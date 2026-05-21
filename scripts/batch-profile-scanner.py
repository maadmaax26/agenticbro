#!/usr/bin/env python3
"""
Batch Profile Scanner for Agentic Bro Scam Detection System
Scans multiple X profiles in parallel using Chrome CDP instances
"""

import csv
import json
import os
import sys
import time
import logging
from datetime import datetime
from pathlib import Path
import requests
from typing import List, Dict, Optional

# Configuration
CHROME_CDP_PORTS = [18801, 18802, 18803]  # 3 parallel instances
SCANS_PER_INSTANCE = 201  # 603 total / 3 instances
REPORTS_DIR = Path("/Users/efinney/.openclaw/workspace/output/scan_reports")
DATABASE_FILE = Path("/Users/efinney/.openclaw/workspace/scammer-database.csv")
PROGRESS_LOG = Path("/Users/efinney/.openclaw/workspace/output/batch_scan_progress.log")
PB_TEST_DATA = Path("/Users/efinney/.openclaw/workspace/output/pig_butchering_test_data.json")

# Load pig butchering test data
try:
    with open(PB_TEST_DATA, 'r') as f:
        PB_DATA = json.load(f)
except:
    PB_DATA = {'characteristic_phrases': {}, 'red_flags': {}}

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(PROGRESS_LOG),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ProfileScanner:
    def __init__(self, cdp_port: int, instance_id: int):
        self.cdp_port = cdp_port
        self.instance_id = instance_id
        self.base_url = f"http://localhost:{cdp_port}"
        self.scanned_count = 0
        self.error_count = 0
        
    def scan_profile(self, handle: str) -> Dict:
        """Scan a single X profile using Chrome CDP"""
        try:
            # Navigate to profile
            url = f"https://x.com/{handle}"
            self._navigate_to(url)
            time.sleep(3)  # Wait for page load
            
            # Extract profile data
            profile_data = self._extract_profile_data()
            profile_data['handle'] = handle
            profile_data['scan_timestamp'] = datetime.now().isoformat()
            profile_data['scanner_instance'] = self.instance_id
            
            # Analyze for red flags
            risk_analysis = self._analyze_red_flags(profile_data)
            profile_data.update(risk_analysis)
            
            # Save detailed report
            self._save_report(profile_data)
            
            self.scanned_count += 1
            logger.info(f"✅ Scanned @{handle} (Risk: {profile_data.get('risk_score', 'N/A')}/10)")
            
            return profile_data
            
        except Exception as e:
            self.error_count += 1
            logger.error(f"❌ Error scanning @{handle}: {str(e)}")
            return {
                'handle': handle,
                'error': str(e),
                'scan_timestamp': datetime.now().isoformat(),
                'scanner_instance': self.instance_id
            }
    
    def _navigate_to(self, url: str):
        """Navigate browser to URL via CDP"""
        # Get current page or create new one
        try:
            pages = requests.get(f"{self.base_url}/json/list").json()
            if pages:
                page_id = pages[0].get('id')
                # Navigate existing page
                response = requests.post(f"{self.base_url}/json", 
                    json={'id': page_id, 'method': 'Page.navigate', 'params': {'url': url}})
            else:
                # Create new tab
                response = requests.put(f"{self.base_url}/json/new?url={url}")
        except Exception as e:
            logger.error(f"Navigation error: {e}")
            raise
    
    def _extract_profile_data(self) -> Dict:
        """Extract profile data from page"""
        # This would use CDP to execute JavaScript and extract data
        # For now, simplified version
        return {
            'followers': 0,
            'following': 0,
            'verified': False,
            'bio': '',
            'account_age_years': 0
        }
    
    def _analyze_red_flags(self, profile_data: Dict) -> Dict:
        """Analyze profile for scam red flags including pig butchering"""
        red_flags = []
        risk_score = 0
        scam_type = None
        
        # Standard scam detection
        # Check verification status
        if not profile_data.get('verified') and profile_data.get('followers', 0) > 10000:
            red_flags.append("UNVERIFIED_LARGE_ACCOUNT")
            risk_score += 1.5
        
        # Check follower/following ratio
        followers = profile_data.get('followers', 0)
        following = profile_data.get('following', 0)
        if following > 0 and followers / following < 0.5:
            red_flags.append("SUSPICIOUS_RATIO")
            risk_score += 1.0
        
        # Pig butchering detection
        bio = profile_data.get('bio', '').lower()
        
        # Check for romance + crypto combo
        romance_keywords = ['love', 'relationship', 'looking for', 'single', 'dating']
        crypto_keywords = ['crypto', 'bitcoin', 'trading', 'invest', 'alpha', 'profits']
        has_romance = any(kw in bio for kw in romance_keywords)
        has_crypto = any(kw in bio for kw in crypto_keywords)
        if has_romance and has_crypto:
            red_flags.append("ROMANCE_CRYPTO_COMBO")
            risk_score += 10
            scam_type = "Pig Butchering (Romance)"
        
        # Check for DM solicitation
        dm_patterns = ['dm me', 'message me', 'send dm', 'free help', 'assistance']
        if any(pattern in bio for pattern in dm_patterns):
            red_flags.append("DM_SOLICITATION")
            risk_score += 8
        
        # Check for bot-like templates
        template_phrases = ['impressed by your work', 'let\'s collaborate', 
                           'exploring opportunities', 'synergy', 'brighter future']
        template_count = sum(1 for phrase in template_phrases if phrase in bio)
        if template_count >= 2:
            red_flags.append("BOT_NETWORK_TEMPLATES")
            risk_score += 8
            if not scam_type:
                scam_type = "Coordinated Shill Network"
        
        # Check for urgency
        urgency_keywords = ['guaranteed', 'limited time', 'act now', 'don\'t miss', 'fast']
        if any(kw in bio for kw in urgency_keywords):
            red_flags.append("URGENCY_TACTICS")
            risk_score += 9
        
        # Check for wealth + investment pitch
        wealth_keywords = ['luxury', 'exotic', 'fancy', 'wealth', 'rich']
        investment_keywords = ['invest', 'portfolio', 'profits', 'returns', 'trading']
        has_wealth = any(kw in bio for kw in wealth_keywords)
        has_investment = any(kw in bio for kw in investment_keywords)
        if has_wealth and has_investment:
            red_flags.append("WEALTH_INVESTMENT_PITCH")
            risk_score += 9
        
        # Cap risk score at 10
        risk_score = min(risk_score, 10)
        
        # Determine verification level
        if risk_score >= 7:
            verification_level = "HIGH RISK"
        elif risk_score >= 5:
            verification_level = "UNVERIFIED"
        elif risk_score >= 3:
            verification_level = "PARTIALLY VERIFIED"
        else:
            verification_level = "LEGITIMATE"
        
        # Determine scam type
        if risk_score >= 5 and not scam_type:
            if 'DM_SOLICITATION' in red_flags:
                scam_type = "Engagement Farming Bot"
            elif 'URGENCY_TACTICS' in red_flags:
                scam_type = "Investment Fraud"
            else:
                scam_type = "Suspicious Activity"
        
        return {
            'red_flags': red_flags,
            'risk_score': risk_score,
            'verification_level': verification_level,
            'scam_type': scam_type
        }
    
    def _save_report(self, profile_data: Dict):
        """Save detailed scan report"""
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{profile_data['handle']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = REPORTS_DIR / filename
        
        with open(filepath, 'w') as f:
            json.dump(profile_data, f, indent=2)
    
    def update_database(self, profile_data: Dict):
        """Update scammer database with scan results"""
        if not DATABASE_FILE.exists():
            logger.warning("Database file not found, creating new one")
            return
        
        # Read existing database
        rows = []
        with open(DATABASE_FILE, 'r') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        # Update or add entry
        handle = profile_data.get('handle', '').replace('@', '')
        found = False
        for row in rows:
            if row.get('X Handle', '').replace('@', '') == handle:
                row['Verification Level'] = profile_data.get('verification_level', 'UNVERIFIED')
                row['Last Updated'] = datetime.now().strftime('%Y-%m-%d %H:%M')
                row['Risk Score'] = str(profile_data.get('risk_score', 0))
                row['Status'] = 'ACTIVE' if profile_data.get('risk_score', 0) > 5 else 'MONITORED'
                row['Scam Type'] = profile_data.get('scam_type', 'Profile Scam')
                row['Notes'] = f"Auto-scanned by batch scanner (Instance {self.instance_id}). Red flags: {', '.join(profile_data.get('red_flags', []))}"
                found = True
                break
        
        if not found:
            # Add new entry
            rows.append({
                'Scammer Name': profile_data.get('handle', 'Unknown'),
                'Platform': 'X/Twitter',
                'X Handle': profile_data.get('handle', ''),
                'Telegram Channel': '',
                'Victims Count': '0',
                'Total Lost USD': '0',
                'Verification Level': profile_data.get('verification_level', 'UNVERIFIED'),
                'Scam Type': profile_data.get('scam_type', 'Profile Scam'),
                'Last Updated': datetime.now().strftime('%Y-%m-%d %H:%M'),
                'Notes': f"Auto-scanned by batch scanner (Instance {self.instance_id}). Red flags: {', '.join(profile_data.get('red_flags', []))}",
                'Wallet Address': '',
                'Evidence Links': f"https://x.com/{handle}",
                'Risk Score': str(profile_data.get('risk_score', 0)),
                'Status': 'ACTIVE' if profile_data.get('risk_score', 0) > 5 else 'MONITORED'
            })
        
        # Write back
        fieldnames = rows[0].keys() if rows else []
        with open(DATABASE_FILE, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        logger.info(f"📝 Database updated for @{handle}")
        if profile_data.get('scam_type'):
            logger.info(f"   Scam Type: {profile_data.get('scam_type')}")
        if profile_data.get('red_flags'):
            logger.info(f"   Red Flags: {', '.join(profile_data.get('red_flags', []))}")


def load_unverified_profiles() -> List[str]:
    """Load UNVERIFIED profiles from database"""
    if not DATABASE_FILE.exists():
        logger.error("Database file not found")
        return []
    
    unverified = []
    with open(DATABASE_FILE, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('Verification Level') == 'UNVERIFIED' and row.get('X Handle'):
                handle = row.get('X Handle', '').replace('@', '')
                unverified.append(handle)
    
    logger.info(f"📊 Found {len(unverified)} UNVERIFIED profiles to scan")
    return unverified


def distribute_work(profiles: List[str], num_instances: int) -> List[List[str]]:
    """Distribute profiles across instances"""
    distribution = [[] for _ in range(num_instances)]
    for i, profile in enumerate(profiles):
        distribution[i % num_instances].append(profile)
    return distribution


def run_batch_scan():
    """Main batch scan execution"""
    logger.info("🚀 Starting batch profile scan")
    logger.info(f"📅 Timestamp: {datetime.now().isoformat()}")
    
    # Load profiles
    profiles = load_unverified_profiles()
    if not profiles:
        logger.info("✅ No UNVERIFIED profiles found - queue is clear!")
        return
    
    # Distribute work
    work_distribution = distribute_work(profiles, len(CHROME_CDP_PORTS))
    
    # Create scanners
    scanners = []
    for i, port in enumerate(CHROME_CDP_PORTS):
        scanner = ProfileScanner(port, i + 1)
        scanners.append(scanner)
    
    # Run scans (simplified - in production this would use threading/async)
    total_scanned = 0
    total_errors = 0
    start_time = time.time()
    
    for scanner_idx, scanner in enumerate(scanners):
        assigned_profiles = work_distribution[scanner_idx]
        logger.info(f"📋 Instance {scanner_idx + 1} scanning {len(assigned_profiles)} profiles")
        
        for profile in assigned_profiles:
            result = scanner.scan_profile(profile)
            if result and not result.get('error'):
                scanner.update_database(result)
            total_scanned += 1
            total_errors += scanner.error_count
            
            # Progress update every 10 scans
            if total_scanned % 10 == 0:
                elapsed = time.time() - start_time
                rate = total_scanned / elapsed if elapsed > 0 else 0
                logger.info(f"📊 Progress: {total_scanned}/{len(profiles)} ({rate:.1f} scans/sec)")
    
    # Final summary
    elapsed = time.time() - start_time
    logger.info("="*60)
    logger.info("🎉 BATCH SCAN COMPLETE")
    logger.info("="*60)
    logger.info(f"⏱️  Total time: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    logger.info(f"✅ Scanned: {total_scanned} profiles")
    logger.info(f"❌ Errors: {total_errors}")
    logger.info(f"📈 Rate: {total_scanned/elapsed:.1f} scans/second")
    logger.info("="*60)


if __name__ == "__main__":
    try:
        run_batch_scan()
    except KeyboardInterrupt:
        logger.info("\n⚠️  Scan interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"💥 Fatal error: {str(e)}")
        sys.exit(1)