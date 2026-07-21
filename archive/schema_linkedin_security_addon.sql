-- ============================================================
-- SEIKI CRM — Add-on Sécurité LinkedIn (restriction colonnes tokens)
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS schema_linkedin_scheduler_addon.sql
--
-- linkedin_accounts.access_token/refresh_token sont en clair (voir
-- commentaire sur la colonne dans schema_linkedin_scheduler_addon.sql) et
-- la policy RLS de la table est un blanket "authenticated_full_access"
-- (USING (true)) — n'importe quel membre de l'équipe authentifié peut donc
-- lire les tokens OAuth actifs de n'importe quel compte connecté via
-- PostgREST. Le frontend n'a jamais besoin de ces colonnes : linkedinService
-- (src/services/linkedinService.ts) ne sélectionne que
-- id/target_type/label/expires_at/connected_at. On retire donc l'accès en
-- lecture aux colonnes token pour le rôle authenticated ; seul le rôle
-- service_role (utilisé exclusivement par les Edge Functions
-- linkedin-oauth-callback et publish-linkedin-post) continue d'y accéder,
-- puisqu'il bypass RLS et les grants de colonnes.
-- ============================================================

REVOKE SELECT ON public.linkedin_accounts FROM authenticated;

GRANT SELECT (id, target_type, label, expires_at, linkedin_urn, connected_by, connected_at, updated_at)
  ON public.linkedin_accounts TO authenticated;

-- Si linkedinService.listAccounts() est un jour modifié pour sélectionner
-- une colonne supplémentaire, l'ajouter à la liste ci-dessus (jamais
-- access_token/refresh_token) plutôt que de revenir à un GRANT SELECT table entier.
