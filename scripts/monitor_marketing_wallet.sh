#!/bin/bash

# Marketing Wallet Monitor
# Tracks deposits to: 9SFtm4S5QNDdMuWwgpy8E7ZhqRfgmjNtE1JLqkzPKj9F
# Uses RPC load balancer (Chainstack primary, public fallback)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/solana-rpc.sh"

WALLET="9SFtm4S5QNDdMuWwgpy8E7ZhqRfgmjNtE1JLqkzPKj9F"
MEMORY_FILE="/Users/efinney/.openclaw/workspace/memory/MARKETING_WALLET.md"
LOG_FILE="/Users/efinney/.openclaw/logs/marketing_wallet.log"

# Get current balance (load balanced)
BALANCE=$(solana_rpc_call "getBalance" "[\"$WALLET\"]" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['value']/1e9)")

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Balance: $BALANCE SOL" >> "$LOG_FILE"

# Check for new transactions (load balanced)
solana_rpc_call "getSignaturesForAddress" "[\"$WALLET\",{\"limit\":1}]" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['result'][0]['signature'][:40])" >> "$LOG_FILE"

echo "---" >> "$LOG_FILE"
