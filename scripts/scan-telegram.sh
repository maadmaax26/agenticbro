#!/bin/bash
# Telegram Profile Scanner via Bot API
# Usage: scan-telegram.sh <username_or_userid>
#
# Uses getChatMember + getUserProfilePhotos to gather profile metadata.
# Falls back to getChat if username lookup works.

set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
BOT_TOKEN="8692355…REDACTED"
GROUP_ID="-1003751594817"

INPUT="${1:-}"
if [ -z "$INPUT" ]; then
    echo "Usage: scan-telegram.sh <username_or_userid>"
    echo ""
    echo "Examples:"
    echo "  scan-telegram.sh James6865"
    echo "  scan-telegram.sh @James6865"
    echo "  scan-telegram.sh 8065473445"
    exit 1
fi

# Strip @ prefix if present
USERNAME="${INPUT#@}"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TIMESTAMP_LOCAL=$(date +"%Y-%m-%d %H:%M:%S %Z")

echo "━━━ 🔍 TELEGRAM PROFILE SCAN — BOT API ASSESSMENT ━━━"
echo ""
echo "📂 Platform: Telegram"
echo "📁 Account: @${USERNAME}"
echo "📅 Time:   $TIMESTAMP_LOCAL ($TIMESTAMP)"
echo "🔍 Method: Bot API (getChatMember + getUserProfilePhotos)"
echo ""

# Output file for JSON
OUTFILE="$WORKSPACE/scan_results/telegram_${USERNAME}_$(date +%Y%m%d_%H%M%S).json"
mkdir -p "$WORKSPACE/scan_results"

# Step 1: Try getChat with @username to get user_id
echo "⏳ Resolving @${USERNAME}..."
CHAT_RESULT=$(curl -s -m 15 "https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=@${USERNAME}" 2>/dev/null || echo '{"ok":false}')

USER_ID=""
if echo "$CHAT_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('ok')==True" 2>/dev/null; then
    # Got user info directly
    USER_ID=$(echo "$CHAT_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'].get('id',''))" 2>/dev/null)
fi

# Step 2: If no user_id yet, try getChatMember in our group (need numeric ID)
if [ -z "$USER_ID" ]; then
    echo "⏳ Direct lookup failed, trying group member lookup..."
    # Try numeric user_id if input is numeric
    if [[ "$USERNAME" =~ ^[0-9]+$ ]]; then
        MEMBER_RESULT=$(curl -s -m 15 "https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${GROUP_ID}&user_id=${USERNAME}" 2>/dev/null || echo '{"ok":false}')
        if echo "$MEMBER_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('ok')==True" 2>/dev/null; then
            USER_ID="$USERNAME"
        fi
    else
        # Try to find user in our group via administrators list (they might be an admin)
        ADMIN_RESULT=$(curl -s -m 15 "https://api.telegram.org/bot${BOT_TOKEN}/getChatAdministrators?chat_id=${GROUP_ID}" 2>/dev/null || echo '{"ok":false}')
        USER_ID=$(echo "$ADMIN_RESULT" | python3 -c "
import sys, json
username = '$USERNAME'.lstrip('@').lower()
try:
    data = json.load(sys.stdin)
    if data.get('ok'):
        for admin in data.get('result', []):
            u = admin.get('user', {})
            if u.get('username', '').lower() == username:
                print(u.get('id', ''))
                break
except:
    pass
" 2>/dev/null)
    fi
fi

# Step 3: If still no user_id, try CDP fallback for public channels/groups
if [ -z "$USER_ID" ]; then
    echo ""
    echo "⚠️ Bot API could not resolve @${USERNAME}."
    echo "🔄 Attempting CDP scan for public channel/group..."
    echo ""
    
    # Check if CDP scanner exists and is available
    CDP_SCRIPT="$WORKSPACE/scripts/scan-telegram-cdp.sh"
    if [ -f "$CDP_SCRIPT" ]; then
        exec "$CDP_SCRIPT" "$USERNAME"
        exit $?
    else
        echo "❌ CDP scanner not found: $CDP_SCRIPT"
        echo ""
        echo "Telegram profile scans require either:"
        echo "  1. User is a member of our group (Bot API)"
        echo "  2. Public channel/group (CDP fallback)"
        echo ""
        echo "⚠️ Educational purposes only. Not financial advice. Always DYOR."
        exit 1
    fi
fi

echo "✅ Found user_id: ${USER_ID}"

# Step 4: Get full ChatMember info
MEMBER_RESULT=$(curl -s -m 15 "https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${GROUP_ID}&user_id=${USER_ID}" 2>/dev/null || echo '{"ok":false}')

# Step 5: Get profile photos
PHOTOS_RESULT=$(curl -s -m 15 "https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${USER_ID}&limit=1" 2>/dev/null || echo '{"ok":false}')

# Step 6: Parse and display
python3 << PYEOF
import json, sys

member = json.loads('''${MEMBER_RESULT}''')
photos = json.loads('''${PHOTOS_RESULT}''')
username = "${USERNAME}"
user_id = "${USER_ID}"

if not member.get('ok'):
    print("❌ Could not retrieve member info.")
    sys.exit(1)

user = member['result']['user']
status = member['result'].get('status', 'unknown')

# Risk scoring
risk_flags = []
risk_score = 0

# Positive indicators (lower risk)
if user.get('is_premium'):
    pass  # premium is good
else:
    risk_flags.append(("No premium account", 1))
    risk_score += 1

if status in ('administrator', 'creator', 'owner'):
    pass  # admin is good
else:
    risk_flags.append(("Regular member (not admin)", 1))
    risk_score += 1

if user.get('is_bot'):
    risk_flags.append(("🚨 Bot account", 5))
    risk_score += 5

# Negative indicators
if not user.get('username'):
    risk_flags.append(("No username set", 1))
    risk_score += 1

# Photo check
photo_count = 0
if photos.get('ok'):
    photo_count = photos['result'].get('total_count', 0)
    if photo_count == 0:
        risk_flags.append(("No profile photo", 2))
        risk_score += 2

# Custom title check
custom_title = member['result'].get('custom_title', '')
if custom_title and custom_title.lower() in ['owner', 'admin', 'creator']:
    pass  # verified role

# Display results
print()
print("╔═══════════════════════════════════════════════════════════════════════╗")
print("║ Telegram Profile Summary                                           ║")
print("╚═══════════════════════════════════════════════════════════════════════╝")
print()
print(f"  👤 Name:       {user.get('first_name', 'N/A')} {user.get('last_name', '')}")
print(f"  📛 Username:   @{user.get('username', 'N/A')}")
print(f"  🆔 User ID:    {user_id}")
print(f"  🤖 Bot:        {'Yes' if user.get('is_bot') else 'No'}")
print(f"  💎 Premium:    {'Yes ✅' if user.get('is_premium') else 'No'}")
print(f"  👑 Role:       {status.title()}")
if custom_title:
    print(f"  🏷️  Title:      {custom_title}")
print(f"  📸 Photos:     {photo_count} profile photo(s)")
print()

# Risk level
if risk_score <= 3:
    level = "LOW ✅"
elif risk_score <= 5:
    level = "MEDIUM ⚠️"
elif risk_score <= 7:
    level = "HIGH 🔴"
else:
    level = "CRITICAL 🚨"

print("╔═══════════════════════════════════════════════════════════════════════╗")
print("║ Risk Assessment                                                     ║")
print("╚═══════════════════════════════════════════════════════════════════════╝")
print()
print(f"  Risk Score: {risk_score}/10 — {level}")
print()

if risk_flags:
    print("  🚩 Red Flags:")
    for flag, pts in risk_flags:
        print(f"     • {flag} ({pts} pt{'s' if pts != 1 else ''})")
else:
    print("  ✅ No red flags detected in available metadata")

print()
print("  ⚠️ LIMITATION: Telegram does not expose bio, posts, or linked channels")
print("  via the Bot API. This scan only covers profile metadata.")
print("  For a full risk assessment, cross-reference on X, Instagram, TikTok,")
print("  or Facebook where profile content is publicly visible.")
print()

# Save JSON
result = {
    "platform": "telegram",
    "username": user.get('username', username),
    "user_id": user_id,
    "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
    "is_bot": user.get('is_bot', False),
    "is_premium": user.get('is_premium', False),
    "status": status,
    "custom_title": custom_title,
    "photo_count": photo_count,
    "risk_score": risk_score,
    "risk_level": level.split()[0],
    "risk_flags": [{"flag": f, "points": p} for f, p in risk_flags],
    "scan_date": "${TIMESTAMP}",
    "disclaimer": "Educational purposes only. Not financial advice. Always DYOR."
}

outfile = "${OUTFILE}"
with open(outfile, 'w') as f:
    json.dump(result, f, indent=2)
print(f"📁 Full JSON saved to: {outfile}")
PYEOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Scan Complete — Educational purposes only. Not financial advice."
echo "    Always DYOR. Cross-reference on other platforms for full assessment."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"