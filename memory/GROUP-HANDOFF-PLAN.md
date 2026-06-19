# Agentic Bro Group Handoff Plan

## Purpose

Hand off group moderation duties from cloud models (glm-5:cloud) to local models (granite4.1:3b or qwen3:1.7b) for the Agentic Bro main group (-1003751594817) to minimize API costs while maintaining quality engagement.

---

## Current State

| Component | Setting | Notes |
|-----------|---------|-------|
| Main Group | -1003751594817 | `requireMention: true` (just changed) |
| Scam Scans Group | -1003967263388 | Separate session, can use different model |
| Current Model | glm-5:cloud | Cloud, ~$0 cost via JaaS |
| Local Options | granite4.1:3b, qwen3:1.7b | Both available |

---

## Local Model Comparison

| Model | Size | Speed | Use Case | Notes |
|-------|------|-------|----------|-------|
| granite4.1:3b | 4.9GB | ~0.1-0.4s | Quick replies, greetings | Already configured for JaaS groups |
| qwen3:1.7b | 4.9GB | ~0.1-0.3s | Simple chat | Lighter weight alternative |

**Recommendation:** Use `ollama/granite4.1:3b` — already proven for JaaS groups, good balance of speed and quality.

---

## Handoff Checklist

### Phase 1: Configuration Changes

1. **Update Agent Config** (`/Users/efinney/.openclaw/agents/agentic-bro/agent/config.json`)
   - Change default model to `ollama/granite4.1:3b`
   - Keep fallback chain for complex tasks
   - Set timeout lower (6s for local)

2. **Update Routing** (`/Users/efinney/.openclaw/agents/agentic-bro/agent/routing.json`)
   - Route group messages to local model
   - Escalate scans/investigations to cloud

3. **Update MEMORY.md**
   - Document new routing rules
   - Update model comparison table

### Phase 2: Model Preparation

1. **Ensure local model is loaded:**
   ```bash
   ollama pull granite4.1:3b
   ollama keep granite4.1:3b
   ```

2. **Verify performance:**
   ```bash
   ollama run granite4.1:3b "Hello, how are you?"
   # Should respond in <1s
   ```

3. **Test with actual group messages:**
   - Send test mentions in group
   - Verify response quality
   - Check response time

### Phase 3: Rollout

1. **Soft Launch**
   - Keep cloud fallback enabled
   - Monitor response quality
   - Track error rates

2. **Monitor Metrics**
   - Response time (target: <2s)
   - Error rate (target: <5%)
   - User satisfaction (subjective)

3. **Hard Cut** (after 24h soft launch)
   - Remove cloud fallback for simple messages
   - Keep cloud for scans/investigations

---

## Routing Rules

### Stay Local (granite4.1:3b)
- Greetings and basic chat
- Status checks ("are you up?")
- Simple acknowledgments
- Member welcomes (from Rose Bot triggers)
- Positive engagement posts (morning/evening vibes)

### Escalate to Cloud (glm-5:cloud)
- Scam scans (use website redirect)
- Deep investigations
- Complex reasoning
- Error recovery
- Any task requiring tools

---

## Config Changes Required

### 1. Agent Config (`agent/config.json`)

```json
{
  "agent": {
    "model": "ollama/granite4.1:3b",
    "timeout_ms": 8000,
    "fallbacks": [
      "ollama/glm-5:cloud",
      "ollama/glm-5.1:cloud"
    ]
  }
}
```

### 2. Routing (`agent/routing.json`)

```json
{
  "handles": [
    "greeting",
    "status_check",
    "quick_reply",
    "member_welcome",
    "engagement_post"
  ],
  "stay_local": [
    "greeting",
    "status_check",
    "quick_reply",
    "member_welcome",
    "engagement_post"
  ],
  "escalate_to": [
    "ollama/glm-5:cloud"
  ]
}
```

### 3. Channel Config (`.openclaw/config.json`)

Already set:
- `requireMention: true` for all groups ✓

---

## Fallback Chain

```
1. granite4.1:3b (local) → Primary for group
2. glm-5:cloud → Fallback for errors
3. glm-5.1:cloud → Secondary fallback
```

---

## Escalation Triggers

Escalate to cloud model when:

| Trigger | Action |
|---------|--------|
| Tool calls needed | Use glm-5:cloud |
| Complex reasoning | Use kimi-k2.6:cloud |
| Scan requests | Redirect to website |
| Error in local | Retry with cloud fallback |
| Multi-step tasks | Use glm-5:cloud |

---

## Monitoring Commands

```bash
# Check local model status
ollama list | grep granite

# Check model memory usage
ollama ps

# Test response time
time ollama run granite4.1:3b "Test greeting"

# Check session status
openclaw status
```

---

## Rollback Plan

If local model causes issues:

1. **Immediate:** Set `requireMention: true` (already done) — reduces volume
2. **If errors > 10%:** Revert agent config to `glm-5:cloud`
3. **If quality issues:** Add routing rule to prefer cloud for all tasks

Rollback command:
```bash
# Edit agent config
# "model": "ollama/glm-5:cloud"
# Restart gateway
openclaw gateway restart
```

---

## Cost Savings Estimate

| Metric | Before (Cloud) | After (Local) |
|--------|----------------|----------------|
| Cost per message | ~$0.001-0.005 | $0 |
| Monthly messages | ~1000-2000 | ~1000-2000 |
| Monthly cost | $1-10 | $0 |

**Estimated savings:** $1-10/month (minimal since JaaS is already free for groups)

---

## Notes

- JaaS groups are already free — main benefit is **speed** not cost
- Local model responds faster (~0.1-0.4s vs 1-3s cloud)
- `requireMention: true` already reduces API calls significantly
- Keep cloud fallback for reliability

---

## Status

- [ ] Update agent config
- [ ] Update routing rules
- [ ] Test local model
- [ ] Soft launch (24h)
- [ ] Monitor metrics
- [ ] Hard cut
- [ ] Update MEMORY.md

---

**Created:** 2026-06-12
**Author:** Jeeevs
**Group:** -1003751594817 (Agentic Bro Main)