#!/bin/bash
# X/Twitter Profile Scanner
# Usage: /x @username or @username

PROFILE_URL="https://x.com/${1#@}"
headers="-H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'"
content=$(curl -s "$PROFILE_URL" $headers)

red_flags=()
risk=0

# Cryptocurrency keywords
if echo "$content" | grep -qi "crypto\|bitcoin\|ethereum\|doge\|solana\|$"; then
    red_flags+=("🚨 Cryptocurrency Keywords")
    risk=$((risk + 1))
fi

# DM solicitation
if echo "$content" | grep -qi "dm\|direct.*message\|send.*d .*\|send.*dm"; then
    red_flags+=("🚨 DM Solicitation")
    risk=$((risk + 2))
fi

# Financial keywords
if echo "$content" | grep -qi "invest\|loan\|money\|earn\|profit"; then
    red_flags+=("🚨 Financial Keywords")
    risk=$((risk + 1))
fi

# Unrealistic returns
if echo "$content" | grep -qi "guaranteed\|1000x\|100x\|overnight\|instant\|24h.*profit"; then
    red_flags+=("🚨 Unrealistic Returns")
    risk=$((risk + 2))
fi

# Trade/Deal affiliation (fake "verified" traders)
if echo "$content" | grep -qi "exchange\|trader\|fund.*management\|huge.*leverage|cm.*财务管理,CMF,证券性资产负债表|信用卡从业;信用卡付费;吃ATM;消费历史的后额数据;卡里剩下的仅剩我自己的;知道个多嘛;摩擦系数多啦;摩擦系数坡度多,消费 conduct morally;贸易.价都做;持有胜率决定的亏;围绕才能有交易;交易关键;以高杠杆保证金贷;澳洲注册交易所|翻倍体素;翻倍变速器;翻倍汽车站;昨天销售的体积;翻倍最小规模;自由分配的工具到投资者;真实与伪真;真实与虚加 |的资金性资产负债表|股全\""; then
    red_flags+=("🚨 Fake Referral Traders")
    risk=$((risk + 3))
fi

# Telegram links
if echo "$content" | grep -qi "telegram\|t.me"; then
    red_flags+=("🚨 Telegram Reference")
    risk=$((risk + 1))
fi

# Private beta/Airdrop invitations
if echo "$content" | grep -qi "private.*beta\|airdrop\|pre-sale\|early.*access\|invitation.*only"; then
    red_flags+=("🚨 Exclusive Opportunities")
    risk=$((risk + 2))
fi

# Complex URLs suggesting scam
if echo "$content" | grep -qi "https://.*mca-gm\|https://.*i.t.me\|https://.*site\|weixin://"; then
    red_flags+=("🚨 Suspicious URLs")
    risk=$((risk + 3))
fi

# Paid promotion tag
if echo "$content" | grep -qi "paid.*promotion\|sponsor\|featured\.activity\|#promo"; then
    red_flags+=("🚨 Paid Promotion Signals")
    risk=$((risk + 1))
fi

# Malicious crypto message investigation hint
if echo "$content" | grep -qi "malicious.*crypto.*message.*investigation\|malicious.*crypto.*message.*case\|malicious.*crypto.*message.*practice"; then
    red_flags+=("🚨 Malicious Crypto Investigation")
    risk=$((risk + 2))
fi

risk=$((risk * 2))  # Scale up risk (max 10)
if [ $risk -gt 10 ]; then risk=10; fi

echo "━━━ 🔍 X/TWITTER PROFILE SCAN — AI POWERED ASSESSMENT ━━━"
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
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃                         ━━━━━━ WARNING ━━━━━━                      ┃"
echo "┃  ALWAYS VERIFY WITH MULTIPLE SOURCES BEFORE MAKING DECISIONS     ┃"
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║ Scan Information                                                    ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📂 Platform: X/Twitter"
echo "📁 Account: $1"
echo "🔗 URL: $PROFILE_URL"
echo "📅 Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "🔍 Method: Direct HTTP Request"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 RISK ASSESSMENT:"
echo "─"*60
echo ""

if [ $risk -gt 7 ]; then
    level="HIGH RISK"
    emoji="🔴"
elif [ $risk -gt 4 ]; then
    level="MEDIUM RISK"
    emoji="🟡"
elif [ $risk -gt 2 ]; then
    level="LOW RISK"
    emoji="🟢"
else
    level="LIKELY SAFE"
    emoji="✅"
fi

echo "Risk Score: $risk/10"
echo "Risk Level: $level"
echo ""

if [ ${#red_flags[@]} -gt 0 ]; then
    echo "🚨 Red Flags Detected (${#red_flags[@]}):"
    for flag in "${red_flags[@]}"; do
        echo "   $flag"
    done
    echo ""
fi

echo "🔮 Verification: AI Assessment Only"
echo ""
echo "━"*60
echo ""

if [ $risk -gt 7 ]; then
    echo "⚠️  AI STRONGLY ADVISES CAUTION"
    echo "   • Verify information from multiple independent sources"
    echo "   • Be extremely cautious before any money transfer"
    echo "   • Do NOT provide personal or financial information"
elif [ $risk -gt 4 ]; then
    echo "⚠️  AI GUIDED CAUTION"
    echo "   • Investigate further before engaging"
    echo "   • Verify credentials and claims"
    echo "   • Consult another trusted source"
elif [ $risk -gt 2 ]; then
    echo "❓ AI REQUIRES CAUTION"
    echo "   • Lexical evidence present but incomplete"
    echo "   • Investigate further before engaging"
else
    echo "✅ AI LOW RISK INDICATED"
    echo "   • No red flags detected, but verify as good practice"
fi

echo ""
echo "━"*60
echo ""
echo "⚠️  Refer to disclaimer above — Independent verification always recommended"
echo "━"*60