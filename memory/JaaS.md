# JaaS — Memory Reference

## Quick Reference

**Service Name:** Jeeevs as a Service (JaaS)
**Location:** `/Users/efinney/.openclaw/workspace/jaas/`
**Bot:** @Jeeevs222_bot
**Token:** $AGNTCBRO

---

## Admin Commands

```bash
cd /Users/efinney/.openclaw/workspace/jaas

# List instances
./scripts/admin/list-instances.sh

# Create instance
./scripts/admin/create-instance.sh \
  --name "Client" \
  --group-id "-100XXX" \
  --tier "token-hold" \
  --wallet "7xKX..."

# Delete instance
./scripts/admin/delete-instance.sh --id "client-name"

# Verify token gates
./scripts/admin/verify-all.sh
```

---

## Pricing

| Tier | Requirement | Groups |
|------|-------------|--------|
| Token Hold | 100K $AGNTCBRO | 1 |
| Pro | $99/mo or 500K tokens | 3 |
| Enterprise | $299/mo or 1.5M tokens | Unlimited |

---

## Current Instances

| Name | Group ID | Tier | Status |
|------|----------|------|--------|
| Agentic Bro | -1003751594817 | internal | ✅ Active |
| Scam Scans | -1003967263388 | internal | ✅ Active |

---

## Security Model

- **You:** Control bot token, configs, instance creation
- **Client:** Add/remove admin role only

---

**Jeeevs as a Service — Zero API cost. Token-gated access. 🔐**