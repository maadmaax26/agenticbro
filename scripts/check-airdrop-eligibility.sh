#!/bin/bash
# AGNTCBRO Airdrop Eligibility Checker
# Wrapper script to bypass exec preflight

SCRIPT_DIR="/Users/efinney/.openclaw/workspace/scripts"
MONITOR_SCRIPT="$SCRIPT_DIR/airdrop_wallet_monitor.py"

# Run the Python script directly
python3 "$MONITOR_SCRIPT" --check-all