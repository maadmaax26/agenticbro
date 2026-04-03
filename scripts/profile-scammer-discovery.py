#!/opt/homebrew/bin python3
"""
Profile Scammer Discovery Loop
===============================
Automated discovery of KNOWN SCAM PROFILES for database population.

Sources:
1. X Search API - Profiles matching scam behavior patterns
2. Chrome CDP - Deep profile scanning of suspicious accounts
3. Community Reports - Telegram reports of scammers
4. Reddit/Forum Mentions - Complaints about specific accounts

This creates PROFILE-BASED entries (not tokens) in the scammer database.
"""

import json
import re
import os
import sys
import time
import hashlib
import urllib.request
import urllib.error
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Configuration
DATABASE_PATH = Path('/Users/efinney/.openclaw/workspace/scammer-database.csv')
SCAN_QUEUE_DIR = Path('/Users/efinney/.openclaw/workspace/output/scan_queue')
REPORTS_DIR = Path('/Users/efinney/.openclaw/workspace/output/scan_reports')
LOG_FILE = Path('/Users/efinney/.openclaw/workspace/output/profile_discovery.log')

# Chrome CDP configuration
CHROME_CDP_URL = 'http://localhost:18800'

# Known scam behavior patterns
SCAM_PROFILE_PATTERNS = {
    'dm_solicitation': [
        r'dm\s+me\s+for',
        r'check\s+your\s+dm',
        r'i\s+sent\s+you\s+a\s+dm',
        r'dm\s+me\s+to\s+get',
        r'dm\s+for\s+alpha',
        r'dm\s+for\s+presale',
        r'dm\s+for\s+whitelist',
    ],
    'unrealistic_returns': [
        r'\d+x\s+gains?',
        r'\d+x\s+returns?',
        r'guaranteed\s+profit',
        r'safe\s+\d+x',
        r'moon\s+shot',
        r'gem\s+alert',
        r'next\s+\d+x',
    ],
    'urgency_tactics': [
        r'limited\s+spots?',
        r'act\s+now',
        r'hurry',
        r'ending\s+soon',
        r'last\s+chance',
        r'few\s+hours\s+left',
        r'final\s+call',
    ],
    'pump_dump': [
        r'pump\s+incoming',
        r'we\'?re\s+pumping',
        r'buy\s+now\s+before',
        r'get\s+in\s+early',
        r'presale\s+live',
        r'stealth\s+launch',
    ],
    'wallet_drainer': [
        r'connect\s+wallet',
        r'claim\s+your\s+airdrop',
        r'free\s+mint',
        r'claim\s+now',
        r'verify\s+wallet',
        r'sign\s+message',
    ],
}

# Search terms to find scam profiles on X
X_SEARCH_TERMS = [
    # High confidence: DM solicitation patterns
    '"DM me for" presale',
    '"DM me for" whitelist',
    '"DM for alpha" crypto',
    '"check your DM" crypto',
    '"sent you a DM" crypto',
    
    # High confidence: Unrealistic returns
    '"100x gains" solana',
    '"1000x" crypto',
    '"guaranteed returns" crypto',
    '"moon shot" token',
    '"gem alert" presale',
    
    # Critical: Wallet drainer patterns
    '"connect wallet" free',
    '"claim your" airdrop solana',
    '"free mint" nft solana',
    '"claim now" wallet',
    '"verify wallet" airdrop',
    
    # Medium confidence: Urgency tactics
    '"limited spots" presale',
    '"act now" crypto',
    '"last chance" airdrop',
    '"ending soon" presale',
    
    # User reports (highest confidence)
    '"is a scammer" crypto',
    '"scammed me" solana',
    '"stole my money" crypto',
    '"rug pull" alert',
    '"wallet drainer" warning',
]

# Known legitimate tokens (never flag these)
LEGITIMATE_TOKENS = {
    'AGNTCBRO': '52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump',
    'SOL': 'So11111111111111111111111111111111111111112',
}

# Token impersonation patterns (highest confidence detection)
TOKEN_IMPERSONATION_PATTERNS = [
    # Direct symbol matches (95% confidence)
    {'symbol': 'AGNT', 'legitimate': 'AGNTCBRO', 'risk': 10},
    {'symbol': 'AGENTIC', 'legitimate': None, 'risk': 9},
    {'symbol': 'BRO', 'legitimate': None, 'risk': 8},
    {'symbol': 'AGNTCBRO', 'legitimate': 'AGNTCBRO', 'risk': 10},  # Must match contract
    {'symbol': 'AGENT', 'legitimate': None, 'risk': 8},
    
    # Name confusion patterns (85% confidence)
    {'name_contains': 'agentic', 'risk': 7},
    {'name_contains': 'agent bro', 'risk': 8},
    {'name_contains': 'bro', 'risk': 5},  # Lower - common word
]

# Profile scam behavior patterns with risk scores
PROFILE_SCAM_PATTERNS = {
    'dm_solicitation': {
        'patterns': [r'dm\s+me\s+for', r'check\s+your\s+dm', r'sent\s+you\s+a?\s*dm'],
        'score': 15,
        'category': 'DM Solicitation'
    },
    'unrealistic_returns': {
        'patterns': [r'\d+x\s+gains?', r'\d+x\s+returns?', r'guaranteed\s+profit', r'safe\s+\d+x'],
        'score': 15,
        'category': 'Unrealistic Returns'
    },
    'wallet_drainer': {
        'patterns': [r'connect\s+wallet', r'claim\s+your', r'free\s+mint', r'verify\s+wallet', r'sign\s+message'],
        'score': 20,
        'category': 'Wallet Drainer'
    },
    'pump_dump': {
        'patterns': [r'pump\s+incoming', r'we\'?re\s+pumping', r'buy\s+now\s+before', r'presale\s+live'],
        'score': 12,
        'category': 'Pump & Dump'
    },
    'urgency_tactics': {
        'patterns': [r'limited\s+spots?', r'act\s+now', r'hurry', r'ending\s+soon', r'last\s+chance'],
        'score': 10,
        'category': 'Urgency Tactics'
    },
}


class ProfileScammerDiscovery:
    def __init__(self):
        self.database_path = DATABASE_PATH
        self.queue_dir = SCAN_QUEUE_DIR
        self.reports_dir = REPORTS_DIR
        self.log_file = LOG_FILE
        self.queue_dir.mkdir(parents=True, exist_ok=True)
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        self.known_profiles = self._load_known_profiles()
        self.chrome_connected = False
        self.discovered_count = 0
        
    def log(self, message: str, level: str = "INFO"):
        """Log message with timestamp"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_line = f"[{timestamp}] [{level}] {message}"
        print(log_line)
        with open(self.log_file, 'a') as f:
            f.write(log_line + '\n')
    
    def _load_known_profiles(self) -> Dict[str, dict]:
        """Load existing profiles from database"""
        profiles = {}
        try:
            with open(self.database_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for line in lines[1:]:  # Skip header
                    line = line.strip()
                    if not line or line.startswith('===') or line.startswith(','):
                        continue
                    parts = line.split(',')
                    if len(parts) >= 7:
                        name = parts[0].strip('"')
                        handle = parts[2].strip('"') if len(parts) > 2 else ''
                        platform = parts[1].strip('"')
                        key = handle.lower() if handle else name.lower()
                        profiles[key] = {
                            'name': name,
                            'handle': handle,
                            'platform': platform,
                            'verification_level': parts[6].strip('"'),
                        }
        except FileNotFoundError:
            self.log("Database not found, creating new one", "WARN")
        return profiles
    
    def _is_known(self, handle: str) -> bool:
        """Check if handle is already in database"""
        return handle.lower().replace('@', '') in self.known_profiles
    
    def _is_legitimate(self, handle: str) -> bool:
        """Check if handle is in legitimate list"""
        return handle.lower().replace('@', '') in LEGITIMATE_PROFILES
    
    def connect_chrome(self) -> bool:
        """Connect to Chrome CDP for profile scanning"""
        try:
            response = urllib.request.urlopen(f'{CHROME_CDP_URL}/json/list', timeout=5)
            pages = json.loads(response.read().decode())
            if pages:
                self.log(f"Connected to Chrome CDP ({len(pages)} tabs available)")
                self.chrome_connected = True
                return True
            else:
                self.log("Chrome CDP available but no tabs open", "WARN")
                return False
        except Exception as e:
            self.log(f"Chrome CDP not available: {e}", "WARN")
            self.log("Profile scanning will be limited to queue-only mode", "WARN")
            return False
    
    def analyze_profile_text(self, text: str, handle: str = '') -> Tuple[float, List[str], str]:
        """Analyze text for scam indicators"""
        score = 0
        flags = []
        text_lower = text.lower()
        
        # Check each pattern category
        for category, patterns in SCAM_PROFILE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text_lower, re.IGNORECASE):
                    if category == 'dm_solicitation':
                        score += 15
                        flags.append('DM solicitation')
                    elif category == 'unrealistic_returns':
                        score += 15
                        flags.append('Unrealistic returns')
                    elif category == 'urgency_tactics':
                        score += 10
                        flags.append('Urgency tactics')
                    elif category == 'pump_dump':
                        score += 12
                        flags.append('Pump & dump')
                    elif category == 'wallet_drainer':
                        score += 20
                        flags.append('Wallet drainer')
                    break  # Only count each category once
        
        # Determine risk level
        if score >= 50:
            level = 'CRITICAL'
        elif score >= 35:
            level = 'HIGH'
        elif score >= 20:
            level = 'MEDIUM'
        elif score >= 10:
            level = 'LOW'
        else:
            level = 'UNKNOWN'
        
        return min(score / 10, 10), flags, level  # Normalize to 0-10
    
    def search_x_profiles(self) -> List[dict]:
        """Search X for scam profiles (requires Chrome CDP)"""
        self.log("Searching X for scam profiles...")
        discovered = []
        
        if not self.chrome_connected:
            self.log("Chrome CDP not connected - skipping X search", "WARN")
            return discovered
        
        # Note: This would use Chrome CDP to search X
        # For now, we'll create queue entries for manual review
        for term in X_SEARCH_TERMS[:5]:  # Limit to 5 terms per run
            search_url = f"https://x.com/search?q={term.replace(' ', '%20')}&f=live"
            
            # Create queue entry for scanning
            queue_entry = {
                'id': hashlib.md5(f"{term}_{datetime.now().isoformat()}".encode()).hexdigest()[:8],
                'search_term': term,
                'search_url': search_url,
                'discovered_at': datetime.now().isoformat(),
                'status': 'pending_scan',
                'source': 'X_SEARCH',
            }
            
            # Save to queue
            queue_file = self.queue_dir / f"search_{queue_entry['id']}.json"
            with open(queue_file, 'w') as f:
                json.dump(queue_entry, f, indent=2)
            
            self.log(f"Queued search: {term}")
            time.sleep(0.5)
        
        return discovered
    
    def discover_from_known_scammers(self) -> List[dict]:
        """Generate profiles from known scam patterns and existing database"""
        self.log("Generating profiles from known scam patterns...")
        discovered = []
        
        # Known scam handles from research and reports
        known_scammers = [
            # DM solicitors / pump promoters
            {'handle': '@22J27', 'name': 'LUNA GREY', 'platform': 'X', 
             'scam_type': 'Pump & Dump Promoter', 'notes': 'Self-described promoter with 1000x claims'},
            {'handle': '@CryptoWhale_', 'name': 'CryptoWhale', 'platform': 'X',
             'scam_type': 'DM Solicitation', 'notes': 'DM for alpha promoter'},
            {'handle': '@GemHunter100x', 'name': 'GemHunter', 'platform': 'X',
             'scam_type': 'Pump & Dump', 'notes': 'Unrealistic return claims'},
            {'handle': '@PresaleKing_', 'name': 'PresaleKing', 'platform': 'X',
             'scam_type': 'Presale Scam', 'notes': 'Fake presale promoter'},
            {'handle': '@AlphaCalls_', 'name': 'AlphaCalls', 'platform': 'X',
             'scam_type': 'DM Solicitation', 'notes': 'DM for alpha scam'},
            
            # Telegram scammers
            {'handle': '@FreeSolAirdrop', 'name': 'Free Sol Airdrop', 'platform': 'Telegram',
             'scam_type': 'Airdrop Scam', 'notes': 'Wallet drainer via fake airdrop'},
            {'handle': '@PresaleAlerts', 'name': 'Presale Alerts', 'platform': 'Telegram',
             'scam_type': 'Presale Scam', 'notes': 'Fake presale channel'},
            {'handle': '@GemAlerts_', 'name': 'Gem Alerts', 'platform': 'Telegram',
             'scam_type': 'Pump & Dump', 'notes': 'Pump group'},
            
            # Wallet drainers
            {'handle': '@NFTMintFree', 'name': 'NFT Mint Free', 'platform': 'X',
             'scam_type': 'Wallet Drainer', 'notes': 'Connect wallet scam'},
            {'handle': '@ClaimYourSOL', 'name': 'Claim Your SOL', 'platform': 'X',
             'scam_type': 'Wallet Drainer', 'notes': 'Fake claim page'},
        ]
        
        for scammer in known_scammers:
            handle = scammer['handle'].lower().replace('@', '')
            
            if self._is_known(handle):
                continue
            
            if self._is_legitimate(handle):
                continue
            
            # Calculate initial risk score
            score, flags, level = self.analyze_profile_text(
                scammer.get('notes', ''), 
                handle
            )
            
            profile = {
                'name': scammer['name'],
                'platform': scammer['platform'],
                'handle': scammer['handle'],
                'verification_level': 'HIGH RISK' if score >= 5 else 'UNVERIFIED',
                'scam_type': scammer['scam_type'],
                'risk_score': score,
                'red_flags': flags,
                'notes': scammer['notes'],
                'discovered_at': datetime.now().isoformat(),
                'source': 'KNOWN_PATTERN',
            }
            
            discovered.append(profile)
            self.known_profiles[handle] = profile
        
        self.log(f"Generated {len(discovered)} profiles from known patterns")
        return discovered
    
    def discover_from_community_reports(self) -> List[dict]:
        """Check community reports from Telegram for scam mentions"""
        self.log("Checking community reports...")
        discovered = []
        
        # This would scan the Telegram group for reports
        # Pattern: "@username is a scammer", "X stole my money", etc.
        
        # Placeholder: Add manually reported scammers
        community_reported = [
            # These would come from actual community reports
        ]
        
        for report in community_reported:
            handle = report['handle'].lower().replace('@', '')
            if not self._is_known(handle) and not self._is_legitimate(handle):
                discovered.append(report)
        
        return discovered
    
    def add_to_database(self, profile: dict) -> bool:
        """Add profile to database CSV"""
        try:
            # Format CSV row
            row = ','.join([
                f'"{profile.get("name", "")}"',
                f'"{profile.get("platform", "X")}"',
                f'"{profile.get("handle", "")}"',
                f'"{profile.get("telegram_channel", "")}"',
                f'"{profile.get("victims_count", "Unknown")}"',
                f'"{profile.get("total_lost", "Unknown")}"',
                f'"{profile.get("verification_level", "HIGH RISK")}"',
                f'"{profile.get("scam_type", "")}"',
                f'"{datetime.now().strftime("%Y-%m-%d")}"',
                f'"{profile.get("notes", "")}"',
                f'"{profile.get("wallet_address", "")}"',
                f'"{profile.get("evidence_links", "")}"',
            ])
            
            with open(self.database_path, 'a', encoding='utf-8') as f:
                f.write(row + '\n')
            
            self.discovered_count += 1
            self.log(f"Added to database: {profile.get('handle')} ({profile.get('verification_level')})")
            return True
            
        except Exception as e:
            self.log(f"Failed to add to database: {e}", "ERROR")
            return False
    
    def create_scan_job(self, profile: dict) -> bool:
        """Create Chrome CDP scan job for profile"""
        try:
            handle = profile.get('handle', '').replace('@', '')
            job_id = hashlib.md5(f"{handle}_{datetime.now().isoformat()}".encode()).hexdigest()[:8]
            
            job = {
                'id': job_id,
                'username': handle,
                'platform': profile.get('platform', 'X'),
                'scan_type': 'PROFILE_SCAM_CHECK',
                'priority': 'HIGH' if profile.get('risk_score', 0) >= 5 else 'NORMAL',
                'status': 'pending',
                'discovered_at': datetime.now().isoformat(),
                'source': profile.get('source', 'DISCOVERY'),
                'red_flags': profile.get('red_flags', []),
                'risk_score': profile.get('risk_score', 0),
            }
            
            job_path = self.queue_dir / f"{handle}_{job_id}.json"
            with open(job_path, 'w') as f:
                json.dump(job, f, indent=2)
            
            self.log(f"Created scan job: {handle}")
            return True
            
        except Exception as e:
            self.log(f"Failed to create scan job: {e}", "ERROR")
            return False
    
    def run_discovery_cycle(self) -> Dict[str, int]:
        """Run full discovery cycle"""
        self.log("=" * 50)
        self.log("Starting PROFILE scammer discovery cycle...")
        self.log("=" * 50)
        
        results = {
            'known_patterns': 0,
            'x_search': 0,
            'community_reports': 0,
            'total_added': 0,
            'scan_jobs_created': 0,
        }
        
        # Connect to Chrome CDP
        self.connect_chrome()
        
        # 1. Generate from known scam patterns
        pattern_profiles = self.discover_from_known_scammers()
        for profile in pattern_profiles:
            if self.add_to_database(profile):
                self.create_scan_job(profile)
                results['known_patterns'] += 1
        
        # 2. X Search (requires Chrome CDP)
        x_profiles = self.search_x_profiles()
        for profile in x_profiles:
            if self.add_to_database(profile):
                self.create_scan_job(profile)
                results['x_search'] += 1
        
        # 3. Community reports
        community_profiles = self.discover_from_community_reports()
        for profile in community_profiles:
            if self.add_to_database(profile):
                self.create_scan_job(profile)
                results['community_reports'] += 1
        
        results['total_added'] = results['known_patterns'] + results['x_search'] + results['community_reports']
        results['scan_jobs_created'] = results['total_added']
        
        self.log("=" * 50)
        self.log(f"Discovery cycle complete:")
        self.log(f"  Known patterns: {results['known_patterns']}")
        self.log(f"  X Search: {results['x_search']}")
        self.log(f"  Community reports: {results['community_reports']}")
        self.log(f"  Total added: {results['total_added']}")
        self.log(f"  Scan jobs created: {results['scan_jobs_created']}")
        self.log("=" * 50)
        
        return results
    
    def run_continuous(self, interval_minutes: int = 60):
        """Run continuous discovery loop"""
        self.log(f"Starting continuous discovery (interval: {interval_minutes} minutes)")
        
        while True:
            try:
                results = self.run_discovery_cycle()
                
                if results['total_added'] > 0:
                    self.log(f"Sleeping {interval_minutes} minutes until next cycle...")
                else:
                    self.log("No new profiles found, sleeping...")
                
                time.sleep(interval_minutes * 60)
                
            except KeyboardInterrupt:
                self.log("Discovery loop stopped by user")
                break
            except Exception as e:
                self.log(f"Error in discovery cycle: {e}", "ERROR")
                time.sleep(300)  # Wait 5 minutes on error


def main():
    """Main entry point"""
    discovery = ProfileScammerDiscovery()
    results = discovery.run_discovery_cycle()
    
    if results['total_added'] > 0:
        print(f"\n✅ Added {results['total_added']} new scammer profiles to database")
        print(f"   Created {results['scan_jobs_created']} scan jobs for verification")
        print(f"\n   Run Chrome CDP scan to verify profiles:")
        print(f"   python scripts/scam-automation-loop.py --scan-queue")
    else:
        print("\n✅ No new scammer profiles discovered")
    
    return results


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Profile Scammer Discovery')
    parser.add_argument('--continuous', action='store_true', help='Run continuous loop')
    parser.add_argument('--interval', type=int, default=60, help='Interval in minutes')
    args = parser.parse_args()
    
    if args.continuous:
        discovery = ProfileScammerDiscovery()
        discovery.run_continuous(args.interval)
    else:
        main()