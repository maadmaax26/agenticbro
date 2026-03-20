# 🤖 Agentic Bro - Project Summary

**Agentic Bro** is your agentic degen advisor — a Solana-based meme coin with real utility. Connect your wallet, and Agentic Bro will roast your portfolio brutally but humorously.

**Powered by:** AutonomousAlpha.io — AI Trading Infrastructure

---

## Core Features
- **Portfolio Analysis:** Analyze last 7 days of trades
- **Degen Detection:** Calculate degen score (0-100)
- **Agentic AI Roasts:** Powered by Ollama Cloud, never repeats
- **Shareable:** Copy to clipboard or share to X
- **AutonomousAlpha Integration:** Upsell to AI Trading Playbook & bot services

---

## Token Information
- **Name:** Agentic Bro
- **Ticker:** $AGNTCBRO
- **Supply:** 1,000,000,000
- **Platform:** Solana / pump.fun
- **Domain:** agenticbro.io
- **Social:** @AgenticBro

---

## Tech Stack
- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** TailwindCSS + custom gradients
- **Wallet:** Solana Wallet Adapter (Phantom)
- **Backend:** Supabase (database + auth)
- **AI:** Ollama Cloud (`glm-4.7:cloud`) — **FREE with Ollama Pro**
- **Data:** Helius API (Solana indexer)
- **Partner:** AutonomousAlpha.io — AI Trading Playbook & Bot Services

---

## Integration with AutonomousAlpha

### How It Works

Agentic Bro serves as a viral funnel for AutonomousAlpha products:

```
User Flow:
1. Connect wallet → Agentic Bro roasts portfolio
2. Agentic Bro says "You need this" → Links to AutonomousAlpha
3. User buys AI Trading Playbook → $79 (with $AGNTCBRO discount)
4. User upgrades to bot services → $99-$199/mo
5. Token demand increases → $AGNTCBRO pumps
```

### Upsell Features

| Roast Count | Upsell Shown |
|-------------|--------------|
| 1–2 | AutonomousAlpha Playbook promo |
| 3+ | Bot services promo |
| 5+ | Complete bundle offer |

### Discount Codes

| Product | Discount Code | Price |
|---------|---------------|-------|
| AI Trading Playbook | `AGNTCBRO20` | $79 (was $99) |
| Strategy Pack | `AGNTCBRO10` | $39 (was $49) |
| Zero to Bot Course | `AGNTCBRO30` | $169 (was $199) |
| Complete Kit | `AGNTCBRO40` | $209 (was $249) |

---

## Project Structure

```
aibro/
├── src/
│   ├── components/
│   │   ├── PortfolioCard.tsx      # Wallet analysis UI
│   │   ├── RoastDisplay.tsx       # AI roast UI
│   │   ├── AutonomousAlphaUpsell.tsx  # Playbook promo
│   │   └── BotServiceUpsell.tsx    # Bot services promo
│   ├── lib/
│   │   ├── supabase.ts           # Database client
│   │   ├── openai.ts             # AI roast generation
│   │   └── helius.ts             # Wallet data fetch
│   ├── utils/
│   │   ├── cn.ts                 # Classname utility
│   │   └── i18n.ts               # i18n stub
│   ├── App.tsx                   # Main app
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles
├── .env.local.example            # Env vars template
├── package.json                  # Dependencies
├── vite.config.ts                # Vite config
├── tailwind.config.js            # Tailwind config
├── tsconfig.json                 # TypeScript config
├── README.md                     # This file
├── QUICKSTART.md                 # Quick start guide
├── DEPLOY.md                     # Deployment guide
├── QUICK_DEPLOY.md               # Quick deploy commands
├── REBRANDING_COMPLETE.md        # Rebranding summary
└── LAUNCH_GUIDE.md              # Launch strategy
```

---

## Getting Started

### 1. Install & Run Locally
```bash
cd aibro
npm install
npm run dev
```

### 2. Configure Environment
```bash
cp .env.local.example .env.local
# Edit with your API keys

# Required:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# AI Provider (Ollama Cloud — FREE):
VITE_AI_PROVIDER=ollama
VITE_OLLAMA_API_URL=https://api.ollama.com
VITE_OLLAMA_MODEL=glm-4.7:cloud

# Optional (Helius):
# VITE_HELIUS_API_KEY=your-helius-key
```

### 3. Deploy to Vercel
```bash
git init
git add .
git commit -m "Initial commit: Agentic Bro"
git push origin main
# Then deploy via Vercel dashboard
```

---

## API Integration Status

| Integration | Status | Notes |
|------------|--------|-------|
| **AI (Ollama Cloud)** | ✅ **Ready** | FREE with Ollama Pro — just configure env vars |
| **AI (OpenAI)** | ✅ Optional | Paid alternative — needs API key |
| Helius | ✅ Mock ready | Add API key for real wallet data |
| Supabase | ✅ Configured | Run SQL schema in dashboard |
| Phantom Wallet | ✅ Working | Test in dev mode |
| **AutonomousAlpha** | ✅ **Integrated** | Upsell components active |

---

## Launch Readiness

### Technical
- [x] Project structure complete
- [x] Core components built
- [x] API integration stubbed
- [x] AutonomousAlpha upsell integrated
- [x] Responsive design
- [x] Error handling
- [ ] Ollama Cloud configured (FREE)
- [ ] Helius API key configured
- [ ] Supabase database set up
- [ ] Deployed to Vercel
- [ ] Custom domain connected

### Content
- [ ] 10 TikTok clips created
- [ ] 20 roast templates written
- [ ] Token mascot designed
- [ ] 5 meme templates designed
- [ ] Launch thread drafted

### Social
- [ ] X account created (@AgenticBro)
- [ ] TikTok account created (@agenticbro)
- [ ] Telegram created (t.me/AgenticBro)
- [ ] Branding applied across all platforms

### Liquidity
- [ ] 3–5 burner wallets created
- [ ] Wallets funded (0.5–1 SOL)
- [ ] Seed strategy planned

---

## Launch Strategy

See `LAUNCH_GUIDE.md` for full details:

### Timeline
- **T-48h:** Complete technical setup
- **T-12h:** Warm-up content on X/TikTok
- **T-0:** Launch thread + first TikTok
- **T+2h:** Continue engagement

### Graduation Target
- Aim for $10k–$15k market cap
- Don't graduate too early (need community)
- Don't graduate too late (momentum dies)

---

## Success Metrics (7 Days)

| Metric | Target |
|--------|--------|
| Holders | 5,000 |
| Market cap | $10,000+ |
| TikTok views | 500,000+ |
| X followers | 10,000+ |
| Telegram members | 2,000+ |
| Dashboard users | 1,000+ |
| Roasts generated | 5,000+ |
| AutonomousAlpha Playbook Sales | 50 |
| AutonomousAlpha Revenue | ~$4,000 |

---

## Revenue Projections

### Scenario: Realistic
- Agentic Bro users: 10,000
- Click-through to AutonomousAlpha: 5% (500 users)
- Playbook conversion: 10% (50 sales)
- **Playbook Revenue:** $3,950 (at $79 each)
- Subscription signups: 20 users
- **Subscription MRR:** $1,980/mo

---

## Next Steps

### Immediate (Today)
1. Register `agenticbro.io` domain
2. Get API keys (Supabase, Ollama)
3. Create GitHub repo
4. Deploy to Vercel
5. Test all functionality

### Short Term (This Week)
1. Set up social accounts (@AgenticBro)
2. Create content bank (TikTok + memes)
3. Set up Telegram
4. Prepare liquidity wallets
5. Finalize launch timing

### Launch (When Ready)
1. Post launch thread on X
2. Drop TikTok content
3. Share in Telegram
4. Seed liquidity
5. Engage with community

---

## Support & Questions

- **Quick Deploy:** `QUICK_DEPLOY.md`
- **Full Deployment:** `DEPLOY.md`
- **Launch Guide:** `LAUNCH_GUIDE.md`
- **AI Setup:** `AI_INTEGRATION.md`

---

## License

MIT

---

Built for degens, by degens. 🤖💸

**Launch date:** TBD
**Ticker:** $AGNTCBRO
**Platform:** Solana / pump.fun
**Domain:** agenticbro.io
**Social:** @AgenticBro