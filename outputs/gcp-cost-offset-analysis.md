# GCP Services That Offset API Costs & Remove Throttles — AgenticBro Architecture Mapping

## Current Bottlenecks (from architecture diagram + stack)

| Bottleneck | Current State | Impact |
|---|---|---|
| **Cloud LLM rate limits** | Claude + GLM-5 on free/shared tiers | Scan throughput capped, complex investigations throttled |
| **Single inference node** | Mac Studio 36GB VRAM, Ollama/Qwen3 | Single point of failure, ~6.8GB VRAM per model, can't scale parallel scans |
| **Static orchestration** | OpenClaw routing is fixed, no adaptive failover | If cloud API throttles hit, scans queue or fail |
| **Chrome CDP single instance** | Port 18801, one browser | Social scans serialize, can't run batch Brand Guard checks in parallel |
| **Supabase free tier** | DB + storage on free tier | Row limits, storage caps, API rate limits on scan history |
| **Redis free tier** | Caching on free/small instance | Cache evictions under load, repeated LLM calls for same scan |

---

## GCP Services That Directly Solve Each Bottleneck

### 1. Vertex AI (Gemini API) — Replaces throttled cloud LLM calls
**Solves:** Cloud LLM rate limits on Claude/GLM-5 free tiers

- **Gemini 1.5 Flash/Pro via Vertex AI** gives you a cloud LLM with higher rate limits than the free Gemini API
- Google for Startups credits cover Vertex AI API calls
- Your architecture already has a swappable model layer (hybrid cloud/local routing) — point it at Vertex AI instead of Claude free tier
- **Cost offset:** Every scan that currently hits Claude/GLM-5 free tier limits shifts to Gemini credits. No code refactor needed — just add a provider endpoint
- **Rate limit lift:** Vertex AI has per-project quotas (default 60 QPM for Gemini 1.5 Flash) vs free API's 15 RPM — 4x throughput minimum

### 2. Compute Engine (GPU instances) — Second inference node
**Solves:** Single-point-of-failure on Mac Studio, can't scale parallel scans

- **T4 GPU instances** (~$0.35/hr preemptible) run Qwen3 9B comfortably (needs ~8GB VRAM)
- Credits cover the hourly cost. One T4 node = redundant inference, doubles scan throughput
- **Adaptive routing becomes real:** OpenClaw routes to local Mac Studio first, falls back to GCP GPU node when local is saturated
- **Removes throttle:** Currently if Mac Studio is running a Brand Guard batch scan, individual user scans queue. Second node eliminates that bottleneck

### 3. Cloud Run — Scalable scan workers
**Solves:** Scan workers serialize on single machine, Chrome CDP single instance

- Containerize the scan workers (brand-guard-scan-worker, x-scan-worker) as Cloud Run services
- **Auto-scales to zero** when no scans pending — costs nothing at idle
- Each Cloud Run instance gets its own Chrome CDP browser — run 10 parallel social scans instead of 1
- **Removes throttle:** Brand Guard batch scans for 20+ prospects run in parallel instead of serial
- Credits cover container execution time (you only pay per-request, not per-hour)

### 4. BigQuery — Trust intelligence analytics
**Solves:** Supabase free tier storage caps on scan history, no analytics layer

- Stream scan results from Supabase → BigQuery via scheduled queries or Data Transfer
- Run aggregate trust intelligence queries (trending scam patterns, brand impersonation rates by industry) without touching operational DB
- **Removes throttle:** Supabase stays fast for real-time scan writes, BigQuery handles analytics load
- Credits cover storage + query costs (very cheap — $0.02/GB stored, $5/TB queried)

### 5. Cloud Storage — Evidence records
**Solves:** Supabase storage limits for scan evidence (screenshots, HTML snapshots, PDF reports)

- Brand Guard scans generate evidence files (screenshots of impersonator profiles, cached phishing pages)
- Move evidence storage from Supabase Storage to Cloud Storage (Nearline/Coldline)
- **Nearline:** $0.010/GB/month (30-day access) — perfect for evidence that's rarely accessed but must be retained
- **Removes throttle:** No more Supabase storage quota pressure, evidence retained indefinitely for takedown workflows

### 6. Cloud Tasks + Pub/Sub — Adaptive orchestration backbone
**Solves:** Static OpenClaw routing, no queue-based failover

- Replace cron-polling pattern (brand-guard-scan-worker polls Supabase every 15s) with Cloud Tasks
- Website API writes scan request → Pub/Sub topic → Cloud Run worker picks it up instantly
- **Adaptive routing:** If Cloud Run scan worker fails, Pub/Sub retries with exponential backoff — no manual retry logic
- **Removes throttle:** Eliminates the 15s poll latency, scans start immediately on submission
- Credits cover Pub/Sub (first 10GB/month free anyway) + Cloud Tasks (first 1M/month free)

### 7. Secret Manager — API key rotation
**Solves:** Hardcoded tokens in scripts, .env files on disk

- Store Telegram bot token, Supabase keys, Stripe keys in Secret Manager instead of macOS Keychain + .env
- Cloud Run workers pull secrets at startup — no more scripts that fail because they can't access Keychain
- **Removes throttle:** Cron jobs running in isolated sessions can auth without the token retrieval failures we saw today

---

## Priority Order (what to migrate first with credits)

| Priority | Service | Why first | Credits needed (est. monthly) |
|---|---|---|---|
| 1 | **Vertex AI (Gemini)** | Immediate rate limit relief for all cloud LLM scans | $200–400 |
| 2 | **Cloud Run (scan workers)** | Parallelize Brand Guard batch scans, removes Chrome CDP bottleneck | $50–150 |
| 3 | **Compute Engine (T4 GPU)** | Redundant inference node, enables adaptive routing | $100–250 (preemptible) |
| 4 | **Cloud Storage** | Evidence retention, frees Supabase storage | $10–30 |
| 5 | **BigQuery** | Analytics layer, trend detection across scans | $20–50 |
| 6 | **Pub/Sub + Cloud Tasks** | Replace polling with event-driven architecture | $5–15 |

**Estimated total:** $400–900/month during build-out phase. Start tier credits (~$2K) cover ~2–5 months of usage while Brand Guard revenue scales to cover the gap.

---

## What This Does NOT Solve

- **Anthropic Claude free tier limits** — GCP credits won't give you Claude credits. But Vertex AI/Gemini can replace Claude as the cloud LLM provider if you're willing to switch (your model layer is already swappable)
- **Supabase free tier row limits** — GCP doesn't replace Supabase. You'd need Supabase Pro ($25/mo) for that. But moving storage + analytics to GCP reduces the Supabase footprint
- **Chrome CDP complexity** — Cloud Run containers need headless Chrome configured. Doable but requires Docker setup work

---

## What to Tell Rehan (Google Cloud BD)

This mapping directly answers his questions:
- **Areas of Interest:** Vertex AI (Gemini), Cloud Run, Compute Engine (GPU), Cloud Storage, BigQuery, Pub/Sub
- **Business Objectives:** Remove API throttles, add redundant inference, scale scan workers, enable analytics
- **Budget:** $400–900/month → falls in the "$10,000 – $20,000" annual range he mentioned
- **Timeline:** Vertex AI + Cloud Run first (2–4 weeks), Compute Engine GPU second (4–8 weeks)