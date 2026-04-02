#!/bin/bash

# Marketing Wallet Monitor
# Tracks deposits to: 9SFtm4S5QNDdMuWwgpy8E7ZhqRfgmjNtE1JLqkzPKj9F

WALLET="9SFtm4S5QNDdMuWwgpy8E7ZhqRfgmjNtE1JLqkzPKj9F"
MEMORY_FILE="/Users/efinney/.openclaw/workspace/memory/MARKETING_WALLET.md"
LOG_FILE="/Users/efinney/.openclaw/logs/marketing_wallet.log"

# Get current balance
BALANCE=$(curl -s "https://api.mainnet-beta.solana.com" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$WALLET\"]}" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['result']['value']/1e9)")

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Balance: $BALANCE SOL" >> "$LOG_FILE"

# Check for new transactions
curl -s "https://api.mainnet-beta.solana.com" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getSignaturesForAddress\",\"params\":[\"$WALLET\",{\"limit\":1}]}" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['result'][0]['signature'][:40])" >> "$LOG_FILE"

echo "---" >> "$LOG_FILE"
