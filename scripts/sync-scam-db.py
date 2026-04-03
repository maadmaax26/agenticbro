#!/opt/homebrew/bin/python3
"""
Sync Scam Database to Supabase (Python version for LaunchAgent)
Run via LaunchAgent hourly to keep website database in sync
"""

import json
import csv
import os
import sys
import urllib.parse
from datetime import datetime
from pathlib import Path
import urllib.request
import urllib.error

# Configuration from environment
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://drvasofyghnxfxvkkwad.supabase.co')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
CSV_PATH = Path('/Users/efinney/.openclaw/workspace/scammer-database.csv')

def log(message):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}")

def supabase_request(table, method='GET', body=None, query=None):
    """Make request to Supabase REST API"""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if query:
        url += '?' + '&'.join(f"{k}={v}" for k, v in query.items())
    
    headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json',
    }
    
    if method in ['POST', 'PATCH']:
        headers['Prefer'] = 'return=representation,resolution=merge-duplicates'
    
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode('utf-8') if body else None,
        headers=headers,
        method=method
    )
    
    try:
        response = urllib.request.urlopen(req, timeout=30)
        return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        log(f"API error: {e}")
        return None

def normalize_platform(platform):
    """Normalize platform name"""
    mapping = {
        'X': 'twitter', 'Twitter': 'twitter',
        'Telegram': 'telegram',
        'Solana Token': 'solana',
        'Base Token': 'base',
        'BSC Token': 'bsc',
    }
    return mapping.get(platform, platform.lower())

def map_scam_type(scam_type):
    """Map scam type to database enum"""
    mapping = {
        'AMA/Giveaway Fraud': 'giveaway_fraud',
        'Token Confusion Scam': 'rug_pull',
        'Rug Pull': 'rug_pull',
        'Wallet Drainer': 'wallet_drainer',
        'Pig Butchering': 'pig_butchering',
        'Phishing': 'phishing',
        'Impersonation': 'impersonation',
        'Investment Fraud': 'investment_fraud',
        'Pump & Dump Promoter': 'pump_and_dump',
    }
    return mapping.get(scam_type, 'other')

def get_threat_level(risk_score):
    """Get threat level from risk score"""
    if risk_score <= 30: return 'LOW'
    if risk_score <= 50: return 'MEDIUM'
    if risk_score <= 70: return 'HIGH'
    return 'CRITICAL'

def parse_csv():
    """Parse CSV file and return records"""
    records = []
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('Scammer Name', '')
            if name and not name.startswith('===') and name.strip():
                records.append(row)
    return records

def map_to_db_record(csv_record):
    """Map CSV record to database record"""
    platform = normalize_platform(csv_record.get('Platform', ''))
    verification_level = csv_record.get('Verification Level', 'Unverified')
    
    x_handle = csv_record.get('X Handle', '').strip()
    telegram_handle = csv_record.get('Telegram Channel', '').replace('@', '').replace('t.me/', '').strip()
    display_name = csv_record.get('Scammer Name', '')
    
    username = x_handle.replace('@', '') or telegram_handle or display_name.lower().replace(' ', '_')
    scam_type = map_scam_type(csv_record.get('Scam Type', ''))
    victims_str = csv_record.get('Victims Count', '0') or '0'
    try:
        victims_count = int(victims_str) if victims_str != 'Unknown' else 0
    except ValueError:
        victims_count = 0
    total_lost_usd = csv_record.get('Total Lost USD', '$0')
    
    evidence_links = [link.strip() for link in (csv_record.get('Evidence Links', '') or '').split(',') if link.strip()]
    
    # Calculate risk score
    score_map = {
        'UNVERIFIED': 50, 'PARTIALLY VERIFIED': 70, 'VERIFIED': 90,
        'HIGH RISK': 100, 'LEGITIMATE': 5, 'PAID PROMOTER': 25, 'RESOLVED': 10,
    }
    risk_score = score_map.get(verification_level.upper(), 50)
    
    verification_map = {
        'UNVERIFIED': 'Unverified', 'PARTIALLY VERIFIED': 'Partially Verified',
        'VERIFIED': 'Verified', 'HIGH RISK': 'High Risk',
        'LEGITIMATE': 'Legitimate', 'PAID PROMOTER': 'Paid Promoter', 'RESOLVED': 'Resolved',
    }
    mapped_verification = verification_map.get(verification_level.upper(), verification_level)
    
    threat_level = get_threat_level(risk_score)
    
    notes = csv_record.get('Notes', '')
    
    return {
        'platform': platform,
        'username': username,
        'display_name': display_name,
        'x_handle': x_handle or None,
        'telegram_channel': telegram_handle or None,
        'scam_type': scam_type,
        'victim_count': victims_count,
        'total_lost_usd': total_lost_usd,
        'verification_level': mapped_verification,
        'threat_level': threat_level,
        'status': 'active',
        'risk_score': risk_score,
        'notes': notes,
        'wallet_address': csv_record.get('Wallet Address'),
        'evidence_urls': evidence_links if evidence_links else None,
        'last_seen': datetime.now().isoformat(),
        'first_reported': datetime.now().isoformat(),
    }

def sync():
    """Sync CSV to Supabase"""
    log("Starting scam database sync...")
    log(f"Supabase URL: {SUPABASE_URL}")
    log(f"Service Key: {'configured' if SUPABASE_SERVICE_ROLE_KEY else 'MISSING'}")
    
    if not SUPABASE_SERVICE_ROLE_KEY:
        log("ERROR: SUPABASE_SERVICE_ROLE_KEY not configured")
        return 1
    
    csv_records = parse_csv()
    log(f"Processing {len(csv_records)} records from CSV")
    
    added = 0
    updated = 0
    unchanged = 0
    errors = 0
    
    for csv_record in csv_records:
        try:
            db_record = map_to_db_record(csv_record)
            
            if not db_record['username']:
                log(f"Skipping record with no username: {csv_record.get('Scammer Name')}")
                continue
            
            # Check if exists
            encoded_username = urllib.parse.quote(db_record['username'])
            existing = supabase_request('known_scammers', 'GET', query={
                'username': f"eq.{encoded_username}",
                'platform': f"eq.{db_record['platform']}",
                'limit': '1'
            })
            
            if not existing or len(existing) == 0:
                # Insert
                result = supabase_request('known_scammers', 'POST', body=db_record)
                if result:
                    added += 1
                    log(f"Added: {db_record['username']} ({db_record['verification_level']})")
                else:
                    errors += 1
            else:
                # Update if changed
                existing_record = existing[0]
                if (existing_record.get('verification_level') != db_record['verification_level'] or
                    existing_record.get('risk_score') != db_record['risk_score'] or
                    existing_record.get('notes') != db_record['notes']):
                    
                    result = supabase_request('known_scammers', 'PATCH', body=db_record, query={
                        'id': f"eq.{existing_record['id']}"
                    })
                    if result:
                        updated += 1
                        log(f"Updated: {db_record['username']}")
                    else:
                        errors += 1
                else:
                    unchanged += 1
                    
        except Exception as e:
            errors += 1
            log(f"Error processing {csv_record.get('Scammer Name')}: {e}")
    
    log("=" * 50)
    log(f"Sync complete:")
    log(f"  Added: {added}")
    log(f"  Updated: {updated}")
    log(f"  Unchanged: {unchanged}")
    log(f"  Errors: {errors}")
    
    return 0 if errors == 0 else 1

if __name__ == '__main__':
    sys.exit(sync())