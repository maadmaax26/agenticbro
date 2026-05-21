#!/usr/bin/env python3
"""
Batch Scan Queue - Scans pending profiles from scan_queue
Uses 3 Chrome CDP instances for parallel scanning
"""

import json
import websocket
import requests
import time
import os
from datetime import datetime
from pathlib import Path
import glob

QUEUE_DIR = Path("/Users/efinney/.openclaw/workspace/output/scan_queue")
DATABASE_FILE = Path("/Users/efinney/.openclaw/workspace/scammer-database.csv")
PROGRESS_FILE = Path("/Users/efinney/.openclaw/workspace/output/batch_scan_progress.log")

# Chrome CDP ports - use logged-in instances 18801-18803
# These have --remote-allow-origins=* enabled
CDP_PORTS = [18801, 18802, 18803]

# Pig butchering and scam patterns
PATTERNS = {
    'dm_patterns': ['dm me', 'dm for', 'message me', 'send dm', 'free help', 'assistance'],
    'templates': ['impressed by your work', 'collaborate', 'exploring opportunities', 'synergy', 'brighter future'],
    'urgency': ['hurry', 'limited', 'act now', 'fast', 'now', 'today'],
    'romance': ['love', 'relationship', 'looking for', 'single'],
    'crypto': ['crypto', 'bitcoin', 'solana', 'eth', 'nft', 'token', 'presale', 'alpha'],
    'wealth': ['luxury', 'wealth', 'rich', 'millionaire'],
    'scam_patterns': ['1000x', '100x', 'pump', 'gem', 'moon', 't.me', 'telegram', 'promo', 'promoter']
}

def get_pending_profiles():
    """Get all pending profiles from scan queue"""
    pending = []
    for filepath in glob.glob(str(QUEUE_DIR / "*.json")):
        with open(filepath, 'r') as f:
            data = json.load(f)
            if data.get('status') == 'pending':
                pending.append({
                    'id': data.get('id'),
                    'username': data.get('username'),
                    'filepath': filepath
                })
    return pending

def scan_profile(handle, port):
    """Scan a single profile using WebSocket CDP"""
    try:
        # Get page
        pages = requests.get(f"http://localhost:{port}/json/list").json()
        if not pages:
            return {'error': 'No page available', 'handle': handle}
        
        page_id = pages[0].get('id')
        ws_url = f"ws://localhost:{port}/devtools/page/{page_id}"
        ws = websocket.create_connection(ws_url)
        
        # Navigate to profile
        nav = {"id": 1, "method": "Page.navigate", "params": {"url": f"https://x.com/{handle}"}}
        ws.send(json.dumps(nav))
        ws.recv()
        time.sleep(6)
        
        # Scroll
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
            const dm = ['dm me', 'dm for', 'message me', 'send dm', 'free help', 'assistance'];
            const templates = ['impressed by your work', 'collaborate', 'exploring opportunities', 'synergy', 'brighter future'];
            const urgency = ['hurry', 'limited', 'act now', 'fast', 'now', 'today'];
            const romance = ['love', 'relationship', 'looking for', 'single'];
            const crypto = ['crypto', 'bitcoin', 'solana', 'eth', 'nft', 'token', 'presale', 'alpha'];
            const wealth = ['luxury', 'wealth', 'rich', 'millionaire'];
            const scam = ['1000x', '100x', 'pump', 'gem', 'moon', 't.me', 'telegram', 'promo', 'promoter'];
            
            if (dm.some(p => lower.includes(p))) { flags.push('DM_SOLICITATION'); score += 8; }
            if (templates.filter(p => lower.includes(p)).length >= 2) { flags.push('BOT_TEMPLATES'); score += 8; }
            if (urgency.some(p => lower.includes(p))) { flags.push('URGENCY'); score += 9; }
            if (romance.some(p => lower.includes(p)) && crypto.some(p => lower.includes(p))) { flags.push('ROMANCE_CRYPTO'); score += 10; }
            if (wealth.some(p => lower.includes(p)) && crypto.some(p => lower.includes(p))) { flags.push('WEALTH_CRYPTO'); score += 9; }
            
            // Standard scam patterns
            if (scam.some(p => lower.includes(p))) { flags.push('SCAM_PATTERN'); score += 10; }
            if (lower.includes('1000x') || lower.includes('100x')) { flags.push('UNREALISTIC_RETURNS'); score += 15; }
            if (lower.includes('presale') || lower.includes('ico') || lower.includes('ido')) { flags.push('PRESALE_PROMO'); score += 10; }
            if (lower.includes('pump') || lower.includes('gem') || lower.includes('moon')) { flags.push('PUMP_DUMP'); score += 10; }
            if (lower.includes('t.me') || lower.includes('telegram')) { flags.push('TELEGRAM_REDIRECT'); score += 5; }
            if (lower.includes('promo') || lower.includes('promoter')) { flags.push('PROMO_ACCOUNT'); score += 5; }
            
            score = Math.min(score, 10);
            
            // Extract followers
            const match = text.match(/(\\d+\\.?\\d*[KM]?)\\s*Followers/i);
            const followers = match ? match[1] : '0';
            const verified = text.includes('Verified') && text.includes('account');
            
            return JSON.stringify({
                handle: handle,
                followers: followers,
                verified: verified,
                riskScore: score,
                riskLevel: score >= 7 ? 'CRITICAL' : score >= 5 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW',
                redFlags: flags
            });
        })()
        """
        
        ws.send(json.dumps({"id": 10, "method": "Runtime.evaluate", "params": {"expression": script}}))
        response = ws.recv()
        ws.close()
        
        try:
            result = json.loads(response)
            # Check for result.result.value structure
            if 'result' in result:
                inner = result.get('result', {})
                if 'result' in inner:
                    value = inner['result'].get('value', '{}')
                    return json.loads(value)
            return {'error': f'Invalid response structure', 'handle': handle, 'response': response[:100]}
        except Exception as e:
            return {'error': str(e), 'handle': handle}
        
    except Exception as e:
        return {'error': str(e), 'handle': handle}

def update_queue_file(filepath, result):
    """Update queue file with scan result"""
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    data['status'] = 'completed'
    data['attempts'] = data.get('attempts', 0) + 1
    data['started_at'] = datetime.now().isoformat()
    data['completed_at'] = datetime.now().isoformat()
    data['result'] = {
        'status': 'active' if result.get('riskScore', 0) < 5 else 'high_risk',
        'risk_score': result.get('riskScore', 0),
        'level': result.get('riskLevel', 'LOW'),
        'red_flags': result.get('redFlags', [])
    }
    
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)

def log_progress(message):
    """Log progress to file"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(PROGRESS_FILE, 'a') as f:
        f.write(f"{timestamp} - {message}\n")
    print(message)

def main():
    log_progress("=" * 70)
    log_progress("🔐 BATCH SCAN QUEUE - PENDING PROFILES")
    log_progress("=" * 70)
    
    # Get pending profiles
    pending = get_pending_profiles()
    total = len(pending)
    log_progress(f"📋 Found {total} pending profiles to scan")
    
    if not pending:
        log_progress("✅ No pending profiles - queue is clear!")
        return
    
    # Distribute across 3 Chrome instances
    chunk_size = (total + len(CDP_PORTS) - 1) // len(CDP_PORTS)
    chunks = [pending[i:i + chunk_size] for i in range(0, total, chunk_size)]
    
    log_progress(f"📊 Distribution: {len(chunks[0])} | {len(chunks[1]) if len(chunks) > 1 else 0} | {len(chunks[2]) if len(chunks) > 2 else 0}")
    log_progress("")
    
    scanned = 0
    errors = 0
    critical = 0
    high = 0
    
    start_time = time.time()
    
    for i, profile in enumerate(pending):
        port_idx = i % len(CDP_PORTS)
        port = CDP_PORTS[port_idx]
        
        handle = profile['username']
        filepath = profile['filepath']
        
        try:
            result = scan_profile(handle, port)
            
            if 'error' in result:
                log_progress(f"  ❌ @{handle}: {result['error']}")
                errors += 1
            else:
                score = result.get('riskScore', 0)
                level = result.get('riskLevel', 'LOW')
                flags = result.get('redFlags', [])
                
                status_icon = "⛔" if score >= 7 else "⚠️" if score >= 5 else "✅"
                log_progress(f"  {status_icon} @{handle}: {score}/10 ({level})")
                
                if flags:
                    log_progress(f"     Flags: {', '.join(flags[:3])}")
                
                # Update queue file
                update_queue_file(filepath, result)
                
                if level == 'CRITICAL':
                    critical += 1
                elif level == 'HIGH':
                    high += 1
                
                scanned += 1
                
        except Exception as e:
            log_progress(f"  ❌ @{handle}: {str(e)}")
            errors += 1
        
        # Progress update every 50 profiles
        if (i + 1) % 50 == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            eta = (total - i - 1) / rate if rate > 0 else 0
            log_progress(f"  📊 Progress: {i+1}/{total} | Rate: {rate:.1f} scans/sec | ETA: {eta/60:.1f} min")
    
    elapsed = time.time() - start_time
    
    log_progress("")
    log_progress("=" * 70)
    log_progress("📊 BATCH SCAN COMPLETE")
    log_progress("=" * 70)
    log_progress(f"✅ Scanned: {scanned} profiles")
    log_progress(f"⛔ CRITICAL: {critical}")
    log_progress(f"⚠️ HIGH: {high}")
    log_progress(f"❌ Errors: {errors}")
    log_progress(f"⏱️  Duration: {elapsed/60:.1f} minutes")
    log_progress(f"📈 Rate: {scanned/elapsed:.1f} scans/second")
    log_progress("=" * 70)
    log_progress(f"📅 Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()