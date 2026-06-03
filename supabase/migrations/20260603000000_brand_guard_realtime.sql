-- Migration: Enable realtime for Brand Guard alerts and subscriptions
-- Created: 2026-06-03
-- Purpose: Add brand_guard_alerts and brand_guard_subscriptions to the
--          supabase_realtime publication so the frontend dashboard receives
--          live updates when alerts are created or subscriptions change.

-- Add tables to realtime publication (idempotent)
ALTER PUBLICATION supabase_realtime ADD TABLE brand_guard_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE brand_guard_subscriptions;

-- Enable RLS policies for service role inserts on brand_guard_alerts
-- (service_role bypasses RLS, but let's ensure anon/auth'd users can also
--  read their own alerts for the dashboard)
CREATE POLICY IF NOT EXISTS "Users can view own alerts via brand_monitor"
  ON brand_guard_alerts
  FOR SELECT
  USING (
    brand_monitor_id IN (
      SELECT id FROM brand_monitors WHERE owner_id = auth.uid()
    )
  );

-- Allow authenticated users to mark their own alerts as read
CREATE POLICY IF NOT EXISTS "Users can update own alerts"
  ON brand_guard_alerts
  FOR UPDATE
  USING (
    brand_monitor_id IN (
      SELECT id FROM brand_monitors WHERE owner_id = auth.uid()
    )
  );

-- Comment
COMMENT ON TABLE brand_guard_alerts IS 'Brand Guard alerts with realtime enabled for dashboard';
COMMENT ON TABLE brand_guard_subscriptions IS 'Brand Guard subscriptions with realtime enabled for dashboard';