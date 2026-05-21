#!/bin/bash
# Facebook Profile Scanner (Unified Scoring)
# Usage: bash scan-facebook.sh @username
# Uses unified 90-point weighted scoring for consistent results

set -uo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
USERNAME="${1#@}"
SCAN_DATE=$(date '+%Y-%m-%d')

if [ -z "$USERNAME" ]; then
    echo "Usage: bash scan-facebook.sh <username>"
    exit 1
fi

PROFILE_URL="https://www.facebook.com/${USERNAME}"
TEMP_FILE="/tmp/fb_scan_${USERNAME}_$$.html"

echo "━━━ 🔍 FACEBOOK PROFILE SCAN — AI POWERED ASSESSMENT ━━━"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  DISCLAIMER NOTICE"
echo ""
echo "This scan is an AI-powered threat assessment of social media content."
echo "For complete accuracy, verify information through multiple sources."
echo ""
echo "LIMITATIONS:"
echo "• Only scans public profile data"
echo "• Does NOT verify user identity"
echo "• May miss sophisticated, well-hidden scams"
echo "• Subject to platform rules and rate limiting"
echo ""
echo "INDEPENDENT VERIFICATION REQUIRED:"
echo "• Cross-check username across multiple platforms"
echo "• Verify contract addresses manually"
echo "• Never send money or share private keys"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Fetch content with mobile Facebook user-agent
USER_AGENT="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FBAN/FBForIphone/FBIVAN/iPhone"

HTTP_CODE=$(curl -s -o "$TEMP_FILE" -w "%{http_code}" \
    -H "User-Agent: ${USER_AGENT}" \
    -H "Accept: text/html,application/xhtml+xml" \
    -H "Accept-Language: en-US,en;q=0.9" \
    "${PROFILE_URL}" 2>/dev/null)

# Check if we got useful data
CONTENT=""
if [ -f "$TEMP_FILE" ]; then
    CONTENT=$(cat "$TEMP_FILE" 2>/dev/null | head -c 50000)
fi

if [ -z "$CONTENT" ] || echo "$CONTENT" | grep -qi "login\|not found\|page isn't available\|sorry"; then
    echo "🔍 Platform: Facebook"
    echo "👤 Account: ${USERNAME}"
    echo "📡 Method: HTTP Profile Fetch"
    echo ""
    echo "⚠️  PROFILE INACCESSIBLE"
    echo ""
    echo "Facebook requires authentication or this profile doesn't exist."
    echo ""
    echo "📊 Risk Score: N/A (Profile Inaccessible)"
    echo "⚠️  Risk Level: UNKNOWN"
    echo ""
    echo "RECOMMENDATIONS:"
    echo "• Check the same username on X/Twitter or Instagram instead"
    echo "• Use Chrome CDP browser scan for full Facebook access"
    echo "• Private/restricted profiles may warrant additional caution"
    echo ""
    echo "📋 Disclaimer: Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR. Scan date: ${SCAN_DATE}"
    rm -f "$TEMP_FILE" 2>/dev/null
    exit 0
fi

# Run Python unified scoring using env vars (safe from shell injection)
SCAN_USERNAME="$USERNAME" SCAN_TEMP_FILE="$TEMP_FILE" python3 << 'PYEOF' 2>/dev/null
import sys
import os
import re
from datetime import datetime

sys.path.insert(0, '/Users/efinney/.openclaw/workspace/scam-detection-framework')
from unified_scoring import calculate_risk_score, format_scan_result

username = os.environ.get('SCAN_USERNAME', 'unknown')
url = f'https://www.facebook.com/{username}'
temp_file = os.environ.get('SCAN_TEMP_FILE', '')

content = ''
if temp_file and os.path.exists(temp_file):
    try:
        with open(temp_file, 'r', errors='ignore') as f:
            content = f.read(50000)
    except:
        pass

if not content:
    print(f"🔍 Platform: Facebook")
    print(f"👤 Account: {username}")
    print(f"📊 Risk Score: N/A (No Data Retrieved)")
    print(f"⚠️  Risk Level: UNKNOWN")
    print(f"\n📋 Disclaimer: Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR. Scan date: {datetime.now().strftime('%Y-%m-%d')}")
    sys.exit(0)

metadata = {}

# Try to extract follower count
follower_match = re.search(r'(\d+[,.]?\d*[KkMm]?)\s*(followers|likes)', content.lower())
if follower_match:
    follower_str = follower_match.group(1).lower()
    if 'k' in follower_str:
        metadata['followers'] = float(follower_str.replace('k', '').replace(',', '')) * 1000
    elif 'm' in follower_str:
        metadata['followers'] = float(follower_str.replace('m', '').replace(',', '')) * 1000000
    else:
        try:
            metadata['followers'] = float(follower_str.replace(',', ''))
        except:
            pass

# Calculate risk using unified scoring
risk_result = calculate_risk_score(content, platform="facebook", metadata=metadata)

# Format and display result
formatted = format_scan_result(
    username=username,
    platform="facebook",
    url=url,
    risk_result=risk_result,
    include_disclaimer=True
)
print(formatted)
PYEOF

rm -f "$TEMP_FILE" 2>/dev/null
echo ""
echo "✅ Scan complete!"
echo ""
echo "📋 Disclaimer: Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR. Scan date: ${SCAN_DATE}"