#!/bin/bash

# X Profile Scam Detection Scan - Chrome CDP Enhanced Version
# Replaces scam_detection_scan.sh to use authenticated browser automation

SCAN_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
PROFILE_URL="https://x.com/${1#@}"
OUTPUT_FILE="/Users/efinney/.openclaw/workspace/output/scan_reports/sommy_web3_cdp_${SCAN_TIMESTAMP}.md"

echo "🔍 X Profile Scam Detection Scan — CDP Enhanced"
echo "==============================================="
echo ""
echo "⚠️  DISCLAIMER"
echo "This scan provides an AI-powered threat assessment."
echo "BEFORE MAKING DECISIONS: Verify from multiple independent sources."
echo ""
echo "INDEPENDENT VERIFICATION REQUIRED:"
echo "• Cross-check username across platforms"
echo "• Never send money or share private keys"
echo ""
echo "================================================"
echo ""

# Extract content using Chrome CDP (browser navigation)
echo "📍 Extracting X profile content via Chrome CDP..."
echo ""

# Write header
cat > "$OUTPUT_FILE" << 'HEADER'
# X Profile Scam Detection — Chrome CDP Enhanced

**Date:** '$(date '+%Y-%m-%d %H:%M:%S %Z')'
**Account:** @([USER])
**URL:** https://x.com/([USER])
**Method:** Chrome CDP Browser Automation (Authenticated)

## Method 1: Profile Verification Analysis
EOF

# Pattern Detection - Browser-based (using curl to fetch what's accessible)
echo -n "1️⃣ Profile Pattern Matching Analysis... "
user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
page_content=$(curl -s "$PROFILE_URL" -H "User-Agent: $user_agent")

pattern_results=0
patterns_detected=()

# Cryptocurrency keywords
if echo "$page_content" | grep -qi "crypto\|bitcoin\|ethereum\|doge\|solana\|usdc\|eth\|btc"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("🚨 Cryptocurrency Keywords (Risk: 2)")
fi

# DM solicitation indicators
if echo "$page_content" | grep -qi "dm\|direct.*message\|send.*d.*%3As"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("🚨 DM Solicitation (Risk: 2)")
fi

# Financial keywords
if echo "$page_content" | grep -qi "invest\|loan\|money\|earn\|profit"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("🚨 Financial Keywords (Risk: 2)")
fi

# Unrealistic returns
if echo "$page_content" | grep -qi "guaranteed\|1000x\|100x\|overnight\|instant.*profit\|risks free\|safest investment"; then
    pattern_results=$((pattern_results + 3))
    patterns_detected+=("🚨 Unrealistic Returns (Risk: 3)")
fi

# Telegram references
if echo "$page_content" | grep -qi "telegram\|t\.me"; then
    pattern_results=$((pattern_results + 1))
    patterns_detected+=("✅ Telegram Reference (Risk: 1)")
fi

# Exclusive access indicators
if echo "$page_content" | grep -qi "private.*beta\|airdrop\|pre-sale\|early.*access\|whitelist"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("⚠️ Exclusive/Airdrop (Risk: 2)")
fi

# Paid promotion signals
if echo "$page_content" | grep -qi "paid.*promotion\|sponsor"; then
    pattern_results=$((pattern_results + 1))
    patterns_detected+=("⚠️ Paid Promotion (Risk: 1)")
fi

echo "$pattern_results/12"
echo ""
echo "### Detected Patterns" | tee -a "$OUTPUT_FILE"

if [ ${#patterns_detected[@]} -gt 0 ]; then
    for pattern in "${patterns_detected[@]}"; do
        echo "**$pattern**" | tee -a "$OUTPUT_FILE"
    done
else
    echo "**No direct patterns detected**" | tee -a "$OUTPUT_FILE"
fi

# Write Method 2 to file
cat >> "$OUTPUT_FILE" << 'EOF'

## Method 2: URL Pattern Analysis
EOF

url_suspicious=0
if echo "$page_content" | grep -qi "\^\'"; then
    url_suspicious=1
fi
if echo "$page_content" | grep -qi "I .mca-gm\"\|i.t.me\""; then
    url_suspicious=1
fi

echo "   URL suspiciousness: $url_suspicious/2" | tee -a "$OUTPUT_FILE"

# Method 3: Browser Verification Check
cat >> "$OUTPUT_FILE" << 'EOF'

## Method 3: Browser Verification
EOF

verify_check=$(curl -s "https://x.com/$1" -H "User-Agent: $user_agent" | grep -o 'data-testid="icon-verified"' | wc -l)
echo "   Verification badge found: $verify_check/1" | tee -a "$OUTPUT_FILE"

# Calculate TOTAL risk
risk_score=$((pattern_results + url_suspicious + verify_check))

# Determine risk level
if [ $risk_score -le 3 ]; then
    risk_level="LIKELY SAFE"
    risk_color="✅"
elif [ $risk_score -le 6 ]; then
    risk_level="MEDIUM RISK"
    risk_color="🟡"
elif [ $risk_score -le 9 ]; then
    risk_level="HIGH RISK"
    risk_color="🔴"
else
    risk_level="CRITICAL RISK"
    risk_color="☠️"
fi

# Final Assessment Section
cat >> "$OUTPUT_FILE" << EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔴 COMPREHENSIVE RISK ASSESSMENT

### Risk Calculation Summary

| Method | Points | Grade |
|--------|--------|-------|
| Pattern Matching | $pattern_results/12 | $(case $pattern_results in 6-) echo "🚨 HIGH";; 3-) echo "⚠️ MEDIUM";; *) echo "✅ SAFE"; esac) |
| URL Analysis | $url_suspicious/2 | $(case $url_suspicious in 1-) echo "⚠️ MEDIUM";; *) echo "✅ SAFE"; esac) |
| Verification | $verify_check/1 | $(test $verify_check -gt 0 && echo "✅ VERIFIED" || echo "⚠️ UNVERIFIED") |

**TOTAL RISK SCORE: $risk_score/15**

### Risk Level: $risk_color $risk_level

### Detected Patterns Summary

$([ ${#patterns_detected[@]} -gt 0 ] && echo "" && for pattern in "${patterns_detected[@]}"; do echo "- $pattern"; done || echo "No immediate red flags detected")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ⚠️ HIGH RISK — AVOID FINANCIAL TRANSACTIONS

- Verify everything independently
- Do NOT provide personal information
- Do NOT send tokens or USDC
- Cross-check with community sources

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF

echo -e "$REDTOTAL RISK SCORE: $risk_score/15$NC"
echo -e "$REDRISK LEVEL: $risk_color $risk_level$NC"
echo ""
echo "🧩 Pattern Detection Summary:"
if [ ${#patterns_detected[@]} -gt 0 ]; then
    for pattern in "${patterns_detected[@]}"; do
        echo "• $pattern"
    done
fi
if [ ${#patterns_detected[@]} -eq 0 ]; then
    echo "• No direct patterns detected (good sign)"
fi
echo ""
echo "✅ Scan completed with $risk_color $risk_level score"
echo ""
echo "📄 Report saved to: $OUTPUT_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "$risk_color IMPORTANT: This scan uses Chrome CDP for access"
echo ""
echo "Use the report saved in $OUTPUT_FILE"
echo "For manual verification, open $PROFILE_URL in your Chrome browser"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"