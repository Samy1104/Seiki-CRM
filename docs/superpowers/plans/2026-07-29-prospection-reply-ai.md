# Prospection Reply AI Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify incoming prospect replies as positive/negative/neutral via Gemini, automatically move the lead's pipeline stage per a user-configured mapping, and close the gap that let an already-approved relance send after the lead had replied.

**Architecture:** Extend the existing `poll-gmail-inbox` cron function (already detects genuine replies and matches them to a lead) with a Gemini-based sentiment call and a stage update. Extract the reply/skip decision and the stage-mapping decision into small pure, unit-tested modules under `supabase/functions/_shared/`, matching this codebase's existing convention where only pure logic is unit tested and DB/network-heavy orchestration (`poll-gmail-inbox/index.ts`, `sendViaGmail.ts`) is verified live.

**Tech Stack:** Deno edge functions (Supabase), Vitest for `_shared/*.test.ts`, React + TypeScript for the Settings UI, Postgres/Supabase (schema applied by hand via SQL Editor — this repo has no migrations directory, see `archive/schema_*.sql` for the existing convention).

## Global Constraints

- No migrations directory exists in this repo — schema changes are SQL files under `archive/` applied manually via Supabase SQL Editor, following the exact pattern in `archive/schema_gmail_settings_addon.sql` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `INSERT ... ON CONFLICT (key) DO NOTHING` for `app_settings`).
- Only pure, side-effect-free logic gets a `.test.ts` file in this codebase (see `gmailReplyClassifier.test.ts`, `warmupRamp.test.ts`, `sendWindow.test.ts`). `poll-gmail-inbox/index.ts`, `dispatch-gmail-sends/index.ts`, and `sendViaGmail.ts` have no test files today and this plan does not add any — new logic that needs testing must be extracted into a pure module first.
- Any Gemini/network/DB failure inside the reply-classification path must be caught and logged, never allowed to break the surrounding reply processing (`sequence_status`, `history`, `email_logs` writes) — this mirrors the non-blocking-failure convention already used throughout `poll-gmail-inbox/index.ts` (e.g. the Message-Id relecture, the threaded-send retry in `sendViaGmail.ts`).
- Deno-side `_shared/` files import each other with explicit `.ts` extensions (e.g. `from "./gmailApi.ts"`) — follow this exactly, Vite/Vitest resolve it fine.
- Default configuration is inert: `reply_ai_classification_enabled` defaults to `true` but both stage-mapping settings default to `null` — no lead ever moves stage until the user configures both dropdowns in Settings.

---

### Task 1: Database schema addon (manual SQL, applied by the user)

**Files:**
- Create: `archive/schema_reply_sentiment_addon.sql`

**Interfaces:**
- Produces: `email_logs.reply_sentiment` (`text`, nullable, `CHECK IN ('positive','negative','neutral')`), `email_logs.reply_sentiment_reason` (`text`, nullable), `generated_emails.statut_envoi` CHECK extended with `'skipped_replied'`, and three new `app_settings` rows: `reply_ai_classification_enabled`, `reply_positive_stage_id`, `reply_negative_stage_id`.

- [ ] **Step 1: Write the SQL addon file**

```sql
-- ============================================================
-- SEIKI CRM — Add-on classification IA des réponses (sentiment)
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS schema_gmail_addon.sql et schema_gmail_settings_addon.sql
-- ============================================================

-- 1. email_logs — résultat de la classification IA sur les réponses entrantes
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS reply_sentiment TEXT
    CHECK (reply_sentiment IN ('positive', 'negative', 'neutral')),
  ADD COLUMN IF NOT EXISTS reply_sentiment_reason TEXT;

COMMENT ON COLUMN public.email_logs.reply_sentiment IS 'Classification IA (Gemini) du ton d''une réponse entrante — NULL si non classifié ou non applicable';

-- 2. generated_emails.statut_envoi — nouveau statut terminal 'skipped_replied'
--    (envoi annulé parce que le lead a répondu entre l'approbation et l'envoi
--    de la relance — ce n'est pas un échec, donc pas 'failed')
ALTER TABLE public.generated_emails DROP CONSTRAINT IF EXISTS generated_emails_statut_envoi_check;
ALTER TABLE public.generated_emails ADD CONSTRAINT generated_emails_statut_envoi_check
  CHECK (statut_envoi IN ('draft', 'approved', 'scheduled', 'sending', 'sent', 'failed', 'skipped_replied'));

-- 3. app_settings — nouveaux réglages (aucun déplacement d'étape tant que les
--    deux stage_id ne sont pas configurés dans Paramètres > Prospection)
INSERT INTO public.app_settings (key, value, label, category) VALUES
  ('reply_ai_classification_enabled', '{"enabled": true}', 'Classification IA des réponses activée', 'prospection'),
  ('reply_positive_stage_id', '{"stage_id": null}', 'Étape pipeline si réponse positive', 'prospection'),
  ('reply_negative_stage_id', '{"stage_id": null}', 'Étape pipeline si réponse négative', 'prospection')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Apply it to the live database**

In the Supabase dashboard: SQL Editor → paste the file contents → Run.

- [ ] **Step 3: Verify**

Run in the same SQL Editor:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'email_logs' AND column_name LIKE 'reply_sentiment%';

SELECT key, value FROM public.app_settings WHERE key LIKE 'reply_%';
```

Expected: 2 rows from the first query (`reply_sentiment`, `reply_sentiment_reason`), 3 rows from the second.

- [ ] **Step 4: Commit**

```bash
git add archive/schema_reply_sentiment_addon.sql
git commit -m "feat(db): add reply sentiment columns and stage-mapping settings"
```

---

### Task 2: Sentiment classifier (`_shared/replySentimentClassifier.ts`)

**Files:**
- Create: `supabase/functions/_shared/replySentimentClassifier.ts`
- Test: `supabase/functions/_shared/replySentimentClassifier.test.ts`

**Interfaces:**
- Consumes: `callGemini(geminiKey: string, options: { systemPrompt?: string; userPrompt: string; temperature: number }): Promise<{ rawText: string; generationMs: number; usageMetadata: unknown }>` from `./geminiApi.ts` (existing, unchanged).
- Produces: `type ReplySentiment = 'positive' | 'negative' | 'neutral'`; `interface SentimentResult { sentiment: ReplySentiment; reason: string }`; `buildSentimentPrompt(replyText: string, originalSubject: string): { system: string; user: string }`; `parseSentimentResponse(rawText: string): SentimentResult`; `classifyReplySentiment(geminiKey: string, replyText: string, originalSubject: string): Promise<SentimentResult>`. Task 5 imports `classifyReplySentiment` and `type SentimentResult`.

- [ ] **Step 1: Write the failing tests**

```typescript
// supabase/functions/_shared/replySentimentClassifier.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCallGemini } = vi.hoisted(() => ({ mockCallGemini: vi.fn() }));
vi.mock('./geminiApi.ts', () => ({ callGemini: mockCallGemini }));

import {
  buildSentimentPrompt,
  parseSentimentResponse,
  classifyReplySentiment,
} from './replySentimentClassifier';

describe('buildSentimentPrompt', () => {
  it('includes the original subject and reply text in the user prompt', () => {
    const { user } = buildSentimentPrompt("Oui je suis intéressé, appelons-nous demain", 'Une idée pour votre entreprise');
    expect(user).toContain('Une idée pour votre entreprise');
    expect(user).toContain("Oui je suis intéressé, appelons-nous demain");
  });

  it('truncates reply text longer than 4000 characters', () => {
    const longText = 'a'.repeat(5000);
    const { user } = buildSentimentPrompt(longText, 'Sujet');
    expect(user).toContain('a'.repeat(4000));
    expect(user).not.toContain('a'.repeat(4001));
  });

  it('instructs the model to default to neutral when unsure', () => {
    const { system } = buildSentimentPrompt('texte', 'sujet');
    expect(system).toContain('neutral');
    expect(system.toLowerCase()).toContain('doute');
  });
});

describe('parseSentimentResponse', () => {
  it('parses a valid positive response', () => {
    expect(parseSentimentResponse('{"sentiment": "positive", "reason": "Demande un rendez-vous"}'))
      .toEqual({ sentiment: 'positive', reason: 'Demande un rendez-vous' });
  });

  it('parses a valid negative response', () => {
    expect(parseSentimentResponse('{"sentiment": "negative", "reason": "Demande d\'arrêter les emails"}').sentiment)
      .toBe('negative');
  });

  it('parses a valid neutral response', () => {
    expect(parseSentimentResponse('{"sentiment": "neutral", "reason": "Réponse automatique absence bureau"}').sentiment)
      .toBe('neutral');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSentimentResponse('not json')).toThrow('JSON invalide');
  });

  it('throws on an unrecognized sentiment value', () => {
    expect(() => parseSentimentResponse('{"sentiment": "maybe", "reason": "test"}')).toThrow('Sentiment invalide');
  });

  it('throws when reason is missing', () => {
    expect(() => parseSentimentResponse('{"sentiment": "neutral"}')).toThrow('Raison manquante');
  });
});

describe('classifyReplySentiment', () => {
  beforeEach(() => {
    mockCallGemini.mockReset();
  });

  it('calls callGemini with the built prompts and returns the parsed result', async () => {
    mockCallGemini.mockResolvedValue({ rawText: '{"sentiment": "positive", "reason": "Intéressé"}', generationMs: 10, usageMetadata: null });
    const result = await classifyReplySentiment('fake-key', "Oui ça m'intéresse", 'Sujet original');
    expect(result).toEqual({ sentiment: 'positive', reason: 'Intéressé' });
    expect(mockCallGemini).toHaveBeenCalledWith('fake-key', expect.objectContaining({ temperature: 0.2 }));
  });

  it('propagates a parse error when Gemini returns malformed JSON', async () => {
    mockCallGemini.mockResolvedValue({ rawText: 'not json', generationMs: 10, usageMetadata: null });
    await expect(classifyReplySentiment('fake-key', 'texte', 'sujet')).rejects.toThrow('JSON invalide');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/replySentimentClassifier.test.ts`
Expected: FAIL — `Cannot find module './replySentimentClassifier'`

- [ ] **Step 3: Write the implementation**

```typescript
// supabase/functions/_shared/replySentimentClassifier.ts
// ============================================================
// _shared/replySentimentClassifier.ts
// Classification IA (Gemini) du sentiment d'une réponse de
// prospect : positive / negative / neutral. Prompt et parsing
// sont purs et testables séparément de l'appel réseau Gemini.
// ============================================================

import { callGemini } from "./geminiApi.ts";

export type ReplySentiment = "positive" | "negative" | "neutral";

export interface SentimentResult {
  sentiment: ReplySentiment;
  reason: string;
}

const VALID_SENTIMENTS: ReplySentiment[] = ["positive", "negative", "neutral"];
const MAX_REPLY_CHARS = 4000;

export function buildSentimentPrompt(replyText: string, originalSubject: string): { system: string; user: string } {
  const truncated = replyText.length > MAX_REPLY_CHARS ? replyText.slice(0, MAX_REPLY_CHARS) : replyText;

  const system = `Tu analyses les réponses reçues par un commercial suite à un email de prospection B2B.
Classe la réponse du prospect en UNE seule catégorie :
- "positive" : le prospect est intéressé, veut continuer l'échange, pose des questions sur l'offre, propose un rendez-vous.
- "negative" : le prospect n'est pas intéressé, demande d'arrêter d'être contacté, se désabonne, ou répond de façon hostile.
- "neutral" : réponse ambiguë, réponse automatique (absence du bureau, hors-sujet), ou tout cas nécessitant un jugement humain.
En cas de doute, choisis TOUJOURS "neutral" plutôt que de deviner.

Réponds UNIQUEMENT avec ce JSON valide (aucun texte avant ou après) :
{"sentiment": "positive" | "negative" | "neutral", "reason": "une phrase courte justifiant le choix"}`;

  const user = `Sujet original de l'email envoyé : ${originalSubject}

Réponse reçue du prospect :
"""
${truncated}
"""`;

  return { system, user };
}

export function parseSentimentResponse(rawText: string): SentimentResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`JSON invalide retourné par Gemini pour la classification de sentiment : ${rawText.substring(0, 300)}`);
  }

  const candidate = parsed as Partial<SentimentResult>;
  if (!candidate.sentiment || !VALID_SENTIMENTS.includes(candidate.sentiment as ReplySentiment)) {
    throw new Error(`Sentiment invalide retourné par Gemini : ${JSON.stringify(parsed).substring(0, 300)}`);
  }
  if (typeof candidate.reason !== "string" || !candidate.reason) {
    throw new Error(`Raison manquante dans la réponse Gemini : ${JSON.stringify(parsed).substring(0, 300)}`);
  }

  return { sentiment: candidate.sentiment as ReplySentiment, reason: candidate.reason };
}

export async function classifyReplySentiment(
  geminiKey: string,
  replyText: string,
  originalSubject: string,
): Promise<SentimentResult> {
  const { system, user } = buildSentimentPrompt(replyText, originalSubject);
  const { rawText } = await callGemini(geminiKey, { systemPrompt: system, userPrompt: user, temperature: 0.2 });
  return parseSentimentResponse(rawText);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/replySentimentClassifier.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/replySentimentClassifier.ts supabase/functions/_shared/replySentimentClassifier.test.ts
git commit -m "feat: add Gemini-based reply sentiment classifier"
```

---

### Task 3: Stage resolver (`_shared/replyStageResolver.ts`)

**Files:**
- Create: `supabase/functions/_shared/replyStageResolver.ts`
- Test: `supabase/functions/_shared/replyStageResolver.test.ts`

**Interfaces:**
- Consumes: `type ReplySentiment` from `./replySentimentClassifier.ts` (Task 2).
- Produces: `interface ReplyStageSettings { positiveStageId: string | null; negativeStageId: string | null }`; `resolveStageIdForSentiment(sentiment: ReplySentiment, settings: ReplyStageSettings): string | null`. Task 5 imports `resolveStageIdForSentiment`.

- [ ] **Step 1: Write the failing tests**

```typescript
// supabase/functions/_shared/replyStageResolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveStageIdForSentiment } from './replyStageResolver';

describe('resolveStageIdForSentiment', () => {
  it('returns the configured positive stage id for a positive sentiment', () => {
    expect(resolveStageIdForSentiment('positive', { positiveStageId: 'stage-a', negativeStageId: 'stage-b' })).toBe('stage-a');
  });

  it('returns the configured negative stage id for a negative sentiment', () => {
    expect(resolveStageIdForSentiment('negative', { positiveStageId: 'stage-a', negativeStageId: 'stage-b' })).toBe('stage-b');
  });

  it('returns null for a neutral sentiment regardless of configuration', () => {
    expect(resolveStageIdForSentiment('neutral', { positiveStageId: 'stage-a', negativeStageId: 'stage-b' })).toBeNull();
  });

  it('returns null when the matching stage is not configured', () => {
    expect(resolveStageIdForSentiment('positive', { positiveStageId: null, negativeStageId: 'stage-b' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/replyStageResolver.test.ts`
Expected: FAIL — `Cannot find module './replyStageResolver'`

- [ ] **Step 3: Write the implementation**

```typescript
// supabase/functions/_shared/replyStageResolver.ts
// ============================================================
// _shared/replyStageResolver.ts
// Décide vers quelle étape de pipeline déplacer un lead suite à
// la classification IA d'une réponse — pure, testable sans DB.
// ============================================================

import type { ReplySentiment } from "./replySentimentClassifier.ts";

export interface ReplyStageSettings {
  positiveStageId: string | null;
  negativeStageId: string | null;
}

export function resolveStageIdForSentiment(
  sentiment: ReplySentiment,
  settings: ReplyStageSettings,
): string | null {
  if (sentiment === "positive") return settings.positiveStageId;
  if (sentiment === "negative") return settings.negativeStageId;
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/replyStageResolver.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/replyStageResolver.ts supabase/functions/_shared/replyStageResolver.test.ts
git commit -m "feat: add pure stage-mapping resolver for reply sentiment"
```

---

### Task 4: Stop relances for leads that already replied (`sendGuard.ts` + `sendViaGmail.ts`)

**Files:**
- Create: `supabase/functions/_shared/sendGuard.ts`
- Test: `supabase/functions/_shared/sendGuard.test.ts`
- Modify: `supabase/functions/_shared/sendViaGmail.ts:14-38` (types), `:86-102` (guard + merged query)

**Interfaces:**
- Produces: `type SequenceStatus = 'idle' | 'active' | 'paused' | 'completed' | 'replied'`; `shouldSkipSendForLeadStatus(sequenceStatus: SequenceStatus): boolean`.
- Modifies `SendOutcome` (in `sendViaGmail.ts`) to add `skippedReplied?: boolean` on the failure variant.

- [ ] **Step 1: Write the failing test**

```typescript
// supabase/functions/_shared/sendGuard.test.ts
import { describe, it, expect } from 'vitest';
import { shouldSkipSendForLeadStatus } from './sendGuard';

describe('shouldSkipSendForLeadStatus', () => {
  it('skips sending when the lead has replied', () => {
    expect(shouldSkipSendForLeadStatus('replied')).toBe(true);
  });

  it('skips sending when the sequence is already completed', () => {
    expect(shouldSkipSendForLeadStatus('completed')).toBe(true);
  });

  it('allows sending for an idle lead', () => {
    expect(shouldSkipSendForLeadStatus('idle')).toBe(false);
  });

  it('allows sending for an active lead', () => {
    expect(shouldSkipSendForLeadStatus('active')).toBe(false);
  });

  it('allows sending for a paused lead', () => {
    expect(shouldSkipSendForLeadStatus('paused')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/sendGuard.test.ts`
Expected: FAIL — `Cannot find module './sendGuard'`

- [ ] **Step 3: Write the implementation**

```typescript
// supabase/functions/_shared/sendGuard.ts
// ============================================================
// _shared/sendGuard.ts
// Décide si un envoi (initial ou relance) doit être annulé parce
// que le lead a déjà répondu ou que sa séquence est terminée —
// pure, testable sans DB/réseau.
// ============================================================

export type SequenceStatus = "idle" | "active" | "paused" | "completed" | "replied";

export function shouldSkipSendForLeadStatus(sequenceStatus: SequenceStatus): boolean {
  return sequenceStatus === "replied" || sequenceStatus === "completed";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/_shared/sendGuard.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Wire the guard into `sendViaGmail.ts`**

In `supabase/functions/_shared/sendViaGmail.ts`, add the import near the top (after the existing `gmailMessageParser.ts` import):

```typescript
import { shouldSkipSendForLeadStatus, type SequenceStatus } from "./sendGuard.ts";
```

Replace the `LeadEmail` interface:

```typescript
interface LeadEmail {
  email: string;
  contact_name: string;
  sequence_status: string;
}
```

Replace the `SendOutcome` type:

```typescript
export type SendOutcome =
  | { success: true; gmailMessageId: string; gmailThreadId: string; sentAt: string; to: string }
  | { success: false; error: string; alreadySent?: boolean; skippedReplied?: boolean };
```

Replace this block (currently lines 92–100):

```typescript
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("email, contact_name")
    .eq("id", ge.lead_id)
    .single();

  if (leadErr || !lead?.email) {
    return { success: false, error: `Lead sans email valide : ${leadErr?.message}` };
  }

  const leadData = lead as LeadEmail;
```

with:

```typescript
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("email, contact_name, sequence_status")
    .eq("id", ge.lead_id)
    .single();

  if (leadErr || !lead?.email) {
    return { success: false, error: `Lead sans email valide : ${leadErr?.message}` };
  }

  if (shouldSkipSendForLeadStatus(lead.sequence_status as SequenceStatus)) {
    await supabase.from("generated_emails").update({ statut_envoi: "skipped_replied" }).eq("id", generatedEmailId);
    return {
      success: false,
      error: "Envoi annulé : le lead a déjà répondu ou la séquence est terminée",
      skippedReplied: true,
    };
  }

  const leadData = lead as LeadEmail;
```

- [ ] **Step 6: Run the full shared test suite to confirm nothing broke**

Run: `npx vitest run supabase/functions/_shared`
Expected: PASS, no regressions

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/sendGuard.ts supabase/functions/_shared/sendGuard.test.ts supabase/functions/_shared/sendViaGmail.ts
git commit -m "fix: stop sending a relance once the lead has replied since it was scheduled"
```

---

### Task 5: Wire sentiment classification into `poll-gmail-inbox`

**Files:**
- Modify: `supabase/functions/poll-gmail-inbox/index.ts`

**Interfaces:**
- Consumes: `classifyReplySentiment`, `type SentimentResult` (Task 2); `resolveStageIdForSentiment` (Task 3).
- No automated test for this file (orchestration/network code — see Global Constraints); verified live per Step 6 below.

- [ ] **Step 1: Add imports**

At the top of `supabase/functions/poll-gmail-inbox/index.ts`, after the existing `classifyInboundMessage` import:

```typescript
import { classifyReplySentiment, type SentimentResult } from "../_shared/replySentimentClassifier.ts";
import { resolveStageIdForSentiment } from "../_shared/replyStageResolver.ts";
```

- [ ] **Step 2: Add the settings loader and its type**

Add this near the top of the file, after the `GmailAccount` interface:

```typescript
interface ReplyClassificationSettings {
  enabled: boolean;
  positiveStageId: string | null;
  negativeStageId: string | null;
  geminiKey: string | null;
}

async function loadReplyClassificationSettings(
  supabase: ReturnType<typeof createClient>,
): Promise<ReplyClassificationSettings> {
  const { data: enabledSetting } = await supabase.from("app_settings").select("value").eq("key", "reply_ai_classification_enabled").maybeSingle();
  const { data: positiveSetting } = await supabase.from("app_settings").select("value").eq("key", "reply_positive_stage_id").maybeSingle();
  const { data: negativeSetting } = await supabase.from("app_settings").select("value").eq("key", "reply_negative_stage_id").maybeSingle();

  return {
    enabled: (enabledSetting?.value as { enabled?: boolean } | null)?.enabled ?? false,
    positiveStageId: (positiveSetting?.value as { stage_id?: string | null } | null)?.stage_id ?? null,
    negativeStageId: (negativeSetting?.value as { stage_id?: string | null } | null)?.stage_id ?? null,
    geminiKey: Deno.env.get("GEMINI_API_KEY") ?? null,
  };
}
```

- [ ] **Step 3: Load settings once per poll cycle and thread them through**

Find this line inside `serve()`:

```typescript
    const acc = account as GmailAccount;
```

Add right after it:

```typescript

    const replySettings = await loadReplyClassificationSettings(supabase);
```

Find the loop that processes messages:

```typescript
        const outcome = await processInboundMessage(supabase, msg, acc.email);
```

Replace with:

```typescript
        const outcome = await processInboundMessage(supabase, msg, acc.email, replySettings);
```

Update the `processInboundMessage` signature:

```typescript
async function processInboundMessage(
  supabase: ReturnType<typeof createClient>,
  msg: GmailMessage,
  accountEmail: string,
  replySettings: ReplyClassificationSettings,
): Promise<"reply" | "bounce" | "ignored"> {
```

- [ ] **Step 4: Classify the reply and resolve the target stage**

Find this block inside `processInboundMessage` (the `classification === 'reply'` path):

```typescript
  const textBody = extractPlainTextBody(msg);
  const textBodyPreview = textBody.length > 500 ? textBody.substring(0, 500) + "..." : textBody;
```

Replace with:

```typescript
  const textBody = extractPlainTextBody(msg);
  const textBodyPreview = textBody.length > 500 ? textBody.substring(0, 500) + "..." : textBody;

  // Classification IA du sentiment — best-effort : un échec Gemini (timeout,
  // JSON invalide, clé manquante) ne doit jamais empêcher le traitement de la
  // réponse elle-même (sequence_status, history, email_logs ci-dessous).
  let sentimentResult: SentimentResult | null = null;
  if (replySettings.enabled && replySettings.geminiKey) {
    try {
      sentimentResult = await classifyReplySentiment(replySettings.geminiKey, textBody, subject);
    } catch (err) {
      console.error("[poll-gmail-inbox] Reply sentiment classification failed (non-blocking):", err instanceof Error ? err.message : err);
    }
  }

  if (sentimentResult) {
    const targetStageId = resolveStageIdForSentiment(sentimentResult.sentiment, {
      positiveStageId: replySettings.positiveStageId,
      negativeStageId: replySettings.negativeStageId,
    });
    if (targetStageId) {
      const { error: stageUpdateErr } = await supabase.from("leads").update({ stage_id: targetStageId, updated_at: now }).eq("id", lead.id);
      if (stageUpdateErr) console.error("[poll-gmail-inbox] Failed to update lead stage from reply sentiment:", stageUpdateErr.message);
    }
  }

  const sentimentNote = sentimentResult
    ? `\n\n[IA] Sentiment détecté : ${sentimentResult.sentiment} — ${sentimentResult.reason}`
    : "";
```

- [ ] **Step 5: Record the sentiment on the history entry**

Find the history insert block:

```typescript
  if (!existingHistory) {
    const { error: historyInsertErr } = await supabase.from("history").insert([{
      lead_id: lead.id,
      action_type: "email_received",
      content: `Email reçu de ${lead.contact_name || senderEmail} : ${subject}\n\n${textBodyPreview}`,
      metadata: { subject, from: fromHeader, gmail_message_id: msg.id },
      is_auto: true,
    }]);
    if (historyInsertErr) console.error("[poll-gmail-inbox] Failed to insert history entry:", historyInsertErr.message);
  }
```

Replace with:

```typescript
  if (!existingHistory) {
    const { error: historyInsertErr } = await supabase.from("history").insert([{
      lead_id: lead.id,
      action_type: "email_received",
      content: `Email reçu de ${lead.contact_name || senderEmail} : ${subject}\n\n${textBodyPreview}${sentimentNote}`,
      metadata: {
        subject,
        from: fromHeader,
        gmail_message_id: msg.id,
        ...(sentimentResult ? { sentiment: sentimentResult.sentiment, sentiment_reason: sentimentResult.reason } : {}),
      },
      is_auto: true,
    }]);
    if (historyInsertErr) console.error("[poll-gmail-inbox] Failed to insert history entry:", historyInsertErr.message);
  }
```

- [ ] **Step 6: Record the sentiment on the inbound `email_logs` row**

Find the inbound insert block:

```typescript
  const { error: inboundInsertErr } = await supabase.from("email_logs").insert([{
    lead_id: lead.id,
    direction: "inbound",
    from_email: senderEmail,
    to_email: getHeader(msg, "To") ?? "",
    subject,
    body_preview: textBodyPreview,
    body_html: textBody,
    message_id: msg.id,
    gmail_thread_id: msg.threadId,
    in_reply_to: getHeader(msg, "In-Reply-To"),
    status: "replied",
    received_at: now,
    generated_email_id: outboundLog.generated_email_id,
  }]);
```

Replace with:

```typescript
  const { error: inboundInsertErr } = await supabase.from("email_logs").insert([{
    lead_id: lead.id,
    direction: "inbound",
    from_email: senderEmail,
    to_email: getHeader(msg, "To") ?? "",
    subject,
    body_preview: textBodyPreview,
    body_html: textBody,
    message_id: msg.id,
    gmail_thread_id: msg.threadId,
    in_reply_to: getHeader(msg, "In-Reply-To"),
    status: "replied",
    received_at: now,
    generated_email_id: outboundLog.generated_email_id,
    reply_sentiment: sentimentResult?.sentiment ?? null,
    reply_sentiment_reason: sentimentResult?.reason ?? null,
  }]);
```

- [ ] **Step 7: Manual live verification (no automated test for this file)**

1. Confirm Task 1's SQL ran (settings rows exist, columns exist).
2. In Settings > Prospection, leave the two stage dropdowns unset, confirm `reply_ai_classification_enabled` toggle is on.
3. Send a real test email through the connected Gmail account to a lead's address (or use `send-test-email` to your own connected inbox, then reply to it from that same inbox — see the existing self-send guard in this file for why the sender must differ from the connected account).
4. Reply to it with an unambiguous positive message ("Oui, ça m'intéresse, appelons-nous").
5. Wait for the next `poll-gmail-inbox` cron tick (or trigger it manually if there's a manual-trigger button in the UI/via `curl`).
6. Check `email_logs` for the inbound row: `reply_sentiment` should be `'positive'`, `reply_sentiment_reason` populated.
7. Check the lead's `history`: the `email_received` entry should end with `[IA] Sentiment détecté : positive — ...`.
8. Go back to Settings > Prospection, set the positive-reply stage to some stage, repeat with a new test reply, confirm the lead's `stage_id` actually changes this time.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/poll-gmail-inbox/index.ts
git commit -m "feat: classify reply sentiment and move lead stage automatically"
```

---

### Task 6: Settings service — new fields

**Files:**
- Modify: `src/services/settingsService.ts`

**Interfaces:**
- Modifies `AppSetting['value']` to add `stage_id?: string | null`.
- Modifies `ProspectionSettings` to add `reply_ai_classification_enabled: boolean`, `reply_positive_stage_id: string | null`, `reply_negative_stage_id: string | null`.
- Task 7/8 consume these three new fields by name, exactly as spelled here.

No automated test — this mirrors the existing untested passthrough for `followup_1_days` etc.; there is no `settingsService.test.ts` in this repo today.

- [ ] **Step 1: Extend `AppSetting['value']`**

Find:

```typescript
export interface AppSetting {
  id: string;
  key: string;
  value: {
    days?: number | number[];
    name?: string;
    enabled?: boolean;
    count?: number;
    mode?: string;
    date?: string;
    start?: string;
    end?: string;
  };
```

Replace with:

```typescript
export interface AppSetting {
  id: string;
  key: string;
  value: {
    days?: number | number[];
    name?: string;
    enabled?: boolean;
    count?: number;
    mode?: string;
    date?: string;
    start?: string;
    end?: string;
    stage_id?: string | null;
  };
```

- [ ] **Step 2: Extend `ProspectionSettings`**

Find:

```typescript
export interface ProspectionSettings {
  prospection_mode: 'manual' | 'auto';
  followup_1_days: number;
  followup_2_days: number;
  archive_after_followups: number;
  gmail_daily_cap: number | null;
  gmail_warmup_start_date: string | null;
  gmail_send_window: { days: number[]; start: string; end: string };
  gmail_from_name: string;
}
```

Replace with:

```typescript
export interface ProspectionSettings {
  prospection_mode: 'manual' | 'auto';
  followup_1_days: number;
  followup_2_days: number;
  archive_after_followups: number;
  gmail_daily_cap: number | null;
  gmail_warmup_start_date: string | null;
  gmail_send_window: { days: number[]; start: string; end: string };
  gmail_from_name: string;
  reply_ai_classification_enabled: boolean;
  reply_positive_stage_id: string | null;
  reply_negative_stage_id: string | null;
}
```

- [ ] **Step 3: Populate the new fields in `getProspectionSettings()`**

Find the `return` inside `getProspectionSettings()`:

```typescript
      gmail_from_name: (find('gmail_from_name')?.name as string) ?? 'Seiki CRM',
    };
  },
```

Replace with:

```typescript
      gmail_from_name: (find('gmail_from_name')?.name as string) ?? 'Seiki CRM',
      reply_ai_classification_enabled: (find('reply_ai_classification_enabled')?.enabled as boolean) ?? true,
      reply_positive_stage_id: (find('reply_positive_stage_id')?.stage_id as string | null | undefined) ?? null,
      reply_negative_stage_id: (find('reply_negative_stage_id')?.stage_id as string | null | undefined) ?? null,
    };
  },
```

- [ ] **Step 4: Persist the new fields in `updateProspectionSettings()`**

Find:

```typescript
    if (updates.gmail_from_name !== undefined) jobs.push(this.updateSetting('gmail_from_name', { name: updates.gmail_from_name }));
    await Promise.all(jobs);
```

Replace with:

```typescript
    if (updates.gmail_from_name !== undefined) jobs.push(this.updateSetting('gmail_from_name', { name: updates.gmail_from_name }));
    if (updates.reply_ai_classification_enabled !== undefined) jobs.push(this.updateSetting('reply_ai_classification_enabled', { enabled: updates.reply_ai_classification_enabled }));
    if (updates.reply_positive_stage_id !== undefined) jobs.push(this.updateSetting('reply_positive_stage_id', { stage_id: updates.reply_positive_stage_id }));
    if (updates.reply_negative_stage_id !== undefined) jobs.push(this.updateSetting('reply_negative_stage_id', { stage_id: updates.reply_negative_stage_id }));
    await Promise.all(jobs);
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no new errors (existing consumers of `ProspectionSettings`/`AppSetting` are updated in Tasks 7–8 next; if you run this before those tasks, expect errors only in `ProspectionSettingsTab.tsx`/`Settings.tsx` for missing new props — not in `settingsService.ts` itself).

- [ ] **Step 6: Commit**

```bash
git add src/services/settingsService.ts
git commit -m "feat: add reply sentiment settings to settingsService"
```

---

### Task 7: Settings UI — new section in `ProspectionSettingsTab.tsx`

**Files:**
- Modify: `src/views/settings/ProspectionSettingsTab.tsx`

**Interfaces:**
- Consumes: `PipelineStage` type from `../../services/settingsService` (existing).
- Produces new props consumed by Task 8: `pipelineStages: PipelineStage[]`, `replyAiClassificationEnabled: boolean`, `replyPositiveStageId: string | null`, `replyNegativeStageId: string | null`, `onReplyAiClassificationEnabledChange: (v: boolean) => void`, `onReplyPositiveStageIdChange: (v: string | null) => void`, `onReplyNegativeStageIdChange: (v: string | null) => void`.

No automated test — no `ProspectionSettingsTab.test.tsx` exists in this repo for any of its existing fields either.

- [ ] **Step 1: Add the new props to the interface and destructure them**

Find:

```typescript
import { Save, ShieldCheck, MailCheck } from 'lucide-react';

interface ProspectionSettingsTabProps {
  followup1Days: number;
  followup2Days: number;
  archiveAfter: number;
  gmailDailyCap: number | null;
  gmailWarmupStartDate: string | null;
  gmailWindowStart: string;
  gmailWindowEnd: string;
  gmailFromName: string;
  onFollowup1DaysChange: (v: number) => void;
  onFollowup2DaysChange: (v: number) => void;
  onArchiveAfterChange: (v: number) => void;
  onGmailDailyCapChange: (v: number | null) => void;
  onGmailWarmupStartDateChange: (v: string | null) => void;
  onGmailWindowStartChange: (v: string) => void;
  onGmailWindowEndChange: (v: string) => void;
  onGmailFromNameChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}
```

Replace with:

```typescript
import { Save, ShieldCheck, MailCheck, Sparkles } from 'lucide-react';
import type { PipelineStage } from '../../services/settingsService';

interface ProspectionSettingsTabProps {
  followup1Days: number;
  followup2Days: number;
  archiveAfter: number;
  gmailDailyCap: number | null;
  gmailWarmupStartDate: string | null;
  gmailWindowStart: string;
  gmailWindowEnd: string;
  gmailFromName: string;
  pipelineStages: PipelineStage[];
  replyAiClassificationEnabled: boolean;
  replyPositiveStageId: string | null;
  replyNegativeStageId: string | null;
  onFollowup1DaysChange: (v: number) => void;
  onFollowup2DaysChange: (v: number) => void;
  onArchiveAfterChange: (v: number) => void;
  onGmailDailyCapChange: (v: number | null) => void;
  onGmailWarmupStartDateChange: (v: string | null) => void;
  onGmailWindowStartChange: (v: string) => void;
  onGmailWindowEndChange: (v: string) => void;
  onGmailFromNameChange: (v: string) => void;
  onReplyAiClassificationEnabledChange: (v: boolean) => void;
  onReplyPositiveStageIdChange: (v: string | null) => void;
  onReplyNegativeStageIdChange: (v: string | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}
```

Find the component's destructured props opening:

```typescript
export const ProspectionSettingsTab: React.FC<ProspectionSettingsTabProps> = ({
  followup1Days,
  followup2Days,
  archiveAfter,
  gmailDailyCap,
  gmailWarmupStartDate,
  gmailWindowStart,
  gmailWindowEnd,
  gmailFromName,
  onFollowup1DaysChange,
  onFollowup2DaysChange,
  onArchiveAfterChange,
  onGmailDailyCapChange,
  onGmailWarmupStartDateChange,
  onGmailWindowStartChange,
  onGmailWindowEndChange,
  onGmailFromNameChange,
  onSubmit,
}) => (
```

Replace with:

```typescript
export const ProspectionSettingsTab: React.FC<ProspectionSettingsTabProps> = ({
  followup1Days,
  followup2Days,
  archiveAfter,
  gmailDailyCap,
  gmailWarmupStartDate,
  gmailWindowStart,
  gmailWindowEnd,
  gmailFromName,
  pipelineStages,
  replyAiClassificationEnabled,
  replyPositiveStageId,
  replyNegativeStageId,
  onFollowup1DaysChange,
  onFollowup2DaysChange,
  onArchiveAfterChange,
  onGmailDailyCapChange,
  onGmailWarmupStartDateChange,
  onGmailWindowStartChange,
  onGmailWindowEndChange,
  onGmailFromNameChange,
  onReplyAiClassificationEnabledChange,
  onReplyPositiveStageIdChange,
  onReplyNegativeStageIdChange,
  onSubmit,
}) => (
```

- [ ] **Step 2: Add the new section markup**

Find the closing of the file (the end of the "Relances Section" `div`, right before the final closing `</div>` of the component):

```typescript
        <AccentButton type="submit" variant="primary" icon={<Save size={14} />}>
          Enregistrer les relances
        </AccentButton>
      </form>
    </div>
  </div>
);
```

Replace with:

```typescript
        <AccentButton type="submit" variant="primary" icon={<Save size={14} />}>
          Enregistrer les relances
        </AccentButton>
      </form>
    </div>

    {/* Reply AI Classification Section */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
        <div>
          <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
            <Sparkles size={18} className="text-[#D4C4A8]" />
            Analyse IA des réponses
          </h2>
          <p className="text-[11px] text-ink-soft mt-0.5">
            Classification automatique du ton des réponses reçues, et déplacement du lead dans le pipeline.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="mb-6 flex items-center justify-between border border-line rounded-control p-4 bg-surface/40">
          <div>
            <div className="text-[13px] font-semibold text-ink">Activer la classification automatique</div>
            <div className="mt-0.5 text-[11px] text-ink-soft max-w-xl">
              Chaque réponse reçue est analysée (positive / négative / neutre) dès sa détection.
            </div>
          </div>
          <label className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={replyAiClassificationEnabled}
              onChange={(e) => onReplyAiClassificationEnabledChange(e.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-hover transition-colors peer-checked:bg-[#D4C4A8]"></span>
            <span className="absolute left-0.5 h-5 w-5 rounded-full bg-[#0d0d0d] transition-transform peer-checked:translate-x-5"></span>
          </label>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Réponse positive →">
            <select
              value={replyPositiveStageId ?? ''}
              onChange={(e) => onReplyPositiveStageIdChange(e.target.value || null)}
              className={inputClass}
            >
              <option value="">— Ne pas déplacer —</option>
              {pipelineStages.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Réponse négative →">
            <select
              value={replyNegativeStageId ?? ''}
              onChange={(e) => onReplyNegativeStageIdChange(e.target.value || null)}
              className={inputClass}
            >
              <option value="">— Ne pas déplacer —</option>
              {pipelineStages.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <AccentButton type="submit" variant="primary" icon={<Save size={14} />}>
          Enregistrer l'analyse des réponses
        </AccentButton>
      </form>
    </div>
  </div>
);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: errors only in `Settings.tsx` (not yet passing the new props) — fixed in Task 8.

- [ ] **Step 4: Commit**

```bash
git add src/views/settings/ProspectionSettingsTab.tsx
git commit -m "feat: add reply AI classification settings UI"
```

---

### Task 8: Wire the new settings into `Settings.tsx`

**Files:**
- Modify: `src/views/Settings.tsx`

**Interfaces:**
- Consumes: the three new `ProspectionSettings` fields (Task 6) and the three new `ProspectionSettingsTab` props (Task 7).

- [ ] **Step 1: Add state**

Find:

```typescript
  const [followup1Days, setFollowup1Days] = useState(5);
  const [followup2Days, setFollowup2Days] = useState(10);
  const [archiveAfter, setArchiveAfter] = useState(2);
```

Replace with:

```typescript
  const [followup1Days, setFollowup1Days] = useState(5);
  const [followup2Days, setFollowup2Days] = useState(10);
  const [archiveAfter, setArchiveAfter] = useState(2);
  const [replyAiClassificationEnabled, setReplyAiClassificationEnabled] = useState(true);
  const [replyPositiveStageId, setReplyPositiveStageId] = useState<string | null>(null);
  const [replyNegativeStageId, setReplyNegativeStageId] = useState<string | null>(null);
```

- [ ] **Step 2: Populate state from loaded settings**

Find:

```typescript
      if (s.key === 'archive_after_followups' && s.value.count !== undefined) setArchiveAfter(s.value.count);
    });
```

Replace with:

```typescript
      if (s.key === 'archive_after_followups' && s.value.count !== undefined) setArchiveAfter(s.value.count);
      if (s.key === 'reply_ai_classification_enabled' && s.value.enabled !== undefined) setReplyAiClassificationEnabled(s.value.enabled);
      if (s.key === 'reply_positive_stage_id') setReplyPositiveStageId(s.value.stage_id ?? null);
      if (s.key === 'reply_negative_stage_id') setReplyNegativeStageId(s.value.stage_id ?? null);
    });
```

- [ ] **Step 3: Save the new fields**

Find:

```typescript
      await settingsService.updateProspectionSettings({
        followup_1_days: followup1Days,
        followup_2_days: followup2Days,
        archive_after_followups: archiveAfter,
        gmail_daily_cap: gmailDailyCap,
        gmail_warmup_start_date: gmailWarmupStartDate,
        gmail_send_window: { days: [1, 2, 3, 4, 5], start: gmailWindowStart, end: gmailWindowEnd },
        gmail_from_name: gmailFromName,
      });
```

Replace with:

```typescript
      await settingsService.updateProspectionSettings({
        followup_1_days: followup1Days,
        followup_2_days: followup2Days,
        archive_after_followups: archiveAfter,
        gmail_daily_cap: gmailDailyCap,
        gmail_warmup_start_date: gmailWarmupStartDate,
        gmail_send_window: { days: [1, 2, 3, 4, 5], start: gmailWindowStart, end: gmailWindowEnd },
        gmail_from_name: gmailFromName,
        reply_ai_classification_enabled: replyAiClassificationEnabled,
        reply_positive_stage_id: replyPositiveStageId,
        reply_negative_stage_id: replyNegativeStageId,
      });
```

- [ ] **Step 4: Pass the new props to `ProspectionSettingsTab`**

Find:

```typescript
      {activeTab === 'prospection' && (
        <ProspectionSettingsTab
          followup1Days={followup1Days}
          followup2Days={followup2Days}
          archiveAfter={archiveAfter}
          gmailDailyCap={gmailDailyCap}
          gmailWarmupStartDate={gmailWarmupStartDate}
          gmailWindowStart={gmailWindowStart}
          gmailWindowEnd={gmailWindowEnd}
          gmailFromName={gmailFromName}
          onFollowup1DaysChange={setFollowup1Days}
          onFollowup2DaysChange={setFollowup2Days}
          onArchiveAfterChange={setArchiveAfter}
          onGmailDailyCapChange={setGmailDailyCap}
          onGmailWarmupStartDateChange={setGmailWarmupStartDate}
          onGmailWindowStartChange={setGmailWindowStart}
          onGmailWindowEndChange={setGmailWindowEnd}
          onGmailFromNameChange={setGmailFromName}
          onSubmit={handleSaveProspectionSettings}
        />
      )}
```

Replace with:

```typescript
      {activeTab === 'prospection' && (
        <ProspectionSettingsTab
          followup1Days={followup1Days}
          followup2Days={followup2Days}
          archiveAfter={archiveAfter}
          gmailDailyCap={gmailDailyCap}
          gmailWarmupStartDate={gmailWarmupStartDate}
          gmailWindowStart={gmailWindowStart}
          gmailWindowEnd={gmailWindowEnd}
          gmailFromName={gmailFromName}
          pipelineStages={stages}
          replyAiClassificationEnabled={replyAiClassificationEnabled}
          replyPositiveStageId={replyPositiveStageId}
          replyNegativeStageId={replyNegativeStageId}
          onFollowup1DaysChange={setFollowup1Days}
          onFollowup2DaysChange={setFollowup2Days}
          onArchiveAfterChange={setArchiveAfter}
          onGmailDailyCapChange={setGmailDailyCap}
          onGmailWarmupStartDateChange={setGmailWarmupStartDate}
          onGmailWindowStartChange={setGmailWindowStart}
          onGmailWindowEndChange={setGmailWindowEnd}
          onGmailFromNameChange={setGmailFromName}
          onReplyAiClassificationEnabledChange={setReplyAiClassificationEnabled}
          onReplyPositiveStageIdChange={setReplyPositiveStageId}
          onReplyNegativeStageIdChange={setReplyNegativeStageId}
          onSubmit={handleSaveProspectionSettings}
        />
      )}
```

- [ ] **Step 5: Run the existing Settings tests to confirm no regression**

Run: `npx vitest run src/views/Settings.test.tsx`
Expected: PASS (both existing tests) — they only exercise the `members`/`pipeline` tabs, unaffected by this change.

- [ ] **Step 6: Type-check the whole project**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/views/Settings.tsx
git commit -m "feat: wire reply sentiment settings into the Settings page"
```

---

### Task 9: Surface sentiment in the Tracking tab

**Files:**
- Modify: `src/services/prospectionService.ts:20-38` (`EmailLog` interface)
- Modify: `src/views/prospection/TrackingTab.tsx`

**Interfaces:**
- Modifies `EmailLog` to add `reply_sentiment: 'positive' | 'negative' | 'neutral' | null` and `reply_sentiment_reason: string | null`.

No automated test — no `TrackingTab.test.tsx` exists in this repo today.

- [ ] **Step 1: Extend `EmailLog`**

In `src/services/prospectionService.ts`, find:

```typescript
export interface EmailLog {
  id: string;
  lead_id: string | null;
  generated_email_id: string | null;
  direction: 'outbound' | 'inbound';
  from_email: string;
  to_email: string;
  subject: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | 'failed';
  gmail_thread_id: string | null;
  body_preview: string | null;
  error_message: string | null;
  opened_at: string | null;
  replied_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  lead?: { contact_name: string; company_name: string } | null;
}
```

Replace with:

```typescript
export interface EmailLog {
  id: string;
  lead_id: string | null;
  generated_email_id: string | null;
  direction: 'outbound' | 'inbound';
  from_email: string;
  to_email: string;
  subject: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | 'failed';
  gmail_thread_id: string | null;
  body_preview: string | null;
  error_message: string | null;
  opened_at: string | null;
  replied_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  reply_sentiment: 'positive' | 'negative' | 'neutral' | null;
  reply_sentiment_reason: string | null;
  lead?: { contact_name: string; company_name: string } | null;
}
```

- [ ] **Step 2: Add sentiment badge maps and render them**

In `src/views/prospection/TrackingTab.tsx`, find:

```typescript
const STATUS_CLASSES: Record<EmailLog['status'], string> = {
  pending: 'bg-surface text-ink-soft border-line-strong',
  sent: 'bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus',
  delivered: 'bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus',
  opened: 'bg-success/10 text-success border-success/20',
  replied: 'bg-success/10 text-success border-success/20',
  bounced: 'bg-danger/10 text-danger border-danger/20',
  failed: 'bg-danger/10 text-danger border-danger/20',
};
```

Add right after it:

```typescript
const SENTIMENT_LABELS: Record<NonNullable<EmailLog['reply_sentiment']>, string> = {
  positive: 'Réponse positive (IA)',
  negative: 'Réponse négative (IA)',
  neutral: 'Réponse neutre (IA)',
};

const SENTIMENT_CLASSES: Record<NonNullable<EmailLog['reply_sentiment']>, string> = {
  positive: 'bg-success/10 text-success border-success/20',
  negative: 'bg-danger/10 text-danger border-danger/20',
  neutral: 'bg-surface text-ink-soft border-line-strong',
};
```

Find the reply rendering block:

```typescript
                  {replies.map((reply) => (
                    <div key={reply.id} className="pl-3 border-l-2 border-success/30 space-y-1">
                      <div className="flex items-center gap-2 text-success font-semibold">
                        <ArrowDownLeft size={12} strokeWidth={2} />
                        Réponse reçue le {formatDate(reply.received_at)}
                      </div>
                      {reply.body_preview && (
                        <p className="text-ink-soft whitespace-pre-line bg-surface p-2 rounded-control border border-line-strong">
                          {reply.body_preview}
                        </p>
                      )}
                    </div>
                  ))}
```

Replace with:

```typescript
                  {replies.map((reply) => (
                    <div key={reply.id} className="pl-3 border-l-2 border-success/30 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-success font-semibold">
                          <ArrowDownLeft size={12} strokeWidth={2} />
                          Réponse reçue le {formatDate(reply.received_at)}
                        </div>
                        {reply.reply_sentiment && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-control border ${SENTIMENT_CLASSES[reply.reply_sentiment]}`}>
                            {SENTIMENT_LABELS[reply.reply_sentiment]}
                          </span>
                        )}
                      </div>
                      {reply.body_preview && (
                        <p className="text-ink-soft whitespace-pre-line bg-surface p-2 rounded-control border border-line-strong">
                          {reply.body_preview}
                        </p>
                      )}
                    </div>
                  ))}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full frontend test suite**

Run: `npx vitest run src`
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/services/prospectionService.ts src/views/prospection/TrackingTab.tsx
git commit -m "feat: show reply sentiment badge in the tracking tab"
```

---

## Post-plan manual steps (not part of any task — outside what code can verify)

1. Apply Task 1's SQL to the live Supabase project (dashboard SQL Editor).
2. Run `npx vitest run` at the repo root once all tasks are done — expect only new passing tests, zero regressions.
3. Do a live reply test per Task 5 Step 7.
4. Configure the two stage dropdowns in Settings > Prospection once you know which stages you want positive/negative replies to land in.
