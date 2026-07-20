# OpenAI Cybersecurity Grant Program — Application Response

## Agentic Bro: AI-Powered Scam Detection Protecting Cryptocurrency Investors

---

### Who We Are

**Agentic Bro** is an open-source, AI-powered scam detection system built to protect cryptocurrency investors — particularly on the Solana blockchain — from social media fraud, impersonation scams, and phishing attacks. Our team is led by a solo developer with deep expertise in blockchain security and AI agent development, operating a live product that has already scanned hundreds of accounts across X/Twitter, Instagram, TikTok, Facebook, and Telegram.

Our project token, $AGNTCBRO, serves as both a community coordination mechanism and a public commitment to transparency. The core scam detection engine is designed for maximum public benefit and open distribution.

---

### What We Plan To Do

We propose expanding Agentic Bro into a **multi-platform, real-time AI scam defense system** that uses LLMs to detect, score, and warn users about fraudulent crypto accounts and schemes before they lose funds.

**Specifically, the grant will fund:**

1. **Enhanced LLM-based scam detection pipeline** — Refine our 90-point unified risk scoring system using OpenAI models to analyze profile metadata, post content, behavioral patterns, and cross-platform signals in real time. Current detection uses rule-based heuristics; we will layer in LLM-based reasoning to catch nuanced scams (e.g., AI-generated impersonation accounts, sophisticated phishing lures, coordinated inauthentic behavior).

2. **Cross-platform scam correlation engine** — Build an AI system that tracks the same scammer across X, Instagram, TikTok, Facebook, and Telegram, correlating behavioral signals to identify coordinated fraud networks rather than individual bad actors.

3. **Real-time agent-based defense** — Deploy autonomous AI agents that monitor social platforms, identify emerging scam patterns, and proactively alert at-risk users. This directly aligns with OpenAI's priority area of **agentic security** — building defensive AI agents that protect people.

4. **Open dataset of cryptocurrency scam signatures** — Create and publish a structured, labeled dataset of social media scam patterns, red flag indicators, and risk scoring ground truth. This dataset will be freely available to researchers, developers, and the cybersecurity community.

---

### When and Where

**Timeline:** 6 months (July 2026 – December 2026)

| Phase | Period | Deliverable |
|-------|--------|-------------|
| Phase 1 | Jul–Aug 2026 | Enhanced LLM scoring pipeline integrated with OpenAI API |
| Phase 2 | Sep–Oct 2026 | Cross-platform correlation engine operational |
| Phase 3 | Oct–Nov 2026 | Autonomous detection agents deployed in production |
| Phase 4 | Nov–Dec 2026 | Open dataset published; results and methodology shared publicly |

**Location:** Remote — United States

---

### Why It Matters

Cryptocurrency fraud is accelerating dramatically. In 2025, AI-powered crypto scams rose **30% year-over-year** (Binance, 2026), with platforms intercepting over 22.9 million scam attempts in Q1 2026 alone. Social media is the primary attack vector — scammers use fake profiles, coordinated bot networks, and AI-generated content to deceive investors on X, Instagram, TikTok, and Telegram.

Current defenses are fragmented:
- Platform trust & safety teams are siloed and slow
- Existing crypto scam databases are manual and reactive
- No open-source tool provides **real-time, AI-powered, cross-platform risk scoring**

Agentic Bro fills this gap. We are the only open project providing instant scam risk assessments across multiple social platforms specifically for cryptocurrency fraud.

**Where today's AI models fall short:**
- LLMs lack structured frameworks for evaluating scam probability in crypto contexts — our 90-point scoring system provides the missing evaluation scaffold
- No publicly available training dataset exists for social media crypto scam patterns — we will create and release one
- Current fraud detection is platform-siloed — our cross-platform correlation addresses this directly

---

### AI Models

We will use **OpenAI GPT-4o and GPT-4o-mini** as the primary reasoning engines for:
- Profile content analysis and scam classification
- Behavioral pattern recognition across platforms
- Natural language explanation generation for risk scores
- Agent-based autonomous monitoring and alerting

We will also evaluate **o1/o3** models for complex multi-step reasoning tasks (e.g., cross-platform correlation, network analysis).

Our existing system currently uses open-weight models (GLM, Qwen, Kimi). OpenAI models will significantly improve detection accuracy, especially for nuanced scams involving AI-generated content and sophisticated social engineering.

---

### New Datasets

Yes — we will create and publish:

**"CryptoScam-Signals"**: A structured, labeled dataset of cryptocurrency scam indicators observed across social media platforms, including:
- Profile metadata patterns (creation date, follower ratios, verification status)
- Content red flags (guaranteed returns, giveaway/airdrop language, urgency tactics, DM solicitation)
- Cross-platform correlation labels (same scammer, different platforms)
- Risk score ground truth (human-verified scam/legitimate classifications)
- Behavioral timeline data (account lifecycle patterns of scam accounts)

The dataset will be released under **CC-BY-4.0** on GitHub and Hugging Face, enabling maximum public benefit and research reuse.

---

### How Results Will Be Shared

- **Open source:** All code, detection rules, and scoring methodology published on GitHub (github.com/maadmaax26/agenticbro)
- **Open dataset:** CryptoScam-Signals published on GitHub and Hugging Face under CC-BY-4.0
- **Research paper:** We will publish a methodology paper on arXiv detailing our 90-point scoring framework, LLM integration approach, and cross-platform correlation technique
- **Public API:** The scam detection API (agenticbro.app/api/social-scan) will remain free and open for non-commercial use
- **Community engagement:** Regular progress updates via our community channels, including technical blog posts on scam pattern discoveries
- **Collaboration:** We are eager to share findings early and connect with other OpenAI grant recipients working on fraud prevention

---

### Budget

We are requesting **$30,000** in total funding, allocated as follows:

| Category | $10K Tier | $20K Tier | $30K Tier |
|----------|-----------|-----------|-----------|
| OpenAI API credits | $5,000 | $10,000 | $15,000 |
| Compute infrastructure (hosting, monitoring, data pipeline) | $2,000 | $4,000 | $6,000 |
| Dataset creation & human verification labeling | $1,500 | $3,000 | $4,000 |
| Research paper & publication costs | $500 | $1,000 | $2,000 |
| Community operations (anti-scam tool free tier) | $1,000 | $2,000 | $3,000 |

**With $10K:** We can enhance our existing LLM pipeline with OpenAI models and begin dataset collection.

**With $20K:** We add cross-platform correlation capabilities and begin human-verified labeling.

**With $30K:** We complete the full scope — autonomous agents, published dataset, research paper, and sustained free public access.

We are flexible on the mix of API credits vs. direct funding and happy to discuss what works best for OpenAI.

---

### Why Our Team

Our team has been building and operating Agentic Bro as a live product since early 2025. We have:
- A **working scam detection system** already protecting real users on Solana
- A **90-point unified risk scoring framework** refined through hundreds of real-world scans
- A **scammer database** with 278+ entries and growing
- A **live website** (agenticbro.app) with a functional public API
- Active community engagement and trust within the Solana ecosystem

We are not starting from zero. This grant accelerates and amplifies work that is already live and protecting people.

---

### Public Benefit & Licensing

All grant-funded work will be licensed for **maximum public benefit**:
- Code: **MIT License** (open source, permissive)
- Dataset: **CC-BY-4.0** (free to use with attribution)
- Research: Published on **arXiv** (open access)
- API: Free for non-commercial use

We believe scam detection should be a public good, not a paywall. This project is defensive cybersecurity only — no offensive capabilities will be developed.

---

*Agentic Bro — Scan first, trust later. 🔐*