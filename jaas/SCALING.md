# JaaS — Response & Scaling Architecture

## Question: How Does Jeeevs Respond in Client Groups?

### Current Architecture

JaaS uses **@Jeeevs222_bot** (your existing bot) for ALL instances. This means:

| Scenario | Behavior |
|----------|----------|
| Mentioned in Agentic Bro group | ✅ Responds (as configured now) |
| Mentioned in Client A group | ✅ Responds (same bot, different config) |
| Mentioned in Client B group | ✅ Responds (same bot, different config) |

**One bot, multiple groups, different configs.**

---

## Response Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 @Jeeevs222_bot (Single Bot)                 │
│                                                              │
│  Receives update from Telegram → Check which group          │
│                                                              │
│  if group == -1003751594817 (Agentic Bro)                   │
│    → Use Agentic Bro config (redirect scans to website)     │
│    → Model: granite4.1:3b                                   │
│                                                              │
│  if group == -100XXX (Client A)                             │
│    → Use Client A config (run scans directly)               │
│    → Model: granite4.1:3b                                   │
│                                                              │
│  if group == -100YYY (Client B)                             │
│    → Use Client B config (custom behavior)                  │
│    → Model: granite4.1:3b                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Do We Need Subagents?

### No — For Most Cases

**Why:** OpenClaw sessions are **per-group**, not per-bot. Each group gets its own session with isolated context.

```
OpenClaw Sessions:
├── agent:agentic-bro:telegram:group:-1003751594817
│   └── Session for Agentic Bro group
├── agent:agentic-bro:telegram:group:-100XXX
│   └── Session for Client A group
└── agent:agentic-bro:telegram:group:-100YYY
    └── Session for Client B group
```

**Each session:**
- Has its own conversation history
- Loads its own JaaS config
- Runs independently
- No cross-talk between groups

---

## When Would We Need Subagents?

### Scenario 1: High Message Volume (100+ groups)

If JaaS scales to 100+ groups with heavy traffic:

```
Problem: Single OpenClaw agent processing all groups sequentially
Solution: Spawn subagents per group or per tier
```

**Implementation:**
```bash
# Cron job spawns isolated subagent per group
sessions_spawn \
  --task "Moderate Client A group" \
  --model "granite4.1:3b" \
  --context "isolated"
```

### Scenario 2: Different Models Per Tier

If Pro/Enterprise clients want better models:

```
Token Hold: granite4.1:3b (local, $0)
Pro: glm-5:cloud (cloud, faster)
Enterprise: kimi-k2.6:cloud (cloud, deep analysis)
```

**Implementation:** Each cron job specifies model per instance config.

---

## Current Scaling Limits

| Factor | Limit | Reason |
|--------|-------|--------|
| Groups per bot | ~200 | Telegram API limit |
| Messages per second | 30 | Telegram rate limit |
| Concurrent sessions | 10-20 | OpenClaw agent capacity |
| Local model speed | 1-2s per response | granite4.1:3b inference |

**Estimated capacity:** 20-50 groups with current setup

---

## Scaling Path

### Phase 1: Current (1-20 groups)
- Single bot (@Jeeevs222_bot)
- Single OpenClaw agent
- Per-group sessions
- Local model (granite4.1:3b)

### Phase 2: Medium (20-100 groups)
- Single bot
- Single OpenClaw agent
- Subagents for high-traffic groups
- Mix of local + cloud models (Pro tier)

### Phase 3: Large (100+ groups)
- Multiple bots (one per tier or region)
- Multiple OpenClaw agents
- Subagents per group
- Cloud models for premium tiers

---

## Subagent Implementation (Future)

If needed, here's how to add subagents:

### Cron Job ( spawns subagent )
```json
{
  "name": "moderator-client-a",
  "schedule": {"kind": "every", "everyMs": 300000},
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "model": "ollama/granite4.1:3b",
    "message": "Run moderation for Client A. Use sessions_spawn to create isolated subagent if message backlog > 50. Config: /workspace/jaas/config/instances/client-a/config.json"
  }
}
```

### Subagent Spawn
```bash
# Inside the cron job, if load is high:
sessions_spawn \
  --task "Process 50+ messages for Client A" \
  --model "granite4.1:3b" \
  --context "isolated" \
  --cleanup "delete"
```

---

## Recommendation

**Start with current architecture:**
- Single bot (@Jeeevs222_bot)
- Per-group sessions (automatic via OpenClaw)
- Local model (granite4.1:3b)

**Add subagents when:**
- Total groups > 20
- Any single group > 100 messages/hour
- Pro/Enterprise clients want faster responses

---

## Response Behavior Per Tier

| Tier | Model | Response Time | Notes |
|------|-------|---------------|-------|
| Internal | granite4.1:3b | 1-2s | Local, $0 |
| Token Hold | granite4.1:3b | 1-2s | Local, $0 |
| Pro | glm-5:cloud | 0.5-1s | Cloud, ~$0.001/msg |
| Enterprise | kimi-k2.6:cloud | 1-3s | Cloud, deep analysis |

**Cost for Pro/Enterprise:**
- ~1000 messages/day = ~$1/day with cloud models
- Pass cost to client via subscription

---

## Summary

| Question | Answer |
|----------|--------|
| Does Jeeevs respond on mention? | ✅ Yes, in all groups where bot has admin |
| Do we need subagents? | ❌ Not yet — per-group sessions handle this |
| When to add subagents? | When >20 groups or high-traffic groups |
| How to scale? | Cloud models for Pro/Enterprise tiers |

---

**JaaS — Ready to scale when you are. 🔐**