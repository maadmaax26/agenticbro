# Configuration Changes

## Purpose
Track all configuration changes across sessions for audit and rollback.

## Recent Changes

### 2026-05-11 18:28 - Nightly Review Cron Updated
- **Changed by:** Jeeevs agent (user: Madmax request)
- **Type:** Cron Job Update
- **Details:**
  - Model: kimi-k2.6:cloud → qwen3.5:9b
  - Timeout: 300s → 180s
  - Delivery: none → announce to 2122311885
  - Added: Trim rules, archive compression, cross-session awareness
- **Reason:** Improve speed, add delivery, automate maintenance
- **Status:** Successful

### 2026-05-11 - Coding Model Added
- **Changed by:** Jeeevs agent (user: Madmax request)
- **Type:** Model Routing
- **Details:**
  - Added qwen3-coder-next:cloud to failover order
  - Position: #2 (after qwen3.5:4b, before kimi-k2.6:cloud)
- **Reason:** Dedicated coding model for code tasks
- **Status:** Successful

### 2026-05-11 - Reasoning Disabled
- **Changed by:** Jeeevs agent (user: Madmax request)
- **Type:** Runtime Config
- **Details:**
  - Reasoning: ON → OFF
- **Reason:** Improve response time
- **Status:** Successful

### 2026-05-11 18:19 - Cross-Session Awareness Reactivated
- **Changed by:** Jeeevs agent (user: Madmax request)
- **Type:** System Improvement
- **Details:**
  - Recreated AGENT_REGISTRY.md
  - Reactivated SESSION_EVENTS.md
  - Created CONFIG_CHANGES.md (this file)
  - Integrated into nightly review
- **Reason:** Restore cross-session visibility
- **Status:** Successful

## Change Types

- **Model Routing** - Failover order, model assignment
- **Cron Job** - Schedule, payload, delivery updates
- **Runtime Config** - Reasoning, execution mode
- **System Improvement** - Memory system, automation
- **Channel Config** - Telegram, group settings

## Rollback Notes

If issues occur, check SESSION_EVENTS.md for context and revert changes using cron update or config edits.

## Last Updated

2026-05-11 18:28 EDT - Created configuration changes log
