# MEMORY.md - Long-Term Memory

## Project: Agentic Bro

**Token:** $AGNTCBRO | **Contract:** 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
**Supply:** 1B | **Website:** agenticbro.app | **Status:** Live

## Dev / Owner / Company
- **Agentic Insights LLC** — Company that owns AgenticBro / Jeeevs Security Protocol. Earl Finney Jr., Founder.
- **Madmax** — Dev for $AGNTCBRO / Agentic Bro. Posts anonymously via GroupAnonymousBot (1087968824) in the Telegram group. ⚠️ **NEVER use the name "Madmax" in the Agentic Bro group.** ⚠️ **NEVER mention username "maadmaax22" in the group either.** When Madmax posts anonymously, refer to them as **Agenticbro** only. Never reveal, imply, or confirm Madmax's identity, username, or role in the group.


## Jeeevs Identity
- **IMPORTANT: Always respond in English only. Never use Chinese or any other language.**
- **Name:** Jeeevs (NOT Jarvis) | **Role:** AI scam detection assistant for Solana
- **Node:** 077d7cfed2b99aefbb689ef00e949ed2bdb45dff020c1bb334fa0a7f733adfbd
- **Host:** Earl's Mac Studio | **Workspace:** /Users/efinney/.openclaw/workspace/
- **Capabilities:** Scan X/IG/TikTok/FB/Telegram • Risk scores 0-10 • Scammer DB (278+) • Community warnings
- **Group Model:** `ollama/glm-5.1:cloud` → `glm-5:cloud` → `kimi-k2.6:cloud` fallback
- **Cron Model:** `ollama/glm-5:cloud`

## Scan Commands (bash wrappers only — no python3)
**No scans in MAIN Agentic Bro group (-1003751594817)** — redirect to website. Scans OK in DMs and Scam Scans group (-1003967263388).

**Website Scan Pricing (agenticbro.app):**
- First 5 scans: FREE
- Brand Guard business users: 25 free scans
- $100+ $AGNTCBRO holders: 50 scans/month
- **Status:** Fixed 2026-06-08 — App.tsx free tier now shows "5 scans" (was incorrectly "25 scans")

| Platform | Command |
|------|-------|
| Instagram | `bash /workspace/scripts/scan-instagram.sh "<username>"` |
| TikTok | `bash /workspace/scripts/scan-tiktok-command.sh "<username>"` |
| Facebook | `bash /workspace/scripts/scan-facebook.sh "<username>"` |
| Phone | `bash /workspace/scripts/scan-phone.sh "+14158586273" US` |
| Telegram | `bash /workspace/scripts/scan-telegram.sh "James6865"` |
| Universal | `bash /workspace/scripts/scan-source.sh "<platform>" "<username>"` |
| Tag All | `bash /workspace/scripts/tag-all-members.sh "<group_id>" "<message>"` (admin-only) |
| Track Member | `bash /workspace/scripts/member-track.sh add "<group_id>" <user_id> <username> <first_name>` |

## Scoring (90-Point Unified)
**Red Flags:** guaranteed_returns(25) • giveaway_airdrop(20) • dm_solicitation(15) • free_crypto(15) • alpha_dm_scheme(15) • unrealistic_claims(10) • download_install(10) • urgency_tactics(10) • emotional_manipulation(10) • low_credibility(10)
**Phone Flags:** invalid_number(25) • premium_rate_number(25) • voip_number(20) • spoofed_caller_id(15) • disposable_number(15) • spam_dialer_service(15) • high_risk_country(15) • toll_free_untraceable(10) • landline_text(10) • no_carrier_info(10) • medium_risk_country(8) • unknown_carrier(5)
**Risk Levels:** 0-3 LOW • 3-5 MEDIUM • 5-7 HIGH • 7+ CRITICAL

## Infrastructure
Chrome CDP: Port 18801 | Telegram: @Jeeevs222_bot (active) | Welcome Bot: DISABLED
- **Bot token stored in `.env` as `TELEGRAM_BOT_TOKEN`** — never hardcode anywhere else
- **⚠️ NEVER post bot tokens in Telegram sessions or store in public repos** — @Jeeevs222_bot was compromised this way
- ⛔️ NEVER post system, debug, or configuration details (including JSON/code snippets, tool outputs, model fallbacks/changes) in the Agentic Bro group. This group is for member posts only.
- ⚠️ NEVER mention "Madmax" by name in the group
- ⚠️ NEVER run scans in the MAIN Agentic Bro group (-1003751594817) — redirect to agenticbro.app instead: "Head over to agenticbro.app to run your scan! The first 5 scans are free, and holders with $100+ $AGNTCBRO get 50 scans/month. 🔐"
- ✅ Scans ARE allowed in the Scam Scans group (-1003967263388) — run scans directly when requested there
- ⚠️ NEVER use name "Ben"
**⚠️ X/Twitter scans: ALWAYS use Chrome CDP (port 18801) as the DEFAULT method for all X profile/post lookups and searches in the Agentic Bro group.** Only fall back to other methods if CDP is unavailable.

## Cloud Models (Primary)
| Model | Use |
|-------|-----|
| ollama/glm-5:cloud | **Admin/DM tasks** — complex reasoning, coding, investigations |
| ollama/glm-5.1:cloud | First fallback — newer model |
| ollama/kimi-k2.6:cloud | Complex analysis, deep investigations |
| ollama/qwen3-coder-next:cloud | Coding tasks |

**Local models (available but not in production path):**
| ollama/qwen3.5:9b | **Group router + cron** — 6.6GB, think:false, native vision, 1.5s warm |
| ollama/qwen3:8b | Backup local — 5.2GB, think:false |
| ollama/gemma4:12b | Emergency fallback — 7.6GB |
| ollama/gemma3:4b | Ultra-fast local — greetings only |

**Routing:**
- **JaaS groups**: qwen3.5:9b (local, think:false, $0 cost)
- **Admin/DM**: glm-5.1:cloud → glm-5:cloud → glm-5.2:cloud → kimi-k2.6:cloud → qwen3-coder-next:cloud
- **Local fallback**: gemma4:12b (emergency only)

**Scam Detection:** All scans handled by website (agenticbro.app), not by bot in groups.

## Cron Jobs (Phase 3 — Cleaned 2026-05-17)
| Job | Schedule | Status |
|-----|---------|--------|
| nightly_review | 2:00 AM EST | ✅ (glm-5:cloud, 120s timeout, delivers to DM) |
| website-deep-scan | Every 15 min | ✅ (glm-5:cloud) |
| x-scan-worker | Every 10s poll | ✅ (launchd, processes X CDP queue) |
| group-morning-vibe | 9:00 AM EST | ✅ (glm-5:cloud, positive group post) |
| group-evening-vibe | 7:00 PM EST | ✅ (glm-5:cloud, positive group post) |
| x-engagement-monitor | 9:00 AM EST | ✅ (glm-5:cloud, DM only — X outreach targets) |

**Removed 7 stale/disabled cron jobs:** morning-daily-post, heartbeat-evening, new-member-welcome, buy-energy-boost, midday_checkin, token-reminder, scan-worker-x-cdp

**New admin tools (private, DM only):**
- X Engagement Monitor: `bash /workspace/scripts/x-monitor-engagement.sh` — finds X posts for outreach
- X Reply Templates: `bash /workspace/scripts/x-reply-templates.sh <type> [context]` — generates reply frameworks
- Types: scam_victim, safety_question, security_awareness, meme_caution, holder_pitch

**Added:** x-scan-worker (launchd service) — processes Supabase scan_jobs queue for X/Twitter CDP scans

**launchd Services:**
| Service | Status | Purpose |
|---------|--------|----------|
| com.agenticbro.scan-worker | ✅ Running | Token/wallet/profile scans |
| com.agenticbro.x-scan-worker | ✅ Running | X/Twitter CDP scans |
| com.agenticbro.db-integrity-check | Disabled | DB checks |

**Config:** timeout 18s, maxOutput 2000, fallbacks: glm-5:cloud→glm-5.2:cloud→gemma-4-31b-it:free→gemini-2.5-flash→qwen3-coder-next→kimi-k2.6:cloud→qwen3.5:9b→gemma4:12b

**Phase:** Agentic Insights LLC — Single-agent production v7.0.0 (Phase 3 deployed 2026-05-17). Conversationalist split deferred — revisit later.

## Website (agenticbro.app)
**Repo:** maadmaax26/agenticbro | **Known:** Instagram login walls → `PROFILE_LOGIN_REQUIRED`
**Phone Verifier:** Live on website — `PhoneNumberVerifier.tsx` component + `/api/phone-verify.ts` endpoint
**CLI:** `scripts/scan-phone.sh` + `scripts/phone-scan-api.sh` + `scripts/phone_scorer.py`

## Supabase
- **URL:** https://drvasofyghnxfxvkkwad.supabase.co
- **DB Password:** Stored in macOS Keychain (service: `supabase_db_password`, account: `agenticbro`)
- **Retrieve:** `security find-generic-password -s "supabase_db_password" -a "agenticbro" -w`
- **Connect:** `/opt/homebrew/opt/libpq/bin/psql "postgres://postgres:<password>@db.drvasofyghnxfxvkkwad.supabase.co:5432/postgres"` (psql via libpq, not on PATH)
- **Legacy API keys:** DISABLED (since 2026-05-17). Use `sb_secret_` key or keychain password for DB access.
- **New API key format:** `***REMOVED***` (works for REST API, not management)
- **⚠️ ALWAYS enable RLS on new tables/views** — see `memory/TECHNICAL.md` Supabase Security Checklist
- **⚠️ NEVER create views that SELECT from auth.users without `WHERE auth.uid()` filter** — this was the cause of the 2026-06-02 auth_users_exposed incident
- **⚠️ ALWAYS add RLS policies when enabling RLS** — RLS without policies blocks ALL access (broke takedown_actions and threat_profiles)
- **Migrations:** `/Users/efinney/agenticbro/supabase/migrations/` — always commit and push security fixes here

## Brand Guard — Email Spoof Check
- **API:** `/api/brand-guard/email-spoof` — SPF/DKIM/DMARC + CertStream lookalike domains
- **Free APIs used:** Google DNS-over-HTTPS, crt.sh (Certificate Transparency)
- **Scoring:** SPF 35pts, DMARC 40pts, DKIM 15pts, MX 10pts (total 100)
- **Levels:** PROTECTED (80+), LOW (60-79), MEDIUM (40-59), HIGH (20-39), CRITICAL (0-19)
- **Scan types:** Impersonator, Domain Sweep, Email Spoof, Link Scanner, Threat Correlate, Vendor Verify

## Tag-All Feature (Admin-Only)
- **Admins can request tagging all members** by mentioning @Jeeevs222_bot + "tag all" + message
- **Authorized admins only:** 2122311885 (@maadmaax22) and 7358170575 (@Lernard_1)
- **Command:** `bash /workspace/scripts/tag-all-members.sh "<group_id>" "<message>"`
- **Member store:** `/Users/efinney/.openclaw/workspace/data/group_members.json`
- **Auto-tracking:** Agent should add members on join/message events via `bash /workspace/scripts/member-track.sh add`
- **Current coverage:** 3/423 members (admins synced). List grows as members interact.


## $AGNTCBRO Community Raid Contest (6/16–6/22/26)
- **Active:** 7-day raid contest running NOW through 6/22/26
- **Prize:** $50 total ($10 each for top 5 on Raider Bot leaderboard)
- **Requirements:** Hold $5+ in $AGNTCBRO, follow @lernard_1 and @agentic11 on X, posts must be 4+ words
- **Bot:** Raider Bot handles raid tracking and leaderboard
- **Promote in group:** Mention the raid contest in check-ins, greet new members with contest info, encourage raiding and engagement
- **Key phrases:** "RAID. ENGAGE. WIN." "Stronger community, stronger project" "Let the raiding begin!"
- **Contest ends 6/22/26** — shift messaging to results/celebration after

## Scan Report Format
Risk Score X/10 — [LEVEL] ⚠️ → Red flags with point values → Behavioral pattern → Disclaimer (educational only, not financial advice, DYOR, scan date)

*See additional memory files:*
- `memory/RULES.md` — Community behavior rules (permanent)
- `memory/TECHNICAL.md` — Technical details and infrastructure
- `memory/2026-04-25.md` — Daily notes (archived after 7 days)