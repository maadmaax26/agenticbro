# Agentic Bro — Goals & Milestones
**Target Completion:** August 31, 2026  
**Created:** May 31, 2026  
**Owner:** Madmax / Agentic Insights LLC

---

## 🎯 Goal 1: Enterprise-Grade Scanner Reliability

**Objective:** Every scanner (X, IG, TikTok, FB, Telegram, Phone, Website, Token) runs clean with <5% error rate and <20s median latency.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 1.1 | Fix scan-facebook.sh shell injection vulnerability | Jun 15 | ⬜ |
| 1.2 | Fix auth-profiles.json invalid "default" entry | Jun 15 | ⬜ |
| 1.3 | Add integration test suite for all 7 scanner types (X, IG, TikTok, FB, Phone, Website, Token) | Jun 30 | ⬜ |
| 1.4 | Achieve <5% error rate across all scanners (currently ~8% on edge cases) | Jul 15 | ⬜ |
| 1.5 | Achieve <20s median scan latency on all platforms | Jul 31 | ⬜ |
| 1.6 | Chrome CDP auto-recovery — detect stale sessions, restart without manual intervention | Jul 31 | ⬜ |
| 1.7 | False positive rate <5% (currently ~8%) | Aug 15 | ⬜ |
| 1.8 | Full scanner health dashboard (uptime, latency, error rates per platform) | Aug 31 | ⬜ |

---

## 🎯 Goal 2: Website & API Polish (agenticbro.app)

**Objective:** Production-quality website with reliable API, proper error handling, and mobile UX.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 2.1 | Fix Instagram login-wall handling — return PROFILE_LOGIN_REQUIRED gracefully | Jun 15 | ⬜ |
| 2.2 | Rate limiting on all API endpoints (prevent abuse) | Jun 30 | ⬜ |
| 2.3 | Mobile-responsive scan results page | Jul 15 | ⬜ |
| 2.4 | Token-gated scan tiers (Free: 5 scans, Holder $100+: 50/month) enforced server-side | Jul 31 | ⬜ |
| 2.5 | Phone verifier UX polish — better error messages, carrier lookup display | Jul 31 | ⬜ |
| 2.6 | Brand Guard email-spoof API production-ready (SPF/DKIM/DMARC + CertStream) | Aug 15 | ⬜ |
| 2.7 | Scan history page — users can view past scans by wallet | Aug 31 | ⬜ |
| 2.8 | SEO optimization — meta tags, sitemap, structured data for scam detection terms | Aug 31 | ⬜ |

---

## 🎯 Goal 3: Database & Data Integrity

**Objective:** Supabase is the single source of truth, scammer DB is deduped, and integrity checks run automatically.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 3.1 | Re-enable scam_db_sync cron (every 12h) — sync local CSV ↔ Supabase | Jun 15 | ⬜ |
| 3.2 | Re-enable db_integrity_check cron (every 6h) | Jun 15 | ⬜ |
| 3.3 | Dedupe scammer-database.csv — remove exact and fuzzy duplicates (currently 278+ entries, unknown dupes) | Jun 30 | ⬜ |
| 3.4 | Supabase schema migration — add proper indexes, RLS policies, and constraints | Jul 15 | ⬜ |
| 3.5 | Scammer DB auto-enrichment — cross-reference X handles with wallet addresses | Aug 15 | ⬜ |
| 3.6 | Backup automation — daily Supabase snapshots to S3/Glacier | Aug 31 | ⬜ |
| 3.7 | DB growth target: 500+ unique scammer entries with verified data | Aug 31 | ⬜ |

---

## 🎯 Goal 4: Community Growth & Engagement

**Objective:** Grow Telegram group to 2,000+ members, establish Agentic Bro as the go-to scam detection brand on Solana.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 4.1 | Fix evening vibe cron timeout (currently timing out at 60s) | Jun 7 | ⬜ |
| 4.2 | X engagement monitor producing actionable outreach targets daily | Jun 15 | ⬜ |
| 4.3 | Telegram group reaches 1,000 members | Jul 15 | ⬜ |
| 4.4 | Launch weekly "Scam Alert" thread series (automated via cron) | Jul 31 | ⬜ |
| 4.5 | Partner with 3+ Solana communities for cross-promotion | Aug 15 | ⬜ |
| 4.6 | Telegram group reaches 2,000 members | Aug 31 | ⬜ |
| 4.7 | $AGNTCBRO holder count reaches 500+ unique wallets | Aug 31 | ⬜ |

---

## 🎯 Goal 5: Revenue & Token Utility

**Objective:** Real revenue from scan API + token utility that drives holding.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 5.1 | Scan API pricing tiers live on website (Free / Holder / Premium) | Jun 30 | ⬜ |
| 5.2 | Holder verification — auto-check $AGNTCBRO balance for scan tier access | Jul 15 | ⬜ |
| 5.3 | Premium API key generation for integrators (other bots, tools) | Aug 15 | ⬜ |
| 5.4 | First paid integration partner using Agentic Bro scan API | Aug 31 | ⬜ |
| 5.5 | Dashboard beta — token-gated trading signals / bot health scores | Aug 31 | ⬜ |

---

## 🎯 Goal 6: Funding & Investor Readiness

**Objective:** Secure seed funding ($500K) or grant to go full-time and scale.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 6.1 | Finalize Investor Brief v6 — clean deck, metrics, ask | Jun 15 | ⬜ |
| 6.2 | Apply to Solana Foundation grant (wallet protection track) | Jun 30 | ⬜ |
| 6.3 | Pitch to 5+ angel investors or seed funds | Jul 31 | ⬜ |
| 6.4 | Apply to 2+ accelerators (Alchemy, a16z Crypto Startup School, etc.) | Jul 31 | ⬜ |
| 6.5 | Secure $500K seed or $50K+ grant | Aug 31 | ⬜ |

---

## 🎯 Goal 7: Operational Excellence

**Objective:** Agentic Bro runs 24/7 with minimal manual intervention. Single-person-ops-friendly.

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 7.1 | Document all launchd services (scan-worker, x-scan-worker) with restart policies | Jun 15 | ⬜ |
| 7.2 | Uptime monitoring — automated alerts when scanner services go down | Jun 30 | ⬜ |
| 7.3 | Resolve Telegram sendChatAction network errors (intermittent) | Jul 15 | ⬜ |
| 7.4 | Nightly review cron covers: error rates, DB health, cron job status, scammer DB growth | Jul 31 | ⬜ |
| 7.5 | Incident response runbook — what to do when X scanner, CDP, or Supabase goes down | Aug 15 | ⬜ |
| 7.6 | 99.5% uptime for scan API (measured via Vercel + health checks) | Aug 31 | ⬜ |

---

## Summary: Key Numbers by Aug 31

| Metric | Current | Target |
|--------|---------|--------|
| Scammer DB entries | 278+ | 500+ |
| Scanner error rate | ~8% | <5% |
| False positive rate | ~8% | <5% |
| Scan latency (median) | ~15s | <20s (maintain) |
| Telegram members | ~500 | 2,000+ |
| $AGNTCBRO holders | — | 500+ |
| Scanners | 7 | 7 (stable) |
| API uptime | — | 99.5% |
| Revenue | $0 | First paid integrator |
| Funding | Bootstrapped | $500K seed or $50K+ grant |

---

## Priority Order (if time is tight)

1. **Goal 1** (Scanner reliability) — foundation everything else depends on
2. **Goal 2** (Website/API) — user-facing, directly drives growth
3. **Goal 3** (Database) — data quality enables better scans
4. **Goal 7** (Ops) — can't scale if it breaks
5. **Goal 4** (Community) — organic, runs alongside everything
6. **Goal 5** (Revenue) — needs 1-4 working first
7. **Goal 6** (Funding) — long-term, can run in parallel

---

**Scan first, trust later! 🔐**