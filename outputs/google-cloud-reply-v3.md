Hi Rehan,

Thanks for the quick response — excited to move forward. Here are the details:

**Areas of Interest:**
We're building a hybrid AI trust intelligence platform (agenticbro.app) that runs local LLM inference on a single Mac Studio node plus cloud LLM calls for complex scans. We're currently paying for Claude (Anthropic) and OpenAI API subscriptions, but we hit weekly usage limits on both providers that force us to manually switch between them — creating scan throughput bottlenecks and degraded user experience. The Google Cloud products that directly solve this are:

1. **Vertex AI (Gemini API)** — Add Gemini as a third LLM provider in our hybrid routing layer, eliminating the weekly usage limit whack-a-mole between Claude and OpenAI. Our model layer is already swappable (we route between local Ollama/Qwen3 and cloud providers) — adding Vertex AI is a config change, not a refactor. This gives us 3 independent cloud providers with separate rate limit pools, so when one hits its weekly cap, traffic auto-shifts to the others.
2. **Cloud Run** — Containerize our scan workers (currently serialized on one machine with a single Chrome CDP browser instance). Cloud Run auto-scales to zero at idle and gives each instance its own browser, enabling parallel Brand Guard batch scans.
3. **Compute Engine (T4 GPU instances)** — Add a redundant inference node running Qwen3 9B locally. Currently a single Mac Studio is a single point of failure. A preemptible T4 node gives us a second local inference endpoint with its own capacity pool.
4. **Cloud Storage (Nearline)** — Evidence records (screenshots, cached phishing pages, PDF reports) currently hit Supabase storage quotas. Move to Cloud Storage at $0.010/GB/month.
5. **BigQuery** — Trust intelligence analytics across scan history (trending scam patterns, impersonation rates by industry). Offloads query load from our operational Postgres.
6. **Pub/Sub + Cloud Tasks** — Replace our cron-polling pattern (workers poll Supabase every 15 seconds) with event-driven architecture. Scans start instantly on submission.

**Business Objectives:**
- Eliminate weekly LLM usage limit throttles by adding a third cloud provider (Vertex AI/Gemini) with its own rate limit pool
- Add a redundant inference node (eliminate single-point-of-failure on Mac Studio)
- Parallelize Brand Guard batch scans (currently serialized, 1 at a time)
- Enable trust intelligence analytics on scan data across 7 surfaces (social, domain, email spoof, website, phone, wallet/token, cross-channel)
- Migrate from polling to event-driven architecture for real-time scan processing

**Budgetary Considerations:**
We're currently spending ~$200–400/month on Claude and OpenAI API subscriptions alone, plus ~$50–100/month on basic infrastructure (Supabase, Redis, domain). The LLM spend is the primary cost, and it's capped by weekly usage limits — we can't spend more even when scan demand requires it. With Google Cloud, estimated total spend is $500–1,000/month during the build-out phase (first 6–12 months), but this REPLACES our current Claude/OpenAI spend rather than adding to it. That puts anticipated annual cloud spend in the $10,000–$20,000 range. We're applying at the Start tier (~$2K credits), which covers approximately 2–4 months of Vertex AI + Cloud Run usage while we build paying customer base.

**Current Funding Stage:**
None (bootstrapped). No external funding raised. Revenue through Brand Guard SaaS subscriptions (Stripe, live). Seeking non-dilutive cloud credits to offset existing LLM API costs and extend runway.

**Timeline:**
Ready to implement immediately upon credit approval:
- Weeks 1–4: Vertex AI integration (add Gemini as third LLM provider, enable adaptive routing across Claude/OpenAI/Gemini)
- Weeks 4–8: Cloud Run containerization of scan workers, Compute Engine GPU node setup
- Weeks 8–12: BigQuery analytics layer, Pub/Sub event-driven migration, Cloud Storage evidence pipeline

**Company Information:**
- Company Name: Agentic Insights LLC
- Billing Address: 155 Willowbrook Blvd, Ste 110 #8469, Wayne, New Jersey 07470
- Domain: agenticbro.app
- Contact: agenticbro@agenticbro.app
- Website: https://agenticbro.app
- Repo: github.com/maadmaax26/agenticbro

Happy to jump on a call to walk through the architecture in more detail — just let me know.

Best regards,
Earl Finney
Founder, Agentic Insights LLC