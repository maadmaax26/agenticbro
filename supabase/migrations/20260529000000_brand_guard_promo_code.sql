-- Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
-- See LICENSE file in parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
-- Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

-- Brand Guard: Promo Code & Admin Migration
-- Adds promo_code tracking to credits, admin user metadata, and admin API support.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Add promo_code column to brand_guard_credits
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE brand_guard_credits ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE brand_guard_credits ADD COLUMN IF NOT EXISTS promo_credits INTEGER DEFAULT 0;

-- Index for looking up promo codes
CREATE INDEX IF NOT EXISTS idx_bg_credits_promo ON brand_guard_credits(promo_code) WHERE promo_code IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Add promo_code to credit transaction types
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE brand_guard_credit_transactions DROP CONSTRAINT IF EXISTS brand_guard_credit_transactions_transaction_type_check;
ALTER TABLE brand_guard_credit_transactions ADD CONSTRAINT brand_guard_credit_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'free_grant',
    'free_usage',
    'purchase',
    'purchase_bonus',
    'paid_usage',
    'subscription_grant',
    'refund',
    'admin_adjustment',
    'promo_grant'
  ));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Update initialize_brand_guard_credits to accept promo_code
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION initialize_brand_guard_credits(
  p_owner_id UUID,
  p_promo_code TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  credit_id UUID;
  v_free_total INTEGER := 25;
  v_promo_credits INTEGER := 0;
  v_total_initial INTEGER;
BEGIN
  -- Check promo code
  IF p_promo_code IS NOT NULL AND LOWER(p_promo_code) = 'beta2026' THEN
    v_free_total := 500;
    v_promo_credits := 475;  -- 500 total minus the base 25
  END IF;

  INSERT INTO brand_guard_credits (owner_id, free_credits_total, free_credits_used, paid_credits, promo_code, promo_credits, first_brand_at)
  VALUES (p_owner_id, v_free_total, 0, 0, p_promo_code, v_promo_credits, now())
  ON CONFLICT (owner_id) DO NOTHING
  RETURNING id INTO credit_id;

  IF credit_id IS NOT NULL THEN
    v_total_initial := v_free_total;
    -- Log the free grant
    INSERT INTO brand_guard_credit_transactions (owner_id, transaction_type, amount, balance_after, free_remaining_after, paid_remaining_after, description)
    VALUES (p_owner_id, 'free_grant', v_free_total, v_total_initial, v_total_initial, 0,
      CASE WHEN v_promo_credits > 0
        THEN 'Beta tester: ' || v_free_total || ' free Brand Guard scans (promo: ' || p_promo_code || ')'
        ELSE 'Initial 25 free Brand Guard scans'
      END
    );

    -- Log promo bonus separately if applicable
    IF v_promo_credits > 0 THEN
      INSERT INTO brand_guard_credit_transactions (owner_id, transaction_type, amount, balance_after, free_remaining_after, paid_remaining_after, description)
      VALUES (p_owner_id, 'promo_grant', v_promo_credits, v_total_initial, v_total_initial, 0,
        'Promo code ' || p_promo_code || ': +' || v_promo_credits || ' bonus scans');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', credit_id IS NOT NULL,
    'credit_id', credit_id,
    'free_credits', v_free_total,
    'promo_code', p_promo_code,
    'promo_bonus', v_promo_credits
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Admin view: user list with promo codes and credit info
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW brand_guard_admin_users AS
SELECT
  u.id AS user_id,
  u.email,
  u.raw_user_meta_data->>'full_name' AS full_name,
  u.created_at AS user_created_at,
  c.free_credits_total,
  c.free_credits_used,
  c.paid_credits,
  c.paid_credits_total_purchased,
  (c.free_credits_total - c.free_credits_used + c.paid_credits) AS total_remaining,
  c.promo_code,
  c.promo_credits,
  c.first_brand_at,
  (SELECT COUNT(*) FROM brand_monitors bm WHERE bm.owner_id = u.id) AS brand_count,
  (SELECT COUNT(*) FROM brand_guard_credit_transactions ct WHERE ct.owner_id = u.id AND ct.transaction_type IN ('free_usage', 'paid_usage')) AS total_scans
FROM auth.users u
LEFT JOIN brand_guard_credits c ON c.owner_id = u.id
ORDER BY u.created_at DESC;

-- Grant service role access to admin view
GRANT SELECT ON brand_guard_admin_users TO service_role;