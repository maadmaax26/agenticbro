-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION: RLS Security Hardening                                  ║
-- ║  Fixes: Supabase Advisor alerts                                      ║
-- ║    - policy_exists_rls_disabled_public_scan_events                   ║
-- ║    - rls_disabled_in_public (any other tables missing RLS)           ║
-- ║  Project: drvasofyghnxfxvkkwad                                       ║
-- ║                                                                      ║
-- ║  Problem: Multiple tables either have RLS disabled entirely, or      ║
-- ║  have RLS enabled but policies use USING (true) / WITH CHECK (true) ║
-- ║  making RLS effectively disabled. Any anon key can read/write all.  ║
-- ║                                                                      ║
-- ║  Fix:                                                                ║
-- ║  1. Enable RLS on all tables missing it (scan_events, phone_scan_   ║
-- ║     results, stats)                                                  ║
-- ║  2. Replace blanket-allow policies with proper role-based ones:     ║
-- ║     - anon: SELECT on read-only tables, SELECT+INSERT on log tables  ║
-- ║     - service_role: full access to all tables                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 0: Enable RLS on tables that are missing it
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- scan_events: created outside migrations, NEVER had RLS enabled — THIS IS THE FLAGGED TABLE
ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;

-- phone_scan_results: created in scan-tracking.sql, no RLS
ALTER TABLE phone_scan_results ENABLE ROW LEVEL SECURITY;

-- stats: referenced but never had explicit RLS in any migration
ALTER TABLE stats ENABLE ROW LEVEL SECURITY;

-- scan_daily_stats materialized view: skip (materialized views don't support RLS,
-- access is controlled by the underlying tables + GRANTs)

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 1: scan_events — THE FLAGGED TABLE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Drop old blanket-allow policies
DROP POLICY IF EXISTS "scan_events_insert" ON scan_events;
DROP POLICY IF EXISTS "scan_events_service_read" ON scan_events;

-- anon: can SELECT (read stats) and INSERT (website/API tracks scans)
CREATE POLICY "scan_events_select" ON scan_events
    FOR SELECT USING (true);

CREATE POLICY "scan_events_insert" ON scan_events
    FOR INSERT WITH CHECK (true);

-- Only service_role can UPDATE or DELETE
CREATE POLICY "scan_events_service_update" ON scan_events
    FOR UPDATE USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "scan_events_service_delete" ON scan_events
    FOR DELETE USING (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 2: scan_results
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP POLICY IF EXISTS "scan_results_public_read" ON scan_results;
DROP POLICY IF EXISTS "scan_results_insert" ON scan_results;

-- anon: SELECT only (read scan results)
CREATE POLICY "scan_results_select" ON scan_results
    FOR SELECT USING (true);

-- service_role only for writes
CREATE POLICY "scan_results_service_insert" ON scan_results
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "scan_results_service_update" ON scan_results
    FOR UPDATE USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "scan_results_service_delete" ON scan_results
    FOR DELETE USING (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 3: known_scammers
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP POLICY IF EXISTS "known_scammers_public_read" ON known_scammers;
DROP POLICY IF EXISTS "known_scammers_service_write" ON known_scammers;

-- anon: SELECT only (read scammer database)
CREATE POLICY "known_scammers_select" ON known_scammers
    FOR SELECT USING (true);

-- service_role only for writes
CREATE POLICY "known_scammers_service_insert" ON known_scammers
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "known_scammers_service_update" ON known_scammers
    FOR UPDATE USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "known_scammers_service_delete" ON known_scammers
    FOR DELETE USING (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 4: scan_jobs
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP POLICY IF EXISTS "Anyone can read scan jobs by id" ON scan_jobs;
DROP POLICY IF EXISTS "Service role full access" ON scan_jobs;

-- anon: SELECT only (frontend polls scan status)
CREATE POLICY "scan_jobs_select" ON scan_jobs
    FOR SELECT USING (true);

-- service_role only for writes
CREATE POLICY "scan_jobs_service_insert" ON scan_jobs
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "scan_jobs_service_update" ON scan_jobs
    FOR UPDATE USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "scan_jobs_service_delete" ON scan_jobs
    FOR DELETE USING (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 5: daily_scan_stats
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP POLICY IF EXISTS "daily_scan_stats_read" ON daily_scan_stats;
DROP POLICY IF EXISTS "daily_scan_stats_insert" ON daily_scan_stats;
DROP POLICY IF EXISTS "daily_scan_stats_update" ON daily_scan_stats;

-- anon: SELECT only (dashboard reads)
CREATE POLICY "daily_scan_stats_select" ON daily_scan_stats
    FOR SELECT USING (true);

-- service_role only for writes
CREATE POLICY "daily_scan_stats_service_insert" ON daily_scan_stats
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "daily_scan_stats_service_update" ON daily_scan_stats
    FOR UPDATE USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "daily_scan_stats_service_delete" ON daily_scan_stats
    FOR DELETE USING (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 6: scan_event_log
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP POLICY IF EXISTS "scan_event_log_read" ON scan_event_log;
DROP POLICY IF EXISTS "scan_event_log_insert" ON scan_event_log;

-- anon: SELECT + INSERT (event logging from website)
CREATE POLICY "scan_event_log_select" ON scan_event_log
    FOR SELECT USING (true);

CREATE POLICY "scan_event_log_insert" ON scan_event_log
    FOR INSERT WITH CHECK (true);

-- service_role only for UPDATE/DELETE
CREATE POLICY "scan_event_log_service_update" ON scan_event_log
    FOR UPDATE USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "scan_event_log_service_delete" ON scan_event_log
    FOR DELETE USING (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 7: phone_scan_results — NO RLS EXISTED
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- anon: SELECT only (read phone scan results)
CREATE POLICY "phone_scan_results_select" ON phone_scan_results
    FOR SELECT USING (true);

-- service_role only for writes
CREATE POLICY "phone_scan_results_service_insert" ON phone_scan_results
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "phone_scan_results_service_update" ON phone_scan_results
    FOR UPDATE USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "phone_scan_results_service_delete" ON phone_scan_results
    FOR DELETE USING (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 8: stats — NO RLS EXISTED
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- anon: SELECT only (dashboard counter)
CREATE POLICY "stats_select" ON stats
    FOR SELECT USING (true);

-- service_role only for writes (increment_scan_count RPC uses service_role)
CREATE POLICY "stats_service_insert" ON stats
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "stats_service_update" ON stats
    FOR UPDATE USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "stats_service_delete" ON stats
    FOR DELETE USING (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 9: Revoke overly-broad grants from anon role
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- The old migration granted ALL on some tables to anon — restrict to SELECT only
REVOKE ALL ON scan_results FROM anon;
GRANT SELECT ON scan_results TO anon;

REVOKE ALL ON known_scammers FROM anon;
GRANT SELECT ON known_scammers TO anon;

REVOKE ALL ON scan_jobs FROM anon;
GRANT SELECT ON scan_jobs TO anon;

REVOKE ALL ON daily_scan_stats FROM anon;
GRANT SELECT ON daily_scan_stats TO anon;

REVOKE ALL ON stats FROM anon;
GRANT SELECT ON stats TO anon;

-- Keep INSERT on scan_events and scan_event_log (website logs scans)
REVOKE ALL ON scan_events FROM anon;
GRANT SELECT, INSERT ON scan_events TO anon;

REVOKE ALL ON scan_event_log FROM anon;
GRANT SELECT, INSERT ON scan_event_log TO anon;

REVOKE ALL ON phone_scan_results FROM anon;
GRANT SELECT ON phone_scan_results TO anon;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VERIFY: Run these in the SQL Editor after applying
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Check RLS is enabled on all tables:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('scan_events', 'scan_results', 'known_scammers', 'scan_jobs',
--   'daily_scan_stats', 'scan_event_log', 'phone_scan_results', 'stats');

-- Check all policies:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Verify anon can't INSERT into protected tables:
-- SET ROLE anon;
-- INSERT INTO scan_results (username, platform, risk_score, risk_level, red_flags)
--   VALUES ('test', 'X', 5, 'MEDIUM', '{}');  -- should FAIL
-- RESET ROLE;