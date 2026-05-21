#!/bin/bash
# scan-ticket-site.sh — Scan a website for fake event ticket scams
# Focus: World Cup 2026, Copa America, and major sporting event ticket fraud
#
# Usage: bash scan-ticket-site.sh <url>
# Example: bash scan-ticket-site.sh https://fifa2026tickets.com
#
# Scans: known scam domains, FIFA impersonation, suspicious payment methods,
#        urgency tactics, and general website security threats

set -euo pipefail

URL="${1:-}"

if [ -z "$URL" ]; then
    echo "━━━ 🎟️  EVENT TICKET SCAM SCANNER ━━━"
    echo ""
    echo "Usage: bash scan-ticket-site.sh <url>"
    echo ""
    echo "Scans websites for fake event ticket sales, especially:"
    echo "  ⚽ World Cup 2026 ticket scams"
    echo "  🏆 Copa America 2026 ticket scams"
    echo "  🎫 General fake ticket reseller sites"
    echo ""
    echo "Examples:"
    echo "  bash scan-ticket-site.sh https://fifa2026tickets.com"
    echo "  bash scan-ticket-site.sh https://suspicious-tickets.com/worldcup"
    echo ""
    echo "Official FIFA tickets: https://www.fifa.com/tickets"
    echo ""
    exit 1
fi

# Normalize URL
if [[ ! "$URL" =~ ^https?:// ]]; then
    URL="https://$URL"
fi

# Extract domain
DOMAIN=$(echo "$URL" | sed -E 's|https?://([^/]+).*|\1|' | sed 's/^www\.//')

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TIMESTAMP_LOCAL=$(date +"%Y-%m-%d %H:%M:%S %Z")

echo "━━━ 🎟️  EVENT TICKET SCAM SCANNER ━━━"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  DISCLAIMER: This scan is for educational purposes only."
echo "Not financial advice. Not a guarantee of safety. Always DYOR."
echo "For World Cup 2026 tickets, buy ONLY from FIFA.com/tickets"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║ Ticket Scan Information                                              ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "🔗 URL:    $URL"
echo "📂 Domain: $DOMAIN"
echo "📅 Time:   $TIMESTAMP_LOCAL ($TIMESTAMP)"
echo "🔍 Method: API Scan (website-scan) + Local Pattern Check"
echo ""

# ─── Step 1: Check known scam domains locally ────────────────────────────────

KNOWN_SCAM=0
SCAM_INFO=""

# World Cup 2026 specific known scams
case "$DOMAIN" in
    fifa2026tickets.com|worldcup2026tickets.com|fifaworldcup2026tickets.com|\
    wc2026tickets.com|2026worldcuptickets.com|worldcuptickets2026.com|\
    fifatickets2026.com|fifa2026official.com|fifafans2026.com|\
    worldcup-hospitality.com|matchhospitality2026.com)
        KNOWN_SCAM=1
        SCAM_INFO="FIFA Warning: Known fake World Cup 2026 ticket site"
        ;;
    tradevectorai-app.org|fastinvest.com|trade-vectorai.net|tradevectorai.net|\
    tradevectorai-official.com|trade.errors-app.org|trade-errors-app.org)
        KNOWN_SCAM=1
        SCAM_INFO="Regulatory Warning: Known scam/fraud domain"
        ;;
esac

# ─── Step 2: Check domain patterns ──────────────────────────────────────────

PATTERN_FLAGS=0

if echo "$DOMAIN" | grep -qiE 'fifa.*2026.*ticket|worldcup.*2026.*ticket|2026.*worldcup.*ticket|wc2026.*ticket|fifa.*official.*2026|fifaticket|worldcup.*hospitality|match.*hospitality.*2026'; then
    PATTERN_FLAGS=1
    echo "🚨 PATTERN MATCH: Domain matches World Cup 2026 ticket scam pattern"
    echo "   ⚽ FIFA.com is the ONLY authorized seller of World Cup 2026 tickets"
    echo ""
fi

if echo "$DOMAIN" | grep -qiE 'ticket'; then
    echo "🎫 DOMAIN CHECK: Domain contains 'ticket' — verify authorization"
    echo "   🔗 Official: https://www.fifa.com/tickets"
    echo ""
fi

# ─── Step 3: Check authorized sellers ───────────────────────────────────────

AUTHORIZED_SELLERS="fifa.com fifaworldcup.com fifa.org match-hospitality.com stubhub.com ticketmaster.com viagogo.com seatgeek.com vivaticket.com"

IS_AUTHORIZED=0
for seller in $AUTHORIZED_SELLERS; do
    if [ "$DOMAIN" = "$seller" ] || [[ "$DOMAIN" == *".$seller" ]]; then
        IS_AUTHORIZED=1
        break
    fi
done

if [ $IS_AUTHORIZED -eq 1 ]; then
    echo "✅ AUTHORIZED: $DOMAIN is an authorized ticket seller"
    echo ""
fi

# ─── Step 4: Call API scan ──────────────────────────────────────────────────

echo "🔍 Running API scan..."
echo ""

# Try the website API first
API_RESULT=$(curl -s -X POST "https://agenticbro.app/api/website-scan" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$URL\"}" \
    --max-time 30 2>/dev/null) || API_RESULT=""

if [ -n "$API_RESULT" ] && echo "$API_RESULT" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    # Parse API response
    RISK_SCORE=$(echo "$API_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('riskScore','N/A'))" 2>/dev/null || echo "N/A")
    RISK_LEVEL=$(echo "$API_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('riskLevel','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
    SCAN_CATEGORY=$(echo "$API_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('scanCategory','general'))" 2>/dev/null || echo "general")
    
    # Display risk assessment
    echo "╔═══════════════════════════════════════════════════════════════════════╗"
    if [ "$RISK_LEVEL" = "CRITICAL" ]; then
        echo "║ 🚨 RISK SCORE: ${RISK_SCORE}/10 — CRITICAL RISK 🚨"
    elif [ "$RISK_LEVEL" = "HIGH" ]; then
        echo "║ ⚠️  RISK SCORE: ${RISK_SCORE}/10 — HIGH RISK ⚠️"
    elif [ "$RISK_LEVEL" = "MEDIUM" ]; then
        echo "║ ⚡ RISK SCORE: ${RISK_SCORE}/10 — MEDIUM RISK ⚡"
    else
        echo "║ ✅ RISK SCORE: ${RISK_SCORE}/10 — LOW RISK ✅"
    fi
    if [ "$SCAN_CATEGORY" = "ticket" ]; then
        echo "║ 🎟️  Category: EVENT TICKET SCAN"
    fi
    echo "╚═══════════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Display threats
    THREATS=$(echo "$API_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
threats=d.get('threats',[])
for t in threats:
    icon='🚨' if t.get('severity')=='CRITICAL' else '⚠️' if t.get('severity')=='HIGH' else '⚡' if t.get('severity')=='MEDIUM' else 'ℹ️'
    print(f\"{icon} [{t.get('severity','?')}] {t.get('description','Unknown threat')}\")
    if t.get('evidence'):
        print(f\"   Evidence: {t['evidence']}\")
    print(f\"   Points: {t.get('weight',0)}\")
    print()
" 2>/dev/null)
    
    if [ -n "$THREATS" ]; then
        echo "━━━ 🚨 DETECTED THREATS ━━━"
        echo ""
        echo "$THREATS"
    else
        echo "✅ No threats detected by API scan."
    fi
    echo ""
    
    # ─── Domain Age Info ───────────────────────────────────────────────────
    DOMAIN_INFO=$(echo "$API_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
info=d.get('domainInfo',{})
if info:
    age=info.get('domainAgeDays')
    reg=info.get('registeredDate','unknown')
    registrar=info.get('registrar','unknown')
    is_new=info.get('isNewDomain',False)
    if age is not None:
        icon='🆕' if is_new else '📅'
        label='NEWLY REGISTERED' if is_new else f'{age} days old'
        print(f'{icon} Domain Age: {label}')
        print(f'   Registered: {reg}')
        print(f'   Registrar: {registrar}')
        if is_new:
            print(f'   ⚠️  Domain registered less than 6 months ago — common scam indicator')
    else:
        print('📅 Domain age: Could not determine (RDAP unavailable)')
        print('   🔗 Check manually: https://who.is/whois/' + d.get('domain',''))
" 2>/dev/null)
    
    if [ -n "$DOMAIN_INFO" ]; then
        echo "━━━ 📅 DOMAIN AGE ━━━"
        echo ""
        echo "$DOMAIN_INFO"
        echo ""
    fi
    
    # ─── Payment Analysis ───────────────────────────────────────────────────
    PAYMENT_INFO=$(echo "$API_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
pa=d.get('paymentAnalysis',{})
if pa:
    assessment=pa.get('riskAssessment','UNKNOWN')
    icon={'SAFE':'✅','MIXED':'⚠️','RISKY':'🚨','DANGEROUS':'💀'}.get(assessment,'❓')
    print(f'{icon} Payment Risk: {assessment}')
    
    safe=pa.get('safeMethods',[])
    risky=pa.get('riskyMethods',[])
    providers=pa.get('paymentProviders',[])
    protection=pa.get('hasBuyerProtection',False)
    
    if providers:
        print(f'   Providers: {', '.join(providers)}')
    if safe:
        print(f'   ✅ Safe methods: {', '.join(safe)}')
    if risky:
        print(f'   🚨 Risky methods: {', '.join(risky)}')
    print(f'   Buyer protection: {'Yes' if protection else 'No'}')
    
    if assessment == 'DANGEROUS':
        print(f'   ⚠️  CRITICAL: No safe payment options — all methods are irreversible!')
    elif assessment == 'RISKY':
        print(f'   ⚠️  Only risky payment methods found — no buyer protection')
    elif assessment == 'MIXED':
        print(f'   ⚠️  Site offers both safe and risky payment methods')
    else:
        print(f'   ✅ Only standard payment methods detected')
" 2>/dev/null)
    
    if [ -n "$PAYMENT_INFO" ]; then
        echo "━━━ 💳 PAYMENT ANALYSIS ━━━"
        echo ""
        echo "$PAYMENT_INFO"
        echo ""
    fi
    
    # Display recommendations
    RECS=$(echo "$API_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('recommendations',[]):
    print(r)
" 2>/dev/null)
    
    if [ -n "$RECS" ]; then
        echo "━━━ ✅ RECOMMENDATIONS ━━━"
        echo ""
        echo "$RECS"
        echo ""
    fi
    
    # Display reputation sources
    REPS=$(echo "$API_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('reputation',[]):
    src=r.get('source','?')
    v=r.get('verdict','?')
    det=r.get('details','')
    print(f\"• {src}: {v}\")
    if det:
        print(f\"  {det}\")
" 2>/dev/null)
    
    if [ -n "$REPS" ]; then
        echo "━━━ 🔍 REPUTATION SOURCES ━━━"
        echo ""
        echo "$REPS"
        echo ""
    fi

else
    echo "⚠️  API scan unavailable. Running local checks only."
    echo ""
fi

# ─── Step 5: Display known scam results ─────────────────────────────────────

if [ $KNOWN_SCAM -eq 1 ]; then
    echo "━━━ 🚨 KNOWN SCAM DOMAIN ━━━"
    echo ""
    echo "🚨 CRITICAL: $DOMAIN is a KNOWN SCAM DOMAIN"
    echo "   $SCAM_INFO"
    echo ""
    echo "❌ Do NOT interact with this website"
    echo "📋 Report: https://reportfraud.ftc.gov"
    echo "📋 FIFA Integrity: https://www.fifa.com/about-fifa/organisation/integrity"
    echo ""
fi

# ─── Step 6: World Cup 2026 specific advice ─────────────────────────────────

echo "━━━ ⚽ WORLD CUP 2026 TICKET INFO ━━━"
echo ""
echo "Official tickets: https://www.fifa.com/tickets"
echo "Authorized resale: StubHub, Ticketmaster, ViaGogo, SeatGeek"
echo "Official hospitality: MATCH Hospitality (via FIFA.com)"
echo ""
echo "⚠️  RED FLAGS for ticket scams:"
echo "   • Claims of 'FIFA authorized' or 'official reseller' (NOT on FIFA.com)"
echo "   • Prices significantly below face value"
echo "   • Wire transfer, crypto, or gift card payments only"
echo "   • No physical address or company registration info"
echo "   • WhatsApp/Telegram/DM only contact"
echo "   • Urgency: 'selling fast', 'last chance', 'almost gone'"
echo "   • Domain registered recently (check who.is)"
echo "   • Only non-standard payment methods (no credit card/PayPal)"
echo "   • No buyer protection or refund policy"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Scan Complete — Refer to disclaimer above — Independent verification always recommended"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📅 Scan Date: $TIMESTAMP_LOCAL ($TIMESTAMP)"
echo "🔗 Full API: https://agenticbro.app/api/website-scan"