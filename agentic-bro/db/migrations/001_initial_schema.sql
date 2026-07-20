-- Agentic Bro Database Schema
-- Version: 1.0.0
-- Created: 2026-03-30

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE scam_type AS ENUM (
    'giveaway_fraud',
    'investment_fraud',
    'pig_butchering',
    'phishing',
    'impersonation',
    'rug_pull',
    'wallet_drainer',
    'ponzi_scheme',
    'romance_scam',
    'other'
);

CREATE TYPE platform_type AS ENUM (
    'twitter',
    'telegram',
    'discord',
    'other'
);

CREATE TYPE risk_level AS ENUM (
    'verified',
    'safe',
    'caution',
    'unsafe',
    'scam'
);

CREATE TYPE token_risk_level AS ENUM (
    'safe',
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE account_status AS ENUM (
    'active',
    'suspended',
    'unknown'
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE,
    email VARCHAR(255) UNIQUE,
    tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'pro', 'team', 'enterprise')),
    scans_used_today INTEGER DEFAULT 0,
    scans_reset_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 day',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- API Keys table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) DEFAULT 'Default',
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- Known Scammers table
CREATE TABLE known_scammers (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'SCM-' || to_char(NOW(), 'YYYYMMDD') || '-' || substring(uuid_generate_v4()::text, 1, 6),
    platform platform_type NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    impersonating VARCHAR(100),
    scam_type scam_type NOT NULL DEFAULT 'other',
    victim_count INTEGER DEFAULT 0,
    total_lost_usd DECIMAL(15, 2) DEFAULT 0,
    evidence_urls TEXT[],
    first_reported TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW(),
    status account_status DEFAULT 'active',
    risk_score INTEGER DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
    aliases TEXT[],
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(platform, username)
);

CREATE INDEX idx_scammers_platform ON known_scammers(platform);
CREATE INDEX idx_scammers_username ON known_scammers(LOWER(username));
CREATE INDEX idx_scammers_impersonating ON known_scammers(impersonating);
CREATE INDEX idx_scammers_status ON known_scammers(status);
CREATE INDEX idx_scammers_risk ON known_scammers(risk_score DESC);
CREATE INDEX idx_scammers_victims ON known_scammers(victim_count DESC);

-- Verified Accounts table (whitelist)
CREATE TABLE verified_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform platform_type NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    verified_type VARCHAR(20) CHECK (verified_type IN ('blue', 'gold', 'gray', 'government')),
    verified_since TIMESTAMP,
    category VARCHAR(100),
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(platform, username)
);

CREATE INDEX idx_verified_platform ON verified_accounts(platform);
CREATE INDEX idx_verified_username ON verified_accounts(LOWER(username));

-- Token Scan History table
CREATE TABLE token_scan_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(100) NOT NULL,
    chain VARCHAR(20) DEFAULT 'solana',
    token_symbol VARCHAR(50),
    token_name VARCHAR(200),
    risk_score DECIMAL(3, 1) NOT NULL,
    risk_level token_risk_level NOT NULL,
    categories JSONB NOT NULL,
    user_id UUID REFERENCES users(id),
    scan_time TIMESTAMP DEFAULT NOW(),
    
    -- Additional data
    liquidity_usd DECIMAL(15, 2),
    market_cap_usd DECIMAL(15, 2),
    holders_count INTEGER,
    dev_holdings_percent DECIMAL(5, 2),
    is_honeypot BOOLEAN,
    liquidity_locked BOOLEAN
);

CREATE INDEX idx_token_scans_contract ON token_scan_history(contract_address);
CREATE INDEX idx_token_scans_time ON token_scan_history(scan_time DESC);
CREATE INDEX idx_token_scans_risk ON token_scan_history(risk_score DESC);
CREATE INDEX idx_token_scans_user ON token_scan_history(user_id);

-- Profile Verification History table
CREATE TABLE profile_verification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform platform_type NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    authenticity_score INTEGER NOT NULL CHECK (authenticity_score >= 0 AND authenticity_score <= 100),
    risk_level risk_level NOT NULL,
    categories JSONB NOT NULL,
    user_id UUID REFERENCES users(id),
    scan_time TIMESTAMP DEFAULT NOW(),
    
    -- Profile data snapshot
    verified BOOLEAN,
    followers_count INTEGER,
    following_count INTEGER,
    account_age_days INTEGER,
    bot_score INTEGER,
    fake_followers_percent DECIMAL(5, 2)
);

CREATE INDEX idx_profile_scans_platform ON profile_verification_history(platform);
CREATE INDEX idx_profile_scans_username ON profile_verification_history(LOWER(username));
CREATE INDEX idx_profile_scans_time ON profile_verification_history(scan_time DESC);
CREATE INDEX idx_profile_scans_score ON profile_verification_history(authenticity_score);

-- Scammer Reports table
CREATE TABLE scammer_reports (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'RPT-' || to_char(NOW(), 'YYYYMMDD') || '-' || substring(uuid_generate_v4()::text, 1, 6),
    platform platform_type NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    scam_type scam_type NOT NULL,
    impersonating VARCHAR(100),
    evidence_urls TEXT[],
    description TEXT,
    victim_amount DECIMAL(15, 2),
    reporter_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'under_review', 'confirmed', 'rejected', 'spam')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    reviewer_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reports_status ON scammer_reports(status);
CREATE INDEX idx_reports_platform_username ON scammer_reports(platform, LOWER(username));
CREATE INDEX idx_reports_reporter ON scammer_reports(reporter_id);
CREATE INDEX idx_reports_time ON scammer_reports(created_at DESC);

-- User Sessions table (for tracking)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_key VARCHAR(255) UNIQUE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days',
    last_active TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

-- API Usage Analytics table
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    endpoint VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Partitioned by date for performance
    date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX idx_usage_user ON api_usage(user_id);
CREATE INDEX idx_usage_endpoint ON api_usage(endpoint);
CREATE INDEX idx_usage_date ON api_usage(date);

-- Subscription Plans table
CREATE TABLE subscription_plans (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    tier VARCHAR(20) NOT NULL,
    price_usd DECIMAL(10, 2) NOT NULL,
    price_agntcbro INTEGER,
    scans_per_day INTEGER,
    verifications_per_day INTEGER,
    features JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default plans
INSERT INTO subscription_plans (id, name, tier, price_usd, price_agntcbro, scans_per_day, verifications_per_day, features) VALUES
('free', 'Free', 'free', 0, 0, 5, 3, '{"deep_scan": false, "media_analysis": false, "history_days": 7}'),
('basic', 'Basic', 'basic', 29.00, 2500, 50, 25, '{"deep_scan": true, "media_analysis": false, "history_days": 30}'),
('pro', 'Professional', 'pro', 99.00, 8500, 200, 100, '{"deep_scan": true, "media_analysis": true, "history_days": 90}'),
('team', 'Team', 'team', 299.00, 25000, 1000, 500, '{"deep_scan": true, "media_analysis": true, "history_days": 365, "team_members": 5}'),
('enterprise', 'Enterprise', 'enterprise', 999.00, 85000, NULL, NULL, '{"deep_scan": true, "media_analysis": true, "history_days": -1, "api_access": true, "priority_support": true}');

-- User Subscriptions table
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id VARCHAR(20) REFERENCES subscription_plans(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
    started_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    payment_method VARCHAR(20),
    payment_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON user_subscriptions(status);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_scammers_updated_at
    BEFORE UPDATE ON known_scammers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON scammer_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create functions for analytics
CREATE OR REPLACE FUNCTION get_daily_stats(date_param DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    total_scans BIGINT,
    total_verifications BIGINT,
    total_users BIGINT,
    new_users BIGINT,
    scammers_reported BIGINT,
    avg_scan_risk DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM token_scan_history WHERE DATE(scan_time) = date_param),
        (SELECT COUNT(*) FROM profile_verification_history WHERE DATE(scan_time) = date_param),
        (SELECT COUNT(*) FROM users),
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) = date_param),
        (SELECT COUNT(*) FROM scammer_reports WHERE DATE(created_at) = date_param),
        (SELECT AVG(risk_score) FROM token_scan_history WHERE DATE(scan_time) = date_param);
END;
$$ LANGUAGE plpgsql;

-- Create function for scammer similarity search
CREATE OR REPLACE FUNCTION search_similar_scammers(
    search_username VARCHAR,
    search_platform platform_type DEFAULT NULL,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id VARCHAR,
    username VARCHAR,
    display_name VARCHAR,
    impersonating VARCHAR,
    scam_type scam_type,
    similarity_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ks.id,
        ks.username,
        ks.display_name,
        ks.impersonating,
        ks.scam_type,
        similarity(LOWER(ks.username), LOWER(search_username))::DECIMAL AS similarity_score
    FROM known_scammers ks
    WHERE 
        (search_platform IS NULL OR ks.platform = search_platform)
        AND ks.status = 'active'
        AND similarity(LOWER(ks.username), LOWER(search_username)) > 0.3
    ORDER BY similarity_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for dashboard stats
CREATE VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM users WHERE tier != 'free') AS paid_users,
    (SELECT COUNT(*) FROM known_scammers WHERE status = 'active') AS active_scammers,
    (SELECT SUM(victim_count) FROM known_scammers) AS total_victims,
    (SELECT SUM(total_lost_usd) FROM known_scammers) AS total_lost_usd,
    (SELECT COUNT(*) FROM token_scan_history WHERE DATE(scan_time) = CURRENT_DATE) AS scans_today,
    (SELECT COUNT(*) FROM profile_verification_history WHERE DATE(scan_time) = CURRENT_DATE) AS verifications_today,
    (SELECT AVG(authenticity_score) FROM profile_verification_history WHERE DATE(scan_time) = CURRENT_DATE) AS avg_authenticity_today;

-- Grant permissions (adjust as needed)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agenticbro;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO agenticbro;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO agenticbro;

-- Insert sample verified accounts
INSERT INTO verified_accounts (platform, username, display_name, verified_type, category) VALUES
('twitter', 'elonmusk', 'Elon Musk', 'blue', 'Business'),
('twitter', 'saylor', 'Michael Saylor', 'blue', 'Business'),
('twitter', 'aantonop', 'Andreas M. Antonopoulos', 'blue', 'Education'),
('twitter', 'VitalikButerin', 'Vitalik Buterin', 'blue', 'Technology'),
('twitter', 'naval', 'Naval', 'blue', 'Investment');

-- Insert sample known scammers
INSERT INTO known_scammers (platform, username, display_name, scam_type, impersonating, victim_count, total_lost_usd, notes) VALUES
('twitter', 'elon_musk_giveaway', 'Elon Musk Giveaway', 'giveaway_fraud', 'elonmusk', 47, 125000.00, 'Classic giveaway scam, asks users to send SOL for "double back"'),
('twitter', 'saylor_bitcoin', 'Michael Saylor Bitcoin', 'giveaway_fraud', 'saylor', 23, 45000.00, 'Impersonation scam targeting Bitcoin holders'),
('telegram', 'solana_airdrop_official', 'Solana Airdrop Official', 'phishing', NULL, 156, 340000.00, 'Phishing links to drain wallets'),
('twitter', 'vitalik_eth_2', 'Vitalik Ethereum', 'impersonation', 'VitalikButerin', 89, 180000.00, 'Impersonation account with deepfake content');

-- Create initial admin user
INSERT INTO users (email, tier) VALUES ('admin@agenticbro.app', 'enterprise');