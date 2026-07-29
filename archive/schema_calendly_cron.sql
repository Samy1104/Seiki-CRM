-- ============================================================
-- SEIKI CRM — Cron Calendly Polling
-- À appliquer dans : Supabase > SQL Editor, APRÈS avoir déployé
-- poll-calendly-bookings ET schema_calendly_addon.sql
-- Réutilise le secret 'seiki_cron_secret' déjà créé (voir
-- schema_prospection_v2_cron.sql) — pas besoin de le recréer.
--
-- Remplacer <PROJECT_REF> et <ANON_KEY> par les vraies valeurs du projet.
--
-- Vérification après exécution :
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'poll-calendly-bookings';
-- Doit renvoyer 1 ligne, active = true.
-- ============================================================

SELECT cron.schedule(
  'poll-calendly-bookings',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/poll-calendly-bookings',
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
