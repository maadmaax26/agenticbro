# Profile Identifier Scan Method

## Default Scan Method for All Sessions

**Effective:** April 2, 2026  
**Last Updated:** April 10, 2026 (Telegram Username Resolution Added)  
**Method:** Chrome CDP Browser Automation (X) + Web Tool Resolution (Telegram)  
**Port:** 18800  
**User Data Dir:** `/tmp/chrome-openclaw`

---

## Platform Detection

Before scanning, detect the platform:

| Platform | Identifier Pattern | Scan Method |
|----------|-------------------|-------------|
| **X/Twitter** | `@username` (no domain) or `x.com/username` | **Chrome CDP Browser Automation (DEFAULT)** |
| **Telegram** | `@username` with `t.me/` or `telegram` context | Web Tool → User ID → Account Age Analysis |
| **Discord** | `username#1234` or `discord.gg/` | Not supported yet |
| **Instagram** | `@username` with `instagram.com/` | **Chrome CDP Browser Automation (DEFAULT)** |
| **Facebook** | `facebook.com/username` or profile URL | **Chrome CDP Browser Automation (DEFAULT)** |

---

## Telegram Username Resolution

### Method: Web Tool (tg-user.id)

Telegram Bot API **cannot** resolve username → user_id without prior interaction.

**Solution:** Use web tool to resolve username → user_id, then analyze.

### Resolution Workflow

```
1. Receive Telegram username (e.g., @gost1_man)
2. Fetch https://tg-user.id/ or use MTProto if available
3. Extract user_id from response
4. Estimate account age from user_id pattern
5. Assess risk level based on age + patterns
```

### User ID Age Estimation

| User ID Range | Estimated Age | Risk Level |
|---------------|---------------|------------|
| < 1,000,000 | Pre-2018 | LOW |
| 1M - 10M | 2018-2020 | LOW |
| 10M - 100M | 2020-2022 | MEDIUM |
| 100M - 1B | 2022-2024 | MEDIUM-HIGH |
| > 1B | 2024-2025 | HIGH |

### Telegram Username → User ID Script

**Script:** `/scripts/telegram-id-lookup-simple.py`

**Usage:**
```bash
# For user_id (works now)
python scripts/telegram-id-lookup-simple.py 7062008359

# For username (needs re-auth or web tool)
python scripts/telegram-id-lookup-simple.py @gost1_man
```

**MTProto Credentials:**
- Location: `/aibro/.env.local`
- API_ID: `33421119`
- API_HASH: Configured
- SESSION_STRING: May need re-authentication

**If MTProto fails:**
1. Use https://tg-user.id/ to manually resolve username → user_id
2. Input user_id into script for age/risk analysis

---

## Why Chrome CDP (for X/Twitter)?

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
- **Join Date (Account Age)** ← IMPORTANT
- **Verification Status** ← CHECK FOR BLUE CHECKMARK using `data-testid="icon-verified"`
- Recent Posts (10-20)

### 5a. Calculate Account Age Risk

**Account Age Risk Scoring:**

| Account Age | Risk Level | Score |
|-------------|------------|-------|
| < 30 days | CRITICAL | +15 points |
| 30-90 days | HIGH | +10 points |
| 90-180 days | MEDIUM | +5 points |
| 180-365 days | LOW | +2 points |
| > 365 days | MINIMAL | +0 points |

**Telegram Account Age Estimation:**

Telegram does not publicly show account creation date. However, we can estimate:

1. **User ID Analysis:**
   - Lower user IDs = older accounts
   - User ID format: 7-9 digits for newer accounts
   - User ID format: 6-7 digits for older accounts (2018-2020)
   - User ID format: <6 digits for very old accounts (pre-2018)

2. **Username Pattern:**
   - Generic names + numbers (gost123_man) = often newer accounts
   - Established brand names = varied
   - Real names = varied

3. **Profile Completeness:**
   - No photo = often newer/suspicious
   - No bio = often newer/suspicious
   - No username = often newer

**For @gost1_man:**
- Username pattern: Generic name + number pattern (gost1_man)
- Display name: "Night Ghost" (anonymous/pseudonymous)
- **Risk Indicator:** Generic name + number pattern often indicates newer accounts created for specific purposes

### 6. Analyze Red Flags (Standard Scam Detection)

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

### 6a. Analyze Pig Butchering Indicators

Apply additional scoring (max 100 points):

| Pig Butchering Red Flag | Weight | Detection Method |
|-------------------------|--------|-------------------|
| Wrong Number Text Pattern | 8 | DM pattern analysis |
| Romance + Crypto Mention | 10 | Keyword combo |
| Fake Platform Link | 10 | URL validation |
| Video Call Avoidance | 9 | Profile behavior |
| Wealth Display + Investment Pitch | 9 | Photo/bio analysis |
| Guaranteed/Urgent Returns | 9 | Keyword search |
| Small Win Pattern | 8 | Post pattern analysis |
| Tax/Fee Demand | 10 | Keyword search |
| DM Solicitation Pattern | 8 | "DM me" keyword search |
| Bot-Like Template Replies | 8 | Post similarity analysis |

**Pig Butchering Detection Phrases:**

```
Initial Contact:
- "Hey, is this [name]?"
- "Sorry, wrong number, but..."
- "Impressed by your [work/profile]"
- "I got your number from [friend]"

Investment Pitch:
- "I'll show you exactly when to buy/sell"
- "This platform has better rates"
- "Download this app"
- "I can teach you"
- "My uncle/mentor showed me"

Urgency:
- "This opportunity won't last"
- "Market moving fast"
- "Act now"

DM Solicitation:
- "DM me for more info"
- "Want free help? DM me"
- "Send me a message"

Template Replies (Bot Networks):
- "Impressed by your work! Let's collaborate!"
- "Ready to collaborate for a brighter future?"
- "Exploring opportunities for synergy"
- "Let's dive into it"
```

### 7. Calculate Risk Score

```
Standard Scam Score = (Total Red Flags / 90) × 10
Pig Butchering Score = (Total PB Flags / 100) × 10

Combined Risk Score = max(Standard Scam Score, Pig Butchering Score)
```

**Risk Levels:**
- 0-3: LOW
- 3-5: MEDIUM
- 5-7: HIGH
- 7-10: CRITICAL

### 8. Output Format (REQUIREMENTS)

#### ⚠️ MANDATORY DISCLAIMER (Every Scan Result)

**EVERY scan result MUST include the disclaimer at the END of the output:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DISCLAIMER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• EDUCATIONAL PURPOSES ONLY
• NOT FINANCIAL ADVICE
• NOT AN INVESTMENT RECOMMENDATION
• NOT A GUARANTEE OF SAFETY
• ALWAYS DO YOUR OWN DUE DILIGENCE

Scan Date: [YYYY-MM-DD HH:MM TZ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Markdown Report Format (REQUIRED)

```markdown
# [Platform] Profile Scan Report: @[handle]

**Scan Date:** [Date]
**Requested By:** [User]
**Platform:** [Platform]
**Risk Level:** [LEVEL] ([Score]/10)

---

## Profile Information

[Table with profile data]

---

## Red Flags Detected

[Table with red flags]

---

## Risk Assessment

[Risk breakdown]

---

## Conclusion

[Summary]

---

## Recommendation

[What to do]

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DISCLAIMER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• EDUCATIONAL PURPOSES ONLY
• NOT FINANCIAL ADVICE
• NOT AN INVESTMENT RECOMMENDATION
• NOT A GUARANTEE OF SAFETY
• ALWAYS DO YOUR OWN DUE DILIGENCE

Scan Date: [YYYY-MM-DD HH:MM TZ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Scan first, Trust later! 🔐**
```

### Database Entry (CSV)

```csv
Scammer Name,Platform,X Handle,Telegram Channel,Victims Count,Total Lost USD,Verification Level,Scam Type,Last Updated,Notes,Wallet Address,Evidence Links,Scan Date,Scanner,Additional Notes
```

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
  "disclaimer": {
    "text": "EDUCATIONAL PURPOSES ONLY - NOT FINANCIAL ADVICE - NOT A GUARANTEE",
    "scan_datetime": "YYYY-MM-DD HH:MM:SS TZ"
  },
  "target": { ... },
  "profile_data": { ... },
  "verification_status": { ... },
  "red_flag_analysis": {
    "standard_scam_flags": [...],
    "pig_butchering_flags": [...],
    "combined_score": X.X
  },
  "risk_score": { ... },
  "content_analysis": { ... },
  "scam_type_detection": {
    "primary_type": "...",
    "secondary_types": [...],
    "confidence": "HIGH|MEDIUM|LOW"
  },
  "conclusion": { ... }
}
```

---

## Pig Butchering Detection Algorithm

```python
def detect_pig_butchering(profile_data, messages, bio_text):
    """
    Detect pig butchering (Sha Zhu Pan) scam indicators.
    
    Args:
        profile_data: Dict with user profile information
        messages: List of recent posts/replies
        bio_text: Profile bio text
    
    Returns:
        Dict with pig_butchering_score, red_flags, scam_type
    """
    
    pb_score = 0
    red_flags = []
    
    # Check for romance + crypto combo in bio
    romance_keywords = ['love', 'relationship', 'looking for', 'single', 'dating']
    crypto_keywords = ['crypto', 'bitcoin', 'trading', 'invest', 'alpha', 'profits']
    
    has_romance = any(kw in bio_text.lower() for kw in romance_keywords)
    has_crypto = any(kw in bio_text.lower() for kw in crypto_keywords)
    
    if has_romance and has_crypto:
        red_flags.append("ROMANCE_CRYPTO_COMBO")
        pb_score += 10
    
    # Check for DM solicitation pattern
    dm_patterns = ['dm me', 'message me', 'send dm', 'free help', 'assistance']
    for msg in messages:
        if any(pattern in msg.lower() for pattern in dm_patterns):
            red_flags.append("DM_SOLICITATION")
            pb_score += 8
            break
    
    # Check for template replies (bot network)
    template_phrases = [
        'impressed by your work',
        'let\'s collaborate',
        'exploring opportunities',
        'synergy',
        'brighter future'
    ]
    
    template_count = sum(1 for msg in messages 
                         for phrase in template_phrases 
                         if phrase in msg.lower())
    
    if template_count >= 3:
        red_flags.append("BOT_NETWORK_TEMPLATES")
        pb_score += 8
    
    # Check for urgency/guaranteed returns
    urgency_keywords = ['guaranteed', 'limited time', 'act now', 'don\'t miss', 'fast']
    for msg in messages:
        if any(kw in msg.lower() for kw in urgency_keywords):
            red_flags.append("URGENCY_TACTICS")
            pb_score += 9
            break
    
    # Check for wealth display + investment pitch
    wealth_keywords = ['luxury', 'exotic', 'fancy', 'wealth', 'rich']
    investment_keywords = ['invest', 'portfolio', 'profits', 'returns', 'trading']
    
    has_wealth = any(kw in bio_text.lower() for kw in wealth_keywords)
    has_investment = any(kw in bio_text.lower() for kw in investment_keywords)
    
    if has_wealth and has_investment:
        red_flags.append("WEALTH_INVESTMENT_PITCH")
        pb_score += 9
    
    # Cap at 10
    pb_score = min(pb_score, 10)
    
    # Determine scam type
    if pb_score >= 7:
        if 'ROMANCE_CRYPTO_COMBO' in red_flags:
            scam_type = "Pig Butchering (Romance)"
        elif 'BOT_NETWORK_TEMPLATES' in red_flags:
            scam_type = "Coordinated Shill Network"
        elif 'DM_SOLICITATION' in red_flags:
            scam_type = "Engagement Farming Bot"
        else:
            scam_type = "Pig Butchering"
    else:
        scam_type = None
    
    return {
        "pig_butchering_score": pb_score,
        "red_flags": red_flags,
        "scam_type": scam_type,
        "risk_level": "CRITICAL" if pb_score >= 7 else "HIGH" if pb_score >= 5 else "MEDIUM"
    }
```

---

## Report Storage

- **CSV Database:** `/workspace/scammer-database.csv`
- **Detailed Reports:** `/workspace/output/scan_reports/[HANDLE]_[DATE].json`
- **Pig Butchering Test Data:** `/workspace/output/pig_butchering_test_data.json`

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
   - Red Flags (checklist) - includes pig butchering flags
   - Scam Type (pump & dump, pig butchering, etc.)
   - Content Analysis (recent posts)
   - Partnership Assessment (if applicable)
   - Conclusion (scammer/legitimate/pig butchering)

### For Telegram Bot

When a scan is requested:

1. **Perform Scan:** Chrome CDP → X profile
2. **Analyze:** Standard scam + pig butchering indicators
3. **Generate Report:** Save JSON
4. **Update Database:** Append CSV
5. **Send Summary:** Post to Telegram group with scam type

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

### Pig Butchering Suspects

- Mark with special flag: "PIG_BUTCHERING_SUSPECT"
- Include romance + crypto indicator
- Add fake platform warning
- Recommend FBI IC3 reporting

---

## Performance Metrics

- **Scan Duration:** ~15-25 seconds per profile
- **Accuracy:** Real-time data from X
- **Cost:** Free (no API costs)
- **Limit:** Browser automation speed
- **Pig Butchering Detection:** Additional 2-5 seconds

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

### Pig Butchering False Positives

- Check for multiple indicators (not just one)
- Look for pattern combinations (romance + crypto + urgency)
- Verify account age (old accounts less likely to be new scam accounts)

---

## Future Enhancements

1. **Batch Scanning:** Multiple profiles in sequence
2. **Screenshot Capture:** Save profile screenshots
3. **Engagement Analysis:** Bot follower detection
4. **Historical Tracking:** Track profile changes over time
5. **API Endpoint:** REST API for scan requests
6. **ML Detection:** Machine learning model for pig butchering patterns
7. **Network Analysis:** Detect coordinated accounts (like @AshCryptoX1 + @raynft_)

---

**This method is now the DEFAULT for all profile identifier scans across all sessions.** 

**Pig butchering detection is integrated as part of the standard scanning process.**