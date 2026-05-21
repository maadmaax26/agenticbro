# Nightly Review — May 10, 2026 (Sun) 2:21 AM EDT

## Memory Management
- **MEMORY.md:** 4.5KB ✅ (under 8KB, no trim needed)
- **AGENTS.md:** 7.6KB ✅ (under 8KB, no trim needed)
- **memory/RULES.md:** 3.7KB ✅ (permanent, untouched)
- **memory/TECHNICAL.md:** 4.5KB ✅ (permanent, untouched)
- **Scammer DB:** 262 entries (262 lines incl. header)
- **Archived:** 8 files from May 5-7 moved to `memory/archive/`
- **Remaining daily notes:** 6 files (May 9-10, within 7-day window)
- **Archive total:** 107 files, 888KB

## System Status

### Gateway
- ✅ Running, pid 72750, port 18789, loopback
- ✅ RPC probe OK, admin-capable

### Models Available (Ollama)
- kimi-k2.6:cloud, kimi-k2.5:cloud, kimi-k2-thinking:cloud
- glm-5.1:cloud, glm-5:cloud, glm-4.7:cloud
- qwen3.5:9b, qwen3.5:cloud, qwen3-next:80b-cloud, qwen3-coder-next:cloud
- gemini-3-flash-preview:latest
- granite4:3b **RETIRED** (removed May 9)

### Cron Jobs
| Job | Schedule | Model | Status |
|-----|----------|-------|--------|
| new-member-welcome | */5 min | qwen3.5:9b | ⚠️ STALLED (repeatedly, model_call timeout) |
| scan-worker-x-cdp | */5 min | qwen3.5:9b | ⚠️ STALLED (1372s+, model_call timeout) |
| nightly_review | 2AM EST | glm-5.1:cloud | ✅ running (this job) |
| morning-daily-post | 8AM EST | kimi-k2.6:cloud | ✅ idle |
| buy-energy-boost | 10AM/2PM/6PM | kimi-k2.6:cloud | ✅ ok |
| midday_checkin | 12PM EST | kimi-k2.6:cloud | ✅ ok |
| heartbeat-evening | 8PM EST | kimi-k2.6:cloud | ✅ ok |
| website-deep-scan-processor | */15 min | qwen3.5:9b | ✅ ok |
| ❌ scam_db_sync | every 12h | — | MISSING |
| ❌ db_integrity_check | every 6h | — | MISSING |
| ❌ token-reminder | Wed 2PM | — | MISSING |

### ⚠️ Stalled Sessions (Active)
- `new-member-welcome` — repeatedly stalls on model_call (503s+)
- `scan-worker-x-cdp` — stalls on model_call (1000s+ at peak)
- Likely cause: qwen3.5:9b model cooldown/overload on local Ollama

### ⚠️ Exec Error
- `check-new-members.sh` fails with "exec host=node requires a node id when multiple nodes are available"
- Script uses `host: "node"` but needs explicit node ID

## Community Summary
- No new scam threats flagged in last 24h
- No new member joins detected (welcome bot stalled)
- Scan worker running but stalling — no pending scans completed
- Quiet Saturday night, low activity

## Issues & Next Steps

1. **🔴 Stalled cron jobs** — new-member-welcome and scan-worker-x-cdp repeatedly stalling on model_call. Likely qwen3.5:9b cooldown. Consider switching to cloud model or adding timeout/retry.
2. **🔴 check-new-members.sh node ID error** — needs explicit node ID in exec config, not just `host: "node"`
3. **⚠️ 3 missing cron jobs** — scam_db_sync, db_integrity_check, token-reminder still not recreated
4. **⚠️ scan-facebook.sh shell injection** — still unfixed
5. **⚠️ auth-profiles.json invalid entry** — still unfixed
6. **🟡 Model retirement** — granite4:3b removed from Ollama (done May 9), MEMORY.md updated
7. **🟡 Consider upgrading to latest OpenClaw** — update available

**Priority for tomorrow:** Fix stalled cron jobs (model timeout), fix check-new-members.sh node ID, recreate missing cron jobs.