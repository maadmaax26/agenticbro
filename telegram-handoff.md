# Telegram Bot Handoff Plan

**Date:** 2026-05-09 21:56 EDT
**Status:** IN PROGRESS — Bot still not responding to Telegram messages

## Problem
@AGNTCBRO_bot (Jeeevs) does not respond to messages in Telegram DMs or group chat.

## Root Cause Found
**Duplicate bot token polling** — Two Telegram accounts (`default` and `1003751594817`) in `openclaw.json` both had the same bot token, creating two parallel polling instances. Telegram only allows one `getUpdates` poller per bot token, so the 409 Conflict error was thrown and messages were never consistently consumed.

## Fixes Applied (but not yet verified working)
1. ✅ Added account `1003751594817` to `openclaw.json` with bot token
2. ✅ Removed duplicate `default` account from `openclaw.json` (same bot token)
3. ✅ Removed top-level `botToken` from `openclaw.json` (was creating implicit default account)
4. ✅ Removed `botToken` and `defaultAgent` from `config.json` (was conflicting with openclaw.json)
5. ✅ Set `requireMention: false` for all groups
6. ✅ Cleared all Telegram sessions from both agents
7. ✅ Gateway restarted multiple times

## Current Config State

### openclaw.json → channels.telegram
```json
{
  "enabled": true,
  "dmPolicy": "open",
  "groupPolicy": "open",
  "accounts": {
    "1003751594817": {
      "botToken": "8692355…REDACTED",
      "dmPolicy": "open",
      "groupPolicy": "open",
      "streaming": { "mode": "off" },
      "enabled": true,
      "allowFrom": ["*"]
    }
  },
  "groups": {
    "*": { "requireMention": false },
    "-1003751594817": { "requireMention": false }
  }
}
```

### config.json → channels.telegram
```json
{
  "allowFrom": ["2122311885"],
  "dmPolicy": "allowlist",
  "enabled": true,
  "groupPolicy": "open",
  "groups": { "*": { "requireMention": false } }
}
```

**⚠️ CONFLICT:** `config.json` has `dmPolicy: "allowlist"` and `allowFrom: ["2122311885"]` while `openclaw.json` has `dmPolicy: "open"` and `allowFrom: ["*"]`. These may conflict — `allowlist` with only one user could block group messages or other users.

## Key Files
| File | Path |
|------|------|
| Main config | `/Users/efinney/.openclaw/openclaw.json` |
| Legacy config | `/Users/efinney/.openclaw/config.json` |
| Agent config | `/Users/efinney/.openclaw/agents/agentic-bro/agent/config.json` |
| Agent routing | `/Users/efinney/.openclaw/agents/agentic-bro/agent/routing.json` |
| Agent sessions | `/Users/efinney/.openclaw/agents/agentic-bro/sessions/sessions.json` |
| Main sessions | `/Users/efinney/.openclaw/agents/main/sessions/sessions.json` |
| Gateway logs | `/tmp/openclaw/openclaw-2026-05-09.log` (rotates daily) |

## What To Check Next

### 1. Verify no more 409 Conflict errors
```bash
grep -i "409\|conflict" /tmp/openclaw/openclaw-2026-05-09.log | tail -5
```
If still seeing conflicts, there may be yet another process with the bot token. Check:
```bash
ps aux | grep -i telegram
```

### 2. Test inbound message processing
Have Madmax send a message to @AGNTCBRO_bot on Telegram, then immediately check logs:
```bash
tail -50 /tmp/openclaw/openclaw-2026-05-09.log | grep -i "inbound\|dispatch\|route\|agent"
```

### 3. Check dmPolicy conflict
`config.json` has `dmPolicy: "allowlist"` with `allowFrom: ["2122311885"]`. This might restrict who the bot responds to. If the group chat sender isn't in the allowlist, messages could be silently dropped. Consider changing config.json to match openclaw.json's `dmPolicy: "open"`.

### 4. Check message routing
Inbound Telegram messages should route to `agent:agentic-bro`, NOT `agent:main`. Verify in the agent routing config:
```bash
cat /Users/efinney/.openclaw/agents/agentic-bro/agent/routing.json
```

### 5. If bot receives but doesn't respond
Check if the agentic-bro agent model (`ollama/glm-5.1:cloud` or `ollama/qwen3.5:9b`) is running:
```bash
curl -s http://localhost:11434/api/ps | python3 -m json.tool
```

### 6. Last resort: full reset
```bash
# Clear all telegram sessions
python3 -c "
import json
for agent in ['agentic-bro', 'main']:
    path = f'/Users/efinney/.openclaw/agents/{agent}/sessions/sessions.json'
    with open(path) as f: d = json.load(f)
    tg_keys = [k for k in d if 'telegram' in k]
    for k in tg_keys: del d[k]
    with open(path, 'w') as f: json.dump(d, f, indent=2)
    print(f'{agent}: removed {len(tg_keys)} sessions')
"
# Clear pending Telegram updates
curl -s "https://api.telegram.org/bot8692355…REDACTED/getUpdates?offset=-1"
# Restart gateway
openclaw gateway restart
```

## Bot Details
- **Bot:** @AGNTCBRO_bot
- **Token:** `8692355…REDACTED`
- **Group ID:** `-1003751594817`
- **Account ID:** `1003751594817`
- **Madmax user ID:** `2122311885`
- **Agent:** `agentic-bro`
- **Group model:** `ollama/glm-5.1:cloud` → `ollama/qwen3.5:9b` fallback

## Gateway Commands
```bash
openclaw gateway status    # Check status
openclaw gateway restart   # Soft restart
openclaw status            # Full status
```