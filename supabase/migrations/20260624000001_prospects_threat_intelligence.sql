-- Add threat_category and financial_impact_score columns to prospects table
-- These integrate the outreach intelligence system with the prospects pipeline

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS threat_category text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS financial_impact_score numeric(5,2);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS threat_tier text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS threat_loss_usd bigint;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS threat_incident_count integer;

-- Add comment for documentation
COMMENT ON COLUMN prospects.threat_category IS 'Threat category from outreach intelligence: domain_impersonation, marketplace_counterfeit, or email_spoofing';
COMMENT ON COLUMN prospects.financial_impact_score IS 'Financial impact score 0-100 from industry rankings';
COMMENT ON COLUMN prospects.threat_tier IS 'Priority tier: S, A, B, C, or D';
COMMENT ON COLUMN prospects.threat_loss_usd IS 'Annual loss figure (USD) for this industry+category combination';
COMMENT ON COLUMN prospects.threat_incident_count IS 'Annual incident count for this industry+category combination';

-- Create index for filtering by threat category
CREATE INDEX IF NOT EXISTS idx_prospects_threat_category ON prospects(threat_category) WHERE threat_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_threat_tier ON prospects(threat_tier) WHERE threat_tier IS NOT NULL;