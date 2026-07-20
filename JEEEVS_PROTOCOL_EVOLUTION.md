# Jeeevs Security Protocol — Evolution Plan

**Company:** Agentic Insights LLC  
**Project:** AgenticBro (product) → Jeeevs Security Protocol (infrastructure)  
**Founder:** Earl Finney Jr.  
**Status:** Strategic planning document — funding-aligned evolution roadmap

---

## The Shift: Product → Protocol

AgenticBro v2.3 is a **product** — a single-node scam detection system that works. Jeeevs Security Protocol is the **infrastructure** that product becomes when it scales.

The distinction matters for funding:

| Aspect | AgenticBro (Today) | Jeeevs Protocol (Funded) |
|--------|-------------------|--------------------------|
| What it is | A scam detection app | A decentralized security network |
| Revenue model | SaaS + token-gated access | Protocol fees + node incentives + enterprise API |
| Moat | Data + accuracy + speed | Network effects + sovereign inference + cross-chain coverage |
| Valuation ceiling | Feature product (~$5-10M) | Infrastructure layer (~$50-200M) |
| Investor story | "Good product, bootstrapped" | "DePIN security primitive for Web3" |
| Comparable | Sardine, Pocket Universe | Chainalysis + Helium + Akash |

**The key insight:** Investors don't fund products at seed — they fund protocols with product-market fit. AgenticBro v2.3 is the proof of product-market fit. Jeeevs Protocol is what gets funded.

---

## Jeeevs Security Protocol — Technical Architecture

### Protocol Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    JEEEVS SECURITY PROTOCOL                      │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  API Gateway  │  │  Browser Ext  │  │   Mobile SDK/App    │  │
│  │  (REST + WS)  │  │  (Safe Browse)│  │  (iOS + Android)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                  │                      │              │
│         └──────────────────┼──────────────────────┘              │
│                            │                                     │
│                   ┌────────▼────────┐                           │
│                   │  Protocol Layer   │                           │
│                   │  (Smart Contracts)│                          │
│                   │                   │                           │
│                   │  • $JEEEVS token  │                           │
│                   │  • Node registry  │                           │
│                   │  • Fee distribution│                           │
│                   │  • Stake/slashing  │                           │
│                   │  • Governance      │                           │
│                   └────────┬──────────┘                           │
│                            │                                     │
│          ┌─────────────────┼──────────────────┐                  │
│          │                 │                   │                  │
│  ┌───────▼───────┐ ┌──────▼───────┐ ┌────────▼────────┐        │
│  │  Validator     │ │  Worker       │ │  Archive        │        │
│  │  Nodes         │ │  Nodes         │ │  Nodes          │        │
│  │                │ │                │ │                  │        │
│  │  • Stake $JEEEVS│ │ • Mac Studio   │ │ • Long-term     │        │
│  │  • Validate     │ │ • Chrome CDP   │ │   storage       │        │
│  │    results      │ │ • Ollama infer │ │ • Historical    │        │
│  │  • Consensus    │ │ • Phone scoring │ │   analysis      │        │
│  │  • Governance   │ │ • Token scanning│ │ • Audit trail   │        │
│  └────────────────┘ └────────────────┘ └──────────────────┘        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    ABIG (AgenticBro Intelligence Graph)    │   │
│  │                    Cross-node shared intelligence           │   │
│  │                                                            │   │
│  │  • Scammer DB sync  • Campaign tracking  • Entity graph  │   │
│  │  • Phone reports    • Token impersonation • Risk history  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    Solana Mainnet                           │   │
│  │                                                            │   │
│  │  $JEEEVS token  •  Node registry  •  Fee pool  •  DAO     │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Node Types

| Node Type | Hardware | Stake | Earnings | Role |
|-----------|----------|-------|----------|------|
| **Validator** | Any (lightweight) | 10K $JEEEVS | Protocol fees | Validate worker results, governance votes |
| **Worker (Standard)** | Mac Studio M2+ | 50K $JEEEVS | Per-scan fees + bonuses | Profile scanning, phone scoring, token analysis |
| **Worker (GPU)** | RTX 3080+ | 50K $JEEEVS | Per-scan fees + bonuses | Complex analysis, deepfake detection (v3) |
| **Archive** | Cloud storage | 5K $JEEEVS | Storage fees | Long-term data, audit trail, compliance |

### $JEEEVS Token Mechanics

**Token:** $JEEEVS (new protocol token, distinct from $AGNTCBRO)  
**Supply:** 1,000,000,000 (1B)  
**Chain:** Solana

| Category | Allocation | Vesting | Notes |
|----------|-----------|---------|-------|
| Node Incentives | 30% (300M) | 4yr unlock | Rewards for validators + workers |
| Liquidity | 15% (150M) | Paired with SOL | OpenBook LP, burn mechanism |
| Team | 15% (150M) | 2yr cliff, 3yr vest | Founders + core team |
| Community | 20% (200M) | Airdrop + earn | $AGNTCBRO holders get airdrop |
| Ecosystem | 10% (100M) | Grants + partnerships | Wallet integrations, exchanges |
| Treasury | 10% (100M) | DAO-governed | Future raises, operations |

**Token Utility:**

| Action | Token Requirement | Burn/Mechanism |
|--------|-------------------|----------------|
| Worker node registration | 50K $JEEEVS stake | Stake locked while node active |
| Validator node registration | 10K $JEEEVS stake | Stake locked while node active |
| Scan request (non-holder) | $1/scan equivalent in $JEEEVS | 30% burned, 70% to node pool |
| Holder tier (50 scans/mo) | 100K $JEEEVS held | No burn — access gated by balance |
| Whale tier (unlimited) | 1M $JEEEVS held | No burn — access gated by balance |
| Governance vote | 1 $JEEEVS = 1 vote | Quadratic voting for major proposals |

**Migration from $AGNTCBRO:**

- $AGNTCBRO holders receive proportional $JEEEVS airdrop (snapshot at launch)
- $AGNTCBRO continues as "community token" with existing utility preserved
- $JEEEVS is the protocol token for node staking, governance, and fee distribution
- Ratio: 1 $AGNTCBRO → 100 $JEEEVS (subject to community governance vote)

---

## Funded Milestones

### Phase 1: Foundation (COMPLETE — v2.3)

Already shipped. This is what de-risks the investment.

✅ 7-scan surface detection system  
✅ 261+ scammer database  
✅ 85+ passing tests  
✅ Chrome CDP at 95%+ accuracy  
✅ Phone Identifier (12 flags, <2s)  
✅ Wallet Transfer Scanner (Solana RPC)  
✅ Website Deep Scanner (queued, 15-min cycle)  
✅ X Engagement Monitor (daily outreach intelligence)  
✅ Local web search (API-free, 3-engine fallback)  
✅ 5 automated cron pipelines  
✅ 10+ REST API endpoints  
✅ Supabase cloud sync  
✅ Live community (Telegram group, bot integration)  
✅ agenticbro.app live with 7 scanner types  
✅ 90-point unified risk scoring (profile + phone)  

### Phase 2: Protocol Launch (Q3 2026 — FUNDED)

| Milestone | Deliverable | KPI |
|-----------|-------------|-----|
| Node Software v1 | Cross-platform installer (Mac, Windows, Linux) | 10+ nodes running in 30 days |
| $JEEEVS Token Launch | Solana token, OpenBook LP, liquidity locked | $500K+ liquidity depth |
| Validator Network | Stake-based validation, consensus rules | 5+ validators at launch |
| Worker Registration | One-click node setup, auto hardware detection | 20+ worker nodes in 60 days |
| BASE/Arbitrum/Polygon | Multi-chain wallet scanning | 3 additional chains supported |
| Phone ID v2 | Real-time VoIP detection, STIR/SHAKEN | <1s carrier lookup |
| Browser Extension Beta | Chrome "Safe Browse" extension | 1K+ installs in 30 days |

**Funding Required:** $500K seed

| Category | Amount | % | Purpose |
|----------|--------|---|---------|
| Liquidity Seeding | $150K | 30% | OpenBook LP, market making, burn |
| Node Farm Expansion | $200K | 40% | 10+ Mac Studio nodes, hosting, infra |
| Browser Extension | $100K | 20% | Dev, security audit, Chrome Store |
| Operations | $50K | 10% | Legal, marketing, 6mo runway |

### Phase 3: Intelligence (Q4 2026 — REVENUE-FUNDED)

| Milestone | Deliverable | KPI |
|-----------|-------------|-----|
| ABIG v2 | Cross-chain entity correlation | 3+ chains correlated |
| Deepfake Detection | Audio + video deepfake scanner | 90%+ detection rate |
| Predictive Campaign Model | Pre-launch scam prediction | 80%+ recall, <10% FPR |
| Mobile App | iOS + Android push alert app | 10K+ downloads |
| Real-Time Call Screening | Phone scam detection during calls | <2s detection latency |
| Carrier API Partnership | 1+ carrier integration for phone scoring | 1M+ phone numbers scored |

**Target Revenue:** $25.7M ARR (from investor brief projections)

### Phase 4: Protocol (2027 — SCALED)

| Milestone | Deliverable | KPI |
|-----------|-------------|-----|
| DAO Governance | Community-governed protocol parameters | 100+ DAO participants |
| Jeeevs-as-a-Service | Enterprise API for fintech, telecom, insurance | 10+ B2B customers |
| Cross-Protocol API | Standard for security intelligence sharing | 3+ protocol integrations |
| International Phone | 50+ country phone risk scoring | 100M+ numbers scored |
| Romance Scam AI | Behavioral detection for romance/dating scams | 85%+ detection rate |
| Job Scam Detection | Employment fraud detection | 80%+ detection rate |

---

## Why This Gets Funded

### 1. Product-Market Fit Is Proven

> "We don't need funding to prove the concept works. We need funding to scale what's already working."

261+ scammers indexed. 7 scan surfaces. 85+ tests. 95%+ accuracy. Live product with daily active users. Zero VC money spent getting here.

### 2. The Market Gap Is Real

- **Chainalysis** sees transactions, not people → can't detect social engineering
- **CertiK** audits code, not behavior → can't detect rug pulls before they happen
- **Pocket Universe** blocks approvals → can't detect the scam before the wallet connects
- **Phone carriers** see caller ID → can't detect behavioral intent

**Nobody covers the full stack. Jeeevs does.**

### 3. DePIN Thesis Alignment

- Mac Studio nodes = real hardware running real inference
- No OpenAI API dependency = sovereign, uncensorable
- Fixed cost infrastructure = 98%+ gross margins
- Network effects = more nodes = faster scans = better data = more users = more nodes

This is the exact thesis Pantera, Multicoin, and Dragonfly are deploying capital into.

### 4. Nights-and-Weekends to Full-Time

> "I built this while working full-time at AT&T. Seed funding = I go full-time and hire 2-3 engineers."

Systems Design Engineer at AT&T. B.S. EE from Boston University. Enterprise infrastructure experience. The product was built with zero funding — imagine what happens with capital.

### 5. Token Economics Create Demand

$JEEEVS isn't a governance gimmick. It's **demand-gated access** to a real security product:

- 50 scans/month requires holding $100 worth → structural buy pressure
- Node operators must stake 50K $JEEEVS → supply locked
- 30% of à la carte scan fees burned → deflationary
- Enterprise API requires $JEEEVS for bulk access → institutional demand

---

## Investor-Specific Pitches

### For Pantera Capital (Menlo Park, CA)

> "Your thesis: 60% of DePIN token market cap is on Solana. We're building DePIN security infrastructure on that exact chain. On-chain tools catch <3% of scams. We catch what they can't see. $1.1B stolen through social engineering in 2025 — that's our market."

### For Multicoin Capital (Austin, TX)

> "You backed Jito, Drift, Squads — Solana infrastructure that scaled. Jeeevs is the security primitive those protocols need but can't build themselves. Every DeFi protocol on Solana is one social engineering attack away from losing user trust. We're the shield."

### For Dragonfly (US, $650M Fund IV)

> "Fresh $650M fund, deploying into infrastructure. You backed Andrena (Solana DePIN). We're the security layer that makes DePIN trustworthy. Sovereign inference on Mac Studio nodes, not API dependency. 98%+ margins. The infrastructure thesis writes itself."

### For Colosseum (Solana-native accelerator)

> "You backed BlockMesh — a Solana DePIN project. We're the other side of that coin: DePIN security infrastructure. 261+ scammers indexed, 7 scan surfaces, 85+ tests passing. Apply for your next accelerator batch — we've already shipped the product."

---

## Key Metrics to Track

| Metric | Current (v2.3) | Phase 2 Target | Phase 3 Target |
|--------|----------------|----------------|-----------------|
| Scammers Indexed | 261+ | 1,000+ | 10,000+ |
| Scan Surfaces | 7 | 10 (3 new chains) | 15+ (new scam types) |
| Active Nodes | 1 (Mac Studio) | 20+ | 200+ |
| API Endpoints | 10+ | 20+ | 50+ |
| Monthly Scans | ~500 | 10,000+ | 100,000+ |
| Revenue (ARR) | Pre-revenue | $25.7M projected | $50M+ |
| Passing Tests | 85+ | 200+ | 500+ |
| Cron Pipelines | 5 | 10 | 20+ |
| Supported Chains | 1 (Solana) | 4 (BASE, ARB, MATIC) | 8+ |
| Team Size | 1 (founder) | 4 | 10+ |

---

## One-Liners for Each Context

**Twitter/X:** "Jeeevs: DePIN security infrastructure for Solana. 7 scan surfaces. 261+ scammers indexed. Funded = protocol launch."

**Telegram Group:** "Scan first, trust later. Jeeevs protects across every surface — Web3, social, phone, wallet, website. 🔐"

**Investor Cold Email:** "AI scams cost $1.1B in 2025. On-chain tools catch <3%. We catch what they can't. DePIN security infrastructure, live on Solana. Raising $500K seed."

**Demo Intro:** "Type any X username into agenticbro.app and get a risk score in 15 seconds. That's Jeeevs. Now imagine that across 7 surfaces, 200+ nodes, every chain. That's the protocol."

---

## Appendix: What Changes From v2.3 Whitepaper

The v2.3 whitepaper documents the **single-node product**. The Jeeevs Protocol evolution adds:

| Whitepaper Section | Current (v2.3) | Protocol Evolution |
|-------------------|----------------|-------------------|
| Architecture | Single node (Mac Studio) | Multi-node DePIN network |
| Token | $AGNTCBRO (utility only) | $JEEEVS (protocol + governance) + $AGNTCBRO (community) |
| Revenue | SaaS + token-gated | Protocol fees + node staking + enterprise API |
| Roadmap Phase 2 | Node software v1 | Same + $JEEEVS launch + validator network |
| Roadmap Phase 3 | ABIG v2, deepfake | Same + mobile app + carrier partnerships |
| Roadmap Phase 4 | DAO, enterprise API | Same + cross-protocol API + international |
| Competitive Table | Single-node comparison | Add: multi-node consensus, validator slashing, protocol fees |
| Business Model | Subscription tiers | Add: protocol fees, node incentives, DAO treasury |
| Team | 1 founder | Add: 2-3 hires (seed-funded) |

**This document is the bridge between "we built a product" and "we're building a protocol." Both are true. The product de-risks the protocol.**