# 🚀 Quick Deploy Commands

## Run These Commands in Order

### 1. Create GitHub Repository (Do This First)
1. Go to https://github.com/new
2. Name: `agenticbro`
3. Description: `Your agentic degen advisor. Connect wallet → Get roasted.`
4. Make it **Public**
5. Click "Create repository"

### 2. Initialize Git & Commit
```bash
cd /Users/efinney/.openclaw/workspace/aibro

git init
git add .
git commit -m "Initial commit: Agentic Bro - AI degen advisor dashboard"
```

### 3. Push to GitHub
```bash
git remote add origin https://github.com/maadmaax26/agenticbro.git
git branch -M main
git push -u origin main
```

### 4. Deploy to Vercel
```bash
# Install Vercel CLI (if needed)
npm i -g vercel

# Deploy
vercel
```

### 5. Add Environment Variables (in Vercel Dashboard)
Go to: Vercel project → Settings → Environment Variables

Add:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_AI_PROVIDER=ollama
VITE_OLLAMA_API_URL=https://api.ollama.com
VITE_OLLAMA_MODEL=glm-4.7:cloud
```

---

## That's It!

Once deployed, your dashboard will be live at:
```
https://agenticbro.vercel.app
```

Then connect `agenticbro.io` domain and you're ready for pump.fun launch.

🚀 $AGNTCBRO