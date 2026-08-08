-- Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
-- See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
-- Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

-- Brand Guard Credits & Billing Schema
-- ============================================================
-- Extends brand_monitors with credit tracking.
-- Mirrors the social scan credit system: 25 free scans, then pay-as-you-go.
-- Supports future subscription plans via brand_guard_subscriptions.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. brand_guard_credits — Pay-as-you-go credit tracking per user
-- ═══════════════════════════════════════════════════════════════════════════════
-- One row per user. Tracks free + paid credits across ALL their brands.
CREATE TABLE IF NOT EXISTS brand_guard_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,

  -- Free tier
  free_credits_total INTEGER NOT NULL DEFAULT 25,    -- starting free credits
  free_credits_used INTEGER NOT NULL DEFAULT 0,       -- consumed free credits

  -- Paid credits (pay-as-you-go)
  paid_credits INTEGER NOT NULL DEFAULT 0,            -- current paid credit balance
  paid_credits_total_purchased INTEGER NOT NULL DEFAULT 0,  -- lifetime total bought

  -- Metadata
  first_brand_at TIMESTAMPTZ,                         -- when user created their first brand (starts free tier)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bg_credits_owner ON brand_guard_credits(owner_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. brand_guard_credit_transactions — Audit trail for all credit changes
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brand_guard_credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'free_grant',       -- Initial 25 free credits on first brand creation
    'free_usage',       -- Consuming a free credit
    'purchase',         -- Buying pay-as-you-go credits (Stripe/crypto)
    'purchase_bonus',   -- Bonus credits added on top of purchase (e.g., whale pack)
    'paid_usage',       -- Consuming a paid credit
    'subscription_grant', -- Monthly credits from subscription
    'refund',           -- Refund/credit reversal
    'admin_adjustment' -- Manual adjustment by admin
  )),
  amount INTEGER NOT NULL,                            -- Positive = add, Negative = deduct
  balance_after INTEGER NOT NULL,                     -- Total remaining (free + paid) after transaction

  -- Breakdown
  free_remaining_after INTEGER NOT NULL DEFAULT 0,    -- Free credits remaining after
  paid_remaining_after INTEGER NOT NULL DEFAULT 0,    -- Paid credits remaining after

  -- Link to what triggered this
  brand_monitor_id UUID REFERENCES brand_monitors(id) ON DELETE SET NULL,
  scan_id TEXT,                                        -- Link to brand_guard_scans if usage

  -- Payment info (for purchases)
  payment_method TEXT CHECK (payment_method IN ('stripe', 'usdc_solana', 'usdc_base', 'agntcbro', 'subscription', 'admin', null)),
  payment_reference TEXT,                              -- Stripe session ID, tx signature, etc.
  amount_usd NUMERIC(10, 2),                           -- Dollar amount paid (for purchases)

  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bg_credit_tx_owner ON brand_guard_credit_transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_bg_credit_tx_type ON brand_guard_credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_bg_credit_tx_created ON brand_guard_credit_transactions(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. brand_guard_subscriptions — Subscription plans (future)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Allows monthly/annual subscription with included credits + overage.
CREATE TABLE IF NOT EXISTS brand_guard_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand_monitor_id UUID REFERENCES brand_monitors(id) ON DELETE CASCADE,

  -- Plan
  plan_id TEXT NOT NULL CHECK (plan_id IN (
    'free',           -- 25 free scans, no subscription
    'guardian',       -- $29/mo: 100 scans/mo, 3 brands, 6-hour monitoring
    'sentinel',       -- $99/mo: 300 scans/mo, 10 brands, 15-minute monitoring
    'fortress'        -- $299/mo: Unlimited scans, Unlimited brands, real-time monitoring
  )),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'expired')),

  -- Billing
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,

  -- Credits included in plan
  monthly_credits_included INTEGER NOT NULL DEFAULT 0,  -- Credits refreshed each billing cycle
  monthly_credits_used INTEGER NOT NULL DEFAULT 0,       -- Used this billing period
  brands_included INTEGER NOT NULL DEFAULT 1,             -- Max brands on this plan

  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,

  -- Overage pricing (for plans that allow it)
  overage_price_per_scan NUMERIC(10, 2) DEFAULT 1.00,    -- $1/scan overage

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bg_subs_owner ON brand_guard_subscriptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_bg_subs_status ON brand_guard_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_bg_subs_stripe_customer ON brand_guard_subscriptions(stripe_customer_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Helper Functions
-- ═══════════════════════════════════════════════════════════════════════════════

-- Initialize credits for a new user (called when first brand is created)
CREATE OR REPLACE FUNCTION initialize_brand_guard_credits(p_owner_id UUID)
RETURNS UUID AS $$
DECLARE
  credit_id UUID;
BEGIN
  INSERT INTO brand_guard_credits (owner_id, free_credits_total, free_credits_used, paid_credits, first_brand_at)
  VALUES (p_owner_id, 10, 0, 0, now())
  ON CONFLICT (owner_id) DO NOTHING
  RETURNING id INTO credit_id;

  -- Log the free grant
  IF credit_id IS NOT NULL THEN
    INSERT INTO brand_guard_credit_transactions (owner_id, transaction_type, amount, balance_after, free_remaining_after, paid_remaining_after, description)
    VALUES (p_owner_id, 'free_grant', 25, 25, 25, 0, 'Initial 25 free Brand Guard scans');
  END IF;

  RETURN credit_id;
END;
$$ LANGUAGE plpgsql;

-- Deduct a credit for a brand guard scan
-- Returns: { success: bool, type: 'free' | 'paid' | 'subscription', remaining: int }
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
  result JSONB;
BEGIN
  -- Get or create credits
  SELECT * INTO credit_rec FROM brand_guard_credits WHERE owner_id = p_owner_id FOR UPDATE;

  -- If no credits row exists, initialize first
  IF NOT FOUND THEN
    PERFORM initialize_brand_guard_credits(p_owner_id);
    SELECT * INTO credit_rec FROM brand_guard_credits WHERE owner_id = p_owner_id FOR UPDATE;
  END IF;

  free_remaining := credit_rec.free_credits_total - credit_rec.free_credits_used;
  paid_remaining := credit_rec.paid_credits;
  total_remaining := free_remaining + paid_remaining;

  -- Check subscription first (if active subscription, subscription grants apply)
  -- For now, subscription grants are handled via monthly credit top-ups

  -- Try free credits first
  IF free_remaining > 0 THEN
    UPDATE brand_guard_credits
    SET free_credits_used = free_credits_used + 1,
        updated_at = now()
    WHERE owner_id = p_owner_id;

    used_type := 'free';
    free_remaining := free_remaining - 1;
    total_remaining := total_remaining - 1;
  -- Then paid credits
  ELSIF paid_remaining > 0 THEN
    UPDATE brand_guard_credits
    SET paid_credits = paid_credits - 1,
        updated_at = now()
    WHERE owner_id = p_owner_id;

    used_type := 'paid';
    paid_remaining := paid_remaining - 1;
    total_remaining := total_remaining - 1;
  ELSE
    -- No credits available
    RETURN jsonb_build_object(
      'success', false,
      'type', NULL,
      'remaining', 0,
      'free_remaining', 0,
      'paid_remaining', 0,
      'message', 'No credits available. Purchase credits or set up a subscription to continue scanning.'
    );
  END IF;

  -- Log the transaction
  INSERT INTO brand_guard_credit_transactions (
    owner_id, transaction_type, amount, balance_after,
    free_remaining_after, paid_remaining_after,
    brand_monitor_id, scan_id,
    payment_method, description
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

-- Add credits to a user (purchase, subscription grant, or admin adjustment)
CREATE OR REPLACE FUNCTION add_brand_guard_credits(
  p_owner_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_amount_usd NUMERIC DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  credit_rec RECORD;
  total_remaining INTEGER;
  free_remaining INTEGER;
  paid_remaining INTEGER;
BEGIN
  -- Get or create credits
  SELECT * INTO credit_rec FROM brand_guard_credits WHERE owner_id = p_owner_id FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM initialize_brand_guard_credits(p_owner_id);
    SELECT * INTO credit_rec FROM brand_guard_credits WHERE owner_id = p_owner_id FOR UPDATE;
  END IF;

  -- Add credits (only to paid balance for purchases/subscriptions)
  UPDATE brand_guard_credits
  SET paid_credits = paid_credits + p_amount,
      paid_credits_total_purchased = paid_credits_total_purchased + p_amount,
      updated_at = now()
  WHERE owner_id = p_owner_id;

  free_remaining := credit_rec.free_credits_total - credit_rec.free_credits_used;
  paid_remaining := credit_rec.paid_credits + p_amount;
  total_remaining := free_remaining + paid_remaining;

  -- Log the transaction
  INSERT INTO brand_guard_credit_transactions (
    owner_id, transaction_type, amount, balance_after,
    free_remaining_after, paid_remaining_after,
    payment_method, payment_reference, amount_usd, description
  ) VALUES (
    p_owner_id, p_transaction_type, p_amount, total_remaining,
    free_remaining, paid_remaining,
    p_payment_method, p_payment_reference, p_amount_usd, p_description
  );

  RETURN jsonb_build_object(
    'success', true,
    'credits_added', p_amount,
    'total_remaining', total_remaining,
    'free_remaining', free_remaining,
    'paid_remaining', paid_remaining
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE brand_guard_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_guard_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_guard_subscriptions ENABLE ROW LEVEL SECURITY;

-- Credits: users can view their own, service role can manage
CREATE POLICY "Users can view own credits" ON brand_guard_credits
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own credits" ON brand_guard_credits
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Credit transactions: users can view their own, service role inserts
CREATE POLICY "Users can view own transactions" ON brand_guard_credit_transactions
  FOR SELECT USING (auth.uid() = owner_id);

-- Subscriptions: users can view their own
CREATE POLICY "Users can view own subscription" ON brand_guard_subscriptions
  FOR SELECT USING (auth.uid() = owner_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Trigger: auto-update timestamps
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_bg_credits_updated
  BEFORE UPDATE ON brand_guard_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bg_subs_updated
  BEFORE UPDATE ON brand_guard_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
