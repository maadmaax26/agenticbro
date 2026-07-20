# Outreach Domain Setup — brandguardhq.com

Goal: a dedicated, well-authenticated sending domain that lands in the inbox and keeps
your *outreach* reputation separate from your *product/transactional* reputation.

**Sending domain:** `brandguardhq.com`
**Defensive-only (do NOT send from):** `getbrand-guard.com` — register-and-redirect to
your main site so a squatter can't use your own lookalike. A hyphenated brand variant
reads as phishy to filters; keep it parked.

> All values below are for **Google Workspace**. Microsoft 365 equivalents are noted in
> brackets. You cannot pre-generate DKIM — the provider mints the key and you paste the
> TXT it gives you (Step 3).

---

## Step 0 — Mailbox

Buy **one** Google Workspace seat on `brandguardhq.com` (~$7/mo) and create a
**named human mailbox**: `earl@brandguardhq.com` (person-to-person outsends beat
`outreach@`/`info@`). Add a real signature with your name, title, and the link to
`agenticbro.app/brand-guard`. Put a simple page or redirect at `https://brandguardhq.com`
so the domain resolves — filters and recipients both check this.

[M365: one Business Basic seat instead.]

---

## Step 1 — MX records (so the mailbox can receive)

Google Workspace (modern single MX):

| Type | Host | Value | Priority | TTL |
|------|------|-------|----------|-----|
| MX | @ | `smtp.google.com` | 1 | 3600 |

(Legacy 5-record set — `ASPMX.L.GOOGLE.COM` etc. — also works if your DNS host doesn't
like the single MX.)
[M365: `brandguardhq-com.mail.protection.outlook.com`, priority 0.]

---

## Step 2 — SPF (authorize Google to send as you)

Exactly **one** SPF TXT record on the root:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| TXT | @ | `v=spf1 include:_spf.google.com ~all` | 3600 |

Never publish two SPF records — that breaks SPF. If you add another sender later, merge
it into this one `include:`.
[M365: `v=spf1 include:spf.protection.outlook.com ~all`]

---

## Step 3 — DKIM (cryptographically sign your mail)

1. Admin console → **Apps → Google Workspace → Gmail → Authenticate email**.
2. Select `brandguardhq.com`, key length **2048-bit**, **Generate new record**.
3. Google shows a host `google._domainkey` and a long value `v=DKIM1; k=rsa; p=…`.
4. Publish it:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| TXT | `google._domainkey` | `v=DKIM1; k=rsa; p=<key Google gives you>` | 3600 |

5. Wait for propagation, then click **Start authentication** in the console.
[M365: enable DKIM in Defender → publish the two `selector1._domainkey` /
`selector2._domainkey` **CNAME** records it provides.]

---

## Step 4 — DMARC (tie SPF+DKIM together + get reports)

Publish DMARC in **monitor mode first**, then tighten. One TXT record:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@brandguardhq.com; fo=1; pct=100` | 3600 |

Progression (don't skip the monitoring window):
- **Weeks 1–2:** `p=none` — collect reports, confirm SPF+DKIM pass on your real mail.
- **Weeks 3–4:** `p=quarantine` once reports are clean.
- **Week 5+:** `p=reject` — full protection.

Point `rua` at a mailbox you'll read, or plug into a free DMARC reader (Postmark DMARC,
dmarcian, or Valimail) so the XML reports are human-readable.

---

## Step 5 — Verify before sending a single real email

- [ ] `dig MX brandguardhq.com`, `dig TXT brandguardhq.com`, `dig TXT _dmarc.brandguardhq.com` resolve correctly
- [ ] Send a test to **mail-tester.com** → aim for **10/10**
- [ ] Confirm the test shows SPF=pass, DKIM=pass, DMARC=pass
- [ ] Domain loads in a browser (page or redirect)
- [ ] (Optional, advanced) add MTA-STS + TLS-RPT and a BIMI record later for extra trust

---

## Step 6 — Warm-up schedule (4 weeks; matches the human-in-the-loop volume)

Cold domains that suddenly send 40 emails get filtered. Ramp slowly and keep replies high.

| Phase | Days | Sends/day | Notes |
|-------|------|-----------|-------|
| 1 | 1–7 | 5–10 | Mostly to people who'll reply (warm contacts, yourself on other providers). Reply to those replies. |
| 2 | 8–14 | 10–20 | Begin real Tier-1 prospects (your warmest signals). |
| 3 | 15–21 | 20–40 | Scale across verticals. |
| 4 | 22+ | 40–50+ | Steady state. Hold here unless metrics are clean. |

**Health thresholds — if breached, stop ramping (or roll back a phase):**
- Bounce rate **> 2–3%** → your list/verification is dirty
- Spam-complaint rate **> 0.1%** → your message or targeting is off
- Any sudden inbox→spam shift → pause and recheck auth + content

Because outreach is human-approved and low-volume by design, you'll likely sit at the
bottom of each band — which is exactly what keeps deliverability healthy.

---

## Why this is separate from your product email

Outreach and transactional/auth email must **never share a domain**. If a cold campaign
trips spam filters, you don't want trial-welcome and threat-alert emails to your paying
customers landing in spam too. Outreach → `brandguardhq.com`. Product/auth → a subdomain
of your main brand domain (next doc: `supabase-smtp-setup.md`).
