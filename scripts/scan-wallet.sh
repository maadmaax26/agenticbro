#!/bin/bash
# Wallet Transfer Scanner for AGNTCBRO Token Detection
# Searches Solana blockchain for recent transfers to/from a target wallet
# Usage: bash scan-wallet.sh <wallet_address>
# Token: AGNTCBRO (52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump)

set -uo pipefail

# Source RPC load balancer (Chainstack primary, public fallback)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/solana-rpc.sh"

WALLET="${1:-}"
SCAN_DATE=$(date '+%Y-%m-%d')
TIMESTAMP=$(date '+%Y-%m-%d %I:%M %p %Z')
AGNTCBRO_MINT="52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
SOLANA_RPC=$(get_solana_rpc)

if [ -z "$WALLET" ]; then
    echo "Usage: bash scan-wallet.sh <wallet_address>"
    echo "Example: bash scan-wallet.sh J1FB6YSXaqX69CHa6JBxqrjGy3nnFdoJXerSsKtZP1hb"
    exit 1
fi

echo "━━━ 💰 WALLET SCAN — AGNTCBRO TOKEN ACTIVITY ━━━"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Wallet: ${WALLET}"
echo "Token: AGNTCBRO (${AGNTCBRO_MINT})"
echo "Time: ${TIMESTAMP}"
echo "Network: Solana Mainnet"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Solana RPC connectivity (round-robin load balanced)
RPC_CHECK=$(solana_rpc_call "getHealth" '[]' 1 2>/dev/null)

if echo "$RPC_CHECK" | grep -q '"result":"ok"'; then
    echo "✅ Solana RPC: Connected (load balanced)"
    echo ""
else
    echo "⚠️  Solana RPC: Connection issue"
    echo ""
fi

# Fetch wallet balance (load balanced)
BALANCE=$(solana_rpc_call "getBalance" "[\"${WALLET}\"]" 2>/dev/null)

if echo "$BALANCE" | grep -q '"result"'; then
    LAMPORTS=$(echo "$BALANCE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('value',0))" 2>/dev/null)
    if [ -n "$LAMPORTS" ] && [ "$LAMPORTS" != "0" ]; then
        SOL_BALANCE=$(python3 -c "print(${LAMPORTS}/1000000000)" 2>/dev/null)
        echo "💰 SOL Balance: ${SOL_BALANCE} SOL"
    else
        echo "💰 SOL Balance: 0 SOL (empty or invalid wallet)"
    fi
else
    echo "💰 SOL Balance: Unable to fetch"
fi

# Fetch token accounts (load balanced)
TOKENS=$(solana_rpc_call "getTokenAccountsByOwner" "[\"${WALLET}\",{\"mint\":\"${AGNTCBRO_MINT}\"},{\"encoding\":\"jsonParsed\"}]" 2>/dev/null)

echo ""
echo "🔍 AGNTCBRO Holdings:"
if echo "$TOKENS" | grep -q '"amount"'; then
    AMOUNT=$(echo "$TOKENS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
accounts=d.get('result',{}).get('value',[])
for acc in accounts:
    info=acc.get('account',{}).get('data',{}).get('parsed',{}).get('info',{})
    print(info.get('tokenAmount',{}).get('uiAmountString','0'))
" 2>/dev/null)
    echo "   Holdings: ${AMOUNT:-0} AGNTCBRO"
else
    echo "   Holdings: 0 AGNTCBRO (no position found)"
fi

# Check recent transactions (load balanced)
SIGNATURES=$(solana_rpc_call "getSignaturesForAddress" "[\"${WALLET}\",{\"limit\":5}]" 2>/dev/null)

echo ""
echo "📋 Recent Transactions (last 5):"
if echo "$SIGNATURES" | python3 -c "
import sys,json
d=json.load(sys.stdin)
sigs=d.get('result',[])
if not sigs:
    print('   No recent transactions found')
for s in sigs[:5]:
    sig=s.get('signature','?')[:20]
    slot=s.get('slot','?')
    err=s.get('err')
    status='✅' if err is None else '❌'
    print(f'   {status} {sig}... (slot {slot})')
" 2>/dev/null; then
    : # output already printed
else
    echo "   Unable to fetch transaction history"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Disclaimer: Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR. Scan date: ${SCAN_DATE}"