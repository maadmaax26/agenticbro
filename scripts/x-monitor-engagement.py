#!/usr/bin/env python3
"""
X Engagement Monitor — Finds relevant X posts for Agentic Bro engagement.

Monitors X search for posts about:
- Crypto scams / rug pulls
- Security questions ("is this legit?")
- Solana safety discussions
- Meme coin caution

Outputs posts sorted by relevance with suggested engagement type.

Requirements:
- Chrome CDP on port 18801 (logged into X)
- Or uses web search fallback

Usage:
  bash /Users/efinney/.openclaw/workspace/scripts/x-monitor-engagement.sh
"""

import json
import re
import sys
import time
import urllib.request
import os
from datetime import datetime

# ─── Config ───────────────────────────────────────────────────────────

CHROME_PORT = 18801
OUTPUT_DIR = "/Users/efinney/.openclaw/workspace/output"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "x-engagement-targets.json")

# Search queries grouped by engagement type
ENGAGEMENT_QUERIES = {
    "scam_victim": [
        '"got scammed" solana',
        '"lost my" solana scam',
        '"rugged" solana',
        '"got rugged" meme coin',
        '"wallet drained" crypto',
        '"lost everything" crypto scam',
        '"scammed on" solana',
        'solana rug pull',
    ],
    "safety_question": [
        '"is this legit" solana',
        '"is this a scam" crypto',
        '"should I trust" crypto',
        '"safe to invest" solana',
        '"anyone know" crypto project',
        '"is this real" airdrop',
        '"can someone check" wallet',
        '"legit or scam" solana',
    ],
    "security_awareness": [
        'crypto security tips',
        'solana safety',
        '"how to verify" crypto project',
        '"DYOR" solana',
        'crypto scam warning',
        '"protect your" wallet crypto',
        'solana phishing alert',
    ],
    "meme_caution": [
        '"should I buy" meme coin',
        '"ape in" solana',
        'meme coin caution',
        '"too good to be true" crypto',
        'meme coin safety',
        '"be careful" meme coin solana',
    ],
}

# Engagement type descriptions for the reply templates
ENGAGEMENT_DESCRIPTIONS = {
    "scam_victim": "Person was scammed — offer free scan of the scammer profile",
    "safety_question": "Person is asking if something is legit — offer to scan it",
    "security_awareness": "General security discussion — share the tool as a resource",
    "meme_caution": "Cautious about meme coins — highlight $AGNTCBRO utility for safety",
}

def connect_chrome(port=CHROME_PORT):
    """Connect to Chrome CDP and get websocket URL"""
    try:
        response = urllib.request.urlopen(
            f'http://localhost:{port}/json/list', timeout=5
        )
        pages = json.loads(response.read().decode())
        if not pages:
            return None, None
        ws_url = pages[0]['webSocketDebuggerUrl']
        page_id = pages[0]['id']
        return ws_url, page_id
    except Exception as e:
        return None, None

def search_via_chrome_cdp(ws_url, page_id, query):
    """Search X via Chrome CDP and extract post data"""
    try:
        import websocket
        ws = websocket.create_connection(ws_url, timeout=15)
        
        # Navigate to X search
        search_url = f"https://x.com/search?q={query.replace(' ', '%20')}&src=typed_query&f=live"
        
        # Send Page.navigate
        nav_cmd = {
            "id": 1,
            "method": "Page.navigate",
            "params": {"url": search_url}
        }
        ws.send(json.dumps(nav_cmd))
        ws.recv()  # ack
        
        # Wait for page load
        time.sleep(4)
        
        # Scroll to load more
        for _ in range(3):
            scroll_cmd = {
                "id": 2,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": "window.scrollBy(0, 800);",
                    "returnByValue": True
                }
            }
            ws.send(json.dumps(scroll_cmd))
            ws.recv()
            time.sleep(1)
        
        # Extract post data
        extract_js = """
        (function() {
            const posts = [];
            const articles = document.querySelectorAll('article[data-testid="tweet"]');
            articles.forEach(article => {
                try {
                    const timeEl = article.querySelector('time');
                    const datetime = timeEl ? timeEl.getAttribute('datetime') : '';
                    
                    const userEl = article.querySelector('[data-testid="User-Name"]');
                    const username = userEl ? userEl.textContent : '';
                    
                    const textEl = article.querySelector('[data-testid="tweetText"]');
                    const text = textEl ? textEl.textContent : '';
                    
                    const likeEl = article.querySelector('[data-testid="like"]');
                    const likeCount = likeEl ? likeEl.getAttribute('aria-label') || '0' : '0';
                    
                    const repostEl = article.querySelector('[data-testid="retweet"]');
                    const repostCount = repostEl ? repostEl.getAttribute('aria-label') || '0' : '0';
                    
                    const replyEl = article.querySelector('[data-testid="reply"]');
                    const replyCount = replyEl ? replyEl.getAttribute('aria-label') || '0' : '0';
                    
                    const linkEl = article.querySelector('a[href*="/status/"]');
                    const link = linkEl ? linkEl.href : '';
                    
                    if (text && link) {
                        posts.push({
                            text: text.substring(0, 500),
                            username: username,
                            datetime: datetime,
                            likes: likeCount,
                            reposts: repostCount,
                            replies: replyCount,
                            url: link
                        });
                    }
                } catch(e) {}
            });
            return JSON.stringify(posts);
        })()
        """
        
        extract_cmd = {
            "id": 3,
            "method": "Runtime.evaluate",
            "params": {"expression": extract_js, "returnByValue": True}
        }
        ws.send(json.dumps(extract_cmd))
        result = json.loads(ws.recv())
        ws.close()
        
        if 'result' in result and 'result' in result['result']:
            value = result['result']['result'].get('value', '[]')
            try:
                return json.loads(value) if isinstance(value, str) else value
            except:
                return []
        return []
    except Exception as e:
        return []

def search_via_web_fallback(query):
    """Fallback: generate search URLs for manual use"""
    encoded = query.replace(' ', '%20')
    return {
        "query": query,
        "url": f"https://x.com/search?q={encoded}&src=typed_query&f=live",
        "advanced_url": f"https://x.com/search?q={encoded}%20min_faves%3A10&src=typed_query&f=top",
    }

def calculate_relevance(post, engagement_type):
    """Score a post by relevance for engagement"""
    score = 0
    text = post.get('text', '').lower()
    
    # High-value keywords
    high_value = ['scam', 'rugged', 'rug pull', 'drained', 'stolen', 'lost']
    for kw in high_value:
        if kw in text:
            score += 3
    
    # Medium-value keywords
    medium_value = ['legit', 'safe', 'trust', 'verify', 'check', 'dyor']
    for kw in medium_value:
        if kw in text:
            score += 2
    
    # Solana relevance
    if 'solana' in text or '$sol' in text or 'sol' in text:
        score += 2
    
    # Meme coin relevance
    if 'meme' in text or 'coin' in text or 'token' in text:
        score += 1
    
    # Recency boost
    try:
        dt = post.get('datetime', '')
        if dt:
            post_time = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            hours_ago = (datetime.now(post_time.tzinfo) - post_time).total_seconds() / 3600
            if hours_ago < 6:
                score += 3
            elif hours_ago < 24:
                score += 2
            elif hours_ago < 48:
                score += 1
    except:
        score += 1  # Unknown time gets small boost
    
    # Engagement metrics
    likes = post.get('likes', '0')
    if isinstance(likes, str):
        likes = int(re.search(r'\d+', likes.replace(',', '')).group() or 0) if re.search(r'\d+', likes.replace(',', '')) else 0
    if likes > 0 and likes < 500:
        score += 2  # Sweet spot: visible but not overwhelming
    
    return min(score, 10)

def format_output(results):
    """Format results as readable report"""
    output = []
    output.append("=" * 70)
    output.append("🔍 X ENGAGEMENT MONITOR — Agentic Bro Growth Targets")
    output.append(f"   Generated: {datetime.now().strftime('%Y-%m-%d %H:%M EST')}")
    output.append("=" * 70)
    
    if not results:
        output.append("\n❌ No posts found. Try running with Chrome CDP or check queries.")
        return "\n".join(output)
    
    # Sort by relevance
    sorted_results = sorted(results, key=lambda x: x.get('relevance', 0), reverse=True)
    
    for i, post in enumerate(sorted_results[:20], 1):
        output.append(f"\n{'─' * 60}")
        output.append(f"🎯 Target #{i} — Relevance: {post.get('relevance', 0)}/10")
        output.append(f"   Type: {post.get('engagement_type', 'unknown')}")
        output.append(f"   Action: {ENGAGEMENT_DESCRIPTIONS.get(post.get('engagement_type', ''), '')}")
        output.append(f"\n👤 {post.get('username', 'Unknown')}")
        output.append(f"📝 {post.get('text', '')[:200]}")
        output.append(f"\n❤️  {post.get('likes', '?')}  🔄 {post.get('reposts', '?')}  💬 {post.get('replies', '?')}")
        output.append(f"🔗 {post.get('url', 'No URL')}")
        output.append(f"📅 {post.get('datetime', 'Unknown')}")
    
    output.append(f"\n{'=' * 70}")
    output.append(f"📊 Total targets: {len(sorted_results)}")
    output.append(f"   High relevance (7+): {sum(1 for r in sorted_results if r.get('relevance', 0) >= 7)}")
    output.append(f"   Medium relevance (4-6): {sum(1 for r in sorted_results if 4 <= r.get('relevance', 0) <= 6)}")
    output.append(f"   Low relevance (1-3): {sum(1 for r in sorted_results if r.get('relevance', 0) <= 3)}")
    output.append(f"\n🔐 Use reply-templates.json for contextual engagement")
    output.append("=" * 70)
    
    return "\n".join(output)

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    all_results = []
    chrome_available = False
    ws_url = None
    page_id = None
    
    # Try Chrome CDP connection
    ws_url, page_id = connect_chrome()
    if ws_url:
        chrome_available = True
        print("✅ Chrome CDP connected on port", CHROME_PORT)
    else:
        print("⚠️  Chrome CDP not available — generating search URLs for manual use")
    
    for engagement_type, queries in ENGAGEMENT_QUERIES.items():
        print(f"\n🔍 Searching: {engagement_type}")
        
        for query in queries:
            print(f"   Query: {query}")
            
            if chrome_available:
                # Search via Chrome CDP
                posts = search_via_chrome_cdp(ws_url, page_id, query)
                for post in posts:
                    post['engagement_type'] = engagement_type
                    post['relevance'] = calculate_relevance(post, engagement_type)
                    all_results.append(post)
                time.sleep(2)  # Rate limit between searches
            else:
                # Generate manual search URLs
                search_info = search_via_web_fallback(query)
                search_info['engagement_type'] = engagement_type
                search_info['relevance'] = 0  # Unknown without scraping
                all_results.append(search_info)
    
    # Save results to JSON
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f"\n💾 Results saved to {OUTPUT_FILE}")
    
    # Print formatted output
    if chrome_available and any(r.get('text') for r in all_results):
        report = format_output(all_results)
        print(report)
    else:
        # Manual mode — just output the URLs
        print("\n" + "=" * 70)
        print("📋 MANUAL SEARCH URLs — Copy/paste into browser:")
        print("=" * 70)
        for r in all_results:
            if r.get('url'):
                print(f"\n  [{r['engagement_type']}] {r.get('query', '')}")
                print(f"    Live: {r['url']}")
                print(f"    Top:  {r.get('advanced_url', '')}")
        
        print(f"\n💡 Tip: Open Chrome with CDP on port {CHROME_PORT} for auto-scraping")
        print(f"   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\")
        print(f"     --remote-allow-origins=* \\")
        print(f"     --user-data-dir=/tmp/chrome-agntcbro \\")
        print(f"     --remote-debugging-port={CHROME_PORT}")

if __name__ == "__main__":
    main()