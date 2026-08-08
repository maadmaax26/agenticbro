# Brand Guard Integrations & Automation

Brand Guard currently supports Slack delivery and signed webhook integrations for alert and monitoring events.

Customer-facing REST API access and programmatic scan submission are not live subscription features. Internal Brand Guard backend APIs still power the website and workers, but they are not a customer API product.

## Availability

| Feature | Minimum plan |
| --- | --- |
| Dashboard scans and alerts | Free |
| Takedown templates | Guardian |
| Webhook Integrations | Sentinel |
| Slack alert delivery | Sentinel |
| Custom reports | Sentinel |
| SLA reports, weekly briefings, account manager | Fortress |

## Webhook Integrations

Webhook Integrations send Brand Guard alerts and monitoring events to existing security, automation, ticketing, or operational workflows.

Create a delivery endpoint with an authenticated customer session:

```bash
curl -X POST https://agenticbro.app/api/brand-guard/delivery \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Security Operations",
    "channel":"webhook",
    "url":"https://security.example.com/hooks/brand-guard",
    "event_types":["alert"],
    "minimum_severity":"medium"
  }'
```

Slack delivery uses the same endpoint with `"channel":"slack"` and a Slack incoming webhook URL under `https://hooks.slack.com/services/`.

## Events Currently Generated

The current database trigger enqueues delivery jobs when a `brand_guard_alerts` row is created and the endpoint is subscribed to `alert`.

Supported endpoint event types:

- `alert`
- `weekly_briefing`
- `sla_report`
- `test`

`weekly_briefing` and `sla_report` are available for Fortress enterprise reporting flows.

## Signing

Webhook destinations receive signed requests. The signing secret is returned once when the endpoint is created.

Delivery headers:

- `X-AgenticBro-Delivery`: delivery job UUID.
- `X-AgenticBro-Event`: event type.
- `X-AgenticBro-Timestamp`: Unix timestamp.
- `X-AgenticBro-Signature`: `v1=HMAC_SHA256(secret, timestamp + "." + rawBody)`.

Consumers should reject timestamps older than five minutes, compare signatures in constant time, and treat the delivery UUID as an idempotency key.

## Retry And Dead Letters

The local delivery worker leases queued jobs and retries with exponential backoff beginning at 30 seconds, capped at six hours, with jitter.

Each attempt records latency, response code, error, and a bounded response excerpt. After eight failed attempts, the job moves to `dead_letter` and creates a `brand_guard_delivery_dead_letters` record.

Customers can inspect delivery health:

```bash
curl https://agenticbro.app/api/brand-guard/delivery/monitoring \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

Customers can replay an unresolved dead letter:

```bash
curl -X POST https://agenticbro.app/api/brand-guard/delivery/dead-letters/replay \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dead_letter_id":"UUID"}'
```

## Entitlement

Delivery endpoints are protected by the `customer_delivery` entitlement. Plans below Sentinel cannot create or manage paid delivery endpoints.

