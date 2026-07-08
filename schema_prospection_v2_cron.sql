-- ============================================================
-- SEIKI CRM — Cron pour le mode Prospection 100% automatique
-- À exécuter UNE FOIS dans Supabase > SQL Editor, après avoir
-- remplacé <PROJECT_REF> et <SERVICE_ROLE_KEY> ci-dessous par
-- les vraies valeurs de ton projet (Dashboard > Settings > API).
--
-- IMPORTANT : utilise bien la clé "service_role", jamais la clé
-- "anon" — ce job a besoin d'un accès en écriture complet, que
-- seule la clé service_role fournit.
--
-- Vérification après exécution :
--   SELECT * FROM cron.job WHERE jobname = 'flush-send-queue-hourly';
-- Doit renvoyer 1 ligne avec active = true.
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
