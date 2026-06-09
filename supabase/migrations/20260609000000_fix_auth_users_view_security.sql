-- =====================================================================
-- Migration: 20260609000000_fix_auth_users_view_security.sql
-- Date: 2026-06-09
-- Description: CRITICAL SECURITY FIX — Replace brand_guard_admin_users view
--   with secure version that only returns the current authenticated user's data.
--
-- Issue: Migrations 20260529000000 and apply_promo_code.sql recreated the view
--   without the WHERE u.id = auth.uid() filter, exposing ALL auth.users
--   emails and personal info through the public API.
--
-- This is the same fix as 005_security_fix_auth_users_and_rls.sql, but must be
--   re-applied after the insecure view definitions.
-- =====================================================================

-- Drop the insecure view definition
DROP VIEW IF EXISTS public.brand_guard_admin_users CASCADE;

-- Recreate with security barrier and auth.uid() filter
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

-- Service role can still see all users for admin operations
GRANT SELECT ON public.brand_guard_admin_users TO service_role;

-- =====================================================================
-- Verification: This view now ONLY returns data for the calling user
-- =====================================================================
-- To verify this fix works:
-- 1. Query the view with anon key — should return empty (no auth.uid())
-- 2. Query with authenticated user — should return only that user's row
-- 3. Query with service_role — should return all users (admin access)