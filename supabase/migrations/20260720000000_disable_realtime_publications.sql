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

DO $$
DECLARE
  publication_table TEXT;
BEGIN
  FOREACH publication_table IN ARRAY ARRAY[
    'brand_guard_alerts',
    'brand_guard_subscriptions',
    'scan_jobs',
    'admin_notifications'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = publication_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %I', publication_table);
    END IF;
  END LOOP;
END $$;
