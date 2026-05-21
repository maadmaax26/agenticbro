#!/bin/bash
# Check for new members and send welcome if needed
# Called by cron every 5 minutes

SCRIPT_DIR="/Users/efinney/.openclaw/workspace/scripts"
STATE_FILE="/Users/efinney/.openclaw/workspace/member-welcome-state.json"

# Run the check
OUTPUT=$(/opt/homebrew/bin/python3 "$SCRIPT_DIR/check-new-members.py" check 2>&1)

# Check if new members detected
if echo "$OUTPUT" | grep -q "NEW_MEMBERS="; then
    # Extract the count
    NEW_COUNT=$(echo "$OUTPUT" | grep "NEW_MEMBERS=" | grep -o "[0-9]*")
    
    if [ -n "$NEW_COUNT" ] && [ "$NEW_COUNT" -ge 1 ]; then
        echo "NEW_MEMBERS=$NEW_COUNT"
    fi
else
    echo "NO_NEW_MEMBERS"
fi