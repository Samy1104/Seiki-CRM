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
