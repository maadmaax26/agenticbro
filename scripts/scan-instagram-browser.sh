#!/bin/bash
# Instagram Profile Scanner - Chrome Browser Automation Version
# Usage: ./scan-instagram-browser.sh "_samialarr"
# Default Method: Chrome CDP (Port 18800) for reliable HTML extraction

PROFILE_URL="${1#@}"
WORKSPACE="/Users/efinney/.openclaw/workspace"
SNAPSHOT_SCRIPT="$WORKSPACE/scam-detection-framework/tiktok-scan.py"  # Reuse for browser automation

echo "━━━ 🔍 INSTAGRAM PROFILE SCAN — AI POWERED ASSESSMENT (Chrome Automation) ━━━"

if [ -z "$PROFILE_URL" ]; then
    echo "❌ Account required. Usage: $0 <account_handle>"
    exit 1
fi

# Verify Chrome is running on port 18800
if ! nc -z localhost 18800 2>/dev/null; then
    echo "⚠️  Chrome CDP not detected on port 18800"
    echo "ℹ️  Use 'npm run start-chrome' or similar to start Chrome with CDP enabled"
    echo "Skipping to default curl-based scan (less reliable due to Instagram anti-scraping)"
    exec "$WORKSPACE/scripts/scan-instagram.sh" "$1"
fi

# Extract username for display
USERNAME=$(echo "$PROFILE_URL" | sed -E 's|https://www\.instagram\.com/(.*)|\1|')

echo "📂 Platform: instagram"
echo "📁 Account: $USERNAME"
echo "🔗 URL: $PROFILE_URL"
echo "🔍 Method: Chrome Browser Automation (CDP)"
echo "📅 Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""
echo "⚠️  Note: Instagram scans are less reliable due to anti-scraping"
echo "                     → Cross-verify with manual inspection"
echo ""

# Attempt to use browser automation
echo "Scanning via browser automation..."
python3 "$SNAPSHOT_SCRIPT" "$USERNAME" 2>&1 || {
    echo "⚠️  Browser automation failed, falling back to curl"
    exec bash "$WORKSPACE/scripts/scan-instagram.sh" "$1"
}

echo ""
echo "⚠️  Refer to disclaimer above — Independent verification always recommended"