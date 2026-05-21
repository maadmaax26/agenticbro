#!/bin/bash
# Phone Scan API Wrapper — Agentic Bro
# Usage: bash phone-scan-api.sh "+14158586273" [US]
set -euo pipefail
PHONE="${1:?Usage: bash phone-scan-api.sh +14158586273 [COUNTRY_CODE]}"
COUNTRY="${2:-US}"
cd /Users/efinney/.openclaw/workspace/scripts && python3 phone_scan_api.py "$PHONE" "$COUNTRY"