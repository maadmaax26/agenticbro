#!/bin/bash
# Token Impersonation Scanner - Quick Start Script

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