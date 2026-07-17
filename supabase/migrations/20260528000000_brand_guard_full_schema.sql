-- Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
-- See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
-- Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

-- Brand Guard — Supabase Schema
-- Run this in the Supabase SQL Editor to create the tables

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. brand_monitors — Brands registered for monitoring
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brand_monitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  brand_handle TEXT NOT NULL,
  brand_domain TEXT,
  platforms TEXT[] DEFAULT ARRAY['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin'],
  scan_frequency TEXT DEFAULT 'weekly' CHECK (scan_frequency IN ('once', 'daily', 'weekly', 'monthly')),
  last_scan_at TIMESTAMPTZ,
  scan_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookup by owner
CREATE INDEX IF NOT EXISTS idx_brand_monitors_owner ON brand_monitors(owner_id);
CREATE INDEX IF NOT EXISTS idx_brand_monitors_handle ON brand_monitors(brand_handle);
CREATE INDEX IF NOT EXISTS idx_brand_monitors_active ON brand_monitors(is_active) WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. brand_guard_scans — Scan results for brand impersonation checks
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brand_guard_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id TEXT UNIQUE NOT NULL,
  brand_monitor_id UUID REFERENCES brand_monitors(id) ON DELETE SET NULL,
  brand_name TEXT NOT NULL,
  brand_handle TEXT NOT NULL,
  brand_domain TEXT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'complete', 'failed')),
  platforms TEXT[],
  variants_generated INTEGER DEFAULT 0,
  profiles_scanned INTEGER DEFAULT 0,
  impersonators_found INTEGER DEFAULT 0,
  scammer_db_matches INTEGER DEFAULT 0,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_brand_guard_scans_scan_id ON brand_guard_scans(scan_id);
CREATE INDEX IF NOT EXISTS idx_brand_guard_scans_brand_handle ON brand_guard_scans(brand_handle);
CREATE INDEX IF NOT EXISTS idx_brand_guard_scans_status ON brand_guard_scans(status);
CREATE INDEX IF NOT EXISTS idx_brand_guard_scans_created ON brand_guard_scans(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. brand_impersonators — Individual impersonator profiles found
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brand_impersonators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID REFERENCES brand_guard_scans(id) ON DELETE CASCADE,
  brand_monitor_id UUID REFERENCES brand_monitors(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  handle_similarity REAL NOT NULL,
  name_similarity REAL DEFAULT 0,
  impersonation_score REAL NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  threat_type TEXT,
  patterns_detected JSONB DEFAULT '[]',
  evidence TEXT[] DEFAULT '{}',
  scammer_db_match BOOLEAN DEFAULT false,
  profile_url TEXT,
  followers INTEGER,
  verified BOOLEAN DEFAULT false,
  takedown_status TEXT DEFAULT 'pending' CHECK (takedown_status IN ('pending', 'reported', 'removed', 'dismissed')),
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_impersonators_brand ON brand_impersonators(brand_monitor_id);
CREATE INDEX IF NOT EXISTS idx_brand_impersonators_platform ON brand_impersonators(platform);
CREATE INDEX IF NOT EXISTS idx_brand_impersonators_risk ON brand_impersonators(risk_level);
CREATE INDEX IF NOT EXISTS idx_brand_impersonators_takedown ON brand_impersonators(takedown_status);
CREATE INDEX IF NOT EXISTS idx_brand_impersonators_username ON brand_impersonators(username);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. domain_monitors — Domain lookalike monitoring (for Feature 3)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS domain_monitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_monitor_id UUID REFERENCES brand_monitors(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  variants JSONB DEFAULT '[]',
  baseline_score REAL DEFAULT 0,
  last_scan_at TIMESTAMPTZ,
  scan_frequency TEXT DEFAULT 'weekly' CHECK (scan_frequency IN ('once', 'daily', 'weekly', 'monthly')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_monitors_owner ON domain_monitors(owner_id);
CREATE INDEX IF NOT EXISTS idx_domain_monitors_domain ON domain_monitors(domain);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4b. domain_lookalikes — Individual lookalike domain scan results
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS domain_lookalikes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id TEXT UNIQUE NOT NULL,
  domain TEXT NOT NULL,
  total_variants INTEGER DEFAULT 0,
  summary JSONB DEFAULT '{}',
  variants JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_lookalikes_scan_id ON domain_lookalikes(scan_id);
CREATE INDEX IF NOT EXISTS idx_domain_lookalikes_domain ON domain_lookalikes(domain);
CREATE INDEX IF NOT EXISTS idx_domain_lookalikes_created ON domain_lookalikes(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. vendor_verifications — Vendor phone verification history (for Feature 2)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendor_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  verification_id TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  country TEXT DEFAULT 'US',
  vendor_name TEXT,
  call_context TEXT,
  verification_score INTEGER NOT NULL,
  verification_level TEXT NOT NULL CHECK (verification_level IN ('VERIFIED', 'LIKELY_LEGITIMATE', 'UNVERIFIED', 'SUSPICIOUS', 'LIKELY_FRAUDULENT')),
  business_legitimacy_score INTEGER NOT NULL,
  phone_risk_score REAL DEFAULT 0,
  scam_patterns JSONB DEFAULT '[]',
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_verifications_phone ON vendor_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_vendor_verifications_vendor ON vendor_verifications(vendor_name);
CREATE INDEX IF NOT EXISTS idx_vendor_verifications_level ON vendor_verifications(verification_level);
CREATE INDEX IF NOT EXISTS idx_vendor_verifications_created ON vendor_verifications(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. threat_profiles — Cross-channel threat correlation (for Feature 4)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS threat_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  threat_id TEXT UNIQUE NOT NULL,
  brand_monitor_id UUID REFERENCES brand_monitors(id) ON DELETE SET NULL,
  channels JSONB DEFAULT '[]',
  linked_entities JSONB DEFAULT '[]',
  aggregate_risk REAL DEFAULT 0,
  risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threat_profiles_brand ON threat_profiles(brand_monitor_id);
CREATE INDEX IF NOT EXISTS idx_threat_profiles_risk ON threat_profiles(risk_level);
CREATE INDEX IF NOT EXISTS idx_threat_profiles_status ON threat_profiles(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. takedown_actions — Takedown request tracking
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS takedown_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  threat_id TEXT REFERENCES threat_profiles(threat_id) ON DELETE CASCADE,
  impersonator_id UUID REFERENCES brand_impersonators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('report', 'cease_desist', 'evidence_package', 'monitor')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'acknowledged', 'removed', 'rejected')),
  template_id TEXT,
  evidence_url TEXT,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takedown_actions_status ON takedown_actions(status);
CREATE INDEX IF NOT EXISTS idx_takedown_actions_platform ON takedown_actions(platform);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Helper Functions
-- ═══════════════════════════════════════════════════════════════════════════════

-- Update last_scan_at and increment scan_count when a scan completes
CREATE OR REPLACE FUNCTION increment_brand_scan_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE brand_monitors
  SET last_scan_at = now(),
      scan_count = scan_count + 1,
      updated_at = now()
  WHERE id = NEW.brand_monitor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_brand_scan_complete
  AFTER UPDATE ON brand_guard_scans
  FOR EACH ROW
  WHEN (OLD.status = 'processing' AND NEW.status = 'complete')
  EXECUTE FUNCTION increment_brand_scan_count();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_brand_monitors_updated
  BEFORE UPDATE ON brand_monitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_domain_monitors_updated
  BEFORE UPDATE ON domain_monitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_threat_profiles_updated
  BEFORE UPDATE ON threat_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE brand_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_guard_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_impersonators ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE takedown_actions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own brands
CREATE POLICY "Users can view own brands" ON brand_monitors FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own brands" ON brand_monitors FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own brands" ON brand_monitors FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own brands" ON brand_monitors FOR DELETE USING (auth.uid() = owner_id);

-- Scans are visible to the brand owner
CREATE POLICY "Users can view own scans" ON brand_guard_scans FOR SELECT USING (
  brand_monitor_id IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
);
CREATE POLICY "Users can insert scans" ON brand_guard_scans FOR INSERT WITH CHECK (true); -- Service role inserts

-- Impersonators visible to brand owner
CREATE POLICY "Users can view own impersonators" ON brand_impersonators FOR SELECT USING (
  brand_monitor_id IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
);

-- Domain monitors visible to owner
CREATE POLICY "Users can view own domains" ON domain_monitors FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own domains" ON domain_monitors FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own domains" ON domain_monitors FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own domains" ON domain_monitors FOR DELETE USING (auth.uid() = owner_id);
-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. brand_guard_alerts — Alert notifications for new threats
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brand_guard_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_monitor_id UUID REFERENCES brand_monitors(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('new_threat', 'escalation', 'resolved', 'scan_complete')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  title TEXT NOT NULL,
  message TEXT,
  threat_id TEXT,
  target TEXT,
  platform TEXT,
  risk_score REAL DEFAULT 0,
  risk_level TEXT,
  evidence TEXT[] DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_guard_alerts_brand ON brand_guard_alerts(brand_monitor_id);
CREATE INDEX IF NOT EXISTS idx_brand_guard_alerts_severity ON brand_guard_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_brand_guard_alerts_read ON brand_guard_alerts(read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_brand_guard_alerts_created ON brand_guard_alerts(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. dashboard_preferences — User dashboard configuration
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  brand_monitor_id UUID REFERENCES brand_monitors(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  alert_email BOOLEAN DEFAULT true,
  alert_email_frequency TEXT DEFAULT 'immediate' CHECK (alert_email_frequency IN ('immediate', 'hourly', 'daily', 'weekly')),
  alert_email_address TEXT,
  dashboard_layout JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_owner ON dashboard_preferences(owner_id);

-- Alert preferences RLS
ALTER TABLE brand_guard_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON brand_guard_alerts FOR SELECT USING (
  brand_monitor_id IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid())
);
CREATE POLICY "Users can insert own alerts" ON brand_guard_alerts FOR INSERT WITH CHECK (true); -- Service role inserts

CREATE POLICY "Users can view own preferences" ON dashboard_preferences FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can update own preferences" ON dashboard_preferences FOR UPDATE USING (auth.uid() = owner_id);
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
    'guardian',       -- $29/mo: 50 scans/mo, 3 brands, weekly monitoring
    'sentinel',       -- $79/mo: 200 scans/mo, 10 brands, daily monitoring
    'fortress'        -- $199/mo: Unlimited scans, Unlimited brands, real-time monitoring
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
  VALUES (p_owner_id, 25, 0, 0, now())
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