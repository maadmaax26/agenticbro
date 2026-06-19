# Brand Guard Outreach - Contact Tracker

**Created:** 2026-06-03
**Goal:** First paying customer at $29/mo

---

## Priority Targets - Full Contact Intel

### 🔴 #1: Backpack (backpack.app) - Score: 55/100, MEDIUM - NO DMARC

**What:** Solana wallet + exchange (real users, real funds)
**Vulnerability:** NO DMARC + SPF ~all → fully spoofable domain
**Why they're #1:** Bug bounty program = security-conscious. Fake "verify wallet" emails from @backpack.app would go straight to inboxes. 10-minute DNS fix.

| Channel | Contact | Notes |
|---------|---------|-------|
| Email | support@backpack.exchange | Support desk (listed on support.backpack.exchange) |
| Email | contact@backpack.app | General contact (Google Play listing) |
| X/Twitter | @armaniferrante | CEO/Founder Armani Ferrante (technical - created Anchor framework) |
| X/Twitter | @Backpack | Official account |
| Bug Bounty | Hackenproof | Active program - they take security seriously |
| LinkedIn | backpackexchange | Company page |

**Template:** Template 1 (No DMARC)
**Status:** ⬜ Not contacted

---

### 🔴 #2: Jito (jito.wtf) - Score: 55/100, MEDIUM - NO DMARC

**What:** Leading Solana MEV/infrastructure (validators, staking, JitoSOL)
**Vulnerability:** NO DMARC + SPF ~all → fully spoofable domain

| Channel | Contact | Notes |
|---------|---------|-------|
| Email | contact@jito.wtf | Listed on jito.wtf/validators page |
| Email | privacy@jito.wtf | Privacy contact |
| X/Twitter | @buffalu__ | CEO/Co-Founder Lucas Bruder |
| X/Twitter | @jito_labs | Official account |
| X/Twitter | @jito_sol | Official account |

**Template:** Template 1 (No DMARC)
**Status:** ⬜ Not contacted

---

### ⚠️ #3: Marginfi (marginfi.com) - Score: 55/100, MEDIUM - Weak SPF + DMARC quarantine

**What:** DeFi lending/borrowing protocol on Solana
**Vulnerability:** SPF ~all (soft fail) + DMARC quarantine only

| Channel | Contact | Notes |
|---------|---------|-------|
| Email | security@mrgn.group | Listed on GitHub SECURITY policy - bug bounty reports |
| X/Twitter | @marginfi | Official account |
| Bug Bounty | Immunefi | Active program (5-level severity scale) |
| GitHub | mrgnlabs/marginfi-v2 | Security overview on GitHub |
| Key Person | @edgarpavlovsky | Co-founder (active on X) |

**Template:** Template 2 (Weak DMARC)
**Status:** ⬜ Not contacted

---

### ⚠️ #4: Drift (drift.trade) - Score: 70/100, LOW - SPF ~all + DMARC quarantine

**What:** Solana DEX (perps + spot trading)
**Vulnerability:** SPF ~all + DMARC quarantine only
**Note:** drift-trade.app is a known SCAM domain (phishdestroy flagged)

| Channel | Contact | Notes |
|---------|---------|-------|
| Email | hello@drift.trade | Listed on Medium and bug bounty docs |
| X/Twitter | @DriftProtocol | Official account |
| Discord | discord.com/invite/95kByNnDy5 | Active community |
| Bug Bounty | Yes | Uses Immunefi severity classification |
| Audit | Trail of Bits | Audit report at drift.trade/audit |

**Template:** Template 3 (DMARC Quarantine)
**Status:** ⬜ Not contacted

---

### ⚠️ #5: Switchboard (switchboard.xyz) - Score: 70/100, LOW - SPF ~all + DMARC quarantine

**What:** Decentralized oracle network on Solana
**Vulnerability:** SPF ~all + DMARC quarantine only

| Channel | Contact | Notes |
|---------|---------|-------|
| Email | hello@switchboard.xyz | Crunchbase-listed contact |
| X/Twitter | @switchboardxyz | Official account |
| Key Person | Chris Hermida | Co-Founder (found via LinkedIn/RocketReach) |
| GitHub | switchboard-xyz | Active open-source repos |

**Template:** Template 3 (DMARC Quarantine)
**Status:** ⬜ Not contacted

---

### ⚠️ #6: Marinade Finance (marinade.finance) - Score: 70/100, LOW - SPF ~all + DMARC quarantine

**What:** Solana liquid staking (mSOL)
**Vulnerability:** SPF ~all + DMARC quarantine only

| Channel | Contact | Notes |
|---------|---------|-------|
| Email | institutional@marinade.finance | Listed on institutions page |
| Email | info@marinade.finance | Listed in privacy policy |
| X/Twitter | @MarinadeFinance | Official account |
| Bug Bounty | Yes | Own program (not on Immunefi), up to $250K for critical |
| Key Person | Michael Repetný | Co-Founder/CEO |

**Template:** Template 3 (DMARC Quarantine)
**Status:** ⬜ Not contacted

---

## Wave 3 — Impersonation Victims (Active Phishing Targets)

### 🎯 #1: Magic Eden (magiceden.io) — CRITICAL: No SPF, No DMARC, No DKIM

**What:** #1 Solana NFT marketplace — millions of users, high-value transactions
**Impersonation evidence:** Dedicated help pages for scam/impersonation warnings. Reddit reports of fake Magic Eden emails sending users to phishing sites (mycrypto360.com). Fake accounts with 50K+ followers posting phishing links.
**Vulnerability:** Zero email authentication — no SPF, no DMARC, no DKIM. Anyone can send emails from @magiceden.io and email providers will deliver them normally.
**Why them:** They literally have a "How to Spot Scams & Impersonators" help page — they know the problem exists but haven't fixed their own email security. A fake "your NFT got a big offer" email from @magiceden.io is exactly what scammers are already sending.

| Channel | Contact | Notes |
|---------|---------|-------|
| Email | support@magiceden.io | Help center contact |
| X/Twitter | @MagicEden | Official account (2M+ followers) |
| Help Center | help.magiceden.io | Trust & Safety collection — scam reporting |
| X/Twitter | @ME_Trust_Safety | Possible trust/safety account |

**Template:** Template 1 (No DMARC) — lead with email spoof scan + phishing evidence
**Status:** ⬜ Not contacted

---

### 🎯 #2: Metaplex (metaplex.com) — CRITICAL: No SPF, No DMARC, No DKIM

**What:** NFT tokenization protocol used for 99% of token/NFT issuance on Solana. Foundation DAO.
**Impersonation evidence:** Reddit reports of fake Metaplex airdrop NFTs draining wallets. Users interact with fake "Metaplex" sites that look identical to the real app.
**Vulnerability:** Zero email authentication — no SPF, no DMARC, no DKIM. Anyone can spoof @metaplex.com.
**Why them:** They have a formal security reporting process (developers.metaplex.com/security) and a security council — they take security seriously. This is a clear gap they'd want to close.

| Channel | Contact | Notes |
|---------|---------|-------|
| Email | security@metaplex.com | Security page (developers.metaplex.com/security) |
| Email | privacy@metaplex.com | Privacy policy contact |
| X/Twitter | @metaplex | Official account |
| GitHub | metaplex-foundation | Active repos |
| Security | developers.metaplex.com/security | Formal vulnerability reporting process |

**Template:** Template 1 (No DMARC) — lead with email spoof scan + NFT phishing evidence
**Status:** ⬜ Not contacted

---

### 🎯 #3: Tensor Foundation (tensor.foundation) — CRITICAL: No SPF, No DMARC, No DKIM

**What:** #1 NFT trading engine on Solana (60-70% of Solana NFT volume). Backed by Placeholder VC, Solana Ventures, Toly and Raj.
**Impersonation evidence:** NFT marketplace phishing is rampant — fake Tensor sites and accounts are documented. Users on Reddit report being drained by fake marketplace connections.
**Vulnerability:** Zero email authentication — no SPF, no DMARC, no DKIM on tensor.foundation.
**Why them:** They have a 7-person security council for governance. They clearly care about security infrastructure. This is an obvious blind spot.

| Channel | Contact | Notes |
|---------|---------|-------|
| Email | info@tensor.foundation | Listed in Terms of Service |
| Email | privacy@tensor.foundation | Listed in Privacy Notice |
| X/Twitter | @tensor_hq | Official account |
| Discord | tensor.trade | Active community |
| Security Council | 7 independent members | Reviews all governance proposals |

**Template:** Template 1 (No DMARC) — lead with email spoof scan + NFT phishing context
**Status:** ⬜ Not contacted

---

## Recent Impersonation Victims (Template 4)

### Jupiter Exchange (jup.ag) — Score: 85/100, PROTECTED
**What happened:** Fake CJUP airdrop drainer circulating
| Channel | Contact | Notes |
|---------|---------|-------|
| X/Twitter | Need to find | — |

### Axiom
**What happened:** 207 users hit by fake app impersonation
| Channel | Contact | Notes |
|---------|---------|-------|
| X/Twitter | Need to find | — |

---

## Outreach Priority & Approach

### Recommended Send Order

1. **Backpack** - Email to support@backpack.exchange + DM @armaniferrante on X
   - Highest impact: wallet with real funds, no DMARC, has bug bounty = cares about security
   - Frame it as a responsible disclosure ("found this while scanning Solana domains")

2. **Jito** - Email to contact@jito.wtf + DM @buffalu__ on X
   - Infrastructure giant, no DMARC, easy win

3. **Drift** - Email to hello@drift.trade + DM @DriftProtocol on X
   - Has bug bounty program, known scam domain impersonating them (drift-trade.app)

4. **Marinade** - Email to info@marinade.finance + DM @MarinadeFinance on X
   - Has bug bounty ($250K critical), security-conscious

5. **Switchboard** - Email to hello@switchboard.xyz + DM @switchboardxyz on X
   - Oracle provider, Crunchbase-listed contact

6. **Marginfi** - Contact via support.marginfi.com + DM @marginfi on X
   - No direct email, but active on Immunefi + X

### Channel Strategy
1. **Email first** - Professional, includes scan proof, hard to ignore
2. **X DM follow-up** - More casual, link to full report, crypto-native
3. **LinkedIn** - Last resort if no response

### Key Insight: Bug Bounty Projects Are Warm Leads
4 out of 6 targets have active bug bounty programs (Backpack, Marginfi, Drift, Marinade). These teams already value security and pay for vulnerability reports. Email spoofing findings are exactly the kind of thing they'd want to know about - and they're already budgeted for it.

---

## Follow-up Tracking

| Date | Target | Channel | Template | Response | Next Step |
|------|--------|---------|----------|----------|-----------|
| 2026-06-03 | Jito | Email | 1 (No DMARC) | contact@jito.wtf + privacy@jito.wtf sent | Awaiting response |
| 2026-06-03 | Backpack | Email | 1 (No DMARC) | support@backpack.exchange + contact@backpack.app sent | Awaiting response |
| 2026-06-03 | Marginfi | Email | 2 (Weak DMARC) | security@mrgn.group sent | Awaiting response |
| 2026-06-03 | Switchboard | Email | 3 (Quarantine) | hello@switchboard.xyz sent | Awaiting response |
| 2026-06-03 | Marinade | Email | 3 (Quarantine) | info@marinade.finance sent | Awaiting response |
| 2026-06-03 | Drift | Email | 3 (Quarantine) | hello@drift.trade sent | Awaiting response |

---

**Next Action:** Send personalized email to Backpack (support@backpack.exchange), or DM @armaniferrante on X with scan findings.