# Memory System Enhancement

## Purpose
Automatically update shared memory files across all sessions to maintain cross-session awareness of agent state, configuration changes, and important decisions.

## Problem Statement
- Each session is isolated
- No visibility into changes made in other sessions
- Agents create/configure other agents without tracking
- No shared state for critical decisions
- Lost context when switching sessions

## Solution Architecture

### File-Based Memory System
```
memory/
├── 2026-03-27.md              # Daily memory log
├── AGENT_REGISTRY.md          # All agents created/configured
├── CONFIG_CHANGES.md          # Configuration modifications
├── SESSION_EVENTS.md          # Cross-session event log
├── DECISIONS.md               # Important decisions
└── MEMORY.md                  # Main memory (summary of all)
```

### Components

#### 1. Agent Registry (memory/AGENT_REGISTRY.md)
Track all agents created, configured, or modified:
```markdown
## Agent Registry

### session-balancer
- Created: 2026-03-27 18:50
- Created by: Mac session (user: Madmax)
- Purpose: Local qwen3.5:9b model for fast responses
- Model: qwen3.5:9b (local)
- Delegates to: glm-4.7:cloud
- Config: ~/.openclaw/agents/session-balancer/
- Status: Active
```

#### 2. Configuration Changes (memory/CONFIG_CHANGES.md)
Track all configuration modifications:
```markdown
## Configuration Changes

### 2026-03-27 13:15 - Model Switch
- Changed from: ollama/glm-4.7:cloud
- Changed to: ollama-pro/deepseek-v3.2
- Reason: Performance optimization attempt
- Changed by: Jeeevs agent (telegram session)

### 2026-03-27 13:30 - Model Revert
- Changed from: ollama-pro/deepseek-v3.2
- Changed to: ollama/glm-4.7:cloud
- Reason: User request
- Changed by: Jeeevs agent (telegram session)
```

#### 3. Session Events (memory/SESSION_EVENTS.md)
Log important cross-session events:
```markdown
## Session Events

### 2026-03-27 18:50 - Agent Created
- Agent: session-balancer
- Session: Mac local session
- Event: Created new agent with qwen3.5:9b model
- Impact: Improved response times for simple queries
```

#### 4. Daily Memory Log (memory/YYYY-MM-DD.md)
Append daily activities:
```markdown
## 2026-03-27

### Agent Management
- Created session-balancer agent (18:50)
- Configured to use qwen3.5:9b locally

### Configuration Changes
- Model switched to ollama-pro/deepseek-v3.2 (13:15)
- Model reverted to ollama/glm-4.7:cloud (13:30)
- Gateway restarted (13:31)
```

### Implementation via OpenClaw Hooks

Modify `openclaw.json` to add hooks:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "boot-md": { "enabled": true },
        "session-memory": { "enabled": true },
        "memory-sync": { "enabled": true }
      }
    }
  }
}
```

### Custom Hook Script
Create `/Users/efinney/.openclaw/extensions/memory-sync/index.ts`:

```typescript
import { HookContext, Log } from 'openclaw';

export async function onAgentCreated(ctx: HookContext) {
  const agentInfo = {
    name: ctx.agent?.name,
    created: new Date().toISOString(),
    session: ctx.sessionKey,
    model: ctx.agent?.model
  };
  
  await updateAgentRegistry(agentInfo);
  await logSessionEvent('agent-created', agentInfo);
}

export async function onConfigChanged(ctx: HookContext) {
  const configInfo = {
    timestamp: new Date().toISOString(),
    session: ctx.sessionKey,
    changes: ctx.changes
  };
  
  await logConfigChange(configInfo);
}

export async function onSessionStart(ctx: HookContext) {
  await logSessionEvent('session-start', {
    session: ctx.sessionKey,
    timestamp: new Date().toISOString()
  });
}
```

### Manual Memory Update Functions

Create helper functions for manual memory updates:

#### Function: Log Agent Creation
```typescript
async function logAgentCreation(agentName: string, details: any) {
  const registryPath = '/Users/efinney/.openclaw/workspace/memory/AGENT_REGISTRY.md';
  const entry = `
### ${agentName}
- Created: ${new Date().toISOString()}
- Created by: ${details.session}
- Purpose: ${details.purpose}
- Model: ${details.model}
- Config: ${details.configPath}
- Status: Active
`;
  await appendToFile(registryPath, entry);
}
```

#### Function: Log Config Change
```typescript
async function logConfigChange(from: string, to: string, reason: string) {
  const configPath = '/Users/efinney/.openclaw/workspace/memory/CONFIG_CHANGES.md';
  const entry = `
### ${new Date().toISOString()} - ${from} → ${to}
- From: ${from}
- To: ${to}
- Reason: ${reason}
- Changed by: ${process.env.SESSION_KEY}
`;
  await appendToFile(configPath, entry);
}
```

#### Function: Log Session Event
```typescript
async function logSessionEvent(eventType: string, details: any) {
  const eventsPath = '/Users/efinney/.openclaw/workspace/memory/SESSION_EVENTS.md';
  const entry = `
### ${new Date().toISOString()} - ${eventType}
- Session: ${details.session}
- Event: ${eventType}
- Details: ${JSON.stringify(details, null, 2)}
`;
  await appendToFile(eventsPath, entry);
}
```

#### Function: Update Daily Memory
```typescript
async function updateDailyMemory(category: string, content: string) {
  const today = new Date().toISOString().split('T')[0];
  const memoryPath = `/Users/efinney/.openclaw/workspace/memory/${today}.md`;
  const entry = `
### ${category}
- ${content}
- Timestamp: ${new Date().toISOString()}
`;
  await appendToFile(memoryPath, entry);
}
```

## Usage

### When Creating an Agent
```typescript
await logAgentCreation('new-agent', {
  session: 'agent:main:telegram:direct:2122311885',
  purpose: 'Handle X profile scanning',
  model: 'qwen3.5:9b',
  configPath: '~/.openclaw/agents/new-agent/'
});
```

### When Changing Configuration
```typescript
await logConfigChange(
  'ollama/glm-4.7:cloud',
  'ollama-pro/deepseek-v3.2',
  'Performance optimization'
);
```

### When Making Important Decision
```typescript
await logDecision('Model Switch', {
  from: 'glm-4.7:cloud',
  to: 'deepseek-v3.2',
  reason: 'Reduce latency',
  impact: 'May improve response times',
  session: 'agent:main:telegram:direct:2122311885'
});
```

## Cross-Session Querying

### Check Agent Registry
```typescript
const registry = await readFile('/workspace/memory/AGENT_REGISTRY.md');
const agents = parseAgentRegistry(registry);
```

### Check Recent Config Changes
```typescript
const changes = await readFile('/workspace/memory/CONFIG_CHANGES.md');
const recentChanges = parseConfigChanges(changes);
```

### Get Today's Memory
```typescript
const today = new Date().toISOString().split('T')[0];
const memory = await readFile(`/workspace/memory/${today}.md`);
```

## Benefits

1. **Visibility:** All sessions can see what happened in other sessions
2. **Audit Trail:** Track all agent creation, config changes, and decisions
3. **Context Preservation:** No lost context when switching sessions
4. **Debugging:** Easy to see what changed and why
5. **Collaboration:** Multiple agents/sessions can share state via files

## Implementation Steps

### Phase 1: File Structure
1. Create memory/ directory structure
2. Initialize AGENT_REGISTRY.md, CONFIG_CHANGES.md, SESSION_EVENTS.md
3. Update existing MEMORY.md with summary

### Phase 2: Manual Logging
1. Implement helper functions in scripts/memory-sync.js
2. Update AGENTS.md with memory logging guidelines
3. Train agents to log actions to memory

### Phase 3: Automated Hooks
1. Create memory-sync OpenClaw extension
2. Register hooks in openclaw.json
3. Test automatic logging

### Phase 4: Cross-Session Awareness
1. Update SOUL.md to encourage memory checks
2. Add memory_search to routine queries
3. Implement periodic memory consolidation

## Next Steps

1. ✅ Create memory system enhancement document
2. ⏳ Initialize memory file structure
3. ⏳ Create helper scripts for memory logging
4. ⏳ Update AGENTS.md with memory guidelines
5. ⏳ Test manual memory logging
6. ⏳ Implement automated hooks

## Status

**Current State:** Document created, ready for implementation
**Priority:** High - Critical for cross-session visibility
**Estimated Time:** 2-3 hours to implement all phases