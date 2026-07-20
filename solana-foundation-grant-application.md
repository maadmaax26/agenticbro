# Solana Foundation Grant Application — Agentic Bro ($AGNTCBRO)

**Application URL:** https://share.hsforms.com/1GE1hYdApQGaDiCgaiWMXHA5lohw

---

## Project Overview

**Project Name:** Agentic Bro — AI-Powered Scam Detection for Solana

**Brief Description:**
Agentic Bro is an AI-powered scam detection and wallet protection platform built on Solana. It provides real-time risk assessment across 7+ platforms (X/Twitter, Instagram, TikTok, Facebook, Telegram, phone numbers, and websites) using a 90-point unified risk scoring system. The system is live at agenticbro.app with 278+ scammers tracked, a holder-gated token model ($AGNTCBRO), and a Wallet Protection system that analyzes Solana transactions before signing — catching wallet drainers, token-2022 exploits, and phishing sites in real-time.

Agentic Bro is consumer protection infrastructure for Solana. Users who feel safe buy and hold. This is the missing layer that makes Solana accessible and trustworthy for everyday users.

---

## How Your Project Provides a Public Good for the Solana Network

### 1. Open-Source Security Tooling
All scanning engines are open-source and free to use (5 free scans/month for non-holders). Our scam detection framework, risk scoring algorithms, and wallet protection APIs are public goods that any Solana developer can integrate.

### 2. Free Community Protection
- **Profile Scanner:** Real-time scam risk assessment for X, Instagram, TikTok, Facebook, and Telegram
- **Phone Identifier:** Live FTC scam call database integration
- **Website Scanner:** Detects wallet drainers, phishing, and seed phrase harvesting before connecting
- **Token Scanner:** Identifies honeypots, sell taxes, mint authority, and Token-2022 dangerous extensions
- **Wallet Protection:** Simulates dApp interactions to catch malicious transactions before signing

### 3. Scammer Database (Public Good)
278+ verified scammer entries with growing community contributions. This database protects ALL Solana users, not just $AGNTCBRO holders.

### 4. Educational Content
Daily scam prevention tips, educational threads about common crypto scams, and community warnings — all public and free.

### 5. Reducing Fraud = Increasing Trust = Growing Solana
Every user scammed on Solana is a user lost forever. Agentic Bro directly reduces the $8.8B/year crypto scam problem by giving users tools to verify before they trust. This is infrastructure that makes Solana safer for everyone.

---

## Why Solana?

### Solana-Specific Advantages
1. **Token-2022 Detection:** We're the first to build dangerous Token-2022 extension detection (permanent delegate, transfer fees, confidential transfers) — only relevant on Solana
2. **Wallet Protection API:** Simulates Solana dApp interactions and decodes Solana transaction instructions (System, SPL Token, Token-2022, Metaplex, Jupiter, Raydium, Orca)
3. **Transaction Analysis Engine:** Parses base58/base64 Solana transactions and scores risk 0-10 with 25+ drain pattern detection
4. **Low-Cost Scanning:** Solana's low gas fees make on-chain scam verification economically viable — we can check token metadata, freeze authority, and mint authority for fractions of a cent
5. **Speed:** Real-time risk scoring (<5 seconds) possible because of Solana's fast finality

Agentic Bro isn't just built ON Solana — it's built FOR Solana. The problems we solve (wallet drainers, token scams, phishing dApps) are Solana-specific attack vectors that generic security tools can't address.

---

## Budget Proposal

### Total Requested: $35,000 USDC

**Why $35,000, not $25,000:** The platform currently runs on free/rate-limited API tiers. Scaling to production — reliable scanning, paid RPC nodes, proper database hosting — requires paid API access. Without it, users hit rate limits mid-scan. This budget covers development AND the infrastructure needed to actually serve users at scale.

### Current Operating Costs

| Expense | Monthly | Annual |
|---------|----------|--------|
| Ollama API (LLM for Jeeevs) | $100 | $1,200 |
| Website Hosting (Vercel) | $60 | $720 |
| **Current Total** | **$160/mo** | **$1,920/yr** |

### Scaling Costs (Free → Paid API Tiers)

Currently all scanning APIs run on free tiers with rate limits. Scaling requires:

| API/Service | Free Tier | Paid Tier | Monthly Cost |
|------------|-----------|-----------|--------------|
| Supabase (DB + auth) | 500MB, 50K rows | Pro: 8GB, unlimited | $25 |
| Helius RPC (Solana) | Public endpoints, rate-limited | Developer: reliable, fast | $49 |
| Brave Search (web reputation) | 2K queries/mo | ~10K queries/mo | $30 |
| Instagram/TikTok/FB APIs | Rate-limited, unreliable | Reliable access | $150 |
| Phone Verification (Numverify) | 100 queries/mo | Production volumes | $50 |
| Monitoring/Uptime | — | BetterUptime | $20 |
| Domain/SSL/Email | — | Included | $10 |
| **Scaled Monthly Total** | | | **$494/mo** |

### Hardware (Sunk Cost)

| Item | Cost | Status |
|------|------|--------|
| Mac Studio (DePIN inference node) | $5,000 | Already purchased |

### Full Budget Breakdown

| Category | Amount | Description |
|----------|--------|-------------|
| Development (3 months) | $15,000 | Full-time development: browser extension, mobile SDK, Token-2022 improvements, public API, community tool |
| Infrastructure (12 months) | $5,928 | Hosting, APIs, RPC, database, monitoring — scaled to production |
| Hardware | $5,000 | Mac Studio DePIN node (sunk cost, already operational) |
| Security Audit | $5,000 | Third-party audit of Wallet Protection transaction engine |
| Contingency (13%) | $4,072 | Buffer for API cost overruns, unexpected infrastructure needs |
| **Total** | **$35,000** | |

### Development Budget Detail

| Deliverable | Cost | Timeline |
|-------------|------|----------|
| Browser Extension (Chrome) | $4,000 | Month 1 |
| Mobile SDK (React Native) | $4,000 | Month 2 |
| Token-2022 Detection Improvements | $2,000 | Month 1 |
| Public API + Documentation | $3,000 | Month 2 |
| Community Reporting Tool | $2,000 | Month 3 |
| **Total** | **$15,000** | |

### Milestones

**Milestone 1 — Month 1 ($11,000):**
- [ ] Open-source Wallet Protection transaction analysis engine
- [ ] Token-2022 dangerous extension detection API (public endpoint)
- [ ] Chrome browser extension MVP for real-time Solana transaction screening
- [ ] Scammer database API (public, rate-limited)
- [ ] Infrastructure: Supabase Pro, Helius RPC, Brave Search API

**Milestone 2 — Month 2 ($12,000):**
- [ ] Mobile SDK for Wallet Protection (React Native)
- [ ] Public API with full documentation and developer guides
- [ ] Paid social media API integration (Instagram, TikTok, Facebook)
- [ ] dApp Simulator improvements — support for top 20 Solana dApps
- [ ] Phone verification API production integration

**Milestone 3 — Month 3 ($12,000):**
- [ ] Security audit of transaction analysis engine
- [ ] Community reporting tool (submit scammer profiles)
- [ ] Educational content series (10+ articles on Solana scam prevention)
- [ ] Performance benchmarking — sub-2-second scan times
- [ ] Full documentation and open-source release

**Post-Grant Sustainability:**
After the 3-month development period, monthly infrastructure costs are ~$494/mo, sustainable through:
- Holder-gated scan limits ($AGNTCBRO holders get unlimited scans)
- Premium API access for developers
- Community growth driving token utility

---

## Team

**Madmax** — Founder & Lead Developer
- Built entire Agentic Bro platform (scanning engines, risk scoring, wallet protection, website)
- Full-stack: React, TypeScript, Solana/web3.js, Python, Supabase
- Live product at agenticbro.app with active community

**Jeeevs (AI Agent)** — Automated Operations
- 24/7 scam detection, community monitoring, automated responses
- Built on OpenClaw agent framework with custom scanning pipelines

---

## Current Traction

| Metric | Value |
|--------|-------|
| Scammer Database | 278+ entries |
| Platforms Scanned | 7 (X, IG, TikTok, FB, Telegram, Phone, Website) |
| Risk Scoring | 90-point unified system, 0-10 scale |
| Website | agenticbro.app (live) |
| Token | $AGNTCBRO on Solana (52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump) |
| Holder-Gated | 5 free scans, 50 scans a month for $100+ holders, unlimited for $1000+ holders |
| Wallet Protection | Live — transaction analysis, Token-2022 detection, dApp simulator |
| Community | Telegram group with active scam alerts |

---

## Open Source Commitment

All grant-funded deliverables will be open-sourced under MIT license:
- Transaction analysis engine (TypeScript)
- Token-2022 dangerous extension detector
- Scammer database API (rate-limited public endpoint)
- Browser extension for Solana transaction screening
- Mobile SDK for Wallet Protection

Existing open-source contributions:
- Scam detection framework (public documentation)
- 90-point unified risk scoring system (public methodology)
- Scammer database (community-contributed, 278+ entries)

---

## Impact on Solana Ecosystem

1. **Reduced Fraud:** Direct detection and prevention of wallet drainers, phishing, and token scams
2. **Increased Trust:** Users who feel safe are more likely to buy, hold, and transact on Solana
3. **Developer Tooling:** Public APIs and SDKs that any Solana developer can integrate
4. **Education:** Free scam prevention content that reaches beyond our direct users
5. **Onboarding:** Wallet Protection makes trying new Solana dApps safer, reducing friction for newcomers
6. **Network Effects:** Every scammer identified and reported protects ALL Solana users, not just Agentic Bro users

---

## Links

- **Website:** https://agenticbro.app
- **Token:** 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
- **Twitter/X:** @AgenticBro
- **Telegram:** @AGNTCBRO community group
- **GitHub:** (to be created — open-sourcing grant deliverables)

---

## Additional Notes

Agentic Bro is live and operational today. We're not a concept or whitepaper — we have a working product with real users, a growing scammer database, and a community that relies on our tools for safety. The Solana Foundation grant would accelerate our roadmap from "working product" to "essential infrastructure" by funding:

1. **Browser extension** — bring Wallet Protection to every Solana user's browser
2. **Public API** — let any Solana dApp integrate scam detection
3. **Security audit** — ensure our transaction analysis is bulletproof
4. **Open-source release** — make all grant-funded code available to the entire ecosystem

We believe consumer protection is the highest-leverage public good Solana can invest in. Every dollar lost to scams is a user lost forever. Agentic Bro ensures that doesn't happen.

**Scan first, trust later. 🔐**