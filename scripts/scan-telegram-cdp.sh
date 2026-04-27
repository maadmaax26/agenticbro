#!/bin/bash
# Telegram CDP Scanner - Fallback for public channels/groups
# Uses simple HTTP fetch for Telegram public pages
set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
CHROME_PORT="${CHROME_PORT:-18801}"
CHROME_HOST="${CHROME_HOST:-localhost}"

INPUT="${1:-}"
if [ -z "$INPUT" ]; then
    echo "Usage: scan-telegram-cdp.sh <username_or_channel>"
    echo "Examples: scan-telegram-cdp.sh agenticbro"
    exit 1
fi

# Clean input
NAME="${INPUT#t.me/}"
NAME="${NAME#https://t.me/}"
NAME="${NAME#@}"
NAME="${NAME%%/*}"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TIMESTAMP_LOCAL=$(date +"%Y-%m-%d %H:%M:%S %Z")

echo "━━━ 🔍 TELEGRAM CDP SCAN — PUBLIC CHANNEL/GROUP ASSESSMENT ━━━"
echo ""
echo "📂 Platform: Telegram (CDP)"
echo "📁 Target: ${NAME}"
echo "📅 Time:   $TIMESTAMP_LOCAL ($TIMESTAMP)"
echo "🔍 Method: Chrome DevTools Protocol (public channel scan)"
echo ""

# Check CDP
if ! curl -s -m 5 "http://${CHROME_HOST}:${CHROME_PORT}/json" > /dev/null 2>&1; then
    echo "❌ Chrome CDP not available on port ${CHROME_PORT}"
    echo "To use CDP scanning, start Chrome with:"
    echo "  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=18801 &"
    echo "⚠️ Educational purposes only. Not financial advice. Always DYOR."
    exit 1
fi

echo "✅ Chrome CDP available on port ${CHROME_PORT}"
echo ""

TARGET_URL="https://t.me/${NAME}"
echo "🌐 Navigating to: ${TARGET_URL}"

# Run Python scanner
export NAME WORKSPACE CHROME_HOST CHROME_PORT TIMESTAMP TARGET_URL

CDP_RESULT=$(python3 << 'ENDSCRIPT'
import json
import urllib.request
import re
import os

NAME = os.environ.get('NAME', 'test')
WORKSPACE = os.environ.get('WORKSPACE', '/Users/efinney/.openclaw/workspace')
CHROME_HOST = os.environ.get('CHROME_HOST', 'localhost')
CHROME_PORT = os.environ.get('CHROME_PORT', '18801')
TARGET_URL = f"https://t.me/{NAME}"

def get_cdp_tabs():
    try:
        url = f"http://{CHROME_HOST}:{CHROME_PORT}/json"
        with urllib.request.urlopen(url, timeout=5) as resp:
            return json.loads(resp.read())
    except:
        return []

def create_cdp_tab(url):
    try:
        req = urllib.request.Request(f"http://{CHROME_HOST}:{CHROME_PORT}/json/new?{url}", method='PUT')
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except:
        return None

# Find or create tab
tabs = get_cdp_tabs()
page_url = None
for tab in tabs:
    if tab.get('type') == 'page' and NAME in tab.get('url', ''):
        page_url = tab.get('url')
        break

if not page_url:
    new_tab = create_cdp_tab(TARGET_URL)
    if new_tab and new_tab.get('url'):
        page_url = new_tab.get('url')

if not page_url:
    page_url = TARGET_URL

# Fetch page
try:
    req = urllib.request.Request(page_url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
    exit(1)

# Parse HTML - using raw strings to avoid quote issues
title_match = re.search(r'<title>([^<]+)</title>', html, re.I)
title = title_match.group(1).strip() if title_match else ''

# Meta description - using character class for quotes
dq = '"'
sq = "'"
desc_pattern1 = r'<meta[^>]+name=[' + dq + sq + r']description[' + dq + sq + r'][^>]+content=[' + dq + sq + r']([^' + dq + sq + r']*)[' + dq + sq + r']'
desc_match = re.search(desc_pattern1, html, re.I)
description = desc_match.group(1).strip() if desc_match else ''

# Channel name
name_pattern = r'class=[' + dq + sq + r']tgme_channel_title[' + dq + sq + r'][^>]*>([^<]+)<'
name_match = re.search(name_pattern, html, re.I)
if not name_match:
    name_pattern = r'class=[' + dq + sq + r']tgme_page_title[' + dq + sq + r'][^>]*>([^<]+)<'
    name_match = re.search(name_pattern, html, re.I)
channel_name = name_match.group(1).strip() if name_match else ''

# Member count
extra_pattern = r'class=[' + dq + sq + r']tgme_channel_extra[' + dq + sq + r'][^>]*>([^<]+)<'
extra_match = re.search(extra_pattern, html, re.I)
if not extra_match:
    extra_pattern = r'class=[' + dq + sq + r']tgme_page_extra[' + dq + sq + r'][^>]*>([^<]+)<'
    extra_match = re.search(extra_pattern, html, re.I)
extra_info = extra_match.group(1).strip() if extra_match else ''

# Clean text
text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.I | re.S)
text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.I | re.S)
text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
text = re.sub(r'<[^>]+>', ' ', text)
text = re.sub(r'\s+', ' ', text).strip()[:2000]

output = {
    "success": True,
    "url": page_url,
    "title": title,
    "channel_name": channel_name,
    "description": description,
    "extra_info": extra_info,
    "content": text
}
print(json.dumps(output))
ENDSCRIPT
)

if [ -z "$CDP_RESULT" ] || [ "$CDP_RESULT" = "null" ]; then
    echo "❌ CDP scan failed - no result"
    echo "⚠️ Educational purposes only. Not financial advice. Always DYOR."
    exit 1
fi

# Parse and display
export CDP_RESULT NAME TARGET_URL TIMESTAMP WORKSPACE

python3 << 'ENDDISPLAY'
import json
import sys
import os
import re
import datetime

result = json.loads(os.environ.get('CDP_RESULT', '{}'))
NAME = os.environ.get('NAME', 'test')
TARGET_URL = os.environ.get('TARGET_URL', '')
TIMESTAMP = os.environ.get('TIMESTAMP', '')
WORKSPACE = os.environ.get('WORKSPACE', '/Users/efinney/.openclaw/workspace')

if not result.get('success'):
    print("Scan failed:", result.get('error', 'Unknown error'))
    sys.exit(1)

title = result.get('title', '')
channel_name = result.get('channel_name', '')
description = result.get('description', '')
extra_info = result.get('extra_info', '')
content = result.get('content', '')

# Risk scoring
risk_flags = []
risk_score = 0
content_lower = content.lower()
desc_lower = description.lower()

keywords = {
    'guaranteed returns': ('guaranteed_returns', 25),
    'giveaway': ('giveaway_airdrop', 20),
    'airdrop': ('giveaway_airdrop', 20),
    'dm me': ('dm_solicitation', 15),
    'message me': ('dm_solicitation', 15),
    'free crypto': ('free_crypto', 15),
    'free bitcoin': ('free_crypto', 15),
    'alpha': ('alpha_dm_scheme', 15),
    'limited time': ('urgency_tactics', 10),
    'act now': ('urgency_tactics', 10),
    'hurry': ('urgency_tactics', 10),
    'click here': ('download_install', 10),
    'invest now': ('unrealistic_claims', 10),
    '100x': ('unrealistic_claims', 10),
    '1000x': ('unrealistic_claims', 10),
    'moon': ('unrealistic_claims', 5),
    'pump': ('unrealistic_claims', 10),
    'signal': ('alpha_dm_scheme', 10),
}

# Telegram UI elements to EXCLUDE from risk scoring (false positives)
TELEGRAM_UI_PATTERNS = [
    'download for mac',
    'download for windows', 
    'download for linux',
    'download app',
    'open in telegram',
    'if you have telegram',
    'you can contact',
    'right away',
    'send message',
    'telegram: contact',
    'open telegram',
]

# Filter out Telegram UI text before scoring
filtered_content = content_lower
for pattern in TELEGRAM_UI_PATTERNS:
    filtered_content = filtered_content.replace(pattern, ' ')

for keyword, (flag, pts) in keywords.items():
    # Only flag if keyword appears in filtered content (not Telegram UI)
    if keyword in filtered_content:
        risk_flags.append((f"Content contains '{keyword}'", pts))
        risk_score += pts

member_count = 0
member_match = re.search(r'(\d[\d,]*)\s*(members?|subscribers?)', extra_info, re.I)
if member_match:
    member_count = int(member_match.group(1).replace(',', ''))
    if member_count < 100:
        risk_flags.append(("Very low member count", 5))
        risk_score += 5

if risk_score <= 3:
    level = "LOW"
elif risk_score <= 5:
    level = "MEDIUM"
elif risk_score <= 7:
    level = "HIGH"
else:
    level = "CRITICAL"

level_display = {"LOW": "LOW ✅", "MEDIUM": "MEDIUM ⚠️", "HIGH": "HIGH 🔴", "CRITICAL": "CRITICAL 🚨"}

print()
print("╔═══════════════════════════════════════════════════════════════════════╗")
print("║ Telegram Public Page Summary                                         ║")
print("╚═══════════════════════════════════════════════════════════════════════╝")
print()
print(f"  📛 Title:      {channel_name or title}")
print(f"  🔗 URL:        {TARGET_URL}")
if extra_info:
    print(f"  👥 Members:    {extra_info}")
print()

print("╔═══════════════════════════════════════════════════════════════════════╗")
print("║ Content Preview (first 500 chars)                                   ║")
print("╚═══════════════════════════════════════════════════════════════════════╝")
print()
preview = content[:500] + "..." if len(content) > 500 else content
words = preview.split()
line = "  "
for word in words:
    if len(line) + len(word) > 70:
        print(line)
        line = "  " + word
    else:
        line += (" " if line != "  " else "") + word
if line.strip():
    print(line)
print()

print("╔═══════════════════════════════════════════════════════════════════════╗")
print("║ Risk Assessment                                                     ║")
print("╚═══════════════════════════════════════════════════════════════════════╝")
print()
print(f"  Risk Score: {risk_score}/10 — {level_display.get(level, level)}")
print()

if risk_flags:
    print("  🚩 Red Flags:")
    for flag, pts in risk_flags:
        pts_label = f"{pts} pt{'s' if pts != 1 else ''}"
        print(f"     • {flag} ({pts_label})")
else:
    print("  ✅ No red flags detected in public content")

print()
print("  ⚠️ LIMITATION: CDP scanning only captures public channel/group content.")
print("  Private user profiles require Bot API access (group membership).")
print()

output_data = {
    "platform": "telegram_cdp",
    "target": NAME,
    "url": TARGET_URL,
    "title": channel_name or title,
    "extra_info": extra_info,
    "member_count": member_count,
    "content_preview": content[:500],
    "risk_score": risk_score,
    "risk_level": level,
    "risk_flags": [{"flag": f, "points": p} for f, p in risk_flags],
    "scan_date": TIMESTAMP,
    "disclaimer": "Educational purposes only. Not financial advice. Always DYOR."
}

outfile = f"{WORKSPACE}/scan_results/telegram_cdp_{NAME}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
os.makedirs(os.path.dirname(outfile), exist_ok=True)
with open(outfile, 'w') as f:
    json.dump(output_data, f, indent=2)
print(f"📁 Full JSON saved to: {outfile}")
ENDDISPLAY

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Scan Complete — Educational purposes only. Not financial advice."
echo "    Always DYOR. Cross-reference on other platforms for full assessment."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"