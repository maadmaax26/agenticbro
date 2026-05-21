#!/opt/homebrew/bin/python3
"""
Deduplicate Scammer Database
=============================
Removes duplicate entries from scammer-database.csv based on wallet address.
"""

import csv
from pathlib import Path

DATABASE_PATH = Path('/Users/efinney/.openclaw/workspace/scammer-database.csv')

def dedupe_database():
    """Remove duplicate entries based on wallet address"""
    seen_wallets = set()
    seen_handles = set()
    unique_rows = []
    duplicates_removed = 0
    
    with open(DATABASE_PATH, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        unique_rows.append(header)
        
        for row in reader:
            if not row or len(row) < 11:
                continue
            
            # Get wallet address (column 10)
            wallet = row[10].strip().lower() if len(row) > 10 else ''
            
            # Get handle (column 2)
            handle = row[2].strip().lower() if len(row) > 2 else ''
            
            # Create unique key - prefer wallet address, fall back to handle
            key = wallet if wallet else f"handle_{handle}"
            
            # Skip if we've seen this key before
            if key and key in seen_wallets:
                duplicates_removed += 1
                print(f"Duplicate found: {row[0]} - {wallet[:20]}...")
                continue
            
            # Add to seen set
            if key:
                seen_wallets.add(key)
            
            unique_rows.append(row)
    
    # Write deduplicated database
    with open(DATABASE_PATH, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(unique_rows)
    
    return duplicates_removed

if __name__ == '__main__':
    print("Deduplicating scammer database...")
    removed = dedupe_database()
    print(f"\n✅ Removed {removed} duplicate entries")