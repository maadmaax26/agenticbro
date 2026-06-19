#!/usr/bin/env python3
"""
X Engagement Monitor — Finds relevant X posts for Agentic Bro engagement.

Priority:
1. Chrome CDP on port 18801 (best — full post data)
2. Local web search (DDG → SearXNG → Google — no API keys)
3. Manual search URLs (last resort)

Usage:
  bash /Users/efinney/.openclaw/workspace/scripts/x-monitor-engagement.sh
"""

import json
import re
import subprocess
import sys
import time
import urllib.request
import os
from datetime import datetime

# ─── Config ───────────────────────────────────────────────────────────

CHROME_PORT = 18801
OUTPUT_DIR = "/Users/efinney/.openclaw/workspace/output"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "x-engagement-targets.json")
LOCAL_SEARCH_SCRIPT = "/Users/efinney/.openclaw/workspace/scripts/local_web_search.py"

# ─── Dynamic query generation ─────────────────────────────────────────────

def build_queries():
    """Generate time-aware search queries for current engagement targets."""
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    month = now.strftime("%B %Y")      # e.g. "May 2026"
    year = now.strftime("%Y")          # e.g. "2026"
    days_7 = (now - __import__('datetime').timedelta(days=7)).strftime("%Y-%m-%d")

    # Base queries that always apply
    base = {
        "scam_victim": [
            '"got scammed" solana',
            '"lost my" solana scam',
            '"got rugged" solana',
            '"wallet drained" crypto solana',
            '"scammed on" solana',
            f'solana rug pull {month}',
            f'crypto scam exposed {year}',
            f'"rug pull" solana {year}',
        ],
        "safety_question": [
            '"is this legit" solana',
            '"is this a scam" crypto',
            '"should I trust" crypto',
            '"anyone know" crypto project',
            '"legit or scam" solana',
            f'"is this safe" solana {year}',
            f'"should I buy" solana token {month}',
        ],
        "security_awareness": [
            f'crypto security tips {year}',
            f'solana scam warning {month}',
            f'solana phishing alert {year}',
            f'"how to verify" crypto project {year}',
            f'solana wallet drain {year}',
            f'crypto scam prevention {month}',
        ],
        "meme_caution": [
            f'"should I buy" meme coin solana {year}',
            '"ape in" solana',
            f'meme coin rug pull {month}',
            f'"too good to be true" crypto {year}',
            f'meme coin scam solana {year}',
            f'pump fun rug pull {month}',
        ],
    }

    # Strip empty strings / duplicates
    for etype in base:
        seen = set()
        deduped = []
        for q in base[etype]:
            if q and q not in seen:
                seen.add(q)
                deduped.append(q)
        base[etype] = deduped

    return base


# Built fresh on every run
ENGAGEMENT_QUERIES = build_queries()

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
    except Exception:
        return None, None


def search_via_chrome_cdp(ws_url, page_id, query):
    """Search X via Chrome CDP and extract post data"""
    try:
        import websocket
        ws = websocket.create_connection(ws_url, timeout=15)

        # Time-aware X search: filter to last 7 days
        since_date = (datetime.now() - __import__('datetime').timedelta(days=7)).strftime('%Y-%m-%d')
        search_url = f"https://x.com/search?q={query.replace(' ', '%20')}%20since%3A{since_date}&src=typed_query&f=live"

        nav_cmd = {"id": 1, "method": "Page.navigate", "params": {"url": search_url}}
        ws.send(json.dumps(nav_cmd))
        ws.recv()

        time.sleep(4)

        for _ in range(3):
            scroll_cmd = {
                "id": 2, "method": "Runtime.evaluate",
                "params": {"expression": "window.scrollBy(0, 800);", "returnByValue": True}
            }
            ws.send(json.dumps(scroll_cmd))
            ws.recv()
            time.sleep(1)

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
                    const linkEl = article.querySelector('a[href*="/status/"]');
                    const link = linkEl ? linkEl.href : '';

                    if (text && link) {
                        posts.push({
                            text: text.substring(0, 500),
                            username: username,
                            datetime: datetime,
                            likes: likeCount,
                            url: link
                        });
                    }
                } catch(e) {}
            });
            return JSON.stringify(posts);
        })()
        """

        extract_cmd = {
            "id": 3, "method": "Runtime.evaluate",
            "params": {"expression": extract_js, "returnByValue": True}
        }
        ws.send(json.dumps(extract_cmd))
        result = json.loads(ws.recv())
        ws.close()

        if 'result' in result and 'result' in result['result']:
            value = result['result']['result'].get('value', '[]')
            try:
                return json.loads(value) if isinstance(value, str) else value
            except Exception:
                return []
        return []
    except Exception:
        return []


def search_via_local_web(query):
    """Use local_web_search.py to find relevant posts via DDG/SearXNG/Google"""
    results = []

    # Add current year/month to make results time-relevant
    year = datetime.now().strftime('%Y')
    month = datetime.now().strftime('%B')

    # Search with X/Twitter focus, then broad
    search_queries = [
        f'{query} site:x.com {year}',
        f'{query} {year}',
    ]

    for q in search_queries:
        try:
            proc = subprocess.run(
                ["python3", LOCAL_SEARCH_SCRIPT, q, "--count", "5", "--json", "--no-cache"],
                capture_output=True, text=True, timeout=25
            )
            if proc.returncode == 0 and proc.stdout.strip():
                search_results = json.loads(proc.stdout.strip())
                for r in search_results:
                    url = r.get("url", "")
                    results.append({
                        "text": r.get("snippet", ""),
                        "username": "",
                        "datetime": "",
                        "likes": "?",
                        "reposts": "?",
                        "replies": "?",
                        "url": url,
                        "source": "local_web_search",
                    })
        except Exception:
            pass

    # Deduplicate by URL
    seen = set()
    deduped = []
    for r in results:
        if r["url"] not in seen and r["url"]:
            seen.add(r["url"])
            deduped.append(r)

    return deduped


def search_via_web_fallback(query):
    """Last resort: generate time-aware search URLs for manual use"""
    since_date = (datetime.now() - __import__('datetime').timedelta(days=7)).strftime('%Y-%m-%d')
    encoded = query.replace(' ', '%20')
    return {
        "query": query,
        "url": f"https://x.com/search?q={encoded}%20since%3A{since_date}&src=typed_query&f=live",
        "advanced_url": f"https://x.com/search?q={encoded}%20since%3A{since_date}%20min_faves%3A10&src=typed_query&f=top",
    }


def calculate_relevance(post, engagement_type):
    """Score a post by relevance for engagement"""
    score = 0
    text = post.get('text', '').lower()
    now = datetime.now()
    current_year = now.strftime('%Y')
    current_month_name = now.strftime('%B').lower()  # e.g. 'may'
    current_month_num = now.strftime('%m')  # e.g. '05'

    # High-value scam keywords
    high_value = ['scam', 'rugged', 'rug pull', 'drained', 'stolen', 'lost']
    for kw in high_value:
        if kw in text:
            score += 3

    # Medium-value trust keywords
    medium_value = ['legit', 'safe', 'trust', 'verify', 'check', 'dyor']
    for kw in medium_value:
        if kw in text:
            score += 2

    # Solana relevance
    if 'solana' in text or '$sol' in text or 'sol' in text:
        score += 2
    if 'meme' in text or 'coin' in text or 'token' in text:
        score += 1

    # Time relevance boost — prefer current content
    if current_year in text:
        score += 2
    if current_month_name in text or f'-{current_month_num}-' in text:
        score += 1

    # Recency from datetime field (CDP results)
    try:
        dt = post.get('datetime', '')
        if dt:
            post_time = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            hours_ago = (now - post_time.replace(tzinfo=None)).total_seconds() / 3600
            if hours_ago < 6:
                score += 3
            elif hours_ago < 24:
                score += 2
            elif hours_ago < 48:
                score += 1
    except Exception:
        score += 1  # Unknown time gets small boost

    # Engagement sweet spot
    likes = post.get('likes', '0')
    if isinstance(likes, str):
        match = re.search(r'\d+', likes.replace(',', ''))
        likes = int(match.group()) if match else 0
    if 0 < likes < 500:
        score += 2

    return min(score, 10)


def format_output(results):
    """Format results as readable report"""
    output = []
    output.append("=" * 70)
    output.append("🔍 X ENGAGEMENT MONITOR — Agentic Bro Growth Targets")
    output.append(f"   Generated: {datetime.now().strftime('%Y-%m-%d %H:%M EST')}")
    output.append(f"   Queries time-boxed to: last 7 days / {datetime.now().strftime('%B %Y')}")
    output.append("=" * 70)

    if not results:
        output.append("\n❌ No posts found.")
        return "\n".join(output)

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
        print("⚠️  Chrome CDP not available — using local web search")

    for engagement_type, queries in ENGAGEMENT_QUERIES.items():
        print(f"\n🔍 Searching: {engagement_type}")

        for query in queries:
            print(f"   Query: {query}")

            if chrome_available:
                posts = search_via_chrome_cdp(ws_url, page_id, query)
                for post in posts:
                    post['engagement_type'] = engagement_type
                    post['relevance'] = calculate_relevance(post, engagement_type)
                    all_results.append(post)
                time.sleep(2)
            else:
                # Fallback: local web search
                posts = search_via_local_web(query)
                if posts:
                    print(f"   → Found {len(posts)} results via local web search")
                    for post in posts:
                        post['engagement_type'] = engagement_type
                        post['relevance'] = calculate_relevance(post, engagement_type)
                        all_results.append(post)
                else:
                    # Last resort: manual URL generation
                    search_info = search_via_web_fallback(query)
                    search_info['engagement_type'] = engagement_type
                    search_info['relevance'] = 0
                    all_results.append(search_info)

    # Deduplicate by URL
    seen = set()
    deduped = []
    for r in all_results:
        url = r.get('url', '')
        if url not in seen:
            seen.add(url)
            deduped.append(r)

    all_results = deduped

    # Save results to JSON
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f"\n💾 Results saved to {OUTPUT_FILE}")

    # Print formatted output
    if chrome_available and any(r.get('text') for r in all_results):
        report = format_output(all_results)
        print(report)
    elif any(r.get('source') == 'local_web_search' for r in all_results):
        web_results = [r for r in all_results if r.get('source') == 'local_web_search']
        print("\n" + "=" * 70)
        print("🔍 X ENGAGEMENT — Local Web Search Results")
        print(f"   Found {len(web_results)} X posts across all queries")
        print("=" * 70)
        for i, r in enumerate(web_results[:20], 1):
            print(f"\n  {i}. [{r.get('engagement_type', '?')}] Relevance: {r.get('relevance', 0)}/10")
            print(f"     {r.get('text', '')[:150]}")
            print(f"     🔗 {r.get('url', '')}")
        print(f"\n🔐 Review these posts and engage manually with reply templates")
        print("=" * 70)
    else:
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