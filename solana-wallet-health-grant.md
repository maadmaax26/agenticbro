# Solana Foundation USA Grant Application
## Wallet Permission Health Score — Agentic Bro

**Grant Program:** Solana Foundation USA Grants (Superteam)
**Max Request:** $10,000 USDC
**Avg Grant Size:** $7,276
**Response Time:** ~1 week

---

## Project Overview

**Project Name:** Wallet Permission Health Score

**Brief Description:**
A wallet security tool that scans all active dApp approvals and SPL token delegations on Solana, calculates a "Wallet Health Score" (0-100), and auto-suggests revocations for risky or stale permissions. This addresses a critical gap: users accumulate dApp approvals but never revoke them, leaving wallets permanently exposed to exploits.

**Problem Statement:**
- "Disconnecting" a dApp ≠ revoking permissions — most users don't know this
- No existing Solana tool provides a health score or risk assessment
- Existing tools (SolRevoker, Revoke.cash) show approvals but don't assess risk
- Users have 20-50+ active approvals from forgotten dApp connections
- Approval exploits are a leading cause of wallet drains on Solana

**Solution:**
Build on Agentic Bro's existing Solana RPC infrastructure to:
1. Scan all token accounts with active delegates via `getProgramAccounts`
2. Identify stale approvals (>30 days old, >90 days high risk)
3. Cross-reference dApp reputation (known scams, rug contracts)
4. Calculate a 0-100 Wallet Health Score
5. Generate one-click revoke transactions for risky approvals
6. Display health trends over time

---

## Alignment with Solana Foundation Goals

This project directly supports **Cause-driven building** and **Developer Tooling**:

### 1. Inclusive Financial System
- Approval exploits disproportionately affect new users who don't understand permissions
- This tool makes self-custody safer for everyday users, not just power users
- Reduces "got scammed, left crypto forever" attrition

### 2. Developer Tooling
- Open-source API for other Solana dApps to integrate wallet health checks
- dApps could show "Your wallet has 12 risky approvals" before connecting
- Wallets could integrate health scores into their UI

### 3. Public Good
- Free to use (5 scans/month for non-holders, unlimited for $AGNTCBRO holders)
- Open-source scanning engine
- Educational content about approval risks

---

## Technical Approach

### What We Already Have (Reusable)
| Component | Status | Description |
|-----------|--------|-------------|
| Solana RPC client | ✅ Live | `blockchain_scanner.py` + `scan-wallet.sh` |
| Wallet scanning | ✅ Live | Token account lookups, balance checks |
| Risk scoring framework | ✅ Live | 90-point unified scoring system |
| Website API | ✅ Live | agenticbro.app/api/ endpoints |
| Chrome CDP | ✅ Live | Port 18801 for browser automation |

### New Components Needed

| Component | Description | Complexity |
|-----------|-------------|------------|
| Approval Scanner | `getProgramAccounts` on Token Program, filter by delegate ≠ null | Medium |
| Approval Age Tracker | Store approval timestamps in Supabase, detect stale | Low |
| dApp Reputation DB | Cross-reference delegates with known scam contracts | Medium |
| Health Score Engine | Weight factors: age, amount, reputation, type | Low |
| Revoke Transaction Builder | Generate `revoke` instructions for flagged approvals | Medium |
| UI Component | React component for agenticbro.app | Low |

### Data Flow

```
Wallet Address → getProgramAccounts(TOKEN_PROGRAM_ID)
  → Filter: delegate != null OR close_authority != owner
  → For each approval:
      - Get delegate account info
      - Check if delegate is known scam/rug contract
      - Check approval age (from transaction history)
      - Get delegated amount
  → Calculate Health Score:
      - Base: 100
      - -5 per approval over 10
      - -10 per approval > 30 days old
      - -25 per approval to known risky contract
      - -50 per approval to confirmed scam contract
  → Generate recommendations:
      - "Revoke approval to [dApp] (risky, 45 days old)"
      - One-click revoke transaction
```

---

## Budget Proposal

### Total Requested: **$8,500 USDC**

Below the $10K max but realistic for 3-week build + infrastructure.

| Category | Amount | Description |
|----------|--------|-------------|
| **Development** | $5,000 | 3 weeks development time (@ ~$1,667/week) |
| **Infrastructure (6 months)** | $1,500 | Hosting, APIs, database for 6-month runway |
| **Testing & QA** | $500 | Mainnet testing, edge cases, security review |
| **Documentation** | $500 | Developer docs, API documentation, integration guide |
| **Contingency** | $1,000 | Buffer for unexpected issues |
| **Total** | **$8,500** | |

### Development Breakdown (3 weeks)

| Week | Tasks | Hours |
|------|-------|-------|
| Week 1 | Approval scanner + RPC integration | 40h |
| Week 2 | Health score engine + dApp reputation DB | 40h |
| Week 3 | Revoke builder + UI component + testing | 40h |

### Infrastructure Costs (6 months)

| Service | Monthly | 6 Months | Notes |
|---------|---------|----------|-------|
| Helius RPC (Developer) | $49 | $294 | Reliable RPC for getProgramAccounts |
| Supabase (Pro) | $25 | $150 | Store approval history, dApp reputation |
| Vercel (Pro) | $20 | $120 | Hosting (already have, included) |
| Brave Search API | $30 | $180 | dApp reputation research |
| **Total** | **$124/mo** | **$744** | |

*Note: Infrastructure runway ensures tool stays operational and free for users through grant period.*

---

## Deliverables

### Week 1: Core Scanner
- [ ] `scan-wallet-approvals.sh` CLI tool
- [ ] Python module: `approval_scanner.py`
- [ ] JSON output with all active approvals

### Week 2: Health Engine
- [ ] Health score calculation (0-100)
- [ ] dApp reputation database (seed with 50+ known contracts)
- [ ] Approval age tracking via transaction history

### Week 3: Production Ready
- [ ] React component: `<WalletHealthScore />`
- [ ] API endpoint: `POST /api/wallet-health`
- [ ] One-click revoke transaction generation
- [ ] Documentation and integration guide

### Post-Grant
- [ ] Open-source release under MIT license
- [ ] Submit to Solana Agent Skills directory
- [ ] Integrate into Phantom/Solflare extension ecosystems

---

## Proof of Work

**Existing Infrastructure:**
- Agentic Bro platform live at agenticbro.app
- 278+ scammers tracked in database
- 7+ platform scanners operational (X, IG, TikTok, FB, Telegram, phone, website)
- OpenClaw agent running 24/7 with 10 cron jobs
- Chrome CDP infrastructure for browser automation

**Related Code:**
- `/workspace/scripts/blockchain_scanner.py` — Solana RPC client
- `/workspace/scripts/scan-wallet.sh` — Wallet token account scanner
- `/workspace/scripts/wallet-link-analyzer-v3.py` — Transaction analysis

---

## Why This Matters for Solana

1. **User Safety**: Every wallet drain on Solana is a user lost. This tool prevents drains proactively.

2. **Ecosystem Trust**: Safer wallets = more confident users = more adoption.

3. **Developer Tooling**: Open API allows any Solana dApp to integrate wallet health checks.

4. **Education**: Tool teaches users about approval risks — most don't know disconnecting ≠ revoking.

5. **Differentiation**: No existing Solana tool provides a health score or risk assessment for approvals.

---

## Contact

**Madmax** — Dev, Agentic Bro
**Email:** [via Superteam application form]
**Project:** $AGNTCBRO | agenticbro.app
**Location:** United States ✅