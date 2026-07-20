# Agentic Bro Dashboard - Feature Roadmap

**Project:** Upgrade agenticbro.app with trading bot integration
**Status:** In Progress (Phases 1-3 planned)
**Token:** $AGNTCBRO on Solana
**Goal:** Give token holders real utility through trading signals, analysis, and alerts

---

## 📋 Overview

### What We're Building

**Core Value Proposition:**
> "Hold $AGNTCBRO and get access to institutional-grade trading signals, real-time bot analysis, and portfolio health monitoring from our multi-bot trading ecosystem."

### Target User Tiers

| Tier | Token Required | Access Level | Monthly Value |
|------|----------------|--------------|---------------|
| **Free** | 0 AGNTCBRO | Basic roast, 1 signal/day | $0 |
| **Holder** | 10,000+ AGNTCBRO (~$34) | All features, real-time | ~$20/month |
| **Whale** | 100,000+ AGNTCBRO (~$341) | Priority access, API, SMS | ~$50/month |

---

## 🗺️ Phases

### Phase 1: Data Collection & Integration (Week 1)

**Goal:** Collect real-time data from all trading bots and store in Supabase

#### Tasks

- [ ] **1.1 Bot Data Aggregator Service**
  - [ ] Create `services/botDataAggregator.ts`
  - [ ] Implement data ingestion from each bot:
    - Hyperliquid (WebSocket API)
    - Kraken (REST API)
    - MES (IBKR API)
    - Polymarket (Webhooks)
  - [ ] Normalize data format across bots
  - [ ] Store to Supabase (signals, status tables)

- [ ] **1.2 Database Schema**
  - [ ] Create Supabase tables:
    - `signals` (bot signals, entries, exits, alerts)
    - `bot_status` (current status, metrics, positions)
    - `token_holders` (wallet, holdings, tier, last_verified)
  - [ ] Add indexes for performance
  - [ ] Set up Row Level Security (RLS)

- [ ] **1.3 Bot Integration**
  - [ ] Hyperliquid: WebSocket connection for real-time signals
  - [ ] Kraken: REST API polling every 15 min
  - [ ] MES: IBKR API polling every 30 min
  - [ ] Polymarket: Webhook receiver for market events

- [ ] **1.4 Health Score Calculation**
  - [ ] Implement portfolio health algorithm
  - [ ] Calculate component scores (profit, win rate, risk, health, efficiency)
  - [ ] Test with mock data

#### Deliverables

✅ `services/botDataAggregator.ts` — 9,200 bytes
✅ Database schema SQL
✅ Bot integration scripts
✅ Health score calculator

#### Timeline

| Day | Tasks |
|-----|-------|
| 1-2 | Create aggregator service + database schema |
| 3-4 | Integrate Hyperliquid + Kraken bots |
| 5 | Integrate MES + Polymarket bots |
| 6-7 | Testing + bug fixes |

---

### Phase 2: Dashboard UI (Week 2)

**Goal:** Build user-facing dashboard components with token gating

#### Tasks

- [ ] **2.1 Signal Feed Component**
  - [ ] Create `components/dashboard/SignalFeed.tsx`
  - [ ] Real-time signal display
  - [ ] Token gating (free: 1/day, holder: all)
  - [ ] Refresh every 30 seconds

- [ ] **2.2 Trade Analysis Dashboard**
  - [ ] Create `components/dashboard/TradeAnalysis.tsx`
  - [ ] Bot status table (all bots)
  - [ ] Portfolio health score
  - [ ] Open positions display
  - [ ] Token gating (free: summary, holder: detailed)

- [ ] **2.3 Alert Feed Component**
  - [ ] Create `components/dashboard/AlertFeed.tsx`
  - [ ] Real-time alert display
  - [ ] Severity levels (info, warning, critical)
  - [ ] Token gating (free: 3/day, holder: all)

- [ ] **2.4 Portfolio Health Score**
  - [ ] Health score component
  - [ ] Component breakdown (holder+ only)
  - [ ] Status indicator (optimal, good, warning, critical)

- [ ] **2.5 Dashboard Integration**
  - [ ] Update main dashboard route
  - [ ] Add navigation between components
  - [ ] Responsive design (mobile + desktop)
  - [ ] Loading states and error handling

#### Deliverables

✅ `components/dashboard/SignalFeed.tsx` — 5,666 bytes
✅ `components/dashboard/TradeAnalysis.tsx` — 10,746 bytes
✅ `components/dashboard/AlertFeed.tsx` — 6,530 bytes
⏳ Portfolio health component
⏳ Dashboard navigation

#### Timeline

| Day | Tasks |
|-----|-------|
| 1-2 | Signal feed + alert feed components |
| 3-4 | Trade analysis dashboard + health score |
| 5 | Dashboard integration + navigation |
| 6-7 | Testing + responsive design |

---

### Phase 3: Token Gating & Verification (Week 3)

**Goal:** Implement token-based access control

#### Tasks

- [ ] **3.1 Token Verification Service**
  - [ ] Create `services/tokenVerification.ts`
  - [ ] Solana RPC integration (Helius preferred)
  - [ ] Token balance query
  - [ ] Tier determination (free, holder, whale)
  - [ ] Caching (5 min TTL)

- [ ] **3.2 Gated Content Components**
  - [ ] Create `<HolderOnly>` wrapper component
  - [ ] Create `<WhaleOnly>` wrapper component
  - [ ] Upgrade prompts for free users
  - [ ] Tier badges (Holder, Whale)

- [ ] **3.3 Holder Dashboard**
  - [ ] Holder-exclusive features
  - [ ] Real-time data (no limits)
  - [ ] Detailed metrics
  - [ ] Historical data access

- [ ] **3.4 Whale Dashboard**
  - [ ] Whale-exclusive features
  - [ ] Priority signals (early access)
  - [ ] SMS notifications setup
  - [ ] API access preview

- [ ] **3.5 Wallet Connection**
  - [ ] Update Phantom wallet integration
  - [ ] Auto-verify token holdings on connect
  - [ ] Display tier badge
  - [ ] Show holdings amount

#### Deliverables

✅ `services/tokenVerification.ts` — 6,410 bytes
⏳ Gated content components
⏳ Holder/Whale dashboards
⏳ Updated wallet connection

#### Timeline

| Day | Tasks |
|-----|-------|
| 1-2 | Token verification service + caching |
| 3 | Gated content components |
| 4-5 | Holder + Whale dashboards |
| 6 | Wallet integration + testing |
| 7 | End-to-end testing |

---

## 📊 Future Phases (Not Yet Scheduled)

### Phase 4: API Development (Week 4)

**Goal:** Build API endpoints for whale tier

#### Features

- REST API for data access
- WebSocket for real-time signals
- Webhook system for notifications
- Authentication (JWT + token verification)
- Rate limiting (whale: unlimited, holder: 100/day)

#### Endpoints

```
GET  /api/signals          - All signals (holder+)
GET  /api/signals/:bot     - Bot-specific signals
GET  /api/bots/status      - All bot status
GET  /api/portfolio/health - Health score
GET  /api/alerts           - All alerts (holder+)
POST /api/webhooks         - Register webhook
```

---

### Phase 5: Testing & Launch (Week 5)

**Goal:** Comprehensive testing and production deployment

#### Tasks

- [ ] End-to-end testing (all user flows)
- [ ] Load testing (simulate 1000 concurrent users)
- [ ] Security audit (token verification, RLS)
- [ ] User testing (10 token holders)
- [ ] Bug fixes and optimization
- [ ] Production deployment
- [ ] Documentation (API docs, user guide)

---

### Phase 6: Advanced Features (Future)

**Goal:** Enhanced value for token holders

#### Potential Features

- [ ] **Historical Charts**
  - PnL charts (hourly/daily/weekly)
  - Win rate trend over time
  - Position heatmap
  - Drawdown visualization

- [ ] **Custom Alerts**
  - User-defined alert thresholds
  - Notification preferences (email, SMS, push)
  - Alert aggregation and filtering

- [ ] **Trade Insights**
  - AI-powered trade analysis
  - Pattern recognition
  - Performance recommendations
  - Risk assessment

- [ ] **Community Features**
  - Share trades with community
  - Leaderboards
  - Trading competitions
  - Bounty system for bug reports

---

## 📈 Success Metrics

### Technical Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Data freshness** | < 30 sec | Signal latency monitoring |
| **Uptime** | > 99.5% | System health checks |
| **API response time** | < 200ms | API monitoring |
| **Database query time** | < 100ms | Supabase logs |

### Business Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Token holders** | 1,000 by Week 4 | On-chain analysis |
| **Holder conversion** | 25% (free → holder) | Wallet connections |
| **Whale conversion** | 5% (holder → whale) | Wallet connections |
| **Daily active users** | 500 by Week 4 | Dashboard analytics |
| **Retention (7-day)** | > 60% | User analytics |

---

## 🛠️ Tech Stack

### Backend

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Type-safe code |
| **Supabase** | Database + real-time |
| **Solana Web3.js** | Token verification |
| **Helius RPC** | Reliable Solana queries |

### Frontend

| Technology | Purpose |
|------------|---------|
| **React** | UI framework |
| **TypeScript** | Type-safe components |
| **Tailwind CSS** | Styling |
| **Phantom Wallet** | Wallet connection |

### APIs

| Bot | API Type | Purpose |
|-----|----------|---------|
| **Hyperliquid** | WebSocket | Real-time signals |
| **Kraken** | REST API | Grid status |
| **MES (IBKR)** | REST API | Options data |
| **Polymarket** | Webhooks | Market events |

---

## 📁 File Structure

```
aibro/
├── services/
│   ├── botDataAggregator.ts       ✅ Phase 1
│   ├── tokenVerification.ts       ✅ Phase 3
│   └── analyticsService.ts         ⏳ Phase 2
├── components/
│   └── dashboard/
│       ├── SignalFeed.tsx          ✅ Phase 2
│       ├── TradeAnalysis.tsx       ✅ Phase 2
│       ├── AlertFeed.tsx           ✅ Phase 2
│       ├── PortfolioHealth.tsx     ⏳ Phase 2
│       ├── HolderOnly.tsx          ⏳ Phase 3
│       └── WhaleOnly.tsx           ⏳ Phase 3
├── pages/
│   ├── dashboard.tsx               ⏳ Phase 2
│   ├── holder-dashboard.tsx        ⏳ Phase 3
│   └── whale-dashboard.tsx         ⏳ Phase 3
├── api/
│   ├── signals.ts                  ⏳ Phase 4
│   ├── bots.ts                     ⏳ Phase 4
│   └── portfolio.ts                ⏳ Phase 4
└── FEATURE_ROADMAP.md              ✅ This file
```

---

## 🚀 Next Steps

### Immediate Actions (This Week)

1. ✅ **Review Phase 1 code** — `services/botDataAggregator.ts`
2. ✅ **Review Phase 2 code** — Dashboard components
3. ✅ **Review Phase 3 code** — `services/tokenVerification.ts`
4. ⏳ **Set up Supabase database** — Run schema migration
5. ⏳ **Deploy to Vercel** — Update production build

### This Week

- Set up Supabase project
- Run database schema
- Test bot data collection
- Deploy Phase 1 to production

### Next Week

- Build dashboard UI components
- Integrate components into main app
- Test token gating
- Deploy Phase 2 + 3 to production

---

## 📞 Need Help?

**For each phase, I can:**
- Write the code
- Review existing code
- Debug issues
- Create documentation
- Help with deployment

**Current Status:**
- ✅ Phase 1 code ready (botDataAggregator)
- ✅ Phase 2 code ready (3 components)
- ✅ Phase 3 code ready (tokenVerification)
- ⏳ Waiting for Supabase setup
- ⏳ Waiting for deployment approval

**What do you want to work on next?**

- Set up Supabase database?
- Deploy to Vercel?
- Create more components?
- Write API documentation?
- Something else?

---

**Last Updated:** 2026-03-13
**Status:** Phases 1-3 code complete, awaiting database setup