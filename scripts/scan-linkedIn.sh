#!/bin/bash
# LinkedIn Profile Scanner
# Usage: scan-linkedin @username or linkedin.com/in/username

# Handle both formats: @username and linkedin.com/in/username
if [[ "$1" == linkedin.com/in/* ]]; then
    USERNAME="${1#linkedin.com/in/}"
    USERNAME="${USERNAME%/}"  # Remove trailing slash
    PROFILE_URL="https://www.linkedin.com/in/$USERNAME"
elif [[ "$1" == *linkedin.com* ]]; then
    # Extract username from linkedin URL
    USERNAME=$(basename "$1" .in)
    PROFILE_URL="https://www.linkedin.com/in/$USERNAME"
else
    USERNAME="${1#@}"
    PROFILE_URL="https://www.linkedin.com/in/$USERNAME"
fi

headers="-H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
         -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
         -H 'Accept-Language: en-US,en;q=0.5'
         -H 'DNT: 1'
         -H 'Connection: keep-alive'
         -H 'Upgrade-Insecure-Requests: 1'"

content=$(curl -s "$PROFILE_URL" $headers)

red_flags=()
risk=0

# LinkedIn profile indicators (common for crypto scammers)
if echo "$content" | grep -qi "crypto\|bitcoin\|ethereum\|solana\|doge\|token"; then
    red_flags+=("🚨 Cryptocurrency keywords")
    risk=$((risk + 1))
fi

# Financial/Investment keywords
if echo "$content" | grep -qi "invest\|investment\|loan\|money\|profit\|earn"; then
    red_flags+=("🚨 Financial investment language")
    risk=$((risk + 1))
fi

# Make money/wealth claims
if echo "$content" | grep -qi "millionaire\|rich\|wealth\|get rich\|financial freedom"; then
    red_flags+=("🚨 Wealth acquisition claims")
    risk=$((risk + 2))
fi

# Crypto giveaway or airdrop mentions
if echo "$content" | grep -qi "airdrop\|giveaway\|free crypto\|claim.*token"; then
    red_flags+=("🚨 Crypto giveaway/airdrop claims")
    risk=$((risk + 2))
fi

# Limited time/urgency tactics
if echo "$content" | grep -qi "urgent\|limited time\|act now\|deadline\|today only"; then
    red_flags+=("🚨 Urgency/fear tactics")
    risk=$((risk + 2))
fi

# Private offer/invitation language
if echo "$content" | grep -qi "private offer\|exclusive access\|invitation\|DM me for details"; then
    red_flags+=("🚨 Private offer invitations")
    risk=$((risk + 2))
fi

# "Click to continue" or redirect language
if echo "$content" | grep -qi "click here\|continue\|redirect\|verify your account"; then
    red_flags+=("🚨 Redirect/authentication attempts")
    risk=$((risk + 2))
fi

# Russian scam indicators (common across platforms)
if echo "$content" | grep -qi "trusted.*relationship\|financial.*success\|import.*export"; then
    red_flags+=("🚨 Russian scam indicators")
    risk=$((risk + 2))
fi

# Attachments/download links (potential scam)
if echo "$content" | grep -qi "\.pdf\|.doc\|.xls\|.zip\|download\|submit.*form"; then
    red_flags+=("🚨 File attachments/forms")
    risk=$((risk + 2))
fi

# Algorithm avoidance phrases
if echo "$content" | grep -qi "ignore these algorithms\|boost your profile\|reach more people"; then
    red_flags+=("🚨 Algorithm manipulation claims")
    risk=$((risk + 2))
fi

# Financial expertise claims without proof
if echo "$content" | grep -qi "financial wizard\|expert\|consultant\|coach"; then
    red_flags+=("🚨 Financial expert claims")
    risk=$((risk + 2))
fi

risk=$((risk * 2))  # Scale up risk (max 10)
if [ $risk -gt 10 ]; then risk=10; fi

echo "━━━ 🔍 LINKEDIN PROFILE SCAN — AI POWERED ASSESSMENT ━━━"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  DISCLAIMER NOTICE"
echo ""
echo "This scan is an AI-powered threat assessment of LinkedIn profile content."
echo "For complete accuracy, verify information through multiple sources."
echo ""
echo "LIMITATIONS:"
echo "• Only scans public profile data"
echo "• Does NOT verify user identity"
echo "• May miss sophisticated, well-hidden scams"
echo "• LinkedIn anti-scraping measures may block reliable scans"
echo ""
echo "INDEPENDENT VERIFICATION REQUIRED:"
echo "• Cross-check username across multiple platforms"
echo "• Verify company and job history independently"
echo "• Never send money or share private keys"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃                         ━━━━━━ WARNING ━━━━━━                      ┃"
echo "┃                                                                   ┃"
echo "┃  ALWAYS VERIFY WITH MULTIPLE SOURCES BEFORE MAKING DECISIONS     ┃"
echo "┃                                                                   ┃"
echo "┃  The AI analysis above may miss sophisticated scams that evade   ┃"
echo "┃  automated detection. Human verification and cross-referencing   ┃"
echo "┃  are essential for complete accuracy.                            ┃"
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║ Scan Information                                                    ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📂 Platform: linkedin"
echo "📁 Account: $1"
echo "🔗 URL: $PROFILE_URL"
echo "📅 Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "🔍 Method: Direct HTTP Request"
echo ""

if [ ${#red_flags[@]} -eq 0 ]; then
    echo "───────────────────────────────────────────────────────────────────────"
    echo ""
    echo "📊 RISK ASSESSMENT:"
    echo "───────────────────────────────────────────────────────────────────────"
    echo ""
    echo "Risk Score: $risk/10"
    echo "Risk Level: LIKELY SAFE"
    echo ""
    echo "✅ No significant red flags detected"
    echo ""
else
    echo "───────────────────────────────────────────────────────────────────────"
    echo ""
    echo "📊 RISK ASSESSMENT:"
    echo "───────────────────────────────────────────────────────────────────────"
    
    if [ $risk -gt 7 ]; then
        level="HIGH RISK"
        emoji="🔴"
        echo "Risk Score: $risk/10"
        echo "Risk Level: $level"
        echo ""
        echo "🚨 Red Flags Detected (${#red_flags[@]}):"
        for flag in "${red_flags[@]}"; do
            echo "   $flag"
        done
        echo ""
        echo "🔮 Verification: AI Assessment Only"
        echo ""
        echo "─"*60
        echo "⚠️  AI STRONGLY ADVISES CAUTION"
        echo "   • Verify information from multiple independent sources"
        echo "   • Be extremely cautious before any money transfer"
        echo "   • Do NOT provide personal or financial information"
    elif [ $risk -gt 4 ]; then
        level="MEDIUM RISK"
        emoji="🟡"
        echo "Risk Score: $risk/10"
        echo "Risk Level: $level"
        echo ""
        echo "🚨 Red Flags Detected (${#red_flags[@]}):"
        for flag in "${red_flags[@]}"; do
            echo "   $flag"
        done
        echo ""
        echo "🔮 Verification: AI Assessment Only"
        echo ""
        echo "─"*60
        echo "⚠️  AI GUIDES CAUTION"
        echo "   • Investigate further before engaging"
        echo "   • Verify credentials and claims"
        echo "   • Consult another trusted source"
    elif [ $risk -gt 2 ]; then
        level="LOW RISK"
        emoji="🟢"
        echo "Risk Score: $risk/10"
        echo "Risk Level: $level"
        echo ""
        echo "🚨 Red Flags Detected (${#red_flags[@]}):"
        for flag in "${red_flags[@]}"; do
            echo "   $flag"
        done
        echo ""
        echo "🔮 Verification: AI Assessment Only"
        echo ""
        echo "─"*60
        echo "⚠️  AI REQUIRES CAUTION"
        echo "   • Lexical evidence present but incomplete"
        echo "   • Investigate further before engaging"
    else
        level="LIKELY SAFE"
        emoji="✅"
        echo "Risk Score: $risk/10"
        echo "Risk Level: $level"
        echo ""
        echo "✅ No significant red flags detected"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Refer to disclaimer above — Independent verification always recommended"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
