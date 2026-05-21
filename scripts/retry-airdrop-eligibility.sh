#!/bin/bash
# AGNTCBRO Airdrop Eligibility Retry
# Retry failed wallets with delay between requests

SCRIPT_DIR="/Users/efinney/.openclaw/workspace/scripts"
MONITOR_SCRIPT="$SCRIPT_DIR/airdrop_wallet_monitor.py"

# Retry with 2-second delay between wallets
echo "Retrying failed wallets with 2-second delays..."

python3 "$MONITOR_SCRIPT" --check-all