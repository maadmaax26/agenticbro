-- Migration: 20260619000001_brand_guard_missing_tables
-- Adds two tables referenced in code but missing from schema:
--   1. brand_visual_fingerprints  — perceptual hash registry (fingerprint.ts, marketplace.ts)
--   2. brand_guard_reports        — takedown report archive (takedown.ts)

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. brand_visual_fingerprints
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS public.brand_visual_fingerprints (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES public.brand_monitors(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  image_url       text NOT NULL,
  image_type      text NOT NULL DEFAULT 'product',  -- 'logo' | 'product' | 'banner'
  phash           text NOT NULL,                    -- 16-char hex perceptual hash
  label           text,                             -- optional human label
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by brand
CREATE INDEX IF NOT EXISTS idx_brand_visual_fingerprints_brand_id
  ON public.brand_visual_fingerprints (brand_id);

-- Index for similarity search (full table scan on phash is acceptable for <10k rows;
-- add pg_trgm or bit-distance index if scale demands it)
CREATE INDEX IF NOT EXISTS idx_brand_visual_fingerprints_phash
  ON public.brand_visual_fingerprints (phash);

-- RLS
ALTER TABLE public.brand_visual_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fingerprints"
  ON public.brand_visual_fingerprints FOR SELECT
  USING (
    user_id = auth.uid()
    OR brand_id IN (
      SELECT id FROM public.brand_monitors WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert fingerprints for their brands"
  ON public.brand_visual_fingerprints FOR INSERT
  WITH CHECK (
    brand_id IN (
      SELECT id FROM public.brand_monitors WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own fingerprints"
  ON public.brand_visual_fingerprints FOR DELETE
  USING (
    brand_id IN (
      SELECT id FROM public.brand_monitors WHERE owner_id = auth.uid()
    )
  );

-- Service role bypass (for server-side auto-discover ingestion)
CREATE POLICY "Service role full access to fingerprints"
  ON public.brand_visual_fingerprints FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. brand_guard_reports
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS public.brand_guard_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_monitor_id    uuid REFERENCES public.brand_monitors(id) ON DELETE SET NULL,
  owner_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  report_type         text NOT NULL DEFAULT 'takedown',   -- 'takedown' | 'summary' | 'evidence'
  platform            text,                               -- 'x' | 'instagram' | 'domain' | etc.
  target_url          text,
  target_handle       text,
  report_content      jsonb NOT NULL DEFAULT '{}',        -- platform-specific template fields
  status              text NOT NULL DEFAULT 'draft',      -- 'draft' | 'submitted' | 'resolved'
  submitted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_guard_reports_brand_monitor_id
  ON public.brand_guard_reports (brand_monitor_id);

CREATE INDEX IF NOT EXISTS idx_brand_guard_reports_owner_id
  ON public.brand_guard_reports (owner_id);

CREATE INDEX IF NOT EXISTS idx_brand_guard_reports_status
  ON public.brand_guard_reports (status);

-- RLS
ALTER TABLE public.brand_guard_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reports"
  ON public.brand_guard_reports FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create reports"
  ON public.brand_guard_reports FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own reports"
  ON public.brand_guard_reports FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Service role full access to reports"
  ON public.brand_guard_reports FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_brand_guard_reports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_brand_guard_reports_updated_at
  BEFORE UPDATE ON public.brand_guard_reports
  FOR EACH ROW EXECUTE FUNCTION update_brand_guard_reports_updated_at();
