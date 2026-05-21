#!/bin/bash
# X Engagement Monitor — Finds relevant X posts for Agentic Bro engagement
# Uses Chrome CDP on port 18801 for auto-scraping, or outputs manual search URLs
#
# Usage: bash /Users/efinney/.openclaw/workspace/scripts/x-monitor-engagement.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="/Users/efinney/.openclaw/workspace/output"

mkdir -p "$OUTPUT_DIR"

echo "🔍 X Engagement Monitor — Agentic Bro Growth Targets"
echo "======================================================"
echo ""

# Check Chrome CDP
if curl -s "http://localhost:18801/json/list" > /dev/null 2>&1; then
    echo "✅ Chrome CDP detected on port 18801 — auto-scraping enabled"
    python3 "$SCRIPT_DIR/x-monitor-engagement.py"
else
    echo "⚠️  Chrome CDP not detected on port 18801"
    echo "   Generating manual search URLs..."
    echo ""
    echo "   To enable auto-scraping, start Chrome with:"
    echo "   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\"
    echo "     --remote-allow-origins=* \\"
    echo "     --user-data-dir=/tmp/chrome-agntcbro \\"
    echo "     --remote-debugging-port=18801"
    echo ""
    python3 "$SCRIPT_DIR/x-monitor-engagement.py"
fi

echo ""
echo "📋 NEXT STEPS:"
echo "   1. Review targets in $OUTPUT_DIR/x-engagement-targets.json"
echo "   2. Pick a target and engagement type"
echo "   3. Generate a reply: bash $SCRIPT_DIR/x-reply-templates.sh <type> [context]"
echo "   4. Customize the reply for the specific post"
echo "   5. Post manually — never copy-paste the same message twice"