#!/usr/bin/env python3
"""
TweetDeck/X Pro Monitor - Simplified Version
Monitors X Pro columns and scans profiles for scam red flags.
"""

import json
import websocket
import urllib.request
import time
import re
import os
import sys
from datetime import datetime

# Configuration
CHROME_CDP_URL = "http://localhost:18800"
SCAN_DELAY = 3  # seconds between operations

class TweetDeckMonitor:
    def __init__(self):
        self.ws = None
        self.scanned = set()
        
    def connect(self):
        """Connect to Chrome CDP"""
        try:
            response = urllib.request.urlopen(f"{CHROME_CDP_URL}/json/list")
            pages = json.loads(response.read().decode())
            
            if not pages:
                print("❌ No Chrome tabs available")
                return False
            
            ws_url = pages[0]['webSocketDebuggerUrl']
            self.ws = websocket.create_connection(ws_url, timeout=15)
            print(f"✅ Connected to Chrome CDP")
            print(f"   Tab: {pages[0].get('title', 'Unknown')[:40]}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
            return False
    
    def send(self, method, params=None):
        """Send command and get result"""
        cmd_id = int(time.time() * 1000)
        cmd = {"id": cmd_id, "method": method}
        if params:
            cmd["params"] = params
        
        self.ws.send(json.dumps(cmd))
        self.ws.settimeout(10)
        
        result = json.loads(self.ws.recv())
        return result.get("result", {})
    
    def get_url(self):
        """Get current page URL"""
        result = self.send("Runtime.evaluate", {"expression": "window.location.href"})
        return result.get("result", {}).get("value", "")
    
    def get_html(self):
        """Get page HTML"""
        # Enable DOM
        self.send("DOM.enable")
        doc = self.send("DOM.getDocument")
        
        if 'root' in doc:
            root_id = doc['root']['nodeId']
            html_result = self.send("DOM.getOuterHTML", {"nodeId": root_id})
            return html_result.get('outerHTML', '')
        return ''
    
    def navigate(self, url):
        """Navigate to URL"""
        print(f"📍 Navigating to: {url}")
        self.send("Page.navigate", {"url": url})
        time.sleep(SCAN_DELAY)
    
    def extract_usernames(self, html):
        """Extract usernames from HTML"""
        usernames = set()
        
        # Pattern 1: @username mentions
        usernames.update(re.findall(r'@([A-Za-z0-9_]{3,15})', html))
        
        # Pattern 2: screen_name in JSON
        usernames.update(re.findall(r'"screen_name":"([A-Za-z0-9_]{3,15})"', html))
        
        # Exclude common non-usernames
        excluded = {'home', 'explore', 'notifications', 'messages', 'bookmarks',
                   'lists', 'profile', 'settings', 'help', 'privacy', 'tos',
                   'search', 'hashtag', 'intent', 'compose', 'status'}
        
        return [u for u in usernames if u.lower() not in excluded]
    
    def parse_profile(self, html, username):
        """Parse profile data from HTML"""
        profile = {"username": username, "scan_date": datetime.now().isoformat()}
        
        # Check for suspended
        if 'suspended' in html.lower():
            profile["status"] = "SUSPENDED"
            profile["risk_score"] = 100
            profile["risk_level"] = "CRITICAL"
            profile["red_flags"] = ["Account suspended"]
            return profile
        
        # Check for not found
        if "doesn't exist" in html.lower():
            profile["status"] = "NOT_FOUND"
            profile["risk_score"] = 0
            profile["risk_level"] = "NONE"
            profile["red_flags"] = []
            return profile
        
        profile["status"] = "ACTIVE"
        
        # Extract data
        name = re.search(r'"name":"([^"]{1,100})"', html)
        if name:
            profile["display_name"] = name.group(1)
        
        desc = re.search(r'"description":"([^"]*)"', html)
        if desc:
            profile["bio"] = desc.group(1).replace('\\n', ' ')
        
        followers = re.search(r'"followers_count":(\d+)', html)
        if followers:
            profile["followers"] = int(followers.group(1))
        
        following = re.search(r'"friends_count":(\d+)', html)
        if following:
            profile["following"] = int(following.group(1))
        
        created = re.search(r'"created_at":"([^"]+)"', html)
        if created:
            profile["created_at"] = created.group(1)
        
        # Calculate risk
        risk_score = 0
        red_flags = []
        bio = profile.get("bio", "").lower()
        
        if 'dm' in bio or 'pm me' in bio:
            risk_score += 15
            red_flags.append("DM solicitation")
        
        if 'giveaway' in bio or 'airdrop' in bio:
            risk_score += 20
            red_flags.append("Giveaway mentioned")
        
        if '100x' in bio or 'guaranteed' in bio:
            risk_score += 25
            red_flags.append("Unrealistic returns")
        
        if 'private alpha' in bio or 'exclusive' in bio:
            risk_score += 15
            red_flags.append("Private alpha")
        
        # Check account age
        if created and ('2024' in created.group(1) or '2025' in created.group(1) or '2026' in created.group(1)):
            risk_score += 15
            red_flags.append("New account")
        
        # Normalize score
        profile["risk_score"] = round(min(risk_score / 90 * 10, 10), 1)
        profile["red_flags"] = red_flags
        
        if profile["risk_score"] < 3:
            profile["risk_level"] = "LOW"
        elif profile["risk_score"] < 5:
            profile["risk_level"] = "MEDIUM"
        elif profile["risk_score"] < 7:
            profile["risk_level"] = "HIGH"
        else:
            profile["risk_level"] = "CRITICAL"
        
        return profile
    
    def scan_profile(self, username):
        """Scan a single profile"""
        if username in self.scanned:
            return None
        
        self.scanned.add(username)
        
        print(f"\n📊 Scanning @{username}...")
        
        # Navigate to profile
        self.navigate(f"https://x.com/{username}")
        
        # Get page content
        html = self.get_html()
        
        # Parse and return
        return self.parse_profile(html, username)
    
    def save_result(self, result):
        """Save result to file"""
        if not result or result.get("status") == "NOT_FOUND":
            return
        
        scan_dir = os.path.expanduser("~/.openclaw/workspace/output/scan_reports")
        os.makedirs(scan_dir, exist_ok=True)
        
        filename = f"{result['username']}_{datetime.now().strftime('%Y-%m-%d')}.json"
        filepath = os.path.join(scan_dir, filename)
        
        with open(filepath, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"   💾 Saved: {filepath}")
    
    def run_once(self, usernames=None):
        """Run a single scan cycle"""
        print(f"\n{'='*50}")
        print(f"TWEETDECK MONITOR - {datetime.now().strftime('%H:%M:%S')}")
        print(f"{'='*50}")
        
        # Get usernames from current page if not provided
        if not usernames:
            html = self.get_html()
            usernames = self.extract_usernames(html)
            print(f"📋 Found {len(usernames)} usernames on page")
        
        # Scan each username
        for username in usernames[:5]:  # Limit to 5
            result = self.scan_profile(username)
            
            if result:
                # Print result
                level = result.get("risk_level", "UNKNOWN")
                score = result.get("risk_score", 0)
                emoji = "🟢" if level == "LOW" else "🟡" if level == "MEDIUM" else "🔴"
                
                print(f"   {emoji} @{username}: {level} ({score}/10)")
                
                if result.get("red_flags"):
                    for flag in result["red_flags"]:
                        print(f"      ⚠️ {flag}")
                
                # Save to file
                self.save_result(result)
            
            # Return to X Pro
            self.navigate("https://pro.x.com/")
        
        print(f"\n✅ Scan complete. {len(self.scanned)} profiles scanned.")
    
    def close(self):
        """Close connection"""
        if self.ws:
            self.ws.close()


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="TweetDeck/X Pro Scam Monitor")
    parser.add_argument("--username", "-u", help="Scan a specific username")
    parser.add_argument("--usernames", "-U", nargs="+", help="Scan multiple usernames")
    parser.add_argument("--once", action="store_true", help="Run one scan and exit")
    parser.add_argument("--continuous", action="store_true", help="Run continuously")
    parser.add_argument("--interval", type=int, default=60, help="Scan interval (seconds)")
    
    args = parser.parse_args()
    
    monitor = TweetDeckMonitor()
    
    if not monitor.connect():
        sys.exit(1)
    
    try:
        if args.username:
            # Scan single username
            result = monitor.scan_profile(args.username)
            if result:
                monitor.save_result(result)
                print(json.dumps(result, indent=2))
        
        elif args.usernames:
            # Scan multiple usernames
            monitor.run_once(args.usernames)
        
        elif args.continuous:
            # Continuous monitoring
            print(f"🔄 Continuous monitoring (interval: {args.interval}s)")
            while True:
                monitor.run_once()
                print(f"\n⏳ Waiting {args.interval}s...")
                time.sleep(args.interval)
        
        else:
            # Single scan
            monitor.run_once()
    
    except KeyboardInterrupt:
        print("\n\n⏹️ Stopped by user")
    finally:
        monitor.close()


if __name__ == "__main__":
    main()