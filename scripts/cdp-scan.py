#!/usr/bin/env python3
"""Chrome CDP profile scanner - navigates to X profiles and extracts text content."""
import json
import sys
import time
import websocket

CDP_PORT = 18801
PAGE_TIMEOUT = 15  # seconds to wait for page load

def get_ws_url():
    import urllib.request
    resp = urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json/list")
    tabs = json.loads(resp.read())
    # Find a usable page tab (not omnibox, not iframe)
    for tab in tabs:
        if tab.get("type") == "page" and "parentId" not in tab:
            url = tab.get("url", "")
            if "newtab" in url or "x.com" in url or "twitter.com" in url:
                return tab["webSocketDebuggerUrl"], tab["id"]
    # Fallback: use first page type tab
    for tab in tabs:
        if tab.get("type") == "page" and "parentId" not in tab:
            return tab["webSocketDebuggerUrl"], tab["id"]
    raise RuntimeError("No usable CDP tab found")

def cdp_send(ws, method, params=None, timeout=30):
    """Send CDP command and get result."""
    global msg_id
    msg_id += 1
    msg = {"id": msg_id, "method": method}
    if params:
        msg["params"] = params
    ws.send(json.dumps(msg))
    # Read responses until we get ours
    deadline = time.time() + timeout
    while time.time() < deadline:
        ws.settimeout(timeout)
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == msg_id:
                return resp
        except websocket.WebSocketTimeoutException:
            break
    return {"error": "timeout"}

msg_id = 0

def scan_profile(username):
    """Navigate to X profile and extract bio + recent tweets."""
    ws_url, tab_id = get_ws_url()
    ws = websocket.create_connection(ws_url, timeout=30)
    
    try:
        # Navigate to profile
        url = f"https://x.com/{username}"
        cdp_send(ws, "Page.navigate", {"url": url})
        
        # Wait for page to load
        time.sleep(5)
        
        # Try to get page content via DOM
        cdp_send(ws, "DOM.enable")
        
        # Get document root
        doc = cdp_send(ws, "DOM.getDocument", {"depth": -1})
        
        # Extract text content via JavaScript evaluation
        js_code = """
        (function() {
            let result = {
                bio: '',
                name: '',
                handle: '',
                tweets: [],
                pinned: [],
                followers: '',
                following: '',
                joined: '',
                verified: false,
                protected: false
            };
            
            // Try to get display name
            let nameEl = document.querySelector('[data-testid="UserName"]');
            if (nameEl) result.name = nameEl.innerText.substring(0, 200);
            
            // Bio
            let bioEl = document.querySelector('[data-testid="UserDescription"]');
            if (bioEl) result.bio = bioEl.innerText.substring(0, 500);
            
            // User URL
            let urlEl = document.querySelector('[data-testid="UserUrl"]');
            if (urlEl) result.bio += ' | URL: ' + urlEl.innerText.substring(0, 200);
            
            // Followers/following
            let followEl = document.querySelector('[data-testid="UserName"]');
            if (followEl) {
                let links = followEl.querySelectorAll('a');
                for (let link of links) {
                    let text = link.innerText;
                    if (text.includes('following')) result.following = text;
                    if (text.includes('follower')) result.followers = text;
                }
            }
            
            // Joined date
            let joinEl = document.querySelector('[data-testid="UserJoinDate"]');
            if (joinEl) result.joined = joinEl.innerText;
            
            // Verified badge
            let svgEl = document.querySelector('[data-testid="icon-CircleCheck"]');
            if (svgEl) result.verified = true;
            
            // Protected
            let lockEl = document.querySelector('[data-testid="icon-Lock"]');
            if (lockEl) result.protected = true;
            
            // Recent tweets
            let tweetEls = document.querySelectorAll('[data-testid="tweetText"]');
            let tweets = [];
            for (let i = 0; i < Math.min(tweetEls.length, 10); i++) {
                tweets.push(tweetEls[i].innerText.substring(0, 300));
            }
            result.tweets = tweets;
            
            // Full page text for additional context
            let bodyText = document.body ? document.body.innerText.substring(0, 3000) : '';
            result.pageText = bodyText;
            
            return JSON.stringify(result);
        })()
        """
        
        eval_result = cdp_send(ws, "Runtime.evaluate", {
            "expression": js_code,
            "returnByValue": True
        })
        
        # Also take a screenshot for visual analysis
        screenshot = cdp_send(ws, "Page.captureScreenshot", {"format": "jpeg", "quality": 50})
        
        result_data = {}
        if "result" in eval_result and "result" in eval_result["result"]:
            val = eval_result["result"]["result"].get("value", "")
            if val:
                try:
                    result_data = json.loads(val)
                except:
                    result_data = {"raw": val}
        
        result_data["username"] = username
        result_data["screenshot_available"] = "result" in screenshot
        
        # Save screenshot
        if "result" in screenshot and "data" in screenshot["result"]:
            import base64
            img_data = base64.b64decode(screenshot["result"]["data"])
            screenshot_path = f"/Users/efinney/.openclaw/workspace/scan_screenshots/{username}.jpg"
            import os
            os.makedirs(os.path.dirname(screenshot_path), exist_ok=True)
            with open(screenshot_path, "wb") as f:
                f.write(img_data)
            result_data["screenshot_path"] = screenshot_path
        
        return result_data
        
    except Exception as e:
        return {"username": username, "error": str(e)}
    finally:
        ws.close()

if __name__ == "__main__":
    username = sys.argv[1].replace("@", "").strip()
    result = scan_profile(username)
    print(json.dumps(result, ensure_ascii=False, indent=2))