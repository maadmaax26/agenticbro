-- Website Brand Guard scans remain the canonical source for consented content.
-- Existing rows are not eligible unless a user explicitly opts in on a new scan.

ALTER TABLE public.brand_guard_scans
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS initiated_from TEXT NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS content_reuse_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_reuse_scope TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS content_reuse_consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_reuse_revoked_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'brand_guard_scans_content_reuse_scope_check'
      AND conrelid = 'public.brand_guard_scans'::regclass
  ) THEN
    ALTER TABLE public.brand_guard_scans
      ADD CONSTRAINT brand_guard_scans_content_reuse_scope_check
      CHECK (content_reuse_scope IN ('none', 'anonymized', 'named'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_brand_guard_scans_owner_created
  ON public.brand_guard_scans(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_guard_scans_content_eligible
  ON public.brand_guard_scans(completed_at DESC)
  WHERE status = 'complete'
    AND content_reuse_consent = true
    AND content_reuse_revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.brand_guard_content_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.brand_guard_scans(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN (
      'new', 'held', 'drafted', 'in_review', 'approved',
      'posted', 'rejected', 'archived'
    )),
  content_scope TEXT NOT NULL
    CHECK (content_scope IN ('anonymized', 'named')),
  finding_type TEXT NOT NULL,
  safe_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_copy TEXT,
  draft_hashtags TEXT[] NOT NULL DEFAULT '{}',
  draft_image_spec TEXT,
  safety_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  telegram_message_id TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  posted_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scan_id, finding_type)
);

CREATE INDEX IF NOT EXISTS idx_brand_guard_content_candidates_status
  ON public.brand_guard_content_candidates(status, created_at);

CREATE INDEX IF NOT EXISTS idx_brand_guard_content_candidates_owner
  ON public.brand_guard_content_candidates(owner_id, created_at DESC);

ALTER TABLE public.brand_guard_content_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_guard_content_candidates FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_brand_guard_content_candidate_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brand_guard_content_candidates_updated_at
  ON public.brand_guard_content_candidates;
CREATE TRIGGER trg_brand_guard_content_candidates_updated_at
  BEFORE UPDATE ON public.brand_guard_content_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_brand_guard_content_candidate_updated_at();

CREATE OR REPLACE FUNCTION public.hold_revoked_brand_guard_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.content_reuse_revoked_at IS NOT NULL
     AND OLD.content_reuse_revoked_at IS NULL THEN
    UPDATE public.brand_guard_content_candidates
    SET status = 'held',
        safety_flags = safety_flags || '["consent_revoked"]'::jsonb,
        updated_at = now()
    WHERE scan_id = NEW.id
      AND status NOT IN ('posted', 'rejected', 'archived');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hold_revoked_brand_guard_content
  ON public.brand_guard_scans;
CREATE TRIGGER trg_hold_revoked_brand_guard_content
  AFTER UPDATE OF content_reuse_revoked_at ON public.brand_guard_scans
  FOR EACH ROW
  EXECUTE FUNCTION public.hold_revoked_brand_guard_content();

COMMENT ON TABLE public.brand_guard_content_candidates IS
  'Sanitized, consented content candidates derived from completed website Brand Guard scans. Service-role only.';
