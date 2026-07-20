-- Brand Guard plan/pricing enhancements
-- - Free tier remains 25 included scans
-- - Guardian becomes 100 scans/month with up to 50 rollover handled by webhook
-- - Sentinel becomes 300 scans/month
-- - Adds Business and Agency plan IDs
-- - Adds billing interval metadata for monthly/annual subscriptions

UPDATE brand_guard_credits
SET
  free_credits_total = GREATEST(free_credits_total, 25)
WHERE promo_code IS NULL;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'brand_guard_credit_transactions'::regclass
    AND pg_get_constraintdef(oid) LIKE '%payment_method%CHECK%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE brand_guard_credit_transactions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE brand_guard_credit_transactions
  ADD CONSTRAINT brand_guard_credit_transactions_payment_method_check
  CHECK (payment_method IN ('stripe', 'usdc_solana', 'usdc_base', 'agntcbro', 'subscription', 'admin', 'free', 'pay_as_you_go', 'refund') OR payment_method IS NULL);

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'brand_guard_subscriptions'::regclass
    AND pg_get_constraintdef(oid) LIKE '%plan_id%CHECK%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE brand_guard_subscriptions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE brand_guard_subscriptions
  ADD CONSTRAINT brand_guard_subscriptions_plan_id_check
  CHECK (plan_id IN ('free', 'guardian', 'business', 'sentinel', 'fortress', 'agency'));

ALTER TABLE brand_guard_subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS rollover_credits_applied INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION initialize_brand_guard_credits(
  p_owner_id UUID,
  p_promo_code TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  credit_id UUID;
  v_promo_credits INTEGER := 0;
  v_free_total INTEGER := 25;
BEGIN
  IF p_promo_code IS NOT NULL AND upper(p_promo_code) = 'BETA2026' THEN
    v_promo_credits := 475;
    v_free_total := 500;
  END IF;

  INSERT INTO brand_guard_credits (
    owner_id,
    free_credits_total,
    free_credits_used,
    paid_credits,
    promo_code,
    promo_credits,
    first_brand_at
  )
  VALUES (
    p_owner_id,
    v_free_total,
    0,
    0,
    p_promo_code,
    v_promo_credits,
    now()
  )
  ON CONFLICT (owner_id) DO NOTHING
  RETURNING id INTO credit_id;

  IF credit_id IS NOT NULL THEN
    INSERT INTO brand_guard_credit_transactions (
      owner_id,
      transaction_type,
      amount,
      balance_after,
      free_remaining_after,
      paid_remaining_after,
      description
    )
    VALUES (
      p_owner_id,
      'free_grant',
      v_free_total,
      v_free_total,
      v_free_total,
      0,
      CASE
        WHEN v_promo_credits > 0 THEN 'Beta tester: ' || v_free_total || ' free Brand Guard scans (promo: ' || p_promo_code || ')'
        ELSE 'Initial 25 free Brand Guard scans'
      END
    );
  END IF;

  RETURN credit_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION deduct_brand_guard_credit(
  p_owner_id UUID,
  p_brand_monitor_id UUID DEFAULT NULL,
  p_scan_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  credit_rec RECORD;
  free_remaining INTEGER;
  paid_remaining INTEGER;
  total_remaining INTEGER;
  used_type TEXT;
BEGIN
  SELECT * INTO credit_rec
  FROM brand_guard_credits
  WHERE owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM initialize_brand_guard_credits(p_owner_id);
    SELECT * INTO credit_rec FROM brand_guard_credits WHERE owner_id = p_owner_id FOR UPDATE;
  END IF;

  free_remaining := credit_rec.free_credits_total - credit_rec.free_credits_used;
  paid_remaining := credit_rec.paid_credits;
  total_remaining := free_remaining + paid_remaining;

  IF free_remaining > 0 THEN
    UPDATE brand_guard_credits
    SET free_credits_used = free_credits_used + 1,
        updated_at = now()
    WHERE owner_id = p_owner_id;

    used_type := 'free';
    free_remaining := free_remaining - 1;
    total_remaining := total_remaining - 1;
  ELSIF paid_remaining > 0 THEN
    UPDATE brand_guard_credits
    SET paid_credits = paid_credits - 1,
        updated_at = now()
    WHERE owner_id = p_owner_id;

    used_type := 'paid';
    paid_remaining := paid_remaining - 1;
    total_remaining := total_remaining - 1;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'type', NULL,
      'remaining', 0,
      'free_remaining', 0,
      'paid_remaining', 0,
      'message', 'No credits available. Purchase credits or set up a subscription to continue scanning.'
    );
  END IF;

  INSERT INTO brand_guard_credit_transactions (
    owner_id,
    transaction_type,
    amount,
    balance_after,
    free_remaining_after,
    paid_remaining_after,
    brand_monitor_id,
    scan_id,
    payment_method,
    description
  ) VALUES (
    p_owner_id,
    CASE WHEN used_type = 'free' THEN 'free_usage' ELSE 'paid_usage' END,
    -1,
    total_remaining,
    free_remaining,
    paid_remaining,
    p_brand_monitor_id,
    p_scan_id,
    CASE WHEN used_type = 'free' THEN 'free' ELSE 'pay_as_you_go' END,
    CASE WHEN used_type = 'free'
      THEN 'Free Brand Guard scan credit used'
      ELSE 'Paid Brand Guard scan credit used'
    END
  );

  RETURN jsonb_build_object(
    'success', true,
    'type', used_type,
    'remaining', total_remaining,
    'free_remaining', free_remaining,
    'paid_remaining', paid_remaining
  );
END;
$$ LANGUAGE plpgsql;
