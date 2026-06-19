#!/usr/bin/env python3
"""Quick bot engagement check via Chrome CDP."""
import json
import time
import websocket
import urllib.request

CDP_PORT = 18801

def cdp_command(ws, msg_id, method, params=None):
    cmd = {"id": msg_id, "method": method}
    if params:
        cmd["params"] = params
    ws.send(json.dumps(cmd))
    for _ in range(30):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == msg_id:
                return resp
        except:
            pass
    return None

def eval_js(ws_url, js_code):
    ws = websocket.create_connection(ws_url, timeout=20)
    ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {
        "expression": js_code,
        "returnByValue": True,
        "timeout": 15000
    }}))
    result = None
    for _ in range(40):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == 1:
                result = resp.get("result", {}).get("result", {}).get("value", "")
                break
        except:
            pass
    ws.close()
    return result

def main():
    username = "defisparco" if len(__import__('sys').argv) < 2 else __import__('sys').argv[1].replace("@", "")
    
    # Get CDP page
    resp = urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json/list")
    tabs = json.loads(resp.read())
    page_tabs = [t for t in tabs if t.get("type") == "page"]
    
    if not page_tabs:
        print("ERROR: No Chrome page found. Make sure Chrome is running with CDP on port 18801")
        return
    
    ws_url = page_tabs[0]["webSocketDebuggerUrl"]
    
    print(f"BOT ENGAGEMENT ANALYSIS: @{username}")
    print("=" * 60)
    
    # Navigate to profile
    print(f"\nNavigating to https://x.com/{username}...")
    ws = websocket.create_connection(ws_url, timeout=30)
    ws.send(json.dumps({"id": 1, "method": "Page.navigate", "params": {"url": f"https://x.com/{username}"}}))
    ws.close()
    
    time.sleep(5)  # Wait for page to load
    
    # Extract profile + tweet engagement data
    print("Extracting profile and engagement data...")
    data = eval_js(ws_url, """
    (() => {
        const result = {profile: {}, tweets: [], replies: []};
        
        // Profile info
        const links = document.querySelectorAll('a');
        for (const link of links) {
            const href = link.getAttribute('href') || '';
            const text = link.innerText || '';
            if (href.includes('/followers') && text.includes('Follower')) {
                result.profile.followers = text.replace(/[^0-9.KMB]/g, '');
            }
            if (href.includes('/following') && text.includes('Following')) {
                result.profile.following = text.replace(/[^0-9.KMB]/g, '');
            }
        }
        
        const nameEl = document.querySelector('[data-testid="UserName"]');
        if (nameEl) result.profile.displayName = nameEl.innerText.split('\\n')[0];
        
        const bioEl = document.querySelector('[data-testid="UserDescription"]');
        if (bioEl) result.profile.bio = bioEl.innerText;
        
        // Verified
        result.profile.verified = !!document.querySelector('[data-testid="icon"]');
        
        // Join date
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
            if (span.innerText.includes('Joined')) {
                result.profile.joinDate = span.innerText;
                break;
            }
        }
        
        // Tweets with engagement
        const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
        for (let i = 0; i < Math.min(tweetEls.length, 5); i++) {
            const el = tweetEls[i];
            const tweet = {};
            
            const textEl = el.querySelector('[data-testid="tweetText"]');
            tweet.text = textEl ? textEl.innerText.substring(0, 200) : '';
            
            // Get all numbers from the tweet
            const nums = [];
            const allSpans = el.querySelectorAll('span');
            for (const span of allSpans) {
                const t = span.innerText.trim();
                if (t.match(/^[0-9,.KMB]+$/) && t.length < 10 && t.length > 0) {
                    nums.push(t);
                }
            }
            tweet.metricNums = nums;
            
            // Aria-labels for engagement
            const buttons = el.querySelectorAll('button[aria-label]');
            for (const btn of buttons) {
                const label = btn.getAttribute('aria-label') || '';
                if (label.includes('repl')) tweet.replies = label;
                if (label.includes('repost') || label.includes('retweet')) tweet.retweets = label;
                if (label.includes('like')) tweet.likes = label;
                if (label.includes('view')) tweet.views = label;
            }
            
            const timeEl = el.querySelector('time');
            tweet.time = timeEl ? timeEl.getAttribute('datetime') : '';
            
            result.tweets.push(tweet);
        }
        
        return JSON.stringify(result);
    })()
    """)
    
    if not data:
        print("ERROR: Could not extract data from page")
        return
    
    result = json.loads(data)
    profile = result.get('profile', {})
    tweets = result.get('tweets', [])
    
    print("\nPROFILE METRICS:")
    print(f"  Display Name: {profile.get('displayName', 'N/A')}")
    print(f"  Followers: {profile.get('followers', 'N/A')}")
    print(f"  Following: {profile.get('following', 'N/A')}")
    print(f"  Verified: {profile.get('verified', False)}")
    print(f"  Join Date: {profile.get('joinDate', 'N/A')}")
    print(f"  Bio: {profile.get('bio', 'N/A')[:100]}...")
    
    print(f"\nRECENT TWEETS ANALYZED: {len(tweets)}")
    print("-" * 60)
    
    for i, tweet in enumerate(tweets[:3]):
        print(f"\nTweet {i+1}:")
        print(f"  Text: {tweet.get('text', '')[:100]}...")
        print(f"  Metrics from buttons: replies={tweet.get('replies', '?')}, retweets={tweet.get('retweets', '?')}, likes={tweet.get('likes', '?')}")
        print(f"  All numbers found: {tweet.get('metricNums', [])}")
    
    # Click into first tweet to check replies
    print("\n" + "=" * 60)
    print("CLICKING INTO FIRST TWEET TO ANALYZE REPLIES...")
    
    eval_js(ws_url, """
    (() => {
        const tweets = document.querySelectorAll('[data-testid="tweet"]');
        if (tweets.length > 0) {
            const timeEl = tweets[0].querySelector('time');
            if (timeEl) {
                const link = timeEl.closest('a');
                if (link) link.click();
            }
        }
        return 'CLICKED';
    })()
    """)
    
    time.sleep(4)
    
    # Get reply data
    reply_data = eval_js(ws_url, """
    (() => {
        const replies = [];
        const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
        
        // Skip first (original tweet)
        for (let i = 1; i < Math.min(tweetEls.length, 15); i++) {
            const el = tweetEls[i];
            const reply = {};
            
            const textEl = el.querySelector('[data-testid="tweetText"]');
            reply.text = textEl ? textEl.innerText.substring(0, 150) : '';
            
            const userEl = el.querySelector('[data-testid="User-Name"]');
            reply.author = userEl ? userEl.innerText.split('\\n')[0] : '';
            
            const imgEl = el.querySelector('img[src*="profile_images"]');
            reply.hasProfileImage = !!imgEl;
            
            // Check for generic patterns
            const lower = reply.text.toLowerCase();
            reply.isGeneric = (
                lower.length < 20 ||
                /^(nice|good|great|awesome|thanks|thank you|yes|no|ok|cool|wow|amazing|🔥|🚀|💎|📈|💯)+/i.test(lower) ||
                /^(dm me|check dm|sent dm|check your dm)/i.test(lower)
            );
            
            // Check for account indicators
            reply.isLikelyBot = (
                !reply.hasProfileImage ||
                reply.author.match(/^[0-9]+/) ||  # numeric username
                reply.author.includes('_') && reply.author.length > 15  # random-looking username
            );
            
            replies.push(reply);
        }
        
        return JSON.stringify(replies);
    })()
    """)
    
    if reply_data:
        replies = json.loads(reply_data)
        
        print(f"\nREPLIES FOUND: {len(replies)}")
        print("-" * 60)
        
        if replies:
            generic_count = sum(1 for r in replies if r.get('isGeneric'))
            bot_indicator_count = sum(1 for r in replies if r.get('isLikelyBot'))
            no_image_count = sum(1 for r in replies if not r.get('hasProfileImage'))
            
            print(f"  Generic/short replies: {generic_count}/{len(replies)} ({100*generic_count/len(replies):.0f}%)")
            print(f"  Bot-like indicators: {bot_indicator_count}/{len(replies)} ({100*bot_indicator_count/len(replies):.0f}%)")
            print(f"  No profile image: {no_image_count}/{len(replies)} ({100*no_image_count/len(replies):.0f}%)")
            
            print("\n  Sample replies:")
            for r in replies[:5]:
                img_status = "✓" if r.get('hasProfileImage') else "✗"
                author = r.get('author', '?')
                text_preview = r.get('text', '')[:40]
                print(f"    [{img_status}] {author}: {text_preview}...")
    
    # Final assessment
    print("\n" + "=" * 60)
    print("BOT ENGAGEMENT ASSESSMENT:")
    print("=" * 60)
    
    # Parse follower count
    followers_str = str(profile.get('followers', '0'))
    followers_num = 0
    try:
        if 'K' in followers_str:
            followers_num = float(followers_str.replace('K', '').replace(',', '')) * 1000
        elif 'M' in followers_str:
            followers_num = float(followers_str.replace('M', '').replace(',', '')) * 1000000
        else:
            followers_num = float(followers_str.replace(',', ''))
    except:
        pass
    
    indicators = []
    
    # Calculate engagement
    if tweets and followers_num > 0:
        # Estimate likes from metric numbers
        total_nums = []
        for t in tweets:
            for num in t.get('metricNums', []):
                try:
                    if 'K' in str(num):
                        total_nums.append(float(str(num).replace('K', '')) * 1000)
                    elif 'M' in str(num):
                        total_nums.append(float(str(num).replace('M', '')) * 1000000)
                    elif str(num).replace(',', '').isdigit():
                        total_nums.append(float(str(num).replace(',', '')))
                except:
                    pass
        
        if total_nums:
            avg_eng = sum(total_nums) / len(tweets) / 3  # Rough estimate
            ratio = followers_num / avg_eng if avg_eng > 0 else 0
            
            if ratio > 100:
                indicators.append(f"⚠️  HIGH follower:engagement ratio ({ratio:.0f}:1) - suggests bot followers")
            elif ratio > 50:
                indicators.append(f"⚠️  Elevated follower:engagement ratio ({ratio:.0f}:1)")
            else:
                indicators.append(f"✓ Normal follower:engagement ratio ({ratio:.1f}:1)")
    
    if reply_data:
        replies = json.loads(reply_data)
        if replies:
            generic_pct = 100 * generic_count / len(replies)
            if generic_pct > 60:
                indicators.append(f"⚠️  HIGH generic reply rate ({generic_pct:.0f}%) - bot engagement")
            elif generic_pct > 40:
                indicators.append(f"⚠️  Elevated generic reply rate ({generic_pct:.0f}%)")
            else:
                indicators.append(f"✓ Low generic reply rate ({generic_pct:.0f}%)")
            
            bot_pct = 100 * bot_indicator_count / len(replies)
            if bot_pct > 50:
                indicators.append(f"⚠️  Many bot-like reply accounts ({bot_pct:.0f}%)")
            else:
                indicators.append(f"✓ Most reply accounts look legitimate")
    
    if profile.get('verified'):
        indicators.append("✓ Account is verified (blue check)")
    
    print(f"\nFollower count: {followers_str}")
    print(f"Followers parsed: {followers_num:,.0f}")
    
    for ind in indicators:
        print(f"  {ind}")
    
    # Verdict
    warning_count = sum(1 for i in indicators if i.startswith("⚠️"))
    if warning_count >= 2:
        print("\nVERDICT: ⚠️  ENGAGEMENT APPEARS BOT-INFLATED")
        print("Key concerns: Multiple indicators suggest artificial engagement")
    elif warning_count == 1:
        print("\nVERDICT: ⚠️  MIXED - Some suspicious indicators")
    else:
        print("\nVERDICT: ✓ ENGAGEMENT APPEARS ORGANIC")

if __name__ == "__main__":
    main()