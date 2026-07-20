-- ============================================================
-- SEIKI CRM — Addon : Prénom & Nom de Famille dans public.users
-- À exécuter dans : Supabase > SQL Editor
-- ============================================================

-- 1. Ajout des colonnes first_name et last_name sur public.users
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Fonction de synchronisation auth.users -> public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_first TEXT;
  v_last TEXT;
  v_full TEXT;
BEGIN
  v_first := NEW.raw_user_meta_data->>'first_name';
  v_last := COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'family_name');
  v_full := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(TRIM(CONCAT(v_first, ' ', v_last)), '')
  );
  
  IF v_full IS NULL OR v_full = '' THEN
    v_full := SPLIT_PART(NEW.email, '@', 1);
  END IF;

  INSERT INTO public.users (auth_id, email, full_name, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    v_full,
    v_first,
    v_last
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 3. Trigger de synchronisation sur la table auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
