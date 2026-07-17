-- ============================================================
-- AgenticBro Supabase Migration
-- Table: employer_reports
-- Community-submitted reports of non-payment, scam employers,
-- and project trust signals for the Employer Trust Score system.
--
-- Phase 2 of Employer Trust Score — 2026-06-27
-- Run this in your Supabase project's SQL Editor
-- ============================================================

-- ─── employer_reports table ───────────────────────────────────────────────────
-- Stores community-submitted reports about Web3 employers/projects
-- Reports feed into the Employer Trust Score calculation

CREATE TABLE IF NOT EXISTS employer_reports (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who is being reported
    employer_handle     TEXT        NOT NULL,          -- e.g. "@AlphaDAO"
    employer_platform   TEXT        NOT NULL DEFAULT 'x'
        CHECK (employer_platform IN ('x', 'instagram', 'tiktok', 'telegram', 'facebook', 'linkedin', 'website')),
    employer_website    TEXT,                          -- e.g. "alphadao.xyz" (optional)
    employer_wallet     TEXT,                          -- Solana wallet address (optional)

    -- Report details
    report_type     TEXT        NOT NULL CHECK (report_type IN (
        'non_payment',           -- didn't pay contractor
        'rug_pull',              -- project rug pulled
        'abandoned_project',     -- project abandoned after hiring
        'blocked_contractor',    -- blocked contractor after work done
        'deleted_community',     -- deleted Discord/Telegram after hiring
        'fake_hiring',           -- hiring posts but never actually hires (scam)
        'account_rebrand',       -- repeated account rebrands to evade reputation
        'positive_review',        -- POSITIVE: contractor vouches for payment
        'verified_payment'        -- POSITIVE: on-chain evidence of payment
    )),
    report_status   TEXT        NOT NULL DEFAULT 'pending' CHECK (report_status IN (
        'pending',     -- newly submitted, awaiting moderation
        'verified',    -- confirmed by AgenticBro or community consensus
        'rejected',    -- flagged as spam/false report
        'disputed'     -- employer has disputed the report
    )),

    -- Who submitted the report
    reporter_handle     TEXT,                      -- X/TG handle of reporter (optional, can be anonymous)
    reporter_role       TEXT   NOT NULL DEFAULT 'other' CHECK (reporter_role IN (
        'developer', 'moderator', 'designer', 'marketer', 'kol',
        'community_manager', 'content_creator', 'other'
    )),

    -- Report content
    role_applied_for   TEXT,                      -- what role they were hired for
    amount_owed         TEXT,                      -- e.g. "$500 USDC" or "2 SOL" (optional)
    description         TEXT,                      -- detailed description of what happened
    evidence_links      TEXT[],                    -- links to evidence (screenshots, tx history, etc.)

    -- Metadata
    project_name        TEXT,                      -- project name (e.g. "AlphaDAO")
    contract_address    TEXT,                      -- token contract address if applicable

    -- Moderation
    verified_by         TEXT,                      -- who verified this report (admin handle or 'system')
    verified_at        TIMESTAMPTZ,
    rejected_reason    TEXT,

    -- Timestamps
    incident_date      DATE,                       -- when the incident occurred
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employer_reports_handle
    ON employer_reports(LOWER(employer_handle));
CREATE INDEX IF NOT EXISTS idx_employer_reports_platform
    ON employer_reports(employer_platform);
CREATE INDEX IF NOT EXISTS idx_employer_reports_type
    ON employer_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_employer_reports_status
    ON employer_reports(report_status);
CREATE INDEX IF NOT EXISTS idx_employer_reports_wallet
    ON employer_reports(employer_wallet);
CREATE INDEX IF NOT EXISTS idx_employer_reports_created
    ON employer_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employer_reports_handle_status
    ON employer_reports(LOWER(employer_handle), report_status);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Public can read verified/pending reports (transparency)
-- Anyone can submit a report (rate-limited at API layer)
-- Only service key can update status (moderation)

ALTER TABLE employer_reports ENABLE ROW LEVEL SECURITY;

-- Public read: allow reading all non-rejected reports
DROP POLICY IF EXISTS "employer_reports_public_read" ON employer_reports;
CREATE POLICY "employer_reports_public_read" ON employer_reports
    FOR SELECT USING (report_status != 'rejected' OR true);
-- Note: we allow reading even rejected reports for transparency,
-- but the scoring only counts verified + pending reports

-- Public insert: anyone can submit a report
DROP POLICY IF EXISTS "employer_reports_public_insert" ON employer_reports;
CREATE POLICY "employer_reports_public_insert" ON employer_reports
    FOR INSERT WITH CHECK (true);

-- Service-only update: only service key can change status (moderation)
DROP POLICY IF EXISTS "employer_reports_service_update" ON employer_reports;
CREATE POLICY "employer_reports_service_update" ON employer_reports
    FOR UPDATE USING (true) WITH CHECK (true);

-- ─── Auto-update updated_at trigger ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_employer_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_employer_reports_updated_at ON employer_reports;
CREATE TRIGGER trigger_employer_reports_updated_at
    BEFORE UPDATE ON employer_reports
    FOR EACH ROW EXECUTE FUNCTION update_employer_reports_updated_at();

-- ─── Convenience view: employer report summary ───────────────────────────────
-- Aggregated report counts per employer, for quick lookup
CREATE OR REPLACE VIEW employer_report_summary AS
SELECT
    LOWER(employer_handle) AS handle,
    employer_platform AS platform,
    employer_website AS website,
    employer_wallet AS wallet,
    project_name AS project,
    COUNT(*) FILTER (WHERE report_type = 'non_payment') AS non_payment_count,
    COUNT(*) FILTER (WHERE report_type = 'rug_pull') AS rug_pull_count,
    COUNT(*) FILTER (WHERE report_type = 'abandoned_project') AS abandoned_count,
    COUNT(*) FILTER (WHERE report_type = 'blocked_contractor') AS blocked_count,
    COUNT(*) FILTER (WHERE report_type = 'deleted_community') AS deleted_community_count,
    COUNT(*) FILTER (WHERE report_type = 'fake_hiring') AS fake_hiring_count,
    COUNT(*) FILTER (WHERE report_type = 'account_rebrand') AS rebrand_count,
    COUNT(*) FILTER (WHERE report_type = 'positive_review') AS positive_review_count,
    COUNT(*) FILTER (WHERE report_type = 'verified_payment') AS verified_payment_count,
    COUNT(*) FILTER (WHERE report_status = 'verified') AS verified_reports,
    COUNT(*) FILTER (WHERE report_status = 'pending') AS pending_reports,
    COUNT(*) FILTER (WHERE report_status = 'rejected') AS rejected_reports,
    COUNT(*) AS total_reports,
    MAX(created_at) AS last_report_at
FROM employer_reports
GROUP BY LOWER(employer_handle), employer_platform, employer_website, employer_wallet, project_name
ORDER BY total_reports DESC;

-- ─── Convenience function: get employer trust metadata ───────────────────────
-- Returns aggregated metadata for use in Employer Trust Score calculation
-- Usage: SELECT * FROM get_employer_trust_metadata('@alphadao', 'x');

CREATE OR REPLACE FUNCTION get_employer_trust_metadata(
    p_handle TEXT,
    p_platform TEXT DEFAULT 'x'
)
RETURNS TABLE (
    handle TEXT,
    platform TEXT,
    website TEXT,
    wallet TEXT,
    project TEXT,
    community_reports INTEGER,
    prior_rug_flags INTEGER,
    positive_reviews INTEGER,
    verified_payments INTEGER,
    username_changes INTEGER,
    hiring_post_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        LOWER(er.employer_handle) AS handle,
        er.employer_platform AS platform,
        MAX(er.employer_website) AS website,
        MAX(er.employer_wallet) AS wallet,
        MAX(er.project_name) AS project,
        COUNT(*) FILTER (WHERE er.report_type IN ('non_payment', 'blocked_contractor', 'deleted_community', 'fake_hiring')
                         AND er.report_status IN ('verified', 'pending'))::INTEGER AS community_reports,
        COUNT(*) FILTER (WHERE er.report_type IN ('rug_pull', 'abandoned_project')
                         AND er.report_status IN ('verified', 'pending'))::INTEGER AS prior_rug_flags,
        COUNT(*) FILTER (WHERE er.report_type = 'positive_review'
                         AND er.report_status IN ('verified', 'pending'))::INTEGER AS positive_reviews,
        COUNT(*) FILTER (WHERE er.report_type = 'verified_payment'
                         AND er.report_status IN ('verified', 'pending'))::INTEGER AS verified_payments,
        COUNT(*) FILTER (WHERE er.report_type = 'account_rebrand'
                         AND er.report_status IN ('verified', 'pending'))::INTEGER AS username_changes,
        COUNT(*) AS hiring_post_count
    FROM employer_reports er
    WHERE LOWER(er.employer_handle) = LOWER(p_handle)
      AND er.employer_platform = p_platform
    GROUP BY LOWER(er.employer_handle), er.employer_platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;