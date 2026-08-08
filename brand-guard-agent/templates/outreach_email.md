# Brand Guard — Outreach Templates (30-Day Free Trial CTA)

## Non-negotiable rules

1. **Verifiable identity first.** Real name, real company, link to agenticbro.app/brand-guard.
2. **Only real findings.** Reference exactly what was verified for their domain.
3. **No urgency theater.** No countdowns, no "act now," no manufactured panic.
4. **No disguised links.** Full, plain URLs. No link shorteners.
5. **CTA = 30-day free trial.** Every channel ends with the pilot offer, not just "run a scan."
6. **CAN-SPAM footer + opt-out** on every email.
7. **Human approves every send.**

Merge fields: `{{company}}`, `{{domain}}`, `{{contact_first_name}}`, `{{finding_1}}`,
`{{finding_2}}`, `{{evidence_url}}`, `{{sender_name}}`, `{{sender_title}}`,
`{{company_address}}`, `{{optout_url}}`, `{{trial_url}}`, `{{scan_url}}`.

---

## Channel D — Cold email (US B2B, verified contact)

**Subject (pick one):**
- `30-day Brand Guard trial for {{company}}`
- `Free brand-impersonation monitoring — {{company}}`
- `Brand protection pilot for {{company}} (30 days, no cost)`

**Body:**
```
Hi {{contact_first_name}},

I'm {{sender_name}}, {{sender_title}} of Agentic Insights LLC. We created Brand Guard, part of the AgenticBro trust ecosystem
(agenticbro.app/brand-guard — feel free to verify us before reading on).

While reviewing public records, we noticed something about {{company}}:
- {{finding_1}}
- {{finding_2}}

You can see the public source here: {{evidence_url}}

We're opening a limited 30-day Brand Guard pilot for {{company}} —
a $299 value on us. Fortress monitors for social impersonators, lookalike
domains, fake stores, spoofed email posture, marketplace clones, alerts,
evidence records, and takedown workflow support.

No card, no commitment. You'll see what continuous monitoring finds
before deciding on a paid plan.

Start your 30-day pilot here (create your account with email + password to onboard your brand): {{trial_url}}

Best,
{{sender_name}}
{{sender_title}}, Agentic Insights LLC — Brand Guard (AgenticBro trust ecosystem)
```

**Footer:**
```
—
Brand Guard · Agentic Insights LLC · {{company_address}}
You received this one-time note because {{company}} appeared in public
brand-abuse records. Prefer not to hear from us? Opt out here: {{optout_url}}
```

---

## Channel B — Official security/abuse inbox

**Subject:** `30-day Brand Guard trial — brand-impersonation report for {{company}}`

**Body:**
```
Hello,

Reporting a possible brand-impersonation issue affecting {{company}},
found via public records:

- {{finding_1}}
- {{finding_2}}
Public source: {{evidence_url}}

We're Agentic Insights LLC — we created Brand Guard (agenticbro.app/brand-guard), a brand-protection service that's part of the AgenticBro trust ecosystem.
We're opening a limited 30-day pilot for {{company}} — a $299 value on us.
Fortress monitors for social impersonators, lookalike domains, fake stores,
spoofed email posture, marketplace clones, alerts, evidence records, and
takedown workflow support.

No card, no commitment. Start the pilot here: {{trial_url}}

Happy to provide details to a named contact if helpful.

{{sender_name}} · {{sender_title}}, Agentic Insights LLC · Brand Guard (AgenticBro trust ecosystem)
{{company_address}} · opt out: {{optout_url}}
```

---

## Channel A — Public credible reply

```
Sorry you're dealing with this — impersonation is exhausting to chase.
We're running a 30-day Brand Guard pilot (normally $299, free right now)
that monitors lookalike domains, social impersonators, and email spoofing
in one place. No card needed: {{trial_url}}
We're Agentic Insights LLC — we created Brand Guard (agenticbro.app/brand-guard), part of the AgenticBro trust ecosystem. Happy to point you to
takedown steps either way.
```

---

## Channel C — LinkedIn message from YOUR personal profile

**Connection note (≤ 300 chars):**
```
Hi {{contact_first_name}} — I'm {{sender_name}}, founder of Agentic Insights LLC — we created Brand Guard (part of the AgenticBro trust ecosystem). We
flag brand impersonation for companies like {{company}} and noticed something
public worth a heads-up. We're running a free 30-day pilot — happy to share
details. (agenticbro.app/brand-guard)
```

**After accept:**
```
Thanks for connecting, {{contact_first_name}}. The specific thing:
{{finding_1}}. Public source: {{evidence_url}}.

We're running a 30-day Brand Guard pilot for {{company}} — normally $299,
free during the pilot. Fortress monitors lookalike domains, social
impersonators, email spoofing, marketplace clones, and includes takedown
workflow support. No card needed:

{{trial_url}}

Happy to answer anything either way.
```

---

## Filled example (Channel D)

```
Subject: 30-day Brand Guard trial for Northwind Coffee Co.

Hi Dana,

I'm Earl Finney, Founder of Agentic Insights LLC — we created Brand Guard (agenticbro.app/brand-guard —
feel free to verify us before reading on).

While reviewing public records, we noticed something about Northwind Coffee Co.:
- Two lookalike domains, "northwind-coffee.shop" and "nothwind-coffee.com",
  were registered in the last 14 days (visible in Certificate Transparency logs).
- Your email authentication (DMARC) is set to p=none, which means anyone can
  spoof northwindcoffee.com to your customers.

You can see the public source here: https://crt.sh/?q=%25northwind-coffee%25

We're opening a limited 30-day Brand Guard pilot for Northwind Coffee Co. —
a $299 value on us. Fortress monitors for social impersonators, lookalike
domains, fake stores, spoofed email posture, marketplace clones, alerts,
evidence records, and takedown workflow support.

No card, no commitment. You'll see what continuous monitoring finds
before deciding on a paid plan.

Start your 30-day pilot here (create your account with email + password to onboard your brand): https://agenticbro.app/brand-guard?request_pilot=1

Best,
Earl Finney
Founder, Agentic Insights LLC — Brand Guard (AgenticBro trust ecosystem)
—
Brand Guard · Agentic Insights LLC · 155 Willowbrook Blvd, Ste 110 #8469, Wayne, NJ 07470
You received this one-time note because Northwind Coffee Co. appeared in public
brand-abuse records. Prefer not to hear from us? Opt out here: https://agenticbro.app/brand-guard/optout
```

---

## Follow-up cadence (all channels)

Max 3 touches, same channel, value-add each time. Any reply or opt-out stops
the sequence. After touch 3 with no response → 60-day nurture queue.

| Touch | Day | Content |
|-------|-----|---------|
| 1 | 0 | The finding + 30-day pilot offer |
| 2 | 4 | "Did you get a chance to look? Here's the takedown step for {{finding_1}}. Pilot is still open: {{trial_url}}" |
| 3 | 10 | "Last note — pilot window closing soon. Scan + 30 days free: {{trial_url}}" |