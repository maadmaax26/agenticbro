# JaaS Bot — Telegram Onboarding Bot

## Setup

### 1. Install Dependencies

```bash
cd /Users/efinney/.openclaw/workspace/jaas-bot
npm install
```

### 2. Run Bot

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 3. Test Bot

1. Open Telegram
2. Search for @JeeevsAI_bot
3. Send `/start`

---

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome + pricing |
| `/subscribe` | Start onboarding |
| `/status` | Check instance status |
| `/help` | Help information |
| `/cancel` | Cancel onboarding |
| `/admin list` | List instances (admin only) |
| `/admin verify <wallet>` | Verify wallet (admin only) |

---

## Onboarding Flow

```
User: /start
Bot: Welcome + pricing

User: /subscribe
Bot: "Step 1: What's your group ID?"

User: -1001234567890
Bot: "Step 2: What's your wallet?"

User: 7xKX...
Bot: [Verifies wallet]
      "Step 3: Confirm?"

User: confirm
Bot: "✅ Instance created!"
      [Notifies admin]
```

---

## Admin Commands

### /admin list
Lists all JaaS instances

### /admin verify <wallet>
Verifies wallet holdings

### /admin help
Shows admin commands

---

## Files

```
jaas-bot/
├── src/
│   └── index.ts        # Bot logic
├── package.json
└── tsconfig.json
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `JAAS_BOT_TOKEN` | Bot token from @BotFather |

---

## Running via OpenClaw

Add to OpenClaw cron:

```json
{
  "name": "jaas-bot",
  "schedule": { "kind": "every", "everyMs": 5000 },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "Run JaaS bot polling.\n\nExecute:\ncd /Users/efinney/.openclaw/workspace/jaas-bot && npm run poll",
    "model": "ollama/granite4.1:3b",
    "timeoutSeconds": 30
  }
}
```

---

## Webhook Mode (Alternative)

For production, use webhooks instead of polling:

```typescript
// For Vercel/serverless
export default async function webhook(req, res) {
  if (req.method === 'POST') {
    await bot.handleUpdate(req.body)
    res.status(200).send('OK')
  }
}
```

---

## Bot Token

Current bot: @JeeevsAI_bot
Token stored in code (for development)

For production, store in:
- Environment variable: `JAAS_BOT_TOKEN`
- Keychain: `security add-generic-password -s "jaas_bot_token" -a "agenticbro" -w "..."`

---

**JaaS Bot — Automated onboarding. 🔐**