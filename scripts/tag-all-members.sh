#!/bin/bash
# tag-all-members.sh — Bash wrapper for tag_all_members.py
# Admin-only: tag all group members with a message
#
# Usage: bash /workspace/scripts/tag-all-members.sh "<group_id>" "<message>"
# Example: bash /workspace/scripts/tag-all-members.sh "-1003751594817" "New contest live!"
#
# This uses the Telegram Bot API to send messages with @mentions.
# Requires TELEGRAM_BOT_TOKEN env var or keychain entry.

set -euo pipefail

GROUP_ID="${1:?Usage: tag-all-members.sh <group_id> <message>}"
MESSAGE="${2:?Usage: tag-all-members.sh <group_id> <message>}"

# Load bot token from keychain if not in env
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  TELEGRAM_BOT_TOKEN=$(security find-generic-password -s "telegram_bot_token" -a "agenticbro" -w 2>/dev/null || echo "")
  export TELEGRAM_BOT_TOKEN
fi

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN not found in env or keychain"
  exit 1
fi

python3 /Users/efinney/.openclaw/workspace/scripts/tag_all_members.py tag "$GROUP_ID" "$MESSAGE"