# $AGNTCBRO Manual Snapshot Airdrop Implementation

**Created:** April 5, 2026
**Snapshot Date:** April 20, 2026 at 12:00 PM UTC

---

## 📋 Overview

**Airdrop Pool:** 30,000,000 $AGNTCBRO (3% of 1B supply)
**Method:** Manual snapshot + batch transfer
**Cost:** $0 (no smart contract required)

---

## 🎯 Eligibility Requirements

1. **Hold minimum 4,000,000 $AGNTCBRO** at snapshot time
2. **Wallet age:** 7+ days old
3. **Social tasks:**
   - Follow @AgenticBro on X
   - Join Telegram group
   - Like & RT announcement post
4. **No exchange wallets** - Only personal wallets (Phantom, Backpack, etc.)

---

## 📸 Snapshot Process

### Step 1: Get All Holders

Use DexScreener or Solscan API to get all token holders:

```python
import requests
import json

CONTRACT = "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"

# DexScreener API
url = f"https://api.dexscreener.com/tokens/{CONTRACT}/holders"
response = requests.get(url)
holders = response.json()

# Filter by minimum holdings (4M tokens)
eligible = [h for h in holders if h['amount'] >= 4000000]
```

### Step 2: Check Wallet Age

```python
import solana.rpc.api as solana

client = solana.Client("https://api.mainnet-beta.solana.com")

def get_wallet_age(wallet_address):
    """Get first transaction timestamp for wallet"""
    signatures = client.get_signatures_for_address(wallet_address, limit=1)
    if signatures['result']:
        first_tx = signatures['result'][-1]
        return first_tx['blockTime']
    return None

# Filter by 7+ days old
import time
seven_days = 7 * 24 * 60 * 60  # seconds
current_time = time.time()

eligible_aged = []
for holder in eligible:
    wallet_age = get_wallet_age(holder['address'])
    if wallet_age and (current_time - wallet_age) >= seven_days:
        eligible_aged.append(holder)
```

### Step 3: Social Task Verification

Create Google Form or Typeform for users to submit:
- X username (for follow verification)
- Telegram username (for join verification)
- Wallet address
- Screenshot of holdings

Manual verification:
- Check if X account follows @AgenticBro
- Check if Telegram user is in group
- Verify RT of announcement post

### Step 4: Generate Distribution List

```python
# Final distribution list
distribution = []

for holder in eligible_aged:
    tier = get_tier(holder['amount'])
    airdrop_amount = calculate_airdrop(tier)
    
    distribution.append({
        'wallet': holder['address'],
        'holdings': holder['amount'],
        'tier': tier,
        'airdrop': airdrop_amount
    })

# Save to CSV
import csv

with open('airdrop_distribution.csv', 'w') as f:
    writer = csv.DictWriter(f, fieldnames=['wallet', 'holdings', 'tier', 'airdrop'])
    writer.writeheader()
    writer.writerows(distribution)
```

---

## 💰 Tier Calculations

```python
def get_tier(amount):
    """Determine tier based on holdings"""
    if amount >= 50_000_000:
        return 'Diamond'
    elif amount >= 10_000_000:
        return 'Gold'
    elif amount >= 5_000_000:
        return 'Silver'
    elif amount >= 4_000_000:
        return 'Bronze'
    return None

def calculate_airdrop(tier):
    """Calculate airdrop amount by tier"""
    amounts = {
        'Bronze': 15_000,
        'Silver': 22_500,
        'Gold': 30_000,
        'Diamond': 45_000
    }
    return amounts.get(tier, 0)
```

---

## 📊 Vesting Schedule

**4-week vesting (25% per week):**

| Week | Date | % Unlocked | Tokens (Bronze) |
|------|------|------------|-----------------|
| 1 | April 27, 2026 | 25% | 3,750 |
| 2 | May 4, 2026 | 25% | 3,750 |
| 3 | May 11, 2026 | 25% | 3,750 |
| 4 | May 18, 2026 | 25% | 3,750 |

---

## 🚀 Distribution Process

### Option A: Manual Transfer (Recommended)

1. Create distribution CSV
2. Use Phantom/Backpack batch send (20 per transaction)
3. Send weekly batches

```bash
# Example batch transfer script
# Run once per week

# Week 1: Send 25% to each wallet
for wallet in distribution:
    amount = wallet['airdrop'] * 0.25
    send_tokens(wallet['wallet'], amount)
```

### Option B: Use Airdrop Tool

Tools like:
- **Token-Airplane** (Solana)
- **SPL Token Distributor**

Upload CSV and batch send.

---

## 📅 Timeline

| Date | Action |
|------|--------|
| April 5, 2026 | Announce airdrop |
| April 5-19, 2026 | Accumulation period |
| April 19, 2026 | Release eligibility form |
| April 20, 2026 | **SNAPSHOT** (12:00 PM UTC) |
| April 21-26, 2026 | Verify eligibility + social tasks |
| April 27, 2026 | Week 1 distribution (25%) |
| May 4, 2026 | Week 2 distribution (25%) |
| May 11, 2026 | Week 3 distribution (25%) |
| May 18, 2026 | Week 4 distribution (25%) |

---

## 📝 Required Files

1. **Snapshot Script** - `/scripts/snapshot-holders.py`
2. **Eligibility Form** - Google Form link
3. **Distribution CSV** - Generated after verification
4. **Transfer Script** - `/scripts/batch-transfer.py`

---

## ⚠️ Important Notes

- **Manual verification** required for social tasks
- **No smart contract** = no automatic enforcement
- **15% sell tax** is manual enforcement (via community pressure)
- **Trust-based** system until staking contract is built

---

## 🔗 Links

- **X Post:** `/x-posts/airdrop-announcement.md`
- **Full Program:** `/memory/AGNTCBRO_AIRDROP_PROGRAM.md`
- **Summary:** `/memory/AIRDROP_SUMMARY.md`

---

**Status:** Ready to announce
**Next Step:** Post announcement on X and Telegram