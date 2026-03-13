# 🚀 Deploy Agentic Bro - Commands Ready to Run

## Step 1: Create GitHub Repository (Do This First in Browser)

1. Go to https://github.com/new
2. Name: `agenticbro`
3. Make it **Public**
4. Click "Create repository"

---

## Step 2: Run These Commands in Terminal

```bash
cd /Users/efinney/.openclaw/workspace/aibro

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Agentic Bro - AI degen advisor dashboard"

# Add remote (your GitHub username)
git remote add origin https://github.com/maadmaax26/agenticbro.git

# Push
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy to Vercel

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy
vercel
```

Follow the prompts:
- Set up and deploy? → Yes
- Which scope? → Select your account
- Link to existing project? → No
- What's your project's name? → `agenticbro`
- Which directory is your code located? → `.`
- Override settings? → No
- Build command? → `npm run build`

---

## Step 4: Add Environment Variables

In Vercel dashboard → Settings → Environment Variables, add:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_AI_PROVIDER=ollama
VITE_OLLAMA_API_URL=https://api.ollama.com
VITE_OLLAMA_MODEL=glm-4.7:cloud
```

Then click "Redeploy"

---

## That's It!

Your dashboard will be live at:
```
https://agenticbro.vercel.app
```

🚀 $AGNTCBRO