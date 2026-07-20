# Colosseum Solana Frontier Hackathon — Project Submission

**Hackathon:** Solana Frontier (April 6 – May 11, 2026)  
**Prize Tracks:** Grand Champion ($30K) · Top 20 ($10K each) · Public Goods Award ($10K) · University Award ($10K)  
**Accelerator:** Up to 10 teams receive $250K pre-seed + mentorship + SF office  
**Primary Sponsors:** Phantom, Altitude  
**Secondary Sponsors:** Coinbase, Privy, Metaplex, Reflect, Arcium, World, Raydium, MoonPay

---

## Project Name

**Agentic Bro — Wallet Simulator**

*Real-time transaction security for every Solana user*

---

## One-Liner

An in-browser Wallet Connect simulator that intercepts, decodes, and risk-scores every Solana transaction before it reaches the user's wallet — like a malware scanner for crypto.

---

## The Problem

Solana users lose millions to scams every month. In Q1 2026 alone, the $270M Drift exploit showed that even sophisticated protocols are vulnerable. But the bigger, quieter problem is **user-side**: everyday signers approving malicious transactions they don't understand.

Current scam tools are **reactive** — you check a token *after* you've seen it, or verify a website *after* you've visited it. There is nothing standing between a user and a malicious `signAndSendTransaction()` call.

Solana transactions are especially opaque: multiple instructions per transaction, Token-2022 extensions with hidden mechanics (permanentDelegate, transferFee), and wallet drainers disguised as normal swaps. Users sign blind.

---

## The Solution

**Agentic Bro Wallet Simulator** is a security layer that sits between the user and any Solana dApp:

1. **User opens a dApp through Agentic Bro** — any Solana dApp loads in a sandboxed environment
2. **A simulated wallet intercepts all signing requests** — `connect()`, `signTransaction()`, `signAndSendTransaction()` are all proxied through our analysis engine
3. **Every transaction is decoded in plain English** — "This transaction transfers 2.5 SOL to 7xKf...3mP" instead of opaque base58 instruction data
4. **Risk score 0-10 with clear flags** — unlimited approvals, unknown destinations, Token-2022 dangerous extensions, drainer contracts all caught and scored
5. **User decides: approve, reject, or auto-blocked** — CRITICAL transactions (9-10) are auto-blocked. The rest require explicit user action proportional to risk.

### What Makes This Different

| Feature | Token Sniffer / GoPlus | Agentic Bro Wallet Simulator |
|---|---|---|
| When it protects | After you find a token | Before you sign anything |
| What it analyzes | Token contracts only | Full transaction payload |
| Token-2022 detection | Partial | Full (permanentDelegate, transferFee, confidentialTransfer) |
| User understanding | Technical flags only | Plain-English explanations |
| Live dApp interaction | No | Yes — browse any dApp through our proxy |
| Drainer detection | Database lookup | Pattern matching + database + real-time analysis |

---

## Technical Architecture

### Core Components (Built on Solana, for Solana)

```
┌─────────────────────────────────────────────────────┐
│                 AGENTIC BRO WEBSITE                    │
│                                                       │
│  ┌──────────────┐   ┌─────────────────────────────┐ │
│  │  Real Wallet  │   │    Wallet Connect Simulator  │ │
│  │  (Phantom,    │   │                               │ │
│  │   Solflare,   │◄──│  ┌──────────────────────┐   │ │
│  │   Backpack)   │   │  │  Transaction Analyzer │   │ │
│  └──────────────┘   │  │  • Parse instructions  │   │ │
│                      │  │  • Token-2022 check     │   │ │
│  ┌──────────────┐   │  │  • Risk scoring (0-10)  │   │ │
│  │  dApp iframe  │   │  │  • Pattern matching    │   │ │
│  │  (any Solana  │──│──│  │  • Scammer DB check   │   │ │
│  │   dApp)       │   │  └──────────────────────┘   │ │
│  └──────────────┘   │           │                    │ │
│                      │     ┌────┴─────┐              │ │
│                      │     │ Decision │              │ │
│                      │     │ ✅ Safe   │              │ │
│                      │     │ ⚠️ Warn   │              │ │
│                      │     │ 🚫 Block  │              │ │
│                      │     └──────────┘              │ │
│                      └─────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Key Technical Innovations

**1. WalletProxyProvider** — A mock Solana wallet adapter implementing `window.solana` that intercepts all wallet calls:
- `connect()` → Shows connection approval modal
- `signTransaction()` → Parses, analyzes, presents risk, then forwards or blocks
- `signAndSendTransaction()` → Same analysis with on-chain risk assessment
- `disconnect()` → Clean teardown

**2. TransactionParser** — Decodes Solana's unique multi-instruction format into human-readable breakdowns:
- System Program (transfers, account creation)
- SPL Token (transfers, approvals, mints, burns, close accounts)
- Associated Token Program (ATA creation)
- Token-2022 extensions (permanentDelegate, transferFee, confidentialTransfer, non-transferable)
- Custom program detection via instruction signature library

**3. RiskEngine** — 90-point unified scoring system with flag-based modifiers:
- Base scores per instruction type (transfer: 1, approve: 2, setAuthority: 8)
- Modifiers for context (unknown destination: +3, unlimited approval: +5, known drainer: +8)
- Token-2022 dangerous extensions auto-flagged at CRITICAL level
- Aggregate scoring across all instructions in a transaction

**4. SimulatorBrowser** — Sandboxed iframe that loads dApps with injected wallet proxy:
- postMessage bridge for parent-child communication
- Works with any Solana dApp (Jupiter, Raydium, Marinade, Tensor, etc.)
- Real-time transaction interception and display

---

## What We've Already Built

Agentic Bro is a **live, operational platform** — not a concept:

- 🔍 **agenticbro.app** — Full-stack Solana scam detection platform, live and serving users
- 🪙 **Token Scanner** — Analyzes Solana tokens for rug pull indicators
- 🌐 **Website Scanner** — Detects phishing and scam websites
- 📱 **Phone Identifier** — Validates phone numbers for scam risk
- 🗄️ **Scammer Database** — 278+ entries, publicly queryable
- 🤖 **Jeeevs AI Agent** — Live in Telegram, processing real-time scan requests
- 👥 **Community** — Active Telegram group with real-time scam alerts

The Wallet Simulator is the **natural evolution** — from reactive scanning to proactive transaction-level protection. We already have the risk scoring engine, the scammer database, the website scanner, and the AI analysis. The Wallet Simulator connects all of these into a unified real-time security layer.

---

## Hackathon Milestones (5 Weeks)

### Week 1: Transaction Parser + Risk Engine
- [ ] TransactionParser.ts — Decode all Solana instruction types
- [ ] RiskEngine.ts — Scoring rules with flag-based modifiers
- [ ] InstructionLibrary.ts — Known program/instruction signatures
- [ ] Token2022Detector.ts — Detect dangerous Token-2022 extensions
- [ ] Server-side `/api/transaction-analyze` endpoint
- [ ] **Demo:** Paste a base58 transaction → get human-readable breakdown + risk score

### Week 2: Wallet Simulator UI
- [ ] WalletSimulator.tsx — Main component (URL entry, browsing, transaction review)
- [ ] SimulatorBrowser.tsx — Sandboxed iframe with postMessage bridge
- [ ] TransactionReview.tsx — Analysis overlay (risk score, instruction breakdown, plain English)
- [ ] ConnectionRequest.tsx — Wallet connect approval modal
- [ ] RiskBadge.tsx — Visual risk component
- [ ] **Demo:** Enter a dApp URL → browse it → see transaction analysis in real-time

### Week 3: Wallet Proxy Integration
- [ ] WalletProxyProvider.ts — Mock Solana wallet adapter
- [ ] useWalletSimulator.ts — State management
- [ ] useTransactionAnalysis.ts — Real-time analysis hook
- [ ] Phantom + Solflare wallet integration
- [ ] Testing with Jupiter, Raydium, Marinade
- [ ] **Demo:** Connect real wallet → browse real dApp → approve/reject real transactions

### Week 4: Scanner Integration + Approval Manager
- [ ] Connect Wallet Simulator to existing scanners (Website, Token, Scammer DB)
- [ ] ApprovalManager.tsx — View and revoke active token approvals
- [ ] TransactionHistory — Log of all analyzed transactions
- [ ] Quick Check — Paste-and-analyze for manual transaction review
- [ ] **Demo:** Full pipeline — browse dApp → intercept tx → aggregate all scanner results → unified risk score

### Week 5: Polish, Testing + Launch
- [ ] Edge case testing (drainer contracts, multi-instruction tx, Token-2022 exploits)
- [ ] Holder-gating (free basic scans, premium for $AGNTCBRO holders)
- [ ] Performance optimization
- [ ] Documentation
- [ ] **Final Demo:** Production-ready Wallet Simulator on agenticbro.app

---

## Why This Wins

### Grand Champion Fit ($30K)
The Wallet Simulator is a **complete, shipping product** — not a hackathon toy. We already have a live platform, a community, and 278+ scam entries. The Wallet Simulator plugs directly into our existing infrastructure and makes it 10x more useful. No other project at this hackathon will have this level of existing traction combined with a security-first mission that the entire Solana ecosystem desperately needs right now.

### Public Goods Award Fit ($10K)
Everything we build is open-source under MIT. The TransactionParser and RiskEngine will be published as `@agenticbro/solana-tx-parser` on npm — any Solana developer can use it to decode and score transactions in their own projects. The scammer database is already public. The Wallet Simulator's core safety features are free for all users.

### Accelerator Fit ($250K)
Agentic Bro is already a real business with real users. The Wallet Simulator is the next logical step in our roadmap, and $250K in pre-seed funding would let us:
1. Hire a second full-time developer (Solana/TypeScript specialist)
2. Conduct a professional security audit of the wallet proxy
3. Build the Chrome extension version (protect users across ALL websites, not just agenticbro.app)
4. Scale our scammer database through automated drainer detection

---

## Team

**Madmax** — Founder & Lead Developer  
Building Solana scam detection tools since 2024. Created the Agentic Bro platform, maintains the scammer database, and designed the 90-point unified risk scoring system. Full-stack developer (TypeScript, React, Next.js, Solana/Anchor, Python).

**Jeeevs** — AI Scam Detection Agent  
Purpose-built assistant running on OpenClaw. Processes real-time scan requests across X, Instagram, TikTok, Facebook, and Telegram. Manages the scammer database and provides 24/7 community protection.

---

## Links

- **Live Product:** https://agenticbro.app
- **GitHub:** https://github.com/maadmaax26/agenticbro
- **X/Twitter:** @AgenticBro
- **Telegram:** @AGNTCBRO_bot
- **Token:** 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump (Solana)

---

## Demo Script (for submission video)

1. **Open agenticbro.app** → Show existing scanners (Token, Website, Phone)
2. **Navigate to Wallet Simulator** → Enter `raydium.io` in the URL bar
3. **Raydium loads in sandboxed iframe** → User clicks "Connect Wallet"
4. **Agentic Bro intercepts** → Shows connection request: "Raydium.io is requesting wallet connection. Connect?"
5. **User approves** → Simulated wallet connects, dApp works normally
6. **User initiates a swap** → Transaction intercepted before signing
7. **Risk analysis overlay appears:**
   - "This transaction swaps 1 SOL for 145 USDC via Raydium"
   - "Risk Score: 2/10 — LOW ✅"
   - "Instruction 1: Transfer 1 SOL to Raydium program"
   - "Instruction 2: Swap via Raydium AMM"
   - "No red flags detected"
8. **User approves** → Transaction forwarded to real Phantom wallet for signing
9. **Switch to malicious scenario** → User visits known phishing dApp
10. **Phishing dApp requests suspicious approval** → Transaction intercepted
11. **Risk analysis:**
    - "🚫 CRITICAL — Risk Score: 10/10"
    - "Instruction 1: Approve UNLIMITED token spending to unknown address 7xKf...3mP"
    - "Flag: unlimited_approval (+5)"
    - "Flag: unknown_delegate (+3)"
    - "Flag: known_drainer (+8)"
    - "AUTO-BLOCKED — This transaction has been blocked for your safety"
12. **Transaction dropped** → User's wallet is protected

---

*Scan first, trust later. 🔐*