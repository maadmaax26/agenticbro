# ✅ AIBRO Deployment Checklist

## Domain & DNS
- [ ] Register `aibro.io` domain
- [ ] Point DNS to Vercel (CNAME: `cname.vercel-dns.com`)
- [ ] Verify DNS propagation (wait 10–15 min)
- [ ] Check HTTPS works

## GitHub
- [ ] Create repo: `github.com/YOUR_USERNAME/aibro`
- [ ] Push code to main branch
- [ ] Set repo to public (for Vercel import)

## Vercel
- [ ] Create Vercel account
- [ ] Import `aibro` repo
- [ ] Configure build settings (Vite, `npm run build`)
- [ ] Add environment variables:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `VITE_OPENAI_API_KEY`
  - [ ] `VITE_HELIUS_API_KEY`
- [ ] Deploy to production
- [ ] Add custom domain `aibro.io`
- [ ] Verify production build works

## Supabase
- [ ] Create Supabase project
- [ ] Get API credentials (URL + anon key)
- [ ] Run database schema SQL
- [ ] Test connection from dashboard
- [ ] Set up RLS policies (for security)

## OpenAI
- [ ] Create OpenAI account
- [ ] Generate API key
- [ ] Test API call
- [ ] Monitor usage (set up alerts)

## Helius
- [ ] Create Helius account
- [ ] Create project
- [ ] Get API key
- [ ] Test wallet data fetch
- [ ] Monitor rate limits

## Testing
- [ ] Test wallet connect on production
- [ ] Test portfolio analysis
- [ ] Test roast generation
- [ ] Test mobile responsiveness
- [ ] Test all share buttons
- [ ] Test error handling

## Social Setup
- [ ] Create X account: `@AIBRO_sol`
- [ ] Create TikTok account: `@aibro.sol`
- [ ] Create Telegram: `t.me/AIBROofficial`
- [ ] Verify handles are available
- [ ] Set up branding (profile pics, banners)

## Content Preparation
- [ ] Create 10 TikTok clips
- [ ] Write 20 roast templates
- [ ] Design token mascot
- [ ] Design 5 meme templates
- [ ] Draft launch thread

## Liquidity Preparation
- [ ] Create 3–5 burner wallets
- [ ] Fund wallets (0.5–1 SOL total)
- [ ] Test wallet connectivity
- [ ] Plan seed strategy (timing + amounts)

## Pre-Launch (48h Before)
- [ ] Final code review
- [ ] Security audit (API keys, env vars)
- [ ] Load test (simulate traffic)
- [ ] Set up monitoring (Vercel Analytics)
- [ ] Prepare emergency rollback plan

## Launch Day
- [ ] Post launch thread on X
- [ ] Drop first TikTok
- [ ] Share pump.fun link in Telegram
- [ ] Begin seeding liquidity
- [ ] Monitor dashboard metrics
- [ ] Reply to all mentions
- [ ] Drop second TikTok (T+30min)

## Post-Launch (First 24h)
- [ ] Monitor all metrics
- [ ] Engage with community
- [ ] Fix any bugs that appear
- [ ] Update documentation
- [ ] Plan next features

---

## Success Metrics (Track These)

| Metric | Target | Current |
|--------|--------|---------|
| Dashboard users | 1,000 | ___ |
| Roasts generated | 5,000 | ___ |
| X followers | 10,000 | ___ |
| TikTok views | 500,000 | ___ |
| Telegram members | 2,000 | ___ |
| Token holders | 5,000 | ___ |
| Market cap | $10,000+ | ___ |

---

## Notes

- Cross off items as completed
- Add notes for any blockers
- Update metrics daily

---

Built for degens, by degens. 🤖💸