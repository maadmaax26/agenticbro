📊 Agentic Bro Profile Verifier — Technical Deep Dive

For the technical community. Here's how we built it.

---

## Architecture

```
User Request → Local Router → Agentic Bro → Profile Verifier
(free, 80%)  (delegates)    (cloud, 20%)  (API calls)
     ↓              ↓             ↓              ↓
  Telegram    granite4:3b   glm-4.7:cloud   Chrome CDP
  Webchat      (local)      (API)          (X profiles)
```

**Cost Optimization:** 85% reduction in API usage by routing simple queries to local model (granite4:3b) and only using cloud API for complex tasks (scans, investigations).

---

## Tech Stack

**Backend:**
- Node.js 25+
- TypeScript 5.3
- Express 4.18
- Jest 29.7 (testing)

**Scraping:**
- Chrome CDP (DevTools Protocol)
- Puppeteer 24.40
- WebSocket extraction

**Data:**
- PostgreSQL (user database)
- Redis (caching)
- CSV (scammer database)

**AI Models:**
- glm-4.7:cloud (scam detection)
- granite4:3b (routing, simple queries)
- Deepfake detection (AI-generated photos)

---

## Chrome CDP Integration

**Why CDP?**
- No API keys needed for X profiles
- Real-time data extraction
- Confirmed verification status
- 95%+ success rate

**How It Works:**
1. Connect to Chrome on port 18800
2. Find page with X profile URL
3. Execute extraction script via WebSocket
4. Return structured JSON data

**Extraction:**
- Username, display name
- Verified status (blue checkmark)
- Followers, following, posts
- Bio, location, website
- Profile image
- Join date

---

## Context-Aware Scoring

**6 Contexts:**

| Context | Verification | Bot | Deepfake | Impersonation | Activity |
|---------|--------------|-----|----------|---------------|----------|
| Crypto | 30% | 25% | 20% | 15% | 10% |
| Romance | 10% | 10% | 35% | 30% | 15% |
| Employment | 20% | 15% | 15% | 20% | 30% |
| Marketplace | 15% | 25% | 20% | 15% | 25% |
| Financial | 40% | 20% | 15% | 15% | 10% |
| General | 25% | 25% | 20% | 15% | 15% |

**Formula:** Weighted sum of category scores

---

## Scam Detection Signals

**90+ signals across 5 categories:**

1. **Verification (30 pts)**
   - Blue checkmark
   - Account age (> 1 year = safe)
   - Verified since date
   - ID verification

2. **Bot Detection (25 pts)**
   - Mass following (following >> followers)
   - Suspicious engagement rate (> 10%)
   - Automated posting patterns

3. **Deepfake (20 pts)**
   - AI-generated photo probability
   - Image analysis via AI model
   - Profile image consistency

4. **Impersonation (15 pts)**
   - Username patterns (_giveaway, _official, _real)
   - Bio keywords (airdrop, giveaway, free)
   - Display name mimics real accounts

5. **Activity (10 pts)**
   - Posting frequency
   - Growth pattern
   - Last active timestamp

---

## Test Coverage

**85 tests passing:**
- Scoring tests: 37/37 ✅
- Scam detection tests: 48/48 ✅

**Scam types tested:**
- Crypto scams (giveaway, rug pull, wallet drainer, pig butchering)
- Romance scams (military doctor, oil rig engineer)
- Job offer scams ($500/day, passive income)
- Tech support, government, bank impersonation
- Fake charity, celebrity endorsement
- Rental, marketplace fraud
- Deepfake detection
- Bot detection
- Known scammer database

---

## API Endpoints

**Base URL:** http://localhost:8080

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1` | API info |
| POST | `/api/v1/verify/profile` | Verify profile |
| POST | `/api/v1/scan/token` | Scan token |

**Request Example:**
```json
{
  "platform": "twitter",
  "username": "elonmusk_giveaway",
  "verificationContext": "crypto",
  "options": {
    "deepScan": false,
    "includeMedia": false
  }
}
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "authenticityScore": 25,
    "riskLevel": "UNSAFE",
    "recommendation": "❌ AVOID - Multiple scam indicators",
    "plainLanguageSummary": "..."
  }
}
```

---

## Open Source

**GitHub:** github.com/agenticbro/profile-verifier (coming soon)

**Contributions Welcome:**
- Add new scam patterns
- Improve deepfake detection
- Add platform support (Telegram, Discord, Facebook)

---

**Tech Stack Summary:**
Node.js, TypeScript, Express, Jest, Chrome CDP, Puppeteer, PostgreSQL, Redis, glm-4.7:cloud, granite4:3b

Scan first, ape later! 🔐

$AGNTCBRO | 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump

#AgenticBro #AGNTCBRO #Solana #DevCommunity #AI #ScamDetection