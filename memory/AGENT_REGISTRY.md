# Agent Registry

## Purpose
Track all agents created, configured, or modified across all sessions.

## Current Active Agents

### agentic-bro (main)
- **Created:** Initial agent (evolved from "main")
- **Purpose:** Main Agentic Bro agent for scam detection and community management
- **Model:** ollama/kimi-k2.6:cloud (primary) → glm-5.1:cloud → qwen3.5:4b fallback
- **Config Path:** `~/.openclaw/agents/agentic-bro/`
- **Status:** Active
- **Active Sessions:** Direct + group Telegram sessions
- **Routing:**
  - Simple tasks → qwen3.5:4b (local)
  - Coding tasks → qwen3-coder-next:cloud
  - Complex analysis → kimi-k2.6:cloud

## Legacy Agents (Inactive)

### session-balancer
- **Created:** 2026-03-27 18:50
- **Status:** Inactive (superseded by agentic-bro config)

### query-router-1 / query-router-2
- **Created:** 2026-03-27 21:04
- **Status:** Inactive (never activated)

### telegram-manager
- **Created:** 2026-03-27 21:04
- **Status:** Inactive (functions merged into agentic-bro)

### web-scraper
- **Created:** 2026-03-27 21:04
- **Status:** Inactive (functions in workspace scripts)

### file-manager
- **Created:** 2026-03-27 21:04
- **Status:** Inactive (functions merged into agentic-bro)

### complex-op-agent-1 / complex-op-agent-2
- **Created:** 2026-03-27 21:04
- **Status:** Inactive (cloud models now direct in config)

### acp-defaultagent / acp-python / codex / qwen3-coder-next
- **Status:** All inactive (0 sessions)

---

## Agent Registry Update Rules

When agent changes occur, update this file:
- New agent created
- Agent configuration updated (model, routing, etc.)
- Agent deleted or deprecated
- Agent status changes (active/inactive)

## Last Updated

2026-05-11 18:45 EDT - Reactivated cross-session awareness, updated to current single-agent architecture
