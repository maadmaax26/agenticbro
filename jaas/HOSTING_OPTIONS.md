# Hosting a Telegram Bot — Options & Requirements

## What You Need

| Requirement | Description |
|-------------|-------------|
| **Bot Token** | From @BotFather (free) |
| **Code** | Bot logic (Node.js, Python, etc.) |
| **Hosting** | Server to run the bot 24/7 |
| **HTTPS** | For webhooks (optional, polling doesn't need it) |

---

## Hosting Options

### Option 1: OpenClaw Agent (Easiest)

**How it works:**
- Bot runs as an OpenClaw agent
- Uses `sessions_spawn` for bot tasks
- Polls Telegram for updates
- No separate server needed

**Pros:**
- Already have OpenClaw running
- No additional cost
- Integrated with JaaS scripts

**Cons:**
- Polling mode (slightly slower than webhooks)
- Uses your Mac Studio resources

**Setup:**
```typescript
// Run bot via OpenClaw cron every 5 seconds
{
  "name": "jaas-bot-poll",
  "schedule": { "kind": "every", "everyMs": 5000 },
  "payload": {
    "kind": "agentTurn",
    "message": "Poll Telegram bot API for updates..."
  }
}
```

---

### Option 2: Vercel (Serverless)

**How it works:**
- Bot code deployed to Vercel
- Webhook endpoint receives updates
- No always-on server needed

**Pros:**
- Free tier available
- Automatic HTTPS
- Easy deployment (`vercel deploy`)
- Scales automatically

**Cons:**
- Cold starts (slight delay on first request)
- Timeout limits (10s on free tier)
- Need webhook setup

**Setup:**
```bash
# Deploy to Vercel
cd jaas-bot
vercel deploy

# Set webhook
curl "https://api.telegram.org/bot${TOKEN}/setWebhook?url=https://jaas-bot.vercel.app/webhook"
```

**Cost:** Free (100GB bandwidth, 100 builds/day)

---

### Option 3: Railway/Render (Container)

**How it works:**
- Bot runs in Docker container
- Always-on process
- Simple deployment

**Pros:**
- Always-on (no cold starts)
- Simple Git-based deployment
- Good free tiers

**Cons:**
- Need to manage process
- Sleep mode on free tiers (Railway)

**Setup:**
```bash
# Railway
railway login
railway init
railway run npm start

# Render
# Connect GitHub repo, set start command
```

**Cost:** 
- Railway: $5/month free credit
- Render: Free tier available

---

### Option 4: Your Mac Studio (PM2)

**How it works:**
- Run bot locally with PM2
- Bot restarts on crash
- Use ngrok for webhook

**Pros:**
- No hosting cost
- Full control
- Already running OpenClaw

**Cons:**
- Depends on your Mac being online
- Need ngrok for webhooks
- Power/network issues

**Setup:**
```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start jaas-bot/dist/index.js --name jaas-bot

# Keep alive
pm2 startup
pm2 save
```

---

## Recommendation for JaaS

### Start With: OpenClaw Agent

**Why:**
- Already running
- No additional infrastructure
- Can use existing JaaS scripts
- Zero cost

**Later Add:** Vercel (if volume grows)

---

## OpenClaw Agent Implementation

### 1. Bot Token

```bash
# Create bot via @BotFather
/newbot
Name: JaaS Bot
Username: JaaasBot

# Save token to keychain
security add-generic-password -s "jaas_bot_token" -a "agenticbro" -w "123456:ABC..."
```

### 2. Bot Code (Simple Polling)

```typescript
// jaas-bot/src/index.ts
import { Telegraf } from 'telegraf'

const bot = new Telegraf(process.env.JAAS_BOT_TOKEN!)

bot.command('start', (ctx) => {
  ctx.reply(`
🤖 Welcome to JaaS Bot!

AI-powered Telegram moderation.

/subscribe - Start onboarding
/status - Check your instance
/help - Get help
  `)
})

bot.command('subscribe', (ctx) => {
  // Start onboarding flow
  ctx.reply('Step 1: What\'s your Telegram group ID?')
})

bot.on('text', async (ctx) => {
  // Handle onboarding steps
  const text = ctx.message.text
  
  // ... onboarding logic
})

// Export for OpenClaw
export { bot }
```

### 3. Run via OpenClaw Cron

```json
{
  "name": "jaas-bot",
  "schedule": { "kind": "every", "everyMs": 5000 },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "Run JaaS bot polling loop.\n\nExecute:\nsource /Users/efinney/.openclaw/workspace/scripts/keychain-env.sh\ncd /Users/efinney/.openclaw/workspace/jaas-bot && npm run poll",
    "model": "ollama/granite4.1:3b",
    "timeoutSeconds": 30
  }
}
```

### 4. Or Use Webhook (Better)

```typescript
// For Vercel/webhook deployment
// Webhook endpoint receives updates from Telegram

export default async function webhook(req, res) {
  if (req.method === 'POST') {
    const update = req.body
    bot.handleUpdate(update)
    res.status(200).send('OK')
  }
}
```

---

## Quick Comparison

| Option | Cost | Uptime | Speed | Setup Time |
|--------|------|--------|-------|------------|
| OpenClaw Agent | Free | 99% (your Mac) | Fast | 30 min |
| Vercel | Free | 99.9% | Fast (after cold start) | 30 min |
| Railway | $5/mo | 99.9% | Fast | 20 min |
| Your Mac | Free | 95% | Fast | 10 min |

---

## My Recommendation

**Phase 1 (Now):** OpenClaw Agent
- Quickest to implement
- Zero cost
- Already have infrastructure

**Phase 2 (If volume grows):** Vercel
- Better uptime
- Webhooks (instant)
- Scales automatically

---

## Next Steps

If you want me to build this:

1. Create bot via @BotFather (5 min)
2. Give me bot token
3. I create the bot code (~1 hour)
4. We deploy via OpenClaw cron (10 min)

Total: **~1.5 hours** (not 5 hours I estimated earlier — simpler with OpenClaw)

---

Want me to proceed? 🔐