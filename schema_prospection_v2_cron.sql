-- ============================================================
-- SEIKI CRM — Cron pour le mode Prospection 100% automatique
-- À exécuter UNE FOIS dans Supabase > SQL Editor.
--
-- Étape 1 : générer un secret dédié pour authentifier ce cron auprès des
-- Edge Functions (PAS la clé service_role — Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
-- côté Edge Function s'est révélé ne pas correspondre de façon fiable à la
-- clé affichée dans le Dashboard sur ce projet, cause exacte non élucidée ;
-- un secret choisi et posé soi-même des deux côtés élimine le problème).
-- Générer une valeur aléatoire longue, par exemple avec :
--   openssl rand -hex 32
-- (ou n'importe quel générateur de chaîne aléatoire >= 32 caractères).
--
--   select vault.create_secret('<VALEUR_ALEATOIRE_GENEREE>', 'seiki_cron_secret');
-- (Si le secret existe déjà : select vault.update_secret(id, new_secret := '<NOUVELLE_VALEUR>')
--  en récupérant l'id via select id from vault.secrets where name = 'seiki_cron_secret';)
--
-- Étape 2 : poser CE MÊME secret côté Edge Functions :
--   npx supabase secrets set CRON_SECRET=<LA_MEME_VALEUR_ALEATOIRE>
-- puis redéployer : npx supabase functions deploy
--
-- Étape 3 : remplacer <PROJECT_REF> et <ANON_KEY> ci-dessous par les vraies
-- valeurs de ton projet (Dashboard > Settings > API — <ANON_KEY> est la clé
-- publique anon, sans risque à coller ici en clair, uniquement utilisée
-- pour le header apikey attendu par la passerelle Supabase).
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
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seiki_cron_secret'
      ),
      'apikey', '<ANON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
