# X Post Raid System - Implementation Guide

## What Changed

**OLD (Wrong):**
- News articles → Telegram
- No X engagement
- One-way broadcast

**NEW (Correct):**
- X posts → Telegram raid targets
- Community engages on X (Like + Repost + Comment)
- X algorithm boosts visibility

---

## Files Created

### 1. Manual Workflow Guide
**Location:** `/scripts/x-post-raid-workflow.md`

**Contents:**
- How to use X Advanced Search
- Search keywords and filters
- Target accounts to monitor
- Comment templates
- How to send me raid targets

### 2. Chrome CDP Automation Script
**Location:** `/scripts/x-post-raid-finder.py`

**Purpose:** Semi-automated X post discovery
**Requires:** Chrome CDP with logged-in X account

---

## How to Use

### Manual Discovery (Recommended)

**Step 1:** Go to X Advanced Search
```
https://x.com/search-advanced
```

**Step 2:** Set filters:
- Keywords: "crypto scam" OR "rug pull"
- Min RTs: 100
- Min Likes: 500
- Date: Last 24 hours

**Step 3:** Find good posts, then send me:
```
RAID TARGET:
URL: https://x.com/username/status/123456
Author: @username
Engagement: 500 likes, 200 RTs
Topic: [brief description]
```

**Step 4:** I create the raid target for Telegram

---

### Chrome CDP Discovery (Advanced)

**Step 1:** Start Chrome with CDP:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-allow-origins=* \
  --user-data-dir=/tmp/chrome-openclaw \
  --remote-debugging-port=18800
```

**Step 2:** Log into X account

**Step 3:** Run script:
```bash
python3 /scripts/x-post-raid-finder.py
```

**Step 4:** Follow prompts for manual discovery

---

## Raid Target Format

```
🎯 RAID TARGET #X - X POST

📍 Post: https://x.com/username/status/123456
👤 @username
📊 500 likes | 200 RTs | 50 replies

💬 COMMENT TO POST:
"[Add value, relate to topic, mention AgenticBro]"

⚡ ACTION:
1. Click X link
2. LIKE the post
3. REPOST the post
4. REPLY with comment above

AGNTCBRO #Hashtags
```

---

## Comment Templates

### For Scam Warning Posts
```
"Sorry to hear this. 🔐 This is exactly why we built AgenticBro - AI-powered scam detection for X profiles, Telegram channels, and contracts. Scan BEFORE you ape. AGNTCBRO"
```

### For Security Education Posts
```
"Great thread! 🧵 For extra protection, AgenticBro scans profiles for 10 red flags before you engage. Free: https://t.me/Agenticbro1 AGNTCBRO"
```

### For Hack News Posts
```
"Another hack. 😔 Stay safe everyone. AgenticBro provides free scam detection - scan profiles, channels, and contracts before trusting. AGNTCBRO"
```

---

## Target Accounts to Monitor

| Account | Followers | When to Raid |
|---------|-----------|--------------|
| @DianaSanchez_04 | 717K | Posts about security |
| @CalebSol | 204K | Posts about Solana |
| @JamesWynnReal | 488K | Posts about crypto |
| @TheCryptoLark | 200K | Posts about education |

---

## Hashtag Searches

Also search these hashtags:
- #SolanaScam
- #CryptoSafety
- #RugPull
- #DeFiSecurity
- #WalletSecurity

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Raid targets per day | 3-5 |
| Community engagement rate | 20%+ |
| X algorithm boost | Measurable |

---

## Next Steps

1. **You:** Search X for high-engagement posts about scams
2. **You:** Send me post URLs with engagement metrics
3. **Me:** Create raid targets for Telegram
4. **Community:** Raids X posts (Like + Repost + Comment)
5. **Result:** X algorithm boosts AgenticBro visibility

---

End of Guide