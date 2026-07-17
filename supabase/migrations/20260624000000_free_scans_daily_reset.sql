-- Add free_scans_reset_at column for daily free scan reset
-- This allows 10 free scans per day (reset at midnight local time)

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS free_scans_reset_at timestamptz DEFAULT now();

-- Reset free_scans_used to 0 for all existing users (one-time reset for the increase from 5 to 10)
UPDATE user_profiles SET free_scans_used = 0 WHERE free_scans_used IS NOT NULL;