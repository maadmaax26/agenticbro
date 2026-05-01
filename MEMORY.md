# MEMORY.md - Long-Term Memory

## Project: Agentic Bro

**Token:** $AGNTCBRO | **Contract:** 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
**Supply:** 1B | **Website:** agenticbro.app | **Status:** Live

## Dev / Owner
- **Madmax** — Dev for $AGNTCBRO / Agentic Bro. Posts anonymously via GroupAnonymousBot (1087968824) in the Telegram group.
- **James** (7151545057, @James_RIao) — Main admin of the Agentic Bro project. Do NOT welcome him — he's a core team member.

## Jeeevs Identity
- **Name:** Jeeevs (NOT Jarvis) | **Role:** AI scam detection assistant for Solana
- **Node:** 077d7cfed2b99aefbb689ef00e949ed2bdb45dff020c1bb334fa0a7f733adfbd
- **Host:** Earl's Mac Studio | **Workspace:** /Users/efinney/.openclaw/workspace/
- **Capabilities:** Scan X/IG/TikTok/FB/Telegram • Risk scores 0-10 • Scammer DB (278+) • Community warnings
- **Group Model:** `ollama/glm-5.1:cloud` → `qwen3.5:9b` fallback
- **Cron Model:** `ollama/qwen3.5:9b`

## Scan Commands (bash wrappers only — no python3)
| Platform | Command |
|------|-------|
| Instagram | `bash /workspace/scripts/scan-instagram.sh "<username>"` |
| TikTok | `bash /workspace/scripts/scan-tiktok-command.sh "<username>"` |
| Facebook | `bash /workspace/scripts/scan-facebook.sh "<username>"` |
| Phone | `bash /workspace/scripts/scan-phone.sh "+14158586273" US` |
| Telegram | `bash /workspace/scripts/scan-telegram.sh "James6865"` |
| Universal | `bash /workspace/scripts/scan-source.sh "<platform>" "<username>"` |

## Scoring (90-Point Unified)
**Red Flags:** guaranteed_returns(25) • giveaway_airdrop(20) • dm_solicitation(15) • free_crypto(15) • alpha_dm_scheme(15) • unrealistic_claims(10) • download_install(10) • urgency_tactics(10) • emotional_manipulation(10) • low_credibility(10)
**Phone Flags:** invalid_number(25) • premium_rate_number(25) • voip_number(20) • spoofed_caller_id(15) • disposable_number(15) • spam_dialer_service(15) • high_risk_country(15) • toll_free_untraceable(10) • landline_text(10) • no_carrier_info(10) • medium_risk_country(8) • unknown_carrier(5)
**Risk Levels:** 0-3 LOW • 3-5 MEDIUM • 5-7 HIGH • 7+ CRITICAL

## Infrastructure
Chrome CDP: Port 18801 | Telegram: @Jeeevs222_bot | Welcome Bot: DISABLED

## Local Models
| Model | Size | Use |
|-------|------|-----|
| ollama/granite4:3b | ~10GB | agentic-bro main agent |
| ollama/glm-5.1:cloud | ~10GB | Nightly review only (complex analysis + memory management) |

## Cron Jobs
| Job | Schedule | Status |
|-----|---------|--------|
| heartbeat-morning | 8:00 AM EST | ✅ (qwen3.5:9b) |
| heartbeat-evening | 8:00 PM EST | ✅ (qwen3.5:9b) |
| morning_energy_post | 7:00 AM EST | ✅ (qwen3.5:9b) |
| morning_education_tip | 7:30 AM EST | ✅ (qwen3.5:9b) |
| buy-energy-boost | 10AM/2PM/6PM | ✅ (qwen3.5:9b) |
| midday_checkin | 12:00 PM | ✅ (qwen3.5:9b) |
| new-member-welcome | Every 5 min | ✅ (qwen3.5:9b) |
| batch-welcome-5-members | Every 5 min | ✅ (qwen3.5:9b) |
| nightly_review | 2:00 AM EST | ✅ (glm-5.1:cloud) |
| scam_db_sync | Every 12h | ❌ MISSING |
| db_integrity_check | Every 6h | ❌ MISSING |
| token-reminder | Wed 2PM | ❌ MISSING |

**Disabled:** profile_scammer_discovery, proactive_scammer_search, daily_market_report, scammer_discovery_daily, session-health

## Website (agenticbro.app)
**Repo:** maadmaax26/agenticbro | **Known:** Instagram login walls → `PROFILE_LOGIN_REQUIRED`
**Phone Verifier:** Live on website — `PhoneNumberVerifier.tsx` component + `/api/phone-verify.ts` endpoint
**CLI:** `scripts/scan-phone.sh` + `scripts/phone-scan-api.sh` + `scripts/phone_scorer.py`

## Scan Report Format
Risk Score X/10 — [LEVEL] ⚠️ → Red flags with point values → Behavioral pattern → Disclaimer (educational only, not financial advice, DYOR, scan date)

*See additional memory files:*
- `memory/RULES.md` — Community behavior rules (permanent)
- `memory/TECHNICAL.md` — Technical details and infrastructure
- `memory/2026-04-25.md` — Daily notes (archived after 7 days)