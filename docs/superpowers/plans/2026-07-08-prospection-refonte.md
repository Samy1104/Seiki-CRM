# Prospection IA — Refonte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AI-generated prospecting emails with editable templates per segment, merged locally with lead data, auto-created the moment a lead is added, with a global manual/automatic toggle and a queue that respects Resend's 100/day limit.

**Architecture:** Postgres holds the source of truth and the scheduling logic (a `email_templates` library, a `render_template()`/`schedule_send()` SQL function pair, and an `AFTER INSERT` trigger on `leads`), so the pipeline works the same whether triggered from the app or from a scheduled job. Two Supabase Edge Functions do the actual Resend calls (`send-email` for one-off sends, `flush-send-queue` for the daily batch, sharing one module). The React frontend (Prospection.tsx + new Templates tab + Settings tab) is a client for that state — the client-side "fill template" function used for live preview is a pure-JS mirror of `render_template()`.

**Tech Stack:** React 19 + TypeScript, Supabase (Postgres + Edge Functions/Deno), `motion` (already installed) for the toggle animation, Tailwind CSS v4 added new, scoped to the Prospection page only (no preflight import, so it can't affect the rest of the app's plain-CSS styling).

## Global Constraints

- No test framework is configured in this repo (no jest/vitest/pytest, `package.json` has no `test` script). Do not introduce one as part of this feature. Every task's verification step is either a SQL query run against the linked Supabase project, or a manual check via the browser preview tool — not an automated unit test.
- Schema changes follow the existing convention: flat `.sql` files at the repo root (`schema_supabase.sql`, `schema_prospection_addon.sql`), applied manually by the user via Supabase SQL Editor or `supabase db query --linked` (per the working note in memory from 2026-07-06). Do not create a `supabase/migrations/` folder — none exists today.
- RLS: every new table gets `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY "authenticated_full_access" ... FOR ALL TO authenticated USING (true) WITH CHECK (true)`, matching every existing table in `schema_supabase.sql`.
- Do not delete or alter `campaigns.system_prompt`, `campaigns.tone`, or `generated_emails.model_used/prompt_used/generation_ms` — per the spec, they stay unused in place, no destructive migration.
- Do not touch the existing `generate-email` Edge Function (Gemini) — it stays deployed but unused by the new flow.
- French UI copy throughout (matches the rest of the app).

---

## File Structure

**New files:**
- `Projet/schema_prospection_v2_addon.sql` — table/column/settings additions (Tasks 1)
- `Projet/schema_prospection_v2_functions.sql` — `render_template`, `schedule_send`, trigger (Tasks 2-4)
- `Projet/schema_prospection_v2_cron.sql` — pg_cron/pg_net setup, run once manually (Task 7)
- `Projet/supabase/functions/_shared/sendViaResend.ts` — shared Resend-sending logic (Task 5)
- `Projet/supabase/functions/flush-send-queue/index.ts` — batch sender (Task 6)
- `Projet/src/services/templatesService.ts` — template CRUD + client-side merge (Task 9)
- `Projet/src/components/ProspectionModeToggle.tsx` — manual/auto toggle (Task 14)
- `Projet/src/views/prospection.css` — Tailwind v4 entry, scoped to this page (Task 8)

**Modified files:**
- `Projet/supabase/functions/send-email/index.ts` — delegate to shared module (Task 5)
- `Projet/src/services/leadsService.ts` — `custom_fields` on `Lead` (Task 10)
- `Projet/src/views/AddLead.tsx` — custom fields editor (Task 10)
- `Projet/src/services/settingsService.ts` — prospection settings (Task 11)
- `Projet/src/views/Settings.tsx` — new "Prospection" tab (Task 11)
- `Projet/src/services/campaignsService.ts` — schedule/flush/unassigned helpers (Task 12)
- `Projet/src/services/prospectionService.ts` — settings-driven thresholds, relance drafts (Task 13)
- `Projet/vite.config.ts` — `@tailwindcss/vite` plugin (Task 8)
- `Projet/package.json` — new deps (Task 8)
- `Projet/src/views/Prospection.tsx` — Templates tab, Génération/Validation rework, Campagnes filter, Relances rework, toggle mount (Tasks 15-19)

---

### Task 1: Schema — new columns, `email_templates` table, settings seed

**Files:**
- Create: `Projet/schema_prospection_v2_addon.sql`

**Interfaces:**
- Produces: table `public.email_templates(id, segment, step, subject, body, updated_at)`; column `public.leads.custom_fields JSONB`; column `public.generated_emails.step TEXT`; 5 new rows in `public.app_settings` (`prospection_mode`, `daily_send_quota`, `followup_1_days`, `followup_2_days`, `archive_after_followups`).

- [ ] **Step 1: Write the SQL file**

```sql
-- ============================================================
-- SEIKI CRM — Add-on Prospection IA v2 (templates, fusion, quota)
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS schema_supabase.sql et schema_prospection_addon.sql
-- ============================================================

-- ============================================================
-- 1. leads.custom_fields — paires clé/valeur libres par lead
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.leads.custom_fields IS 'Paires clé/valeur libres utilisables dans les templates via {{custom.<clé>}}';

-- ============================================================
-- 2. generated_emails.step — quelle étape du parcours
-- ============================================================
ALTER TABLE public.generated_emails
  ADD COLUMN IF NOT EXISTS step TEXT NOT NULL DEFAULT 'initial'
    CHECK (step IN ('initial', 'relance_1', 'relance_2'));

-- ============================================================
-- 3. TABLE email_templates — bibliothèque par segment x étape
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment     TEXT NOT NULL CHECK (segment IN ('Media', 'Retail', 'Instit', 'All')),
  step        TEXT NOT NULL CHECK (step IN ('initial', 'relance_1', 'relance_2')),
  subject     TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segment, step)
);

COMMENT ON TABLE public.email_templates IS 'Samples d''email éditables, un par segment x étape (initial/relance_1/relance_2)';

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.email_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_email_templates_updated
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed vide pour les 4 segments x 3 étapes, à éditer depuis l'onglet Templates
INSERT INTO public.email_templates (segment, step, subject, body) VALUES
  ('All', 'initial', 'Une idée pour {{company_name}}', 'Bonjour {{contact_name}},\n\n[Écrire le sample ici]\n\nCordialement,\nSeiki'),
  ('All', 'relance_1', 'Petit rappel — {{company_name}}', 'Bonjour {{contact_name}},\n\n[Écrire la relance ici]\n\nCordialement,\nSeiki'),
  ('All', 'relance_2', 'Dernier mot — {{company_name}}', 'Bonjour {{contact_name}},\n\n[Écrire la dernière relance ici]\n\nCordialement,\nSeiki')
ON CONFLICT (segment, step) DO NOTHING;

-- ============================================================
-- 4. app_settings — nouvelles clés Prospection
-- ============================================================
INSERT INTO public.app_settings (key, value, label, category) VALUES
  ('prospection_mode',        '{"mode": "manual"}', 'Mode de prospection (manuel/automatique)', 'prospection'),
  ('daily_send_quota',        '{"count": 100}',     'Quota d''envoi quotidien (limite Resend)',  'prospection'),
  ('followup_1_days',         '{"days": 5}',        'Délai avant la 1ère relance (jours)',      'prospection'),
  ('followup_2_days',         '{"days": 10}',       'Délai avant la 2ème relance (jours)',      'prospection'),
  ('archive_after_followups', '{"count": 2}',       'Nombre de relances avant archivage',       'prospection')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Apply it to the linked Supabase project**

Run: `supabase db query --linked --file schema_prospection_v2_addon.sql` (from `Projet/`)
Expected: no errors printed; command exits 0.

- [ ] **Step 3: Verify with a query**

Run: `supabase db query --linked "SELECT segment, step, subject FROM public.email_templates ORDER BY segment, step;"`
Expected: 3 rows (`All`/`initial`, `All`/`relance_1`, `All`/`relance_2`).

Run: `supabase db query --linked "SELECT key, value FROM public.app_settings WHERE category = 'prospection' ORDER BY key;"`
Expected: 5 rows matching the keys above.

- [ ] **Step 4: Commit**

```bash
git add schema_prospection_v2_addon.sql
git commit -m "feat(db): add email_templates, custom_fields, prospection settings"
```

---

### Task 2: SQL — `render_template()` merge function

**Files:**
- Create: `Projet/schema_prospection_v2_functions.sql`

**Interfaces:**
- Consumes: `public.leads` columns `contact_name, company_name, poste, segment, custom_fields` (Task 1).
- Produces: `public.render_template(p_template TEXT, p_lead_id UUID) RETURNS TEXT`, used by Task 4's trigger and referenced (not called) by the client-side mirror in Task 9.

- [ ] **Step 1: Write the function**

```sql
-- ============================================================
-- render_template — fusion de variables {{...}} pour un lead donné
-- ============================================================
CREATE OR REPLACE FUNCTION public.render_template(p_template TEXT, p_lead_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_lead   RECORD;
  v_result TEXT := p_template;
  v_key    TEXT;
  v_value  TEXT;
BEGIN
  SELECT contact_name, company_name, poste, segment, custom_fields
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN p_template;
  END IF;

  v_result := replace(v_result, '{{contact_name}}', COALESCE(v_lead.contact_name, ''));
  v_result := replace(v_result, '{{company_name}}', COALESCE(v_lead.company_name, ''));
  v_result := replace(v_result, '{{poste}}',        COALESCE(v_lead.poste, ''));
  v_result := replace(v_result, '{{segment}}',      COALESCE(v_lead.segment, ''));

  FOR v_key, v_value IN
    SELECT key, value FROM jsonb_each_text(COALESCE(v_lead.custom_fields, '{}'::jsonb))
  LOOP
    v_result := replace(v_result, '{{custom.' || v_key || '}}', COALESCE(v_value, ''));
  END LOOP;

  RETURN v_result;
END;
$$;
```

- [ ] **Step 2: Apply and verify with a real lead**

Run: `supabase db query --linked --file schema_prospection_v2_functions.sql`
Expected: no errors (function created; Tasks 3-4 append to this same file before you re-run it — for this task, run it as-is first).

Run:
```sql
supabase db query --linked "
INSERT INTO public.leads (company_name, contact_name, email, segment, stage_id, custom_fields)
SELECT 'ACME Corp', 'Jean Dupont', 'jean@acme-test.example', 'Media', id, '{\"evenement\": \"Salon Test\"}'::jsonb
FROM public.pipeline_stages LIMIT 1
RETURNING id;
"
```
Note the returned `id`, then:
```sql
supabase db query --linked "SELECT public.render_template('Bonjour {{contact_name}} de {{company_name}}, vu à {{custom.evenement}}', '<paste-id-here>');"
```
Expected: `Bonjour Jean Dupont de ACME Corp, vu à Salon Test`

Clean up the test lead: `supabase db query --linked "DELETE FROM public.leads WHERE email = 'jean@acme-test.example';"`

- [ ] **Step 3: Commit**

```bash
git add schema_prospection_v2_functions.sql
git commit -m "feat(db): add render_template() variable merge function"
```

---

### Task 3: SQL — `schedule_send()` quota-aware scheduling function

**Files:**
- Modify: `Projet/schema_prospection_v2_functions.sql` (append)

**Interfaces:**
- Consumes: `public.generated_emails(statut_envoi, scheduled_at, sent_at)`, `public.app_settings` key `daily_send_quota`.
- Produces: `public.schedule_send(p_generated_email_id UUID) RETURNS TIMESTAMPTZ`, called by Task 4's trigger (auto mode) and by `campaignsService.approveAndSchedule` (Task 12, manual mode) via `supabase.rpc('schedule_send', ...)`.

- [ ] **Step 1: Append the function**

```sql
-- ============================================================
-- schedule_send — trouve le prochain créneau sous quota et
-- passe l'email en 'approved' avec scheduled_at fixé
-- ============================================================
CREATE OR REPLACE FUNCTION public.schedule_send(p_generated_email_id UUID)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql AS $$
DECLARE
  v_quota       INTEGER;
  v_day         DATE := current_date;
  v_used_today  INTEGER;
  v_slot        TIMESTAMPTZ;
BEGIN
  SELECT COALESCE((value->>'count')::INTEGER, 100) INTO v_quota
  FROM public.app_settings WHERE key = 'daily_send_quota';

  LOOP
    SELECT count(*) INTO v_used_today
    FROM public.generated_emails
    WHERE id <> p_generated_email_id
      AND (
        (statut_envoi = 'sent' AND sent_at::date = v_day)
        OR (statut_envoi IN ('approved', 'sending') AND scheduled_at::date = v_day)
      );

    EXIT WHEN v_used_today < v_quota;
    v_day := v_day + 1;
  END LOOP;

  v_slot := v_day::TIMESTAMPTZ;

  UPDATE public.generated_emails
  SET statut_envoi = 'approved',
      scheduled_at = v_slot,
      approved_at  = now()
  WHERE id = p_generated_email_id;

  RETURN v_slot;
END;
$$;
```

- [ ] **Step 2: Apply and verify quota rollover**

Run: `supabase db query --linked --file schema_prospection_v2_functions.sql`
Expected: no errors.

Manual verification of the rollover (temporarily lower the quota to make it fast to test):
```sql
supabase db query --linked "UPDATE public.app_settings SET value = '{\"count\": 1}' WHERE key = 'daily_send_quota';"
```
Create 2 draft `generated_emails` rows for any existing lead (reuse an existing lead id), call `SELECT public.schedule_send('<id-1>');` then `SELECT public.schedule_send('<id-2>');` — expect the first call to return today's date and the second to return tomorrow's date (since quota is 1). Then restore the real quota:
```sql
supabase db query --linked "UPDATE public.app_settings SET value = '{\"count\": 100}' WHERE key = 'daily_send_quota';"
```
And delete the 2 test rows.

- [ ] **Step 3: Commit**

```bash
git add schema_prospection_v2_functions.sql
git commit -m "feat(db): add schedule_send() quota-aware scheduling function"
```

---

### Task 4: SQL — auto-pipeline trigger on lead creation

**Files:**
- Modify: `Projet/schema_prospection_v2_functions.sql` (append)

**Interfaces:**
- Consumes: `public.render_template` (Task 2), `public.schedule_send` (Task 3), `public.email_templates` (Task 1), `public.app_settings` key `prospection_mode`.
- Produces: trigger `trg_auto_create_prospection_draft` on `public.leads`, firing function `public.auto_create_prospection_draft()`.

- [ ] **Step 1: Append the trigger function and trigger**

```sql
-- ============================================================
-- auto_create_prospection_draft — dès qu'un lead est créé,
-- prépare son email initial (draft, ou approved+planifié si
-- le mode automatique est actif)
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_create_prospection_draft()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_subject TEXT;
  v_body    TEXT;
  v_mode    TEXT;
  v_new_id  UUID;
BEGIN
  IF NEW.email IS NULL OR NEW.is_archived THEN
    RETURN NEW;
  END IF;

  SELECT subject, body INTO v_subject, v_body
  FROM public.email_templates
  WHERE segment = NEW.segment AND step = 'initial';

  IF NOT FOUND THEN
    SELECT subject, body INTO v_subject, v_body
    FROM public.email_templates
    WHERE segment = 'All' AND step = 'initial';
  END IF;

  IF NOT FOUND OR v_subject IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.generated_emails (lead_id, campaign_id, step, sujet, corps_du_mail, statut_envoi, model_used)
  VALUES (
    NEW.id, NULL, 'initial',
    public.render_template(v_subject, NEW.id),
    public.render_template(v_body, NEW.id),
    'draft', 'template'
  )
  RETURNING id INTO v_new_id;

  SELECT (value->>'mode') INTO v_mode FROM public.app_settings WHERE key = 'prospection_mode';

  IF v_mode = 'auto' THEN
    PERFORM public.schedule_send(v_new_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_prospection_draft
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_prospection_draft();
```

- [ ] **Step 2: Apply and verify end-to-end**

Run: `supabase db query --linked --file schema_prospection_v2_functions.sql`
Expected: no errors.

Verify manual mode (default): insert a test lead, then check a draft was created:
```sql
supabase db query --linked "
INSERT INTO public.leads (company_name, contact_name, email, segment, stage_id)
SELECT 'Trigger Test SA', 'Alice Test', 'alice@trigger-test.example', 'Media', id
FROM public.pipeline_stages LIMIT 1
RETURNING id;
"
```
```sql
supabase db query --linked "SELECT statut_envoi, step, sujet FROM public.generated_emails ge JOIN public.leads l ON l.id = ge.lead_id WHERE l.email = 'alice@trigger-test.example';"
```
Expected: 1 row, `statut_envoi = 'draft'`, `step = 'initial'`.

Verify auto mode: `supabase db query --linked "UPDATE public.app_settings SET value = '{\"mode\": \"auto\"}' WHERE key = 'prospection_mode';"`, insert a second test lead the same way with a different email, then check its `generated_emails` row has `statut_envoi = 'approved'` and `scheduled_at` set. Restore mode to manual afterward: `UPDATE public.app_settings SET value = '{"mode": "manual"}' WHERE key = 'prospection_mode';`

Clean up both test leads and their generated_emails rows (`ON DELETE CASCADE` on `generated_emails.lead_id` means deleting the lead is enough): `DELETE FROM public.leads WHERE email IN ('alice@trigger-test.example', '<second-test-email>');`

- [ ] **Step 3: Commit**

```bash
git add schema_prospection_v2_functions.sql
git commit -m "feat(db): auto-create prospection draft on lead insert"
```

---

### Task 5: Edge Function — extract shared Resend-sending module

**Files:**
- Create: `Projet/supabase/functions/_shared/sendViaResend.ts`
- Modify: `Projet/supabase/functions/send-email/index.ts:1-239` (replace body with a thin wrapper)

**Interfaces:**
- Produces: `sendGeneratedEmailViaResend(supabase: SupabaseClient, generatedEmailId: string, options?: { fromEmail?: string; fromName?: string }): Promise<{ success: true; resendMessageId: string; sentAt: string; to: string } | { success: false; error: string; alreadySent?: boolean }>` — consumed by both `send-email/index.ts` (Task 5) and `flush-send-queue/index.ts` (Task 6).

- [ ] **Step 1: Write the shared module**

This is the existing logic from `send-email/index.ts` steps 3-11, extracted verbatim into a reusable function (same behavior, same buildEmailHtml, same Resend payload):

```typescript
// ============================================================
// _shared/sendViaResend.ts
// Logique d'envoi Resend partagée par send-email et flush-send-queue.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface GeneratedEmail {
  id: string;
  lead_id: string;
  campaign_id: string | null;
  sujet: string;
  corps_du_mail: string;
  statut_envoi: string;
}

interface LeadEmail {
  email: string;
  contact_name: string;
}

export type SendOutcome =
  | { success: true; resendMessageId: string; sentAt: string; to: string }
  | { success: false; error: string; alreadySent?: boolean };

function buildEmailHtml(corps: string, trackingPixelUrl: string): string {
  const htmlBody = corps
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br/>" : `<p style="margin:0 0 8px 0;line-height:1.6">${line}</p>`))
    .join("");

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
  <img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt=""/>
</body>
</html>`;
}

export async function sendGeneratedEmailViaResend(
  supabase: SupabaseClient,
  generatedEmailId: string,
  options?: { fromEmail?: string; fromName?: string },
): Promise<SendOutcome> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return { success: false, error: "RESEND_API_KEY non configurée dans les secrets Supabase" };
  }

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "prospection@votredomaine.com";
  const fromName = Deno.env.get("RESEND_FROM_NAME") || "Seiki CRM";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

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

  const delay = Math.floor(Math.random() * 1500) + 500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email?id=${generatedEmailId}&t=open`;
  const emailHtml = buildEmailHtml(ge.corps_du_mail, trackingPixelUrl);

  const resendPayload = {
    from: `${options?.fromName || fromName} <${options?.fromEmail || fromEmail}>`,
    to: [leadData.email],
    subject: ge.sujet,
    html: emailHtml,
    text: ge.corps_du_mail,
    tags: [
      { name: "source", value: "seiki-crm" },
      { name: "generated_email_id", value: generatedEmailId },
      ...(ge.campaign_id ? [{ name: "campaign_id", value: ge.campaign_id }] : []),
    ],
  };

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(resendPayload),
  });

  const resendData = await resendResponse.json();

  if (!resendResponse.ok) {
    await supabase.from("generated_emails").update({ statut_envoi: "failed" }).eq("id", generatedEmailId);
    return { success: false, error: `Resend API error ${resendResponse.status}: ${JSON.stringify(resendData)}` };
  }

  const resendMessageId = resendData.id as string;
  const sentAt = new Date().toISOString();

  await supabase
    .from("generated_emails")
    .update({ statut_envoi: "sent", sent_at: sentAt, resend_message_id: resendMessageId })
    .eq("id", generatedEmailId);

  const { error: logErr } = await supabase.from("email_logs").insert([{
    lead_id: ge.lead_id,
    sequence_id: null,
    generated_email_id: generatedEmailId,
    direction: "outbound",
    from_email: options?.fromEmail || fromEmail,
    to_email: leadData.email,
    subject: ge.sujet,
    body_preview: ge.corps_du_mail.substring(0, 500),
    body_html: emailHtml,
    message_id: resendMessageId,
    status: "sent",
    sent_at: sentAt,
  }]);

  if (logErr) {
    console.warn("[sendViaResend] Erreur insertion log (non bloquante) :", logErr.message);
  }

  return { success: true, resendMessageId, sentAt, to: leadData.email };
}
```

- [ ] **Step 2: Replace `send-email/index.ts` with a thin wrapper**

```typescript
// ============================================================
// Edge Function : send-email
// Runtime : Deno (Supabase)
// Rôle : Envoie UN email généré via Resend (appel direct depuis l'UI).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendGeneratedEmailViaResend } from "../_shared/sendViaResend.ts";

interface SendRequest {
  generatedEmailId: string;
  fromEmail?: string;
  fromName?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const body = (await req.json()) as SendRequest;
    if (!body.generatedEmailId) {
      return new Response(
        JSON.stringify({ error: "generatedEmailId est requis" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const outcome = await sendGeneratedEmailViaResend(supabase, body.generatedEmailId, {
      fromEmail: body.fromEmail,
      fromName: body.fromName,
    });

    if (!outcome.success) {
      return new Response(
        JSON.stringify({ error: outcome.error, alreadySent: outcome.alreadySent }),
        { status: outcome.alreadySent ? 409 : 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, resendMessageId: outcome.resendMessageId, sentAt: outcome.sentAt, to: outcome.to }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[send-email] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] **Step 3: Deploy and verify behavior is unchanged**

Run: `supabase functions deploy send-email --project-ref <your-project-ref>` (from `Projet/`)
Expected: deploy succeeds.

Manually trigger a send exactly as in the 2026-07-06 test session (create a draft, approve it, send it from the Prospection UI) and confirm the email still arrives at `baiaks1104@gmail.com` (the Resend sandbox constraint from that session still applies — see the memory note). This is the same test as before; it should behave identically since the logic didn't change, just moved.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/sendViaResend.ts supabase/functions/send-email/index.ts
git commit -m "refactor(edge): extract Resend-sending logic into shared module"
```

---

### Task 6: Edge Function — `flush-send-queue` batch sender

**Files:**
- Create: `Projet/supabase/functions/flush-send-queue/index.ts`

**Interfaces:**
- Consumes: `sendGeneratedEmailViaResend` (Task 5), `public.app_settings` keys `prospection_mode`/`daily_send_quota`.
- Produces: HTTP endpoint returning `{ skipped?: string; processed: number; sent: number; failed: number }`, called manually from `campaignsService.flushSendQueue()` (Task 12) and by the cron job (Task 7).

- [ ] **Step 1: Write the function**

```typescript
// ============================================================
// Edge Function : flush-send-queue
// Runtime : Deno (Supabase)
// Rôle : Purge la file d'envoi (generated_emails approved, dus
//        aujourd'hui) dans la limite du quota quotidien restant.
//        Appelée à la demande (bouton UI) ou par le cron Supabase
//        en mode automatique.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendGeneratedEmailViaResend } from "../_shared/sendViaResend.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: modeSetting } = await supabase
      .from("app_settings").select("value").eq("key", "prospection_mode").single();
    const { data: quotaSetting } = await supabase
      .from("app_settings").select("value").eq("key", "daily_send_quota").single();

    const mode = (modeSetting?.value as { mode?: string } | null)?.mode ?? "manual";
    const quota = (quotaSetting?.value as { count?: number } | null)?.count ?? 100;

    // En mode manuel, la purge automatique (cron) ne doit rien faire —
    // seul le bouton explicite de l'UI doit envoyer. On distingue les deux
    // via un flag dans le corps JSON (pas un header custom : un header
    // non listé dans Access-Control-Allow-Headers de _shared/cors.ts
    // ferait échouer le preflight CORS pour tout appel navigateur).
    let triggeredBy: string | undefined;
    try {
      const body = await req.json();
      triggeredBy = body?.triggeredBy;
    } catch {
      // Pas de corps (ex: appel cron sans body) — reste undefined, traité comme non-manuel.
    }
    const isManualTrigger = triggeredBy === "manual-button";
    if (mode === "manual" && !isManualTrigger) {
      return new Response(
        JSON.stringify({ skipped: "prospection_mode is manual", processed: 0, sent: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const { count: sentTodayCount } = await supabase
      .from("generated_emails")
      .select("id", { count: "exact", head: true })
      .eq("statut_envoi", "sent")
      .gte("sent_at", `${today}T00:00:00.000Z`)
      .lt("sent_at", `${today}T23:59:59.999Z`);

    const remainingQuota = Math.max(0, quota - (sentTodayCount ?? 0));

    if (remainingQuota === 0) {
      return new Response(
        JSON.stringify({ skipped: "daily quota already reached", processed: 0, sent: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const { data: due, error: dueErr } = await supabase
      .from("generated_emails")
      .select("id")
      .eq("statut_envoi", "approved")
      .lte("scheduled_at", `${today}T23:59:59.999Z`)
      .order("scheduled_at", { ascending: true })
      .limit(remainingQuota);

    if (dueErr) throw dueErr;

    let sent = 0;
    let failed = 0;

    for (const row of due ?? []) {
      const outcome = await sendGeneratedEmailViaResend(supabase, row.id as string);
      if (outcome.success) sent++;
      else failed++;
    }

    return new Response(
      JSON.stringify({ processed: (due ?? []).length, sent, failed }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[flush-send-queue] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] **Step 2: Deploy and verify**

Run: `supabase functions deploy flush-send-queue --project-ref <your-project-ref>`
Expected: deploy succeeds.

Verify the manual-mode skip: with `prospection_mode` set to `manual` (default), call the function with an empty body —
Run: `curl -X POST https://<project-ref>.supabase.co/functions/v1/flush-send-queue -H "Authorization: Bearer <anon-key>" -H "apikey: <anon-key>" -H "Content-Type: application/json" -d '{}'`
Expected: `{"skipped":"prospection_mode is manual","processed":0,"sent":0,"failed":0}`

Verify it processes when `triggeredBy` is in the body and there's at least one `approved` row with `scheduled_at` today (create one via `schedule_send()` in the SQL console first):
Run: `curl -X POST https://<project-ref>.supabase.co/functions/v1/flush-send-queue -H "Authorization: Bearer <anon-key>" -H "apikey: <anon-key>" -H "Content-Type: application/json" -d '{"triggeredBy":"manual-button"}'`
Expected: `{"processed":1,"sent":1,"failed":0}` (or however many rows were due).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/flush-send-queue/index.ts
git commit -m "feat(edge): add flush-send-queue batch sender respecting daily quota"
```

---

### Task 7: SQL — cron setup for full-auto mode

**Files:**
- Create: `Projet/schema_prospection_v2_cron.sql`

**Interfaces:**
- Consumes: `flush-send-queue` Edge Function URL (Task 6).
- Produces: a `pg_cron` job named `flush-send-queue-hourly`, run once by the user (not part of the automated addon files, since it requires enabling extensions and embedding the project's service-role key).

- [ ] **Step 1: Write the file with a placeholder the user must fill in**

```sql
-- ============================================================
-- SEIKI CRM — Cron pour le mode Prospection 100% automatique
-- À exécuter UNE FOIS dans Supabase > SQL Editor, après avoir
-- remplacé <PROJECT_REF> et <SERVICE_ROLE_KEY> ci-dessous par
-- les vraies valeurs de ton projet (Dashboard > Settings > API).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'flush-send-queue-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/flush-send-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'apikey', '<SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 2: Document the manual steps (no code — this is genuinely a one-time manual action)**

In the same file, above the SQL, keep the comment block instructing the user to:
1. Open Supabase Dashboard → Settings → API, copy the `service_role` key (never the anon key — this job needs write access).
2. Replace `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>` in this file.
3. Run it once in the SQL Editor.
4. Verify with `SELECT * FROM cron.job WHERE jobname = 'flush-send-queue-hourly';` — expect one row, `active = true`.

This step has no automated verification — it depends on Supabase project credentials only the user holds. Flag it as done once the user confirms the `cron.job` row exists.

- [ ] **Step 3: Commit**

```bash
git add schema_prospection_v2_cron.sql
git commit -m "docs(db): add one-time cron setup script for full-auto mode"
```

---

### Task 8: Frontend infra — add Tailwind v4, scoped to the Prospection page

**Files:**
- Modify: `Projet/package.json`
- Modify: `Projet/vite.config.ts`
- Create: `Projet/src/views/prospection.css`

**Interfaces:**
- Produces: Tailwind utility classes (e.g. `bg-brand-purple`, `text-brand-text`) available to any component that imports `./prospection.css`, without a preflight import (so it cannot change the styling of any other page).

- [ ] **Step 1: Install dependencies**

Run: `cd Projet && npm install -D tailwindcss@^4 @tailwindcss/vite@^4`
Expected: `package.json` devDependencies gain `tailwindcss` and `@tailwindcss/vite`.

- [ ] **Step 2: Register the Vite plugin**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

- [ ] **Step 3: Write the scoped Tailwind entry, mapping brand tokens**

```css
/* ============================================================
   Tailwind v4, scoped to the Prospection page only.
   No preflight import on purpose — importing only theme+utilities
   means Tailwind can't reset styles used by the rest of the app,
   which is plain CSS (index.css / App.css).
   ============================================================ */
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);

@theme {
  --color-brand-purple: var(--purple);
  --color-brand-purple-glow: var(--purple-glow);
  --color-brand-gold: var(--gold);
  --color-brand-gold-glow: var(--gold-glow);
  --color-brand-green: var(--green);
  --color-brand-red: var(--red);
  --color-brand-bg-panel: var(--bg-panel);
  --color-brand-border: var(--border-subtle);
  --color-brand-text: var(--text-primary);
  --color-brand-text-secondary: var(--text-secondary);
  --color-brand-text-muted: var(--text-muted);
  --font-brand-heading: var(--font-heading);
  --font-brand-body: var(--font-body);
}
```

- [ ] **Step 4: Verify Tailwind classes compile and render**

Temporarily add `import './prospection.css';` to the top of `Projet/src/views/Prospection.tsx` and add a throwaway `<div className="bg-brand-purple text-white p-2 rounded-full">test tailwind</div>` inside the returned JSX.

Run: `npm run dev` (or use the preview tool) and open the Prospection page.
Expected: a small purple rounded pill reading "test tailwind" appears, and no other page's styling changed (spot-check the Pipeline or Leads page — they must look untouched).

Remove the throwaway div (keep the `import './prospection.css';` — later tasks need it).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/views/prospection.css src/views/Prospection.tsx
git commit -m "feat(ui): add Tailwind v4 scoped to the Prospection page"
```

---

### Task 9: `templatesService.ts` — template CRUD + client-side merge mirror

**Files:**
- Create: `Projet/src/services/templatesService.ts`

**Interfaces:**
- Consumes: `Lead` type from `./leadsService`.
- Produces:
  ```typescript
  export interface EmailTemplate {
    id: string;
    segment: 'Media' | 'Retail' | 'Instit' | 'All';
    step: 'initial' | 'relance_1' | 'relance_2';
    subject: string;
    body: string;
    updated_at: string;
  }
  export const templatesService = {
    getTemplates(): Promise<EmailTemplate[]>,
    upsertTemplate(segment: EmailTemplate['segment'], step: EmailTemplate['step'], subject: string, body: string): Promise<EmailTemplate>,
    resolveTemplate(templates: EmailTemplate[], segment: EmailTemplate['segment'], step: EmailTemplate['step']): EmailTemplate | null,
    renderTemplate(template: { subject: string; body: string }, lead: Lead): { subject: string; body: string },
  }
  ```
  `renderTemplate` is consumed by Task 13 (`prospectionService.createFollowUpDraft`) and Task 16 (manual generation flow, template preview).

- [ ] **Step 1: Write the service**

```typescript
// ============================================================
// templatesService.ts
// CRUD de la bibliothèque de templates (segment x étape) et
// fusion de variables côté client (miroir de render_template()
// en base — utilisé pour la génération manuelle et l'aperçu live
// de l'éditeur de templates).
// ============================================================

import { supabase } from './supabaseClient';
import type { Lead } from './leadsService';

export interface EmailTemplate {
  id: string;
  segment: 'Media' | 'Retail' | 'Instit' | 'All';
  step: 'initial' | 'relance_1' | 'relance_2';
  subject: string;
  body: string;
  updated_at: string;
}

function fillOne(template: string, lead: Lead): string {
  let result = template
    .replace(/\{\{contact_name\}\}/g, lead.contact_name || '')
    .replace(/\{\{company_name\}\}/g, lead.company_name || '')
    .replace(/\{\{poste\}\}/g, (lead as unknown as { poste?: string }).poste || '')
    .replace(/\{\{segment\}\}/g, lead.segment || '');

  const customFields = (lead as unknown as { custom_fields?: Record<string, string> }).custom_fields || {};
  for (const [key, value] of Object.entries(customFields)) {
    result = result.replaceAll(`{{custom.${key}}}`, value ?? '');
  }
  return result;
}

export const templatesService = {
  async getTemplates(): Promise<EmailTemplate[]> {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('segment')
      .order('step');
    if (error) throw error;
    return (data || []) as EmailTemplate[];
  },

  async upsertTemplate(
    segment: EmailTemplate['segment'],
    step: EmailTemplate['step'],
    subject: string,
    body: string,
  ): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from('email_templates')
      .upsert([{ segment, step, subject, body, updated_at: new Date().toISOString() }], { onConflict: 'segment,step' })
      .select()
      .single();
    if (error) throw error;
    return data as EmailTemplate;
  },

  resolveTemplate(
    templates: EmailTemplate[],
    segment: EmailTemplate['segment'],
    step: EmailTemplate['step'],
  ): EmailTemplate | null {
    return (
      templates.find((t) => t.segment === segment && t.step === step) ||
      templates.find((t) => t.segment === 'All' && t.step === step) ||
      null
    );
  },

  renderTemplate(template: { subject: string; body: string }, lead: Lead): { subject: string; body: string } {
    return {
      subject: fillOne(template.subject, lead),
      body: fillOne(template.body, lead),
    };
  },
};
```

- [ ] **Step 2: Verify against a real lead in the browser console**

With the dev server running, open the browser console on the Prospection page and run:
```javascript
const { templatesService } = await import('/src/services/templatesService.ts');
const { leadsService } = await import('/src/services/leadsService.ts');
const templates = await templatesService.getTemplates();
const leads = await leadsService.getLeads();
const t = templatesService.resolveTemplate(templates, leads[0].segment, 'initial');
console.log(templatesService.renderTemplate(t, leads[0]));
```
Expected: an object `{ subject, body }` with `{{contact_name}}`/`{{company_name}}` replaced by the real lead's values, matching what `render_template()` (Task 2) would produce for the same lead — spot-check by running the equivalent SQL query.

- [ ] **Step 3: Commit**

```bash
git add src/services/templatesService.ts
git commit -m "feat(prospection): add templatesService (CRUD + client-side merge)"
```

---

### Task 10: `leadsService.ts` + `AddLead.tsx` — custom fields

**Files:**
- Modify: `Projet/src/services/leadsService.ts:31-60` (add `custom_fields` to `Lead`)
- Modify: `Projet/src/views/AddLead.tsx`

**Interfaces:**
- Produces: `Lead.custom_fields: Record<string, string>` — consumed by `templatesService.renderTemplate` (Task 9) and the trigger's SQL-side equivalent (Task 2).

- [ ] **Step 1: Add the field to the `Lead` interface**

In `Projet/src/services/leadsService.ts`, in the `Lead` interface (around line 31), add after `sequence_status`:

```typescript
  custom_fields: Record<string, string>;
```

- [ ] **Step 2: Add a custom-fields editor to `AddLead.tsx`**

Add state near the top of the `AddLead` component (after the existing `scores` state, around line 109):

```typescript
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);

  const addCustomField = () => setCustomFields((prev) => [...prev, { key: '', value: '' }]);
  const updateCustomField = (index: number, field: 'key' | 'value', val: string) =>
    setCustomFields((prev) => prev.map((cf, i) => (i === index ? { ...cf, [field]: val } : cf)));
  const removeCustomField = (index: number) =>
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
```

In `handleReset` (around line 130), add `setCustomFields([]);` alongside the other resets.

In `handleSubmit`, in `leadPayload` (around line 196-211), add:

```typescript
        custom_fields: Object.fromEntries(
          customFields.filter((cf) => cf.key.trim()).map((cf) => [cf.key.trim(), cf.value])
        ),
```

In the JSX, after the "Note" field block (around line 371-379, before the closing `</div>` of `form-grid`), add:

```tsx
              <div className="form-field full">
                <div className="field-label">Champs personnalisés (utilisables dans les templates via {'{{custom.<clé>}}'})</div>
                {customFields.map((cf, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <input
                      type="text"
                      placeholder="clé (ex: evenement)"
                      value={cf.key}
                      onChange={(e) => updateCustomField(i, 'key', e.target.value)}
                      style={{ flex: '1' }}
                    />
                    <input
                      type="text"
                      placeholder="valeur (ex: Salon VivaTech)"
                      value={cf.value}
                      onChange={(e) => updateCustomField(i, 'value', e.target.value)}
                      style={{ flex: '2' }}
                    />
                    <button type="button" className="btn" onClick={() => removeCustomField(i)}>×</button>
                  </div>
                ))}
                <button type="button" className="btn" onClick={addCustomField}>+ Ajouter un champ</button>
              </div>
```

- [ ] **Step 3: Verify `leadsService.createLead` still type-checks**

`createLead`'s parameter type is `Omit<Lead, 'id' | 'score' | 'days_in_stage' | 'stage_changed_at' | 'is_archived' | 'merged_into_id' | 'sequence_id' | 'sequence_status' | 'created_at' | 'updated_at' | 'owner' | 'stage' | 'scores' | 'history'>` — since `custom_fields` isn't in that omit list, it's now a required field of the payload, matching the `custom_fields` key added to `leadPayload` in Step 2.

Run: `npm run build` (from `Projet/`)
Expected: TypeScript compiles with no errors mentioning `custom_fields` or `AddLead.tsx`.

- [ ] **Step 4: Verify in the browser**

Open Add Lead, fill in a company/segment, add a custom field `evenement` = `Salon Test`, submit. Then check in Supabase SQL Editor:
Run: `supabase db query --linked "SELECT custom_fields FROM public.leads ORDER BY created_at DESC LIMIT 1;"`
Expected: `{"evenement": "Salon Test"}`

- [ ] **Step 5: Commit**

```bash
git add src/services/leadsService.ts src/views/AddLead.tsx
git commit -m "feat(leads): add custom_fields editor to Add Lead form"
```

---

### Task 11: `settingsService.ts` + `Settings.tsx` — Prospection settings tab

**Files:**
- Modify: `Projet/src/services/settingsService.ts:1-33`
- Modify: `Projet/src/views/Settings.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export interface ProspectionSettings {
    prospection_mode: 'manual' | 'auto';
    daily_send_quota: number;
    followup_1_days: number;
    followup_2_days: number;
    archive_after_followups: number;
  }
  settingsService.getProspectionSettings(): Promise<ProspectionSettings>
  settingsService.updateProspectionSettings(updates: Partial<ProspectionSettings>): Promise<void>
  ```
  Consumed by Task 13 (`prospectionService`), Task 14 (`ProspectionModeToggle`), Task 18/19 (`Prospection.tsx`), and this task's own `Settings.tsx` tab.

- [ ] **Step 1: Add the settings helpers**

In `Projet/src/services/settingsService.ts`, after the `AppSetting` interface (line 13), add:

```typescript
export interface ProspectionSettings {
  prospection_mode: 'manual' | 'auto';
  daily_send_quota: number;
  followup_1_days: number;
  followup_2_days: number;
  archive_after_followups: number;
}
```

In the `settingsService` object, after `getSettings` (line 42), add:

```typescript
  async getProspectionSettings(): Promise<ProspectionSettings> {
    const all = await this.getSettings();
    const find = (key: string) => all.find((s) => s.key === key)?.value as Record<string, unknown> | undefined;
    return {
      prospection_mode: (find('prospection_mode')?.mode as 'manual' | 'auto') ?? 'manual',
      daily_send_quota: (find('daily_send_quota')?.count as number) ?? 100,
      followup_1_days: (find('followup_1_days')?.days as number) ?? 5,
      followup_2_days: (find('followup_2_days')?.days as number) ?? 10,
      archive_after_followups: (find('archive_after_followups')?.count as number) ?? 2,
    };
  },

  async updateProspectionSettings(updates: Partial<ProspectionSettings>): Promise<void> {
    const jobs: Promise<void>[] = [];
    if (updates.prospection_mode !== undefined) jobs.push(this.updateSetting('prospection_mode', { mode: updates.prospection_mode }));
    if (updates.daily_send_quota !== undefined) jobs.push(this.updateSetting('daily_send_quota', { count: updates.daily_send_quota }));
    if (updates.followup_1_days !== undefined) jobs.push(this.updateSetting('followup_1_days', { days: updates.followup_1_days }));
    if (updates.followup_2_days !== undefined) jobs.push(this.updateSetting('followup_2_days', { days: updates.followup_2_days }));
    if (updates.archive_after_followups !== undefined) jobs.push(this.updateSetting('archive_after_followups', { count: updates.archive_after_followups }));
    await Promise.all(jobs);
  },
```

- [ ] **Step 2: Add a "Prospection" tab to `Settings.tsx`**

In `Projet/src/views/Settings.tsx`, change the tab union (line 11) from `'members' | 'pipeline' | 'sla'` to `'members' | 'pipeline' | 'sla' | 'prospection'`.

Add state near the SLA state (after line 33):

```typescript
  const [dailyQuota, setDailyQuota] = useState(100);
  const [followup1Days, setFollowup1Days] = useState(5);
  const [followup2Days, setFollowup2Days] = useState(10);
  const [archiveAfter, setArchiveAfter] = useState(2);
```

In `loadSettingsData` (line 45-49), add to the `fetchedSettings.forEach` block:

```typescript
        if (s.key === 'daily_send_quota' && s.value.count !== undefined) setDailyQuota(s.value.count);
        if (s.key === 'followup_1_days' && s.value.days !== undefined) setFollowup1Days(s.value.days);
        if (s.key === 'followup_2_days' && s.value.days !== undefined) setFollowup2Days(s.value.days);
        if (s.key === 'archive_after_followups' && s.value.count !== undefined) setArchiveAfter(s.value.count);
```

Add a new handler after `handleSaveGeneralSettings` (line 205):

```typescript
  const handleSaveProspectionSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await settingsService.updateProspectionSettings({
        daily_send_quota: dailyQuota,
        followup_1_days: followup1Days,
        followup_2_days: followup2Days,
        archive_after_followups: archiveAfter,
      });
      showToast('Paramètres de prospection sauvegardés ✓');
      loadSettingsData();
    } catch (err) {
      console.error('Error saving prospection settings:', err);
      showToast('Erreur de sauvegarde des paramètres', 'error');
    }
  };
```

Add the tab button, after the "sla" tab button (line 242-249):

```tsx
        <button
          className={`mtab ${activeTab === 'prospection' ? 'on' : ''}`}
          onClick={() => setActiveTab('prospection')}
        >
          <Sliders size={14} style={{ marginRight: '6px' }} />
          Prospection
        </button>
```

Add the tab panel, after the SLA panel closes (after line 558, before the final closing `</div>` at line 559-560):

```tsx
      {activeTab === 'prospection' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' }}>
            Quota d'envoi et relances
          </div>

          <form onSubmit={handleSaveProspectionSettings}>
            <div className="form-grid" style={{ marginBottom: '24px' }}>
              <div className="form-field">
                <div className="field-label">Quota d'envoi quotidien</div>
                <input type="number" value={dailyQuota} onChange={(e) => setDailyQuota(parseInt(e.target.value) || 1)} min={1} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Limite Resend : ne pas dépasser {dailyQuota} emails envoyés par jour.
                </span>
              </div>

              <div className="form-field">
                <div className="field-label">Délai avant 1ère relance (jours)</div>
                <input type="number" value={followup1Days} onChange={(e) => setFollowup1Days(parseInt(e.target.value) || 1)} min={1} />
              </div>

              <div className="form-field">
                <div className="field-label">Délai avant 2ème relance (jours)</div>
                <input type="number" value={followup2Days} onChange={(e) => setFollowup2Days(parseInt(e.target.value) || 1)} min={1} />
              </div>

              <div className="form-field">
                <div className="field-label">Relances avant archivage</div>
                <input type="number" value={archiveAfter} onChange={(e) => setArchiveAfter(parseInt(e.target.value) || 1)} min={1} />
              </div>
            </div>

            <button type="submit" className="btn btn-grad">Enregistrer les paramètres</button>
          </form>
        </div>
      )}
```

- [ ] **Step 3: Verify in the browser**

Open Réglages → Prospection tab, change "Quota d'envoi quotidien" to `50`, save, reload the page, confirm it still shows `50`.

Run: `supabase db query --linked "SELECT value FROM public.app_settings WHERE key = 'daily_send_quota';"`
Expected: `{"count": 50}`

Then set it back to `100` the same way (don't leave the test project misconfigured).

- [ ] **Step 4: Commit**

```bash
git add src/services/settingsService.ts src/views/Settings.tsx
git commit -m "feat(settings): add Prospection settings tab (quota, followup thresholds)"
```

---

### Task 12: `campaignsService.ts` — scheduling, flush, unassigned emails

**Files:**
- Modify: `Projet/src/services/campaignsService.ts`

**Interfaces:**
- Consumes: `public.schedule_send` RPC (Task 3), `flush-send-queue` Edge Function (Task 6).
- Produces:
  ```typescript
  campaignsService.getUnassignedGeneratedEmails(statut?: GeneratedEmail['statut_envoi']): Promise<GeneratedEmail[]>
  campaignsService.approveAndSchedule(generatedEmailId: string): Promise<{ scheduledAt: string }>
  campaignsService.flushSendQueue(): Promise<{ processed: number; sent: number; failed: number; skipped?: string }>
  ```
  Consumed by Task 16 (Génération/Validation tab) and Task 17 (Campagnes tab's daily-send button).

- [ ] **Step 1: Add `getUnassignedGeneratedEmails`**

After `getGeneratedEmails` (around line 233), add:

```typescript
  /** Récupère les emails générés hors campagne (flux automatique par lead) */
  async getUnassignedGeneratedEmails(statut?: GeneratedEmail['statut_envoi']): Promise<GeneratedEmail[]> {
    let query = supabase
      .from('generated_emails')
      .select(`
        *,
        lead:leads!lead_id(contact_name, company_name, email, poste, segment)
      `)
      .is('campaign_id', null)
      .order('created_at', { ascending: false });

    if (statut) {
      query = query.eq('statut_envoi', statut);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as GeneratedEmail[];
  },
```

- [ ] **Step 2: Add `approveAndSchedule`**

After `approveEmail` (around line 275), add:

```typescript
  /** Approuve un email ET le planifie sous quota (remplace approveEmail pour le nouveau flux) */
  async approveAndSchedule(generatedEmailId: string): Promise<{ scheduledAt: string }> {
    const { data, error } = await supabase.rpc('schedule_send', { p_generated_email_id: generatedEmailId });
    if (error) throw error;
    return { scheduledAt: data as string };
  },
```

- [ ] **Step 3: Add `flushSendQueue`**

After `sendEmail` (around line 304), add:

```typescript
  /** Déclenche la purge de la file d'envoi du jour (bouton manuel) */
  async flushSendQueue(): Promise<{ processed: number; sent: number; failed: number; skipped?: string }> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/flush-send-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ triggeredBy: 'manual-button' }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Erreur purge file (${response.status})`);
    }
    return data;
  },
```

- [ ] **Step 4: Verify with `npm run build` and a manual RPC check**

Run: `npm run build`
Expected: no TypeScript errors.

In the browser console on the Prospection page (after Task 16 wires it in, or standalone via dynamic import as in Task 9's verification), call `campaignsService.approveAndSchedule('<a-draft-id>')` on an existing draft and confirm it returns `{ scheduledAt: '...' }`, then check in SQL that the row is now `approved`.

- [ ] **Step 5: Commit**

```bash
git add src/services/campaignsService.ts
git commit -m "feat(prospection): add schedule/flush/unassigned helpers to campaignsService"
```

---

### Task 13: `prospectionService.ts` — settings-driven thresholds + relance drafts

**Files:**
- Modify: `Projet/src/services/prospectionService.ts`

**Interfaces:**
- Consumes: `settingsService.getProspectionSettings()` (Task 11), `templatesService` (Task 9).
- Produces:
  ```typescript
  prospectionService.getFollowUpCandidates(): Promise<FollowUpCandidate[]>  // signature changes: no more daysThreshold param
  prospectionService.createFollowUpDraft(lead: ProspectionLead, step: 'relance_1' | 'relance_2'): Promise<GeneratedEmail>
  ```
  Consumed by Task 19 (Relances tab rework).

- [ ] **Step 1: Rewrite `getFollowUpCandidates` to read thresholds from settings**

Replace the method signature and its two threshold usages (around lines 85, 141, 150, 152, 154):

```typescript
  async getFollowUpCandidates(): Promise<FollowUpCandidate[]> {
    const { followup_1_days, followup_2_days, archive_after_followups } = await settingsService.getProspectionSettings();
    const daysThreshold = followup_1_days;

    const { data: sentEmails, error } = await supabase
      .from('generated_emails')
      .select(`
        lead_id,
        sent_at,
        campaign_id,
        lead:leads!lead_id(
          id, contact_name, company_name, email, segment, sequence_status,
          is_archived, merged_into_id, poste, enrichi_contexte, custom_fields,
          score, stage_id, owner_id, created_at, updated_at,
          note, email_verified, phone, linkedin_url, website, domain,
          deal_value, source, days_in_stage, stage_changed_at
        )
      `)
      .eq('statut_envoi', 'sent')
      .gte('sent_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('sent_at', { ascending: false });

    if (error) throw error;

    const leadIds = [...new Set((sentEmails || []).map((e) => e.lead_id as string))];
    if (leadIds.length === 0) return [];

    const { data: logs } = await supabase
      .from('email_logs')
      .select('lead_id, status, opened_at, replied_at, generated_email_id')
      .in('lead_id', leadIds)
      .eq('direction', 'outbound');

    const now = Date.now();
    const candidates: FollowUpCandidate[] = [];
    const processedLeads = new Set<string>();

    for (const sentEmail of sentEmails || []) {
      const leadId = sentEmail.lead_id as string;
      if (processedLeads.has(leadId)) continue;
      processedLeads.add(leadId);

      const lead = sentEmail.lead as unknown as ProspectionLead;
      if (!lead || lead.is_archived || lead.merged_into_id) continue;
      if (lead.sequence_status === 'replied' || lead.sequence_status === 'completed') continue;

      const leadLogs = (logs || []).filter((l) => l.lead_id === leadId);
      const hasOpened = leadLogs.some((l) => l.status === 'opened');
      const hasReplied = leadLogs.some((l) => l.status === 'replied');

      if (hasReplied) continue;

      const sentAt = sentEmail.sent_at as string;
      const daysSince = Math.floor((now - new Date(sentAt).getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince < daysThreshold) continue;

      const followUpCount = (sentEmails || []).filter((e) => e.lead_id === leadId).length - 1;

      let recommendedAction: FollowUpCandidate['recommendedAction'] = 'wait';
      if (daysSince >= followup_1_days && followUpCount === 0) {
        recommendedAction = 'follow_up_1';
      } else if (daysSince >= followup_2_days && followUpCount === 1) {
        recommendedAction = 'follow_up_2';
      } else if (followUpCount >= archive_after_followups) {
        recommendedAction = 'archive';
      }

      candidates.push({
        lead, lastEmailSentAt: sentAt, daysSinceLastEmail: daysSince,
        hasOpened, hasReplied, followUpCount, recommendedAction,
      });
    }

    return candidates.sort((a, b) => {
      const order = { follow_up_1: 0, follow_up_2: 1, archive: 2, wait: 3 };
      return order[a.recommendedAction] - order[b.recommendedAction];
    });
  },
```

Add the two new imports at the top of the file (after the existing `import type { Lead } from './leadsService';`):

```typescript
import { settingsService } from './settingsService';
import { templatesService } from './templatesService';
```

- [ ] **Step 2: Add `createFollowUpDraft`**

After `getFollowUpCandidates`, add:

```typescript
  /** Crée un draft de relance (relance_1 ou relance_2) pour un lead, à partir du template de la bibliothèque */
  async createFollowUpDraft(
    lead: ProspectionLead,
    step: 'relance_1' | 'relance_2',
  ): Promise<{ id: string; sujet: string; corps_du_mail: string }> {
    const templates = await templatesService.getTemplates();
    const template = templatesService.resolveTemplate(templates, lead.segment, step);
    if (!template) {
      throw new Error(`Aucun template trouvé pour ${lead.segment}/${step}`);
    }

    const rendered = templatesService.renderTemplate(template, lead as unknown as Lead);

    const { data, error } = await supabase
      .from('generated_emails')
      .insert([{
        lead_id: lead.id,
        campaign_id: null,
        step,
        sujet: rendered.subject,
        corps_du_mail: rendered.body,
        statut_envoi: 'draft',
        model_used: 'template',
      }])
      .select('id, sujet, corps_du_mail')
      .single();

    if (error) throw error;
    return data;
  },
```

- [ ] **Step 3: Verify `npm run build` and a manual call**

Run: `npm run build`
Expected: no TypeScript errors (in particular, confirm `settingsService` and `templatesService` imports resolve and `getFollowUpCandidates()` callers — currently only `Prospection.tsx`'s `FollowUpTab`, updated in Task 19 — aren't broken by the signature change before Task 19 runs; if Task 19 hasn't landed yet, `npm run build` will show a "expected 0 arguments" error at the old call site `getFollowUpCandidates(5)` — that's expected until Task 19; note it and continue, it will resolve itself once Task 19 lands).

- [ ] **Step 4: Commit**

```bash
git add src/services/prospectionService.ts
git commit -m "feat(prospection): read followup thresholds from settings, add createFollowUpDraft"
```

---

### Task 14: `ProspectionModeToggle.tsx` — manual/auto toggle component

**Files:**
- Create: `Projet/src/components/ProspectionModeToggle.tsx`

**Interfaces:**
- Produces: `ProspectionModeToggle: React.FC<{ mode: 'manual' | 'auto'; onChange: (mode: 'manual' | 'auto') => void }>`, consumed by Task 19 (`Prospection.tsx` header).
- Requires `prospection.css` (Task 8) to already be imported by the consuming page for its Tailwind classes to apply.

- [ ] **Step 1: Write the component**

Adapted from the `SliderToggle` code provided by the user: same `motion` spring-animated pill, brand gradient instead of violet/indigo, `ShieldCheck`/`Zap` instead of `Moon`/`Sun`.

```tsx
import { motion } from 'motion/react';
import { ShieldCheck, Zap } from 'lucide-react';

const TOGGLE_CLASSES =
  'text-sm font-medium flex items-center gap-2 px-3 md:pl-3 md:pr-3.5 py-3 md:py-1.5 transition-colors relative z-10';

interface ProspectionModeToggleProps {
  mode: 'manual' | 'auto';
  onChange: (mode: 'manual' | 'auto') => void;
}

export const ProspectionModeToggle: React.FC<ProspectionModeToggleProps> = ({ mode, onChange }) => {
  return (
    <div className="relative flex w-fit items-center rounded-full bg-brand-bg-panel border border-brand-border">
      <button
        type="button"
        className={`${TOGGLE_CLASSES} ${mode === 'manual' ? 'text-white' : 'text-brand-text-secondary'}`}
        onClick={() => onChange('manual')}
      >
        <ShieldCheck className="relative z-10" size={14} />
        <span className="relative z-10">Vérification humaine</span>
      </button>
      <button
        type="button"
        className={`${TOGGLE_CLASSES} ${mode === 'auto' ? 'text-white' : 'text-brand-text-secondary'}`}
        onClick={() => onChange('auto')}
      >
        <Zap className="relative z-10" size={14} />
        <span className="relative z-10">Automatique</span>
      </button>
      <div className={`absolute inset-0 z-0 flex ${mode === 'auto' ? 'justify-end' : 'justify-start'}`}>
        <motion.span
          layout
          transition={{ type: 'spring', damping: 15, stiffness: 250 }}
          className="h-full w-1/2 rounded-full bg-gradient-to-r from-brand-purple to-brand-gold"
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify it renders and toggles**

Temporarily mount it in `Prospection.tsx` (inside the header, guarded by the existing `import './prospection.css';` from Task 8) with local `useState('manual')`, load the page via the preview tool, click both sides, confirm the gradient pill slides between them with a spring animation and the active label turns white.

This wiring becomes permanent in Task 19 — for this task's verification, a throwaway local state is enough; don't wire it to `settingsService` yet (that's Task 19's job, once the rest of the page exists to react to it).

- [ ] **Step 3: Commit**

```bash
git add src/components/ProspectionModeToggle.tsx
git commit -m "feat(ui): add ProspectionModeToggle component"
```

---

### Task 15: `Prospection.tsx` — Templates tab

**Files:**
- Modify: `Projet/src/views/Prospection.tsx`

**Interfaces:**
- Consumes: `templatesService` (Task 9), `leadsService.getLeads` (existing).
- Produces: a new `Tab` value `'templates'` and a `TemplatesTab` component, self-contained (no other task depends on its internals).

- [ ] **Step 1: Add the tab to the `Tab` union and tab bar**

Change line 12 from `type Tab = 'campaigns' | 'generation' | 'followup';` to:

```typescript
type Tab = 'campaigns' | 'generation' | 'templates' | 'followup';
```

Add a new import at the top (alongside the existing `lucide-react` import list, line 2-6): add `FileEdit` to the destructured icons.

Add the tab button after the "Génération IA" button (after line 46, before the "Relances" button):

```tsx
        <button
          className={`pros-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileEdit size={14} /> Templates
        </button>
```

Add the render branch after `{activeTab === 'generation' && <GenerationTab showToast={showToast} />}` (line 58):

```tsx
        {activeTab === 'templates' && <TemplatesTab showToast={showToast} />}
```

Add `import './prospection.css';` at the very top of the file (first line) — this is what makes Tailwind classes in `TemplatesTab` and `ProspectionModeToggle` (Task 19) actually apply.

Add `import { templatesService, type EmailTemplate } from '../services/templatesService';` and `import { leadsService, type Lead } from '../services/leadsService';` near the other service imports (line 7-8).

- [ ] **Step 2: Write the `TemplatesTab` component**

Add this component after `GenerationTab` (after line 359, before the "Tab Relances" section comment):

```tsx
// ── Tab Templates ──────────────────────────────────────────────────────────────

const SEGMENTS: EmailTemplate['segment'][] = ['All', 'Media', 'Retail', 'Instit'];
const STEPS: { key: EmailTemplate['step']; label: string }[] = [
  { key: 'initial', label: '1er email' },
  { key: 'relance_1', label: 'Relance 1' },
  { key: 'relance_2', label: 'Relance 2' },
];
const VARIABLES = ['{{contact_name}}', '{{company_name}}', '{{poste}}', '{{segment}}'];

const TemplatesTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [segment, setSegment] = useState<EmailTemplate['segment']>('All');
  const [step, setStep] = useState<EmailTemplate['step']>('initial');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewLeadId, setPreviewLeadId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, l] = await Promise.all([templatesService.getTemplates(), leadsService.getLeads()]);
      setTemplates(t);
      setLeads(l);
    } catch {
      showToast('Erreur chargement des templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const existing = templates.find((t) => t.segment === segment && t.step === step);
    setSubject(existing?.subject || '');
    setBody(existing?.body || '');
  }, [segment, step, templates]);

  const insertVariable = (variable: string) => {
    const textarea = bodyRef.current;
    if (!textarea) { setBody((prev) => prev + variable); return; }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setBody((prev) => prev.slice(0, start) + variable + prev.slice(end));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await templatesService.upsertTemplate(segment, step, subject, body);
      showToast('Template sauvegardé ✓', 'success');
      load();
    } catch {
      showToast('Erreur sauvegarde template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const previewLead = leads.find((l) => l.id === previewLeadId);
  const preview = previewLead ? templatesService.renderTemplate({ subject, body }, previewLead) : null;

  if (loading) return <div className="pros-loading"><Loader size={20} className="spin" /> Chargement...</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <select className="gen-select" value={segment} onChange={(e) => setSegment(e.target.value as EmailTemplate['segment'])}>
          {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="gen-select" value={step} onChange={(e) => setStep(e.target.value as EmailTemplate['step'])}>
          {STEPS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div className="gen-field-group">
        <label className="gen-label">Sujet</label>
        <input className="gen-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div className="gen-field-group">
        <label className="gen-label">Corps</label>
        <div className="flex gap-2 flex-wrap mb-2">
          {VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              className="text-xs px-2 py-1 rounded-full bg-brand-bg-panel border border-brand-border text-brand-text-secondary hover:text-white"
              onClick={() => insertVariable(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <textarea ref={bodyRef} className="gen-textarea" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      <button className="btn-primary-sm" onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? <Loader size={13} className="spin" /> : <Check size={13} />} Sauvegarder
      </button>

      <div className="gen-field-group">
        <label className="gen-label">Aperçu sur un lead</label>
        <select className="gen-select" value={previewLeadId} onChange={(e) => setPreviewLeadId(e.target.value)}>
          <option value="">-- Choisir un lead --</option>
          {leads.map((l) => <option key={l.id} value={l.id}>{l.contact_name} — {l.company_name}</option>)}
        </select>
        {preview && (
          <div className="mt-3 p-4 rounded-xl bg-brand-bg-panel border border-brand-border">
            <div className="font-semibold text-brand-text">{preview.subject}</div>
            <div className="mt-2 text-brand-text-secondary whitespace-pre-line">{preview.body}</div>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify `npm run build`**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Verify in the browser**

Open Prospection → Templates tab. Select segment `Media`, step `1er email`, type a subject/body containing `{{contact_name}}`, click a variable button to insert `{{company_name}}` at the cursor, save. Reload the page, re-select `Media`/`1er email`, confirm the saved text reappears. Pick a lead in "Aperçu sur un lead" and confirm the preview box shows the merged text with real values.

- [ ] **Step 4: Commit**

```bash
git add src/views/Prospection.tsx
git commit -m "feat(prospection): add Templates tab (editable samples + live preview)"
```

---

### Task 16: `Prospection.tsx` — Génération/Validation tab rework

**Files:**
- Modify: `Projet/src/views/Prospection.tsx`

**Interfaces:**
- Consumes: `campaignsService.getUnassignedGeneratedEmails/approveAndSchedule` (Task 12), `templatesService` (Task 9).
- Produces: an updated `GenerationTab` with a "File de validation" default view (auto-pipeline drafts) alongside the existing manual campaign-based generation flow, whose "Générer" button now fills templates client-side instead of calling Gemini.

- [ ] **Step 1: Replace the AI bulk-generate call with template fill**

In `GenerationTab`'s `handleGenerate` (around lines 197-224), replace the body with:

```typescript
  const handleGenerate = async () => {
    if (!selectedCampaign) { showToast('Sélectionne une campagne', 'error'); return; }
    if (selectedLeads.size === 0) { showToast('Sélectionne au moins un lead', 'error'); return; }

    setIsGenerating(true);
    setProgress({ current: 0, total: selectedLeads.size });
    const leadIds = Array.from(selectedLeads);
    const templates = await templatesService.getTemplates();
    const generated: GeneratedEmail[] = [];
    const failedLeads: string[] = [];

    for (let i = 0; i < leadIds.length; i++) {
      const lead = leads.find((l) => l.id === leadIds[i]);
      setProgress({ current: i + 1, total: leadIds.length });
      if (!lead) { failedLeads.push(leadIds[i]); continue; }

      const template = templatesService.resolveTemplate(templates, lead.segment, 'initial');
      if (!template) { failedLeads.push(leadIds[i]); continue; }

      const rendered = templatesService.renderTemplate(template, lead);
      const { data, error } = await supabase
        .from('generated_emails')
        .insert([{
          lead_id: lead.id,
          campaign_id: selectedCampaign,
          step: 'initial',
          sujet: rendered.subject,
          corps_du_mail: rendered.body,
          statut_envoi: 'draft',
          model_used: 'template',
        }])
        .select(`*, lead:leads!lead_id(contact_name, company_name, email, poste, segment)`)
        .single();

      if (error || !data) failedLeads.push(leadIds[i]);
      else generated.push(data as GeneratedEmail);
    }

    setGeneratedEmails(generated);
    if (failedLeads.length > 0) {
      showToast(`${generated.length} emails générés, ${failedLeads.length} échecs (template manquant pour le segment)`, 'info');
    } else {
      showToast(`${generated.length} emails générés avec succès !`, 'success');
    }
    setViewMode('review');
    setIsGenerating(false);
  };
```

Add `import { supabase } from '../services/supabaseClient';` near the other imports (needed for the direct insert above — `campaignsService` doesn't expose a template-fill insert helper since it's a one-off client-side operation, not shared with the SQL trigger).

- [ ] **Step 1b: Remove the now-dead Gemini call path from `campaignsService.ts`**

`generateEmailForLead` and `bulkGenerateEmails` (and the `GenerateResult` interface they used) have no remaining callers after Step 1 — the `generate-email` Edge Function itself stays deployed (per Global Constraints, untouched), but its TypeScript wrapper is now dead code in the frontend. Remove from `Projet/src/services/campaignsService.ts`:
- the `GenerateResult` interface (lines 67-75)
- the `generateEmailForLead` method (lines 151-172)
- the `bulkGenerateEmails` method (lines 179-208)

Run: `npm run build` after removing them.
Expected: no errors (confirms nothing else referenced these).

- [ ] **Step 2: Add the "File de validation" sub-view for unassigned auto-pipeline drafts**

Add a new sub-tab selector at the top of `GenerationTab`'s returned JSX (right after the opening `<div>` at line 236), and new state:

```typescript
  const [subView, setSubView] = useState<'auto' | 'manual'>('auto');
  const [autoDrafts, setAutoDrafts] = useState<GeneratedEmail[]>([]);
  const [autoLoading, setAutoLoading] = useState(true);

  const loadAutoDrafts = useCallback(async () => {
    setAutoLoading(true);
    try {
      const drafts = await campaignsService.getUnassignedGeneratedEmails('draft');
      setAutoDrafts(drafts);
    } catch {
      showToast('Erreur chargement de la file de validation', 'error');
    } finally {
      setAutoLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAutoDrafts(); }, [loadAutoDrafts]);
```

Add the sub-tab buttons and the auto-drafts list in the JSX, replacing the top of the `return (` block (line 236-244) with:

```tsx
  return (
    <div>
      <div className="pros-section-header">
        <h2>{subView === 'auto' ? 'File de validation (auto-pipeline)' : viewMode === 'select' ? 'Génération manuelle' : `${generatedEmails.length} emails générés`}</h2>
        <div className="flex gap-2">
          <button className={`btn-ghost-sm ${subView === 'auto' ? 'active' : ''}`} onClick={() => setSubView('auto')}>Auto ({autoDrafts.length})</button>
          <button className={`btn-ghost-sm ${subView === 'manual' ? 'active' : ''}`} onClick={() => setSubView('manual')}>Manuelle</button>
        </div>
        {subView === 'manual' && viewMode === 'review' && (
          <button className="btn-secondary-sm" onClick={() => setViewMode('select')}>
            ← Retour à la sélection
          </button>
        )}
      </div>

      {subView === 'auto' && (
        autoLoading ? (
          <div className="pros-loading"><Loader size={20} className="spin" /> Chargement...</div>
        ) : autoDrafts.length === 0 ? (
          <div className="pros-empty">
            <Mail size={28} style={{ opacity: 0.4 }} />
            <p>Aucun draft en attente — tout lead ajouté avec un email génère automatiquement son 1er mail ici.</p>
          </div>
        ) : (
          <div className="gen-review-list">
            {autoDrafts.map((email) => (
              <EmailPreviewCard
                key={email.id}
                email={email}
                showToast={showToast}
                onUpdate={() => setAutoDrafts((prev) => prev.filter((e) => e.id !== email.id))}
              />
            ))}
          </div>
        )
      )}

      {subView === 'manual' && (
```

Then close this new wrapping `{subView === 'manual' && ( ... )}` right before the final `</div>\n  );\n};` of `GenerationTab` (after line 356-358) by adding a closing `)}` before the component's closing `</div>`.

Note: this wraps the *entire* existing manual-flow JSX (the `viewMode === 'select'` and `viewMode === 'review'` blocks, lines 246-356) inside the new `subView === 'manual'` condition — the existing JSX content itself doesn't change, only the wrapping braces around it.

- [ ] **Step 3: Wire `EmailPreviewCard`'s approve button to `approveAndSchedule`**

In `EmailPreviewCard`'s `handleApproveAndSend` (lines 519-540), this stays calling `campaignsService.approveEmail` + `sendEmail` for the existing "approve and send immediately" behavior on manually-reviewed campaign emails — no change needed there, it already respects quota implicitly (a single immediate send). But for the **auto-pipeline drafts list** (rendered above), replace the single "Approuver & Envoyer" button with two actions specific to queue-based sending. Add a new prop to `EmailPreviewCard`:

```typescript
const EmailPreviewCard: React.FC<{
  email: GeneratedEmail;
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
  onUpdate: () => void;
  queueMode?: boolean;
}> = ({ email, showToast, onUpdate, queueMode = false }) => {
```

Pass `queueMode` from the auto-drafts list: `<EmailPreviewCard key={email.id} email={email} showToast={showToast} onUpdate={...} queueMode />`.

Add a new handler alongside `handleApproveAndSend`:

```typescript
  const handleApproveAndQueue = async () => {
    setIsSending(true);
    try {
      const { scheduledAt } = await campaignsService.approveAndSchedule(email.id);
      const date = new Date(scheduledAt).toLocaleDateString('fr-FR');
      showToast(`Email approuvé, planifié pour le ${date}`, 'success');
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur planification', 'error');
    } finally {
      setIsSending(false);
    }
  };
```

In the actions block (lines 631-648), swap the button conditionally:

```tsx
              {queueMode ? (
                <button className="btn-primary-sm" onClick={handleApproveAndQueue} disabled={isSending}>
                  {isSending ? <Loader size={12} className="spin" /> : <Check size={12} />}
                  {isSending ? 'Planification...' : 'Approuver'}
                </button>
              ) : (
                <button className="btn-primary-sm" onClick={handleApproveAndSend} disabled={isSending}>
                  {isSending ? <Loader size={12} className="spin" /> : <Send size={12} />}
                  {isSending ? 'Envoi...' : 'Approuver & Envoyer'}
                </button>
              )}
```

- [ ] **Step 4: Verify `npm run build`**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 5: Verify in the browser**

Add a test lead (Task 10's form) with segment Media and an email — confirm it appears within a few seconds in Génération/Validation → "Auto" sub-tab as a draft (the trigger from Task 4 creates it). Click "Approuver" — confirm the toast shows a scheduled date and the card disappears from the list. Check in SQL that its `statut_envoi` is `approved` with `scheduled_at` set to today.

Switch to "Manuelle" sub-tab, pick a campaign and a lead, click "Générer" — confirm a draft appears in the review list with merged template text (no Gemini call, no network delay).

- [ ] **Step 6: Commit**

```bash
git add src/views/Prospection.tsx
git commit -m "feat(prospection): rework Génération tab with auto-pipeline validation queue"
```

---

### Task 17: `Prospection.tsx` — Campagnes tab "Sans campagne" filter + daily-send button

**Files:**
- Modify: `Projet/src/views/Prospection.tsx`

**Interfaces:**
- Consumes: `campaignsService.flushSendQueue` (Task 12), `settingsService.getProspectionSettings` (Task 11).

- [ ] **Step 1: Add a daily-send button and quota display to `CampaignsTab`**

Add state and a handler in `CampaignsTab` (after line 70):

```typescript
  const [flushing, setFlushing] = useState(false);
  const [quota, setQuota] = useState<number | null>(null);

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setQuota(s.daily_send_quota));
  }, []);

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const result = await campaignsService.flushSendQueue();
      if (result.skipped) {
        showToast(`Rien à envoyer : ${result.skipped}`, 'info');
      } else {
        showToast(`${result.sent}/${result.processed} emails envoyés`, result.failed > 0 ? 'info' : 'success');
      }
      loadCampaigns();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi du lot', 'error');
    } finally {
      setFlushing(false);
    }
  };
```

Add `import { settingsService } from '../services/settingsService';` near the other service imports.

In the JSX header (line 110-115), add the button next to "Nouvelle campagne":

```tsx
      <div className="pros-section-header">
        <h2>Campagnes actives</h2>
        <div className="flex gap-2">
          <button className="btn-secondary-sm" onClick={handleFlush} disabled={flushing}>
            {flushing ? <Loader size={13} className="spin" /> : <Send size={13} />}
            Envoyer le lot du jour {quota !== null ? `(quota: ${quota}/j)` : ''}
          </button>
          <button className="btn-primary-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={13} /> Nouvelle campagne
          </button>
        </div>
      </div>
```

- [ ] **Step 2: Add a "Sans campagne" metrics card**

After loading `campaigns` (line 72-84), add a parallel fetch and card for the unassigned auto-pipeline emails:

```typescript
  const [unassignedCount, setUnassignedCount] = useState({ draft: 0, approved: 0, sent: 0 });

  const loadUnassigned = useCallback(async () => {
    const [draft, approved, sent] = await Promise.all([
      campaignsService.getUnassignedGeneratedEmails('draft'),
      campaignsService.getUnassignedGeneratedEmails('approved'),
      campaignsService.getUnassignedGeneratedEmails('sent'),
    ]);
    setUnassignedCount({ draft: draft.length, approved: approved.length, sent: sent.length });
  }, []);

  useEffect(() => { loadUnassigned(); }, [loadUnassigned]);
```

Add the card in the JSX, right before `{showCreateModal && (...)}` (line 140):

```tsx
      <div className="mt-4 p-4 rounded-xl bg-brand-bg-panel border border-brand-border">
        <div className="font-semibold text-brand-text mb-2">Flux automatique (sans campagne)</div>
        <div className="flex gap-6 text-brand-text-secondary text-sm">
          <span>{unassignedCount.draft} en attente</span>
          <span>{unassignedCount.approved} planifiés</span>
          <span>{unassignedCount.sent} envoyés</span>
        </div>
      </div>
```

- [ ] **Step 3: Verify `npm run build` and in the browser**

Run: `npm run build`
Expected: no TypeScript errors.

Open Campagnes tab, confirm the quota shows `(quota: 100/j)`, the "Flux automatique" card shows non-zero counts if Task 16's test lead is still `approved`, and clicking "Envoyer le lot du jour" shows a toast — the button always sends `{ triggeredBy: 'manual-button' }` in the request body, so it works regardless of `prospection_mode`, per Task 6's design.

- [ ] **Step 4: Commit**

```bash
git add src/views/Prospection.tsx
git commit -m "feat(prospection): add daily-send button and unassigned-flow metrics to Campagnes tab"
```

---

### Task 18: `Prospection.tsx` — Relances tab rework

**Files:**
- Modify: `Projet/src/views/Prospection.tsx`

**Interfaces:**
- Consumes: `prospectionService.getFollowUpCandidates()` (new no-arg signature, Task 13), `prospectionService.createFollowUpDraft` (Task 13).

- [ ] **Step 1: Update the call site and add a "Générer la relance" action**

In `FollowUpTab` (lines 363-427), change the `useEffect` call (line 369) from `prospectionService.getFollowUpCandidates(5)` to `prospectionService.getFollowUpCandidates()`.

Add a handler after the `actionLabels` object (line 383):

```typescript
  const handleGenerateFollowUp = async (candidate: (typeof candidates)[number]) => {
    if (candidate.recommendedAction !== 'follow_up_1' && candidate.recommendedAction !== 'follow_up_2') return;
    const step = candidate.recommendedAction === 'follow_up_1' ? 'relance_1' : 'relance_2';
    try {
      await prospectionService.createFollowUpDraft(candidate.lead, step);
      showToast(`Relance générée pour ${candidate.lead.contact_name}`, 'success');
      setCandidates((prev) => prev.filter((c) => c.lead.id !== candidate.lead.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur génération relance', 'error');
    }
  };
```

In the JSX row (lines 403-421), add a button after the `action` badge:

```tsx
                <span className="followup-action-badge" style={{ color: action.color, borderColor: action.color }}>
                  {action.label}
                </span>
                {(recommendedAction === 'follow_up_1' || recommendedAction === 'follow_up_2') && (
                  <button className="btn-ghost-sm" onClick={() => handleGenerateFollowUp({ lead, daysSinceLastEmail, hasOpened, followUpCount, recommendedAction })}>
                    Générer la relance
                  </button>
                )}
```

- [ ] **Step 2: Verify `npm run build`**

Run: `npm run build`
Expected: no TypeScript errors, and the earlier "expected 0 arguments" error noted in Task 13 Step 3 is now gone.

- [ ] **Step 3: Verify in the browser**

In Réglages → Prospection, temporarily set "Délai avant 1ère relance" to `0`. Find a lead with a `sent` email older than today (or send one manually first), open Relances tab, confirm it appears with "1ère relance" badge and a "Générer la relance" button; click it, confirm a toast confirms, and check in Génération/Validation → Auto that the new `relance_1` draft appears. Restore the setting to `5` afterward.

- [ ] **Step 4: Commit**

```bash
git add src/views/Prospection.tsx
git commit -m "feat(prospection): wire Relances tab to settings thresholds and template drafts"
```

---

### Task 19: `Prospection.tsx` — mount the mode toggle, final wiring

**Files:**
- Modify: `Projet/src/views/Prospection.tsx`

**Interfaces:**
- Consumes: `ProspectionModeToggle` (Task 14), `settingsService.getProspectionSettings/updateProspectionSettings` (Task 11).

- [ ] **Step 1: Add mode state and the toggle to the page header**

In the top-level `Prospection` component (lines 15-63), add:

```typescript
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setMode(s.prospection_mode));
  }, []);

  const handleModeChange = async (newMode: 'manual' | 'auto') => {
    setMode(newMode);
    try {
      await settingsService.updateProspectionSettings({ prospection_mode: newMode });
      showToast(`Mode ${newMode === 'auto' ? 'automatique' : 'vérification humaine'} activé`, 'success');
    } catch {
      showToast('Erreur changement de mode', 'error');
    }
  };
```

Add `import { settingsService } from '../services/settingsService';` and `import { ProspectionModeToggle } from '../components/ProspectionModeToggle';` at the top (if `settingsService` isn't already imported from Task 17 — check before adding a duplicate import).

In the JSX header (lines 21-31), add the toggle next to the title block:

```tsx
      <div className="prospection-header">
        <div className="prospection-title">
          <Sparkles size={20} style={{ color: 'var(--purple)' }} />
          <h1>Prospection IA</h1>
          <span className="prospection-badge">Gemini 2.5 Flash</span>
        </div>
        <ProspectionModeToggle mode={mode} onChange={handleModeChange} />
        <p className="prospection-subtitle">
          Générez et envoyez des emails ultra-personnalisés en quelques clics.
        </p>
      </div>
```

Also update the badge text — it's misleading now that Gemini isn't in the default path. Change `<span className="prospection-badge">Gemini 2.5 Flash</span>` to `<span className="prospection-badge">Templates + fusion</span>`.

- [ ] **Step 2: Verify `npm run build`**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Verify the full manual-mode flow end-to-end in the browser**

1. Confirm toggle shows "Vérification humaine" active (gradient pill on the left) on page load.
2. Add a lead (segment Media, real-ish email) via Add Lead with one custom field.
3. Go to Génération/Validation → Auto — confirm the draft appears with merged `{{contact_name}}`/`{{company_name}}` text.
4. Approve it — confirm it moves out of the list.
5. Go to Campagnes — confirm "Flux automatique" shows 1 planifié, click "Envoyer le lot du jour", confirm the toast reports 1 sent and the count updates.
6. Toggle to "Automatique" — confirm the toast confirms the mode switch and `app_settings.prospection_mode` is `auto` in SQL.
7. Add a second test lead — confirm its draft is auto-approved (check SQL: `statut_envoi = 'approved'`) without visiting Génération/Validation.
8. Toggle back to "Vérification humaine" to leave the app in its default state, and delete both test leads.

- [ ] **Step 4: Commit**

```bash
git add src/views/Prospection.tsx
git commit -m "feat(prospection): mount manual/auto mode toggle in page header"
```

---

### Task 20: Final regression pass

**Files:** none (verification only)

- [ ] **Step 1: Confirm the rest of the app still works**

Using the preview tool, click through Pipeline, Leads, Tasks, Agenda, Stats, Codir, and Settings (all tabs) — confirm none of them show visual regressions from the Tailwind addition (Task 8's scoping should prevent this, but verify).

- [ ] **Step 2: Confirm the pre-existing Resend sandbox limitation still applies**

Per the memory note from 2026-07-06: `RESEND_FROM_EMAIL` is still on `onboarding@resend.dev`, so real sends only reach `baiaks1104@gmail.com`. This plan does not change that — flag it to the user as a pre-existing blocker for sending to real prospects, unrelated to this feature, requiring a verified domain at resend.com/domains.

- [ ] **Step 3: Run `npm run build` one final time on the full diff**

Run: `npm run build`
Expected: clean build, no errors.

- [ ] **Step 4: Commit if anything was fixed during this pass**

Only if Step 1-3 surfaced a fix — otherwise this task produces no commit.
