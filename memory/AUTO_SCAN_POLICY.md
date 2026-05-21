# Auto-Scan Policy for AgenticBro Group

## Trigger Keywords

Auto-scan any member who messages containing:
- "marketing"
- "promotion"
- "promote"
- "pin post"
- "volume" (in context of services)
- "community" (when offering services)
- "shill"
- "kols"
- "influencers"
- "trending"
- "boost"

## Policy

When a member posts messages offering paid marketing, promotion services, or "pin post in my community", automatically:

1. **Scan the profile** using available methods (Chrome CDP, web fetch, database lookup)
2. **Analyze for red flags** (shill account patterns, vague claims, unverifiable track record)
3. **Post risk assessment** to the group
4. **Add to scammer database** if HIGH RISK
5. **Warn the community** about the account

## Risk Scoring for Paid Promoters

| Red Flag | Weight |
|----------|--------|
| Unsolicited promotion offer | +15 |
| Vague volume/follower claims | +10 |
| "Pin post in my community" language | +10 |
| No track record verification | +8 |
| Generic shill account pattern | +8 |
| Paid promoter solicitation | +10 |
| Telegram redirect for private deal | +12 |
| New account (<30 days) | +8 |
| No blue checkmark + offering services | +5 |
| Copy/paste promotional message | +7 |

**Thresholds:**
- 0-30: LOW RISK (legitimate influencer)
- 31-50: MEDIUM RISK (exercise caution)
- 51-70: HIGH RISK (avoid engagement)
- 71-90: CRITICAL (confirmed scam)

## Actions

- **LOW RISK:** Allow, but verify independently
- **MEDIUM RISK:** Post warning, allow discussion
- **HIGH RISK:** Post full risk assessment, recommend DO NOT ENGAGE
- **CRITICAL:** Post alert, add to database, recommend ban

## Implementation

Policy active as of: 2026-04-05
Applies to: All new members posting promotional content