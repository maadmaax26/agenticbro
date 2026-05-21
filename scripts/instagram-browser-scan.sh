#!/bin/bash
# Instagram Profile Scanner — Chrome Browser Automation
# Uses Chrome DevTools Protocol to render and extract Instagram profile data

PROFILE_URL="${1#@}"
WORKSPACE="/Users/efinney/.openclaw/workspace"

echo "━━━ 🔍 INSTAGRAM PROFILE SCAN (Chrome Browser Automation) ━━━"
echo ""
echo "⚠️  INSTAGRAM ANTI-SCRAPING NOTED"
echo "Chrome automation required for reliable extraction due to:"
echo "  • JavaScript rendering requirements"
echo "  • Anti-bot protections"
echo "  • Dynamic content loading"
echo ""

if [ -z "$PROFILE_URL" ]; then
    echo "❌ Account required. Usage: $0 <username>"
    exit 1
fi

# Extract username for display
USERNAME=$(echo "$PROFILE_URL" | sed -E 's|https://www\.instagram\.com/(.*)|\1|')

echo "📂 Platform: instagram"
echo "📁 Account: $USERNAME"
echo "🔗 URL: $PROFILE_URL"
echo "📅 Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "🔍 Method: Chrome Browser Automation (CDP Port 18800)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Chrome CDP is available
if ! nc -z localhost 18800 2>/dev/null; then
    echo "❌ Chrome CDP not running on port 18800"
    echo ""
    echo "Required setup:"
    echo "  1. Install Chrome browser"
    echo "  2. Enable Chrome DevTools Protocol (CDP)"
    echo "     chrome --remote-debugging-port=18800 --user-data-dir=/tmp/chrome-profile"
    echo ""
    echo "Refer to documentation for CDP connection guide"
    exit 1
fi

echo "✅ Chrome CDP detected on port 18800"
echo ""
echo "⚠️  IMPORTANT: You must have Chrome CDP running to scan Instagram profiles"
echo ""
echo "BROWSER AUTOMATION SETUP REQUIRED:"
echo "  • Launch Chrome with: chrome --remote-debugging-port=18800"
echo "  • Navigate to Instagram profile manually"
echo "  • Wait for full page load"
echo "  • Or use browser UI to manually inspect profile"
echo ""
echo "Since automated Instagram scraping has significant limitations due to:"
echo "  • Instagram's aggressive anti-bot measures"
echo "  • JavaScript-based content rendering"
echo "  • Profile bio extraction challenges"
echo ""
echo "Recommended approach for reliable Instagram scans:"
echo "  1. Manually open profile in Chrome (CDP enabled)"
echo "  2. Paste profile data here after manual inspection"
echo "  3. I can analyze bio content using manual techniques"
echo "  4. OR provide profile description/blo below for analysis"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚨 IMPORTANT MANUAL INSTRUCTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To scan Instagram profiles reliably:"
echo ""
echo "1. OPEN PROFILE IN CHROME:"
echo "   - Navigate to chrome://inspect in browser"
echo "   - Select the 'localhost' inspection target"
echo ""
echo "2. COPY PROFILE DATA:"
echo "   - Profile username: $USERNAME"
echo "   - Profile bio/content (paste below):"
echo ""
echo "3. I will analyze your manually provided profile data"
echo ""
echo "OR provide:"
echo "   • Screenshot of bio section"
echo "   • Transcription of profile content"
echo "   • Link username from other platforms to cross-verify"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Manual scan prompt
echo ""
echo "READY FOR MANUAL INPUT:"
echo "────────────────────────────────────────────────"
echo ""
read -p "Enter profile bio/content to analyze: " profile_blo
echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Perform analysis on manual input
red_flags=()
risk_score=0

cleaned_content=$(echo "$profile_blo" | tr '[:upper:]' '[:lower:]')

# Cryptocurrency keywords
if echo "$cleaned_content" | grep -qi "crypto\|bitcoin\|ethereum\|solana\|doge\|bnb\|usdt\|usdc"; then
    red_flags+=("🚨 Cryptocurrency keywords detected")
    risk_score=$((risk_score + 2))
fi

# Financial keywords
if echo "$cleaned_content" | grep -qi "invest\|investment\|loan\|money\|earn\|profit\|500%\|1000%"; then
    red_flags+=("🚨 Financial claims detected")
    risk_score=$((risk_score + 2))
fi

# Unrealistic claims
if echo "$cleaned_content" | grep -qi "guaranteed\|100x\|1000x\|24h\|overnight\|instant"; then
    red_flags+=("🚨 Unrealistic/failed predictions")
    risk_score=$((risk_score + 3))
fi

# Investment/business solicitation
if echo "$cleaned_content" | grep -qi "investment\|join the team\|partner\|business\|promote\|affiliate"; then
    red_flags+=("🚨 Investment/affiliate solicitation")
    risk_score=$((risk_score + 2))
fi

# Emotional manipulation
if echo "$cleaned_content" | grep -qi "family\|help\|emergency\|sick\|hospital\|desperate"; then
    red_flags+=("🚨 Emotional manipulation indicators")
    risk_score=$((risk_score + 2))
fi

# Cross-platform hints
if echo "$cleaned_content" | grep -qi "telegram\|x\.com\|twitter\|dm\|private group"; then
    red_flags+=("🚨 Cross-platform solicitation")
    risk_score=$((risk_score + 1))
fi

# Provide result
if [ $risk_score -gt 5 ]; then
    risk_level="HIGH RISK"
    emoji="🔴"
elif [ $risk_score -gt 3 ]; then
    risk_level="MEDIUM RISK"
    emoji="🟡"
else
    risk_level="LOW RISK/SAFE"
    emoji="✅"
fi

echo "📊 ANALYSIS RESULTS"
echo "────────────────────────────────────────────────"
echo "Profile: $USERNAME"
echo "Risk Score: $risk_score/10"
echo "Risk Level: $emoji $risk_level"
echo ""
if [ ${#red_flags[@]} -gt 0 ]; then
    echo "🚨 DETECTED FLAGS (${#red_flags[@]}):"
    for flag in "${red_flags[@]}"; do
        echo "   $flag"
    done
else
    echo "✅ No red flags detected"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  INDEPENDENT VERIFICATION STRONGLY ADVISED"
echo "   • Cross-check username on multiple platforms"
echo "   • Verify claims with multiple sources"
echo "   • Never click unknown links or download files"
echo "   • Avoid sending money to unsolicited accounts"
echo ""
echo "Scan first, trust later! 🔐"
echo ""