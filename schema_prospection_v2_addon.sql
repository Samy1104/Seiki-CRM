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
DROP POLICY IF EXISTS "authenticated_full_access" ON public.email_templates;
CREATE POLICY "authenticated_full_access" ON public.email_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_email_templates_updated ON public.email_templates;
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
