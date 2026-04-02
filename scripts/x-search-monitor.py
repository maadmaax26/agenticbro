#!/usr/bin/env python3
"""
X Search Monitor - Scans X search results for potential scam accounts
Uses regular X search (free, no Premium required)
"""

import json
import re
import sys
import time
import urllib.request
import websocket
from datetime import datetime

# Search terms for scam detection
SEARCH_TERMS = [
    # Direct scam patterns
    "solana airdrop",
    "crypto giveaway",
    "DM for alpha",
    "100x crypto",
    "free crypto",
    "send me DM",
    "guaranteed returns",
    
    # User inquiries about scams
    "is this a scam",
    "is this legit",
    "should I trust",
    "is this real",
    "legit or scam",
    "safe to invest",
    
    # Help requests about specific accounts
    "Help with @",
    "help me with @",
    "what do you think about @",
    "anyone know @",
    "has anyone used @",
    "experience with @",
    
    # Specific scam tactics
    "wallet drainer",
    "phishing link",
    "seed phrase",
    "private key request",
    "send SOL to receive",
    "connect wallet airdrop",
    
    # Urgency/tactics
    "limited time offer",
    "act now crypto",
    "only few spots left",
    "last chance to",
    "ending soon airdrop",
    
    # Suspicious behaviors
    "DM me for",
    "check my DM",
    "sent you DM",
    "turn on notifications for",
    "follow for signals",
]

def connect_chrome():
    """Connect to Chrome CDP"""
    try:
        response = urllib.request.urlopen('http://localhost:18800/json/list', timeout=5)
        pages = json.loads(response.read().decode())
        if not pages:
            print("❌ No Chrome tabs found")
            return None
        return pages[0]['webSocketDebuggerUrl']
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        return None

def navigate_to_search(ws, term):
    """Navigate to X search for a term"""
    search_url = f"https://x.com/search?q={term.replace(' ', '%20')}&f=live"
    ws.send(json.dumps({'id': 1, 'method': 'Page.navigate', 'params': {'url': search_url}}))
    time.sleep(10)  # Wait for JavaScript to render

def extract_usernames_from_page(ws):
    """Extract usernames using JavaScript from the loaded page"""
    # Wait for content
    time.sleep(2)
    
    # Get page text and extract @ mentions
    ws.send(json.dumps({'id': 10, 'method': 'Runtime.evaluate', 'params': {
        'expression': 'document.body.innerText',
        'returnByValue': True
    }}))
    result = json.loads(ws.recv())
    text = result.get('result', {}).get('result', {}).get('value', '')
    
    # Extract @username patterns
    excluded = {'home', 'explore', 'notifications', 'messages', 'bookmarks',
               'lists', 'profile', 'settings', 'help', 'privacy', 'tos',
               'search', 'hashtag', 'intent', 'compose', 'status', 'i', 'x'}
    
    usernames = set()
    matches = re.findall(r'@([A-Za-z0-9_]{4,15})', text)
    for m in matches:
        if m.lower() not in excluded:
            usernames.add(m)
    
    return list(usernames)

def calculate_risk(text, username):
    """Calculate risk score based on text content"""
    risk = 0
    red_flags = []
    
    text_lower = text.lower()
    
    # Red flag patterns
    if 'dm' in text_lower and ('me' in text_lower or 'for' in text_lower):
        risk += 15
        red_flags.append("DM solicitation")
    if 'giveaway' in text_lower:
        risk += 20
        red_flags.append("Giveaway")
    if 'airdrop' in text_lower:
        risk += 10
        red_flags.append("Airdrop")
    if '100x' in text_lower or '1000x' in text_lower:
        risk += 25
        red_flags.append("Unrealistic returns")
    if 'free' in text_lower and 'crypto' in text_lower:
        risk += 15
        red_flags.append("Free crypto")
    if 'alpha' in text_lower and 'dm' in text_lower:
        risk += 15
        red_flags.append("Alpha DM scheme")
    if 'guaranteed' in text_lower:
        risk += 20
        red_flags.append("Guaranteed returns")
    
    risk_score = min(risk / 90 * 10, 10)
    level = 'LOW' if risk_score < 3 else 'MEDIUM' if risk_score < 5 else 'HIGH' if risk_score < 7 else 'CRITICAL'
    
    return risk_score, level, red_flags

def scan_profile(ws, username):
    """Scan a single profile"""
    print(f"\n📊 Scanning @{username}...")
    
    # Navigate to profile
    ws.send(json.dumps({'id': 20, 'method': 'Page.navigate', 'params': {'url': f'https://x.com/{username}'}}))
    time.sleep(6)
    
    # Get profile content
    ws.send(json.dumps({'id': 21, 'method': 'Runtime.evaluate', 'params': {
        'expression': 'document.body.innerText',
        'returnByValue': True
    }}))
    result = json.loads(ws.recv())
    text = result.get('result', {}).get('result', {}).get('value', '')
    
    # Check for suspended
    if 'suspended' in text.lower() or 'account suspended' in text.lower():
        print(f"   🔴 @{username}: SUSPENDED")
        return {'username': username, 'status': 'suspended', 'risk_score': 10, 'level': 'SUSPENDED'}
    
    # Check for not found
    if 'not found' in text.lower() or "doesn't exist" in text.lower():
        print(f"   ⚪ @{username}: NOT FOUND")
        return {'username': username, 'status': 'not_found', 'risk_score': 0, 'level': 'N/A'}
    
    # Calculate risk
    risk_score, level, red_flags = calculate_risk(text, username)
    
    emoji = '🟢' if level == 'LOW' else '🟡' if level == 'MEDIUM' else '🔴'
    print(f"   {emoji} @{username}: {level} ({risk_score:.1f}/10)")
    if red_flags:
        print(f"      Red flags: {', '.join(red_flags)}")
    
    return {
        'username': username,
        'status': 'active',
        'risk_score': risk_score,
        'level': level,
        'red_flags': red_flags
    }

def main():
    print("=" * 50)
    print(f"X SEARCH MONITOR - {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 50)
    
    # Connect to Chrome
    ws_url = connect_chrome()
    if not ws_url:
        print("\n❌ Chrome CDP not running on port 18800")
        print("Start Chrome with: open -a 'Google Chrome' --args --remote-debugging-port=18800 --remote-allow-origins='*' --user-data-dir=/tmp/chrome-debug")
        return
    
    ws = websocket.create_connection(ws_url, timeout=30)
    print("✅ Connected to Chrome CDP")
    
    all_usernames = set()
    all_results = []
    
    # Scan each search term
    for term in SEARCH_TERMS:
        print(f"\n🔍 Searching: '{term}'")
        navigate_to_search(ws, term)
        
        # Extract usernames
        usernames = extract_usernames_from_page(ws)
        
        print(f"   Found {len(usernames)} usernames")
        if usernames[:5]:
            print(f"   Sample: {usernames[:5]}")
        all_usernames.update(usernames)
        
        time.sleep(2)  # Rate limiting
    
    print(f"\n📋 Total unique usernames: {len(all_usernames)}")
    
    # Scan top profiles
    if all_usernames:
        print("\n" + "=" * 50)
        print("SCANNING PROFILES")
        print("=" * 50)
        
        for username in list(all_usernames)[:5]:
            result = scan_profile(ws, username)
            all_results.append(result)
            time.sleep(3)  # Rate limiting
            
            # Return to search
            ws.send(json.dumps({'id': 30, 'method': 'Page.navigate', 'params': {'url': 'https://x.com/home'}}))
            time.sleep(1)
    
    ws.close()
    
    # Summary
    print("\n" + "=" * 50)
    print("SCAN SUMMARY")
    print("=" * 50)
    
    critical = [r for r in all_results if r.get('level') == 'CRITICAL']
    high = [r for r in all_results if r.get('level') == 'HIGH']
    medium = [r for r in all_results if r.get('level') == 'MEDIUM']
    
    print(f"Critical: {len(critical)}")
    print(f"High: {len(high)}")
    print(f"Medium: {len(medium)}")
    
    if critical:
        print(f"\n⚠️ CRITICAL ACCOUNTS:")
        for r in critical:
            print(f"   @{r['username']} - {', '.join(r['red_flags'])}")
    
    print(f"\n✅ Scan complete. {len(all_results)} profiles scanned.")

if __name__ == "__main__":
    main()