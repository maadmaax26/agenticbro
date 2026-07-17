-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION: Scan Analytics — ALTER existing scan_events + add analytics ║
-- ║  Run this in Supabase Dashboard → SQL Editor                           ║
-- ║  Project: YOUR_PROJECT_ID                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- EXISTING SCHEMA (as of 2026-05-17):
--   scan_events: id, created_at, event_date, scan_type, platform, username,
--                risk_score, risk_level, scam_type, verification_level,
--                source_table, source_id, metadata
--   127 rows, all from scan_jobs, no platform/username/risk populated
--
-- PLAN:
--   1. Add missing columns (target, source, wallet_address, country_code)
--   2. Populate new columns from existing data where possible
--   3. Drop old RPCs and create new analytics-grade ones
--   4. Create materialized view for dashboard
--   5. Add indexes for analytics performance
--   6. Backfill from scan_results table
--   7. Update RLS policies

-- ─── 1. Add new columns ────────────────────────────────────────────────────

-- 'target' is the unified field for username/phone/URL/contract address
ALTER TABLE scan_events ADD COLUMN IF NOT EXISTS target TEXT;
-- 'source' distinguishes website vs telegram vs api
ALTER TABLE scan_events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website';
-- 'wallet_address' for connected wallet tracking
ALTER TABLE scan_events ADD COLUMN IF NOT EXISTS wallet_address TEXT;
-- 'country_code' for phone scan geographic breakdown
ALTER TABLE scan_events ADD COLUMN IF NOT EXISTS country_code TEXT;

-- ─── 2. Populate 'target' from 'username' for existing rows ──────────────────

UPDATE scan_events SET target = username WHERE target IS NULL AND username IS NOT NULL;
UPDATE scan_events SET target = source_id WHERE target IS NULL AND source_table = 'scan_jobs';

-- ─── 3. Backfill 'platform' from scan_jobs metadata ────────────────────────

-- For x_cdp scans, platform is twitter
UPDATE scan_events SET platform = 'twitter' WHERE scan_type = 'x_cdp' AND platform IS NULL;

-- For profile scans, try to extract platform from metadata
UPDATE scan_events SET platform = metadata->>'platform' 
WHERE scan_type = 'profile' AND platform IS NULL AND metadata->>'platform' IS NOT NULL;

-- For token scans, no platform needed
-- (already NULL which is correct)

-- ─── 4. Backfill 'risk_score' and 'risk_level' from scan_jobs result ────────

-- Join with scan_jobs to get risk data
UPDATE scan_events se
SET 
  risk_score = (sj.result->>'riskScore')::decimal,
  risk_level = sj.result->>'riskLevel'
FROM scan_jobs sj
WHERE se.source_table = 'scan_jobs' 
  AND se.source_id::uuid = sj.id
  AND sj.status = 'completed'
  AND sj.result IS NOT NULL
  AND se.risk_score IS NULL;

-- For any remaining NULL risk_levels, derive from risk_score
UPDATE scan_events SET risk_level = 
  CASE 
    WHEN risk_score IS NULL THEN NULL
    WHEN risk_score::decimal < 3 THEN 'LOW'
    WHEN risk_score::decimal < 5 THEN 'MEDIUM'
    WHEN risk_score::decimal < 7 THEN 'HIGH'
    ELSE 'CRITICAL'
  END
WHERE risk_level IS NULL AND risk_score IS NOT NULL;

-- ─── 5. Backfill from scan_results (social scans) ───────────────────────────

INSERT INTO scan_events (scan_type, platform, target, risk_score, risk_level, source, created_at, event_date)
SELECT
    'social' AS scan_type,
    LOWER(platform) AS platform,
    username AS target,
    risk_score,
    COALESCE(risk_level,
        CASE 
            WHEN risk_score < 3 THEN 'LOW'
            WHEN risk_score < 5 THEN 'MEDIUM'
            WHEN risk_score < 7 THEN 'HIGH'
            ELSE 'CRITICAL'
        END
    ) AS risk_level,
    COALESCE(data_source, 'website') AS source,
    scanned_at AS created_at,
    scanned_at::date AS event_date
FROM scan_results
WHERE NOT EXISTS (
    SELECT 1 FROM scan_events se
    WHERE se.scan_type = 'social'
      AND se.target = scan_results.username
      AND se.created_at = scan_results.scanned_at
)
ON CONFLICT DO NOTHING;

-- ─── 6. Add indexes for analytics ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_scan_events_created_at ON scan_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_type_date ON scan_events(scan_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_platform_date ON scan_events(platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_source_date ON scan_events(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_target ON scan_events(scan_type, target);
CREATE INDEX IF NOT EXISTS idx_scan_events_risk ON scan_events(risk_score DESC) WHERE risk_score IS NOT NULL;

-- ─── 7. Drop old RPCs ──────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_scan_counts_by_date(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_daily_scan_stats(DATE, DATE);
DROP FUNCTION IF EXISTS get_total_scan_counts();
DROP FUNCTION IF EXISTS get_scan_growth();

-- ─── 8. Create new RPC: get_daily_scan_stats ────────────────────────────────

CREATE OR REPLACE FUNCTION get_daily_scan_stats(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    scan_date     DATE,
    scan_type     TEXT,
    platform      TEXT,
    total_scans   BIGINT,
    unique_targets BIGINT,
    avg_risk_score NUMERIC,
    critical_count BIGINT,
    high_count    BIGINT,
    medium_count  BIGINT,
    low_count     BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        se.event_date,
        se.scan_type,
        se.platform,
        COUNT(*)::BIGINT,
        COUNT(DISTINCT se.target)::BIGINT,
        ROUND(AVG(se.risk_score::decimal), 1),
        SUM(CASE WHEN se.risk_level = 'CRITICAL' THEN 1 ELSE 0 END)::BIGINT,
        SUM(CASE WHEN se.risk_level = 'HIGH'     THEN 1 ELSE 0 END)::BIGINT,
        SUM(CASE WHEN se.risk_level = 'MEDIUM'   THEN 1 ELSE 0 END)::BIGINT,
        SUM(CASE WHEN se.risk_level = 'LOW'       THEN 1 ELSE 0 END)::BIGINT
    FROM scan_events se
    WHERE se.event_date BETWEEN start_date AND end_date
    GROUP BY se.event_date, se.scan_type, se.platform
    ORDER BY se.event_date DESC, COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- ─── 9. Create new RPC: get_total_scan_counts ──────────────────────────────

CREATE OR REPLACE FUNCTION get_total_scan_counts()
RETURNS TABLE (
    scan_type      TEXT,
    total          BIGINT,
    today          BIGINT,
    this_week      BIGINT,
    this_month     BIGINT,
    last_7_days    BIGINT,
    last_30_days   BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        se.scan_type,
        COUNT(*)::BIGINT,
        SUM(CASE WHEN se.event_date = CURRENT_DATE THEN 1 ELSE 0 END)::BIGINT,
        SUM(CASE WHEN se.event_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END)::BIGINT,
        SUM(CASE WHEN se.event_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 ELSE 0 END)::BIGINT,
        SUM(CASE WHEN se.event_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END)::BIGINT,
        SUM(CASE WHEN se.event_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 ELSE 0 END)::BIGINT
    FROM scan_events se
    GROUP BY se.scan_type
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- ─── 10. Create new RPC: get_scan_growth ────────────────────────────────────

CREATE OR REPLACE FUNCTION get_scan_growth()
RETURNS TABLE (
    scan_type      TEXT,
    this_week      BIGINT,
    last_week      BIGINT,
    growth_pct     NUMERIC,
    this_month     BIGINT,
    last_month     BIGINT,
    month_growth_pct NUMERIC
) AS $$
WITH this_week AS (
    SELECT scan_type, COUNT(*)::BIGINT AS cnt
    FROM scan_events WHERE event_date >= CURRENT_DATE - INTERVAL '7 days' GROUP BY scan_type
),
prev_week AS (
    SELECT scan_type, COUNT(*)::BIGINT AS cnt
    FROM scan_events WHERE event_date BETWEEN CURRENT_DATE - INTERVAL '14 days' AND CURRENT_DATE - INTERVAL '7 days' GROUP BY scan_type
),
this_month AS (
    SELECT scan_type, COUNT(*)::BIGINT AS cnt
    FROM scan_events WHERE event_date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY scan_type
),
prev_month AS (
    SELECT scan_type, COUNT(*)::BIGINT AS cnt
    FROM scan_events WHERE event_date BETWEEN CURRENT_DATE - INTERVAL '60 days' AND CURRENT_DATE - INTERVAL '30 days' GROUP BY scan_type
)
SELECT
    COALESCE(tw.scan_type, pw.scan_type)  AS scan_type,
    COALESCE(tw.cnt, 0)                    AS this_week,
    COALESCE(pw.cnt, 0)                    AS last_week,
    CASE
        WHEN COALESCE(pw.cnt, 0) = 0 THEN NULL
        ELSE ROUND((COALESCE(tw.cnt, 0) - COALESCE(pw.cnt, 0))::NUMERIC / pw.cnt * 100, 1)
    END                                     AS growth_pct,
    COALESCE(tm.cnt, 0)                    AS this_month,
    COALESCE(pm.cnt, 0)                    AS last_month,
    CASE
        WHEN COALESCE(pm.cnt, 0) = 0 THEN NULL
        ELSE ROUND((COALESCE(tm.cnt, 0) - COALESCE(pm.cnt, 0))::NUMERIC / pm.cnt * 100, 1)
    END                                     AS month_growth_pct
FROM this_week tw
FULL OUTER JOIN prev_week pw ON tw.scan_type = pw.scan_type
FULL OUTER JOIN this_month tm ON COALESCE(tw.scan_type, pw.scan_type) = tm.scan_type
FULL OUTER JOIN prev_month pm ON COALESCE(tw.scan_type, pw.scan_type) = pm.scan_type
ORDER BY COALESCE(tw.cnt, 0) DESC;
$$ LANGUAGE sql;

-- ─── 11. Create materialized view ──────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS scan_daily_stats;
CREATE MATERIALIZED VIEW scan_daily_stats AS
SELECT
    event_date                        AS scan_date,
    scan_type,
    platform,
    source,
    COUNT(*)                          AS total_scans,
    COUNT(DISTINCT target)            AS unique_targets,
    ROUND(AVG(risk_score::decimal), 1) AS avg_risk_score,
    SUM(CASE WHEN risk_level = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_count,
    SUM(CASE WHEN risk_level = 'HIGH'     THEN 1 ELSE 0 END) AS high_count,
    SUM(CASE WHEN risk_level = 'MEDIUM'   THEN 1 ELSE 0 END) AS medium_count,
    SUM(CASE WHEN risk_level = 'LOW'       THEN 1 ELSE 0 END) AS low_count
FROM scan_events
GROUP BY event_date, scan_type, platform, source;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_daily_stats_date_type 
    ON scan_daily_stats(scan_date, scan_type, platform, source);

-- ─── 12. Update RLS policies ───────────────────────────────────────────────

-- Ensure scan_events allows inserts from anon (website) and service_role
DROP POLICY IF EXISTS "scan_events_insert" ON scan_events;
CREATE POLICY "scan_events_insert" ON scan_events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "scan_events_service_read" ON scan_events;
CREATE POLICY "scan_events_service_read" ON scan_events FOR SELECT USING (true);

-- Grant permissions
GRANT ALL ON scan_events TO service_role;
GRANT INSERT ON scan_events TO anon;
GRANT SELECT ON scan_events TO anon;
GRANT EXECUTE ON FUNCTION get_daily_scan_stats(DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION get_daily_scan_stats(DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_total_scan_counts() TO service_role;
GRANT EXECUTE ON FUNCTION get_total_scan_counts() TO anon;
GRANT EXECUTE ON FUNCTION get_scan_growth() TO service_role;
GRANT EXECUTE ON FUNCTION get_scan_growth() TO anon;
GRANT ALL ON scan_daily_stats TO service_role;
GRANT SELECT ON scan_daily_stats TO anon;

-- ─── 13. Refresh materialized view ──────────────────────────────────────────

REFRESH MATERIALIZED VIEW CONCURRENTLY scan_daily_stats;

-- ─── Done! Verify with: ────────────────────────────────────────────────────
-- SELECT * FROM get_total_scan_counts();
-- SELECT * FROM get_daily_scan_stats(CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE);
-- SELECT * FROM get_scan_growth();
-- SELECT scan_type, COUNT(*) FROM scan_events GROUP BY scan_type;
-- SELECT platform, COUNT(*) FROM scan_events WHERE platform IS NOT NULL GROUP BY platform;