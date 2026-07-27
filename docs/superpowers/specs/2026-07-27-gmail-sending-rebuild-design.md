# Prospection sending system rebuild: Resend → Gmail API

## Context

The Prospection module currently sends via Resend (see [[project_prospection_audit_fix]] memory), limited to delivering only to the Resend account owner's own inbox because no domain is verified at resend.com/domains. Reply capture works today via Resend's inbound webhook (`resend-webhook`), which fetches full reply content through Resend's API.

This rebuild replaces the **sending, scheduling, and event-tracking** layer with direct Gmail API usage against the user's personal Gmail account. It explicitly does **not** touch the template system (`email_templates`, `templatesService`, `render_template()`), the approval UI (`ValidationTab`/`EmailPreviewCard`), or the follow-up detection logic in `prospectionService.getFollowUpCandidates` — those stay as-is and just end up reading/writing renamed columns.

## Decisions made

- **Account**: personal Gmail via OAuth, not Google Workspace. Same pattern as the existing LinkedIn personal-account integration ([[project_linkedin_scheduler]]).
- **Vendor**: raw Gmail API, not Nylas. No third-party vendor gets OAuth access to the inbox; more code to write in exchange for zero added cost and no data processor.
- **Reply detection**: polling, not Pub/Sub push. Avoids needing a separate Google Cloud Pub/Sub topic and the 7-day `users.watch` renewal chore. A 5-minute poll cadence is close enough to real-time for this volume.
- **Open tracking**: kept as the existing pixel mechanism in `track-email` (unchanged) — Gmail has no open webhook, so this is the only signal for opens on any provider.
- **Bounce detection**: heuristic, via the same polling cron. Gmail has no native bounce webhook; bounces arrive as a reply-like message from `mailer-daemon@`/`postmaster@` or a "Delivery Status Notification" subject, in the same inbox the poller already reads.
- **Scheduling model**: rebuilt, not a straight swap. The core concern raised was cold-email deliverability risk on a personal Gmail account, not the mechanics of dates. The queue becomes a **pacing engine**: warm-up ramp, randomized business-hours send windows, and randomized spacing between sends — not a flat daily counter firing everything back-to-back.
- **Warm-up ramp**: enabled. The account hasn't done bulk cold outreach before, so daily volume increases gradually from a low starting point rather than jumping straight to the target cap.
- **Daily cap**: configurable, exact number deferred to the user; the mechanism must not hardcode a number.
- **Polling cadence**: every 5 minutes.

## Architecture overview

```
┌─────────────────┐   OAuth (one-time)   ┌──────────────────┐
│ gmail-oauth-start │ ───────────────────▶ │ Google consent    │
│ gmail-oauth-callback │◀──────────────── │ screen             │
└─────────────────┘                       └──────────────────┘
        │ stores tokens
        ▼
┌─────────────────┐
│ gmail_accounts    │  (1 row: access/refresh token, last_history_id)
└─────────────────┘
        │
        ├── read by ──▶ send-via-gmail   (sends one generated_emails row)
        │                     ▲
        │                     │ send_at <= now()
        │              ┌──────────────────────┐
        │              │ dispatch-gmail-sends  │  cron, ~2 min
        │              └──────────────────────┘
        │                     ▲
        │              ┌──────────────────────┐
        │              │ schedule-gmail-sends  │  cron, hourly
        │              │ (pacing engine)       │
        │              └──────────────────────┘
        │
        └── read by ──▶ poll-gmail-inbox  (cron, 5 min)
                              │
                              ├─ reply detected  → email_logs 'replied' + history + leads.sequence_status
                              ├─ bounce detected → email_logs 'bounced'
                              └─ advances gmail_accounts.last_history_id
```

`track-email` (pixel) is unchanged and continues to independently mark `email_logs.status = 'opened'`.

## Data model changes

### New table: `gmail_accounts`

Mirrors `linkedin_accounts` (plaintext tokens behind RLS — same accepted risk already documented for that table).

```sql
CREATE TABLE public.gmail_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  access_token     TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  last_history_id  TEXT,              -- Gmail history cursor for polling
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Single-row table in practice (one personal account). RLS: authenticated full access, same policy shape as `linkedin_accounts`.

### `generated_emails` changes

- Drop `resend_message_id`.
- Add `gmail_message_id TEXT`, `gmail_thread_id TEXT`.
- Add `send_at TIMESTAMPTZ` — the pacing engine's computed slot (distinct from `scheduled_at`, which is the earliest-eligible date already set by follow-up logic / auto-draft trigger).
- `statut_envoi` CHECK gains `'scheduled'`:
  `CHECK (statut_envoi IN ('draft', 'approved', 'scheduled', 'sending', 'sent', 'failed'))`
  - `approved`: ready to send, not yet assigned a pacing slot.
  - `scheduled`: pacing engine has assigned `send_at`, waiting for dispatch.

### `email_logs`

No schema change — `message_id` and `in_reply_to` (RFC822 Message-ID) are already the right shape for Gmail's own message IDs.

### New `app_settings` keys

- `gmail_daily_cap`: `{ count: number }` — target ceiling once ramp completes. No default assumed; must be set before automatic sending is enabled.
- `gmail_warmup_start_date`: `{ date: 'YYYY-MM-DD' }` — anchors the ramp curve.
- `gmail_send_window`: `{ days: [1,2,3,4,5], start: '08:00', end: '18:00' }` — business-hours window, weekdays only by default.

## Send pipeline

### `send-via-gmail` (Edge Function, replaces `send-email`'s role for actual delivery)

1. Load the `generated_emails` row + lead's email (same lookups as today's `sendViaResend.ts`).
2. Look up the lead's last outbound `email_logs.message_id`/thread info to set `In-Reply-To` / `References` headers when this is a relance — keeps the conversation threaded in Gmail on both ends.
3. Build a raw RFC822 MIME message (subject, HTML body with tracking pixel — same `buildEmailHtml` logic reused, just no Resend-specific bits), base64url-encode it, POST to `users.messages.send` with the stored OAuth access token (refreshed via `refresh_token` if expired).
4. On success: update `generated_emails.statut_envoi='sent'`, `sent_at`, `gmail_message_id`, `gmail_thread_id`; insert `email_logs` row with `status='sent'`, `message_id` = Gmail's `Message-Id` header value (needed later for threading/reply matching).
5. On failure: same failure-logging pattern as today (`email_logs` row with `status='failed'`, `error_message`), `statut_envoi='failed'`.

### Pacing engine

**`schedule-gmail-sends`** (cron, hourly):

1. Compute today's allowed volume from the warm-up ramp: days since `gmail_warmup_start_date` determine a step (e.g. week 1 low, increasing weekly) capped at `gmail_daily_cap`. Ramp step table is a simple lookup, not hardcoded magic numbers in code — stored as a small config array so the curve can be tuned later without a schema change.
2. Count how many are already `sent` or `scheduled` for today; compute remaining budget.
3. Pull that many `approved` rows, oldest `created_at` first (respects `scheduled_at` floor if set by follow-up logic).
4. For each, compute a random `send_at` inside today's remaining business-hours window (`gmail_send_window`), spaced with random jitter so timestamps aren't evenly distributed (avoids a detectable robotic pattern). Set `statut_envoi='scheduled'`.

**`dispatch-gmail-sends`** (cron, ~2 min):

1. Select `generated_emails` where `statut_envoi='scheduled' AND send_at <= now()`.
2. Call `send-via-gmail` for each, one at a time (sequential, not parallel — avoids bursting Gmail's API and keeps the human-like pacing intent).

Manual mode (the existing `prospection_mode` toggle) still gates whether these crons do anything, same as `flush-send-queue` does today — this behavior is preserved, not rebuilt.

## Reply / bounce polling

### `poll-gmail-inbox` (cron, every 5 minutes)

1. Call `users.history.list` with `startHistoryId = gmail_accounts.last_history_id`, filtered to `messagesAdded`.
2. For each new message in the inbox:
   - Fetch full message (`users.messages.get`, `format=full`).
   - **Bounce check**: sender matches `mailer-daemon@`/`postmaster@`, or subject matches a Delivery Status Notification pattern → find the related outbound `email_logs` row via thread ID, set `status='bounced'`, `error_message` from the DSN body.
   - **Reply check**: message is part of a Gmail thread ID matching a `generated_emails.gmail_thread_id` → this is the same logic `resend-webhook`'s `email.received` branch already implements (find lead by thread → find lead by sender email fallback, set `leads.sequence_status='replied'`, insert `history` row with the reply body preview, update the outbound `email_logs` row to `status='replied'`, insert an inbound `email_logs` row with the full reply content). Reused almost verbatim, only the "fetch full email content" step changes from a Resend API call to the Gmail message already fetched in step 1.
3. Advance and persist `gmail_accounts.last_history_id` to the latest seen, so the next run doesn't reprocess.

Idempotency: same guards as today (`.neq('status', 'replied')` before overwriting, dedup via `message_id` uniqueness on `email_logs`).

## Connect UI

Reuses the exact pattern already built for LinkedIn accounts (`ContenuHeader.tsx` + `linkedinService.oauthConnectUrl`): a pill-shaped `<a>` link styled identically (`Link2`/`CheckCircle2` icon, "Connecter X" / "X (Connecté)" label), pointing at `gmail-oauth-start` instead of `linkedin-oauth-start`. Since there's only one Gmail account (no personal/company split like LinkedIn), it's a single button, not a pair.

- New `gmailService.ts` (mirrors `linkedinService.ts`'s `listAccounts`/`oauthConnectUrl` shape): `listAccount()` reads the single `gmail_accounts` row, `oauthConnectUrl()` builds the link to `gmail-oauth-start`.
- Button placed in `ProspectionHeader.tsx`, next to the existing `ProspectionModeToggle`, in the same row.
- Connected state label shows the connected Gmail address (e.g. "test@gmail.com (Connecté)") rather than a fixed name like "Jaafar"/"Seiki".

**Testing plan**: the user will connect a personal test Gmail address (not `contact@seiki.fr`) through this button first, and exercise the full pipeline — send, warm-up pacing, open pixel, reply polling, bounce detection — end-to-end against that test inbox before ever pointing it at a real prospecting account. No code difference between "test" and "real" Gmail accounts; it's the same OAuth flow against whichever address is connected.

## Prerequisites / manual setup (user)

Not yet done — needs to happen before any of this can run:

1. Create a Google Cloud project (console.cloud.google.com).
2. Enable the Gmail API for that project.
3. Configure the OAuth consent screen as **External + Testing** (no Google verification review needed — testing mode allows the account owner to authorize their own app without publishing), add the personal Gmail address as a test user.
4. Create OAuth 2.0 credentials (Web application type), redirect URI pointing at the new `gmail-oauth-callback` Edge Function URL.
5. Scopes needed: `gmail.send`, `gmail.readonly` (for polling — full read access to the inbox is required to detect replies/bounces in arbitrary threads), `gmail.metadata` is not sufficient since body content must be read.
6. Hand me the client ID + client secret to store as Supabase secrets (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`), same pattern as the LinkedIn app credentials.

This mirrors the LinkedIn OAuth app setup already done once for this project — same shape of work.

## Out of scope (explicitly)

- Template system, `email_templates`, `render_template()`.
- Follow-up cadence logic (`followup_1_days`/`followup_2_days`/`archive_after_followups`) — untouched, just now schedules against the new pacing engine instead of the flat quota.
- Approval UI (`ValidationTab`, `EmailPreviewCard`) — same approve action, just routes to the new pipeline underneath.
- `daily_send_quota` / `flush-send-queue` — fully replaced by `gmail_daily_cap` + the two new cron functions; will be removed rather than left dead.
