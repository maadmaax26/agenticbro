# TikTok Scan Files Overview

**Date:** April 12, 2026
**Total Files:** 21
**Scan Methods:** 2

---

## 📂 Directory Structure

```
/Users/efinney/.openclaw/workspace/
├── output/
├── scam-detection-framework/
│   ├── scan-tiktok-default.sh       # Default TikTok scan (5.9KB)
│   ├── scan-tiktok-direct.sh        # Direct HTTP scan (3.4KB)
│   ├── scan-tiktok-profile.sh       # Profile-specific scan (5.9KB)
│   ├── scan-tiktok-web.txt          # Web scan alternatives (448B)
│   └── tiktok-scan.py               # Python scanner (7.3KB)
│
├── scripts/
│   ├── scan-tiktok-command.sh       # Scan from chat (6.2KB)
│   ├── scan-tiktok-group-only.sh    # Group-only scan (2.5KB)
│   └── tiktok-scan-fixed.py         # Fixed Python scanner (11KB)
│
└── scan-tiktok-official-dbr-island.sh  # Custom scan script (4.8KB)
```

---

## 📊 Scan Result Files

### 📁 `output/tiktok_profiles/` (Primary Directory - 6 files)

| Profile | Risk Level | File Size | Scan Date |
|---------|------------|-----------|-----------|
| **official.dbr.island** | MEDIUM-HIGH (7/10) | 572B | Apr 12 21:48 |
| AGNTCBRO_contract | ❔ Unknown | 999B | Apr 12 21:11 |
| follow_back_bot_viral | ⚠️ HIGH (6/10) | 829B | Apr 12 13:03 |
| investment_chat_dm | ⚠️ HIGH (6/10) | 823B | Apr 12 13:46 |
| sats_wallet_claim | ⚠️ HIGH (6/10) | 821B | Apr 12 13:17 |
| test_account | ✅ LOW (2/10) | 811B | Apr 12 13:18 |

### 📁 `output/tiktok_scans/` (Aggregated Scans - 5 files)

| Scan Type | Finds | File Size | Scan Date |
|-----------|-------|-----------|-----------|
| investment_chat_dm | 3 accounts | 667B | Apr 12 12:28 |
| follow_back_bot_viral | 3 accounts | 773B | Apr 12 12:56 |
| crypto_checker_24h | Crypto patterns | 756B | Apr 12 17:05 |
| dm_usd_promo | 2 accounts | 743B | Apr 12 16:52 |
| sats_wallet_claim | 1 account | 720B | Apr 12 17:11 |

### 📁 Individual Scan JSON Files (10 files)

| Type | Count | Format |
|------|-------|--------|
| Profile JSONs | 10 | `{username}_YYYYMMDD_HHMMSS.json` |
| Summary Results | 1 | `tiktok-scan-xxx.txt` |

---

## 🛠️ Scanner Scripts (9 files)

### Main Scanners: `scam-detection-framework/`

| Script | Purpose | Size |
|--------|---------|------|
| `scan-tiktok-default.sh` | Default scan with describes | 5.9KB |
| `scan-tiktok-direct.sh` | Direct HTTP bypass | 3.4KB |
| `scan-tiktok-profile.sh` | Profile-specific scanner | 5.9KB |
| `tscam-tiktok-web.txt` | Web alternatives | 448B |
| `tiktok-scan.py` | Python scanner | 7.3KB |

### Chat Integration: `scripts/`

| Script | Purpose | Size |
|--------|---------|------|
| `scan-tiktok-command.sh` | Chat command wrapper | 6.2KB |
| `scan-tiktok-group-only.sh` | Group-only mode | 2.5KB |
| `tiktok-scan-fixed.py` | Fixed version | 11KB |

---

## 📈 Undocumented Files

| File | Status |
|------|--------|
| `scan-tiktok-official-dbr-island.sh` | ✅ Active (custom script) |
| `scripts/scan-tiktok-command.sh.backup-20260412` | ⚠️ Backup file |

---

## 🎯 Quick Stats

```
┌────────────────────────────────────┐
│     TIKTOK SCAN METRICS           │
├────────────────────────────────────┤
│    Total Files:      21            │
│    Profiles Scanned:  13           │
│    Average Risk:     4.5/10       │
│    High Risk:         7            │
│    Medium Risk:      4            │
│    Low Risk:           2            │
│                                      
│    Scanner Scripts:    9           │
│    JSON Outputs:      11           │
└────────────────────────────────────┘
```

---

## 📝 Memo

- **Duplicate directories** previously existed (user deleted `/workspace/workspace/` on Apr 12)
- **bot scanning** through `python3` scraper discovered multiple crypto spam profiles
- **Chrome CDP inspection** shows @official.dbr.island with HIGH RISK indicators
- **TikTok profile scraper** returns substantial content when bio is restricted (313,241 chars)
- Profile scanner has regex patterns for DM solicitation, airdrops, guaranteed returns, etc.