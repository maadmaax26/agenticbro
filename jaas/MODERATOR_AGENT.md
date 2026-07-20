# Group Moderator Engagement Agent — Implementation Guide

**Zero API cost Telegram moderation powered by local Ollama models**

---

## Quick Start

### 1. Create a Group Instance

```bash
cd /Users/efinney/.openclaw/workspace/group-moderator-agent

# Free instance (Agentic Bro community)
./scripts/create-instance.sh \
  --group-id -1001234567890 \
  --name "My Project"

# Token-gated instance (external projects)
./scripts/create-instance.sh \
  --group-id -1001234567890 \
  --name "Client Project" \
  --token-gated \
  --wallet 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

### 2. Verify Token Gate

```bash
./scripts/token-check.sh check <wallet-address> 100000
```

### 3. Run Moderation

```bash
# Manual run
./scripts/moderator-agent.sh run -1001234567890

# Check status
./scripts/moderator-agent.sh status -1001234567890
```

### 4. Add to Cron (OpenClaw)

Add a cron job to run moderation every 5 minutes:

```bash
openclaw cron add \
  --name "moderator-myproject" \
  --schedule "every 5m" \
  --session-target "isolated" \
  --model "ollama/granite4.1:3b"
```

The cron payload should run:
```bash
bash /Users/efinney/.openclaw/workspace/group-moderator-agent/scripts/moderator-agent.sh run -1001234567890
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Bot API                          │
│                   (Jeeevs222_bot)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenClaw Cron (every 5 minutes)                 │
│           Model: granite4.1:3b (local, $0)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 moderator-agent.sh                           │
│  • Load group config                                         │
│  • Verify token gate (if applicable)                         │
│  • Run local model for moderation tasks                      │
│  • Post responses via Telegram API                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Group Configuration (JSON)                      │
│  • config/groups/agentic-bro.json                           │
│  • config/groups/client-project.json                        │
│  • config/token-gating.json                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Token Gating Flow

### For External Projects

```
┌─────────────────┐
│ Project applies │
│ for moderator   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Provide wallet  │────▶│ Token Check     │
│ address         │     │ (100K $AGNTCBRO)│
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
          ┌─────────────────┐       ┌─────────────────┐
          │ HOLDINGS MET    │       │ HOLDINGS LOW    │
          │ ✅ Create       │       │ ❌ Require:     │
          │ instance        │       │ • $99/month OR  │
          └─────────────────┘       │ • 500K tokens   │
                                    └─────────────────┘
```

### Verification Methods

1. **On-chain check** — Query Solana RPC for token balance (free, instant)
2. **Cached check** — Store result for 24 hours to reduce RPC calls
3. **Allowlist** — Manual admin approval for trusted partners

---

## OpenClaw Cron Integration

### Create Cron Job for a Group

Use the `cron` tool to create a scheduled moderator run:

```json
{
  "name": "moderator-agentic-bro",
  "schedule": {
    "kind": "every",
    "everyMs": 300000
  },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "Run group moderation for Agentic Bro.\n\nExecute:\nbash /Users/efinney/.openclaw/workspace/group-moderator-agent/scripts/moderator-agent.sh run -1003751594817\n\nIf no action needed, reply: NO_REPLY",
    "model": "ollama/granite4.1:3b",
    "timeoutSeconds": 60,
    "toolsAllow": ["exec"]
  }
}
```

### Create via CLI

```bash
# Add moderator cron for new group
openclaw cron add moderator-myproject \
  --every 5m \
  --model granite4.1:3b \
  --command "bash /workspace/group-moderator-agent/scripts/moderator-agent.sh run -1001234567890"
```

---

## API for External Projects

### Endpoint: Create Instance

**POST** `/api/moderator/create`

```json
{
  "groupId": "-1001234567890",
  "name": "Client Project",
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "tier": "token-hold"
}
```

**Response:**
```json
{
  "success": true,
  "instance": {
    "id": "moderator-client-project",
    "groupId": "-1001234567890",
    "status": "active",
    "tokenGate": "verified",
    "holdings": 150000
  }
}
```

### Endpoint: Verify Token Gate

**POST** `/api/moderator/verify`

```json
{
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "minimum": 100000
}
```

**Response:**
```json
{
  "verified": true,
  "holdings": 150000,
  "minimum": 100000,
  "cachedUntil": "2026-06-12T12:00:00Z"
}
```

---

## Pricing Tiers

| Tier | Price | Features | Limits |
|------|-------|----------|--------|
| **Token Hold** | 100K $AGNTCBRO | Full moderation | 1 group |
| **Pro** | $99/mo or 500K tokens | Multi-group, priority support | 3 groups |
| **Enterprise** | $299/mo or 1.5M tokens | Unlimited, custom training, API | Unlimited |

---

## File Structure

```
group-moderator-agent/
├── README.md                    # Overview and features
├── MODERATOR_AGENT.md          # This file — implementation guide
├── config/
│   ├── token-gating.json       # Pricing and verification rules
│   └── groups/
│       ├── agentic-bro.json    # Agentic Bro group config
│       └── scam-scans.json     # Scam Scans group config
├── scripts/
│   ├── moderator-agent.sh      # Main moderation runner
│   ├── token-check.sh          # Token gate verification
│   └── create-instance.sh      # Create new group instance
└── templates/
    ├── welcome.md              # Welcome message templates
    ├── engagement.md           # Engagement tips and prompts
    └── spam-alert.md           # Spam/scam alert templates
```

---

## Models

| Model | Size | Response Time | Use Case |
|-------|------|---------------|----------|
| granite4.1:3b | 2.1GB | ~1-2s | Primary moderation, engagement |
| qwen3:1.7b | 4.9GB | ~0.1-0.4s | Fast greetings, quick replies |

**Cost:** $0 (local Ollama)

---

## Next Steps

1. ✅ Core framework created
2. ✅ Token gating verification
3. ✅ Per-group configuration
4. ✅ Templates for welcome/engagement/alerts
5. ⏳ OpenClaw cron integration (add jobs per group)
6. ⏳ API endpoints for external projects
7. ⏳ Subscription management dashboard

---

**Built by Agentic Bro — Scan first, trust later! 🔐**