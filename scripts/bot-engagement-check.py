#!/usr/bin/env python3
"""Analyze X/Twitter profile for bot engagement indicators via Chrome CDP."""

import json
import sys
import time
import websocket
import urllib.request

CDP_PORT = 18801

def get_page_targets():
    resp = urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json/list")
    tabs = json.loads(resp.read())
    return [t for t in tabs if t.get("type") == "page"]

def get_or_create_page():
    tabs = get_page_targets()
    if tabs:
        return tabs[0]["webSocketDebuggerUrl"], tabs[0]["id"]
    resp = urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json/new?https://x.com")
    tab = json.loads(resp.read())
    return tab["webSocketDebuggerUrl"], tab["id"]

def cdp_eval(ws_url, expression, timeout=20):
    ws = websocket.create_connection(ws_url, timeout=timeout)
    msg_id = 1
    ws.send(json.dumps({"id": msg_id, "method": "Runtime.evaluate", "params": {
        "expression": expression,
        "returnByValue": True,
        "timeout": 15000
    }}))
    result = None
    for _ in range(40):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == msg_id:
                result = resp
                break
        except websocket.WebSocketTimeoutException:
            break
        except Exception:
            pass
    ws.close()
    if result and "result" in result:
        return result["result"].get("result", {}).get("value", "")
    return ""

def navigate_to(ws_url, url, wait=5):
    ws = websocket.create_connection(ws_url, timeout=30)
    ws.send(json.dumps({"id": 1, "method": "Page.enable"}))
    try:
        ws.recv()
    except:
        pass
    ws.send(json.dumps({"id": 2, "method": "Page.navigate", "params": {"url": url}}))
    for _ in range(30):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == 2:
                break
        except:
            pass
    ws.close()
    time.sleep(wait)

def analyze_profile(username):
    """Analyze profile for bot engagement indicators."""
    ws_url, tab_id = get_or_create_page()
    
    # Navigate to profile
    print(f"Navigating to https://x.com/{username}...")
    navigate_to(ws_url, f"https://x.com/{username}", wait=6)
    
    # Extract profile metrics
    profile_data = cdp_eval(ws_url, """
    (() => {
        const result = {};
        
        // Get follower/following counts
        const links = document.querySelectorAll('a');
        for (const link of links) {
            const href = link.getAttribute('href') || '';
            const text = link.innerText || '';
            if (href.includes('/followers')) {
                const num = text.replace(/[^0-9.KMB]/g, '');
                if (num) result.followers = num;
            }
            if (href.includes('/following')) {
                const num = text.replace(/[^0-9.KMB]/g, '');
                if (num) result.following = num;
            }
        }
        
        // Get display name
        const nameEl = document.querySelector('[data-testid="UserName"]');
        if (nameEl) {
            result.displayName = nameEl.innerText.split('\\n')[0];
        }
        
        // Get bio
        const bioEl = document.querySelector('[data-testid="UserDescription"]');
        if (bioEl) {
            result.bio = bioEl.innerText;
        }
        
        // Get join date
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
            if (span.innerText.includes('Joined')) {
                result.joinDate = span.innerText;
                break;
            }
        }
        
        // Get verified status
        const verifiedIcon = document.querySelector('[data-testid="icon"]');
        result.verified = !!verifiedIcon;
        
        return JSON.stringify(result);
    })()
    """)
    
    # Extract recent tweets with engagement metrics
    tweets_data = cdp_eval(ws_url, """
    (() => {
        const tweets = [];
        const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
        const limit = Math.min(tweetEls.length, 10);
        
        for (let i = 0; i < limit; i++) {
            const tweet = {};
            const el = tweetEls[i];
            
            // Tweet text
            const textEl = el.querySelector('[data-testid="tweetText"]');
            tweet.text = textEl ? textEl.innerText.substring(0, 200) : '';
            
            // Extract engagement numbers from aria-label
            const ariaLabel = el.getAttribute('aria-label') || '';
            
            // Get metrics from buttons
            const buttons = el.querySelectorAll('button[aria-label]');
            tweet.replies = 0;
            tweet.retweets = 0;
            tweet.likes = 0;
            tweet.views = 0;
            tweet.bookmarks = 0;
            
            for (const btn of buttons) {
                const label = btn.getAttribute('aria-label') || '';
                const match = label.match(/([0-9,.KMB]+)(?:\s*(replies?|reposts?|likes?|views?|bookmarks?|quotes?))?/i);
                if (match) {
                    const num = match[1];
                    if (label.toLowerCase().includes('repl')) tweet.replies = num;
                    else if (label.toLowerCase().includes('repost') || label.toLowerCase().includes('retweet')) tweet.retweets = num;
                    else if (label.toLowerCase().includes('like')) tweet.likes = num;
                    else if (label.toLowerCase().includes('view')) tweet.views = num;
                    else if (label.toLowerCase().includes('bookmark')) tweet.bookmarks = num;
                }
            }
            
            // Try data-testid for views
            const viewEl = el.querySelector('[data-testid="views"]');
            if (viewEl) {
                tweet.views = viewEl.innerText;
            }
            
            // Get all span numbers
            const allSpans = el.querySelectorAll('span');
            const nums = [];
            for (const span of allSpans) {
                const t = span.innerText.trim();
                if (t.match(/^[0-9,.KMB]+$/) && t.length < 10) {
                    nums.push(t);
                }
            }
            tweet.metricNums = nums;
            
            // Time
            const timeEl = el.querySelector('time');
            tweet.time = timeEl ? timeEl.getAttribute('datetime') : '';
            
            tweets.push(tweet);
        }
        
        return JSON.stringify(tweets);
    })()
    """)
    
    return {
        "profile": profile_data,
        "tweets": tweets_data
    }

def analyze_replies(username):
    """Click into first tweet and analyze replies for bot patterns."""
    ws_url, tab_id = get_or_create_page()
    
    # Already on profile page, click first tweet
    print("Clicking into first tweet to analyze replies...")
    
    click_result = cdp_eval(ws_url, """
    (() => {
        const tweets = document.querySelectorAll('[data-testid="tweet"]');
        if (tweets.length > 0) {
            const timeEl = tweets[0].querySelector('time');
            if (timeEl) {
                const link = timeEl.closest('a');
                if (link) {
                    link.click();
                    return 'CLICKED';
                }
            }
        }
        return 'NOT_FOUND';
    })()
    """)
    
    time.sleep(5)  # Wait for tweet to load
    
    # Extract reply patterns
    replies_data = cdp_eval(ws_url, """
    (() => {
        const replies = [];
        const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
        
        // Skip first one (original tweet)
        for (let i = 1; i < Math.min(tweetEls.length, 20); i++) {
            const el = tweetEls[i];
            const reply = {};
            
            // Reply text
            const textEl = el.querySelector('[data-testid="tweetText"]');
            reply.text = textEl ? textEl.innerText.substring(0, 150) : '';
            
            // Author info
            const userEl = el.querySelector('[data-testid="User-Name"]');
            reply.author = userEl ? userEl.innerText.split('\\n')[0] : '';
            
            const userLink = el.querySelector('a[href^="/"]');
            if (userLink) {
                reply.authorHref = userLink.getAttribute('href');
            }
            
            // Check for profile image (bots often have default/missing)
            const imgEl = el.querySelector('img[src*="profile_images"]');
            reply.hasProfileImage = !!imgEl;
            
            // Check account age (if visible)
            const timeEl = el.querySelector('time');
            reply.time = timeEl ? timeEl.getAttribute('datetime') : '';
            
            // Check for generic/repetitive content patterns
            const lowerText = reply.text.toLowerCase();
            reply.isGeneric = (
                lowerText.length < 20 ||
                lowerText.match(/^(nice|good|great|awesome|thanks|thank you|yes|no|ok|cool|wow|amazing|🔥|🚀|💎|📈|💯)+/i) ||
                lowerText.match(/^(dm me|check dm|sent dm|check your dm)/i)
            );
            
            replies.push(reply);
        }
        
        return JSON.stringify(replies);
    })()
    """)
    
    return replies_data

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 bot-engagement-check.py <username>")
        sys.exit(1)
    
    username = sys.argv[1].replace("@", "")
    
    print(f"\n{'='*60}")
    print(f"BOT ENGAGEMENT ANALYSIS: @{username}")
    print(f"{'='*60}\n")
    
    try:
        profile_result = analyze_profile(username)
        
        profile = json.loads(profile_result["profile"]) if profile_result["profile"] else {}
        tweets = json.loads(profile_result["tweets"]) if profile_result["tweets"] else []
        
        print("PROFILE METRICS:")
        print(f"  Followers: {profile.get('followers', 'N/A')}")
        print(f"  Following: {profile.get('following', 'N/A')}")
        print(f"  Verified: {profile.get('verified', False)}")
        print(f"  Join Date: {profile.get('joinDate', 'N/A')}")
        print()
        
        print(f"RECENT TWEETS ANALYZED: {len(tweets)}")
        print("-" * 60)
        
        # Analyze engagement ratios
        for i, tweet in enumerate(tweets[:5]):
            print(f"\nTweet {i+1}:")
            text_preview = tweet.get('text', '')[:80]
            print(f"  Text: {text_preview}...")
            print(f"  Metrics: {tweet.get('metricNums', [])}")
            print(f"  Time: {tweet.get('time', 'N/A')}")
        
        # Analyze replies
        print("\n" + "="*60)
        print("REPLY ANALYSIS:")
        print("="*60)
        
        replies_raw = analyze_replies(username)
        replies = json.loads(replies_raw) if replies_raw else []
        
        if replies:
            print(f"Replies found: {len(replies)}")
            
            generic_count = sum(1 for r in replies if r.get('isGeneric'))
            no_image_count = sum(1 for r in replies if not r.get('hasProfileImage'))
            
            print(f"  Generic/short replies: {generic_count}/{len(replies)} ({100*generic_count/len(replies):.1f}%)")
            print(f"  Replies without profile image: {no_image_count}/{len(replies)} ({100*no_image_count/len(replies):.1f}%)")
            
            print("\n  Sample replies:")
            for r in replies[:5]:
                text_preview = r.get('text', '')[:50]
                author = r.get('author', 'Unknown')
                has_img = "✓" if r.get('hasProfileImage') else "✗"
                print(f"    [{has_img}] {author}: {text_preview}...")
        else:
            print("No replies found to analyze.")
        
        print("\n" + "="*60)
        print("ASSESSMENT:")
        print("="*60)
        
        # Parse follower count
        followers_str = str(profile.get('followers', '0'))
        followers_num = 0
        if 'K' in followers_str:
            followers_num = float(followers_str.replace('K', '').replace(',', '')) * 1000
        elif 'M' in followers_str:
            followers_num = float(followers_str.replace('M', '').replace(',', '')) * 1000000
        else:
            followers_num = float(followers_str.replace(',', '')) if followers_str.replace(',', '').isdigit() else 0
        
        # Key indicators
        indicators = []
        
        # 1. Follower/engagement ratio
        if tweets and followers_num > 0:
            avg_likes = 0
            for t in tweets:
                nums = t.get('metricNums', [])
                for num in nums:
                    if 'K' in str(num):
                        avg_likes += float(str(num).replace('K', '')) * 1000
                    elif 'M' in str(num):
                        avg_likes += float(str(num).replace('M', '')) * 1000000
                    elif str(num).replace(',', '').isdigit():
                        avg_likes += float(str(num).replace(',', ''))
            if avg_likes > 0:
                avg_likes = avg_likes / len(tweets)
                ratio = followers_num / avg_likes if avg_likes > 0 else 0
                # Healthy accounts have follower:engagement ratio of 1-5%
                # Bot-inflated accounts often have ratios > 50 (many followers, low engagement)
                if ratio > 100:
                    indicators.append(f"⚠️  High follower:engagement ratio ({ratio:.0f}:1) suggests possible bot followers")
                elif ratio > 50:
                    indicators.append(f"⚠️  Elevated follower:engagement ratio ({ratio:.0f}:1) - review engagement quality")
                else:
                    indicators.append(f"✓ Normal follower:engagement ratio ({ratio:.1f}:1)")
        
        # 2. Generic replies
        if replies:
            generic_pct = 100 * generic_count / len(replies)
            if generic_pct > 50:
                indicators.append(f"⚠️  High generic reply rate ({generic_pct:.0f}%) - possible bot engagement")
            elif generic_pct > 30:
                indicators.append(f"⚠️  Elevated generic reply rate ({generic_pct:.0f}%)")
            else:
                indicators.append(f"✓ Low generic reply rate ({generic_pct:.0f}%)")
        
        # 3. Profile images on replies
        if replies:
            no_img_pct = 100 * no_image_count / len(replies)
            if no_img_pct > 30:
                indicators.append(f"⚠️  Many replies without profile images ({no_img_pct:.0f}%) - suspicious")
            else:
                indicators.append(f"✓ Most replies have profile images ({100-no_img_pct:.0f}%)")
        
        # 4. Verified status
        if profile.get('verified'):
            indicators.append("✓ Account is verified")
        
        for ind in indicators:
            print(f"  {ind}")
        
        print("\n" + "="*60)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()