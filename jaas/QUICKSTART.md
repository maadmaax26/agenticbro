# Quick Start Guide — Deploying to External Projects (Revised)

## Core Principle

**You control the bot. Client controls only admin role.**

- **You** create and hold all bot tokens
- **Client** adds @Jeeevs222_bot to their group and grants admin
- **Client** can remove admin to revoke access
- **You** can re-enable if client re-adds

---

## Deployment Process

### Step 1: Client Onboarding

Client provides:
- Telegram group ID
- Wallet address (for token gate)
- Contact info (Telegram handle, email)

### Step 2: You Create Instance

```bash
cd /Users/efinney/.openclaw/workspace/jaas

./scripts/admin/create-instance.sh \
  --name "Client Project" \
  --group-id "-1001234567890" \
  --owner-telegram "@client_handle" \
  --tier "token-hold" \
  --wallet "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
```

**Output:**
```
✅ Token gate verified: 150000 $AGNTCBRO
✅ Instance directory created
✅ Registry updated

Instance Details:
  Name:      Client Project
  Group ID:  -1001234567890
  Tier:      token-hold
  Model:     granite4.1:3b
  Bot:       @Jeeevs222_bot
  Owner:     @client_handle
  Wallet:    7xKX...

Next steps:
  1. Tell client to add @Jeeevs222_bot to their group
  2. Client grants admin role to the bot
  3. Add cron job via OpenClaw
```

### Step 3: Client Adds Bot

Tell client:
> "Add @Jeeevs222_bot to your Telegram group and grant it admin permissions. The bot will begin moderation automatically."

Client actions:
1. Go to group settings
2. Add members → @Jeeevs222_bot
3. Grant admin role

### Step 4: You Add Cron Job

```bash
# Add via OpenClaw cron
```

---

## Access Control

| Action | Who Controls | How |
|--------|--------------|-----|
| **Create instance** | You only | Admin script |
| **Bot token** | You only | Stored in your `.env` |
| **Configuration** | You only | Admin config files |
| **Add bot to group** | Client | Telegram group settings |
| **Grant admin** | Client | Telegram group settings |
| **Revoke access** | Client | Remove admin role |
| **Delete instance** | You only | Admin script |

---

## Revocation Flow

### Client Revokes Access (removes admin role)

1. Client removes admin role from @Jeeevs222_bot
2. Bot can no longer read/send messages
3. Instance remains configured (you can re-enable)
4. Cron job continues running but gets errors

**Detection:**
```
❌ Telegram API error: Forbidden: bot was kicked from the supergroup chat
⚠️  Bot may have been removed from group or admin role revoked
   Client needs to re-add @Jeeevs222_bot and grant admin
```

### Client Re-adds Bot

1. Client re-adds @Jeeevs222_bot
2. Grants admin role
3. Bot resumes moderation automatically
4. No config changes needed

### You Delete Instance

```bash
./scripts/admin/delete-instance.sh --id "client-project"
```

1. Config archived
2. Registry updated
3. Cron job removed
4. Bot remains in group but does nothing

---

## Enterprise: Custom Bot (Optional)

For Enterprise clients who want branded bot:

1. **You** create bot via @BotFather
2. **You** hold the token (add to master `.env`)
3. Client sees branded bot (e.g., `@ClientModBot`)
4. Client still only controls admin role

**Setup:**
```bash
# Add to your master .env
echo "BOT_TOKEN_CLIENT_A=789012:DEF..." >> /Users/efinney/.openclaw/workspace/.env

# Create instance with custom bot
./scripts/admin/create-instance.sh \
  --name "Client A" \
  --group-id "-100XXX" \
  --custom-bot-token-var "BOT_TOKEN_CLIENT_A" \
  --tier "enterprise"
```

**You still control the token.** Client cannot revoke or modify it.

---

## Security Summary

| Layer | Protection |
|-------|------------|
| **Bot tokens** | You hold ALL tokens in your `.env` |
| **Configuration** | Only your Telegram ID can modify |
| **Client control** | Add/remove admin role only |
| **Revocation** | Client removes admin → bot stops, config stays |
| **Recovery** | Client re-adds admin → bot resumes |
| **Token gate** | Auto-verified, auto-pause if fails |

---

## Pricing Reminder

| Tier | Requirement | Features |
|------|-------------|----------|
| **Token Hold** | 100K $AGNTCBRO | 1 group, @Jeeevs222_bot |
| **Pro** | $99/mo or 500K tokens | 3 groups, @Jeeevs222_bot |
| **Enterprise** | $299/mo or 1.5M tokens | Unlimited, custom bot option |

---

## Quick Commands

```bash
# List all instances
./scripts/admin/list-instances.sh

# Create new instance
./scripts/admin/create-instance.sh --name "X" --group-id "-100XXX" --tier pro --wallet "7xKX..."

# Delete instance
./scripts/admin/delete-instance.sh --id "instance-id"

# Verify all token gates
./scripts/admin/verify-all.sh
```

---

**Built by Agentic Bro — Scan first, trust later! 🔐**