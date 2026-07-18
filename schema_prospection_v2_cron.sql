-- ============================================================
-- SEIKI CRM — Cron pour le mode Prospection 100% automatique
-- À exécuter UNE FOIS dans Supabase > SQL Editor.
--
-- Étape 1 : stocker la clé service_role dans Vault (une seule fois, ou
-- si elle change) — évite qu'elle finisse en clair dans cron.job / les
-- logs pg_net, contrairement à une substitution littérale dans l'URL/headers.
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'seiki_service_role_key');
-- (Si le secret existe déjà : select vault.update_secret(id, '<NOUVELLE_CLE>')
--  en récupérant l'id via select id from vault.secrets where name = 'seiki_service_role_key';)
--
-- Étape 2 : remplacer <PROJECT_REF> ci-dessous par la vraie valeur de ton
-- projet (Dashboard > Settings > API), puis exécuter ce fichier.
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
