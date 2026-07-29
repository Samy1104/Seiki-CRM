-- ============================================================
-- SEIKI CRM — Add-on Étape de perte (is_closed_lost)
-- À appliquer dans : Supabase > SQL Editor
-- ============================================================

ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS is_closed_lost BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pipeline_stages.is_closed_lost IS 'Indique si cette étape est un statut de perte/échec (les leads dans cette étape sont archivés)';
