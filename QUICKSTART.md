# ⚡ AIBRO Quick Start

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git
- Vercel account (for deployment)

---

## 1. Install Dependencies

```bash
cd aibro
npm install
```

---

## 2. Set Up Environment Variables

```bash
# Copy example file
cp .env.local.example .env.local

# Edit with your actual values:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
# VITE_OPENAI_API_KEY=sk-your-openai-key
# VITE_HELIUS_API_KEY=your-helius-key
```

### Get API Keys

**Supabase:**
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → API
4. Copy `Project URL` and `anon public key`

**OpenAI:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Copy the key (starts with `sk-`)

**Helius:**
1. Go to [helius.dev](https://helius.dev)
2. Create a free account
3. Create a new project
4. Copy the API key

---

## 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 4. Connect Phantom Wallet

1. Install [Phantom Wallet](https://phantom.app)
2. Click "Connect Wallet" in the top-right
3. Approve the connection in Phantom
4. AIBRO will analyze your wallet

---

## 5. Deploy to Vercel

### Push to GitHub

```bash
# Initialize git
git init
git add .
git commit -m "Initial commit: AIBRO dashboard"
git branch -M main

# Create repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/aibro.git
git push -u origin main
```

### Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your `aibro` repo
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `.`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add environment variables (same as `.env.local`)
6. Click "Deploy"

### Add Custom Domain

1. Register `aibro.io` domain
2. In Vercel project → Settings → Domains
3. Enter `aibro.io`
4. Add DNS records to your domain registrar

---

## 6. Set Up Supabase Database

Run this SQL in Supabase SQL Editor:

```sql
-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roasts table
CREATE TABLE roasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  roast_text TEXT NOT NULL,
  roast_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sentiment_score FLOAT
);

-- Analytics table
CREATE TABLE analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_roasts_user ON roasts(user_id);
CREATE INDEX idx_analytics_event ON analytics(event_type);
```

---

## Troubleshooting

### Wallet won't connect
- Make sure Phantom is installed and unlocked
- Check Solana network is set to `mainnet-beta`
- Refresh the page and try again

### Roasts aren't generating
- Check OpenAI API key is correct
- Check you have credits in your OpenAI account
- Check browser console for errors

### Build fails
- Run `npm install` again
- Delete `node_modules` and run `npm install`
- Check Node.js version is 18+

---

## Next Steps

- Read `LAUNCH_GUIDE.md` for launch strategy
- Customize branding (colors, mascot)
- Add your own roast templates
- Set up social accounts
- Prepare liquidity wallets

---

Built for degens, by degens. 🤖💸