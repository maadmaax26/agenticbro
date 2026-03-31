# Gateway Load Balancer Configuration - Failed Attempt

## Date
2026-03-27 21:16 EDT

## Overview
Attempted to configure gateway load balancer for Level 4 multi-agent architecture, but discovered that OpenClaw 2026.3.23-2 does not support these features.

## Attempted Configuration

### Agent Routing (agents.defaults.routing)
```json
{
  "agents": {
    "defaults": {
      "routing": {
        "query-router-1": {
          "model": "ollama/qwen3.5:9b",
          "path": "~/.openclaw/agents/query-router-1/",
          "maxSessions": 10,
          "weight": 25,
          "specialization": "simple-queries"
        },
        // ... 6 more agents
      }
    }
  }
}
```

### Gateway Load Balancer (gateway.loadBalancer)
```json
{
  "gateway": {
    "loadBalancer": {
      "enabled": true,
      "strategy": "weighted-round-robin",
      "agents": [...],
      "routingRules": [...]
    }
  }
}
```

## Error Message

```
Config invalid
File: ~/.openclaw/openclaw.json
Problem:
  - agents.defaults: Unrecognized key: "routing"
  - gateway: Unrecognized key: "loadBalancer"
```

## Root Cause Analysis

**OpenClaw 2026.3.23-2 does NOT support:**
- `agents.defaults.routing` - Agent routing configuration
- `gateway.loadBalancer` - Gateway load balancer middleware
- `gateway.loadBalancer.routingRules` - Automatic routing rules

**What IS supported:**
- `agents.defaults.model` - Default model selection
- `agents.defaults.models` - Available models
- `gateway.port`, `gateway.mode`, `gateway.bind` - Basic gateway config
- `gateway.auth` - Authentication
- `gateway.tailscale` - Tailscale integration

## Alternatives for Multi-Agent Routing

### Option 1: Manual Agent Selection via sessions_send
```
When request comes in:
1. Determine which agent should handle it
2. Use sessions_send to route to specific agent
3. Agent responds back via sessions_send
```

**Pros:**
- Works with current OpenClaw version
- Full control over routing logic
- No need for configuration

**Cons:**
- Requires manual routing in main agent
- More complex to implement
- No automatic load balancing

### Option 2: Custom Hooks-Based Routing
```
Create OpenClaw hook:
1. Hook into incoming request
2. Analyze request content
3. Select appropriate agent
4. Route to agent via sessions_spawn/sessions_send
5. Return response
```

**Pros:**
- Works with current OpenClaw version
- Automatic routing
- Reusable routing logic

**Cons:**
- Requires hook development
- More complex setup
- May need gateway restart for changes

### Option 3: Upgrade OpenClaw Version
```
Check if newer version supports:
- agents.defaults.routing
- gateway.loadBalancer
- Automatic load balancing
```

**Pros:**
- Native support for multi-agent routing
- Less custom code
- Better performance

**Cons:**
- Upgrade may break existing setup
- Unclear if feature exists in newer versions
- Requires testing

### Option 4: Session-Level Agent Selection
```
User selects agent when starting session:
- Session type: "simple-query" → query-router-1/2
- Session type: "telegram" → telegram-manager
- Session type: "web-scrape" → web-scraper
- Session type: "complex" → complex-op-agent-1/2
```

**Pros:**
- Works with current OpenClaw version
- Predictable agent selection
- No routing logic needed

**Cons:**
- User must know which agent to use
- Less flexible
- No automatic load balancing

## Recommended Approach

### Immediate: Manual Routing in Main Agent

**Implementation:**

1. **Create routing function in main agent:**
```javascript
function routeRequest(request) {
  if (request.content.includes('@') && request.content.includes('x.com')) {
    return { agent: 'web-scraper', reason: 'X profile scan' };
  }
  if (request.channel === 'telegram' && request.chatType === 'group') {
    return { agent: 'telegram-manager', reason: 'Telegram group message' };
  }
  if (request.complexity === 'high') {
    return { agent: 'complex-op-agent-1', reason: 'Complex operation' };
  }
  // Default to query routers
  const router = Math.random() < 0.5 ? 'query-router-1' : 'query-router-2';
  return { agent: router, reason: 'Simple query' };
}
```

2. **Delegation in main agent:**
```javascript
const routing = routeRequest(request);
await sessions_send({
  sessionKey: `agent:${routing.agent}:main`,
  message: request.content,
  metadata: { originalSession: request.sessionKey, reason: routing.reason }
});
```

3. **Response handling:**
```javascript
// Agent responds back
await sessions_send({
  sessionKey: request.originalSession,
  message: response,
  metadata: { delegatedBy: routing.agent }
});
```

### Long-Term: Upgrade to OpenClaw with Load Balancer Support

1. **Check newer versions** for load balancer support
2. **Request feature** if not available
3. **Migrate configuration** when available
4. **Test thoroughly** before production use

## Status

**Load Balancer Configuration:** ❌ Failed (feature not supported)
**Alternative Routing:** ⏳ Not yet implemented
**Agent Creation:** ✅ Complete (7 agents ready)
**Current Limitation:** Gateway doesn't support automatic routing

## Next Steps

1. **Document current limitation** in memory
2. **Implement manual routing** in main agent
3. **Test routing logic** with simple requests
4. **Monitor performance** of manual routing
5. **Consider OpenClaw upgrade** for native routing support

## Lessons Learned

1. **Check feature support** before assuming configuration keys
2. **Validate configuration** before applying
3. **Have fallback plans** for unsupported features
4. **Document limitations** for future reference

---

**Created:** 2026-03-27 21:16 EDT
**Status:** Load balancer not supported, alternative routing needed
**Next Required:** Implement manual routing in main agent