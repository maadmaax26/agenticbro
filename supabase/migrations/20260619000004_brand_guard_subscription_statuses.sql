-- Stripe trials must be representable before Brand Guard can activate access.
ALTER TABLE brand_guard_subscriptions
  DROP CONSTRAINT IF EXISTS brand_guard_subscriptions_status_check;

ALTER TABLE brand_guard_subscriptions
  ADD CONSTRAINT brand_guard_subscriptions_status_check
  CHECK (status IN (
    'active', 'trialing', 'trial_ending', 'past_due',
    'canceled', 'expired', 'unpaid'
  ));
