# OpenClaw integration — daily review-queue populator

This folder wires `worker.py` into OpenClaw's cron so the discovery pipeline runs
once a day and **fills the human review queue**. It does **not** send mail and it
does **not** approve anything. A human still approves every draft by hand in the
Outreach console at `https://agenticbro.app/brand-guard/admin`.

```
cron fires daily  ->  worker.py --live  ->  collect -> resolve -> score -> route -> draft
                                          ->  persist each draft as approval='unreviewed'
                                          ->  STOP. (no send, no approve)

human, later, in the Outreach tab  ->  review -> approve/reject -> (separate, dry-run send stage)
```

## What the job does

`cron-job.json` is a single OpenClaw cron job, modeled exactly on the existing
`brand-guard-*` jobs in `~/.openclaw/cron/jobs.json`. It uses an `agentTurn`
payload with `toolsAllow: ["exec"]` to run:

```bash
cd ~/agenticbro/brand-guard-agent && python3 worker.py --live --days 30 --max-cases 25
```

- Schedule: `0 7 * * *` (07:00 America/New_York, daily), with a 5-minute stagger.
- `--live` is required for the job to talk to the network (UDRP collect) and to
  write unreviewed drafts to the real Supabase store. Even with `--live`, nothing
  is approved and nothing is sent — the worker imports no transport at all.
- The job reports back (Telegram) **only** when it queues new drafts or errors;
  otherwise it replies `NO_REPLY`, matching the other Brand Guard jobs.

## It is shipped DISABLED on purpose

`cron-job.json` has:

```json
"enabled": false
```

Nothing runs until you flip it to `true` and load it into OpenClaw. This was left
inactive intentionally — do not enable it without a deliberate go-ahead.

## How to install it (when you're ready)

1. **Pick real values for the placeholders** in `cron-job.json`:
   - `id`: generate a fresh UUID, e.g. `python3 -c "import uuid; print(uuid.uuid4())"`.
     The placeholder `00000000-0000-0000-0000-000000000000` must be replaced — two
     jobs may not share an id.
   - `createdAtMs`: set to "now" in ms, e.g. `python3 -c "import time; print(int(time.time()*1000))"`.
   - `sessionKey` / `delivery`: the file reuses the existing Brand Guard group
     session key. Change it if you want the run reported to a different channel,
     or leave `delivery.mode` as `"none"` to keep it silent.
   - The `cd ~/agenticbro/brand-guard-agent` path in `payload.message` is the
     assumed install location of this project on the host. **Verify it matches
     where `worker.py` actually lives** and edit if not.

2. **Confirm the host can reach the store.** `--live` calls `db.store.connect()`,
   which loads the Supabase service key from `~/agenticbro/.env.local`. Make sure
   that file exists on the OpenClaw host and that `python3 worker.py --live` runs
   by hand first (see "Dry run first" below).

3. **Merge the job** into `~/.openclaw/cron/jobs.json`. The jobs file is an object
   with a top-level `"jobs": [ ... ]` array (see `jobs.json.migrated`). Append the
   object from `cron-job.json` into that array. With `jq`:

   ```bash
   jq '.jobs += [input]' ~/.openclaw/cron/jobs.json cron-job.json > /tmp/jobs.json \
     && cp ~/.openclaw/cron/jobs.json ~/.openclaw/cron/jobs.json.bak \
     && mv /tmp/jobs.json ~/.openclaw/cron/jobs.json
   ```

   (Back up first, as above. Do not hand-edit while OpenClaw is mid-write.)

4. **Enable it** by setting `"enabled": true` on the job, then reload OpenClaw's
   cron (restart the agent, or however you normally pick up jobs.json changes).

## Dry run first (strongly recommended)

Before going `--live`, prove the wiring offline — no network, nothing persisted:

```bash
cd ~/agenticbro/brand-guard-agent
python3 worker.py                 # OFFLINE: fixtures + in-memory store
python3 worker.py --days 14 --max-cases 40   # same, different knobs
```

Then a single real run by hand before letting cron drive it:

```bash
python3 worker.py --live --max-cases 5        # small real collect + real enqueue
```

Open the Outreach console and confirm the new `unreviewed` drafts show up. Only
then enable the cron job.

## Website content review bridge

`content-review-cron-job.json` consumes the existing Supabase
`brand_guard_content_candidates` queue. It does not copy content into
`outreach_drafts`, create Gmail drafts, or publish to X.

Run these checks from `brand-guard-agent` after the website migration and API
worker are deployed:

```bash
BRANDGUARD_ENV_FILE=.env.content python3 -m crm.telegram_review content-status
BRANDGUARD_ENV_FILE=.env.content python3 -m crm.telegram_review content-post --limit 5 --dry-run
BRANDGUARD_ENV_FILE=.env.content python3 -m crm.telegram_review content-post --limit 5
```

The live command claims each `new` candidate as `in_review` before posting one
card to the configured private admin Telegram DM. Telegram buttons use the
existing callback command with `bgc:approve:ID`, `bgc:reject:ID`, or
`bgc:skip:ID`. Approval marks the candidate `approved` for manual X posting;
rejection marks it `rejected`; hold marks it `held`.

The supplied hourly job is disabled by default. Register and enable it only
after the dry run shows sanitized draft copy and the callback handler is routed
to:

```bash
python3 -m crm.telegram_review callback "<callback_data>" \
  "<from_id>" "<callback_query_id>" "<chat_id>" "<message_id>"
```

## Incident Discovery Telegram command center

`incident-daily-cron-job.json` and `incident-alerts-cron-job.json` deploy the
new `incident_discovery_agent.py` as OpenClaw command jobs:

- `brand-guard-incident-daily`: `15 7 * * *` America/New_York. Posts the morning
  Brand Guard Daily Incident Report, top outreach opportunities, industry and
  attack summaries, trend detection, sales queue, social content pack, and the
  Friday weekly executive/product report.
- `brand-guard-incident-alerts`: `5 * * * *` America/New_York. Runs an hourly
  score-90+ sweep and posts only immediate high-priority incidents. If there is
  no qualifying incident, the command prints `NO_REPLY`.

The deployed commands use:

```bash
BRANDGUARD_ENV_FILE=~/.openclaw/workspace/brand-guard-agent/.env.incidents \
python3 incident_discovery_agent.py --live --post-telegram --max-items 40
```

Telegram delivery reads `MADMAX_TELEGRAM_BOT_TOKEN` plus
`MADMAX_TELEGRAM_CHAT_ID` first, then falls back to `BG_BOT_TOKEN` /
`TELEGRAM_BOT_TOKEN` and `BG_INCIDENT_CHAT_ID` / `BG_CHAT_ID`. OpenClaw fallback
delivery is disabled on both jobs so Telegram output is controlled by the agent
itself.

To run it on demand from a Telegram/OpenClaw session, ask the agent to execute
one of these commands:

```bash
cd ~/.openclaw/workspace/brand-guard-agent && python3 crm/incident_trigger.py daily
cd ~/.openclaw/workspace/brand-guard-agent && python3 crm/incident_trigger.py alerts
cd ~/.openclaw/workspace/brand-guard-agent && python3 crm/incident_trigger.py preview
cd ~/.openclaw/workspace/brand-guard-agent && python3 crm/incident_trigger.py status
```

`daily` and `alerts` post to the configured Madmax Telegram group. `preview`
prints a live report without posting. `status` shows the last report timestamp
and the deployed OpenClaw job IDs.

## What this does NOT do

- It does not send email. There is no transport imported anywhere in `worker.py`.
- It does not approve drafts. Everything it writes is `approval='unreviewed'`.
- It does not change the separate send stage (which is dry-run/disarmed by default
  and human-gated regardless).
- It does not touch your live `jobs.json` — this folder is just the snippet plus
  these instructions. You install it deliberately.
