# Handoff Spec — A&C Approved → Gmail Draft Cron (+ collector data-source fix)

**Owner of implementation:** OpenClaw agent (runs on Earl's Mac).
**Why OpenClaw, not Cowork:** keeps everything on the local runtime, uses zero Claude API,
and lets any text generation stay on the local Ollama model. The draft-insert step itself
needs **no model at all** — it just pushes already-generated text into Gmail Drafts.

---

## Non-negotiable constraints

- **Never send.** This cron only *creates Gmail drafts*. It must never call any send endpoint.
- **Human-gated.** Only rows a human has explicitly **approved** in the console are eligible.
- **Channels A and C only.** B/D/E are handled elsewhere; this job ignores them.
- **Idempotent.** A given approved case is drafted into Gmail exactly once.
- **No Claude API.** Drafting text is done by the existing worker pipeline (deterministic
  templates, optionally local Ollama via `--use-llm`). This job does not generate text.

---

## Part 1 — Collector data-source fix (prerequisite, separate change)

The daily discovery cron is enabled but currently returns `collected: 0 signal(s)`, so the
review queue never fills and there is nothing to approve. Root cause (analysis only — implement
on your side):

- `collectors/udrp.py` harvests candidate links from two index URLs:
  - `WIPO_INDEX_URL = "https://www.wipo.int/amc/en/domains/search/"`
  - `ADRFORUM_INDEX_URL = "https://www.adrforum.com/domain-dispute/decisions"`
- Both are **search / landing pages** that render their decision links via JavaScript/AJAX.
  A plain HTTP GET (what `_harvest_cases` does) receives the page shell but none of the actual
  case links, so `candidates` is empty → 0 cases → 0 signals.
- The per-case parsers (`_parse_case_page`) work correctly — offline fixtures parse fine. The
  gap is purely the index/discovery URLs.

**Direction for the fix (agent/Earl to implement):**

- Repoint each provider at a page that returns **static links to individual decisions** (e.g. a
  dated/yearly decision listing rather than the JS search form), **or**
- Pass a real default `query` into `fetch_wipo` so it requests `?q=<term>` and gets results back
  instead of the empty form.
- Keep the existing case-number regexes (`WIPO_CASE_RE`, `ADRFORUM_CASE_RE`), robots.txt respect,
  honest UA, and `REQUEST_DELAY_S` rate limiting unchanged.

**Acceptance:** re-run the existing one-liner and confirm the SUMMARY line shows
`queued(unreviewed)=N` with **N > 0**:

```
cd ~/.openclaw/workspace/brand-guard-agent \
  && BRANDGUARD_ENV_FILE=~/.openclaw/workspace/.env.local \
     python3 worker.py --live --days 30 --max-cases 25
```

Once N > 0, the rest of the pipeline (resolve → score → route → draft → queue as
`approval='unreviewed'`) is already proven end to end.

---

## Part 2 — A&C approved → Gmail draft cron

### Prerequisites

- **Gmail auth for the OpenClaw agent.** The agent needs its **own** Gmail credential/tool scoped
  to `efinney@brandguardhq.com`. (The connector currently authenticated to that mailbox is the
  Cowork connector — the OpenClaw agent cannot borrow it.) Confirm the agent has a Gmail tool that
  can call `users.drafts.create` on that mailbox before enabling the cron.
- **Schema:** add an idempotency column to the drafts table, e.g.
  `gmail_draft_id text` (nullable; `null` = not yet pushed to Gmail). This doubles as the
  "already drafted" guard. (Optional companion: `gmail_drafted_at timestamptz`.)

### Eligibility query (run each cycle)

Select rows where:

- `channel in ('A','C')`
- `approval = 'approved'`
- `gmail_draft_id is null`

Each eligible row already carries the generated `subject`, `body`, and the prospect's `to`
address from the worker pipeline.

### Per-row action

1. Call Gmail `users.drafts.create` on `efinney@brandguardhq.com` with:
   - `To:` = prospect email from the row
   - `Subject:` = stored draft subject
   - body = stored draft body (text/plain or html, matching how the worker stored it)
   - **Do not set any send flag. Do not call `send`.**
2. On success, write the returned Gmail draft id back to the row's `gmail_draft_id`
   (and `gmail_drafted_at = now()` if you added it).
3. On failure, leave `gmail_draft_id` null so the next cycle retries; log the error.

### Cron registration (OpenClaw)

- Schedule: every 30 min, or chain it to fire right after the daily discovery run.
- `toolsAllow`: exec + the agent's Gmail tool. No network egress beyond Gmail + Supabase.
- `delivery.mode`: none (this job produces drafts, it does not notify/send).

### Pseudocode (no LLM call anywhere)

```
rows = supabase.select(drafts)
        .where(channel in ['A','C'])
        .where(approval == 'approved')
        .where(gmail_draft_id is null)

for r in rows:
    draft = gmail.drafts_create(
        mailbox="efinney@brandguardhq.com",
        to=r.to,
        subject=r.subject,
        body=r.body,            # already generated; no model call here
    )                            # NEVER call gmail.send
    supabase.update(drafts, id=r.id,
        gmail_draft_id=draft.id,
        gmail_drafted_at=now())
```

---

## Verification (end to end)

1. After the collector fix: discovery cron run → review queue has > 0 unreviewed drafts.
2. Approve one **A** or **C** case in the console at `agenticbro.app/brand-guard/admin`.
3. Within one cron cycle: a **draft** (unsent) appears in `efinney@brandguardhq.com` Drafts,
   addressed to the prospect, and the row's `gmail_draft_id` is populated.
4. Confirm no message was actually sent (Sent folder unchanged).

> Independent check available: once the agent has run this once, Cowork can use its read-only
> Gmail connector on `brandguardhq.com` to confirm the draft landed in Drafts (read-only, no send).

---

## Summary of ownership

| Piece | Owner | Uses Claude API? |
|---|---|---|
| Collector data-source fix (`collectors/udrp.py`) | OpenClaw agent / Earl | No |
| A&C approved → Gmail draft cron | OpenClaw agent | No |
| Optional read-only "did the draft land?" check | Cowork (on request) | Yes (one read) |
