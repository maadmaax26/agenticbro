# Wallet Trace Report - Wallet 2 Funding Analysis

**Generated:** April 6, 2026
**Subject:** `4WWvoHMqCWmapJaN91x7MPosnrqdLUnA1LASCBNFby4g`

---

## 📊 Current State

| Wallet | Balance | Status |
|--------|---------|--------|
| Wallet 2 | 4.69 SOL | Active |

---

## 💸 Major Funding Source Found

### Funder: `2eRfNDdkRpn1MY6xDmJ7KQg3MiicCfC5vXoSLToz5R2U`

| Transaction | Date | Amount | Direction |
|-------------|------|--------|-----------|
| `nZrsMDYMLsy...` | Apr 5, 14:26 | **0.3756 SOL** | → Wallet 2 |

**Funder Current Balance:** 0.001176 SOL (nearly empty)

---

## 🔍 Funder Trace

### Origin of Funder Account

**First Transaction:** March 19, 2026 15:44:23

| From | To | Amount |
|-----|-----|--------|
| `2eRfNDdk...` (Funder) | `Eeoi7PKL...` | 0.0744 SOL |

**Note:** This appears to be a **transfer OUT** of the funder account, not funding INTO it. The funder was already funded before March 19.

---

## 📋 Complete Fund Flow

```
Mar 19, 2026 - Funder account (2eRfNDdk...) sends 0.074 SOL somewhere
     ↓
Mar 29, 2026 - Wallet 1 sends 0.05 SOL to Wallet 2
     ↓
Apr 5, 2026 - Funder sends 0.376 SOL to Wallet 2
     ↓
Apr 5-6, 2026 - Wallet 2 has various small transactions
     ↓
Current: Wallet 2 has 4.69 SOL
```

---

## 🚨 Key Findings

### 1. Multiple Funding Sources

| Source | Amount | Date |
|--------|--------|------|
| Wallet 1 | 0.05 SOL | Mar 29 |
| Funder (`2eRfNDdk...`) | 0.376 SOL | Apr 5 |
| Other small transfers | ~0.01 SOL | Various |

### 2. Funder Account Pattern

- **Address:** `2eRfNDdkRpn1MY6xDmJ7KQg3MiicCfC5vXoSLToz5R2U`
- **Current Balance:** 0.001 SOL (drained)
- **Activity:** Sent 0.376 SOL to Wallet 2, then drained
- **Pattern:** Burner/funnel account - used to move funds anonymously

### 3. Where Did the 4.69 SOL Come From?

**Wallet 2 received funds from:**
1. Wallet 1: 0.05 SOL (Mar 29)
2. Funder account: 0.376 SOL (Apr 5)
3. **UNKNOWN SOURCE:** ~4.3 SOL (majority of balance)

**The 4+ SOL must have come from earlier transactions or exchanges.**

---

## 📊 Transaction Summary for Wallet 2

| Date | Type | Amount | Counterparty |
|------|------|--------|--------------|
| Mar 29 | IN | 0.05 SOL | Wallet 1 |
| Mar 29 | IN | ~0.001 SOL | Various |
| Apr 5 | IN | 0.376 SOL | Funder (2eRfNDdk...) |
| Apr 5-6 | Various | Small amounts | Multiple addresses |

---

## 🚩 Red Flags

1. **Funder account is now empty** - burner wallet pattern
2. **Wallet 1 → Wallet 2 transfer** - linked wallets
3. **Multiple small transactions** - potential obfuscation
4. **Large SOL balance (4.69)** - from unknown source

---

## 📋 Recommendations

1. **Check where the 4+ SOL came from** - Need exchange/wallet history
2. **Trace funder account origin** - Where did `2eRfNDdk...` get its funds?
3. **Check Wallet 2 outgoing transactions** - Where is it sending funds?
4. **Report if fraudulent** - Contact Solscan, exchanges if needed

---

**Scan first, decide smart.** 🔐