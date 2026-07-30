-- ============================================================
-- SEIKI CRM — Add-on Dashboard CODIR v2
-- À appliquer dans : Supabase > SQL Editor
-- ============================================================

-- 1. Historique structuré des transitions d'étape
CREATE TABLE IF NOT EXISTS public.lead_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    from_stage_id UUID NULL REFERENCES public.pipeline_stages(id),
    to_stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead ON public.lead_stage_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_to_stage ON public.lead_stage_history(to_stage_id);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_changed_at ON public.lead_stage_history(changed_at);

COMMENT ON TABLE public.lead_stage_history IS 'Trace chaque transition de stage_id sur leads, écrite par trigger DB (voir trg_log_lead_stage_change) — remplace le logging applicatif incomplet (Kanban drag-and-drop ne loggait rien).';

-- 2. Trigger DB-level : capture TOUT changement de stage_id (Sécurisé avec EXCEPTION)
CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id)
     OR (TG_OP = 'INSERT' AND NEW.stage_id IS NOT NULL) THEN
    BEGIN
      INSERT INTO public.lead_stage_history (lead_id, from_stage_id, to_stage_id, changed_at)
      VALUES (
        NEW.id,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage_id ELSE NULL END,
        NEW.stage_id,
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Empêche tout échec d'UPDATE du lead si l'historique rencontre un problème
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_lead_stage_change ON public.leads;
CREATE TRIGGER trg_log_lead_stage_change
  AFTER INSERT OR UPDATE OF stage_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_lead_stage_change();

-- 2b. Politiques RLS pour lead_stage_history
ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read/write on lead_stage_history" ON public.lead_stage_history;
CREATE POLICY "Allow read/write on lead_stage_history" ON public.lead_stage_history
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 3. Table dédiée pour les réunions CODIR (remplace app_settings.codir_history)
CREATE TABLE IF NOT EXISTS public.codir_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    label VARCHAR(255) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Migration des dates existantes depuis app_settings.codir_history
INSERT INTO public.codir_meetings (meeting_date, label)
SELECT (d)::timestamptz, 'Migré depuis app_settings'
FROM public.app_settings, LATERAL jsonb_array_elements_text(value->'dates') AS d
WHERE key = 'codir_history'
ON CONFLICT DO NOTHING;

-- 4. Flag de disqualification, indépendant de l'étape pipeline
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_disqualified BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.is_disqualified IS 'Exclut le lead des calculs analytiques (cohortes, volumes, conversions) sans le confondre avec Perdu';
