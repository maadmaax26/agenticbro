# Model Handoff Plan

**Created:** 2026-05-10  
**Primary Model:** `ollama/kimi-k2.6:cloud`  
**Fallbacks:** `ollama/glm-5.1:cloud` → `ollama/qwen3.5:9b`

---

## Current Model Stack

| Role | Model | Use Case |
|------|-------|----------|
| Primary | kimi-k2.6:cloud | All conversations, group chat, DMs |
| Fallback #1 | glm-5.1:cloud | Complex analysis, when primary times out |
| Fallback #2 | qwen3.5:9b | Local, cron jobs, heartbeat, lightweight tasks |
| Cron Jobs | qwen3.5:9b | All scheduled posts and scans |
| Nightly Review | glm-5.1:cloud | Complex analysis needs bigger model |

## Model Capabilities

### kimi-k2.6:cloud (Primary)
- **Strengths:** Strong reasoning, good at conversation, multilingual support
- **Context:** 202k tokens
- **Cost:** Free (Ollama cloud routing)
- **Notes:** Cloud-hosted via Ollama, may have latency spikes

### glm-5.1:cloud (Fallback #1)
- **Strengths:** Complex analysis, longer reasoning chains
- **Context:** 202k tokens
- **Cost:** Free
- **Known Issues:** Occasional "stream ended without a final response" errors

### qwen3.5:9b (Fallback #2 / Local)
- **Strengths:** Fast, reliable for simple tasks, always available
- **Context:** 262k tokens
- **Cost:** Free (local)
- **Size:** ~20GB VRAM
- **Notes:** Currently loaded on GPU

## Handoff Behavior

When primary model fails:
1. System automatically falls back to `glm-5.1:cloud`
2. Context is preserved across handoff
3. No user notification (seamless)
4. If both fail, falls back to local `qwen3.5:9b`

## Configuration Files

| File | Setting |
|------|---------|
| `openclaw.json` → `agents.defaults.model.primary` | `ollama/kimi-k2.6:cloud` |
| `agentic-bro/agent/config.json` → `agent.model` | `ollama/kimi-k2.6:cloud` |
| `agentic-bro/agent/config.json` → `agent.fallbacks` | `["ollama/glm-5.1:cloud", "ollama/qwen3.5:9b"]` |
| `agentic-bro/agent/routing.json` | Group chat model overrides |

## Model Switch Procedure

To change primary model:
1. Update `agent.model` in `config.json`
2. Update `agents.defaults.model.primary` in `openclaw.json`
3. Update cron jobs that specify explicit models (use `cron update`)
4. Restart gateway: `openclaw gateway restart`
5. Test with a DM to the bot

## Retired Models

| Model | Removed | Reason |
|-------|---------|--------|
| granite4:3b | 2026-05-09 | Removed from Ollama |
| ministral-3:latest | 2026-05-09 | No longer installed |