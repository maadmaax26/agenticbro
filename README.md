# 🛡️ AgenticBro — Brand Guard

**AI-powered brand protection for businesses of every size.**

> One Shield. Total Protection. · Detect. Monitor. Protect.

**Live at:** [agenticbro.app/brand-guard](https://agenticbro.app/brand-guard)  
**Admin CRM:** [agenticbro.app/brand-guard/admin](https://agenticbro.app/brand-guard/admin) *(restricted)*  
**Built by:** Agentic Insights LLC · Earl B. Finney Jr.

---

## What This Is

Brand Guard is a production B2B brand protection platform built on the AgenticBro infrastructure. It monitors businesses across domains, social platforms, email channels, phone numbers, and marketplaces — detecting impersonation threats in real time and generating ready-to-submit takedown reports.

The platform emerged from AgenticBro's original Web3/crypto scam detection capability and has been expanded into a full SMB brand protection SaaS, targeting fintech, healthcare, ecommerce, and Web3 companies facing brand impersonation, email spoofing, and domain compromise.

---

## Platform Status

| Layer | Status |
|-------|--------|
| 6 scan features | ✅ Live |
| Supabase backend + RLS | ✅ Live |
| Stripe 7 products/prices | ✅ Live |
| Webhook endpoint | ✅ Live |
| 4 payment rails | ✅ Live |
| Auth + auto-confirm | ✅ Live |
| Mobile-responsive dashboard | ✅ Live |
| Admin CRM (Prospect Hunter) | ✅ Live |
| Billing end-to-end (credit deduction, tier enforcement) | 🔧 In progress |
| Domain monitoring cron | 🔧 In progress |
| Takedown Generator | 🔧 In progress |
| Marketplace Scanner (Shopify/Etsy) | 🔧 Planned |
| Visual Fingerprinting (pHash) | 🔧 Planned |
| Alert notifications (email + Telegram) | 🔧 Planned |

---

## Brand Guard Features

### 🔍 Impersonator Scan
Detects fake accounts mimicking a brand across social platforms. Scans X, Instagram, TikTok, Facebook, LinkedIn, and Telegram for copycats, squatting accounts, and impersonation patterns using Chrome CDP + behavioral AI scoring.

### 🌐 Domain Monitor
Scans Certificate Transparency logs via crt.sh for lookalike domain registrations. Catches TLD swaps (.xyz, .shop, .crypto), phishing suffixes (-login.app, -signin.app), and prefix attacks (login-, secure-, verify-) at registration — before the fake site goes live. Each result gets a HIGH/MEDIUM/LOW risk rating.

### 📧 Email Spoof Check
Full SPF/DKIM/DMARC/MX analysis on a 100-point scale:
- SPF: 35 pts
- DMARC: 40 pts
- DKIM: 15 pts
- MX: 10 pts

Ratings: PROTECTED (80+) / LOW (60–79) / MEDIUM (40–59) / HIGH (20–39) / CRITICAL (0–19)

Uses Google DNS-over-HTTPS + crt.sh. No external API dependency.

### 🌍 Website Scan
Scans any URL for threats, phishing indicators, and malware signals using the existing AgenticBro Website Deep Scanner infrastructure and Supabase job queue.

### ⚡ Threat Correlate
Cross-channel risk correlation. Takes signals from multiple scan types — social impersonation, lookalike domains, email spoof risk, phone fraud — and combines them into a unified risk picture and campaign risk score for a brand.

### 📞 Vendor Verify
Phone number fraud check. Validates whether a number is VOIP, disposable, premium rate, spoofed, or tied to high-risk countries. Uses the same 12-signal, 90-point scoring engine as the AgenticBro Phone Identifier, including FTC complaint database integration and STIR-SHAKEN detection.

---

## Pricing

| Tier | Price | Target |
|------|-------|--------|
| **Guardian** | $29/month | SMBs, small ecommerce, freelancers |
| **Sentinel** | $79/month | Growing brands, fintech, healthcare |
| **Fortress** | $199/month | Enterprise, agencies, crypto projects |

**Free trial:** 7 days — no credit card required.

---

## Payment Rails

Four payment methods accepted:
- Stripe card (primary)
- USDC on Solana
- USDC on Base
- $AGNTCBRO token

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + TypeScript + TailwindCSS (aibro/) |
| Backend API | Node.js / TypeScript / Express — port 8080 |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth + auto-confirm endpoint |
| Payments | Stripe (7 products/prices, webhook live) |
| Email | Zoho Mail (agenticbro@agenticbro.app) |
| Cold email infra | Gmail alias (agenticbro@agenticbro.app) via send-as |
| Social scanning | Chrome CDP — port 18800 |
| Local inference | Ollama (Qwen3 suite, GLM-5:cloud primary) |
| Agent framework | OpenClaw — workspace at ~/.openclaw/workspace/agentic-bro/ |
| Execution hardware | Mac Studio M4 Max 36GB ("Jeeevs") |
| Networking | Tailscale mesh |
| Alerts | Telegram bot (@Jeeevs222_bot) |

---

## Repository Structure

```
agenticbro/
├── aibro/                        # React frontend (Next.js/Vite)
│   └── src/
│       ├── pages/
│       │   └── brand-guard/      # Brand Guard dashboard + admin
│       └── components/
│           └── brand-guard/      # Scan UI components
├── server/                       # Express API (port 8080)
│   └── routes/
│       └── brand-guard/          # Scan endpoints
├── services/                     # Core scan services
│   ├── profile-verifier/         # CDP-based social scanner (85 tests passing)
│   ├── takedown-generator/       # [In progress] Report templates
│   └── marketplace-scanner/      # [Planned] Shopify/Etsy crawler + pHash
├── supabase/
│   └── migrations/               # DB schema (RLS, credits, subscriptions)
├── .openclaw/                    # OpenClaw agent configuration
├── src/                          # Shared utilities
├── scripts/                      # Start/stop scripts (launchd)
└── memory/                       # Agent memory system
```

---

## API Endpoints — Brand Guard

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/brand-guard/scan/impersonator` | Social platform scan |
| POST | `/api/brand-guard/scan/domain` | CT log lookalike scan |
| POST | `/api/brand-guard/scan/email` | SPF/DKIM/DMARC check |
| POST | `/api/brand-guard/scan/website` | URL threat scan |
| POST | `/api/brand-guard/scan/correlate` | Cross-channel correlation |
| POST | `/api/brand-guard/scan/vendor` | Phone fraud check |
| POST | `/api/brand-guard/takedown/generate` | [In progress] Takedown report |
| POST | `/api/brand-guard/marketplace/scan` | [Planned] Shopify/Etsy scan |
| POST | `/api/brand-guard/fingerprint/register` | [Planned] Image hash registration |

---

## Supabase Schema

Core tables:

| Table | Purpose |
|-------|---------|
| `users` | Supabase Auth |
| `credits` | Scan credit balance per user |
| `transactions` | Credit deduction log |
| `subscriptions` | Stripe subscription status + tier |
| `brand_guard_reports` | Generated takedown reports |
| `brand_visual_fingerprints` | pHash fingerprints (planned) |
| `marketplace_scan_results` | Shopify/Etsy scan results (planned) |

6 DB functions live including credit management and webhook handlers.

---

## Admin CRM — Prospect Hunter

Located at: `agenticbro.app/brand-guard/admin`
Access restricted to: `agenticbro@agenticbro.app`

The admin panel includes an AI-powered Prospect Hunter that:
- Searches for real companies with documented brand impersonation incidents
- Classifies threat type (Cloned Store, Fake Social Accounts, Lookalike Domain, Email Spoofing, Vendor Fraud, Telegram Impersonation)
- Generates threat intelligence briefs via Claude API
- Writes personalised cold outreach emails based on verified scan data
- Tracks outreach status through a full pipeline (pending → contacted → replied → converted)
- Exports to CSV

---

## GTM Automation System (7-Agent Pipeline)

| Agent | Role | Status |
|-------|------|--------|
| Prospect Hunter | Finds companies with documented brand impersonation | ✅ Live in admin |
| Outreach Automator | Personalised threat brief emails via Gmail + Zoho | ✅ Active |
| Content Engine | LinkedIn + SEO content | 🔧 Planned |
| Trial Concierge | 7-day trial activation sequence | 🔧 Planned |
| Ops Coordinator | Routes data between agents | 🔧 Planned |
| Product Feedback | Captures friction from churned/converted users | 🔧 Planned |
| BI Analyst | Weekly automated KPI report | 🔧 Planned |

---

## Email Deliverability Configuration

| Mail Infrastructure | Send Channel |
|---------------------|-------------|
| Exchange Online targets | Gmail alias (agenticbro@agenticbro.app) |
| Proofpoint targets | Gmail alias |
| Google Workspace targets | Zoho Mail (agenticbro@agenticbro.app) |
| Self-hosted / other | Zoho Mail |

DKIM verified on agenticbro.app via Zoho (zoho._domainkey selector).  
DMARC: p=reject  
SPF: v=spf1 include:zohomail.com -all

---

## Development Setup

### Prerequisites

- Node.js 18+
- Supabase project (URL + anon key + service role key)
- Stripe account (webhook endpoint configured)
- Ollama running locally (or GLM cloud API)
- Chrome with remote debugging enabled (port 18800) for CDP scans

### Environment Variables

```bash
cp .env.example .env

# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
ANTHROPIC_API_KEY=

# AI routing
OLLAMA_API_URL=https://api.ollama.com
OLLAMA_MODEL=glm-5:cloud

# Optional
TELEGRAM_BOT_TOKEN=
HELIUS_API_KEY=
```

### Run Locally

```bash
# Install dependencies
npm install

# Start backend API (port 8080)
./scripts/start-profile-verifier.sh

# Start frontend
cd aibro && npm run dev
```

### Run Tests

```bash
npm test
# 85+ passing tests, 100% verifier coverage
```

---

## Deployment

Production runs on Jeeevs (Mac Studio M4 Max) via launchd services.

```bash
# Deploy frontend
cd aibro && npm run build

# Backend is managed via launchd plist
# See: agenticbro-backend-server.plist
# See: com.agenticbro.profile-verifier.plist
```

---

## Roadmap

### Immediate (unblocking billing)
- [ ] Billing activation: credits deduct on each scan, tiers enforce limits, trial expires at day 7
- [ ] Trial activation email sequence (Day 0/1/3/5/6/7 via Supabase cron)
- [ ] `payment_method_collection: 'if_required'` on all Stripe checkout sessions

### Phase 2 (conversion)
- [ ] Takedown Generator: 5 platform templates (Shopify, Etsy, domain registrar, social abuse, DMCA)
- [ ] Domain monitoring cron (weekly for Guardian, daily for Sentinel)
- [ ] Alert notifications: email + Telegram when new threat detected

### Phase 3 (retention + expansion)
- [ ] Marketplace Scanner: Shopify and Etsy crawler using existing Website Deep Scanner pattern
- [ ] Visual Fingerprinting: pHash-based image comparison for cloned store detection
- [ ] Scan-to-PDF export with Brand Guard branding
- [ ] Cross-platform campaign clustering in Threat Correlate

---

## Target Market

**TAM:** $64B+ combined brand protection market

**Primary verticals:**
- Ecommerce / Shopify merchants (clone store attacks)
- Healthcare SMBs (post-breach impersonation)
- Fintech / Web3 (fake social accounts, email spoofing, DMARC gaps)
- Professional services (vendor invoice fraud, BEC)
- SaaS / EdTech (lookalike domains, credential harvesting)

**Pricing competitive set:** ChainPatrol ($500+/mo), BrandShield ($299–$999/mo), ZeroFox ($2,000–$10,000/mo). Brand Guard is the only option built for SMBs under $200/mo.

---

## Contact

**Earl B. Finney Jr.**  
Founder, Agentic Insights LLC  
agenticbro@agenticbro.app  
[linkedin.com/in/earl-finney-60259a4](https://linkedin.com/in/earl-finney-60259a4)

---

*One Shield. Total Protection. · Scan First. Trust Later. Stay Safe.*
