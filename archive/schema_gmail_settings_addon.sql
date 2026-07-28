-- ============================================================
-- SEIKI CRM — Add-on nom d'expéditeur Gmail configurable
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS schema_gmail_addon.sql
-- (déjà appliqué directement en session le 2026-07-28 — ce fichier
-- documente le changement pour toute réapplication/relecture future)
-- ============================================================

INSERT INTO public.app_settings (key, value, label, category) VALUES
  ('gmail_from_name', '{"name": "Seiki CRM"}', 'Nom affiché comme expéditeur', 'prospection')
ON CONFLICT (key) DO NOTHING;
