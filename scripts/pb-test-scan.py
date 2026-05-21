#!/usr/bin/env python3
"""Pig Butchering Detection Test Scan"""

import json
import requests
import websocket
import time
from datetime import datetime

# Test profile from pig butchering test data
# PB007: romance_cryptocurrency - Classic romance + crypto pig butchering
# Simulating a profile with romance + crypto keywords
TEST_HANDLE = "TestProfile_PB007"

# Get active page
pages = requests.get("http://localhost:18801/json/list").json()
page_id = None
for p in pages:
    if p.get('type') == 'page' or 'devtoolsFrontendUrl' in p:
        page_id = p['id']
        break

if not page_id:
    # Create new tab
    new_tab = requests.put("http://localhost:18801/json/new?about:blank").json()
    page_id = new_tab.get('id')
    time.sleep(2)

ws_url = f"ws://localhost:18801/devtools/page/{page_id}"
ws = websocket.create_connection(ws_url)

# Navigate to profile
nav = {"id": 1, "method": "Page.navigate", "params": {"url": f"https://x.com/{TEST_HANDLE}"}}
ws.send(json.dumps(nav))
ws.recv()
time.sleep(12)

# Scroll to load content
for i in range(3):
    ws.send(json.dumps({"id": 2+i, "method": "Runtime.evaluate", 
                        "params": {"expression": f"window.scrollTo(0, {(i+1)*600});"}}))
    ws.recv()
    time.sleep(2)

# Extract and analyze
script = """
(() => {
    const text = document.body.innerText;
    const lower = text.toLowerCase();
    
    // Pig butchering patterns
    const pb = {
        dm: ['dm me', 'message me', 'send dm', 'free help', 'assistance'],
        templates: ['impressed by your work', 'collaborate', 'exploring opportunities', 'synergy', 'brighter future'],
        urgency: ['guaranteed', 'limited time', 'act now', 'fast', 'hurry'],
        romance: ['love', 'relationship', 'looking for', 'single', 'dating'],
        crypto: ['crypto', 'bitcoin', 'trading', 'invest', 'alpha', 'profits'],
        wealth: ['luxury', 'wealth', 'rich', 'millionaire']
    };
    
    let score = 0;
    let flags = [];
    
    // Check patterns
    if (pb.dm.some(p => lower.includes(p))) { flags.push('DM_SOLICITATION'); score += 8; }
    if (pb.templates.filter(p => lower.includes(p)).length >= 2) { flags.push('BOT_TEMPLATES'); score += 8; }
    if (pb.urgency.some(p => lower.includes(p))) { flags.push('URGENCY'); score += 9; }
    if (pb.romance.some(p => lower.includes(p)) && pb.crypto.some(p => lower.includes(p))) { flags.push('ROMANCE_CRYPTO'); score += 10; }
    if (pb.wealth.some(p => lower.includes(p)) && pb.crypto.some(p => lower.includes(p))) { flags.push('WEALTH_CRYPTO'); score += 9; }
    
    // Extract profile info
    const lines = text.split('\\n').filter(l => l.trim());
    let followers = '', following = '', bio = '', verified = false;
    
    for (const line of lines) {
        if (line.match(/\\d+\\.?\\d*[KM]?\\s*Followers/i)) followers = line;
        if (line.match(/\\d+\\.?\\d*[KM]?\\s*Following/i)) following = line;
        if (line.includes('Alpha') || line.includes('Crypto') || line.includes('NFT')) bio = line;
    }
    
    verified = text.includes('Verified') && text.includes('account');
    score = Math.min(score, 10);
    
    return JSON.stringify({
        handle: 'AshCryptoX1',
        followers, following, bio, verified,
        riskScore: score,
        riskLevel: score >= 7 ? 'CRITICAL' : score >= 5 ? 'HIGH' : 'MEDIUM',
        redFlags: flags,
        scamType: score >= 7 ? 'Coordinated Shill Network' : null
    });
})()
"""

ws.send(json.dumps({"id": 10, "method": "Runtime.evaluate", "params": {"expression": script}}))
result = json.loads(ws.recv())

if 'result' in result and 'result' in result['result']:
    profile = json.loads(result['result']['result']['value'])
    
    print("=" * 70)
    print(f"🔍 PIG BUTCHERING DETECTION TEST SCAN")
    print("=" * 70)
    print(f"\n📊 Profile: @{profile['handle']}")
    print(f"   Followers: {profile['followers'] or 'N/A'}")
    print(f"   Following: {profile['following'] or 'N/A'}")
    print(f"   Bio: {profile['bio'][:60] or 'N/A'}...")
    print(f"   Verified: {'✅' if profile['verified'] else '❌'}")
    print()
    print("🚨 RED FLAGS:")
    print("-" * 70)
    if profile['redFlags']:
        for f in profile['redFlags']:
            print(f"   ⚠️  {f}")
    else:
        print("   ✅ No pig butchering red flags")
    print()
    print("🎯 ASSESSMENT:")
    print("-" * 70)
    print(f"   Risk Score: {profile['riskScore']}/10")
    print(f"   Risk Level: {profile['riskLevel']}")
    if profile['scamType']:
        print(f"   Scam Type: {profile['scamType']}")
    print()
    print("=" * 70)
    print(f"Scan: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("Framework: Pig Butchering Detection v1.0")
    print("=" * 70)

ws.close()