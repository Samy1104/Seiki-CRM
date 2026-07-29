-- ============================================================
-- SEIKI CRM — Add-on Calendly Integration
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS le schéma principal (schema_supabase.sql)
-- ============================================================

-- ============================================================
-- 1. TABLE CALENDLY_ACCOUNTS — Compte Calendly connecté
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calendly_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendly_user_uri   TEXT NOT NULL UNIQUE,
  access_token        TEXT NOT NULL,
  refresh_token       TEXT NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  connected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.calendly_accounts IS 'Compte Calendly connecté (outil mono-utilisateur, une seule ligne) pour la synchronisation des rendez-vous';
COMMENT ON COLUMN public.calendly_accounts.access_token IS 'Token OAuth Calendly — non chiffré en base, protégé uniquement par RLS';

ALTER TABLE public.calendly_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.calendly_accounts;
CREATE POLICY "authenticated_full_access" ON public.calendly_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_calendly_accounts_updated ON public.calendly_accounts;
CREATE TRIGGER trg_calendly_accounts_updated
  BEFORE UPDATE ON public.calendly_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. TABLE CALENDLY_BOOKINGS — Rendez-vous synchronisés
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calendly_bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendly_event_uri  TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,
  invitee_name        TEXT NOT NULL,
  invitee_email       TEXT NOT NULL,
  location            TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  cancel_reason       TEXT,
  lead_id             UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.calendly_bookings IS 'Rendez-vous Calendly synchronisés par polling (poll-calendly-bookings), affichés dans l''Agenda';

ALTER TABLE public.calendly_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.calendly_bookings;
CREATE POLICY "authenticated_full_access" ON public.calendly_bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_calendly_bookings_updated ON public.calendly_bookings;
CREATE TRIGGER trg_calendly_bookings_updated
  BEFORE UPDATE ON public.calendly_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_calendly_bookings_start_time
  ON public.calendly_bookings(start_time);

CREATE INDEX IF NOT EXISTS idx_calendly_bookings_lead_id
  ON public.calendly_bookings(lead_id);

-- ============================================================
-- 3. HISTORY — Ajout de 'calendly_booking' aux action_type autorisés
-- ============================================================
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_action_type_check;
ALTER TABLE public.history ADD CONSTRAINT history_action_type_check CHECK (action_type IN (
  'note', 'stage_change', 'email_sent', 'email_received',
  'call', 'linkedin_add', 'task_created', 'score_update',
  'merge', 'sequence_start', 'sequence_step', 'calendly_booking'
));
