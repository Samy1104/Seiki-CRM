-- ============================================================
-- SEIKI CRM — Cron pour la publication automatique LinkedIn
-- À exécuter UNE FOIS dans Supabase > SQL Editor, après avoir
-- remplacé <PROJECT_REF> et <SERVICE_ROLE_KEY> par les vraies
-- valeurs (Dashboard > Settings > API).
--
-- Vérification après exécution :
--   SELECT * FROM cron.job WHERE jobname = 'publish-linkedin-post-5min';
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'publish-linkedin-post-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/publish-linkedin-post',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'apikey', '<SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
