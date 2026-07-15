-- ============================================================
-- SEIKI CRM — Add-on Scheduler LinkedIn
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS le schéma principal (schema_supabase.sql)
-- ============================================================

-- ============================================================
-- 1. TABLE LINKEDIN_ACCOUNTS — Comptes LinkedIn connectés
-- ============================================================
CREATE TABLE IF NOT EXISTS public.linkedin_accounts (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type    TEXT    NOT NULL CHECK (target_type IN ('personal', 'company')),
  label          TEXT    NOT NULL,
  access_token   TEXT    NOT NULL,
  refresh_token  TEXT,
  expires_at     TIMESTAMPTZ NOT NULL,
  linkedin_urn   TEXT    NOT NULL,
  connected_by   UUID    REFERENCES public.team_members(id) ON DELETE SET NULL,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_type, label)
);

COMMENT ON TABLE public.linkedin_accounts IS 'Comptes LinkedIn (personnel/entreprise) connectés pour la publication automatique';
COMMENT ON COLUMN public.linkedin_accounts.access_token IS 'Token OAuth LinkedIn — non chiffré en base, protégé uniquement par RLS';

ALTER TABLE public.linkedin_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.linkedin_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_linkedin_accounts_updated
  BEFORE UPDATE ON public.linkedin_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. TABLE SCHEDULED_LINKEDIN_POSTS — File de publication
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scheduled_linkedin_posts (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  hook               TEXT    NOT NULL,
  corps              TEXT    NOT NULL,
  hashtags           TEXT[]  NOT NULL DEFAULT '{}',
  image_path         TEXT,
  target_account_id  UUID    NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  scheduled_at       TIMESTAMPTZ NOT NULL,
  status             TEXT    NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled', 'posted', 'failed')),
  error_message      TEXT,
  linkedin_post_urn  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.scheduled_linkedin_posts IS 'File de posts LinkedIn programmés, publiés automatiquement par le cron publish-linkedin-post';

ALTER TABLE public.scheduled_linkedin_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.scheduled_linkedin_posts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_scheduled_linkedin_posts_updated
  BEFORE UPDATE ON public.scheduled_linkedin_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_scheduled_linkedin_posts_status_due
  ON public.scheduled_linkedin_posts(status, scheduled_at);

-- ============================================================
-- 3. STORAGE — Bucket images de posts
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('linkedin-media', 'linkedin-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "linkedin_media_authenticated_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'linkedin-media');

CREATE POLICY "linkedin_media_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'linkedin-media');

CREATE POLICY "linkedin_media_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'linkedin-media');
