# TECHNICAL.md - Technical Reference

This file contains technical details that don't change often. Safe to reference but not critical for every interaction.

---

## Infrastructure

- **Chrome CDP:** Port 18801 (local Mac Studio only)
- **Telegram Bot:** @Jeeevs222_bot
- **Welcome Bot:** DISABLED
- **Node:** 077d7cfed2b99aefbb689ef00e949ed2bdb45dff020c1bb334fa0a7f733adfbd
- **Host:** Earl's Mac Studio
- **Workspace:** /Users/efinney/.openclaw/workspace/

---

## Model Assignments

| Model | Use Case |
|-------|----------|
| ollama/kimi-k2.6:cloud | Primary — all sessions |
| ollama/glm-5.1:cloud | Fallback #1 + nightly review |
| ollama/qwen3.5:9b | ALL cron jobs + local fallback #2 |
| ollama/glm-5:cloud | Config default fallback |

**Ollama Cooldown:** Model swaps cause provider cooldown cascade. Set `OLLAMA_KEEP_ALIVE=24h`.
**VRAM:** Only `qwen3.5:9b` (6.6GB) loaded locally. All other models are cloud-based — no VRAM contention.

---

## Scan Commands

| Platform | Command |
|----------|---------|
| Instagram | `bash /workspace/scripts/scan-instagram.sh "<username>"` |
| TikTok | `bash /workspace/scripts/scan-tiktok-command.sh "<username>"` |
| Facebook | `bash /workspace/scripts/scan-facebook.sh "<username>"` |
| Phone | `bash /workspace/scripts/scan-phone.sh "+14158586273" US` |
| Phone API | `bash /workspace/scripts/phone-scan-api.sh "+14158586273" US` |
| Telegram | `bash /workspace/scripts/scan-telegram.sh "James6865"` |
| Universal | `bash /workspace/scripts/scan-source.sh "<platform>" "<username>"` |

**NOTE:** Always use `bash` wrapper scripts. Direct `python3` calls are blocked by OpenClaw exec preflight.

---

## Risk Scoring (90-Point Unified)

### Red Flags
| Flag | Points |
|------|--------|
| guaranteed_returns | 25 |
| giveaway_airdrop | 20 |
| dm_solicitation | 15 |
| free_crypto | 15 |
| alpha_dm_scheme | 15 |
| unrealistic_claims | 10 |
| download_install | 10 |
| urgency_tactics | 10 |
| emotional_manipulation | 10 |
| low_credibility | 10 |

### Phone Flags
| Flag | Points |
|------|--------|
| invalid_number | 25 |
| premium_rate_number | 25 |
| voip_number | 20 |
| spoofed_caller_id | 15 |
| disposable_number | 15 |
| spam_dialer_service | 15 |
| high_risk_country | 15 |
| toll_free_untraceable | 10 |
| landline_text | 10 |
| no_carrier_info | 10 |
| medium_risk_country | 8 |
| unknown_carrier | 5 |

### Risk Levels
- 0-3: LOW
- 3-5: MEDIUM
- 5-7: HIGH
- 7+: CRITICAL

---

## Bot Detection (100-Point Scale)

### Bot Score Classification
- 0-20: Authentic
- 21-40: Mild Bot Activity
- 41-60: Moderate Bot Inflation
- 61-80: High Bot Inflation
- 81-100: Highly Bot-Inflated

### Ghost Comments Scoring
| Threshold | Points |
|-----------|--------|
| ≥95% hidden | 20 (Critical) |
| ≥70% hidden | 15 (High) |
| ≥50% hidden | 10 (Moderate) |

---

## Supabase Security Checklist

**⚠️ MANDATORY: Run this checklist for EVERY new table, view, or migration that touches Supabase.**

### When Creating a New Table:
1. **ENABLE RLS** — `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;`
2. **Add at minimum a SELECT policy** — even public-read tables need explicit policies
3. **Never expose `auth.users` data** through public views or tables
4. **Use `security_barrier = true`** on all views that reference auth schema
5. **Test with anon key** — verify anonymous API access returns only what it should

### When Creating a View:
1. **Never SELECT from `auth.users` without `WHERE auth.uid()` filter** — a view without this filter exposes ALL user emails/IDs to the public API
2. **Set `security_barrier = true`** — prevents Postgres from optimizing away security filters
3. **Revoke anon/public access** if the view should only be visible to authenticated users: `REVOKE ALL ON public.<view> FROM anon; REVOKE ALL ON public.<view> FROM public;`
4. **Grant only what's needed** — e.g., `GRANT SELECT ON public.<view> TO authenticated;`

### RLS Policy Patterns (copy these):
- **Public read, service write:** `CREATE POLICY "<table>_select" ON public.<table> FOR SELECT TO anon USING (true);` + service_role INSERT/UPDATE/DELETE with `(auth.role() = 'service_role')`
- **Owner-scoped:** `USING (owner_id = auth.uid())` or `USING (brand_monitor_id IN (SELECT id FROM brand_monitors WHERE owner_id = auth.uid()))`
- **Type cast when needed:** If a FK column is `text` but references a `uuid`, use `::uuid` cast: `brand_monitor_id::uuid IN (SELECT id ...)`

### Secret Handling Rules (NEVER violate these):
1. **NEVER commit `.env*` files** — `.env`, `.env.local`, `.env.production`, `.env.check`, `.env.vercel` all in `.gitignore`
2. **NEVER hardcode Supabase URL** — Always use `import.meta.env.VITE_SUPABASE_URL` or `process.env.VITE_SUPABASE_URL`, never a fallback URL string
3. **NEVER hardcode API keys** — All keys come from env vars. No fallback values.
4. **NEVER commit Telegram bot tokens** — Store in `.env` as `TELEGRAM_BOT_TOKEN`. @Jeeevs222_bot was compromised this way.
5. **NEVER commit Vercel OIDC tokens** — `.env.check` and `.env.vercel` are auto-generated by `vercel` CLI, always in `.gitignore`
6. **`supabase/migrations/` can contain project IDs** (they're not secret, just project identifiers) but prefer `YOUR_PROJECT_ID` placeholders
7. **`.env.example` is OK** — Contains only placeholder values (`your_key_here`, `sk_live_...`), never real keys
8. **If secrets are accidentally committed:** Use `git filter-repo` to purge from history, then force push. Rotate the compromised key.

### Security Audit Commands:
```bash
# Scan git history for leaked secrets
git log -p --all | grep -E "eyJhb|sk_live|sk_test_[a-zA-Z0-9]{20}|VERCEL_OIDC"

# Check for hardcoded URLs in source
git grep -l "drvasofyghnxfxvkkwad" HEAD

# Purge files from history
git filter-repo --invert-paths --path .env.check --path .env.vercel --force

# Replace strings in history
echo "SECRET_STRING" > /tmp/purge.txt && git filter-repo --replace-text /tmp/purge.txt --force
```

```sql
-- Find tables WITHOUT RLS
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;

-- Find tables with RLS but NO policies (blocks ALL access)
SELECT t.tablename FROM pg_tables t LEFT JOIN (SELECT schemaname, tablename, count(*) as pc FROM pg_policies WHERE schemaname = 'public' GROUP BY 1,2) p ON t.schemaname = p.schemaname AND t.tablename = p.tablename WHERE t.schemaname = 'public' AND t.rowsecurity = true AND COALESCE(p.pc, 0) = 0;

-- Find views exposing auth.users
SELECT viewname FROM pg_views WHERE definition ILIKE '%auth.users%' AND schemaname = 'public';
```

### Incident: 2026-06-02 — Two Critical Supabase Security Issues
- **auth_users_exposed:** `brand_guard_admin_users` view exposed ALL user emails/IDs/metadata to anyone with API access. Fixed by adding `WHERE u.id = auth.uid()` + `security_barrier = true` + revoked anon access.
- **rls_disabled_in_public:** `email_spoof_checks` and `visual_match_evidence` had no RLS. `takedown_actions` and `threat_profiles` had RLS but 0 policies (blocks all access). Fixed by enabling RLS + adding appropriate policies.
- **Migration:** `005_security_fix_auth_users_and_rls.sql` committed and pushed.

---

## Cron Job Details

| Job | Schedule | Model | Status |
|-----|----------|-------|--------|
| heartbeat-morning | 8:00 AM EST | qwen3.5:9b | ✅ |
| heartbeat-evening | 8:00 PM EST | qwen3.5:9b | ✅ |
| morning_energy_post | 7:00 AM EST | qwen3.5:9b | ✅ |
| morning_education_tip | 7:30 AM EST | qwen3.5:9b | ✅ |
| buy-energy-boost | 10AM/2PM/6PM | qwen3.5:9b | ✅ |
| midday_checkin | 12:00 PM | qwen3.5:9b | ✅ |
| new-member-welcome | Every 5 min | qwen3.5:9b | ✅ |
| batch-welcome-5-members | Every 5 min | qwen3.5:9b | ✅ |
| nightly_review | 2:00 AM EST | glm-5.1:cloud | ✅ |
| scam_db_sync | Every 12h | — | ❌ MISSING |
| db_integrity_check | Every 6h | — | ❌ MISSING |
| token-reminder | Wed 2PM | — | ❌ MISSING |

**Session Target:** All group crons now target `session:agent:agentic-bro:telegram:group:-1003751594817`

---

## API Keys

| Service | Key Location |
|---------|--------------|
| FTC DNC | `FTC_API_KEY` in Vercel env |
| Numverify | `05c48520e3a536d5cf899c6a6a6d2be34d` |
| Telegram Bot | `8692355…REDACTED` |
| Supabase | Project: `drvasofyghnxfxvkkwad` |

---

## Key Files

| File | Purpose |
|------|---------|
| `/workspace/MEMORY.md` | Active memory (trimmed if >8KB) |
| `/workspace/memory/RULES.md` | Permanent rules (never trimmed) |
| `/workspace/memory/TECHNICAL.md` | Technical reference (this file) |
| `/workspace/memory/2026-04-25.md` | Daily notes (archived after 7 days) |
| `/workspace/batch-welcome-state.json` | Welcome tracker state |
| `/workspace/scammer-database.csv` | 278+ scammer entries |
| `/cron/jobs.json` | Cron job definitions |

---

**This file should NEVER be trimmed.**
---

## Brand Guard — Monitor Worker & Alert Delivery

**Deployed:** 2026-06-03
**Status:** ✅ Live (Vercel serverless + cron)

### Monitor Worker (`/api/brand-guard/monitor-worker`)
- **Schedule:** Every 6 hours (Vercel cron + OpenClaw cron backup)
- **Logic:** Fetches `brand_monitors` where `is_active=true` and `scan_frequency != 'once'` and `last_scan_at` is past due
- **Scans run:** email-spoof, impersonator-scan, domain-monitor (per monitor config)
- **Delta detection:** Compares current scan results against previous scan for score drops (≥15 points triggers escalation alert)
- **Alerts created:** New threats (impersonators, lookalike domains), email security changes, score degradation
- **Writes to:** `brand_guard_alerts`, updates `brand_monitors.last_scan_at` and `scan_count`
- **Rate limiting:** 2s delay between monitors to avoid API rate limits

### Alert Delivery (`/api/brand-guard/alert-delivery`)
- **Schedule:** Every 15 minutes (Vercel cron + OpenClaw cron backup)
- **Logic:** Fetches unread `brand_guard_alerts` from last 24h, delivers via email (Resend) and in-app (Supabase realtime broadcast)
- **Email:** Styled HTML with severity-based colors (critical=red, high=orange, medium=yellow, low=green, info=blue)
- **In-app:** Supabase realtime channel `brand-alerts:{owner_id}` with broadcast events
- **After delivery:** Marks alerts as `read=true`
- **Requires:** `RESEND_API_KEY` env var (free tier = 100 emails/day)

### Frontend Hook (`useBrandGuardAlerts.ts`)
- Subscribes to `brand_guard_alerts` postgres_changes for INSERT and UPDATE
- Shows toast notifications with auto-dismiss (30s for critical/high, 10s for low/info)
- Methods: `markRead()`, `markAllRead()`, `dismissToast()`, `refresh()`
- Returns: `alerts`, `unreadCount`, `criticalCount`, `toasts`

### Cron Jobs (OpenClaw — backup)
| Job | Schedule | Purpose |
|-----|----------|---------|
| brand-guard-monitor-worker | Every 6h EST | Triggers monitor-worker API |
| brand-guard-alert-delivery | Every 15m | Triggers alert-delivery API |

### Env Vars Needed
| Var | Purpose | Where |
|-----|---------|-------|
| `RESEND_API_KEY` | Email delivery | `.env.local` + Vercel |
| `RESEND_FROM_EMAIL` | Sender address | `.env.local` + Vercel (default: alerts@agenticbro.app) |
| `SUPABASE_URL` | DB access | Already configured |
| `SUPABASE_SECRET_API_KEY` | Service role | Already configured |
