#!/bin/bash

# Quick-start wrapper for batch profile scanning
# 1. Launches 3 Chrome CDP instances
# 2. Runs batch scanner on all UNVERIFIED profiles

set -e

WORKSPACE="/Users/efinney/.openclaw/workspace"
SCRIPTS_DIR="$WORKSPACE/scripts"

echo "━━━ 🔍 AGENTIC BRO BATCH PROFILE SCAN — AI POWERED ASSESSMENT ━━━"
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
echo "• Cross-check usernames across multiple platforms"
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
echo ""
echo "🔐 Agentic Bro Batch Profile Scanner"
echo "======================================"
echo ""

# Step 1: Launch Chrome instances
echo "Step 1: Launching Chrome CDP instances..."
"$SCRIPTS_DIR/launch-chrome-instances.sh"

if [ $? -ne 0 ]; then
    echo "❌ Failed to launch Chrome instances"
    exit 1
fi

echo ""
echo "Step 2: Starting batch profile scanner..."
echo ""

# Step 2: Run batch scanner
cd "$WORKSPACE"
python3 scripts/batch-scan-simple.py

echo ""
echo "✅ Batch scan complete!"