#!/usr/bin/env python3
"""Streamlined X profile extraction via Chrome CDP."""

import json
import sys
import time
import websocket
import urllib.request

CDP_PORT = 18801

def get_ws_url():
    resp = urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json/list")
    tabs = json.loads(resp.read())
    page_tabs = [t for t in tabs if t.get("type") == "page"]
    return page_tabs[0]["webSocketDebuggerUrl"] if page_tabs else None

def cdp_eval(ws_url, js_expr, timeout=15):
    ws = websocket.create_connection(ws_url, timeout=timeout)
    ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {
        "expression": js_expr, "returnByValue": True
    }}))
    result = None
    for _ in range(30):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == 1:
                result = resp.get("result", {}).get("result", {}).get("value", "")
                break
        except:
            pass
    ws.close()
    return result or ""

def navigate_to(ws_url, url, wait=5):
    ws = websocket.create_connection(ws_url, timeout=30)
    ws.send(json.dumps({"id": 1, "method": "Page.enable"}))
    try: ws.recv()
    except: pass
    ws.send(json.dumps({"id": 2, "method": "Page.navigate", "params": {"url": url}}))
    for _ in range(20):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == 2: break
        except: pass
    ws.close()
    time.sleep(wait)

def extract_profile(username):
    ws_url = get_ws_url()
    if not ws_url:
        return {"error": "No Chrome page found"}
    
    navigate_to(ws_url, f"https://x.com/{username}", wait=5)
    
    # Extract profile header info
    profile = cdp_eval(ws_url, r"""
    (() => {
        const result = {};
        const allAnchors = document.querySelectorAll('a[href]');
        for (const a of allAnchors) {
            const href = a.getAttribute('href') || '';
            const text = (a.innerText || '').trim();
            if (href.includes('/followers') && text && !result.followersLink) {
                result.followersLink = text;
            }
            if (href.includes('/following') && text && !result.followingLink) {
                result.followingLink = text;
            }
        }
        const descEl = document.querySelector('[data-testid="UserDescription"]');
        result.bio = descEl ? descEl.innerText : '';
        const unameEl = document.querySelector('[data-testid="UserName"]');
        result.userName = unameEl ? unameEl.innerText : '';
        
        // Look for "Followed by" text
        const allText = document.body.innerText;
        const fbMatch = allText.match(/Followed by ([^\n]+)/);
        if (fbMatch) result.followedBy = fbMatch[1].substring(0, 100);
        
        return JSON.stringify(result);
    })()
    """)
    
    # Extract recent tweets with metrics
    tweets = cdp_eval(ws_url, r"""
    (() => {
        const tweets = [];
        const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
        const limit = Math.min(tweetEls.length, 5);
        for (let i = 0; i < limit; i++) {
            const el = tweetEls[i];
            const tweet = {};
            const textEl = el.querySelector('[data-testid="tweetText"]');
            tweet.text = textEl ? textEl.innerText.substring(0, 200) : '';
            const timeEl = el.querySelector('time');
            tweet.time = timeEl ? timeEl.getAttribute('datetime') : '';
            
            // Get engagement numbers from the bottom bar
            const groupEl = el.querySelector('[role="group"]');
            if (groupEl) {
                const spans = groupEl.querySelectorAll('span');
                const nums = [];
                for (const span of spans) {
                    const t = span.innerText.trim();
                    if (t.match(/^[0-9,.KMB]+$/) && t.length < 8) {
                        nums.push(t);
                    }
                }
                // Deduplicate adjacent duplicates
                const deduped = [];
                for (const n of nums) {
                    if (deduped.length === 0 || deduped[deduped.length-1] !== n) {
                        deduped.push(n);
                    }
                }
                tweet.engagement = deduped;
            }
            tweets.push(tweet);
        }
        return JSON.stringify(tweets);
    })()
    """)
    
    return {
        "username": username,
        "profile": profile,
        "tweets": tweets
    }

def click_first_tweet(username):
    """Click into the first tweet and get replies."""
    ws_url = get_ws_url()
    if not ws_url:
        return {"error": "No Chrome page"}
    
    # Click on the tweet's timestamp link to open it
    result = cdp_eval(ws_url, """
    (() => {
        const tweets = document.querySelectorAll('[data-testid="tweet"]');
        if (tweets.length > 0) {
            const timeEl = tweets[0].querySelector('time');
            if (timeEl) {
                const link = timeEl.closest('a');
                if (link) {
                    link.click();
                    return link.href;
                }
            }
        }
        return 'NOT_FOUND';
    })()
    """)
    
    time.sleep(4)
    
    # Get reply data
    replies = cdp_eval(ws_url, r"""
    (() => {
        const replies = [];
        const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
        // Skip first (original tweet), get replies
        for (let i = 1; i < Math.min(tweetEls.length, 20); i++) {
            const el = tweetEls[i];
            const reply = {};
            const textEl = el.querySelector('[data-testid="tweetText"]');
            reply.text = textEl ? textEl.innerText.substring(0, 120) : '';
            const userEl = el.querySelector('[data-testid="User-Name"]');
            reply.user = userEl ? userEl.innerText.substring(0, 80) : '';
            const avatarEl = el.querySelector('[data-testid="TweetAvatar"] img');
            reply.hasAvatar = !!avatarEl;
            replies.push(reply);
        }
        return JSON.stringify(replies);
    })()
    """)
    
    return {"post_url": result, "replies": replies}

def click_second_tweet():
    """Go back and click into the second tweet."""
    ws_url = get_ws_url()
    # Go back first
    cdp_eval(ws_url, "window.history.back(); 'back'")
    time.sleep(3)
    
    result = cdp_eval(ws_url, """
    (() => {
        const tweets = document.querySelectorAll('[data-testid="tweet"]');
        if (tweets.length > 1) {
            const timeEl = tweets[1].querySelector('time');
            if (timeEl) {
                const link = timeEl.closest('a');
                if (link) {
                    link.click();
                    return link.href;
                }
            }
        }
        return 'NOT_FOUND';
    })()
    """)
    
    time.sleep(4)
    
    replies = cdp_eval(ws_url, r"""
    (() => {
        const replies = [];
        const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
        for (let i = 1; i < Math.min(tweetEls.length, 15); i++) {
            const el = tweetEls[i];
            const reply = {};
            const textEl = el.querySelector('[data-testid="tweetText"]');
            reply.text = textEl ? textEl.innerText.substring(0, 120) : '';
            const userEl = el.querySelector('[data-testid="User-Name"]');
            reply.user = userEl ? userEl.innerText.substring(0, 80) : '';
            const avatarEl = el.querySelector('[data-testid="TweetAvatar"] img');
            reply.hasAvatar = !!avatarEl;
            replies.push(reply);
        }
        return JSON.stringify(replies);
    })()
    """)
    
    return {"post_url": result, "replies": replies}

def check_followers_tab(username):
    """Navigate to followers tab and check for bot-like followers."""
    ws_url = get_ws_url()
    if not ws_url:
        return {"error": "No Chrome page"}
    
    navigate_to(ws_url, f"https://x.com/{username}/verified_followers", wait=4)
    
    followers = cdp_eval(ws_url, r"""
    (() => {
        const cells = document.querySelectorAll('[data-testid="UserCell"]');
        const result = [];
        for (let i = 0; i < Math.min(cells.length, 15); i++) {
            const cell = cells[i];
            const info = {};
            const userLink = cell.querySelector('a[href]');
            if (userLink) {
                info.href = userLink.getAttribute('href');
                info.name = userLink.innerText.substring(0, 50);
            }
            const avatar = cell.querySelector('img');
            info.hasAvatar = !!avatar;
            info.avatarSrc = avatar ? (avatar.getAttribute('src') || '').substring(0, 60) : 'none';
            const bioSpan = cell.querySelector('[dir="auto"]:not(a)');
            info.bio = bioSpan ? bioSpan.innerText.substring(0, 60) : '';
            result.push(info);
        }
        return JSON.stringify(result);
    })()
    """)
    
    return followers

if __name__ == "__main__":
    username = sys.argv[1]
    action = sys.argv[2] if len(sys.argv) > 2 else "profile"
    
    if action == "profile":
        data = extract_profile(username)
        print(json.dumps(data, indent=2))
    elif action == "replies1":
        data = click_first_tweet(username)
        print(json.dumps(data, indent=2))
    elif action == "replies2":
        data = click_second_tweet()
        print(json.dumps(data, indent=2))
    elif action == "followers":
        data = check_followers_tab(username)
        print(json.dumps(data, indent=2))