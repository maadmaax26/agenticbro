# JaaS — Pricing & Payment

## Pricing (USDC)

| Tier | Price | Groups | Features |
|------|-------|--------|----------|
| **Starter** | $25/month USDC | 1 group | Full moderation |
| **Pro** | $99/month USDC | 3 groups | Priority support |
| **Enterprise** | $299/month USDC | Unlimited | Custom bot, API |

---

## Payment Flow

### 1. Client Subscribes via Bot

```
User: /start
Bot: Shows pricing ($25, $99, $299)

User: /subscribe
Bot: "Select plan: 1, 2, or 3"

User: 1
Bot: "Enter group ID"

User: -1001234567890
Bot: "Enter wallet for payment"

User: 7xKX...
Bot: "Send $25 USDC to [wallet]"

User: done
Bot: "Confirm?"

User: confirm
Bot: "Submitted! Add @Jeeevs222_bot to your group"
```

### 2. Admin Verifies Payment

```
Admin receives notification:
- User: @handle
- Plan: Starter ($25/month)
- Group: -100XXX
- Wallet: 7xKX...

Admin verifies USDC payment on-chain
```

### 3. Admin Creates Instance

```bash
./scripts/admin/create-instance.sh \
  --name "Client" \
  --group-id "-100XXX" \
  --tier "starter" \
  --wallet "7xKX..."
```

### 4. Client Adds Bot

```
Client adds @Jeeevs222_bot to group
Client grants admin role
Group is protected 24/7
```

---

## Revenue Model

| Metric | Value |
|--------|-------|
| **Starter** | $25/month = $300/year |
| **Pro** | $99/month = $1,188/year |
| **Enterprise** | $299/month = $3,588/year |
| **Break-even** | ~10 clients = $250/month |

---

## Payment Wallet

**Set up a Solana wallet for USDC payments:**

1. Create wallet: `solana-keygen new`
2. Get USDC address
3. Add to `src/index.ts`:
   ```typescript
   const PAYMENT_WALLET = 'YOUR_USDC_WALLET_HERE'
   ```

---

## Verification

Payments are verified on-chain:

```bash
# Check USDC balance for wallet
curl -X POST https://api.mainnet-beta.solana.com \
  -d '{"jsonrpc":"2.0","id":1,"method":"getTokenAccountsByOwner","params":["WALLET",{"mint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"},{"encoding":"jsonParsed"}]}'
```

---

## Monthly Billing

- Payments are monthly
- Bot sends renewal reminders
- Admin verifies before each month
- Suspended if not renewed

---

**JaaS — Revenue stream from day one. 🔐**