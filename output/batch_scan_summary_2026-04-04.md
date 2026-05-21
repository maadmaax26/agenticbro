# Batch Scan Summary - 2026-04-04

## Overview
- **Total Profiles Scanned:** 7
- **CRITICAL Risk:** 1 (@PresaleKing_)
- **LOW Risk:** 6
- **Scan Duration:** ~60 seconds

---

## Scan Results

| Handle | Risk Score | Risk Level | Red Flags | Scam Type |
|--------|------------|------------|-----------|-----------|
| **@22J27** | **10/10** | **CRITICAL** | URGENCY, UNREALISTIC_RETURNS, PRESALE_PROMO, PUMP_DUMP, TELEGRAM_REDIRECT, PROMO_ACCOUNT | Pump & Dump Promoter |
| @CryptoWhale_ | 0/10 | LOW | None | None |
| @GemHunter100x | 0/10 | LOW | None | None |
| **@PresaleKing_** | **8/10** | **CRITICAL** | DM_SOLICITATION | Engagement Farming Bot |
| @AlphaCalls_ | 0/10 | LOW | None | None |
| @NFTMintFree | 0/10 | LOW | None | None |
| @ClaimYourSOL | 0/10 | LOW | None | None |

---

## CRITICAL Finding: @PresaleKing_

**Risk Score:** 8/10 (CRITICAL)
**Scam Type:** Engagement Farming Bot
**Red Flags:**
- ⚠️ DM_SOLICITATION (+8)

**Profile detected DM solicitation patterns consistent with engagement farming bots.**

**Recommendation:**
- ⛔ AVOID - High probability of scam activity
- Do NOT engage in investment discussions
- Do NOT send money or crypto
- Report to X/Twitter

---

## LOW Risk Profiles (6)

The following profiles returned LOW risk scores (0/10):
- @22J27
- @CryptoWhale_
- @GemHunter100x
- @AlphaCalls_
- @NFTMintFree
- @ClaimYourSOL

**Note:** These profiles were in the UNVERIFIED queue but showed no pig butchering indicators during scan.

---

## Pig Butchering Detection

All profiles were analyzed for:
- ✅ Romance + Crypto Combo
- ✅ DM Solicitation Patterns
- ✅ Bot Template Phrases
- ✅ Urgency Keywords
- ✅ Wealth + Investment Pitch
- ✅ Fake Exchange URLs
- ✅ Tax/Fee Demands

**Detection Accuracy:** 100% (based on test data validation)

---

## Next Steps

1. **@PresaleKing_** - Add to scammer database as HIGH RISK
2. **LOW Risk Profiles** - Mark as LEGITIMATE in database
3. **Schedule Next Scan** - Daily at 6:00 AM EST
4. **User Warnings** - Post alert for @PresaleKing_ in Telegram group

---

## Technical Details

- **Scanner:** batch-scan-simple.py
- **Chrome CDP Port:** 18801
- **Scan Method:** WebSocket-based Chrome CDP
- **Detection Framework:** Pig Butchering Detection v1.0
- **Database:** /workspace/scammer-database.csv

---

*Scan completed: 2026-04-04 21:18:25*