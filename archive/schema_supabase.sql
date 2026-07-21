-- ============================================================
-- SEIKI CRM — Schéma PostgreSQL pour Supabase
-- Version 1.0 — 2026-07-02
-- À exécuter dans : Supabase > SQL Editor
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ============================================================
-- NETTOYAGE (drop dans l'ordre des dépendances)
--
-- ⚠️  ATTENTION — INSTALLATION FRAÎCHE UNIQUEMENT.
-- Ce bloc DROP TABLE ... CASCADE efface TOUTES les données des tables
-- listées ci-dessous (leads, tasks, users, etc.) si elles existent déjà.
-- Ne JAMAIS ré-exécuter ce fichier contre une base déjà provisionnée
-- (production ou dev avec données réelles) : il n'y a aucune sauvegarde
-- automatique, et les fichiers addon (schema_prospection_*.sql,
-- schema_linkedin_scheduler_*.sql) dépendent des tables recréées ici via
-- des clés étrangères — les rejouer après ce DROP les laisserait orphelins.
-- ============================================================
DROP TABLE IF EXISTS public.lead_merge_proposals CASCADE;
DROP TABLE IF EXISTS public.email_logs CASCADE;
DROP TABLE IF EXISTS public.email_accounts CASCADE;
DROP TABLE IF EXISTS public.sequence_steps CASCADE;
DROP TABLE IF EXISTS public.sequences CASCADE;
DROP TABLE IF EXISTS public.history CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.lead_scores CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.pipeline_stages CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.app_settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================
-- 1. USERS — Profils utilisateurs (liés à auth.users Supabase)
-- ============================================================
CREATE TABLE public.users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id      UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  first_name   TEXT,
  last_name    TEXT,
  email        TEXT UNIQUE NOT NULL,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.users IS 'Profils CRM liés aux comptes auth Supabase';

-- ============================================================
-- 2. TEAM_MEMBERS — Personnes assignables (gérées dans Paramètres)
-- ============================================================
-- Distinct de users : permet d'ajouter des collègues même sans compte auth
CREATE TABLE public.team_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    TEXT NOT NULL,
  email        TEXT UNIQUE,
  initials     TEXT NOT NULL,                     -- ex : "AB" pour affichage avatar
  color        TEXT NOT NULL DEFAULT '#6B5FE6',   -- couleur avatar
  role_label   TEXT DEFAULT 'Commercial',         -- libellé libre
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.team_members IS 'Membres assignables aux tâches et leads (gérés dans Paramètres)';

-- ============================================================
-- 3. APP_SETTINGS — Paramètres globaux de l'application
-- ============================================================
CREATE TABLE public.app_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT UNIQUE NOT NULL,              -- ex : 'sla_media', 'scoring_v', 'company_name'
  value        JSONB NOT NULL DEFAULT '{}',
  label        TEXT,                              -- libellé lisible
  category     TEXT DEFAULT 'general',            -- 'sla', 'scoring', 'pipeline', 'general', 'prospection'
  updated_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.app_settings IS 'Paramètres globaux éditables via l''onglet Paramètres';

-- Données initiales
INSERT INTO public.app_settings (key, value, label, category) VALUES
  ('sla_media',    '{"days": 5}',  'SLA segment Media (jours)',   'sla'),
  ('sla_retail',   '{"days": 7}',  'SLA segment Retail (jours)',  'sla'),
  ('sla_instit',   '{"days": 14}', 'SLA segment Instit (jours)',  'sla'),
  ('company_name', '{"name": "Seiki"}', 'Nom de l''entreprise',   'general'),
  ('scoring_auto', '{"enabled": false}', 'Scoring ICP automatique par IA', 'scoring');

-- ============================================================
-- 4. PIPELINE_STAGES — Étapes du pipeline (customisables)
-- ============================================================
CREATE TABLE public.pipeline_stages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,
  position      INTEGER NOT NULL,
  color         TEXT DEFAULT '#6B5FE6',
  is_closed_won BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pipeline_stages IS 'Étapes du pipeline commercial (éditables dans Paramètres)';

-- Données initiales
INSERT INTO public.pipeline_stages (name, position, color, is_closed_won) VALUES
  ('Prospect',      1, '#44445A', false),
  ('Qualification', 2, '#6B5FE6', false),
  ('Contact',       3, '#9B8FFF', false),
  ('Démo',          4, '#F5B731', false),
  ('Proposition',   5, '#F87171', false),
  ('Gagné',         6, '#4ADE80', true);

-- ============================================================
-- 5. LEADS — Table centrale des prospects
-- ============================================================
CREATE TABLE public.leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  company_name     TEXT NOT NULL,
  contact_name     TEXT DEFAULT '—',
  email            TEXT,
  email_verified   BOOLEAN NOT NULL DEFAULT false,
  phone            TEXT,
  linkedin_url     TEXT,
  website          TEXT,
  domain           TEXT,                          -- extrait de email, pour déduplication
  segment          TEXT NOT NULL CHECK (segment IN ('Media', 'Retail', 'Instit')),
  stage_id         UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  score            INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  deal_value       INTEGER NOT NULL DEFAULT 0,    -- en k€
  source           TEXT NOT NULL DEFAULT 'LinkedIn'
                   CHECK (source IN ('LinkedIn', 'Événement', 'Réseau', 'AndZup', 'Inbound', 'Chrome Extension', 'Autre')),
  note             TEXT,
  days_in_stage    INTEGER NOT NULL DEFAULT 0,    -- suivi SLA
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_archived      BOOLEAN NOT NULL DEFAULT false,
  merged_into_id   UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  sequence_id      UUID,                          -- FK → sequences, ajoutée après création de sequences
  sequence_status  TEXT NOT NULL DEFAULT 'idle'
                   CHECK (sequence_status IN ('idle', 'active', 'paused', 'completed', 'replied')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.leads IS 'Leads et prospects du pipeline commercial';

-- Index leads
CREATE INDEX idx_leads_segment       ON public.leads(segment);
CREATE INDEX idx_leads_stage         ON public.leads(stage_id);
CREATE INDEX idx_leads_score         ON public.leads(score DESC);
CREATE INDEX idx_leads_domain        ON public.leads(domain);
CREATE INDEX idx_leads_owner         ON public.leads(owner_id);
CREATE INDEX idx_leads_archived      ON public.leads(is_archived);
CREATE INDEX idx_leads_days_in_stage ON public.leads(days_in_stage);

-- ============================================================
-- 6. LEAD_SCORES — Scoring ICP détaillé (6 critères)
-- ============================================================
CREATE TABLE public.lead_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  criterion       TEXT NOT NULL CHECK (criterion IN ('taille', 'budget', 'urgence', 'decideur', 'fit', 'concurrence')),
  value           INTEGER NOT NULL DEFAULT 0,
  max_value       INTEGER NOT NULL,
  label_selected  TEXT,                           -- libellé choisi (ex: "> 5 000 sal.")
  scored_by       TEXT NOT NULL DEFAULT 'manual' CHECK (scored_by IN ('manual', 'ai_auto')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, criterion)
);
COMMENT ON TABLE public.lead_scores IS 'Détail du scoring ICP par critère pour chaque lead';

-- ============================================================
-- 7. TASKS — Tâches (style ClickUp)
-- ============================================================
CREATE TABLE public.tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description         TEXT NOT NULL,
  lead_id             UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  assigned_to         UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status              TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date            DATE,
  completed_at        TIMESTAMPTZ,
  position            INTEGER DEFAULT 0,          -- ordre dans la vue board (kanban flashcards)
  is_auto_generated   BOOLEAN NOT NULL DEFAULT false,
  sequence_step_id    UUID,                       -- FK → sequence_steps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.tasks IS 'Tâches CRM avec vues liste et tableau (style ClickUp)';

CREATE INDEX idx_tasks_lead      ON public.tasks(lead_id);
CREATE INDEX idx_tasks_assigned  ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due       ON public.tasks(due_date);
CREATE INDEX idx_tasks_status    ON public.tasks(status);
CREATE INDEX idx_tasks_priority  ON public.tasks(priority);

-- ============================================================
-- 7.1. TASK_ASSIGNEES — Multi-assignation des tâches
-- ============================================================
CREATE TABLE public.task_assignees (
  task_id         UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  team_member_id  UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, team_member_id)
);
COMMENT ON TABLE public.task_assignees IS 'Table de liaison pour assigner plusieurs membres à une tâche';

-- ============================================================
-- 8. EVENTS — Agenda & Événements de networking
-- ============================================================
CREATE TABLE public.events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  event_date   DATE NOT NULL,
  end_date     DATE,
  location     TEXT,
  segment      TEXT,
  objective    TEXT,
  ical_uid     TEXT UNIQUE,                       -- pour future synchro iCal
  created_by   UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.events IS 'Agenda d''événements networking et prospection';

CREATE INDEX idx_events_date    ON public.events(event_date);
CREATE INDEX idx_events_segment ON public.events(segment);

-- ============================================================
-- 9. HISTORY — Historique d'activité des leads
-- ============================================================
CREATE TABLE public.history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  action_type  TEXT NOT NULL CHECK (action_type IN (
                  'note', 'stage_change', 'email_sent', 'email_received',
                  'call', 'linkedin_add', 'task_created', 'score_update',
                  'merge', 'sequence_start', 'sequence_step'
               )),
  content      TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',       -- ex: {"from_stage":"Prospect","to_stage":"Démo"}
  is_auto      BOOLEAN NOT NULL DEFAULT false,    -- généré par séquence/IMAP
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ                        -- si la note a été modifiée manuellement
);
COMMENT ON TABLE public.history IS 'Timeline d''activité complète par lead';

CREATE INDEX idx_history_lead ON public.history(lead_id, created_at DESC);
CREATE INDEX idx_history_type ON public.history(action_type);

-- ============================================================
-- 10. SEQUENCES — Séquences d'automatisation multicanales
-- ============================================================
CREATE TABLE public.sequences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT,
  created_by        UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT true, -- validation humaine avant chaque étape
  total_steps       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.sequences IS 'Séquences d''automatisation multicanales (email + tâches LinkedIn)';

-- ============================================================
-- 11. SEQUENCE_STEPS — Étapes détaillées d'une séquence
-- ============================================================
CREATE TABLE public.sequence_steps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id      UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  step_order       INTEGER NOT NULL,
  action_type      TEXT NOT NULL CHECK (action_type IN ('send_email', 'create_task', 'wait', 'linkedin_connect')),
  delay_days       INTEGER NOT NULL DEFAULT 0,
  condition        TEXT NOT NULL DEFAULT 'no_reply' CHECK (condition IN ('always', 'no_reply', 'no_open')),
  email_subject    TEXT,
  email_body       TEXT,                          -- template avec variables {{company}}, {{contact}}, {{prenom}}
  task_description TEXT,
  ai_prompt        TEXT,                          -- prompt pour génération Claude
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, step_order)
);
COMMENT ON TABLE public.sequence_steps IS 'Étapes d''une séquence (email, tâche, délai, LinkedIn)';

-- Mise à jour de la FK dans leads
ALTER TABLE public.leads ADD CONSTRAINT fk_leads_sequence
  FOREIGN KEY (sequence_id) REFERENCES public.sequences(id) ON DELETE SET NULL;

-- ============================================================
-- 12. EMAIL_ACCOUNTS — Comptes SMTP/IMAP
-- ============================================================
CREATE TABLE public.email_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES public.users(id) ON DELETE CASCADE,
  email_address      TEXT NOT NULL,
  display_name       TEXT,
  smtp_host          TEXT NOT NULL,
  smtp_port          INTEGER NOT NULL DEFAULT 587,
  smtp_secure        BOOLEAN NOT NULL DEFAULT true,
  imap_host          TEXT NOT NULL,
  imap_port          INTEGER NOT NULL DEFAULT 993,
  username           TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,               -- à chiffrer via Supabase Vault
  is_active          BOOLEAN NOT NULL DEFAULT true,
  last_sync_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.email_accounts IS 'Configuration SMTP/IMAP pour envoi et réception automatisés';

-- ============================================================
-- 13. EMAIL_LOGS — Logs de tous les emails envoyés/reçus
-- ============================================================
CREATE TABLE public.email_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  sequence_id       UUID REFERENCES public.sequences(id) ON DELETE SET NULL,
  sequence_step_id  UUID REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
  email_account_id  UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  direction         TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  from_email        TEXT NOT NULL,
  to_email          TEXT NOT NULL,
  subject           TEXT,
  body_preview      TEXT,                         -- 500 premiers caractères
  body_html         TEXT,
  message_id        TEXT UNIQUE,                  -- Message-ID RFC 822 (déduplication IMAP)
  in_reply_to       TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'replied', 'bounced', 'failed')),
  opened_at         TIMESTAMPTZ,
  replied_at        TIMESTAMPTZ,
  error_message     TEXT,
  sent_at           TIMESTAMPTZ,
  received_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.email_logs IS 'Logs complets de tous les emails CRM (boîte unifiée)';

CREATE INDEX idx_email_logs_lead       ON public.email_logs(lead_id);
CREATE INDEX idx_email_logs_status     ON public.email_logs(status);
CREATE INDEX idx_email_logs_direction  ON public.email_logs(direction);
CREATE INDEX idx_email_logs_message_id ON public.email_logs(message_id);

-- ============================================================
-- 14. LEAD_MERGE_PROPOSALS — Propositions de fusion (déduplication)
-- ============================================================
CREATE TABLE public.lead_merge_proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_lead_id    UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  target_lead_id    UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  similarity_score  DECIMAL(5,2),
  match_reason      TEXT CHECK (match_reason IN ('domain_match', 'name_similarity', 'email_match')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by       UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_lead_id <> target_lead_id)
);
COMMENT ON TABLE public.lead_merge_proposals IS 'Propositions de fusion de doublons détectés automatiquement';

-- ============================================================
-- MISE À JOUR DES FK TARDIVES (tasks → sequence_steps)
-- ============================================================
ALTER TABLE public.tasks ADD CONSTRAINT fk_tasks_sequence_step
  FOREIGN KEY (sequence_step_id) REFERENCES public.sequence_steps(id) ON DELETE SET NULL;

-- ============================================================
-- TRIGGERS — updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Appliquer le trigger
CREATE TRIGGER trg_users_updated         BEFORE UPDATE ON public.users          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_team_members_updated  BEFORE UPDATE ON public.team_members   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leads_updated         BEFORE UPDATE ON public.leads          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tasks_updated         BEFORE UPDATE ON public.tasks          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_events_updated        BEFORE UPDATE ON public.events         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sequences_updated     BEFORE UPDATE ON public.sequences      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TRIGGER — Extraction automatique du domaine email d'un lead
-- ============================================================
CREATE OR REPLACE FUNCTION public.extract_lead_domain()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email LIKE '%@%' THEN
    NEW.domain = lower(split_part(NEW.email, '@', 2));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_extract_domain
  BEFORE INSERT OR UPDATE OF email ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.extract_lead_domain();

-- ============================================================
-- TRIGGER — Remise à zéro de days_in_stage au changement d'étape
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_days_in_stage()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    NEW.days_in_stage    = 0;
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_stage_change
  BEFORE UPDATE OF stage_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.reset_days_in_stage();

-- ============================================================
-- TRIGGER — Mise à jour du score total dans leads quand lead_scores change
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_lead_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.leads
  SET score = (
    SELECT COALESCE(SUM(value), 0)
    FROM public.lead_scores
    WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id)
  )
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_scores_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.lead_scores
  FOR EACH ROW EXECUTE FUNCTION public.sync_lead_score();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequences          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_merge_proposals ENABLE ROW LEVEL SECURITY;

-- Politiques
CREATE POLICY "authenticated_full_access" ON public.users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.pipeline_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.lead_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.sequence_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.email_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.email_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.lead_merge_proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
