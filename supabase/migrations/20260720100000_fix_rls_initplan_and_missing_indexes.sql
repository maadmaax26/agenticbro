-- ============================================================
-- Performance: fix auth_rls_initplan + add missing indexes
--
-- Problem 1 (auth_rls_initplan — 80 advisor hits):
--   auth.uid() and auth.role() are function calls. When used
--   bare in RLS quals/checks, Postgres re-evaluates them for
--   every row in the table (O(n) cost). Wrapping in
--   (select auth.uid()) pins evaluation to a one-time init
--   plan — O(1) per query.
--
-- Problem 2: sla_status has no index on `timestamp`.
--   The periodic cleanup DELETE (WHERE timestamp < $1) was
--   seq-scanning ~1009 rows × 44 calls.
--
-- Problem 3: scan_jobs partial index only covers status='pending'.
--   Queries filtering other statuses (claimed, running, completed)
--   fall back to seq scan.
--
-- Also drops unused indexes on empty tables (scan_events,
-- scan_results, legitimate_accounts) to reduce write overhead.
-- ============================================================

-- ── brand_guard_account_assignments ─────────────────────────
DROP POLICY IF EXISTS "Owners read account assignment" ON public.brand_guard_account_assignments;
CREATE POLICY "Owners read account assignment"
  ON public.brand_guard_account_assignments FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_account_case_events ─────────────────────────
DROP POLICY IF EXISTS "Owners read case events" ON public.brand_guard_account_case_events;
CREATE POLICY "Owners read case events"
  ON public.brand_guard_account_case_events FOR SELECT
  USING (case_id IN (
    SELECT id FROM brand_guard_account_cases
    WHERE owner_id = (select auth.uid())
  ));

-- ── brand_guard_account_cases ────────────────────────────────
DROP POLICY IF EXISTS "Owners manage account cases" ON public.brand_guard_account_cases;
CREATE POLICY "Owners manage account cases"
  ON public.brand_guard_account_cases FOR ALL
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

-- ── brand_guard_account_managers ─────────────────────────────
DROP POLICY IF EXISTS "Owners read assigned manager" ON public.brand_guard_account_managers;
CREATE POLICY "Owners read assigned manager"
  ON public.brand_guard_account_managers FOR SELECT
  USING (id IN (
    SELECT manager_id FROM brand_guard_account_assignments
    WHERE owner_id = (select auth.uid())
  ));

-- ── brand_guard_alerts ───────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own alerts" ON public.brand_guard_alerts;
CREATE POLICY "Users can update own alerts"
  ON public.brand_guard_alerts FOR UPDATE
  USING (brand_monitor_id IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can view own alerts" ON public.brand_guard_alerts;
CREATE POLICY "Users can view own alerts"
  ON public.brand_guard_alerts FOR SELECT
  USING (brand_monitor_id IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

-- ── brand_guard_api_keys ─────────────────────────────────────
DROP POLICY IF EXISTS "Owners create API keys" ON public.brand_guard_api_keys;
CREATE POLICY "Owners create API keys"
  ON public.brand_guard_api_keys FOR INSERT
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Owners read API keys" ON public.brand_guard_api_keys;
CREATE POLICY "Owners read API keys"
  ON public.brand_guard_api_keys FOR SELECT
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Owners update API keys" ON public.brand_guard_api_keys;
CREATE POLICY "Owners update API keys"
  ON public.brand_guard_api_keys FOR UPDATE
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_api_usage_logs ───────────────────────────────
DROP POLICY IF EXISTS "Owners read API usage" ON public.brand_guard_api_usage_logs;
CREATE POLICY "Owners read API usage"
  ON public.brand_guard_api_usage_logs FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_credit_transactions ──────────────────────────
DROP POLICY IF EXISTS "Users can view own transactions" ON public.brand_guard_credit_transactions;
CREATE POLICY "Users can view own transactions"
  ON public.brand_guard_credit_transactions FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_credits ──────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own credits" ON public.brand_guard_credits;
CREATE POLICY "Users can insert own credits"
  ON public.brand_guard_credits FOR INSERT
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can view own credits" ON public.brand_guard_credits;
CREATE POLICY "Users can view own credits"
  ON public.brand_guard_credits FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_delivery_attempts ───────────────────────────
DROP POLICY IF EXISTS "Owners read delivery attempts" ON public.brand_guard_delivery_attempts;
CREATE POLICY "Owners read delivery attempts"
  ON public.brand_guard_delivery_attempts FOR SELECT
  USING (job_id IN (
    SELECT id FROM brand_guard_delivery_jobs WHERE owner_id = (select auth.uid())
  ));

-- ── brand_guard_delivery_dead_letters ───────────────────────
DROP POLICY IF EXISTS "Owners read dead letters" ON public.brand_guard_delivery_dead_letters;
CREATE POLICY "Owners read dead letters"
  ON public.brand_guard_delivery_dead_letters FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_delivery_endpoints ──────────────────────────
DROP POLICY IF EXISTS "Owners manage delivery endpoints" ON public.brand_guard_delivery_endpoints;
CREATE POLICY "Owners manage delivery endpoints"
  ON public.brand_guard_delivery_endpoints FOR ALL
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

-- ── brand_guard_delivery_jobs ───────────────────────────────
DROP POLICY IF EXISTS "Owners read delivery jobs" ON public.brand_guard_delivery_jobs;
CREATE POLICY "Owners read delivery jobs"
  ON public.brand_guard_delivery_jobs FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_detected_threats ────────────────────────────
DROP POLICY IF EXISTS "Owners read threats" ON public.brand_guard_detected_threats;
CREATE POLICY "Owners read threats"
  ON public.brand_guard_detected_threats FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_dmarc_reports ────────────────────────────────
DROP POLICY IF EXISTS "Owners read DMARC reports" ON public.brand_guard_dmarc_reports;
CREATE POLICY "Owners read DMARC reports"
  ON public.brand_guard_dmarc_reports FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_dmarc_sources ────────────────────────────────
DROP POLICY IF EXISTS "Owners read DMARC sources" ON public.brand_guard_dmarc_sources;
CREATE POLICY "Owners read DMARC sources"
  ON public.brand_guard_dmarc_sources FOR SELECT
  USING (brand_monitor_id IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

-- ── brand_guard_dns_observations ─────────────────────────────
DROP POLICY IF EXISTS "Owners read DNS observations" ON public.brand_guard_dns_observations;
CREATE POLICY "Owners read DNS observations"
  ON public.brand_guard_dns_observations FOR SELECT
  USING (brand_monitor_id IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

-- ── brand_guard_enterprise_reports ───────────────────────────
DROP POLICY IF EXISTS "Owners read enterprise reports" ON public.brand_guard_enterprise_reports;
CREATE POLICY "Owners read enterprise reports"
  ON public.brand_guard_enterprise_reports FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_pilot_requests ───────────────────────────────
DROP POLICY IF EXISTS "Users can view own Brand Guard pilot requests" ON public.brand_guard_pilot_requests;
CREATE POLICY "Users can view own Brand Guard pilot requests"
  ON public.brand_guard_pilot_requests FOR SELECT
  USING (
    (select auth.uid()) = owner_id
    OR lower(email) = lower((select auth.jwt()) ->> 'email')
  );

-- ── brand_guard_pilots ───────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own Brand Guard pilot" ON public.brand_guard_pilots;
CREATE POLICY "Users can view own Brand Guard pilot"
  ON public.brand_guard_pilots FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_reports ──────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage their own reports" ON public.brand_guard_reports;
CREATE POLICY "Users can manage their own reports"
  ON public.brand_guard_reports FOR ALL
  USING ((select auth.uid()) = user_id);

-- ── brand_guard_scan_queue ───────────────────────────────────
DROP POLICY IF EXISTS "Owners read scan queue" ON public.brand_guard_scan_queue;
CREATE POLICY "Owners read scan queue"
  ON public.brand_guard_scan_queue FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_scans ────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own scans" ON public.brand_guard_scans;
CREATE POLICY "Users can view own scans"
  ON public.brand_guard_scans FOR SELECT
  USING (brand_monitor_id IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

-- ── brand_guard_sla_policies ─────────────────────────────────
DROP POLICY IF EXISTS "Owners read SLA" ON public.brand_guard_sla_policies;
CREATE POLICY "Owners read SLA"
  ON public.brand_guard_sla_policies FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_subscriptions ────────────────────────────────
DROP POLICY IF EXISTS "Users can view own subscription" ON public.brand_guard_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.brand_guard_subscriptions FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_guard_takedown_logs ────────────────────────────────
DROP POLICY IF EXISTS "Owners read takedown logs" ON public.brand_guard_takedown_logs;
CREATE POLICY "Owners read takedown logs"
  ON public.brand_guard_takedown_logs FOR SELECT
  USING (threat_id IN (
    SELECT id FROM brand_guard_detected_threats WHERE owner_id = (select auth.uid())
  ));

-- ── brand_guard_threat_intel_jobs ────────────────────────────
DROP POLICY IF EXISTS "Owners read intel jobs" ON public.brand_guard_threat_intel_jobs;
CREATE POLICY "Owners read intel jobs"
  ON public.brand_guard_threat_intel_jobs FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── brand_impersonators ──────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own impersonators" ON public.brand_impersonators;
CREATE POLICY "Users can view own impersonators"
  ON public.brand_impersonators FOR SELECT
  USING (brand_monitor_id IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

-- ── brand_monitors ───────────────────────────────────────────
DROP POLICY IF EXISTS "Users can delete own brands" ON public.brand_monitors;
CREATE POLICY "Users can delete own brands"
  ON public.brand_monitors FOR DELETE
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can insert own brands" ON public.brand_monitors;
CREATE POLICY "Users can insert own brands"
  ON public.brand_monitors FOR INSERT
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can update own brands" ON public.brand_monitors;
CREATE POLICY "Users can update own brands"
  ON public.brand_monitors FOR UPDATE
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can view own brands" ON public.brand_monitors;
CREATE POLICY "Users can view own brands"
  ON public.brand_monitors FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── dashboard_preferences ────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can update own preferences"
  ON public.dashboard_preferences FOR UPDATE
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can view own preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can view own preferences"
  ON public.dashboard_preferences FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── domain_monitors ──────────────────────────────────────────
DROP POLICY IF EXISTS "Users can delete own domains" ON public.domain_monitors;
CREATE POLICY "Users can delete own domains"
  ON public.domain_monitors FOR DELETE
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can insert own domains" ON public.domain_monitors;
CREATE POLICY "Users can insert own domains"
  ON public.domain_monitors FOR INSERT
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can update own domains" ON public.domain_monitors;
CREATE POLICY "Users can update own domains"
  ON public.domain_monitors FOR UPDATE
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can view own domains" ON public.domain_monitors;
CREATE POLICY "Users can view own domains"
  ON public.domain_monitors FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── scan_credit_accounts ─────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own scan credit account" ON public.scan_credit_accounts;
CREATE POLICY "Users can view own scan credit account"
  ON public.scan_credit_accounts FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── scan_credit_transactions ─────────────────────────────────
DROP POLICY IF EXISTS "Users can view own scan credit transactions" ON public.scan_credit_transactions;
CREATE POLICY "Users can view own scan credit transactions"
  ON public.scan_credit_transactions FOR SELECT
  USING ((select auth.uid()) = owner_id);

-- ── takedown_actions ─────────────────────────────────────────
DROP POLICY IF EXISTS "takedown_actions_delete" ON public.takedown_actions;
CREATE POLICY "takedown_actions_delete"
  ON public.takedown_actions FOR DELETE
  USING ((brand_monitor_id)::uuid IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "takedown_actions_insert" ON public.takedown_actions;
CREATE POLICY "takedown_actions_insert"
  ON public.takedown_actions FOR INSERT
  WITH CHECK ((brand_monitor_id)::uuid IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "takedown_actions_select" ON public.takedown_actions;
CREATE POLICY "takedown_actions_select"
  ON public.takedown_actions FOR SELECT
  USING ((brand_monitor_id)::uuid IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "takedown_actions_update" ON public.takedown_actions;
CREATE POLICY "takedown_actions_update"
  ON public.takedown_actions FOR UPDATE
  USING ((brand_monitor_id)::uuid IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ))
  WITH CHECK ((brand_monitor_id)::uuid IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

-- ── threat_profiles ──────────────────────────────────────────
DROP POLICY IF EXISTS "threat_profiles_delete" ON public.threat_profiles;
CREATE POLICY "threat_profiles_delete"
  ON public.threat_profiles FOR DELETE
  USING (brand_monitor_id IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "threat_profiles_insert" ON public.threat_profiles;
CREATE POLICY "threat_profiles_insert"
  ON public.threat_profiles FOR INSERT
  WITH CHECK (brand_monitor_id IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "threat_profiles_select" ON public.threat_profiles;
CREATE POLICY "threat_profiles_select"
  ON public.threat_profiles FOR SELECT
  USING (brand_monitor_id IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "threat_profiles_update" ON public.threat_profiles;
CREATE POLICY "threat_profiles_update"
  ON public.threat_profiles FOR UPDATE
  USING (brand_monitor_id IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ))
  WITH CHECK (brand_monitor_id IN (
    SELECT id FROM brand_monitors WHERE owner_id = (select auth.uid())
  ));

-- ── user_profiles ────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING ((select auth.uid()) = id);

-- ── known_scammers + scan_results: auth.role() initplan fix ──
DROP POLICY IF EXISTS "known_scammers_service_delete" ON public.known_scammers;
CREATE POLICY "known_scammers_service_delete"
  ON public.known_scammers FOR DELETE
  USING ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "known_scammers_service_insert" ON public.known_scammers;
CREATE POLICY "known_scammers_service_insert"
  ON public.known_scammers FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "known_scammers_service_update" ON public.known_scammers;
CREATE POLICY "known_scammers_service_update"
  ON public.known_scammers FOR UPDATE
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "scan_results_service_delete" ON public.scan_results;
CREATE POLICY "scan_results_service_delete"
  ON public.scan_results FOR DELETE
  USING ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "scan_results_service_insert" ON public.scan_results;
CREATE POLICY "scan_results_service_insert"
  ON public.scan_results FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "scan_results_service_update" ON public.scan_results;
CREATE POLICY "scan_results_service_update"
  ON public.scan_results FOR UPDATE
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── Add missing indexes ──────────────────────────────────────

-- sla_status: cleanup DELETE (WHERE timestamp < $1) was seq-scanning
CREATE INDEX IF NOT EXISTS idx_sla_status_timestamp
  ON public.sla_status (timestamp);

-- scan_jobs: non-pending status queries miss the partial index on status='pending'
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status_created
  ON public.scan_jobs (status, created_at DESC);

-- ── Drop unused indexes on empty tables ─────────────────────

-- scan_events (0 live tuples)
DROP INDEX IF EXISTS public.idx_scan_events_type_date;
DROP INDEX IF EXISTS public.idx_scan_events_source_date;
DROP INDEX IF EXISTS public.idx_scan_events_platform_date;
DROP INDEX IF EXISTS public.idx_scan_events_target;
DROP INDEX IF EXISTS public.idx_scan_events_created_at;
DROP INDEX IF EXISTS public.idx_scan_events_event_date;
DROP INDEX IF EXISTS public.idx_scan_events_scan_type;
DROP INDEX IF EXISTS public.idx_scan_events_platform;
DROP INDEX IF EXISTS public.idx_scan_events_risk_level;
DROP INDEX IF EXISTS public.idx_scan_events_source_table;
DROP INDEX IF EXISTS public.idx_scan_events_risk;

-- scan_results (0 live tuples)
DROP INDEX IF EXISTS public.idx_scan_results_username;
DROP INDEX IF EXISTS public.idx_scan_results_platform;
DROP INDEX IF EXISTS public.idx_scan_results_risk;
DROP INDEX IF EXISTS public.idx_scan_results_scanned_at;
DROP INDEX IF EXISTS public.idx_scan_results_wallet;

-- legitimate_accounts (0 live tuples)
DROP INDEX IF EXISTS public.idx_legitimate_platform;
DROP INDEX IF EXISTS public.idx_legitimate_verification_level;
DROP INDEX IF EXISTS public.idx_legitimate_created_at;
DROP INDEX IF EXISTS public.idx_legitimate_risk_score;
