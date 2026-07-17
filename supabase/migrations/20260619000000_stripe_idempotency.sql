-- Migration: stripe_idempotency
-- Adds a table to track processed Stripe webhook events, preventing double-processing on retries.
-- Each Stripe event has a globally unique ID (e.g. evt_1Abc123...) which is used as the key.

CREATE TABLE IF NOT EXISTS stripe_processed_events (
  event_id   TEXT        PRIMARY KEY,          -- Stripe event ID (e.g. evt_1Abc...)
  event_type TEXT        NOT NULL,             -- e.g. checkout.session.completed
  owner_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup jobs (delete events older than 90 days)
CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_at
  ON stripe_processed_events (processed_at);

-- RLS: only service role can read/write (webhook runs with service key)
ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- No user-facing policies — service role bypasses RLS
COMMENT ON TABLE stripe_processed_events IS
  'Tracks processed Stripe webhook event IDs to prevent double-processing on retries.';
