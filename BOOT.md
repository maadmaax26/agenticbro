# BOOT.md - System Startup Reference

**Project:** Agentic Bro ($AGNTCBRO)  
**Agent:** agentic-bro  
**Host:** Earl's Mac Studio  
**Workspace:** /Users/efinney/.openclaw/workspace/

---

## Current Model Routing (Updated 2026-05-16)

### Primary Model
- **Current:** `ollama/glm-5:cloud`
- **Reasoning:** OFF (for faster responses)

### Failover Order
1. `glm-5.1:cloud` — Newer cloud model, first fallback
2. `kimi-k2.6:cloud` — Complex analysis, multi-step reasoning
3. `qwen3-coder-next:cloud` — Coding tasks

### Routing Rules
| Task Type | Model | Notes |
|-----------|-------|-------|
| Simple queries, welcomes | glm-5:cloud | Most reliable cloud |
| Profile scans (IG/TikTok/FB) | glm-5:cloud | Cloud, reliable |
| Code generation | qwen3-coder-next:cloud | Dedicated coding model |
| Deep investigation | kimi-k2.6:cloud | Cloud, 200K context |
| Complex reasoning | kimi-k2.6:cloud | Escalation path |
| Fallback / errors | glm-5.1:cloud | Newer model backup |

### ⚠️ Dead Models — DO NOT USE
- `qwen3.5:4b` — REMOVED from Ollama May 16. Caused all Telegram session failures.
- `ministral-3:latest` — Retired
- `granite4:3b` — Retired

---

## Cron Jobs (Active)

| Job | Schedule | Model | Status |
|-----|----------|-------|--------|
| nightly_review | 2:00 AM EST | glm-5.1:cloud | ✅ Active |
| website-deep-scan | Every 15 min | glm-5.1:cloud | ✅ Active |

### Disabled Cron Jobs
- heartbeat-morning, heartbeat-evening, buy-energy-boost, midday_checkin, token-reminder
- new-member-welcome, scan-worker-x-cdp
- All disabled per policy: no auto group posts

---

## Scan Commands (bash wrappers only)

```bash
# Platform scanning
bash /workspace/scripts/scan-instagram.sh "<username>"
bash /workspace/scripts/scan-tiktok-command.sh "<username>"
bash /workspace/scripts/scan-facebook.sh "<username>"
bash /workspace/scripts/scan-source.sh "<platform>" "<username>"
bash /workspace/scripts/scan-telegram.sh "<username>"

# Phone verification
bash /workspace/scripts/scan-phone.sh "+14158586273" US

# X/Twitter — Chrome CDP only (port 18801)
```

---

## Key System Info

- **Chrome CDP:** Port 18801
- **Telegram:** DISABLED (bot deleted, no token)
- **Group ID:** -1003751594817 (archived)
- **Scammer DB:** 278+ entries
- **Contract:** 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
- **Config:** timeout 18s, maxOutput 2000, fallbacks: glm-5→glm-5.1→kimi-k2.6→qwen3-coder-next

---

## Cross-Session Awareness

**Active Files:**
- `memory/AGENT_REGISTRY.md` — Agent tracking
- `memory/SESSION_EVENTS.md` — Event logging
- `memory/CONFIG_CHANGES.md` — Config audit trail
- `memory/RULES.md` — Permanent behavioral rules
- `memory/TECHNICAL.md` — Technical reference

**Nightly Review:** Updates all cross-session files at 2:00 AM EST

---

## Response Guidelines

- **Language:** English only
- **Style:** Sharp, direct, protective
- **Group messages:** 1-4 sentences max
- **Slogan:** "Scan first, trust later!"
- **Emoji:** 🔍

---

## Important Rules

- NEVER mention "Madmax" by name in group
- NEVER produce scan-format responses in group chat
- NEVER use name "Ben" — use actual username
- NEVER reference dead models (qwen3.5:4b, ministral-3, granite4:3b)
- ALWAYS include disclaimer in scan reports
- ALWAYS specify platform in scan results
- NO auto-scanning members (only when asked with @username)

---

## Boot Check

When starting a new session, verify:
1. Model routing matches config.json (glm-5.1:cloud primary)
2. Cron jobs status via `cron list`
3. Memory files accessible
4. Gateway responding
5. No sessions stuck on dead models (qwen3.5:4b)

Last updated: 2026-05-16 18:38 EDT