Hi Rehan,

Thanks for the quick response — excited to move forward. Here are the details:

**Areas of Interest:**
We're building a hybrid AI trust intelligence platform (agenticbro.app) that uses a hybrid LLM architecture: local inference (Ollama/Qwen3 on a Mac Studio) for routine scans, and cloud LLMs (Claude, OpenAI) for complex development, coding, and deep investigation workloads. We're currently paying for Claude, OpenAI, and Ollama subscriptions, but the Claude and OpenAI tiers we're on are development-tier plans with weekly usage limits that we hit regularly. The next tier up on both providers is prohibitively expensive for a bootstrapped solo founder — we can't justify $200+ per provider per month for production-scale API access. We're stuck in a gap: paying for subscriptions that cap out before covering our actual workload.

The Google Cloud products that directly solve this are:

1. **Vertex AI (Gemini API)** — Add Gemini as a third cloud LLM provider with its own rate limit pool. Our model layer is already swappable (we route between local Ollama and cloud providers via OpenClaw orchestration). Adding Vertex AI gives us three independent cloud providers, so when Claude or OpenAI hits weekly caps, traffic auto-shifts to Gemini instead of stalling. This eliminates the manual provider-switching we currently do.
2. **Cloud Run** — Containerize our scan workers (currently serialized on one machine with a single Chrome CDP browser instance). Cloud Run auto-scales to zero at idle and gives each instance its own browser, enabling parallel Brand Guard batch scans.
3. **Compute Engine (T4 GPU instances)** — Add a redundant inference node running Qwen3 locally. Currently a single Mac Studio is a single point of failure. A preemptible T4 node gives us a second inference endpoint with its own capacity.
4. **Cloud Storage (Nearline)** — Evidence records (screenshots, cached phishing pages, PDF reports) currently hit Supabase storage quotas. Move to Cloud Storage at $0.010/GB/month.
5. **BigQuery** — Trust intelligence analytics across scan history (trending scam patterns, impersonation rates by industry). Offloads query load from our operational Postgres.
6. **Pub/Sub + Cloud Tasks** — Replace our cron-polling pattern (workers poll every 15 seconds) with event-driven architecture. Scans start instantly on submission.

**Business Objectives:**
- Eliminate weekly LLM usage limit throttles by adding Vertex AI/Gemini as a third provider with independent rate limits
- Offset existing Claude/OpenAI subscription costs with GCP credits (credits replace spend, not add to it)
- Add a redundant inference node (eliminate single-point-of-failure on Mac Studio)
- Parallelize Brand Guard batch scans (currently serialized, 1 at a time)
- Enable trust intelligence analytics on scan data across 7 surfaces (social, domain, email spoof, website, phone, wallet/token, cross-channel)

**Budgetary Considerations:**
We're currently spending ~$300–500/month across Claude, OpenAI, and Ollama subscriptions — and that spend is capped by weekly usage limits on the development tiers. The production tiers on Claude and OpenAI would cost $200+/month per provider, which is out of reach for a bootstrapped founder. With Google Cloud credits, estimated total cloud spend is $500–1,000/month, but this REPLACES our existing Claude/OpenAI subscription spend rather than adding to it. Anticipated annual cloud spend falls in the $10,000–$20,000 range. We're applying at the Start tier (~$2K credits), which covers approximately 2–4 months of Vertex AI + Cloud Run usage while we build paying Brand Guard customer base to sustain the cost.

**Current Funding Stage:**
None (bootstrapped). No external funding raised. Revenue through Brand Guard SaaS subscriptions (Stripe, live). Seeking non-dilutive cloud credits to offset existing LLM API costs and break through the usage tier gap.

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