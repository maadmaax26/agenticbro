#!/bin/bash
# TikTok Scan from Chat Command Wrapper
# Usage: ./scan-tiktok-command.sh @username
# v2: Parses Python JSON output properly instead of ignoring it

set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
SCAN_SCRIPT="/Users/efinney/.openclaw/workspace/scripts/tiktok-scan-fixed.py"
OUTPUT_DIR="$WORKSPACE/output/tiktok_profiles"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TIMESTAMP_LOCAL=$(date +"%Y-%m-%d %H:%M:%S %Z")
SCAN_TIME="$TIMESTAMP"

# Extract username
USERNAME="${1#@}"
PROFILE_URL="https://www.tiktok.com/@$USERNAME"
OUTPUT_FILE="$OUTPUT_DIR/${USERNAME}_${SCAN_TIME}.json"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "━━━ 🔍 TIKTOK PROFILE SCAN — AI POWERED ASSESSMENT ━━━"
echo ""
echo "⚠️  DISCLAIMER: Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR."
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║ Scan Information                                                    ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📁 Account: $USERNAME"
echo "🔗 URL:    $PROFILE_URL"
echo "📅 Time:   $TIMESTAMP_LOCAL ($TIMESTAMP)"
echo "🔍 Method: Direct HTTP (bypasses SSRF)"
echo ""

# Run Python scanner and capture JSON output
echo "Scanning... (this takes 1-2 seconds for each profile)"
SCAN_JSON=$(python3 "$SCAN_SCRIPT" "$USERNAME" 2>&1)

# Parse the JSON result properly
PARSED=$(echo "$SCAN_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # Extract fields from the Python scanner's actual output
    risk_score = data.get('risk_score', 0)
    raw_score = data.get('raw_score', 0)
    risk_level = data.get('risk_level', 'UNKNOWN')
    red_flags = data.get('red_flags', [])
    status = data.get('status', 'unknown')
    profile_data = data.get('profile_data', {})
    error = data.get('error', '')
    
    # Build red flags display
    flags_json = json.dumps(red_flags)
    
    # Build profile data display
    display_name = profile_data.get('display_name', 'N/A')
    bio = profile_data.get('bio', 'N/A')
    
    # Output as key=value pairs for shell parsing
    print(f'RISK_SCORE={risk_score}')
    print(f'RAW_SCORE={raw_score}')
    print(f'RISK_LEVEL={risk_level}')
    print(f'STATUS={status}')
    print(f'DISPLAY_NAME={display_name}')
    print(f'BIO={bio}')
    print(f'ERROR={error}')
    print(f'RED_FLAGS={flags_json}')
except Exception as e:
    print(f'PARSE_ERROR={e}')
    print(f'RISK_SCORE=0')
    print(f'RISK_LEVEL=ERROR')
    print(f'STATUS=parse_error')
    print(f'RED_FLAGS=[]')
" 2>/dev/null)

# Extract values
RISK_SCORE=$(echo "$PARSED" | grep '^RISK_SCORE=' | cut -d= -f2-)
RAW_SCORE=$(echo "$PARSED" | grep '^RAW_SCORE=' | cut -d= -f2-)
RISK_LEVEL=$(echo "$PARSED" | grep '^RISK_LEVEL=' | cut -d= -f2-)
STATUS=$(echo "$PARSED" | grep '^STATUS=' | cut -d= -f2-)
DISPLAY_NAME=$(echo "$PARSED" | grep '^DISPLAY_NAME=' | cut -d= -f2-)
BIO=$(echo "$PARSED" | grep '^BIO=' | cut -d= -f2-)
SCAN_ERROR=$(echo "$PARSED" | grep '^ERROR=' | cut -d= -f2-)
RED_FLAGS_JSON=$(echo "$PARSED" | grep '^RED_FLAGS=' | cut -d= -f2-)

# Display results
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║ Risk Assessment                                                     ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

if [ "$STATUS" = "error" ]; then
    echo "❌ Scan Error: $SCAN_ERROR"
    RISK_SCORE=0
    RISK_LEVEL="ERROR"
elif [ "$STATUS" = "parse_error" ]; then
    echo "❌ Parse Error: Could not read scanner output"
    RISK_SCORE=0
    RISK_LEVEL="ERROR"
else
    echo "👤 Display Name: $DISPLAY_NAME"
    echo "📝 Bio: $BIO"
    echo ""
    echo "📊 Risk Score: $RISK_SCORE/10 — $RISK_LEVEL"
    echo "🔢 Raw Score: $RAW_SCORE/90"
    echo ""

    # Display red flags with point values
    FLAG_POINTS='{"Guaranteed returns":25,"Airdrop/giveaway language detected":20,"DM solicitation for crypto/alpha":15,"Free crypto claims":15,"Alpha DM scheme":15,"Unrealistic claims":10,"Download/install push":10,"Urgency tactics":10,"Emotional manipulation":10,"Low credibility (disclaimer on risky content)":10}'

    if [ "$RED_FLAGS_JSON" != "[]" ] && [ "$RED_FLAGS_JSON" != "" ]; then
        echo "🚩 Red Flags:"
        echo "$RED_FLAGS_JSON" | python3 -c "
import sys, json
flags = json.load(sys.stdin)
points = json.loads('''$FLAG_POINTS''')
for f in flags:
    pts = points.get(f, '?')
    print(f'  • {f} ({pts} pts)')
" 2>/dev/null
    else
        echo "✅ No red flags detected in profile content"
    fi
fi

echo ""
echo "📋 Disclaimer: Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR. Scan date: $(date +%Y-%m-%d)"
echo ""

# Save the actual JSON result from the Python scanner (not a fabricated one)
echo "$SCAN_JSON" > "$OUTPUT_FILE"
echo "📁 Full JSON: $OUTPUT_FILE"