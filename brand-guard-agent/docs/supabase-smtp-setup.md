# Get Supabase Auth Emails Off the Default Sender

Supabase's built-in email is for **transactional auth only** (signup confirmation,
password reset, magic link) and is **hard rate-limited** — fine for testing, not for
production. You need a real transactional SMTP provider behind it, on a domain separate
from your outreach domain.

**Decision:** send product/auth email from a **subdomain of your main brand domain**,
e.g. `notify.agenticbro.app` — customers expect product mail from your real brand, and
it keeps this reputation independent from `brandguardhq.com` outreach.

Provider options (any is fine for transactional):
- **Resend** — simplest, Supabase-friendly (used below)
- **Postmark** — excellent deliverability (note: bans cold/bulk; transactional only — fine here)
- **Amazon SES** — cheapest at scale, more setup

---

## Step 1 — Verify the sending subdomain at your ESP (Resend example)

1. Resend → **Domains → Add Domain** → `notify.agenticbro.app`.
2. Resend gives you DNS records — add them to `agenticbro.app`'s DNS:
   - an **SPF/MX** TXT for the subdomain (e.g. `send.notify` `v=spf1 include:amazonses.com ~all`)
   - two/three **DKIM CNAME** records (`resend._domainkey`, etc.)
   - a **DMARC** TXT: `_dmarc.notify` → `v=DMARC1; p=none; rua=mailto:dmarc@agenticbro.app`
3. Click **Verify**. Wait for all records to go green.
4. Create an **API key** (Sending access).

---

## Step 2 — Point Supabase at it

Supabase Dashboard → **Authentication → Emails → SMTP Settings** → enable **Custom SMTP**:

| Field | Value |
|-------|-------|
| Sender email | `noreply@notify.agenticbro.app` |
| Sender name | `Brand Guard` |
| Host | `smtp.resend.com` |
| Port | `465` (SSL) or `587` (STARTTLS) |
| Username | `resend` |
| Password | `<YOUR_RESEND_API_KEY>` |
| Minimum interval / rate limit | raise from the testing default to your real need |

> Enter the API key in the Supabase dashboard UI yourself — I won't handle secret values.
> Treat it like any password: never commit it to the repo or paste it into code.

[Amazon SES instead: Host `email-smtp.<region>.amazonaws.com`, Port 587, Username/Password
= **SES SMTP credentials** (not your AWS keys). Move out of the SES sandbox before prod.]

---

## Step 3 — Customize the auth templates

Authentication → **Emails → Templates**: set confirm-signup, magic-link, reset-password,
and change-email with Brand Guard branding and a real support address. Plain, trustworthy,
no marketing fluff — these are security emails.

---

## Step 4 — Verify

- [ ] Trigger a real signup confirmation and a password reset
- [ ] Both arrive from `noreply@notify.agenticbro.app`, not `…@supabase.io`
- [ ] mail-tester.com on a sample → SPF/DKIM/DMARC all pass
- [ ] Reset-password and magic-link land in inbox, not spam

---

## The three-stream summary

| Stream | Domain | Sender | Provider |
|--------|--------|--------|----------|
| Outreach (cold/warm) | `brandguardhq.com` | `earl@brandguardhq.com` | Google Workspace |
| Product/auth (transactional) | `notify.agenticbro.app` | `noreply@notify.agenticbro.app` | Resend / SES |
| Defensive only (no send) | `getbrand-guard.com` | — | parked / redirect |

Keeping these separate is what protects paying-customer deliverability if an outreach
campaign ever stumbles.
