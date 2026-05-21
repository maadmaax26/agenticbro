#!/usr/bin/env python3
"""
Quick X Profile Scanner - Scan a single profile via Chrome CDP
"""
import asyncio
import json
import sys
import re
from datetime import datetime
import websockets

async def scan_profile(username, port=18800):
    """Scan X profile for scam detection"""
    
    # Remove @ if present
    username = username.replace("@", "").strip()
    
    print(f"🔍 Scanning @{username}...")
    
    ws_url = f"ws://localhost:{port}/devtools/page"
    
    # Get available pages
    import urllib.request
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/json") as response:
            pages = json.loads(response.read().decode())
    except Exception as e:
        print(f"❌ Cannot connect to Chrome on port {port}: {e}")
        return None
    
    if not pages:
        print("❌ No Chrome pages available")
        return None
    
    # Find or create a page
    page = pages[0]
    page_id = page.get("id")
    ws_url = page.get("webSocketDebuggerUrl")
    
    if not ws_url:
        print("❌ Cannot get WebSocket URL")
        return None
    
    # Connect to page
    async with websockets.connect(ws_url) as ws:
        
        # Navigate to X profile
        url = f"https://x.com/{username}"
        
        await ws.send(json.dumps({
            "id": 1,
            "method": "Page.navigate",
            "params": {"url": url}
        }))
        
        response = await ws.recv()
        
        # Wait for page load
        await asyncio.sleep(5)
        
        # Get page content
        await ws.send(json.dumps({
            "id": 2,
            "method": "Runtime.evaluate",
            "params": {
                "expression": "document.body.innerText",
                "returnByValue": True
            }
        }))
        
        response = await ws.recv()
        result = json.loads(response)
        content = result.get("result", {}).get("result", {}).get("value", "")
        
        # Get profile data via DOM
        await ws.send(json.dumps({
            "id": 3,
            "method": "Runtime.evaluate",
            "params": {
                "expression": """
                (function() {
                    const data = {
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
                        pinnedTweet: ''
                    };
                    
                    // Try to get username
                    const usernameEl = document.querySelector('[data-testid="UserName"]') || 
                                      document.querySelector('span[data-testid="UserName"]');
                    if (usernameEl) data.username = usernameEl.innerText;
                    
                    // Display name
                    const displayNameEl = document.querySelector('[data-testid="UserName"] span');
                    if (displayNameEl) data.displayName = displayNameEl.innerText;
                    
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
                    const stats = document.querySelectorAll('[data-testid="primaryColumn"] span');
                    stats.forEach(span => {
                        const text = span.innerText || '';
                        if (text.includes('Following')) data.following = text;
                        if (text.includes('Followers')) data.followers = text;
                        if (text.includes('Posts') || text.includes('posts')) data.posts = text;
                    });
                    
                    // Verified check
                    const verifiedBadge = document.querySelector('[data-testid="icon"]');
                    if (verifiedBadge) data.verified = true;
                    
                    // Pinned tweet
                    const pinnedEl = document.querySelector('[data-testid="tweet"]');
                    if (pinnedEl) data.pinnedTweet = pinnedEl.innerText.substring(0, 500);
                    
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
            profile_data = {}
        
        # Analyze for red flags
        risk_score = 0
        red_flags = []
        
        bio = profile_data.get("bio", "").lower()
        
        # Red flag detection
        if any(word in bio for word in ["guaranteed", "100x", "1000x", "moon", "lambo"]):
            risk_score += 15
            red_flags.append("Unrealistic promises")
        
        if any(word in bio for word in ["dm me", "pm me", "private alpha", "early alpha"]):
            risk_score += 20
            red_flags.append("DM solicitation")
        
        if any(word in bio for word in ["crypto millionaire", "make money", "get rich"]):
            risk_score += 15
            red_flags.append("Get rich claims")
        
        if any(word in bio for word in ["limited time", "act now", "hurry", "don't miss"]):
            risk_score += 10
            red_flags.append("Urgency tactics")
        
        if any(word in bio for word in ["bitcoin", "ethereum", "solana", "trading"]):
            risk_score += 5
            red_flags.append("Crypto focus")
        
        if "http" in bio and any(domain in bio for domain in ["t.me", "telegram", "discord"]):
            risk_score += 10
            red_flags.append("External chat link")
        
        # Calculate final score (0-10 scale)
        final_score = min(risk_score / 9, 10)
        
        # Risk level
        if final_score < 3:
            risk_level = "LOW"
        elif final_score < 5:
            risk_level = "MEDIUM"
        elif final_score < 7:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"
        
        # Print results
        print(f"\n{'='*50}")
        print(f"🔍 Profile Scan: @{username}")
        print(f"{'='*50}")
        print(f"📛 Display Name: {profile_data.get('displayName', 'N/A')}")
        print(f"📍 Location: {profile_data.get('location', 'N/A')}")
        print(f"🔗 Website: {profile_data.get('website', 'N/A')}")
        print(f"📅 Join Date: {profile_data.get('joinDate', 'N/A')}")
        print(f"👥 Following: {profile_data.get('following', 'N/A')}")
        print(f"👥 Followers: {profile_data.get('followers', 'N/A')}")
        print(f"📝 Posts: {profile_data.get('posts', 'N/A')}")
        print(f"✅ Verified: {'Yes' if profile_data.get('verified') else 'No'}")
        print(f"\n📄 Bio:")
        print(f"{profile_data.get('bio', 'N/A')[:300]}")
        print(f"\n{'='*50}")
        print(f"⚠️  RISK SCORE: {final_score:.1f}/10 ({risk_level})")
        print(f"{'='*50}")
        
        if red_flags:
            print(f"🚩 Red Flags:")
            for flag in red_flags:
                print(f"   • {flag}")
        else:
            print(f"✅ No major red flags detected")
        
        return {
            "username": username,
            "profile": profile_data,
            "risk_score": final_score,
            "risk_level": risk_level,
            "red_flags": red_flags
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python quick-scan.py @username")
        sys.exit(1)
    
    username = sys.argv[1]
    asyncio.run(scan_profile(username))