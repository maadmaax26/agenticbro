# 🔍 Agentic Bro — AI Scam Detection for Solana

**$AGNTCBRO** | **Contract:** `52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump` (Solana)

AI-powered scam detection protecting crypto investors across X/Twitter, Instagram, TikTok, Facebook, Telegram, phone numbers, email domains, and websites. Real-time risk scoring, scammer database, brand protection, and community alerts.

**Website:** [agenticbro.app](https://agenticbro.app) | **X:** [@AgenticBro11](https://x.com/agenticbro11) | **Telegram:** t.me/AGNTCBRO

---

## Features

### Multi-Platform Scanning

| Platform | Method | Status |
|----------|--------|--------|
| **X / Twitter** | Chrome CDP (port 18801) + Supabase queue worker | ✅ Live |
| **Instagram** | HTTP API + login-wall detection | ✅ Live |
| **TikTok** | HTTP API | ✅ Live |
| **Facebook** | HTTP API | ✅ Live |
| **Telegram** | Web fetch + channel analysis | ✅ Live |
| **Phone Numbers** | API-based carrier/VOIP/spam detection | ✅ Live |
| **Website/URL** | Deep-scan via website API | ✅ Live |
| **Email/Domain** | SPF/DKIM/DMARC + CertStream lookalike detection | ✅ Live |
| **Brand Impersonation** | Cross-platform monitor + takedown actions | ✅ Live |

### Scan Example

```
Risk Score: 7.5/10 — HIGH ⚠️

Red Flags:
• guaranteed_returns (+25) — Promises unrealistic ROI
• giveaway_airdrop (+20) — Fake giveaway/airdrop promoted
• dm_solicitation (+15) — Asks followers to DM for "opportunities"
• urgency_tactics (+10) — "Act now or miss out" pressure

Behavioral Pattern: Classic giveaway scam — inflates trust with small payouts, then rugs.

Educational purposes only. Not financial advice. Always DYOR. Scan date: 2026-06-02
```

### Brand Guard

Enterprise-grade brand protection for businesses:

- **Impersonator Detection** — Finds fake accounts mimicking your brand across platforms
- **Domain Monitoring** — Watches for lookalike domains via Certificate Transparency (crt.sh)
- **Email Spoof Checks** — SPF/DKIM/DMARC scoring (100-point scale)
- **Vendor Verification** — Verify if a vendor/contact actually works for the claimed company
- **Takedown Actions** — Generate and track DMCA/abuse reports for impersonators
- **Credits System** — Free scans + paid tiers via Stripe integration

---

## Architecture

```
Jeeevs (OpenClaw Agent — Mac Studio)
├── Browser X Scanning (Chrome CDP port 18801)
├── HTTP Social Scanning (Instagram / TikTok / Facebook)
├── Telegram Channel Scanning (web fetch)
├── Phone Verification (carrier + VOIP + spam detection)
├── Email/Domain Security (SPF/DKIM/DMARC + CertStream)
├── Brand Guard (impersonation + domain monitoring + takedowns)
├── Risk Scoring (90-pt unified system, 0–10 scale)
├── Scammer Database (CSV 278+ entries + Supabase)
├── Community Integration (Telegram group -1003751594817)
├── launchd Workers (scan-worker + x-scan-worker)
└── Website API (agenticbro.app/api/*)
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

### Pages & Features

| Page | Route | Description |
|------|-------|-------------|
| **Home** | `/` | Scanner, token info, roadmap |
| **Brand Guard** | `/brand-guard` | Business brand protection dashboard |
| **Brand Guard Admin** | `/brand-guard/admin` | Admin dashboard for brand monitoring |
| **Wallet Protection** | `/wallet-protection` | Transaction review & approval simulator |
| **Payment Success** | `/payment/success` | Stripe payment confirmation |

### Key Components

- **SocialScanForm** — Multi-platform social media scanner
- **PhoneNumberVerifier** — Phone number risk verification
- **WebsiteSecurityScanner** — URL deep-scan
- **TokenScanner / TokenImpersonationScanner** — Token scam detection
- **ProfileVerifierScanner** — Profile authenticity checker
- **AgntcbroBalanceTracker** — $AGNTCBRO holder tier detection
- **ScanAnalytics** — Scan metrics dashboard
- **WalletProtector** — Transaction approval & risk review
- **Brand Guard** — Impersonation monitor, domain monitor, email spoof, vendor verify

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/social-scan` | Social media profile scan |
| `/api/phone-verify` | Phone number verification |
| `/api/phone-scan` | Phone risk scan (async) |
| `/api/scan` | General scan (async, queued) |
| `/api/scan-report` | Scan report generation |
| `/api/website-deep-scan` | Website security deep-scan |
| `/api/brand-guard/email-spoof` | SPF/DKIM/DMARC + lookalike domain check |
| `/api/brand-guard/impersonator-scan` | Brand impersonation scanner |
| `/api/brand-guard/domain-monitor` | Domain monitoring |
| `/api/brand-guard/vendor-verify` | Vendor employment verification |
| `/api/brand-guard/threat-correlate` | Cross-platform threat correlation |
| `/api/brand-guard/brands` | Brand CRUD management |
| `/api/brand-guard/credits` | Stripe credit management |
| `/api/brand-guard/dashboard` | Dashboard analytics |
| `/api/brand-guard/admin` | Admin operations |
| `/api/scam-investigate` | Deep scam investigation |
| `/api/token-2022-check` | Token-2022 scam detection |
| `/api/transaction-analyze` | Transaction risk analysis |

### Tech Stack

- **Frontend:** React 19 + Vite + TypeScript + TailwindCSS
- **Backend:** Supabase (database + auth + RLS)
- **AI:** OpenClaw agent (glm-5:cloud)
- **Payments:** Stripe (credit purchases)
- **Hosting:** Vercel
- **Database:** Supabase PostgreSQL with Row-Level Security

---

## Database (Supabase)

### Schema

26 tables with Row-Level Security enabled on all. Key tables:

| Table | Purpose | RLS Policy |
|-------|---------|------------|
| `scan_results` | Social scan results | Public read, service_role write |
| `scammers` | Known scammer database | Public read, service_role write |
| `scan_jobs` | Async scan queue | Public read, service_role write |
| `scan_events` | Scan analytics | Public read, service_role write |
| `brand_monitors` | Brand monitoring config | Owner-scoped (auth.uid) |
| `brand_impersonators` | Detected impersonators | Owner-scoped |
| `brand_guard_credits` | User scan credits | Owner-scoped |
| `takedown_actions` | DMCA/abuse actions | Owner-scoped + service_role |
| `threat_profiles` | Threat intelligence | Owner-scoped + service_role |
| `email_spoof_checks` | SPF/DKIM/DMARC results | Public read, service_role write |
| `vendor_verifications` | Vendor check results | Public read, service_role write |

### Security

- **All tables have RLS enabled** with appropriate policies
- **Views referencing `auth.users`** use `WHERE u.id = auth.uid()` filter + `security_barrier`
- **Anon access** restricted to read-only on public data tables
- **Owner-scoped tables** restrict access to authenticated user's own data
- **Service role** has full CRUD for background workers

### Migrations

Located in `supabase/migrations/`:

| File | Description |
|------|-------------|
| `001_scan_results_and_scammers.sql` | Core scan tables |
| `002_scan_events_analytics.sql` | Analytics events |
| `003_scan_analytics.sql` | Analytics views |
| `004_rls_security_hardening.sql` | RLS policies hardening |
| `005_security_fix_auth_users_and_rls.sql` | Auth view exposure + RLS fixes |
| `20260528000000_brand_guard_full_schema.sql` | Brand Guard tables |
| `20260529000000_brand_guard_promo_code.sql` | Promo code support |
| `20260529000001_email_spoof_checks.sql` | Email spoof checks |

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
# X scans are processed via Supabase queue (scan_jobs table)
```

---

## Cron Jobs & Workers

| Job / Worker | Schedule | Model | Purpose |
|-----|----------|-------|---------|
| `nightly_review` | 2:00 AM EST | glm-5:cloud | Review metrics, deliver to DM |
| `website-deep-scan` | Every 15 min | glm-5:cloud | Scan submitted URLs |
| `group-morning-vibe` | 9:00 AM EST | glm-5:cloud | Positive morning post to group |
| `group-evening-vibe` | 7:00 PM EST | glm-5:cloud | Positive evening post to group |
| `x-engagement-monitor` | 9:00 AM EST | glm-5:cloud | DM only — X outreach targets |
| `x-scan-worker` | Every 10s (launchd) | — | Processes Supabase scan_jobs for X CDP |
| `scan-worker` | Continuous (launchd) | — | Token/wallet/profile scans |

---

## Project Structure

```
agenticbro/
├── src/                              # React frontend (Vite + TS)
│   ├── components/                   # 27 UI components
│   │   ├── dashboard/                # Holder dashboard, whale, signals, etc.
│   │   ├── WalletProtector/          # Transaction review & approval
│   │   ├── wallet-simulator/         # Safe transaction simulator
│   │   ├── PhoneNumberVerifier.tsx   # Phone verification UI
│   │   ├── SocialScanForm.tsx        # Social scanner UI
│   │   ├── WebsiteSecurityScanner.tsx # URL deep-scan UI
│   │   ├── TokenScanner.tsx          # Token scam detection
│   │   ├── TokenImpersonationScanner.tsx
│   │   ├── ProfileVerifierScanner.tsx
│   │   ├── AgntcbroBalanceTracker.tsx # $AGNTCBRO holder tier
│   │   ├── ScanAnalytics.tsx
│   │   └── ...                       # Auth, payment, roadmap, etc.
│   ├── pages/                        # Route pages
│   │   ├── BrandGuardPage.tsx
│   │   ├── BrandGuardAdminPage.tsx
│   │   ├── WalletProtectionPage.tsx
│   │   └── PaymentSuccess.tsx
│   ├── hooks/                        # Custom React hooks
│   └── lib/                          # Utilities, payments, Supabase client
├── api/                              # Vercel serverless functions (27 endpoints)
│   ├── social-scan.ts
│   ├── phone-verify.ts / phone-scan.ts
│   ├── website-deep-scan.ts
│   ├── brand-guard/                  # Brand Guard API suite
│   │   ├── email-spoof.ts
│   │   ├── impersonator-scan.ts
│   │   ├── domain-monitor.ts
│   │   ├── vendor-verify.ts
│   │   ├── threat-correlate.ts
│   │   ├── brands.ts / credits.ts / dashboard.ts / admin.ts
│   │   └── stripe-webhook.ts
│   ├── scan-report.ts
│   ├── scam-investigate.ts
│   ├── token-2022-check.ts
│   └── transaction-analyze.ts
├── supabase/migrations/              # Database migrations (8 files)
├── scam-detection-framework/         # Python scoring engine
│   └── unified_scoring.py            # 90-point unified risk scorer
├── scripts/                          # Bash scan wrappers
│   ├── scan-instagram.sh
│   ├── scan-tiktok-command.sh
│   ├── scan-facebook.sh
│   ├── scan-telegram.sh
│   ├── scan-phone.sh / phone-scan-api.sh
│   └── scan-source.sh
├── scammer-database.csv              # 278+ known scammer entries
├── scam-detection-framework.md       # Detection methodology docs
└── scammer-investigation-guide.md    # Investigation procedures
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

- **Free tier:** First 25 scans free
- **Holder tier:** Hold $100+ in AGNTCBRO → 50 scans/month
- **Brand Guard:** Credit-based enterprise brand protection

---

## Security & Disclaimers

- Scans use **public profile data only**
- Does **not** verify real-world identity
- May miss sophisticated, well-hidden scams
- Subject to platform rate limits and login walls
- **All scan reports include disclaimer:** Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR.
- **Bot token security:** Never hardcode tokens. @Jeeevs222_bot was previously compromised via token leak.
- **Database security:** All Supabase tables have RLS enabled. Views referencing `auth.users` use `WHERE auth.uid()` filter + `security_barrier`.

---

## Company

**Agentic Insights LLC** — Earl Finney Jr., Founder

---

## License

MIT

---

**Scan first, trust later! 🔐**