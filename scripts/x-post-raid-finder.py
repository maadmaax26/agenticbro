#!/usr/bin/env python3
"""
X Post Raid Finder - Chrome CDP Automation
Finds X posts with high engagement for raiding (Like + Repost + Comment)

Requirements:
- Chrome running with --remote-allow-origins=* on port 18800
- Logged-in X account for search access

Usage:
  python3 x-post-raid-finder.py
"""

import json
import websocket
import time
from datetime import datetime

# Chrome CDP connection
CHROME_PORT = 18800

# Search queries for raid targets
SEARCH_QUERIES = [
    "crypto scam",
    "rug pull",
    "wallet drainer",
    "pig butchering",
    "Solana hack",
    "DeFi security",
    "lost crypto"
]

# Target accounts to monitor
TARGET_ACCOUNTS = [
    "DianaSanchez_04",
    "CalebSol",
    "JamesWynnReal",
    "TheCryptoLark"
]

# Minimum engagement thresholds
MIN_LIKES = 500
MIN_RTS = 100
MAX_AGE_HOURS = 24

def connect_chrome(port=18800):
    """Connect to Chrome CDP"""
    ws_url = f"ws://localhost:{port}/devtools/browser"
    
    try:
        ws = websocket.create_connection(ws_url)
        return ws
    except Exception as e:
        print(f"❌ Chrome CDP not available on port {port}")
        print(f"   Start Chrome with:")
        print(f"   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\")
        print(f"     --remote-allow-origins=* \\")
        print(f"     --user-data-dir=/tmp/chrome-openclaw \\")
        print(f"     --remote-debugging-port={port}")
        return None

def search_x(query, port=18800):
    """
    Search X for posts matching query
    
    Note: This requires Chrome CDP with logged-in X account
    Returns list of post URLs with engagement metrics
    """
    
    search_url = f"https://x.com/search?q={query}&src=typed_query&f=top"
    
    print(f"\n{'='*60}")
    print(f"🔍 SEARCHING X FOR: {query}")
    print(f"{'='*60}")
    print(f"\n📍 URL: {search_url}")
    print(f"\n📋 INSTRUCTIONS:")
    print(f"\n1. Open Chrome with CDP on port {port}")
    print(f"2. Log into your X account")
    print(f"3. Navigate to the search URL above")
    print(f"4. Scroll through results")
    print(f"5. Look for posts with:")
    print(f"   - {MIN_LIKES}+ likes")
    print(f"   - {MIN_RTS}+ RTs")
    print(f"   - Posted within {MAX_AGE_HOURS} hours")
    print(f"\n6. Copy post URLs and engagement metrics")
    print(f"7. Send to me in this format:")
    print(f"\n   RAID TARGET:")
    print(f"   URL: https://x.com/username/status/123456")
    print(f"   Author: @username")
    print(f"   Engagement: 500 likes, 200 RTs")
    print(f"   Topic: Brief description")
    
    return {
        "status": "manual_required",
        "url": search_url,
        "query": query,
        "min_likes": MIN_LIKES,
        "min_rts": MIN_RTS,
        "max_age_hours": MAX_AGE_HOURS
    }

def check_target_accounts(port=18800):
    """Check target accounts for recent posts"""
    
    print(f"\n{'='*60}")
    print(f"👥 TARGET ACCOUNTS TO MONITOR")
    print(f"{'='*60}")
    
    for account in TARGET_ACCOUNTS:
        url = f"https://x.com/{account}"
        print(f"\n📍 @{account}")
        print(f"   URL: {url}")
        print(f"   Check for:")
        print(f"   - Recent posts about scams/security")
        print(f"   - High engagement posts")
        print(f"   - Posts where AgenticBro can add value")

def print_raid_target_template():
    """Print template for creating raid targets"""
    
    print(f"\n{'='*60}")
    print(f"📝 RAID TARGET TEMPLATE")
    print(f"{'='*60}")
    
    template = """
🎯 RAID TARGET #X - X POST

📍 Post: [X Post URL]
👤 @[username]
📊 [Likes] likes | [RTs] RTs | [Replies] replies

💬 COMMENT TO POST:
"[Comment text - add value, don't just promote]"

⚡ ACTION:
1. Click X link
2. LIKE the post
3. REPOST the post
4. REPLY with the comment above

This drives X algorithm visibility for AgenticBro!

AGNTCBRO #[Hashtags]
"""
    print(template)

def print_manual_workflow():
    """Print manual discovery workflow"""
    
    print(f"\n{'='*60}")
    print(f"📋 MANUAL DISCOVERY WORKFLOW")
    print(f"{'='*60}")
    
    print("""
1. Go to X Advanced Search: https://x.com/search-advanced

2. Set filters:
   - Keywords: "crypto scam" OR "rug pull" OR "wallet drainer"
   - Minimum retweets: 100
   - Minimum likes: 500
   - Date: Last 24 hours

3. Evaluate posts:
   - High engagement (500+ likes, 100+ RTs)
   - Relevant topic (scams, security, protection)
   - Opportunity for AgenticBro to add value

4. Copy post details and send to me:
   RAID TARGET:
   URL: https://x.com/username/status/123456
   Author: @username
   Engagement: 500 likes, 200 RTs
   Topic: Brief description

5. I'll create the raid target post for Telegram
""")

def main():
    print(f"\n{'='*60}")
    print(f"🎯 X POST RAID FINDER")
    print(f"{'='*60}")
    print(f"\nPurpose: Find X posts for community to raid")
    print(f"Action: Like + Repost + Comment on X posts")
    print(f"Goal: Drive X algorithm visibility for AgenticBro")
    
    # Check Chrome CDP
    ws = connect_chrome(CHROME_PORT)
    
    if ws:
        print(f"\n✅ Chrome CDP connected on port {CHROME_PORT}")
        print(f"   You can use browser automation for X search")
    else:
        print(f"\n⚠️ Chrome CDP not connected")
        print(f"   Manual discovery required")
    
    # Print manual workflow
    print_manual_workflow()
    
    # Print target accounts
    check_target_accounts()
    
    # Print template
    print_raid_target_template()
    
    # Suggest searches
    print(f"\n{'='*60}")
    print(f"🔍 SUGGESTED SEARCHES")
    print(f"{'='*60}")
    
    for query in SEARCH_QUERIES:
        search_x(query)
    
    print(f"\n{'='*60}")
    print(f"✅ READY FOR MANUAL DISCOVERY")
    print(f"{'='*60}")
    print(f"\nNext steps:")
    print(f"1. Open X and search using keywords above")
    print(f"2. Find high-engagement posts about scams/security")
    print(f"3. Send post URLs to me")
    print(f"4. I'll create raid targets for Telegram")

if __name__ == "__main__":
    main()