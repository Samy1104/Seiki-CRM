-- ============================================================
-- SEIKI CRM — Cron pour la publication automatique LinkedIn
-- À exécuter UNE FOIS dans Supabase > SQL Editor.
--
-- Étape 1 : stocker la clé service_role dans Vault, si ce n'est pas déjà
-- fait pour schema_prospection_v2_cron.sql (même secret réutilisé ici) :
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'seiki_service_role_key');
--
-- Étape 2 : remplacer <PROJECT_REF> ci-dessous par la vraie valeur
-- (Dashboard > Settings > API), puis exécuter ce fichier.
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
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seiki_service_role_key'
      ),
      'apikey', (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seiki_service_role_key'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
