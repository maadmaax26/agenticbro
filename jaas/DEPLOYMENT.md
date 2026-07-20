# Multi-Tenant Deployment Architecture (Revised)

## Core Principle

**You control ALL bot tokens.** Clients only manage admin role in their group — they cannot revoke your access to the bot configuration.

---

## Bot Token Strategy

### One Bot, Multiple Groups (Recommended)

Use **Jeeevs222_bot** for ALL instances. Clients add it to their group and give it admin role.

**Pros:**
- Single token to manage
- You control the bot identity
- Clients can only remove admin (can't revoke the token)
- All moderation runs through your trusted bot

**Cons:**
- Shared bot identity (clients see "Jeeevs222_bot")

### Multiple Bots (Alternative)

Create separate bots via @BotFather, but **you hold all tokens**.

**Pros:**
- Each client sees their branded bot
- Can white-label for Enterprise tier

**Cons:**
- More tokens to manage
- Client can ask you to reveal token (but you control it)

---

## Architecture (Recommended: Single Bot)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MASTER ADMIN (You)                           │
│                 Single Control Interface                         │
│  • Create/delete instances                                       │
│  • Manage all configurations                                     │
│  • Hold all bot tokens                                           │
│  • Token gate verification                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BOT INSTANCE MANAGER                          │
│                  (OpenClaw Agent)                                │
│                                                                  │
│  Uses: @Jeeevs222_bot (YOUR bot)                                │
│  Token: Stored securely in your .env                             │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │  Group #1     │ │  Group #2     │ │  Group #3     │
    │  Agentic Bro  │ │  Client A     │ │  Client B     │
    │               │ │               │ │               │
    │ Bot: Jeeevs   │ │ Bot: Jeeevs   │ │ Bot: Jeeevs   │
    │ Admin: ✅     │ │ Admin: ✅     │ │ Admin: ✅     │
    └───────────────┘ └───────────────┘ └───────────────┘
```

---

## Client Control Model

| Action | Who Controls | How |
|--------|--------------|-----|
| **Create instance** | You only | Admin script |
| **Configure bot** | You only | Admin config files |
| **Bot token** | You only | Never shared |
| **Add bot to group** | Client | Add @Jeeevs222_bot |
| **Grant admin role** | Client | Telegram group settings |
| **Revoke access** | Client | Remove admin role |
| **Delete instance** | You only | Admin script |

**Key insight:** Client can remove admin role, but they CANNOT:
- Access the bot token
- Modify bot configuration
- Stop you from re-adding the bot
- Access other groups' configs

---

## Deployment Flow

### Step 1: Client Onboarding

1. Client provides:
   - Telegram group ID
   - Wallet address (for token gate)
   - Contact info

2. You verify:
   - Token gate (100K+ $AGNTCBRO)
   - Group exists

3. You create instance:
   ```bash
   ./scripts/admin/create-instance.sh \
     --name "Client Project" \
     --group-id "-1001234567890" \
     --use-jeeevs-bot \
     --tier "token-hold" \
     --wallet "7xKX..."
   ```

### Step 2: Client Adds Bot

1. You tell client: "Add @Jeeevs222_bot to your group and give it admin role"
2. Client adds bot: `@Jeeevs222_bot`
3. Client grants admin permissions
4. Bot begins moderation

### Step 3: Ongoing Control

- **Client can remove admin** → Bot stops working in that group
- **You can re-add** → If client wants to resume, they add admin again
- **You can delete instance** → Permanently remove config
- **Client CANNOT access bot token** → Full control stays with you

---

## Security Model

### You Control
- ✅ Bot token (@Jeeevs222_bot)
- ✅ All configurations
- ✅ Instance creation/deletion
- ✅ Token gate verification
- ✅ Cron jobs

### Client Controls
- ✅ Admin role in their group (add/remove)
- ✅ Group settings
- ✅ Member management

### Client CANNOT Access
- ❌ Bot token
- ❌ Other groups' configs
- ❌ Admin scripts
- ❌ Instance registry

---

## Revocation Scenarios

### Scenario 1: Client Removes Admin Role
- Bot stops receiving messages from that group
- Config remains (you can re-enable if client re-adds)
- No data breach (isolated config)

### Scenario 2: You Delete Instance
- Config archived
- Cron job removed
- Bot remains in group but does nothing
- Client can still see @Jeeevs222_bot but it won't respond

### Scenario 3: Token Gate Fails
- Instance auto-pauses
- Client notified
- You notified
- Instance resumes when holdings restored

---

## Implementation Changes

### Instance Config (Revised)

```json
{
  "id": "client-project-a",
  "name": "Client Project A",
  "groupId": "-1001234567890",
  "botSource": "jeeevs",
  "botUsername": "Jeeevs222_bot",
  "enabled": true,
  "tier": "token-hold",
  "tokenGate": {
    "required": true,
    "wallet": "7xKX...",
    "minimumHoldings": 100000
  }
}
```

**No per-instance `.env` needed** — single bot token used for all.

### Admin Create Script (Revised)

```bash
./scripts/admin/create-instance.sh \
  --name "Client Project" \
  --group-id "-1001234567890" \
  --use-jeeevs-bot \
  --tier "token-hold" \
  --wallet "7xKX..."
```

**No `--bot-token` argument** — always uses your bot.

### Instance Runner (Revised)

```bash
# Loads single bot token from master .env
source /Users/efinney/.openclaw/workspace/.env

# Uses group ID from instance config
BOT_TOKEN=$TELEGRAM_BOT_TOKEN  # Single token for all
GROUP_ID=$(jq -r '.groupId' "$INSTANCE_CONFIG")
```

---

## Multi-Bot Option (Enterprise)

For Enterprise clients who want white-label:

1. Create new bot via @BotFather
2. **You hold the token** (stored in your master .env)
3. Client sees branded bot (e.g., `@ClientModBot`)
4. Client can still only add/remove admin

**Implementation:**
```bash
# Master .env (you control)
TELEGRAM_BOT_TOKEN=123456:ABC...  # Jeeevs222_bot
BOT_TOKEN_CLIENT_A=789012:DEF...   # Client A's branded bot
BOT_TOKEN_CLIENT_B=345678:GHI...   # Client B's branded bot
```

```bash
# Create instance with custom bot
./scripts/admin/create-instance.sh \
  --name "Client A" \
  --group-id "-100XXX" \
  --custom-bot-token-var "BOT_TOKEN_CLIENT_A" \
  --tier "enterprise"
```

---

## Summary

| Aspect | Implementation |
|--------|----------------|
| **Bot tokens** | You hold ALL tokens, never shared |
| **Default bot** | @Jeeevs222_bot for all groups |
| **Client control** | Add/remove admin role only |
| **Revocation** | Client removes admin → bot stops, config stays |
| **Recovery** | Client re-adds admin → bot resumes |
| **White-label** | Optional for Enterprise (you still hold token) |

---

**Built by Agentic Bro — Scan first, trust later! 🔐**