# Multi-Agent Architecture Design

## Overview
Scale beyond the current 10 concurrent session limit by implementing a multi-agent architecture with specialized agents, gateway-level routing, and load balancing.

## Current Architecture (Single Agent)

```
┌─────────────────────────────────────────────┐
│           Gateway (18789)                   │
│         (Single Session Balancer)            │
└────────────────┬────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │ Session        │
        │ Balancer       │
        │ (qwen3.5:9b)   │
        │ 10 sessions    │
        └────────┬───────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌───────────────┐  ┌──────────────────┐
│ Local Queries │  │ Main Agent       │
│ < 2s          │  │ (glm-4.7:cloud)  │
│ Unlimited     │  │ Unlimited        │
└───────────────┘  └──────────────────┘
```

**Limitation:** 10 concurrent sessions maximum

---

## Multi-Agent Architecture (Tiered)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Gateway (18789)                            │
│                   Load Balancer Middleware                       │
│              (Round-robin / Weight-based)                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Agent Cluster  │  │  Agent Cluster  │  │  Agent Cluster  │
│  #1 (Local)     │  │  #2 (Local)     │  │  #3 (Cloud)     │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ • session-      │  │ • session-      │  │ • complex-op-   │
│   balancer-1    │  │   balancer-2    │  │   agent-1       │
│ • 10 sessions  │  │ • 10 sessions  │  │ • 50 sessions  │
│ • qwen3.5:9b   │  │ • qwen3.5:9b   │  │ • glm-4.7:cloud │
│ • Fast queries │  │ • Fast queries │  │ • Complex ops  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Shared State    │
                    │  (Redis/Files)   │
                    │  • Memory        │
                    │  • Scammer DB    │
                    │  • Config        │
                    └──────────────────┘
```

**Capacity:** 70+ concurrent sessions

---

## Agent Types

### Tier 1: Query Routers (Local)
Handle high-volume simple queries with minimal latency.

**Agent: query-router-1, query-router-2, query-router-3**
- **Model:** qwen3.5:9b (local)
- **Sessions:** 10 each (30 total)
- **Purpose:** Fast responses to simple queries
- **Tools:** read, write, edit (no exec/process)
- **Response Time:** < 1 second
- **Use Cases:**
  - Status checks
  - Greetings
  - Basic Q&A
  - Quick text generation

### Tier 2: Specialized Agents (Local)
Handle specific tasks requiring tools or external access.

**Agent: telegram-manager**
- **Model:** qwen3.5:9b (local)
- **Sessions:** 10
- **Purpose:** Telegram group management
- **Tools:** sessions_send, sessions_list, memory_search, memory_get
- **Response Time:** < 2 seconds
- **Use Cases:**
  - Telegram message routing
  - Group moderation
  - Member management
  - Scheduled posts

**Agent: web-scraper**
- **Model:** qwen3.5:9b (local)
- **Sessions:** 10
- **Purpose:** Web scraping and data fetching
- **Tools:** web_fetch, web_search, read, write
- **Response Time:** < 3 seconds
- **Use Cases:**
  - X/Twitter profile scanning
  - Telegram channel scraping
  - Data extraction
  - Research tasks

**Agent: file-manager**
- **Model:** qwen3.5:9b (local)
- **Sessions:** 10
- **Purpose:** File operations and database updates
- **Tools:** read, write, edit, exec (limited)
- **Response Time:** < 2 seconds
- **Use Cases:**
  - Scammer database updates
  - Memory system updates
  - Report generation
  - Data exports

### Tier 3: Complex Operations (Cloud)
Handle reasoning-heavy tasks and multi-step operations.

**Agent: complex-op-agent-1, complex-op-agent-2**
- **Model:** glm-4.7:cloud
- **Sessions:** 25 each (50 total)
- **Purpose:** Complex reasoning and multi-step operations
- **Tools:** All tools (full access)
- **Response Time:** < 5 seconds
- **Use Cases:**
  - Scam detection analysis
  - Code generation
  - Multi-step investigations
  - Complex decision making

---

## Gateway Routing Configuration

### Load Balancer Middleware

```json
{
  "gateway": {
    "loadBalancer": {
      "enabled": true,
      "strategy": "weighted-round-robin",
      "agents": [
        {
          "id": "query-router-1",
          "weight": 30,
          "maxSessions": 10,
          "model": "ollama/qwen3.5:9b",
          "path": "~/.openclaw/agents/query-router-1/",
          "specialization": "simple-queries"
        },
        {
          "id": "query-router-2",
          "weight": 30,
          "maxSessions": 10,
          "model": "ollama/qwen3.5:9b",
          "path": "~/.openclaw/agents/query-router-2/",
          "specialization": "simple-queries"
        },
        {
          "id": "telegram-manager",
          "weight": 10,
          "maxSessions": 10,
          "model": "ollama/qwen3.5:9b",
          "path": "~/.openclaw/agents/telegram-manager/",
          "specialization": "telegram"
        },
        {
          "id": "web-scraper",
          "weight": 10,
          "maxSessions": 10,
          "model": "ollama/qwen3.5:9b",
          "path": "~/.openclaw/agents/web-scraper/",
          "specialization": "web-scraping"
        },
        {
          "id": "file-manager",
          "weight": 10,
          "maxSessions": 10,
          "model": "ollama/qwen3.5:9b",
          "path": "~/.openclaw/agents/file-manager/",
          "specialization": "file-operations"
        },
        {
          "id": "complex-op-agent-1",
          "weight": 5,
          "maxSessions": 25,
          "model": "ollama/glm-4.7:cloud",
          "path": "~/.openclaw/agents/complex-op-agent-1/",
          "specialization": "complex-operations"
        },
        {
          "id": "complex-op-agent-2",
          "weight": 5,
          "maxSessions": 25,
          "model": "ollama/glm-4.7:cloud",
          "path": "~/.openclaw/agents/complex-op-agent-2/",
          "specialization": "complex-operations"
        }
      ],
      "routingRules": [
        {
          "condition": "channel == 'telegram' and type == 'simple'",
          "target": ["query-router-1", "query-router-2"]
        },
        {
          "condition": "channel == 'telegram' and type == 'management'",
          "target": ["telegram-manager"]
        },
        {
          "condition": "operation == 'web_scrape'",
          "target": ["web-scraper"]
        },
        {
          "condition": "operation == 'file_operation'",
          "target": ["file-manager"]
        },
        {
          "condition": "complexity == 'high'",
          "target": ["complex-op-agent-1", "complex-op-agent-2"]
        },
        {
          "condition": "default",
          "target": ["query-router-1", "query-router-2"]
        }
      ]
    }
  }
}
```

### Channel-Specific Routing

```json
{
  "channels": {
    "telegram": {
      "routing": {
        "direct_chats": {
          "agent": ["query-router-1", "query-router-2"],
          "strategy": "round-robin"
        },
        "groups": {
          "-1003751594817": {
            "agent": ["telegram-manager", "query-router-1"],
            "strategy": "specialized"
          },
          "-5183433558": {
            "agent": ["query-router-2", "telegram-manager"],
            "strategy": "specialized"
          },
          "default": {
            "agent": ["query-router-1", "query-router-2"],
            "strategy": "round-robin"
          }
        }
      }
    }
  }
}
```

---

## Capacity Analysis

### Per-Agent Capacity

| Agent | Model | Sessions | Response Time | Throughput |
|-------|-------|----------|---------------|------------|
| query-router-1 | qwen3.5:9b | 10 | < 1s | 600/hour |
| query-router-2 | qwen3.5:9b | 10 | < 1s | 600/hour |
| telegram-manager | qwen3.5:9b | 10 | < 2s | 300/hour |
| web-scraper | qwen3.5:9b | 10 | < 3s | 200/hour |
| file-manager | qwen3.5:9b | 10 | < 2s | 300/hour |
| complex-op-agent-1 | glm-4.7:cloud | 25 | < 5s | 300/hour |
| complex-op-agent-2 | glm-4.7:cloud | 25 | < 5s | 300/hour |

**Total Capacity:**
- **Concurrent Sessions:** 100
- **Throughput:** 2,600 queries/hour
- **Daily Capacity:** 62,400 queries/day

### Load Distribution

```
Simple Queries (60%):
├─ query-router-1: 20%
├─ query-router-2: 20%
└─ Other agents: 20%

Telegram Management (15%):
└─ telegram-manager: 15%

Web Scraping (10%):
└─ web-scraper: 10%

File Operations (10%):
└─ file-manager: 10%

Complex Operations (5%):
├─ complex-op-agent-1: 2.5%
└─ complex-op-agent-2: 2.5%
```

---

## Shared State Management

### Memory System (File-Based)

```
memory/
├── AGENT_REGISTRY.md          # All agents
├── CONFIG_CHANGES.md          # Config history
├── SESSION_EVENTS.md          # Event log
├── 2026-03-27.md              # Daily log
└── SHARED_STATE.md            # Cross-agent state
```

### Shared Data

**Scammer Database:**
- Location: `/workspace/scammer-database.csv`
- Access: All agents (read/write)
- Conflict: File locking or last-write-wins

**Memory Logs:**
- Location: `/workspace/memory/`
- Access: All agents (read/write/append)
- Conflict: Append-only, no conflicts

**Agent State:**
- Location: `/workspace/agents-state.json`
- Access: All agents (read/write)
- Conflict: Write coordination needed

### Coordination Mechanisms

1. **File Locking:** For database updates
2. **Append-Only:** For memory logs
3. **Last-Write-Wins:** For agent state
4. **Agent Handshake:** For cross-agent delegation

---

## Agent Communication

### Inter-Agent Delegation

**Protocol:**
```typescript
// Agent A delegates to Agent B
await sessions_send({
  sessionKey: "agent:complex-op-agent-1",
  message: "Analyze this profile: @Crypto_Genius09",
  metadata: {
    delegatedBy: "query-router-1",
    originalSession: "telegram:2122311885",
    priority: "high"
  }
});
```

**Response:**
```typescript
// Agent B responds to Agent A
await sessions_send({
  sessionKey: "agent:query-router-1",
  message: "Analysis complete. Risk Score: 0/10 (LEGITIMATE)",
  metadata: {
    delegatedTo: "complex-op-agent-1",
    originalSession: "telegram:2122311885"
  }
});
```

### Session Handoff

**Scenario:** Simple query becomes complex

```
1. User sends query to query-router-1
2. Query router identifies complexity (needs web search)
3. Query router sends to web-scraper
4. Web scraper fetches data
5. Web scraper sends result to query-router-1
6. Query router sends final response to user
```

---

## Implementation Steps

### Phase 1: Create Additional Agents
1. Create query-router-1, query-router-2
2. Create telegram-manager
3. Create web-scraper
4. Create file-manager
5. Create complex-op-agent-1, complex-op-agent-2

### Phase 2: Configure Gateway
1. Add load balancer middleware to gateway config
2. Define routing rules
3. Configure channel-specific routing
4. Test agent selection

### Phase 3: Implement Delegation Protocol
1. Add sessions_send to all agents
2. Define handoff protocol
3. Test cross-agent communication
4. Handle delegation failures

### Phase 4: Shared State Management
1. Implement SHARED_STATE.md
2. Add file locking for database
3. Test concurrent access
4. Resolve conflicts

### Phase 5: Monitoring and Scaling
1. Add agent health monitoring
2. Track session distribution
3. Auto-scale based on load
4. Add alerting

---

## File Structure

```
~/.openclaw/
├── agents/
│   ├── query-router-1/
│   │   ├── agent/config.json
│   │   ├── agent/models.json
│   │   └── AGENT.md
│   ├── query-router-2/
│   │   ├── agent/config.json
│   │   ├── agent/models.json
│   │   └── AGENT.md
│   ├── telegram-manager/
│   │   ├── agent/config.json
│   │   ├── agent/models.json
│   │   └── AGENT.md
│   ├── web-scraper/
│   │   ├── agent/config.json
│   │   ├── agent/models.json
│   │   └── AGENT.md
│   ├── file-manager/
│   │   ├── agent/config.json
│   │   ├── agent/models.json
│   │   └── AGENT.md
│   ├── complex-op-agent-1/
│   │   ├── agent/config.json
│   │   ├── agent/models.json
│   │   └── AGENT.md
│   ├── complex-op-agent-2/
│   │   ├── agent/config.json
│   │   ├── agent/models.json
│   │   └── AGENT.md
│   └── session-balancer/
│       └── (existing)
├── openclaw.json
│   ├── gateway.loadBalancer (new)
│   └── channels.telegram.routing (new)
└── workspace/
    ├── memory/
    │   ├── AGENT_REGISTRY.md
    │   ├── CONFIG_CHANGES.md
    │   ├── SESSION_EVENTS.md
    │   ├── SHARED_STATE.md (new)
    │   └── 2026-03-27.md
    └── agents-state.json (new)
```

---

## Performance Comparison

### Single Agent (Current)
- **Concurrent Sessions:** 10
- **Throughput:** 12,000 queries/hour
- **Response Time:** < 2s (local), < 5s (delegated)
- **Scaling:** Fixed

### Multi-Agent (Proposed)
- **Concurrent Sessions:** 100
- **Throughput:** 62,400 queries/hour
- **Response Time:** < 1s (simple), < 5s (complex)
- **Scaling:** 10x improvement

---

## Cost Analysis

### Model Costs

**Local Models (qwen3.5:9b):**
- **Cost:** $0 (free, local inference)
- **Hardware:** 6.6 GB RAM per model
- **Instances:** 5 models × 6.6 GB = 33 GB RAM

**Cloud Models (glm-4.7:cloud):**
- **Cost:** $0 (current usage)
- **Instances:** 2 agents (delegated only)

**Total Cost:** $0/month (no additional cost)

### Resource Usage

**RAM:**
- Current: 6.6 GB (1 model)
- Proposed: 33 GB (5 models)
- Increase: +26.4 GB

**CPU:**
- Current: Moderate (1 model inference)
- Proposed: High (5 concurrent inferences)
- Increase: 5x CPU usage

---

## Scaling Path

### Level 1: Current (10 sessions)
```
1 session balancer (qwen3.5:9b)
→ 10 concurrent sessions
```

### Level 2: Medium (30 sessions)
```
3 query routers (qwen3.5:9b)
→ 30 concurrent sessions
```

### Level 3: High (70 sessions)
```
3 query routers + 4 specialized agents (qwen3.5:9b)
→ 70 concurrent sessions
```

### Level 4: Very High (100 sessions)
```
3 query routers + 4 specialized (qwen3.5:9b)
+ 2 complex agents (glm-4.7:cloud)
→ 100 concurrent sessions
```

### Level 5: Ultra High (200+ sessions)
```
Add more query routers (5-10)
Add more specialized agents
Consider GPU acceleration for local models
→ 200+ concurrent sessions
```

---

## Monitoring

### Metrics to Track

**Per-Agent Metrics:**
- Active session count
- Response time (p50, p95, p99)
- Throughput (queries/minute)
- Error rate
- Delegation rate

**System Metrics:**
- Total concurrent sessions
- Load distribution
- Queue length
- CPU usage per agent
- RAM usage per agent

**Cross-Agent Metrics:**
- Delegation success rate
- Handoff latency
- Shared state conflicts
- Agent-to-agent communication

---

## Failover and Recovery

### Agent Failure Handling

**Scenario:** query-router-1 crashes

1. **Detection:** Gateway detects agent unresponsive
2. **Failover:** Redirect sessions to query-router-2
3. **Recovery:** Restart query-router-1
4. **Restoration:** Gradually restore sessions

### Graceful Degradation

**Scenario:** High load on all agents

1. **Queue:** New sessions queued
2. **Prioritize:** High-priority sessions first
3. **Defer:** Low-priority tasks to later
4. **Alert:** Notify admin of capacity issues

---

## Next Steps

1. ✅ Create multi-agent architecture document
2. ⏳ Implement Phase 1: Create additional agents
3. ⏳ Implement Phase 2: Configure gateway routing
4. ⏳ Implement Phase 3: Implement delegation protocol
5. ⏳ Implement Phase 4: Shared state management
6. ⏳ Implement Phase 5: Monitoring and scaling

---

**Status:** Design complete, ready for implementation
**Capacity:** 10x improvement (10 → 100 concurrent sessions)
**Cost:** $0 additional (uses existing models)
**Time:** 4-6 hours to implement all phases