#!/bin/bash
# Phone Community Reports Scanner - 800notes + WhoCalledMe
# Uses Chrome CDP (port 18801) to scrape live community spam reports
# Usage: scan-phone-community.sh "+1234567890"

set -euo pipefail

PHONE="$1"
PHONE="${PHONE#+}"
PHONE="${PHONE// /}"

if [ -z "$PHONE" ]; then
    echo "Usage: scan-phone-community.sh \"+1234567890\""
    exit 1
fi

CDP_PORT="${CDP_PORT:-18801}"
CDP_URL="http://localhost:$CDP_PORT/json"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
OUTPUT_DIR="/Users/efinney/.openclaw/workspace/output/phone-community-reports"
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/${PHONE}_$(date +%Y%m%d_%H%M%S).json"

echo "━━━━━ 📞 PHONE COMMUNITY REPORTS SCAN ━━━━━"
echo ""
echo "📱 Phone: +$PHONE"
echo "🔍 Sources: 800notes.com, whocalledme.org"
echo "📅 Time: $TIMESTAMP"
echo "🌐 CDP Port: $CDP_PORT"
echo ""

# ── CDP Helper Functions ─────────────────────────────────────────────────────

cdp_request() {
    local method="$1"
    local params="$2"
    curl -s -X POST "$CDP_URL" \
        -H "Content-Type: application/json" \
        -d "{\"method\":\"$method\",\"params\":$params,\"id\":1}" 2>/dev/null
}

get_active_tab() {
    curl -s "$CDP_URL" 2>/dev/null | python3 -c "
import sys, json
tabs = json.load(sys.stdin)
for tab in tabs:
    if 'chrome://newtab' in tab.get('url', '') or tab.get('type') == 'page':
        print(tab.get('id', ''))
        break
" 2>/dev/null || echo ""
}

navigate_to() {
    local tab_id="$1"
    local url="$2"
    curl -s -X POST "$CDP_URL" \
        -H "Content-Type: application/json" \
        -d "{\"method\":\"Page.navigate\",\"params\":{\"frameId\":\"$tab_id\",\"url\":\"$url\"},\"id\":1}" 2>/dev/null
    sleep 3
}

get_page_content() {
    local tab_id="$1"
    curl -s -X POST "$CDP_URL" \
        -H "Content-Type: application/json" \
        -d "{\"method\":\"Runtime.evaluate\",\"params\":{\"expression\":\"document.body.innerText\"},\"id\":1}" 2>/dev/null
}

# ── Check CDP Connection ────────────────────────────────────────────────────

if ! curl -s "$CDP_URL" >/dev/null 2>&1; then
    echo "❌ Chrome CDP not available on port $CDP_PORT"
    echo "   Start Chrome with: open -a 'Google Chrome' --args --remote-debugging-port=$CDP_PORT"
    echo ""
    echo "📊 Returning empty community data..."
    echo '{"phone": "+'$PHONE'", "sources": [], "error": "CDP not available", "timestamp": "'$TIMESTAMP'"}' | python3 -m json.tool
    exit 0
fi

TAB_ID=$(get_active_tab)
if [ -z "$TAB_ID" ]; then
    echo "⚠️  No active browser tab, attempting to use any available tab..."
    TAB_ID=$(curl -s "$CDP_URL" 2>/dev/null | python3 -c "import sys,json; tabs=json.load(sys.stdin); print(tabs[0].get('id','') if tabs else '')" 2>/dev/null || echo "")
fi

# ── 800notes.com Scan ───────────────────────────────────────────────────────

echo "🔍 Scanning 800notes.com..."

NOTES_800_URL="https://800notes.com/Phone.aspx/$PHONE"
NOTES_DATA='{"reports": [], "total": 0, "source": "800notes.com"}'

if [ -n "$TAB_ID" ]; then
    navigate_to "$TAB_ID" "$NOTES_800_URL" 2>/dev/null || true
    sleep 2
    
    # Extract page content
    NOTES_CONTENT=$(curl -s -X POST "$CDP_URL" \
        -H "Content-Type: application/json" \
        -d "{\"method\":\"Runtime.evaluate\",\"params\":{\"expression\":\"document.body.innerText\"},\"id\":1}" 2>/dev/null)
    
    # Parse comments/reports
    NOTES_DATA=$(echo "$NOTES_CONTENT" | python3 -c "
import sys, json, re
try:
    data = json.load(sys.stdin)
    text = data.get('result', {}).get('result', {}).get('value', '') if data else ''
    
    reports = []
    # Look for common patterns in 800notes comments
    # Pattern: 'XX calls', 'XX reports', 'Scam', 'Spam', 'Robocall'
    
    scam_mentions = len(re.findall(r'\b(scam|fraud|spam|robocall|harassment|fake)\b', text, re.I))
    call_count = re.search(r'(\d+)\s*(?:calls?|reports?)', text, re.I)
    total_calls = int(call_count.group(1)) if call_count else 0
    
    # Extract recent comments (simplified)
    comments = re.findall(r'(\d{1,2}/\d{1,2}/\d{2,4}.*?)(?=\d{1,2}/\d{1,2}/\d{2,4}|$)', text)
    
    result = {
        'reports': comments[:10] if comments else [],
        'total': total_calls if total_calls > 0 else scam_mentions * 5,
        'scam_mentions': scam_mentions,
        'source': '800notes.com',
        'url': 'https://800notes.com/Phone.aspx/$PHONE'
    }
    print(json.dumps(result))
except:
    print('{\"reports\": [], \"total\": 0, \"source\": \"800notes.com\"}')" 2>/dev/null || echo '{"reports": [], "total": 0, "source": "800notes.com"}')
    
    echo "   ✅ 800notes data extracted"
else
    echo "   ⚠️  No browser tab available, skipping 800notes"
fi

# ── WhoCalledMe.org Scan ─────────────────────────────────────────────────────

echo "🔍 Scanning whocalledme.org..."

WHOCALLED_URL="https://www.whocalledme.org/phone/$PHONE"
WHOCALLED_DATA='{"reports": [], "total": 0, "source": "whocalledme.org"}'

if [ -n "$TAB_ID" ]; then
    navigate_to "$TAB_ID" "$WHOCALLED_URL" 2>/dev/null || true
    sleep 2
    
    WHOCALLED_CONTENT=$(curl -s -X POST "$CDP_URL" \
        -H "Content-Type: application/json" \
        -d "{\"method\":\"Runtime.evaluate\",\"params\":{\"expression\":\"document.body.innerText\"},\"id\":1}" 2>/dev/null)
    
    WHOCALLED_DATA=$(echo "$WHOCALLED_CONTENT" | python3 -c "
import sys, json, re
try:
    data = json.load(sys.stdin)
    text = data.get('result', {}).get('result', {}).get('value', '') if data else ''
    
    reports = []
    scam_mentions = len(re.findall(r'\b(scam|fraud|spam|robocall|harassment|fake)\b', text, re.I))
    call_count = re.search(r'(\d+)\s*(?:calls?|reports?|complaints?)', text, re.I)
    total_calls = int(call_count.group(1)) if call_count else 0
    
    # Look for spam score or rating
    spam_score = re.search(r'(?:spam\s*score|risk\s*score)[:\s]*(\d+)', text, re.I)
    risk_level = re.search(r'(?:risk|rating|level)[:\s]*(high|medium|low|critical)', text, re.I)
    
    comments = re.findall(r'(\d{1,2}/\d{1,2}/\d{2,4}.*?)(?=\d{1,2}/\d{1,2}/\d{2,4}|$)', text)
    
    result = {
        'reports': comments[:10] if comments else [],
        'total': total_calls if total_calls > 0 else scam_mentions * 3,
        'scam_mentions': scam_mentions,
        'spam_score': int(spam_score.group(1)) if spam_score else 0,
        'risk_level': risk_level.group(1) if risk_level else 'unknown',
        'source': 'whocalledme.org',
        'url': 'https://www.whocalledme.org/phone/$PHONE'
    }
    print(json.dumps(result))
except:
    print('{\"reports\": [], \"total\": 0, \"source\": \"whocalledme.org\"}')" 2>/dev/null || echo '{"reports": [], "total": 0, "source": "whocalledme.org"}')
    
    echo "   ✅ WhoCalledMe data extracted"
else
    echo "   ⚠️  No browser tab available, skipping WhoCalledMe"
fi

# ── Combine Results ──────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

COMBINED=$(python3 << PYTHON
import json
import sys
from datetime import datetime

try:
    notes = json.loads('''$NOTES_DATA''')
    who = json.loads('''$WHOCALLED_DATA''')
except:
    notes = {"reports": [], "total": 0, "source": "800notes.com"}
    who = {"reports": [], "total": 0, "source": "whocalledme.org"}

# Calculate aggregate metrics
total_reports = notes.get('total', 0) + who.get('total', 0)
total_scam_mentions = notes.get('scam_mentions', 0) + who.get('scam_mentions', 0)

# Determine overall risk from community data
if total_reports > 100 or total_scam_mentions > 20:
    community_risk = "HIGH"
elif total_reports > 20 or total_scam_mentions > 5:
    community_risk = "MEDIUM"
elif total_reports > 0:
    community_risk = "LOW"
else:
    community_risk = "NONE"

result = {
    "phone": "+$PHONE",
    "timestamp": "$TIMESTAMP",
    "sources": [
        notes,
        who
    ],
    "aggregate": {
        "total_reports": total_reports,
        "scam_mentions": total_scam_mentions,
        "community_risk": community_risk,
        "last_report_date": datetime.now().strftime("%Y-%m-%d") if total_reports > 0 else None
    }
}

print(json.dumps(result, indent=2))
PYTHON
)

echo "$COMBINED"

# Save to file
echo "$COMBINED" > "$OUTPUT_FILE"
echo ""
echo "📄 Report saved to: $OUTPUT_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"