# TECHNICAL.md - Technical Reference

This file contains technical details that don't change often. Safe to reference but not critical for every interaction.

---

## Infrastructure

- **Chrome CDP:** Port 18801 (local Mac Studio only)
- **Telegram Bot:** @Jeeevs222_bot
- **Welcome Bot:** DISABLED
- **Node:** 077d7cfed2b99aefbb689ef00e949ed2bdb45dff020c1bb334fa0a7f733adfbd
- **Host:** Earl's Mac Studio
- **Workspace:** /Users/efinney/.openclaw/workspace/

---

## Model Assignments

| Model | Use Case |
|-------|----------|
| ollama/kimi-k2.6:cloud | Primary — all sessions |
| ollama/glm-5.1:cloud | Fallback #1 + nightly review |
| ollama/qwen3.5:9b | ALL cron jobs + local fallback #2 |
| ollama/glm-5:cloud | Config default fallback |

**Ollama Cooldown:** Model swaps cause provider cooldown cascade. Set `OLLAMA_KEEP_ALIVE=24h`.
**VRAM:** Only `qwen3.5:9b` (6.6GB) loaded locally. All other models are cloud-based — no VRAM contention.

---

## Scan Commands

| Platform | Command |
|----------|---------|
| Instagram | `bash /workspace/scripts/scan-instagram.sh "<username>"` |
| TikTok | `bash /workspace/scripts/scan-tiktok-command.sh "<username>"` |
| Facebook | `bash /workspace/scripts/scan-facebook.sh "<username>"` |
| Phone | `bash /workspace/scripts/scan-phone.sh "+14158586273" US` |
| Phone API | `bash /workspace/scripts/phone-scan-api.sh "+14158586273" US` |
| Telegram | `bash /workspace/scripts/scan-telegram.sh "James6865"` |
| Universal | `bash /workspace/scripts/scan-source.sh "<platform>" "<username>"` |

**NOTE:** Always use `bash` wrapper scripts. Direct `python3` calls are blocked by OpenClaw exec preflight.

---

## Risk Scoring (90-Point Unified)

### Red Flags
| Flag | Points |
|------|--------|
| guaranteed_returns | 25 |
| giveaway_airdrop | 20 |
| dm_solicitation | 15 |
| free_crypto | 15 |
| alpha_dm_scheme | 15 |
| unrealistic_claims | 10 |
| download_install | 10 |
| urgency_tactics | 10 |
| emotional_manipulation | 10 |
| low_credibility | 10 |

### Phone Flags
| Flag | Points |
|------|--------|
| invalid_number | 25 |
| premium_rate_number | 25 |
| voip_number | 20 |
| spoofed_caller_id | 15 |
| disposable_number | 15 |
| spam_dialer_service | 15 |
| high_risk_country | 15 |
| toll_free_untraceable | 10 |
| landline_text | 10 |
| no_carrier_info | 10 |
| medium_risk_country | 8 |
| unknown_carrier | 5 |

### Risk Levels
- 0-3: LOW
- 3-5: MEDIUM
- 5-7: HIGH
- 7+: CRITICAL

---

## Bot Detection (100-Point Scale)

### Bot Score Classification
- 0-20: Authentic
- 21-40: Mild Bot Activity
- 41-60: Moderate Bot Inflation
- 61-80: High Bot Inflation
- 81-100: Highly Bot-Inflated

### Ghost Comments Scoring
| Threshold | Points |
|-----------|--------|
| ≥95% hidden | 20 (Critical) |
| ≥70% hidden | 15 (High) |
| ≥50% hidden | 10 (Moderate) |

---

## Cron Job Details

| Job | Schedule | Model | Status |
|-----|----------|-------|--------|
| heartbeat-morning | 8:00 AM EST | qwen3.5:9b | ✅ |
| heartbeat-evening | 8:00 PM EST | qwen3.5:9b | ✅ |
| morning_energy_post | 7:00 AM EST | qwen3.5:9b | ✅ |
| morning_education_tip | 7:30 AM EST | qwen3.5:9b | ✅ |
| buy-energy-boost | 10AM/2PM/6PM | qwen3.5:9b | ✅ |
| midday_checkin | 12:00 PM | qwen3.5:9b | ✅ |
| new-member-welcome | Every 5 min | qwen3.5:9b | ✅ |
| batch-welcome-5-members | Every 5 min | qwen3.5:9b | ✅ |
| nightly_review | 2:00 AM EST | glm-5.1:cloud | ✅ |
| scam_db_sync | Every 12h | — | ❌ MISSING |
| db_integrity_check | Every 6h | — | ❌ MISSING |
| token-reminder | Wed 2PM | — | ❌ MISSING |

**Session Target:** All group crons now target `session:agent:agentic-bro:telegram:group:-1003751594817`

---

## API Keys

| Service | Key Location |
|---------|--------------|
| FTC DNC | `FTC_API_KEY` in Vercel env |
| Numverify | `05c48520e3a536d5cf899c6a6a6d2be34d` |
| Telegram Bot | `8692355…REDACTED` |
| Supabase | Project: `drvasofyghnxfxvkkwad` |

---

## Key Files

| File | Purpose |
|------|---------|
| `/workspace/MEMORY.md` | Active memory (trimmed if >8KB) |
| `/workspace/memory/RULES.md` | Permanent rules (never trimmed) |
| `/workspace/memory/TECHNICAL.md` | Technical reference (this file) |
| `/workspace/memory/2026-04-25.md` | Daily notes (archived after 7 days) |
| `/workspace/batch-welcome-state.json` | Welcome tracker state |
| `/workspace/scammer-database.csv` | 278+ scammer entries |
| `/cron/jobs.json` | Cron job definitions |

---

**This file should NEVER be trimmed.**