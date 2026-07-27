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

ALTER TABLE public.gmail_accounts ADD CONSTRAINT gmail_accounts_email_key UNIQUE (email);

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
