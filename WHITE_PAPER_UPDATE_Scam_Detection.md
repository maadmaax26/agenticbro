# Agentic Bro White Paper Update v2.0
## Scam Detection System · Gem Advisor · Priority Scan

---

## Executive Summary

Agentic Bro v2.0 introduces three major security and analytical enhancements:

1. **Scam Detection System** — AI-powered scam risk assessment for X (Twitter) and Telegram users
2. **Gem Advisor Framework** — Quality-gated alpha channel analysis and recommendation engine
3. **Enhanced Priority Scan** — Multi-mode deep scan with scam detection capabilities

These systems work together to provide users with comprehensive protection against crypto scams and intelligent, data-driven alpha signal recommendations.

---

## Section 1: Scam Detection System

### Overview

The Scam Detection System is an AI-powered tool that analyzes public profiles and posting patterns to assess scam risk for X (Twitter) and Telegram users. It uses a multi-factor risk scoring model to identify potential scammers before you engage or send funds.

### How It Works

**Input:**
- Username (X or Telegram handle)
- Platform selection (X or Telegram)

**Analysis Process:**
1. **Public Profile Data Collection**
   - Bio analysis
   - Follower/following ratios
   - Account age and verification status
   - Posting history and frequency

2. **Red Flag Detection**
   - Guaranteed returns or unrealistic ROI promises
   - Private alpha or early access models (invite-only, whitelist)
   - Urgency tactics (limited spots, act now, expiring soon)
   - No track record, evidence, or performance data
   - Pump-and-dump patterns
   - Influencer conflicts of interest
   - Hidden methodology or black box strategies

3. **Risk Scoring (1-10 Scale)**
   - HIGH RISK (7-10): Scam likely — avoid engagement
   - MEDIUM RISK (4-6): Caution advised — verify before investing
   - LOW RISK (1-3): Generally safe — use standard precautions

4. **Verification Assessment**
   - Unverified → Partially Verified → Verified → Highly Verified

5. **Evidence Collection**
   - Search for victim reports (X, Reddit, Bitcointalk, Google)
   - Identify scam type (Private Alpha, Pump & Dump, Rug Pull, etc.)
   - Compile supporting evidence

**Output:**
- Risk Score (1-10)
- Risk Level (LOW/MEDIUM/HIGH)
- Verification Level
- List of Red Flags
- Evidence Summary
- Recommended Action

### Risk Scoring Formula

**Red Flag Weights:**

HIGH RISK (7-10 points each):
- Guaranteed returns or unrealistic ROI promises
- Private alpha or early access models
- Urgency tactics
- No track record or evidence
- Pump-and-dump patterns
- Influencer conflicts of interest
- Hidden methodology

MEDIUM RISK (4-6 points each):
- Daily signals without context
- VIP tiers with unclear benefits
- No user reviews or community feedback
- Anonymous/unverified teams

LOW RISK (1-3 points each):
- Transparent methodology and track record
- Verified performance history
- Educational focus
- Clear compensation model

**Final Risk Score:** Weighted average of detected red flags

### Real-World Case Study: @raynft_

**Investigation Results:**
- **Risk Score:** 4/10
- **Risk Level:** LOW-MEDIUM
- **Verification Level:** Unverified
- **Analysis:** Verified account (13+ years old, 325K followers), but no public track record as "Alpha Caller." DM outreach offering "free help" could be legitimate or funnel for paid services.
- **Recommendation:** Cautious engagement — verify before paying, never send money without independent verification

### Privacy and Ethics

**Data Collection:**
- Only public information is analyzed
- No private data is accessed
- No private keys, DMs, or sensitive content is read

**Usage:**
- Assessments are for investigation purposes only
- Never accuse without verified evidence
- Always include disclaimers in public alerts

---

## Section 2: Gem Advisor Framework

### Overview

The Gem Advisor Framework is an AI-powered recommendation engine that analyzes crypto alpha channels (Telegram groups, X accounts) and ranks their token calls based on multiple quality metrics. It provides quality-gated recommendations to protect users from low-quality signals and scams.

### How It Works

**Input:**
- Channel name or username
- Telegram group handle or X account

**Analysis Metrics:**
1. **Win Rate** — Percentage of profitable calls
2. **Rug Rate** — Percentage of rugs/scams
3. **Liquidity** — Average liquidity of called tokens
4. **Edge Score** — Composite score (0-1) combining all metrics

**Confidence Tiers:**
- HIGH (edge score > 0.70)
- MEDIUM (edge score > 0.50)
- LOW (edge score ≤ 0.50)

**Edge Score Formula:**
```
edgeScore = (winRate * 0.50) + ((1 - rugRate) * 0.30) + (liquidityScore * 0.20)
```

**Quality Guards:**
- Rug rate threshold: 30% (tokens above this are filtered out)
- Minimum liquidity: $20,000
- Verification required for HIGH confidence

### Filter Modes

- **All:** Show all gems regardless of edge score
- **High:** Only HIGH confidence gems (edge score > 0.70)
- **Medium:** MEDIUM confidence or better (edge score > 0.50)
- **Low:** All gems except low-risk quality filters
- **New Tokens:** Recent deployments with potential upside

### Real-World Analysis

**@Crypto_Rush_Global_Call:**
- **Risk Score:** 8.5/10 HIGH RISK SCAM
- **Type:** Advance fee scam pattern, pump-and-dump likely
- **Findings:** Unrealistic returns (x5-x100), private alpha, urgency tactics, no track record
- **Recommendation:** DO NOT INVEST — High confidence scam

**@CryptoSpaceX04:**
- **Risk Score:** INSUFFICIENT DATA
- **Type:** Moltbook agent with 216K followers
- **Status:** PAUSED — Need actual Telegram channel and performance data

### Output Format

Gem recommendations include:
- Ticker and token name
- Edge Score (0-1)
- Confidence Level (HIGH/MEDIUM/LOW)
- Win Rate (%)
- Rug Rate (%)
- Liquidity ($)
- Source channel
- Recommendation text

---

## Section 3: Enhanced Priority Scan

### Overview

Priority Scan is an on-demand deep scan feature that jumps the queue and returns results in seconds. It now supports 4 scan modes:

1. **Wallet Scan** — Track alpha signals for a specific wallet
2. **Channel Scan** — Deep-scan a Telegram channel for token calls
3. **Token Scan** — Find all calls for a specific token across channels
4. **Scam Detection** — Scan X or Telegram user for scam patterns ⚠️ NEW

### Scan Modes

#### Mode 1: Wallet Scan
- **Input:** Wallet address (Solana or EVM)
- **Output:** Token calls referencing this wallet + on-chain activity
- **Use Case:** Track a wallet's alpha signal performance

#### Mode 2: Channel Scan
- **Input:** Channel name or username
- **Output:**
  - Success rate analysis
  - Win/rug rates
  - Average wins/losses
  - Risk-adjusted returns
  - Recent token calls with edge scoring
- **Use Case:** Evaluate channel quality before following signals

#### Mode 3: Token Scan
- **Input:** Token ticker or contract address
- **Output:** All calls for this token across tracked channels
- **Use Case:** Identify which channels called a specific token

#### Mode 4: Scam Detection (NEW) ⚠️
- **Input:** Username (X or Telegram) + Platform selection
- **Output:** Risk assessment, red flags, evidence
- **Use Case:** Check if a user is a scammer before engaging or investing

### Pricing

| Scan Mode | Cost (AGNTCBRO) | Holder Tier | Whale Tier |
|-----------|------------------|-------------|------------|
| Wallet Scan | 10K | Free | Free |
| Channel Scan | 10K | Free | Free |
| Token Scan | 10K | Free | Free |
| Scam Detection | 5K | Free | Free |
| All Channels | 15K | Free | Free |

**Free Scan Limit:**
- New users: 10 free scans (increased from 3)
- Connected users: Tracks per-wallet free scan count
- Holder/Whale tiers: Unlimited priority scans

### Integration

The Scam Detection mode is seamlessly integrated into the Priority Scan interface:

```tsx
[👛 Wallet] [📡 Channel] [🔍 Token] [🚨 Scam Detection]
```

**Features:**
- Platform toggle (X/Telegram)
- Username input field
- Privacy notice (public data only)
- Expandable result cards with risk analysis
- Color-coded risk scores (red/yellow/green)

---

## Section 4: Security Architecture

### Multi-Layer Protection

**Layer 1: Pre-Engagement**
- Gem Advisor filters low-quality channels
- Risk score analysis before following signals
- Historical performance data

**Layer 2: Real-Time Scanning**
- Priority Scan with scam detection
- Instant risk assessment of new users
- Wallet analysis and on-chain tracking

**Layer 3: Post-Engagement**
- Scammer database for tracking repeat offenders
- Evidence collection for legal action
- Community alerts and warnings

### Privacy-Preserving Analysis

**Data Sources:**
- Public blockchain data (Solscan, Etherscan)
- Public social media profiles (X, Telegram)
- Open web sources (Reddit, Bitcointalk, Google)

**No Private Data Access:**
- No private keys or seed phrases
- No DMs or private communications
- No wallet balances (unless publicly exposed)

**Legal & Ethical:**
- Only public information is analyzed
- Assessments include disclaimers
- Never accuse without verified evidence
- Designed for investigation purposes

---

## Section 5: Technical Implementation

### Cloud Routing Architecture

**Models Used:**
- `glm-4.7:cloud` — Primary reasoning, planning, chat
- `qwen3.5:27b` (local) — Heartbeats, emergency fallback

**Routing Logic:**
- Web searches → Cloud models
- Pattern analysis → Cloud models
- Heartbeats → Local model
- Emergency fallback → Local model

### Backend Services

**Scammer Detection Service:**
- Location: `scammer-detection-service/`
- Components:
  - Twitter collector
  - Wallet analyzer
  - Victim reporter
- APIs: Solscan, Etherscan, Twitter, Reddit

**Gem Advisor Service:**
- Location: `trading-services/`
- Components:
  - Gem advisor (main)
  - Market analysis
  - Asset signal services
  - AI insights
  - Market impact
- API: Alpha channel feeds + DEX data

### Frontend Integration

**Components:**
- `App.tsx` — Main page with Priority Scan
- `PriorityScan.tsx` — Standalone Priority Scan component
- `ScamResultCard.tsx` — Scam detection result display

**State Management:**
- React hooks for UI state
- LocalStorage for scan counts
- API integration for backend services

---

## Section 6: Roadmap and Future Enhancements

### Completed Features (v2.0)
- ✅ Scam Detection System
- ✅ Gem Advisor Framework
- ✅ Enhanced Priority Scan (4 modes)
- ✅ Free scan limit increased to 10
- ✅ Webpage integration

### Planned Enhancements

**v2.1:**
- Automated scam alerts for followed users
- Integration with known scammer databases
- Email notifications on new scam reports

**v2.2:**
- Multi-chain support (Ethereum, BSC, Base)
- NFT scam detection
- DeFi rug pull detection

**v3.0:**
- Machine learning model for scam detection
- Community-powered reputation system
- Advanced whale tracking

---

## Section 7: Conclusion

Agentic Bro v2.0 represents a significant advancement in crypto safety and intelligence:

1. **Scam Detection System** — Protects users from known and emerging scams
2. **Gem Advisor Framework** — Provides quality-gated alpha recommendations
3. **Enhanced Priority Scan** — Multi-mode analysis with instant results

These systems work together to provide users with a comprehensive toolkit for:
- Avoiding scams
- Identifying quality alpha sources
- Making informed trading decisions
- Protecting their assets

The combination of AI-powered analysis, cloud routing, and privacy-preserving data collection makes Agentic Bro a trusted companion for degen traders.

---

**Document Version:** 2.0  
**Last Updated:** March 21, 2026  
**Token:** $AGNTCBRO  
**Platform:** Solana / pump.fun  
**Website:** agenticbro.io

---

Built for degens, by degens. 🤖💸