# Employer Trust Score — Feature Summary

**Ship Date:** 2026-06-27
**Status:** Phase 1-3 Complete — Live on agenticbro.app
**Contract:** $AGNTCBRO · 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump

---

## What It Is

AgenticBro now scans **Web3 employers, founders, and projects** for trust risk before you accept work. Instead of only asking "Is this website safe?", users can ask: **"Can I trust the person who's hiring me?"**

This moves AgenticBro beyond scam detection toward becoming a **Web3 trust layer**.

---

## How It Works

The Employer Trust Score combines:
1. **Existing 90-point profile scam detection** (bio text analysis)
2. **Community reports** from Supabase (non-payment, rug pulls, abandoned projects)
3. **Domain age** from crt.sh Certificate Transparency logs
4. **Wallet payment activity** from Solana RPC
5. **9 employer-specific risk flags** + **4 trust signals**

Output: **Employer Trust Score 0-10** (0 = fully trusted, 10 = critical risk)

---

## Risk Flags (increase score)

| Flag | Weight | Triggers When |
|------|--------|---------------|
| Prior rug pull | 15 | 1+ rug/abandon flags in community reports |
| Community non-payment reports | 15 | 1+ non-payment reports |
| Anonymous founder | 10 | No verifiable identity |
| New domain | 10 | Website < 90 days old |
| No payment history | 10 | Wallet shows no outgoing contributor payments |
| Account rebrand | 10 | 2+ username/display name changes |
| Hiring spam | 10 | 5+ hiring posts across accounts |
| No public founders | 5 | Founders not publicly identified |
| Unverified contact | 5 | Phone/email not verified |

## Trust Signals (decrease score)

| Signal | Weight | Triggers When |
|--------|--------|---------------|
| Positive payment history | -15 | Wallet has 10+ transactions (proxy for contractor payments) |
| Established domain | -10 | Website > 2 years old |
| Public founders | -10 | Founders have verifiable public identity |
| Positive contractor reviews | -10 | 3+ positive community reviews |

---

## Trust Levels

| Score | Level | Meaning |
|-------|-------|---------|
| 0-1.5 | HIGHLY TRUSTED ✅ | Strong trust signals, verified payments |
| 1.5-3 | TRUSTED 🟢 | Appears reliable, verify details |
| 3-5 | MODERATE 🟡 | Exercise caution, get terms in writing |
| 5-7 | HIGH RISK 🔴 | Do NOT accept work without verified terms |
| 7+ | CRITICAL RISK 🚨 | Multiple red flags, avoid engaging |

---

## Community Reporting

Users can submit 9 types of reports:

**Negative reports:**
- 💸 Non-payment — didn't pay contractor
- 🚨 Rug pull — project rugged after hiring
- 📉 Abandoned project — project abandoned
- 🚫 Blocked contractor — blocked after work done
- 🗑️ Deleted community — deleted Discord/Telegram
- 🎭 Fake hiring — hiring posts but never actually hires
- 🔄 Account rebrand — repeated rebrands to evade reputation

**Positive reports:**
- 👍 Positive review — contractor vouches for payment
- ✅ Verified payment — on-chain evidence of payment

Reports go through moderation: `pending` → `verified` / `rejected` / `disputed`

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Website (agenticbro.app)                             │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │ EmployerTrustScanner │  │ /api/employer-scan   │ │
│  │ (React component)    │──│ (Vercel serverless)  │ │
│  │ - Scan form          │  │ - POST scan          │ │
│  │ - Score display       │  │ - GET cached scan    │ │
│  │ - Report submission   │  │ - POST report        │ │
│  └──────────────────────┘  │ - GET reports        │ │
│                             └──────┬───────────────┘ │
└─────────────────────────────────────┼───────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              ┌─────▼─────┐  ┌──────▼──────┐  ┌──────▼──────┐
              │ Supabase  │  │ crt.sh      │  │ Solana RPC │
              │ employer_ │  │ (domain age)│  │ (wallet tx)│
              │ reports   │  │             │  │             │
              └───────────┘  └─────────────┘  └─────────────┘

┌─────────────────────────────────────────────────────┐
│ Local CLI (OpenClaw agent)                           │
│  bash scan-source.sh employer @handle                 │
│  bash scan-employer.sh @handle [options]              │
│  bash submit-employer-report.sh --handle @x ...       │
│  bash get-employer-reports.sh --handle @x --summary   │
│  python3 employer_scoring.py @handle [options]       │
└─────────────────────────────────────────────────────┘
```

---

## Files

| File | Phase | Purpose |
|------|-------|---------|
| `scam-detection-framework/employer_scoring.py` | 1+2 | Core scoring module (9 risk flags, 4 trust signals, auto-fetch) |
| `scripts/scan-employer.sh` | 1 | Bash wrapper for CLI |
| `scripts/scan-source.sh` | 1 | Router update (employer platform) |
| `scripts/submit-employer-report.sh` | 2 | Community report submission |
| `scripts/get-employer-reports.sh` | 2 | Community report lookup |
| `aibro/supabase/migrations/20260627000000_employer_reports.sql` | 2 | Supabase table, view, function, RLS |
| `aibro/api/employer-scan.ts` | 3 | Website API (4 endpoints) |
| `aibro/src/components/EmployerTrustScanner.tsx` | 3 | React UI component |
| `aibro/src/App.tsx` | 3 | Routing integration |

---

## Test Results

| Scenario | Score | Level |
|----------|-------|-------|
| Critical risk (anonymous, new domain, no payments, 3 reports, prior rug, hiring spam) | 9.4/10 | 🚨 CRITICAL RISK |
| Trusted employer (public founders, 900-day domain, payment history, 5 positive reviews) | 0/10 | ✅ HIGHLY TRUSTED |
| Moderate risk (200-day domain, 1 community report, no payment history) | 3.3/10 | 🟡 MODERATE |
| Clean employer with "DM for details" bio | 0.8/10 | ✅ HIGHLY TRUSTED |
| End-to-end: submit 2 reports → scan auto-fetches → flags triggered | ✅ | Verified |

---

## Roadmap

**Done:**
- ✅ Phase 1: Scoring module + CLI
- ✅ Phase 2: Community reporting + Supabase + auto-fetch
- ✅ Phase 3: Website API + React component + routing

**Next:**
- ⏳ Upgrade wallet payment analysis (parse distinct recipients, SPL transfers, payroll patterns)
- ⏳ Public employer profile pages (shareable URLs like agenticbro.app/employer/@handle)
- ⏳ API for freelance platforms to query trust scores
- ⏳ Report moderation dashboard
- ⏳ X profile history (username change detection via API)
- ⏳ On-chain payroll pattern detection (recurring same-amount transfers)

---

*Scan first, trust later! 🔐*