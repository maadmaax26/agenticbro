#!/usr/bin/env zsh

# X/Twitter Profile Scanner - HYBRID VERSION v2
# Combines Chrome CDP verification + Web Fetch pattern analysis
# Implements the correct 90-point weighted scoring system from AGENTS.md
# FIXED: Uses correct OpenClaw browser commands and multiple verification selectors

PROFILE_URL="https://x.com/${1#@}"
SCAN_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
OUTPUT_FILE="/Users/efinney/.openclaw/workspace/output/x-profile-reports/scan-x-hybrid_${SCAN_TIMESTAMP}.md"

# Create output directory if it doesn't exist
mkdir -p "$(dirname "$OUTPUT_FILE")"

echo "══════════════════════════════════════════════════════════════════"
echo "                    ⚠️  DISCLAIMER NOTICE ⚠️"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "This scan is an AI-powered threat assessment of X (Twitter) content."
echo "For complete accuracy, verify information through multiple sources."
echo ""
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo " LIMITATIONS:"
echo " • Only scans public profile data"
echo " • Does NOT verify user identity"
echo " • May miss sophisticated, well-hidden scams"
echo " • Pattern detection based on available content"
echo " • Verification check requires Chrome CDP session"
echo ""
echo " INDEPENDENT VERIFICATION REQUIRED:"
echo " • Cross-check username across multiple platforms"
echo " • Verify contract addresses manually"
echo " • Never send money or share private keys"
echo " • Check for blue checkmark manually in browser"
echo " • Ask community in Agentic Bro group for insights"
echo ""
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "━━━━━ 🔍 X/TWITTER PROFILE SCAN — HYBRID METHOD v2 ━━━━━"
echo ""
echo "📂 Platform: X/Twitter"
echo "📁 Account: $1"
echo "🔗 URL: $PROFILE_URL"
echo "📅 Time: $SCAN_TIMESTAMP"
echo "🔍 Method: Chrome CDP Verification + Web Fetch Pattern Analysis"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Initialize red flags and weights
typeset -A RED_FLAGS
typeset -A RED_FLAG_WEIGHTS
TOTAL_WEIGHT=0
MAX_WEIGHT=90

# Define red flags with weights (from AGENTS.md framework)
RED_FLAG_WEIGHTS=(
    ["Guaranteed Returns"]=10
    ["Private Alpha"]=10
    ["Unrealistic Claims"]=10
    ["Urgency Tactics"]=10
    ["No Track Record"]=10
    ["Requests Crypto"]=10
    ["No Verification"]=10
    ["Fake Followers"]=10
    ["New Account"]=5
    ["VIP Upsell"]=5
)

# Function to add red flag
add_red_flag() {
    local flag="$1"
    local weight="${RED_FLAG_WEIGHTS[$flag]}"
    RED_FLAGS["$flag"]="$weight"
    TOTAL_WEIGHT=$((TOTAL_WEIGHT + weight))
    echo "   🚨 $flag (weight: $weight)"
}

# Step 1: Verification status via Chrome CDP
echo ""
echo "🔍 STEP 1: VERIFICATION STATUS CHECK (Chrome CDP)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

VERIFICATION_STATUS="UNKNOWN"
VERIFICATION_EMOJI="⚠️"
VERIFICATION_METHOD="Manual inspection required"
VERIFICATION_DEBUG=""

# Try to use Chrome CDP for verification
if command -v openclaw &> /dev/null; then
    echo "📊 Checking for blue checkmark via Chrome CDP..."

    # Try to start browser
    echo "   Starting browser..."
    if openclaw browser start 2>/dev/null; then
        sleep 2

        # Navigate to profile
        echo "   Navigating to profile..."
        if openclaw browser navigate "$PROFILE_URL" 2>/dev/null; then
            sleep 3

            # Take snapshot (aria format for accessibility tree)
            echo "   Taking snapshot..."
            SNAPSHOT=$(openclaw browser snapshot --format aria 2>/dev/null || echo "")

            if [ -n "$SNAPSHOT" ]; then
                VERIFICATION_DEBUG="Snapshot captured successfully"

                # Test multiple selectors for verification badge
                VERIFICATION_FOUND=false

                # Selector 1: data-testid="icon-verified"
                if echo "$SNAPSHOT" | grep -q 'data-testid="icon-verified"'; then
                    VERIFICATION_FOUND=true
                    VERIFICATION_DEBUG="Found via data-testid=\"icon-verified\""
                fi

                # Selector 2: aria-label="Verified"
                if ! $VERIFICATION_FOUND && echo "$SNAPSHOT" | grep -q 'aria-label="Verified"'; then
                    VERIFICATION_FOUND=true
                    VERIFICATION_DEBUG="Found via aria-label=\"Verified\""
                fi

                # Selector 3: aria-label="Verified account"
                if ! $VERIFICATION_FOUND && echo "$SNAPSHOT" | grep -q 'aria-label="Verified account"'; then
                    VERIFICATION_FOUND=true
                    VERIFICATION_DEBUG="Found via aria-label=\"Verified account\""
                fi

                # Selector 4: Look for "Verified" in any aria-label
                if ! $VERIFICATION_FOUND && echo "$SNAPSHOT" | grep -qi 'aria-label=".*verified.*"'; then
                    VERIFICATION_FOUND=true
                    VERIFICATION_DEBUG="Found via aria-label containing 'verified'"
                fi

                # Selector 5: Look for role="img" with verification-related content
                if ! $VERIFICATION_FOUND && echo "$SNAPSHOT" | grep -qi 'role="img".*verified'; then
                    VERIFICATION_FOUND=true
                    VERIFICATION_DEBUG="Found via role=\"img\" with verification"
                fi

                # Selector 6: Look for the classic blue checkmark path
                if ! $VERIFICATION_FOUND && echo "$SNAPSHOT" | grep -qi 'path.*d="M22.5 12.5c0-1.58'; then
                    VERIFICATION_FOUND=true
                    VERIFICATION_DEBUG="Found via blue checkmark path"
                fi

                # Selector 7: Look for "Verified account" text anywhere
                if ! $VERIFICATION_FOUND && echo "$SNAPSHOT" | grep -qi 'Verified account'; then
                    VERIFICATION_FOUND=true
                    VERIFICATION_DEBUG="Found via 'Verified account' text"
                fi

                if $VERIFICATION_FOUND; then
                    VERIFICATION_STATUS="VERIFIED"
                    VERIFICATION_EMOJI="✅"
                    VERIFICATION_METHOD="Chrome CDP detected blue checkmark"
                    echo "   $VERIFICATION_EMOJI VERIFIED (blue checkmark detected)"
                    echo "   Debug: $VERIFICATION_DEBUG"
                else
                    VERIFICATION_STATUS="NOT VERIFIED"
                    VERIFICATION_EMOJI="❌"
                    VERIFICATION_METHOD="Chrome CDP - no blue checkmark found"
                    echo "   $VERIFICATION_EMOJI NOT VERIFIED (no blue checkmark)"
                    echo "   Debug: Tested 7 selectors, none found verification badge"
                    add_red_flag "No Verification"
                fi
            else
                VERIFICATION_STATUS="UNKNOWN"
                VERIFICATION_EMOJI="⚠️"
                VERIFICATION_METHOD="Chrome CDP - snapshot failed"
                VERIFICATION_DEBUG="Snapshot was empty or failed"
                echo "   $VERIFICATION_EMOJI UNKNOWN (snapshot failed)"
                echo "   Debug: $VERIFICATION_DEBUG"
                add_red_flag "No Verification"
            fi
        else
            VERIFICATION_STATUS="UNKNOWN"
            VERIFICATION_EMOJI="⚠️"
            VERIFICATION_METHOD="Chrome CDP - navigation failed"
            VERIFICATION_DEBUG="Failed to navigate to profile"
            echo "   $VERIFICATION_EMOJI UNKNOWN (navigation failed)"
            echo "   Debug: $VERIFICATION_DEBUG"
            add_red_flag "No Verification"
        fi
    else
        VERIFICATION_STATUS="UNKNOWN"
        VERIFICATION_EMOJI="⚠️"
        VERIFICATION_METHOD="Chrome CDP - browser start failed"
        VERIFICATION_DEBUG="Failed to start browser"
        echo "   $VERIFICATION_EMOJI UNKNOWN (browser start failed)"
        echo "   Debug: $VERIFICATION_DEBUG"
        add_red_flag "No Verification"
    fi
else
    echo "⚠️  OpenClaw browser automation not available"
    echo "   Falling back to manual verification..."
    VERIFICATION_STATUS="UNKNOWN"
    VERIFICATION_EMOJI="⚠️"
    VERIFICATION_METHOD="Manual inspection required (OpenClaw not available)"
    add_red_flag "No Verification"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 VERIFICATION STATUS SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Status: $VERIFICATION_EMOJI $VERIFICATION_STATUS"
echo "Method: $VERIFICATION_METHOD"
if [ -n "$VERIFICATION_DEBUG" ]; then
    echo "Debug: $VERIFICATION_DEBUG"
fi
echo ""

# Step 2: Pattern analysis via web fetch
echo "🔍 STEP 2: PATTERN ANALYSIS (Web Fetch)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📡 Fetching profile content via web fetch..."

# Use r.jina.ai for content extraction
web_check=$(curl -s "https://r.jina.ai/http://$PROFILE_URL" 2>/dev/null)

# Check for guaranteed returns
if echo "$web_check" | grep -qiE "guaranteed|guarantee|sure.*thing|can't.*lose|risk.*free"; then
    add_red_flag "Guaranteed Returns"
fi

# Check for private alpha
if echo "$web_check" | grep -qiE "private.*alpha|exclusive.*access|vip.*only|invitation.*only|whitelist"; then
    add_red_flag "Private Alpha"
fi

# Check for unrealistic claims
if echo "$web_check" | grep -qiE "1000x|100x|overnight|instant.*money|24h.*profit|get.*rich.*quick"; then
    add_red_flag "Unrealistic Claims"
fi

# Check for urgency tactics
if echo "$web_check" | grep -qiE "act.*now|limited.*time|expires.*soon|last.*chance|don't.*wait"; then
    add_red_flag "Urgency Tactics"
fi

# Check for no track record
if echo "$web_check" | grep -qiE "new.*account|just.*started|fresh.*start|recently.*created"; then
    add_red_flag "No Track Record"
fi

# Check for requests crypto
if echo "$web_check" | grep -qiE "send.*crypto|send.*usdc|send.*eth|send.*btc|send.*sol|send.*token"; then
    add_red_flag "Requests Crypto"
fi

# Check for fake followers
if echo "$web_check" | grep -qiE "buy.*followers|fake.*followers|bot.*followers|inflated.*followers"; then
    add_red_flag "Fake Followers"
fi

# Check for new account
if echo "$web_check" | grep -qiE "joined.*today|joined.*yesterday|new.*account|recent.*join"; then
    add_red_flag "New Account"
fi

# Check for VIP upsell
if echo "$web_check" | grep -qiE "vip.*group|vip.*access|premium.*group|exclusive.*group|paid.*group"; then
    add_red_flag "VIP Upsell"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 PATTERN ANALYSIS SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Red Flags Detected: ${#RED_FLAGS[@]}"
echo "Total Weight: $TOTAL_WEIGHT/$MAX_WEIGHT"

# Calculate risk score
if [ $MAX_WEIGHT -gt 0 ]; then
    RISK_SCORE=$(echo "scale=1; $TOTAL_WEIGHT * 10 / $MAX_WEIGHT" | bc)
else
    RISK_SCORE="0.0"
fi

echo "Risk Score: $RISK_SCORE/10"

# Determine risk level
RISK_LEVEL="LOW"
RISK_EMOJI="✅"

if (( $(echo "$RISK_SCORE > 3" | bc -l) )); then
    RISK_LEVEL="MEDIUM"
    RISK_EMOJI="🟡"
fi

if (( $(echo "$RISK_SCORE > 5" | bc -l) )); then
    RISK_LEVEL="HIGH"
    RISK_EMOJI="🔴"
fi

if (( $(echo "$RISK_SCORE > 7" | bc -l) )); then
    RISK_LEVEL="CRITICAL"
    RISK_EMOJI="☠️"
fi

echo "Risk Level: $RISK_EMOJI $RISK_LEVEL"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 FINAL ASSESSMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Combine verification status with risk level
if [ "$VERIFICATION_STATUS" = "VERIFIED" ]; then
    FINAL_RISK="LOW"
    FINAL_EMOJI="✅"
    FINAL_COLOR="green"
elif [ "$VERIFICATION_STATUS" = "NOT VERIFIED" ]; then
    if [ "$RISK_LEVEL" = "HIGH" ]; then
        FINAL_RISK="HIGH"
        FINAL_EMOJI="🔴"
        FINAL_COLOR="red"
    elif [ "$RISK_LEVEL" = "MEDIUM" ]; then
        FINAL_RISK="MEDIUM"
        FINAL_EMOJI="🟡"
        FINAL_COLOR="yellow"
    else
        FINAL_RISK="MEDIUM"
        FINAL_EMOJI="🟡"
        FINAL_COLOR="yellow"
    fi
else
    FINAL_RISK="$RISK_LEVEL"
    FINAL_EMOJI="$RISK_EMOJI"
    FINAL_COLOR="yellow"
fi

echo "Verification Status: $VERIFICATION_EMOJI $VERIFICATION_STATUS"
echo "Pattern Analysis: $RISK_EMOJI $RISK_LEVEL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FINAL RISK LEVEL: $FINAL_EMOJI $FINAL_RISK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Write report
cat > "$OUTPUT_FILE" << EOF
# X Profile Scan — Hybrid Method v2

**Date:** $SCAN_TIMESTAMP
**Platform:** X/Twitter
**Account:** $1
**URL:** $PROFILE_URL
**Method:** Chrome CDP Verification + Web Fetch Pattern Analysis

---

## ⚠️ DISCLAIMER NOTICE

**This scan is an AI-powered threat assessment of X (Twitter) content.**

For complete accuracy, verify information through multiple sources.

---

### LIMITATIONS

• Only scans public profile data
• Does NOT verify user identity
• May miss sophisticated, well-hidden scams
• Pattern detection based on available content
• Verification check requires Chrome CDP session

---

### INDEPENDENT VERIFICATION REQUIRED

• Cross-check username across multiple platforms
• Verify contract addresses manually
• Never send money or share private keys
• Check for blue checkmark manually in browser
• Ask community in Agentic Bro group for insights

---

## Verification Status

**Status:** $VERIFICATION_EMOJI **$VERIFICATION_STATUS**
**Method:** $VERIFICATION_METHOD**
EOF

if [ -n "$VERIFICATION_DEBUG" ]; then
    cat >> "$OUTPUT_FILE" << EOF
**Debug:** $VERIFICATION_DEBUG
EOF
fi

cat >> "$OUTPUT_FILE" << EOF

---

## Pattern Analysis

**Red Flags Detected:** ${#RED_FLAGS[@]}
**Total Weight:** $TOTAL_WEIGHT/$MAX_WEIGHT
**Risk Score:** $RISK_SCORE/10
**Risk Level:** $RISK_EMOJI $RISK_LEVEL

---

## Detected Red Flags

EOF

if [ ${#RED_FLAGS[@]} -gt 0 ]; then
    for flag in "${(@k)RED_FLAGS}"; do
        weight="${RED_FLAGS[$flag]}"
        echo "- 🚨 $flag (weight: $weight)" >> "$OUTPUT_FILE"
    done
else
    echo "- No red flags detected" >> "$OUTPUT_FILE"
fi

cat >> "$OUTPUT_FILE" << EOF

---

## Final Assessment

**Verification Status:** $VERIFICATION_EMOJI $VERIFICATION_STATUS
**Pattern Analysis:** $RISK_EMOJI $RISK_LEVEL
**Overall Risk Level:** $FINAL_EMOJI $FINAL_RISK

---

## Recommendations

EOF

case "$FINAL_RISK" in
    "CRITICAL")
        cat >> "$OUTPUT_FILE" << 'EOF'
### ☠️ CRITICAL RISK — AVOID ALL INTERACTIONS

1. **BLOCK this account immediately**
2. **DO NOT send any tokens or USDC**
3. **DO NOT provide personal information**
4. **Report to X/Twitter**
5. **Warn community members**
EOF
        ;;
    "HIGH")
        cat >> "$OUTPUT_FILE" << 'EOF'
### 🔴 HIGH RISK — EXTREME CAUTION REQUIRED

1. **DO NOT engage financially**
2. **DO NOT send tokens or USDC**
3. **Verify from multiple independent sources**
4. **Ask community in Agentic Bro group for insights**
5. **Check contract addresses independently**
6. **Report suspicious activity**
EOF
        ;;
    "MEDIUM")
        cat >> "$OUTPUT_FILE" << 'EOF'
### 🟡 MEDIUM RISK — CAUTION RECOMMENDED

1. **Verify from multiple sources**
2. **Do not send any tokens**
3. **Ask community in Agentic Bro group for insights**
4. **Manually inspect profile in browser**
5. **Cross-check with other platforms**
6. **Check for blue checkmark manually**
EOF
        ;;
    *)
        cat >> "$OUTPUT_FILE" << 'EOF'
### ✅ LOW RISK — PROCEED WITH CAUTION

1. **No obvious red flags detected**
2. **Proceed with normal caution**
3. **Verify any contract addresses**
4. **Do personal research before investing**
5. **Check for blue checkmark manually**
EOF
        ;;
esac

cat >> "$OUTPUT_FILE" << EOF

---

*Scan completed: $SCAN_TIMESTAMP*
*Report: $OUTPUT_FILE*
*Method: Hybrid v2 (Chrome CDP + Web Fetch)*
*Scoring: 90-Point Weighted System*
*Selectors tested: 7 different verification badge selectors*
EOF

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SCAN COMPLETED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Report saved to: $OUTPUT_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 HYBRID SCORING NOTES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "• Chrome CDP for verification check (blue checkmark detection)"
echo "• Web fetch for pattern analysis (red flag detection)"
echo "• 90-point weighted scoring system from AGENTS.md"
echo "• 10 red flag types with consistent weights"
echo "• Risk score formula: (weight / 90) × 10"
echo "• Standardized risk levels: LOW (0-3), MEDIUM (3-5), HIGH (5-7), CRITICAL (7-10)"
echo "• Comprehensive assessment combining both methods"
echo "• 7 different verification badge selectors tested"
echo ""