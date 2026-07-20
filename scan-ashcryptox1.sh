#!/bin/bash
# X/Twitter Profile Scam Scanner - @AshCryptoX1 (Direct Chrome CDP)
# Method: Direct curl + Chrome CDP API

PROFILE_URL="https://x.com/AshCryptoX1"
TIMESTAMP=$(date +%s)

echo "🔍 X Profile Scan — @AshCryptoX1"
echo "Target: https://x.com/AshCryptoX1"
echo "Method: Chrome CDP (direct API)"
echo ""

# Navigate to profile
echo "📍 Navigating to profile..."
curl -s -X POST "http://localhost:18800/jsonrpc" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "method": "Page.navigate",
    "params": { "url": "'"$PROFILE_URL"'" }
  }' > /dev/null 2>&1

# Wait for page load
echo "⏳ Waiting for page to load..."
sleep 5

# Capture payload data (X's internal JavaScript data)
echo "📸 Extracting profile data from X's DOM..."
PAYLOAD=$(curl -s "https://x.com/AshCryptoX1" | grep -oP 'window\.YTCFG\s*=\s*\{[^}]+\}' | head -1 || echo "")

# Extract shortname from URL
USERNAME="${PROFILE_URL##*/}"

# Extract display name
DISPLAY_NAME=$(curl -s "https://x.com/$USERNAME" | grep -oP 'data-testid="user-mentioned-displayname">[^<]*</span>' | sed 's/.*<span[^>]*>\(.*\)<\/span>/\1/' | sed 's/[[:cntrl:]]//g' | sed 's/<[^>]*>//g')

# Extract bio
BIO=$(curl -s "https://x.com/$USERNAME" | grep -oP 'data-testid="tweetText" [^>]*>[^<]*</div>' | head -1 | sed 's/<[^>]*>//g' | sed 's/[[:cntrl:]]//g' | sed 's/&nbsp;//g' | sed 's/&amp;/\&/g' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

# Extract follower count using multiple methods
FOLLOWERS=$(curl -s "https://x.com/$USERNAME" | grep -oP '[0-9,]*(?= followers)' | head -1 | tr -d ',' || echo "0")

# Following count
FOLLOWING=$(curl -s "https://x.com/$USERNAME" | grep -oP '[0-9,]*(?= following)' | head -1 | tr -d ',' || echo "0")

# Verification badge
VERIFY_BADGE=$(curl -s "https://x.com/$USERNAME" | grep -o 'data-testid="icon-verified"' | wc -l)

echo "Profile data extracted:"
echo "  Username: @${USERNAME:-Unknown}"
echo "  Display: ${DISPLAY_NAME:-Unknown}"
echo "  Followers: ${FOLLOWERS:-0}"
echo "  Following: ${FOLLOWING:-0}"
echo "  Verification: $([[ $VERIFY_BADGE -gt 0 ]] && echo "✅ Verified" || echo "❌ Unverified")"
echo "  Bio: ${BIO:0:100}..."
echo ""

# Red flag analysis (20-point system)
RED_FLAGS=0
SCORE=0

# 1. Guaranteed returns (10 points)
if echo "$BIO" | grep -qiE "(guaranteed|100x|500x|1000x|overnight|instant.*return|never.*lose|zero risk)"; then
    echo "🚨 Red flag: Guaranteed returns (10 pts)"
    ((SCORE+=10))
    ((RED_FLAGS+=1))
fi

# 2. DM solicitation (10 points)
if echo "$BIO" | grep -qi "(dm me|message me|send dm|private message|d.m.)"; then
    echo "🚨 Red flag: DM solicitation (10 pts)"
    ((SCORE+=10))
    ((RED_FLAGS+=1))
fi

# 3. Crypto giveaways (10 points)
if echo "$BIO" | grep -qiE "(giveaway|airdrop|free crypto|win.*token|token.*free)"; then
    echo "🚨 Red flag: Crypto giveaways (10 pts)"
    ((SCORE+=10))
    ((RED_FLAGS+=1))
fi

# 4. Private investment/VIP groups (10 points)
if echo "$BIO" | grep -qiE "(private group|vip group|exclusive group|members only|investor only)"; then
    echo "🚨 Red flag: Private investment/VIP groups (10 pts)"
    ((SCORE+=10))
    ((RED_FLAGS+=1))
fi

# 5. Money-making/pyramid schemes (10 points)
if echo "$BIO" | grep -qiE "(earn money|make money|rich.*now|fast money|multi-level|downline|team)"; then
    echo "🚨 Red flag: Money-making/pyramid scheme (10 pts)"
    ((SCORE+=10))
    ((RED_FLAGS+=1))
fi

# 6. Urgency tactics (10 points)
if echo "$BIO" | grep -qiE "(now|today|limited time|act fast|urgent|closing soon)"; then
    echo "🚨 Red flag: Urgency tactics (10 pts)"
    ((SCORE+=10))
    ((RED_FLAGS+=1))
fi

# 7. Financial advice without proper disclaimer (10 points)
if echo "$BIO" | grep -qiE "advice" && ! echo "$BIO" | grep -qi "financial advice.*disclaimer" && ! echo "$BIO" | grep -qiE "I am not a (financial)? advisor|For informational purposes"; then
    echo "🚨 Red flag: Missing financial advice disclaimer (10 pts)"
    ((SCORE+=10))
    ((RED_FLAGS+=1))
fi

# 8. Emotional manipulation (10 points)
if echo "$BIO" | grep -qiE "(financial crisis|investor opportunity|never miss|missing out|secure your future)"; then
    echo "🚨 Red flag: Emotional manipulation (10 pts)"
    ((SCORE+=10))
    ((RED_FLAGS+=1))
fi

# 9. Suspicious website/donate links (10 points)
if echo "$BIO" | grep -qiE "(join my group|donate to me|support me|send btc|send eth|fund project)" && ! echo "$BIO" | grep -qiE "(official website|site|link in bio|biography)"; then
    echo "🚨 Red flag: Suspicious requests (10 pts)"
    ((SCORE+=10))
    ((RED_FLAGS+=1))
fi

# 10. No clear value proposition (10 points)
if [ -z "$BIO" ] || echo "$BIO" | grep -qiE "(make money|invest|crypto|token|profit)" && ! echo "$BIO" | grep -qiE "(research|analysis|education|community|updates)"; then
    echo "⚠️  Red flag: Weak value proposition (10 pts)"
    ((SCORE+=10))
    ((RED_FLAGS+=1))
fi

# Risk score calculation (max 100 points, 0-10 scale)
RISK_SCORE=$(echo "scale=1; $SCORE * 10 / 20" | bc)

# Risk level determination
case $RISK_SCORE in
    0) RISK_LEVEL="LOW"; RECOMMENDATION="✅ LOW RISK - Legitimate account" ;;
    0.1-3) RISK_LEVEL="UNVERIFIED"; RECOMMENDATION="⚠️  UNVERIFIED - Check before engaging" ;;
    3.1-5) RISK_LEVEL="MEDIUM"; RECOMMENDATION="⚠️  MEDIUM RISK - Exercise caution" ;;
    5.1-7) RISK_LEVEL="PARTIALLY VERIFIED"; RECOMMENDATION="🚨 HIGH ALERT - Use extreme caution" ;;
    7.1-8.5) RISK_LEVEL="HIGH RISK"; RECOMMENDATION="🚨 CRITICAL - Likely scammer" ;;
    8.6-10) RISK_LEVEL="CRITICAL"; RECOMMENDATION="🚨🚨 DEFINITE SCAM - Avoid immediately" ;;
    *) RISK_LEVEL="UNDEFINED"; RECOMMENDATION="? Unknown risk" ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SCAN RESULTS — @AshCryptoX1"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Profile Information:"
echo "  Username: @${USERNAME:-AshCryptoX1}"
echo "  Display Name: ${DISPLAY_NAME:-N/A}"
echo "  Followers: ${FOLLOWERS:-0}"
echo "  Following: ${FOLLOWING:-0}"
echo "  Verification: $([[ $VERIFY_BADGE -gt 0 ]] && echo "✅ Verified account" || echo "❌ Unverified account")"
echo "  Bio length: ${#BIO} characters"
echo ""
echo "Analysis:"
echo "  Red Flags Detected: $RED_FLAGS / 10"
echo "  Risk Score: $RISK_SCORE/10.0"
echo "  Risk Level: $RISK_LEVEL"
echo ""
echo "Recommendation:"
echo "  $RECOMMENDATION"
echo ""
if [ $RISK_LEVEL = "HIGH RISK" ] || [ $RISK_LEVEL = "CRITICAL" ]; then
    echo "⚠️  WARNING: This account has significant red flags"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Actions to take:"
    echo "  ✗ Do NOT send any crypto to this account"
    echo "  ✗ Do NOT join any groups they mention"
    echo "  ✗ Do NOT provide personal information"
    echo "  ✓ Report to x.com/@username/scam if applicable"
    echo "  ✓ Scan contract addresses on dexscreener.com first"
fi
echo ""
echo "────────────────────────────────────────"
echo "Scan completed at: $(date)"
echo "────────────────────────────────────────"

# Save JSON report
mkdir -p output/scan_reports
REPORT_FILE="output/scan_reports/${USERNAME:-AshCryptoX1}_${TIMESTAMP}.json"

cat > "$REPORT_FILE" << LOGEOF
{
  "scan_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "scan_method": "Direct Chrome CDP HTML Parsing",
  "target_offset": 0,
  "profile": {
    "username": "${USERNAME:-AshCryptoX1}",
    "profile_url": "$PROFILE_URL",
    "display_name": "${DISPLAY_NAME:-N/A}",
    "followers": ${FOLLOWERS:-0},
    "following": ${FOLLOWING:-0},
    "verification_badge": $([[ $VERIFY_BADGE -gt 0 ]] && echo "true" || echo "false"),
    "bio": "$BIO",
    "bio_length": ${#BIO}
  },
  "red_flags": {
    "total": $RED_FLAGS,
    "guaranteed_returns": $([[ $SCORE -ge 10 ]] && echo "true" || echo "false"),
    "dm_solicitation": $([[ $SCORE -ge 10 ]] && echo "true" || echo "false"),
    "giveaways": $([[ $SCORE -ge 20 ]] && echo "true" || echo "false"),
    "private_groups": $([[ $SCORE -ge 30 ]] && echo "true" || echo "false"),
    "money_schemes": $([[ $SCORE -ge 40 ]] && echo "true" || echo "false"),
    "urgency": $([[ $SCORE -ge 50 ]] && echo "true" || echo "false"),
    "disclaimer": $([[ $SCORE -ge 60 ]] && echo "false" || echo "true"),
    "emotional": $([[ $SCORE -ge 70 ]] && echo "true" || echo "false"),
    "suspicious_links": $([[ $SCORE -ge 80 ]] && echo "true" || echo "false"),
    "value_proposition": $([[ $SCORE -ge 90 ]] && echo "true" || echo "false")
  },
  "risk_score": {
    "score": $RISK_SCORE,
    "level": "$RISK_LEVEL",
    "assessment": "${RECOMMENDATION}"
  },
  "scan_config": {
    "browser_cdp": "lo",
    "profile_url": "$PROFILE_URL",
    "page_load_wait": 5,
    "extraction_method": "curl_html_parsing",
    "red_flag_checker": "bash_grep_patterns"
  }
}
LOGEOF

echo "📂 Full report saved to: $REPORT_FILE"
exit 0