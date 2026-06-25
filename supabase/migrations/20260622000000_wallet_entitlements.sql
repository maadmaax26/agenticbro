-- ╔══════════════════════════════════════════════════════════════╗
-- ║  MIGRATION: Wallet Association & Scan Entitlements            ║
-- ║  Adds wallet_address, tier, monthly scan tracking to users    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── 1. Add columns to user_profiles (if table exists) ────────────────────────
-- If user_profiles doesn't exist yet, create it

CREATE TABLE IF NOT EXISTS user_profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                TEXT,
  wallet_address       TEXT,
  scan_credits         INT  NOT NULL DEFAULT 0,
  free_scans_used      INT  NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add entitlement columns
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS tier                    TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'holder', 'whale')),
  ADD COLUMN IF NOT EXISTS monthly_scans_limit     INT  NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS monthly_scans_used      INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_reset_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  ADD COLUMN IF NOT EXISTS last_entitlement_check  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_known_balance      BIGINT,
  ADD COLUMN IF NOT EXISTS last_known_usd_value    DECIMAL(15, 4);

-- ─── 2. Index on wallet_address for lookups ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet
  ON user_profiles(wallet_address)
  WHERE wallet_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_tier
  ON user_profiles(tier);

-- ─── 3. Updated_at trigger (idempotent) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_user_profiles_updated_at();

-- ─── 4. Monthly scan reset function ──────────────────────────────────────────
-- Called periodically (cron or on entitlement check) to reset monthly counters
CREATE OR REPLACE FUNCTION reset_monthly_scans_if_needed(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET
    monthly_scans_used = 0,
    monthly_reset_at = NOW() + INTERVAL '30 days'
  WHERE id = p_user_id
    AND monthly_reset_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ─── 5. Increment monthly scan usage ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_monthly_scan(p_user_id UUID)
RETURNS TABLE (
  success      BOOLEAN,
  remaining    INT,
  tier         TEXT,
  monthly_limit INT
) AS $$
DECLARE
  v_profile   user_profiles%ROWTYPE;
  v_remaining INT;
BEGIN
  -- Get profile with lock
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'free', 5;
    RETURN;
  END IF;

  -- Auto-reset if month has passed
  IF v_profile.monthly_reset_at < NOW() THEN
    UPDATE user_profiles
    SET monthly_scans_used = 0,
        monthly_reset_at = NOW() + INTERVAL '30 days'
    WHERE id = p_user_id
    RETURNING * INTO v_profile;
  END IF;

  -- Check if scans remaining
  -- whale tier = unlimited (monthly_scans_limit = -1)
  IF v_profile.monthly_scans_limit = -1 THEN
    v_remaining := -1;  -- unlimited
    UPDATE user_profiles SET monthly_scans_used = monthly_scans_used + 1 WHERE id = p_user_id;
    RETURN QUERY SELECT TRUE, v_remaining, v_profile.tier, v_profile.monthly_scans_limit;
    RETURN;
  END IF;

  -- Check free scans first (5 free, tracked by free_scans_used)
  IF v_profile.free_scans_used < 5 THEN
    UPDATE user_profiles SET free_scans_used = free_scans_used + 1 WHERE id = p_user_id;
    v_remaining := 5 - (v_profile.free_scans_used + 1);
    RETURN QUERY SELECT TRUE, v_remaining, v_profile.tier, v_profile.monthly_scans_limit;
    RETURN;
  END IF;

  -- Check paid credits
  IF v_profile.scan_credits > 0 THEN
    UPDATE user_profiles SET scan_credits = scan_credits - 1 WHERE id = p_user_id;
    v_remaining := v_profile.scan_credits - 1;
    RETURN QUERY SELECT TRUE, v_remaining, v_profile.tier, v_profile.monthly_scans_limit;
    RETURN;
  END IF;

  -- Check monthly tier scans
  IF v_profile.monthly_scans_used < v_profile.monthly_scans_limit THEN
    UPDATE user_profiles SET monthly_scans_used = monthly_scans_used + 1 WHERE id = p_user_id;
    v_remaining := v_profile.monthly_scans_limit - (v_profile.monthly_scans_used + 1);
    RETURN QUERY SELECT TRUE, v_remaining, v_profile.tier, v_profile.monthly_scans_limit;
    RETURN;
  END IF;

  -- No scans remaining
  v_remaining := 0;
  RETURN QUERY SELECT FALSE, v_remaining, v_profile.tier, v_profile.monthly_scans_limit;
END;
$$ LANGUAGE plpgsql;

-- ─── 6. Update tier based on wallet balance ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_user_tier(
  p_user_id    UUID,
  p_balance    BIGINT,
  p_usd_value  DECIMAL
)
RETURNS TABLE (
  tier             TEXT,
  monthly_limit    INT,
  is_new_tier      BOOLEAN
) AS $$
DECLARE
  v_old_tier   TEXT;
  v_new_tier   TEXT;
  v_new_limit  INT;
BEGIN
  SELECT tier INTO v_old_tier FROM user_profiles WHERE id = p_user_id;

  -- Determine new tier
  IF p_usd_value >= 1000 THEN
    v_new_tier := 'whale';
    v_new_limit := -1;  -- unlimited
  ELSIF p_usd_value >= 100 THEN
    v_new_tier := 'holder';
    v_new_limit := 100;
  ELSE
    v_new_tier := 'free';
    v_new_limit := 5;
  END IF;

  -- Update profile
  UPDATE user_profiles
  SET
    tier                   = v_new_tier,
    monthly_scans_limit    = v_new_limit,
    last_known_balance     = p_balance,
    last_known_usd_value   = p_usd_value,
    last_entitlement_check = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_new_tier, v_new_limit, (v_old_tier IS DISTINCT FROM v_new_tier);
END;
$$ LANGUAGE plpgsql;

-- ─── 7. RLS Policies ─────────────────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (e.g., link wallet)
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Service role has full access
DROP POLICY IF EXISTS "Service role full access" ON user_profiles;
CREATE POLICY "Service role full access"
  ON user_profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
