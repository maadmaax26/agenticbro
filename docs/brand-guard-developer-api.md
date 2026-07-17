# Brand Guard Developer API

Base URL: `https://agenticbro.app/api/v1/brand-guard`

## Authentication

Create and revoke keys from `POST /api/brand-guard/api-keys` using a signed-in Supabase bearer token. The raw key is returned once and stored only as a SHA-256 hash.

```bash
curl -X POST https://agenticbro.app/api/brand-guard/api-keys \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Production","scopes":["scans:read","scans:write","takedowns:read","takedowns:write","usage:read"]}'
```

Use the resulting key on developer endpoints:

```text
Authorization: Bearer bg_live_...
```

Available scopes:

| Scope | Access |
|---|---|
| `scans:write` | Queue scans |
| `scans:read` | Read scan jobs and results |
| `takedowns:write` | Queue takedown submissions |
| `takedowns:read` | Read takedown lifecycle state |
| `usage:read` | Read request usage logs |

## Rate Limits

Key ceilings are plan-based: Free 30, Guardian 60, Sentinel 300, and Fortress 1,000 requests per minute. Every response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. A rejected request returns `429` with `Retry-After`.

## Queue A Scan

```bash
curl -X POST https://agenticbro.app/api/v1/brand-guard/scans \
  -H "Authorization: Bearer $BRAND_GUARD_API_KEY" \
  -H "Idempotency-Key: customer-42-scan-2026-06-19" \
  -H "Content-Type: application/json" \
  -d '{"brand_monitor_id":"MONITOR_UUID","job_type":"full","platforms":["x","instagram","tiktok","facebook","telegram","linkedin"]}'
```

The API returns `202`. Read one job with `GET /scans/{job_id}` or list jobs with `GET /scans?limit=25`.

Job states are `queued`, `leased`, `processing`, `completed`, `failed`, and `canceled`. Workers use leases and exponential retry. An expired lease is safely requeued until `max_attempts` is reached.

## Plan Scheduling

| Plan | Schedule | Queue priority |
|---|---:|---:|
| Free | Manual only | 10 |
| Guardian | Every 6 hours | 30 |
| Sentinel | Every 15 minutes | 60 |
| Fortress | Every 5 minutes | 100 |

The five-minute Fortress cadence is the durable polling implementation of near-real-time monitoring. Scheduler inserts are idempotent by monitor, plan, and time slot.

## Submit A Takedown

```bash
curl -X POST https://agenticbro.app/api/v1/brand-guard/takedowns \
  -H "Authorization: Bearer $BRAND_GUARD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "brand_monitor_id":"MONITOR_UUID",
    "platform":"instagram",
    "target_url":"https://instagram.com/example_impersonator",
    "claim":"brand_impersonation",
    "evidence":["https://evidence.example/screenshot.png"],
    "contact":{"email":"security@example.com"}
  }'
```

Read status at `GET /takedowns/{id}`. Lifecycle states are `draft`, `queued`, `submitting`, `submitted`, `acknowledged`, `monitoring`, `removed`, `rejected`, `failed`, and `canceled`.

Automated submission uses `TAKEDOWN_GATEWAY_URL` and `TAKEDOWN_GATEWAY_TOKEN`. The provider must support:

- `POST /v1/submissions` returning `{ "id": "provider-reference", "status": "submitted" }`.
- `GET /v1/submissions/{id}` returning the current provider status.
- The `Idempotency-Key` header on submission.

This gateway boundary is required because social platforms generally use private partner APIs or human-facing legal forms rather than public takedown APIs.

## Usage Logs

`GET /usage?since=2026-06-01T00:00:00Z` returns request totals and up to 1,000 recent records. Logs include route, scope, response status, latency, units, and a salted hash of the source IP. Raw API keys and raw IP addresses are never logged.
