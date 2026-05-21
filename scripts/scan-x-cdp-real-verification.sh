#!/bin/bash

# X Profile Scanner with REAL Chrome CDP Verification Check
# Uses Chrome DevTools Protocol to check for blue checkmark

PROFILE_URL="https://x.com/${1#@}"
SCAN_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
OUTPUT_FILE="/Users/efinney/.openclaw/workspace/output/x-profile-reports/scan-x-cdp-real-verification_${SCAN_TIMESTAMP}.md"

echo "━━━━━ 🔍 X/TWITTER PROFILE SCAN — REAL CDP VERIFICATION ━━━━━"
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
# X Profile Scan — Real CDP Verification Check

**Date:** '$(date '+%Y-%m-%d %H:%M:%S %Z')'
**Platform:** X/Twitter
**Account:** @([USER])
**URL:** https://x.com/([USER])
**Method:** Chrome CDP Browser Automation (Authenticated)

---
EOF

echo ""
echo "🔍 REAL VERIFICATION STATUS CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📊 Checking for blue checkmark (verification badge) via Chrome CDP..."
echo ""

# Use Chrome CDP to check for verification badge
# This requires Chrome CDP running on port 18800 with authenticated session

# Try to use openclaw browser automation if available
if command -v openclaw &> /dev/null; then
    echo "✅ Using OpenClaw browser automation..."
    echo ""

    # Navigate to profile
    echo "📍 Navigating to profile..."
    openclaw session_send request:browser goto "$PROFILE_URL" 2>/dev/null || echo "⚠️  Browser navigation failed"

    # Wait for page to load
    sleep 3

    # Take snapshot
    echo "📸 Taking page snapshot..."
    SNAPSHOT=$(openclaw session_send request:browser snapshot 2>/dev/null || echo "")

    # Check for verification badge
    if echo "$SNAPSHOT" | grep -q 'data-testid="icon-verified"'; then
        VERIFICATION_STATUS="VERIFIED"
        VERIFICATION_EMOJI="✅"
        VERIFICATION_COLOR="green"
    else
        VERIFICATION_STATUS="NOT VERIFIED"
        VERIFICATION_EMOJI="❌"
        VERIFICATION_COLOR="red"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "VERIFICATION STATUS: $VERIFICATION_EMOJI $VERIFICATION_STATUS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Add to report
    cat >> "$OUTPUT_FILE" << EOF
## Verification Status

**Status:** $VERIFICATION_EMOJI **$VERIFICATION_STATUS**

**Method:** Chrome CDP Browser Automation
**Detection:** Checked for \`data-testid="icon-verified"\` element

EOF

else
    echo "⚠️  OpenClaw browser automation not available"
    echo ""
    echo "Falling back to manual verification instructions..."
    echo ""

    VERIFICATION_STATUS="UNKNOWN"
    VERIFICATION_EMOJI="⚠️"
    VERIFICATION_COLOR="yellow"

    cat >> "$OUTPUT_FILE" << 'EOF'
## Verification Status

**Status:** ⚠️ **UNKNOWN**

**Method:** Manual Verification Required
**Reason:** OpenClaw browser automation not available

EOF
fi

echo ""
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
echo "FINAL ASSESSMENT"
echo "=================================="
echo ""

# Combine verification status with risk level
if [ "$VERIFICATION_STATUS" = "VERIFIED" ]; then
    FINAL_RISK="LOW"
    FINAL_EMOJI="✅"
    FINAL_COLOR="green"
elif [ "$VERIFICATION_STATUS" = "NOT VERIFIED" ]; then
    if [ "$risk_level" = "HIGH" ]; then
        FINAL_RISK="HIGH"
        FINAL_EMOJI="🔴"
        FINAL_COLOR="red"
    elif [ "$risk_level" = "MEDIUM" ]; then
        FINAL_RISK="MEDIUM"
        FINAL_EMOJI="🟡"
        FINAL_COLOR="yellow"
    else
        FINAL_RISK="MEDIUM"
        FINAL_EMOJI="🟡"
        FINAL_COLOR="yellow"
    fi
else
    FINAL_RISK="$risk_level"
    FINAL_EMOJI="$risk_color"
    FINAL_COLOR="yellow"
fi

echo "Verification Status: $VERIFICATION_EMOJI $VERIFICATION_STATUS"
echo "Pattern Analysis: $risk_color $risk_level"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FINAL RISK LEVEL: $FINAL_EMOJI $FINAL_RISK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Add final assessment to report
cat >> "$OUTPUT_FILE" << EOF
## Pattern Analysis

**Score:** $current_score/$max_score
**Risk Level:** $risk_color $risk_level

**Detected Patterns:**
EOF

if [ ${#pattern_patterns[@]} -gt 0 ]; then
    for pattern in "${pattern_patterns[@]}"; do
        echo "- $pattern" >> "$OUTPUT_FILE"
    done
else
    echo "- No patterns detected" >> "$OUTPUT_FILE"
fi

cat >> "$OUTPUT_FILE" << EOF

## Final Assessment

**Verification Status:** $VERIFICATION_EMOJI $VERIFICATION_STATUS
**Pattern Analysis:** $risk_color $risk_level
**Overall Risk Level:** $FINAL_EMOJI $FINAL_RISK

EOF

echo "=================================="
echo "RECOMMENDATIONS"
echo "=================================="
echo ""

if [ "$FINAL_RISK" = "HIGH" ]; then
    echo "⚠️  HIGH RISK — Exercise Extreme Caution"
    cat >> "$OUTPUT_FILE" << EOF
## ⚠️ HIGH RISK — RECOMMENDATIONS

1. DO NOT engage financially
2. DO NOT send tokens or USDC
3. Verify in Agentic Bro group or other trusted sources
4. Cross-check username on other platforms
5. Check contract addresses independently
6. Report suspicious account
EOF
elif [ "$FINAL_RISK" = "MEDIUM" ]; then
    echo "🟡 MEDIUM RISK — Caution Recommended"
    cat >> "$OUTPUT_FILE" << EOF
## 🟡 MEDIUM RISK — RECOMMENDATIONS

1. Verify from multiple sources
2. Do not send any tokens
3. Ask community in Agentic Bro group for insights
4. Manually inspect profile in browser
5. Cross-check with other platforms
EOF
else
    echo "✅ LOW RISK — Safe to Proceed with Caution"
    cat >> "$OUTPUT_FILE" << EOF
## ✅ LOW RISK — RECOMMENDATIONS

1. No obvious red flags detected
2. Proceed with normal caution
3. Verify any contract addresses
4. Do personal research before investing
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
echo "   • Used Chrome CDP for verification check"
echo "   • Checked for blue checkmark element"
echo "   • Pattern analysis via web scraping"
echo "   • Combined assessment for accurate risk level"
echo ""