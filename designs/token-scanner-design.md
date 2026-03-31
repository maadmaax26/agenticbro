# Token Scanner — Feature Design

## Overview

Real-time token risk assessment for Solana tokens. Users paste a contract address and receive an instant risk score with detailed breakdown.

---

## User Flow

```
User Input: Contract Address
        ↓
    Validation
        ↓
    Multi-Source Scan
    ├── DexScreener (price, liquidity, volume)
    ├── GoPlus Security (honeypot check)
    ├── RugCheck (developer holdings)
    └── Solana RPC (authority transfers)
        ↓
    Risk Calculation
        ↓
    Results Display
    ├── Risk Score (0-10)
    ├── Risk Level (SAFE/LOW/MEDIUM/HIGH/CRITICAL)
    ├── Breakdown by Category
    └── Recommendations
```

---

## API Endpoints

### `POST /api/scan/token`

**Request:**
```json
{
  "contractAddress": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
  "chain": "solana"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": {
      "symbol": "AGNTCBRO",
      "name": "Agentic Bro",
      "contract": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
      "platform": "pump.fun",
      "createdAt": "2025-03-15T10:30:00Z"
    },
    "riskScore": 2.5,
    "riskLevel": "LOW",
    "categories": {
      "liquidity": {
        "score": 1,
        "status": "SAFE",
        "details": {
          "locked": true,
          "lockDuration": "1 year",
          "lockPercent": 80,
          "liquidityUsd": 125000
        }
      },
      "developer": {
        "score": 3,
        "status": "LOW",
        "details": {
          "devHoldingsPercent": 8.5,
          "top10HoldersPercent": 25,
          "devTransactions": 12,
          "soldPercent": 0
        }
      },
      "honeypot": {
        "score": 0,
        "status": "SAFE",
        "details": {
          "buyable": true,
          "sellable": true,
          "sellTax": 0,
          "maxSellPercent": 100,
          "hiddenOwner": false
        }
      },
      "authority": {
        "score": 2,
        "status": "LOW",
        "details": {
          "mintable": false,
          "freezable": false,
          "permanentDelegate": false,
          "authorityTransfers": 0
        }
      },
      "market": {
        "score": 2,
        "status": "LOW",
        "details": {
          "marketCap": 850000,
          "volume24h": 45000,
          "holders": 3420,
          "transactions24h": 892
        }
      }
    },
    "redFlags": [],
    "warnings": [
      "Token created 15 days ago - newer tokens carry higher risk"
    ],
    "recommendation": "✅ SAFE TO TRADE - Low risk profile. Standard due diligence recommended.",
    "scanTime": "2026-03-30T20:44:00Z",
    "scanDuration": "2.3s"
  }
}
```

---

## Risk Scoring Algorithm

### Category Weights

| Category | Weight | Max Score |
|----------|--------|-----------|
| Honeypot | 35% | 3.5 |
| Developer | 25% | 2.5 |
| Liquidity | 20% | 2.0 |
| Authority | 15% | 1.5 |
| Market | 5% | 0.5 |
| **Total** | **100%** | **10.0** |

### Scoring Rules

**Honeypot (0-3.5 points):**
```
SAFE (0):     Sellable, no hidden tax, no hidden owner
LOW (0.5):    Sell tax 1-5% or minor restrictions
MEDIUM (1.5): Sell tax 6-15% or max sell <50%
HIGH (2.5):   Sell tax 16-30% or max sell <25%
CRITICAL (3.5): Cannot sell, hidden owner, or complete honeypot
```

**Developer (0-2.5 points):**
```
SAFE (0):     Dev holdings <5%, top 10 holders <20%, no sells
LOW (0.5):    Dev holdings 5-10% or top 10 holders 20-35%
MEDIUM (1.0): Dev holdings 11-25% or top 10 holders 35-50%
HIGH (1.5):   Dev holdings 26-40% or top 10 holders 50-70%
CRITICAL (2.5): Dev holdings >40% or top 10 holders >70% or dev sold 100%
```

**Liquidity (0-2.0 points):**
```
SAFE (0):     Locked 100%, locked 6+ months, liquidity >$100k
LOW (0.5):    Locked 50-99% or locked 3-6 months
MEDIUM (1.0): Locked 25-49% or locked 1-3 months
HIGH (1.5):   Locked <25% or unlocked, liquidity $10k-$50k
CRITICAL (2.0): Unlocked, liquidity <$10k, or no liquidity pool
```

**Authority (0-1.5 points):**
```
SAFE (0):     No mint, no freeze, no permanent delegate
LOW (0.3):    Mint authority exists but revoked
MEDIUM (0.7): Freeze authority exists
HIGH (1.0):   Permanent delegate present or authority not revoked
CRITICAL (1.5): Multiple dangerous authorities active
```

**Market (0-0.5 points):**
```
SAFE (0):     Age >30 days, holders >1000, volume >$10k/day
LOW (0.1):    Age 7-30 days or holders 500-1000
MEDIUM (0.2): Age 3-7 days or holders 100-500
HIGH (0.3):   Age 1-3 days or holders <100
CRITICAL (0.5): Age <24 hours or holders <50
```

---

## Risk Level Thresholds

| Level | Score Range | Display Color | Action |
|-------|-------------|---------------|--------|
| SAFE | 0-1.5 | 🟢 Green | "Safe to trade" |
| LOW | 1.6-3.0 | 🟡 Yellow | "Minor risks, proceed with caution" |
| MEDIUM | 3.1-5.0 | 🟠 Orange | "Moderate risks, research recommended" |
| HIGH | 5.1-7.0 | 🔴 Red | "High risk, significant red flags" |
| CRITICAL | 7.1-10.0 | 🟣 Purple | "Extremely dangerous, avoid trading" |

---

## Data Sources

### Primary APIs

1. **DexScreener API** — Price, liquidity, volume, pairs
   - Endpoint: `https://api.dexscreener.com/latest/dex/tokens/{address}`
   - Rate limit: 300 requests/minute

2. **GoPlus Security API** — Honeypot detection, security info
   - Endpoint: `https://api.gopluslabs.io/api/v1/solana/token_security/{address}`
   - Requires API key for production

3. **RugCheck API** — Developer holdings, distribution
   - Endpoint: `https://api.rugcheck.xyz/v1/tokens/{address}/report`

4. **Solana RPC** — Authority checks, on-chain data
   - Uses Helius or QuickNode endpoint
   - Checks: `getAccountInfo`, `getTokenSupply`, `getSignaturesForAddress`

### Fallback Strategy

```
Primary → Secondary → Tertiary
DexScreener → Birdeye → Solana RPC direct
GoPlus → Manual simulation → Skip honeypot check
RugCheck → Solscan scraping → Estimate from chain
```

---

## UI Components

### Scan Input

```
┌─────────────────────────────────────────────────────┐
│  🔍 Token Scanner                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Contract Address                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump│   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Scan Token]  [Clear]                              │
│                                                     │
│  Examples: AGNTCBRO | BONK | WIF                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Results Display

```
┌─────────────────────────────────────────────────────┐
│  AGNTCBRO - Agentic Bro                             │
│  Risk Score: 2.5/10  🟡 LOW RISK                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✅ Honeypot Check      0.0  ━━━━━━━━━━━ SAFE       │
│     • Buyable: Yes                                  │
│     • Sellable: Yes                                 │
│     • Sell Tax: 0%                                  │
│                                                     │
│  ✅ Liquidity          0.5  ━━━━━━━━━━━ LOW        │
│     • 80% Locked (1 year)                           │
│     • Liquidity: $125,000                           │
│                                                     │
│  ⚠️ Developer           1.0  ━━━━━━━━━━━ MEDIUM     │
│     • Dev Holdings: 8.5%                            │
│     • Top 10 Holders: 25%                           │
│                                                     │
│  ✅ Authority          0.0  ━━━━━━━━━━━ SAFE       │
│     • Mint: Revoked                                 │
│     • Freeze: None                                  │
│                                                     │
│  ✅ Market             0.5  ━━━━━━━━━━━ LOW        │
│     • Age: 15 days                                  │
│     • Holders: 3,420                                │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Warnings:                                          │
│  ⚠️ Token created 15 days ago - newer tokens       │
│     carry higher risk                              │
│                                                     │
│  Recommendation:                                    │
│  ✅ SAFE TO TRADE - Low risk profile.              │
│     Standard due diligence recommended.            │
│                                                     │
│  [Share Results] [Export PDF] [Report Issue]       │
│                                                     │
│  Scanned: 2026-03-30 20:44 UTC · 2.3s             │
└─────────────────────────────────────────────────────┘
```

---

## Telegram Bot Integration

### Command Format

```
/scan <contract_address>

Example:
/scan 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
```

### Bot Response Format

```
🔍 Token Scan Results

AGNTCBRO - Agentic Bro
Risk: 2.5/10 🟡 LOW

✅ Honeypot: PASS (sellable, 0% tax)
✅ Liquidity: 80% locked ($125k)
⚠️ Dev: 8.5% holdings
✅ Authority: No mint/freeze

Recommendation: ✅ SAFE TO TRADE

Scan: 2.3s · agenticbro.app/scan/52bJE...
```

---

## Caching Strategy

- **Hot Cache (Redis):** 5 minutes for popular tokens
- **Warm Cache (Redis):** 1 hour for medium-volume tokens
- **Cold Storage (DB):** 24 hours for all scans
- **Force Refresh:** User can request fresh scan

---

## Rate Limiting

| Tier | Scans/Day | Scans/Hour |
|------|-----------|------------|
| Free | 5 | 2 |
| Basic ($29) | 50 | 10 |
| Pro ($99) | 200 | 30 |
| Team ($299) | 1000 | 100 |
| Enterprise ($999) | Unlimited | Unlimited |

---

## Error Handling

```json
{
  "success": false,
  "error": {
    "code": "INVALID_ADDRESS",
    "message": "Not a valid Solana token address",
    "suggestion": "Please enter a 44-character base58 address"
  }
}
```

**Error Codes:**
- `INVALID_ADDRESS` — Not a valid Solana address
- `TOKEN_NOT_FOUND` — Address exists but no token data
- `NO_LIQUIDITY` — Token has no trading pairs
- `API_ERROR` — External API failure
- `RATE_LIMITED` — User exceeded scan quota
- `CHAIN_ERROR` — Solana RPC failure

---

## Future Enhancements

1. **Batch Scanning** — Scan multiple tokens at once
2. **Historical Tracking** — Track risk score changes over time
3. **Alert System** — Notify when risk score changes
4. **API Access** — Public API for developers
5. **Browser Extension** — Scan directly from DEXs
6. **Mobile App** — iOS/Android with camera scanning

---

## Competitive Analysis

| Feature | Agentic Bro | GoPlus | RugCheck | Token Sniffer |
|---------|-------------|--------|----------|---------------|
| Honeypot Detection | ✅ | ✅ | ✅ | ✅ |
| Liquidity Lock | ✅ | ✅ | ❌ | ❌ |
| Dev Holdings % | ✅ | ✅ | ✅ | ❌ |
| Authority Check | ✅ | ✅ | ❌ | ❌ |
| Risk Score (0-10) | ✅ | ❌ | ✅ | ✅ |
| Telegram Bot | ✅ | ❌ | ❌ | ❌ |
| Free Tier | 5/day | 100/day | Unlimited | 10/day |
| Solana-Native | ✅ | ✅ | ❌ | ❌ |