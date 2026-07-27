# Gmail Sending Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Resend-based sending in the Prospection module with direct Gmail API sending, add a warm-up-ramp pacing engine (business-hours window, randomized spacing) to protect a personal Gmail account from cold-outreach spam flags, and detect replies (with full content) and bounces via inbox polling.

**Architecture:** Pure, Deno-import-free TypeScript modules (`_shared/gmailMessageParser.ts`, `_shared/gmailMime.ts`, `_shared/warmupRamp.ts`, `_shared/sendWindow.ts`, `_shared/gmailReplyClassifier.ts`) hold all business logic and are unit-tested with the frontend's existing Vitest setup — same pattern already used for `_shared/postValidator.ts` etc. Thin Deno edge functions (`gmail-oauth-start`, `gmail-oauth-callback`, `schedule-gmail-sends`, `dispatch-gmail-sends`, `poll-gmail-inbox`) orchestrate these modules plus a Deno-specific `_shared/gmailApi.ts` (fetch wrapper, untested — same convention as `_shared/linkedinApi.ts`). `generated_emails.statut_envoi` gains a `scheduled` state; `scheduled_at` is repurposed as the pacing engine's computed send slot (it has no other current use — `schedule_send()`'s old quota-lookahead role is removed).

**Tech Stack:** Deno edge functions (Supabase), TypeScript, Vitest (existing frontend test runner, reused for pure modules), Gmail API (`gmail.googleapis.com`), Postgres (`pg_cron`/`pg_net` for scheduling, same as existing crons).

## Global Constraints

- Personal Gmail account via OAuth (not Google Workspace) — per approved spec.
- Raw Gmail API only — no Nylas or other third-party email vendor.
- Reply/bounce detection via polling (`poll-gmail-inbox`, every 5 min) — no Pub/Sub push, no `users.watch`.
- Open tracking stays on the existing pixel mechanism (`track-email/index.ts`) — **do not modify that function**.
- Daily send volume must never be hardcoded — it's computed from `app_settings.gmail_warmup_start_date` + `app_settings.gmail_daily_cap`, both user-configured, both required before any automatic sending happens.
- Sends only happen inside the configured business-hours window (`app_settings.gmail_send_window`), spaced with randomized jitter — never all at once.
- Template system (`email_templates`, `templatesService`, `render_template()`) is out of scope — do not modify.
- Follow-up cadence logic (`followup_1_days`/`followup_2_days`/`archive_after_followups`, `prospectionService.getFollowUpCandidates`) is out of scope — do not modify beyond what's needed to read renamed columns.
- All new `_shared/*.ts` modules that hold business logic (not raw Gmail API calls) must have zero Deno-specific imports (no `Deno.*` at module scope, no remote URL imports) so they stay portable and testable with Vitest.
- Test commands run from `Projet/` (repo root for `git`, Vitest root).
- No immediate/bypass send path in the UI — every send (initial approval or retry-after-failure) re-enters the pacing queue (`statut_envoi = 'approved'`); nothing should call Gmail synchronously from a button click, since that would defeat the warm-up/window protections that are the entire point of this rebuild.

---

### Task 0: Google Cloud OAuth app setup (manual, user-performed, blocks Task 8)

This has no files to create — it's account/console setup on Google's side, needed before Task 8's `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` secrets can be set. Can be done any time before Task 8; doesn't block Tasks 1-7.

- [ ] **Step 1:** Go to [console.cloud.google.com](https://console.cloud.google.com), create a new project (any name, e.g. "Seiki CRM Gmail").
- [ ] **Step 2:** In that project, go to "APIs & Services" → "Library", search "Gmail API", click Enable.
- [ ] **Step 3:** Go to "APIs & Services" → "OAuth consent screen". Choose **External**. Fill in the required app name/support email/developer email. Under "Test users", add the personal Gmail address that will be used for testing (and later, the real prospecting address, if different). Leave the app in **Testing** status — do not submit for verification; testing mode allows the listed test users to authorize the app indefinitely without Google review, which is sufficient for a single-account internal tool.
- [ ] **Step 4:** Add scopes: `https://www.googleapis.com/auth/gmail.send` and `https://www.googleapis.com/auth/gmail.readonly`.
- [ ] **Step 5:** Go to "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID". Application type: **Web application**. Under "Authorized redirect URIs", add `https://<PROJECT_REF>.supabase.co/functions/v1/gmail-oauth-callback` (replace `<PROJECT_REF>` with the actual Supabase project ref — same one used everywhere else in this plan's cron SQL).
- [ ] **Step 6:** Copy the generated **Client ID** and **Client secret** — these are `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`, set as Supabase secrets in Task 8 Step 4.

---

### Task 1: Database migration — schema + cron jobs

**Files:**
- Create: `archive/schema_gmail_addon.sql`
- Create: `archive/schema_gmail_cron.sql`

**Interfaces:**
- Produces: `public.gmail_accounts` table (`id`, `email`, `access_token`, `refresh_token`, `expires_at`, `last_history_id`, `connected_at`, `updated_at`), `generated_emails` columns `gmail_message_id TEXT`, `gmail_thread_id TEXT` (replacing `resend_message_id`), `statut_envoi` CHECK including `'scheduled'`, `app_settings` keys `gmail_daily_cap` (`{count}`), `gmail_warmup_start_date` (`{date}`), `gmail_send_window` (`{days, start, end}`). Consumed by every later task that touches `generated_emails`, `gmail_accounts`, or these settings keys.

This is a manual-apply SQL migration (same convention as every other `archive/schema_*.sql` file in this repo — no automated test runner for Supabase SQL). Verification is a set of `SELECT` checks run by hand in the Supabase SQL Editor.

- [ ] **Step 1: Write `archive/schema_gmail_addon.sql`**

```sql
-- ============================================================
-- SEIKI CRM — Add-on Gmail Sending (remplace Resend)
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS schema_supabase.sql, schema_prospection_v2_addon.sql,
-- schema_prospection_v2_functions.sql, schema_prospection_v3_cleanup.sql
-- ============================================================

-- ============================================================
-- 1. TABLE GMAIL_ACCOUNTS — Compte Gmail personnel connecté
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gmail_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  access_token     TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  last_history_id  TEXT,
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gmail_accounts IS 'Compte Gmail personnel connecté pour l''envoi de prospection (un seul compte en pratique)';
COMMENT ON COLUMN public.gmail_accounts.access_token IS 'Token OAuth Gmail — non chiffré en base, protégé uniquement par RLS (même compromis que linkedin_accounts)';
COMMENT ON COLUMN public.gmail_accounts.last_history_id IS 'Curseur Gmail history API — jusqu''où poll-gmail-inbox a déjà traité l''inbox';

ALTER TABLE public.gmail_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.gmail_accounts;
CREATE POLICY "authenticated_full_access" ON public.gmail_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_gmail_accounts_updated ON public.gmail_accounts;
CREATE TRIGGER trg_gmail_accounts_updated
  BEFORE UPDATE ON public.gmail_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. GENERATED_EMAILS — remplace les colonnes Resend par Gmail
-- ============================================================
ALTER TABLE public.generated_emails DROP COLUMN IF EXISTS resend_message_id;
ALTER TABLE public.generated_emails ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
ALTER TABLE public.generated_emails ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;

ALTER TABLE public.generated_emails DROP CONSTRAINT IF EXISTS generated_emails_statut_envoi_check;
ALTER TABLE public.generated_emails ADD CONSTRAINT generated_emails_statut_envoi_check
  CHECK (statut_envoi IN ('draft', 'approved', 'scheduled', 'sending', 'sent', 'failed'));

CREATE INDEX IF NOT EXISTS idx_gen_emails_statut_scheduled
  ON public.generated_emails(statut_envoi, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_gen_emails_thread
  ON public.generated_emails(gmail_thread_id);

COMMENT ON COLUMN public.generated_emails.scheduled_at IS 'Créneau d''envoi calculé par le moteur de pacing (schedule-gmail-sends) — NULL tant que non planifié';

-- ============================================================
-- 3. APP_SETTINGS — nouvelles clés Gmail, retrait de l'ancien quota Resend
-- ============================================================
DELETE FROM public.app_settings WHERE key = 'daily_send_quota';

INSERT INTO public.app_settings (key, value, label, category) VALUES
  ('gmail_daily_cap',         '{}',                                             'Plafond d''envoi quotidien cible (une fois le warm-up terminé)', 'prospection'),
  ('gmail_warmup_start_date', '{}',                                             'Date de début du warm-up Gmail',                                 'prospection'),
  ('gmail_send_window',       '{"days": [1,2,3,4,5], "start": "08:00", "end": "18:00"}', 'Fenêtre horaire d''envoi (jours ouvrés par défaut)',       'prospection')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 4. schedule_send() — simplifié : n'assigne plus de créneau
--    (le moteur de pacing schedule-gmail-sends s'en charge), se
--    contente de marquer 'approved'. Renvoie NULL (plus de date
--    immédiate à afficher côté UI).
-- ============================================================
CREATE OR REPLACE FUNCTION public.schedule_send(p_generated_email_id UUID)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.generated_emails
  SET statut_envoi = 'approved',
      scheduled_at = NULL,
      approved_at  = now()
  WHERE id = p_generated_email_id;

  RETURN NULL;
END;
$$;

-- ============================================================
-- 5. auto_create_prospection_draft() — mode auto appelle toujours
--    schedule_send() (inchangé dans son intention, juste simplifié
--    ci-dessus), pour rejoindre la file d'approbation automatiquement.
-- ============================================================
-- Rien à changer ici : la fonction existante (schema_prospection_v3_cleanup.sql)
-- appelle déjà PERFORM public.schedule_send(v_new_id) en mode auto — elle
-- continue de fonctionner avec la nouvelle définition simplifiée ci-dessus.
```

- [ ] **Step 2: Write `archive/schema_gmail_cron.sql`**

```sql
-- ============================================================
-- SEIKI CRM — Cron Gmail Sending (remplace flush-send-queue-hourly)
-- À appliquer dans : Supabase > SQL Editor, APRÈS schema_gmail_addon.sql
-- Réutilise le secret 'seiki_cron_secret' déjà créé pour
-- flush-send-queue-hourly (voir schema_prospection_v2_cron.sql) —
-- pas besoin de le recréer si déjà présent.
--
-- Remplacer <PROJECT_REF> et <ANON_KEY> par les vraies valeurs du
-- projet avant d'exécuter.
--
-- Vérification après exécution :
--   SELECT jobname, schedule, active FROM cron.job
--   WHERE jobname IN ('schedule-gmail-sends', 'dispatch-gmail-sends', 'poll-gmail-inbox');
-- Doit renvoyer 3 lignes, toutes active = true.
-- ============================================================

-- Retire l'ancien cron Resend, désormais remplacé
SELECT cron.unschedule('flush-send-queue-hourly');

SELECT cron.schedule(
  'schedule-gmail-sends',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/schedule-gmail-sends',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seiki_cron_secret'
      ),
      'apikey', '<ANON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'dispatch-gmail-sends',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/dispatch-gmail-sends',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seiki_cron_secret'
      ),
      'apikey', '<ANON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'poll-gmail-inbox',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/poll-gmail-inbox',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seiki_cron_secret'
      ),
      'apikey', '<ANON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 3: Commit**

```bash
git add archive/schema_gmail_addon.sql archive/schema_gmail_cron.sql
git commit -m "feat: add Gmail sending schema migration and cron jobs (SQL, manual apply)"
```

---

### Task 2: `gmailMessageParser.ts` — pure Gmail message parsing

**Files:**
- Create: `supabase/functions/_shared/gmailMessageParser.ts`
- Test: `supabase/functions/_shared/gmailMessageParser.test.ts`

**Interfaces:**
- Produces: `GmailMessagePart` and `GmailMessage` types, `getHeader(msg: GmailMessage, name: string): string | null`, `extractPlainTextBody(msg: GmailMessage): string`. Consumed by Task 7 (`gmailApi.ts` return type), Task 9 (`sendViaGmail.ts` — reading last outbound message for threading), Task 12 (`poll-gmail-inbox` — reading inbound message content).

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/_shared/gmailMessageParser.test.ts
import { describe, it, expect } from 'vitest';
import { getHeader, extractPlainTextBody, type GmailMessage } from './gmailMessageParser';

function b64url(text: string): string {
  const b64 = btoa(unescape(encodeURIComponent(text)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('getHeader', () => {
  const msg: GmailMessage = {
    id: '1', threadId: 't1',
    payload: { headers: [{ name: 'From', value: 'a@b.com' }, { name: 'Subject', value: 'Hi' }] },
  };

  it('finds a header case-insensitively', () => {
    expect(getHeader(msg, 'from')).toBe('a@b.com');
    expect(getHeader(msg, 'SUBJECT')).toBe('Hi');
  });

  it('returns null for a missing header', () => {
    expect(getHeader(msg, 'X-Missing')).toBeNull();
  });
});

describe('extractPlainTextBody', () => {
  it('extracts body from a single-part message', () => {
    const msg: GmailMessage = {
      id: '1', threadId: 't1',
      payload: { headers: [], body: { data: b64url('Bonjour, ça va ?') } },
    };
    expect(extractPlainTextBody(msg)).toBe('Bonjour, ça va ?');
  });

  it('extracts text/plain part from a multipart/alternative message', () => {
    const msg: GmailMessage = {
      id: '1', threadId: 't1',
      payload: {
        headers: [],
        parts: [
          { mimeType: 'text/plain', body: { data: b64url('Plain reply') } },
          { mimeType: 'text/html', body: { data: b64url('<p>Html reply</p>') } },
        ],
      },
    };
    expect(extractPlainTextBody(msg)).toBe('Plain reply');
  });

  it('finds text/plain nested inside multipart/mixed > multipart/alternative', () => {
    const msg: GmailMessage = {
      id: '1', threadId: 't1',
      payload: {
        headers: [],
        parts: [
          {
            mimeType: 'multipart/alternative',
            parts: [
              { mimeType: 'text/plain', body: { data: b64url('Nested plain') } },
            ],
          },
        ],
      },
    };
    expect(extractPlainTextBody(msg)).toBe('Nested plain');
  });

  it('returns empty string when no text/plain part exists', () => {
    const msg: GmailMessage = {
      id: '1', threadId: 't1',
      payload: { headers: [], parts: [{ mimeType: 'text/html', body: { data: b64url('<p>only html</p>') } }] },
    };
    expect(extractPlainTextBody(msg)).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/gmailMessageParser.test.ts`
Expected: FAIL with "Cannot find module './gmailMessageParser'" (file doesn't exist yet)

- [ ] **Step 3: Write `gmailMessageParser.ts`**

```ts
// ============================================================
// _shared/gmailMessageParser.ts
// Lecture pure des messages Gmail (format API `format=full`) —
// zéro import Deno, portable et testable avec Vitest.
// ============================================================

export interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  payload: {
    headers: { name: string; value: string }[];
    parts?: GmailMessagePart[];
    body?: { data?: string };
  };
}

export function getHeader(msg: GmailMessage, name: string): string | null {
  const found = msg.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found ? found.value : null;
}

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}

function findTextPlainPart(parts: GmailMessagePart[]): GmailMessagePart | null {
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) return part;
    if (part.parts) {
      const nested = findTextPlainPart(part.parts);
      if (nested) return nested;
    }
  }
  return null;
}

export function extractPlainTextBody(msg: GmailMessage): string {
  if (msg.payload.parts) {
    const part = findTextPlainPart(msg.payload.parts);
    return part?.body?.data ? decodeBase64Url(part.body.data) : '';
  }
  return msg.payload.body?.data ? decodeBase64Url(msg.payload.body.data) : '';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/gmailMessageParser.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/gmailMessageParser.ts supabase/functions/_shared/gmailMessageParser.test.ts
git commit -m "feat: add pure Gmail message parser (headers, plain-text body extraction)"
```

---

### Task 3: `gmailMime.ts` — pure MIME message building

**Files:**
- Create: `supabase/functions/_shared/gmailMime.ts`
- Test: `supabase/functions/_shared/gmailMime.test.ts`

**Interfaces:**
- Consumes: none (pure, self-contained).
- Produces: `buildEmailHtml(corps: string, trackingPixelUrl: string): string`, `buildRawEmail(params: RawEmailParams): string` (returns base64url-encoded RFC822 message, ready for Gmail's `messages.send` `raw` field), `RawEmailParams` type. Consumed by Task 9 (`sendViaGmail.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/_shared/gmailMime.test.ts
import { describe, it, expect } from 'vitest';
import { buildEmailHtml, buildRawEmail } from './gmailMime';

function decodeRaw(raw: string): string {
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}

describe('buildEmailHtml', () => {
  it('wraps each line in a paragraph and appends the tracking pixel', () => {
    const html = buildEmailHtml('Ligne 1\nLigne 2', 'https://x.test/track?id=1');
    expect(html).toContain('Ligne 1');
    expect(html).toContain('Ligne 2');
    expect(html).toContain('<img src="https://x.test/track?id=1"');
  });

  it('converts blank lines to line breaks', () => {
    const html = buildEmailHtml('Ligne 1\n\nLigne 2', 'https://x.test/track');
    expect(html).toContain('<br/>');
  });
});

describe('buildRawEmail', () => {
  const base = {
    fromEmail: 'me@gmail.com',
    fromName: 'Seiki CRM',
    toEmail: 'lead@example.com',
    subject: 'Bonjour à vous',
    textBody: 'Corps en texte brut',
    htmlBody: '<p>Corps en html</p>',
  };

  it('produces a valid base64url string (no +, /, or = padding)', () => {
    const raw = buildRawEmail(base);
    expect(raw).not.toMatch(/[+/=]/);
  });

  it('decodes to a multipart/alternative message with both text and html parts', () => {
    const decoded = decodeRaw(buildRawEmail(base));
    expect(decoded).toContain('Content-Type: multipart/alternative');
    expect(decoded).toContain('Corps en texte brut');
    expect(decoded).toContain('<p>Corps en html</p>');
  });

  it('includes From/To headers and an RFC 2047 encoded subject', () => {
    const decoded = decodeRaw(buildRawEmail(base));
    expect(decoded).toContain('From: Seiki CRM <me@gmail.com>');
    expect(decoded).toContain('To: lead@example.com');
    expect(decoded).toMatch(/Subject: =\?UTF-8\?B\?/);
  });

  it('adds In-Reply-To and References headers when provided (threading)', () => {
    const decoded = decodeRaw(buildRawEmail({ ...base, inReplyTo: '<msg1@mail.gmail.com>', references: '<msg1@mail.gmail.com>' }));
    expect(decoded).toContain('In-Reply-To: <msg1@mail.gmail.com>');
    expect(decoded).toContain('References: <msg1@mail.gmail.com>');
  });

  it('omits In-Reply-To/References when not provided', () => {
    const decoded = decodeRaw(buildRawEmail(base));
    expect(decoded).not.toContain('In-Reply-To');
    expect(decoded).not.toContain('References');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/gmailMime.test.ts`
Expected: FAIL with "Cannot find module './gmailMime'"

- [ ] **Step 3: Write `gmailMime.ts`**

```ts
// ============================================================
// _shared/gmailMime.ts
// Construction du corps HTML (avec pixel de tracking) et du
// message RFC822 brut (base64url) attendu par Gmail API
// messages.send. Zéro import Deno — pur, testable avec Vitest.
// ============================================================

export interface RawEmailParams {
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  inReplyTo?: string;
  references?: string;
}

export function buildEmailHtml(corps: string, trackingPixelUrl: string): string {
  const htmlBody = corps
    .split('\n')
    .map((line) => (line.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px 0;line-height:1.6">${line}</p>`))
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;background:#fff;padding:24px;max-width:600px;margin:0 auto">
  <div style="border-left:3px solid #6B5FE6;padding-left:16px;margin-bottom:24px">
    ${htmlBody}
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="font-size:11px;color:#888;margin:0">
    Envoyé par Seiki — <a href="mailto:contact@seiki.fr" style="color:#6B5FE6">contact@seiki.fr</a>
  </p>
  <!-- Tracking pixel (ouverture) -->
  <img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt=""/>
</body>
</html>`;
}

function base64UrlEncode(str: string): string {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
}

export function buildRawEmail(params: RawEmailParams): string {
  const boundary = `seiki_boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `From: ${params.fromName} <${params.fromEmail}>`,
    `To: ${params.toEmail}`,
    `Subject: ${encodeSubject(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) headers.push(`References: ${params.references}`);

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    params.textBody,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    params.htmlBody,
    `--${boundary}--`,
  ].join('\r\n');

  const raw = `${headers.join('\r\n')}\r\n\r\n${body}`;
  return base64UrlEncode(raw);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/gmailMime.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/gmailMime.ts supabase/functions/_shared/gmailMime.test.ts
git commit -m "feat: add pure Gmail MIME builder (HTML body + raw RFC822 message)"
```

---

### Task 4: `warmupRamp.ts` — pure warm-up ramp calculation

**Files:**
- Create: `supabase/functions/_shared/warmupRamp.ts`
- Test: `supabase/functions/_shared/warmupRamp.test.ts`

**Interfaces:**
- Produces: `RampStep` type, `DEFAULT_RAMP: RampStep[]`, `computeDailyCap(warmupStartDate: string, now: Date, targetCap: number, ramp?: RampStep[]): number`. Consumed by Task 11 (`schedule-gmail-sends`).

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/_shared/warmupRamp.test.ts
import { describe, it, expect } from 'vitest';
import { computeDailyCap, DEFAULT_RAMP } from './warmupRamp';

describe('computeDailyCap', () => {
  it('returns 0 before the warm-up start date', () => {
    const now = new Date('2026-07-01T12:00:00Z');
    expect(computeDailyCap('2026-07-05', now, 50)).toBe(0);
  });

  it('returns the first ramp step cap on day 0', () => {
    const now = new Date('2026-07-05T12:00:00Z');
    expect(computeDailyCap('2026-07-05', now, 50)).toBe(DEFAULT_RAMP[0].cap);
  });

  it('advances to the next ramp step once its threshold is reached', () => {
    const start = '2026-07-01';
    const now = new Date('2026-07-08T00:00:00Z'); // 7 days later
    const step = [...DEFAULT_RAMP].reverse().find((s) => 7 >= s.afterDays)!;
    expect(computeDailyCap(start, now, 999)).toBe(step.cap);
  });

  it('never exceeds the configured target cap, even late in the ramp', () => {
    const now = new Date('2027-01-01T00:00:00Z'); // far past the whole ramp
    expect(computeDailyCap('2026-01-01', now, 10)).toBe(10);
  });

  it('accepts a custom ramp table', () => {
    const customRamp = [{ afterDays: 0, cap: 2 }, { afterDays: 3, cap: 100 }];
    const now = new Date('2026-07-04T00:00:00Z'); // 3 days after 2026-07-01
    expect(computeDailyCap('2026-07-01', now, 999, customRamp)).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/warmupRamp.test.ts`
Expected: FAIL with "Cannot find module './warmupRamp'"

- [ ] **Step 3: Write `warmupRamp.ts`**

```ts
// ============================================================
// _shared/warmupRamp.ts
// Calcule le plafond d'envoi du jour selon une courbe de warm-up
// (protège un compte Gmail personnel neuf en prospection à froid
// d'une montée en volume trop brutale). Zéro import Deno — pur,
// testable avec Vitest.
// ============================================================

export interface RampStep {
  afterDays: number;
  cap: number;
}

// Semaine 1 : 5/jour, semaine 2 : 10/jour, semaine 3 : 20/jour,
// semaine 4+ : 35/jour (plafonné ensuite par la cible configurée).
export const DEFAULT_RAMP: RampStep[] = [
  { afterDays: 0, cap: 5 },
  { afterDays: 7, cap: 10 },
  { afterDays: 14, cap: 20 },
  { afterDays: 21, cap: 35 },
];

export function computeDailyCap(
  warmupStartDate: string,
  now: Date,
  targetCap: number,
  ramp: RampStep[] = DEFAULT_RAMP,
): number {
  const start = new Date(`${warmupStartDate}T00:00:00Z`);
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / 86_400_000);

  if (daysSinceStart < 0) return 0;

  let cap = ramp[0].cap;
  for (const step of ramp) {
    if (daysSinceStart >= step.afterDays) cap = step.cap;
  }

  return Math.min(cap, targetCap);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/warmupRamp.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/warmupRamp.ts supabase/functions/_shared/warmupRamp.test.ts
git commit -m "feat: add pure warm-up ramp calculation for Gmail daily send cap"
```

---

### Task 5: `sendWindow.ts` — pure business-hours window + randomized spacing

**Files:**
- Create: `supabase/functions/_shared/sendWindow.ts`
- Test: `supabase/functions/_shared/sendWindow.test.ts`

**Interfaces:**
- Produces: `SendWindow` type (`{ days: number[]; start: string; end: string }`, `days` using JS `Date.getDay()` convention 0=Sunday), `getTodaysWindowBounds(now: Date, window: SendWindow): { start: Date; end: Date } | null`, `pickRandomSendTimes(count: number, start: Date, end: Date, rng?: () => number): Date[]`. Consumed by Task 11 (`schedule-gmail-sends`).

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/_shared/sendWindow.test.ts
import { describe, it, expect } from 'vitest';
import { getTodaysWindowBounds, pickRandomSendTimes, type SendWindow } from './sendWindow';

const weekdayWindow: SendWindow = { days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' };

describe('getTodaysWindowBounds', () => {
  it('returns null on a day not in the window (Saturday)', () => {
    const saturday = new Date('2026-07-25T10:00:00'); // a Saturday
    expect(getTodaysWindowBounds(saturday, weekdayWindow)).toBeNull();
  });

  it('returns null once the window has already passed today', () => {
    const afterWindow = new Date('2026-07-27T19:00:00'); // Monday, 19:00, window ends 18:00
    expect(getTodaysWindowBounds(afterWindow, weekdayWindow)).toBeNull();
  });

  it('starts at the window start time when called before the window opens', () => {
    const beforeWindow = new Date('2026-07-27T06:00:00'); // Monday, 06:00
    const bounds = getTodaysWindowBounds(beforeWindow, weekdayWindow)!;
    expect(bounds.start.getHours()).toBe(8);
    expect(bounds.end.getHours()).toBe(18);
  });

  it('starts at "now" when called mid-window (remaining window only)', () => {
    const midWindow = new Date('2026-07-27T12:30:00'); // Monday, 12:30
    const bounds = getTodaysWindowBounds(midWindow, weekdayWindow)!;
    expect(bounds.start.getTime()).toBe(midWindow.getTime());
    expect(bounds.end.getHours()).toBe(18);
  });
});

describe('pickRandomSendTimes', () => {
  it('returns an empty array for count <= 0', () => {
    expect(pickRandomSendTimes(0, new Date('2026-07-27T08:00:00'), new Date('2026-07-27T18:00:00'))).toEqual([]);
  });

  it('returns exactly `count` timestamps, all within [start, end], in ascending order', () => {
    const start = new Date('2026-07-27T08:00:00');
    const end = new Date('2026-07-27T18:00:00');
    const times = pickRandomSendTimes(5, start, end);
    expect(times).toHaveLength(5);
    for (const t of times) {
      expect(t.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(t.getTime()).toBeLessThanOrEqual(end.getTime());
    }
    for (let i = 1; i < times.length; i++) {
      expect(times[i].getTime()).toBeGreaterThan(times[i - 1].getTime());
    }
  });

  it('spaces timestamps into distinct slots (stratified), not clustered, given a fixed rng', () => {
    const start = new Date('2026-07-27T08:00:00');
    const end = new Date('2026-07-27T18:00:00'); // 10h window = 600 min
    const times = pickRandomSendTimes(4, start, end, () => 0.5); // midpoint of each slot
    // 4 slots of 150 min each, midpoint => 75, 225, 375, 525 minutes after start
    const offsetsMin = times.map((t) => (t.getTime() - start.getTime()) / 60_000);
    expect(offsetsMin).toEqual([75, 225, 375, 525]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/sendWindow.test.ts`
Expected: FAIL with "Cannot find module './sendWindow'"

- [ ] **Step 3: Write `sendWindow.ts`**

```ts
// ============================================================
// _shared/sendWindow.ts
// Fenêtre horaire d'envoi (jours ouvrés + heures de bureau) et
// répartition aléatoire (stratifiée) des créneaux d'envoi du jour
// — évite un motif détectable de bot qui enverrait tout d'un coup.
// Zéro import Deno — pur, testable avec Vitest.
// ============================================================

export interface SendWindow {
  days: number[]; // Date.getDay() convention: 0 = dimanche ... 6 = samedi
  start: string;  // "HH:MM"
  end: string;    // "HH:MM"
}

function parseTimeOnDate(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const result = new Date(date);
  result.setHours(h, m, 0, 0);
  return result;
}

/** Bornes de la fenêtre d'envoi restante pour aujourd'hui, ou null si hors fenêtre (mauvais jour, ou fenêtre déjà terminée). */
export function getTodaysWindowBounds(now: Date, window: SendWindow): { start: Date; end: Date } | null {
  if (!window.days.includes(now.getDay())) return null;

  const windowStart = parseTimeOnDate(now, window.start);
  const windowEnd = parseTimeOnDate(now, window.end);

  if (now >= windowEnd) return null;

  const effectiveStart = now > windowStart ? now : windowStart;
  if (effectiveStart >= windowEnd) return null;

  return { start: effectiveStart, end: windowEnd };
}

/**
 * Répartit `count` créneaux entre start et end par échantillonnage stratifié :
 * la fenêtre est divisée en `count` tranches égales, un point aléatoire est
 * choisi dans chacune — garantit un espacement minimal sans motif régulier.
 */
export function pickRandomSendTimes(count: number, start: Date, end: Date, rng: () => number = Math.random): Date[] {
  if (count <= 0) return [];
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return [];

  const slotMs = totalMs / count;
  const times: Date[] = [];
  for (let i = 0; i < count; i++) {
    const slotStart = start.getTime() + i * slotMs;
    times.push(new Date(slotStart + rng() * slotMs));
  }
  return times;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/sendWindow.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/sendWindow.ts supabase/functions/_shared/sendWindow.test.ts
git commit -m "feat: add pure business-hours send window and stratified random spacing"
```

---

### Task 6: `gmailReplyClassifier.ts` — pure bounce/reply classification

**Files:**
- Create: `supabase/functions/_shared/gmailReplyClassifier.ts`
- Test: `supabase/functions/_shared/gmailReplyClassifier.test.ts`

**Interfaces:**
- Produces: `InboundClassification = 'bounce' | 'reply'`, `classifyInboundMessage(fromEmail: string, subject: string): InboundClassification`. Consumed by Task 12 (`poll-gmail-inbox`).

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/_shared/gmailReplyClassifier.test.ts
import { describe, it, expect } from 'vitest';
import { classifyInboundMessage } from './gmailReplyClassifier';

describe('classifyInboundMessage', () => {
  it('classifies mailer-daemon sender as a bounce', () => {
    expect(classifyInboundMessage('mailer-daemon@googlemail.com', 'Delivery Status Notification (Failure)')).toBe('bounce');
  });

  it('classifies postmaster sender as a bounce', () => {
    expect(classifyInboundMessage('postmaster@example.com', 'Undeliverable')).toBe('bounce');
  });

  it('classifies a Delivery Status Notification subject as a bounce even from an unusual sender', () => {
    expect(classifyInboundMessage('bounce-relay@example.com', 'Delivery Status Notification (Failure)')).toBe('bounce');
  });

  it('classifies "Mail delivery failed" subject as a bounce', () => {
    expect(classifyInboundMessage('MAILER-DAEMON@example.com', 'Mail delivery failed: returning message to sender')).toBe('bounce');
  });

  it('classifies a normal lead reply as a reply', () => {
    expect(classifyInboundMessage('lead@company.com', 'Re: Une idée pour votre entreprise')).toBe('reply');
  });

  it('is case-insensitive on both sender and subject', () => {
    expect(classifyInboundMessage('MAILER-DAEMON@Example.com', 'DELIVERY STATUS NOTIFICATION')).toBe('bounce');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/gmailReplyClassifier.test.ts`
Expected: FAIL with "Cannot find module './gmailReplyClassifier'"

- [ ] **Step 3: Write `gmailReplyClassifier.ts`**

```ts
// ============================================================
// _shared/gmailReplyClassifier.ts
// Gmail n'a pas de webhook de bounce — un échec de livraison
// revient comme un message dans la même boîte de réception (et
// le même thread) que l'envoi d'origine. Classification par
// heuristique sur l'expéditeur/le sujet. Zéro import Deno — pur,
// testable avec Vitest.
// ============================================================

export type InboundClassification = 'bounce' | 'reply';

const BOUNCE_SENDER_PATTERNS = ['mailer-daemon@', 'postmaster@'];
const BOUNCE_SUBJECT_PATTERNS = [
  'delivery status notification',
  'undeliverable',
  'undelivered mail',
  'mail delivery failed',
  'failure notice',
];

export function classifyInboundMessage(fromEmail: string, subject: string): InboundClassification {
  const from = fromEmail.toLowerCase();
  const subj = subject.toLowerCase();

  const isBounceSender = BOUNCE_SENDER_PATTERNS.some((p) => from.includes(p));
  const isBounceSubject = BOUNCE_SUBJECT_PATTERNS.some((p) => subj.includes(p));

  return isBounceSender || isBounceSubject ? 'bounce' : 'reply';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/gmailReplyClassifier.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/gmailReplyClassifier.ts supabase/functions/_shared/gmailReplyClassifier.test.ts
git commit -m "feat: add pure bounce/reply classifier for Gmail inbox polling"
```

---

### Task 7: `gmailApi.ts` — Gmail REST API wrapper (Deno, untested)

**Files:**
- Create: `supabase/functions/_shared/gmailApi.ts`

**Interfaces:**
- Consumes: `GmailMessage` type from Task 2 (`gmailMessageParser.ts`).
- Produces: `buildRedirectUri(supabaseUrl: string): string`, `exchangeCodeForToken(code, redirectUri): Promise<TokenResponse>`, `refreshAccessToken(refreshToken): Promise<TokenResponse>`, `fetchGmailAddress(accessToken): Promise<string>`, `sendRawMessage(accessToken, rawBase64Url): Promise<{id: string; threadId: string}>`, `getMessage(accessToken, id): Promise<GmailMessage>`, `getCurrentHistoryId(accessToken): Promise<string>`, `listHistory(accessToken, startHistoryId): Promise<{historyId: string; addedMessageIds: string[]}>`. Consumed by Task 8 (oauth functions), Task 9 (`sendViaGmail.ts`), Task 12 (`poll-gmail-inbox`).

No test file for this task — it's a thin Deno-specific fetch wrapper (uses `Deno.env.get`), same convention as `_shared/linkedinApi.ts` which has no test file either. Verified manually via the OAuth connect flow in Task 8 and a real send in Task 10.

- [ ] **Step 1: Write `gmailApi.ts`**

```ts
// ============================================================
// _shared/gmailApi.ts
// Helpers Gmail REST API (OAuth token exchange/refresh, envoi,
// lecture de message, polling d'historique) partagés par
// gmail-oauth-callback, dispatch-gmail-sends et poll-gmail-inbox.
// Pas de test unitaire ici (usage Deno.env) — même convention que
// _shared/linkedinApi.ts.
// ============================================================

import { fetchWithTimeout } from "./fetchWithTimeout.ts";
import type { GmailMessage } from "./gmailMessageParser.ts";

export function buildRedirectUri(supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/gmail-oauth-callback`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET")!;
  const body = new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret });

  const res = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail OAuth error: ${JSON.stringify(data)}`);
  return data as TokenResponse;
}

export function exchangeCodeForToken(code: string, redirectUri: string): Promise<TokenResponse> {
  return requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function fetchGmailAddress(accessToken: string): Promise<string> {
  const res = await fetchWithTimeout("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail profile error: ${JSON.stringify(data)}`);
  return data.emailAddress as string;
}

export async function getCurrentHistoryId(accessToken: string): Promise<string> {
  const res = await fetchWithTimeout("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail profile error: ${JSON.stringify(data)}`);
  return String(data.historyId);
}

export async function sendRawMessage(accessToken: string, rawBase64Url: string): Promise<{ id: string; threadId: string }> {
  const res = await fetchWithTimeout("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: rawBase64Url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail send error: ${JSON.stringify(data)}`);
  return { id: data.id, threadId: data.threadId };
}

export async function getMessage(accessToken: string, id: string): Promise<GmailMessage> {
  const res = await fetchWithTimeout(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail get message error: ${JSON.stringify(data)}`);
  return data as GmailMessage;
}

/**
 * Renvoie les IDs des messages ajoutés à l'INBOX depuis startHistoryId.
 * Lève une erreur si startHistoryId est trop ancien (Gmail purge son
 * historique) — l'appelant (poll-gmail-inbox) doit alors resynchroniser
 * via getCurrentHistoryId().
 */
export async function listHistory(accessToken: string, startHistoryId: string): Promise<{ historyId: string; addedMessageIds: string[] }> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/history");
  url.searchParams.set("startHistoryId", startHistoryId);
  url.searchParams.set("historyTypes", "messageAdded");
  url.searchParams.set("labelId", "INBOX");

  const res = await fetchWithTimeout(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail history error ${res.status}: ${JSON.stringify(data)}`);

  const addedMessageIds: string[] = [];
  for (const h of data.history ?? []) {
    for (const m of h.messagesAdded ?? []) {
      addedMessageIds.push(m.message.id);
    }
  }
  return { historyId: data.historyId ?? startHistoryId, addedMessageIds };
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/gmailApi.ts
git commit -m "feat: add Gmail REST API wrapper (OAuth, send, message read, history polling)"
```

---

### Task 8: `gmail-oauth-start` + `gmail-oauth-callback` edge functions

**Files:**
- Create: `supabase/functions/gmail-oauth-start/index.ts`
- Create: `supabase/functions/gmail-oauth-callback/index.ts`

**Interfaces:**
- Consumes: `buildRedirectUri`, `exchangeCodeForToken`, `fetchGmailAddress`, `getCurrentHistoryId` from Task 7 (`gmailApi.ts`).
- Produces: two deployed edge functions reachable at `/functions/v1/gmail-oauth-start` and `/functions/v1/gmail-oauth-callback`; a `gmail_accounts` row on success. Consumed by Task 13 (`gmailService.ts` builds the link to `gmail-oauth-start`).

No automated test — OAuth redirect flows can't be unit tested; verified manually in Task 8's own verification step by actually connecting a Gmail account.

- [ ] **Step 1: Write `gmail-oauth-start/index.ts`**

```ts
// ============================================================
// Edge Function : gmail-oauth-start
// Runtime : Deno (Supabase)
// Rôle : Construit l'URL d'autorisation Google et redirige vers
//        l'écran de consentement Gmail (flux OAuth 2.0).
//        Appelé directement en navigation (pas de CORS/fetch JS).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildRedirectUri } from "../_shared/gmailApi.ts";

serve((req: Request) => {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = buildRedirectUri(supabaseUrl);

  // Scopes : gmail.send (envoi), gmail.readonly (lecture inbox pour
  // détecter réponses/bounces — gmail.metadata ne suffit pas, il faut
  // le corps du message).
  const scope = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly";

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("access_type", "offline");
  authorizeUrl.searchParams.set("prompt", "consent"); // force la délivrance d'un refresh_token à chaque connexion

  return new Response(null, { status: 302, headers: { Location: authorizeUrl.toString() } });
});
```

- [ ] **Step 2: Write `gmail-oauth-callback/index.ts`**

```ts
// ============================================================
// Edge Function : gmail-oauth-callback
// Runtime : Deno (Supabase)
// Rôle : Reçoit le code d'autorisation Google, échange contre un
//        token, récupère l'adresse Gmail connectée + le curseur
//        d'historique de départ, stocke dans gmail_accounts (une
//        seule ligne — upsert par email), redirige vers le front.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildRedirectUri, exchangeCodeForToken, fetchGmailAddress, getCurrentHistoryId } from "../_shared/gmailApi.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  const redirectWithError = (message: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${frontendUrl}/?activeApp=prospection&gmail=error&message=${encodeURIComponent(message)}` },
    });

  if (errorParam) return redirectWithError(`Google a refusé la connexion (${errorParam})`);
  if (!code) return redirectWithError("Réponse Google incomplète (code manquant)");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const redirectUri = buildRedirectUri(supabaseUrl);
    const token = await exchangeCodeForToken(code, redirectUri);

    if (!token.refresh_token) {
      return redirectWithError("Google n'a pas renvoyé de refresh_token — révoque l'accès existant sur myaccount.google.com/permissions puis reconnecte-toi");
    }

    const email = await fetchGmailAddress(token.access_token);
    const lastHistoryId = await getCurrentHistoryId(token.access_token);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    const { error: upsertErr } = await supabase.from("gmail_accounts").upsert(
      {
        email,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: expiresAt,
        last_history_id: lastHistoryId,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

    if (upsertErr) throw upsertErr;

    return new Response(null, {
      status: 302,
      headers: { Location: `${frontendUrl}/?activeApp=prospection&gmail=connected&email=${encodeURIComponent(email)}` },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[gmail-oauth-callback] Erreur :", message);
    return redirectWithError(message);
  }
});
```

- [ ] **Step 3: Add a unique constraint on `gmail_accounts.email` needed by the upsert's `onConflict`**

Add to `archive/schema_gmail_addon.sql` (Task 1), just below the `CREATE TABLE public.gmail_accounts` block:

```sql
ALTER TABLE public.gmail_accounts ADD CONSTRAINT gmail_accounts_email_key UNIQUE (email);
```

(Go back and add this line to the Task 1 file now, before deploying — the `upsert(..., { onConflict: "email" })` call above requires it.)

- [ ] **Step 4: Deploy both functions and set secrets**

Run: `npx supabase functions deploy gmail-oauth-start gmail-oauth-callback`

Set secrets (values come from the Google Cloud OAuth client created per the spec's prerequisites section):

```bash
npx supabase secrets set GMAIL_CLIENT_ID=<your-client-id>
npx supabase secrets set GMAIL_CLIENT_SECRET=<your-client-secret>
```

- [ ] **Step 5: Manually verify by visiting the start URL**

Navigate to `https://<PROJECT_REF>.supabase.co/functions/v1/gmail-oauth-start` in a browser, log in with the personal test Gmail account, accept the consent screen.

Expected: redirected back to `http://localhost:5173/?activeApp=prospection&gmail=connected&email=<test-address>` (or whatever `FRONTEND_URL` is set to), and:

```sql
SELECT email, expires_at, last_history_id FROM public.gmail_accounts;
```

returns exactly one row with the connected address and a non-null `last_history_id`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/gmail-oauth-start supabase/functions/gmail-oauth-callback archive/schema_gmail_addon.sql
git commit -m "feat: add Gmail OAuth connect flow (start + callback edge functions)"
```

---

### Task 9: `sendViaGmail.ts` — send orchestrator (Deno, untested)

**Files:**
- Create: `supabase/functions/_shared/sendViaGmail.ts`

**Interfaces:**
- Consumes: `buildEmailHtml`, `buildRawEmail` from Task 3; `refreshAccessToken`, `sendRawMessage` from Task 7.
- Produces: `sendGeneratedEmailViaGmail(supabase: SupabaseClient, generatedEmailId: string): Promise<SendOutcome>`, `SendOutcome` type (`{success: true; gmailMessageId: string; gmailThreadId: string; sentAt: string; to: string} | {success: false; error: string; alreadySent?: boolean}`). Consumed by Task 10 (`dispatch-gmail-sends`).

No test file — this mirrors `_shared/sendViaResend.ts`, an orchestrator making live DB + network calls, verified manually (same convention noted in project memory: "live-tested by triggering an actual send-email call").

- [ ] **Step 1: Write `sendViaGmail.ts`**

```ts
// ============================================================
// _shared/sendViaGmail.ts
// Logique d'envoi Gmail — remplace _shared/sendViaResend.ts.
// Rafraîchit le token si besoin, construit le MIME (avec
// In-Reply-To si c'est une relance), envoie via Gmail API,
// journalise dans generated_emails + email_logs.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEmailHtml, buildRawEmail } from "./gmailMime.ts";
import { refreshAccessToken, sendRawMessage } from "./gmailApi.ts";

interface GeneratedEmail {
  id: string;
  lead_id: string;
  sujet: string;
  corps_du_mail: string;
  statut_envoi: string;
}

interface LeadEmail {
  email: string;
  contact_name: string;
}

interface GmailAccount {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export type SendOutcome =
  | { success: true; gmailMessageId: string; gmailThreadId: string; sentAt: string; to: string }
  | { success: false; error: string; alreadySent?: boolean };

async function getValidAccessToken(supabase: SupabaseClient, account: GmailAccount): Promise<string> {
  const expiresInMs = new Date(account.expires_at).getTime() - Date.now();
  if (expiresInMs > 5 * 60 * 1000) return account.access_token;

  const refreshed = await refreshAccessToken(account.refresh_token);
  await supabase
    .from("gmail_accounts")
    .update({
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq("id", account.id);

  return refreshed.access_token;
}

export async function sendGeneratedEmailViaGmail(supabase: SupabaseClient, generatedEmailId: string): Promise<SendOutcome> {
  const { data: account, error: accErr } = await supabase
    .from("gmail_accounts")
    .select("id, email, access_token, refresh_token, expires_at")
    .limit(1)
    .maybeSingle();

  if (accErr || !account) {
    return { success: false, error: "Aucun compte Gmail connecté" };
  }

  const { data: genEmail, error: genErr } = await supabase
    .from("generated_emails")
    .select("*")
    .eq("id", generatedEmailId)
    .single();

  if (genErr || !genEmail) {
    return { success: false, error: `Email généré introuvable : ${genErr?.message}` };
  }

  const ge = genEmail as GeneratedEmail;

  if (ge.statut_envoi === "sent") {
    return { success: false, error: "Cet email a déjà été envoyé", alreadySent: true };
  }

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("email, contact_name")
    .eq("id", ge.lead_id)
    .single();

  if (leadErr || !lead?.email) {
    return { success: false, error: `Lead sans email valide : ${leadErr?.message}` };
  }

  const leadData = lead as LeadEmail;

  await supabase.from("generated_emails").update({ statut_envoi: "sending" }).eq("id", generatedEmailId);

  // Relance : on thread avec le dernier email sortant du lead pour que Gmail
  // affiche la conversation groupée, des deux côtés.
  const { data: lastOutbound } = await supabase
    .from("email_logs")
    .select("message_id")
    .eq("lead_id", ge.lead_id)
    .eq("direction", "outbound")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email?id=${generatedEmailId}&t=open`;
  const htmlBody = buildEmailHtml(ge.corps_du_mail, trackingPixelUrl);

  const rawMessage = buildRawEmail({
    fromEmail: account.email,
    fromName: "Seiki CRM",
    toEmail: leadData.email,
    subject: ge.sujet,
    textBody: ge.corps_du_mail,
    htmlBody,
    inReplyTo: lastOutbound?.message_id ?? undefined,
    references: lastOutbound?.message_id ?? undefined,
  });

  const recordFailure = async (errorMessage: string) => {
    await supabase.from("generated_emails").update({ statut_envoi: "failed" }).eq("id", generatedEmailId);
    await supabase.from("email_logs").insert([{
      lead_id: ge.lead_id,
      generated_email_id: generatedEmailId,
      direction: "outbound",
      from_email: account.email,
      to_email: leadData.email,
      subject: ge.sujet,
      status: "failed",
      error_message: errorMessage,
    }]);
  };

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(supabase, account as GmailAccount);
  } catch (err) {
    const message = `Rafraîchissement du token Gmail échoué : ${err instanceof Error ? err.message : String(err)}`;
    await recordFailure(message);
    return { success: false, error: message };
  }

  let sendResult: { id: string; threadId: string };
  try {
    sendResult = await sendRawMessage(accessToken, rawMessage);
  } catch (err) {
    const message = `Erreur envoi Gmail : ${err instanceof Error ? err.message : String(err)}`;
    await recordFailure(message);
    return { success: false, error: message };
  }

  const sentAt = new Date().toISOString();

  await supabase
    .from("generated_emails")
    .update({ statut_envoi: "sent", sent_at: sentAt, gmail_message_id: sendResult.id, gmail_thread_id: sendResult.threadId })
    .eq("id", generatedEmailId);

  const { error: logErr } = await supabase.from("email_logs").insert([{
    lead_id: ge.lead_id,
    generated_email_id: generatedEmailId,
    direction: "outbound",
    from_email: account.email,
    to_email: leadData.email,
    subject: ge.sujet,
    body_preview: ge.corps_du_mail.substring(0, 500),
    body_html: htmlBody,
    message_id: sendResult.id,
    status: "sent",
    sent_at: sentAt,
  }]);

  if (logErr) {
    console.warn("[sendViaGmail] Erreur insertion log (non bloquante) :", logErr.message);
  }

  return { success: true, gmailMessageId: sendResult.id, gmailThreadId: sendResult.threadId, sentAt, to: leadData.email };
}
```

Threading uses `email_logs.message_id` directly (the last outbound row for the lead), not Gmail header parsing — `gmailMessageParser.ts` isn't needed here, only by Task 12's inbound-reading path.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/sendViaGmail.ts
git commit -m "feat: add Gmail send orchestrator (replaces sendViaResend.ts)"
```

---

### Task 10: `dispatch-gmail-sends` edge function

**Files:**
- Create: `supabase/functions/dispatch-gmail-sends/index.ts`

**Interfaces:**
- Consumes: `sendGeneratedEmailViaGmail` from Task 9; `requireUserOrServiceRole` from `_shared/requireUser.ts` (existing).
- Produces: deployed edge function at `/functions/v1/dispatch-gmail-sends`, callable by cron (Task 1's `schema_gmail_cron.sql`) and by the frontend manual-trigger button (Task 16).

No automated test — same integration-only convention as `flush-send-queue`/`publish-linkedin-post`.

- [ ] **Step 1: Write `dispatch-gmail-sends/index.ts`**

```ts
// ============================================================
// Edge Function : dispatch-gmail-sends
// Runtime : Deno (Supabase)
// Rôle : Envoie via Gmail tous les generated_emails dont le
//        créneau planifié (scheduled_at) est échu. Le calcul du
//        créneau lui-même est fait par schedule-gmail-sends — cette
//        fonction ne fait qu'exécuter les envois déjà décidés.
//        Appelée par le cron Supabase toutes les 2 min, ou par le
//        bouton manuel de test dans l'UI.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendGeneratedEmailViaGmail } from "../_shared/sendViaGmail.ts";
import { requireUserOrServiceRole } from "../_shared/requireUser.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authError = await requireUserOrServiceRole(req, supabase, corsHeaders(req));
    if (authError) return authError;

    const { data: due, error: dueErr } = await supabase
      .from("generated_emails")
      .select("id")
      .eq("statut_envoi", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (dueErr) throw dueErr;

    let sent = 0;
    let failed = 0;

    for (const row of due ?? []) {
      try {
        const outcome = await sendGeneratedEmailViaGmail(supabase, row.id as string);
        if (outcome.success) sent++;
        else failed++;
      } catch (err) {
        console.error("[dispatch-gmail-sends] Send failed for row", row.id, ":", err instanceof Error ? err.message : err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed: (due ?? []).length, sent, failed }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[dispatch-gmail-sends] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] **Step 2: Deploy**

Run: `npx supabase functions deploy dispatch-gmail-sends`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/dispatch-gmail-sends
git commit -m "feat: add dispatch-gmail-sends edge function (executes paced sends)"
```

---

### Task 11: `schedule-gmail-sends` edge function (pacing engine)

**Files:**
- Create: `supabase/functions/schedule-gmail-sends/index.ts`

**Interfaces:**
- Consumes: `computeDailyCap`, `DEFAULT_RAMP` from Task 4; `getTodaysWindowBounds`, `pickRandomSendTimes` from Task 5.
- Produces: deployed edge function at `/functions/v1/schedule-gmail-sends`. Promotes `generated_emails` rows from `statut_envoi='approved'` to `'scheduled'` with a computed `scheduled_at`.

No automated test — this is the orchestration layer around the already-tested pure modules (Tasks 4 and 5 hold all the actual logic under test); verified manually.

- [ ] **Step 1: Write `schedule-gmail-sends/index.ts`**

```ts
// ============================================================
// Edge Function : schedule-gmail-sends
// Runtime : Deno (Supabase)
// Rôle : Moteur de pacing — calcule le volume autorisé aujourd'hui
//        (courbe de warm-up), prend les brouillons 'approved' les
//        plus anciens dans cette limite, et leur assigne un créneau
//        aléatoire dans la fenêtre horaire du jour. Ne fait AUCUN
//        envoi — dispatch-gmail-sends s'en charge séparément.
//        Appelée par le cron Supabase toutes les heures, ou par le
//        bouton manuel de test dans l'UI.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireUserOrServiceRole } from "../_shared/requireUser.ts";
import { computeDailyCap } from "../_shared/warmupRamp.ts";
import { getTodaysWindowBounds, pickRandomSendTimes, type SendWindow } from "../_shared/sendWindow.ts";

function skip(req: Request, reason: string) {
  return new Response(
    JSON.stringify({ skipped: reason, scheduled: 0 }),
    { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authError = await requireUserOrServiceRole(req, supabase, corsHeaders(req));
    if (authError) return authError;

    const { data: modeSetting } = await supabase.from("app_settings").select("value").eq("key", "prospection_mode").single();
    const { data: capSetting } = await supabase.from("app_settings").select("value").eq("key", "gmail_daily_cap").single();
    const { data: warmupSetting } = await supabase.from("app_settings").select("value").eq("key", "gmail_warmup_start_date").single();
    const { data: windowSetting } = await supabase.from("app_settings").select("value").eq("key", "gmail_send_window").single();

    const mode = (modeSetting?.value as { mode?: string } | null)?.mode ?? "manual";

    let triggeredBy: string | undefined;
    try {
      const body = await req.json();
      triggeredBy = body?.triggeredBy;
    } catch {
      // pas de corps (appel cron) — reste undefined
    }
    const isManualTrigger = triggeredBy === "manual-button";
    if (mode === "manual" && !isManualTrigger) {
      return skip(req, "prospection_mode is manual");
    }

    const targetCap = (capSetting?.value as { count?: number } | null)?.count;
    const warmupStartDate = (warmupSetting?.value as { date?: string } | null)?.date;
    const sendWindow = windowSetting?.value as SendWindow | undefined;

    if (!targetCap || !warmupStartDate || !sendWindow) {
      return skip(req, "Gmail pacing not configured (gmail_daily_cap / gmail_warmup_start_date / gmail_send_window)");
    }

    const now = new Date();
    const allowedToday = computeDailyCap(warmupStartDate, now, targetCap);

    // scheduled_at is always set the moment a row leaves 'approved' (right
    // below), and dispatch-gmail-sends sends it within ~2 min of that slot —
    // so for every row in these three statuses, scheduled_at's date IS the
    // day it was/will be sent. Filtering on scheduled_at alone (instead of
    // an OR against sent_at too) avoids a fragile two-column OR condition.
    const today = now.toISOString().slice(0, 10);
    const { count: alreadyCounted } = await supabase
      .from("generated_emails")
      .select("id", { count: "exact", head: true })
      .in("statut_envoi", ["scheduled", "sending", "sent"])
      .gte("scheduled_at", `${today}T00:00:00.000Z`)
      .lt("scheduled_at", `${today}T23:59:59.999Z`);

    const remaining = Math.max(0, allowedToday - (alreadyCounted ?? 0));
    if (remaining === 0) {
      return skip(req, "daily warm-up cap already reached for today");
    }

    const bounds = getTodaysWindowBounds(now, sendWindow);
    if (!bounds) {
      return skip(req, "outside configured send window");
    }

    const { data: approved, error: approvedErr } = await supabase
      .from("generated_emails")
      .select("id")
      .eq("statut_envoi", "approved")
      .order("created_at", { ascending: true })
      .limit(remaining);

    if (approvedErr) throw approvedErr;
    if (!approved || approved.length === 0) {
      return skip(req, "no approved drafts waiting");
    }

    const sendTimes = pickRandomSendTimes(approved.length, bounds.start, bounds.end);

    for (let i = 0; i < approved.length; i++) {
      await supabase
        .from("generated_emails")
        .update({ statut_envoi: "scheduled", scheduled_at: sendTimes[i].toISOString() })
        .eq("id", approved[i].id);
    }

    return new Response(
      JSON.stringify({ scheduled: approved.length }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[schedule-gmail-sends] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] **Step 2: Deploy**

Run: `npx supabase functions deploy schedule-gmail-sends`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/schedule-gmail-sends
git commit -m "feat: add schedule-gmail-sends edge function (warm-up ramp pacing engine)"
```

---

### Task 12: `poll-gmail-inbox` edge function (reply + bounce detection)

**Files:**
- Create: `supabase/functions/poll-gmail-inbox/index.ts`

**Interfaces:**
- Consumes: `getMessage`, `listHistory`, `getCurrentHistoryId`, `refreshAccessToken` from Task 7; `getHeader`, `extractPlainTextBody` from Task 2; `classifyInboundMessage` from Task 6; `requireServiceRole` from `_shared/requireUser.ts`.
- Produces: deployed edge function at `/functions/v1/poll-gmail-inbox`. Updates `email_logs.status` (`opened`/`replied`/`bounced`), `leads.sequence_status='replied'`, inserts `history` rows — same effects `resend-webhook`'s inbound branches produced.

No automated test — network + DB integration, verified manually by replying to a real sent test email.

- [ ] **Step 1: Write `poll-gmail-inbox/index.ts`**

```ts
// ============================================================
// Edge Function : poll-gmail-inbox
// Runtime : Deno (Supabase)
// Rôle : Remplace resend-webhook. Gmail n'a pas de webhook —
//        on interroge périodiquement l'historique de la boîte de
//        réception pour détecter réponses (par expéditeur connu)
//        et bounces (par thread + heuristique expéditeur/sujet).
//        Appelée par le cron Supabase toutes les 5 min.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireServiceRole } from "../_shared/requireUser.ts";
import { getMessage, listHistory, getCurrentHistoryId, refreshAccessToken } from "../_shared/gmailApi.ts";
import { getHeader, extractPlainTextBody, type GmailMessage } from "../_shared/gmailMessageParser.ts";
import { classifyInboundMessage } from "../_shared/gmailReplyClassifier.ts";

interface GmailAccount {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_history_id: string | null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  const authError = requireServiceRole(req, corsHeaders(req));
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: account, error: accErr } = await supabase
      .from("gmail_accounts")
      .select("id, access_token, refresh_token, expires_at, last_history_id")
      .limit(1)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(JSON.stringify({ skipped: "no Gmail account connected" }), {
        status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const acc = account as GmailAccount;

    let accessToken = acc.access_token;
    const expiresInMs = new Date(acc.expires_at).getTime() - Date.now();
    if (expiresInMs < 5 * 60 * 1000) {
      const refreshed = await refreshAccessToken(acc.refresh_token);
      accessToken = refreshed.access_token;
      await supabase
        .from("gmail_accounts")
        .update({ access_token: refreshed.access_token, expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString() })
        .eq("id", acc.id);
    }

    if (!acc.last_history_id) {
      const historyId = await getCurrentHistoryId(accessToken);
      await supabase.from("gmail_accounts").update({ last_history_id: historyId }).eq("id", acc.id);
      return new Response(JSON.stringify({ skipped: "history cursor initialized, nothing to process yet" }), {
        status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let historyResult;
    try {
      historyResult = await listHistory(accessToken, acc.last_history_id);
    } catch (err) {
      // startHistoryId trop ancien (Gmail purge son historique après un
      // certain temps) — on resynchronise sur l'état courant plutôt que
      // de planter, au prix de manquer les messages de l'intervalle.
      console.warn("[poll-gmail-inbox] History resync needed:", err instanceof Error ? err.message : err);
      const historyId = await getCurrentHistoryId(accessToken);
      await supabase.from("gmail_accounts").update({ last_history_id: historyId }).eq("id", acc.id);
      return new Response(JSON.stringify({ skipped: "history cursor resynced after gap" }), {
        status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let replies = 0;
    let bounces = 0;
    let ignored = 0;

    for (const messageId of historyResult.addedMessageIds) {
      const msg = await getMessage(accessToken, messageId);
      const outcome = await processInboundMessage(supabase, msg);
      if (outcome === "reply") replies++;
      else if (outcome === "bounce") bounces++;
      else ignored++;
    }

    await supabase.from("gmail_accounts").update({ last_history_id: historyResult.historyId }).eq("id", acc.id);

    return new Response(
      JSON.stringify({ processed: historyResult.addedMessageIds.length, replies, bounces, ignored }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[poll-gmail-inbox] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});

async function processInboundMessage(
  supabase: ReturnType<typeof createClient>,
  msg: GmailMessage,
): Promise<"reply" | "bounce" | "ignored"> {
  const fromHeader = getHeader(msg, "From") ?? "";
  const subject = getHeader(msg, "Subject") ?? "(sans sujet)";
  const match = fromHeader.match(/<([^>]+)>/);
  const senderEmail = (match ? match[1] : fromHeader).trim().toLowerCase();

  const classification = classifyInboundMessage(senderEmail, subject);
  const now = new Date().toISOString();

  if (classification === "bounce") {
    const { data: relatedEmail } = await supabase
      .from("generated_emails")
      .select("id, lead_id")
      .eq("gmail_thread_id", msg.threadId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!relatedEmail) return "ignored";

    const bodyPreview = extractPlainTextBody(msg).slice(0, 500);
    await supabase
      .from("email_logs")
      .update({ status: "bounced", error_message: bodyPreview || `Bounce détecté (${subject})` })
      .eq("generated_email_id", relatedEmail.id)
      .eq("direction", "outbound")
      .neq("status", "replied");

    return "bounce";
  }

  // classification === 'reply'
  const { data: lead } = await supabase
    .from("leads")
    .select("id, contact_name, company_name")
    .eq("email", senderEmail)
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();

  if (!lead) return "ignored";

  await supabase.from("leads").update({ sequence_status: "replied", updated_at: now }).eq("id", lead.id);

  const textBody = extractPlainTextBody(msg);
  const textBodyPreview = textBody.length > 500 ? textBody.substring(0, 500) + "..." : textBody;

  await supabase.from("history").insert([{
    lead_id: lead.id,
    action_type: "email_received",
    content: `Email reçu de ${lead.contact_name || senderEmail} : ${subject}\n\n${textBodyPreview}`,
    metadata: { subject, from: fromHeader, gmail_message_id: msg.id },
    is_auto: true,
  }]);

  const { data: outboundLog } = await supabase
    .from("email_logs")
    .select("id, generated_email_id")
    .eq("lead_id", lead.id)
    .eq("direction", "outbound")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (outboundLog) {
    await supabase
      .from("email_logs")
      .update({ status: "replied", replied_at: now })
      .eq("id", outboundLog.id);
  }

  await supabase.from("email_logs").insert([{
    lead_id: lead.id,
    direction: "inbound",
    from_email: senderEmail,
    to_email: getHeader(msg, "To") ?? "",
    subject,
    body_preview: textBodyPreview,
    body_html: textBody,
    message_id: msg.id,
    in_reply_to: getHeader(msg, "In-Reply-To"),
    status: "replied",
    received_at: now,
    generated_email_id: outboundLog?.generated_email_id ?? null,
  }]);

  return "reply";
}
```

- [ ] **Step 2: Deploy**

Run: `npx supabase functions deploy poll-gmail-inbox`

- [ ] **Step 3: Manually verify with a real reply**

Send a test email through the pipeline (Tasks 13-16 must be done first, or trigger `dispatch-gmail-sends` directly via `curl` with the cron secret against a manually-approved+scheduled row), then reply to it from a different mailbox, then either wait 5 minutes or invoke:

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/poll-gmail-inbox \
  -H "Authorization: Bearer <CRON_SECRET>" -H "apikey: <ANON_KEY>"
```

Expected: `{"processed":1,"replies":1,"bounces":0,"ignored":0}`, and:

```sql
SELECT sequence_status FROM leads WHERE email = '<the-test-lead-email>';
-- expect: replied
SELECT status, body_preview FROM email_logs WHERE direction = 'inbound' ORDER BY created_at DESC LIMIT 1;
-- expect: status = 'replied', body_preview containing the reply text
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/poll-gmail-inbox
git commit -m "feat: add poll-gmail-inbox edge function (reply + bounce detection, replaces resend-webhook)"
```

---

### Task 13: Remove Resend code

**Files:**
- Delete: `supabase/functions/send-email/index.ts` (and the now-empty `send-email/` directory)
- Delete: `supabase/functions/flush-send-queue/index.ts` (and directory)
- Delete: `supabase/functions/resend-webhook/index.ts` (and directory)
- Delete: `supabase/functions/_shared/sendViaResend.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing — pure removal.

The git-level deletion below is safe to do now: it only removes source files from this repo, it doesn't touch what's currently live on Supabase. The actual undeploy (Step 3) is the part with a dependency — it must wait until Task 16's frontend changes (which stop calling `send-email`/`flush-send-queue`) are built, deployed, and verified working, otherwise the live frontend would start calling functions that no longer exist.

- [ ] **Step 1: Delete the files**

```bash
git rm -r supabase/functions/send-email supabase/functions/flush-send-queue supabase/functions/resend-webhook supabase/functions/_shared/sendViaResend.ts
```

- [ ] **Step 2: Commit the removal**

```bash
git commit -m "chore: remove Resend sending code (replaced by Gmail API pipeline)"
```

- [ ] **Step 3: Undeploy from Supabase (only after Task 16's frontend changes are deployed and verified working)**

```bash
npx supabase functions delete send-email
npx supabase functions delete flush-send-queue
npx supabase functions delete resend-webhook
```

Also remove the Resend webhook URL from the Resend dashboard (Webhooks settings) so Resend stops trying to call a deleted function.

---

### Task 14: `gmailService.ts` + Connect button in `ProspectionHeader.tsx`

**Files:**
- Create: `src/services/gmailService.ts`
- Modify: `src/views/prospection/ProspectionHeader.tsx`
- Modify: `src/views/Prospection.tsx`

**Interfaces:**
- Produces: `GmailAccount` type (`{id, email, expires_at, connected_at}`), `gmailService.getAccount(): Promise<GmailAccount | null>`, `gmailService.oauthConnectUrl(): string`. Consumed by `Prospection.tsx` and `ProspectionHeader.tsx`.
- Consumes: nothing new (standard `supabase` client + `import.meta.env.VITE_SUPABASE_URL`, same as `linkedinService.ts`).

- [ ] **Step 1: Write `src/services/gmailService.ts`**

```ts
// ============================================================
// gmailService.ts
// Accès au compte Gmail connecté pour l'envoi de prospection.
// ============================================================

import { supabase } from './supabaseClient';

export interface GmailAccount {
  id: string;
  email: string;
  expires_at: string;
  connected_at: string;
}

export const gmailService = {
  async getAccount(): Promise<GmailAccount | null> {
    const { data, error } = await supabase
      .from('gmail_accounts')
      .select('id, email, expires_at, connected_at')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  oauthConnectUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/gmail-oauth-start`;
  },
};
```

- [ ] **Step 2: Modify `src/views/prospection/ProspectionHeader.tsx` — add the Connect button**

Add the import at the top (after the existing `ProspectionModeToggle` import on line 3):

```ts
import { Link2, CheckCircle2 } from 'lucide-react';
import type { GmailAccount } from '../../services/gmailService';
```

Change the props interface (currently lines 7-12) to:

```ts
interface ProspectionHeaderProps {
  mode: 'manual' | 'auto';
  onModeChange: (newMode: 'manual' | 'auto') => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  gmailAccount: GmailAccount | null;
  gmailConnectUrl: string;
}
```

Change the component signature (currently lines 14-19) to accept the two new props:

```tsx
export const ProspectionHeader: React.FC<ProspectionHeaderProps> = ({
  mode,
  onModeChange,
  activeTab,
  setActiveTab,
  gmailAccount,
  gmailConnectUrl,
}) => {
```

In the top row (currently lines 22-38, the `<div className="flex flex-col sm:flex-row ...">` containing the `<h1>` and `<ProspectionModeToggle>`), add the Connect button between them:

```tsx
        <div className="flex items-center gap-3">
          <a
            href={gmailConnectUrl}
            className="text-xs flex items-center gap-2 px-3.5 py-2 rounded-control border border-line-strong bg-surface text-ink-soft hover:text-ink hover:border-line-focus transition-all duration-200 cursor-pointer"
          >
            {gmailAccount ? (
              <CheckCircle2 size={15} strokeWidth={2} className="text-success" />
            ) : (
              <Link2 size={15} strokeWidth={2} className="text-[#D4C4A8]" />
            )}
            <span className="font-medium">{gmailAccount ? `${gmailAccount.email} (Connecté)` : 'Connecter Gmail'}</span>
          </a>
          <ProspectionModeToggle mode={mode} onChange={onModeChange} />
        </div>
```

(This replaces the bare `<ProspectionModeToggle mode={mode} onChange={onModeChange} />` line that currently sits directly inside the outer flex row.)

- [ ] **Step 3: Modify `src/views/Prospection.tsx` — load the account and handle the OAuth redirect**

Add imports (after line 3, `import { settingsService } ...`):

```ts
import { gmailService, type GmailAccount } from '../services/gmailService';
```

Add state (after the existing `mode` state on line 13):

```ts
const [gmailAccount, setGmailAccount] = useState<GmailAccount | null>(null);
```

Replace the existing `useEffect` (lines 15-17) with one that also loads the Gmail account and handles the OAuth redirect query params:

```tsx
useEffect(() => {
  settingsService.getProspectionSettings().then((s) => setMode(s.prospection_mode));
  gmailService.getAccount().then(setGmailAccount).catch(() => {});

  const params = new URLSearchParams(window.location.search);
  const gmailStatus = params.get('gmail');
  if (gmailStatus === 'connected') {
    showToast(`Compte Gmail "${params.get('email')}" connecté.`, 'success');
    gmailService.getAccount().then(setGmailAccount).catch(() => {});
  } else if (gmailStatus === 'error') {
    showToast(params.get('message') || 'Connexion Gmail échouée.', 'error');
  }
  if (gmailStatus) {
    window.history.replaceState({}, '', window.location.pathname);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Update the `<ProspectionHeader>` usage (lines 35-40) to pass the two new props:

```tsx
<ProspectionHeader
  mode={mode}
  onModeChange={handleModeChange}
  activeTab={activeTab}
  setActiveTab={setActiveTab}
  gmailAccount={gmailAccount}
  gmailConnectUrl={gmailService.oauthConnectUrl()}
/>
```

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, open the Prospection tab.

Expected: a "Connecter Gmail" pill button appears next to the mode toggle. Clicking it navigates to Google's consent screen (will fail until Task 8's secrets are set on the deployed project, which is fine at this point in the plan — full end-to-end verification happens after Task 8 is deployed).

- [ ] **Step 5: Commit**

```bash
git add src/services/gmailService.ts src/views/prospection/ProspectionHeader.tsx src/views/Prospection.tsx
git commit -m "feat: add Gmail connect button to Prospection header"
```

---

### Task 15: `emailsService.ts` + `settingsService.ts` updates

**Files:**
- Modify: `src/services/emailsService.ts`
- Modify: `src/services/settingsService.ts`

**Interfaces:**
- Produces: updated `GeneratedEmail` type (drop `resend_message_id`, add `gmail_message_id: string | null`, `gmail_thread_id: string | null`; `statut_envoi` includes `'scheduled'`), `emailsService.approveAndSchedule(id): Promise<void>` (no longer returns a date — direct DB update, no RPC), removal of `emailsService.sendEmail`/`emailsService.flushSendQueue`, new `emailsService.runPacingCycleNow(): Promise<{scheduled: number; processed: number; sent: number; failed: number}>`. `settingsService`: `ProspectionSettings` drops `daily_send_quota`, gains `gmailDailyCap: number | null`, `gmailWarmupStartDate: string | null`, `gmailSendWindow: {days: number[]; start: string; end: string}`.
- Consumed by Task 16 (`EmailPreviewCard.tsx`, `ValidationTab.tsx`) and Task 17 (`Settings.tsx`, `ProspectionSettingsTab.tsx`).

- [ ] **Step 1: Modify `src/services/emailsService.ts`**

Replace the `GeneratedEmail` interface (lines 12-37) with:

```ts
export interface GeneratedEmail {
  id: string;
  lead_id: string;
  sequence_step_id: string | null;
  sujet: string;
  corps_du_mail: string;
  icebreaker: string | null;
  statut_envoi: 'draft' | 'approved' | 'scheduled' | 'sending' | 'sent' | 'failed';
  model_used: string;
  prompt_used: string | null;
  generation_ms: number | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  created_at: string;
  lead?: {
    contact_name: string;
    company_name: string;
    email: string | null;
    poste: string | null;
    segment: string;
  } | null;
}
```

Remove the `SendResult` interface (lines 39-44) entirely — no longer used.

Replace `approveAndSchedule` (lines 101-106):

```ts
  /** Approuve un email — rejoint la file de pacing (schedule-gmail-sends l'y prendra) */
  async approveAndSchedule(generatedEmailId: string): Promise<void> {
    const { error } = await supabase
      .from('generated_emails')
      .update({ statut_envoi: 'approved', scheduled_at: null, approved_at: new Date().toISOString() })
      .eq('id', generatedEmailId);
    if (error) throw error;
  },
```

Remove `sendEmail` (lines 108-125) and `flushSendQueue` (lines 127-130) entirely, replacing both with:

```ts
  /** Lance immédiatement un cycle pacing + dispatch (bouton manuel de test) */
  async runPacingCycleNow(): Promise<{ scheduled: number; sent: number; failed: number }> {
    const scheduleResult = await callEdgeFunction<{ scheduled?: number; skipped?: string }>(
      'schedule-gmail-sends', { triggeredBy: 'manual-button' }
    );
    const dispatchResult = await callEdgeFunction<{ sent: number; failed: number }>(
      'dispatch-gmail-sends', { triggeredBy: 'manual-button' }
    );
    return { scheduled: scheduleResult.scheduled ?? 0, sent: dispatchResult.sent, failed: dispatchResult.failed };
  },
```

- [ ] **Step 2: Modify `src/services/settingsService.ts`**

Replace the `ProspectionSettings` interface (lines 17-23):

```ts
export interface ProspectionSettings {
  prospection_mode: 'manual' | 'auto';
  followup_1_days: number;
  followup_2_days: number;
  archive_after_followups: number;
  gmail_daily_cap: number | null;
  gmail_warmup_start_date: string | null;
  gmail_send_window: { days: number[]; start: string; end: string };
}
```

Replace `getProspectionSettings` (lines 60-70):

```ts
  async getProspectionSettings(): Promise<ProspectionSettings> {
    const all = await this.getSettings();
    const find = (key: string) => all.find((s) => s.key === key)?.value as Record<string, unknown> | undefined;
    return {
      prospection_mode: (find('prospection_mode')?.mode as 'manual' | 'auto') ?? 'manual',
      followup_1_days: (find('followup_1_days')?.days as number) ?? 5,
      followup_2_days: (find('followup_2_days')?.days as number) ?? 10,
      archive_after_followups: (find('archive_after_followups')?.count as number) ?? 2,
      gmail_daily_cap: (find('gmail_daily_cap')?.count as number) ?? null,
      gmail_warmup_start_date: (find('gmail_warmup_start_date')?.date as string) ?? null,
      gmail_send_window: (find('gmail_send_window') as { days: number[]; start: string; end: string } | undefined)
        ?? { days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' },
    };
  },
```

Replace `updateProspectionSettings` (lines 84-92):

```ts
  async updateProspectionSettings(updates: Partial<ProspectionSettings>): Promise<void> {
    const jobs: Promise<void>[] = [];
    if (updates.prospection_mode !== undefined) jobs.push(this.updateSetting('prospection_mode', { mode: updates.prospection_mode }));
    if (updates.followup_1_days !== undefined) jobs.push(this.updateSetting('followup_1_days', { days: updates.followup_1_days }));
    if (updates.followup_2_days !== undefined) jobs.push(this.updateSetting('followup_2_days', { days: updates.followup_2_days }));
    if (updates.archive_after_followups !== undefined) jobs.push(this.updateSetting('archive_after_followups', { count: updates.archive_after_followups }));
    if (updates.gmail_daily_cap !== undefined) jobs.push(this.updateSetting('gmail_daily_cap', { count: updates.gmail_daily_cap }));
    if (updates.gmail_warmup_start_date !== undefined) jobs.push(this.updateSetting('gmail_warmup_start_date', { date: updates.gmail_warmup_start_date }));
    if (updates.gmail_send_window !== undefined) jobs.push(this.updateSetting('gmail_send_window', updates.gmail_send_window));
    await Promise.all(jobs);
  },
```

Also update the `AppSetting['value']` type (lines 3-15) to allow the new shapes:

```ts
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
  label: string;
  category: string;
}
```

- [ ] **Step 3: Run the frontend build to catch type errors from this change**

Run: `npm run build`
Expected: FAILS at this point — `EmailPreviewCard.tsx` and `ValidationTab.tsx` still reference the removed `sendEmail`/`flushSendQueue`/old `GeneratedEmail` shape. This is expected; Task 16 fixes it. Confirm the errors are exactly in those two files and nowhere else.

- [ ] **Step 4: Commit**

```bash
git add src/services/emailsService.ts src/services/settingsService.ts
git commit -m "feat: update emailsService/settingsService for Gmail pacing model"
```

---

### Task 16: `EmailPreviewCard.tsx` + `ValidationTab.tsx` updates

**Files:**
- Modify: `src/views/prospection/EmailPreviewCard.tsx`
- Modify: `src/views/prospection/ValidationTab.tsx`

**Interfaces:**
- Consumes: `emailsService.approveAndSchedule` (now `Promise<void>`), `emailsService.runPacingCycleNow` from Task 15.

- [ ] **Step 1: Modify `src/views/prospection/EmailPreviewCard.tsx` — remove the instant-send branch**

Replace `handleApproveAndSend` (lines 22-59):

```tsx
  const handleApprove = async () => {
    setIsSending(true);
    try {
      await emailsService.approveAndSchedule(email.id);
      showToast(
        email.statut_envoi === 'failed'
          ? `Remis en file d'envoi pour ${email.lead?.contact_name || 'le prospect'}.`
          : `Approuvé — sera envoyé automatiquement selon la planification (${email.lead?.contact_name || 'le prospect'}).`,
        'success'
      );
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur approbation', 'error');
    } finally {
      setIsSending(false);
    }
  };
```

Update the button (lines 169-182) to call the renamed handler and drop the "Envoi..." wording (nothing sends synchronously anymore):

```tsx
              <AccentButton
                variant="primary"
                onClick={handleApprove}
                disabled={isSending}
                icon={
                  isSending ? (
                    <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <Send size={14} strokeWidth={2} />
                  )
                }
              >
                {isSending ? 'Approbation...' : email.statut_envoi === 'failed' ? 'Remettre en file' : 'Approuver'}
              </AccentButton>
```

- [ ] **Step 2: Modify `src/views/prospection/ValidationTab.tsx` — replace the flush button with a pacing-cycle trigger**

Replace the `quota` state and its loading effect (lines 16, 34-36):

```tsx
  const [running, setRunning] = useState(false);
```

(Remove the `quota` state entirely, and the `useEffect` that loaded `daily_send_quota` — that setting no longer exists.)

Replace `handleFlush` (lines 38-53) with:

```tsx
  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await emailsService.runPacingCycleNow();
      if (result.scheduled === 0 && result.sent === 0) {
        showToast('Rien à envoyer pour le moment (hors fenêtre, quota du jour atteint, ou aucun brouillon approuvé)', 'info');
      } else {
        showToast(`${result.sent} email(s) envoyé(s)${result.failed > 0 ? `, ${result.failed} échec(s)` : ''}`, result.failed > 0 ? 'info' : 'success');
      }
      loadDrafts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur cycle d\'envoi', 'error');
    } finally {
      setRunning(false);
    }
  };
```

Update the button (lines 61-75):

```tsx
        <AccentButton
          variant="primary"
          onClick={handleRunNow}
          disabled={running}
          icon={
            running ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            ) : (
              <Send size={14} strokeWidth={2} />
            )
          }
        >
          {running ? 'Cycle en cours...' : 'Lancer un cycle d\'envoi maintenant'}
        </AccentButton>
```

- [ ] **Step 3: Run the frontend build to confirm the type errors from Task 15 are resolved**

Run: `npm run build`
Expected: PASS, no TypeScript errors.

- [ ] **Step 4: Run the frontend test suite**

Run: `npm test`
Expected: PASS (all existing tests plus the new `_shared/*.test.ts` files from Tasks 2-6).

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`, open Prospection → Validation tab.

Expected: the button reads "Lancer un cycle d'envoi maintenant" (no more quota display, since `daily_send_quota` is gone). Clicking "Approuver" on a draft removes it from the validation list (no immediate "Envoyé !" toast — it now just confirms approval).

- [ ] **Step 6: Commit**

```bash
git add src/views/prospection/EmailPreviewCard.tsx src/views/prospection/ValidationTab.tsx
git commit -m "feat: update Prospection UI for pacing-based approval flow (no instant send)"
```

---

### Task 17: Settings UI for warm-up/cap/window

**Files:**
- Modify: `src/views/settings/ProspectionSettingsTab.tsx`
- Modify: `src/views/Settings.tsx`

**Interfaces:**
- Consumes: `settingsService.getProspectionSettings`/`updateProspectionSettings` (updated shape from Task 15).

- [ ] **Step 1: Modify `src/views/settings/ProspectionSettingsTab.tsx`**

Replace the whole file:

```tsx
import React from 'react';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

interface ProspectionSettingsTabProps {
  followup1Days: number;
  followup2Days: number;
  archiveAfter: number;
  gmailDailyCap: number | null;
  gmailWarmupStartDate: string | null;
  gmailWindowStart: string;
  gmailWindowEnd: string;
  onFollowup1DaysChange: (v: number) => void;
  onFollowup2DaysChange: (v: number) => void;
  onArchiveAfterChange: (v: number) => void;
  onGmailDailyCapChange: (v: number | null) => void;
  onGmailWarmupStartDateChange: (v: string | null) => void;
  onGmailWindowStartChange: (v: string) => void;
  onGmailWindowEndChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ProspectionSettingsTab: React.FC<ProspectionSettingsTabProps> = ({
  followup1Days,
  followup2Days,
  archiveAfter,
  gmailDailyCap,
  gmailWarmupStartDate,
  gmailWindowStart,
  gmailWindowEnd,
  onFollowup1DaysChange,
  onFollowup2DaysChange,
  onArchiveAfterChange,
  onGmailDailyCapChange,
  onGmailWarmupStartDateChange,
  onGmailWindowStartChange,
  onGmailWindowEndChange,
  onSubmit,
}) => (
  <div className="space-y-4">
    <div className="rounded-surface border border-line bg-elevated p-5">
      <div className="mb-3.5 text-sm font-bold text-ink">Envoi Gmail — pacing anti-spam</div>
      <p className="text-[11px] text-ink-faint mb-4">
        Le volume envoyé chaque jour monte progressivement depuis la date de début de warm-up jusqu'au plafond cible ci-dessous,
        et reste confiné à la fenêtre horaire indiquée (jours ouvrés, heures de bureau) — protège le compte Gmail personnel
        contre les signalements spam en prospection à froid.
      </p>
      <form onSubmit={onSubmit}>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date de début du warm-up">
            <input
              type="date"
              value={gmailWarmupStartDate ?? ''}
              onChange={(e) => onGmailWarmupStartDateChange(e.target.value || null)}
              className={inputClass}
            />
          </Field>

          <Field label="Plafond quotidien cible">
            <input
              type="number"
              value={gmailDailyCap ?? ''}
              onChange={(e) => onGmailDailyCapChange(e.target.value ? parseInt(e.target.value) : null)}
              min={1}
              className={inputClass}
            />
            <span className="text-[10px] text-ink-faint">Volume max/jour une fois le warm-up terminé.</span>
          </Field>

          <Field label="Début de la fenêtre d'envoi">
            <input type="time" value={gmailWindowStart} onChange={(e) => onGmailWindowStartChange(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Fin de la fenêtre d'envoi">
            <input type="time" value={gmailWindowEnd} onChange={(e) => onGmailWindowEndChange(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Button type="submit" variant="primary">Enregistrer les paramètres</Button>
      </form>
    </div>

    <div className="rounded-surface border border-line bg-elevated p-5">
      <div className="mb-3.5 text-sm font-bold text-ink">Relances</div>
      <form onSubmit={onSubmit}>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Délai avant 1ère relance (jours)">
            <input type="number" value={followup1Days} onChange={(e) => onFollowup1DaysChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>

          <Field label="Délai avant 2ème relance (jours)">
            <input type="number" value={followup2Days} onChange={(e) => onFollowup2DaysChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>

          <Field label="Relances avant archivage">
            <input type="number" value={archiveAfter} onChange={(e) => onArchiveAfterChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>
        </div>
        <Button type="submit" variant="primary">Enregistrer les paramètres</Button>
      </form>
    </div>
  </div>
);
```

- [ ] **Step 2: Modify `src/views/Settings.tsx`**

Replace the `dailyQuota` state with the three new pieces of state. Find the existing state declarations near `dailyQuota` (search for `setDailyQuota`) and replace:

```ts
const [dailyQuota, setDailyQuota] = useState(100);
```

with:

```ts
const [gmailDailyCap, setGmailDailyCap] = useState<number | null>(null);
const [gmailWarmupStartDate, setGmailWarmupStartDate] = useState<string | null>(null);
const [gmailWindowStart, setGmailWindowStart] = useState('08:00');
const [gmailWindowEnd, setGmailWindowEnd] = useState('18:00');
```

Replace line 75 (`if (s.key === 'daily_send_quota' ...)`):

```tsx
      if (s.key === 'gmail_daily_cap' && s.value.count !== undefined) setGmailDailyCap(s.value.count);
      if (s.key === 'gmail_warmup_start_date' && s.value.date !== undefined) setGmailWarmupStartDate(s.value.date);
      if (s.key === 'gmail_send_window') {
        if (s.value.start !== undefined) setGmailWindowStart(s.value.start);
        if (s.value.end !== undefined) setGmailWindowEnd(s.value.end);
      }
```

Replace `handleSaveProspectionSettings`'s body (lines 229-234):

```tsx
      await settingsService.updateProspectionSettings({
        followup_1_days: followup1Days,
        followup_2_days: followup2Days,
        archive_after_followups: archiveAfter,
        gmail_daily_cap: gmailDailyCap,
        gmail_warmup_start_date: gmailWarmupStartDate,
        gmail_send_window: { days: [1, 2, 3, 4, 5], start: gmailWindowStart, end: gmailWindowEnd },
      });
```

Replace the `<ProspectionSettingsTab>` usage (lines 323-333):

```tsx
        <ProspectionSettingsTab
          followup1Days={followup1Days}
          followup2Days={followup2Days}
          archiveAfter={archiveAfter}
          gmailDailyCap={gmailDailyCap}
          gmailWarmupStartDate={gmailWarmupStartDate}
          gmailWindowStart={gmailWindowStart}
          gmailWindowEnd={gmailWindowEnd}
          onFollowup1DaysChange={setFollowup1Days}
          onFollowup2DaysChange={setFollowup2Days}
          onArchiveAfterChange={setArchiveAfter}
          onGmailDailyCapChange={setGmailDailyCap}
          onGmailWarmupStartDateChange={setGmailWarmupStartDate}
          onGmailWindowStartChange={setGmailWindowStart}
          onGmailWindowEndChange={setGmailWindowEnd}
          onSubmit={handleSaveProspectionSettings}
        />
```

- [ ] **Step 3: Run the frontend build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, open Settings → Prospection tab.

Expected: a "Envoi Gmail — pacing anti-spam" card with warm-up date, daily cap, and start/end time fields, above the existing "Relances" card. Set a warm-up start date (today) and a daily cap (e.g. 20), save, reload the page, confirm the values persisted.

- [ ] **Step 5: Commit**

```bash
git add src/views/settings/ProspectionSettingsTab.tsx src/views/Settings.tsx
git commit -m "feat: add Gmail warm-up/cap/window settings UI"
```

---

## End-to-end verification (after all tasks)

1. In Settings → Prospection, set `gmail_warmup_start_date` to today and `gmail_daily_cap` to a small number (e.g. 5).
2. Connect the personal test Gmail account via the "Connecter Gmail" button in the Prospection header.
3. Create a test lead with your own secondary/test email address — confirms `auto_create_prospection_draft()` still fires and produces a draft.
4. In Validation, click "Approuver" on the draft.
5. Click "Lancer un cycle d'envoi maintenant" — confirms `schedule-gmail-sends` picks it up (warm-up day 0 cap should allow at least 1) and `dispatch-gmail-sends` sends it.
6. Check the test inbox: email arrived, correctly formatted, tracking pixel present (view source).
7. Open the email from the test inbox side — within a minute or two, check `email_logs.status` turns `'opened'`.
8. Reply to the email from the test inbox — within 5 minutes (or trigger `poll-gmail-inbox` manually), confirm the lead's `sequence_status` becomes `'replied'`, a `history` row appears with the reply content, and `email_logs` has a new inbound row with the full reply body.
9. Send another test email to a deliberately invalid address (e.g. `doesnotexist12345@gmail.com`) through the same flow, wait for the bounce, confirm `email_logs.status` turns `'bounced'` with the DSN content in `error_message`.
