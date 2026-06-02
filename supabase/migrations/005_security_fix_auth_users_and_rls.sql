-- =====================================================================
-- Migration: 005_security_fix_auth_users_and_rls.sql
-- Date: 2026-06-02
-- Description: Fix two CRITICAL Supabase security issues
--   1. auth_users_exposed: brand_guard_admin_users view exposed auth.users
--      (emails, user IDs) to anyone with API access
--   2. rls_disabled_in_public: email_spoof_checks and visual_match_evidence
--      tables had no Row-Level Security enabled
-- =====================================================================

-- =====================================================================
-- FIX 1: Replace brand_guard_admin_users view with a secure version
-- The original view exposed ALL auth.users data (emails, IDs, metadata)
-- to anyone with API access. Now restricted to only show the current
-- authenticated user their own data via WHERE u.id = auth.uid()
-- =====================================================================

DROP VIEW IF EXISTS public.brand_guard_admin_users CASCADE;

CREATE VIEW public.brand_guard_admin_users AS
SELECT 
  u.id AS user_id,
  u.email,
  (u.raw_user_meta_data ->> 'full_name'::text) AS full_name,
  (u.raw_user_meta_data ->> 'source'::text) AS signup_source,
  (u.raw_user_meta_data ->> 'app'::text) AS signup_app,
  u.created_at AS user_created_at,
  c.free_credits_total,
  c.free_credits_used,
  c.paid_credits,
  c.paid_credits_total_purchased,
  ((c.free_credits_total - c.free_credits_used) + c.paid_credits) AS total_remaining,
  c.promo_code,
  c.promo_credits,
  c.first_brand_at,
  (SELECT count(*) AS count
   FROM brand_monitors bm
   WHERE bm.owner_id = u.id) AS brand_count,
  (SELECT count(*) AS count
   FROM brand_guard_credit_transactions ct
   WHERE ct.owner_id = u.id
     AND ct.transaction_type IN ('free_usage', 'paid_usage')) AS total_scans
FROM auth.users u
LEFT JOIN brand_guard_credits c ON c.owner_id = u.id
WHERE u.id = auth.uid()
ORDER BY u.created_at DESC;

-- Security barrier prevents optimizations that could leak data
ALTER VIEW public.brand_guard_admin_users SET (security_barrier = true);

-- Grant access only to authenticated users, revoke from anon/public
GRANT SELECT ON public.brand_guard_admin_users TO authenticated;
REVOKE ALL ON public.brand_guard_admin_users FROM anon;
REVOKE ALL ON public.brand_guard_admin_users FROM public;

-- =====================================================================
-- FIX 2: Enable RLS on email_spoof_checks (was wide open)
-- Pattern matches other public-read tables like vendor_verifications
-- =====================================================================

ALTER TABLE public.email_spoof_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_spoof_checks_select_anon" ON public.email_spoof_checks
  FOR SELECT TO anon USING (true);

CREATE POLICY "email_spoof_checks_select_authenticated" ON public.email_spoof_checks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "email_spoof_checks_service_insert" ON public.email_spoof_checks
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "email_spoof_checks_service_update" ON public.email_spoof_checks
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "email_spoof_checks_service_delete" ON public.email_spoof_checks
  FOR DELETE TO service_role USING (true);

-- =====================================================================
-- FIX 3: Enable RLS on visual_match_evidence (was wide open)
-- Pattern matches other brand-guard tables
-- =====================================================================

ALTER TABLE public.visual_match_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visual_match_evidence_select_anon" ON public.visual_match_evidence
  FOR SELECT TO anon USING (true);

CREATE POLICY "visual_match_evidence_select_authenticated" ON public.visual_match_evidence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "visual_match_evidence_service_insert" ON public.visual_match_evidence
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "visual_match_evidence_service_update" ON public.visual_match_evidence
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "visual_match_evidence_service_delete" ON public.visual_match_evidence
  FOR DELETE TO service_role USING (true);

-- =====================================================================
-- FIX 4: Add policies for takedown_actions (RLS enabled but 0 policies)
-- Without policies, RLS blocks ALL access including legitimate users
-- =====================================================================

CREATE POLICY "takedown_actions_select" ON public.takedown_actions
  FOR SELECT TO authenticated USING (
    brand_monitor_id::uuid IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
  );

CREATE POLICY "takedown_actions_insert" ON public.takedown_actions
  FOR INSERT TO authenticated WITH CHECK (
    brand_monitor_id::uuid IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
  );

CREATE POLICY "takedown_actions_update" ON public.takedown_actions
  FOR UPDATE TO authenticated USING (
    brand_monitor_id::uuid IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
  ) WITH CHECK (
    brand_monitor_id::uuid IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
  );

CREATE POLICY "takedown_actions_delete" ON public.takedown_actions
  FOR DELETE TO authenticated USING (
    brand_monitor_id::uuid IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
  );

-- Service role full access
CREATE POLICY "takedown_actions_service_select" ON public.takedown_actions
  FOR SELECT TO service_role USING (true);
CREATE POLICY "takedown_actions_service_insert" ON public.takedown_actions
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "takedown_actions_service_update" ON public.takedown_actions
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "takedown_actions_service_delete" ON public.takedown_actions
  FOR DELETE TO service_role USING (true);

-- =====================================================================
-- FIX 5: Add policies for threat_profiles (RLS enabled but 0 policies)
-- =====================================================================

CREATE POLICY "threat_profiles_select" ON public.threat_profiles
  FOR SELECT TO authenticated USING (
    brand_monitor_id IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
  );

CREATE POLICY "threat_profiles_insert" ON public.threat_profiles
  FOR INSERT TO authenticated WITH CHECK (
    brand_monitor_id IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
  );

CREATE POLICY "threat_profiles_update" ON public.threat_profiles
  FOR UPDATE TO authenticated USING (
    brand_monitor_id IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
  ) WITH CHECK (
    brand_monitor_id IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
  );

CREATE POLICY "threat_profiles_delete" ON public.threat_profiles
  FOR DELETE TO authenticated USING (
    brand_monitor_id IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
  );

-- Service role full access
CREATE POLICY "threat_profiles_service_select" ON public.threat_profiles
  FOR SELECT TO service_role USING (true);
CREATE POLICY "threat_profiles_service_insert" ON public.threat_profiles
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "threat_profiles_service_update" ON public.threat_profiles
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "threat_profiles_service_delete" ON public.threat_profiles
  FOR DELETE TO service_role USING (true);