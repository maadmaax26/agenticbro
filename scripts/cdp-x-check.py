#!/usr/bin/env python3
"""Extract X/Twitter profile data and engagement info via Chrome CDP."""

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
    # Create new tab
    resp = urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json/new?https://x.com")
    tab = json.loads(resp.read())
    return tab["webSocketDebuggerUrl"], tab["id"]

def cdp_eval(ws_url, expression, timeout=15):
    ws = websocket.create_connection(ws_url, timeout=timeout)
    msg_id = 1
    ws.send(json.dumps({"id": msg_id, "method": "Runtime.evaluate", "params": {
        "expression": expression,
        "returnByValue": True,
        "timeout": 10000
    }}))
    result = None
    for _ in range(30):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == msg_id:
                result = resp
                break
        except websocket.WebSocketTimeoutException:
            break
        except Exception as e:
            pass
    ws.close()
    if result and "result" in result:
        return result["result"].get("result", {}).get("value", "")
    return ""

def navigate_to(ws_url, url, wait=5):
    ws = websocket.create_connection(ws_url, timeout=30)
    # Enable page events
    ws.send(json.dumps({"id": 1, "method": "Page.enable"}))
    try:
        ws.recv()
    except:
        pass
    
    # Navigate
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

def scroll_down(ws_url, pixels=3000, wait=3):
    cdp_eval(ws_url, f"window.scrollBy(0, {pixels}); 'scrolled'")
    time.sleep(wait)

def extract_profile_info(username):
    """Navigate to profile and extract key metrics."""
    ws_url, tab_id = get_or_create_page()
    
    # Navigate to profile
    navigate_to(ws_url, f"https://x.com/{username}", wait=5)
    
    # Extract profile data via JS
    profile_data = cdp_eval(ws_url, """
    (() => {
        const result = {};
        
        // Get follower/following counts from the profile header
        const links = document.querySelectorAll('a');
        for (const link of links) {
            const href = link.getAttribute('href') || '';
            const text = link.innerText || '';
            if (href.includes('/verified_followers') || href.includes('/followers')) {
                if (text.includes('Follower')) {
                    result.followers = text.replace(/[^0-9]/g, '');
                }
            }
            if (href.includes('/following')) {
                if (text.includes('Following')) {
                    result.following = text.replace(/[^0-9]/g, '');
                }
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
        
        // Get post count
        const links2 = document.querySelectorAll('a');
        for (const link of links2) {
            const href = link.getAttribute('href') || '';
            if (href === `/${username}` || href === `/${username}/`) {
                const text = link.innerText || '';
                if (text.includes('Post')) {
                    result.postCount = text.replace(/[^0-9]/g, '');
                }
            }
        }
        
        return JSON.stringify(result);
    })()
    """)
    
    # Get first few tweets
    tweets_data = cdp_eval(ws_url, """
    (() => {
        const tweets = [];
        const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
        const limit = Math.min(tweetEls.length, 5);
        
        for (let i = 0; i < limit; i++) {
            const tweet = {};
            const el = tweetEls[i];
            
            // Tweet text
            const textEl = el.querySelector('[data-testid="tweetText"]');
            tweet.text = textEl ? textEl.innerText : '';
            
            // Metrics
            const metrics = {};
            const metricEls = el.querySelectorAll('[role="group"] span, [data-testid="app-text-transition-container"]');
            
            // Get reply, retweet, like, view counts
            const allSpans = el.querySelectorAll('span');
            const nums = [];
            for (const span of allSpans) {
                const t = span.innerText.trim();
                if (t.match(/^[0-9,.KMB]+$/) && t.length < 10) {
                    nums.push(t);
                }
            }
            tweet.metrics = nums;
            
            // Author
            const userLink = el.querySelector('[data-testid="User-Name"] a');
            if (userLink) {
                tweet.author = userLink.innerText;
                tweet.authorHref = userLink.getAttribute('href');
            }
            
            // Time
            const timeEl = el.querySelector('time');
            tweet.time = timeEl ? timeEl.getAttribute('datetime') : '';
            
            tweets.push(tweet);
        }
        
        return JSON.stringify(tweets);
    })()
    """)
    
    # Scroll down to load more content, then check replies on first post
    scroll_down(ws_url, 3000, 3)
    
    more_tweets = cdp_eval(ws_url, """
    (() => {
        const tweets = [];
        const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
        for (let i = 0; i < Math.min(tweetEls.length, 10); i++) {
            const el = tweetEls[i];
            const textEl = el.querySelector('[data-testid="tweetText"]');
            if (textEl) {
                tweets.push(textEl.innerText.substring(0, 200));
            }
        }
        return JSON.stringify(tweets);
    })()
    """)
    
    return {
        "username": username,
        "profile": profile_data,
        "tweets": tweets_data,
        "more_tweets": more_tweets
    }

def check_post_replies(ws_url, username, post_index=0):
    """Click into a specific post and check replies for bot patterns."""
    # Click on the tweet to expand it
    click_js = (
        "(() => {"
        "  const tweets = document.querySelectorAll('[data-testid=\"tweet\"]');"
        "  if (tweets.length > " + str(post_index) + ") {"
        "    const timeEl = tweets[" + str(post_index) + "].querySelector('time');"
        "    if (timeEl) {"
        "      const link = timeEl.closest('a');"
        "      if (link) {"
        "        link.click();"
        "        return link.href;"
        "      }"
        "    }"
        "  }"
        "  return 'NOT_FOUND';"
        "})()"
    )
    result = cdp_eval(ws_url, click_js)
    
    time.sleep(4)
    
    # Extract replies
    replies_data = cdp_eval(ws_url, """
    (() => {
        const replies = [];
        const replyEls = document.querySelectorAll('[data-testid="tweet"]');
        
        for (let i = 1; i < Math.min(replyEls.length, 15); i++) {
            const el = replyEls[i];
            const reply = {};
            
            const textEl = el.querySelector('[data-testid="tweetText"]');
            reply.text = textEl ? textEl.innerText.substring(0, 150) : '';
            
            const userEl = el.querySelector('[data-testid="User-Name"]');
            reply.user = userEl ? userEl.innerText.substring(0, 80) : '';
            
            // Check for avatar (real profile pics vs default)
            const avatarEl = el.querySelector('[data-testid="TweetAvatar"] img');
            reply.hasAvatar = avatarEl ? true : false;
            reply.avatarSrc = avatarEl ? avatarEl.getAttribute('src')?.substring(0, 50) : 'none';
            
            replies.push(reply);
        }
        
        return JSON.stringify(replies);
    })()
    """)
    
    # Scroll for more replies
    scroll_down(ws_url, 2000, 3)
    
    more_replies = cdp_eval(ws_url, """
    (() => {
        const replies = [];
        const replyEls = document.querySelectorAll('[data-testid="tweet"]');
        
        for (let i = 1; i < Math.min(replyEls.length, 25); i++) {
            const el = replyEls[i];
            const reply = {};
            
            const textEl = el.querySelector('[data-testid="tweetText"]');
            reply.text = textEl ? textEl.innerText.substring(0, 150) : '';
            
            const userEl = el.querySelector('[data-testid="User-Name"]');
            reply.user = userEl ? userEl.innerText.substring(0, 80) : '';
            
            replies.push(reply);
        }
        
        return JSON.stringify(replies);
    })()
    """)
    
    return {
        "post_url": result,
        "replies": replies_data,
        "more_replies": more_replies
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: cdp-x-check.py <username> [--replies]")
        sys.exit(1)
    
    username = sys.argv[1]
    check_replies = "--replies" in sys.argv
    
    data = extract_profile_info(username)
    print(json.dumps(data, indent=2))
    
    if check_replies:
        ws_url, _ = get_or_create_page()
        reply_data = check_post_replies(ws_url, username, 0)
        print("\n--- REPLIES ---")
        print(json.dumps(reply_data, indent=2))