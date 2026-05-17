# 🔍 Agentic Bro — AI Scam Detection for Solana

**$AGNTCBRO** | **Contract:** `52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump` (Solana)

AI-powered scam detection protecting crypto investors across X/Twitter, Instagram, TikTok, Facebook, Telegram, and phone numbers. Real-time risk scoring, scammer database, and community alerts.

**Website:** [agenticbro.app](https://agenticbro.app) | **X:** [@AgenticBro11](https://x.com/agenticbro11) | **Telegram:** t.me/AGNTCBRO

---

## What It Does

Agentic Bro scans social media profiles and phone numbers for scam indicators and generates a **90-point risk score (0–10 scale)** with detailed red flag breakdowns.

### Platform Scanning

| Platform | Method | Status |
|----------|--------|--------|
| **X / Twitter** | Chrome CDP (port 18801) | ✅ Live |
| **Instagram** | HTTP API + login-wall detection | ✅ Live |
| **TikTok** | HTTP API | ✅ Live |
| **Facebook** | HTTP API | ✅ Live |
| **Telegram** | Web fetch + channel analysis | ✅ Live |
| **Phone Numbers** | API-based carrier/VOIP/spam detection | ✅ Live |
| **Website/URL** | Deep-scan via website API | ✅ Live |

### Scan Example

```
Risk Score: 7.5/10 — HIGH ⚠️

Red Flags:
• guaranteed_returns (+25) — Promises unrealistic ROI
• giveaway_airdrop (+20) — Fake giveaway/airdrop promoted
• dm_solicitation (+15) — Asks followers to DM for "opportunities"
• urgency_tactics (+10) — "Act now or miss out" pressure

Behavioral Pattern: Classic giveaway scam — inflates trust with small payouts, then rugs.

Educational purposes only. Not financial advice. Always DYOR. Scan date: 2026-05-17
```

---

## Architecture

```
Jeeevs (OpenClaw Agent — Mac Studio)
├── Browser X Scanning (Chrome CDP port 18801)
├── HTTP Social Scanning (Instagram / TikTok / Facebook)
├── Telegram Channel Scanning (web fetch)
├── Phone Verification (carrier + VOIP + spam detection)
├── Risk Scoring (90-pt unified system, 0–10 scale)
├── Scammer Database (CSV 278+ entries + Supabase)
├── Community Integration (Telegram group -1003751594817)
└── Website API (agenticbro.app/api/social-scan)
```

### AI Agent — Jeeevs

- **Name:** Jeeevs
- **Role:** AI-powered scam detection assistant
- **Platform:** OpenClaw single-agent (Phase 3 production)
- **Primary Model:** `glm-5:cloud` → fallbacks: `glm-5.1:cloud` → `kimi-k2.6:cloud` → `qwen3-coder-next:cloud`
- **Telegram Bot:** @Jeeevs222_bot (active)

---

## Risk Scoring System (90-Point Unified)

### Social Media Red Flags

| Flag | Points | Indicator |
|------|--------|-----------|
| `guaranteed_returns` | 25 | Promises guaranteed ROI |
| `giveaway_airdrop` | 20 | Fake giveaways or airdrops |
| `dm_solicitation` | 15 | Asks followers to DM |
| `free_crypto` | 15 | Offers free crypto |
| `alpha_dm_scheme` | 15 | "Exclusive alpha" via DM |
| `unrealistic_claims` | 10 | Unrealistic earnings claims |
| `download_install` | 10 | Pushes app/download links |
| `urgency_tactics` | 10 | Pressure to act immediately |
| `emotional_manipulation` | 10 | Exploits FOMO or fear |
| `low_credibility` | 10 | New account, no history |

### Phone Number Red Flags

| Flag | Points | Indicator |
|------|--------|-----------|
| `invalid_number` | 25 | Number doesn't exist |
| `premium_rate_number` | 25 | Premium rate scam number |
| `voip_number` | 20 | VOIP/disposable number |
| `spoofed_caller_id` | 15 | Caller ID spoofing detected |
| `disposable_number` | 15 | Temporary/burner number |
| `spam_dialer_service` | 15 | Known spam dialer |
| `high_risk_country` | 15 | High-risk country origin |
| `toll_free_untraceable` | 10 | Toll-free, untraceable |
| `landline_text` | 10 | Landline pretending to text |
| `no_carrier_info` | 10 | No carrier data available |
| `medium_risk_country` | 8 | Medium-risk country |
| `unknown_carrier` | 5 | Carrier unknown |

### Risk Levels

| Score | Level |
|-------|-------|
| 0–3 | LOW |
| 3–5 | MEDIUM |
| 5–7 | HIGH |
| 7+ | CRITICAL |

---

## Website

**Live at** [agenticbro.app](https://agenticbro.app)

### Key Features
- **Social Scanner** — Enter a username, get instant risk score with red flag breakdown
- **Phone Verifier** — Check phone numbers for VOIP/spam/disposable indicators
- **Scammer Database** — 278+ known scam profiles
- **Real-time API** — `/api/social-scan` and `/api/phone-verify` endpoints

### Tech Stack
- **Frontend:** React 19 + Vite + TypeScript + TailwindCSS
- **Backend:** Supabase (database + auth)
- **AI:** OpenClaw agent (glm-5:cloud)
- **Hosting:** Vercel
- **Repository:** [maadmaax26/agenticbro](https://github.com/maadmaax26/agenticbro)

---

## Scan Commands

All scans use bash wrapper scripts (direct `python3` calls are blocked by OpenClaw exec preflight):

```bash
# Instagram
bash /workspace/scripts/scan-instagram.sh "<username>"

# TikTok
bash /workspace/scripts/scan-tiktok-command.sh "<username>"

# Facebook
bash /workspace/scripts/scan-facebook.sh "<username>"

# Telegram
bash /workspace/scripts/scan-telegram.sh "<username>"

# Phone Number
bash /workspace/scripts/scan-phone.sh "+14158586273" US

# Universal (any platform)
bash /workspace/scripts/scan-source.sh "<platform>" "<username>"

# X/Twitter — Chrome CDP on port 18801
```

---

## Cron Jobs

| Job | Schedule | Model | Purpose |
|-----|----------|-------|---------|
| `nightly_review` | 2:00 AM EST | glm-5:cloud | Review metrics, deliver to DM |
| `website-deep-scan` | Every 15 min | glm-5:cloud | Scan submitted URLs |

---

## Project Structure

```
agenticbro/
├── src/                          # React frontend (Vite + TS)
│   ├── components/
│   │   ├── PhoneNumberVerifier.tsx  # Phone verification UI
│   │   └── SocialScanForm.tsx       # Social scanner UI
│   └── app/
│       └── api/
│           ├── social-scan.ts        # Social scan API endpoint
│           └── phone-verify.ts       # Phone verify API endpoint
├── scam-detection-framework/        # Python scoring engine
│   └── unified_scoring.py           # 90-point unified risk scorer
├── scripts/                         # Bash scan wrappers
│   ├── scan-instagram.sh
│   ├── scan-tiktok-command.sh
│   ├── scan-facebook.sh
│   ├── scan-telegram.sh
│   ├── scan-phone.sh
│   ├── phone-scan-api.sh
│   └── scan-source.sh
├── scammer-database.csv             # 278+ known scammer entries
├── scam-detection-framework.md      # Detection methodology docs
└── scammer-investigation-guide.md   # Investigation procedures
```

---

## Token Info

| Field | Value |
|-------|-------|
| **Name** | Agentic Bro |
| **Ticker** | $AGNTCBRO |
| **Supply** | 1,000,000,000 |
| **Platform** | Solana / pump.fun |
| **Contract** | `52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump` |
| **Website** | agenticbro.app |
| **X** | [@AgenticBro11](https://x.com/agenticbro11) |

### Token Utility
- **Free tier:** 5 scans free
- **Holder tier:** Hold $100+ in AGNTCBRO → 50 scans/month
- **Scan first, trust later!**

---

## Security & Disclaimers

- Scans use **public profile data only**
- Does **not** verify real-world identity
- May miss sophisticated, well-hidden scams
- Subject to platform rate limits and login walls
- **All scan reports include disclaimer:** Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR.
- **Bot token security:** Never hardcode tokens. @Jeeevs222_bot was previously compromised via token leak.

---

## License

MIT

---

**Scan first, trust later! 🔐**