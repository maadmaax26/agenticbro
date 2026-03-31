# Agent Registry

## Purpose
Track all agents created, configured, or modified across all sessions.

## Agents

### session-balancer
- **Created:** 2026-03-27 18:50
- **Created by:** Mac local session (user: Madmax)
- **Purpose:** Local qwen3.5:9b model for fast responses, delegates complex operations to main agent
- **Model:** qwen3.5:9b (local via ollama)
- **Delegates to:** glm-4.7:cloud (main agent)
- **Config Path:** `~/.openclaw/agents/session-balancer/`
- **Status:** Active
- **Performance Targets:**
  - Response Time: < 2 seconds for local queries
  - Max Concurrent Sessions: 10
  - Load Threshold: 70% before delegating
  - Context Window: 32,768 tokens
  - Max Tokens: 4,096 output

### main
- **Created:** Unknown (initial agent)
- **Purpose:** Main Agentic Bro agent for scam detection and community management
- **Model:** ollama/glm-4.7:cloud (default)
- **Config Path:** `~/.openclaw/agents/main/`
- **Status:** Active
- **Active Sessions:** 22 total (including subagents)

### acp-defaultagent
- **Created:** Unknown
- **Purpose:** Default ACP coding agent
- **Config Path:** `~/.openclaw/agents/acp-defaultagent/`
- **Status:** Inactive (0 sessions)

### acp-python
- **Created:** Unknown
- **Purpose:** Python coding specialist
- **Config Path:** `~/.openclaw/agents/acp-python/`
- **Status:** Inactive (0 sessions)

### codex
- **Created:** March 23, 2026
- **Purpose:** Coding agent
- **Config Path:** `~/.openclaw/agents/codex/`
- **Status:** Inactive (0 sessions)

### qwen3-coder-next
- **Created:** March 5, 2026
- **Purpose:** Qwen 3 coding specialist
- **Config Path:** `~/.openclaw/agents/qwen3-coder-next/`
- **Status:** Inactive (0 sessions)

---

## Agent Creation Guidelines

When creating a new agent, log it here with:
- **Created:** Date/time (ISO format)
- **Created by:** Session ID or user
- **Purpose:** What the agent does
- **Model:** Model used
- **Config Path:** Path to agent config
- **Status:** Active/Inactive
- **Additional Info:** Performance targets, routing rules, etc.

### query-router-1
- **Created:** 2026-03-27 21:04
- **Created by:** telegram:2122311885 (Jeeevs agent)
- **Purpose:** Fast responses to simple queries, route complex requests to specialized agents
- **Model:** qwen3.5:9b (local via ollama)
- **Config Path:** `~/.openclaw/agents/query-router-1/`
- **Status:** Created (not yet activated)
- **Performance Targets:**
  - Response Time: < 1 second for simple queries
  - Max Concurrent Sessions: 10
  - Load Threshold: 70% before delegating
  - Context Window: 32,768 tokens
  - Max Tokens: 4,096 output

### query-router-2
- **Created:** 2026-03-27 21:04
- **Created by:** telegram:2122311885 (Jeeevs agent)
- **Purpose:** Fast responses to simple queries, route complex requests to specialized agents
- **Model:** qwen3.5:9b (local via ollama)
- **Config Path:** `~/.openclaw/agents/query-router-2/`
- **Status:** Created (not yet activated)
- **Performance Targets:**
  - Response Time: < 1 second for simple queries
  - Max Concurrent Sessions: 10
  - Load Threshold: 70% before delegating
  - Context Window: 32,768 tokens
  - Max Tokens: 4,096 output

### telegram-manager
- **Created:** 2026-03-27 21:04
- **Created by:** telegram:2122311885 (Jeeevs agent)
- **Purpose:** Telegram group management, message scheduling, member interactions
- **Model:** qwen2.5:7b (local via ollama)
- **Config Path:** `~/.openclaw/agents/telegram-manager/`
- **Status:** Created (not yet activated)
- **Performance Targets:**
  - Response Time: < 2 seconds for Telegram posts
  - Max Concurrent Sessions: 10
  - Load Threshold: 70% before delegating
  - Context Window: 32,768 tokens
  - Max Tokens: 4,096 output

### web-scraper
- **Created:** 2026-03-27 21:04
- **Created by:** telegram:2122311885 (Jeeevs agent)
- **Purpose:** Hybrid web scraping (API + browser tab for X/Twitter)
- **Model:** qwen2.5:7b (local via ollama)
- **Config Path:** `~/.openclaw/agents/web-scraper/`
- **Status:** Created (not yet activated)
- **Tools:**
  - API: web_fetch, web_search
  - Browser: Chrome CDP (port 18800, 3 max tabs)
- **Performance Targets:**
  - API Scraping: < 1 second
  - Browser Scraping: < 3 seconds
  - Max Concurrent Sessions: 10
  - Load Threshold: 70% before delegating
  - Context Window: 32,768 tokens
  - Max Tokens: 4,096 output

### file-manager
- **Created:** 2026-03-27 21:04
- **Created by:** telegram:2122311885 (Jeeevs agent)
- **Purpose:** File operations, database updates, memory system updates
- **Model:** qwen2.5:7b (local via ollama)
- **Config Path:** `~/.openclaw/agents/file-manager/`
- **Status:** Created (not yet activated)
- **Key Files:**
  - scammer-database.csv
  - memory/ (AGENT_REGISTRY.md, CONFIG_CHANGES.md, SESSION_EVENTS.md)
  - output/ (scan reports)
- **Performance Targets:**
  - File operations: < 2 seconds
  - Max Concurrent Sessions: 10
  - Load Threshold: 70% before delegating
  - Context Window: 32,768 tokens
  - Max Tokens: 4,096 output

### complex-op-agent-1
- **Created:** 2026-03-27 21:04
- **Created by:** telegram:2122311885 (Jeeevs agent)
- **Purpose:** Complex reasoning, multi-step operations, scam detection analysis
- **Model:** glm-4.7:cloud (cloud via ollama)
- **Config Path:** `~/.openclaw/agents/complex-op-agent-1/`
- **Status:** Created (not yet activated)
- **Performance Targets:**
  - Complex reasoning: < 5 seconds
  - Scam analysis: < 10 seconds
  - Max Concurrent Sessions: 25
  - Load Threshold: 70% before delegating
  - Context Window: 200,000 tokens
  - Max Tokens: 8,192 output

### complex-op-agent-2
- **Created:** 2026-03-27 21:04
- **Created by:** telegram:2122311885 (Jeeevs agent)
- **Purpose:** Complex reasoning, multi-step operations, scam detection analysis (backup/failover)
- **Model:** glm-4.7:cloud (cloud via ollama)
- **Config Path:** `~/.openclaw/agents/complex-op-agent-2/`
- **Status:** Created (not yet activated)
- **Performance Targets:**
  - Complex reasoning: < 5 seconds
  - Scam analysis: < 10 seconds
  - Max Concurrent Sessions: 25
  - Load Threshold: 70% before delegating
  - Context Window: 200,000 tokens
  - Max Tokens: 8,192 output

---

## Multi-Agent Architecture (Level 4)

**Total Capacity:**
- **Concurrent Sessions:** 100 (70 local + 30 cloud)
- **RAM Usage:** 19.5 GB (optimized)
- **Models:** 5 local (2 × qwen3.5:9b + 3 × qwen2.5:7b) + 2 cloud (glm-4.7:cloud)

**Agent Distribution:**
- **Query Routers:** 2 agents × 10 sessions = 20 sessions (simple queries)
- **Telegram Manager:** 1 agent × 10 sessions = 10 sessions (Telegram management)
- **Web Scraper:** 1 agent × 10 sessions = 10 sessions (hybrid scraping)
- **File Manager:** 1 agent × 10 sessions = 10 sessions (file operations)
- **Complex Ops:** 2 agents × 25 sessions = 50 sessions (complex reasoning)
- **Session Balancer:** 1 agent × 10 sessions = 10 sessions (legacy)

---

## Last Updated

2026-03-27 21:04 EDT - Added 7 new agents (Level 4 multi-agent architecture)