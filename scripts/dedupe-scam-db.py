#!/usr/bin/env python3
"""
Deduplicate Scammer Database
=============================
Removes duplicate entries from scammer-database.csv based on:
1. Wallet Address (primary key)
2. X Handle (secondary key)
"""

import csv
from pathlib import Path
from datetime import datetime

DATABASE_PATH = Path('/Users/efinney/.openclaw/workspace/scammer-database.csv')

def deduplicate_database():
    """Remove duplicates from database"""
    
    # Read all entries
    entries = []
    seen_wallets = set()
    seen_handles = set()
    duplicates = []
    
    with open(DATABASE_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.strip().split('\n')
        
        # Get header
        if not lines:
            print("Empty database!")
            return
        
        header_line = lines[0]
        
        # Parse header
        reader = csv.reader([header_line])
        fieldnames = next(reader)
        
        # Parse data rows
        for line in lines[1:]:
            if not line.strip():
                continue
            
            reader = csv.reader([line])
            row_values = next(reader)
            
            # Create dict from row
            entry = {}
            for i, field in enumerate(fieldnames):
                if i < len(row_values):
                    entry[field] = row_values[i]
                else:
                    entry[field] = ''
            
            entries.append(entry)
    
    # Deduplicate based on wallet address (most reliable)
    unique_entries = []
    for entry in entries:
        wallet = entry.get('Wallet Address', '').strip().strip('"').lower()
        handle = entry.get('X Handle', '').strip().strip('"').lower()
        
        # Create unique key - prefer wallet address
        if wallet and wallet not in ['unknown', 'n/a', '']:
            key = ('wallet', wallet)
            key_set = seen_wallets
        elif handle and handle not in ['unknown', 'n/a', '']:
            key = ('handle', handle)
            key_set = seen_handles
        else:
            # No unique identifier, keep it
            unique_entries.append(entry)
            continue
        
        if key[1] in key_set:
            duplicates.append(entry)
            continue
        
        key_set.add(key[1])
        unique_entries.append(entry)
    
    # Write deduplicated database
    with open(DATABASE_PATH, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for entry in unique_entries:
            writer.writerow(entry)
    
    # Report
    original_count = len(entries)
    unique_count = len(unique_entries)
    duplicate_count = len(duplicates)
    
    print(f"\n📊 Deduplication Report")
    print(f"=" * 40)
    print(f"Original entries: {original_count}")
    print(f"Unique entries:   {unique_count}")
    print(f"Duplicates removed: {duplicate_count}")
    print(f"=" * 40)
    
    if duplicates:
        print(f"\n🔍 Sample duplicates removed:")
        for dup in duplicates[:10]:
            name = dup.get('Scammer Name', 'Unknown')
            wallet = dup.get('Wallet Address', 'N/A')
            handle = dup.get('X Handle', 'N/A')
            print(f"  - {name} | {handle} | {wallet[:30]}...")
    
    return {
        'original': original_count,
        'unique': unique_count,
        'duplicates': duplicate_count
    }

if __name__ == '__main__':
    deduplicate_database()