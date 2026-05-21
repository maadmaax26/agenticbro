# Social Media Scanner Scoring Standardization Analysis

**Date:** 2026-04-13  
**Task:** Analyze and standardize scoring for Instagram, Facebook, and TikTok profile scanners  
**Reference:** X.com unified 90-point weighted scoring system

---

## Executive Summary

After analyzing all three platform scanners (Instagram, Facebook, TikTok), I found **significant inconsistencies** in scoring algorithms:

- **Instagram:** Uses arbitrary 1-3 point weights, max 10 points, 16 different flags
- **Facebook:** Uses 1-2 point weights, then doubles the score (max 10), 8 different flags
- **TikTok:** Uses arbitrary 1-3 point weights, max 10 points, 20 different flags
- **X.com (Reference):** Uses standardized 90-point weighted scoring with 10 red flag types

**Root Cause:** Each platform was developed independently without a unified scoring framework, leading to inconsistent risk assessments across platforms.

---

## Current Scoring Comparison

### Instagram Scanner (`scan-instagram.py`)

**Scoring Method:** Arbitrary weights (1-3 points per flag)

| Flag | Weight | Description |
|------|--------|-------------|
| Crypto mentions | 1 | Crypto keywords in bio/profile |
| DM solicitation | 2 | DM for more/contact me |
| Business/DM gatekeeping | 2 | Business inquiry/partnership |
| Airdrop/giveaway | 2 | Airdrop/giveaway language |
| Unrealistic returns | 2 | 24h/overnight/guarantee |
| Download links | 3 | .exe/.apk/download |
| Emotional manipulation | 2 | Family need/emergency/sick |
| Affiliate marketing | 2 | Affiliate/partner/referral |
| Urgency tactics | 1 | Act now/join now/limited time |
| Malware installation | 3 | Install app/software |
| Price simulation | 1 | $ + invest/trading |
| Investment risk indicators | 2 | Risk-free/secure/100% profit |
| VIP/premium claims | 1 | VIP/premium/exclusive |
| Trading signals | 1 | Signals + trading/crypto |
| Short links | 3 | bit.ly/tinyurl.com/lnkd.in |
| Team investment | 2 | Team + invest/project/fund |
| Ambiguous profile | 1 | Hire me/work with me |

**Risk Levels:**
- 0-2: LOW
- 3-4: MEDIUM
- 5-6: MEDIUM
- 7-10: HIGH

**Verification Levels:**
- 0 flags: LIKELY SAFE
- 1-2 flags: PATTERN MATCHES
- 3-4 flags: UNVERIFIED
- 5+ flags: HIGH RISK

**Max Possible Score:** 10 (capped)

---

### Facebook Scanner (`scan-facebook.sh`)

**Scoring Method:** 1-2 point weights, then doubled (max 10)

| Flag | Weight | Description |
|------|--------|-------------|
| Cryptocurrency keywords | 1 | crypto/bitcoin/ethereum/doge/$ |
| Financial keywords | 1 | invest/loan/profit/money/earn |
| Unrealistic returns | 2 | guaranteed/24h/overnight/instant/fast/100x |
| Russian scam indicators | 2 | trusted.*relationships.*acquisition |
| Emotional manipulation | 2 | family/help/charity/emergency |
| Virtual companion fraud | 2 | messages to community |
| Download/File attachment | 2 | attachment/.pdf/.exe/.zip/.txt |
| Crypto giveaway | 2 | giveaway/airdrop/claim.*crypto/free.*bitcoin |

**Risk Levels:**
- 0-2: LIKELY SAFE
- 3-4: LOW RISK
- 5-7: MEDIUM RISK
- 8-10: HIGH RISK

**Max Possible Score:** 10 (capped)

---

### TikTok Scanner (`tiktok-scan.py`)

**Scoring Method:** Arbitrary weights (1-3 points per flag)

| Flag | Weight | Description |
|------|--------|-------------|
| DM solicitation for crypto | 2 | DM + crypto/investment/promo |
| Airdrop/giveaway | 2 | Airdrop/giveaway/free |
| Unrealistic returns | 2 | 24h/overnight/guarantee |
| Crypto keywords | 1 | doge/solana/crypto/token |
| Download links | 3 | .exe/.apk/download |
| Limited content | 2 | <5 videos |
| Emotional manipulation | 2 | Family need/emergency/sick |
| Business/DM gatekeeping | 2 | Business + DM |
| Affiliate marketing | 2 | Affiliate/partner |
| Urgency tactics | 1 | Act now/join now/limited time |
| Contact-only patterns | 2 | Contact + via/soon |
| Suspicious URL shortener | 3 | short.ly/bit.ly/tinyurl.com/cutt.ly |
| Malware installation | 3 | Secure/install + wallet/app |
| Private profile | 2 | Private/private account |
| Price simulation | 1 | • + invest/trading |
| Team investment | 2 | Team + invest/project |
| VIP/premium claims | 1 | VIP/premium/exclusive |
| Trading signals | 1 | Signals + crypto/trading |
| Wallet claiming | 2 | Crypto + wallet/claim |
| Random characters | 1 | @#•%^&* |

**Risk Levels:**
- 0-2: VERY LOW
- 3-4: LOW
- 5-6: MEDIUM
- 7-10: HIGH

**Verification Levels:**
- 0 flags: LIKELY SAFE
- 1-2 flags: PATTERN MATCHES
- 3-4 flags: UNVERIFIED
- 5+ flags: HIGH RISK

**Max Possible Score:** 10 (capped)

---

### X.com Scanner (Reference - `scam-automation-loop.py`)

**Scoring Method:** Standardized 90-point weighted scoring

| Flag | Weight | Description |
|------|--------|-------------|
| DM solicitation | 15 | DM + me/for |
| Giveaway | 20 | Giveaway language |
| Airdrop | 10 | Airdrop language |
| Unrealistic returns | 25 | 100x/1000x |
| Free crypto | 15 | Free + crypto |
| Alpha DM scheme | 15 | Alpha + DM |
| Guaranteed returns | 20 | Guaranteed |
| Low followers + high claims | 10 | <1K followers + high risk |

**Risk Levels:**
- 0-3: LOW
- 3-5: MEDIUM
- 5-7: HIGH
- 7-10: CRITICAL

**Max Possible Score:** 10 (calculated as risk/90 * 10)

---

## Inconsistencies Identified

### 1. **Different Weight Scales**
- Instagram: 1-3 points
- Facebook: 1-2 points (then doubled)
- TikTok: 1-3 points
- X.com: 10-25 points (normalized to 90-point scale)

### 2. **Different Risk Level Thresholds**
- Instagram: 0-2 LOW, 3-6 MEDIUM, 7-10 HIGH
- Facebook: 0-2 SAFE, 3-4 LOW, 5-7 MEDIUM, 8-10 HIGH
- TikTok: 0-2 VERY LOW, 3-4 LOW, 5-6 MEDIUM, 7-10 HIGH
- X.com: 0-3 LOW, 3-5 MEDIUM, 5-7 HIGH, 7-10 CRITICAL

### 3. **Different Red Flag Types**
- Instagram: 16 unique flags
- Facebook: 8 unique flags
- TikTok: 20 unique flags
- X.com: 8 unique flags

### 4. **Different Verification Levels**
- Instagram: 4 levels (LIKELY SAFE, PATTERN MATCHES, UNVERIFIED, HIGH RISK)
- Facebook: No verification levels
- TikTok: 4 levels (LIKELY SAFE, PATTERN MATCHES, UNVERIFIED, HIGH RISK)
- X.com: No verification levels (uses risk levels only)

### 5. **Inconsistent Flag Descriptions**
- Same concept has different names across platforms
- Different weights for similar flags
- Some platforms have platform-specific flags (e.g., TikTok's "limited content")

---

## Root Cause Analysis

### Why Different Platforms Have Different Scoring

1. **Independent Development:** Each scanner was built separately without a unified framework
2. **Platform-Specific Features:** Different platforms have different content structures (e.g., TikTok video counts)
3. **No Standardization:** No reference document or scoring framework was established
4. **Iterative Development:** Flags were added over time without reviewing existing weights
5. **Different Developers:** Different people may have different interpretations of risk

### Which Scoring Method is Most Accurate?

**X.com's 90-point weighted scoring is the most accurate** because:

1. **Consistent Scale:** All weights are on the same scale (10-25 points)
2. **Normalized Output:** Final score is normalized to 0-10 scale
3. **Clear Thresholds:** Risk levels are clearly defined (LOW/MEDIUM/HIGH/CRITICAL)
4. **Fewer Flags:** Focuses on the most important red flags
5. **Proven in Production:** Used in the automation loop for X.com scanning

### What Causes the Discrepancies?

1. **Arbitrary Weight Assignment:** Weights were assigned without a systematic approach
2. **No Weight Normalization:** Different platforms use different weight ranges
3. **Inconsistent Risk Thresholds:** Different platforms have different cutoffs for risk levels
4. **Platform-Specific Flags:** Some flags only apply to certain platforms
5. **No Unified Framework:** No reference document to guide scoring decisions

---

## Recommended Unified Scoring System

### 10 Red Flag Types (Standardized Across All Platforms)

Based on X.com's proven system, here are the 10 red flag types with standardized weights:

| # | Red Flag Type | Weight | Description |
|---|---------------|--------|-------------|
| 1 | Guaranteed Returns | 25 | Claims of guaranteed profits, 100x/1000x returns |
| 2 | Giveaway/Airdrop | 20 | Free crypto, giveaways, airdrops |
| 3 | DM Solicitation | 15 | Requests to DM for more info/alpha |
| 4 | Free Crypto | 15 | Free money/crypto without clear source |
| 5 | Alpha DM Scheme | 15 | "DM for alpha" or similar gatekeeping |
| 6 | Unrealistic Claims | 10 | 24h/overnight profits, instant wealth |
| 7 | Download/Install | 10 | Requests to download .exe/.apk or install apps |
| 8 | Urgency Tactics | 10 | Act now, limited time, last chance |
| 9 | Emotional Manipulation | 10 | Family emergencies, pleas for help |
| 10 | Low Credibility | 10 | New account, low followers, no track record |

**Total Maximum Score:** 90 points

**Final Risk Score:** (Sum of weights / 90) × 10 = 0-10 scale

### Risk Level Thresholds (Standardized)

| Risk Score | Risk Level | Action |
|------------|------------|--------|
| 0-3 | LOW | Monitor, no action needed |
| 3-5 | MEDIUM | Investigate further |
| 5-7 | HIGH | Warn community, investigate |
| 7-10 | CRITICAL | Immediate warning, high priority |

### Verification Levels (Standardized)

| Red Flags Detected | Verification Level | Description |
|--------------------|-------------------|-------------|
| 0 | LIKELY SAFE | No red flags detected |
| 1-2 | PATTERN MATCHES | Some suspicious patterns |
| 3-4 | UNVERIFIED | Multiple red flags, needs investigation |
| 5+ | HIGH RISK | Confirmed scam pattern |

---

## Implementation Plan

### Phase 1: Create Unified Scoring Module

Create a Python module with the unified scoring system:

```python
# unified_scoring.py

RED_FLAGS = {
    "guaranteed_returns": {
        "weight": 25,
        "patterns": ["guaranteed", "100x", "1000x", "guarantee", "sure thing"],
        "description": "Claims of guaranteed profits or unrealistic returns"
    },
    "giveaway_airdrop": {
        "weight": 20,
        "patterns": ["giveaway", "airdrop", "free crypto", "free bitcoin"],
        "description": "Free crypto giveaways or airdrops"
    },
    "dm_solicitation": {
        "weight": 15,
        "patterns": ["dm for", "dm me", "message me", "contact me"],
        "description": "Requests to DM for more information"
    },
    "free_crypto": {
        "weight": 15,
        "patterns": ["free", "no cost", "zero investment"],
        "description": "Free money or crypto without clear source"
    },
    "alpha_dm_scheme": {
        "weight": 15,
        "patterns": ["alpha", "private alpha", "exclusive access", "vip"],
        "description": "Gatekeeping information behind DM/VIP"
    },
    "unrealistic_claims": {
        "weight": 10,
        "patterns": ["24h", "overnight", "instant", "fast profits"],
        "description": "Unrealistic timeframes for profits"
    },
    "download_install": {
        "weight": 10,
        "patterns": [".exe", ".apk", "download", "install app"],
        "description": "Requests to download files or install apps"
    },
    "urgency_tactics": {
        "weight": 10,
        "patterns": ["act now", "limited time", "last chance", "ending soon"],
        "description": "Urgency to create FOMO"
    },
    "emotional_manipulation": {
        "weight": 10,
        "patterns": ["family", "emergency", "sick", "hospital", "desperate"],
        "description": "Emotional pleas for help"
    },
    "low_credibility": {
        "weight": 10,
        "patterns": ["new account", "low followers", "no track record"],
        "description": "Low credibility indicators"
    }
}

def calculate_risk_score(text, metadata=None):
    """Calculate unified risk score"""
    total_weight = 0
    detected_flags = []
    text_lower = text.lower()
    
    for flag_name, flag_data in RED_FLAGS.items():
        for pattern in flag_data["patterns"]:
            if pattern in text_lower:
                total_weight += flag_data["weight"]
                detected_flags.append(flag_name)
                break
    
    # Normalize to 0-10 scale
    risk_score = min((total_weight / 90) * 10, 10)
    
    # Determine risk level
    if risk_score < 3:
        risk_level = "LOW"
    elif risk_score < 5:
        risk_level = "MEDIUM"
    elif risk_score < 7:
        risk_level = "HIGH"
    else:
        risk_level = "CRITICAL"
    
    # Determine verification level
    flag_count = len(detected_flags)
    if flag_count == 0:
        verification_level = "LIKELY SAFE"
    elif flag_count <= 2:
        verification_level = "PATTERN MATCHES"
    elif flag_count <= 4:
        verification_level = "UNVERIFIED"
    else:
        verification_level = "HIGH RISK"
    
    return {
        "risk_score": round(risk_score, 1),
        "risk_level": risk_level,
        "verification_level": verification_level,
        "red_flags_detected": flag_count,
        "flag_details": detected_flags,
        "weights_sum": total_weight
    }
```

### Phase 2: Update Instagram Scanner

Replace the arbitrary scoring with the unified system.

### Phase 3: Update Facebook Scanner

Replace the arbitrary scoring with the unified system.

### Phase 4: Update TikTok Scanner

Replace the arbitrary scoring with the unified system.

### Phase 5: Test All Scanners

Test all scanners with known scam profiles to ensure consistency.

---

## Testing Recommendations

### Test Cases

1. **Known Scam Profile:** Should score 7-10 (HIGH/CRITICAL)
2. **Legitimate Profile:** Should score 0-3 (LOW)
3. **Suspicious Profile:** Should score 3-5 (MEDIUM)
4. **Edge Cases:** Profiles with mixed signals

### Consistency Check

Run the same profile (or similar content) on all three platforms and verify:
- Risk scores are within 1 point of each other
- Risk levels match
- Red flags detected are similar

### Regression Testing

Ensure that previously scanned profiles still produce similar results after the update.

---

## Conclusion

The current scoring systems across Instagram, Facebook, and TikTok are inconsistent and arbitrary. By implementing the unified 90-point weighted scoring system (proven in X.com scanning), we can:

1. **Provide Consistent Results:** All platforms use the same scoring algorithm
2. **Improve Accuracy:** Standardized weights based on proven patterns
3. **Simplify Maintenance:** Single scoring module to update
4. **Enable Cross-Platform Comparison:** Compare risk across platforms
5. **Build Trust:** Consistent methodology builds user trust

The implementation plan outlined above will standardize all three scanners to use the same scoring system, ensuring consistent and accurate scam detection across all social media platforms.

---

**Next Steps:**
1. Create unified_scoring.py module
2. Update Instagram scanner
3. Update Facebook scanner
4. Update TikTok scanner
5. Test all scanners
6. Deploy to production