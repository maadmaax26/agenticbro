#!/usr/bin/env python3
"""
Deduplicate Scammer Database v2
===============================
Properly handles CSV with section headers and deduplicates by wallet address.
"""

import csv
from pathlib import Path
from datetime import datetime

DATABASE_PATH = Path('/Users/efinney/.openclaw/workspace/scammer-database.csv')

def deduplicate_database():
    """Remove duplicates from database based on wallet address"""
    
    # Read all entries
    all_lines = []
    with open(DATABASE_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            all_lines.append(line.strip())
    
    # Parse entries
    header_line = all_lines[0]
    fieldnames = ['Scammer Name', 'Platform', 'X Handle', 'Telegram Channel', 
                   'Victims Count', 'Total Lost USD', 'Verification Level', 
                   'Scam Type', 'Last Updated', 'Notes', 'Wallet Address', 
                   'Evidence Links', 'Scan Date', 'Scanner', 'Additional Notes']
    
    entries = []
    section_headers = []
    
    for i, line in enumerate(all_lines[1:], 1):
        if not line or line.startswith('===') or line.startswith(','):
            # Track section headers
            if line.startswith('==='):
                section_headers.append((i, line))
            continue
        
        # Parse CSV line
        reader = csv.reader([line])
        row_values = next(reader)
        
        # Create entry dict
        entry = {'line': line, 'row': i}
        for j, field in enumerate(fieldnames):
            if j < len(row_values):
                entry[field] = row_values[j]
            else:
                entry[field] = ''
        
        entries.append(entry)
    
    # Deduplicate by wallet address
    seen_wallets = {}
    unique_entries = []
    duplicates = []
    
    for entry in entries:
        wallet = entry.get('Wallet Address', '').strip().strip('"').lower()
        
        if not wallet or wallet in ['unknown', 'n/a', 'multiple contracts - see report', '']:
            # Keep entries without wallet addresses (they're likely from different sources)
            unique_entries.append(entry)
            continue
        
        if wallet in seen_wallets:
            duplicates.append(entry)
            continue
        
        seen_wallets[wallet] = entry
        unique_entries.append(entry)
    
    # Write deduplicated database
    with open(DATABASE_PATH, 'w', encoding='utf-8', newline='') as f:
        # Write header
        f.write(header_line + '\n')
        
        # Write section header for HIGH RISK
        f.write(',,,,,,,,,,,,,,\n')
        f.write('=== HIGH RISK / VERIFIED SCAMMERS ===,,,,,,,,,,,,,,\n')
        f.write(',,,,,,,,,,,,,,\n')
        
        # Write unique entries
        for entry in unique_entries:
            f.write(entry['line'] + '\n')
        
        # Write section headers at end
        f.write(',,,,,,,,,,,,,,\n')
        f.write('=== LEGITIMATE / VERIFIED SAFE ===,,,,,,,,,,,,,,\n')
        f.write(',,,,,,,,,,,,,,\n')
        f.write(',,,,,,,,,,,,,,\n')
        f.write('=== RESOLVED / DISPUTED ===,,,,,,,,,,,,,,\n')
    
    # Report
    original_count = len(entries)
    unique_count = len(unique_entries)
    duplicate_count = len(duplicates)
    
    print(f"\n📊 Deduplication Report")
    print(f"=" * 50)
    print(f"Original entries:    {original_count}")
    print(f"Unique entries:      {unique_count}")
    print(f"Duplicates removed:  {duplicate_count}")
    print(f"=" * 50)
    
    if duplicates:
        print(f"\n🔍 Duplicates removed:")
        for dup in duplicates[:10]:
            name = dup.get('Scammer Name', 'Unknown')
            wallet = dup.get('Wallet Address', 'N/A')[:30]
            print(f"  - {name} | {wallet}...")
    
    return {
        'original': original_count,
        'unique': unique_count,
        'duplicates': duplicate_count
    }

if __name__ == '__main__':
    deduplicate_database()