-- ============================================================
-- SEIKI CRM — Add-on Étape de perte (is_closed_lost)
-- À appliquer dans : Supabase > SQL Editor
-- ============================================================

ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS is_closed_lost BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pipeline_stages.is_closed_lost IS 'Indique si cette étape est un statut de perte/échec (les leads dans cette étape sont archivés)';

-- Trigger pour auto-archiver les leads déplacés vers une étape de perte
CREATE OR REPLACE FUNCTION public.auto_archive_lost_lead_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_is_lost BOOLEAN;
BEGIN
  IF NEW.stage_id IS NOT NULL THEN
    SELECT COALESCE(is_closed_lost, false) OR (LOWER(name) LIKE '%perdu%' OR LOWER(name) LIKE '%lost%' OR LOWER(name) LIKE '%abandon%')
    INTO v_is_lost
    FROM public.pipeline_stages
    WHERE id = NEW.stage_id;

    IF v_is_lost THEN
      NEW.is_archived := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_archive_lost_lead ON public.leads;

CREATE TRIGGER trg_auto_archive_lost_lead
  BEFORE INSERT OR UPDATE OF stage_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_archive_lost_lead_trigger();
