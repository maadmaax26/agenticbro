#!/bin/bash
# Universal Social Media Scanner - Consistent Command Interface
# Usage: scan-source <platform> @username

set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"

# Display disclaimer banner (common to all platforms)
DISCLAIMER_BANNER() {
    echo "━━━ 🔍 SOCIAL MEDIA PROFILE SCAN — AI POWERED ASSESSMENT ━━━"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "⚠️  DISCLAIMER NOTICE"
    echo ""
    echo "This scan is an AI-powered threat assessment of social media content."
    echo "For complete accuracy, verify information through multiple sources."
    echo ""
    echo "LIMITATIONS:"
    echo "• Only scans public profile data"
    echo "• Does NOT verify user identity"
    echo "• May miss sophisticated, well-hidden scams"
    echo "• Subject to platform rules and rate limiting"
    echo ""
    echo "INDEPENDENT VERIFICATION REQUIRED:"
    echo "• Cross-check username across multiple platforms"
    echo "• Verify contract addresses manually"
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
    echo "┃  The AI analysis may miss sophisticated scams.                    ┃"
    echo "┃  automated detection. Human verification and cross-referencing"
    echo "┃  are essential for complete accuracy."
    echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
    }

# Parse arguments
PLATFORM="$1"
USERNAME="$2"

if [ -z "$PLATFORM" ] || [ -z "$USERNAME" ]; then
    echo "Usage: scan-source <platform> @username"
    echo ""
    echo "Platforms: tiktok | facebook | instagram | telegram | x | linkedin"
    echo ""
    echo "Examples:"
    echo "  scan-source tiktok @investment_chat_dm"
    echo "  scan-source x @CryptoGenius" 
    exit 1
fi

# Extract username
USERNAME="${USERNAME#@}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TIMESTAMP_LOCAL=$(date +"%Y-%m-%d %H:%M:%S %Z")

# Display banner
DISCLAIMER_BANNER
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║ Scan Information                                                    ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📂 Platform: $PLATFORM"
echo "📁 Account: $USERNAME"
echo "📅 Time:   $TIMESTAMP_LOCAL ($TIMESTAMP)"
echo "🔍 Method: AI-Powered Red Flag Detection"
echo ""

# Route to appropriate scanner script
case "$PLATFORM" in
    tiktok)
        SCAN_SCRIPT="$WORKSPACE/scripts/scan-tiktok-command.sh"
        PROFILE_URL="https://www.tiktok.com/$USERNAME"
        METHOD="Direct_HTTP_Requests (bypasses SSRF)"
        ;;

    facebook)
        SCAN_SCRIPT="$WORKSPACE/scripts/scan-facebook.sh"
        PROFILE_URL="https://www.facebook.com/$USERNAME"
        METHOD="Direct_HTTP_Request"
        ;;

    instagram)
        SCAN_SCRIPT="$WORKSPACE/scripts/scan-instagram.sh"
        PROFILE_URL="https://www.instagram.com/$USERNAME"
        METHOD="Direct_HTTP_Request"
        ;;

    telegram)
        SCAN_SCRIPT="$WORKSPACE/scripts/scan-telegram.sh"
        PROFILE_URL="https://t.me/$USERNAME"
        METHOD="Bot_API (getChatMember + getUserProfilePhotos)"
        ;;

    x)
        SCAN_SCRIPT="$WORKSPACE/scan_x_profile.sh"  # Uses scan_x_cdp.py internally
        PROFILE_URL="https://x.com/$USERNAME"
        METHOD="Chrome CDP Browser Automation"
        ;;

    linkedin)
        SCAN_SCRIPT="$WORKSPACE/scripts/scan-linkedin.sh"
        PROFILE_URL="https://www.linkedin.com/in/$USERNAME"
        METHOD="Direct_HTTP_Request"
        ;;

    *)
        echo "❌ Unknown platform: $PLATFORM"
        echo ""
        echo "Available platforms: tiktok | facebook | instagram | telegram | x | linkedin"
        exit 1
        ;;
esac

echo "🔗 URL:    $PROFILE_URL"
echo "🚀 Method: $METHOD"
echo ""
echo "Running scan..."
echo ""

# Run the appropriate scanner
if [ -n "$SCAN_SCRIPT" ]; then
    if [ -f "$SCAN_SCRIPT" ]; then
        ${SCAN_SCRIPT} "$USERNAME"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "⚠️  Scan Complete — Refer to disclaimer above — Independent verification always recommended"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "📁 Full JSON output saved to workspace"
    else
        echo "❌ Scanner script not found: $SCAN_SCRIPT"
        exit 1
    fi
else
    # Native command (e.g., telegram)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  Scan Complete — Refer to disclaimer above — Independent verification always recommended"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
fi