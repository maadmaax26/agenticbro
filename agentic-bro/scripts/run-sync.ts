#!/usr/bin/env npx ts-node
/**
 * Scam Database Sync Script
 * 
 * Run manually or via scheduled job
 * Syncs local CSV to PostgreSQL database
 */

import { ScamDBSync } from '../services/scam-db-sync';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const CSV_PATH = process.env.SCAM_DB_CSV_PATH || '/Users/efinney/.openclaw/workspace/scammer-database.csv';
const LOG_PATH = process.env.SYNC_LOG_PATH || '/Users/efinney/.openclaw/workspace/output/sync-logs';

async function main() {
  console.log('=== Scam Database Sync ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`CSV Path: ${CSV_PATH}`);
  console.log(`Database: ${DATABASE_URL ? 'Connected' : 'Not configured'}`);

  // Check CSV exists
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERROR: CSV file not found at ${CSV_PATH}`);
    process.exit(1);
  }

  // Check database URL
  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not configured');
    console.error('Set DATABASE_URL or POSTGRES_URL environment variable');
    process.exit(1);
  }

  try {
    // Run sync
    const sync = new ScamDBSync(DATABASE_URL, CSV_PATH);
    const result = await sync.sync();
    await sync.close();

    // Log results
    console.log('\n=== Sync Results ===');
    console.log(`Records Added: ${result.added}`);
    console.log(`Records Updated: ${result.updated}`);
    console.log(`Records Unchanged: ${result.unchanged}`);
    console.log(`Total Processed: ${result.totalRecords}`);
    
    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`);
      result.errors.forEach(err => console.log(`  - ${err}`));
    }

    // Write log file
    const logDir = path.dirname(LOG_PATH);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(LOG_PATH, `sync-${new Date().toISOString().split('T')[0]}.json`);
    const logEntry = {
      timestamp: result.timestamp.toISOString(),
      added: result.added,
      updated: result.updated,
      unchanged: result.unchanged,
      totalRecords: result.totalRecords,
      errors: result.errors,
    };

    // Append to daily log
    let logs: any[] = [];
    if (fs.existsSync(logFile)) {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
    }
    logs.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));

    console.log(`\nLog saved to: ${logFile}`);
    console.log('=== Sync Complete ===');

    process.exit(0);

  } catch (error) {
    console.error('\n=== Sync Failed ===');
    console.error(error);
    
    // Retry logic
    const retryCount = parseInt(process.env.SYNC_RETRY_COUNT || '0', 10);
    if (retryCount < 1) {
      console.log('\nRetrying in 30 seconds...');
      process.env.SYNC_RETRY_COUNT = '1';
      setTimeout(() => main(), 30000);
    } else {
      console.error('Max retries exceeded');
      process.exit(1);
    }
  }
}

main();