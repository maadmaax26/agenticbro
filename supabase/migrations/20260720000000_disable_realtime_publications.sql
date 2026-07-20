-- ============================================================
-- Emergency fix: remove all tables from supabase_realtime publication
--
-- Root cause: Realtime was hitting PoolingReplicationPreparationError /
-- SubscriptionDeletionFailed every 6s with 11-12s queue timeouts,
-- saturating the entire Postgres connection pool and starving auth.
--
-- Tables affected: brand_guard_alerts, brand_guard_subscriptions,
--                  scan_jobs, admin_notifications
--
-- Frontend updated to use polling instead of Realtime subscriptions.
-- Apply this in the Supabase SQL Editor immediately after restoring the
-- project from the pause/restart.
-- ============================================================

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS brand_guard_alerts;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS brand_guard_subscriptions;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS scan_jobs;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS admin_notifications;
