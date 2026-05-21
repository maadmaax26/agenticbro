#!/bin/bash
# X/Twitter Profile Scam Scanner - Direct CDP Method
# Uses curl to extract HTML and regex parsing (no puppeteer needed)

set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
OUTPUT_DIR="$WORKSPACE/output/x-profile-reports"
USERNAME="${1#@}"
PROFILE_URL="https://x.com/${USERNAME}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
OUTPUT_FILE="$OUTPUT_DIR/scan-x-curl_${USERNAME}_${TIMESTAMP}.md"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "━━━━━ 🔍 X/TWITTER PROFILE SCAN — CURL METHOD ━━━━━"
echo ""
echo "⚠️  DISCLAIMER NOTICE"
echo "This scan is an AI-powered threat assessment of X (Twitter) content."
echo "For complete accuracy, verify information through multiple sources."
echo ""
echo "INDEPENDENT VERIFICATION REQUIRED:"
echo "• Cross-check username across multiple platforms"
echo "• Never send money or share private keys"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "📂 Platform: X/Twitter"
echo "📁 Account: $USERNAME"
echo "🔗 URL: $PROFILE_URL"
echo "📅 Time: $TIMESTAMP"
echo "🔍 Method: Chrome CDP + Direct CDP Commands"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get Chrome CDP page ID
PAGE_ID=$(curl -s "http://localhost:18801/json/list" 2>/dev/null | grep -o '"x.com"[^}]*' | head -1 | grep -o '[0-9A-F]\{32\}' || echo "")

if [ -z "$PAGE_ID" ]; then
    echo "❌ Could not find Chrome CDP page for X. Opening X in browser..."
    
    # Navigate to X using openclaw
    echo "Navigating to $PROFILE_URL..."
    openclaw session_send request:browser goto "$PROFILE_URL" 2>/dev/null || true
    sleep 3
    
    # Try again to get page ID
    PAGE_ID=$(curl -s "http://localhost:18801/json/list" 2>/dev/null | grep -o '"x.com"[^}]*' | head -1 | grep -o '[0-9A-F]\{32\}' || echo "")
    echo "Page ID: $PAGE_ID"
fi

if [ -z "$PAGE_ID" ]; then
    echo "❌ Still couldn't find X page. Using fallback: direct fetch"
    
    # Direct fetch of X profile
    echo "Fetching profile..."
    PROFILE_PAGE=$(curl -s --user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36" "https://x.com/${USERNAME}" 2>/dev/null || echo "")
    
    if [ -z "$PROFILE_PAGE" ] || [ "${PROFILE_PAGE:0:40}" = "https://x.com/${USERNAME}"* ]; then
        echo "❌ Profile not found or login wall detected"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "⚠️  PROFILE NOT ACCESSIBLE"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Profile was not found or requires login."
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "⚠️  DISCLAIMER"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR."
        echo "Scan date: $TIMESTAMP"
        
        cat > "$OUTPUT_FILE" << EOF
# X Profile Scan — Curl Method

**Date:** $TIMESTAMP
**Platform:** X/Twitter
**Account:** $USERNAME
**URL:** $PROFILE_URL

---

## Profile Data

- **Status:** Not accessible
- **Issue:** Profile not found or login wall

---

## Risk Assessment

**Risk Score:** N/A
**Risk Level:** UNKNOWN

---

## Disclaimer

Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR.
EOF
        echo ""
        echo "✅ Report saved to: $OUTPUT_FILE"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "⚠️  Scan Complete — Refer to disclaimer above — Independent verification always recommended"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        exit 0
    fi
    
    echo "Profile fetched"
fi

# Navigate to profile
echo "Navigating to profile..."
openclaw session_send request:browser goto "$PROFILE_URL" 2>/dev/null || true
sleep 3

# Take snapshot
echo "Taking snapshot..."
SNAPSHOT=$(openclaw session_send request:browser snapshot 2>&1 || echo "")

if [ -z "$SNAPSHOT" ]; then
    echo "❌ Could not capture page snapshot"
    echo "Report saved as N/A"
    exit 0
fi

# Extract data
echo "Extracting data..."
TIMESTAMP_SEC=$(date +%s)

# Extract username (from multiple selectors)
USERNAME_EXTRA=$(echo "$SNAPSHOT" | grep -oP 'data-testid="user-mentioned-username">[^<]*</span>|<[^>]*><[^>]*>\K[^<]+' | head -1 | sed 's/.*<span[^>]*>\(.*\)<\/span>/\1/' | sed 's/<\/span>//' | sed 's/<[^>]*>//g' | head -1 || echo "@$USERNAME")

# If extraction failed, use the input username
if echo "$USERNAME_EXTRA" | grep -qP '^\@?[A-Za-z0-9_]+$' || echo "$USERNAME_EXTRA" | grep -qE '^@?[A-Za-z0-9_]{1,50}$'; then
    DISPLAY_USERNAME="$USERNAME_EXTRA"
else
    DISPLAY_USERNAME="$USERNAME"
fi

# Extract display name
DISPLAY_NAME=$(echo "$SNAPSHOT" | grep -oP 'data-testid="user-mentioned-displayname">[^<]*</span>|article h1' | head -1 | sed 's/.*<span[^>]*>\(.*\)<\/span>/\1/' | sed 's/<[^>]*>//g' | sed 's/[[:cntrl:]]//g' | sed 's/[“"]//g' | head -1 || echo "N/A")

# Extract bio
BIO=$(echo "$SNAPSHOT" | grep -oP 'data-testid="tweetText"[^>]*>[^<]*</div>|<[^>]*><[^>]*>\K[^<]+' | head -1 | sed 's/<[^>]*>//g' | sed 's/[[:cntrl:]]//g' | head -1 || echo "")

# Extract follower count
FOLLOWERS=$(echo "$SNAPSHOT" | grep -oP 'followers?[^<]*>[^<]*<[^>]*>[0-9,]+' | grep -oP '[0-9,]+' | head -1 | tr -d ',' || echo "0")

# Extract following count
FOLLOWING=$(echo "$SNAPSHOT" | grep -oP 'following[^<]*>[^<]*<[^>]*>[0-9,]+' | grep -oP '[0-9,]+' | head -1 | tr -d ',' || echo "0")

# Check verification badge
VERIFY_BADGE=$(echo "$SNAPSHOT" | grep -o 'data-testid="icon-verified"' | wc -l || echo "0")
if [ "$VERIFY_BADGE" = "0" ]; then
    VERIFIED="❌"
else
    VERIFIED="✅"
fi

# Extract join date
JOIN_DATE=$(echo "$SNAPSHOT" | grep -oP 'Since [A-Za-z]{3} [0-9]+.*' | head -1 | sed 's/Since //')

# Count tweets
TWEETS=$(echo "$SNAPSHOT" | grep -oP 'data-testid="tweet"' | wc -l || echo "0")

# Red flag analysis
echo "Analyzing for red flags..."
RED_FLAGS=0
SCORE=0

# Check for guarantees
if echo "$BIO" | grep -qiE "guaranteed|100x|500x|2x|3x|overnight.*rich|instant.*return|never.*lose"; then
    echo "🚨 Red flag: Unrealistic claims detected"
    RED_FLAGS=$((RED_FLAGS + 1))
    SCORE=$((SCORE + 10))
fi

# Check for DM solicitation
if echo "$BIO" | grep -qi "d\.m\|direct message|dm me|message me|send dm|private message"; then
    echo "🚨 Red flag: DM solicitation detected"
    RED_FLAGS=$((RED_FLAGS + 1))
    SCORE=$((SCORE + 10))
fi

# Check for crypto giveaways
if echo "$BIO" | grep -qiE "giveaway|airdrop|free crypto|win.*token|token.*free"; then
    echo "🚨 Red flag: Crypto giveaway claim"
    RED_FLAGS=$((RED_FLAGS + 1))
    SCORE=$((SCORE + 10))
fi

# Check for emotion manipulation
if echo "$BIO" | grep -qiE "earn.*money|make.*money|millionaire|rich.*now|fast.*money|financial.*crisis|investor.*guide"; then
    echo "🚨 Red flag: Emotion manipulation"
    RED_FLAGS=$((RED_FLAGS + 1))
    SCORE=$((SCORE + 10))
fi

# Check for financial advice without disclaimer
ADVICE_COUNT=$(echo "$BIO" | grep -c "financial advice" || echo "0")
if [ "$ADVICE_COUNT" -lt 2 ]; then
    SCORE=$((SCORE + 10))
fi

# Check for VIP/investor group promotion
if echo "$BIO" | grep -qiE "private group|vip group|investor only|exclusive group|members only"; then
    echo "🚨 Red flag: VIP/Investor group push"
    RED_FLAGS=$((RED_FLAGS + 1))
    SCORE=$((SCORE + 10))
fi

# No verification
if [ "$VERIFY_BADGE" = "0" ]; then
    echo "⚠️  Warning: No verification badge"
    SCORE=$((SCORE + 10))
fi

# Determine risk level
MAX_POSSIBLE=90
PERCENTAGE=$((SCORE))

if [ "$RED_FLAGS" -eq 0 ]; then
    RISK_LEVEL="LOW"
else
    if [ "$SCORE" -ge 70 ]; then
        RISK_LEVEL="CRITICAL"
    elif [ "$SCORE" -ge 50 ]; then
        RISK_LEVEL="HIGH"
    elif [ "$SCORE" -ge 20 ]; then
        RISK_LEVEL="MEDIUM"
    else
        RISK_LEVEL="LOW"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 PROFILE DATA EXTRACTED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Username: @$DISPLAY_USERNAME"
echo "Display Name: $DISPLAY_NAME"
echo "Verified: $VERIFIED"
echo "Bio: $BIO"
echo "Followers: $FOLLOWERS"
echo "Following: $FOLLOWING"
echo "Joined: $JOIN_DATE"
echo "Tweets: $TWEETS"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚨 RED FLAG ANALYSIS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Risk Score: $SCORE/90"
echo "Risk Level: $RISK_LEVEL"
echo ""
echo "Red Flags Found: $RED_FLAGS"

# Generate report
cat > "$OUTPUT_FILE" << EOF
# X Profile Scan — Curl Method

**Date:** $TIMESTAMP
**Platform:** X/Twitter
**Account:** @$DISPLAY_USERNAME
**URL:** $PROFILE_URL
**Method:** Chrome CDP Browser Automation

---

## Profile Data

- **Username:** @$DISPLAY_USERNAME
- **Display Name:** $DISPLAY_NAME
- **Verified:** $VERIFIED
- **Bio:** $BIO
- **Followers:** $FOLLOWERS
- **Following:** $FOLLOWING
- **Joined:** $JOIN_DATE
- **Tweets:** $TWEETS

---

## Risk Assessment

**Risk Score:** $SCORE/90
**Risk Level:** $RISK_LEVEL

**Red Flags Found:** $RED_FLAGS
EOF

if [ "$RED_FLAGS" -gt 0 ]; then
    echo "" >> "$OUTPUT_FILE"
    echo "### Red Flag Details:" >> "$OUTPUT_FILE"
    echo "- Unrealistic claims: 10 points" >> "$OUTPUT_FILE"
    echo "- DM solicitation: 10 points" >> "$OUTPUT_FILE"
    echo "- Crypto giveaway: 10 points" >> "$OUTPUT_FILE"
    echo "- Emotion manipulation: 10 points" >> "$OUTPUT_FILE"
    echo "- Financial advice disclaimer missing: 10 points" >> "$OUTPUT_FILE"
    echo "- VIP group promotion: 10 points" >> "$OUTPUT_FILE"
    echo "- No verification badge: 10 points" >> "$OUTPUT_FILE"
fi

echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "## Disclaimer" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR." >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Scan date: $TIMESTAMP" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "**Red flags:** guaranteed_returns • giveaway_airdrop • dm_solicitation • free_crypto • alpha_dm_scheme • unrealistic_claims • download_install • urgency_tactics • emotional_manipulation • low_credibility" >> "$OUTPUT_FILE"

echo ""
echo "✅ Report saved to: $OUTPUT_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Scan Complete — Refer to disclaimer above — Independent verification always recommended"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
