#!/usr/bin/env python3
"""
Phone Community Scan Worker
Processes phone_community scan jobs from Supabase queue
Uses Chrome CDP to scrape 800notes.com and whocalledme.org

Runs on Mac Studio (has Chrome CDP on port 18801)
Polls Supabase scan_jobs for pending phone_community jobs.
"""

import json
import time
import requests
import websocket
import os
import sys
from datetime import datetime
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://drvasofyghnxfxvkkwad.supabase.co')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

CDP_PORT = int(os.environ.get('CDP_PORT', '18801'))
POLL_INTERVAL = int(os.environ.get('POLL_INTERVAL', '5'))  # seconds
MAX_RETRIES = 3

# ── CDP Helper Functions ────────────────────────────────────────────────────

def get_active_tab(port: int) -> str | None:
    """Get an active browser tab ID from Chrome CDP."""
    try:
        resp = requests.get(f"http://localhost:{port}/json/list", timeout=5)
        pages = resp.json()
        # Prefer newtab or blank pages
        for page in pages:
            url = page.get('url', '')
            if 'chrome://newtab' in url or 'about:blank' in url:
                return page.get('id')
        # Fall back to any page
        for page in pages:
            if page.get('type') == 'page':
                return page.get('id')
        return pages[0].get('id') if pages else None
    except Exception as e:
        print(f"[CDP] Error getting tabs: {e}")
        return None

def navigate_to(port: int, tab_id: str, url: str, wait: float = 3.0) -> bool:
    """Navigate tab to URL via CDP."""
    try:
        ws_url = f"ws://localhost:{port}/devtools/page/{tab_id}"
        ws = websocket.create_connection(ws_url, timeout=10)
        
        # Send navigate command
        cmd = {"id": 1, "method": "Page.navigate", "params": {"url": url}}
        ws.send(json.dumps(cmd))
        ws.recv()  # Wait for response
        
        time.sleep(wait)  # Wait for page load
        ws.close()
        return True
    except Exception as e:
        print(f"[CDP] Navigate error: {e}")
        return False

def get_page_text(port: int, tab_id: str) -> str | None:
    """Extract page text content via CDP."""
    try:
        ws_url = f"ws://localhost:{port}/devtools/page/{tab_id}"
        ws = websocket.create_connection(ws_url, timeout=10)
        
        # Execute script to get body text
        cmd = {"id": 1, "method": "Runtime.evaluate", 
               "params": {"expression": "document.body.innerText"}}
        ws.send(json.dumps(cmd))
        result = json.loads(ws.recv())
        ws.close()
        
        if 'result' in result and 'result' in result['result']:
            return result['result']['result'].get('value', '')
        return None
    except Exception as e:
        print(f"[CDP] Get text error: {e}")
        return None

# ── Scraping Functions ─────────────────────────────────────────────────────

def scrape_800notes(port: int, tab_id: str, phone: str) -> dict:
    """Scrape 800notes.com for community reports."""
    result = {
        'source': '800notes.com',
        'url': f'https://800notes.com/Phone.aspx/{phone.lstrip("+")}',
        'reports': [],
        'total': 0,
        'scam_mentions': 0,
        'last_report_date': None,
        'error': None
    }
    
    try:
        # Navigate to 800notes
        if not navigate_to(port, tab_id, result['url'], wait=4.0):
            result['error'] = 'Navigation failed'
            return result
        
        # Get page content
        text = get_page_text(port, tab_id)
        if not text:
            result['error'] = 'Failed to extract page content'
            return result
        
        # Parse content
        import re
        
        # Count scam keywords
        scam_keywords = r'\b(scam|fraud|spam|robocall|harassment|fake|phishing|threat|warning)\b'
        result['scam_mentions'] = len(re.findall(scam_keywords, text, re.I))
        
        # Look for call count
        call_match = re.search(r'(\d+)\s*(?:calls?|reports?|complaints?)', text, re.I)
        if call_match:
            result['total'] = int(call_match.group(1))
        else:
            result['total'] = result['scam_mentions'] * 5
        
        # Extract comments with dates
        comment_pattern = r'(\d{1,2}/\d{1,2}/\d{2,4}[^"]*?)(?=\d{1,2}/\d{1,2}/\d{2,4}|$)'
        comments = re.findall(comment_pattern, text)
        result['reports'] = comments[:10]
        
        # Last report date
        date_matches = re.findall(r'(\d{1,2}/\d{1,2}/\d{2,4})', text)
        if date_matches:
            result['last_report_date'] = date_matches[-1]
        
        print(f"[800notes] Found {result['total']} reports, {result['scam_mentions']} scam mentions")
        
    except Exception as e:
        result['error'] = str(e)
    
    return result

def scrape_whocalledme(port: int, tab_id: str, phone: str) -> dict:
    """Scrape whocalledme.org for community reports."""
    result = {
        'source': 'whocalledme.org',
        'url': f'https://www.whocalledme.org/phone/{phone.lstrip("+")}',
        'reports': [],
        'total': 0,
        'scam_mentions': 0,
        'spam_score': 0,
        'risk_level': 'unknown',
        'last_report_date': None,
        'error': None
    }
    
    try:
        # Navigate to whocalledme
        if not navigate_to(port, tab_id, result['url'], wait=4.0):
            result['error'] = 'Navigation failed'
            return result
        
        # Get page content
        text = get_page_text(port, tab_id)
        if not text:
            result['error'] = 'Failed to extract page content'
            return result
        
        import re
        
        # Count scam keywords
        scam_keywords = r'\b(scam|fraud|spam|robocall|harassment|fake|phishing|threat)\b'
        result['scam_mentions'] = len(re.findall(scam_keywords, text, re.I))
        
        # Look for call count
        call_match = re.search(r'(\d+)\s*(?:calls?|reports?|complaints?)', text, re.I)
        if call_match:
            result['total'] = int(call_match.group(1))
        else:
            result['total'] = result['scam_mentions'] * 3
        
        # Look for spam score
        score_match = re.search(r'(?:spam\s*score|risk\s*score|rating)[:\s]*(\d+)', text, re.I)
        if score_match:
            result['spam_score'] = int(score_match.group(1))
        
        # Look for risk level
        level_match = re.search(r'(?:risk|level|rating)[:\s]*(high|medium|low|critical|safe)', text, re.I)
        if level_match:
            result['risk_level'] = level_match.group(1).lower()
        
        # Extract comments
        comment_pattern = r'(\d{1,2}/\d{1,2}/\d{2,4}[^"]*?)(?=\d{1,2}/\d{1,2}/\d{2,4}|$)'
        comments = re.findall(comment_pattern, text)
        result['reports'] = comments[:10]
        
        # Last report date
        date_matches = re.findall(r'(\d{1,2}/\d{1,2}/\d{2,4})', text)
        if date_matches:
            result['last_report_date'] = date_matches[-1]
        
        print(f"[whocalledme] Found {result['total']} reports, {result['scam_mentions']} scam mentions")
        
    except Exception as e:
        result['error'] = str(e)
    
    return result

# ── Job Processing ─────────────────────────────────────────────────────────

def claim_job() -> dict | None:
    """Claim a pending phone_community job from the queue."""
    try:
        # Use Supabase REST API
        headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
        
        # Find pending job
        resp = requests.get(
            f'{SUPABASE_URL}/rest/v1/scan_jobs'
            f'?select=*&scan_type=eq.phone_community&status=eq.pending'
            f'&order=created_at.asc&limit=1',
            headers=headers,
            timeout=10
        )
        
        jobs = resp.json()
        if not jobs:
            return None
        
        job = jobs[0]
        
        # Claim it
        update_resp = requests.patch(
            f'{SUPABASE_URL}/rest/v1/scan_jobs?id=eq.{job["id"]}',
            headers=headers,
            json={'status': 'processing', 'claimed_at': datetime.utcnow().isoformat()},
            timeout=10
        )
        
        if update_resp.status_code in [200, 204]:
            return job
        return None
        
    except Exception as e:
        print(f"[Queue] Error claiming job: {e}")
        return None

def submit_result(job_id: str, result: dict, error: str | None = None):
    """Submit job result to Supabase."""
    try:
        headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        }
        
        update = {
            'status': 'completed' if not error else 'failed',
            'result': result,
            'completed_at': datetime.utcnow().isoformat()
        }
        if error:
            update['error'] = error
        
        resp = requests.patch(
            f'{SUPABASE_URL}/rest/v1/scan_jobs?id=eq.{job_id}',
            headers=headers,
            json=update,
            timeout=10
        )
        
        print(f"[Queue] Submitted result for job {job_id}: {resp.status_code}")
        
    except Exception as e:
        print(f"[Queue] Error submitting result: {e}")

def process_job(job: dict) -> dict:
    """Process a phone community scan job."""
    payload = job.get('payload', {})
    phone = payload.get('phone', '').lstrip('+')
    sources = payload.get('sources', ['800notes', 'whocalledme'])
    
    print(f"[Job] Processing phone: +{phone}, sources: {sources}")
    
    # Get CDP tab
    tab_id = get_active_tab(CDP_PORT)
    if not tab_id:
        raise Exception("No Chrome CDP tab available")
    
    results = []
    
    # Scrape each source
    if '800notes' in sources:
        notes_result = scrape_800notes(CDP_PORT, tab_id, phone)
        results.append(notes_result)
    
    if 'whocalledme' in sources:
        who_result = scrape_whocalledme(CDP_PORT, tab_id, phone)
        results.append(who_result)
    
    # Calculate aggregate
    total_reports = sum(r.get('total', 0) for r in results)
    total_scam_mentions = sum(r.get('scam_mentions', 0) for r in results)
    
    # Determine community risk
    if total_reports > 100 or total_scam_mentions > 20:
        community_risk = 'HIGH'
    elif total_reports > 20 or total_scam_mentions > 5:
        community_risk = 'MEDIUM'
    elif total_reports > 0:
        community_risk = 'LOW'
    else:
        community_risk = 'NONE'
    
    # Get last report date
    last_dates = [r.get('last_report_date') for r in results if r.get('last_report_date')]
    
    return {
        'phone': f'+{phone}',
        'sources': results,
        'aggregate': {
            'total_reports': total_reports,
            'scam_mentions': total_scam_mentions,
            'community_risk': community_risk,
            'last_report_date': last_dates[-1] if last_dates else None
        },
        'scanned_at': datetime.utcnow().isoformat()
    }

# ── Main Loop ──────────────────────────────────────────────────────────────

def main():
    if not SUPABASE_SERVICE_KEY:
        print("[Error] SUPABASE_SERVICE_ROLE_KEY not set")
        sys.exit(1)
    
    print(f"[Worker] Starting phone community scan worker (CDP port {CDP_PORT})")
    print(f"[Worker] Polling {SUPABASE_URL} every {POLL_INTERVAL}s")
    
    while True:
        try:
            # Claim a job
            job = claim_job()
            if not job:
                time.sleep(POLL_INTERVAL)
                continue
            
            print(f"[Worker] Claimed job {job['id']}")
            
            # Process it
            try:
                result = process_job(job)
                submit_result(job['id'], result)
                print(f"[Worker] Completed job {job['id']}")
            except Exception as e:
                print(f"[Worker] Job failed: {e}")
                submit_result(job['id'], {}, error=str(e))
            
        except KeyboardInterrupt:
            print("\n[Worker] Shutting down")
            break
        except Exception as e:
            print(f"[Worker] Error: {e}")
            time.sleep(POLL_INTERVAL)

if __name__ == '__main__':
    main()