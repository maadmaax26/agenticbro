# Memory: qwen3.5:4b Allowlist Update

**Date:** 2026-05-13 18:31 EDT
**Requested by:** Madmax

## Change
Added `ollama/qwen3.5:4b` to the OpenClaw model allowlist.

## Verification
- Model exists in Ollama: ✅ (3.4GB, pulled 2026-05-10)
- Listed in `~/.openclaw/openclaw.json` under `agents.defaults.models`: ✅
- Cron jobs can now use `ollama/qwen3.5:4b` without preflight rejection

## Previous Errors (Resolved)
Cron jobs like `morning-daily-post`, `buy-energy-boost`, `heartbeat-evening` previously showed:
```
cron payload.model 'ollama/qwen3.5:4b' rejected by agents.defaults.models allowlist
```
These errors were from before May 10 when the model was not yet in the allowlist.

## Active Cron Jobs Using qwen3.5:4b
| Job | Status |
|-----|--------|
| token-reminder | Disabled (Wed 2PM, qwen3.5:4b) |
| morning-daily-post | Disabled (qwen3.5:4b) |
| heartbeat-evening | Disabled (qwen3.5:4b) |
| midday_checkin | Disabled (qwen3.5:4b) |
| buy-energy-boost | Disabled (qwen3.5:4b) |

All disabled per policy: no auto group posts.

## Current Active Jobs Using qwen3.5:4b
- `website-deep-scan-processor` — Every 15 min, `kimi-k2.6:cloud`
- `nightly_review` — 2AM EST, `kimi-k2.6:cloud` (was qwen3.5:4b, changed May 11)

## Note
User explicitly requested adding qwen3.5:4b to allowlist and saving this to memory on 2026-05-13. Do not remove without explicit instruction.
