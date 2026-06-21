CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  wallet_address TEXT UNIQUE,
  scan_credits INTEGER NOT NULL DEFAULT 0,
  free_scans_used INTEGER NOT NULL DEFAULT 0 CHECK (free_scans_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

INSERT INTO public.user_profiles(id, email, created_at, updated_at)
SELECT id, email, created_at, now() FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles(id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NEW.created_at, now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_user_profile ON auth.users;
CREATE TRIGGER trg_create_user_profile
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();

CREATE OR REPLACE FUNCTION public.increment_free_scans_used(user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_used INTEGER;
BEGIN
  IF auth.uid() IS DISTINCT FROM user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE user_profiles SET free_scans_used = free_scans_used + 1, updated_at = now()
  WHERE id = user_id RETURNING free_scans_used INTO v_used;
  RETURN COALESCE(v_used, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_free_scans_used(UUID) TO authenticated;
