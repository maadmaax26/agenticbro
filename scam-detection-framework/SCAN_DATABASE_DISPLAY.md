# Scan Database Display Guide

## When a Scan Report Card is Selected

**Location:** `/workspace/output/scan_reports/[HANDLE]_[DATE].json`  
**Database:** `/workspace/scammer-database.csv`

---

## Display Format

### Header Section

```
🔍 Profile Scan Report
━━━━━━━━━━━━━━━━━━━━━━

@HANDLE (Display Name)
Verification Level: [LEVEL]
Risk Score: X.X/10 [LEVEL]
```

### Profile Summary Card

```
📊 Profile Summary
─────────────────
Followers:     XXX,XXX
Following:     XX,XXX
Posts:         XX,XXX
Account Age:   XX years
Joined:        Month Year
Location:      City, Country
Bio:           [Full bio text]
Telegram:       @handle (if available)
```

### Risk Score Gauge

```
Risk Score: 2.8/10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOW ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    0       2.8        5         7.5        10

Risk Level: LOW (0-3 range)
```

### Red Flag Checklist

```
🚩 Red Flags Detected (Weight: Score)

✅ ❌ Guaranteed Returns (15 pts) - Score: 0
    [Notes about detection]

✅ ❌ Private Alpha (15 pts) - Score: 0
    [Notes]

⚠️  Unrealistic Claims (15 pts) - Score: 15
    "#100x #GEM claims in posts"

⚠️  Urgency Tactics (10 pts) - Score: 5
    "Mild urgency language detected"

✅ ❌ No Track Record (10 pts) - Score: 0
    "14+ years on platform"

[... remaining flags ...]

Total: 25/90 points
```

### Content Analysis

```
📝 Recent Posts Analyzed

1. [Date] - [Content Preview]
   Type: [paid_promotion/engagement/unrealistic_claim]
   
2. [Date] - [Content Preview]
   Type: [type]

Engagement: XX% engagement ratio
Promotion Frequency: [description]
```

### Verification Status

```
✓ Verification Level: PAID PROMOTER

Reasoning:
• Legitimate account (14+ years)
• High follower count (717K)
• Established crypto influencer
• Does paid token promotions
• AMA HOST experience
```

### Partnership Assessment (if applicable)

```
🤝 Partnership Assessment

Viable Target: ✅ YES

Pros:
• Legitimate account
• Established influencer
• High engagement
• AMA HOST experience

Considerations:
• Does paid promotions
• Unrealistic claims in some posts
• Multiple token promotions

Recommendation:
[Viable partnership target. Ensure disclosure of paid promotion status.]
```

### Conclusion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 CONCLUSION

Is Scammer:     ❌ NO
Is Legitimate:  ✅ YES
Is Paid Promoter: ⚠️ YES

Action: [Proceed with partnership outreach]
        [Ensure disclosure of paid promotion status]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Scan Metadata

```
🔧 Scan Details
───────────────
Scan ID:      SCAN-2026-04-02-001
Method:       Chrome CDP Browser Automation
Duration:     ~15 seconds
Scanner:      Jarvis (agentic-bro agent)
Timestamp:    2026-04-02T13:11:00Z
```

---

## Verification Level Badges

| Level | Badge | Color |
|-------|-------|-------|
| Unverified | `❓ UNVERIFIED` | Gray |
| Partially Verified | `⚠️ PARTIALLY VERIFIED` | Yellow |
| Verified Scammer | `🚫 VERIFIED SCAM` | Red |
| Legitimate | `✅ LEGITIMATE` | Green |
| Paid Promoter | `⚠️ PAID PROMOTER` | Orange |
| High Risk | `🔴 HIGH RISK` | Dark Red |

---

## Risk Level Colors

| Level | Range | Color |
|-------|-------|-------|
| LOW | 0-3 | 🟢 Green |
| MEDIUM | 3-5 | 🟡 Yellow |
| HIGH | 5-7 | 🟠 Orange |
| CRITICAL | 7-10 | 🔴 Red |

---

## Database Fields (CSV)

When displaying from CSV:

```
Field 1:  Scammer Name
Field 2:  Platform
Field 3:  X Handle
Field 4:  Telegram Channel
Field 5:  Victims Count
Field 6:  Total Lost USD
Field 7:  Verification Level
Field 8:  Scam Type
Field 9:  Last Updated
Field 10: Notes
Field 11: Wallet Address
Field 12: Evidence Links
Field 13: Scan Date
Field 14: Scanner
Field 15: Additional Notes
```

---

## API Endpoints (for website)

### Get All Scans

```
GET /api/scans
→ Returns CSV data as JSON array
```

### Get Single Scan

```
GET /api/scans/:handle/:date
→ Returns JSON report file
```

### Get Latest Scan for Handle

```
GET /api/scans/:handle/latest
→ Returns most recent JSON report
```

---

## Integration with Agentic Bro Website

When implementing the scan report display:

1. **Card Selection:** User clicks scan report card
2. **Load Data:** Fetch JSON report from `/output/scan_reports/`
3. **Render Display:** Use format above
4. **Show Actions:**
   - If scammer: "Report" / "Warn Community"
   - If legitimate: "Partner" / "Safe to Engage"
   - If paid promoter: "Partner (with disclosure)" / "Caution Advised"

---

**This guide ensures consistent display of scan report details across all platforms.**