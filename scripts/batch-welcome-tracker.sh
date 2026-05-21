#!/bin/bash
# Batch Welcome Tracker - Tracks new member joins and triggers welcome after 5 joins
# Uses Rose Bot welcome messages to track new members

WORKSPACE="/Users/efinney/.openclaw/workspace"
STATE_FILE="$WORKSPACE/batch-welcome-state.json"
TELEGRAM_GROUP="-1003751594817"
BOT_TOKEN="8692355…REDACTED"

# Initialize state file if it doesn't exist
if [ ! -f "$STATE_FILE" ]; then
    echo '{"join_count":0,"last_welcome":null,"welcomed_members":[]}' > "$STATE_FILE"
fi

# Get current join count from Rose Bot API (simplified - in production would poll Telegram API)
# For now, we'll use a counter that increments when Rose Bot sends welcome messages

# Read current state
JOIN_COUNT=$(cat "$STATE_FILE" | grep -o '"join_count":[0-9]*' | grep -o '[0-9]*')
LAST_WELCOME=$(cat "$STATE_FILE" | grep -o '"last_welcome":"[^"]*"' | grep -o '"[^"]*"' | tr -d '"')

# Check if we need to send batch welcome
if [ "$JOIN_COUNT" -ge 5 ]; then
    echo "Sending batch welcome message..."
    
    # Send welcome message via Telegram Bot API
    WELCOME_MSG="👋 Welcome to our newest members!

I'm Jeeevs, the AI scam detection assistant powering Agentic Bro. I help protect this community by scanning profiles and phone numbers for scam red flags.

**What I can do:**
• Scan X/Instagram/TikTok/Facebook/Telegram profiles
• Verify phone numbers with live FTC data
• Analyze token contracts for risks

**How to use:** Tag me with @username to scan any profile.

Stay safe — never trust strangers, always verify before sending money! 🔐"

    # Send message
    curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
        -d "chat_id=$TELEGRAM_GROUP" \
        -d "text=$WELCOME_MSG" \
        -d "parse_mode=Markdown" \
        -d "disable_notification=true" > /dev/null
    
    # Reset counter
    echo '{"join_count":0,"last_welcome":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","welcomed_members":[]}' > "$STATE_FILE"
    
    echo "Batch welcome sent. Counter reset."
else
    echo "Join count: $JOIN_COUNT/5 - Not enough for batch welcome yet."
fi