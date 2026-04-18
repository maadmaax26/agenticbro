#!/bin/bash
# Keep-Alive Script for Agentic Bro Group
# Sends periodic messages to prevent session timeout

GROUP_ID="-1003751594817"
BOT_TOKEN="8798669748:AAH4mFi-Fmc415aM8jAEGYu7Wm_vx7BQ_nI"

# Morning keep-alive (8:00 AM EST)
if [ "$(date +%H)" = "08" ]; then
    curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d '{
            "chat_id": "'${GROUP_ID}'",
            "text": "Good morning Agentic Bro community! ☀️\n\nJust checking in. Remember: Scan first, ape later! 🔐\n\nHow'\''s everyone doing today?\n• Any scam concerns?\n• Want me to scan a profile or channel?\n• Questions about Agentic Bro?\n\nDrop a comment below! 👇\n\n$AGNTCBRO #Solana #CryptoSafety",
            "parse_mode": "HTML"
        }'
fi

# Evening keep-alive (8:00 PM EST)
if [ "$(date +%H)" = "20" ]; then
    curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d '{
            "chat_id": "'${GROUP_ID}'",
            "text": "Evening check-in! 🌙\n\nAgentic Bro here. Still protecting your $SOL from scams.\n\nDaily reminder:\n• Scan X profiles before investing\n• Check Telegram channels before joining\n• Verify contract addresses (only trust 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump)\n• Report suspicious activity\n\nScan first, ape later! 🔐\n\n$AGNTCBRO #Solana #CryptoSafety",
            "parse_mode": "HTML"
        }'
fi