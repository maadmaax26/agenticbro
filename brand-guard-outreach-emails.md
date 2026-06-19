# Agentic Bro Brand Guard — Outreach Emails

*10 personalized outreach emails targeting companies with impersonated brands. Each includes real scan data from Agentic Bro Brand Guard.*

---

## 1. Luma AI

**To:** support@lumalabs.ai  
**Subject:** 3 lookalike domains impersonating Luma AI — your SPF has a gap

Your email authentication scores 90/100 — solid, but not airtight. Three lookalike domains are live right now: lumalabsai.com, lumalabs-ai.com, and getlumalabs.com. The last two resolve to known parking/suspicious IPs.

In May, UNC6032 used fake Luma AI social profiles and paid ads to distribute malware. Your SPF record uses `~all` (soft fail) instead of `-all` (hard fail), meaning spoofed emails from your domain won't be rejected — just marked. That's a gap attackers exploit after social impersonation drives victims to check email.

We ran a full Brand Guard assessment at no cost. You can review your complete exposure — email auth, lookalike domains, CertStream alerts — at [agenticbro.app/brand-guard](https://agenticbro.app/brand-guard).

Earl Finney Jr., Founder, Agentic Insights LLC

---

## 2. Kling AI

**To:** support@kling.ai  
**Subject:** klingai-app.com resolving to 9 suspicious IPs — Brand Guard findings

Your email auth is strong (90/100, DMARC reject), but one lookalike domain is a red flag. klingai-app.com resolves to 9 IPs in the 46.8.8.220–229 range — that's a suspiciously narrow allocation pattern consistent with phishing infrastructure.

UNC6032 already used fake Kling AI accounts and paid social ads to push malware in May. A lookalike domain with that kind of IP footprint is exactly the infrastructure they use for the next wave.

We've documented your full exposure in a free Brand Guard assessment. View your email spoof score, lookalike domain map, and real-time CertStream monitoring at [agenticbro.app/brand-guard](https://agenticbro.app/brand-guard).

Earl Finney Jr., Founder, Agentic Insights LLC

---

## 3. Hootsuite

**To:** support@hootsuite.com  
**Subject:** WhatsApp/Telegram impersonation + broad SPF — your Brand Guard scan results

Your email score is 90/100, but two vectors concern us. First, fraudsters are actively posing as Hootsuite reps on WhatsApp and Telegram with fake documents to steal credentials — that's a social impersonation attack your email auth can't touch. Second, your SPF record uses a very broad multi-include with `~all` (soft fail). Broad SPF includes increase your authorized sender surface, and soft fail means spoofed messages pass through instead of being rejected.

We've mapped your full brand exposure — email auth gaps, lookalike domains like myhootsuite.com, and social impersonation vectors — in a free Brand Guard assessment at [agenticbro.app/brand-guard](https://agenticbro.app/brand-guard).

Earl Finney Jr., Founder, Agentic Insights LLC

---

## 4. Ledger

**To:** support@ledger.com  
**Subject:** 6 lookalike domains targeting Ledger — including ledger-support.com

You have the highest-risk lookalike profile we've seen: six active domains including ledger-support.com, ledgerapp.com, ledger-app.com, ledgerai.com, ledger-ai.com, and myledger.com. The "support" variant is a textbook scam domain — victims searching for Ledger help land there first.

Your email auth scores 90/100 (DMARC reject), but SPF uses `~all` (soft fail) with both Google and Amazon SES includes. In April, fake emails about "post quantum security patches" were already circulating. Tightening SPF to hard fail and aggressively pursuing the lookalike domains would close the gap.

We've documented your complete exposure in a free Brand Guard assessment at [agenticbro.app/brand-guard](https://agenticbro.app/brand-guard).

Earl Finney Jr., Founder, Agentic Insights LLC

---

## 5. Phantom

**To:** help.phantom.com (ticket submission)

**Subject:** phantomsupport.com is live — 6 lookalike domains despite your gold-standard email auth

Your email authentication is the best we've scored: 100/100. Hard fail SPF, strict DMARC with reject, proper alignment. But phantomsupport.com is live and dangerous. Six lookalike domains are registered: phantomapp.com, phantomsupport.com, phantomai.com, phantom-ai.com, getphantom.com, and myphantom.com. The "support" variant is the highest-risk pattern — users searching "Phantom support" will find it.

Your email auth can't protect against victims navigating to a lookalike directly. Domain takedowns and CertStream monitoring are the fix here.

We've mapped your full exposure in a free Brand Guard assessment at [agenticbro.app/brand-guard](https://agenticbro.app/brand-guard).

Earl Finney Jr., Founder, Agentic Insights LLC

---

## 6. MoonPay

**To:** support@moonpay.com  
**Subject:** moonpaysupport.com is live — active phishing campaigns + 2 lookalike domains

Your email auth is perfect (100/100, hard fail SPF, DMARC reject). But the threats are outside email. Active phishing campaigns are sending fake transaction confirmations. Telegram impersonation is ongoing. Two lookalike domains: moonpayapp.com (suspicious DNS at 172.65.211.209) and moonpaysupport.com (CRITICAL — 77.37.34.159, a live support-scam domain).

Victims who search "MoonPay support" will hit that domain. Your email hardening won't save them there — you need domain-level protection and real-time monitoring.

We've mapped your complete exposure in a free Brand Guard assessment at [agenticbro.app/brand-guard](https://agenticbro.app/brand-guard).

Earl Finney Jr., Founder, Agentic Insights LLC

---

## 7. Ripple

**To:** info@ripple.com  
**Subject:** DMARC quarantine + 6 lookalike domains — your brand scored 80/100

Your email authentication scored 80/100 — the lowest passing grade. Two critical issues: your DMARC policy is `p=quarantine`, not `p=reject`. That means spoofed emails from ripple.com get quarantined, not blocked. Combined with a very broad SPF (SendGrid, Salesforce, Pardot, Greenhouse — all `~all` soft fail), your authorized sender surface is wide open.

Six lookalike domains are registered, including ripplesupport.com (CRITICAL). Fake XRP giveaways and deepfakes of Brad Garlinghouse are actively running on X, Facebook, and Instagram. Switching DMARC to reject and tightening SPF would close the biggest gaps.

We've documented your full exposure in a free Brand Guard assessment at [agenticbro.app/brand-guard](https://agenticbro.app/brand-guard).

Earl Finney Jr., Founder, Agentic Insights LLC

---

## 8. Notion

**To:** abuse@makenotion.com  
**Subject:** Email auth scored 40/100 — 8 lookalike domains targeting Notion

Your brand is the most exposed in our dataset. Email authentication scored 40/100 (HIGH RISK). SPF is `v=spf1 ~all` — minimal, allows nearly everything. DMARC is `p=quarantine`, not reject. No DKIM and no MX records found. Any attacker can send email that appears to come from makenotion.com.

Eight lookalike domains are live, including notionsupport.com, notion-support.com, notionapp.com, notion-app.com, notionai.com, notion-ai.com, getnotion.com, and mynotion.com. Two are "support" variants — the most dangerous pattern. Phishing campaigns with fake Notion login pages are active right now.

This is fixable. We've mapped your full exposure in a free Brand Guard assessment at [agenticbro.app/brand-guard](https://agenticbro.app/brand-guard).

Earl Finney Jr., Founder, Agentic Insights LLC

---

## 9. Vercel

**To:** abuse@vercel.com  
**Subject:** Your infrastructure is being abused for phishing + 2 support-scam domains live

Your email auth scored 80/100 — DMARC is `p=quarantine` (not reject), SPF uses broad includes with soft fail. But the bigger issue: in February, hackers used Vercel GenAI to mass-produce phishing sites mimicking Microsoft, Adidas, and Nike on your infrastructure. That makes Vercel itself an attack vector, not just a target.

Six lookalike domains are registered, including vercelsupport.com and vercel-support.com — two live support-scam domains (CRITICAL). When your own platform is being weaponized and your brand has active scam domains, the exposure compounds fast.

We've documented your full exposure in a free Brand Guard assessment at [agenticbro.app/brand-guard](https://agenticbro.app/brand-guard).

Earl Finney Jr., Founder, Agentic Insights LLC

---

## 10. Malwarebytes

**To:** security@malwarebytes.com  
**Subject:** malwarebytessupport.com is a live support-scam domain — your Brand Guard scan

Your email auth is solid — 100/100 with hard fail SPF, DMARC reject, and proper DKIM. But malwarebytessupport.com is a live support-scam domain (CRITICAL risk). For a security company, having an active impersonation domain is especially damaging — it erodes the trust your brand is built on.

In February, AI website builders were used to clone the Malwarebytes brand directly. Your email hardening is textbook, but the threats are landing at the domain and social layer, not email. Real-time CertStream monitoring and proactive takedowns are the next step.

We've mapped your complete brand exposure in a free Brand Guard assessment at [agenticbro.app/brand-guard](https://agenticbro.app/brand-guard).

Earl Finney Jr., Founder, Agentic Insights LLC

---

*All scan data collected via Agentic Bro Brand Guard at agenticbro.app. Emails drafted June 2026.*