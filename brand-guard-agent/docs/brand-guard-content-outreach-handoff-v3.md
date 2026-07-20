# Brand Guard Content and Outreach Loop
## OpenClaw Handoff v3

**Runtime:** Jeeevs in OpenClaw on the Mac Studio
**Persistent stores:** Local SQLite for outreach; website Supabase for customer scans and content candidates
**Approval:** Private Telegram DM
**Email:** Gmail Drafts through the existing OAuth integration
**Supersedes:** `brand-guard-content-outreach-handoff-v2.md`

This revision removes the proposed Jarvis, Hermes, Zoho, Signal, WhatsApp,
Redis, and TCS dependencies. It uses a deliberate two-store boundary:

- Local SQLite, managed by Jeeevs, is the system of record for prospect
  discovery, outreach monitoring, Telegram approval, Gmail drafting, replies,
  and suppression.
- The website's existing Supabase project remains the system of record for
  customer-initiated Brand Guard scans, alerts, and consented content
  candidates derived from those scans.

Customer scan data is not copied into the outreach database. Outreach data is
not written into the website Supabase project.

---

## 0. Production Contract

| Capability | Existing component |
|---|---|
| Daily prospect discovery | `scripts/bg-daily-outreach.sh` |
| Local queue population | `brand-guard-agent/worker.py` through a local store adapter |
| Local database | `data/brand-guard-outreach.sqlite3` |
| Prospect store | SQLite `prospects` |
| Evidence store | SQLite `signals` |
| Outreach drafts | SQLite `outreach_drafts` |
| Website scan source | Supabase `brand_guard_scans` |
| Website normalized findings | Supabase `brand_guard_alerts`, `brand_impersonators`, `domain_lookalikes`, and `brand_guard_detected_threats` |
| Website scan ownership | Supabase `brand_monitors.owner_id` and validated `brand_guard_scans.owner_id` |
| Content candidate queue | Supabase `brand_guard_content_candidates` |
| Deterministic score | `pipeline/scorer.py` using `victim_score` |
| Compliance routing | `pipeline/router.py` |
| Draft generation | `pipeline/drafter.py` |
| Telegram review | `crm/telegram_review.py` |
| Gmail integration | `gmail_draft_pusher.py` |
| Reply and bounce processing | `crm/inbound_runner.py` |
| Scheduling and notifications | OpenClaw cron jobs owned by Jeeevs |

### Existing field mapping

Preserve the current logical field names in the local schema:

| Meaning | Production field |
|---|---|
| Prospect identifier | `prospects.id` |
| Brand or company name | `prospects.company_name` |
| Official domain | `prospects.primary_domain` |
| Risk or buyer-priority score | `prospects.victim_score` |
| Outreach channel | `prospects.routed_channel` |
| Draft approval | `outreach_drafts.approval` |
| Detection evidence | `signals` and `signals.extra` |

### Required local database bootstrap

Create `brand-guard-agent/db/sqlite_store.py` behind the existing `BaseStore`
contract and manage schema versions in `brand-guard-agent/db/sqlite_migrations/`.
The first migration creates local equivalents of `prospects`, `signals`,
`outreach_drafts`, `suppression_list`, `touches`, and `replies`, then adds:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

ALTER TABLE prospects
  ADD COLUMN monitor_enabled INTEGER NOT NULL DEFAULT 0
    CHECK (monitor_enabled IN (0, 1));
ALTER TABLE prospects
  ADD COLUMN monitor_priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE prospects ADD COLUMN monitor_last_checked_at TEXT;
ALTER TABLE prospects ADD COLUMN monitor_last_detection_at TEXT;

CREATE INDEX IF NOT EXISTS idx_prospects_monitor_queue
  ON prospects (monitor_priority DESC, monitor_last_checked_at ASC)
  WHERE monitor_enabled = 1
    AND suppressed = 0
    AND primary_domain IS NOT NULL;

ALTER TABLE outreach_drafts
  ADD COLUMN lane TEXT NOT NULL DEFAULT 'cold'
    CHECK (lane IN ('cold', 'live_detection', 'pilot', 'follow_up'));
```

SQLite migrations must be ordered, transactional, and recorded in a
`schema_migrations(version, applied_at)` table. Migration code must check
existing columns before issuing `ALTER TABLE`, because SQLite does not support
`ADD COLUMN IF NOT EXISTS`.

Do not create a second CRM or a separate watchlist. The monitored watchlist is a
local query over `prospects`. Existing JSON files in `data/` are imported once
and retained only as discovery inputs, run artifacts, and recovery evidence.

---

## 1. Closed-Loop Architecture

```text
Prospect discovery
      |
      v
Local SQLite prospects
  monitor_enabled=true
      |
      v
Jeeevs OpenClaw monitor job
      |
      +--> CT candidate collection
      +--> official-domain exclusion
      +--> active-site and evidence verification
      |
      v
Local SQLite signals (canonical detection record)
      |
      v
Existing deterministic scorer and compliance router
      |
      +--> Outreach lane: unreviewed outreach_drafts row
                         lane=live_detection
                              |
                              v
                     Telegram DM approval
                              |
                              v
                       Gmail Draft created
                              |
                              v
                     Human reviews and sends

Website Brand Guard scan
      |
      v
Supabase brand_guard_scans + normalized findings
      |
      +--> completed real scan
      +--> validated owner
      +--> explicit content-reuse consent
      |
      v
Supabase brand_guard_content_candidates
      |
      v
Jeeevs creates anonymized content draft
      |
      v
Private Telegram DM review
      |
      v
Human publishes
```

Jeeevs owns orchestration, retries, summaries, and Telegram notifications.
OpenClaw invokes existing scripts and records run results. No service may send
email automatically.

All services access SQLite through `BaseStore` and short-lived connections.
Each connection enables foreign keys and `busy_timeout`; write transactions use
`BEGIN IMMEDIATE` only for the smallest necessary critical section. Jobs must
not share a long-lived connection across processes.

The content service accesses website Supabase with a server-side service
credential and a narrowly scoped repository module. It may read completed,
consented scan records and write content candidates. It must not modify scan
results, customer alerts, subscriptions, credits, or outreach records.

---

## 2. Monitoring Eligibility

A prospect enters the watchlist only when all are true:

- `monitor_enabled = true`
- `primary_domain` is present and normalized
- `suppressed = false`
- the domain belongs to the prospect, not a registrar or third party
- the prospect has a usable company name or brand token

Suggested automatic enablement:

- verified SMB or mid-market company
- named decision maker or published business intake
- documented harm, public complaint, UDRP filing, or recent impersonation event
- `victim_score >= 30`

Manual enable and disable must remain available in the Brand Guard Admin
Outreach view.

---

## 3. Detection Rules

Certificate Transparency results are candidates, not proof of abuse. A CT-only
match must never generate a claim that fraud occurred.

For each monitored prospect:

1. Query CT logs using a normalized brand token.
2. Exclude `primary_domain`, known official domains, CDN domains, and authorized
   subdomains.
3. Normalize candidate domains with IDNA handling and registrable-domain parsing.
4. Deduplicate against `signals`.
5. Verify DNS, certificate recency, HTTP status, redirects, page title, brand
   text, payment or login indicators, and screenshot evidence where available.
6. Store the evidence as a `signals` row with:
   - `source = 'crt.sh'`
   - `signal_type = 'lookalike_domain'`
   - `prospect_id = prospects.id`
   - candidate domain and verification data in `extra`
7. Recompute `victim_score`.

### Canonical idempotency key

Use one local database key:

```text
sha256(prospect_id + normalized_candidate_domain + certificate_id)
```

Store it in a dedicated `signals.dedup_key` column with a unique index. Keep
verification detail as JSON text in `signals.extra`. Repeated checks update
`last_seen_at`; they do not create duplicate outreach drafts.

---

## 4. Outreach Eligibility

The live-detection lane must reuse `pipeline/router.py`. It does not bypass:

- suppression checks
- contact-quality checks
- verified-recipient checks
- jurisdiction and compliance rules
- maximum-touch limits
- prior bounce or opt-out state

A detection may create an outreach draft only when:

- it maps to exactly one prospect
- the candidate is stronger than a raw CT match
- the deterministic score clears the configured threshold
- the existing router returns an allowed outbound channel
- no active live-detection draft already exists for the same detection

The draft must describe facts precisely:

- Allowed: "A lookalike domain resembling your brand appeared in public
  certificate records."
- Allowed when verified: "The domain currently resolves and presents branding
  similar to yours."
- Not allowed without evidence: "Customers are being defrauded" or "This is a
  confirmed phishing site."

Set:

```text
outreach_drafts.lane = live_detection
outreach_drafts.approval = unreviewed
outreach_drafts.findings_used = {
  detection_id,
  candidate_domain,
  first_seen_at,
  verification,
  evidence_urls,
  victim_score,
  dedup_key
}
```

---

## 5. Telegram DM Review

Extend `crm/telegram_review.py` rather than building a new approval service.

Each private Telegram review card should include:

- company and official domain
- named recipient and channel
- `victim_score`
- candidate domain
- first-seen time
- verification summary
- subject and complete draft body
- Approve, Reject, and Skip controls

Approval only changes local SQLite state:

```text
unreviewed -> approved
unreviewed -> rejected
```

It must not send email. A callback must verify the configured owner identity,
update the draft inside a transaction, use the draft ID from the callback, and
be idempotent.

Telegram group chats are not part of this workflow. Reviews and operational
notifications go only to the configured private admin DM.

---

## 6. Gmail Draft Integration

Extend `gmail_draft_pusher.py`.

The pusher reads approved drafts from the local store where:

- `lane in ('cold', 'live_detection', 'pilot', 'follow_up')`
- an eligible email channel is selected
- `contact_email` is present
- the prospect and address are not suppressed
- email verification does not return low confidence
- `gmail_draft_id` is absent

The pusher creates a Gmail draft through `users.drafts.create` and records the
Gmail draft ID in dedicated `gmail_draft_id` and `gmail_drafted_at` columns.
The update uses `WHERE gmail_draft_id IS NULL` to prevent duplicate claiming.
It never calls a Gmail send endpoint.

For `live_detection`, the subject should be factual and non-alarmist:

```text
Possible lookalike domain detected for <Company>
```

The human performs the final review and send from Gmail.

---

## 7. Website Scan Content Lane

Website-initiated Brand Guard scans remain in the existing Supabase
`brand_guard_scans` table. Content creation reads only completed real scans and
their normalized findings. Preview-only results where
`result.real_scan_pending = true` are never eligible.

### Ownership and consent migration

Add trusted ownership and a per-scan consent snapshot:

```sql
ALTER TABLE brand_guard_scans
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS initiated_from TEXT NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS content_reuse_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_reuse_scope TEXT NOT NULL DEFAULT 'none'
    CHECK (content_reuse_scope IN ('none', 'anonymized', 'named')),
  ADD COLUMN IF NOT EXISTS content_reuse_consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_reuse_revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_brand_guard_scans_content_eligible
  ON brand_guard_scans (completed_at DESC)
  WHERE status = 'complete'
    AND content_reuse_consent = true
    AND content_reuse_revoked_at IS NULL;
```

The website scan endpoint must:

- derive `owner_id` from the validated authentication token
- validate that `brand_monitor_id` belongs to that owner
- ignore or reject a client-supplied monitor ID that is not owned by the caller
- store the consent checkbox, scope, and timestamp at scan initiation
- default unauthenticated scans to `content_reuse_consent = false`
- preserve the original consent timestamp for audit
- provide a withdrawal path that sets `content_reuse_revoked_at`; unpublished
  candidates are immediately moved to `held`

### Supabase content candidate queue

Create a sanitized derivative queue in the website Supabase project:

```sql
CREATE TABLE IF NOT EXISTS brand_guard_content_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES brand_guard_scans(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN (
      'new', 'held', 'drafted', 'in_review', 'approved',
      'posted', 'rejected', 'archived'
    )),
  content_scope TEXT NOT NULL
    CHECK (content_scope IN ('anonymized', 'named')),
  finding_type TEXT NOT NULL,
  safe_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_copy TEXT,
  draft_hashtags TEXT[] NOT NULL DEFAULT '{}',
  draft_image_spec TEXT,
  safety_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  telegram_message_id TEXT,
  posted_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scan_id, finding_type)
);

ALTER TABLE brand_guard_content_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON brand_guard_content_candidates FROM anon, authenticated;
```

Raw scan payloads, customer identifiers, email addresses, phone numbers,
account IDs, and unredacted evidence remain in their existing protected tables.
`safe_summary` contains only the minimum facts needed to draft content.

The deterministic content gate must require:

- `brand_guard_scans.status = 'complete'`
- `result.real_scan_pending` is absent or false
- trusted `owner_id` and validated monitor ownership
- explicit `content_reuse_consent = true`
- `content_reuse_revoked_at IS NULL`
- at least one verified or high-confidence finding
- no unresolved safety or privacy flag

The gate must block:

- a victim brand name unless `content_reuse_scope = 'named'`
- raw customer or account identifiers
- candidate domains, handles, or phone numbers unless named consent and human
  approval explicitly permit them
- unsupported loss, fraud, or attribution claims
- "caught live" language without a completed `brand_guard_scans.id`
- theoretical variants presented as detected impersonators

Jeeevs writes draft copy only to `brand_guard_content_candidates`. Private
Telegram DM can approve or reject the content candidate, but publishing remains
manual initially.

---

## 8. OpenClaw Services

Register or update these Jeeevs-owned services:

| Service | Schedule | Action |
|---|---|---|
| Daily outreach | 9:00 AM ET | Existing discovery, people enrichment and draft preparation |
| Watchlist sync | After daily outreach | Enable or refresh qualified monitored prospects |
| Lookalike monitor | Every 6 hours | Scan due monitored prospects and upsert signals |
| Detection router | After monitor | Score, route and stage content/outreach drafts |
| Telegram review notifier | After routing | Post new review cards to private admin DM |
| Gmail draft pusher | Every 30 minutes | Create Gmail drafts from approved rows |
| Inbound tracker | Every 3 hours | Process replies, opt-outs and bounces |
| Website content candidate builder | Hourly | Read newly completed, consented Supabase scans and upsert sanitized candidates |
| Content review notifier | After candidate builder | Post new content drafts to the private admin DM |
| Local database backup | Daily after outreach | Run SQLite online backup and retain 14 daily copies |
| Database maintenance | Weekly | Run `PRAGMA quick_check`, checkpoint WAL and report file size |
| Weekly metrics | Weekly | Report detections, approvals, Gmail drafts and replies |

Every job must:

- use an idempotent database operation
- emit a short run summary
- retry transient failures with a bounded backoff
- avoid logging credentials or complete private email bodies
- notify Telegram only when action or human attention is required

The database file and backups must be owner-readable only (`0600`) and stored
outside website roots. Use SQLite's online backup API rather than copying a live
database file. Fail closed if `PRAGMA quick_check` does not return `ok`.

---

## 9. Dispatch Manifest

```yaml
BG3-00:
  task: Confirm production field mapping
  owner: Jeeevs
  acceptance:
    - prospects.id and company_name are used
    - Gmail and Telegram DM are confirmed
    - victim_score and pipeline/router.py are reused

BG3-01:
  task: Bootstrap local SQLite and add the BaseStore adapter
  depends_on: [BG3-00]
  writes: data/brand-guard-outreach.sqlite3
  acceptance:
    - WAL, foreign keys and busy timeout are enabled
    - migrations are ordered, transactional and idempotent
    - database and backups are mode 0600
    - pipeline code depends on BaseStore, not vendor APIs

BG3-02:
  task: Import existing local JSON state and build the watchlist query
  depends_on: [BG3-01]
  acceptance:
    - imports are repeatable and deduplicated by stable natural keys
    - source JSON files remain unchanged
    - enabling a prospect makes it due for monitoring
    - disabling removes it from future monitor runs

BG3-03:
  task: Adapt CT collector for monitored prospects
  depends_on: [BG3-02]
  writes: signals
  acceptance:
    - official domains are excluded
    - duplicate certificates do not create duplicate signals
    - CT-only results are labeled unverified

BG3-04:
  task: Verify candidates and route detections
  depends_on: [BG3-03]
  reads: signals, prospects
  writes: outreach_drafts
  acceptance:
    - existing scorer and compliance router are called
    - one signal creates at most one outreach draft
    - unsupported claims are blocked

BG3-05:
  task: Extend Telegram DM review cards
  depends_on: [BG3-04]
  acceptance:
    - only configured admin DM can approve
    - approval never sends mail
    - callbacks are idempotent

BG3-06:
  task: Extend Gmail draft pusher for live_detection
  depends_on: [BG3-05]
  acceptance:
    - approved eligible rows create one Gmail draft
    - Gmail draft ID prevents duplicates
    - no Gmail send endpoint is called

BG3-07:
  task: Add website scan ownership, consent and Supabase content queue
  depends_on: [BG3-00]
  acceptance:
    - scan owner comes from authenticated server context
    - client-supplied monitor ownership is validated
    - incomplete previews and non-consented scans are blocked
    - raw evidence is not copied into content candidates
    - victim names and identifiers are blocked by default
    - one scan creates at most one candidate per finding type

BG3-08:
  task: Register and verify OpenClaw jobs
  depends_on: [BG3-03, BG3-04, BG3-05, BG3-06, BG3-07]
  acceptance:
    - each job appears in the active OpenClaw registry
    - website content jobs use Supabase only
    - outreach jobs use local SQLite only
    - daily online backup and weekly quick_check are registered
    - one dry run completes without duplicate rows or external sends

BG3-09:
  task: Add operational metrics
  depends_on: [BG3-08]
  acceptance:
    - weekly Telegram DM reports candidates, verified detections,
      approvals, Gmail drafts, replies, bounces and opt-outs
```

---

## 10. Rollout Order

1. BG3-00 through BG3-03: turn qualified prospects into a monitored watchlist.
2. BG3-04 through BG3-06: create the detection-to-Telegram-to-Gmail loop.
3. BG3-07: add the consented website-scan content lane in Supabase.
4. BG3-08: arm and dry-run OpenClaw services.
5. BG3-09: measure conversion and detection quality.

The first useful production slice is BG3-00 through BG3-06. It produces
verified, prospect-specific Gmail drafts after Telegram approval without
requiring the public content lane or any new outbound provider.

BG3-07 is independently deployable after its ownership and consent migration.
It must not depend on, query, or copy records from the local outreach database.

---

## 11. Required End-to-End Test

Use a controlled test prospect and synthetic lookalike signal:

1. Enable monitoring for the test prospect.
2. Insert or collect one synthetic CT candidate.
3. Confirm exactly one `signals` row.
4. Run verification and deterministic routing.
5. Confirm one unreviewed `live_detection` outreach draft.
6. Confirm one private Telegram DM card.
7. Approve it from Telegram.
8. Confirm one Gmail draft is created.
9. Re-run every service.
10. Confirm no duplicate signal, Telegram card, or Gmail draft appears.
11. Confirm no email was automatically sent.

Production rollout is blocked until this test passes.

### Website content test

Use one controlled website account and completed synthetic scan:

1. Start a scan without content consent and confirm no candidate is created.
2. Start a consented scan and confirm trusted `owner_id` is stored.
3. Attempt another user's `brand_monitor_id` and confirm the request is rejected.
4. Confirm a processing preview does not create a candidate.
5. Complete the scan with one high-confidence synthetic finding.
6. Confirm one sanitized `brand_guard_content_candidates` row.
7. Confirm the candidate contains no raw account identifiers or private data.
8. Confirm one private Telegram DM review card.
9. Approve it and confirm no automatic public post occurs.
10. Re-run the builder and confirm no duplicate candidate or review card.

Content rollout is blocked until this test passes.
