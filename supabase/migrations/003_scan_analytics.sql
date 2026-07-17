-- ============================================================
-- Scan Analytics Tracking - Migration 003
-- Adds: scan_type breakdown, daily aggregates, stats API
-- Run in Supabase SQL Editor
-- ============================================================

-- ─── 1. Add scan_type to scan_results (if not exists) ────────────────────────
-- Tracks which type of scan was performed: social, phone, website, token, wallet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_results' AND column_name = 'scan_type'
  ) THEN
    ALTER TABLE scan_results ADD COLUMN scan_type TEXT DEFAULT 'social'
      CHECK (scan_type IN ('social', 'phone', 'website', 'token', 'wallet', 'x_cdp'));
  END IF;
END $$;

-- ─── 2. Add source column to phone_scan_results (if not exists) ────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phone_scan_results' AND column_name = 'scan_type'
  ) THEN
    ALTER TABLE phone_scan_results ADD COLUMN scan_type TEXT DEFAULT 'phone';
  END IF;
END $$;

-- ─── 3. Create daily_scan_stats materialized view ────────────────────────────
-- Pre-aggregated daily stats for fast dashboard queries
DROP TABLE IF EXISTS daily_scan_stats;
CREATE TABLE daily_scan_stats (
    id              BIGSERIAL PRIMARY KEY,
    stat_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    scan_type       TEXT NOT NULL DEFAULT 'social',
    platform        TEXT NOT NULL DEFAULT 'unknown',
    scan_count      INTEGER NOT NULL DEFAULT 0,
    avg_risk_score  NUMERIC(4,2) DEFAULT 0,
    high_risk_count  INTEGER NOT NULL DEFAULT 0,
    critical_count   INTEGER NOT NULL DEFAULT 0,
    unique_users     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(stat_date, scan_type, platform)
);

CREATE INDEX IF NOT EXISTS idx_daily_scan_stats_date ON daily_scan_stats(stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_scan_stats_type ON daily_scan_stats(scan_type);
CREATE INDEX IF NOT EXISTS idx_daily_scan_stats_platform ON daily_scan_stats(platform);

-- ─── 4. Hourly scan log for real-time tracking ──────────────────────────────
DROP TABLE IF EXISTS scan_event_log;
CREATE TABLE scan_event_log (
    id              BIGSERIAL PRIMARY KEY,
    event_type      TEXT NOT NULL CHECK (event_type IN ('social', 'phone', 'website', 'token', 'wallet', 'x_cdp')),
    platform        TEXT NOT NULL DEFAULT 'unknown',
    username        TEXT,
    risk_score      NUMERIC(3,1),
    risk_level      TEXT,
    source          TEXT DEFAULT 'website',  -- website, telegram_bot, api, manual
    scanned_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_event_log_time ON scan_event_log(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_event_log_type ON scan_event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_scan_event_log_platform ON scan_event_log(platform);
CREATE INDEX IF NOT EXISTS idx_scan_event_log_source ON scan_event_log(source);

-- ─── 5. RPC: record_scan_event ──────────────────────────────────────────────
-- Single function to log any scan type with proper categorization
CREATE OR REPLACE FUNCTION record_scan_event(
  p_event_type TEXT,
  p_platform TEXT,
  p_username TEXT DEFAULT NULL,
  p_risk_score NUMERIC DEFAULT NULL,
  p_risk_level TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'website'
)
RETURNS JSONB AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_stats_id BIGINT;
BEGIN
  -- Insert event log
  INSERT INTO scan_event_log (event_type, platform, username, risk_score, risk_level, source)
  VALUES (p_event_type, p_platform, p_username, p_risk_score, p_risk_level, p_source);

  -- Upsert daily stats
  INSERT INTO daily_scan_stats (stat_date, scan_type, platform, scan_count, avg_risk_score, high_risk_count, critical_count, unique_users)
  VALUES (
    v_today,
    p_event_type,
    p_platform,
    1,
    COALESCE(p_risk_score, 0),
    CASE WHEN p_risk_level IN ('HIGH', 'HIGH RISK', 'CRITICAL') THEN 1 ELSE 0 END,
    CASE WHEN p_risk_level = 'CRITICAL' THEN 1 ELSE 0 END,
    1
  )
  ON CONFLICT (stat_date, scan_type, platform)
  DO UPDATE SET
    scan_count = daily_scan_stats.scan_count + 1,
    avg_risk_score = (daily_scan_stats.avg_risk_score * daily_scan_stats.scan_count + COALESCE(p_risk_score, 0)) / (daily_scan_stats.scan_count + 1),
    high_risk_count = daily_scan_stats.high_risk_count + CASE WHEN p_risk_level IN ('HIGH', 'HIGH RISK', 'CRITICAL') THEN 1 ELSE 0 END,
    critical_count = daily_scan_stats.critical_count + CASE WHEN p_risk_level = 'CRITICAL' THEN 1 ELSE 0 END,
    unique_users = daily_scan_stats.unique_users + 1, -- approximate, exact would need subquery
    updated_at = NOW();

  -- Also update global stats counter
  UPDATE stats SET
    total_scans = total_scans + 1,
    last_updated = NOW()
  WHERE id = (SELECT id FROM stats LIMIT 1);

  IF NOT FOUND THEN
    INSERT INTO stats (total_scans, last_updated) VALUES (1, NOW());
  END IF;

  RETURN jsonb_build_object(
    'recorded', true,
    'event_type', p_event_type,
    'platform', p_platform,
    'date', v_today
  );
END;
$$ LANGUAGE plpgsql;

-- ─── 6. RPC: get_scan_analytics ──────────────────────────────────────────────
-- Dashboard API: returns scan counts broken down by type, platform, and date
CREATE OR REPLACE FUNCTION get_scan_analytics(
  p_days INTEGER DEFAULT 30,
  p_scan_type TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_start_date DATE := CURRENT_DATE - p_days;
BEGIN
  -- Summary totals
  SELECT jsonb_build_object(
    'total_scans', COALESCE(SUM(scan_count), 0),
    'total_high_risk', COALESCE(SUM(high_risk_count), 0),
    'total_critical', COALESCE(SUM(critical_count), 0),
    'avg_risk_score', ROUND(COALESCE(AVG(avg_risk_score), 0), 2),
    'unique_days', COUNT(DISTINCT stat_date),
    'by_type', (
      SELECT jsonb_object_agg(scan_type, type_obj)
      FROM (
        SELECT scan_type, jsonb_build_object(
          'count', SUM(scan_count),
          'high_risk', SUM(high_risk_count),
          'critical', SUM(critical_count),
          'avg_risk', ROUND(AVG(avg_risk_score), 2)
        ) AS type_obj
        FROM daily_scan_stats
        WHERE stat_date >= v_start_date AND (p_scan_type IS NULL OR scan_type = p_scan_type)
        GROUP BY scan_type
      ) s
    ),
    'by_platform', (
      SELECT jsonb_object_agg(platform, platform_obj)
      FROM (
        SELECT platform, jsonb_build_object(
          'count', SUM(scan_count),
          'high_risk', SUM(high_risk_count),
          'critical', SUM(critical_count),
          'avg_risk', ROUND(AVG(avg_risk_score), 2)
        ) AS platform_obj
        FROM daily_scan_stats
        WHERE stat_date >= v_start_date AND (p_scan_type IS NULL OR scan_type = p_scan_type)
        GROUP BY platform
      ) p
    ),
    'daily', (
      SELECT jsonb_agg(daily_row ORDER BY stat_date ASC)
      FROM (
        SELECT jsonb_build_object(
          'date', stat_date,
          'scan_type', scan_type,
          'platform', platform,
          'count', scan_count,
          'high_risk', high_risk_count,
          'critical', critical_count,
          'avg_risk', ROUND(avg_risk_score, 2)
        ) AS daily_row, stat_date
        FROM daily_scan_stats
        WHERE stat_date >= v_start_date AND (p_scan_type IS NULL OR scan_type = p_scan_type)
      ) d
    ),
    'growth', (
      SELECT jsonb_build_object(
        'today', COALESCE(SUM(CASE WHEN stat_date = CURRENT_DATE THEN scan_count ELSE 0 END), 0),
        'yesterday', COALESCE(SUM(CASE WHEN stat_date = CURRENT_DATE - 1 THEN scan_count ELSE 0 END), 0),
        'last_7d', COALESCE(SUM(CASE WHEN stat_date >= CURRENT_DATE - 7 THEN scan_count ELSE 0 END), 0),
        'last_30d', COALESCE(SUM(scan_count), 0),
        'this_week_vs_last_week', CASE
          WHEN COALESCE(SUM(CASE WHEN stat_date >= CURRENT_DATE - 13 AND stat_date < CURRENT_DATE - 6 THEN scan_count ELSE 0 END), 0) > 0
          THEN ROUND(
            (COALESCE(SUM(CASE WHEN stat_date >= CURRENT_DATE - 6 THEN scan_count ELSE 0 END), 0)::NUMERIC -
             COALESCE(SUM(CASE WHEN stat_date >= CURRENT_DATE - 13 AND stat_date < CURRENT_DATE - 6 THEN scan_count ELSE 0 END), 0)::NUMERIC) /
            COALESCE(SUM(CASE WHEN stat_date >= CURRENT_DATE - 13 AND stat_date < CURRENT_DATE - 6 THEN scan_count ELSE 0 END), 0)::NUMERIC * 100
          , 1)
          ELSE NULL
        END
      )
      FROM daily_scan_stats
      WHERE stat_date >= v_start_date AND (p_scan_type IS NULL OR scan_type = p_scan_type)
    )
  ) INTO v_result
  FROM daily_scan_stats
  WHERE stat_date >= v_start_date AND (p_scan_type IS NULL OR scan_type = p_scan_type);

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- ─── 7. RPC: get_scan_trends ──────────────────────────────────────────────────
-- Returns day-by-day trend data for charting
CREATE OR REPLACE FUNCTION get_scan_trends(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  stat_date DATE,
  total_scans BIGINT,
  social_scans BIGINT,
  phone_scans BIGINT,
  website_scans BIGINT,
  token_scans BIGINT,
  wallet_scans BIGINT,
  x_cdp_scans BIGINT,
  high_risk_total BIGINT,
  critical_total BIGINT
) AS $$
DECLARE
  v_start DATE := CURRENT_DATE - p_days;
BEGIN
  RETURN QUERY
  SELECT
    d.stat_date,
    COALESCE(SUM(d.scan_count), 0)::BIGINT AS total_scans,
    COALESCE(SUM(CASE WHEN d.scan_type = 'social' THEN d.scan_count ELSE 0 END), 0)::BIGINT AS social_scans,
    COALESCE(SUM(CASE WHEN d.scan_type = 'phone' THEN d.scan_count ELSE 0 END), 0)::BIGINT AS phone_scans,
    COALESCE(SUM(CASE WHEN d.scan_type = 'website' THEN d.scan_count ELSE 0 END), 0)::BIGINT AS website_scans,
    COALESCE(SUM(CASE WHEN d.scan_type = 'token' THEN d.scan_count ELSE 0 END), 0)::BIGINT AS token_scans,
    COALESCE(SUM(CASE WHEN d.scan_type = 'wallet' THEN d.scan_count ELSE 0 END), 0)::BIGINT AS wallet_scans,
    COALESCE(SUM(CASE WHEN d.scan_type = 'x_cdp' THEN d.scan_count ELSE 0 END), 0)::BIGINT AS x_cdp_scans,
    COALESCE(SUM(d.high_risk_count), 0)::BIGINT AS high_risk_total,
    COALESCE(SUM(d.critical_count), 0)::BIGINT AS critical_total
  FROM daily_scan_stats d
  WHERE d.stat_date >= v_start
  GROUP BY d.stat_date
  ORDER BY d.stat_date ASC;
END;
$$ LANGUAGE plpgsql;

-- ─── 8. Permissions ─────────────────────────────────────────────────────────
ALTER TABLE daily_scan_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_scan_stats_read" ON daily_scan_stats;
CREATE POLICY "daily_scan_stats_read" ON daily_scan_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "daily_scan_stats_insert" ON daily_scan_stats;
CREATE POLICY "daily_scan_stats_insert" ON daily_scan_stats FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "daily_scan_stats_update" ON daily_scan_stats;
CREATE POLICY "daily_scan_stats_update" ON daily_scan_stats FOR UPDATE USING (true);

ALTER TABLE scan_event_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scan_event_log_read" ON scan_event_log;
CREATE POLICY "scan_event_log_read" ON scan_event_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "scan_event_log_insert" ON scan_event_log;
CREATE POLICY "scan_event_log_insert" ON scan_event_log FOR INSERT WITH CHECK (true);

GRANT ALL ON daily_scan_stats TO service_role;
GRANT ALL ON scan_event_log TO service_role;
GRANT ALL ON daily_scan_stats TO anon;
GRANT ALL ON scan_event_log TO anon;
GRANT EXECUTE ON FUNCTION record_scan_event(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION record_scan_event(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_scan_analytics(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_scan_analytics(INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_scan_trends(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_scan_trends(INTEGER) TO anon;