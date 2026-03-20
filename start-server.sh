#!/bin/bash
# Start AgenticBro server with environment loaded

# Kill any existing servers
pkill -f "tsx watch server" 2>/dev/null || true
pkill -f "node.*tsx" 2>/dev/null || true

echo "🚀 Starting AgenticBro server with Telegram integration..."

# Load environment from .env.local explicitly
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
  echo "✅ Environment loaded from .env.local"
else
  echo "⚠️  .env.local not found — Telegram will use mock data"
fi

# Start server
npx tsx server/index.ts