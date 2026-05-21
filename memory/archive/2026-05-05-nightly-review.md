# Nightly Review — May 5, 2026 (2:00 AM EDT)

## Memory Management
- MEMORY.md: 4.1 KB ✅ (under 8KB limit)
- AGENTS.md: 7.6 KB ✅ (under 8KB limit)
- RULES.md & TECHNICAL.md: preserved (permanent)
- Archive: 95 files, 824 KB — no new archives needed (daily notes from May 1+ still within 7-day window)

## System Status
- **Gateway:** Running (pid 21189, loopback:18789) ✅
- **Disk:** 139 GB used / 460 GB (33%) ✅
- **Models available:** glm-5.1:cloud, glm-5:cloud, qwen3.5:9b, kimi-k2.5:cloud, qwen3-next:80b-cloud, qwen3-coder-next:cloud, gemini-3-flash-preview, granite4:3b, kimi-k2-thinking:cloud, qwen3.5:cloud

### Cron Jobs
| Job | Schedule | Status |
|-----|----------|--------|
| new-member-welcome | */5 min | ✅ running |
| scan-worker-x-cdp | */2 min | ✅ running |
| website-deep-scan-prober | 30s | ✅ ok |
| nightly_review | 2 AM | ✅ running (this job) |
| morning_energy_post | 7 AM | ✅ ok |
| morning_education_tip | 7:30 AM | ✅ ok |
| heartbeat-morning | 8 AM | ✅ ok |
| buy-energy-boost | 10AM/2PM/6PM | ✅ ok |
| midday_checkin | 12 PM | ✅ ok |
| heartbeat-evening | 8 PM | ⚠️ error |
| scam_db_sync | — | ❌ MISSING |
| db_integrity_check | — | ❌ MISSING |
| token-reminder | — | ❌ MISSING |

## Community Summary
- No new member welcome events logged today (new-member-welcome cron running normally)
- Today's notes: model timeout investigation, airdrop correction follow-up, system check
- Airdrop Week 2 correction completed — 11 Silver wallets sent 62,500 each
- 9 wallets received tokens incorrectly — awaiting Madmax's decision on redistribution
- Bot migration: @AGNTCBRO_bot now active (replacing @Jeeevs222_bot)

## Issues
1. ⚠️ **heartbeat-evening cron error** — last run errored (8 PM yesterday)
2. ⚠️ **3 missing crons** — scam_db_sync, db_integrity_check, token-reminder not re-created
3. ⚠️ **Airdrop redistribution decision pending** — 1.5M AGNTCBRO to 9 wrong wallets

## Next Steps
1. Investigate heartbeat-evening error
2. Re-create missing crons (scam_db_sync, db_integrity_check, token-reminder)
3. Follow up with Madmax on airdrop redistribution decision
4. Monitor scan-worker-x-cdp stability