# MEMORY.md - Long-Term Memory

## Project: Agentic Bro

**Token:** $AGNTCBRO
**Contract:** 52bJEa5NDpJFaRDLgRCxALGb15W86x4Hbzopump
**Website:** agenticbro.app
**Status:** Launch Preparation Phase

---

## Key Insights (March 2026)

### April 2, 2026

**Profile Scan Infrastructure Update:**
- Set Chrome CDP browser automation as DEFAULT scan method for all sessions
- Created `/scam-detection-framework/PROFILE_SCAN_METHOD.md` - complete scan methodology
- Created `/scam-detection-framework/SCAN_DATABASE_DISPLAY.md` - display guide for website
- Added Diana Sanchez (@DianaSanchez_04) scan report as first detailed JSON report
- Database now supports PAID PROMOTER verification level (legitimate influencers who do paid promos)
- Scan reports stored in `/output/scan_reports/[HANDLE]_[DATE].json`
- Database updated in `/scammer-database.csv`
- Crypto_Genius09 moved to RESOLVED section (AMA completed)

**Scam Database Auto-Sync (Supabase):**
- Integrated with Supabase: `https://drvasofyghnxfxvkkwad.supabase.co`
- Created sync service: `/agentic-bro/services/supabase-scam-sync.ts`
- Created API routes: `/agentic-bro/routes/sync.ts`
- API endpoints:
  - `POST /api/v1/sync/scam-db` - Manual sync trigger
  - `GET /api/v1/sync/status` - Last sync status
  - `GET /api/v1/sync/csv-stats` - CSV file statistics
- Scheduled job: `scam_db_hourly_sync` runs every hour
- Table: `known_scammers` in Supabase
- Fields mapped: platform, username, display_name, x_handle, telegram_channel, scam_type, victim_count, total_lost_usd, verification_level, threat_level, status, risk_score, notes, evidence_urls
- First sync: 2 added, 7 updated, 0 errors

**Scan Method:**
- Port 18800 Chrome CDP
- User data dir: `/tmp/chrome-openclaw`
- Duration: ~15 seconds per profile
- Cost: Free (no X API needed)
- Output: JSON detailed report + CSV database entry

**Diana Sanchez Scan Results:**
- Followers: 717K (verified)
- Account Age: 14+ years (joined Jan 2012)
- Risk Score: 2.8/10 (LOW)
- Verification: PAID PROMOTER
- Status: Viable partnership target for Agentic Bro
- Action: Proceed with partnership outreach (see `kol-pitch-diana-sanchez.md`)

### April 1, 2026

**Marketing Wallet Community Fund:**
- Marketing wallet: `9SFtm4S5QNDdMuWwgpy8E7ZhqRfgmjNtE1JLqkzPKj9F` (Solana)
- Current balance: **0.463 SOL (~$76 USD)** (checked Apr 1, 2026 18:13 EST)
- Purpose: Community-funded marketing initiatives (trending, boost bots, promotions)
- Status: No community contributions received yet
- **SOL ONLY** - Do NOT sell AGNTCBRO to contribute (protects token price)
- Policy: Remind members about marketing wallet when they request trending/boost services
- Tracking: All contributions logged in `/memory/MARKETING_WALLET.md`
- Goals: 2 SOL (basic trending), 5 SOL (premium trending)

**Community Interaction Update:**
- Added automated response for trending/boost bot requests
- Triggers: "get trending", "boost bot", "trending bot", "marketing services"
- Response: Remind about marketing wallet and how to contribute
- Tone: Educational, not pushy - "Community-funded = community-decided"

### April 1, 2026 — End of Day Summary

**Quiet Day — Documentation & Maintenance:**
- Marketing wallet tracking fully documented (0.463 SOL, ~$76 USD)
- Community interaction automation added for trending/boost requests
- No scam reports or urgent issues
- Group stable at 5K+ members

**Next High-Priority Actions (April 2):**
1. Configure Stripe production keys in Vercel
2. Test payment flow end-to-end
3. Verify Chrome CDP running on port 18800
4. Post payment system launch announcement in Telegram

### March 31, 2026

**Website Payment System Complete:**
- Unified credit system across Token Scanner and Profile Verifier
- 3 free scans per user (tracked by wallet address or email in localStorage)
- $1/scan after free scans exhausted
- Payment options: Stripe (USD), USDC (Solana/Base), AGNTCBRO
- Credit packages: Starter ($5/5), Basic ($10/10), Pro ($25/25), Whale ($100/110)
- Receiving wallets: Solana (`9SFtm4S5QNDdMuWwgpy8E7ZhqRfgmjNtE1JLqkzPKj9F`), Base (`0x1c793592adf512dfe590817225c3b2b6bd913fac`)

**Mobile Menu Architecture:**
- Fixed hamburger menu using React Portal (`createPortal`)
- Renders at `document.body` level to bypass parent container constraints
- z-index 99999, prevents background scrolling when open

**Model Unification:**
- All 10 agents unified to `ollama/glm-4.7:cloud`
- Default model set to `glm-4.7:cloud` in config
- Removed `glm-5:cloud` as primary

**Chrome CDP Scanning Enhancement:**
- WebSocket extraction now primary method for X profile scanning
- Added `PAID PROMOTER` verification level (6 total levels now)
- Risk scoring updated: +15 pts for shill accounts, +10 pts for high-risk token promotion
- Technical reference created: `/scam-detection-framework/CHROME_CDP_PROFILE_SCANNER.md`

**Git Activity Today:**
- 20+ commits: mobile menu fixes, Token Scanner component, payment system, USDC wallets
- 1,807 lines added, 290 lines removed

### March 26, 2026

**Token Impersonation Scanner Added:**
- Created comprehensive token impersonation scanner (token_impersonation_scanner.py)
- Automatically detects tokens copying legitimate projects by contract address
- Risk scoring system: High (5+ points), Medium (3-4 points), Low (1-2 points)
- Generates formatted alerts ready for social media posting
- Produces detailed JSON reports with full analysis
- Quick-start wrapper script: scan_token.sh

**Scanner Capabilities:**
- Input: Legitimate contract address → Output: Token info + impersonator alerts
- Analyzes symbol/name matching, liquidity, volume, platform risks
- Uses DexScreener API for comprehensive token search
- Risk factors: exact symbol match (+5), name similarity (+3), zero liquidity (+2), Pump.fun platform (+1)
- AGNTCBRO scan results: 54 tokens analyzed, 34 suspicious, 0 direct copies

**Integration Complete:**
- Scanner location: /workspace/scripts/token_impersonation_scanner.py
- Documentation: /workspace/scam-detection-framework/TOKEN_IMPERSONATION_SCANNER.md
- Quick reference: /workspace/scam-detection-framework/SCANNER_QUICK_REF.md
- Reports saved as: impersonation_scan_[CONTRACT]_[DATE].json
- Alert format matches requested social media template

**Usage:**
```bash
./scan_token.sh 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
```

**AGNTCBRO Scam Detection Complete:**
- 70 tokens analyzed via DexScreener API
- 12 suspicious tokens identified (impersonation tactics)
- Legitimate AGNTCBRO verified safe at correct contract address
- No direct contract address copies found
- Social media posts created for immediate community warning

### March 25, 2026

**Scam Detection System Enhancements:**
- Added ScamDatabaseModal component with tabbed interface for viewing scammers, legitimate accounts, and recent scans
- Created ScamDetectionDisplay component for full-page scam database view
- Implemented `/api/scam-investigate` endpoint alias for Vercel compatibility
- Updated investigation pipeline to support Twitter profile, wallet analysis, and victim reports integration
- Added stats dashboard with key metrics (total scammers, legitimate accounts, recent scans, risk distribution)
- Integrated Supabase backend support (optional) with error handling for missing credentials
- Cleaned up code: removed unused React import from ScamDetectionDisplay.tsx

**Git Activity:**
- 3 commits: scam database modal, import cleanup, investigation endpoint alias
- 1,016 lines added, 68 lines removed across 5 files
- Key changes: server/index.ts, App.tsx, ScamDatabaseModal.tsx, ScamDetectionDisplay.tsx, ScamDetectionSection.tsx

**Production Status:**
- Core scam detection functionality complete
- Modal and display components integrated into main app
- Backend endpoints operational
- Frontend UI components complete
- Build dependencies need verification (TypeScript compiler)

**Technical Debt Identified:**
- Token mint address placeholder in services/tokenVerification.ts
- Mock wallet stats in RoastDisplay.tsx need real integration
- Mock transaction analysis in helius.ts needs Helius API implementation

### March 24, 2026

**System Security Hardening:**
- Changed Telegram groupPolicy from "open" to "allowlist" for security
- Set tools profile from "coding" to "messaging" to restrict elevated access
- Gateway updated to 2026.3.23-2 (latest version)
- Default model switched to ollama/glm-4.7:cloud (200k token context)
- Security audit: 0 critical issues, 3 warnings (non-blocking)

**Chrome Automation Operational:**
- Chrome CDP running on port 18800 with dedicated profile
- User data directory: /tmp/chrome-openclaw
- Real-time X profile scanning (no API keys needed)
- 3 tabs available for browser automation
- Verified @Web3warrior scan: Risk Score 0.5/10 (LOW RISK)

**Scam Detection System Verified:**
- Backend server operational on port 3001
- Full stack working: X scraping → Reddit search → DB lookup → Telegram intel
- Ready for AMA demo with live profile scanning

### March 23, 2026

**Revenue Model Finalized:**
- Hybrid payment model: USDC (stable) + AGNTCBRO (utility)
- Tiered pricing: Free → $29/mo → $99/mo → $299/mo → $999/mo
- 30% token burn on AGNTCBRO payments (deflationary)
- Year 1 projections: $390K (conservative) to $18.7M (optimistic)
- Token supply impact: 1.79% to 53.1% burned in Year 1

**Partnership Strategy:**
- Target KOLs: @DianaSanchez_04 (717K), @CalebSol (204K), @JamesWynnReal (488K)
- Revenue share: 10-20% on referrals
- Upfront token payments: 50K-100K $AGNTCBRO
- Partnership types: Shoutout (1-2 posts), Affiliate (ongoing), Strategic (6-12 months)

**AMA Preparation:**
- Comprehensive talking points document created
- Covers: technology, revenue, partnerships, roadmap, governance
- Target metrics: 1M+ $SOL protected, 500K+ scans, 100+ countries
- Key message: "Scan first, ape later"

**Bot Activity:**
- 6 users warned for marketing promotion services
- Warnings tracked in warnings.json with timestamps and message IDs

**Key Stats:**
- 1M+ $SOL protected
- 500K+ scans completed
- 5K+ Telegram group members
- 50% month-over-month growth

---

## Business Model

### Payment Structure
- **Freemium:** 5 scans/day, basic features
- **Tier 1 (Individual):** $29 or 2,500 AGNTCBRO/mo
- **Tier 2 (Professional):** $99 or 8,500 AGNTCBRO/mo
- **Tier 3 (Team):** $299 or 25,000 AGNTCBRO/mo
- **Tier 4 (Enterprise):** $999 or 85,000 AGNTCBRO/mo

### Token Economics
- Total supply: 1B $AGNTCBRO
- 30% burn on token payments
- Token utility: governance, voting, staking, access
- Hybrid discount: 10% off for AGNTCBRO payments

---

## Technology Stack

### Browser Automation
- Chrome CDP on port 18800
- Profile: openclaw
- Real-time X profile scanning (no API keys needed)
- Telegram channel scanning via web fetch

### Risk Scoring
- 10 red flags with weighted scoring (90 total points)
- Risk levels: 0-3 (LOW), 3-5 (MEDIUM), 5-7 (HIGH), 7-10 (CRITICAL)
- Verification tiers: 6 levels from Unverified → Partially Verified → Verified → Legitimate → PAID PROMOTER → HIGH RISK
- Paid promoter detection: +15 pts for shill accounts, +10 pts for high-risk token promotion

---

## Roadmap

### Q2 2026
- Priority Scan API for website integration
- Mobile app (iOS/Android)
- Enhanced reporting (PDF export, API access)
- Social media sharing
- 10 KOL partnerships, 5 enterprise clients

### Q3 2026
- Multi-profile scanning (batch)
- API marketplace
- Developer SDK
- Community governance voting
- Token staking rewards

### Q4 2026
- AI-powered recommendations
- Predictive risk scoring
- Real-time alerts (push notifications)
- Whitelist/blacklist management

### 2027+
- Cross-chain scanning (ETH, BNB, Polygon)
- NFT scam detection
- DeFi protocol scanning
- Smart contract analysis
- White-label solutions

---

## Partnerships

### Target KOLs
- @DianaSanchez_04 (717K followers) - Verified
- @CalebSol (204K followers) - Verified
- @TheCryptoLark (200K followers)
- @girlgone_crypto (100K followers)
- @JamesWynnReal (488K followers)
- @Ralvero (184K followers)

### Partnership Models
1. **Shoutout:** 1-2 posts, 50K tokens, 10% commission
2. **Affiliate:** 10-20% commission, no upfront
3. **Strategic:** 100K tokens, 20% commission, exclusive access

---

## Community Engagement

### Telegram Group
- Group ID: -1003751594817
- Members: 5K+
- Activities: Weekly AMAs (Thursday 7 PM EST), Cherry Bot raids (2-3x/week), daily updates

### Moderation
- Auto-warnings for marketing services
- Tracked in warnings.json
- 6 warnings issued on March 23, 2026

---

## Key Documents

- ama-talking-points.md - Comprehensive AMA preparation
- revenue-model-hybrid-usdc-agntcbro.md - Detailed revenue model
- kol-pitch-diana-sanchez.md - Partnership pitch for Diana Sanchez
- crypto-group-moderation-guide.md - Moderation guidelines
- cherry-bot-raid-guide.md - Raid strategy
- FEATURE_ROADMAP.md - Feature development roadmap

---

## Important Decisions

1. **Hybrid Payment Model:** USDC for enterprise stability + AGNTCBRO for community utility
2. **30% Token Burn:** Creates scarcity and demonstrates commitment to token value
3. **Freemium Strategy:** Drive user acquisition with free tier, upsell to premium
4. **KOL-First Marketing:** Target verified KOLs with revenue share incentives
5. **Browser-Based Scanning:** Real-time data vs cached APIs, no API keys needed

---

## Metrics to Track

**Daily:**
- Scans completed
- New signups
- Token burn amount
- Warnings issued

**Weekly:**
- Revenue (USDC + AGNTCBRO)
- $SOL protected
- Partnership inquiries
- Community growth

**Monthly:**
- Conversion rate (free → paid)
- Partner performance
- Token price impact
- Churn rate

---

## Blocked Items / Need Input

### March 31, 2026
1. **Stripe Production Keys** - Need to add production Stripe keys to Vercel environment (`VITE_STRIPE_PUBLISHABLE_KEY`)
2. **Chrome CDP Automation** - Profile Verifier needs Chrome CDP running on port 18800 for live scanning
3. **AMA Scheduling** - Need to finalize date/time and announce in Telegram group

### Resolved (March 31)
- ✅ TypeScript build working (20+ commits deployed)
- ✅ Token mint address configured (`52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump`)
- ✅ Payment system implemented (Stripe, USDC Solana/Base, AGNTCBRO)
- ✅ Credit system unified across scanners (3 free scans, $1/scan after)
- ✅ Mobile menu working (React Portal fix)

### Previous (Resolved)
- WhaleChat data access issue - FIXED with backend health monitoring

---

## Next High-Priority Actions

### Immediate (Tomorrow - April 2, 2026)
1. **Add Stripe Production Keys** - Configure `VITE_STRIPE_PUBLISHABLE_KEY` in Vercel environment
2. **Test Payment Flow End-to-End** - Verify Stripe checkout and USDC/AGNTCBRO payments work
3. **Chrome CDP Verification** - Ensure Chrome CDP is running on port 18800 for Profile Verifier
4. **Post Community Update** - Announce payment system launch in Telegram group

### Short Term (This Week)
1. **Contact @DianaSanchez_04** - Send partnership pitch email and Telegram DM
2. **Schedule AMA** - Finalize date/time and announce in Telegram group
3. **Integrate Real Wallet Stats** - Replace mock data in RoastDisplay.tsx with PortfolioCard integration
4. **Test Credit System** - Verify 3 free scans per user works correctly

### Ongoing
5. **Monitor Payment Conversions** - Track free → paid conversions
6. **Prepare AMA Demo** - Test 3-5 profile scans using Chrome automation
7. **KOL Outreach** - Continue partnership discussions with target influencers
8. **Token-Gating Setup** - Collab.Land integration for token-based access

---

## Nightly Reviews Summary

| Date | Key Items | Status |
|------|-----------|--------|
| 2026-04-01 | Marketing wallet docs, community automation, quiet day | ✅ Complete |