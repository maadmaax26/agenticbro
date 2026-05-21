# Raid Target System - Updated for X Posts

## Issue
Web search doesn't directly return X/Twitter posts. We need a different approach for finding X posts to raid.

## Current Approach
1. **News Articles** - Web search finds crypto news (working)
2. **X Posts** - Need manual discovery or X API

## IMPORTANT: Correct Telegram Link

✅ **CORRECT:** `https://t.me/Agenticbro1`
❌ **WRONG:** `t.me/agenticbro` (lowercase, no https)

Always use the full URL with correct capitalization: `https://t.me/Agenticbro1`

## Manual X Post Discovery Steps

### Step 1: Go to X Advanced Search
```
x.com/search-advanced
```

### Step 2: Set Filters
- **Keywords:** scam, rug pull, crypto safety, wallet drainer
- **Minimum retweets:** 100
- **Minimum likes:** 500
- **Date range:** Last 24 hours

### Step 3: Check Target Accounts
- @DianaSanchez_04 (717K)
- @CalebSol (204K)
- @JamesWynnReal (488K)
- @TheCryptoLark (200K)

### Step 4: Record Post Details
For each high-engagement post, record:
- URL (https://x.com/user/status/123456)
- Author (@username)
- Likes, RTs, Replies
- Topic/keywords

### Step 5: Add to Raid Queue
Update `/output/raid_queue.json` with:
```json
{
  "type": "x_post",
  "url": "https://x.com/user/status/123456",
  "author": "@username",
  "likes": 500,
  "retweets": 100,
  "score": 85
}
```

## X Post Raid Template

When you find a high-engagement X post about scams/security:

```
🎯 RAID TARGET #X - X POST

📍 Post: [Title/Description]
🔗 [X Post URL - https://x.com/user/status/123456]
👤 @[username]
📊 [Likes] likes | [RTs] RTs | [replies] replies

💬 SUGGESTED COMMENT:
"[Comment text]"

⚡ Action:
1. Click X link
2. Like, RT, Reply
3. Include @AgenticBro11

https://t.me/Agenticbro1
AGNTCBRO #[Hashtags]
```

## Chrome CDP Automation (Free Alternative)

### Requirements
- Chrome running with `--remote-allow-origins=*` on port 18800-18803
- Logged-in X account for search access

### Script Location
`/scripts/raid-target-x-posts.py`

### Usage
```bash
python3 /Users/efinney/.openclaw/workspace/scripts/raid-target-x-posts.py
```

### Start Chrome for X Search
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-allow-origins=* \
  --user-data-dir=/tmp/chrome-openclaw \
  --remote-debugging-port=18800
```

## Solutions Comparison

| Method | Cost | Automation | Quality |
|--------|------|------------|---------|
| **Manual** | Free | None | Best curation |
| **Chrome CDP** | Free | Partial | Good |
| **X API** | $100/month | Full | Best |

## Hashtags to Monitor

- #SolanaScam
- #CryptoSafety
- #RugPull
- #DeFiSecurity
- #WalletSecurity
- #ScamAlert

## Next Steps

1. **Immediate:** Use manual X post discovery
2. **Optional:** Set up Chrome CDP automation
3. **Future:** Consider X API subscription if needed

---

End of Guide