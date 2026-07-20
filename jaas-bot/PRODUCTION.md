# JaaS Bot — Production Ready

## Bot: @JeeevsAI_bot

**Payment Wallet:** `BDXMYzf9wQk7Qngd38prMVLfQh2H2nXzA4TJdYKaMHqA`

---

## Pricing

| Tier | Price | Groups |
|------|-------|--------|
| **Starter** | $25/month USDC | 1 group |

---

## Onboarding Flow

```
User: /start
Bot: Welcome + $25/month pricing

User: /subscribe
Bot: "Step 1/3: Enter group ID"

User: -1001234567890
Bot: "Step 2/3: Enter wallet"

User: 7xKX...
Bot: "Step 3/3: Send $25 USDC to BDXMY..."

User: done
Bot: "Confirm?"

User: confirm
Bot: "✅ Submitted!"
     [Admin notified]
```

---

## Payment Flow

1. User sends $25 USDC to: `BDXMYzf9wQk7Qngd38prMVLfQh2H2nXzA4TJdYKaMHqA`
2. Admin verifies on-chain
3. Admin creates instance
4. User adds @Jeeevs222_bot to group

---

## Commands

| Command | Action |
|---------|--------|
| `/start` | Welcome + pricing |
| `/subscribe` | Start onboarding |
| `/status` | Check instance |
| `/help` | Help |
| `/cancel` | Cancel onboarding |

---

## Run Bot

```bash
cd /Users/efinney/.openclaw/workspace/jaas-bot
npm start
```

---

## Files

```
jaas-bot/
├── src/index.ts      # Bot code
├── dist/             # Compiled JS
├── package.json
└── tsconfig.json
```

---

**JaaS Bot — $25/month USDC revenue stream. 🔐**