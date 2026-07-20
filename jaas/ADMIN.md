# Group Moderator Agent — Admin Controls

## Quick Reference

### Service Management

```bash
# List all services
./scripts/service-manager.sh list

# Check service status
./scripts/service-manager.sh status -1003751594817

# Enable a service
./scripts/service-manager.sh enable -1003751594817

# Disable (pause) a service
./scripts/service-manager.sh disable -1003751594817

# Delete a service permanently
./scripts/service-manager.sh delete -1003751594817
```

### Token Gate Management

```bash
# Check token holdings
./scripts/token-check.sh check <wallet-address> 100000

# Verify with cache
./scripts/token-check.sh verify <wallet-address> 100000

# Clear token cache
./scripts/token-check.sh clear-cache
```

### Instance Creation

```bash
# Free instance (Agentic Bro community)
./scripts/create-instance.sh \
  --group-id -1001234567890 \
  --name "My Project"

# Token-gated instance
./scripts/create-instance.sh \
  --group-id -1001234567890 \
  --name "Client Project" \
  --token-gated \
  --wallet <wallet-address>
```

---

## Service Lifecycle

### Enable Flow
```
enable <group-id>
    │
    ├── Check if group exists
    │
    ├── Verify token gate (if tokenGated=true)
    │   ├── Query Solana RPC for wallet balance
    │   ├── Compare against minimum (100K $AGNTCBRO)
    │   └── Fail if insufficient
    │
    └── Update config: enabled=true
```

### Disable Flow
```
disable <group-id>
    │
    ├── Check if group exists
    │
    └── Update config: enabled=false
```

### Delete Flow
```
delete <group-id>
    │
    ├── Check if group exists
    │
    ├── Prompt for confirmation
    │
    ├── Archive config to archive/
    │
    └── Delete config file
```

---

## Configuration Files

### Group Config Structure
```json
{
  "groupId": "-1003751594817",
  "name": "Agentic Bro",
  "enabled": true,
  "tokenGated": false,
  "wallet": "",
  "model": "granite4.1:3b",
  "createdAt": "2026-06-11T12:30:00-04:00",
  "settings": {
    "autoWelcome": true,
    "spamDetection": true,
    "engagement": {
      "enabled": true,
      "replyAfterMessages": 5
    },
    "tone": "friendly"
  }
}
```

### Token Gating Config
```json
{
  "enabled": true,
  "contract": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
  "minimumHoldings": 100000,
  "cacheDurationHours": 24,
  "pricing": {
    "tokenHold": {"amount": 100000},
    "pro": {"priceUsd": 99, "priceTokens": 500000},
    "enterprise": {"priceUsd": 299, "priceTokens": 1500000}
  }
}
```

---

## Monitoring

### Log Files
- Moderation logs: `logs/moderator-<group-id>.log`
- Error logs: `logs/errors.log`
- Token verification: `logs/token-check.log`

### Health Check
```bash
# Check if cron jobs are running
openclaw cron list | grep moderator

# Check model availability
ollama list | grep -E "granite|qwen"

# Check disk space
df -h ~/.openclaw
```

---

## Troubleshooting

### Service won't enable
- Check token gate: `./scripts/token-check.sh check <wallet> 100000`
- Verify config: `./scripts/service-manager.sh status <group-id>`

### Moderation not running
- Check cron job status: `openclaw cron list`
- Verify model is available: `ollama list`
- Check logs: `tail -50 logs/moderator-*.log`

### Token gate fails
- Clear cache: `./scripts/token-check.sh clear-cache`
- Verify wallet address format
- Check Solana RPC status

---

## Security

### Token Verification
- Uses Solana mainnet RPC (no API keys)
- Caches results for 24 hours
- Never stores private keys

### Config Security
- Archive deleted configs before removal
- No sensitive data in config files
- Wallet addresses are public (token accounts)

---

**Built by Agentic Bro — Scan first, trust later! 🔐**