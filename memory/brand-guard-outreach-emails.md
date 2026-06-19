# Brand Guard Cold Outreach Emails

## Template 1: No DMARC (backpack.app, jito.wtf) — HIGHEST PRIORITY

**Subject:** Your domain has no email spoof protection — anyone can send from @backpack.app

> Hi [Name],
>
> I ran a security scan on backpack.app and found that you have no DMARC policy configured. This means anyone on the internet can send emails that appear to come from @backpack.app — and email providers like Gmail and Outlook will deliver them to inboxes, not spam.
>
> For a crypto wallet where users receive transaction emails and security alerts, this is a real phishing vector. An attacker could send a fake "verify your wallet" email from support@backpack.app and most users would trust it.
>
> Your SPF is also set to ~all (soft fail) instead of -all (hard fail), so unauthorized senders still get through.
>
> I built Brand Guard at agenticbro.app — it scans for exactly this kind of vulnerability across email, domains, and social media impersonation. **7-day free trial, no credit card required.** First 25 scans are free.
>
> If you want, I can send you the full report with specific DNS records to fix. It's a 10-minute DNS update.
>
> — Earl Finney, Agentic Insights

---

## Template 2: Weak DMARC (marginfi.com) — HIGH PRIORITY

**Subject:** Found email security gaps on marginfi.com — phishing risk for your users

> Hi [Name],
>
> I ran a brand security scan on marginfi.com and wanted to flag two issues:
>
> 1. Your SPF uses ~all (soft fail) — unauthorized email senders aren't blocked, just "marked"
> 2. Your DMARC policy is p=quarantine instead of p=reject — spoofed emails go to spam, but some still reach inboxes
>
> For a DeFi lending platform where users receive important account notifications, this creates a phishing window. Attackers can still send convincing fake emails that bypass basic filters.
>
> The fix is straightforward: upgrade SPF to -all and DMARC to p=reject. I can send you the exact DNS records.
>
> We built Brand Guard (agenticbro.app) to monitor for these vulnerabilities continuously, plus scan for social media impersonation and lookalike domains. **7-day free trial, no credit card required.** First 25 scans are free.
>
> — Earl Finney, Agentic Insights

---

## Template 3: DMARC Quarantine Only (drift.trade, switchboard.xyz, marinade.finance)

**Subject:** Quick security note: your DMARC could be stronger on [domain]

> Hi [Name],
>
> I was running some domain security checks and noticed [domain] has DMARC set to quarantine. This means spoofed emails are routed to spam — but not rejected entirely. For a platform handling user funds, p=reject closes that last gap.
>
> Your SPF is also ~all (soft fail) rather than -all (hard fail), which means unauthorized senders get a pass instead of a block.
>
> Happy to share the full scan report if useful. We built Brand Guard at agenticbro.app to catch these issues plus monitor for impersonator accounts on X and Instagram — first 25 scans are free.
>
> — Earl Finney, Agentic Insights

---

## Template 4: Recent Impersonation Victim (Jupiter, Axiom, etc.)

**Subject:** After the recent fake [airdrop/app] — are your email domains secured?

> Hi [Name],
>
> I saw the recent [fake airdrop / app impersonation] targeting [brand]. Situations like this are exactly why I built Brand Guard.
>
> I ran a scan on [domain] and found:
> - [Specific findings from scan]
>
> The social impersonation is one attack vector — but email spoofing is another. If your DMARC isn't on p=reject, attackers can send phishing emails from your own domain that bypass most filters.
>
> Brand Guard monitors both: we scan for impersonator accounts across X, Instagram, TikTok, and Facebook, plus run continuous email spoof and lookalike domain checks. **7-day free trial, no credit card required.** First 25 scans are free at agenticbro.app.
>
> — Earl Finney, Agentic Insights

---

## Template 5: General SMB (non-crypto, for later phases)

**Subject:** We found [X] impersonation accounts using your brand name

> Hi [Name],
>
> I ran a brand monitoring scan for [business name] and found [number] accounts on [platform(s)] that appear to be impersonating your business:
>
> - [Account 1] — [platform] — [brief description of red flags]
> - [Account 2] — [platform] — [brief description]
>
> These impersonator accounts can damage your reputation, confuse your customers, and in some cases drain their money.
>
> Brand Guard at agenticbro.app scans for impersonation across X, Instagram, TikTok, and Facebook, checks your email security for spoofing vulnerabilities, and monitors for lookalike domains — all for $29/mo. **7-day free trial, no credit card required.** First 25 scans are free.
>
> — Earl Finney, Agentic Insights