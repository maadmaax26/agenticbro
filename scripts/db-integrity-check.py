#!/usr/bin/env python3
"""
Scammer Database Integrity Check
=================================
Verifies scammer-database.csv matches Supabase known_scammers table.
Runs every 30 minutes via cron.
Reports discrepancies and can auto-fix if enabled.

Usage:
  python3 scripts/db-integrity-check.py [--fix] [--json]
"""

import os
import sys
import csv
import json
from datetime import datetime
from typing import Dict, List, Any

# Add user site-packages for supabase
user_site = os.path.expanduser('~/Library/Python/3.9/lib/python/site-packages')
if user_site not in sys.path:
    sys.path.insert(0, user_site)

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase not installed. Run: pip3 install supabase")
    sys.exit(1)

# ─── Configuration ────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://drvasofyghnxfxvkkwad.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

WORKSPACE = os.path.expanduser('~/.openclaw/workspace')
CSV_PATH = os.path.join(WORKSPACE, 'scammer-database.csv')
OUTPUT_DIR = os.path.join(WORKSPACE, 'output', 'integrity_reports')
LOG_FILE = os.path.join(WORKSPACE, 'output', 'integrity-check.log')

# ─── Helpers ──────────────────────────────────────────────────────────────────

def log(message: str, level: str = 'INFO'):
    """Log to console and file."""
    timestamp = datetime.utcnow().isoformat()
    line = f"[{timestamp}] [{level}] {message}"
    print(line)
    
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    with open(LOG_FILE, 'a') as f:
        f.write(line + '\n')

def read_csv() -> Dict[str, Dict[str, Any]]:
    """Read scammer-database.csv into dict keyed by X handle."""
    entries = {}
    
    if not os.path.exists(CSV_PATH):
        log(f"CSV not found: {CSV_PATH}", 'ERROR')
        return entries
    
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Skip empty rows and section headers
            name = row.get('Scammer Name', '').strip()
            if not name or name.startswith('==='):
                continue
            
            x_handle = row.get('X Handle', '').strip().lower().replace('@', '')
            if x_handle:
                entries[x_handle] = {
                    'name': name,
                    'platform': row.get('Platform', ''),
                    'x_handle': row.get('X Handle', ''),
                    'telegram': row.get('Telegram Channel', ''),
                    'victims': row.get('Victims Count', '0'),
                    'total_lost': row.get('Total Lost USD', '$0'),
                    'verification': row.get('Verification Level', 'UNVERIFIED'),
                    'scam_type': row.get('Scam Type', 'Unknown'),
                    'notes': row.get('Notes', ''),
                    'last_updated': row.get('Last Updated', ''),
                    'source': 'csv'
                }
    
    log(f"Read {len(entries)} entries from CSV")
    return entries

def fetch_supabase() -> Dict[str, Dict[str, Any]]:
    """Fetch all records from Supabase known_scammers table."""
    entries = {}
    
    if not SUPABASE_KEY:
        log("SUPABASE_SERVICE_ROLE_KEY not set", 'ERROR')
        return entries
    
    try:
        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Fetch all records
        response = client.table('known_scammers').select('*').execute()
        
        for row in response.data:
            x_handle = (row.get('x_handle') or '').lower().replace('@', '')
            if x_handle:
                entries[x_handle] = {
                    'id': row.get('id'),
                    'name': row.get('display_name') or row.get('username'),
                    'platform': row.get('platform', ''),
                    'x_handle': row.get('x_handle', ''),
                    'telegram': row.get('telegram_channel', ''),
                    'victims': row.get('victim_count', 0),
                    'total_lost': row.get('total_lost_usd', '$0'),
                    'verification': row.get('verification_level', 'UNVERIFIED'),
                    'scam_type': row.get('scam_type', 'Unknown'),
                    'notes': row.get('notes', ''),
                    'threat_level': row.get('threat_level', 'UNKNOWN'),
                    'risk_score': row.get('risk_score', 0),
                    'status': row.get('status', 'active'),
                    'last_updated': row.get('updated_at', '')[:10] if row.get('updated_at') else '',
                    'source': 'supabase'
                }
        
        log(f"Fetched {len(entries)} records from Supabase")
        return entries
        
    except Exception as e:
        log(f"Supabase fetch error: {e}", 'ERROR')
        return entries

def compare_entries(csv_data: Dict, supabase_data: Dict) -> Dict[str, Any]:
    """Compare CSV and Supabase data, return discrepancies."""
    discrepancies = {
        'csv_only': [],      # In CSV but not in Supabase
        'supabase_only': [], # In Supabase but not in CSV
        'mismatched': [],    # In both but different values
        'matched': []        # In both and matching
    }
    
    all_handles = set(csv_data.keys()) | set(supabase_data.keys())
    
    for handle in all_handles:
        csv_entry = csv_data.get(handle)
        supabase_entry = supabase_data.get(handle)
        
        if csv_entry and not supabase_entry:
            discrepancies['csv_only'].append({
                'handle': handle,
                'csv': csv_entry
            })
        elif supabase_entry and not csv_entry:
            discrepancies['supabase_only'].append({
                'handle': handle,
                'supabase': supabase_entry
            })
        else:
            # Both exist - check for mismatches
            mismatches = []
            
            # Compare key fields
            if csv_entry['verification'] != supabase_entry['verification']:
                mismatches.append(f"verification: CSV={csv_entry['verification']} vs Supabase={supabase_entry['verification']}")
            
            if csv_entry['scam_type'] != supabase_entry['scam_type']:
                mismatches.append(f"scam_type: CSV={csv_entry['scam_type']} vs Supabase={supabase_entry['scam_type']}")
            
            # Normalize notes for comparison (first 100 chars)
            csv_notes = (csv_entry['notes'] or '')[:100].strip()
            supabase_notes = (supabase_entry['notes'] or '')[:100].strip()
            if csv_notes != supabase_notes:
                mismatches.append(f"notes differ")
            
            if mismatches:
                discrepancies['mismatched'].append({
                    'handle': handle,
                    'csv': csv_entry,
                    'supabase': supabase_entry,
                    'differences': mismatches
                })
            else:
                discrepancies['matched'].append(handle)
    
    return discrepancies

def generate_report(discrepancies: Dict) -> Dict[str, Any]:
    """Generate integrity check report."""
    return {
        'timestamp': datetime.utcnow().isoformat(),
        'summary': {
            'total_checked': len(discrepancies['csv_only']) + len(discrepancies['supabase_only']) + len(discrepancies['mismatched']) + len(discrepancies['matched']),
            'matched': len(discrepancies['matched']),
            'csv_only': len(discrepancies['csv_only']),
            'supabase_only': len(discrepancies['supabase_only']),
            'mismatched': len(discrepancies['mismatched'])
        },
        'discrepancies': {
            'csv_only': discrepancies['csv_only'],
            'supabase_only': discrepancies['supabase_only'],
            'mismatched': discrepancies['mismatched']
        },
        'status': 'PASS' if not (discrepancies['csv_only'] or discrepancies['supabase_only'] or discrepancies['mismatched']) else 'FAIL'
    }

def save_report(report: Dict):
    """Save report to output directory."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    filename = f"integrity_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    log(f"Report saved: {filepath}")
    return filepath

def fix_discrepancies(discrepancies: Dict, supabase_data: Dict, csv_data: Dict) -> int:
    """Attempt to fix discrepancies by syncing CSV → Supabase."""
    fixed = 0
    
    if not SUPABASE_KEY:
        log("Cannot fix: SUPABASE_SERVICE_ROLE_KEY not set", 'ERROR')
        return 0
    
    try:
        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Fix CSV-only entries (add to Supabase)
        for item in discrepancies['csv_only']:
            handle = item['handle']
            csv_entry = item['csv']
            
            try:
                client.table('known_scammers').insert({
                    'platform': csv_entry['platform'],
                    'username': handle,
                    'display_name': csv_entry['name'],
                    'x_handle': csv_entry['x_handle'],
                    'telegram_channel': csv_entry['telegram'],
                    'victim_count': int(csv_entry['victims']) if csv_entry['victims'].isdigit() else 0,
                    'total_lost_usd': csv_entry['total_lost'],
                    'verification_level': csv_entry['verification'],
                    'scam_type': csv_entry['scam_type'],
                    'notes': csv_entry['notes'],
                    'threat_level': 'HIGH' if csv_entry['verification'] == 'HIGH RISK' else 'LOW' if csv_entry['verification'] == 'LEGITIMATE' else 'MEDIUM',
                    'status': 'active'
                }).execute()
                log(f"Added {handle} to Supabase")
                fixed += 1
            except Exception as e:
                log(f"Failed to add {handle}: {e}", 'ERROR')
        
        # Fix mismatches (update Supabase from CSV)
        for item in discrepancies['mismatched']:
            handle = item['handle']
            csv_entry = item['csv']
            
            try:
                client.table('known_scammers').update({
                    'verification_level': csv_entry['verification'],
                    'scam_type': csv_entry['scam_type'],
                    'notes': csv_entry['notes'],
                    'threat_level': 'LOW' if csv_entry['verification'] == 'LEGITIMATE' else 'HIGH' if csv_entry['verification'] == 'HIGH RISK' else 'MEDIUM'
                }).eq('x_handle', csv_entry['x_handle']).execute()
                log(f"Updated {handle} in Supabase")
                fixed += 1
            except Exception as e:
                log(f"Failed to update {handle}: {e}", 'ERROR')
        
        return fixed
        
    except Exception as e:
        log(f"Supabase fix error: {e}", 'ERROR')
        return fixed

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Scammer Database Integrity Check')
    parser.add_argument('--fix', action='store_true', help='Fix discrepancies by syncing CSV → Supabase')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    args = parser.parse_args()
    
    log("=" * 60)
    log("INTEGRITY CHECK STARTED")
    log("=" * 60)
    
    # Read data
    csv_data = read_csv()
    supabase_data = fetch_supabase()
    
    # Compare
    discrepancies = compare_entries(csv_data, supabase_data)
    
    # Generate report
    report = generate_report(discrepancies)
    
    # Output
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        log(f"Summary: {report['summary']['matched']} matched, {report['summary']['mismatched']} mismatched, {report['summary']['csv_only']} CSV-only, {report['summary']['supabase_only']} Supabase-only")
        log(f"Status: {report['status']}")
        
        if discrepancies['mismatched']:
            log(f"\nMismatched entries ({len(discrepancies['mismatched'])}):")
            for item in discrepancies['mismatched'][:5]:
                log(f"  - {item['handle']}: {', '.join(item['differences'])}")
        
        if discrepancies['csv_only']:
            log(f"\nCSV-only entries ({len(discrepancies['csv_only'])}):")
            for item in discrepancies['csv_only'][:5]:
                log(f"  - {item['handle']}: {item['csv']['verification']}")
        
        if discrepancies['supabase_only']:
            log(f"\nSupabase-only entries ({len(discrepancies['supabase_only'])}):")
            for item in discrepancies['supabase_only'][:5]:
                log(f"  - {item['handle']}: {item['supabase']['verification']}")
    
    # Save report
    save_report(report)
    
    # Fix if requested
    if args.fix and (discrepancies['csv_only'] or discrepancies['mismatched']):
        fixed = fix_discrepancies(discrepancies, supabase_data, csv_data)
        log(f"Fixed {fixed} discrepancies")
    
    log("=" * 60)
    log("INTEGRITY CHECK COMPLETED")
    log("=" * 60)
    
    return 0 if report['status'] == 'PASS' else 1

if __name__ == '__main__':
    sys.exit(main())