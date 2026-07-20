# Wallet Protect Grant — Goals & Milestones
**Grant Program:** Solana Foundation USA (Superteam)  
**Requested:** $10,000 USDG  
**Avg Response Time:** ~1 week  
**Created:** May 31, 2026  
**Owner:** Earl Finney Jr. / Agentic Insights LLC

---

## ⏱️ Timeframe Analysis

### Is Aug 31, 2026 Too Aggressive?

**Honest answer: Yes, but it's the right kind of aggressive.**

Here's why:

| Factor | Reality | Impact on Timeline |
|--------|---------|-------------------|
| Grant review | ~1 week response, but onboarding can take 2-4 weeks | You won't have funds until mid-July at earliest |
| You're solo | 1 engineer, nights & weekends currently | 3-month deliverable timeline assumes funded full-time |
| Existing code | Transaction parser + Token-2022 detector already built | Cuts ~3 weeks off |
| Chrome extension | New build, requires security review | Can't rush this |
| Security audit | External, depends on reviewer availability | 2-4 weeks lead time |

**Recommended approach: Apply NOW, set milestones from funding date, not from today.**

If you submit this week (Jun 1) and get approved in ~1-2 weeks:
- Funds arrive: ~Jul 1
- 3-month deliverable timeline: Jul → Sep → Oct
- **Set final deadline: October 31, 2026** instead of Aug 31

But if you want to push for Aug 31:
- You need to start building NOW on spec (before funding)
- The grant application says 3 months — you'd be compressing to 2 months
- Risk: rushed security audit, incomplete testing

**My recommendation:** Set **October 31, 2026** as the grant completion deadline. Use Jun–Jul for pre-work (build what you can unfunded), Jul–Oct for funded deliverables. This matches your application's own 3-month milestone plan and gives you breathing room.

---

## 🎯 Goal 1: Open-Source Transaction Analysis Engine

**Objective:** Ship a production-quality npm package that any Solana developer can use to decode and score transactions.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 1.1 | Refactor existing transaction parser into standalone TypeScript package | Jul 15 | ⬜ |
| 1.2 | Full instruction decoder — System, SPL Token, Token-2022, Associated Token, Metaplex, Jupiter, Raydium, Orca, Marinade, Wormhole, Compute Budget, Memo, Stake, Vote, Config, Serum, OpenBook, Candy Machine, Candy Guard | Aug 15 | ⬜ |
| 1.3 | Human-readable instruction summaries (plain English output) | Aug 15 | ⬜ |
| 1.4 | npm package published with docs and SDK examples | Aug 31 | ⬜ |
| 1.5 | Public API endpoint: `POST /api/transaction-analyze` | Sep 15 | ⬜ |
| 1.6 | 95%+ instruction coverage for top 20 Solana programs | Sep 30 | ⬜ |
| 1.7 | Sub-2-second analysis for 95th percentile of transactions | Oct 15 | ⬜ |
| 1.8 | Community feedback round — address false positives/negatives | Oct 31 | ⬜ |

---

## 🎯 Goal 2: Token-2022 Dangerous Extension Detector

**Objective:** First public tool that detects dangerous Token-2022 extensions before users interact with a token.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 2.1 | Detect all 18 Token-2022 extension types | Jul 31 | ⬜ |
| 2.2 | Risk scoring per extension (Permanent Delegate=10, Transfer Fee=7, Mint Close=7, Confidential Transfer=5, Frozen Default=5, CPI Guard=2) | Aug 15 | ⬜ |
| 2.3 | Public API endpoint: `POST /api/token-2022-analyze` | Aug 31 | ⬜ |
| 2.4 | Integration with website — token analysis page | Sep 15 | ⬜ |
| 2.5 | Test against 100+ real Token-2022 mints (Drift, Jito, etc.) | Sep 30 | ⬜ |
| 2.6 | Documentation — extension risk guide for developers | Oct 15 | ⬜ |

---

## 🎯 Goal 3: Chrome Browser Extension MVP

**Objective:** Wallet Protect button appears on Solana dApps when a transaction is pending — decode, score, warn in real time.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 3.1 | Chrome extension scaffold — manifest v3, popup UI, content script injection | Aug 15 | ⬜ |
| 3.2 | Transaction interceptor — detect pending Solana transactions in browser | Sep 1 | ⬜ |
| 3.3 | Wallet connect detection — identify Phantom, Solflare, Backpack | Sep 15 | ⬜ |
| 3.4 | Real-time risk display — show risk score + plain English explanation on dApps | Sep 30 | ⬜ |
| 3.5 | Drainer pattern detection — approve+transfer, setAuthority+close combos | Oct 15 | ⬜ |
| 3.6 | Tested against top 20 Solana dApps (Jupiter, Raydium, Orca, Magic Eden, etc.) | Oct 31 | ⬜ |

---

## 🎯 Goal 4: Known Drainer Address Database & API

**Objective:** Public, rate-limited API for known Solana scam/drain addresses, seeded from our 278+ entries.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 4.1 | Migrate scammer database entries to on-chain address format (where available) | Jul 31 | ⬜ |
| 4.2 | Public API endpoint: `GET /api/known-addresses` with rate limiting | Aug 15 | ⬜ |
| 4.3 | Seed with 300+ known scam addresses (Solana-focused) | Aug 31 | ⬜ |
| 4.4 | Address reputation engine — cross-reference with known safe contracts (Jupiter, Raydium, etc.) | Sep 15 | ⬜ |
| 4.5 | Community reporting tool — users can flag false positives/negatives | Oct 15 | ⬜ |
| 4.6 | 500+ verified addresses in database | Oct 31 | ⬜ |

---

## 🎯 Goal 5: Security Audit & Open-Source Release

**Objective:** Third-party security review, then MIT license release on GitHub.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 5.1 | Identify and contract security auditor (OtterSec, Neodyme, or similar) | Aug 15 | ⬜ |
| 5.2 | Provide auditor with codebase, test vectors, and threat model | Sep 1 | ⬜ |
| 5.3 | Security audit complete — address all critical/high findings | Oct 15 | ⬜ |
| 5.4 | Open-source release under MIT license on GitHub | Oct 31 | ⬜ |
| 5.5 | Publish 5+ educational articles on Solana transaction security | Oct 31 | ⬜ |

---

## 🎯 Goal 6: Wallet Permission Health Score (Bonus)

**Objective:** Scan all active dApp approvals and SPL token delegations, calculate a 0-100 health score, suggest revocations.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 6.1 | Approval scanner — `getProgramAccounts` on Token Program, filter by delegate ≠ null | Sep 15 | ⬜ |
| 6.2 | Health score engine — base 100, -5/approval over 10, -10/stale over 30 days, -25/risky contract, -50/confirmed scam | Oct 1 | ⬜ |
| 6.3 | Revoke transaction builder — generate one-click `revoke` instructions | Oct 15 | ⬜ |
| 6.4 | UI component on agenticbro.app — wallet health dashboard | Oct 31 | ⬜ |

---

## Budget Allocation (per Grant Application)

| Category | Amount | Timeline |
|----------|--------|----------|
| Development (3 months) | $7,000 | Jul–Oct |
| Security Audit | $1,500 | Sep–Oct |
| Infrastructure (3 months) | $1,000 | Jul–Oct |
| Contingency (5%) | $500 | As needed |
| **Total** | **$10,000** | |

---

## Key Metrics — Success Criteria

| Metric | Target by Oct 31 |
|--------|------------------|
| Instruction coverage (top 20 programs) | 95%+ |
| Transaction analysis latency (p95) | <2 seconds |
| Token-2022 extensions detected | 18/18 |
| Known scam addresses | 500+ |
| Chrome extension dApp compatibility | Top 20 Solana dApps |
| Security audit findings resolved | All critical/high |
| npm package downloads (first month) | 100+ |
| GitHub stars (first month) | 50+ |
| Educational articles published | 5+ |

---

## Pre-Work (Jun 1 – Jun 30, Before Funding)

These don't require grant money — start now to compress the funded timeline:

| Task | Days | Impact |
|------|------|--------|
| Refactor transaction parser into standalone TS module | 3-5 | Cuts 2 weeks off Goal 1 |
| Publish initial npm package (alpha) | 2-3 | Early feedback, proof of work |
| Set up GitHub repo structure, CI, issue templates | 1-2 | Professional from day one |
| Expand drainer address database to 350+ entries | 3-5 | Stronger grant application data |
| Draft Chrome extension manifest v3 scaffold | 1-2 | Parallel with Goal 1 |
| Write 2 educational articles (Token-2022 risks, drainer patterns) | 2-3 | Builds credibility, SEO |

**Total pre-work: ~2 weeks of focused effort**

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Solo developer bottleneck | Pre-work reduces funded timeline; focus on engine first, extension second |
| Security auditor availability | Identify auditor in Aug, contract in early Sep before they fill up |
| Chrome Web Store review delays | Submit Oct 1 at latest; use developer mode for testing |
| Token-2022 program changes | Pin to current Token-2022 spec; monitor Metaplex updates |
| Low npm adoption | Educational content + Solana community outreach + Superteam network |

---

**Scan first, trust later! 🔐**