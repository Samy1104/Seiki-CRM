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
