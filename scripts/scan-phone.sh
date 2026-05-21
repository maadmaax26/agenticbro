#!/bin/bash
# Phone Number Scam Scanner — Agentic Bro
# Uses Numverify API to validate and risk-score phone numbers
# Usage: bash scan-phone.sh "+14158586273" [country_code]

set -euo pipefail

PHONE="${1:?Usage: bash scan-phone.sh '+14158586273' [country_code]}"
COUNTRY="${2:-US}"

# Load API key
NUMVERIFY_API_KEY=$(grep NUMVERIFY_API_KEY /tmp/agenticbro/.env.local 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")

if [ -z "$NUMVERIFY_API_KEY" ]; then
    echo '{"error": "NUMVERIFY_API_KEY not found in /tmp/agenticbro/.env.local"}'
    exit 1
fi

# Strip formatting from phone number
CLEAN_PHONE=$(echo "$PHONE" | tr -d ' -()')

# Call Numverify API and save to temp file
RESULT_FILE=$(mktemp)
curl -s "http://apilayer.net/api/validate?access_key=${NUMVERIFY_API_KEY}&number=${CLEAN_PHONE}&country_code=${COUNTRY}" -o "$RESULT_FILE" 2>/dev/null

# Run Python scoring with the result file
python3 /Users/efinney/.openclaw/workspace/scripts/phone_scorer.py "$RESULT_FILE" "$PHONE"

# Cleanup
rm -f "$RESULT_FILE"