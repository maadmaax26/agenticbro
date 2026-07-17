# Brand Guard Enterprise Operations

## Entitlements

Protected customer endpoints use `requireBrandGuardEntitlement` from `api/_lib/brand-guard-entitlements.ts`. Subscription status is evaluated on every request, so downgrades and cancellations take effect without stale application caches.

| Feature | Minimum plan |
|---|---|
| Brand management, dashboard, scans | Free |
| Takedown templates | Guardian |
| Developer API, Slack/webhooks, automatic takedowns, visual fingerprints, custom reports | Sentinel |
| SLA reports, weekly briefings, dedicated account manager | Fortress |

Brand limits are Free 1, Guardian 3, Sentinel 10, and Fortress unlimited.

## Slack And Webhooks

Create an endpoint with an authenticated customer session:

```bash
curl -X POST https://agenticbro.app/api/brand-guard/delivery \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Security Operations",
    "channel":"webhook",
    "url":"https://security.example.com/hooks/brand-guard",
    "event_types":["alert","weekly_briefing","sla_report"],
    "minimum_severity":"medium"
  }'
```

Destinations and signing secrets are encrypted with AES-256-GCM using `DELIVERY_ENCRYPTION_KEY`. Webhook requests include:

- `X-AgenticBro-Delivery`: stable delivery job UUID.
- `X-AgenticBro-Event`: event type.
- `X-AgenticBro-Timestamp`: Unix timestamp.
- `X-AgenticBro-Signature`: `v1=HMAC_SHA256(secret, timestamp + "." + rawBody)`.

Reject timestamps older than five minutes and compare signatures in constant time. Consumers must treat the delivery UUID as an idempotency key.

Slack destinations must be incoming webhook URLs under `https://hooks.slack.com/services/`.

## Retry And Dead Letters

The local delivery worker leases queued jobs and uses exponential backoff beginning at 30 seconds, capped at six hours, with jitter. Each HTTP attempt records latency, response code, error, and a bounded response excerpt. After eight failed attempts the job moves to `dead_letter` and creates a `brand_guard_delivery_dead_letters` record.

Customers can inspect `/api/brand-guard/delivery/monitoring` and replay with:

```bash
curl -X POST https://agenticbro.app/api/brand-guard/delivery/dead-letters/replay \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dead_letter_id":"UUID"}'
```

Administrators use the Operations tab or `/api/brand-guard/admin/delivery-monitoring`.

## Enterprise Reports

Fortress customers receive weekly briefings every Monday at 13:00 UTC. Reports measure scan completion, threats, impersonators, takedown outcomes, delivery success and latency, dead letters, and account-manager cases.

- `GET /api/brand-guard/enterprise/reports`
- `POST /api/brand-guard/enterprise/reports`
- `GET /api/brand-guard/enterprise/briefings`
- `GET /api/brand-guard/enterprise/sla`

Weekly briefings and SLA reports are delivered to customer endpoints that subscribe to `weekly_briefing` or `sla_report`.

## Account Managers

Fortress customers use `GET /api/brand-guard/enterprise/account-manager` and `POST /api/brand-guard/enterprise/cases`. Administrators create managers, assign accounts, and update case state through the Brand Guard admin API. Every customer or manager action is appended to `brand_guard_account_case_events`.
