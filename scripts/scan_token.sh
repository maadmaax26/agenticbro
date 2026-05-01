#!/bin/bash
# Token Impersonation Scanner - Quick Start Script

echo "━━━ 🔍 TOKEN IMPERSONATION SCAN — AI POWERED THREAT ASSESSMENT ━━━"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  DISCLAIMER NOTICE"
echo ""
echo "This scan is an AI-powered threat assessment of token contracts and impersonation patterns."
echo "For complete accuracy, verify information through multiple sources."
echo ""
echo "LIMITATIONS:"
echo "• Only scans publicly available data from search APIs")
echo("• Does NOT verify contract ownership or developer identity")
echo("• May miss sophisticated, well-hidden impersonators")
echo("• Subject to DexScreener API rate limits")
echo("\nINDEPENDENT VERIFICATION REQUIRED:")
echo("• Cross-check contract addresses on official platforms")
echo("• Never transfer tokens based on AI assessment alone")
echo("• Verify official communication channels")
echo("\n" + "="*70)
echo("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
echo ""
echo "🔍 Token Impersonation Scanner"
echo "================================"
echo ""
echo "This script scans for tokens impersonating a legitimate token."
echo ""

# Check if contract address is provided
if [ -z "$1" ]; then
    echo "❌ Error: Contract address required"
    echo ""
    echo "Usage: ./scan_token.sh <CONTRACT_ADDRESS>"
    echo ""
    echo "Example:"
    echo "  ./scan_token.sh 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
    echo ""
    exit 1
fi

CONTRACT_ADDRESS=$1

echo "🎯 Target Contract: $CONTRACT_ADDRESS"
echo ""
echo "⏳ Starting scan..."
echo ""

# Run the scanner
python3 /Users/efinney/.openclaw/workspace/scripts/token_impersonation_scanner.py "$CONTRACT_ADDRESS"

echo ""
echo "✅ Scan complete!"
echo ""
echo "📁 Files created:"
echo "  - Detailed report: impersonation_scan_${CONTRACT_ADDRESS}_*.json"
echo "  - Alert output (shown above)"
echo ""
echo "📢 Next steps:"
echo "  1. Review the alert output above"
echo "  2. Copy and paste to social media if threats found"
echo "  3. Update scammer database with high-risk tokens"
echo ""
echo "🔐 Remember: Scan first, ape later!"
echo ""