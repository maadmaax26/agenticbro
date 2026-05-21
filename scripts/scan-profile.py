#!/usr/bin/env python3
"""
Single X Profile Scanner - Navigate and extract profile data
"""
import asyncio
import json
import sys
import urllib.request
from datetime import datetime
import websockets

async def scan_profile(username, port=18800):
    """Scan X profile for scam detection"""
    
    username = username.replace("@", "").strip()
    print(f"🔍 Scanning @{username}...")
    
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
        
        # Navigate to profile
        url = f"https://x.com/{username}"
        print(f"📍 Navigating to: {url}")
        
        await ws.send(json.dumps({
            "id": 1,
            "method": "Page.navigate",
            "params": {"url": url}
        }))
        
        await ws.recv()
        
        # Wait for page load
        print("⏳ Waiting for page to load...")
        await asyncio.sleep(8)
        
        # Extract profile data
        await ws.send(json.dumps({
            "id": 2,
            "method": "Runtime.evaluate",
            "params": {
                "expression": """
                (function() {
                    const data = {
                        title: document.title,
                        url: window.location.href,
                        username: '',
                        displayName: '',
                        bio: '',
                        location: '',
                        website: '',
                        joinDate: '',
                        following: '',
                        followers: '',
                        posts: '',
                        verified: false,
                        bodyText: document.body.innerText.substring(0, 2000)
                    };
                    
                    // Try multiple selectors for username
                    const usernameSelectors = [
                        '[data-testid="UserName"]',
                        '[data-testid="primaryColumn"] h2',
                        'span.css-901oao.css-16my406.r-18u37iz',
                        '[data-testid="SideNav_AccountLogIn"]'
                    ];
                    
                    for (const sel of usernameSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.innerText) {
                            data.username = el.innerText.trim();
                            break;
                        }
                    }
                    
                    // Bio
                    const bioEl = document.querySelector('[data-testid="UserDescription"]');
                    if (bioEl) data.bio = bioEl.innerText;
                    
                    // Location
                    const locationEl = document.querySelector('[data-testid="UserLocation"]');
                    if (locationEl) data.location = locationEl.innerText;
                    
                    // Website
                    const websiteEl = document.querySelector('[data-testid="UserUrl"]');
                    if (websiteEl) data.website = websiteEl.innerText;
                    
                    // Join date
                    const joinEl = document.querySelector('[data-testid="UserJoinDate"]');
                    if (joinEl) data.joinDate = joinEl.innerText;
                    
                    // Stats
                    const allSpans = document.querySelectorAll('span');
                    allSpans.forEach(span => {
                        const text = span.innerText || '';
                        if (text.match(/^[\d,KM.]+\s*Following$/i)) data.following = text;
                        if (text.match(/^[\d,KM.]+\s*Followers?$/i)) data.followers = text;
                    });
                    
                    // Posts count
                    const postsEl = document.querySelector('[href="/' + window.location.pathname.split('/')[1] + '"]');
                    if (postsEl) data.posts = postsEl.innerText;
                    
                    return JSON.stringify(data);
                })()
                """,
                "returnByValue": True
            }
        }))
        
        response = await ws.recv()
        result = json.loads(response)
        profile_json = result.get("result", {}).get("result", {}).get("value", "{}")
        
        try:
            profile_data = json.loads(profile_json)
        except:
            profile_data = {"bodyText": "Failed to parse"}
        
        # Print extracted data
        print(f"\n{'='*60}")
        print(f"🔍 Profile Scan: @{username}")
        print(f"{'='*60}")
        print(f"📍 URL: {profile_data.get('url', 'N/A')}")
        print(f"📄 Title: {profile_data.get('title', 'N/A')}")
        print(f"\n📛 Username: {profile_data.get('username', 'N/A')}")
        print(f"📍 Location: {profile_data.get('location', 'N/A')}")
        print(f"🔗 Website: {profile_data.get('website', 'N/A')}")
        print(f"📅 Join Date: {profile_data.get('joinDate', 'N/A')}")
        print(f"👥 Following: {profile_data.get('following', 'N/A')}")
        print(f"👥 Followers: {profile_data.get('followers', 'N/A')}")
        print(f"📝 Posts: {profile_data.get('posts', 'N/A')}")
        print(f"\n📄 Bio:")
        print(f"{profile_data.get('bio', 'N/A')[:500]}")
        
        # Risk analysis
        bio = profile_data.get("bio", "").lower()
        body = profile_data.get("bodyText", "").lower()
        
        risk_score = 0
        red_flags = []
        
        if any(w in bio + body for w in ["guaranteed", "100x", "1000x", "moon", "lambo", "get rich"]):
            risk_score += 15
            red_flags.append("Unrealistic promises")
        
        if any(w in bio + body for w in ["dm me", "pm me", "private alpha", "early alpha", "secret"]):
            risk_score += 20
            red_flags.append("DM solicitation")
        
        if any(w in bio + body for w in ["limited time", "act now", "hurry", "don't miss", "last chance"]):
            risk_score += 10
            red_flags.append("Urgency tactics")
        
        if "t.me" in bio or "telegram" in bio.lower():
            risk_score += 10
            red_flags.append("Telegram link")
        
        if "discord" in bio.lower():
            risk_score += 5
            red_flags.append("Discord link")
        
        # Calculate final score
        final_score = min(risk_score / 9, 10)
        
        if final_score < 3:
            risk_level = "LOW"
        elif final_score < 5:
            risk_level = "MEDIUM"
        elif final_score < 7:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"
        
        print(f"\n{'='*60}")
        print(f"⚠️  RISK SCORE: {final_score:.1f}/10 ({risk_level})")
        print(f"{'='*60}")
        
        if red_flags:
            print(f"🚩 Red Flags:")
            for flag in red_flags:
                print(f"   • {flag}")
        else:
            print(f"✅ No major red flags detected")
        
        print(f"\n📄 Page Content Preview:")
        print(f"{profile_data.get('bodyText', 'N/A')[:500]}")
        
        return {
            "username": username,
            "profile": profile_data,
            "risk_score": final_score,
            "risk_level": risk_level,
            "red_flags": red_flags
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scan-profile.py @username")
        sys.exit(1)
    
    username = sys.argv[1]
    asyncio.run(scan_profile(username))