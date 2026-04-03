#!/bin/bash
# Sync local scan reports to database
# Run this after local Chrome CDP scans to update the website database

cd /Users/efinney/.openclaw/workspace

echo "=== Syncing Local Scans to Database ==="
echo ""

# Run the sync script
npx ts-node scripts/sync-scans-to-db.ts

echo ""
echo "Done!"