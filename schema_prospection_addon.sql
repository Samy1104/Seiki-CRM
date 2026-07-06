-- ============================================================
-- SEIKI CRM — Add-on Prospection IA
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS le schéma principal (schema_supabase.sql)
-- ============================================================

-- ============================================================
-- 1. COLONNES SUPPLÉMENTAIRES SUR LEADS
-- ============================================================
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS poste            TEXT,
  ADD COLUMN IF NOT EXISTS enrichi_contexte TEXT;

COMMENT ON COLUMN public.leads.poste            IS 'Intitulé du poste du contact (ex: Directeur Marketing)';
COMMENT ON COLUMN public.leads.enrichi_contexte IS 'Contexte enrichi : actualités, levées de fonds, articles récents. Alimenté manuellement ou par enrichissement IA.';

-- ============================================================
-- 2. TABLE CAMPAIGNS — Campagnes de prospection IA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT    NOT NULL,
  description      TEXT,
  objective        TEXT    NOT NULL DEFAULT 'Prise de RDV',
  target_segment   TEXT    CHECK (target_segment IN ('Media', 'Retail', 'Instit', 'All')),
  sequence_id      UUID    REFERENCES public.sequences(id) ON DELETE SET NULL,
  status           TEXT    NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  system_prompt    TEXT,   -- prompt système personnalisé pour ce LLM
  tone             TEXT    NOT NULL DEFAULT 'professionnel'
                   CHECK (tone IN ('professionnel', 'décontracté', 'direct', 'consultatif')),
  created_by       UUID    REFERENCES public.team_members(id) ON DELETE SET NULL,
  emails_sent      INTEGER NOT NULL DEFAULT 0,
  emails_opened    INTEGER NOT NULL DEFAULT 0,
  emails_replied   INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.campaigns IS 'Campagnes de prospection email propulsées par IA';

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.campaigns 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_campaigns_updated 
  BEFORE UPDATE ON public.campaigns 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. TABLE GENERATED_EMAILS — Emails générés par le LLM
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generated_emails (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID    NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id      UUID    REFERENCES public.campaigns(id) ON DELETE SET NULL,
  sequence_step_id UUID    REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
  sujet            TEXT    NOT NULL,
  corps_du_mail    TEXT    NOT NULL,
  icebreaker       TEXT,    -- accroche personnalisée générée par le LLM
  statut_envoi     TEXT    NOT NULL DEFAULT 'draft'
                   CHECK (statut_envoi IN ('draft', 'approved', 'sending', 'sent', 'failed')),
  model_used       TEXT    DEFAULT 'gpt-4o-mini',
  prompt_used      TEXT,    -- prompt complet envoyé au LLM (pour audit)
  generation_ms    INTEGER, -- temps de génération en ms
  approved_by      UUID    REFERENCES public.team_members(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  scheduled_at     TIMESTAMPTZ, -- date planifiée pour l'envoi
  resend_message_id TEXT,       -- ID retourné par Resend après envoi
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.generated_emails IS 'Emails personnalisés générés par le LLM, en attente de validation ou envoyés';

ALTER TABLE public.generated_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.generated_emails 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_gen_emails_lead     ON public.generated_emails(lead_id);
CREATE INDEX idx_gen_emails_campaign ON public.generated_emails(campaign_id);
CREATE INDEX idx_gen_emails_statut   ON public.generated_emails(statut_envoi);
CREATE INDEX idx_gen_emails_created  ON public.generated_emails(created_at DESC);

-- ============================================================
-- 4. LIAISON email_logs → generated_emails
-- ============================================================
ALTER TABLE public.email_logs 
  ADD COLUMN IF NOT EXISTS generated_email_id UUID 
    REFERENCES public.generated_emails(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_gen_email 
  ON public.email_logs(generated_email_id);

-- ============================================================
-- 5. VUE — Métriques par campagne (open rate, reply rate)
-- ============================================================
CREATE OR REPLACE VIEW public.campaign_metrics AS
SELECT
  c.id,
  c.name,
  c.status,
  c.objective,
  c.tone,
  c.target_segment,
  c.created_at,
  COUNT(DISTINCT ge.id)                                              AS total_generated,
  COUNT(DISTINCT ge.id) FILTER (WHERE ge.statut_envoi = 'sent')     AS total_sent,
  COUNT(DISTINCT ge.id) FILTER (WHERE ge.statut_envoi = 'draft')    AS total_draft,
  COUNT(DISTINCT el.generated_email_id) FILTER (WHERE el.status = 'opened')  AS total_opened,
  COUNT(DISTINCT el.generated_email_id) FILTER (WHERE el.status = 'replied') AS total_replied,
  ROUND(
    100.0 * COUNT(DISTINCT el.generated_email_id) FILTER (WHERE el.status = 'opened')
    / NULLIF(COUNT(DISTINCT ge.id) FILTER (WHERE ge.statut_envoi = 'sent'), 0), 1
  )                                                                  AS open_rate,
  ROUND(
    100.0 * COUNT(DISTINCT el.generated_email_id) FILTER (WHERE el.status = 'replied')
    / NULLIF(COUNT(DISTINCT ge.id) FILTER (WHERE ge.statut_envoi = 'sent'), 0), 1
  )                                                                  AS reply_rate
FROM public.campaigns c
LEFT JOIN public.generated_emails ge ON ge.campaign_id = c.id
LEFT JOIN public.email_logs el       ON el.generated_email_id = ge.id
GROUP BY c.id, c.name, c.status, c.objective, c.tone, c.target_segment, c.created_at;

-- ============================================================
-- 6. TRIGGER — Mise à jour auto des compteurs sur campaigns
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_campaign_counters()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Met à jour emails_sent quand un email passe au statut 'sent'
  IF (TG_OP = 'UPDATE') AND 
     (OLD.statut_envoi IS DISTINCT FROM NEW.statut_envoi) AND 
     (NEW.statut_envoi = 'sent') AND 
     (NEW.campaign_id IS NOT NULL) THEN
    UPDATE public.campaigns
    SET emails_sent = emails_sent + 1
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_campaign_sent
  AFTER UPDATE ON public.generated_emails
  FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_counters();

-- ============================================================
-- 7. TRIGGER — Log historique quand un email est généré
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_generated_email()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Ajoute une entrée dans l'historique du lead
  INSERT INTO public.history (lead_id, action_type, content, metadata, is_auto)
  VALUES (
    NEW.lead_id,
    'email_sent',
    CASE 
      WHEN NEW.statut_envoi = 'sent' 
        THEN 'Email de prospection envoyé : ' || COALESCE(NEW.sujet, '(sans sujet)')
      ELSE 'Email de prospection généré par IA : ' || COALESCE(NEW.sujet, '(sans sujet)')
    END,
    jsonb_build_object(
      'generated_email_id', NEW.id,
      'campaign_id', NEW.campaign_id,
      'model', NEW.model_used,
      'statut', NEW.statut_envoi
    ),
    true
  );
  RETURN NEW;
END;
$$;

-- Trigger sur INSERT (génération) et sur UPDATE vers 'sent' (envoi)
CREATE TRIGGER trg_log_generated_email_insert
  AFTER INSERT ON public.generated_emails
  FOR EACH ROW EXECUTE FUNCTION public.log_generated_email();
