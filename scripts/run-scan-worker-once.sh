#!/bin/bash
# Run the scan worker once
cd /Users/efinney/.openclaw/workspace/scripts

export SUPABASE_URL="https://tkuqlqzhramryxsmlxge.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdXFscXpocmFtcnl4c21seGdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkzNjk5NywiZXhwIjoyMDg5NTEyOTk3fQ.UhbmW8Dhzeg7M0rR7YGEjzgVypl8Ehw6wY15KJYzMoA"

python3 scan-worker.py --once