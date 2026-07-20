#!/bin/bash

# Comprehensive X Profile Scam Detection Scan
# Multi-method approach combining web scraping, pattern analysis, and heuristic detection

SCAN_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
OUTPUT_FILE="/Users/efinney/.openclaw/workspace/output/scan_reports/Sommy_web3_comprehensive_${SCAN_TIMESTAMP}.md"

# Color codes for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━ 🔍 COMPREHENSIVE X PROFILE SCAM DETECTION SCAN ━━━━━${NC}"
echo -e "$BLUE────────────────────────────────────────────────────────────────────────${NC}"
echo -e ""
echo -e "$GREEN⚠️  DISCLAIMER NOTICE$NC"
echo -e "This scan provides an AI-powered threat assessment with multiple detection methods."
echo -e "BEFORE MAKING ANY DECISIONS: Verify information from multiple independent sources."
echo -e ""
echo -e "$YELLOWINDEPENDENT VERIFICATION REQUIRED:$NC"
echo -e "• Cross-check username across platforms"
echo -e "• Never send money or share private keys"
echo -e ""

# Write scan header to file
cat > "$OUTPUT_FILE" << 'HEADER'
# Comprehensive X Profile Scam Detection Scan

**Scan Date:** $(date '+%Y-%m-%d %H:%M:%S %Z')
**Account:** @Sommy_web3
**URL:** https://x.com/Sommy_web3
**Method:** Multi-method Detection (Web Scraping + Pattern Analysis)

## ━━━━━━ WARNING ━━━━━━

PLEASE VERIFY WITH MULTIPLE SOURCES BEFORE MAKING DECISIONS

HEADER

# Extract X page content
echo -e "$BLUE[1/6] Extracting X profile content...$NC"
PROFILE_URL="https://x.com/Sommy_web3"
user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
x_page_content=$(curl -s "$PROFILE_URL" -H "User-Agent: $user_agent")

# Save content for analysis
echo "$x_page_content" > /tmp/sommy_web3_content.html

echo -e "$GREEN✅ Page content extracted (${$#x_page_content//- /} characters)$NC"
echo ""

# Method 1: Direct Pattern Matching
echo -e "$BLUE[2/6] Running direct pattern matching analysis...$NC"
cat >> "$OUTPUT_FILE" << 'EOF'

## Method 1: Direct Pattern Matching
EOF

pattern_results=0
patterns_detected=()

# Cryptocurrency keywords
if echo "$x_page_content" | grep -qi "crypto\|bitcoin\|ethereum\|doge\|solana\|usdc\|eth\|btc"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("🚨 Cryptocurrency Keywords (Risk: 2)")
fi

# DM solicitation
if echo "$x_page_content" | grep -qi "dm\|direct.*message\|send.*d.*%3As\|send.*dm.*copy"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("🚨 DM Solicitation Pattern (Risk: 2)")
fi

# Financial keywords
if echo "$x_page_content" | grep -qi "invest\|loan\|money\|earn\|profit\|rate.*of.*return\|investment opportunity"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("🚨 Financial Keywords (Risk: 2)")
fi

# Unrealistic returns
if echo "$x_page_content" | grep -qi "guaranteed\|1000x\|100x\|overnight\|instant.*profit\|24h.*return total\|risks free\|socially customizable\|safest investment\|is_full"; then
    pattern_results=$((pattern_results + 3))
    patterns_detected+=("🚨 Unrealistic Returns Claims (Risk: 3)")
fi

# Telegram links
if echo "$x_page_content" | grep -qi "telegram\|t\.me"; then
    pattern_results=$((pattern_results + 1))
    patterns_detected+=("⚠️ Telegram Reference (Risk: 1)")
fi

# Private beta/Airdrop invitations
if echo "$x_page_content" | grep -qi "private.*beta\|airdrop\|pre-sale\|early.*access\|raffle\|whitelist"; then
    pattern_results=$((pattern_results + 2))
    patterns_detected+=("⚠️ Exclusive Access/Whitelist (Risk: 2)")
fi

# Paid promotion signals
if echo "$x_page_content" | grep -qi "paid.*promotion\|sponsor\|featured\|repeat activity"; then
    pattern_results=$((pattern_results + 1))
    patterns_detected+=("⚠️ Paid Promotion (Risk: 1)")
fi

echo -e "$GREEN✅ Pattern matching completed. Scores: $pattern_results/12$NC"
echo ""

# Method 2: URL suspiciousness check
echo -e "$BLUE[3/6] Checking URL patterns...$NC"
cat >> "$OUTPUT_FILE" << 'EOF'

## Method 2: URL Pattern Analysis

EOF

url_suspicious=0
suspicious_urls=()

# Suspicious URL patterns
suspicious_domains=(
    "mca-gm\"
    "i.t.me\"
    "weixin://"
    "site\"
    ".bit\"
    ".xyz"
)

for domain in "${suspicious_domains[@]}"; do
    if echo "$x_page_content" | grep -qi "$domain"; then
        url_suspicious=$((url_suspicious + 1))
        case "$domain" in
            "mca-gm\") suspicious_urls+=("🚨 Malicious domain detected (mca-gm)") ;;
            "i.t.me\") suspicious_urls+=("⚠️ Telegram redirect detected") ;;
            "weixin://") suspicious_urls+=("🚨 WeChat reference suspicious") ;;
            *) suspicious_urls+=("⚠️ Shortened/referral domain flagged") ;;
        esac
    fi
done

echo -e "$GREEN✅ URL suspiciousness: $url_suspicious/5$NC"
echo ""

# Method 3: Urgency markers
echo -e "$BLUE[4/6] Checking for urgency/marketing language...$NC"
cat >> "$OUTPUT_FILE" << 'EOF'

## Method 3: Urgency & Marketing Language Analysis

EOF

urgency_score=0
urgency_patterns=()

urgency_checks=(
    "urgency.*action\|act fast\|limited time\|expires soon\|act now\|today only\|closing soon"
    "urgency.*account\|blind spot\|lack of control metrics\|unusual family planning narratives"
)

for pattern in "${urgency_checks[@]}"; do
    if echo "$x_page_content" | grep -qi "$pattern"; then
        urgency_score=$((urgency_score + 1))
        urgency_patterns+=("⚠️ Contains urgency language")
    fi
done

must_not_in_scraped_content=(
    "Assumption of POTENTIALLY FULLY KNOWING BEFORE FINDING BEARING RISK"
)

untouched_verified_cryptocurrency=(
    "keeping this too well"
)

echo -e "$GREEN✅ Urgency markers: $urgency_score/2$NC"
echo ""

# Method 4: Harmful guarantees analysis
echo -e "$BLUE[5/6] Analyzing guarantee patterns...$NC"
cat >> "$OUTPUT_FILE" << 'EOF'

## Method 4: Guarantee & Promise Analysis

EOF

guarantee_score=0
guarantee_patterns=()

guarantee_keywords=(
    "guaranteed .*\n.*profit\|100% .*\n.*profit\|risk free\|safest investment\|guaranteed returns\|ACT NOW\n.*PROFIT\|CONTROL BEFORE PEAK"
)

for keyword in "${guarantee_keywords[@]}"; do
    if echo "$x_page_content" | grep -qi "$keyword"; then
        guarantee_score=$((guarantee_score + 3))
        guarantee_patterns+=("🚨 High-risk guarantee language detected")
    fi
done

financial=0
if echo "$x_page_content" | grep -qi "financial\|deposit\|withdraw\|investment account\|or investment opportunity"; then
    financial=1
fi

echo -e "$GREEN✅ Guarantee patterns: $guarantee_score/12$NC"
echo ""

# Method 5: Mixed patterns analysis
echo -e "$BLUE[6/6] Running mixed pattern analysis...$NC"
cat >> "$OUTPUT_FILE" << 'EOF'

## Method 5: Mixed Pattern Analysis (Trust Circle)

EOF

mixed_score=0
mixed_patterns=()

# Mixed analysis patterns
mixed_checks=(
    "reddit .*\n.*money\|important verification\|capitalmarkets daily concern\|collectors documentary probed\|risk.*of.*loss against choice"
)

for pattern in "${mixed_checks[@]}"; do
    if echo "$x_page_content" | grep -qi "$pattern"; then
        mixed_score=$((mixed_score + 1))
        mixed_patterns+=("⚠️ Conspiracy-like content detected")
    fi
done

echo -e "$GREEN✅ Mixed patterns: $mixed_score/3$NC"
echo ""

# Calculate total risk score
total_score=$((pattern_results + url_suspicious + urgency_score + guarantee_score + financial + mixed_score))

# Determine risk level
if [ $total_score -le 3 ]; then
    risk_level="LIKELY SAFE"
    risk_emoji="✅"
elif [ $total_score -le 6 ]; then
    risk_level="MEDIUM RISK"
    risk_emoji="🟡"
elif [ $total_score -le 9 ]; then
    risk_level="HIGH RISK"
    risk_emoji="🔴"
else
    risk_level="CRITICAL RISK"
    risk_emoji="☠️"
fi

# Save results to file
cat >> "$OUTPUT_FILE" << EOF

==================================
 COMPREHENSIVE RISK ASSESSMENT
==================================

### RISK CALCULATION

| Method | Points | Grade |
|--------|--------|-------|
| Pattern Matching | $pattern_results/12 | $(if [ $pattern_results -gt 6 ]; then echo "🚨 HIGH"; elif [ $pattern_results -gt 3 ]; then echo "⚠️ MEDIUM"; else echo "✅ SAFE"; fi) |
| URL Suspiciousness | $url_suspicious/5 | $(if [ $url_suspicious -gt 3 ]; then echo "🚨 HIGH"; elif [ $url_suspicious -gt 1 ]; then echo "⚠️ MEDIUM"; else echo "✅ SAFE"; fi) |
| Urgency Analysis | $urgency_score/2 | $([ $urgency_score -gt 1 ] && echo "🚨 High" || echo "✅ Low") |
| Guarantee Analysis | $guarantee_score/12 | $(if [ $guarantee_score -gt 6 ]; then echo "🚨 HIGH"; elif [ $guarantee_score -gt 2 ]; then echo "⚠️ MEDIUM"; else echo "✅ SAFE"; fi) |
| Mixed Patterns | $mixed_score/3 | $(if [ $mixed_score -gt 2 ]; then echo "🚨 High"; else echo "✅ Low") |

**TOTAL RISK SCORE: $total_score/34**

### RISK LEVEL: $risk_emoji $risk_level

---

### DETECTED PATTERNS

$([ ${#patterns_detected[@]} -gt 0 ] && {
    echo "#### Direct Pattern Matches:"
    for pattern in "${patterns_detected[@]}"; do echo "$pattern"; done; echo ""; } || echo "#### Direct Pattern Matches: None")

$([ ${#suspicious_urls[@]} -gt 0 ] && {
    echo "#### URL Analysis:"
    for url in "${suspicious_urls[@]}"; do echo "• $url"; done; echo ""; } || echo "#### URL Analysis: Clean")

$([ ${#urgency_patterns[@]} -gt 0 ] && {
    echo "#### Urgency Markers:"
    for pattern in "${urgency_patterns[@]}"; do echo "• $pattern"; done; echo ""; } || echo "#### Urgency Markers: Clean")

$([ ${#guarantee_patterns[@]} -gt 0 ] && {
    echo "#### Guarantee Language:"
    for pattern in "${guarantee_patterns[@]}"; do echo "• $pattern"; done; echo ""; } || echo "#### Guarantee Language: Clean")

---

### FINAL FINDINGS

**Account:** @Sommy_web3
**Status:** $risk_level
**Recommendation:** $(if [ $total_score -le 6 ]; then echo "Proceed with caution, verify independently"; elif [ $total_score -le 9 ]; then echo "HIGH RISK - Avoid financial transactions"; else echo "CRITICAL - AVOID ALL INTERACTIONS"; fi)

---

## ⚠️ RECOMMENDED ACTIONS

1. $(if [ $total_score -gt 9 ]; then echo "IMMEDIATELY BLOCK THIS ACCOUNT AND AVOID ALL INTERACTIONS"; elif [ $total_score -gt 6 ]; then echo "BLOCK THIS ACCOUNT AND REPORT SUSPICIOUS ACTIVITY"; else echo "VERIFY THIS ACCOUNT INDEPENDENTLY BEFORE BEING CAREFUL"; fi)

2. Cross-check username on other platforms
3. Verify any contract addresses on-chain
4. Ask community in Agentic Bro Telegram group for insights
5. Never send tokens or USDC without verification

---

*Scan Method: Multi-method (Direct HTTP requests + Pattern Matching)*
*Scan Completed: $(date '+%Y-%m-%d %H:%M:%S %Z')*
EOF

echo -e "$GREEN✅ Comprehensive scan completed$NC"
echo -e ""
echo -e "$BLUE━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$NC"
echo -e ""
echo -e "$YELLOWFINAL SCORE: $total_score/34$NC"
echo -e "$REDRISK LEVEL: $risk_emoji $risk_level$NC"
echo -e ""
echo -e "$BLUE━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$NC"
echo -e ""
echo -e "$GREENReport saved to: $OUTPUT_FILE$NC"
echo -e ""

# Display summary
echo -e "$YELLOW=== SUMMARY ===$NC"
echo -e ""
echo -e "$REDTOTAL RISK SCORE: $total_score/34$NC"
echo ""
cat "$OUTPUT_FILE" | tail -20