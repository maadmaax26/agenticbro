-- ╔══════════════════════════════════════════════════════════════╗
-- ║  MIGRATION: Scan Job Queue                                   ║
-- ║  Run this in Supabase → SQL Editor                           ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── 1. Create scan_jobs table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scan_jobs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','claimed','running','completed','failed','timeout')),
  scan_type      TEXT        NOT NULL DEFAULT 'token',
  payload        JSONB       NOT NULL,            -- { address, chain, options }
  worker_id      TEXT,                            -- which OpenClaw worker claimed it
  claimed_at     TIMESTAMPTZ,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  retry_count    INT         DEFAULT 0,
  max_retries    INT         DEFAULT 3,
  result         JSONB,
  error          TEXT,
  priority       INT         DEFAULT 5            -- 1=highest, 10=lowest
);

-- ─── 2. Indexes ───────────────────────────────────────────────────────────────

-- Efficient index for worker polling (partial index on 'pending' only)
CREATE INDEX IF NOT EXISTS idx_scan_jobs_pending
  ON scan_jobs (status, priority, created_at)
  WHERE status = 'pending';

-- ─── 3. Auto-update updated_at trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scan_jobs_updated_at ON scan_jobs;
CREATE TRIGGER scan_jobs_updated_at
  BEFORE UPDATE ON scan_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 4. Atomic job claim (FOR UPDATE SKIP LOCKED) ────────────────────────────

CREATE OR REPLACE FUNCTION claim_next_scan_job(
  p_worker_id  TEXT,
  p_max_retries INT DEFAULT 3
)
RETURNS SETOF scan_jobs AS $$
DECLARE
  v_job scan_jobs;
BEGIN
  SELECT * INTO v_job
  FROM scan_jobs
  WHERE status = 'pending'
    AND retry_count < p_max_retries
  ORDER BY priority ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    UPDATE scan_jobs SET
      status     = 'claimed',
      worker_id  = p_worker_id,
      claimed_at = NOW()
    WHERE id = v_job.id
    RETURNING * INTO v_job;
    RETURN NEXT v_job;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ─── 5. Requeue timed-out jobs (worker went silent > 3 min) ──────────────────

CREATE OR REPLACE FUNCTION requeue_timed_out_jobs()
RETURNS void AS $$
  UPDATE scan_jobs
  SET
    status      = 'pending',
    worker_id   = NULL,
    claimed_at  = NULL,
    retry_count = retry_count + 1,
    error       = 'Worker timeout — requeued'
  WHERE status IN ('claimed', 'running')
    AND updated_at < NOW() - INTERVAL '3 minutes'
    AND retry_count < max_retries;
$$ LANGUAGE plpgsql;

-- ─── 6. Enable Row Level Security (open read for anon, write for service role) ─

ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read their own job by id (frontend status polling)
CREATE POLICY "Anyone can read scan jobs by id"
  ON scan_jobs FOR SELECT
  USING (true);

-- Only service role can insert / update / delete
-- (anon key will be blocked by default when RLS is on)
CREATE POLICY "Service role full access"
  ON scan_jobs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── NOTE ─────────────────────────────────────────────────────────────────────
-- After running this migration, enable Realtime replication:
-- Supabase Dashboard → Database → Replication → Add table → select scan_jobs
-- ──────────────────────────────────────────────────────────────────────────────
