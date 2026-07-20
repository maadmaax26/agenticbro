# Agentic Bro — Wallet Protection

**Track:** Infrastructure / AI
**Status:** Live Product | Real Users | Production-Ready

---

## One-Liner

Decode Solana transactions before you sign them. See exactly what a transaction does in plain language — with AI-powered risk scoring that catches wallet drainers, hidden fees, and Token-2022 exploits before they drain your wallet.

---

## The Problem

Every day, Solana users lose millions to:
- **Wallet drainers** — transactions that look like small transfers but secretly drain all SPL tokens
- **Token-2022 exploits** — malicious tokens with permanent delegate authority that lets someone freeze or burn your tokens
- **Hidden transfer fees** — Token-2022 tokens with massive fees embedded in the metadata
- **Fake dApps** — phishing sites that trick users into signing malicious transactions
- **Impersonation scams** — fake tokens with identical names/logos to real projects

The $2.3 billion lost to crypto scams in 2024 wasn't smart contract exploits — it was users signing transactions they didn't understand.

---

## The Solution

Agentic Bro Wallet Protection is a live security layer that decodes and scores Solana transactions BEFORE the user signs.

### Core Features

#### 1. Transaction Decoder
- Parses System, SPL, Token-2022, Metaplex, Jupiter, Raydium, and Orca instructions
- Converts raw blockchain data into human-readable steps
- Shows exactly what tokens will be transferred, to which addresses, with what fees

#### 2. Risk Scoring Engine
- 90-point unified scoring system
- Flags wallet drainers (25 pts), permanent delegates (15 pts), hidden fees (10 pts), urgency tactics (10 pts)
- Real-time analysis using Helius RPC + local LLM inference

#### 3. Website Scanner
- Enter any URL → instant security assessment
- Detects wallet drainer scripts, phishing patterns, fake airdrops
- Cross-references regulatory warnings (FCA, SEC)

#### 4. Profile Scanner
- Check X/Instagram/TikTok/Facebook/Telegram usernames
- AI-powered behavioral analysis for scam indicators
- Community-reported scammer database (278+ entries)

#### 5. Token Impersonation Detection
- Compares token metadata against verified originals
- Detects fake tokens with identical names, symbols, logos
- Catches freeze authority abuse and mint authority risks

---

## Live Demo

**Website:** https://agenticbro.app

**Try it now:**
1. Paste a suspicious Solana transaction → get decoded steps
2. Enter a Telegram username → get risk score
3. Enter any URL → get security assessment

**Telegram Community:** @AGNTCBRO (active, 280+ members)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Tailwind |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Blockchain | Helius RPC, Solana Web3.js |
| AI/LLM | Ollama (local inference) + Cloud models |
| Scanning | Chrome CDP (X), Web fetch (IG/TikTok/FB/Telegram) |
| Infrastructure | Mac Studio (DePIN inference node), Vercel |

---

## What Makes This Different

| Feature | Others | Agentic Bro |
|---------|--------|-------------|
| Pre-sign protection | ❌ Post-incident | ✅ Pre-sign decoding |
| Token-2022 support | ❌ Rare | ✅ First-of-kind detection |
| Multi-platform scanning | ❌ Single platform | ✅ X/IG/TikTok/FB/TG |
| Local inference | ❌ Cloud-only | ✅ On-device (privacy) |
| Open-source | ❌ Proprietary | ✅ MIT license |
| Real users | ❌ Demo | ✅ Live product, 280+ community |

---

## Team

**Madmax (@maadmaax22)** — Founder, Solana developer, security researcher
- Built the transaction analysis engine from scratch
- 278+ verified scammers catalogued
- Active in Solana security community

**Jeeevs (AI Agent)** — On-chain security analyst
- Scans 1000+ profiles/week across platforms
- Risk scoring with 90-point framework
- Community protection via Telegram integration

---

## Roadmap (Grant-Funded)

| Milestone | Deliverable | Timeline |
|-----------|-------------|----------|
| Month 1 | Browser extension MVP, Token-2022 API, open-source engine | $11,000 |
| Month 2 | Mobile SDK, public API, paid platform integrations | $12,000 |
| Month 3 | Security audit, community reporting tool, full open-source | $12,000 |

**Post-Grant:** Self-sustaining via $AGNTCBRO holder-gated features + premium API

---

## Public Good Commitment

- ✅ 5 free scans/month for anyone (no token required)
- ✅ Scammer database API (public, rate-limited)
- ✅ Educational content (daily scam prevention tips)
- ✅ Open-source under MIT license
- ✅ All grant deliverables publicly available

---

## Links

| Resource | URL |
|----------|-----|
| Live Product | https://agenticbro.app |
| Contract | 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump |
| Telegram | @AGNTCBRO |
| Website | agenticbro.app |
| This Repo | (GitHub link after submission) |

---

**Scan first, trust later. 🔐**

$AGNTCBRO #Solana #ScamPrevention #CryptoSafety
