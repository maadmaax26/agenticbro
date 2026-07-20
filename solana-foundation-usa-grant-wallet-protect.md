# Solana Foundation USA Grant Application — Wallet Protect

**Project:** Agentic Bro — Wallet Protect  
**Requested Amount:** $10,000 USDG  
**Applicant:** Agentic Insights LLC (Earl Finney Jr., Founder)  
**Location:** United States  
**Website:** agenticbro.app  
**Grant Timeline:** July 1, 2026 – October 31, 2026 (4 months)  

---

## Project Overview

**Wallet Protect** is a Solana-native transaction analysis engine that decodes and scores any Solana transaction before the user signs it — catching wallet drainers, Token-2022 exploits, malicious approvals, and phishing dApps in real time.

Built as part of Agentic Bro (agenticbro.app), Wallet Protect addresses the #1 attack vector on Solana: users signing malicious transactions. In 2024, over $2.3 billion was lost to crypto scams, with Solana users disproportionately affected by drainer scripts, Token-2022 permanent delegate attacks, and hidden transfer fees.

Wallet Protect currently exists as a functional prototype on agenticbro.app with:
- Full transaction decoding (System, SPL Token, Token-2022, Metaplex, Jupiter, Raydium, Orca, and more)
- Risk scoring engine (0-10 scale) with pattern detection for drainer combos
- Token-2022 dangerous extension detector (permanent delegate, transfer fees, mint close authority, confidential transfers, default frozen accounts)
- Known drainer address database (278+ entries)
- Quick Check mode for paste-and-analyze transactions
- Simulator mode for exploring transaction outcomes

This grant funds production hardening, Chrome extension development, security audit, and open-source release of the Wallet Protect engine.

---

## Problem Statement

### Users are signing transactions blind

When a Solana user connects their wallet to a dApp and clicks "Approve," they see a wall of base58-encoded instruction data. They have no idea what the transaction actually does. This is the root cause of the most devastating losses on Solana:

- **Wallet drainers** — single transactions that drain all SPL tokens and SOL
- **Token-2022 permanent delegate attacks** — creators can freeze or burn tokens they don't own
- **Hidden transfer fees** — Token-2022's `TransferFeeConfig` allows creators to silently take a percentage of every transfer
- **Malicious approval cascades** — a single "approve" instruction grants unlimited spending authority to a drainer contract
- **Phishing dApps** — fake sites that look like Jupiter, Raydium, or Magic Eden but inject drainer transactions

### Current tools are insufficient

Existing Solana safety tools (Wallet Guard, Scam Sniffer) are primarily browser extensions that rely on static blacklists and heuristics. They:
- Don't decode Token-2022 extensions (the fastest-growing attack surface on Solana)
- Can't explain what a transaction does in plain language
- Don't score risk — they only flag known-bad addresses
- Are closed-source and not composable by other developers

Wallet Protect solves all of these gaps.

---

## How Wallet Protect Works

### Transaction Parser
Decodes any Solana transaction (legacy and Versioned) into human-readable instructions:
- Identifies the program for each instruction (System, SPL Token, Token-2022, Associated Token, Metaplex, Jupiter, Raydium, Orca, Marinade, Wormhole, Compute Budget, etc.)
- Extracts instruction type from discriminators (transfer, approve, setAuthority, mintTo, burn, freezeAccount, etc.)
- Resolves accounts and amounts
- Produces a plain-English summary: *"Transfer 5 SOL to unknown address"*, *"Grant unlimited approval to delegate [address]"*, *"Set permanent delegate on your token account"*

### Token-2022 Extension Detector
Scans Token-2022 mints for dangerous extensions and scores each one:

| Extension | Risk | Score | Why |
|-----------|------|-------|-----|
| Permanent Delegate | 🔴 Critical | 10 | Creator can transfer/burn ANY holder's tokens |
| Transfer Fee Config | 🟠 High | 7 | Hidden fees on every transfer |
| Mint Close Authority | 🟠 High | 7 | Creator can close mint, freezing supply |
| Confidential Transfer | 🟡 Medium | 5 | Hidden transfer amounts |
| Default Account State (Frozen) | 🟡 Medium | 5 | Accounts start frozen |
| CPI Guard | 🟢 Low | 2 | Restricts cross-program calls |

This is the **first Token-2022 dangerous extension detector** available as a public tool on Solana.

### Risk Engine
Combines parsed instructions with context-aware scoring:
- **Base risk** per instruction type (transfer=1, approve=2, setAuthority=8, permanentDelegate=10)
- **Modifiers** based on context (unknown destination +3, unlimited approval +5, known drainer address +8, all balance at risk +5)
- **Cross-instruction pattern detection** — flags drainer combos (approve + transfer all, setAuthority + close)
- **Address reputation** — checks against known drainer addresses and known safe contracts
- **Wallet impact estimate** — calculates SOL at risk, tokens at risk, approvals requested, authority changes

Final output: a 0-10 risk score with recommendation (APPROVE / CAUTION / REJECT / BLOCK) and a human-readable explanation.

### Quick Check
Users paste a serialized transaction (base58 or base64) and get instant analysis. No wallet connection required.

---

## Why This Is a Public Good

Every feature we build protects ALL Solana users — not just $AGNTCBRO holders:

1. **Free analysis** — Quick Check is free for anyone, no wallet connection, no sign-up
2. **Open-source engine** — The transaction parser, Token-2022 detector, and risk engine will be released under MIT license
3. **Token-2022 protection** — First public tool that detects dangerous Token-2022 extensions before users interact with a token
4. **Known drainer database** — Our scammer database (278+ entries) will become a public, rate-limited API
5. **Educational multiplier** — Every scan teaches users what to look for, protecting their entire network

Every user scammed on Solana is a user lost forever. Wallet Protect stops scams before they happen — at the point of signing, which is the last line of defense.

---

## Deliverables and Milestones

### Milestone 1 — July 1 to July 31 ($3,500)

**Open-Source Transaction Analysis Engine + Token-2022 Detector**

| Deliverable | Description | Verification |
|-------------|-------------|--------------|
| Transaction parser (TypeScript) | Full instruction decoder for System, SPL Token, Token-2022, Associated Token, Metaplex, Jupiter, Raydium, Orca, Marinade, Wormhole, Compute Budget, Memo, Stake, Vote, Config, Serum, OpenBook, Candy Machine, Candy Guard | GitHub repo with test suite, 95%+ instruction coverage |
| Human-readable summaries | Plain-English output for every decoded instruction | Example: "Transfer 5 SOL to unknown address", "Grant unlimited approval to [address]" |
| npm package | Published to npm with TypeScript types, docs, and SDK examples | `npm install @agenticbro/solana-tx-parser` installable |
| Token-2022 extension detector | Detect all 18 Token-2022 extension types with risk scoring per extension | Public API: `POST /api/token-2022-analyze` returning structured JSON |
| Known drainer address API | Public, rate-limited endpoint with 300+ known scam addresses | `GET /api/known-addresses` returning verified address list |

**Milestone 1 Acceptance Criteria:**
- [ ] npm package installable and functional
- [ ] Transaction parser decodes top 20 Solana program instructions with 95%+ accuracy
- [ ] Token-2022 detector identifies all 18 extension types with risk scores
- [ ] Both API endpoints returning valid JSON responses
- [ ] 50+ unit tests passing
- [ ] README with installation and usage documentation

---

### Milestone 2 — August 1 to August 31 ($3,500)

**Chrome Extension MVP + Public API + Wallet Health Score**

| Deliverable | Description | Verification |
|-------------|-------------|--------------|
| Chrome browser extension (Manifest V3) | Wallet Protect overlay on Solana dApps when a transaction is pending — decodes, scores, and displays risk in real time | Extension installable from Chrome Web Store developer mode |
| Transaction interceptor | Detect pending Solana transactions in browser, decode before signing | Works with Phantom, Solflare, Backpack wallets |
| Drainer pattern detection | Flag dangerous combos: approve+transfer all, setAuthority+close, permanentDelegate+burn | Pattern detection with 90%+ accuracy on known drainer transactions |
| Public API documentation | Full REST API docs with rate limiting, SDK examples, and error codes | `POST /api/transaction-analyze`, `POST /api/token-2022-analyze`, `GET /api/known-addresses` |
| dApp integration testing | Tested against top 20 Solana dApps | Jupiter, Raydium, Orca, Marinade, Magic Eden, Tensor, Meteora, Phoenix, Drift, Kamino, MarginFi, Solend, Lido, Jito, Squads, Realms, Wormhole, Helium, Render, Pyth |
| Wallet Health Score (beta) | Scan all active dApp approvals, calculate 0-100 health score, suggest revocations | `POST /api/wallet-health` returning score + recommendations |

**Milestone 2 Acceptance Criteria:**
- [ ] Chrome extension installable and functional on developer mode
- [ ] Transaction interceptor detects pending transactions on 3+ wallets
- [ ] Extension displays risk score + plain-English explanation on dApps
- [ ] Drainer pattern detection flags known attack patterns with 90%+ accuracy
- [ ] API documentation complete with curl examples and rate limits
- [ ] Tested on 10+ Solana dApps without errors
- [ ] Wallet Health Score returns 0-100 score with actionable recommendations

---

### Milestone 3 — September 1 to October 31 ($3,000)

**Security Audit + Performance + Open-Source Release + Educational Content**

| Deliverable | Description | Verification |
|-------------|-------------|--------------|
| Security audit | Third-party review of transaction parsing engine, risk scoring, and extension | Audit report from OtterSec, Neodyme, or equivalent |
| Performance optimization | Sub-2-second analysis for 95th percentile of transactions | Benchmark results, load test report |
| Community reporting tool | Users flag false positives/negatives directly from extension and API | In-app UI + API endpoint for feedback |
| Full open-source release | MIT license on GitHub — engine, detector, extension | Public repo with MIT LICENSE, CONTRIBUTING.md, issue templates |
| Educational content | 5+ articles on Solana transaction security, Token-2022 risks, drainer patterns | Published on blog/medium with links in grant report |
| Known address database growth | Expand from 278+ to 500+ verified scam addresses | Database snapshot, API returning 500+ entries |
| Chrome Web Store listing | Extension published to Chrome Web Store for public install | Live listing URL |

**Milestone 3 Acceptance Criteria:**
- [ ] Security audit complete with all critical/high findings resolved
- [ ] p95 latency under 2 seconds for transaction analysis
- [ ] Community reporting tool live and functional
- [ ] GitHub repo public under MIT license with full documentation
- [ ] 5+ educational articles published
- [ ] 500+ verified scam addresses in database
- [ ] Chrome Web Store listing live and installable

---

## Budget Breakdown

| Category | Amount | Description |
|----------|--------|-------------|
| Development (4 months) | $7,000 | Transaction engine, Token-2022 detector, Chrome extension, Wallet Health Score, public API, documentation |
| Security Audit | $1,500 | Third-party review of transaction parsing and risk scoring (OtterSec or Neodyme) |
| Infrastructure (4 months) | $1,000 | Helius RPC, Vercel hosting, Supabase, monitoring |
| Contingency (5%) | $500 | Buffer for API cost overruns |
| **Total** | **$10,000** | |

### Monthly Budget Allocation

| Month | Focus | Spend |
|-------|-------|-------|
| Jul 2026 | Engine + npm package + Token-2022 detector | $1,750 |
| Aug 2026 | Chrome extension + public API + Wallet Health Score | $1,750 |
| Sep 2026 | Security audit + performance + community tool | $1,750 |
| Oct 2026 | Open-source release + Chrome Web Store + articles + 500+ addresses | $1,750 |
| Audit | Third-party security review | $1,500 |
| Infra | RPC + hosting + DB (4 months) | $1,000 |
| Buffer | Contingency | $500 |

### Post-Grant Sustainability
Infrastructure costs (~$500/mo) sustained through:
- Free tier: 5 scans/month for anyone, no token required
- $AGNTCBRO holder tier: 50+ scans/month for $100+ holders
- Premium API access for developers and integrators

---

## Why Solana

- **Token-2022 detection is Solana-specific** — this is the only chain with Token Extensions that enable permanent delegate, hidden transfer fees, and frozen default accounts. No other chain has this attack surface, and no other tool detects it.
- **Transaction speed matters** — Solana's 400ms block time means users sign transactions fast. Wallet Protect analyzes in under 2 seconds, matching Solana's UX expectations.
- **Low-cost on-chain verification** — Solana's low fees make it viable to check every token's on-chain metadata before interacting.
- **Built FOR Solana, not just ON it** — Every instruction parser, risk rule, and extension detector is purpose-built for the Solana transaction format and program model.

---

## Proof of Work

**Already built and live:**

| Component | Status | URL |
|-----------|--------|-----|
| Transaction parser | ✅ Live | agenticbro.app/api/transaction-analyze |
| Token-2022 detector | ✅ Live | agenticbro.app/wallet-protection |
| Risk scoring engine | ✅ Live | 0-10 scale, 25+ drain patterns |
| Quick Check mode | ✅ Live | Paste base58/base64, instant analysis |
| Simulator mode | ✅ Live | Explore transaction outcomes |
| Scammer database | ✅ Live | 278+ verified entries |
| Multi-platform scanner | ✅ Live | X, Instagram, TikTok, Facebook, Telegram, phone, website |
| Phone scam detector | ✅ Live | FTC DNC integration, 12-flag scoring |
| Brand Guard (email spoof) | ✅ Live | SPF/DKIM/DMARC + CertStream |

**Code samples available on request.**

---

## Team

**Earl Finney Jr.** — Founder, Agentic Insights LLC
- Building scam detection tooling on Solana since 2024
- Agentic Bro (agenticbro.app) live and serving users
- 278+ verified scam entries in database
- Multi-platform scanning (X, Instagram, TikTok, Facebook, Telegram, websites, phone numbers)
- Token: $AGNTCBRO (52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump)

---

## Links

- **Live Product:** agenticbro.app
- **Wallet Protect:** agenticbro.app/wallet-protection
- **Transaction Analysis API:** agenticbro.app/api/transaction-analyze
- **Token-2022 Analysis API:** agenticbro.app/api/token-2022-analyze
- **Scammer Database:** 278+ entries, growing daily
- **Token:** $AGNTCBRO (52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump)

---

**Scan first, trust later. 🔐**