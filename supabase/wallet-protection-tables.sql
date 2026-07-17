-- Wallet Protection System Tables
-- Phase 4: Integration with Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Wallet protection events (all analyzed transactions)
CREATE TABLE IF NOT EXISTS wallet_protection_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  
  -- Transaction details
  transaction_signature TEXT,
  dapp_url TEXT NOT NULL,
  dapp_domain TEXT,
  
  -- Risk assessment
  risk_score DECIMAL(3,1) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 10),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('SAFE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  recommendation TEXT NOT NULL CHECK (recommendation IN ('APPROVE', 'CAUTION', 'REJECT', 'BLOCK')),
  
  -- Decision
  user_decision TEXT NOT NULL CHECK (user_decision IN ('approved', 'rejected', 'blocked')),
  
  -- Instruction breakdown (JSON)
  instructions JSONB DEFAULT '[]',
  flags JSONB DEFAULT '[]',
  
  -- Token extensions detected
  token_extensions JSONB DEFAULT '[]',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  
  -- Indexes
  INDEX idx_wallet_events_user (user_id),
  INDEX idx_wallet_events_session (session_id),
  INDEX idx_wallet_events_created (created_at),
  INDEX idx_wallet_events_risk (risk_score)
);

-- Active approvals (token approvals, etc.)
CREATE TABLE IF NOT EXISTS active_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Approval details
  dapp_url TEXT NOT NULL,
  dapp_domain TEXT,
  
  -- Token being approved
  token_mint TEXT NOT NULL,
  token_symbol TEXT,
  token_name TEXT,
  
  -- Spender
  spender_address TEXT NOT NULL,
  spender_name TEXT,
  
  -- Amount
  amount TEXT, -- 'unlimited' or specific amount
  amount_raw TEXT,
  
  -- Risk assessment at time of approval
  risk_score DECIMAL(3,1) NOT NULL,
  risk_level TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  
  -- Expiry
  expires_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  
  -- Indexes
  INDEX idx_approvals_user (user_id),
  INDEX idx_approvals_token (token_mint),
  INDEX idx_approvals_spender (spender_address),
  INDEX idx_approvals_status (status)
);

-- Blocked addresses (user-blocked malicious addresses)
CREATE TABLE IF NOT EXISTS blocked_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Address details
  address TEXT NOT NULL,
  
  -- Why blocked
  reason TEXT,
  source TEXT CHECK (source IN ('user', 'automatic', 'database')),
  
  -- Transaction that caused the block
  blocking_transaction TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(user_id, address),
  
  -- Indexes
  INDEX idx_blocked_user (user_id),
  INDEX idx_blocked_address (address)
);

-- Known drainer contracts (global database)
CREATE TABLE IF NOT EXISTS known_drainers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Address
  address TEXT NOT NULL UNIQUE,
  
  -- Identification
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('drainer_contract', 'phishing_site', 'malicious_token')),
  
  -- Risk level
  risk_level TEXT NOT NULL DEFAULT 'CRITICAL',
  
  -- Source of identification
  source TEXT,
  reference_url TEXT,
  
  -- Metadata
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  total_stolen_usd DECIMAL(20, 2),
  victim_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_drainers_address (address),
  INDEX idx_drainers_type (type)
);

-- Wallet sessions (for tracking user sessions)
CREATE TABLE IF NOT EXISTS wallet_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session details
  session_token TEXT NOT NULL UNIQUE,
  
  -- Wallet
  wallet_address TEXT NOT NULL,
  wallet_type TEXT CHECK (wallet_type IN ('phantom', 'solflare', 'backpack', 'other')),
  
  -- Session metadata
  ip_address TEXT,
  user_agent TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Indexes
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_token (session_token),
  INDEX idx_sessions_active (is_active)
);

-- Row Level Security (RLS) Policies

-- wallet_protection_events
ALTER TABLE wallet_protection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet events"
  ON wallet_protection_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet events"
  ON wallet_protection_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- active_approvals
ALTER TABLE active_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own approvals"
  ON active_approvals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own approvals"
  ON active_approvals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own approvals"
  ON active_approvals FOR UPDATE
  USING (auth.uid() = user_id);

-- blocked_addresses
ALTER TABLE blocked_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocked addresses"
  ON blocked_addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own blocked addresses"
  ON blocked_addresses FOR ALL
  USING (auth.uid() = user_id);

-- known_drainers (public read, admin write)
ALTER TABLE known_drainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to known drainers"
  ON known_drainers FOR SELECT
  USING (true);

-- wallet_sessions
ALTER TABLE wallet_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON wallet_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sessions"
  ON wallet_sessions FOR ALL
  USING (auth.uid() = user_id);

-- Functions

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_known_drainers_updated_at
  BEFORE UPDATE ON known_drainers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM wallet_sessions
  WHERE expires_at < NOW() OR (last_activity < NOW() - INTERVAL '24 hours' AND is_active = FALSE);
END;
$$ LANGUAGE plpgsql;

-- Get user stats
CREATE OR REPLACE FUNCTION get_user_wallet_stats(p_user_id UUID)
RETURNS TABLE (
  total_transactions BIGINT,
  blocked_count BIGINT,
  rejected_count BIGINT,
  approved_count BIGINT,
  average_risk_score DECIMAL(3,1),
  active_approvals_count BIGINT,
  blocked_addresses_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM wallet_protection_events WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM wallet_protection_events WHERE user_id = p_user_id AND user_decision = 'blocked'),
    (SELECT COUNT(*) FROM wallet_protection_events WHERE user_id = p_user_id AND user_decision = 'rejected'),
    (SELECT COUNT(*) FROM wallet_protection_events WHERE user_id = p_user_id AND user_decision = 'approved'),
    (SELECT COALESCE(AVG(risk_score), 0) FROM wallet_protection_events WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM active_approvals WHERE user_id = p_user_id AND status = 'active'),
    (SELECT COUNT(*) FROM blocked_addresses WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;