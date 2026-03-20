#!/bin/bash
# ─── AgenticBro Backend Server ────────────────────────────────────────────────
# Run this script once on your local machine to start the Express backend.
# The frontend (localhost:5173 or GitHub Pages) routes all /api/* calls here.
#
# Usage:  ./start-server.sh
#         chmod +x start-server.sh  (first time only if permission denied)
# ──────────────────────────────────────────────────────────────────────────────

# Change to project root (handles running from any directory)
cd "$(dirname "$0")"

if [ ! -f ".env.local" ]; then
  echo "⚠️  .env.local not found — Telegram features will run in demo mode."
  echo "   Copy .env.local.example to .env.local and fill in your credentials."
fi

echo "🚀 Starting AgenticBro backend on http://localhost:3001 ..."
echo "   Press Ctrl+C to stop."
echo ""

npx tsx server/index.ts
