#!/bin/bash
# TikTok Scanner — GROUP ONLY OUTPUT
# Usage: scan-tiktok-group-only @username

USERNAME="$2"

# Run Python scan
SCAN_OUTPUT=$(python3 /Users/efinney/.openclaw/workspace/scam-detection-framework/tiktok-scan.py "$@" 2>&1)

SESSION_KEY="agent:agentic-bro:telegram:group:-1003751594817"
MESSAGE="🔍 TIKTOK SCAN — @${USERNAME}

━━━ CHAT: ${USERNAME} ━━━

⚠️  DISCLAIMER NOTICE

This is an AI-powered threat assessment. For complete accuracy, verify via multiple sources.

CRYPTO REQUISITES:
• Only public profile data
• No identity verification
• May miss sophisticated scams
• Subject to website rules

INDEPENDENT VERIFICATION REQUIRED:
• Cross-check across platforms
• Never send money or share private keys

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃          ⚠️ CRITICAL WARNING ⚠️ ┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️   Verify multi-source before decisions
⚠️   AI may miss sophisticated scams — cross-ref
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻

$SCAN_OUTPUT

────────────────────────────────────────────────────────────────────────

⚠️ CRITICAL — AI STRONGLY ADVISES CAUTION
   • Verify from multiple independent sources
   • Be extremely cautious before money transfer
   • Do NOT provide personal/financial info

────────────────────────────────────────────────────────────────────────

⚠️  Scan complete — Refer to disclaimer — Independent verification always recommended

$AGNTCBRO #ScamDetection"

# Send ONLY to Agentic Bro group
curl -s -X POST "https://api.openclaw.ai/gateway/sessions/send" \
  -H "Content-Type: application/json" \
  -d "{\"sessionKey\":\"$SESSION_KEY\",\"message\":\"$MESSAGE\"}" > /dev/null

echo "✅ Posted to Agentic Bro group only"

exit 0