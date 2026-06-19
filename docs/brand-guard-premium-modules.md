# Brand Guard Premium Modules

This implementation maps the premium handoff onto the platform's existing Node.js and Supabase durable-worker architecture. Redis/Celery is intentionally not introduced as a second queue system.

## Components

- `domain-watcher-worker`: claims active brands with `FOR UPDATE SKIP LOCKED`, generates bounded lookalikes, observes A/MX state, and emits threats only on DNS transitions.
- `dmarc-ingest`: authenticated inbound provider endpoint accepting a recipient token, filename, and base64 attachment. ZIP/GZIP metadata is checked before decompression; extracted XML is capped at 10 MB.
- `takedown-worker`: existing provider gateway with exponential retries. Automatic dispatch now requires 99% calculated confidence and no missing evidence fields; all other requests enter admin review.
- `threat-intel-dispatch-worker`: sends jobs to a separately deployed HTTPS runner. It never launches Playwright or navigates untrusted targets in the primary API process.

## Inbound DMARC Contract

`POST /api/brand-guard/dmarc-ingest`

```json
{
  "token": "brand-specific-rua-token",
  "filename": "google.com!example.com!report.xml.gz",
  "content_base64": "..."
}
```

Use `Authorization: Bearer $DMARC_INBOUND_SECRET`. The inbound mail provider is responsible for extracting the attachment from multipart email and forwarding it in this bounded contract.

## Isolated Runner Contract

The runner must expose `POST /v1/analyze` over HTTPS and enforce:

- ephemeral container per job;
- read-only filesystem and non-root user;
- no cloud metadata or private-network access;
- 90-second wall timeout and 5 MB response cap;
- browser concurrency bounded independently from the API worker;
- screenshot/script artifacts stored outside the API host;
- returned `fingerprint` and redacted `exfil_endpoints` only. Never return captured secrets or live Telegram bot tokens.

## Production Activation

1. Apply migration `20260619000005_premium_threat_intelligence.sql`.
2. Configure the new environment variables from `.env.example`.
3. Deploy the persistent Node worker separately from Vercel serverless functions.
4. Configure the inbound mail provider to forward DMARC attachments.
5. Deploy and security-review the isolated runner before setting `THREAT_INTEL_RUNNER_URL`.
6. Run `npm run test:premium` and the normal production build.

Do not enable automated takedown dispatch until the provider gateway is configured and the administrator review queue has been exercised in staging.
