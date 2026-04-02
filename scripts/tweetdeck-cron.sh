#!/bin/bash
# TweetDeck Monitor Cron Job
# Scans X Pro columns for potential scammers

cd /Users/efinney/.openclaw/workspace/scripts

# Log file
LOG="/Users/efinney/.openclaw/workspace/output/tweetdeck-monitor.log"

echo "$(date): Starting TweetDeck scan..." >> "$LOG"

# Run the monitor
python3 tweetdeck-monitor.py --once >> "$LOG" 2>&1

echo "$(date): Scan complete" >> "$LOG"
