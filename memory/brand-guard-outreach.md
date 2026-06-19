# Brand Guard Outreach Plan

## Status: READY TO START
**Created:** 2026-06-03
**Goal:** First paying customer at $29/mo for Brand Guard

---

## Target Niche: Solana Projects (Phase 1)

### Why Solana First
- Our scanning infra is already tuned for Solana/crypto
- Community is on X where we're active
- High impersonation rate — every project gets faked
- They understand the problem viscerally

### Target List (20 Solana Projects Under 20K Followers)

**Priority 1 — Recently Impersonated (found via search)**
1. Jupiter Exchange — fake CJUP airdrop drainer circulating (2 weeks ago)
2. Axiom — 207 users hit by fake app impersonation (4 days ago)
3. Ubuntu/X — account hijacked to promote fake Solana AI agent (1 month ago)

**Priority 2 — Email Security Vulnerabilities Found (Brand Guard Scans)**

| Domain | Score | Level | SPF | DMARC | Issue |
|--------|-------|-------|-----|-------|-------|
| backpack.app | 55/100 | MEDIUM | ~all | **NONE** | No DMARC at all — fully spoofable |
| marginfi.com | 55/100 | MEDIUM | ~all | quarantine | Weak SPF (~all) + DMARC quarantine only |
| jito.wtf | 55/100 | MEDIUM | ~all | **NONE** | No DMARC at all — fully spoofable |
| drift.trade | 70/100 | LOW | ~all | quarantine | Weak SPF, DMARC not on reject |
| switchboard.xyz | 70/100 | LOW | ~all | quarantine | Weak SPF, DMARC not on reject |
| marinade.finance | 70/100 | LOW | ~all | quarantine | Weak SPF, DMARC not on reject |
| jup.ag | 85/100 | PROTECTED | -all | quarantine | Could upgrade DMARC to reject |
| meteora.ag | 85/100 | PROTECTED | -all | quarantine | Could upgrade DMARC to reject |
| sanctum.so | 85/100 | PROTECTED | ~all | quarantine | Could upgrade DMARC to reject |

**Best outreach targets (MEDIUM/LOW scores):**
- **backpack.app** — 55/100, NO DMARC. Anyone can send emails appearing to be from @backpack.app
- **jito.wtf** — 55/100, NO DMARC. Same — fully spoofable
- **marginfi.com** — 55/100, weak SPF + quarantine-only DMARC
- **drift.trade** — 70/100, upgrading DMARC would close gaps
- **switchboard.xyz** — 70/100, same story
- **marinade.finance** — 70/100, same story

**Already well-protected (skip for outreach):**
- raydium.io (85), phantom.app (85), orca.so (85), kamino.finance (100), tensor.trade (100), wormhole.com (90), pyth.network (85), agenticbro.app (85)

### Outreach Method: Personalized Cold Email with Live Scan Results

**Subject:** We found [X] impersonation threats against your brand

**Body Template:**

> Hi [Name],
>
> I ran a brand security scan on [domain] and found some issues I thought you'd want to know about.
>
> [Include 2-3 specific findings from the scan]
>
> For example, your email SPF has [issue] which means attackers could send phishing emails that appear to come from your domain.
>
> We built Brand Guard to help projects like yours monitor for impersonation across X, Instagram, TikTok, and domain lookalikes — and take action with DMCA takedown reports.
>
> First 25 scans are free at agenticbro.app/brand-guard, and I'd be happy to run a deeper analysis for you at no cost.
>
> — Earl, Agentic Insights

---

## Brand Guard Product Capabilities (Current)

### Scan types (all live on website)
| Scan | API Endpoint | Status |
|------|-------------|--------|
| Email Spoof Check | `/api/brand-guard/email-spoof` | ✅ Live |
| Impersonator Scan | `/api/brand-guard/impersonator-scan` | ✅ Live |
| Domain Monitor | `/api/brand-guard/domain-monitor` | ✅ Live |
| Marketplace Scan | `/api/brand-guard/marketplace` | ✅ Live |
| Takedown Generator | `/api/brand-guard/takedown` | ✅ Live |
| Brand Fingerprint | `/api/brand-guard/fingerprint` | ✅ Live |
| Dashboard | `/api/brand-guard/dashboard` | ✅ Live |
| Credits & Billing | `/api/brand-guard/credits` | ✅ Live |
| Brand CRUD | `/api/brand-guard/brands` | ✅ Live |
| **Monitor Worker** | `/api/brand-guard/monitor-worker` | ✅ Deployed (Vercel cron: 6h) |
| **Alert Delivery** | `/api/brand-guard/alert-delivery` | ✅ Deployed (Vercel cron: 15min) |

### Scoring (Email Spoof)
- SPF: 35 pts
- DMARC: 40 pts
- DKIM: 15 pts
- MX: 10 pts
- Total: 100 pts
- Levels: PROTECTED (80+), LOW (60-79), MEDIUM (40-59), HIGH (20-39), CRITICAL (0-19)

### Pricing Model
- **Free tier:** 25 scans
- **$29/mo:** 50 scans/month + email alerts + takedown reports
- **$99/mo:** Unlimited scans + automated monitoring + priority takedowns

---

## Action Items

- [x] Build list of 20 target Solana projects (under 20K followers)
- [x] Run Brand Guard email spoof scans on all 20 → 9 scored, 6 with vulnerabilities
- [x] Draft personalized emails for targets with findings → 5 templates saved
- [x] Find contact info for priority targets → saved in memory/brand-guard-outreach-contacts.md
- [ ] Send first outreach email (backpack.app is #1 target)
- [ ] Follow up on X DMs if no email response
- [ ] Track responses in outreach-contacts.md
- [ ] Goal: 2-3 conversations started this week, 1 paying customer by end of month

**Contact tracker:** memory/brand-guard-outreach-contacts.md

---

## Weekly Review Notes
(To be filled as outreach progresses)