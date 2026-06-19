# Brand Guard Outreach List — 10 Companies with Recent Brand Impersonation

**Generated:** June 6, 2026 | **Tool:** Agentic Bro Brand Guard (email-spoof + lookalike domain scan)

---

## 1. Luma AI 🟡

**Company Size:** ~165 employees | **Domain:** lumalabs.ai

**Recent Impersonation (May 2025):** UNC6032 threat group (Mandiant-tracked) created fake Luma AI social media profiles + paid ads distributing malware-laced downloads to US users.

**Contact:** support@lumalabs.ai | lumalabs.ai/contact-sales

**📧 Brand Guard — Email Spoof Check**
| Check | Result | Score |
|-------|--------|-------|
| SPF | ✅ `v=spf1 include:_spf.google.com ~all` (soft fail) | 25/35 |
| DMARC | ✅ `p=reject` — Full enforcement | 40/40 |
| DKIM | ✅ google selector found | 15/15 |
| MX | ✅ Google Workspace | 10/10 |
| **Total** | | **90/100 — PROTECTED** |

⚠️ SPF uses `~all` (soft fail) instead of `-all` (hard fail) — emails from unauthorized servers may still be delivered to spam instead of rejected outright.

🔍 **Lookalike Domains Found:**
| Domain | IP | Risk |
|--------|-----|------|
| lumalabsai.com | 103.224.182.216 | HIGH — brand+TLD squat |
| lumalabs-ai.com | 103.224.212.108 | HIGH — hyphenated variant |
| getlumalabs.com | 104.21.90.144 (Cloudflare) | MEDIUM — "get" prefix pattern |

---

## 2. Kling AI 🔴

**Company Size:** ~34 employees | **Revenue:** $3.7M | **Domain:** klingai.com

**Recent Impersonation (May 2025):** Same UNC6032 campaign — fake Kling AI accounts + paid social ads pushing malware downloads.

**Contact:** support@kling.ai | klingai_api_platform@kuaishou.com

**📧 Brand Guard — Email Spoof Check**
| Check | Result | Score |
|-------|--------|-------|
| SPF | ✅ `v=spf1 include:_spf.google.com ~all` (soft fail) | 25/35 |
| DMARC | ✅ `p=reject; sp=reject` — Full enforcement + subdomain | 40/40 |
| DKIM | ✅ google selector found | 15/15 |
| MX | ✅ Google Workspace | 10/10 |
| **Total** | | **90/100 — PROTECTED** |

⚠️ Same `~all` soft fail issue as Luma AI.

🔍 **Lookalike Domains Found:**
| Domain | IP | Risk |
|--------|-----|------|
| klingai-app.com | 46.8.8.220-229 (9 IPs!) | CRITICAL — app variant, suspicious IP range |

---

## 3. Hootsuite 🟡

**Company Size:** ~1,200 employees | **Domain:** hootsuite.com

**Recent Impersonation (May 2025):** Fraudsters posed as Hootsuite company reps on WhatsApp & Telegram with fake docs to steal credentials from US marketing professionals.

**Contact:** support@hootsuite.com | hootsuite.com/contact

**📧 Brand Guard — Email Spoof Check**
| Check | Result | Score |
|-------|--------|-------|
| SPF | ✅ Complex multi-include with `~all` (soft fail) | 25/35 |
| DMARC | ✅ `p=reject; pct=100` — Full enforcement | 40/40 |
| DKIM | ✅ google, s1, s2, mail selectors | 15/15 |
| MX | ✅ Google Workspace | 10/10 |
| **Total** | | **90/100 — PROTECTED** |

⚠️ Very broad SPF — includes many 3rd-party senders (SendGrid, HubSpot, etc.) which increases attack surface.

🔍 **Lookalike Domains Found:**
| Domain | IP | Risk |
|--------|-----|------|
| myhootsuite.com | 34.111.46.214 (GCP) | MEDIUM — "my" prefix |

---

## 4. Ledger 🔴

**Company Size:** ~400 employees | **Domain:** ledger.com

**Recent Impersonation (April 2026 — ACTIVE):** Ongoing fake accounts & emails about "post quantum security patches." Ledger publicly warning users about impersonation scams on X.

**Contact:** support@ledger.com | Report phishing via support.ledger.com

**📧 Brand Guard — Email Spoof Check**
| Check | Result | Score |
|-------|--------|-------|
| SPF | ✅ `include:_spf.google.com include:amazonses.com ~all` | 25/35 |
| DMARC | ✅ `p=reject` — Full enforcement | 40/40 |
| DKIM | ✅ google selector found | 15/15 |
| MX | ✅ Google Workspace | 10/10 |
| **Total** | | **90/100 — PROTECTED** |

⚠️ Includes Amazon SES — if a sender's AWS credentials are compromised, they could spoof via SES.

🔍 **Lookalike Domains Found:**
| Domain | IP | Risk |
|--------|-----|------|
| ledgerapp.com | 74.220.199.6 | HIGH — app variant |
| ledger-app.com | 3.12.83.239 (AWS) | HIGH — hyphenated |
| ledger-support.com | 76.223.54.146 (Global Accelerate) | CRITICAL — support impersonation |
| ledgerai.com | 76.223.54.146 | HIGH — AI prefix |
| ledger-ai.com | 54.215.31.113 (AWS) | HIGH — AI variant |
| myledger.com | 76.223.54.146 | MEDIUM — "my" prefix |

**6 lookalike domains detected** — highest count in the set. ledger-support.com is especially dangerous (classic support scam pattern).

---

## 5. Phantom 🔴

**Company Size:** ~150 employees | **Domain:** phantom.com

**Recent Impersonation (Ongoing):** Fake DM accounts pretending to be Phantom Support, asking for recovery phrases. Lookalike profiles across X and Telegram.

**Contact:** help.phantom.com (ticket-based, no public email) | DM @phantom on X

**📧 Brand Guard — Email Spoof Check**
| Check | Result | Score |
|-------|--------|-------|
| SPF | ✅ `include:_spf.google.com include:amazonses.com include:sendgrid.net -all` (HARD FAIL) | 35/35 |
| DMARC | ✅ `p=reject; pct=100; aspf=r; adkim=r` — Strict enforcement | 40/40 |
| DKIM | ✅ google selector found | 15/15 |
| MX | ✅ Google Workspace | 10/10 |
| **Total** | | **100/100 — PROTECTED** |

✅ Only company in this set using hard fail `-all` SPF + strict DMARC alignment. Gold standard config.

🔍 **Lookalike Domains Found:**
| Domain | IP | Risk |
|--------|-----|------|
| phantomapp.com | 192.64.119.203 | HIGH — app variant |
| phantomsupport.com | 76.223.54.146 (Global Accelerate) | CRITICAL — support scam |
| phantomai.com | 76.223.54.146 | HIGH — AI variant |
| phantom-ai.com | 212.92.105.218 | HIGH — AI hyphenated |
| getphantom.com | 76.223.54.146 | MEDIUM — "get" prefix |
| myphantom.com | 5.22.145.121 | MEDIUM — "my" prefix |

**6 lookalike domains** — phantomsupport.com is the highest risk (direct support impersonation vector).

---

## 6. MoonPay 🔴

**Company Size:** ~500 employees | **Domain:** moonpay.com

**Recent Impersonation (Ongoing):** Widespread phishing campaigns impersonating MoonPay support; fake transaction confirmation emails; scammers using MoonPay branding on Telegram.

**Contact:** support@moonpay.com | support.moonpay.com

**📧 Brand Guard — Email Spoof Check**
| Check | Result | Score |
|-------|--------|-------|
| SPF | ✅ Multi-include with `-all` (hard fail) | 35/35 |
| DMARC | ✅ `p=reject; sp=reject; pct=100` — Full enforcement | 40/40 |
| DKIM | ✅ google, s1, s2 selectors | 15/15 |
| MX | ✅ Mailstream (Trend Micro) | 10/10 |
| **Total** | | **100/100 — PROTECTED** |

✅ Strong email auth. But email is only part of the picture — social impersonation is the real vector.

🔍 **Lookalike Domains Found:**
| Domain | IP | Risk |
|--------|-----|------|
| moonpayapp.com | 172.65.211.209 (exp.gname.net) | HIGH — app variant, suspicious DNS |
| moonpaysupport.com | 77.37.34.159 | CRITICAL — support impersonation |

---

## 7. Ripple 🟡

**Company Size:** ~900 employees | **Domain:** ripple.com

**Recent Impersonation (Ongoing):** Fake Ripple/XRP giveaways on X, Facebook, Instagram. Deepfakes of Brad Garlinghouse. Impersonation campaigns using legitimate video footage with scam overlays.

**Contact:** info@ripple.com | xrpl.org/community/report-a-scam

**📧 Brand Guard — Email Spoof Check**
| Check | Result | Score |
|-------|--------|-------|
| SPF | ✅ Very broad includes with `~all` (soft fail) | 25/35 |
| DMARC | ⚠️ `p=quarantine` — NOT reject! | 30/40 |
| DKIM | ✅ google, s1, s2 selectors | 15/15 |
| MX | ✅ Proofpoint hosted | 10/10 |
| **Total** | | **80/100 — LOW PROTECTION** |

⚠️ **DMARC is quarantine, not reject.** Spoofed emails may land in spam but not be rejected. Also, very broad SPF with many 3rd-party includes (SendGrid, Salesforce, Pardot, Greenhouse) increases attack surface significantly.

🔍 **Lookalike Domains Found:**
| Domain | IP | Risk |
|--------|-----|------|
| rippleapp.com | 104.21.68.209 (Cloudflare) | HIGH — app variant |
| ripple-app.com | 15.197.225.128 (AWS) | HIGH — hyphenated |
| ripplesupport.com | 54.243.117.197 (AWS) | CRITICAL — support scam |
| rippleai.com | 76.223.54.146 | HIGH — AI variant |
| getripple.com | 18.233.141.236 (AWS) | MEDIUM — "get" prefix |
| myripple.com | 15.197.225.128 (AWS) | MEDIUM — "my" prefix |

**6 lookalike domains.** ripplesupport.com is the highest risk — classic crypto support scam pattern.

---

## 8. Notion 🔴

**Company Size:** ~800 employees | **Domain:** notion.so

**Recent Impersonation (Ongoing):** Phishing campaigns using fake Notion login pages, malvertising directing users to cloned Notion sites, Notion platform itself abused to host phishing pages.

**Contact:** abuse@makenotion.com (report platform abuse) | trustcenter.notion.com

**📧 Brand Guard — Email Spoof Check**
| Check | Result | Score |
|-------|--------|-------|
| SPF | ⚠️ `v=spf1 ~all` — MINIMAL SPF, allows all! | 10/35 |
| DMARC | ⚠️ `p=quarantine; pct=100` — NOT reject | 30/40 |
| DKIM | ❌ No DKIM selectors found | 0/15 |
| MX | ❌ No MX records found | 0/10 |
| **Total** | | **40/100 — HIGH RISK** |

🚨 **Worst email auth in this set.** SPF allows everything (`~all` with no includes/mechanisms), no DKIM, no MX records visible, DMARC only quarantine. Notion is highly vulnerable to email spoofing attacks.

🔍 **Lookalike Domains Found:**
| Domain | IP | Risk |
|--------|-----|------|
| notionapp.com | 104.21.75.233 (Cloudflare) | HIGH — app variant |
| notion-app.com | 172.67.170.65 (Cloudflare) | HIGH — hyphenated |
| notionsupport.com | 35.206.112.50 (GCP) | CRITICAL — support scam |
| notion-support.com | 150.95.255.38 | CRITICAL — support scam |
| notionai.com | 50.6.227.40 | HIGH — AI variant |
| notion-ai.com | 76.223.54.146 | HIGH — AI variant |
| getnotion.com | 13.35.107.x (AWS CF) | MEDIUM — "get" prefix |
| mynotion.com | 16.55.1.45 (AWS) | MEDIUM — "my" prefix |

**8 lookalike domains** — highest in the set. Combined with weak email auth, Notion is the most exposed brand here.

---

## 9. Vercel 🟡

**Company Size:** ~500 employees | **Domain:** vercel.com

**Recent Impersonation (Feb 2026):** Hackers abusing Vercel GenAI to mass-produce phishing sites mimicking Microsoft, Adidas, Nike, and other brands hosted on Vercel infrastructure. Malwarebytes reported this directly.

**Contact:** abuse@vercel.com | vercel.com/abuse

**📧 Brand Guard — Email Spoof Check**
| Check | Result | Score |
|-------|--------|-------|
| SPF | ✅ Multi-include with `~all` (soft fail) | 25/35 |
| DMARC | ⚠️ `p=quarantine; pct=100` — NOT reject | 30/40 |
| DKIM | ✅ google, s1, s2 selectors | 15/15 |
| MX | ✅ Google Workspace | 10/10 |
| **Total** | | **80/100 — LOW PROTECTION** |

⚠️ DMARC quarantine-only means spoofed emails may still reach inboxes. Very broad SPF (Google, Marketo, SES, SendGrid, Salesforce, Mailtrap).

🔍 **Lookalike Domains Found:**
| Domain | IP | Risk |
|--------|-----|------|
| vercelapp.com | 103.224.182.242 | HIGH — app variant |
| vercel-app.com | 96.126.111.165 (Linode) | HIGH — hyphenated |
| vercelsupport.com | 64.239.123.1 | CRITICAL — support scam |
| vercel-support.com | 64.239.109.1 | CRITICAL — support scam |
| vercelai.com | 64.239.109.193 | HIGH — AI variant |
| vercel-ai.com | 2.57.91.91 | HIGH — AI variant |

**6 lookalike domains.** Two support-scam domains is concerning for a hosting platform.

---

## 10. Malwarebytes 🟡

**Company Size:** ~700 employees | **Domain:** malwarebytes.com

**Recent Impersonation (Feb 2026):** AI website builders being used to clone Malwarebytes' own brand. They reported being directly impersonated by AI-generated phishing sites.

**Contact:** security@malwarebytes.com | malwarebytes.com/contact

**📧 Brand Guard — Email Spoof Check**
| Check | Result | Score |
|-------|--------|-------|
| SPF | ✅ `include:spf1.malwarebytes.com include:clients.cleverbridge.com -all` (hard fail) | 35/35 |
| DMARC | ✅ `p=reject; pct=100` — Full enforcement | 40/40 |
| DKIM | ✅ s1, s2 selectors found | 15/15 |
| MX | ✅ Microsoft 365 | 10/10 |
| **Total** | | **100/100 — PROTECTED** |

✅ Solid email auth — hard fail SPF + reject DMARC + dedicated rua/ruf reporting. Practice what you preach.

🔍 **Lookalike Domains Found:**
| Domain | IP | Risk |
|--------|-----|------|
| malwarebytessupport.com | 199.191.50.185 | CRITICAL — support scam |
| mymalwarebytes.com | 3.33.251.168 (AWS) | MEDIUM — "my" prefix |

Only 2 lookalikes found — but malwarebytessupport.com is a classic support scam domain.

---

## Summary: Risk Ranking

| Rank | Company | Email Score | Lookalikes | Priority |
|------|---------|-------------|------------|----------|
| 1 | **Notion** | 40/100 🚨 | 8 domains | CRITICAL — fix email auth + domains |
| 2 | **Ripple** | 80/100 | 6 domains | HIGH — upgrade DMARC to reject |
| 3 | **Vercel** | 80/100 | 6 domains | HIGH — upgrade DMARC to reject |
| 4 | **Ledger** | 90/100 | 6 domains | HIGH — most lookalikes are active scams |
| 5 | **Phantom** | 100/100 | 6 domains | HIGH — phantomsupport.com is live |
| 6 | **MoonPay** | 100/100 | 2 domains | MEDIUM — but active social impersonation |
| 7 | **Luma AI** | 90/100 | 3 domains | MEDIUM — fresh UNC6032 targeting |
| 8 | **Kling AI** | 90/100 | 1 domain | MEDIUM — same campaign, small team |
| 9 | **Hootsuite** | 90/100 | 1 domain | LOW — but WhatsApp/Telegram vector |
| 10 | **Malwarebytes** | 100/100 | 2 domains | LOW — good posture, 1 risky domain |

**Key outreach angle:** We can offer each company a free Brand Guard assessment showing their exact exposure — email spoof vulnerability, lookalike domain monitoring, and CertStream real-time alerts for new registrations. The data above proves the value immediately.

---

*Generated by Agentic Bro Brand Guard | agenticbro.app | Scan first, trust later! 🔐*