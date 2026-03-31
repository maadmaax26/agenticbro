# Multi-Agent Optimization Plan

**Goal:** Maximize concurrent sessions with fast response times for Telegram

**Hardware:** Mac Mini, 36GB unified memory

---

## Current Issues

1. **Missing Model:** `qwen2.5:7b` not installed (referenced by 3 agents)
2. **Memory Pressure:** Too many local models loaded = fewer concurrent sessions
3. **Cloud Dependency:** Agents using cloud models have latency + cost

---

## Available Models

### Local Models (Fast, No Cost)

| Model | Size | Context | Speed | Status |
|-------|------|---------|-------|--------|
| qwen3.5:9b | 6.6 GB | 262K | Fast | ✅ Installed |
| qwen3-coder:30b | 18 GB | - | Medium | ✅ Installed |
| qwen3.5:27b | 17 GB | - | Medium | ✅ Installed |
| glm-4.7-flash | ~19 GB | 32K | Fast | ⏳ Downloading |

### Cloud Models (High Intelligence, Latency)

| Model | Context | Intelligence | Status |
|-------|---------|--------------|--------|
| glm-5:cloud | 128K | Very High | ✅ Available |
| glm-4.7:cloud | - | High | ✅ Available |
| deepseek-v3.2:cloud | 163K | Very High | ✅ Available |

---

## Optimized Architecture

### Memory Budget (36 GB)

| Allocation | Amount | Purpose |
|------------|--------|---------|
| OS + System | 8 GB | Reserved |
| **Available for Models** | 28 GB | Maximum usable |
| Per qwen3.5:9b instance | ~5 GB | 6.6 GB model + KV cache |
| **Max concurrent local sessions** | ~5 | 28 GB ÷ 5 GB |

### Strategy: Model Tiering

**Tier 1: Ultra-Fast Local (qwen3.5:9b)**
- Agenticbro (Telegram groups) - NEEDS FASTEST
- Query routers - Simple queries
- Session balancer - Routing logic

**Tier 2: Fast Local (glm-4.7-flash when ready)**
- Agenticbro (when glm-4.7-flash finishes downloading)
- Complex ops (when available)

**Tier 3: Cloud (High Intelligence)**
- Main agent - Complex investigations
- Fallback for Tier 1/2 overload

---

## Optimized Agent Assignments

### Telegram-Facing Agents (NEED FASTEST)

| Agent | Current | Optimized | Reason |
|-------|---------|----------|--------|
| **agenticbro** | glm-4.7:cloud | **qwen3.5:9b** (local) | Telegram needs <2s response |
| **telegram-manager** | qwen2.5:7b ❌ | **qwen3.5:9b** (local) | Telegram groups need speed |

### Internal Agents

| Agent | Current | Optimized | Reason |
|-------|---------|----------|--------|
| **query-router-1** | qwen3.5:9b ✅ | **qwen3.5:9b** | Keep |
| **query-router-2** | qwen3.5:9b ✅ | **qwen3.5:9b** | Keep |
| **session-balancer** | qwen3.5:9b ✅ | **qwen3.5:9b** | Keep |
| **web-scraper** | qwen2.5:7b ❌ | **qwen3.5:9b** (local) | Web scraping needs speed |
| **file-manager** | qwen2.5:7b ❌ | **qwen3.5:9b** (local) | File ops need speed |
| **complex-op-agent-1** | glm-4.7:cloud | **glm-4.7:cloud** | Keep (complex tasks) |
| **complex-op-agent-2** | glm-4.7:cloud | **glm-4.7:cloud** | Keep (complex tasks) |
| **main** | (default) | **glm-5:cloud** | Complex investigations |

---

## Maximum Concurrent Sessions

### With Current Config (Issues)

| Scenario | Local Models | Cloud Models | Total Sessions |
|----------|--------------|--------------|----------------|
| All agents active | ~0 (qwen2.5:7b missing) | 8 | 8 (cloud only) |

### With Optimized Config

| Scenario | Local Models | Cloud Models | Total Sessions |
|----------|--------------|--------------|----------------|
| Light load | 5 (qwen3.5:9b) | 3 (cloud) | 8 |
| Medium load | 4 (qwen3.5:9b) | 4 (cloud) | 8 |
| Heavy load | 2 (qwen3.5:9b) | 6 (cloud) | 8 |

### Session Types

| Type | Agent | Model | Max Concurrent |
|------|-------|-------|----------------|
| Telegram groups | agenticbro | qwen3.5:9b | 10 (config limit) |
| Simple queries | query-router-1/2 | qwen3.5:9b | 20 (10 each) |
| Web scraping | web-scraper | qwen3.5:9b | 10 |
| File ops | file-manager | qwen3.5:9b | 10 |
| Complex tasks | complex-op-1/2 | glm-4.7:cloud | 50 (25 each) |
| Deep analysis | main | glm-5:cloud | Unlimited |

---

## Response Time Targets

### Optimized Targets

| Agent | Current | Optimized | Improvement |
|-------|---------|-----------|-------------|
| agenticbro | 2-5s (cloud) | <1s (local) | **5x faster** |
| telegram-manager | N/A (broken) | <1s (local) | **Fixed** |
| query-router-1 | <1s ✅ | <1s | Keep |
| query-router-2 | <1s ✅ | <1s | Keep |
| web-scraper | N/A (broken) | <2s (local) | **Fixed** |
| file-manager | N/A (broken) | <1s (local) | **Fixed** |

---

## Migration Steps

### Step 1: Update All Local Agents to qwen3.5:9b

**Files to update:**
- `~/.openclaw/agents/agenticbro/agent/config.json`
- `~/.openclaw/agents/telegram-manager/agent/config.json`
- `~/.openclaw/agents/web-scraper/agent/config.json`
- `~/.openclaw/agents/file-manager/agent/config.json`

**Change:**
```json
"model": "ollama/qwen3.5:9b"
```

### Step 2: Keep Cloud Agents

**No changes needed:**
- `complex-op-agent-1` (glm-4.7:cloud)
- `complex-op-agent-2` (glm-4.7:cloud)
- `main` (glm-5:cloud via default)

### Step 3: Set Session Limits

**Update agent configs:**
```json
"sessionLoadBalancer": {
  "enabled": true,
  "maxConcurrentSessions": 10,
  "loadThreshold": 0.8,
  "delegationAgent": "agent:main:main"
}
```

### Step 4: Configure Delegation Chain

**Fast path:**
```
Telegram → agenticbro (qwen3.5:9b, local)
  ├─ Simple query → Handle locally (<1s)
  ├─ X/Twitter scan → Delegate to web-scraper (qwen3.5:9b, local, <2s)
  └─ Complex analysis → Delegate to main (glm-5:cloud, <15s)
```

---

## When glm-4.7-flash Downloads

### Option A: Replace agenticbro model

```json
// ~/.openclaw/agents/agenticbro/agent/config.json
"model": "ollama/glm-4.7-flash"
```

**Trade-off:**
- Better intelligence (30B MoE)
- Slightly slower than qwen3.5:9b
- More memory (~10 GB vs ~5 GB)

### Option B: Create dedicated local pool

**Memory allocation:**
- 10 GB for glm-4.7-flash (agenticbro)
- 15 GB for qwen3.5:9b (other agents, ~3 instances)
- 3 GB headroom

**Max sessions:** ~4 local + unlimited cloud

---

## Recommendations

### Immediate (Now)

1. ✅ Update all broken agents to `qwen3.5:9b`
2. ✅ Keep complex-op agents on `glm-4.7:cloud`
3. ✅ Restart gateway
4. ✅ Test Telegram routing

### When glm-4.7-flash Finishes

1. Test performance on Mac Mini (36 GB)
2. If <35 tok/s: Keep agenticbro on qwen3.5:9b
3. If >35 tok/s: Switch agenticbro to glm-4.7-flash

### Future Optimization

1. Monitor actual session load
2. Adjust maxConcurrentSessions based on usage
3. Consider dedicated Telegram pool if needed

---

## Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Working local agents | 3 (qwen3.5:9b only) | 7 | +133% |
| Telegram response time | 2-5s (cloud) | <1s (local) | 5x faster |
| Max concurrent local sessions | 3 | 5 | +67% |
| Cost per session | Cloud $$ | Local $0 | 100% savings |
| Broken agents | 3 | 0 | Fixed |

---

**Created:** March 28, 2026
**Status:** Ready to implement
**Priority:** High (fixes broken agents + improves Telegram speed)