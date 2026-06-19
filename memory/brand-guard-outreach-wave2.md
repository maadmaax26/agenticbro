# Brand Guard Outreach — Wave 2 Targets (10 More)

**Created:** 2026-06-03
**Goal:** Expand beyond initial 6 targets into next tier of Solana projects with email security gaps

---

## New Targets Ranked by Vulnerability

### 🔴 CRITICAL — No DMARC + Weak SPF (Fully Spoofable)

#### 1. Solend (solend.fi) — ~35/100, HIGH
- **What:** Solana lending/borrowing protocol (like Aave/Compound on Solana)
- **SPF:** `v=spf1 a include:_spf.google.com ~all` (soft fail)
- **DMARC:** NONE — fully spoofable
- **DKIM:** Not found
- **MX:** 5 records (Google — receives email)
- **Email:** No direct email found — GitHub: solendprotocol, X: need to find
- **Template:** Template 1 (No DMARC)
- **Why it matters:** DeFi protocol with real TVL, no email spoof protection at all

#### 2. Mango Markets (mango.markets) — ~20/100, CRITICAL
- **What:** Solana DEX (perps + spot), was hacked for $100M+ in 2022
- **SPF:** NONE
- **DMARC:** NONE — fully spoofable
- **DKIM:** Not found
- **MX:** 0 records (may not receive email on this domain)
- **Email:** No email found — X: need to find
- **Template:** Template 1 (No DMARC) — but note: no MX records, may not receive email
- **Caveat:** No MX = domain may not be actively used for email. Lower priority.

#### 3. mrgn.fi (marginfi's parent org) — ~40/100, HIGH
- **What:** Parent company/org for marginfi protocol
- **SPF:** `v=spf1 ip4:31.217.192.232 ip4:31.217.192.158 +a +mx ~all` (soft fail, hardcoded IPs)
- **DMARC:** NONE — fully spoofable
- **DKIM:** Found
- **MX:** 1 record (hostingpalvelu.fi — Finnish host)
- **Email:** security@mrgn.group (already contacted for marginfi)
- **Template:** Template 1 (No DMARC) — different domain than marginfi.com
- **Why it matters:** This is marginfi's org domain with NO DMARC. We already contacted them about marginfi.com — follow up about this domain too.

---

### ⚠️ HIGH — DMARC p=none (No Protection At All)

#### 4. Francium (francium.io) — ~35/100, HIGH
- **What:** Solana leveraged yield aggregator
- **SPF:** `v=spf1 include:spf.privateemail.com ~all` (soft fail + private email service)
- **DMARC:** `p=none; sp=none` — NO enforcement, just monitoring
- **DKIM:** Not found
- **MX:** 2 records (privateemail.com)
- **Email:** contact@francium.io (from Golden wiki)
- **X/Twitter:** @francium_defi
- **Template:** Template 2 (Weak DMARC — but p=none is worse than quarantine)
- **Why it matters:** p=none is effectively no DMARC at all. Spoofed emails will be delivered normally. Plus using privateemail.com (free email hosting) = less secure.

---

### ⚠️ MEDIUM — DMARC Quarantine Only (Spoofed Email Goes to Spam, Not Rejected)

#### 5. Helius (helius.xyz) — ~65/100, LOW
- **What:** Solana RPC/infrastructure provider (powering Backpack, Phantom, etc.)
- **SPF:** `v=spf1 include:_spf.google.com -all` (strict, good)
- **DMARC:** `p=quarantine` (soft — should upgrade to reject)
- **DKIM:** Found
- **MX:** 6 records (Google)
- **Email:** support@helius.xyz (from their docs)
- **X/Twitter:** @helius_labs (need to verify)
- **Template:** Template 3 (Quarantine)
- **Why it matters:** Infrastructure provider powering other Solana projects. If someone spoofs helius.xyz emails, it could compromise downstream integrations.

#### 6. OpenBook (openbook.wtf) — ~55/100, MEDIUM
- **What:** Community-led DEX (Serum fork) on Solana
- **SPF:** NONE
- **DMARC:** `p=quarantine; adkim=r; aspf=r` (quarantine only, relaxed alignment)
- **MX:** Need to verify (may have no MX)
- **Email:** No email found — X: @openbookdex
- **Template:** Template 3 (Quarantine)
- **Why it matters:** DEX with user funds, relaxed DMARC settings weaken protection

#### 7. Sanctum (sanctum.so) — ~60/100, LOW
- **What:** Solana liquid staking (competing with Marinade)
- **SPF:** `v=spf1 include:spf.migadu.com include:google.com include:outlook.com include:sendgrid.net -all` (strict, but lots of includes)
- **DMARC:** `p=quarantine` (should upgrade to reject)
- **MX:** migadu.com (email hosting)
- **Email:** Need to find
- **X/Twitter:** Need to find
- **Template:** Template 3 (Quarantine)
- **Note:** Lots of SPF includes (migadu, google, outlook, sendgrid) = larger attack surface

#### 8. Pump.fun (pump.fun) — ~65/100, LOW
- **What:** Memecoin launchpad on Solana (huge user base)
- **SPF:** `v=spf1 include:_spf.google.com -all` (strict, good)
- **DMARC:** `p=quarantine; sp=quarantine` (should upgrade to reject)
- **DKIM:** Need to verify
- **Email:** Need to find
- **X/Twitter:** Need to find
- **Template:** Template 3 (Quarantine)
- **Why it matters:** Massive user base, phishing risk is high if emails from @pump.fun get through

---

### 📋 LOWER PRIORITY — Worth Monitoring but less urgent

#### 9. Juice Finance (juice.finance) — ~55/100, MEDIUM
- **What:** Solana DeFi yield
- **SPF:** `v=spf1 include:_spf.google.com ~all` (soft fail)
- **DMARC:** `p=quarantine` (should upgrade)
- **Email:** Need to find
- **Template:** Template 3 (Quarantine)

#### 10. Orca (orca.so) — ~75/100, LOW (was 85 in first scan)
- **What:** Solana DEX (AMM)
- **SPF:** `v=spf1 include:_spf.google.com ~all` (soft fail)
- **DMARC:** `p=reject` (good!) but SPF is ~all
- **Email:** ops@orca.so (from DMARC rua)
- **X/Twitter:** @orca_so
- **Template:** Template 3 variant — DMARC is good but SPF ~all weakens it
- **Why it matters:** DMARC reject is great, but SPF ~all means DKIM is the only thing protecting them. If DKIM breaks, spoofing gets through.

---

## Scoring Reference

| Domain | SPF Score | DMARC Score | DKIM Score | MX Score | **Total** | **Level** |
|--------|-----------|-------------|-------------|----------|-----------|-----------|
| solend.fi | ~17 | 0 | 0 | 10 | **~27** | HIGH |
| mango.markets | 0 | 0 | 0 | 0 | **~0** | CRITICAL* |
| mrgn.fi | ~17 | 0 | 15 | 10 | **~42** | HIGH |
| francium.io | ~17 | 0 | 0 | 10 | **~27** | HIGH |
| helius.xyz | 35 | 20 | 15 | 10 | **~80** | LOW |
| openbook.wtf | 0 | 20 | 0 | ~5 | **~25** | HIGH* |
| sanctum.so | 35 | 20 | ? | 10 | **~65** | LOW |
| pump.fun | 35 | 20 | ? | 10 | **~65** | LOW |
| juice.finance | ~17 | 20 | ? | 10 | **~47** | MEDIUM |
| orca.so | ~17 | 40 | ? | 10 | **~67+** | LOW |

\* = no MX records, may not receive email on this domain

---

## Contact Info Summary

| # | Target | Email | X/Twitter | Bug Bounty | Notes |
|---|--------|-------|-----------|-----------|-------|
| 1 | Solend | security@solend.fi | TBD | ✅ Yes | Listed on bug bounty docs |
| 2 | Mango Markets | TBD (no MX) | @mangomarkets | ❌ | No MX records — may not receive email |
| 3 | mrgn.fi | security@mrgn.group | @marginfi | ✅ Immunefi | Already contacted for marginfi.com — follow up |
| 4 | Francium | contact@francium.io | @francium_defi | ❌ | Golden wiki / EdgeIn listing. Status: Dead/Inactive (2021) |
| 5 | Helius | support@helius.xyz | TBD | TBD | Listed on docs.helius.dev |
| 6 | OpenBook | TBD | @openbookdex | TBD | Community-led DEX, GitHub: openbook-dex, Discord |
| 7 | Sanctum | cloud@sanctum.so | @sanctumso | TBD | Listed on sanctum.so website |
| 8 | Pump.fun | TBD | @Pumpfun (X) / @pumpfunsupport (TG) | TBD | No public email found, Telegram support channel |
| 9 | Juice Finance | TBD | @Juice_Finance | TBD | No public email found |
| 10 | Orca | ops@orca.so | @orca_so | TBD | DMARC rua address = ops@orca.so |

---

## Outreach Priority

**Wave 2 — Best bets (clear vulnerability + real user impact + email available):**
1. **Solend** — security@solend.fi ✅ | No DMARC, has bug bounty program = security-conscious
2. **mrgn.fi** — security@mrgn.group ✅ | Already in contact for marginfi.com, easy follow-up
3. **Francium** — contact@francium.io ✅ | DMARC p=none = zero protection ⚠️ Note: project may be inactive
4. **Helius** — support@helius.xyz ✅ | Infrastructure provider powering Backpack, Phantom etc.
5. **Sanctum** — cloud@sanctum.so ✅ | Liquid staking competitor to Marinade
6. **Orca** — ops@orca.so ✅ | Good DMARC but SPF ~all gap

**X/DM only (no public email found):**
7. **Pump.fun** — @Pumpfun on X | Massive user base, quarantine DMARC
8. **OpenBook** — @openbookdex on X | Community DEX, no SPF at all
9. **Juice Finance** — @Juice_Finance on X | DMARC quarantine + SPF ~all

**Lower priority (no email, may not receive email):**
10. **Mango Markets** — No MX records, may not use domain for email. @mangomarkets on X