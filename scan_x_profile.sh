#!/bin/bash
# X/Twitter Profile Scam Scanner - Browser Automation
# Usage: scan_x_profile.sh <username>
# Method: Chrome CDP via Python WebSocket

set -euo pipefail

USERNAME="${1:-}"
if [ -z "$USERNAME" ]; then
    echo "Usage: scan_x_profile.sh <username>"
    exit 1
fi

# Strip @ prefix if present
USERNAME="${USERNAME#@}"
WORKSPACE="/Users/efinney/.openclaw/workspace"
TIMESTAMP=$(date +%s)
PROFILE_URL="https://x.com/${USERNAME}"

echo "🔍 X Profile Scan — @${USERNAME}"
echo "URL: ${PROFILE_URL}"
echo ""
echo "🚀 Initializing Chrome CDP scan..."
echo ""

# Use Python for reliable CDP data extraction
export SCAN_USERNAME="$USERNAME"
python3 /Users/efinney/.openclaw/workspace/scripts/scan_x_cdp.py "$USERNAME"

echo ""
echo "────────────────────────────────────────"
echo "Scan completed at: $(date)"
echo "Agentic Bro • t.me/Agenticbro1 • t.me/agenticbro11"
echo "────────────────────────────────────────"