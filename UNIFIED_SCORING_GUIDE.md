# Unified Scoring System - Quick Reference

**Version:** 1.0
**Date:** 2026-04-13
**Purpose:** Consistent risk scoring for X profile scans

---

## Scoring Formula

```
Risk Score = (Sum of present red flag weights / 90) × 10
```

**Example:**
- Red flags detected: Guaranteed Returns (10) + No Verification (10) = 20
- Risk Score: (20 / 90) × 10 = 2.2/10
- Risk Level: LOW

---

## Red Flags and Weights

| # | Red Flag | Weight | Detection Method |
|---|----------|--------|------------------|
| 1 | Guaranteed Returns | 10 | Pattern: "guaranteed", "sure thing", "can't lose" |
| 2 | Private Alpha | 10 | Pattern: "private alpha", "exclusive access", "whitelist" |
| 3 | Unrealistic Claims | 10 | Pattern: "1000x", "100x", "overnight", "instant money" |
| 4 | Urgency Tactics | 10 | Pattern: "limited time", "act now", "last chance" |
| 5 | No Track Record | 10 | CDP: New account, few posts, no history |
| 6 | Requests Crypto | 10 | Pattern: "send sol", "send usdc", "pay upfront" |
| 7 | No Verification | 10 | CDP: No blue checkmark detected |
| 8 | Fake Followers | 10 | CDP: High follower count, low engagement rate |
| 9 | New Account | 5 | CDP: Account created < 6 months ago |
| 10 | VIP Upsell | 5 | Pattern: "vip tier", "premium access", "paid group" |

**Total Weight:** 90 points

---

## Risk Levels

| Risk Score | Risk Level | Color | Action |
|------------|------------|-------|--------|
| 0-3 | LOW | 🟢 | Proceed with normal caution |
| 3-5 | MEDIUM | 🟡 | Investigate further before engaging |
| 5-7 | HIGH | 🟠 | Exercise extreme caution |
| 7-10 | CRITICAL | 🔴 | DO NOT engage |

---

## Verification Status

| Status | Detection | Impact on Score |
|--------|-----------|-----------------|
| VERIFIED | CDP: Blue checkmark detected | Reduces risk by 20% (if not LOW) |
| NOT VERIFIED | CDP: No blue checkmark | Adds "No Verification" red flag (weight 10) |
| UNKNOWN | CDP not available | No adjustment |

---

## Example Calculations

### Example 1: Known Scammer

**Red Flags:**
- Guaranteed Returns: 10
- Requests Crypto: 10
- No Verification: 10
- Unrealistic Claims: 10
- Urgency Tactics: 10

**Calculation:**
```
Total Weight = 10 + 10 + 10 + 10 + 10 = 50
Risk Score = (50 / 90) × 10 = 5.6/10
Risk Level = HIGH
```

---

### Example 2: Legitimate Account

**Red Flags:**
- None detected

**Calculation:**
```
Total Weight = 0
Risk Score = (0 / 90) × 10 = 0/10
Risk Level = LOW
```

---

### Example 3: Suspicious Account

**Red Flags:**
- Private Alpha: 10
- VIP Upsell: 5
- No Verification: 10

**Calculation:**
```
Total Weight = 10 + 5 + 10 = 25
Risk Score = (25 / 90) × 10 = 2.8/10
Risk Level = LOW (but investigate further)
```

---

## Usage

### Run Unified Scanner

```bash
./scripts/scan-x-unified.sh @username
```

### Output

- Markdown report saved to: `output/x-profile-reports/scan-x-unified_[timestamp].md`
- Console output with summary
- Risk score and level
- Red flags detected
- Recommendations

---

## Comparison with Old Scanners

| Feature | Old Scanners | Unified Scanner |
|---------|--------------|-----------------|
| Scoring Scale | 10-20 points (inconsistent) | 90 points (consistent) |
| Weight System | Arbitrary or none | Weighted (based on severity) |
| Verification | None or manual | CDP automated |
| Pattern Detection | HTTP or web fetch | Web fetch (patterns) + CDP (verification) |
| Risk Levels | Inconsistent thresholds | Standardized (0-3, 3-5, 5-7, 7-10) |
| Consistency | Low | High |

---

## Troubleshooting

### Issue: Score seems too high/low

**Solution:**
1. Check which red flags were detected
2. Verify weights are correct
3. Manually inspect profile
4. Adjust weights if needed (update script)

### Issue: Verification status unknown

**Solution:**
1. Check if Chrome CDP is available
2. Verify OpenClaw browser automation is working
3. Try manual verification (inspect profile in browser)

### Issue: Inconsistent scores across scans

**Solution:**
1. Ensure using unified scanner
2. Check for changes in profile between scans
3. Verify web fetch is returning consistent data
4. Report issue for investigation

---

## Migration from Old Scanners

### Step 1: Test Unified Scanner

```bash
# Test on known accounts
./scripts/scan-x-unified.sh @known_scammer
./scripts/scan-x-unified.sh @legitimate_account
./scripts/scan-x-unified.sh @suspicious_account
```

### Step 2: Compare Results

```bash
# Run old scanner for comparison
./scripts/scan-x.sh @known_scammer

# Compare scores and risk levels
```

### Step 3: Validate Accuracy

```bash
# Manually verify results
# Check if red flags are accurate
# Verify risk scores are appropriate
```

### Step 4: Deploy

```bash
# Replace old scanner with unified scanner
# Update documentation
# Train team
```

---

## Support

For issues or questions:
1. Check this guide
2. Review analysis report: `output/x-profile-reports/RISK_SCORING_INCONSISTENCY_ANALYSIS.md`
3. Consult AGENTS.md for framework details
4. Report issues for investigation

---

**Scan first, ape later! 🔐**

$AGNTCBRO #ScamDetection #Solana