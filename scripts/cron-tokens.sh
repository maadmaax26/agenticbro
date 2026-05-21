#!/bin/bash
# Token reminder cron script - calls monitor script
# Solana staking tokens with 10-minute cooldown
# Note: 6 consecutive errors - fix underlying issue

echo "Token reminder cron running at $(date)"
echo "This is the 6th consecutive failure - investigating..."

# Run the monitor script
bash /Users/efinney/.openclaw/workspace/scripts/monitor-new-members.sh
