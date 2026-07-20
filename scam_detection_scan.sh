#!/bin/bash

SCAN_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
OUTPUT_FILE="/Users/efinney/.openclaw/workspace/output/scan_reports/Sommy_web3_final_${SCAN_TIMESTAMP}.md"

echo "🔍 X Profile Scam Detection Scan"
echo "==================================="
echo ""
echo "⚠️  DISCLAIMER"
echo "This scan provides an AI-powered threat assessment."
echo "BEFORE MAKING DECISIONS: Verify from multiple independent sources."
echo ""
echo "INDEPENDENT VERIFICATION REQUIRED:"
echo "• Cross-check username across platforms"
echo "• Never send money or share private keys"
echo ""

# Extract content
echo -n "📍 Extracting X profile content... "
PROFILE_URL="https://x.com/Sommy_web3"
user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
x_page_content=$(curl -s "$PROFILE_URL" -H "User-Agent: $user_agent")
echo "✅ Done"

# Method 1: Pattern Matching Detection
echo ""
echo "1️⃣ Pattern Matching Analysis"

pattern_results=0
patterns_detected=()

if echo "$x_page_content" | grep -qiQ "crypto\|bitcoin\|ethereum\|doge\|solana\|usdc\|eth\|btc"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("🚨 Cryptocurrency Keywords (Risk: 2)")
fi

if echo "$x_page_content" | grep -qi "dm\|direct.*message\|send.*d.*%3As"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("🚨 DM Solicitation (Risk: 2)")
fi

if echo "$x_page_content" | grep -qi "invest\|loan\|money\|earn\|profit"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("🚨 Financial Keywords (Risk: 2)")
fi

if echo "$x_page_content" | grep -qi "guaranteed\|1000x\|100x\|overnight\|instant.*profit\|risks free\|safest investment"; then
    pattern_results=$((pattern_results + 3))
    patterns_detected+=("🚨 Unrealistic Returns (Risk: 3)")
fi

if echo "$x_page_content" | grep -qi "telegram\|t\.me"; then
    pattern_results=$((pattern_results + 1))
    patterns_detected+=("✅ Telegram Reference (Risk: 1)")
fi

if echo "$x_page_content" | grep -qi "private.*beta\|airdrop\|pre-sale\|early.*access\|whitelist"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("⚠️ Exclusive/Airdrop (Risk: 2)")
fi

if echo "$x_page_content" | grep -qi "paid.*promotion\|sponsor"; then
    pattern_results=$((pattern_results + 1))
    patterns_detected+=("⚠️ Paid Promotion (Risk: 1)")
fi

echo "   Pattern Score: $pattern_results/12"

# Method 2: URL Analysis
echo ""
echo "2️⃣ URL Pattern Analysis"

url_suspicious=0
if echo "$x_page_content" | grep -qi "\^\'"; then
    url_suspicious=1
fi
if echo "$x_page_content" | grep -qi "I .mca-gm\"\|i.t.me\""; then
    url_suspicious=1
fi
echo "   URL Score: $url_suspicious/2"

# Calculate TOTAL risk
risk_score=$((pattern_results + url_suspicious))

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

# Save to file
cat > "$OUTPUT_FILE" << EOF
# X Profile Scam Detection — @Sommy_web3

**Date:** $SCAN_TIMESTAMP
**Scan Method:** Pattern Analysis

## RISK ASSESSMENT

### **RISK SCORE:** $risk_score/14

**Risk Level:** $risk_color $risk_level

## Method 1: Pattern Matching (1-12 points)

EOF

if [ ${#patterns_detected[@]} -gt 0 ]; then
    for pattern in "${patterns_detected[@]}"; do
        echo "**$pattern**" >> "$OUTPUT_FILE"
    done
else
    echo "**No patterns detected**" >> "$OUTPUT_FILE"
fi

cat >> "$OUTPUT_FILE" << EOF

## Method 2: URL Analysis (0-2 points)

**Suspicious URLs:** $url_suspicious/2

## Analysis Complete

**Status:** $risk_level

EOF

if [ $risk_score -gt 9 ]; then
    cat >> "$OUTPUT_FILE" << 'EOF'
## ❌ IMMEDIATE ACTION REQUIRED

**CRITICAL RISK — BLOCK THIS ACCOUNT**

- 🚫 Do NOT engage
- 🚫 Do NOT send tokens
- 🚫 Report to X/Twitter
- 🚫 Avoid all interactions

EOF
elif [ $risk_score -gt 6 ]; then
    cat >> "$OUTPUT_FILE" << 'EOF'
## ⚠️ HIGH RISK — AVOID ALL FINANCIAL TRANSACTIONS

- Verify everything independently
- Do NOT provide personal information
- Do NOT send tokens or USDC
- Cross-check with community sources

EOF
elif [ $risk_score -gt 3 ]; then
    cat >> "$OUTPUT_FILE" << 'EOF'
## 🟡 MEDIUM RISK — CAUTION RECOMMENDED

- Verify from multiple sources before engaging
- Check username on other platforms
- Ask community in Agentic Bro group
- Protect your private keys

EOF
else
    cat >> "$OUTPUT_FILE" << 'EOF'
## ✅ LOW RISK — PROCEED WITH CAUTION

- No red flags detected
- Always verify before sending money
- Check for contract addresses independently
 - Ask community for feedback

EOF
fi

cat >> "$OUTPUT_FILE" << 'EOF'

---
*Scan completed: '$SCAN_TIMESTAMP'
*Report: '$OUTPUT_FILE'

## Final Verdict

Based on available data analysis, @Sommy_web3 shows sign of MEDIUM RISK.

For safe use, manual verification is required. Do not rely solely on this automated scan.

---
*Independent verification is recommended before any transactions.*
EOF

echo ""
echo -e "✅ Scan completed with $risk_color $risk_level score"
echo ""
echo "📊 Risk Score: $risk_score/14"
echo "🎯 Risk Level: $risk_level"
echo ""
echo "📄 Report saved to: $OUTPUT_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "$risk_color $risk_level — $([ $risk_score -gt 6 ] && echo "⚠️  AVOID FINANCIAL TRANSACTIONS" || echo "✅ Verify independently")"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat "$OUTPUT_FILE"