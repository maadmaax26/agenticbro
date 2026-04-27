-- Create scan_results table for tracking profile scans
CREATE TABLE IF NOT EXISTS scan_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  platform TEXT NOT NULL,
  risk_score NUMERIC(3,1) NOT NULL,
  risk_level TEXT NOT NULL,
  red_flags TEXT[] DEFAULT '{}',
  wallet_address TEXT,
  data_source TEXT DEFAULT 'website',
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create phone_scan_results table for tracking phone scans
CREATE TABLE IF NOT EXISTS phone_scan_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  risk_score NUMERIC(3,1) NOT NULL,
  risk_level TEXT NOT NULL,
  red_flags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'website',
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_scan_results_scanned_at ON scan_results(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_results_platform ON scan_results(platform);
CREATE INDEX IF NOT EXISTS idx_phone_scan_results_scanned_at ON phone_scan_results(scanned_at DESC);

-- RPC function to increment scan count
CREATE OR REPLACE FUNCTION increment_scan_count()
RETURNS void AS $$
BEGIN
  UPDATE stats SET 
    total_scans = total_scans + 1,
    last_updated = NOW()
  WHERE id = (SELECT id FROM stats LIMIT 1);
  
  -- If no stats row exists, create one
  IF NOT FOUND THEN
    INSERT INTO stats (total_scans, last_updated) VALUES (1, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;

-- RPC function to increment phone scan count
CREATE OR REPLACE FUNCTION increment_phone_scan_count()
RETURNS void AS $$
BEGIN
  UPDATE stats SET 
    total_scans = total_scans + 1,
    last_updated = NOW()
  WHERE id = (SELECT id FROM stats LIMIT 1);
  
  -- If no stats row exists, create one
  IF NOT FOUND THEN
    INSERT INTO stats (total_scans, last_updated) VALUES (1, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;

-- RPC function to get scan counts by date range
CREATE OR REPLACE FUNCTION get_scan_counts_by_date(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  scan_date DATE,
  total_scans BIGINT,
  profile_scans BIGINT,
  phone_scans BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d::DATE AS scan_date,
    COALESCE(ps.profile_count, 0) + COALESCE(phs.phone_count, 0) AS total_scans,
    COALESCE(ps.profile_count, 0) AS profile_scans,
    COALESCE(phs.phone_count, 0) AS phone_scans
  FROM generate_series(start_date::DATE, end_date::DATE, '1 day'::INTERVAL) AS d
  LEFT JOIN (
    SELECT scanned_at::DATE AS scan_date, COUNT(*) AS profile_count
    FROM scan_results
    WHERE scanned_at >= start_date AND scanned_at <= end_date
    GROUP BY scanned_at::DATE
  ) ps ON ps.scan_date = d::DATE
  LEFT JOIN (
    SELECT scanned_at::DATE AS scan_date, COUNT(*) AS phone_count
    FROM phone_scan_results
    WHERE scanned_at >= start_date AND scanned_at <= end_date
    GROUP BY scanned_at::DATE
  ) phs ON phs.scan_date = d::DATE
  ORDER BY scan_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON scan_results TO service_role;
GRANT ALL ON phone_scan_results TO service_role;
GRANT EXECUTE ON FUNCTION increment_scan_count() TO service_role;
GRANT EXECUTE ON FUNCTION increment_phone_scan_count() TO service_role;
GRANT EXECUTE ON FUNCTION get_scan_counts_by_date(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;