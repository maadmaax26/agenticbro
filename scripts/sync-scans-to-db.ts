#!/usr/bin/env ts-node
/**
 * Sync Local Scan Reports to Database
 * 
 * This script:
 * 1. Reads all scan reports from /output/scan_reports/
 * 2. Updates scammer-database.csv for HIGH RISK scans
 * 3. Updates legitimate_accounts for LEGITIMATE scans
 * 4. Triggers Supabase sync
 * 
 * Run after local scans to update the website database.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SCAN_REPORTS_DIR = '/Users/efinney/.openclaw/workspace/output/scan_reports';
const CSV_PATH = '/Users/efinney/.openclaw/workspace/scammer-database.csv';
const SYNCED_LOG = '/Users/efinney/.openclaw/workspace/output/synced_scans.json';

interface ScanReport {
  scan_id?: string;
  scan_date: string;
  platform?: string;
  handle?: string;
  username?: string;
  target_handle?: string;
  target_name?: string;
  display_name?: string;
  risk_score?: number;
  risk_level?: string;
  verification_level?: string;
  verification_status?: string;
  status?: string;
  classification?: string;
  scam_type?: string;
  notes?: string;
  wallet?: string;
  wallet_address?: string;
  summary?: {
    title?: string;
    recommendation?: string;
    key_findings?: string[];
    notes?: string;
  };
  profile?: {
    bio?: string;
    followers?: number;
    following?: number;
    posts?: number;
    join_date?: string;
    verified?: boolean;
  };
  red_flags?: Record<string, boolean>;
  evidence_links?: string[];
  evidence?: string[];
  scanner?: string;
  x_handle?: string;
}

interface SyncedScans {
  synced: string[];
  last_sync: string;
}

function loadSyncedScans(): SyncedScans {
  try {
    if (fs.existsSync(SYNCED_LOG)) {
      return JSON.parse(fs.readFileSync(SYNCED_LOG, 'utf-8'));
    }
  } catch (e) {
    // ignore
  }
  return { synced: [], last_sync: new Date().toISOString() };
}

function saveSyncedScans(data: SyncedScans): void {
  fs.writeFileSync(SYNCED_LOG, JSON.stringify(data, null, 2));
}

function loadCSV(): string[] {
  try {
    return fs.readFileSync(CSV_PATH, 'utf-8').split('\n');
  } catch (e) {
    console.error('[Sync] Error reading CSV:', e);
    return [];
  }
}

function saveCSV(lines: string[]): void {
  fs.writeFileSync(CSV_PATH, lines.join('\n'));
}

function normalizeHandle(handle: string | undefined | null): string {
  if (!handle) return '';
  return handle.replace(/^@/, '').toLowerCase();
}

function findCSVLine(lines: string[], handle: string): number {
  const normalized = normalizeHandle(handle);
  if (!normalized) return -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes(normalized) || line.includes(`@${normalized}`)) {
      return i;
    }
  }
  return -1;
}

function getVerificationLevel(report: ScanReport): string {
  const level = (report.verification_level || report.verification_status || '').toUpperCase();
  
  // Map risk levels to database verification levels
  if (level === 'LEGITIMATE' || level === 'VERIFIED' || level === 'VERIFIED SAFE') return 'LEGITIMATE';
  if (level === 'PAID PROMOTER') return 'PAID PROMOTER';
  if (level === 'HIGH RISK' || level === 'SCAMMER' || level === 'FLAGGED') return 'HIGH RISK';
  if (level === 'UNVERIFIED') return 'UNVERIFIED';
  
  // Fall back to risk score
  const score = report.risk_score ?? 0;
  if (score >= 7) return 'HIGH RISK';
  if (score >= 5) return 'UNVERIFIED';
  if (score <= 3) return 'LEGITIMATE';
  
  return 'UNVERIFIED';
}

function getScamType(report: ScanReport): string {
  const classification = (report.classification || report.scam_type || '').toLowerCase();
  
  if (classification.includes('scam') || classification.includes('fraud')) return 'Investment Fraud';
  if (classification.includes('promoter') || classification.includes('shill')) return 'Paid Promoter';
  if (classification.includes('impersonation')) return 'Impersonation';
  if (classification.includes('phishing')) return 'Phishing';
  if (classification.includes('rug')) return 'Rug Pull';
  
  return 'Other';
}

function formatCSVRow(report: ScanReport): string {
  const verificationLevel = getVerificationLevel(report);
  const scamType = getScamType(report);
  const date = new Date(report.scan_date).toISOString().split('T')[0];
  const handle = (report.handle || report.username || report.target_handle || '').replace(/^@/, '');
  const platform = report.platform || 'X (Twitter)';
  const displayName = report.display_name || report.target_name || handle;
  
  const row = [
    displayName, // Scammer Name
    platform === 'X (Twitter)' ? 'X' : platform, // Platform
    report.handle || report.x_handle || `@${handle}`, // X Handle
    '', // Telegram Channel
    '0', // Victims Count
    '$0', // Total Lost USD
    verificationLevel, // Verification Level
    scamType, // Scam Type
    date, // Last Updated
    report.summary?.notes || report.summary?.title || report.notes || '', // Notes
    report.wallet_address || report.wallet || '', // Wallet Address
    (report.evidence_links || report.evidence || []).join(', '), // Evidence Links
    date, // Scan Date
    report.scanner || 'Jarvis', // Scanner
    report.summary?.key_findings?.join('; ') || '', // Additional Notes
  ];
  
  return row.map(field => {
    if (!field) return '';
    // Escape fields that contain commas
    if (field.includes(',') || field.includes('"')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }).join(',');
}

async function syncToSupabase(): Promise<void> {
  console.log('[Sync] Triggering Supabase sync...');
  
  try {
    const { stdout, stderr } = await execAsync(
      'curl -X POST http://localhost:3001/api/v1/sync/scam-db 2>/dev/null',
      { timeout: 30000 }
    );
    
    const result = JSON.parse(stdout);
    if (result.success) {
      console.log(`[Sync] Supabase sync complete: ${result.result?.added || 0} added, ${result.result?.updated || 0} updated`);
    } else {
      console.error('[Sync] Supabase sync failed:', result.error);
    }
  } catch (e) {
    console.error('[Sync] Supabase sync error:', e);
    // Try alternate method
    console.log('[Sync] Note: Supabase sync requires backend server running on port 3001');
  }
}

async function main(): Promise<void> {
  console.log('[Sync] Starting local scan to database sync...\n');
  
  // Load already synced scans
  const syncedData = loadSyncedScans();
  const syncedSet = new Set(syncedData.synced);
  
  // Find all scan reports
  const files = fs.readdirSync(SCAN_REPORTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(SCAN_REPORTS_DIR, f));
  
  console.log(`[Sync] Found ${files.length} scan reports`);
  
  // Load CSV
  const csvLines = loadCSV();
  console.log(`[Sync] Loaded CSV with ${csvLines.length} lines`);
  
  let addedCount = 0;
  let updatedCount = 0;
  
  // Process each scan report
  for (const file of files) {
    const filename = path.basename(file);
    
    // Skip if already synced
    if (syncedSet.has(filename)) {
      continue;
    }
    
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const report: ScanReport = JSON.parse(content);
      
      // Extract handle from various possible fields
      const handle = normalizeHandle(report.handle || report.username || report.target_handle || report.x_handle || '');
      const displayName = report.display_name || report.target_name || handle;
      
      // Skip if no handle
      if (!handle) {
        console.log(`  → Skipped (no handle)`);
        continue;
      }
      
      const verificationLevel = getVerificationLevel(report);
      
      console.log(`\n[Sync] Processing: ${filename}`);
      console.log(`  Handle: ${handle}`);
      console.log(`  Risk: ${report.risk_level || 'UNKNOWN'} (${report.risk_score ?? 0}/10)`);
      console.log(`  Verification: ${verificationLevel}`);
      
      // Only sync HIGH RISK or LEGITIMATE scans
      if (verificationLevel === 'HIGH RISK') {
        const existingIdx = findCSVLine(csvLines, handle);
        const newRow = formatCSVRow(report);
        
        if (existingIdx >= 0) {
          // Update existing entry
          csvLines[existingIdx] = newRow;
          updatedCount++;
          console.log(`  → Updated existing entry`);
        } else {
          // Find insertion point (after header, before LEGITIMATE section)
          let insertIdx = 1;
          for (let i = 0; i < csvLines.length; i++) {
            if (csvLines[i].includes('=== HIGH RISK')) {
              insertIdx = i + 2; // After section header
              break;
            }
          }
          
          // If no HIGH RISK section found, insert after header
          if (insertIdx === 1) {
            insertIdx = 17; // After header rows
          }
          
          csvLines.splice(insertIdx, 0, newRow);
          addedCount++;
          console.log(`  → Added new entry to HIGH RISK section`);
        }
        
        syncedData.synced.push(filename);
      } else if (verificationLevel === 'LEGITIMATE' || verificationLevel === 'PAID PROMOTER') {
        // For legitimate accounts, we'd need a separate legitimate_accounts.csv or table
        // For now, add to RESOLVED section of main CSV
        const existingIdx = findCSVLine(csvLines, handle);
        
        if (existingIdx < 0) {
          // Add to LEGITIMATE section
          const newRow = formatCSVRow(report);
          let insertIdx = csvLines.length - 1;
          
          // Find LEGITIMATE section
          for (let i = 0; i < csvLines.length; i++) {
            if (csvLines[i].includes('=== LEGITIMATE')) {
              insertIdx = i + 2;
              break;
            }
          }
          
          csvLines.splice(insertIdx, 0, newRow);
          addedCount++;
          console.log(`  → Added to LEGITIMATE section`);
        }
        
        syncedData.synced.push(filename);
      } else {
        console.log(`  → Skipped (verification level: ${verificationLevel})`);
      }
    } catch (e) {
      console.error(`[Sync] Error processing ${filename}:`, e);
    }
  }
  
  // Save updated CSV
  if (addedCount > 0 || updatedCount > 0) {
    saveCSV(csvLines);
    console.log(`\n[Sync] Updated CSV: ${addedCount} added, ${updatedCount} updated`);
    
    // Update synced log
    syncedData.last_sync = new Date().toISOString();
    saveSyncedScans(syncedData);
    
    // Trigger Supabase sync
    await syncToSupabase();
  } else {
    console.log('\n[Sync] No changes needed');
  }
  
  console.log('\n[Sync] Complete!');
}

main().catch(console.error);