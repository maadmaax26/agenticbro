# Multi-Agent Routing Implementation (Manual)

## Date
2026-03-27 21:26 EDT

## Overview
Implement manual routing in the main agent using sessions_send to delegate requests to specialized agents based on request analysis.

## Architecture

```
Incoming Request
       │
       ▼
┌──────────────────┐
│  Main Agent      │
│  (glm-4.7:cloud) │
└────────┬─────────┘
         │
    [Analyze Request]
         │
         ▼
┌─────────────────────────────────────┐
│  Routing Decision Tree              │
├─────────────────────────────────────┤
│  X/Twitter profile scan?           │
│  ├─ Yes → web-scraper             │
│  │    (browser tab for X profiles) │
│  │                                 │
│  Web scrape/search?                │
│  ├─ Yes → web-scraper             │
│  │    (API-based)                 │
│  │                                 │
│  Telegram group management?        │
│  ├─ Yes → telegram-manager        │
│  │                                 │
│  File/database operation?          │
│  ├─ Yes → file-manager            │
│  │                                 │
│  Complex reasoning?                │
│  ├─ Yes → complex-op-agent-1/2    │
│  │                                 │
│  Simple query?                     │
│  └─ Yes → query-router-1/2        │
└─────────────────────────────────────┘
         │
         ▼
   [Delegate via sessions_send]
         │
         ▼
┌─────────────────────────────────────┐
│  Specialized Agent                 │
└─────────────────────────────────────┘
         │
         ▼
   [Return result via sessions_send]
         │
         ▼
┌─────────────────────────────────────┐
│  Main Agent                         │
│  (format and return to user)       │
└─────────────────────────────────────┘
```

## Routing Decision Tree

### Step 1: Analyze Request Content

```javascript
function analyzeRequest(content, context) {
  const analysis = {
    complexity: 'simple',
    operation: null,
    target: null,
    urgency: 'normal'
  };

  // Check for X/Twitter profile scan
  if (content.includes('x.com/') || content.includes('twitter.com/') ||
      (content.startsWith('@') && content.includes('scan'))) {
    analysis.complexity = 'medium';
    analysis.operation = 'x_profile_scan';
    analysis.target = extractXHandle(content);
    return analysis;
  }

  // Check for Telegram channel scan
  if (content.includes('t.me/') || content.includes('telegram channel')) {
    analysis.complexity = 'medium';
    analysis.operation = 'telegram_channel_scan';
    analysis.target = extractTelegramChannel(content);
    return analysis;
  }

  // Check for web search
  if (content.toLowerCase().includes('search') ||
      content.toLowerCase().includes('find') ||
      content.toLowerCase().includes('look up')) {
    analysis.complexity = 'simple';
    analysis.operation = 'web_search';
    return analysis;
  }

  // Check for web fetch/scrape
  if (content.includes('http://') || content.includes('https://')) {
    analysis.complexity = 'simple';
    analysis.operation = 'web_scrape';
    return analysis;
  }

  // Check for Telegram group management
  if (context.channel === 'telegram' && context.chatType === 'group') {
    if (content.toLowerCase().includes('post') ||
        content.toLowerCase().includes('schedule') ||
        content.toLowerCase().includes('welcome')) {
      analysis.complexity = 'medium';
      analysis.operation = 'telegram_management';
      return analysis;
    }
  }

  // Check for file operations
  if (content.toLowerCase().includes('read') ||
      content.toLowerCase().includes('write') ||
      content.toLowerCase().includes('update') ||
      content.toLowerCase().includes('database')) {
    analysis.complexity = 'simple';
    analysis.operation = 'file_operation';
    return analysis;
  }

  // Check for complex reasoning
  if (content.toLowerCase().includes('analyze') ||
      content.toLowerCase().includes('investigate') ||
      content.toLowerCase().includes('complex') ||
      content.toLowerCase().includes('multi-step') ||
      content.toLowerCase().includes('generate code') ||
      content.toLowerCase().includes('debug')) {
    analysis.complexity = 'high';
    analysis.operation = 'complex_reasoning';
    return analysis;
  }

  // Default to simple query
  return analysis;
}
```

### Step 2: Select Target Agent

```javascript
function selectAgent(analysis) {
  switch (analysis.operation) {
    case 'x_profile_scan':
    case 'telegram_channel_scan':
    case 'web_scrape':
    case 'web_search':
      return {
        agent: 'web-scraper',
        sessionKey: 'agent:web-scraper:main',
        reason: `Web scraping (${analysis.operation})`
      };

    case 'telegram_management':
      return {
        agent: 'telegram-manager',
        sessionKey: 'agent:telegram-manager:main',
        reason: 'Telegram group management'
      };

    case 'file_operation':
      return {
        agent: 'file-manager',
        sessionKey: 'agent:file-manager:main',
        reason: 'File operations'
      };

    case 'complex_reasoning':
      // Load balance between two complex op agents
      const complexAgent = Math.random() < 0.5
        ? 'complex-op-agent-1'
        : 'complex-op-agent-2';
      return {
        agent: complexAgent,
        sessionKey: `agent:${complexAgent}:main`,
        reason: 'Complex reasoning'
      };

    default:
      // Load balance between two query routers
      const queryRouter = Math.random() < 0.5
        ? 'query-router-1'
        : 'query-router-2';
      return {
        agent: queryRouter,
        sessionKey: `agent:${queryRouter}:main`,
        reason: 'Simple query'
      };
  }
}
```

### Step 3: Delegate Request

```javascript
async function delegateRequest(analysis, agent, content, context) {
  // Prepare delegation message
  const delegationMessage = {
    type: 'delegation',
    originalContent: content,
    operation: analysis.operation,
    complexity: analysis.complexity,
    originalSession: context.sessionKey,
    originalChannel: context.channel,
    originalChatId: context.chatId,
    timestamp: new Date().toISOString(),
    metadata: {
      delegatedBy: 'main',
      reason: agent.reason,
      urgency: analysis.urgency
    }
  };

  // Send to target agent
  const result = await sessions_send({
    sessionKey: agent.sessionKey,
    message: JSON.stringify(delegationMessage),
    timeout: 30000 // 30 second timeout
  });

  return result;
}
```

### Step 4: Handle Response

```javascript
async function handleResponse(response, context) {
  // Parse response
  const parsedResponse = JSON.parse(response);

  // Check if response includes delegation metadata
  if (parsedResponse.metadata && parsedResponse.metadata.delegatedBy) {
    // Response came from delegated agent
    console.log(`Response from ${parsedResponse.metadata.delegatedBy}`);
  }

  // Format and return to user
  return {
    content: parsedResponse.content,
    metadata: {
      delegatedTo: parsedResponse.metadata.delegatedBy,
      processingTime: parsedResponse.metadata.processingTime,
      agent: parsedResponse.metadata.delegatedBy
    }
  };
}
```

## Integration with Main Agent

### Update Main Agent System Prompt

Add to main agent's AGENT.md or bootstrap context:

```
## Multi-Agent Routing

You are the main routing agent. When you receive a request:

1. **Analyze the request:**
   - Is it an X/Twitter profile scan? → Delegate to web-scraper
   - Is it a Telegram channel scan? → Delegate to web-scraper
   - Is it web search/scraping? → Delegate to web-scraper
   - Is it Telegram group management? → Delegate to telegram-manager
   - Is it a file/database operation? → Delegate to file-manager
   - Is it complex reasoning? → Delegate to complex-op-agent-1/2
   - Is it a simple query? → Delegate to query-router-1/2

2. **Select target agent:**
   - Use the routing decision tree above
   - Load balance between agent pairs (query-router-1/2, complex-op-agent-1/2)
   - Check agent availability (if known)

3. **Delegate request:**
   - Use sessions_send to route to target agent
   - Include original session context in metadata
   - Set appropriate timeout (30 seconds default)

4. **Handle response:**
   - Receive response from delegated agent
   - Format appropriately for user
   - Include attribution (handled by X agent)
   - Return to original session

## Delegation Protocol

Use sessions_send with this format:
```json
{
  "sessionKey": "agent:[agent-name]:main",
  "message": "Request content or delegation object",
  "timeout": 30000,
  "metadata": {
    "delegatedBy": "main",
    "originalSession": "agent:main:telegram:direct:2122311885",
    "reason": "Web scraping request"
  }
}
```

## Example Workflows

### Example 1: X Profile Scan

**User Request:** "Scan @Crypto_Genius09"

**Main Agent:**
1. Analyzes: X handle detected → operation='x_profile_scan'
2. Selects: web-scraper (sessionKey: 'agent:web-scraper:main')
3. Delegates:
```json
{
  "sessionKey": "agent:web-scraper:main",
  "message": "Scan X profile @Crypto_Genius09",
  "metadata": {
    "delegatedBy": "main",
    "originalSession": "agent:main:telegram:direct:2122311885",
    "operation": "x_profile_scan",
    "target": "@Crypto_Genius09"
  }
}
```

**Web Scraper Agent:**
1. Receives delegation
2. Opens browser tab
3. Navigates to https://x.com/Crypto_Genius09
4. Extracts data
5. Generates risk report
6. Responds back to main agent

**Main Agent:**
1. Receives response
2. Formats for user
3. Returns result

### Example 2: Simple Query

**User Request:** "What's the time?"

**Main Agent:**
1. Analyzes: Simple query → complexity='simple'
2. Selects: query-router-1 (sessionKey: 'agent:query-router-1:main')
3. Delegates:
```json
{
  "sessionKey": "agent:query-router-1:main",
  "message": "What's the time?",
  "metadata": {
    "delegatedBy": "main",
    "originalSession": "agent:main:telegram:direct:2122311885",
    "operation": "simple_query"
  }
}
```

**Query Router Agent:**
1. Receives delegation
2. Gets current time
3. Responds back to main agent

**Main Agent:**
1. Receives response
2. Returns to user

### Example 3: Complex Investigation

**User Request:** "Investigate this scam: VIP tier structure with guaranteed returns and urgency tactics"

**Main Agent:**
1. Analyzes: Complex reasoning → complexity='high', operation='complex_reasoning'
2. Selects: complex-op-agent-1 (sessionKey: 'agent:complex-op-agent-1:main')
3. Delegates:
```json
{
  "sessionKey": "agent:complex-op-agent-1:main",
  "message": "Investigate this scam: VIP tier structure with guaranteed returns and urgency tactics",
  "metadata": {
    "delegatedBy": "main",
    "originalSession": "agent:main:telegram:direct:2122311885",
    "operation": "complex_reasoning",
    "complexity": "high"
  }
}
```

**Complex Op Agent:**
1. Receives delegation
2. Analyzes scam patterns
3. May delegate to web-scraper for X profile scan
4. May delegate to file-manager to update database
5. Generates comprehensive investigation report
6. Responds back to main agent

**Main Agent:**
1. Receives response
2. Formats for user
3. Returns result

## Agent Session Keys

| Agent | Session Key |
|-------|-------------|
| query-router-1 | agent:query-router-1:main |
| query-router-2 | agent:query-router-2:main |
| telegram-manager | agent:telegram-manager:main |
| web-scraper | agent:web-scraper:main |
| file-manager | agent:file-manager:main |
| complex-op-agent-1 | agent:complex-op-agent-1:main |
| complex-op-agent-2 | agent:complex-op-agent-2:main |

## Error Handling

### Agent Not Available
If delegated agent is not available or fails:
1. Retry with alternative agent (e.g., query-router-2 if query-router-1 fails)
2. Fall back to main agent for processing
3. Log error for investigation

### Timeout
If delegation times out (30 seconds):
1. Return partial results if available
2. Inform user of delay
3. Continue processing in background

### Delegation Failure
If delegation fails completely:
1. Log detailed error
2. Attempt to process locally
3. Inform user of issue

## Load Balancing

### Query Routers
```javascript
// Round-robin between query-router-1 and query-router-2
const queryRouters = [
  'agent:query-router-1:main',
  'agent:query-router-2:main'
];
const selectedRouter = queryRouters[Math.floor(Math.random() * queryRouters.length)];
```

### Complex Op Agents
```javascript
// Round-robin between complex-op-agent-1 and complex-op-agent-2
const complexAgents = [
  'agent:complex-op-agent-1:main',
  'agent:complex-op-agent-2:main'
];
const selectedAgent = complexAgents[Math.floor(Math.random() * complexAgents.length)];
```

## Performance Monitoring

Track:
- Delegation success rate
- Response times per agent
- Load distribution across agents
- Error rates per agent
- Timeout frequency

## Next Steps

1. ✅ Create routing implementation guide
2. ⏳ Update main agent's AGENT.md with routing instructions
3. ⏳ Test routing with sample requests
4. ⏳ Monitor delegation performance
5. ⏳ Optimize routing based on metrics

---

**Created:** 2026-03-27 21:26 EDT
**Status:** Implementation guide complete, ready for testing
**Approach:** Manual routing via sessions_send delegation