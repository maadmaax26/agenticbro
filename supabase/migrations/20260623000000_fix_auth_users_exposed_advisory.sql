-- =====================================================================
-- CRITICAL SECURITY FIX — auth_users_exposed view
-- Date: 2026-06-23
-- Supabase Advisory: User data exposed through a view (auth_users_exposed)
-- 
-- The view brand_guard_admin_users selects from auth.users WITHOUT
-- a WHERE u.id = auth.uid() filter, exposing ALL users' emails
-- and personal data through the public API.
--
-- This fix:
--   1. Drops the insecure view
--   2. Recreates with security_barrier and auth.uid() filter
--   3. Revokes access from anon/public
--   4. Grants SELECT only to authenticated (for own row) and service_role (admin)
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Project: agentic-bro-scam-detection (drvasofyghnxfxvkkwad)
-- =====================================================================

-- Step 1: Drop the insecure view
DROP VIEW IF EXISTS public.brand_guard_admin_users CASCADE;

-- Step 2: Recreate with security barrier + auth.uid() filter
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

-- Step 3: Security barrier prevents optimizations that could leak data
ALTER VIEW public.brand_guard_admin_users SET (security_barrier = true);

-- Step 4: Revoke all access from anon and public
REVOKE ALL ON public.brand_guard_admin_users FROM anon;
REVOKE ALL ON public.brand_guard_admin_users FROM public;

-- Step 5: Grant SELECT only to authenticated users (see their own row) and service_role (admin)
GRANT SELECT ON public.brand_guard_admin_users TO authenticated;
GRANT SELECT ON public.brand_guard_admin_users TO service_role;

-- =====================================================================
-- Verification queries (run after applying):
--   SELECT * FROM public.brand_guard_admin_users;  -- with anon key → should return empty
--   SELECT * FROM public.brand_guard_admin_users;  -- with authenticated user → only that user's row
-- =====================================================================

-- Also check for any OTHER views selecting from auth.users:
-- SELECT schemaname, viewname, definition 
-- FROM pg_views 
-- WHERE schemaname = 'public' AND definition ILIKE '%auth.users%';