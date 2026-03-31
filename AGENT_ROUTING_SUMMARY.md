# Agent Model Routing Summary

**Generated:** March 28, 2026

---

## Primary/Default Model

| Setting | Value |
|---------|-------|
| **Primary Model** | `ollama/glm-5:cloud` |
| **Provider** | Ollama Cloud |
| **Context** | 128K tokens |
| **Intelligence** | Very High (744B MoE) |

---

## Telegram Group Routing

| Telegram Group | Agent | Per-Agent Model | Location | Response Time |
|----------------|-------|-----------------|----------|---------------|
| **AgenticBro** (-1003751594817) | `agenticbro` | `ollama/glm-4.7-flash:latest` | Local | ~1-2s |
| **Scam Scans** (-5183433558) | `web-scraper` | `ollama/qwen3.5:9b` | Local | ~1-2s |

---

## All Agents Model Assignments

### Local Agents (Fast Response)

| Agent | Config Model | Status | Purpose |
|-------|--------------|--------|---------|
| `agenticbro` | glm-4.7-flash:latest | ✅ Active | AgenticBro Telegram group |
| `web-scraper` | qwen3.5:9b | ✅ Active | Web scraping, scam scans |
| `telegram-manager` | qwen3.5:9b | ✅ Active | Telegram management |
| `file-manager` | qwen3.5:9b | ✅ Active | File operations |
| `query-router-1` | qwen3.5:9b | ✅ Active | Simple queries |
| `query-router-2` | qwen3.5:9b | ✅ Active | Simple queries (LB) |
| `session-balancer` | qwen3.5:9b | ✅ Active | Session routing |

### Cloud Agents (High Intelligence)

| Agent | Config Model | Status | Purpose |
|-------|--------------|--------|---------|
| `main` | glm-5:cloud (default) | ✅ Active | Complex investigations |
| `complex-op-1` | venice/glm-4.7 | ✅ Active | Multi-step operations |
| `complex-op-2` | venice/glm-4.7 | ✅ Active | Multi-step operations (LB) |

---

## Routing Logic

### Incoming Message Flow

```
Telegram Message Received
    ↓
Gateway checks BINDINGS
    ↓
Match found? → Route to specific agent
No match? → Route to DEFAULT agent (main)
    ↓
Agent loads its CONFIG.JSON model
    ↓
Process request
    ↓
Return response
```

### Binding Priority (Most Specific First)

1. **Peer match** (specific user/group) ← AGENTICBRO BINDING HERE
2. **Guild/Team match** (Discord/Slack specific)
3. **Account match** (specific account)
4. **Channel-wide match**
5. **Default agent** ← FALLS BACK HERE

---

## Current Bindings (openclaw.json)

```json
{
  "bindings": [
    {
      "agentId": "agenticbro",
      "match": {
        "channel": "telegram",
        "peer": {
          "kind": "group",
          "id": "-1003751594817"
        }
      }
    },
    {
      "agentId": "web-scraper",
      "match": {
        "channel": "telegram",
        "peer": {
          "kind": "group",
          "id": "-5183433558"
        }
      }
    }
  ]
}
```

---

## Delegation Chain

```
Telegram: AgenticBro Group
    ↓
agenticbro agent (glm-4.7-flash, local)
    ├─ Simple Q&A → Handle locally (<1s)
    ├─ X/Twitter scan → Delegate to web-scraper (<3s)
    ├─ Telegram mgmt → Delegate to telegram-manager (<1s)
    └─ Complex analysis → Delegate to main (glm-5:cloud, <5s)
```

---

## Troubleshooting

### Check Agent Model

```bash
# Check what model an agent uses
grep '"model"' ~/.openclaw/agents/[agent-name]/agent/config.json
```

### Check Current Routing

```bash
# Show all agents and their bindings
openclaw agents list --bindings
```

### Restart Gateway

```bash
# Apply config changes
openclaw gateway restart
```

### Verify Telegram Routing

1. Send test message to AgenticBro group
2. Check logs: `tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log`
3. Look for agent assignment in logs

---

## Memory Usage (Mac Mini 36GB)

| Model | Size | Concurrent Sessions |
|-------|------|---------------------|
| glm-4.7-flash | ~10 GB | 1-2 |
| qwen3.5:9b | ~5 GB | 3-4 |
| glm-5:cloud | Cloud | Unlimited |

**Total Local Capacity:** ~20 GB (5-6 concurrent local sessions)

---

## Status: ✅ CONFIGURED

- [x] Bindings configured for both Telegram groups
- [x] AgenticBro uses glm-4.7-flash (local, fast)
- [x] Web-scraper uses qwen3.5:9b (local, fast)
- [x] Complex tasks delegate to cloud models
- [x] Agent-to-agent delegation enabled

**Last Updated:** March 28, 2026 19:13 EDT
