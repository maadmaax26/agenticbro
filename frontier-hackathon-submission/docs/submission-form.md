# Colosseum Frontier Hackathon — Submission Form

**Deadline:** May 11, 2026 (Tomorrow)
**Registration:** https://colosseum.com/frontier

---

## Project Information

### Project Name
**Agentic Bro — Wallet Protection**

### One-Sentence Description
Decode Solana transactions before you sign them — AI-powered risk scoring that catches wallet drainers, hidden fees, and Token-2022 exploits in real-time.

### Detailed Description (max 500 words)

Agentic Bro is a live security ecosystem protecting Solana users from scams. Our Wallet Protection module decodes and scores transactions BEFORE users sign them — preventing losses instead of recovering from them.

**The Problem:** $2.3 billion lost to crypto scams in 2024. The #1 attack vector isn't smart contract exploits — it's users signing transactions they don't understand. Wallet drainers hide in plain sight, Token-2022 tokens embed malicious authorities, and fake dApps phish signatures every day.

**Our Solution:** 

1. **Transaction Decoder** — Paste any Solana transaction and see every instruction in plain language. System transfers, SPL tokens, Token-2022 extensions, Metaplex, Jupiter swaps — all decoded into human-readable steps with exact token amounts, destination addresses, and fees.

2. **Risk Scoring Engine** — 90-point unified scoring detects wallet drainers (25pts), permanent delegate exploits (15pts), hidden transfer fees (10pts), and urgency tactics (10pts). Real-time analysis using Helius RPC + local LLM inference.

3. **Website Scanner** — Enter any URL before connecting your wallet. Detects wallet drainer scripts, phishing patterns, fake airdrops, and cross-references regulatory warnings (FCA, SEC).

4. **Profile Scanner** — Check X/Instagram/TikTok/Telegram usernames for scam indicators. AI-powered behavioral analysis with 278+ verified scammer entries.

5. **Token Impersonation Detector** — Catches fake tokens with identical names/logos to real projects. Unique to Solana's Token-2022 ecosystem.

**Tech Stack:** TypeScript, React, Supabase, Helius RPC, Ollama (local inference), Chrome CDP.

**Traction:** Live product at agenticbro.app. 280+ community members. 278+ verified scammers in database. 5,000+ scans completed across platforms.

**Public Good:** 5 free scans/month for anyone. Open-source under MIT. Educational content daily. Scammer database API public and rate-limited.

---

## Team

### Team Members
- **Madmax (@maadmaax22)** — Founder, Solana developer, security researcher
- **Jeeevs (AI Agent)** — On-chain security analyst, community protection

### Team Background
Madmax: Solana developer since 2023. Built transaction analysis engine from scratch. Catalogued 278+ verified scammers. Active in Solana security community. Previously shipped multiple Solana dApps.

### Team Size
2 (1 human founder + AI agent co-founder)

---

## Track Selection

**Primary Track:** Infrastructure
**Why:** Transaction decoding, risk scoring, and wallet protection are core infrastructure for Solana user safety.

**Secondary Track:** AI
**Why:** AI-powered behavioral analysis for profile scanning and transaction pattern recognition.

---

## Links

| Resource | URL |
|----------|-----|
| Live Demo | https://agenticbro.app |
| GitHub Repo | (Add after making public) |
| Demo Video | (Add after recording) |
| Telegram Community | @AGNTCBRO |
| Token Contract | 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump |
| Website | https://agenticbro.app |

---

## Additional Questions (Common on Colosseum)

### How long have you been working on this?
6 months. Live product with real users for 4 months.

### What stage is your project?
Production — live at agenticbro.app with active users and community.

### What's your biggest challenge?
Scaling infrastructure — currently on free tiers for several APIs. Rate limits impact user experience during high-traffic periods.

### What do you need help with?
- Infrastructure scaling (paid API tiers)
- Security audit (third-party review)
- Mobile SDK development (React Native)
- Browser extension distribution

### Why Solana?
Solana's Token-2022 standard introduced new attack vectors (permanent delegate, transfer fees) that no other chain has. We're the first to build detection for these exploits. Solana's speed and low costs make real-time scanning feasible.

### What's your go-to-market strategy?
- Community-first: 280+ members in Telegram, daily engagement
- Free tier: 5 scans/month for anyone (acquisition)
- Holder-gated: Premium features for $AGNTCBRO holders (retention)
- API access: Developer integrations for wallets and dApps (B2B)

### Revenue Model
- Premium API access for developers
- Holder-gated advanced features
- Enterprise security audits
- Community reporting bounties

### What makes you different?
- Pre-sign protection (not post-incident)
- Token-2022 exploit detection (first-of-kind)
- Multi-platform scanning (X/IG/TikTok/FB/Telegram)
- Local inference option (privacy-preserving)
- Real users, not a prototype

### What's the biggest risk?
API rate limits on free tiers. If we get a traffic spike from hackathon visibility, users may hit limits. We need funding to upgrade to paid API tiers.

### What's next?
- Browser extension (Chrome) — Month 1
- Mobile SDK (React Native) — Month 2
- Security audit — Month 3
- Full open-source release

---

## Submission Checklist

- [ ] Register on colosseum.com/frontier
- [ ] Create public GitHub repo
- [ ] Record demo video (2-3 min)
- [ ] Upload demo video to YouTube/Vimeo
- [ ] Fill out submission form
- [ ] Add all links (demo, repo, video)
- [ ] Submit before May 11 deadline

---

## Post-Submission

- Share on X/Telegram
- Tag @colosseumorg
- Tag @solana
- Use hashtags: #FrontierHackathon #Solana #AgenticBro

---

**Scan first, trust later. 🔐**
