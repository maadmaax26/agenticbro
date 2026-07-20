-- Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
-- See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
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
