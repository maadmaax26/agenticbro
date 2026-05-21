#!/usr/bin/env python3
"""
Raid Target Finder - X Posts via Chrome CDP
Finds recent high-engagement X posts for AgenticBro raids

Requirements:
- Chrome running with --remote-allow-origins=* on port 18800-18803
- Logged-in X account for search access

Usage:
  python3 raid-target-x-posts.py [--port 18800]
"""
import json
import websocket
import argparse
from datetime import datetime, timedelta

def connect_chrome(port=18800):
    """Connect to Chrome CDP"""
    ws_url = f"ws://localhost:{port}/devtools/browser"
    
    try:
        ws = websocket.create_connection(ws_url)
        return ws
    except Exception as e:
        print(f"❌ Chrome CDP not available on port {port}")
        print(f"   Start Chrome with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-allow-origins=* --user-data-dir=/tmp/chrome-openclaw --remote-debugging-port={port}")
        return None

def search_x_posts(port=18800):
    """
    Search X for high-engagement posts about crypto scams
    
    Note: This requires Chrome CDP with logged-in X account
    The web search API cannot directly return X posts
    """
    
    # X Advanced Search URLs
    search_urls = [
        "https://x.com/search?q=Solana%20scam&src=typed_query&f=top",
        "https://x.com/search?q=crypto%20rug%20pull&src=typed_query&f=top",
        "https://x.com/search?q=wallet%20drainer&src=typed_query&f=top",
        "https://x.com/search?q=crypto%20security%20tips&src=typed_query&f=top",
    ]
    
    # Target accounts to monitor (high followers)
    target_accounts = [
        "DianaSanchez_04",   # 717K - Verified KOL
        "CalebSol",          # 204K - Verified
        "JamesWynnReal",     # 488K - Crypto influencer
        "TheCryptoLark",     # 200K - Crypto educator
    ]
    
    print(f"\n{'='*60}")
    print(f"🎯 X POST RAID FINDER")
    print(f"{'='*60}")
    print(f"\n⚠️  NOTE: Web search API cannot return X posts directly")
    print(f"   Options:")
    print(f"   1. Use Chrome CDP (free, needs login)")
    print(f"   2. Use X API ($100/month)")
    print(f"   3. Manual discovery at x.com/search-advanced")
    print()
    print(f"📋 MANUAL X POST DISCOVERY:")
    print(f"\n1. Go to: x.com/search-advanced")
    print(f"\n2. Set filters:")
    print(f"   - Keywords: scam, rug pull, crypto safety")
    print(f"   - Min retweets: 100")
    print(f"   - Min likes: 500")
    print(f"   - Date: Last 24 hours")
    print(f"\n3. Check target accounts:")
    for account in target_accounts:
        print(f"   - @{account}")
    print()
    print(f"4. Save post URLs and engagement metrics")
    print()
    print(f"5. Add to raid queue:")
    print(f"   /Users/efinney/.openclaw/workspace/output/raid_queue.json")
    print()
    
    return {
        "method": "manual",
        "search_urls": search_urls,
        "target_accounts": target_accounts,
        "filters": {
            "min_retweets": 100,
            "min_likes": 500,
            "max_age_hours": 24
        },
        "note": "Web search cannot return X posts. Use Chrome CDP or manual discovery."
    }

def get_x_post_template():
    """Return template for X post raid targets"""
    return """
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
"""

def main():
    parser = argparse.ArgumentParser(description='Find X posts for raid targets')
    parser.add_argument('--port', type=int, default=18800, help='Chrome CDP port')
    parser.add_argument('--template', action='store_true', help='Print X post template')
    args = parser.parse_args()
    
    if args.template:
        print(get_x_post_template())
        return
    
    result = search_x_posts(args.port)
    
    print(f"\n💡 TIP: Add X posts manually to raid_queue.json")
    print(f"   Format:")
    print(f"""{{
  "type": "x_post",
  "url": "https://x.com/user/status/123456",
  "author": "@username",
  "likes": 500,
  "retweets": 100,
  "score": 85
}}""")

if __name__ == "__main__":
    main()