#!/usr/bin/env python3
"""
Simple Batch Scanner - Scans UNVERIFIED profiles sequentially
Uses WebSocket CDP for reliable scanning
"""

import csv
import json
import websocket
import requests
import time
from datetime import datetime
from pathlib import Path

DATABASE_FILE = Path("/Users/efinney/.openclaw/workspace/scammer-database.csv")
REPORTS_DIR = Path("/Users/efinney/.openclaw/workspace/output/scan_reports")
CHROME_PORT = 18801

# Pig butchering patterns
PB_PATTERNS = {
    'dm_patterns': ['dm me', 'message me', 'send dm', 'free help', 'assistance'],
    'templates': ['impressed by your work', 'collaborate', 'exploring opportunities', 'synergy', 'brighter future'],
    'urgency': ['guaranteed', 'limited time', 'act now', 'fast', 'hurry'],
    'romance': ['love', 'relationship', 'looking for', 'single', 'dating'],
    'crypto': ['crypto', 'bitcoin', 'trading', 'invest', 'alpha', 'profits'],
    'wealth': ['luxury', 'wealth', 'rich', 'millionaire']
}

def get_unverified_handles():
    """Get UNVERIFIED handles from database"""
    handles = []
    with open(DATABASE_FILE, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('Verification Level') == 'UNVERIFIED' and row.get('Platform') == 'X':
                handle = row.get('X Handle', '').replace('@', '')
                if handle:
                    handles.append(handle)
    return handles

def scan_profile(handle, ws):
    """Scan a single profile using WebSocket CDP"""
    print(f"  📡 Scanning @{handle}...")
    
    # Navigate to profile
    nav = {"id": 1, "method": "Page.navigate", "params": {"url": f"https://x.com/{handle}"}}
    ws.send(json.dumps(nav))
    ws.recv()
    time.sleep(8)
    
    # Scroll to load content
    for i in range(2):
        ws.send(json.dumps({"id": 2+i, "method": "Runtime.evaluate", 
                           "params": {"expression": f"window.scrollTo(0, {(i+1)*400});"}}))
        ws.recv()
        time.sleep(1)
    
    # Extract and analyze
    script = """
    (() => {
        const text = document.body.innerText;
        const lower = text.toLowerCase();
        
        let score = 0;
        let flags = [];
        
        // Pig butchering patterns
        if (PB_PATTERNS.dm_patterns.some(p => lower.includes(p))) { flags.push('DM_SOLICITATION'); score += 8; }
        if (PB_PATTERNS.templates.filter(p => lower.includes(p)).length >= 2) { flags.push('BOT_TEMPLATES'); score += 8; }
        if (PB_PATTERNS.urgency.some(p => lower.includes(p))) { flags.push('URGENCY'); score += 9; }
        if (PB_PATTERNS.romance.some(p => lower.includes(p)) && PB_PATTERNS.crypto.some(p => lower.includes(p))) { flags.push('ROMANCE_CRYPTO'); score += 10; }
        if (PB_PATTERNS.wealth.some(p => lower.includes(p)) && PB_PATTERNS.crypto.some(p => lower.includes(p))) { flags.push('WEALTH_CRYPTO'); score += 9; }
        
        // Standard scam patterns
        if (lower.includes('1000x') || lower.includes('100x')) { flags.push('UNREALISTIC_RETURNS'); score += 15; }
        if (lower.includes('presale') || lower.includes('ico') || lower.includes('ido')) { flags.push('PRESALE_PROMO'); score += 10; }
        if (lower.includes('pump') || lower.includes('gem') || lower.includes('moon')) { flags.push('PUMP_DUMP'); score += 10; }
        if (lower.includes('t.me') || lower.includes('telegram')) { flags.push('TELEGRAM_REDIRECT'); score += 5; }
        if (lower.includes('promo') || lower.includes('promoter')) { flags.push('PROMO_ACCOUNT'); score += 5; }
        
        // Extract info
        const lines = text.split('\\n').filter(l => l.trim());
        let followers = '', verified = false, bio = '';
        
        for (const line of lines) {
            if (line.match(/\\d+\\.?\\d*[KM]?\\s*Followers/i)) followers = line;
            if (line.includes('Alpha') || line.includes('Crypto') || line.includes('NFT') || line.includes('Gem')) bio = line;
        }
        
        verified = text.includes('Verified') && text.includes('account');
        score = Math.min(score, 10);
        
        return JSON.stringify({
            handle: window.location.href.split('/').pop(),
            followers, bio, verified,
            riskScore: score,
            riskLevel: score >= 7 ? 'CRITICAL' : score >= 5 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW',
            redFlags: flags
        });
    })()
    """.replace('PB_PATTERNS', json.dumps(PB_PATTERNS))
    
    ws.send(json.dumps({"id": 10, "method": "Runtime.evaluate", "params": {"expression": script}}))
    result = json.loads(ws.recv())
    
    if 'result' in result and 'result' in result['result']:
        profile = json.loads(result['result']['result']['value'])
        return profile
    
    return {'handle': handle, 'error': 'No data', 'riskScore': 0}

def update_database(handle, profile):
    """Update database with scan results"""
    rows = []
    with open(DATABASE_FILE, 'r') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)
    
    for row in rows:
        if row.get('X Handle', '').replace('@', '') == handle:
            row['Verification Level'] = 'HIGH RISK' if profile.get('riskScore', 0) >= 7 else 'PARTIALLY VERIFIED' if profile.get('riskScore', 0) >= 5 else 'LEGITIMATE'
            row['Last Updated'] = datetime.now().strftime('%Y-%m-%d')
            row['Risk Score'] = str(profile.get('riskScore', 0))
            row['Status'] = 'ACTIVE' if profile.get('riskScore', 0) >= 5 else 'MONITORED'
            row['Scam Type'] = profile.get('scamType', 'Profile Scam')
            row['Notes'] = f"Batch scan. Red flags: {', '.join(profile.get('redFlags', []))}"
            break
    
    with open(DATABASE_FILE, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

def main():
    print("=" * 70)
    print("🔐 AGENTIC BRO BATCH PROFILE SCANNER")
    print("=" * 70)
    print()
    
    # Get UNVERIFIED handles
    handles = get_unverified_handles()
    print(f"📋 Found {len(handles)} UNVERIFIED profiles to scan")
    print()
    
    if not handles:
        print("✅ No UNVERIFIED profiles found - queue is clear!")
        return
    
    # Get WebSocket connection
    try:
        pages = requests.get(f"http://localhost:{CHROME_PORT}/json/list").json()
        if not pages:
            print("❌ No Chrome pages available")
            return
        
        page_id = pages[0].get('id')
        ws_url = f"ws://localhost:{CHROME_PORT}/devtools/page/{page_id}"
        ws = websocket.create_connection(ws_url)
    except Exception as e:
        print(f"❌ Failed to connect to Chrome CDP: {e}")
        return
    
    # Scan each profile
    scanned = 0
    errors = 0
    
    for handle in handles:
        try:
            profile = scan_profile(handle, ws)
            
            if 'error' in profile:
                print(f"  ⚠️  @{handle}: {profile['error']}")
                errors += 1
            else:
                score = profile.get('riskScore', 0)
                level = profile.get('riskLevel', 'LOW')
                flags = profile.get('redFlags', [])
                
                print(f"  ✅ @{handle}: {score}/10 ({level})")
                if flags:
                    print(f"     Flags: {', '.join(flags)}")
                
                # Update database
                update_database(handle, profile)
                scanned += 1
                
        except Exception as e:
            print(f"  ❌ @{handle}: {str(e)}")
            errors += 1
    
    ws.close()
    
    print()
    print("=" * 70)
    print("📊 BATCH SCAN COMPLETE")
    print("=" * 70)
    print(f"✅ Scanned: {scanned} profiles")
    print(f"❌ Errors: {errors}")
    print(f"📅 Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

if __name__ == "__main__":
    main()