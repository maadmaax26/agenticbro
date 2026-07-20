# Client Onboarding Flow

## What Client Provides

1. **Telegram Group ID** — The group to moderate
2. **Wallet Address** — Solana wallet holding $AGNTCBRO
3. **Telegram Handle** — Contact for notifications

---

## Verification Process

### Step 1: Client Provides Info

```
Client: "I want JaaS for my group"
  - Group ID: -1001234567890
  - Wallet: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
  - Telegram: @client_handle
```

### Step 2: You Verify Holdings

```bash
# Option 1: Use the verification tool on agenticbro.app/jaas
# Enter wallet address → Instant verification

# Option 2: Use the API
curl -X POST https://agenticbro.app/api/jaas/verify-wallet \
  -H "Content-Type: application/json" \
  -d '{"wallet": "7xKX..."}'

# Response:
{
  "verified": true,
  "balance": 150000,
  "minimum": 125000,
  "message": "Wallet verified: 150,000 $AGNTCBRO"
}
```

### Step 3: Create Instance

```bash
cd /Users/efinney/.openclaw/workspace/jaas

./scripts/admin/create-instance.sh \
  --name "Client Project" \
  --group-id "-1001234567890" \
  --owner-telegram "@client_handle" \
  --tier "token-hold" \
  --wallet "7xKX..."
```

### Step 4: Client Adds Bot

Tell client:
> "Add @Jeeevs222_bot to your group and grant admin permissions"

### Step 5: Add Cron Job

```bash
# Via OpenClaw cron tool
```

---

## Ongoing Monitoring

### Automatic Verification (Every 24 Hours)

The `verify-all.sh` script runs daily via cron:

```bash
./scripts/admin/verify-all.sh
```

**What it does:**
1. Checks every token-gated instance
2. Verifies wallet holdings via Solana RPC
3. Pauses instances where holdings < $25
4. Notifies you and client

**If holdings drop:**
```
❌ FAIL — Balance: 100,000 < 125,000
⏸️  Instance paused: client-project
```

**Client notification:**
> "Your JaaS instance has been paused due to insufficient $AGNTCBRO holdings. Add tokens to resume service."

---

## Pricing Reference

| Tier | Requirement | Minimum Tokens | USD Value |
|------|-------------|----------------|-----------|
| Token Hold | $25 worth | 125,000 | ~$25 |
| Pro | $99/mo | — | $99/month |
| Enterprise | $299/mo | — | $299/month |

*Assumes $AGNTCBRO ≈ $0.0002*

---

## Verification API

### Endpoint

```
POST /api/jaas/verify-wallet
```

### Request

```json
{
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

### Response (Success)

```json
{
  "verified": true,
  "balance": 150000,
  "minimum": 125000,
  "wallet": "7xKX...",
  "contract": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
  "message": "Wallet verified: 150,000 $AGNTCBRO"
}
```

### Response (Fail)

```json
{
  "verified": false,
  "balance": 50000,
  "minimum": 125000,
  "wallet": "7xKX...",
  "message": "Insufficient holdings: 50,000 < 125,000"
}
```

---

## Security

- **No private keys** — Only public wallet address needed
- **On-chain verification** — Direct Solana RPC query
- **No API keys** — Public blockchain data
- **Cached 24h** — Reduces RPC calls

---

**JaaS — Verified and secure. 🔐**