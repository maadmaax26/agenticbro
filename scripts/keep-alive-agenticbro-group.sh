#!/bin/bash
# Keep-Alive Script for Agentic Bro Group
# Sends periodic messages to prevent session timeout
# Bot token is loaded from .env.local — NEVER hardcode tokens

# Load token from env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env.local"

if [ -f "$ENV_FILE" ]; then
    BOT_TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | cut -d'=' -f2-)
    GROUP_ID=$(grep '^TELEGRAM_GROUP_ID=' "$ENV_FILE" | cut -d'=' -f2-)
else
    BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
    GROUP_ID="${TELEGRAM_GROUP_ID:--1003751594817}"
fi

if [ -z "$BOT_TOKEN" ]; then
    echo "ERROR: TELEGRAM_BOT_TOKEN not set. Check .env.local or environment."
    exit 1
fi

# Morning keep-alive (8:00 AM EST)
if [ "$(date +%H)" = "08" ]; then
    curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d '{
            "chat_id": "'${GROUP_ID}'",
            "text": "Good morning Agentic Bro community! ☀️\n\nJust checking in. Remember: Scan first, ape later! 🔐\n\nHow'\''s everyone doing today?\n• Any scam concerns?\n• Want me to scan a profile or channel?\n• Questions about Agentic Bro?\n\nDrop a comment below! 👇\n\n$AGNTCBRO #Solana #CryptoSafety",
            "parse_mode": "HTML"
        }'
fi

# Evening keep-alive (8:00 PM EST)
if [ "$(date +%H)" = "20" ]; then
    curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d '{
            "chat_id": "'${GROUP_ID}'",
            "text": "Evening check-in! 🌙\n\nAgentic Bro here. Still protecting your $SOL from scams.\n\nDaily reminder:\n• Scan X profiles before investing\n• Check Telegram channels before joining\n• Verify contract addresses\n• Report suspicious activity\n\nScan first, ape later! 🔐\n\n$AGNTCBRO #Solana #CryptoSafety",
            "parse_mode": "HTML"
        }'
fi