# CRM Approval Tabs — Spec

Three tabs added to your existing admin at **`agenticbro.app/brand-guard/admin`**.
This is where the human-in-the-loop gate actually lives: the agent finds, scores,
routes, and drafts — but **nothing leaves the building until you approve it here.**

The tabs map 1:1 to the `db/schema.sql` tables. Build them in this order:
**Drafts** (the gate) → **Triage** (input quality) → **Replies** (close the loop).

---

## Shared shell

- Sits behind your existing admin auth (authenticated admin only — see RLS in `schema.sql`).
- Top bar: counts per tab as badges — `Drafts (7) · Triage (3) · Replies (2)`.
- All writes go through your server (service role), never the browser anon key.
- Every approve/reject/edit is logged with `approved_by = auth.uid()` + timestamp.

---

## Tab 1 — Drafts (the approval gate)

**Source:** `outreach_drafts` where `approval = 'unreviewed'`, newest first.
**Job:** let you approve / edit / reject each queued message before it sends.

### List (left pane)
A row per draft:

| Column | From | Notes |
|--------|------|-------|
| Company | `prospects.company_name` | + `primary_domain` underneath |
| Channel | `outreach_drafts.channel` | A/B/C/D pill (color-coded) |
| Victim Score | `prospects.victim_score` | bar 0–100; red <50, amber 50–69, green 70+ |
| Vertical | `prospects.vertical` | |
| Region | `prospects.compliance_region` | EU/UK flagged amber (extra care) |
| Queued | `outreach_drafts.created_at` | relative time |

Sort by Victim Score desc by default. Filter by channel, region, score band.

### Detail (right pane) — the actual review
Show, top to bottom:

1. **Why this prospect** — the `score_breakdown` jsonb rendered as chips
   (`public scam warning +35`, `UDRP recent +35`, `lookalike +10`…). This is the
   evidence trail; if it looks thin, reject.
2. **Evidence list** — the `signals` rows: source, snippet, and a clickable
   `signal_url` (opens the real post / UDRP decision in a new tab so you can verify).
3. **Routing reason** — the Router's one-line `reason` string (why this channel).
4. **The draft** — `subject` + `body` + `opt_out_line`, in an **editable** textarea.
   Edits save to `outreach_drafts.edited_body` (original `body` is preserved).
5. **Findings used** — `findings_used` jsonb: the ONLY facts the model was allowed
   to cite. Cross-check that the body invents nothing beyond this.
6. **Compliance strip** — suppression check (live lookup against `suppression_list`),
   `compliance_ok`, region basis. If suppressed → approve is **disabled**.

### Actions
- **Approve & queue send** → `approval='approved'`, `approved_by`, `approved_at`;
  `prospects.draft='approved'`. (Actual send is a separate worker; this just clears the gate.)
- **Approve with edits** → same, but `edited_body` is what sends.
- **Switch channel** → override the Router's recommendation (dropdown A/B/C/D). Most
  useful for flipping to **C — LinkedIn from your personal profile** when you judge a
  human note will land better; re-drafts in the chosen channel's template and updates
  `prospects.routed_channel`. Channel C drafts are marked **"send by hand"** (you send
  them from your own profile — the app never automates LinkedIn).
- **Reject** → `approval='rejected'` + required reason; `prospects.approval='rejected'`.
- **Reject + suppress** → also inserts into `suppression_list` (domain or email).
- Keyboard: `A` approve, `R` reject, `E` focus editor, `J/K` next/prev. (Optional, but
  you'll be doing this daily — it pays off.)

### Guardrails surfaced in UI
- Hard-disable Approve if `suppressed = true` or `compliance_ok = false`.
- Banner if `victim_score < 50` ("below route threshold — why is this here?").
- Banner on EU/UK rows reminding of legitimate-interest basis + published-contact rule.

---

## Tab 2 — Triage (collector quality control)

**Source:** `triage_queue` join `signals` where `resolved = false`.
**Job:** catch low-confidence or model-down collector hits before they ever become a
draft. This is the input filter that keeps junk out of the Drafts tab.

### List
| Column | From | Notes |
|--------|------|-------|
| Snippet | `signals.snippet` | the raw evidence text |
| Source | `signals.source` | crt.sh / udrp_wipo / x_profile |
| Type | `signals.signal_type` | |
| Reason queued | `triage_queue.reason` | low_confidence / llm_down / ambiguous |
| Link | `signals.signal_url` | verify the source |

### Actions
- **Confirm → promote** : mark a real victim signal; attaches/creates a `prospects`
  row and lets the rest of the pipeline (score → route → draft) proceed.
- **Discard** : `resolved=true`, not a real signal (false positive). No prospect created.
- **Send to suppression** : if it's a competitor/known-bad/do-not-contact.

Triage is where you teach the system: a few minutes here keeps the Drafts tab clean.

---

## Tab 3 — Replies (close the loop)

**Source:** `replies` where `handled = false`, plus prospect context.
**Job:** handle inbound responses; enforce opt-outs immediately; stop sequences.

### List
| Column | From | Notes |
|--------|------|-------|
| Company | via `prospect_id` | |
| From | `replies.from_address` | |
| Sentiment | `replies.sentiment` | positive / neutral / negative / **opt_out** |
| Received | `replies.received_at` | |
| Preview | `replies.body` | first line |

Opt-out rows pinned to top and styled red.

### Actions
- **Mark handled** → `handled=true`.
- **Opt out (one click)** → inserts email + domain into `suppression_list`
  (`reason='opt_out'`), sets `prospects.response_status='opted_out'`, and **stops any
  active sequence**. This must be instant and irreversible-by-default (CAN-SPAM/PECR).
- **Mark converted** → `response_status='converted'` (links to their signup if you want
  attribution back to the campaign).
- **Open thread** → deep-link to the Gmail thread (via your Gmail MCP) to reply by hand.
  Replies are always human, never auto-sent.

---

## Minimal data each tab reads (quick reference)

```
Drafts  : outreach_drafts (+ prospects, signals)         where approval='unreviewed'
Triage  : triage_queue (+ signals)                       where resolved=false
Replies : replies (+ prospects)                          where handled=false
```

## Build notes
- Read-heavy; a single Supabase query per tab + realtime subscription for the badge counts.
- Keep all mutations server-side (Edge Function or your API route) so the service role —
  not the browser — writes to `suppression_list` and flips approval states.
- The Drafts tab is the one that matters most. If you only build one this week, build that:
  it's the wall between "the agent drafted something" and "a real person received it."
