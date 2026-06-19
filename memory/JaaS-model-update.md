# JaaS Model Routing Update

## Change Date: 2026-06-11

## New Architecture

**JaaS Groups (Local — FREE):**
- Model: `ollama/granite4.1:3b`
- Groups: Agentic Bro (-1003751594817), Scam Scans (-1003967263388)
- Purpose: Community engagement only
- Cost: $0 (local model)

**Scam Detection:**
- All scans handled by website (agenticbro.app)
- NOT performed by bot in groups
- Users directed to website for scans

**Admin/DM (Cloud):**
- Model: `ollama/glm-5:cloud`
- Purpose: Complex reasoning, coding, investigations
- Fallbacks: glm-5.1:cloud → kimi-k2.6:cloud → qwen3-coder-next:cloud

---

## Updated Cron Jobs

| Job | Model | Purpose |
|-----|-------|---------|
| jaas-agentic-bro | granite4.1:3b | Community engagement |
| jaas-scam-scans | granite4.1:3b | Community engagement |

---

## Session Models

| Session | Model | Pinned |
|---------|-------|--------|
| Agentic Bro group | granite4.1:3b | ✅ |
| Scam Scans group | granite4.1:3b | ✅ |
| Admin DM | glm-5:cloud | Default |

---

**Cost savings: $0 for JaaS group interactions. 🔐**