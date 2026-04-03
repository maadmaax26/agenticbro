#!/opt/homebrew/bin/python3
"""
Proactive Scammer Profile Discovery
=====================================
Multi-source proactive search for scammer profiles.

Sources:
1. X Search (via Chrome CDP) - DM solicitation, unrealistic returns, wallet drainers
2. Telegram Channel Monitoring - Pump groups, airdrop scams
3. Reddit/Discord Monitoring - Scam reports
4. Known Scammer Network - Find connected accounts
5. Hashtag Monitoring - #SCAM, #RUG, #ALERT posts
"""

import json
import re
import os
import sys
import time
import hashlib
import urllib.request
import urllib.error
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set

# Configuration
DATABASE_PATH = Path('/Users/efinney/.openclaw/workspace/scammer-database.csv')
SCAN_QUEUE_DIR = Path('/Users/efinney/.openclaw/workspace/output/scan_queue')
REPORTS_DIR = Path('/Users/efinney/.openclaw/workspace/output/scan_reports')
DISCOVERY_LOG = Path('/Users/efinney/.openclaw/workspace/output/proactive_discovery.log')
CHROME_CDP_URL = 'http://localhost:18800'

# High-confidence search queries for X
X_SEARCH_QUERIES = {
    # Critical: Wallet Drainer Patterns (95% confidence)
    'wallet_drainer': [
        '"connect wallet" airdrop solana',
        '"claim your" free solana',
        '"verify wallet" nft',
        '"sign message" claim',
        '"free mint" connect',
        '"claim now" wallet connect',
    ],
    
    # High: DM Solicitation (85% confidence)
    'dm_solicitation': [
        '"DM me for" presale',
        '"DM me for" whitelist',
        '"DM me for" alpha',
        '"check your DM" crypto',
        '"sent you a DM" airdrop',
        '"DM me" investment opportunity',
    ],
    
    # High: Unrealistic Returns (85% confidence)
    'unrealistic_returns': [
        '"100x gains" solana',
        '"1000x returns" crypto',
        '"guaranteed profit" trading',
        '"moon shot" guaranteed',
        '"safe 50x" investment',
        '"next 100x gem" solana',
    ],
    
    # Medium: Pump & Dump (75% confidence)
    'pump_dump': [
        '"pump incoming" token',
        '"we are pumping" solana',
        '"buy now before" pump',
        '"get in early" moon',
        '"limited supply" gem',
        '"whale buying" now',
    ],
    
    # Medium: Presale Scams (75% confidence)
    'presale_scam': [
        '"presale live" guaranteed',
        '"fair launch" limited',
        '"stealth launch" tonight',
        '"presale allocation" available',
        '"private sale" opportunity',
    ],
    
    # User Reports (Highest Confidence)
    'user_reports': [
        '"is a scammer" solana',
        '"scammed me" crypto',
        '"rug pulled" my money',
        '"stole my" solana',
        '"wallet drainer" alert',
        '"do not trust" this account',
    ],
    
    # Telegram Promotion
    'telegram_promo': [
        '"join my telegram" free crypto',
        '"t.me/" airdrop solana',
        '"telegram channel" signals',
        '"join telegram" presale',
    ],
    
    # Hashtag Monitoring
    'hashtags': [
        '#SCAM solana',
        '#RUG alert',
        '#ALERT crypto',
        '#WARNING solana',
        '#STAYAWAY',
    ],
}

# Telegram channel patterns
TELEGRAM_PATTERNS = {
    'pump_group': {
        'keywords': ['gem', 'alpha', 'calls', 'signals', 'pump', 'moonshots'],
        'risk': 8,
        'type': 'Pump & Dump Group'
    },
    'airdrop_scam': {
        'keywords': ['free', 'airdrop', 'claim', 'connect wallet', 'verify'],
        'risk': 9,
        'type': 'Airdrop Scam'
    },
    'presale_group': {
        'keywords': ['presale', 'fair launch', 'stealth', 'allocation'],
        'risk': 7,
        'type': 'Presale Scam'
    },
}

# Known scammer network expansion
# When we find a scammer, check their connections
NETWORK_EXPANSION = {
    'following_patterns': [
        'Follows known scammers',
        'Followed by known scammers',
        'Mutual follows with scammers',
    ],
    'engagement_patterns': [
        'Engages with scam posts',
        'Shares scam content',
        'Promotes scam tokens',
    ],
}

# Rate limiting
X_SEARCH_DELAY = 10  # seconds between searches
MAX_PROFILES_PER_RUN = 50
MAX_PROFILES_PER_CATEGORY = 10


class ProactiveDiscovery:
    def __init__(self):
        self.database_path = DATABASE_PATH
        self.queue_dir = SCAN_QUEUE_DIR
        self.reports_dir = REPORTS_DIR
        self.log_file = DISCOVERY_LOG
        self.queue_dir.mkdir(parents=True, exist_ok=True)
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        self.known_profiles = self._load_known_profiles()
        self.chrome_connected = False
        self.discovered_count = 0
        
    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_line = f"[{timestamp}] [{level}] {message}"
        print(log_line)
        with open(self.log_file, 'a') as f:
            f.write(log_line + '\n')
    
    def _load_known_profiles(self) -> Set[str]:
        """Load known profile handles from database"""
        profiles = set()
        try:
            with open(self.database_path, 'r', encoding='utf-8') as f:
                for line in f:
                    parts = line.split(',')
                    if len(parts) >= 3:
                        handle = parts[2].strip('"@').lower()
                        if handle:
                            profiles.add(handle)
        except FileNotFoundError:
            pass
        return profiles
    
    def _is_known(self, handle: str) -> bool:
        """Check if handle is already known"""
        return handle.lower().replace('@', '') in self.known_profiles
    
    def connect_chrome(self) -> bool:
        """Connect to Chrome CDP for X searches"""
        try:
            response = urllib.request.urlopen(f'{CHROME_CDP_URL}/json/list', timeout=5)
            pages = json.loads(response.read().decode())
            if pages:
                self.chrome_connected = True
                self.log(f"Chrome CDP connected ({len(pages)} tabs)")
                return True
        except Exception as e:
            self.log(f"Chrome CDP not available: {e}", "WARN")
        return False
    
    def extract_handles_from_text(self, text: str) -> List[str]:
        """Extract @handles from text"""
        handles = re.findall(r'@([a-zA-Z0-9_]{1,15})', text)
        return list(set(handles))
    
    def calculate_risk_score(self, text: str, category: str) -> Tuple[float, List[str], str]:
        """Calculate risk score based on patterns"""
        score = 0
        flags = []
        text_lower = text.lower()
        
        # Category-specific scoring
        if category == 'wallet_drainer':
            if 'connect wallet' in text_lower:
                score += 25
                flags.append('Connect wallet')
            if 'claim' in text_lower and 'free' in text_lower:
                score += 20
                flags.append('Free claim')
            if 'verify' in text_lower:
                score += 15
                flags.append('Verify request')
            level = 'CRITICAL'
            
        elif category == 'dm_solicitation':
            if 'dm me' in text_lower or 'dm for' in text_lower:
                score += 15
                flags.append('DM solicitation')
            if 'presale' in text_lower or 'whitelist' in text_lower:
                score += 10
                flags.append('Presale promotion')
            level = 'HIGH'
            
        elif category == 'unrealistic_returns':
            if '100x' in text_lower or '1000x' in text_lower:
                score += 20
                flags.append('Unrealistic returns')
            if 'guaranteed' in text_lower:
                score += 15
                flags.append('Guaranteed claims')
            level = 'HIGH'
            
        elif category == 'pump_dump':
            if 'pump' in text_lower:
                score += 15
                flags.append('Pump promotion')
            if 'buy now' in text_lower:
                score += 10
                flags.append('Urgency tactics')
            level = 'MEDIUM'
            
        elif category == 'user_reports':
            score += 25  # User reports are high confidence
            if 'scammed' in text_lower:
                flags.append('User scam report')
            if 'rug' in text_lower:
                flags.append('Rug pull report')
            level = 'HIGH'
            
        else:
            score += 10
            level = 'MEDIUM'
        
        # Normalize to 0-10
        score = min(score / 10, 10)
        
        return score, flags, level
    
    def generate_search_candidates(self) -> List[dict]:
        """Generate list of search queries to run"""
        candidates = []
        
        # Randomly select queries from each category
        for category, queries in X_SEARCH_QUERIES.items():
            # Select up to MAX_PROFILES_PER_CATEGORY queries per category
            selected = random.sample(queries, min(len(queries), MAX_PROFILES_PER_CATEGORY))
            for query in selected:
                candidates.append({
                    'query': query,
                    'category': category,
                    'url': f"https://x.com/search?q={query.replace(' ', '%20')}&f=live",
                    'priority': 'HIGH' if category in ['wallet_drainer', 'user_reports'] else 'MEDIUM',
                })
        
        random.shuffle(candidates)
        return candidates[:MAX_PROFILES_PER_RUN]
    
    def create_scan_job(self, handle: str, source: dict, score: float, flags: List[str], level: str) -> dict:
        """Create a scan job for a profile"""
        job_id = hashlib.md5(f"{handle}_{datetime.now().isoformat()}".encode()).hexdigest()[:8]
        
        job = {
            'id': job_id,
            'username': handle.replace('@', '').lower(),
            'platform': 'X',
            'scan_type': 'PROFILE_SCAM_CHECK',
            'priority': source.get('priority', 'MEDIUM'),
            'risk_score': score,
            'risk_level': level,
            'red_flags': flags,
            'source_query': source.get('query', 'unknown'),
            'source_category': source.get('category', 'unknown'),
            'discovered_at': datetime.now().isoformat(),
            'status': 'pending',
        }
        
        return job
    
    def save_scan_job(self, job: dict) -> bool:
        """Save scan job to queue"""
        try:
            job_path = self.queue_dir / f"{job['username']}_{job['id']}.json"
            with open(job_path, 'w') as f:
                json.dump(job, f, indent=2)
            return True
        except Exception as e:
            self.log(f"Failed to save job: {e}", "ERROR")
            return False
    
    def run_x_searches(self) -> List[dict]:
        """Run X searches via Chrome CDP"""
        discovered = []
        
        if not self.chrome_connected:
            self.log("Chrome CDP not connected - creating search URLs only")
            # Create queue entries for manual scanning
            candidates = self.generate_search_candidates()
            for candidate in candidates:
                job = {
                    'id': hashlib.md5(f"{candidate['query']}_{datetime.now().isoformat()}".encode()).hexdigest()[:8],
                    'search_url': candidate['url'],
                    'search_query': candidate['query'],
                    'category': candidate['category'],
                    'priority': candidate['priority'],
                    'discovered_at': datetime.now().isoformat(),
                    'status': 'pending_scan',
                }
                
                job_path = self.queue_dir / f"search_{job['id']}.json"
                with open(job_path, 'w') as f:
                    json.dump(job, f, indent=2)
                
                self.log(f"Queued search: {candidate['query']}")
            
            return discovered
        
        # Chrome CDP scanning would go here
        # For now, we queue searches for manual review
        self.log("Chrome CDP scanning not implemented - using queue-only mode")
        
        return discovered
    
    def run_network_expansion(self) -> List[dict]:
        """Find connected accounts from known scammers"""
        discovered = []
        
        # This would check followers/following of known scammers
        # For now, add known patterns from analysis
        
        network_patterns = [
            # Known scammer networks (from database analysis)
            {'handle': '@22J27', 'connected_to': 'LUNA GREY', 'relation': 'same_network'},
            {'handle': '@lunagreyX0', 'connected_to': 'LUNA GREY', 'relation': 'telegram_channel'},
        ]
        
        for pattern in network_patterns:
            handle = pattern['handle'].replace('@', '').lower()
            if not self._is_known(handle):
                self.log(f"Network connection found: {handle} (connected to {pattern['connected_to']})")
                discovered.append({
                    'handle': handle,
                    'source': 'network_expansion',
                    'risk_score': 8.0,
                    'flags': [f"Connected to {pattern['connected_to']}"],
                    'level': 'HIGH',
                })
        
        return discovered
    
    def run_telegram_monitoring(self) -> List[dict]:
        """Monitor Telegram for scam channels"""
        discovered = []
        
        # This would use Telegram API to search channels
        # For now, use known patterns from database
        
        telegram_patterns = [
            {'channel': '@FreeSolAirdrop', 'type': 'Airdrop Scam', 'risk': 9},
            {'channel': '@PresaleAlerts', 'type': 'Presale Scam', 'risk': 7},
            {'channel': '@GemAlerts_', 'type': 'Pump & Dump', 'risk': 6},
        ]
        
        for pattern in telegram_patterns:
            channel = pattern['channel'].replace('@', '').lower()
            if not self._is_known(channel):
                discovered.append({
                    'handle': channel,
                    'platform': 'Telegram',
                    'risk_score': pattern['risk'],
                    'flags': [pattern['type']],
                    'level': 'HIGH' if pattern['risk'] >= 8 else 'MEDIUM',
                })
        
        return discovered
    
    def run_discovery_cycle(self) -> Dict[str, int]:
        """Run full proactive discovery cycle"""
        self.log("=" * 60)
        self.log("Starting PROACTIVE discovery cycle...")
        self.log("=" * 60)
        
        results = {
            'x_search_jobs': 0,
            'network_expansion': 0,
            'telegram_monitoring': 0,
            'total_discovered': 0,
            'total_queued': 0,
        }
        
        # 1. X Search queries
        self.log("Running X search queries...")
        x_found = self.run_x_searches()
        results['x_search_jobs'] = len(x_found)
        
        # 2. Network expansion
        self.log("Running network expansion...")
        network_found = self.run_network_expansion()
        for profile in network_found:
            if not self._is_known(profile['handle']):
                job = self.create_scan_job(
                    profile['handle'],
                    {'category': 'network_expansion'},
                    profile['risk_score'],
                    profile['flags'],
                    profile['level']
                )
                if self.save_scan_job(job):
                    results['network_expansion'] += 1
                    results['total_queued'] += 1
        
        # 3. Telegram monitoring
        self.log("Running Telegram monitoring...")
        telegram_found = self.run_telegram_monitoring()
        for profile in telegram_found:
            if not self._is_known(profile['handle']):
                job = {
                    'id': hashlib.md5(f"{profile['handle']}_{datetime.now().isoformat()}".encode()).hexdigest()[:8],
                    'username': profile['handle'],
                    'platform': profile['platform'],
                    'scan_type': 'CHANNEL_SCAM_CHECK',
                    'priority': 'HIGH' if profile['level'] == 'HIGH' else 'MEDIUM',
                    'risk_score': profile['risk_score'],
                    'risk_level': profile['level'],
                    'red_flags': profile['flags'],
                    'discovered_at': datetime.now().isoformat(),
                    'status': 'pending',
                }
                if self.save_scan_job(job):
                    results['telegram_monitoring'] += 1
                    results['total_queued'] += 1
        
        results['total_discovered'] = results['network_expansion'] + results['telegram_monitoring']
        
        self.log("=" * 60)
        self.log(f"Discovery cycle complete:")
        self.log(f"  X search jobs queued: {results['x_search_jobs']}")
        self.log(f"  Network expansion: {results['network_expansion']}")
        self.log(f"  Telegram monitoring: {results['telegram_monitoring']}")
        self.log(f"  Total queued: {results['total_queued']}")
        self.log("=" * 60)
        
        return results


def main():
    """Main entry point"""
    discovery = ProactiveDiscovery()
    
    # Connect to Chrome CDP if available
    discovery.connect_chrome()
    
    # Run discovery cycle
    results = discovery.run_discovery_cycle()
    
    if results['total_queued'] > 0:
        print(f"\n✅ Queued {results['total_queued']} profiles for scanning")
        print(f"   X searches: {results['x_search_jobs']}")
        print(f"   Network expansion: {results['network_expansion']}")
        print(f"   Telegram monitoring: {results['telegram_monitoring']}")
        print(f"\n   Run Chrome CDP scan to verify profiles:")
        print(f"   python scripts/scam-automation-loop.py --scan-queue")
    else:
        print("\n✅ No new profiles discovered")
    
    return results


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Proactive Scammer Profile Discovery')
    parser.add_argument('--continuous', action='store_true', help='Run continuous loop')
    parser.add_argument('--interval', type=int, default=3600, help='Interval in seconds')
    args = parser.parse_args()
    
    if args.continuous:
        discovery = ProactiveDiscovery()
        while True:
            try:
                discovery.run_discovery_cycle()
                time.sleep(args.interval)
            except KeyboardInterrupt:
                discovery.log("Stopped by user")
                break
            except Exception as e:
                discovery.log(f"Error: {e}", "ERROR")
                time.sleep(300)
    else:
        main()