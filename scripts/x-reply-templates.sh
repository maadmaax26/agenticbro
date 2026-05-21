#!/bin/bash
# X Reply Template Generator — Picks contextual reply templates for Agentic Bro engagement
#
# Types: scam_victim, safety_question, security_awareness, meme_caution, holder_pitch
#
# Usage:
#   bash /Users/efinney/.openclaw/workspace/scripts/x-reply-templates.sh list
#   bash /Users/efinney/.openclaw/workspace/scripts/x-reply-templates.sh scam_victim "wallet drained"
#   bash /Users/efinney/.openclaw/workspace/scripts/x-reply-templates.sh safety_question "new project"
#   bash /Users/efinney/.openclaw/workspace/scripts/x-reply-templates.sh meme_caution "meme coin safety"
#   bash /Users/efinney/.openclaw/workspace/scripts/x-reply-templates.sh holder_pitch

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ $# -lt 1 ]; then
    echo "Usage: bash $0 <type> [context]"
    echo ""
    echo "Types:"
    echo "  list                 — Show all available engagement types"
    echo "  scam_victim          — Person was scammed → offer free scan"
    echo "  safety_question      — Person asking if something is legit"
    echo "  security_awareness   — General security discussion"
    echo "  meme_caution         — Cautious about meme coins"
    echo "  holder_pitch         — What does $AGNTCBRO actually do?"
    echo ""
    echo "Examples:"
    echo "  bash $0 scam_victim \"lost SOL to fake airdrop\""
    echo "  bash $0 safety_question \"is @project legit\""
    echo "  bash $0 holder_pitch"
    exit 1
fi

python3 "$SCRIPT_DIR/x-reply-templates.py" "$@"