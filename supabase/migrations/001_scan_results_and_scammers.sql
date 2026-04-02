-- ============================================================
-- AgenticBro Supabase Migration
-- Tables: scan_results, known_scammers
-- Run this in your Supabase project's SQL Editor
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── scan_results table ────────────────────────────────────────────────────────
-- Stores every scam detection scan result

CREATE TABLE IF NOT EXISTS scan_results (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT        NOT NULL,
    platform        TEXT        NOT NULL CHECK (platform IN ('X', 'Telegram')),
    risk_score      DECIMAL(4,1) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 10),
    red_flags       JSONB       NOT NULL DEFAULT '[]',
    verification_level TEXT,
    scam_type       TEXT,
    recommended_action TEXT,
    full_report     TEXT,
    x_profile       JSONB,
    victim_reports  JSONB,
    known_scammer_match JSONB,
    evidence        JSONB       NOT NULL DEFAULT '[]',
    data_source     TEXT        DEFAULT 'live',
    wallet_address  TEXT,       -- wallet that ran the scan (optional)
    scanned_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_results_username    ON scan_results(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_scan_results_platform    ON scan_results(platform);
CREATE INDEX IF NOT EXISTS idx_scan_results_risk        ON scan_results(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_scan_results_scanned_at  ON scan_results(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_results_wallet      ON scan_results(wallet_address);

-- Row Level Security: public reads, anyone can insert (server-side will use service key)
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scan_results_public_read" ON scan_results;
CREATE POLICY "scan_results_public_read" ON scan_results
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "scan_results_insert" ON scan_results;
CREATE POLICY "scan_results_insert" ON scan_results
    FOR INSERT WITH CHECK (true);


-- ─── known_scammers table ──────────────────────────────────────────────────────
-- Unified database of known scammers from all local sources

CREATE TABLE IF NOT EXISTS known_scammers (
    id              TEXT        PRIMARY KEY DEFAULT 'SCM-' || to_char(NOW(), 'YYYYMMDD') || '-' || UPPER(substring(gen_random_uuid()::text, 1, 6)),
    platform        TEXT        NOT NULL DEFAULT 'other',
    username        TEXT        NOT NULL,
    display_name    TEXT,
    x_handle        TEXT,
    telegram_channel TEXT,
    impersonating   TEXT,
    scam_type       TEXT        NOT NULL DEFAULT 'other',
    victim_count    INTEGER     DEFAULT 0,
    total_lost_usd  TEXT        DEFAULT '0',
    verification_level TEXT     DEFAULT 'Unverified',
    threat_level    TEXT,       -- CRITICAL / HIGH / MEDIUM / LOW / Legitimate
    category        TEXT,
    status          TEXT        DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'unknown', 'Legitimate', 'pending')),
    risk_score      INTEGER     DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
    aliases         TEXT[],
    notes           TEXT,
    wallet_address  TEXT,
    evidence_links  TEXT,
    evidence_urls   TEXT[],
    violations      JSONB       DEFAULT '[]',
    red_flags       JSONB       DEFAULT '[]',
    scan_notes      TEXT,
    banned          BOOLEAN     DEFAULT false,
    banned_date     DATE,
    warn_count      INTEGER     DEFAULT 0,
    harassment      BOOLEAN     DEFAULT false,
    ban_evasion     BOOLEAN     DEFAULT false,
    first_reported  TIMESTAMPTZ DEFAULT NOW(),
    last_seen       TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(platform, username)
);

CREATE INDEX IF NOT EXISTS idx_known_scammers_username   ON known_scammers(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_known_scammers_platform   ON known_scammers(platform);
CREATE INDEX IF NOT EXISTS idx_known_scammers_x_handle   ON known_scammers(LOWER(x_handle));
CREATE INDEX IF NOT EXISTS idx_known_scammers_telegram   ON known_scammers(LOWER(telegram_channel));
CREATE INDEX IF NOT EXISTS idx_known_scammers_status     ON known_scammers(status);
CREATE INDEX IF NOT EXISTS idx_known_scammers_threat     ON known_scammers(threat_level);

-- Row Level Security: public reads, service key writes
ALTER TABLE known_scammers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "known_scammers_public_read" ON known_scammers;
CREATE POLICY "known_scammers_public_read" ON known_scammers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "known_scammers_service_write" ON known_scammers;
CREATE POLICY "known_scammers_service_write" ON known_scammers
    FOR ALL USING (true);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_known_scammers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_known_scammers_updated_at ON known_scammers;
CREATE TRIGGER trigger_known_scammers_updated_at
    BEFORE UPDATE ON known_scammers
    FOR EACH ROW EXECUTE FUNCTION update_known_scammers_updated_at();


-- ─── Convenience view: recent scans summary ────────────────────────────────────
CREATE OR REPLACE VIEW recent_scans_summary AS
SELECT
    username,
    platform,
    risk_score,
    verification_level,
    scam_type,
    scanned_at,
    wallet_address,
    CASE
        WHEN risk_score < 3  THEN 'LOW'
        WHEN risk_score < 5  THEN 'MEDIUM'
        WHEN risk_score < 7  THEN 'HIGH'
        ELSE 'CRITICAL'
    END AS risk_level
FROM scan_results
ORDER BY scanned_at DESC;


-- ─── Convenience view: confirmed scammers ─────────────────────────────────────
CREATE OR REPLACE VIEW confirmed_scammers AS
SELECT
    username,
    platform,
    x_handle,
    telegram_channel,
    scam_type,
    threat_level,
    victim_count,
    total_lost_usd,
    verification_level,
    notes,
    last_seen
FROM known_scammers
WHERE status IN ('active', 'pending')
  AND threat_level IN ('HIGH', 'CRITICAL')
ORDER BY
    CASE threat_level WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END,
    victim_count DESC;
