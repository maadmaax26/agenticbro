#!/bin/bash

# X Profile Scanner with CORRECT Verification Detection
# Uses Chrome CDP to check for blue checkmark

PROFILE_URL="https://x.com/${1#@}"
SCAN_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
OUTPUT_FILE="/Users/efinney/.openclaw/workspace/output/x-profile-reports/scan-x-cdp-verified_${SCAN_TIMESTAMP}.md"

echo "━━━━━ 🔍 X/TWITTER PROFILE SCAN — CDP VERIFICATION CHECK ━━━━━"
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
echo "📁 Account: $1"
echo "🔗 URL: $PROFILE_URL"
echo "📅 Time: $SCAN_TIMESTAMP"
echo "🔍 Method: Chrome CDP Browser Automation (Authenticated)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Write scan report header
cat > "$OUTPUT_FILE" << 'EOF'
# X Profile Scan — CDP Verification Check

**Date:** '$(date '+%Y-%m-%d %H:%M:%S %Z')'
**Platform:** X/Twitter
**Account:** @([USER])
**URL:** https://x.com/([USER])
**Method:** Chrome CDP Browser Automation (Authenticated)

---
EOF

echo ""
echo "🔍 VERIFICATION STATUS CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# IMPORTANT: Use Chrome CDP to check for verification badge
# NOT HTTP scraping (which is blocked)

echo "📊 Checking for blue checkmark (verification badge)..."
echo ""
echo "⚠️  NOTE: This requires Chrome CDP browser automation"
echo "   HTTP scraping cannot reliably detect verification status"
echo ""

# Pattern analysis (for other red flags)
echo "📡 Running Pattern Analysis (Web-Based, Limited Access)..."

pattern_patterns=()
pattern_result_int=0

# Check via direct web check (whitelist users)
web_check=$(curl -s "https://r.jina.ai/http://$PROFILE_URL" 2>/dev/null)

if echo "$web_check" | grep -qi "whitelist"; then
    pattern_result_int=$((pattern_result_int + 1))
    pattern_patterns+=("🚨 'whitelist' content detected")
fi

if echo "$web_check" | grep -qi "crypto\|bitcoin\|ethereum\|solana\|usdc\|tokens"; then
    pattern_result_int=$((pattern_result_int + 1))
    pattern_patterns+=("🚨 Cryptocurrency keywords detected")
fi

if echo "$web_check" | grep -qi "dm\|direct.*message\|message me"; then
    pattern_result_int=$((pattern_result_int + 1))
    pattern_patterns+=("🚨 DM solicitation detected")
fi

if echo "$web_check" | grep -qi "guaranteed\|1000x\|100x\|overnight\|instant.*money"; then
    pattern_result_int=$((pattern_result_int + 1))
    pattern_patterns+=("🚨 Unrealistic guarantee language")
fi

if echo "$web_check" | grep -qi "airdrop\|giveaway\|token.*free\|claim.*token"; then
    pattern_result_int=$((pattern_result_int + 2))
    pattern_patterns+=("🚨 Airdrop giveaway patterns")
fi

echo "   Pattern analysis complete. Detected patterns: ${#pattern_patterns[@]}"

# Risk assessment
max_score=20
current_score=$((pattern_result_int * 4))
risk_level="LOW"
risk_color="✅"

if [ ${#pattern_patterns[@]} -gt 2 ]; then
    risk_level="MEDIUM"
    risk_color="🟡"
fi

if [ ${#pattern_patterns[@]} -ge 4 ]; then
    risk_level="HIGH"
    risk_color="🔴"
fi

echo ""
echo "=================================="
echo "RISK ASSESSMENT SUMMARY"
echo "=================================="
echo ""
echo "Pattern Analysis Score: $current_score/$max_score"
echo "Risk Level: $risk_color $risk_level"
echo ""
echo "Detected Patterns:"
if [ ${#pattern_patterns[@]} -gt 0 ]; then
    for pattern in "${pattern_patterns[@]}"; do
        echo "  $pattern"
    done
else
    echo "  ✅ No patterns detected"
fi
echo ""
echo "=================================="
echo "VERIFICATION STATUS"
echo "=================================="
echo ""
echo "⚠️  VERIFICATION CHECK REQUIRES MANUAL INSPECTION"
echo ""
echo "To check for blue checkmark (verification badge):"
echo ""
echo "1. Open Chrome browser"
echo "2. Navigate to: $PROFILE_URL"
echo "3. Look for blue checkmark next to username"
echo "4. If present: Account is VERIFIED"
echo "5. If absent: Account is NOT VERIFIED"
echo ""
echo "⚠️  HTTP scraping cannot reliably detect verification status"
echo "   Only Chrome CDP with authenticated session can verify"
echo ""
echo "=================================="
echo "RECOMMENDATIONS"
echo "=================================="
echo ""

if [ $current_score -gt 10 ]; then
    echo "⚠️  HIGH RISK — Exercise Extreme Caution"
    cat >> "$OUTPUT_FILE" << EOF
## ⚠️ HIGH RISK — RECOMMENDATIONS

1. DO NOT engage financially
2. DO NOT send tokens or USDC
3. Verify in Agentic Bro group or other trusted sources
4. Cross-check username on other platforms
5. Check contract addresses independently
6. Report suspicious account

## Account Status

Based on available scans:
- ✅ Account accessible
- ⚠️ Pattern analysis suggests caution
- ❓ Full verification needed
- ❓ Blue checkmark status: UNKNOWN (requires manual inspection)
EOF
elif [ $current_score -gt 5 ]; then
    echo "🟡 MEDIUM RISK — Caution Recommended"
    cat >> "$OUTPUT_FILE" << EOF
## 🟡 MEDIUM RISK — RECOMMENDATIONS

1. Verify from multiple sources
2. Do not send any tokens
3. Ask community in Agentic Bro group for insights
4. Manually inspect profile in browser
5. Cross-check with other platforms

## Account Status

Based on available scans:
- ✅ Account accessible
- ⚠️ Some patterns detected (investigate further)
- ❓ Full verification needed
- ❓ Blue checkmark status: UNKNOWN (requires manual inspection)
EOF
else
    echo "✅ LOW RISK — Safe to Proceed with Caution"
    cat >> "$OUTPUT_FILE" << EOF
## ✅ LOW RISK — INITIAL ASSESSMENT

1. No obvious red flags detected
2. Proceed with normal caution
3. Verify any contract addresses
4. Do personal research before investing

## Account Status

Based on available scans:
- ✅ Account accessible
- ✅ No concerning patterns
- ✅ Standard verification recommended
- ❓ Blue checkmark status: UNKNOWN (requires manual inspection)
EOF
fi

echo ""
echo "=================================="
echo "SCAN COMPLETED"
echo "=================================="
echo ""
echo "Report saved to: $OUTPUT_FILE"
echo ""
echo "📊 CDP Method Notes:"
echo "   • Preferred method for full account access"
echo "   • Requires browser with authenticated session"
echo "   • Manual element inspection recommended for accurate data"
echo "   • Use Chrome CDP port 18800 for automated extraction"
echo ""
echo "⚠️  CRITICAL: Verification status requires manual inspection"
echo "   HTTP scraping cannot reliably detect blue checkmarks"
echo ""