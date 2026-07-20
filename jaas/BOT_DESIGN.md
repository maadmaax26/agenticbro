# JaaS Telegram Bot — Onboarding & Setup Bot

## Overview

A Telegram bot that handles client onboarding, wallet verification, and instance creation automatically — no manual work for you.

---

## What the Bot Does

### For Clients
1. `/start` — Introduction and pricing
2. `/subscribe` — Start onboarding flow
3. Enter group ID
4. Enter wallet address
5. Bot verifies holdings automatically
6. Bot provides instructions to add @Jeeevs222_bot
7. `/status` — Check instance status
8. `/help` — Support

### For You (Admin)
1. Auto-verification of holdings
2. Auto-creation of instances
3. Auto-monitoring of wallets
4. Auto-pause when holdings drop
5. Notifications when action needed

---

## Bot Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT                             │
│                   (@JaaasBot)                               │
│                                                             │
│  Commands:                                                  │
│  /start     - Welcome & pricing                            │
│  /subscribe - Start onboarding                             │
│  /status    - Check your instance                          │
│  /help      - Support                                     │
│                                                             │
│  Flow:                                                      │
│  1. User sends /subscribe                                  │
│  2. Bot asks for group ID                                  │
│  3. Bot asks for wallet address                            │
│  4. Bot verifies holdings (Solana RPC)                     │
│  5. Bot creates instance OR shows error                   │
│  6. Bot provides setup instructions                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    JaaS SYSTEM                              │
│                                                             │
│  Files:                                                     │
│  • config/instances/<id>/config.json                       │
│  • config/instances.json                                   │
│  • scripts/admin/create-instance.sh                        │
│  • scripts/admin/verify-all.sh                             │
│                                                             │
│  Cron:                                                      │
│  • Every 24h: verify-all.sh                                │
│  • Every 5m: moderator-agent.sh (per instance)            │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Options

### Option 1: Separate Bot (Recommended)

**Create a new bot:** @JaaasBot (or similar)

**Pros:**
- Clean separation from @Jeeevs222_bot (moderation bot)
- Focused on onboarding/setup only
- Easier to maintain
- Can have different rate limits

**Cons:**
- Need to create and host another bot

### Option 2: Add to Existing Bot

**Add commands to @Jeeevs222_bot**

**Pros:**
- Single bot
- No extra hosting

**Cons:**
- Mixes moderation with onboarding
- More complex logic
- Harder to maintain

---

## Required Components

### 1. Bot Token

```bash
# Create bot via @BotFather
/newbot
Name: JaaS Bot
Username: JaaasBot

# Returns token like:
# 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 2. Bot Code (Node.js/Python)

**Framework:** Telegraf (Node.js) or python-telegram-bot

**Structure:**
```
jaas-bot/
├── src/
│   ├── index.ts          # Bot entry point
│   ├── commands/
│   │   ├── start.ts      # /start command
│   │   ├── subscribe.ts  # /subscribe flow
│   │   ├── status.ts     # /status command
│   │   └── help.ts       # /help command
│   ├── handlers/
│   │   ├── onboarding.ts # Handle onboarding flow
│   │   └── wallet.ts     # Wallet verification
│   └── utils/
│       ├── solana.ts     # Solana RPC calls
│       └── config.ts     # JaaS config management
├── package.json
└── tsconfig.json
```

### 3. Hosting

**Options:**
- **OpenClaw Agent** — Run as agentTurn task (easiest)
- **Vercel** — Serverless functions
- **Railway/Render** — Always-on container
- **Your Mac Studio** — PM2/systemd

---

## Bot Flow (Detailed)

### /start
```
Bot: Welcome to JaaS! 🤖

AI-powered Telegram moderation with zero API costs.

Pricing:
• Token Hold: $25 worth of $AGNTCBRO (1 group)
• Pro: $99/mo (3 groups)
• Enterprise: $299/mo (unlimited)

Commands:
/subscribe - Start onboarding
/status - Check your instance
/help - Get help

Ready to protect your community? Type /subscribe
```

### /subscribe
```
Bot: Let's set up JaaS for your group! 🚀

Step 1/3: What's your Telegram group ID?

How to find it:
1. Add @Jeeevs222_bot to your group
2. Send a message
3. Forward the message to this chat
4. I'll extract the group ID

Or enter it manually (format: -1001234567890)
```

### User enters group ID
```
Bot: ✅ Group ID: -1001234567890

Step 2/3: What's your Solana wallet address?

This is the wallet holding your $AGNTCBRO tokens.

Example: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

### User enters wallet
```
Bot: 🔍 Verifying wallet...

[Query Solana RPC]

Bot: ✅ Verified!

Wallet: 7xKX...gAsU
Balance: 150,000 $AGNTCBRO (~$30)
Minimum: 125,000 $AGNTCBRO ($25)

You qualify for the Token Hold tier! 🎉

Step 3/3: Confirm your details:

Group: -1001234567890
Wallet: 7xKX...gAsU
Tier: Token Hold (1 group)

Type "confirm" to proceed, or "cancel" to abort.
```

### User confirms
```
Bot: 🎉 Setting up your JaaS instance...

[Create instance via scripts/admin/create-instance.sh]

Bot: ✅ Instance created!

Your JaaS instance is ready.

NEXT STEPS:

1. Add @Jeeevs222_bot to your group
2. Grant admin permissions to the bot
3. Your group is now protected 24/7!

INSTANCE DETAILS:
• Name: [Your Group Name]
• Group ID: -1001234567890
• Status: Active
• Tier: Token Hold

Use /status anytime to check your instance.

Questions? Contact @maadmaax22
```

### /status
```
Bot: 📊 JaaS Instance Status

Instance: [Group Name]
Group ID: -1001234567890
Tier: Token Hold
Status: ✅ Active

Wallet: 7xKX...gAsU
Balance: 150,000 $AGNTCBRO
Last Verified: 2 hours ago

Next Verification: 22 hours

Your group is protected! 🔐
```

---

## Admin Commands (You Only)

### /admin list
```
Bot: 📋 JaaS Instances

1. Client A (-100XXX) - Token Hold - ✅ Active
2. Client B (-100YYY) - Pro - ✅ Active
3. Client C (-100ZZZ) - Token Hold - ⚠️ Low Balance

3 instances total
```

### /admin verify-all
```
Bot: 🔄 Running verification for all instances...

✅ Client A: 150,000 tokens
✅ Client B: Pro (no verification needed)
⚠️ Client C: 80,000 tokens (paused)

2 active, 1 paused
```

---

## Code Structure (Telegraf)

```typescript
// src/index.ts
import { Telegraf } from 'telegraf'
import { message } from 'telegraf/filters'

const bot = new Telegraf(process.env.JAAS_BOT_TOKEN!)

// Commands
bot.command('start', require('./commands/start'))
bot.command('subscribe', require('./commands/subscribe'))
bot.command('status', require('./commands/status'))
bot.command('help', require('./commands/help'))

// Admin commands
bot.command('admin', require('./commands/admin'))

// Onboarding flow
bot.on('text', require('./handlers/onboarding'))

bot.launch()
```

---

## Estimated Effort

| Task | Time |
|------|------|
| Create bot via @BotFather | 5 min |
| Set up project structure | 30 min |
| Write command handlers | 2-3 hours |
| Integrate Solana verification | 1 hour |
| Integrate JaaS scripts | 1 hour |
| Testing | 1 hour |
| **Total** | **5-6 hours** |

---

## Quick Start

If you want me to build this now:

1. Create bot via @BotFather
2. Give me the bot token
3. I'll create the bot code
4. We host it (OpenClaw agent or Vercel)

---

## Alternative: Web Form

Instead of a bot, add a form to agenticbro.app/jaas:

```
Name: [Your Name]
Telegram: [@handle]
Group ID: [-100...]
Wallet: [7xKX...]
Email: [optional]

[Submit Request]
```

**Then:**
1. Form submits to your DM
2. You verify and create instance
3. You DM client with instructions

**Pros:** Simpler, no bot needed
**Cons:** Not instant, manual approval

---

Which approach do you prefer?

1. **Telegram Bot** — Full automation, instant setup
2. **Web Form + Manual** — Simpler, you approve each
3. **Both** — Web form for info, bot for status

🔐