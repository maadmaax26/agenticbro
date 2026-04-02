# Profile Identifier Scan Method

## Default Scan Method for All Sessions

**Effective:** April 2, 2026  
**Method:** Chrome CDP Browser Automation  
**Port:** 18800  
**User Data Dir:** `/tmp/chrome-openclaw`

---

## Why Chrome CDP?

1. **Real-Time Data:** Browser-based scanning captures live X/Twitter profile data
2. **No API Limits:** No X API costs or rate limits
3. **Full Visibility:** Access to all profile elements (followers, posts, engagement)
4. **Accurate Metrics:** Real follower counts vs. cached/API data

---

## Scan Process

### 1. Start Chrome CDP (if not running)

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=18800 \
  --user-data-dir=/tmp/chrome-openclaw &>/dev/null &
```

### 2. Navigate to Profile

```bash
curl -X PUT "http://localhost:18800/json/new?https://x.com/[HANDLE]"
```

### 3. Wait for Page Load (3-5 seconds)

### 4. Extract Profile Data

Use WebSocket to evaluate JavaScript:
```javascript
document.body.innerText
```

### 5. Parse Key Fields

- Display Name
- Handle
- Followers Count
- Following Count
- Post Count
- Bio
- Location
- Join Date
- Verification Status
- Recent Posts (10-20)

### 6. Analyze Red Flags

Apply weighted scoring (max 90 points):

| Red Flag | Weight | Detection Method |
|----------|--------|------------------|
| Guaranteed Returns | 15 | Keyword search |
| Private Alpha | 15 | Keyword search |
| Unrealistic Claims | 15 | Keyword search + context |
| Urgency Tactics | 10 | Keyword search |
| No Track Record | 10 | Account age check |
| Requests Crypto | 10 | Keyword search |
| No Verification | 10 | Badge check |
| Fake Followers | 10 | Ratio analysis |
| New Account | 10 | Join date check |
| VIP Upsell | 10 | Keyword search |

### 7. Calculate Risk Score

```
Risk Score = (Total Red Flags / 90) × 10
```

**Risk Levels:**
- 0-3: LOW
- 3-5: MEDIUM
- 5-7: HIGH
- 7-10: CRITICAL

### 8. Determine Verification Level

| Level | Criteria |
|-------|----------|
| **Unverified** | Insufficient data |
| **Partially Verified** | Pattern matches |
| **Verified** | 5+ victims confirmed |
| **Legitimate** | Verified safe account |
| **PAID PROMOTER** | Legitimate but does paid promos |
| **HIGH RISK** | Confirmed scam |

---

## Output Format

### Database Entry (CSV)

```csv
Scammer Name,Platform,X Handle,Telegram Channel,Victims Count,Total Lost USD,Verification Level,Scam Type,Last Updated,Notes,Wallet Address,Evidence Links,Scan Date,Scanner,Additional Notes
```

### Detailed Report (JSON)

```json
{
  "scan_id": "SCAN-YYYY-MM-DD-XXX",
  "scan_type": "X Profile Identifier",
  "scan_method": "Chrome CDP Browser Automation",
  "timestamp": "ISO-8601",
  "target": { ... },
  "profile_data": { ... },
  "verification_status": { ... },
  "red_flag_analysis": { ... },
  "risk_score": { ... },
  "content_analysis": { ... },
  "conclusion": { ... }
}
```

---

## Report Storage

- **CSV Database:** `/workspace/scammer-database.csv`
- **Detailed Reports:** `/workspace/output/scan_reports/[HANDLE]_[DATE].json`

---

## Integration Points

### For Agentic Bro Website

When a user selects a scan report card:

1. **Read JSON Report:**
   ```javascript
   fetch(`/api/scan-reports/${handle}_${date}.json`)
   ```

2. **Display Fields:**
   - Profile Summary (followers, posts, age)
   - Risk Score (visual gauge)
   - Red Flags (checklist)
   - Content Analysis (recent posts)
   - Partnership Assessment (if applicable)
   - Conclusion (scammer/legitimate/paid promoter)

### For Telegram Bot

When a scan is requested:

1. **Perform Scan:** Chrome CDP → X profile
2. **Generate Report:** Save JSON
3. **Update Database:** Append CSV
4. **Send Summary:** Post to Telegram group

---

## Handling Special Cases

### Locked/Suspended Accounts

- Risk Score: N/A
- Verification Level: Unverified
- Notes: "Account locked or suspended - cannot verify"

### Private Accounts

- Risk Score: N/A
- Verification Level: Unverified
- Notes: "Private account - limited visibility"

### X Login Required

- May need to handle login page redirect
- Check for "Log in" or "Sign up" in page text
- If detected, note in report: "Profile requires login - limited data"

---

## Performance Metrics

- **Scan Duration:** ~15 seconds per profile
- **Accuracy:** Real-time data from X
- **Cost:** Free (no API costs)
- **Limit:** Browser automation speed

---

## Troubleshooting

### Chrome CDP Not Running

```bash
# Check if running
curl http://localhost:18800/json/list

# If no response, start Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=18800 \
  --user-data-dir=/tmp/chrome-openclaw &>/dev/null &
```

### Page Not Loading

- Wait longer (5-10 seconds)
- Check network connection
- Try refreshing tab

### WebSocket Errors

- Ensure `ws` module installed: `npm install ws`
- Check WebSocket URL from `/json/list`

---

## Future Enhancements

1. **Batch Scanning:** Multiple profiles in sequence
2. **Screenshot Capture:** Save profile screenshots
3. **Engagement Analysis:** Bot follower detection
4. **Historical Tracking:** Track profile changes over time
5. **API Endpoint:** REST API for scan requests

---

**This method is now the DEFAULT for all profile identifier scans across all sessions.**