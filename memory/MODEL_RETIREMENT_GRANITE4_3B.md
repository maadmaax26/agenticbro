# Model Retirement: granite4:3b — Handoff Plan

**Created:** April 16, 2026, 7:54 PM EDT
**Status:** RETIRED — granite4:3b removed from all roles AND deleted from Ollama (May 9, 2026)

---

## Retired Model

| Property | Value |
|---|---|
| Model | `ollama/granite4:3b` |
| Size | 2.1 GB |
| Roles Retired | Cron job runner, Local router, Main agent fallback |
| Reason | Slow inference, VRAM conflicts with coding model, timeouts on cron jobs |

## Replacement Mapping

| Role | Previous Model | New Model | Notes |
|---|---|---|---|
| Cron jobs (all 15) | `ollama/granite4:3b` | `ollama/ministral-3:latest` | Updated April 16, 2026 |
| Local router agent | `ollama/granite4:3b` | `ollama/ministral-3:latest` | Updated in agent config |
| Main agent (openclaw.json) | `ollama/granite4:3b` | `ollama/glm-5.1:cloud` | Primary model in defaults |
| Agentic Bro group agent | `ollama/qwen3.5:2b` (was `granite4:3b`) | `ollama/qwen3.5:2b` | Unchanged, already switched |

## Model Inventory (Post-Cleanup, May 9, 2026)

| Model | Size | Role | Status |
|---|---|---|---|
| `ollama/qwen3.5:9b` | 6.6 GB | Cron jobs + local fallback | ✅ Active (in VRAM) |
| `ollama/glm-5.1:cloud` | Cloud | Primary — all sessions + nightly review | ✅ Active |
| `ollama/kimi-k2.6:cloud` | Cloud | Agent fallback #1 | ✅ Available |
| `ollama/glm-5:cloud` | Cloud | Config default fallback | ✅ Available |
| `ollama/glm-4.7:cloud` | Cloud | Available (not in chain) | ✅ Available |
| `ollama/qwen3.5:cloud` | Cloud | Available (not in chain) | ✅ Available |
| `ollama/granite4:3b` | 2.1 GB | ~~Cron, router, fallback~~ | ❌ DELETED from Ollama |
| `ollama/ministral-3:latest` | 6.0 GB | ~~Cron jobs (interim)~~ | ❌ No longer installed |

## Telegram Group Model Routing

### Current Architecture (Post-Retirement)

```
┌──────────────────────────────────────────────────────────┐
│              Agentic Bro Group (-1003751594817)          │
│                    Telegram Interface                     │
└────────────────────────┬─────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌─────▼─────┐   ┌─────▼──────┐
    │  MAIN   │    │ AGENTIC-  │   │   LOCAL    │
    │  AGENT  │    │   BRO     │   │  ROUTER    │
    │         │    │           │   │            │
    │ glm-5.1 │    │ qwen3.5  │   │ ministral3 │
    │ :cloud  │    │  :2b      │   │ :latest    │
    │         │    │           │   │            │
    │ Primary │    │ Group     │   │ Telegram   │
    │ default │    │ chat &   │   │ DM router  │
    │ web UI  │    │ scans     │   │ classify   │
    └─────────┘    └───────────┘   └────────────┘
         │               │               │
         └───────┬───────┘───────────────┘
                 │
         ┌───────▼───────┐
         │  CLOUD TASKS  │
         │  (on demand)  │
         │               │
         │ glm-5.1:cloud │  ← Scam scans, web fetch, analysis
         │ glm-5:cloud   │  ← Fallback
         │ glm-4-7-flash │  ← Fast cloud
         └───────────────┘
```

### Model Assignment by Channel

| Channel | Agent | Model | Purpose |
|---|---|---|---|
| Webchat | main | `glm-5.1:cloud` | Primary control |
| Telegram Group | agentic-bro | `qwen3.5:2b` | Group chat + scans |
| Telegram DM | local-router | `ministral-3:latest` | Classification + routing |
| Cron Jobs | isolated sessions | `ministral-3:latest` | Scheduled posts |
| Subagents | spawned | `glm-5.1:cloud` or `qwen3-coder:30b` | Coding/analysis tasks |

## Cron Jobs Updated (April 16, 2026)

All 15 enabled cron jobs switched from `granite4:3b` → `ministral-3:latest`:

| Job Name | Schedule | Status |
|---|---|---|
| agentic-bro-heartbeat-morning | 8:00 AM EST | ✅ Updated |
| agentic-bro-heartbeat-evening | 8:00 PM EST | ✅ Updated |
| morning_energy_post | 7:00 AM EST | ✅ Updated |
| morning_education_tip | 7:30 AM EST | ✅ Updated |
| midday_checkin | 12:00 PM EST | ✅ Updated |
| midday_educational | 12:30 PM EST | ✅ Updated |
| agentic-bro-buy-energy-boost | 10 AM, 2 PM, 6 PM | ✅ Updated |
| agentic-bro-midday-boost | 12:00 PM EST | ✅ Updated |
| agentic-bro-scam-education | 2:00 PM EST | ✅ Updated |
| agentic-bro-engagement-question | 6:00 PM EST | ✅ Updated |
| agentic-bro-weekend-vibes | Sat/Sun 11,3,7 | ✅ Updated |
| agentic-bro-member-spotlight | Fri 6 PM | ✅ Updated |
| agentic-bro-weekly-challenge | Mon 10 AM | ✅ Updated |
| agentic-bro-token-reminder | Wed 2 PM | ✅ Updated |
| friday_celebration | Fri 1 PM | ✅ Updated |
| nightly_review | 11:30 PM EST | ✅ Updated |
| db_integrity_check | Every 6 hours | ✅ Updated |
| scam_db_sync | Every 12 hours | ✅ Updated |
| agentic-bro-session-health | Every 5 min | ✅ (systemEvent, no model) |

## VRAM Conflict History

**The Problem:** When `qwen3-coder:30b` (18 GB) was loaded for coding subagents, it evicted `granite4:3b` from VRAM. Then when cron jobs tried to use `granite4:3b`, Ollama had to reload it, causing:
- Model cooldown errors ("provider ollama is in cooldown")
- Timeouts during model switching
- Cascading failures across multiple cron jobs
- `qwen3.5:2b` timeouts (also evicted)

**The Fix:** Using `ministral-3:latest` (6 GB) instead of `granite4:3b` (2.1 GB) provides:
- Better quality output (3B params vs 4x3B MoE)
- Less VRAM contention (loads faster)
- More reliable for scheduled tasks
- Still local/FREE

## Action Items After granite4:3b Deletion

1. ✅ Update all cron jobs → `ministral-3:latest` (then → `qwen3.5:9b`)
2. ✅ Update local-router agent → `ministral-3:latest` (then → `qwen3.5:9b`)
3. ✅ Update `openclaw.json` agents list → remove `granite4:3b` from main agent
4. ✅ Remove `granite4:3b` from Ollama: `ollama rm granite4:3b` (done May 9, 2026)
5. ✅ Remove `granite4:3b` from allowed models in `openclaw.json`
6. ✅ Restart gateway after config changes
7. ✅ Verify all cron jobs run successfully on new model
8. ✅ Update MEMORY.md + TECHNICAL.md to reflect `qwen3.5:9b` as cron model
9. ✅ Update this retirement doc to completed

## Rollback Plan

If `ministral-3:latest` causes issues:
1. Re-pull `ollama pull granite4:3b`
2. Re-add to `openclaw.json` allowed models
3. Update affected cron jobs back to `granite4:3b`
4. Restart gateway

---

*Document created: April 16, 2026*
*granite4:3b retired after ~3 weeks of service*