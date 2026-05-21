# Telegram User ID Lookup Integration

## Problem

The Telegram Bot API **cannot resolve username → user_id** without prior interaction.

**Limitation:** With Bot API, you can only get user IDs for users who have:
- Previously messaged your bot
- Interacted with your bot in a group

---

## Solutions

### Option 1: Use Third-Party Tools (Recommended)

**Free Online Tool:** https://tg-user.id/

This website resolves any public username to numerical User ID using MTProto.

**Limitations:**
- Requires manual lookup (not automated)
- External service (not controlled by us)
- Could have rate limits

---

### Option 2: MTProto Client (Automated)

Use Telegram MTProto (not Bot API) to resolve usernames.

**Requires:**
- Telegram API ID and API Hash (from my.telegram.org)
- MTProto client library (e.g., telethon, pyrogram)

**Implementation:**
```python
from telethon import TelegramClient

api_id = 'YOUR_API_ID'
api_hash = 'YOUR_API_HASH'

client = TelegramClient('session_name', api_id, api_hash)

async def get_user_id(username):
    user = await client.get_entity(username)
    return user.id
```

**Limitations:**
- Requires API credentials
- Requires phone number verification
- More complex setup

---

### Option 3: Ask User to Forward Message

Ask the person to forward a message from the target user, then extract user_id from the forwarded message.

**Implementation:**
- User forwards message to bot
- Bot extracts `forward_from.id` from message
- Returns user_id

---

### Option 4: Use @creationdatebot (Partial)

@creationdatebot can estimate account creation date if you provide a Telegram ID.

**Limitations:**
- Requires user_id, not username
- Cannot resolve username → user_id

---

## Current Implementation

For @gost1_man scan:

1. **User provided ID directly:** 7062008359
2. **Estimated account age:** ~1-2 years (9-digit ID = 2024-2026)
3. **Risk assessment:** MEDIUM (requires more info)

---

## Recommendation

**For Manual Scans:**
- Ask user to provide user_id directly (if available)
- Use https://tg-user.id/ for manual lookups
- Ask user to forward message from target

**For Automated Scans:**
- Implement MTProto client for username resolution
- Store API credentials in secure environment
- Add rate limiting to avoid Telegram limits

---

## Integration Steps

1. **Get Telegram API credentials:**
   - Go to https://my.telegram.org
   - Create application
   - Get API ID and API Hash

2. **Install MTProto library:**
   ```bash
   pip install telethon
   ```

3. **Create lookup function:**
   - Connect to Telegram MTProto
   - Resolve username to user_id
   - Get account creation estimate

4. **Add to scan pipeline:**
   - Input: username
   - Output: user_id, estimated_age, risk_score

---

## Files to Create

- `/scripts/telegram-id-lookup.py` - MTProto lookup script
- `/config/telegram-api.env` - API credentials (secured)

---

End of Integration Guide