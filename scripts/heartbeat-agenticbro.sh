#!/bin/bash
# Heartbeat for Agentic Bro Group - Zero API Cost
# Uses Telegram Bot API directly

BOT_TOKEN="8798669748:AAH4mFi-Fmc415aM8jAEGYu7Wm_vx7BQ_nI"
GROUP_ID="-1003751594817"

HOUR=$(date +%H)

if [ "$HOUR" = "08" ]; then
    MESSAGE="Good morning Agentic Bro community! ☀️

Just checking in. Remember: Scan first, ape later! 🔐

How's everyone doing today?
• Any scam concerns?
• Want me to scan a profile or channel?
• Questions about Agentic Bro?

Drop a comment below! 👇

\$AGNTCBRO #Solana #CryptoSafety"
elif [ "$HOUR" = "20" ]; then
    MESSAGE="Evening check-in! 🌙

Agentic Bro here. Still protecting your \$SOL from scams.

Daily reminder:
• Scan X profiles before investing
• Check Telegram channels before joining
• Verify contract addresses (only trust 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump)
• Report suspicious activity

Scan first, ape later! 🔐

\$AGNTCBRO #Solana #CryptoSafety"
else
    echo "Not a heartbeat hour (current: $HOUR)"
    exit 0
fi

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\": \"${GROUP_ID}\", \"text\": \"${MESSAGE}\", \"parse_mode\": \"HTML\"}" > /dev/null

echo "Heartbeat sent at $(date)"
