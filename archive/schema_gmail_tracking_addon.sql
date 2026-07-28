-- ============================================================
-- SEIKI CRM — Add-on Suivi email (opens/replies/bounces pour les
-- envois de test, en plus du pipeline generated_emails)
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS schema_gmail_addon.sql
-- ============================================================

-- gmail_thread_id sur email_logs (et plus seulement generated_emails) :
-- permet à poll-gmail-inbox de retrouver un envoi sortant à partir du
-- thread Gmail même quand il n'y a pas de ligne generated_emails associée
-- (envoi de test ad-hoc via send-test-email, sans lead).
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;

CREATE INDEX IF NOT EXISTS idx_email_logs_thread ON public.email_logs(gmail_thread_id);

COMMENT ON COLUMN public.email_logs.gmail_thread_id IS 'Thread Gmail interne de l''envoi — clé de correspondance pour les bounces, y compris les envois de test sans generated_emails/lead';
