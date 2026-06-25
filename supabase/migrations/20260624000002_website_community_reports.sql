-- ============================================================
-- website_community_reports
-- Community-sourced flagging of scam/phishing/malware URLs
-- Applied to: drvasofyghnxfxvkkwad (agentic-bro-scam-detection)
-- ============================================================

CREATE TABLE IF NOT EXISTS website_community_reports (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  domain      text        NOT NULL,
  url         text,
  report_type text        NOT NULL CHECK (
    report_type IN ('phishing', 'scam', 'malware', 'fake_store', 'investment_fraud', 'impersonation', 'unknown')
  ),
  notes       text        CHECK (char_length(notes) <= 500),
  reported_at timestamptz DEFAULT now(),
  source      text        DEFAULT 'agenticbro_website'
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_website_reports_domain      ON website_community_reports(domain);
CREATE INDEX IF NOT EXISTS idx_website_reports_reported_at ON website_community_reports(reported_at DESC);

-- RLS: public read + public insert (no auth required, same as phone_community_reports)
ALTER TABLE website_community_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read website reports"
  ON website_community_reports FOR SELECT
  USING (true);

CREATE POLICY "Public insert website reports"
  ON website_community_reports FOR INSERT
  WITH CHECK (true);
