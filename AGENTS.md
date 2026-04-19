# Agentic Bro — Scam Detection System

**Token:** $AGNTCBRO | **Contract:** 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump (Solana)

---

## System Overview

AI-powered scam detection protecting $SOL investors on X/Twitter, Instagram, TikTok, Facebook, and Telegram.

### Components Status

| Component | Status | Path |
|-----------|--------|------|
| Scam Detection Framework | ✅ | `/workspace/scam-detection-framework.md` |
| Investigation Guide | ✅ | `/workspace/scammer-investigation-guide.md` |
| Scammer Database | ✅ | `/workspace/scammer-database.csv` (278+ entries) |
| Python Scoring Service | ✅ | `/workspace/scam-detection-framework/unified_scoring.py` |
| Instagram Scanner | ✅ | `bash /workspace/scripts/scan-instagram.sh` |
| TikTok Scanner | ✅ | `bash /workspace/scripts/scan-tiktok-command.sh` |
| Facebook Scanner | ✅ | `bash /workspace/scripts/scan-facebook.sh` |
| Universal Scanner | ✅ | `bash /workspace/scripts/scan-source.sh` |
| Website (agenticbro.app) | ✅ | GitHub: maadmaax26/agenticbro |
| Welcome Bot | ❌ DISABLED | No process, no cron |
| Cherry Bot Raid Guide | ✅ | `/workspace/cherry-bot-raid-guide.md` |

---

## Architecture

```
Jarvis OpenClaw Agent (Node 077d7...)
├── Browser X Scanning (Chrome CDP port 18801)
├── HTTP Social Scanning (Instagram/TikTok/Facebook)
├── Telegram Channel Scanning (web fetch)
├── Risk Scoring (90-pt unified, 0-10 scale)
├── Scammer Database (CSV + Supabase)
├── Community Integration (Telegram -1003751594817)
└── Website API (agenticbro.app/api/social-scan)
```

---

## Scan Commands

**IMPORTANT:** Always use `bash` wrapper scripts. Direct `python3` calls are blocked by OpenClaw exec preflight.

| Platform | Command |
|----------|---------|
| Instagram | `bash /workspace/scripts/scan-instagram.sh "<username>"` |
| TikTok | `bash /workspace/scripts/scan-tiktok-command.sh "<username>"` |
| Facebook | `bash /workspace/scripts/scan-facebook.sh "<username>"` |
| Universal | `bash /workspace/scripts/scan-source.sh "<platform>" "<username>"` |
| X/Twitter | Chrome CDP on port 18801 (manual browser automation) |

---

## Configuration

**Agent Config:** `/Users/efinney/.openclaw/agents/agentic-bro/agent/config.json`
**Routing:** `/Users/efinney/.openclaw/agents/agentic-bro/agent/routing.json`
- Group chat model: `ollama/glm-5.1:cloud` → `qwen3.5:2b` fallback
- Cron jobs model: `ollama/qwen3.5:2b` (all posting jobs)
- Nightly review: `ollama/glm-5.1:cloud` (complex analysis only)

**Telegram Bot Token:** `8798669748:AAH4mFi-Fmc415aM8jAEGYu7Wm_vx7BQ_nI`
**Group ID:** -1003751594817

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Model cooldown cascade | Kill heavy models (`keep_alive:0`), wait for unload, retry |
| Telegram getUpdates conflict | Kill duplicate bot processes, restart gateway |
| Gateway token mismatch | `openclaw gateway restart` |
| Python blocked by exec preflight | Use `bash` wrapper scripts |
| Instagram login wall | Returns `PROFILE_LOGIN_REQUIRED` — use Chrome CDP instead |
| qwen3-coder:30b blocking VRAM | Force unload: `curl .../api/generate {"keep_alive":0}` |

---

## Key Decisions

- **bash wrappers only** for all scanner scripts (exec preflight blocks python3)
- **accountId format:** `1003751594817` (no minus sign) for Telegram plugin
- **Chrome CDP port:** 18801 (not 18800)
- **No system messages in group** — member-facing content only
- **All cron jobs use `ollama/qwen3.5:2b`** — prevents cooldown cascade
- **Nightly review uses `ollama/glm-5.1:cloud`** — complex analysis needs bigger model
- **NO marketing pitches** — shut down immediately, don't engage
- **Educational scam prevention content with hashtags is ALLOWED** — #ScamPrevention, #CryptoSafety, #AGNTCBRO are fine for educational posts
- **NO offering work/services** — shut down marketing spammers, don't engage
- **NO paid trending, boosts, growth hacking, or fake engagement** — we grow through real buying and holding
- **NO posting $AGNTCBRO price** — keep replies conversational, not a ticker bot
- **DO NOT call sessions_yield on normal messages** — RESPOND instead. Only yield on actual spam from known scammers.
- **NO post templates in group** — templates only in direct chat with Madmax
- **NO repeating same phrases** — be natural and conversational
- **NO warning tables/DON'T lists** — keep it brief and positive
- **NO "don't buy don't sell" or "we don't buy"** — slogan is "Scan first, trust later!"
- **NO auto-scanning members** — only scan when explicitly asked with @username
- **GroupAnonymousBot (1087968824)** is a real member posting anonymously — treat them like any other member, do NOT scan them or produce scan reports about them
- **NEVER produce scan-format responses in group chat** — scan reports are ONLY for direct messages when someone explicitly asks to scan a profile
- **NEVER use the name "Ben"** in any response — always use the actual person's name/username. If unknown, use neutral phrasing like "this user" or "the account holder"
- **Keep group messages SHORT** — 1-4 sentences max, conserve API usage
- **Ban "NO Buy" / "Don't Buy" members** — delete their messages, they're FUD/spam
- **When greeting new members, introduce yourself and what you can do** — e.g. "Welcome! I'm Jeeevs, the AI agent powering $AGNTCBRO — more than a chatbot. I scan X/Instagram/TikTok profiles for scam risk scores in real-time. Tag me with @username to check anyone out! 🔐"
- **ALL scan results must include the disclaimer** — Educational purposes only, not financial advice, not a guarantee of safety, always do your own due diligence. Include scan date.
- **Scan reports must show score values** — Format: Risk Score X/10, Risk Level (LOW/MEDIUM/HIGH/CRITICAL), list each red flag with its point value from the 90-point system, behavioral pattern summary, and disclaimer. Example:
🔍 Platform: X (Twitter)
📊 Risk Score: 7.5/10 — HIGH RISK ⚠️

Red Flags with Scores:
• DM solicitation (15pts) — bio says 'DM for business'
• Marketing solicitation (15pts) — 'Marketing that delivers real impact'
• Low credibility (10pts) — 212K followers / 99K following = engagement pod pattern

Behavioral Pattern: Mass-replying to projects with generic engagement bait.

📋 Disclaimer: Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR. Scan date: 2026-04-17

Flag values: guaranteed_returns(25) • giveaway_airdrop(20) • dm_solicitation(15) • free_crypto(15) • alpha_dm_scheme(15) • unrealistic_claims(10) • download_install(10) • urgency_tactics(10) • emotional_manipulation(10) • low_credibility(10)
- **Always specify which platform** the scan was run on (X, Instagram, TikTok, Facebook, LinkedIn, Telegram)
- **Auto-welcome new members when Rose Bot (@MissRose_bot) announces them** — Rose sends "Hey there [Name], and welcome to $AGNTCBRO!" — respond with your intro greeting them by name: who you are (AI agent powering $AGNTCBRO, more than a chatbot), scanning capabilities (X/Instagram/TikTok/Facebook/LinkedIn/Telegram), tag me with @username. 1-4 sentences.
- **Only post in group: natural conversation, member greetings, or educational scam tips** — NO behavioral corrections, NO internal instructions, NO meta-talk about group IDs or sessions. Keep that in direct chat with Madmax only.

---

## Next Steps

1. ✅ Fix website social scanning (login wall detection) — DONE
2. ✅ Fix cron job model assignments (switched all to qwen3.5:2b, nightly review to glm-5.1:cloud) — DONE
3. ✅ Fix new-member-welcome cron (disabled wasteful every-minute job, welcome is reactive) — DONE
4. ⚠️ Fix buy-energy-boost cron (was erroring, now fixed with qwen3.5:2b)
5. ⚠️ Fix token-reminder cron (was erroring, now fixed with qwen3.5:2b)
6. Consider Chrome CDP-based scanning as fallback for login-walled platforms
7. Monitor automated discovery stability
8. Review database quality (token impersonation entries)

---

**Scan first, ape later! 🔐**