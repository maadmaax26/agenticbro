# Agentic Bro — Goals & Milestones
**Deadline:** October 31, 2026  
**Created:** May 31, 2026  
**Owner:** Madmax / Agentic Insights LLC  
**Token:** $AGNTCBRO | **Contract:** 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump

---

## Phase Overview

| Phase | Dates | Focus |
|-------|--------|-------|
| Pre-Work | Jun 1 – Jun 30 | Fix critical issues, pre-build grant components |
| Phase 1 | Jul 1 – Jul 31 | Scanner reliability, database integrity, grant submission |
| Phase 2 | Aug 1 – Aug 31 | Website polish, API hardening, Chrome extension scaffold |
| Phase 3 | Sep 1 – Sep 30 | Wallet Protect engine, Token-2022 detector, community growth |
| Phase 4 | Oct 1 – Oct 31 | Security audit, open-source release, revenue launch |

---

## 🎯 Goal 1: Scanner Reliability — Enterprise Grade

**Objective:** Every scanner runs clean. <5% error rate, <20s latency, auto-recovery.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 1.1 | Fix scan-facebook.sh shell injection vulnerability | Jun 15 | ⬜ |
| 1.2 | Fix auth-profiles.json invalid "default" entry | Jun 15 | ⬜ |
| 1.3 | Fix evening vibe cron timeout (currently 60s, bump to 120s) | Jun 7 | ⬜ |
| 1.4 | Integration test suite for all 7 scanners (X, IG, TikTok, FB, Phone, Website, Token) | Jun 30 | ⬜ |
| 1.5 | Chrome CDP auto-recovery — detect stale sessions, restart without manual intervention | Jul 31 | ⬜ |
| 1.6 | <5% error rate across all scanners (currently ~8%) | Aug 31 | ⬜ |
| 1.7 | <20s median scan latency on all platforms | Aug 31 | ⬜ |
| 1.8 | <5% false positive rate (currently ~8%) | Sep 30 | ⬜ |
| 1.9 | Scanner health dashboard (uptime, latency, error rates per platform) | Oct 31 | ⬜ |

---

## 🎯 Goal 2: Database & Data Integrity

**Objective:** Supabase = single source of truth. Auto-sync, deduped, backed up, 500+ entries.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 2.1 | Re-enable scam_db_sync cron (every 12h) | Jun 15 | ⬜ |
| 2.2 | Re-enable db_integrity_check cron (every 6h) | Jun 15 | ⬜ |
| 2.3 | Dedupe scammer-database.csv — remove exact and fuzzy duplicates | Jun 30 | ⬜ |
| 2.4 | Supabase schema hardening — indexes, RLS policies, constraints | Jul 31 | ⬜ |
| 2.5 | Scammer DB auto-enrichment — cross-reference X handles with wallet addresses | Sep 15 | ⬜ |
| 2.6 | Daily Supabase snapshots to S3/Glacier | Sep 30 | ⬜ |
| 2.7 | 500+ unique verified scammer entries | Oct 31 | ⬜ |

---

## 🎯 Goal 3: Website & API Polish

**Objective:** Production-quality agenticbro.app — reliable, mobile-ready, properly gated.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 3.1 | Fix Instagram PROFILE_LOGIN_REQUIRED — graceful error messaging | Jun 15 | ⬜ |
| 3.2 | Rate limiting on all API endpoints | Jul 15 | ⬜ |
| 3.3 | Mobile-responsive scan results page | Jul 31 | ⬜ |
| 3.4 | Token-gated scan tiers enforced server-side (Free: 5, Holder $100+: 50/mo) | Aug 15 | ⬜ |
| 3.5 | Phone verifier UX polish — better errors, carrier display | Aug 31 | ⬜ |
| 3.6 | Brand Guard email-spoof API production-ready (SPF/DKIM/DMARC + CertStream) | Sep 15 | ⬜ |
| 3.7 | Scan history page — view past scans by wallet | Sep 30 | ⬜ |
| 3.8 | SEO — meta tags, sitemap, structured data for scam detection terms | Oct 31 | ⬜ |

---

## 🎯 Goal 4: Wallet Protect Grant Deliverables

**Objective:** Ship all 3 grant milestones — engine, extension, audit — and open-source under MIT.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 4.1 | Refactor transaction parser into standalone TypeScript npm package | Jun 30 | ⬜ |
| 4.2 | Full instruction decoder — System, SPL Token, Token-2022, AToken, Metaplex, Jupiter, Raydium, Orca, Compute Budget, Memo, Stake, Wormhole, Serum, OpenBook, Candy Machine | Jul 31 | ⬜ |
| 4.3 | Human-readable instruction summaries (plain English) | Jul 31 | ⬜ |
| 4.4 | Publish npm package (alpha) with docs and SDK examples | Aug 15 | ⬜ |
| 4.5 | Token-2022 extension detector — detect all 18 types, risk score each | Aug 15 | ⬜ |
| 4.6 | Public API: `POST /api/transaction-analyze` | Aug 31 | ⬜ |
| 4.7 | Public API: `POST /api/token-2022-analyze` | Aug 31 | ⬜ |
| 4.8 | Chrome extension manifest v3 scaffold — popup, content script, background | Aug 31 | ⬜ |
| 4.9 | Chrome extension: transaction interceptor + Wallet connect detection (Phantom, Solflare, Backpack) | Sep 15 | ⬜ |
| 4.10 | Chrome extension: real-time risk display on dApps — score + plain English | Sep 30 | ⬜ |
| 4.11 | Chrome extension: drainer pattern detection (approve+transfer, setAuthority+close) | Oct 15 | ⬜ |
| 4.12 | Chrome extension tested against top 20 Solana dApps | Oct 31 | ⬜ |
| 4.13 | Identify and contract security auditor (OtterSec / Neodyme) | Aug 15 | ⬜ |
| 4.14 | Security audit complete — all critical/high findings resolved | Oct 31 | ⬜ |
| 4.15 | Open-source release under MIT license on GitHub | Oct 31 | ⬜ |
| 4.16 | Known drainer address API: `GET /api/known-addresses` with rate limiting, 500+ addresses | Oct 31 | ⬜ |
| 4.17 | Community reporting tool — flag false positives/negatives | Oct 31 | ⬜ |
| 4.18 | Publish 5+ educational articles on Solana transaction security | Oct 31 | ⬜ |

---

## 🎯 Goal 5: Wallet Permission Health Score

**Objective:** Scan dApp approvals, calculate 0-100 health score, one-click revoke.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 5.1 | Approval scanner — `getProgramAccounts` on Token Program, filter by delegate ≠ null | Sep 15 | ⬜ |
| 5.2 | Health score engine — base 100, deductions per risk factor | Oct 1 | ⬜ |
| 5.3 | Revoke transaction builder — generate one-click revoke instructions | Oct 15 | ⬜ |
| 5.4 | Wallet health dashboard on agenticbro.app | Oct 31 | ⬜ |

---

## 🎯 Goal 6: Community Growth & Engagement

**Objective:** 2,000+ Telegram members. Agentic Bro = go-to scam detection on Solana.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 6.1 | Fix evening vibe cron timeout (bump to 120s) | Jun 7 | ⬜ |
| 6.2 | X engagement monitor producing daily outreach targets | Jun 15 | ⬜ |
| 6.3 | Launch weekly "Scam Alert" thread series (automated via cron) | Jul 31 | ⬜ |
| 6.4 | Telegram group reaches 1,000 members | Aug 31 | ⬜ |
| 6.5 | Partner with 3+ Solana communities for cross-promotion | Sep 30 | ⬜ |
| 6.6 | Telegram group reaches 2,000 members | Oct 31 | ⬜ |
| 6.7 | $AGNTCBRO holder count reaches 500+ unique wallets | Oct 31 | ⬜ |

---

## 🎯 Goal 7: Revenue & Token Utility

**Objective:** Real revenue from scan API. Token utility drives holding.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 7.1 | Scan API pricing tiers live on website (Free / Holder / Premium) | Jul 31 | ⬜ |
| 7.2 | Holder verification — auto-check $AGNTCBRO balance for tier access | Aug 15 | ⬜ |
| 7.3 | Premium API key generation for integrators | Sep 30 | ⬜ |
| 7.4 | First paid integration partner using Agentic Bro scan API | Oct 31 | ⬜ |
| 7.5 | Dashboard beta — token-gated trading signals / bot health scores | Oct 31 | ⬜ |

---

## 🎯 Goal 8: Funding

**Objective:** Secure $10K Solana Foundation grant or equivalent.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 8.1 | Finalize Wallet Protect grant application (use existing draft) | Jun 7 | ⬜ |
| 8.2 | Submit to Solana Foundation USA Grants (Superteam) | Jun 15 | ⬜ |
| 8.3 | Pre-work: refactor parser, publish alpha npm package, expand drainer DB to 350+ | Jun 30 | ⬜ |
| 8.4 | Grant approval + first payment received | Jul 31 | ⬜ |
| 8.5 | Milestone 1 report submitted (engine + npm package) | Aug 31 | ⬜ |
| 8.6 | Milestone 2 report submitted (Chrome extension + API) | Sep 30 | ⬜ |
| 8.7 | Milestone 3 report submitted (audit + open-source + articles) | Oct 31 | ⬜ |

---

## 🎯 Goal 9: Operational Excellence

**Objective:** Runs 24/7 with minimal manual intervention. Single-person-ops-friendly.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 9.1 | Document all launchd services with restart policies | Jun 15 | ⬜ |
| 9.2 | Uptime monitoring — automated alerts when scanners go down | Jun 30 | ⬜ |
| 9.3 | Resolve Telegram sendChatAction network errors | Jul 15 | ⬜ |
| 9.4 | Nightly review covers: error rates, DB health, cron status, DB growth | Jul 31 | ⬜ |
| 9.5 | Incident response runbook — what to do when CDP, Supabase, or scanners fail | Aug 31 | ⬜ |
| 9.6 | 99.5% uptime for scan API (Vercel + health checks) | Oct 31 | ⬜ |

---

## Key Numbers — Current vs. Oct 31 Target

| Metric | Current | Target |
|--------|---------|--------|
| Scammer DB entries | 278+ | 500+ |
| Scanner error rate | ~8% | <5% |
| False positive rate | ~8% | <5% |
| Scan latency (p50) | ~15s | <20s |
| Telegram members | ~500 | 2,000+ |
| $AGNTCBRO holders | — | 500+ |
| Scanners | 7 | 7 (stable) |
| API uptime | — | 99.5% |
| Revenue | $0 | First paid integrator |
| npm package | — | Published (alpha by Aug) |
| Chrome extension | — | MVP tested on top 20 dApps |
| Token-2022 extensions detected | — | 18/18 |
| Security audit | — | Complete, all critical findings resolved |
| Educational articles | — | 5+ published |

---

## Priority Order

1. **Goal 8** (Funding) — submit grant ASAP, everything else depends on it
2. **Goal 1** (Scanner reliability) — foundation for everything
3. **Goal 4** (Wallet Protect) — grant deliverables, highest impact
4. **Goal 2** (Database) — data quality enables better scans
5. **Goal 9** (Ops) — can't scale if it breaks
6. **Goal 3** (Website) — user-facing, drives growth
7. **Goal 6** (Community) — organic, runs in parallel
8. **Goal 5** (Health Score) — bonus, builds on Wallet Protect
9. **Goal 7** (Revenue) — needs 1-6 working first

---

## Critical Path

```
Jun 7   → Fix evening cron timeout (blocking daily posts)
Jun 7   → Finalize grant application
Jun 15  → Submit grant to Superteam
Jun 30  → Pre-work: refactor parser, alpha npm, expand drainer DB
Jul 31  → Grant approved + first payment
Jul 31  → CDP auto-recovery, rate limiting, integration tests
Aug 15  → npm package alpha, Token-2022 detector, contract auditor
Aug 31  → Public APIs live, Chrome extension scaffold
Sep 15  → Approval scanner, health score engine
Sep 30  → Chrome extension MVP, community partnerships
Oct 15  → Security audit findings resolved, drainer patterns, revoke builder
Oct 31  → Open-source release, 500+ DB entries, 2K members, dashboard beta
```

---

**Scan first, trust later! 🔐**