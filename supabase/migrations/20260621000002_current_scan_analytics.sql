CREATE TABLE IF NOT EXISTS public.phone_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  risk_score NUMERIC(3,1) NOT NULL,
  risk_level TEXT NOT NULL,
  red_flags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'website',
  scan_type TEXT NOT NULL DEFAULT 'phone',
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_scan_results_scanned_at ON public.phone_scan_results(scanned_at DESC);
ALTER TABLE public.phone_scan_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phone_scan_results_select" ON public.phone_scan_results;
CREATE POLICY "phone_scan_results_select" ON public.phone_scan_results FOR SELECT USING (true);
DROP POLICY IF EXISTS "phone_scan_results_service_insert" ON public.phone_scan_results;
CREATE POLICY "phone_scan_results_service_insert" ON public.phone_scan_results FOR INSERT WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "phone_scan_results_service_update" ON public.phone_scan_results;
CREATE POLICY "phone_scan_results_service_update" ON public.phone_scan_results FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "phone_scan_results_service_delete" ON public.phone_scan_results;
CREATE POLICY "phone_scan_results_service_delete" ON public.phone_scan_results FOR DELETE USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.increment_phone_scan_count()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE stats SET total_scans = total_scans + 1, last_updated = now()
  WHERE id = (SELECT id FROM stats LIMIT 1);
  IF NOT FOUND THEN INSERT INTO stats(total_scans, last_updated) VALUES (1, now()); END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_scan_trends(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  stat_date DATE, total_scans BIGINT, social_scans BIGINT, phone_scans BIGINT,
  website_scans BIGINT, token_scans BIGINT, wallet_scans BIGINT, x_cdp_scans BIGINT,
  high_risk_total BIGINT, critical_total BIGINT
) LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT event_date,
    count(*)::BIGINT,
    count(*) FILTER (WHERE scan_type = 'social')::BIGINT,
    count(*) FILTER (WHERE scan_type = 'phone')::BIGINT,
    count(*) FILTER (WHERE scan_type = 'website')::BIGINT,
    count(*) FILTER (WHERE scan_type = 'token')::BIGINT,
    count(*) FILTER (WHERE scan_type = 'wallet')::BIGINT,
    count(*) FILTER (WHERE scan_type = 'x_cdp')::BIGINT,
    count(*) FILTER (WHERE upper(coalesce(risk_level, '')) IN ('HIGH','HIGH RISK','CRITICAL'))::BIGINT,
    count(*) FILTER (WHERE upper(coalesce(risk_level, '')) = 'CRITICAL')::BIGINT
  FROM scan_events
  WHERE event_date >= current_date - greatest(least(p_days, 365), 1)
  GROUP BY event_date ORDER BY event_date;
$$;

CREATE OR REPLACE FUNCTION public.get_scan_analytics(p_days INTEGER DEFAULT 30, p_scan_type TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE SET search_path = public AS $$
  WITH filtered AS (
    SELECT * FROM scan_events
    WHERE event_date >= current_date - greatest(least(p_days, 365), 1)
      AND (p_scan_type IS NULL OR scan_type = p_scan_type)
  ), type_rows AS (
    SELECT coalesce(scan_type, 'unknown') AS scan_type, jsonb_build_object('count', count(*), 'high_risk', count(*) FILTER (WHERE upper(coalesce(risk_level,'')) IN ('HIGH','HIGH RISK','CRITICAL')), 'critical', count(*) FILTER (WHERE upper(coalesce(risk_level,''))='CRITICAL'), 'avg_risk', round(coalesce(avg(risk_score),0),2)) value
    FROM filtered GROUP BY coalesce(scan_type, 'unknown')
  ), platform_rows AS (
    SELECT coalesce(platform, 'unknown') AS platform, jsonb_build_object('count', count(*), 'high_risk', count(*) FILTER (WHERE upper(coalesce(risk_level,'')) IN ('HIGH','HIGH RISK','CRITICAL')), 'critical', count(*) FILTER (WHERE upper(coalesce(risk_level,''))='CRITICAL'), 'avg_risk', round(coalesce(avg(risk_score),0),2)) value
    FROM filtered GROUP BY coalesce(platform, 'unknown')
  ), daily_rows AS (
    SELECT event_date, jsonb_build_object('date', event_date, 'scan_type', scan_type, 'platform', platform, 'count', count(*), 'high_risk', count(*) FILTER (WHERE upper(coalesce(risk_level,'')) IN ('HIGH','HIGH RISK','CRITICAL')), 'critical', count(*) FILTER (WHERE upper(coalesce(risk_level,''))='CRITICAL'), 'avg_risk', round(coalesce(avg(risk_score),0),2)) value
    FROM filtered GROUP BY event_date, scan_type, platform
  )
  SELECT jsonb_build_object(
    'total_scans', (SELECT count(*) FROM filtered),
    'total_high_risk', (SELECT count(*) FROM filtered WHERE upper(coalesce(risk_level,'')) IN ('HIGH','HIGH RISK','CRITICAL')),
    'total_critical', (SELECT count(*) FROM filtered WHERE upper(coalesce(risk_level,''))='CRITICAL'),
    'avg_risk_score', (SELECT round(coalesce(avg(risk_score),0),2) FROM filtered),
    'unique_days', (SELECT count(DISTINCT event_date) FROM filtered),
    'by_type', coalesce((SELECT jsonb_object_agg(scan_type,value) FROM type_rows),'{}'::jsonb),
    'by_platform', coalesce((SELECT jsonb_object_agg(platform,value) FROM platform_rows),'{}'::jsonb),
    'daily', coalesce((SELECT jsonb_agg(value ORDER BY event_date) FROM daily_rows),'[]'::jsonb),
    'growth', jsonb_build_object(
      'today', (SELECT count(*) FROM filtered WHERE event_date=current_date),
      'yesterday', (SELECT count(*) FROM filtered WHERE event_date=current_date-1),
      'last_7d', (SELECT count(*) FROM filtered WHERE event_date>=current_date-7),
      'last_30d', (SELECT count(*) FROM filtered)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.increment_phone_scan_count() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_scan_trends(INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_scan_analytics(INTEGER, TEXT) TO anon, authenticated, service_role;
