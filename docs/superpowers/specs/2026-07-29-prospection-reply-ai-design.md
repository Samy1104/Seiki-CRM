# Prospection reply AI classification — design

Date: 2026-07-29

## Problem

Prospection replies land in `poll-gmail-inbox` (cron, every 5 min), which already
tells a genuine reply apart from a bounce, matches it to a lead, and sets
`leads.sequence_status = 'replied'`. `getFollowUpCandidates()` already excludes
`replied`/`completed` leads. Two things are missing:

1. No read on whether the reply is positive or negative — the lead's pipeline
   stage never moves automatically.
2. A relance already approved/scheduled before the reply lands can still be
   sent — `sendGeneratedEmailViaGmail` never re-checks reply status at send
   time, only whether the draft itself was already sent.

## Scope decisions (confirmed with user)

- Classification is 3-way: `positive` / `negative` / `neutral`. `neutral`
  covers anything ambiguous, an autoresponder, or requiring human judgement —
  the model must never force a guess into positive/negative.
- Fully automatic: classification and stage move happen the moment
  `poll-gmail-inbox` processes the reply, no human confirmation step.
- Default stage mapping is unset (no stage move happens until the user
  configures both dropdowns in Settings).

## 1. Bug fix — stop sends for leads that replied after approval

`sendGeneratedEmailViaGmail` (`supabase/functions/_shared/sendViaGmail.ts`),
right after the existing `statut_envoi === 'sent'` guard: fetch
`leads.sequence_status` for `ge.lead_id`. If it is `replied` or `completed`,
do not send. Set `generated_emails.statut_envoi = 'skipped_replied'` (new
terminal status — not `failed`, since nothing errored) and return a
`SendOutcome` variant `{ success: false, error: '...', skippedReplied: true }`.
Callers (`dispatch-gmail-sends`) already treat any non-success outcome as
`failed++`; that counter is fine to also cover skips, no caller change needed
beyond reading the new field if UI wants to distinguish it later.

## 2. Sentiment classifier

New `supabase/functions/_shared/replySentimentClassifier.ts`, same shape as
the existing `promptBuilder.ts` / `postValidator.ts` pair:

- `buildSentimentPrompt(replyText: string, originalSubject: string): { system: string; user: string }`
  — pure, testable without hitting Gemini.
- `classifyReplySentiment(geminiKey: string, replyText: string, originalSubject: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; reason: string }>`
  — calls the existing shared `callGemini()`, parses strict JSON, validates
  the `sentiment` enum. Throws on malformed output; caller treats as
  non-fatal (see below).

Prompt instructs:
- `positive` — interested, wants to continue, asks for a meeting or more info.
- `negative` — not interested, asks to stop contacting, unsubscribe, hostile.
- `neutral` — ambiguous, out-of-office autoresponder, or anything needing a
  human read. Default here when unsure.

Input: full `extractPlainTextBody(msg)` (not the 500-char preview truncated
for `body_preview`), capped at ~4000 chars before sending to Gemini.

## 3. Wiring into `poll-gmail-inbox`

In the existing reply branch (`processInboundMessage`, `classification ===
'reply'` path), after the inbound `email_logs` insert and the
`sequence_status = 'replied'` update:

1. If `reply_ai_classification_enabled` is `false`, skip entirely.
2. Call `classifyReplySentiment` with the full reply text + subject.
3. On success: update the just-inserted inbound `email_logs` row with
   `reply_sentiment` and `reply_sentiment_reason`. Append the sentiment to
   the `history` entry already being written for this reply (same insert,
   extra `metadata.sentiment` field — no second history row).
4. If sentiment is `positive` or `negative` AND the matching
   `reply_positive_stage_id` / `reply_negative_stage_id` setting is
   configured: `update leads set stage_id = ..., updated_at = now()`.
   `stage_changed_at` is set by the existing DB trigger — no extra field
   needed here, matching how every other stage-move in this codebase works.
5. `neutral`, or a sentiment with no configured target stage: record the
   sentiment for visibility, no stage change.
6. Any failure in steps 2–4 (Gemini timeout, bad JSON, DB error): caught,
   `console.error`'d, and does not affect the rest of `processInboundMessage`
   — same non-blocking-failure convention already used throughout this file
   (e.g. the Message-Id relecture, the threaded-send retry).

## 4. Data model

`app_settings` (existing key/value jsonb pattern, applied ad hoc via
Supabase CLI/dashboard like the rest of this schema — no migrations
directory in this repo):

- `reply_ai_classification_enabled` → `{ enabled: boolean }`, default `true`.
- `reply_positive_stage_id` → `{ stage_id: string | null }`, default unset.
- `reply_negative_stage_id` → `{ stage_id: string | null }`, default unset.

`email_logs`: two new nullable columns —
- `reply_sentiment` (text, `'positive' | 'negative' | 'neutral'`, nullable)
- `reply_sentiment_reason` (text, nullable)

`generated_emails.statut_envoi`: extend the allowed value set with
`'skipped_replied'` (see bug fix above).

## 5. Settings UI

`src/views/settings/ProspectionSettingsTab.tsx` gets a new section,
"Analyse IA des réponses":
- Toggle: activer/désactiver la classification automatique.
- Two stage-picker `<select>`s ("Réponse positive →", "Réponse négative →"),
  options sourced from the same `pipeline_stages` list already loaded in
  `Settings.tsx` for the Pipeline Stages tab (new `pipelineStages` prop
  passed down). Default option: "— Ne pas déplacer —" (maps to `null`).

`settingsService.ts`: extend `ProspectionSettings` interface and
`getProspectionSettings()`/`updateProspectionSettings()` with the three new
fields, following the exact pattern already used for `followup_1_days` etc.

## 6. Testing

- Unit tests (Vitest, same style as `gmailReplyClassifier.test.ts`):
  `buildSentimentPrompt` (pure) and the JSON-parsing/enum-validation logic
  in `classifyReplySentiment`, with a mocked `callGemini`.
- Unit test for the `sendGeneratedEmailViaGmail` guard: replied/completed
  lead → send skipped, `skipped_replied` status set, no Gmail API call made.
- Live end-to-end verification (an actual reply landing, Gemini classifying
  it, the lead's stage actually moving) requires a real test reply against
  the connected Gmail account — flagged as a manual step for the user,
  consistent with how prior prospection work in this repo was verified.
