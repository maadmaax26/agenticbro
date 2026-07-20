# JaaS Onboarding Flow — Complete Architecture

## The Problem

**Website wallet check** = Just a verification tool (does not save or monitor)

**We need:**
1. Client provides wallet + group info
2. We verify holdings
3. We SAVE the wallet to JaaS config
4. We MONITOR holdings continuously
5. We PAUSE service if holdings drop

---

## Complete Flow

### Phase 1: Client Interest

```
Client visits agenticbro.app/jaas
  │
  ├─► Reads pricing
  ├─► Uses wallet verification tool (optional, just to check)
  └─► Clicks "Contact Us to Get Started"
```

### Phase 2: Manual Onboarding (Current)

```
Client DMs you:
  "I want JaaS for my group"
  - Group ID: -100XXX
  - Wallet: 7xKX...
  - Telegram: @handle

You verify:
  ./scripts/admin/create-instance.sh \
    --name "Client" \
    --group-id "-100XXX" \
    --wallet "7xKX..." \
    --tier "token-hold"

System:
  ├─► Verifies wallet holdings (≥ 125,000 tokens)
  ├─► Creates config with wallet
  ├─► Adds to registry
  └─► Returns cron job config

You tell client:
  "Add @Jeeevs222_bot to your group and grant admin"

You add cron job
```

### Phase 3: Continuous Monitoring (Automated)

```
Every 24 hours (via cron):
  │
  ├─► verify-all.sh runs
  │     │
  │     ├─► For each token-gated instance:
  │     │     ├─► Query Solana RPC
  │     │     ├─► Check holdings
  │     │     └─► If < 125,000:
  │     │           ├─► Pause instance
  │     │           ├─► Notify you
  │     │           └─► Notify client (optional)
  │
  └─► Log results
```

---

## What the Website Wallet Check Does

**Purpose:** Let clients verify they qualify BEFORE contacting you

**It does NOT:**
- Save the wallet
- Create an instance
- Start monitoring

**It DOES:**
- Check if wallet has ≥ 125,000 $AGNTCBRO
- Show balance
- Tell client "you qualify" or "need more tokens"

---

## What We Need to Add

### Option A: Manual Onboarding (Current)

Keep as-is:
1. Client checks wallet on website
2. Client DMs you with info
3. You verify and create instance
4. You add cron job
5. System monitors daily

**Pros:** Simple, you control everything
**Cons:** Manual work for each client

### Option B: Self-Service Onboarding (Future)

Add to website:
1. Form to submit:
   - Group ID
   - Wallet address
   - Telegram handle
2. API verifies wallet
3. Saves to database
4. Auto-creates instance
5. Notifies you to add cron

**Pros:** No manual work
**Cons:** More complex, needs auth

---

## Recommended: Hybrid Approach

**Phase 1 (Now): Manual with Verification Tool**
- Website has wallet check tool
- Client sees they qualify
- Client DMs you
- You create instance manually

**Phase 2 (Later): Self-Service Form**
- Add form to website
- Client submits: group ID, wallet, telegram
- API verifies and creates pending instance
- You approve and add cron
- Client gets confirmation

---

## Files That Need Updates

| File | Purpose | Status |
|------|---------|--------|
| `verify-wallet.ts` (API) | Check holdings | ✅ Created |
| `create-instance.sh` | Create instance with wallet | ✅ Updated |
| `verify-all.sh` | Daily monitoring | ✅ Updated |
| `moderator-agent.sh` | Check before each run | ✅ Updated |
| `token-gating.json` | Config | ✅ Updated |
| **NEW: Self-service form** | Website submission | ❌ Not needed yet |

---

## Monitoring Flow (Automated)

```
┌─────────────────────────────────────────┐
│         DAILY CRON (verify-all.sh)      │
│                                         │
│  For each instance with tokenGate:      │
│  ┌─────────────────────────────────────┐│
│  │ 1. Get wallet from config.json      ││
│  │ 2. Query Solana RPC                 ││
│  │ 3. Check balance ≥ 125,000          ││
│  │ 4. If FAIL:                         ││
│  │    - Set enabled = false            ││
│  │    - Log warning                    ││
│  │    - (Future) Notify client         ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

---

## Summary

| Component | Does What | How |
|-----------|-----------|-----|
| **Website wallet check** | Shows client if they qualify | Instant RPC check |
| **create-instance.sh** | Saves wallet to config | Manual by you |
| **verify-all.sh** | Daily monitoring | Cron job |
| **moderator-agent.sh** | Check before each run | Part of moderation |

**The website tool is for CLIENTS to check themselves. YOU create the actual monitored instance.**

---

**JaaS — Manual onboarding, automated monitoring. 🔐**