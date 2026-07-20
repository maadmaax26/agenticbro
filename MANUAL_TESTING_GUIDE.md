# Profile Verifier - Manual Testing Guide

## Quick Start

### Option 1: Interactive Menu (Recommended)

Run the interactive test menu:

```bash
cd /Users/efinney/.openclaw/workspace/scripts
./test-profile-verifier-interactive.sh
```

This provides a menu-driven interface to:
- Test individual scam types
- Test all scams at once
- Run custom username tests
- View formatted JSON output

### Option 2: Batch Script

Run all tests automatically:

```bash
cd /Users/efinney/.openclaw/workspace/scripts
./test-profile-verifier.sh
```

Output saved to: `./output/profile-verifier-tests/`

---

## Test Scenarios

### Safe Profiles

| Test | Username | Context | Expected Result |
|------|----------|---------|-----------------|
| Verified Company | @solana | crypto | SAFE or VERIFIED |
| Normal Developer | @vitalikbuterin | crypto | SAFE or VERIFIED |

### Crypto Scams

| Test | Username | Context | Red Flags |
|------|----------|---------|-----------|
| Giveaway Fraud | @elon_giveaway_real | crypto | `_giveaway` username, airdrop bio |
| Rug Pull | @solana_official_dev | crypto | `_official` username, airdrop |
| Wallet Drainer | @real_metamask_support | crypto | `_real` username, airdrop/free |
| Fake Charity | @ukraine_aid_giveaway | crypto | giveaway + send + gift card |

### Romance Scams

| Test | Username | Context | Red Flags |
|------|----------|---------|-----------|
| Military Doctor | @dr_johnson_military | romance | Military, gift card, Western Union |
| Oil Rig Engineer | @engineer_petro_worker | romance | Oil rig, Western Union |

### Job Offer Scams

| Test | Username | Context | Red Flags |
|------|----------|---------|-----------|
| $500/day | @earn500daily_official | employment | Work-from-home, $500/day, no experience |
| Passive Income | @unlimited_earnings_now | employment | Passive income, unlimited earning |

### Financial Scams

| Test | Username | Context | Red Flags |
|------|----------|---------|-----------|
| Tech Support | @microsoft_helpline_real | financial | official + helpline + account suspended |
| IRS Impersonation | @irs_official_verify | financial | IRS official, account suspended |
| Bank Impersonation | @the_chase_bank_helpline | financial | `the_` prefix, `_chase_bank_` |
| Ponzi Scheme | @guaranteed_10k_weekly | financial | $10k/week, guaranteed returns |

### Marketplace Scams

| Test | Username | Context | Red Flags |
|------|----------|---------|-----------|
| Rental Scam | @cheap_rentals_official | marketplace | Cashapp only, no returns |
| Seller Fraud | @luxury_seller_official | marketplace | Cashapp only, no refunds |

### Deepfake Detection

| Test | Username | Context | Expected |
|------|----------|---------|----------|
| AI Influencer | @ai_influencer_fake | romance | Deepfake category 0, AI-generated flag |

---

## Understanding the Output

### Response Structure

```json
{
  "success": true,
  "data": {
    "profile": {
      "username": "elon_giveaway_real",
      "displayName": "Elon Musk",
      "verified": false,
      "followers": 1250,
      "following": 50,
      "createdAt": "2026-03-01"
    },
    "authenticityScore": 25,
    "riskLevel": "UNSAFE",
    "verificationContext": "crypto",
    "categories": {
      "verification": {
        "score": 0,
        "maxScore": 30,
        "status": "SCAM"
      },
      "botDetection": {
        "score": 5,
        "maxScore": 25,
        "status": "UNSAFE"
      },
      "deepfake": {
        "score": 20,
        "maxScore": 20,
        "status": "SAFE"
      },
      "impersonation": {
        "score": 0,
        "maxScore": 15,
        "status": "SCAM"
      },
      "activity": {
        "score": 0,
        "maxScore": 10,
        "status": "SCAM"
      }
    },
    "redFlags": [
      "Username mimics @elonmusk with giveaway suffix",
      "Account is only 30 days old"
    ],
    "warnings": [
      "Suspicious bio contains 'airdrop' and 'giveaway' keywords"
    ],
    "recommendation": "❌ AVOID - This account shows multiple scam indicators",
    "plainLanguageSummary": "This account is impersonating @elonmusk with giveaway keywords in the username and bio. It's only 30 days old and shows clear signs of a giveaway scam. Avoid interacting.",
    "scanTime": "2026-03-31T09:30:00Z",
    "scanDuration": "2.3s",
    "cacheHit": false
  }
}
```

### Key Fields for Users

| Field | What It Means |
|-------|---------------|
| `authenticityScore` | 0-100, higher is better |
| `riskLevel` | VERIFIED, SAFE, CAUTION, UNSAFE, SCAM |
| `recommendation` | Plain-English action to take |
| `plainLanguageSummary` | Non-technical explanation |

---

## Custom Tests

### Test Your Own Username

**Option A: Use Interactive Menu**
1. Run `./test-profile-verifier-interactive.sh`
2. Select `[19] Custom Username Test`
3. Enter platform, username, context

**Option B: Direct cURL Command**

```bash
curl -X POST "http://localhost:3001/api/verify/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "username": "YOUR_USERNAME_HERE",
    "verificationContext": "crypto",
    "options": {
      "deepScan": false,
      "includeMedia": false
    }
  }' | jq .
```

---

## Context Comparison

Test the same username across contexts to see different scores:

```bash
# Crypto context
curl -X POST "http://localhost:3001/api/verify/profile" \
  -H "Content-Type: application/json" \
  -d '{"platform": "twitter", "username": "test_user", "verificationContext": "crypto"}' | jq .

# Romance context (deepfake weighted higher)
curl -X POST "http://localhost:3001/api/verify/profile" \
  -H "Content-Type: application/json" \
  -d '{"platform": "twitter", "username": "test_user", "verificationContext": "romance"}' | jq .
```

---

## Output Files

All test results saved to: `./output/profile-verifier-tests/`

Format: `test-name-TIMESTAMP.json`

Example filenames:
```
test1-verified-company-20260331-093000.json
test2-romance-scam-20260331-093015.json
test3-crypto-giveaway-20260331-093030.json
```

---

## View Results

### View all results:
```bash
ls -la ./output/profile-verifier-tests/
```

### View specific result with formatting:
```bash
cat ./output/profile-verifier-tests/test1-verified-company-*.json | jq .
```

### View just the score and recommendation:
```bash
cat ./output/profile-verifier-tests/test1-verified-company-*.json | jq '.data | {authenticityScore, riskLevel, recommendation}'
```

### Compare two results:
```bash
diff <(cat ./output/profile-verifier-tests/test1-*.json | jq .) \
     <(cat ./output/profile-verifier-tests/test2-*.json | jq .)
```

---

## Troubleshooting

### API Not Running

**Error:** `curl: (7) Failed to connect to localhost port 3001`

**Fix:**
```bash
cd /Users/efinney/.openclaw/workspace/agentic-bro
npm start
```

### jq Not Found

**Error:** `jq: command not found`

**Fix:**
```bash
brew install jq
```

### Permission Denied

**Error:** `bash: ./test-profile-verifier.sh: Permission denied`

**Fix:**
```bash
chmod +x ./scripts/test-profile-verifier*.sh
```

---

## Integration with Local Router

Once the API endpoint is live, test via the local-router:

**In Telegram or Webchat:**
```
/verify @elon_giveaway_real
```

**Expected Flow:**
1. Local-router receives message
2. Detects "verify" keyword → Delegates to agentic-bro
3. Agentic-bro calls ProfileVerifier API
4. Returns formatted result to user

---

**Created:** 2026-03-31
**Scripts:** `scripts/test-profile-verifier.sh` (batch) and `scripts/test-profile-verifier-interactive.sh` (menu)