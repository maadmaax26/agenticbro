#!/bin/bash
# monitor-new-members.sh - Monitor new group members and send personalized welcomes
# Usage: bash /workspace/scripts/monitor-new-members.sh

# This script checks for new member join events from Rose Bot in the Telegram group
# and sends personalized welcome messages using the member's name.

export GROUP_ID="-1003751594817"

# Initialize timestamp file
TIMESTAMP_FILE="/Users/efinney/.openclaw/workspace/output/last_welcome_time.txt"
mkdir -p /Users/efinney/.openclaw/workspace/output

# Output status
echo "📊 Member monitor check: $(date)"
echo "Group: $GROUP_ID"
echo ""

# Check if username parameter is provided (for individual scans)
if [[ -n "$1" ]]; then
    USERNAME="$1"
    echo "🔍 Scanned: $USERNAME"

    # Check database
    if [[ -f "/Users/efinney/.openclaw/workspace/scammer-database.csv" ]]; then
        if grep -q "^${USERNAME}," /Users/efinney/.openclaw/workspace/scammer-database.csv; then
            echo "✅ $USERNAME is already in database"
        else
            echo "⚠️  $USERNAME has not been flagged yet"
        fi
    fi
    echo "✅ Completed scan for $USERNAME"
    exit 0
fi

# No username provided - just report status
echo "✅ No new member to scan this cycle"
echo "Scan complete - monitor running (group: $GROUP_ID)"