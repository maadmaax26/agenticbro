#!/bin/bash
# member-track.sh — Bash wrapper for group member tracking
# Usage:
#   bash /workspace/scripts/member-track.sh add <group_id> <user_id> [username] [first_name]
#   bash /workspace/scripts/member-track.sh remove <group_id> <user_id>
#   bash /workspace/scripts/member-track.sh list <group_id>
#   bash /workspace/scripts/member-track.sh count <group_id>
#   bash /workspace/scripts/member-track.sh sync <group_id>
#
# Member store: /Users/efinney/.openclaw/workspace/data/group_members.json

set -euo pipefail

ACTION="${1:?Usage: member-track.sh <action> [args...]}"
shift

# Load bot token from keychain if not in env (needed for sync)
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  TELEGRAM_BOT_TOKEN=$(security find-generic-password -s "telegram_bot_token" -a "agenticbro" -w 2>/dev/null || echo "")
  export TELEGRAM_BOT_TOKEN
fi

python3 /Users/efinney/.openclaw/workspace/scripts/tag_all_members.py "$ACTION" "$@"