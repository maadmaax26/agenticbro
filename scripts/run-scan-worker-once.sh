#!/bin/bash
# Run the scan worker once
cd /Users/efinney/.openclaw/workspace/scripts

# Load secrets from .env file (not committed to git)
if [ -f "../.env" ]; then
  source ../.env
fi

# Fallback: check for env vars already set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env or environment"
  exit 1
fi

echo "[$(date)] Starting scan worker..." >&2
python3 scan-worker.py --once 2>&1
echo "[$(date)] Scan worker finished with exit code $?" >&2