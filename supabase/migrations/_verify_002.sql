-- Verification queries for migration 002_scan_events_analytics.sql
-- Run this in Supabase SQL Editor to confirm everything was created.

-- 1. Table exists with expected columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'scan_events'
ORDER BY ordinal_position;

-- 2. Indexes on scan_events
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'scan_events'
ORDER BY indexname;

-- 3. Materialized view exists
SELECT matviewname FROM pg_matviews
WHERE schemaname = 'public' AND matviewname = 'scan_daily_stats';

-- 4. The 3 RPC functions exist
SELECT proname
FROM pg_proc
WHERE proname IN ('get_daily_scan_stats', 'get_total_scan_counts', 'get_scan_growth')
ORDER BY proname;

-- 5. Row count (should reflect any backfilled rows from scan_results / phone_scan_results / scan_jobs)
SELECT COUNT(*) AS scan_events_count FROM scan_events;

-- 6. Quick functional smoke test of one RPC
SELECT * FROM get_total_scan_counts();
