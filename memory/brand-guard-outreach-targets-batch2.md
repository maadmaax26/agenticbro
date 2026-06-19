# Brand Guard Outreach Targets — Batch 2

## Recent Attack Victims & Impersonated Brands

Scanned June 3, 2026. Focus: companies with recent domain takeovers, account hijacks, impersonation campaigns, or weak email security that makes them vulnerable.

---

## 🔴 TIER 1 — Recent Attack Victims (HIGHEST PRIORITY)

### 1. CoW Swap / CoW DAO — `cow.fi`
- **Attack:** April 14, 2026 — Domain hijacked via social engineering of registrar (Gandi SAS). $1.2M in user losses. DNS redirected to phishing site that drained wallets.
- **Email Security:** DMARC p=reject, SPF `-all` → **Score: 85/100 PROTECTED**
- **Why outreach:** They just got hit HARD via domain hijack. They need *domain monitoring* (Brand Guard's domain monitor watches crt.sh for lookalikes). They're now security-conscious and have DAO treasury.
- **Contact:** @CoWSwap on X, forum.cow.fi governance, security@cow.fi
- **Pitch angle:** "You just survived a domain hijack. Brand Guard monitors crt.sh for lookalike domains impersonating cow.fi in real-time."

### 2. Pepeto — `pepeto.io` / `pepetocoin.com`
- **Attack:** Hacked THREE TIMES in 30 days (April 28, May 9, May 27, 2026). Domain repeatedly hijacked. Lost control of pepeto.io → pepetoswap.com → pepetocoin.com.
- **Email Security:** NO DMARC, NO SPF on either domain → **Score: 0/100 CRITICAL**
- **Why outreach:** Worst-case scenario — 3 domain takeovers in a month. Their email is completely unprotected. Brand Guard could have caught the lookalike domains before each attack.
- **Contact:** X @PepetoOfficial, pepetocoin.com contact
- **Pitch angle:** "3 domain takeovers in 30 days. Brand Guard monitors for lookalike domains and alerts you before the next attack."

### 3. Lifinity — `lifinity.io`
- **Attack:** Active phishing campaign — counterfeit sites like lfinity.io stealing funds. Review sites flag it as "severe security risk." Project is winding down (deadline Dec 2026).
- **Email Security:** SPF `~all` (soft fail), NO DMARC → **Score: ~30/100 HIGH**
- **Why outreach:** Even though winding down, still has active users being phished. Soft fail SPF means spoofable.
- **Contact:** X @Lifinity_Labs, GitHub Lifinity-Labs
- **Pitch angle:** "Users are being phished on lfinity.io right now. Brand Guard detects lookalike domains and alerts your team."

### 4. Xaman Wallet (XRPL) — `xaman.app`
- **Attack:** Founder reports 20+ new fake Twitter accounts and 10+ fake domains created DAILY impersonating Xaman. Desktop wallet scam running.
- **Email Security:** DMARC p=quarantine, SPF `-all` (strict) → **Score: ~75/100 LOW**
- **Why outreach:** They're being MASSIVELY impersonated right now. 20+ scam accounts/day. Even with decent email security, they need domain monitoring for lookalikes.
- **Contact:** @XamanWallet on X, founder Wietse Wind, xaman.app/contact
- **Pitch angle:** "20+ scam accounts/day impersonating you. Brand Guard detects lookalike domains and impersonation automatically."

---

## 🟡 TIER 2 — Vulnerable Domains (HIGH VALUE)

### 5. Solend — `solend.fi`
- **Vulnerability:** SPF `~all` (soft fail), NO DMARC → **Score: 30/100 HIGH**
- **Why outreach:** DeFi lending protocol on Solana. Soft fail SPF means anyone can spoof @solend.fi emails. No DMARC = emails land in inbox by default.
- **Contact:** X @solendprotocol, Discord, GitHub solendprotocol
- **Pitch angle:** "Your @solend.fi emails can be spoofed — no DMARC, soft fail SPF. Brand Guard secures your email domain and monitors for impersonation."

### 6. Velora (ParaSwap) — `velora.io`
- **Vulnerability:** SPF `~all` (soft fail) via PrivateEmail, NO DMARC → **Score: ~30/100 HIGH**
- **Why outreach:** DEX aggregator that just rebranded from ParaSwap. Soft fail SPF + no DMARC + PrivateEmail (cheap email) = easy to spoof. They process trades — spoofed emails could phish users.
- **Contact:** X @VeloraDEX, founder Mounir Benchemled
- **Pitch angle:** "Velora processes trades but your email domain is spoofable. Brand Guard adds DMARC enforcement and monitors for lookalikes."

### 7. THORChain — `thorchain.org`
- **Vulnerability:** DMARC p=none (monitoring only!), SPF `~all` (soft fail) → **Score: ~40/100 MEDIUM**
- **Why outreach:** Cross-chain DEX that suffered $10.7M exploit in June 2026. DMARC p=none means they're only monitoring, not blocking spoofed emails. After a major hack, they should be security-conscious.
- **Contact:** X @THORChain, Discord, community governance
- **Pitch angle:** "After the $10.7M exploit, your email domain is still vulnerable — DMARC p=none means anyone can spoof @thorchain.org. Brand Guard fixes this."

### 8. Sui Foundation — `sui.io`
- **Vulnerability:** DMARC p=quarantine (not reject), SPF `-all` with HubSpot+SendGrid includes → **Score: ~75/100 LOW**
- **Why outreach:** Layer 1 blockchain. DMARC quarantine means spoofed emails still reach spam (not rejected). HubSpot+SendGrid includes expand attack surface.
- **Contact:** X @SuiNetwork, sui.io
- **Pitch angle:** "Your DMARC is quarantine-only — spoofed emails still reach spam folders. Brand Guard upgrades to p=reject and monitors lookalikes."

---

## 🟢 TIER 3 — Recent Incident + Decent Security (MONITORING PITCH)

### 9. Ubuntu/Canonical — `ubuntu.com`
- **Attack:** Official X account @ubuntu was hijacked May 7, 2026 to promote fake "Numbat" crypto scam. Sophisticated phishing site mimicked official docs.
- **Email Security:** DMARC p=none, SPF `~all` (soft fail) → **Score: ~40/100 MEDIUM**
- **Why outreach:** Major brand with X account hijacked. DMARC p=none is weak for a company their size. They need monitoring + DMARC enforcement.
- **Contact:** Canonical security team, @ubuntu on X
- **Pitch angle:** "After the @ubuntu X account hijack, your email domain is still DMARC p=none. Brand Guard monitors for lookalike domains and enforces DMARC."

### 10. Drift Protocol — `drift.trade`
- **Vulnerability:** DMARC p=quarantine, SPF soft-ish → **Score: 70/100 LOW**
- **Why outreach:** Solana DEX that was part of the $577M April 2026 Lazarus attacks. Even with decent email security, they need domain monitoring after being targeted by nation-state actors.
- **Contact:** X @DriftProtocol
- **Pitch angle:** "After being targeted by Lazarus Group, monitor for lookalike domains and impersonation with Brand Guard."

---

## Key Incident Timeline (for outreach context)

| Date | Target | Attack Type | Impact |
|------|--------|-------------|--------|
| Apr 14, 2026 | CoW Swap (cow.fi) | Domain hijack via registrar social engineering | $1.2M user losses |
| Apr 28, 2026 | Pepeto (pepeto.io) | Domain takeover #1 | Domain lost |
| May 7, 2026 | Ubuntu (@ubuntu) | X account hijack → crypto scam | Brand damage |
| May 9, 2026 | Pepeto (pepetoswap.com) | Domain takeover #2 | Domain lost again |
| May 2026 | Xaman Wallet | 20+ fake X accounts/day + fake domains | Ongoing impersonation |
| May 2026 | Lifinity (lfinity.io) | Phishing site impersonation | User fund theft |
| May 27, 2026 | Pepeto (pepetocoin.com) | Domain takeover #3 | Domain lost again |
| May 30, 2026 | Gravity Bridge | Bridge exploit | $5.4M |
| May 31, 2026 | MetaMask | Fake "mandatory update" phishing | Hundreds of EVM wallets drained |
| Jun 1, 2026 | THORChain | Bridge exploit (ignored security warning) | $10.7M |

---

## Scanning Results Summary (DNS-verified)

| Domain | DMARC | SPF | Score Est. | Risk Level |
|--------|-------|-----|------------|-------------|
| pepeto.io | ❌ NONE | ❌ NONE | 0 | CRITICAL |
| pepetocoin.com | ❌ NONE | ❌ NONE | 0 | CRITICAL |
| lifinity.io | ❌ NONE | ~all (soft) | ~30 | HIGH |
| solend.fi | ❌ NONE | ~all (soft) | 30 | HIGH |
| velora.io | ❌ NONE | ~all (PrivateEmail) | ~30 | HIGH |
| thorchain.org | p=none | ~all (soft) | ~40 | MEDIUM |
| ubuntu.com | p=none | ~all (soft) | ~40 | MEDIUM |
| drift.trade | p=quarantine | soft-ish | 70 | LOW |
| sui.io | p=quarantine | -all (with includes) | ~75 | LOW |
| xaman.app | p=quarantine | -all | ~75 | LOW |
| cow.fi | p=reject | -all | 85 | PROTECTED |
| axelar.network | p=reject | -all (strict) | 85+ | PROTECTED |
| kelpdao.xyz | p=reject | -all | 85+ | PROTECTED |

---

## Outreach Priority Order

1. **Pepeto** — 3 domain takeovers, 0/100 CRITICAL, urgent need
2. **Solend** — Solana DeFi, 30/100 HIGH, easy pitch
3. **Lifinity** — Active phishing, 30/100 HIGH
4. **Velora** — Just rebranded, 30/100 HIGH, expanding
5. **THORChain** — Just exploited, 40/100 MEDIUM, DMARC p=none
6. **Xaman** — 20+ scam accounts/day, needs monitoring even with decent email
7. **CoW Swap** — Just hijacked, needs domain monitoring (email OK)
8. **Ubuntu/Canonical** — X hijacked, DMARC p=none (enterprise account)
9. **Drift** — Lazarus target, needs domain monitoring
10. **Sui** — L1 blockchain, DMARC quarantine-only