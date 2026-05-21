#!/bin/bash
# Daily Scan Report Generator
# Shows scans requested and source (website or Telegram)

set -euo pipefail

DATE="${1:-$(date +%Y-%m-%d)}"
WORKSPACE="/Users/efinney/.openclaw/workspace"
SESSIONS_DIR="/Users/efinney/.openclaw/agents/agentic-bro/sessions"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 AGENTIC BRO — DAILY SCAN REPORT"
echo "📅 Date: $DATE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check scan_results directory for actual scans performed
echo "📁 SCAN RESULTS FILES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SCAN_FILES=$(find "$WORKSPACE/scan_results" -name "*.json" -newermt "$DATE 00:00:00" ! -newermt "$DATE 23:59:59" 2>/dev/null | sort)
SCAN_COUNT=$(echo "$SCAN_FILES" | grep -c ".json" 2>/dev/null || echo 0)

if [[ -n "$SCAN_FILES" ]] && [[ "$SCAN_COUNT" -gt 0 ]]; then
    for file in $SCAN_FILES; do
        FILENAME=$(basename "$file")
        echo "  📄 $FILENAME"
    done
    echo ""
fi

# Count by platform
TELEGRAM_SCANS=$(find "$WORKSPACE/scan_results" -name "telegram_*.json" -newermt "$DATE 00:00:00" ! -newermt "$DATE 23:59:59" 2>/dev/null | wc -l | tr -d ' ')
INSTAGRAM_SCANS=$(find "$WORKSPACE/scan_results" -name "instagram_*.json" -newermt "$DATE 00:00:00" ! -newermt "$DATE 23:59:59" 2>/dev/null | wc -l | tr -d ' ')
TIKTOK_SCANS=$(find "$WORKSPACE/scan_results" -name "tiktok_*.json" -newermt "$DATE 00:00:00" ! -newermt "$DATE 23:59:59" 2>/dev/null | wc -l | tr -d ' ')
FACEBOOK_SCANS=$(find "$WORKSPACE/scan_results" -name "facebook_*.json" -newermt "$DATE 00:00:00" ! -newermt "$DATE 23:59:59" 2>/dev/null | wc -l | tr -d ' ')
PHONE_SCANS=$(find "$WORKSPACE/scan_results" -name "phone_*.json" -newermt "$DATE 00:00:00" ! -newermt "$DATE 23:59:59" 2>/dev/null | wc -l | tr -d ' ')
X_SCANS=$(find "$WORKSPACE/scan_results" -name "*x_*.json" -newermt "$DATE 00:00:00" ! -newermt "$DATE 23:59:59" 2>/dev/null | wc -l | tr -d ' ')

TOTAL_SCANS=$((TELEGRAM_SCANS + INSTAGRAM_SCANS + TIKTOK_SCANS + FACEBOOK_SCANS + PHONE_SCANS + X_SCANS))

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SCANS BY PLATFORM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "  📱 Telegram:    $TELEGRAM_SCANS"
echo "  📸 Instagram:   $INSTAGRAM_SCANS"
echo "  🎵 TikTok:      $TIKTOK_SCANS"
echo "  📘 Facebook:    $FACEBOOK_SCANS"
echo "  📞 Phone:       $PHONE_SCANS"
echo "  ✖️  X/Twitter:   $X_SCANS"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 Total:       $TOTAL_SCANS"
echo ""

# Check website API logs
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 WEBSITE VS TELEGRAM SOURCE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Count scan-related messages from webchat vs telegram in session logs
WEBSITE_COUNT=0
TELEGRAM_COUNT=0

for file in "$SESSIONS_DIR"/*.jsonl; do
    if [[ -f "$file" ]]; then
        # Website scans
        W=$(grep "sourceChannel.*webchat" "$file" 2>/dev/null | grep -c "scan\|profile\|phone" || echo 0)
        WEBSITE_COUNT=$((WEBSITE_COUNT + W))
        
        # Telegram scans
        T=$(grep "sourceChannel.*telegram" "$file" 2>/dev/null | grep -c "scan\|profile\|phone\|@" || echo 0)
        TELEGRAM_COUNT=$((TELEGRAM_COUNT + T))
    fi
done 2>/dev/null || true

echo "  🌐 From Website:       $WEBSITE_COUNT"
echo "  📱 From Telegram:      $TELEGRAM_COUNT"
echo ""

# Check Vercel logs for API calls (if available)
VERCEL_LOGS="/Users/efinney/agenticbro/.vercel"
if [[ -d "$VERCEL_LOGS" ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📈 VERCEL API ANALYTICS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  (Vercel logs require CLI: vercel logs)"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Generated: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"