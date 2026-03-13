# 🚀 Deployment Guide: Agentic Bro

## Step 1: Initialize Git Repository

```bash
cd /Users/efinney/.openclaw/workspace/aibro

# Initialize git
git init

# Add all files
git add .

# Initial commit
git commit -m "Initial commit: Agentic Bro - AI degen advisor dashboard"
```

---

## Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `agenticbro`
3. Description: `Your agentic degen advisor. Connect wallet → Get roasted.`
4. Make it **Public**
5. Don't initialize with README (we have one)
6. Click "Create repository"

---

## Step 3: Push to GitHub

```bash
# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/agenticbro.git

# Push to main
git branch -M main
git push -u origin main
```

---

## Step 4: Deploy to Vercel

### Option A: via Vercel Dashboard (Easier)

1. Go to https://vercel.com
2. Click "Add New Project"
3. Import your `agenticbro` repository
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `.`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Click "Deploy"
6. Wait ~2–3 minutes
7. Copy the preview URL (e.g., `https://agenticbro.vercel.app`)

### Option B: via Vercel CLI (Faster for repeat deploys)

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from aibro directory
cd /Users/efinney/.openclaw/workspace/aibro
vercel
```

Follow the prompts:
- Set up and deploy? → Yes
- Which scope? → Select your account
- Link to existing project? → No
- What's your project's name? → `agenticbro`
- Which directory is your code located? → `.`
- Want to override the settings? → No
- What build command do you want to use? → `npm run build`

---

## Step 5: Add Environment Variables

After deployment:

1. Go to your Vercel project → Settings → Environment Variables
2. Add these variables:

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Yes |
| `VITE_AI_PROVIDER` | `ollama` | Yes |
| `VITE_OLLAMA_API_URL` | `https://api.ollama.com` | Yes |
| `VITE_OLLAMA_MODEL` | `glm-4.7:cloud` | Yes |
| `VITE_HELIUS_API_KEY` | Your Helius API key (optional) | No |

3. Click "Redeploy" to apply changes

---

## Step 6: Test the Deployment

1. Open your Vercel URL (e.g., `https://agenticbro.vercel.app`)
2. Click "Connect Wallet"
3. Test with Phantom wallet
4. Verify:
   - [ ] Wallet connects
   - [ ] Portfolio stats appear (mock data works)
   - [ ] Roast generates (mock data works)
   - [ ] Share to X button works

---

## Step 7: Add Custom Domain

### Register Domain
1. Go to Namecheap or Cloudflare
2. Search: `agenticbro.io`
3. Add to cart and purchase (~$40–$70/year)

### Configure in Vercel
1. Go to Vercel project → Settings → Domains
2. Enter: `agenticbro.io`
3. Click "Add"
4. Copy the DNS records Vercel shows you

### Update DNS Records
**If using Namecheap:**
1. Log in to Namecheap
2. Go to Domain Manager → agenticbro.io
3. Click "DNS Records"
4. Add:
   - Type: CNAME, Name: @, Value: `cname.vercel-dns.com`
   - Type: CNAME, Name: www, Value: `cname.vercel-dns.com`

**If using Cloudflare:**
1. Log in to Cloudflare
2. Select domain: agenticbro.io
3. Go to DNS → Records
4. Add:
   - Type: CNAME, Name: @, Target: `cname.vercel-dns.com`
   - Type: CNAME, Name: www, Target: `cname.vercel-dns.com`
   - Proxy status: Proxied (orange cloud)

### Verify
Wait 10–15 minutes, then check:
```
https://agenticbro.io
```

---

## Step 8: Create Social Accounts

### X (Twitter)
1. Go to https://twitter.com/i/flow/signup
2. Handle: `@AgenticBro`
3. Bio: `🤖 Your agentic degen advisor. Connect wallet → Get roasted. 📈 $AGNTCBRO`
4. Profile pic: Use the glitchy robot mascot 🤖
5. Banner: Purple/neon green gradient

### TikTok
1. Download TikTok app
2. Create account
3. Handle: `@agenticbro`
4. Bio: `🤖 Agentic Bro | AI degen advisor | Connect wallet → Get roasted`
5. Link to agenticbro.io in bio

### Telegram
1. Go to https://t.me
2. Create new channel/group
3. Username: `t.me/AgenticBro`
4. Description: `🤖 Agentic Bro Community | Roasts, memes, alpha`
5. Set profile pic

---

## Step 9: Prepare for pump.fun Launch

### Token Info
```
Name: Agentic Bro
Ticker: AGNTCBRO
Supply: 1,000,000,000
Platform: Solana
Launch: pump.fun
```

### Launch Thread Template (Copy & Paste)
```
🤖 Agentic Bro is live on pump.fun

Your agentic degen advisor is here to roast your portfolio.

He's brutal. He's honest. He's powered by agentic AI.

✅ Dashboard: agenticbro.io
✅ Fair launch (no presale, no team allocation)
✅ Real utility (live at launch)
✅ Community-driven (you shape the roasts)

🚀 pump.fun/coin/AGNTCBRO

Let the roasting begin. 🧵👇

1/8

What is Agentic Bro?

Agentic Bro is your AI degen advisor. Connect your wallet, and he'll roast your portfolio brutally but humorously.

He analyzes your last 7 days of trades, calculates your degen score, and tells you exactly where you went wrong.

2/8

Why Agentic Bro?

- Agentic AI-powered roasts (never repeats)
- Real utility at launch
- Fair launch (no presale)
- Community-driven
- Multi-chain coming soon

Not just another meme coin. Real utility, real degen energy.

3/8

Dashboard Features:

📊 Portfolio Analysis
- Win rate tracking
- PnL calculation
- Gas fee tracking
- Degen score (0-100)

💬 Agentic AI Roasts
- Personalized to your wallet
- Shareable to X
- Never repeats
- Brutally honest

4/8

Tokenomics:

🔸 Ticker: $AGNTCBRO
🔸 Supply: 1,000,000,000
🔸 Platform: Solana / pump.fun
🔸 Launch: Fair (no presale)
🔸 Liquidity: 100% community-owned

5/8

Roadmap:

Week 1: Dashboard live, 5k holders
Week 2: Discord bot, 10k holders
Week 3: X bot, NFT drop, 20k holders
Week 4: API launch, DEX listing, 50k holders

6/8

How to get roasted:

1. Connect wallet on agenticbro.io
2. Wait 10 seconds (AI analyzes your wallet)
3. Read your brutal roast
4. Share to X for extra degen points

7/8

Community:

X: @AgenticBro
TikTok: @agenticbro
Telegram: t.me/AgenticBro
Dashboard: agenticbro.io

Built for degens, by degens. 🤖💸

8/8

🚀 Ready to get roasted?

👉 pump.fun/coin/AGNTCBRO
👉 agenticbro.io

Let the roasting begin.

$AGNTCBRO #Solana #memecoins #AgenticAI
```

---

## Step 10: Liquidity Preparation

### Create Burner Wallets
1. Create 3–5 new Phantom wallets
2. Transfer 0.5–1 SOL total (stagger amounts)
3. Test connectivity to pump.fun

### Seed Strategy
```
T-15min: 0.1 SOL (Wallet 1)
T-5min:  0.1 SOL (Wallet 2)
T+5min:  0.2 SOL (Wallet 3)
T+15min: 0.2 SOL (Wallet 4)
T+25min: 0.2 SOL (Wallet 5)
```

---

## Launch Checklist

### Technical
- [ ] Git initialized
- [ ] Pushed to GitHub
- [ ] Deployed to Vercel
- [ ] Environment variables added
- [ ] Custom domain connected
- [ ] Tested all functionality

### Social
- [ ] X account created (@AgenticBro)
- [ ] TikTok account created (@agenticbro)
- [ ] Telegram created (t.me/AgenticBro)
- [ ] Branding applied

### Content
- [ ] Launch thread drafted
- [ ] 10 TikTok clips created
- [ ] Meme templates designed

### Liquidity
- [ ] Burner wallets created
- [ ] Wallets funded
- [ ] Seed strategy planned

---

## Post-Launch Monitoring

### First Hour
- Reply to every mention
- Monitor pump.fun activity
- Check for bugs
- Engage with early buyers

### First 24 Hours
- Post updates every 2 hours
- Share roasts from dashboard
- Build community in Telegram
- Monitor graduation progress

---

## Success Metrics (Track Daily)

| Day | Holders | Market Cap | X Followers | TikTok Views |
|-----|---------|------------|-------------|--------------|
| 1 | 500 | $1,000 | 100 | 10,000 |
| 3 | 2,000 | $5,000 | 300 | 50,000 |
| 7 | 5,000 | $10,000 | 1,000 | 250,000 |

---

## Troubleshooting

### Build Error on Vercel
```bash
# Make sure dependencies are installed
npm install

# Test build locally
npm run build

# If successful, push and redeploy
git add .
git commit -m "Fix build issues"
git push
```

### Wallet Won't Connect
- Check Phantom is installed
- Ensure Solana network is `mainnet-beta`
- Refresh page and try again

### Roasts Not Generating
- Check `VITE_AI_PROVIDER=ollama` is set
- Check browser console for errors
- Try mock mode (remove AI provider vars)

### Domain Not Resolving
- Wait 15–20 minutes for DNS propagation
- Check DNS records match Vercel's instructions
- Try HTTPS (SSL cert auto-issues)

---

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **Solana Wallet Adapter:** https://github.com/solana-labs/wallet-adapter

---

## Quick Deploy Command Summary

```bash
# One-liner to deploy (if Vercel CLI installed)
cd /Users/efinney/.openclaw/workspace/aibro && vercel
```

---

Ready to launch! 🚀

$AGNTCBRO #Solana #AgenticAI