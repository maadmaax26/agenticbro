#!/bin/bash

# Simple X Profile Scanner with Database Check
# Checks scammer_database.json before scanning

DB_FILE="/Users/efinney/.openclaw/workspace/scammer_database.json"
PROFILE="$1"

echo "🔍 X Profile Scanner with Database Lookup"
echo "========================================="
echo ""

# Step 1: Check database
echo "🔎 Searching database for @$PROFILE..."

# Check JSON database for profile
PROFILE_FOUND=$(cat "$DB_FILE" | grep -i "$PROFILE" | head -1)

if [ -n "$PROFILE_FOUND" ]; then
    echo ""
    echo "✅ FOUND IN DATABASE"
    echo ""
    echo "🟦 CACHED DATABASE RESULT (JSON)"
    echo ""
    echo "📋 Database Entry Found:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Extract relevant fields safely
    VERIFICATION=$(echo "$PROFILE_FOUND" | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        data = json.loads(line)
        if data.get('x_handle'):
            print(data.get('verification', 'UNVERIFIED'))
            sys.exit(0)
    except:
        pass
print('UNVERIFIED')
")

    # Simple display based on name
    NAME=$(echo "$PROFILE_FOUND" | grep -o '"name"[^,]*' | cut -d'"' -f4)
    X_HANDLE=$(echo "$PROFILE" | cut -d'@' -f2)

    echo "• Account: @$X_HANDLE"
    [ -n "$NAME" ] && echo "• Name: $NAME"
    echo "• Risk Level: $VERIFICATION"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "💡 QUICK RECOMMENDATIONS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    case "$VERIFICATION" in
        "HIGH RISK"|"CRITICAL RISK")
            echo "🔴 BLOCK — Do not engage"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "• Block this account"
            echo "• DO NOT send tokens or USDC"
            echo "• Verify contract addresses independently"
            ;;
        "MEDIUM RISK")
            echo "🟡 VERIFY CAREFULLY"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "• Ask community in Agentic Bro group"
            echo "• Cross-check across platforms"
            echo "• Check contract addresses"
            ;;
        *)
            echo "⚪ RESEARCH INDEPENDENTLY"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
            ;;
    esac

    echo ""
    echo "✅ CACHED — Scan skipped"
    exit 0
fi

echo "❌ NOT FOUND IN DATABASE"
echo ""
echo "🧪 RUNNING NEW SCAN (CDP method)"
echo ""

# Step 2: Use Hybrid Scanner (Default)
SCAN_DIR="/Users/efinney/.openclaw/workspace/scripts"
SCAN_SCRIPT=""

if [ -f "$SCAN_DIR/scan-x-hybrid.sh" ]; then
    SCAN_SCRIPT="$SCAN_DIR/scan-x-hybrid.sh"
    echo "✅ Using: scan-x-hybrid.sh (Hybrid: CDP + Web Fetch)"
else
    echo "❌ Hybrid scanner not found"
    exit 1
fi

# Step 3: Run scan
echo ""
OUTPUT_FILE="/tmp/x-scan-${PROFILE}-$(date +%s).log"

if bash "$SCAN_SCRIPT" "$PROFILE" > "$OUTPUT_FILE" 2>&1; then
    echo "✅ SCAN COMPLETED"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "💾 SAVE TO DATABASE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "✅ @$PROFILE will be added after next lookup"
    echo "📊 Output: $OUTPUT_FILE"

    # Actually add to database now
    python3 << INJECT_DB
import json
from datetime import datetime

DB="$DB_FILE"
PROFILE="$PROFILE"

try:
    with open(DB, 'r') as f:
        db = json.load(f)
except:
    db = {"scammers": []}

# Add entry
new_entry = {
    "name": f"X User - {PROFILE}",
    "x_handle": PROFILE.lower(),
    "platform": "X/Twitter",
    "verification": "UNVERIFIED",
    "scam_type": "Pattern Scan",
    "victims_count": 0,
    "notes": f"DP scan via check-and-scrape-x.sh on {datetime.now().isoformat()}",
    "created_on": datetime.now().isoformat()
}

db["scammers"].append(new_entry)

with open(DB, 'w') as f:
    json.dump(db, f, indent=2)

print(f"✅ Added @$PROFILE to database")
except Exception as e:
    print(f"❌ Error: {e}")
INJECT_DB

    echo "✅ Database updated"
else
    echo "❌ SCAN FAILED"
    echo "📄 Output: $OUTPUT_FILE"
    exit 1
fi

exit 0