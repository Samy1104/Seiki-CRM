-- ============================================================
-- SEIKI CRM — Cron pour la publication automatique LinkedIn
-- À exécuter UNE FOIS dans Supabase > SQL Editor.
--
-- Étape 1 : réutiliser le même secret 'seiki_cron_secret' que
-- schema_prospection_v2_cron.sql (le créer là-bas d'abord si pas déjà fait).
--
-- Étape 2 : remplacer <PROJECT_REF> et <ANON_KEY> ci-dessous par les vraies
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
