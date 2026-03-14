# Deployment Guide - Agentic Bro

## Fix Summary
✅ Created `DailyReport` component (missing dependency)
✅ Fixed `App.tsx` to import `DailyReport`
✅ Created `BNB` signal service
✅ Created `XRP` signal service
✅ All trading services complete

---

## Step 1: Test Build Locally

```bash
cd /Users/efinney/.openclaw/workspace/aibro
npm run build
```

**Expected output:**
```
vite v6.0.7 building for production...
✓ 58 modules transformed.
dist/index.html                   0.45 kB │ gzip:   0.30 kB
dist/assets/index-[hash].js      150.00 kB │ gzip:  45.00 kB
dist/assets/index-[hash].css       5.00 kB │ gzip:   2.00 kB
```

**If build fails:** Paste the error and I'll debug.

---

## Step 2: Commit Changes to Git

```bash
# Check git status
git status

# Add all changes
git add .

# Commit
git commit -m "feat: add DailyReport + complete signal services

- Add DailyReport component with market analysis
- Fix App.tsx to import DailyReport
- Add BNB signal service
- Add XRP signal service
- All 5 asset signals now complete (BTC/ETH/SOL/BNB/XRP)"

# Push to origin
git push
```

---

## Step 3: Deploy to Vercel

```bash
# Deploy to production
vercel --prod
```

**Expected output:**
```
? Set up and deploy “~/workspace/aibro”? [Y/n] Y
? Which scope do you want to deploy to? Your username
? Link to existing project? [y/N] N
? What's your project's name? aibro
? In which directory is your code located? ./

🔍  Inspect: https://vercel.com/your-username/aibro/...
✅  Production: https://aibro.vercel.app
```

---

## Step 4: Configure Vercel Settings (If Needed)

### Environment Variables

Go to Vercel Dashboard → Settings → Environment Variables → Add:

```
VITE_HELIUS_API_KEY=your_helius_key_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Upgrade Build Machine

Create or edit `vercel.json`:

```json
{
  "buildCommandSettings": {
    "maxWorkers": 16,
    "memoryMb": 16384
  }
}
```

Then redeploy:
```bash
vercel --prod
```

---

## Step 5: Verify Deployment

1. Visit: `https://aibro.vercel.app` (or your Vercel URL)
2. Connect wallet
3. Verify all components load:
   - ✅ PortfolioCard
   - ✅ RoastDisplay
   - ✅ SignalFeed
   - ✅ TradeAnalysis
   - ✅ AlertFeed
   - ✅ DailyReport (NEW!)

---

## Troubleshooting

### Build fails with TypeScript errors:
```bash
# Check TypeScript config
cat tsconfig.json

# Fix missing types
npm install --save-dev @types/node
```

### Vercel timeout:
```bash
# Upgrade build machine (see Step 4 above)
```

### Environment variables missing:
```bash
# Check if .env exists
ls -la .env*

# Add to Vercel dashboard (not to git)
```

### Components not loading:
```bash
# Check browser console for errors
# Look for 404s or missing imports
```

---

## After Deployment Success

🎉 **Website live!** 

**Next steps:**
1. Update production URL in social media
2. Test all features with wallet connected
3. Monitor Vercel logs for errors
4. Deploy trading services API (next phase)

---

**Need help?** Paste any error output and I'll debug.