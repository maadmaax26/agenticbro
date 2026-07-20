-- Gmail Draft Pusher — schema migration
-- Run this in the Supabase SQL editor for the outreach DB (tkuqlqzhramryxsmlxge)
-- These columns track which drafts have been pushed to Gmail

ALTER TABLE outreach_drafts ADD COLUMN IF NOT EXISTS gmail_draft_id text;
ALTER TABLE outreach_drafts ADD COLUMN IF NOT EXISTS gmail_drafted_at timestamptz;

-- Optional: index for faster lookups
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_gmail_draft_id 
  ON outreach_drafts(gmail_draft_id) 
  WHERE gmail_draft_id IS NOT NULL;