#!/bin/bash
# Auto-Raid Queue Manager for AgenticBro
# Finds and queues raid targets for community engagement

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
QUEUE_FILE="/Users/efinney/.openclaw/workspace/output/raid_queue.json"
LOG_FILE="/Users/efinney/.openclaw/workspace/output/raid_log.txt"

echo "[$TIMESTAMP] Raid Queue Manager Started" >> "$LOG_FILE"

# Check if Chrome is available on port 18801
CHROME_CHECK=$(curl -s http://localhost:18801/json/version 2>/dev/null | grep -c "Browser")

if [ "$CHROME_CHECK" -gt 0 ]; then
    echo "[$TIMESTAMP] Chrome available, running scan..." >> "$LOG_FILE"
    
    # Run Python raid finder
    python3 /Users/efinney/.openclaw/workspace/scripts/raid-target-finder.py >> "$LOG_FILE" 2>&1
    
    # Post to Telegram if targets found
    TARGETS=$(cat /Users/efinney/.openclaw/workspace/output/raid_targets.json 2>/dev/null | grep -c "url")
    
    if [ "$TARGETS" -gt 0 ]; then
        echo "[$TIMESTAMP] Found $TARGETS targets, posting to Telegram..." >> "$LOG_FILE"
        # Telegram posting is handled separately
    fi
else
    echo "[$TIMESTAMP] Chrome not available, using web search fallback..." >> "$LOG_FILE"
    
    # Fallback: Use web search to find targets
    # This is handled manually for now
    echo "[$TIMESTAMP] Manual search required - Chrome not logged in" >> "$LOG_FILE"
fi

echo "[$TIMESTAMP] Raid Queue Manager Completed" >> "$LOG_FILE"