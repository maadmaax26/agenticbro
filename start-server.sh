#!/bin/bash
# Start backend server with Telegram MTProto credentials

echo "🚀 Starting backend server with Telegram credentials..."

# Load environment variables from .env.local
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo "✅ Loaded environment variables from .env.local"
else
    echo "⚠️ .env.local not found, using defaults"
fi

# Show loaded credentials (sanitized)
echo "📋 Telegram Configuration:"
echo "   API_ID: ${TELEGRAM_API_ID:0:-6}***"
echo "   API_HASH: ${TELEGRAM_API_HASH:0:-6}***"
echo "   SESSION: ${TELEGRAM_SESSION_STRING:0:20}***"

# Start the server
echo ""
echo "🔧 Starting Node.js backend server..."
npm run dev:server