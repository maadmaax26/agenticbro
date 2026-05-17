#!/bin/bash
# Heartbeat for Agentic Bro Group - Zero API Cost
# Uses Telegram Bot API directly
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
• Verify contract addresses
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