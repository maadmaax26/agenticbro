# Telegram Setup Instructions

## Current Status

✅ **Bot Token Configured:** `8798669748:AAEqLvnot5leTfXGoI4VB6gbfozsD78GoBE`
⚠️ **MTProto Credentials Missing:** Required for priority scan feature

## Why You're Seeing "Demo Mode"

The priority scan feature requires **Telegram MTProto API credentials** for full functionality, not just a bot token. The demo mode warning means the system is using mock data instead of live Telegram data.

## Quick Fix (5 minutes)

### Step 1: Get Telegram API Credentials

1. Go to https://my.telegram.org/apps
2. Sign in with your Telegram account
3. Click "Create new application"
4. Fill in the form:
   - App title: `Agentic Bro Scanner`
   - Short name: `agenticbro`
   - Platform: `Desktop`
   - Description: `Crypto scam detection system`

5. Click "Create application"
6. Save your **api_id** and **api_hash** (16-character hex string)

### Step 2: Generate Session String

Run the Telegram setup script:
```bash
cd /Users/efinney/.openclaw/workspace
npx tsx server/telegram/setup.ts
```

This will:
- Prompt for your phone number
- Send you an OTP via Telegram
- Authenticate and generate a session string
- Print the session string for you to copy

### Step 3: Set Environment Variables

Choose one of these options:

**Option A: Set in `.env` file (Recommended)**
```bash
cd /Users/efinney/.openclaw/workspace
cat >> .env << 'EOF'
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here
TELEGRAM_SESSION_STRING=your_session_string_here
EOF
```

**Option B: Set in shell (Temporary)**
```bash
export TELEGRAM_API_ID=your_api_id_here
export TELEGRAM_API_HASH=your_api_hash_here  
export TELEGRAM_SESSION_STRING=your_session_string_here
```

### Step 4: Restart Backend Server

```bash
# Kill existing server
pkill -f "npm run dev:server"

# Restart with new credentials
npm run dev:server
```

## Verification

After setting up credentials, you should no longer see the demo mode warning. The priority scan will use live Telegram data instead of mock data.

## Features That Require MTProto Credentials

✅ **Priority Scan** - Real-time Telegram channel scanning
✅ **Alpha Feed** - Live alpha calls from tracked channels
✅ **Channel Intelligence** - Real-time channel monitoring
✅ **Gem Advise** - Live gem recommendations
✅ **Full Telegram Integration** - Complete Telegram features

## Features That Work with Bot Token Only

✅ **Basic Bot Messages** - Send/receive messages
✅ **Group Integration** - Post to Telegram groups  
✅ **Basic Commands** - Simple bot functionality
⚠️ **Priority Scan** - Will remain in demo mode without MTProto credentials

## Troubleshooting

**"Demo mode" still showing after setup:**
1. Verify environment variables are set: `echo $TELEGRAM_API_ID`
2. Restart the backend server completely
3. Check the terminal for any connection errors

**Setup script fails:**
1. Make sure your phone number can receive Telegram messages
2. Check your Telegram spam folder for OTP
3. Ensure you have `npx` and `tsx` installed

**Need help?**
- Check Telegram documentation: https://core.telegram.org/api
- Review setup script: `server/telegram/setup.ts`
- Check Telegram client: `server/telegram/client.ts`

---

**After completing these steps, your Telegram priority scan will use live data instead of demo mode!** 🚀