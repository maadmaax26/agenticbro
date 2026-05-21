#!/usr/bin/env python3
"""
Raid Target Finder - Find X posts that complement AgenticBro scam detection
Uses Chrome CDP (same as profile scanner) to search X and find high-engagement posts
"""
import asyncio
import json
import sys
import urllib.request
from datetime import datetime
import websockets

async def find_raid_targets(search_query, port=18801, min_likes=200, min_retweets=50):
    """Search X for raid targets"""
    
    print(f"🔍 Searching for raid targets: '{search_query}'")
    print(f"   Min engagement: {min_likes} likes, {min_retweets} RTs")
    
    # Get Chrome pages
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/json") as response:
            pages = json.loads(response.read().decode())
    except Exception as e:
        print(f"❌ Cannot connect to Chrome on port {port}: {e}")
        return None
    
    if not pages:
        print("❌ No Chrome pages available")
        return None
    
    # Get first page
    page = pages[0]
    ws_url = page.get("webSocketDebuggerUrl")
    
    if not ws_url:
        print("❌ Cannot get WebSocket URL")
        return None
    
    async with websockets.connect(ws_url) as ws:
        
        # Navigate to X search
        search_url = f"https://x.com/search?q={search_query.replace(' ', '%20')}&src=typed_query&f=live"
        print(f"📍 Navigating to: {search_url}")
        
        await ws.send(json.dumps({
            "id": 1,
            "method": "Page.navigate",
            "params": {"url": search_url}
        }))
        
        await ws.recv()
        
        # Wait for page load
        print("⏳ Waiting for results...")
        await asyncio.sleep(5)
        
        # Scroll to load more results
        for i in range(3):
            await ws.send(json.dumps({
                "id": 100 + i,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": "window.scrollTo(0, document.body.scrollHeight);",
                    "returnByValue": True
                }
            }))
            await ws.recv()
            await asyncio.sleep(1)
        
        # Extract posts
        await ws.send(json.dumps({
            "id": 2,
            "method": "Runtime.evaluate",
            "params": {
                "expression": """
                (function() {
                    const posts = [];
                    const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
                    
                    tweetElements.forEach((tweet, index) => {
                        try {
                            const data = {};
                            
                            // Get post link
                            const linkEl = tweet.querySelector('a[href*="/status/"]');
                            if (linkEl) {
                                data.url = 'https://x.com' + linkEl.getAttribute('href');
                                data.id = linkEl.getAttribute('href').split('/').pop();
                            }
                            
                            // Get author
                            const authorEl = tweet.querySelector('[data-testid="User-Name"]');
                            if (authorEl) {
                                data.author = authorEl.innerText.split('\\n')[0] || '';
                                data.handle = authorEl.innerText.split('\\n')[1] || '';
                            }
                            
                            // Get text
                            const textEl = tweet.querySelector('[data-testid="tweetText"]');
                            if (textEl) {
                                data.text = textEl.innerText;
                            }
                            
                            // Get engagement metrics
                            const metrics = tweet.querySelectorAll('[data-testid="app-text-transition-container"]');
                            metrics.forEach(m => {
                                const text = m.innerText || '';
                                if (text.includes('replies') || text.match(/^\\d/)) {
                                    data.replies = text;
                                }
                            });
                            
                            // Try to get likes/retweets from aria-label
                            const allButtons = tweet.querySelectorAll('button');
                            allButtons.forEach(btn => {
                                const aria = btn.getAttribute('aria-label') || '';
                                if (aria.includes('like')) {
                                    data.likes = aria.match(/\\d+[,.]?\\d*[KM]?/)?.[0] || '0';
                                }
                                if (aria.includes('repost')) {
                                    data.retweets = aria.match(/\\d+[,.]?\\d*[KM]?/)?.[0] || '0';
                                }
                                if (aria.includes('repl')) {
                                    data.replies = aria.match(/\\d+[,.]?\\d*[KM]?/)?.[0] || '0';
                                }
                            });
                            
                            // Get timestamp
                            const timeEl = tweet.querySelector('time');
                            if (timeEl) {
                                data.time = timeEl.getAttribute('datetime');
                            }
                            
                            // Get author link
                            const authorLink = tweet.querySelector('a[href^="/"]');
                            if (authorLink && !data.authorHandle) {
                                const href = authorLink.getAttribute('href');
                                if (href && href.length > 1 && !href.includes('status')) {
                                    data.authorHandle = href.replace('/', '');
                                }
                            }
                            
                            if (data.url && data.text) {
                                posts.push(data);
                            }
                        } catch (e) {
                            // Skip malformed tweets
                        }
                    });
                    
                    return JSON.stringify(posts);
                })()
                """,
                "returnByValue": True
            }
        }))
        
        response = await ws.recv()
        result = json.loads(response)
        posts_json = result.get("result", {}).get("result", {}).get("value", "[]")
        
        try:
            posts = json.loads(posts_json)
        except:
            posts = []
        
        # Process and score posts
        print(f"\n{'='*60}")
        print(f"🎯 RAID TARGETS FOUND: {len(posts)}")
        print(f"{'='*60}")
        
        if not posts:
            print("No posts found. Try different search query.")
            return []
        
        # Score and rank posts
        scored_posts = []
        for post in posts:
            score = 0
            
            # Engagement score
            likes_str = post.get('likes', '0').upper()
            rts_str = post.get('retweets', '0').upper()
            
            # Parse numbers (handle K, M)
            def parse_count(s):
                s = s.replace(',', '').replace(' ', '')
                if 'K' in s:
                    return float(s.replace('K', '')) * 1000
                if 'M' in s:
                    return float(s.replace('M', '')) * 1000000
                try:
                    return float(s)
                except:
                    return 0
            
            likes = parse_count(likes_str)
            rts = parse_count(rts_str)
            
            if likes >= min_likes:
                score += 15
            if likes >= min_likes * 5:
                score += 10
            if rts >= min_retweets:
                score += 10
            if rts >= min_retweets * 3:
                score += 5
            
            # Relevance score (keywords)
            text_lower = post.get('text', '').lower()
            
            # High relevance keywords
            if any(w in text_lower for w in ['scam', 'rug', 'drain', 'honeypot']):
                score += 20
            if any(w in text_lower for w in ['protect', 'safety', 'security', 'warning']):
                score += 15
            if 'solana' in text_lower or 'sol' in text_lower:
                score += 10
            if any(w in text_lower for w in ['crypto', 'defi', 'web3', 'nft']):
                score += 5
            
            # Author score (if handle looks legitimate)
            handle = post.get('authorHandle', '')
            if handle:
                score += 5
            
            post['score'] = score
            scored_posts.append(post)
        
        # Sort by score
        scored_posts.sort(key=lambda x: x.get('score', 0), reverse=True)
        
        # Display top results
        print(f"\n🏆 TOP RAID TARGETS:\n")
        for i, post in enumerate(scored_posts[:10]):
            print(f"{'─'*60}")
            print(f"#{i+1} - Score: {post.get('score', 0)}/50")
            print(f"👤 @{post.get('authorHandle', 'unknown')}")
            print(f"📝 {post.get('text', '')[:150]}...")
            print(f"❤️ {post.get('likes', '0')} likes | 🔄 {post.get('retweets', '0')} RTs | 💬 {post.get('replies', '0')} replies")
            print(f"🔗 {post.get('url', '')}")
        
        return scored_posts

async def scan_for_good_comments(posts, min_score=20):
    """Analyze which posts would benefit from AgenticBro comments"""
    
    print(f"\n{'='*60}")
    print("💡 RECOMMENDED FOR RAID")
    print(f"{'='*60}")
    
    recommended = [p for p in posts if p.get('score', 0) >= min_score]
    
    if not recommended:
        print("\nNo posts meet minimum score threshold.")
        return []
    
    print(f"\n{len(recommended)} posts recommended for raid:\n")
    
    for i, post in enumerate(recommended[:5]):
        print(f"{'─'*60}")
        print(f"TARGET #{i+1}")
        print(f"🔗 {post.get('url', '')}")
        print(f"👤 @{post.get('authorHandle', '')}")
        print(f"📊 Score: {post.get('score', 0)} | ❤️ {post.get('likes', '0')} | 🔄 {post.get('retweets', '0')}")
        print(f"\n📝 Post: {post.get('text', '')[:200]}...")
        
        # Generate suggested comment
        text_lower = post.get('text', '').lower()
        
        if any(w in text_lower for w in ['scam', 'rug', 'drain']):
            print(f"\n💬 SUGGESTED COMMENT:")
            print(f'"Great point about staying safe! 🔐 We built AgenticBro for exactly this - AI-powered scam detection for X profiles and Telegram channels. Scan before you invest and protect your SOL. @AgenticBro11 AGNTCBRO #Solana"')
        elif any(w in text_lower for w in ['protect', 'safety', 'security']):
            print(f"\n💬 SUGGESTED COMMENT:")
            print(f'"Spot on! 🛡️ For anyone looking to verify projects: ✅ Scan X profiles ✅ Check Telegram channels ✅ Verify contracts. AgenticBro does all this free: t.me/agenticbro AGNTCBRO #CryptoSafety"')
        else:
            print(f"\n💬 SUGGESTED COMMENT:")
            print(f'"This is exactly why we built AgenticBro. 💙 Every week we identify 20+ scam profiles protecting 1M+ USD in SOL. Scan first, decide smart. t.me/agenticbro AGNTCBRO #Solana"')
        
        print()
    
    return recommended

if __name__ == "__main__":
    # Default search queries
    queries = [
        "crypto scam",
        "rug pull",
        "Solana scam",
        "wallet drainer",
        "protect crypto"
    ]
    
    if len(sys.argv) > 1:
        queries = [sys.argv[1]]
    
    async def main():
        all_posts = []
        
        for query in queries:
            posts = await find_raid_targets(query, min_likes=100, min_retweets=30)
            if posts:
                all_posts.extend(posts)
        
        # Remove duplicates by URL
        seen = set()
        unique_posts = []
        for post in all_posts:
            url = post.get('url', '')
            if url not in seen:
                seen.add(url)
                unique_posts.append(post)
        
        # Sort by score
        unique_posts.sort(key=lambda x: x.get('score', 0), reverse=True)
        
        # Get recommended targets
        recommended = await scan_for_good_comments(unique_posts, min_score=15)
        
        # Save to file
        if recommended:
            output = {
                "timestamp": datetime.now().isoformat(),
                "total_found": len(unique_posts),
                "recommended": len(recommended),
                "targets": recommended[:10]
            }
            
            with open('/Users/efinney/.openclaw/workspace/output/raid_targets.json', 'w') as f:
                json.dump(output, f, indent=2)
            
            print(f"\n💾 Saved {len(recommended[:10])} targets to raid_targets.json")
        
        return recommended
    
    asyncio.run(main())