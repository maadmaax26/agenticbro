#!/bin/bash
# X/Twitter Profile Scam Scanner - macOS Compatible
# Fixes: (1) hardcoded username, (2) plugin allow, (3) macOS grep compatibility

set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
OUTPUT_DIR="$WORKSPACE/output/x-profile-reports"

# Fix 1: Use the passed username, not hardcoded
USERNAME="${1#@}"
if [ -z "$USERNAME" ]; then
    echo "❌ Error: No username provided"
    echo "Usage: $0 <username>"
    echo "Example: $0 Sommy_web3"
    exit 1
fi

PROFILE_URL="https://x.com/${USERNAME}"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
OUTPUT_FILE="$OUTPUT_DIR/scan-x_${USERNAME}_${TIMESTAMP}.md"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "━━━━━ 🔍 X/TWITTER PROFILE SCAN ━━━━━"
echo ""
echo "⚠️  DISCLAIMER"
echo "Educational purposes only. Not financial advice. Always DYOR."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "📂 Platform: X/Twitter"
echo "📁 Account: @$USERNAME"
echo "🔗 URL: $PROFILE_URL"
echo "📅 Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "🔍 Method: Chrome CDP (Port 18801)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Fix 2: Use direct curl to Chrome CDP, not openclaw session_send
CDP_PORT="${CHROME_CDP_PORT:-18801}"
CDP_URL="http://localhost:${CDP_PORT}"

# Check if Chrome CDP is running
if ! curl -s "${CDP_URL}/json/list" > /dev/null 2>&1; then
    echo "❌ Chrome CDP not running on port ${CDP_PORT}"
    echo ""
    echo "Start Chrome with:"
    echo "  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${CDP_PORT} &"
    echo ""
    echo "Or scan via web fetch (limited data):"
    echo ""
    
    # Fallback: web fetch
    WEB_DATA=$(curl -s -L --user-agent "Mozilla/5.0" "${PROFILE_URL}" 2>/dev/null || echo "")
    
    if [ -z "$WEB_DATA" ]; then
        echo "❌ Could not fetch profile. X may require login."
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "SCAN RESULT: UNABLE TO SCAN"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Profile requires login or does not exist."
        echo "Risk Score: N/A"
        echo "Scan date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
        exit 1
    fi
    
    # Extract what we can from web data (limited)
    # Fix 3: Use BSD grep (macOS compatible), not PCRE
    
    # Extract display name using sed (macOS compatible)
    DISPLAY_NAME=$(echo "$WEB_DATA" | grep -o 'data-testid="UserName"[^>]*>[^<]*</span>' | head -1 | sed 's/<[^>]*>//g' | tr -d '\n' || echo "N/A")
    
    # Check for verification badge
    IS_VERIFIED="No"
    if echo "$WEB_DATA" | grep -q 'data-testid="icon-verified"'; then
        IS_VERIFIED="Yes ✓"
    fi
    
    # Check for crypto keywords
    CRYPTO_KEYWORDS=0
    for kw in "crypto\|bitcoin\|eth\|solana\|nft\|airdrop\|giveaway\|whale\|alpha"; do
        if echo "$WEB_DATA" | grep -qi "$kw"; then
            CRYPTO_KEYWORDS=$((CRYPTO_KEYWORDS + 1))
        fi
    done
    
    # Risk assessment
    RISK_SCORE=0
    RISK_PATTERNS=()
    
    if [ $CRYPTO_KEYWORDS -gt 3 ]; then
        RISK_SCORE=$((RISK_SCORE + 5))
        RISK_PATTERNS+=("High crypto keyword density")
    fi
    
    if echo "$WEB_DATA" | grep -qi "dm me\|message me\|direct message"; then
        RISK_SCORE=$((RISK_SCORE + 15))
        RISK_PATTERNS+=("DM solicitation detected")
    fi
    
    if echo "$WEB_DATA" | grep -qi "guaranteed\|100x\|1000x\|risk.free\|no risk"; then
        RISK_SCORE=$((RISK_SCORE + 25))
        RISK_PATTERNS+=("Guaranteed returns language")
    fi
    
    if echo "$WEB_DATA" | grep -qi "airdrop\|giveaway\|free.*token\|claim.*free"; then
        RISK_SCORE=$((RISK_SCORE + 20))
        RISK_PATTERNS+=("Airdrop/giveaway language")
    fi
    
    # Cap score at 90
    if [ $RISK_SCORE -gt 90 ]; then
        RISK_SCORE=90
    fi
    
    # Normalize to 0-10
    NORMALIZED_SCORE=$(echo "scale=1; $RISK_SCORE / 10" | bc 2>/dev/null || echo "0")
    
    # Determine risk level
    RISK_LEVEL="LOW"
    if [ $(echo "$NORMALIZED_SCORE >= 7" | bc 2>/dev/null || echo 0) -eq 1 ]; then
        RISK_LEVEL="CRITICAL"
    elif [ $(echo "$NORMALIZED_SCORE >= 5" | bc 2>/dev/null || echo 0) -eq 1 ]; then
        RISK_LEVEL="HIGH"
    elif [ $(echo "$NORMALIZED_SCORE >= 3" | bc 2>/dev/null || echo 0) -eq 1 ]; then
        RISK_LEVEL="MEDIUM"
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "SCAN RESULT: WEB FETCH (Limited)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Account: @$USERNAME"
    echo "URL: $PROFILE_URL"
    echo ""
    echo "RISK SCORE: ${NORMALIZED_SCORE}/10 — ${RISK_LEVEL}"
    echo ""
    if [ ${#RISK_PATTERNS[@]} -gt 0 ]; then
        echo "RED FLAGS:"
        for pattern in "${RISK_PATTERNS[@]}"; do
            echo "  • $pattern"
        done
    else
        echo "RED FLAGS: None detected (limited scan)"
    fi
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "DISCLAIMER: Educational purposes only. Not financial advice. Always DYOR."
    echo "Scan date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
    exit 0
fi

# Chrome CDP is running - use it
echo "✅ Chrome CDP detected on port ${CDP_PORT}"
echo ""

# Get existing X tab or create new one
PAGE_INFO=$(curl -s "${CDP_URL}/json/list" 2>/dev/null | grep -o '"url":"https://x.com[^"]*"' | head -1 || echo "")

if [ -z "$PAGE_INFO" ]; then
    echo "📌 Opening new X tab..."
    # Navigate to profile
    NAV_RESULT=$(curl -s -X POST "${CDP_URL}/json/new?${PROFILE_URL}" 2>/dev/null || echo "")
    sleep 3
else
    echo "📌 Found existing X tab, navigating..."
    # Get page ID from existing tab
    PAGE_ID=$(curl -s "${CDP_URL}/json/list" 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//' || echo "")
    
    if [ -n "$PAGE_ID" ]; then
        # Navigate existing page
        curl -s -X POST "${CDP_URL}/json/navigate?${PROFILE_URL}" > /dev/null 2>&1 || true
        sleep 2
    fi
fi

# Wait for page load
sleep 2

# Capture screenshot
echo "📸 Capturing screenshot..."
SCREENSHOT_FILE="${OUTPUT_DIR}/x_${USERNAME}_${TIMESTAMP}.png"
curl -s "${CDP_URL}/json/screenshot" > "$SCREENSHOT_FILE" 2>/dev/null || true

# Get page content via CDP
echo "📊 Extracting profile data..."

# Use CDP Runtime.evaluate to get page content
CDP_SCRIPT='
(function() {
    var data = {};
    
    // Try to get username
    var userEl = document.querySelector("[data-testid=\"UserName\"]");
    if (userEl) data.username = userEl.textContent.trim();
    
    // Try to get display name
    var nameEl = document.querySelector("[data-testid=\"UserName\"]");
    if (nameEl) data.displayName = nameEl.textContent.trim();
    
    // Check verification
    data.verified = !!document.querySelector("[data-testid=\"icon-verified\"]");
    
    // Try to get follower count
    var followersLink = document.querySelector("a[href*=\"/followers\"]");
    if (followersLink) data.followers = followersLink.textContent.trim();
    
    // Try to get following count
    var followingLink = document.querySelector("a[href*=\"/following\"]");
    if (followingLink) data.following = followingLink.textContent.trim();
    
    // Try to get bio
    var bioEl = document.querySelector("[data-testid=\"UserDescription\"]");
    if (bioEl) data.bio = bioEl.textContent.trim();
    
    return JSON.stringify(data);
})()
'

# Execute script via CDP (macOS compatible)
PAGE_ID=$(curl -s "${CDP_URL}/json/list" 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//' || echo "")

if [ -n "$PAGE_ID" ]; then
    # Get websocket URL for this page
    WS_URL=$(curl -s "${CDP_URL}/json/list" 2>/dev/null | grep -A1 "\"id\":\"${PAGE_ID}\"" | grep "webSocketDebuggerUrl" | sed 's/.*"webSocketDebuggerUrl":"\([^"]*\)".*/\1/' || echo "")
    
    if [ -z "$WS_URL" ]; then
        # Fallback: find any websocket URL for x.com
        WS_URL=$(curl -s "${CDP_URL}/json/list" 2>/dev/null | grep -o '"webSocketDebuggerUrl":"[^"]*"' | head -1 | sed 's/"webSocketDebuggerUrl":"//;s/"$//' || echo "")
    fi
    
    echo "WebSocket: $WS_URL"
    
    # For now, just capture what we can via web fetch as fallback
    echo ""
    echo "📊 Profile Data (CDP):"
    echo "   Username: @$USERNAME"
    echo "   (Full CDP extraction requires WebSocket connection)"
fi

# Do web-based pattern analysis
echo ""
echo "🔍 Running pattern analysis..."

WEB_DATA=$(curl -s -L --user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "${PROFILE_URL}" 2>/dev/null || echo "")

# Risk scoring (90-point unified system)
RISK_SCORE=0
RISK_PATTERNS=()

# Guaranteed returns (25 pts)
if echo "$WEB_DATA" | grep -qi "guaranteed\|100%\|risk.free\|no risk\|sure thing"; then
    RISK_SCORE=$((RISK_SCORE + 25))
    RISK_PATTERNS+=("Guaranteed returns language (25pts)")
fi

# Giveaway/Airdrop (20 pts)
if echo "$WEB_DATA" | grep -qi "airdrop\|giveaway\|free.*token\|claim.*free"; then
    RISK_SCORE=$((RISK_SCORE + 20))
    RISK_PATTERNS+=("Airdrop/giveaway language (20pts)")
fi

# DM solicitation (15 pts)
if echo "$WEB_DATA" | grep -qi "dm me\|message me\|direct message\|dm for"; then
    RISK_SCORE=$((RISK_SCORE + 15))
    RISK_PATTERNS+=("DM solicitation (15pts)")
fi

# Free crypto (15 pts)
if echo "$WEB_DATA" | grep -qi "free crypto\|free btc\|free eth\|free sol\|claim free"; then
    RISK_SCORE=$((RISK_SCORE + 15))
    RISK_PATTERNS+=("Free crypto offers (15pts)")
fi

# Alpha DM scheme (15 pts)
if echo "$WEB_DATA" | grep -qi "alpha\|vip\|exclusive\|private group"; then
    RISK_SCORE=$((RISK_SCORE + 15))
    RISK_PATTERNS+=("Alpha/VIP gating (15pts)")
fi

# Unrealistic claims (10 pts)
if echo "$WEB_DATA" | grep -qi "100x\|1000x\|overnight\|instant.*wealth"; then
    RISK_SCORE=$((RISK_SCORE + 10))
    RISK_PATTERNS+=("Unrealistic claims (10pts)")
fi

# Urgency (10 pts)
if echo "$WEB_DATA" | grep -qi "act now\|limited time\|last chance\|expires soon"; then
    RISK_SCORE=$((RISK_SCORE + 10))
    RISK_PATTERNS+=("Urgency tactics (10pts)")
fi

# Cap at 90
if [ $RISK_SCORE -gt 90 ]; then
    RISK_SCORE=90
fi

# Normalize to 0-10
NORMALIZED_SCORE=$(echo "scale=1; $RISK_SCORE / 10" | bc 2>/dev/null || echo "0")

# Determine risk level
RISK_LEVEL="LOW"
if [ $(echo "$NORMALIZED_SCORE >= 7" | bc 2>/dev/null || echo 0) -eq 1 ]; then
    RISK_LEVEL="CRITICAL"
elif [ $(echo "$NORMALIZED_SCORE >= 5" | bc 2>/dev/null || echo 0) -eq 1 ]; then
    RISK_LEVEL="HIGH"
elif [ $(echo "$NORMALIZED_SCORE >= 3" | bc 2>/dev/null || echo 0) -eq 1 ]; then
    RISK_LEVEL="MEDIUM"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SCAN RESULT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Account: @$USERNAME"
echo "URL: $PROFILE_URL"
echo ""
echo "RISK SCORE: ${NORMALIZED_SCORE}/10 — ${RISK_LEVEL}"
echo ""

if [ ${#RISK_PATTERNS[@]} -gt 0 ]; then
    echo "RED FLAGS:"
    for pattern in "${RISK_PATTERNS[@]}"; do
        echo "  • $pattern"
    done
else
    echo "RED FLAGS: None detected"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "DISCLAIMER: Educational purposes only. Not financial advice. Always DYOR."
echo "Scan date: $(date '+%Y-%m-%d %H:%M:%S %Z')"

# Write report to file
cat > "$OUTPUT_FILE" << EOF
# X Profile Scan — @$USERNAME

**Date:** $(date '+%Y-%m-%d %H:%M:%S %Z')
**Platform:** X/Twitter
**Account:** @$USERNAME
**URL:** $PROFILE_URL

---

## Risk Assessment

**Risk Score:** ${NORMALIZED_SCORE}/10
**Risk Level:** ${RISK_LEVEL}

---

## Red Flags

$(if [ ${#RISK_PATTERNS[@]} -gt 0 ]; then
    for pattern in "${RISK_PATTERNS[@]}"; do
        echo "- $pattern"
    done
else
    echo "None detected"
fi)

---

## Disclaimer

Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR.

**Scan Date:** $(date '+%Y-%m-%d %H:%M:%S %Z')
EOF

echo ""
echo "📄 Report saved: $OUTPUT_FILE"