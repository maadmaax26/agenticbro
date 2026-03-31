# Facebook Page Scanning - Test Cases

## Test Page: Fake Crypto Signals Page

### URL (Hypothetical - Based on Research Patterns)
```
https://facebook.com/solana-vip-signals-official-2024
```

### Expected Page Characteristics (Based on Research)
- **Name:** Solana VIP Signals Official
- **Verified:** ❌ No blue checkmark
- **Created:** 2 weeks ago (14 days)
- **Followers:** 15,000 (suspicious growth for new page)
- **Posts:** 50+ (high activity for new page)
- **Bio:** "🚀 Verified Solana VIP signals. Join our VIP tier for guaranteed 500% monthly returns. Spots limited!"
- **Recent Posts:** 
  1. "🔥 LIMITED TIME: Join VIP Tier 1 today for $100/month. Guaranteed 500% returns!"
  2. "💎 Pool trading investment opening soon. Invest with us and multiply your crypto!"
  3. "⚠️ Only 5 spots left for Premium VIP. DM to secure your spot!"
  4. "100% ROI guaranteed in first month. No risk trading!"

### Expected Red Flags
1. ⚠️ Unverified page (+5 points)
2. ⚠️ New page (14 days old) (+4 points)
3. ⚠️ VIP tier structure (Tier 1: $100/month) (+7 points)
4. ⚠️ Guaranteed returns ("500% monthly", "100% ROI") (+9 points)
5. ⚠️ Pool trading mentioned (+8 points)
6. ⚠️ Urgency tactics ("LIMITED TIME", "Only 5 spots left") (+6 points)

### Expected Risk Score
```
Total Red Flag Weight: 5 + 4 + 7 + 9 + 8 + 6 = 39
Risk Score: (39 / 70) × 10 = 5.6/10
Risk Level: HIGH (5.6 falls in 5-7 range)
```

### Expected Output
```
🔍 Facebook Page Scan: Solana VIP Signals Official (FAKE)

Risk Score: 5.6/10 (HIGH RISK)
Risk Level: HIGH
Verification Status: UNVERIFIED

Red Flags Detected (6):
• ⚠️ Page is not verified (+5)
• ⚠️ Page is 14 days old (+4)
• ⚠️ VIP tier structure in bio (+7)
• ⚠️ Post mentions "guaranteed returns" (+9)
• ⚠️ Pool trading mentioned (+8)
• ⚠️ Urgency tactics: "LIMITED TIME" (+6)

Key Findings:
• 15K followers, unverified
• 2 weeks old, 50+ posts (suspicious activity)
• Multiple red flags: VIP tiers, guaranteed returns, pool trading
• Urgency tactics to pressure quick decisions
• No track record or verifiable performance data

Recommendation: ⚠️ HIGH RISK - Avoid interaction
• Do not send crypto
• Do not join VIP tiers
• Report page to Meta and community
• Warn others about this scam

$AGNTCBRO #ScamDetection #CryptoSafety
```

---

## Test Page: Legitimate Project Page

### URL
```
https://facebook.com/solana
```

### Expected Page Characteristics
- **Name:** Solana
- **Verified:** ✅ Blue checkmark present
- **Created:** 5+ years ago
- **Followers:** 1M+
- **Posts:** 500+
- **Bio:** Official Solana Foundation page. Solana is a decentralized blockchain built for scalable crypto projects.
- **Recent Posts:**
  1. "🎉 Solana ecosystem update: 5 new DeFi projects launched this week!"
  2. "📚 Learn about Solana at our developer documentation: docs.solana.com"
  3. "🔔 Important security update: Please ensure you're using official wallets"
  4. "🗓️ Upcoming Solana events: Conference in NYC on April 15"

### Expected Red Flags
- None detected

### Expected Risk Score
```
Total Red Flag Weight: 0
Risk Score: (0 / 70) × 10 = 0/10
Risk Level: LOW
```

### Expected Output
```
🔍 Facebook Page Scan: Solana

Risk Score: 0/10 (NO RISK)
Risk Level: LOW
Verification Status: LEGITIMATE

Key Findings:
• ✅ Page is verified
• 1M+ followers, verified
• 5+ years old, established track record
• No red flags detected
• Official Solana Foundation page
• Educational focus, community updates

Recommendation: ✅ LEGITIMATE OFFICIAL PAGE
• Safe to follow for official Solana updates
• Verify information with official website
• No scam concerns

$AGNTCBRO #ScamDetection #CryptoSafety
```

---

## Test Page: Medium Risk Page

### URL (Hypothetical)
```
https://facebook.com/crypto-tips-daily-2025
```

### Expected Page Characteristics
- **Name:** Crypto Tips Daily
- **Verified:** ❌ No blue checkmark
- **Created:** 45 days ago (1.5 months)
- **Followers:** 8,000
- **Posts:** 30+
- **Bio:** "Daily crypto tips and market analysis. Learn to trade better. Check out our Telegram for more."
- **Recent Posts:**
  1. "📈 Market analysis: BTC showing strength today"
  2. "🎓 Learn to trade: Join our Telegram group for daily signals"
  3. "💡 Tip: Always do your own research before investing"
  4. "🚀 Altcoin picks for this week: SOL, ETH, MATIC"

### Expected Red Flags
1. ⚠️ Unverified page (+5 points)
2. ⚠️ New page (< 60 days) (+3 points, not < 30 days)
3. ⚠️ Promotes Telegram group for signals (+3 points - mild)

### Expected Risk Score
```
Total Red Flag Weight: 5 + 3 + 3 = 11
Risk Score: (11 / 70) × 10 = 1.6/10
Risk Level: LOW (1.6 falls in 0-3 range)
```

### Expected Output
```
🔍 Facebook Page Scan: Crypto Tips Daily

Risk Score: 1.6/10 (LOW-MEDIUM RISK)
Risk Level: LOW
Verification Status: UNVERIFIED

Key Findings:
• 8K followers, unverified
• 45 days old (relatively new)
• 1 mild red flag: Promotes Telegram for signals
• No guaranteed returns or VIP tiers mentioned
• Educational focus mixed with promotion

Recommendation: ⚠️ LOW-MEDIUM RISK - Exercise caution
• Page is unverified
• Be cautious about Telegram promotion
• Do not send crypto without verification
• Research thoroughly before trusting signals

$AGNTCBRO #ScamDetection #CryptoSafety
```

---

## Test Plan

### Test 1: High-Risk Scam Page
- **URL:** Hypothetical fake VIP signals page
- **Expected Score:** 5.6/10 (HIGH)
- **Red Flags:** 6

### Test 2: Legitimate Page
- **URL:** https://facebook.com/solana
- **Expected Score:** 0/10 (LOW)
- **Red Flags:** 0

### Test 3: Medium-Risk Page
- **URL:** Hypothetical tips page
- **Expected Score:** 1.6/10 (LOW-MEDIUM)
- **Red Flags:** 3

---

**Note:** Since I cannot access actual Facebook pages for scanning without proper access and authentication, I've created hypothetical test cases based on the research findings in `RESEARCH_BASED_ENHANCEMENTS.md`. These test cases match the scam patterns identified in real-world victim reports and can be used to validate the Facebook page scanning algorithm.

---

**Created:** March 28, 2026  
**Status:** Test cases ready for validation  
**Next Step:** Implement and test with actual Facebook page scanning