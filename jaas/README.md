# Jeeevs as a Service (JaaS)

**AI-powered Telegram moderation as a service. Zero API cost. Token-gated access.**

---

## Overview

A self-hosted moderation agent that:
- Uses local Ollama models (granite4.1:3b, qwen3:1.7b) — **$0 API cost**
- Engages with community members naturally
- Detects spam, scams, and FUD automatically
- Supports multiple Telegram groups with per-project configuration
- **Token-gated access:** External projects must hold $AGNTCBRO or pay a fee

---

## Features

### Core Capabilities
- **Auto-welcome** new members with configurable templates
- **Spam/scam detection** — flags promotional posts, scam links, bot accounts
- **Engagement** — replies after N member messages to keep group active
- **FUD detection** — identifies "don't buy" / "don't sell" bad actors
- **Raid protection** — alerts on coordinated attacks
- **Scheduled posts** — morning/evening vibes, tips, announcements

### Configuration
- Per-group settings (group ID, tone, rules, response frequency)
- Custom trigger phrases and auto-responses
- Whitelist/blacklist for users and keywords
- Token-gating rules for external projects

---

## Token Gating

### For Agentic Bro Community
- **Free** — unlimited use for $AGNTCBRO groups

### For External Projects

| Tier | Requirement | Groups |
|------|-------------|--------|
| **Token Hold** | $25 worth of $AGNTCBRO | 1 group |
| **Pro** | $99/mo | 3 groups |
| **Enterprise** | $299/mo | Unlimited |

### Verification
- Solana wallet check via RPC (no API cost)
- Cache verification for 24 hours
- Fallback: Manual allowlist in config

---

## Architecture

```
Group Moderator Agent
├── config/
│   ├── default.json          # Default settings
│   ├── groups/               # Per-group configs
│   │   ├── agentic-bro.json
│   │   └── client-project.json
│   └── token-gating.json     # External project access rules
├── scripts/
│   ├── moderator-agent.sh    # Main agent runner
│   ├── token-check.sh        # Verify $AGNTCBRO holdings
│   └── create-instance.sh    # Spin up new group instance
├── templates/
│   ├── welcome.md
│   ├── spam-alert.md
│   └── engagement.md
└── MODERATOR_AGENT.md        # This file
```

---

## Quick Start

### 1. Configure a Group
```bash
cd /Users/efinney/.openclaw/workspace/group-moderator-agent
./scripts/create-instance.sh --group-id -100XXXXXXXXXX --name "My Project"
```

### 2. Set Up Cron Job
```bash
# Add to OpenClaw cron
openclaw cron add \
  --name "moderator-MyProject" \
  --schedule "every 5m" \
  --session-target "isolated" \
  --model "ollama/granite4.1:3b"
```

### 3. Verify Token Gate (External Projects)
```bash
./scripts/token-check.sh <wallet-address> 100000
```

---

## Models

| Model | Size | Use Case |
|-------|------|----------|
| granite4.1:3b | 2.1GB | Primary moderation, engagement |
| qwen3:1.7b | 4.9GB | Fast greetings, quick replies |

Both run locally via Ollama — **zero API cost**.

---

## Pricing for External Projects

| Tier | Price | Features |
|------|-------|----------|
| **Token Hold** | 100K $AGNTCBRO | Full features, 1 group |
| **Pro** | $99/mo | Up to 3 groups, priority support |
| **Enterprise** | $299/mo | Unlimited groups, custom training |

---

## Configuration Reference

### Group Config (`config/groups/<name>.json`)
```json
{
  "groupId": "-100XXXXXXXXXX",
  "name": "Project Name",
  "enabled": true,
  "tokenGated": false,
  "settings": {
    "autoWelcome": true,
    "welcomeTemplate": "templates/welcome.md",
    "spamDetection": true,
    "spamThreshold": 0.7,
    "engagement": {
      "enabled": true,
      "replyAfterMessages": 5,
      "maxRepliesPerHour": 10
    },
    "scheduledPosts": {
      "morning": "09:00",
      "evening": "19:00"
    },
    "whitelist": [],
    "blacklist": [],
    "tone": "friendly",
    "language": "en"
  }
}
```

### Token Gating (`config/token-gating.json`)
```json
{
  "enabled": true,
  "contract": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
  "minimumHoldings": 100000,
  "cacheDurationHours": 24,
  "allowlist": [
    "wallet_address_1",
    "wallet_address_2"
  ],
  "paidSubscriptions": {
    "project_name": {
      "wallet": "wallet_address",
      "expiresAt": "2026-12-31",
      "tier": "pro"
    }
  }
}
```

---

## Commands

| Command | Description |
|---------|-------------|
| `/moderator status` | Show agent status for current group |
| `/moderator config` | Display current configuration |
| `/moderator enable <feature>` | Enable a feature |
| `/moderator disable <feature>` | Disable a feature |
| `/moderator whitelist <user>` | Add user to whitelist |
| `/moderator blacklist <user>` | Add user to blacklist |

---

## API for External Projects

External projects can configure their instance via a simple API:

```bash
# Create new instance
curl -X POST https://agenticbro.app/api/moderator/create \
  -H "Authorization: Bearer <token>" \
  -d '{"groupId": "-100XXX", "name": "My Project", "wallet": "..."}'

# Verify token gate
curl -X POST https://agenticbro.app/api/moderator/verify \
  -d '{"wallet": "...", "groupId": "-100XXX"}'
```

---

## Implementation Status

- [ ] Core moderator agent script
- [ ] Token gating verification
- [ ] Per-group configuration
- [ ] OpenClaw cron integration
- [ ] API endpoints for external projects
- [ ] Dashboard for subscription management

---

**Built by Agentic Bro — Scan first, trust later! 🔐**