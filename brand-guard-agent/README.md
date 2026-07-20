# Brand Guard — Discovery/Outreach Agent (stub set)

Runnable skeletons for the victim-signal discovery + outreach pipeline described in
`../brand-guard-discovery-outreach-implementation.md`. Built for OpenClaw + a local
`qwen3.5:9b` model via Ollama.

## Layout

```
brand-guard-agent/
├─ run.py             # Thin end-to-end runner: collectors→scorer→router→drafter→send_worker (dry-run)
├─ common/
│  ├─ models.py        # RawSignal / Prospect dataclasses + Victim Score weights (schema source of truth)
│  └─ llm.py           # Ollama qwen3.5:9b helper: classify / extract / draft / vision (all JSON-constrained)
├─ collectors/
│  ├─ crt_sh.py        # Tier 3: lookalike domains from CT logs (edit-distance + homoglyph) — WORKS today
│  ├─ udrp.py          # Tier 1: UDRP/URS dispute filings (highest intent) — WIPO + ADRForum adapters, robots-aware
│  ├─ x_profile_cdp.py # Tier 1A: public scam-warning posts via local Chrome over CDP — WORKS w/ setup
│  └─ enrich.py        # DMARC/SPF/MX (DoH) + RDAP abuse + security.txt + RFC-2142 role guesses — passive OSINT, offline by default
├─ pipeline/
│  ├─ resolver.py      # RawSignal[] → deduped/enriched Prospect[]; enqueue: score→route→draft→persist (unreviewed)
│  ├─ scorer.py        # Victim Score (0–100) + BANT+ lite — deterministic, explainable
│  ├─ router.py        # Channel decision tree A/B/C/D/E + hard stops — deterministic
│  ├─ drafter.py       # Routed prospect → channel-correct draft (template fill + optional LLM polish)
│  ├─ send_worker.py   # Last gate: suppression + 3-touch cadence + send-by-hand guards; dry-run by default
│  └─ inbound.py       # Channel E: reply ingest (opt-out→suppress, reply→stop) + warm-lead capture
├─ db/
│  ├─ schema.sql       # Supabase/Postgres sketch (7 tables, RLS, enums) — review before applying
│  └─ store.py         # Data-access layer: queue drafts, load review queue, apply approvals, persist touches/inbound (InMemory + Supabase)
├─ crm/
│  ├─ drafts.html      # Single-file approval console (Drafts/Triage/Replies). Loads queue.json, emits approvals.json — never touches the DB
│  └─ queue_cli.py     # Server-side bridge: export review queue→queue.json, apply approvals.json→store.apply_approvals()
├─ docs/
│  └─ crm-approval-tabs-spec.md # Drafts / Triage / Replies admin tabs (the human approval gate)
└─ templates/
   └─ outreach_email.md # Legitimacy-first email + channel A/B/C/D variants + CAN-SPAM footer
```

## What's ready vs. what needs work

| File | Status | Needs |
|------|--------|-------|
| `run.py` | ✅ ready (chains all stages, dry-run, in-memory) | nothing to run the demo; `--live-store` for real Supabase persistence (send stays dry-run) |
| `common/models.py` | ✅ ready | — |
| `common/llm.py` | ✅ ready | running Ollama + `ollama pull qwen3.5:9b` |
| `collectors/crt_sh.py` | ✅ ready (matching logic unit-tested) | network access to crt.sh |
| `collectors/x_profile_cdp.py` | ✅ ready | Chrome on `--remote-debugging-port=9222`, logged into x.com, `pip install websocket-client` |
| `collectors/udrp.py` | ✅ ready (offline parser self-test passes) | verify selectors vs. live WIPO/ADRForum HTML before a `--live` run; honors robots.txt |
| `collectors/enrich.py` | ✅ ready (offline parser self-test passes) | DMARC/SPF/MX over DoH + RDAP abuse + security.txt; network only when `live=True`; reserved `.example` domains never resolved |
| `pipeline/resolver.py` | ✅ ready (self-test passes) | enrichment now wired (`collectors.enrich`), **offline by default**; pass `enrich_live=True` (cron worker) so prospects clear the threshold |
| `pipeline/scorer.py` | ✅ ready (self-test passes) | — |
| `pipeline/router.py` | ✅ ready (self-test passes) | — |
| `pipeline/drafter.py` | ✅ ready (self-test passes) | optional: Ollama up for `use_llm=True` polish |
| `pipeline/send_worker.py` | ✅ ready (self-test passes, dry-run) | live `SmtpTransport` is wired but **disarmed**; set creds + `BRANDGUARD_LIVE_SEND=1` (or `armed=True`) to transmit |
| `pipeline/inbound.py` | ✅ ready (self-test passes) | feed it real reply/scan/form events from your inbox + site |
| `db/schema.sql` | 🟡 sketch | review + adapt to your live tables before applying (RLS `using(true)` is a placeholder) |
| `db/store.py` | ✅ ready (self-test passes, in-memory) | `connect()` auto-loads `~/agenticbro/.env.local` (or `$BRANDGUARD_ENV_FILE`); reads `SUPABASE_URL` + `SUPABASE_SECRET_API_KEY` (new `sb_secret_…`; legacy `SUPABASE_SERVICE_ROLE_KEY` still accepted); `pip install supabase` for `SupabaseStore` |
| `crm/queue_cli.py` | ✅ ready (selftest passes, offline round-trip) | `--live` needs `SupabaseStore` creds; `export`/`apply` are the server-side ends of the review loop |
| `crm/drafts.html` | ✅ ready (Drafts tab; Triage/Replies stubs) | open in a browser; ships with built-in demo data, or load a real `queue.json` from `queue_cli export` |
| `docs/crm-approval-tabs-spec.md` | ✅ spec | Drafts tab built (`crm/drafts.html`); Triage/Replies still stubs |
| `templates/outreach_email.md` | ✅ ready | fill merge fields per prospect |

## Quick start

```bash
# See the whole pipeline run end-to-end in one go (offline, dry-run, nothing sent):
python3 run.py                   # collectors→scorer→router→drafter→send_worker on demo prospects
python3 run.py --from-udrp       # also seed prospects from the offline UDRP fixtures
python3 run.py --no-approve      # show the human-approval gate stopping every send
python3 run.py --live-store      # read suppression / persist touches to real Supabase (send still dry-run)

# 0) local model
ollama pull qwen3.5:9b
python3 -m common.llm                 # smoke test (needs Ollama running)

# 1) Tier-3 lookalike scan (works now, needs internet)
python3 -m collectors.crt_sh northwindcoffee

# 2) Tier-1A X scan — start Chrome with the debug port first, log into x.com, then:
pip install websocket-client
python3 -m collectors.x_profile_cdp northwindcoffee acmetools

# 3) Tier-1 UDRP — public domain-dispute decisions (strongest signal)
python3 -m collectors.udrp                      # OFFLINE parser self-test (no network)
python3 -m collectors.udrp --live --days 90     # real fetch; respects robots.txt + rate limits

# 3b) DMARC + contact enrichment — passive public OSINT (offline self-test, then a live probe)
python3 -m collectors.enrich                    # OFFLINE parser self-test (no network)
python3 -m collectors.enrich northwindcoffee.com  # live: DMARC/SPF/MX + RDAP abuse + security.txt

# 4) Deterministic core — resolve, score, route, draft (no network, no Ollama needed)
python3 -m pipeline.resolver     # RawSignal[] → Prospect[] merge/enrich, then enqueue (score→route→draft→persist)
python3 -m pipeline.scorer       # Victim Score + BANT self-test
python3 -m pipeline.router       # channel decision tree self-test (A/B/C/D + hard stops)
python3 -m pipeline.drafter      # routed prospect → channel-correct draft (D email + C LinkedIn pair)

# 5) Outbound gate + inbound capture (both DRY-RUN; send nothing, write nothing)
python3 -m pipeline.send_worker  # suppression + 3-touch cadence + send-by-hand gates
python3 -m pipeline.inbound      # Channel E: opt-out→suppress, reply→stop, scan/form→warm lead

# 6) Data-access layer — load approved drafts, persist touches, apply inbound actions
python3 -m db.store              # full outbound+inbound loop against InMemoryStore (no DB needed)
# To hit a real Supabase project instead, server-side only:
#   pip install supabase
#   # connect() AUTO-LOADS your existing creds — no manual sourcing needed.
#   # It searches, in order: the env_file arg → $BRANDGUARD_ENV_FILE →
#   #   ~/agenticbro/.env.local, ~/.openclaw/workspace/.env.local,
#   #   ~/agenticbro/.env, ./.env.local, ./.env
#   # Real env vars always win; the file only fills in MISSING ones.
#   # It reads SUPABASE_URL + SUPABASE_SECRET_API_KEY (sb_secret_…) and logs
#   #   key NAMES only — never secret values.
#   python3 -c "from db.store import connect; print(connect())"            # auto-finds ~/agenticbro/.env.local
#   BRANDGUARD_ENV_FILE=/path/to/.env.local python3 -c "from db.store import connect; print(connect())"
#   # or pass it explicitly:  connect("/path/to/.env.local")
#   # opt out of auto-loading entirely:  connect(auto_load=False)

# 7) Approval loop — review queued drafts in a browser, apply decisions server-side
python3 -m crm.queue_cli selftest             # offline end-to-end: seed → export → approve → apply (no DB)
python3 -m crm.queue_cli export --demo -o queue.json   # write a demo queue.json for the console
# then: open crm/drafts.html in a browser → "Load queue JSON…" → choose queue.json
#       approve / reject / edit each draft → "Export approvals.json" downloads the batch
python3 -m crm.queue_cli apply approvals.json --live   # the ONLY writer of approval state (server-side)
# Live export instead of demo:
#   python3 -m crm.queue_cli export --live -o queue.json
```

## How it fits the pipeline

`collectors/* → RawSignal[]  →  Resolver (dedupe+enrich, code)  →  Scorer (Victim Score, code)
→  Router (channel tree, code)  →  Drafter (template fill, code; optional LLM polish)
→  store.queue_draft (UNREVIEWED)  →  HUMAN APPROVAL (Drafts console)  →  store.apply_approvals
→  Send worker (suppression + cadence gate, code)  →  log touch`

The discovery half is one call: **`pipeline/resolver.py`** collapses the flat `RawSignal[]`
from the collectors into one `Prospect` per victim (merging by brand/domain, attaching every
piece of evidence), runs enrichment, then `enqueue` scores→routes→drafts each one and persists
the draft as **`unreviewed`** via the store. Nothing is approved or sent in that pass.
(Enrichment — DMARC lookup, contact discovery — is a deliberate stub today; it never invents a
contact or a policy, so thin prospects correctly fall below `ROUTE_THRESHOLD` instead of
producing junk drafts.)

The human gate is **`crm/drafts.html`** + **`crm/queue_cli.py`**. `queue_cli export` pulls the
unreviewed queue out of the store into a plain `queue.json` (no keys, no DB handle); you load
that into the browser console, approve / reject / edit each draft, and the console downloads an
`approvals.json` batch. `queue_cli apply` feeds that batch to `store.apply_approvals()` — the
**one and only** place approval state changes. The browser never holds a database credential and
never writes to Supabase, matching the spec's "all writes go through your server" rule.

Running alongside it all is the **inbound worker (Channel E)**, which closes the loop:
replies stop the sequence (and opt-outs hit the permanent suppression list), while
consented scan/form leads become warm prospects queued for fast human follow-up.

Every read/write to the database goes through **`db/store.py`** — the one persistence
seam. It loads approved+sendable drafts for the send worker, records each touch and the
cadence bump after a send, and applies the inbound worker's actions (suppress, stop, warm
upsert). `InMemoryStore` backs the offline self-tests; `SupabaseStore` (service-role,
server-side only) talks to the live tables in `schema.sql`. Both share one `BaseStore`
dispatch so they can't drift, and neither ever hard-deletes — suppression is append-only.

The collectors only **find evidence**. Scoring and routing stay in deterministic code
(`models.py` has the weights and `ROUTE_THRESHOLD = 50`). The Drafter fills the
channel-correct template from **only the verified signals** on the prospect; the local
model is optional and only *polishes* B/D subject+body, constrained to those same
findings and validated in code (it falls back to the template if Ollama is down or the
output drifts). **Channel C (LinkedIn) is drafted but flagged `send_by_hand` — you send
it yourself from your real profile; the app never automates LinkedIn.**

## Guardrails baked in (don't strip these)

- **Public data + OSINT only.** No login-walled scraping, no probing, no auth automation.
- **Enrichment is passive and offline-by-default.** `collectors/enrich.py` only does DNS
  (DMARC/SPF/MX over DoH) + RDAP + the published security.txt; it performs **zero** network
  I/O unless called with `live=True`, and never resolves reserved `.example` placeholders.
  It never invents a named person or title (so `decision_maker_found` stays earned).
- **Intake inboxes are flagged, not auto-pitched.** `abuse@`/`security@` and security.txt
  contacts exist to receive abuse/vulnerability reports, not sales mail. Every such contact
  is tagged `report_only=true` with its provenance and surfaced to the human reviewer, who
  should reject sales drafts aimed at an incident inbox. RFC-2142 role-address *guesses* are
  unverified and gated behind `allow_unverified` (default off). Sending to these can burn
  your sender reputation and is bad form — treat them as a fallback the reviewer must approve.
- **X scanner is low-volume, human-paced** (real delays, keyword pre-filter, no bot-evasion).
  Automated X scraping can breach its ToS — prefer the official API at any real volume.
- **Nothing sends without a human approving the draft.** The Drafter queues; a person signs off.
- **The send worker ships DRY-RUN.** The default transport prints and transmits nothing.
  A real `SmtpTransport` is now wired but behind a **double-lock**: you must (1) construct it
  and hand it to the worker, AND (2) *arm* it (`armed=True` or env `BRANDGUARD_LIVE_SEND=1`).
  A disarmed transport builds the message and reports `disarmed` — no byte leaves the box, so
  importing or constructing it can never send by accident. Even armed, it enforces in code:
  suppression check, 3-touch cadence cap, minimum spacing, stop-on-reply/opt-out, and it
  refuses to auto-send Channel A/C (human-sent) or Channel E (inbound-only).
- **Opt-outs are permanent and deterministic.** The inbound worker detects unsubscribe intent
  with rules (never the model), suppresses the address, and stops the sequence.
- **Compliance:** CAN-SPAM footer + one-click opt-out on every email; permanent suppression
  list checked before every send; Router branches on `compliance_region` for EU/UK (GDPR/PECR).
- **Findings must be real.** The Drafter prompt forbids inventing threats — only verified
  per-prospect data goes in the message.

## Note on the local model

`qwen3.5:9b` (256K context, native tools, vision, ~6.6 GB Q4_K_M) is plenty for these
narrow tasks. Keep thinking mode **off** for high-volume classify/extract; optionally on
for drafting. If extraction accuracy is shaky on real UDRP prose, step up to
`qwen3.5:9b-q8_0` or a larger tag in the family.
```
