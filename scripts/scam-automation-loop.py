#!/usr/bin/env python3
"""
Scam Detection Automation Loop
==============================
1. EXTRACT: Scans X search results, identifies authors and mentioned profiles
2. FILTER: Ignores profiles already in Supabase scammer database
3. QUEUE: Creates JSON jobs for new profiles
4. DEEP-DIVE: Runs AI-powered scan and updates Supabase
"""

import json
import re
import os
import sys
import time
import hashlib
import urllib.request
import urllib.error
import websocket
from datetime import datetime
from pathlib import Path

# Configuration
SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL', 'https://drvasofyghnxfxvkkwad.supabase.co')
SUPABASE_KEY = os.environ.get('VITE_SUPABASE_ANON_KEY', '')
CHROME_CDP_URL = 'http://localhost:18800'
QUEUE_DIR = Path('/Users/efinney/.openclaw/workspace/output/scan_queue')
REPORTS_DIR = Path('/Users/efinney/.openclaw/workspace/output/scan_reports')
SCAN_LOG = Path('/Users/efinney/.openclaw/workspace/output/automation.log')

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

# Rate limiting
SCAN_INTERVAL = 60  # seconds between search cycles
PROFILE_SCAN_DELAY = 5  # seconds between profile scans
MAX_PROFILES_PER_CYCLE = 10


class ScamAutomation:
    def __init__(self):
        self.queue_dir = QUEUE_DIR
        self.reports_dir = REPORTS_DIR
        self.queue_dir.mkdir(parents=True, exist_ok=True)
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        self.ws = None
        self.processed_profiles = set()
        self.log_file = SCAN_LOG
        
    def log(self, message, level="INFO"):
        """Log message with timestamp"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_line = f"[{timestamp}] [{level}] {message}"
        print(log_line)
        with open(self.log_file, 'a') as f:
            f.write(log_line + '\n')
    
    def connect_chrome(self):
        """Connect to Chrome CDP"""
        try:
            response = urllib.request.urlopen(f'{CHROME_CDP_URL}/json/list', timeout=5)
            pages = json.loads(response.read().decode())
            if not pages:
                self.log("No Chrome tabs found", "ERROR")
                return False
            
            ws_url = pages[0]['webSocketDebuggerUrl']
            self.ws = websocket.create_connection(ws_url, timeout=30)
            self.log("Connected to Chrome CDP")
            return True
        except Exception as e:
            self.log(f"Failed to connect to Chrome: {e}", "ERROR")
            return False
    
    def disconnect_chrome(self):
        """Disconnect from Chrome CDP"""
        if self.ws:
            self.ws.close()
            self.ws = None
    
    def navigate_to_search(self, term):
        """Navigate to X search"""
        search_url = f"https://x.com/search?q={term.replace(' ', '%20')}&f=live"
        self.ws.send(json.dumps({'id': 1, 'method': 'Page.navigate', 'params': {'url': search_url}}))
        time.sleep(10)  # Wait for JavaScript to render
    
    def extract_profiles_from_page(self):
        """Extract author usernames and mentioned profiles"""
        time.sleep(2)
        
        # Get page text
        self.ws.send(json.dumps({'id': 10, 'method': 'Runtime.evaluate', 'params': {
            'expression': 'document.body.innerText',
            'returnByValue': True
        }}))
        result = json.loads(self.ws.recv())
        text = result.get('result', {}).get('result', {}).get('value', '')
        
        # Extract @username patterns
        excluded = {'home', 'explore', 'notifications', 'messages', 'bookmarks',
                   'lists', 'profile', 'settings', 'help', 'privacy', 'tos',
                   'search', 'hashtag', 'intent', 'compose', 'status', 'i', 'x',
                   'solana', 'bitcoin', 'ethereum', 'crypto'}
        
        usernames = set(re.findall(r'@([A-Za-z0-9_]{4,15})', text))
        return [u for u in usernames if u.lower() not in excluded]
    
    def check_supabase(self, username):
        """Check if profile exists in Supabase"""
        if not SUPABASE_KEY:
            # Fallback to local check
            return self.check_local_db(username)
        
        try:
            # Check known_scammers
            url = f"{SUPABASE_URL}/rest/v1/known_scammers?handle=eq.{username}&select=handle"
            req = urllib.request.Request(url)
            req.add_header('apikey', SUPABASE_KEY)
            req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
            
            response = urllib.request.urlopen(req, timeout=10)
            data = json.loads(response.read().decode())
            
            if data:
                return True, 'known_scammers'
            
            # Check legitimate_accounts
            url = f"{SUPABASE_URL}/rest/v1/legitimate_accounts?handle=eq.{username}&select=handle"
            req = urllib.request.Request(url)
            req.add_header('apikey', SUPABASE_KEY)
            req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
            
            response = urllib.request.urlopen(req, timeout=10)
            data = json.loads(response.read().decode())
            
            if data:
                return True, 'legitimate_accounts'
            
            return False, None
        except Exception as e:
            self.log(f"Supabase check failed for {username}: {e}", "WARN")
            return self.check_local_db(username)
    
    def check_local_db(self, username):
        """Check local CSV database"""
        csv_path = Path('/Users/efinney/.openclaw/workspace/scammer-database.csv')
        if not csv_path.exists():
            return False, None
        
        try:
            with open(csv_path, 'r') as f:
                content = f.read().lower()
                if username.lower() in content:
                    return True, 'local_db'
            return False, None
        except:
            return False, None
    
    def add_to_queue(self, username, source_search, mentioned_in=None):
        """Add profile to scan queue"""
        job_id = hashlib.md5(f"{username}_{datetime.now().isoformat()}".encode()).hexdigest()[:12]
        job_file = self.queue_dir / f"{job_id}.json"
        
        job = {
            'id': job_id,
            'username': username,
            'source': 'x_search',
            'search_term': source_search,
            'mentioned_in': mentioned_in,
            'status': 'pending',
            'created_at': datetime.now().isoformat(),
            'priority': 'normal',
            'attempts': 0,
            'max_attempts': 3
        }
        
        with open(job_file, 'w') as f:
            json.dump(job, f, indent=2)
        
        self.log(f"Queued @{username} (job: {job_id})")
        return job_id
    
    def get_pending_jobs(self, limit=5):
        """Get pending jobs from queue"""
        jobs = []
        for job_file in sorted(self.queue_dir.glob('*.json')):
            try:
                with open(job_file, 'r') as f:
                    job = json.load(f)
                if job['status'] == 'pending' and job['attempts'] < job['max_attempts']:
                    jobs.append(job)
                    if len(jobs) >= limit:
                        break
            except:
                continue
        return jobs
    
    def scan_profile(self, username):
        """Deep-dive scan of a profile"""
        self.log(f"Scanning @{username}...")
        
        # Navigate to profile
        self.ws.send(json.dumps({'id': 20, 'method': 'Page.navigate', 'params': {'url': f'https://x.com/{username}'}}))
        time.sleep(8)
        
        # Get profile content
        self.ws.send(json.dumps({'id': 21, 'method': 'Runtime.evaluate', 'params': {
            'expression': 'document.body.innerText',
            'returnByValue': True
        }}))
        result = json.loads(self.ws.recv())
        text = result.get('result', {}).get('result', {}).get('value', '')
        
        # Check for suspended
        if 'suspended' in text.lower():
            return {'status': 'suspended', 'risk_score': 10, 'level': 'SUSPENDED'}
        
        # Check for not found
        if 'not found' in text.lower() or "doesn't exist" in text.lower():
            return {'status': 'not_found', 'risk_score': 0, 'level': 'N/A'}
        
        # Calculate risk
        risk_score, level, red_flags = self.calculate_risk(text, username)
        
        return {
            'status': 'active',
            'risk_score': risk_score,
            'level': level,
            'red_flags': red_flags,
            'text_length': len(text)
        }
    
    def calculate_risk(self, text, username):
        """Calculate risk score based on profile content"""
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
        if 'send' in text_lower and 'dm' in text_lower:
            risk += 15
            red_flags.append("DM solicitation")
        
        # Check follower count (if visible)
        followers_match = re.search(r'(\d+[,.]?\d*[KkMm]?)\s*followers', text_lower)
        if followers_match:
            follower_str = followers_match.group(1)
            if 'k' in follower_str.lower():
                followers = float(follower_str.replace('k', '').replace(',', '')) * 1000
            elif 'm' in follower_str.lower():
                followers = float(follower_str.replace('m', '').replace(',', '')) * 1000000
            else:
                followers = float(follower_str.replace(',', ''))
            
            # Low followers + high claims = suspicious
            if followers < 1000 and risk > 20:
                risk += 10
                red_flags.append("Low followers + high claims")
        
        risk_score = min(risk / 90 * 10, 10)
        level = 'LOW' if risk_score < 3 else 'MEDIUM' if risk_score < 5 else 'HIGH' if risk_score < 7 else 'CRITICAL'
        
        return risk_score, level, red_flags
    
    def process_job(self, job):
        """Process a scan job"""
        job_file = self.queue_dir / f"{job['id']}.json"
        
        try:
            # Update job status
            job['status'] = 'processing'
            job['attempts'] += 1
            job['started_at'] = datetime.now().isoformat()
            with open(job_file, 'w') as f:
                json.dump(job, f, indent=2)
            
            # Scan profile
            result = self.scan_profile(job['username'])
            
            # Update job with results
            job['result'] = result
            job['status'] = 'completed'
            job['completed_at'] = datetime.now().isoformat()
            
            with open(job_file, 'w') as f:
                json.dump(job, f, indent=2)
            
            # Save report
            report_file = self.reports_dir / f"{job['username']}_{datetime.now().strftime('%Y-%m-%d')}.json"
            with open(report_file, 'w') as f:
                json.dump(job, f, indent=2)
            
            self.log(f"Completed scan of @{job['username']}: {result['level']} ({result['risk_score']:.1f}/10)")
            
            # Update Supabase if configured
            if SUPABASE_KEY and result['level'] in ['HIGH', 'CRITICAL']:
                self.update_supabase(job['username'], result)
            
            # Add to Guardian reply queue for HIGH/CRITICAL
            if result['risk_score'] >= 7.0:
                self.add_to_guardian_queue(job['username'], result)
            
            return True
        except Exception as e:
            self.log(f"Failed to process job {job['id']}: {e}", "ERROR")
            job['status'] = 'pending'
            job['error'] = str(e)
            with open(job_file, 'w') as f:
                json.dump(job, f, indent=2)
            return False
    
    def update_supabase(self, username, result):
        """Update Supabase with scan result"""
        try:
            data = {
                'handle': username,
                'platform': 'X',
                'risk_score': result['risk_score'],
                'risk_level': result['level'],
                'verification_level': 'UNVERIFIED' if result['risk_score'] < 5 else 'PARTIALLY_VERIFIED',
                'scam_type': 'Potential scam',
                'red_flags': json.dumps(result.get('red_flags', [])),
                'last_updated': datetime.now().isoformat(),
                'notes': f"Auto-detected via X search - {', '.join(result.get('red_flags', []))}"
            }
            
            url = f"{SUPABASE_URL}/rest/v1/known_scammers"
            req = urllib.request.Request(url, data=json.dumps(data).encode(), method='POST')
            req.add_header('apikey', SUPABASE_KEY)
            req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
            req.add_header('Content-Type', 'application/json')
            req.add_header('Prefer', 'return=minimal')
            
            urllib.request.urlopen(req, timeout=10)
            self.log(f"Updated Supabase: @{username}")
        except urllib.error.HTTPError as e:
            if e.code == 409:
                self.log(f"@{username} already in database", "INFO")
            else:
                self.log(f"Supabase update failed: {e}", "WARN")
        except Exception as e:
            self.log(f"Supabase update failed: {e}", "WARN")
    
    def add_to_guardian_queue(self, username, result):
        """Add high-risk profiles to Guardian reply queue"""
        # Only add for HIGH/CRITICAL risk
        if result['risk_score'] < 7.0:
            return None
        
        try:
            # Import guardian bot
            import guardian_reply_bot
            
            draft_data = {
                'username': username,
                'risk_level': result['level'],
                'risk_score': result['risk_score'],
                'red_flags': result.get('red_flags', [])
            }
            
            bot = guardian_reply_bot.GuardianReplyBot()
            draft = bot.generate_draft_reply(draft_data)
            
            if draft:
                draft_id = bot.add_to_queue(draft)
                self.log(f"Added to Guardian queue: @{username} (draft: {draft_id})")
                return draft_id
        except Exception as e:
            self.log(f"Guardian queue failed: {e}", "WARN")
        
        return None
    
    def run_cycle(self):
        """Run one scan cycle"""
        self.log("=" * 50)
        self.log("Starting scan cycle")
        
        # Connect to Chrome
        if not self.connect_chrome():
            return False
        
        try:
            # Extract phase
            all_profiles = set()
            for term in SEARCH_TERMS:
                self.log(f"Searching: '{term}'")
                self.navigate_to_search(term)
                profiles = self.extract_profiles_from_page()
                self.log(f"Found {len(profiles)} profiles")
                
                for profile in profiles:
                    if profile not in self.processed_profiles:
                        all_profiles.add((profile, term))
                
                time.sleep(2)  # Rate limiting
            
            self.log(f"Total unique profiles: {len(all_profiles)}")
            
            # Filter phase
            new_profiles = []
            for profile, term in list(all_profiles)[:MAX_PROFILES_PER_CYCLE]:
                exists, source = self.check_supabase(profile)
                if exists:
                    self.log(f"Skipping @{profile} (exists in {source})")
                else:
                    new_profiles.append((profile, term))
                    self.processed_profiles.add(profile)
            
            self.log(f"New profiles to queue: {len(new_profiles)}")
            
            # Queue phase
            for profile, term in new_profiles:
                self.add_to_queue(profile, term)
            
            # Process phase
            pending_jobs = self.get_pending_jobs(limit=5)
            self.log(f"Processing {len(pending_jobs)} pending jobs")
            
            for job in pending_jobs:
                self.process_job(job)
                time.sleep(PROFILE_SCAN_DELAY)
            
            self.log("Cycle complete")
            return True
        finally:
            self.disconnect_chrome()
    
    def run_continuous(self, interval=SCAN_INTERVAL):
        """Run continuous automation loop"""
        self.log("Starting continuous automation loop")
        self.log(f"Scan interval: {interval} seconds")
        
        while True:
            try:
                self.run_cycle()
            except KeyboardInterrupt:
                self.log("Stopping automation loop")
                break
            except Exception as e:
                self.log(f"Cycle error: {e}", "ERROR")
            
            self.log(f"Waiting {interval} seconds until next cycle...")
            time.sleep(interval)


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Scam Detection Automation Loop')
    parser.add_argument('--once', action='store_true', help='Run one cycle and exit')
    parser.add_argument('--interval', type=int, default=SCAN_INTERVAL, help='Interval between cycles (seconds)')
    args = parser.parse_args()
    
    automation = ScamAutomation()
    
    if args.once:
        automation.run_cycle()
    else:
        automation.run_continuous(interval=args.interval)


if __name__ == "__main__":
    main()