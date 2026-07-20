#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AgenticBro Dev Server Startup Script
# Starts both the Express backend (port 3001) and Vite frontend (port 5173)
# Called by the macOS LaunchAgent on login.
# ─────────────────────────────────────────────────────────────────────────────

# Set up PATH so Homebrew node/npm are available to launchd
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

PROJECT_DIR="$HOME/.openclaw/workspace/aibro"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

echo "[$(date)] AgenticBro dev servers starting..." >> "$LOG_DIR/startup.log"

cd "$PROJECT_DIR" || {
  echo "[$(date)] ERROR: Could not cd to $PROJECT_DIR" >> "$LOG_DIR/startup.log"
  exit 1
}

# Run both servers (concurrently is already in package.json devDependencies)
exec npm run dev >> "$LOG_DIR/server.log" 2>&1
