#!/usr/bin/env npx ts-node
/**
 * Sync Scam Database to Supabase
 * 
 * Uses Supabase REST API to sync local CSV to website database
 * Run via: npx ts-node sync-scam-db.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
const envPath = path.join(__dirname, '..', 'agentic-bro', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^\"|\'|["']$/g, '');
      process.env[key.trim()] = value;
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CSV_PATH = process.env.SCAM_DB_CSV_PATH || '/Users/efinney/.openclaw/workspace/scammer-database.csv';

interface SyncResult {
  timestamp: string;
  added: number;
  updated: number;
  unchanged: number;
  errors: string[];
  totalRecords: number;
}

interface ScammerRecord {
  platform: string;
  username: string;
  display_name: string;
  x_handle: string | null;
  telegram_channel: string | null;
  scam_type: string;
  victim_count: number;
  total_lost_usd: string;
  verification_level: string;
  threat_level: string;
  status: string;
  risk_score: number;
  notes: string;
  wallet_address: string | null;
  evidence_links: string[] | null;
  evidence_urls: string[] | null;
  red_flags: string[];
  scan_notes: string;
  last_seen: string;
  first_reported: string;
}

/**
 * Make request to Supabase REST API
 */
async function supabaseRequest(table: string, options: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;
  query?: Record<string, string>;
}): Promise<any> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: options.method,
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.method === 'POST' ? 'return=representation,resolution=merge-duplicates' : 'return=representation',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase API error: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Parse CSV file and return records
 */
function parseCSV(): any[] {
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  
  type CSVRow = Record<string, string>;
  const records = csv.parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as CSVRow[];

  return records.filter((record) => {
    const name = record['Scammer Name'];
    return name && !name.startsWith('===') && name.trim() !== '';
  });
}

/**
 * Normalize platform name
 */
function normalizePlatform(platform: string): string {
  const platformMap: Record<string, string> = {
    'X': 'twitter',
    'Twitter': 'twitter',
    'Telegram': 'telegram',
    'Solana Token': 'solana',
    'Base Token': 'base',
    'BSC Token': 'bsc',
    'Discord': 'discord',
    'Instagram': 'instagram',
    'LinkedIn': 'linkedin',
    'Facebook': 'facebook',
    'Other': 'other',
  };
  return platformMap[platform] || platform.toLowerCase();
}

/**
 * Map scam type to database enum
 */
function mapScamType(scamType: string): string {
  const typeMap: Record<string, string> = {
    'AMA/Giveaway Fraud': 'giveaway_fraud',
    'Token Confusion Scam': 'rug_pull',
    'Rug Pull': 'rug_pull',
    'Wallet Drainer': 'wallet_drainer',
    'Pig Butchering': 'pig_butchering',
    'Phishing': 'phishing',
    'Impersonation': 'impersonation',
    'Investment Fraud': 'investment_fraud',
    'KOL/Influencer': 'other',
    'AMA Completed': 'other',
    'Pump & Dump Promoter': 'pump_and_dump',
  };
  return typeMap[scamType] || 'other';
}

/**
 * Get threat level from risk score (0-10 scale)
 */
function getThreatLevel(riskScore: number): string {
  if (riskScore <= 3) return 'LOW';
  if (riskScore <= 5) return 'MEDIUM';
  if (riskScore <= 7) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Format date string to ISO format
 */
function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.startsWith('http') || dateStr.includes('.com')) {
    return new Date().toISOString();
  }
  // Try to parse YYYY-MM-DD format
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(`${match[1]}-${match[2]}-${match[3]}`).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Map CSV record to database record
 */
function mapToDatabaseRecord(csvRecord: Record<string, string>): ScammerRecord {
  const platform = normalizePlatform(csvRecord['Platform'] || '');
  const verificationLevel = csvRecord['Verification Level'] || 'Unverified';
  
  const xHandle = (csvRecord['X Handle'] || '').trim();
  const telegramHandle = (csvRecord['Telegram Channel'] || '').replace('@', '').replace('t.me/', '').trim();
  const displayName = csvRecord['Scammer Name'] || '';
  
  const username = xHandle.replace('@', '') || telegramHandle || displayName.toLowerCase().replace(/\s+/g, '_');
  
  const scamType = mapScamType(csvRecord['Scam Type'] || '');
  const victimsCount = parseInt(csvRecord['Victims Count'] || '0', 10) || 0;
  const totalLostUsd = csvRecord['Total Lost USD'] || '$0';
  
  const evidenceLinks = (csvRecord['Evidence Links'] || '')
    .split(',')
    .map((link: string) => link.trim())
    .filter((link: string) => link.length > 0);
  
  // Calculate risk score from verification level
  // Note: In the context of legitimate accounts, 'VERIFIED' means "verified as legitimate"
  // For scammers, 'VERIFIED' means "verified as scammer" (5+ victims)
  // We need to distinguish based on the section/context
  const isLegitimateContext = ['LEGITIMATE', 'VERIFIED SAFE', 'PAID PROMOTER', 'RESOLVED'].includes(verificationLevel.toUpperCase());
  
  const scoreMap: Record<string, number> = {
    // High risk / scammer levels
    'HIGH RISK': 100,
    'PARTIALLY VERIFIED': 70,  // Suspicious patterns
    'UNVERIFIED': 50,  // Insufficient data
    // Legitimate levels
    'LEGITIMATE': 5,
    'VERIFIED SAFE': 5,
    'VERIFIED': isLegitimateContext ? 10 : 90,  // Context-dependent
    'PAID PROMOTER': 25,  // Legitimate but paid
    'RESOLVED': 10,  // Dispute resolved
  };
  
  // Try to extract actual risk score from notes first
  const notes = csvRecord['Notes'] || '';
  const riskMatch = notes.match(/Risk Score[:\s]+([\d.]+)\/10/i);
  let riskScore: number;
  if (riskMatch) {
    // Risk scores in notes are already in 0-10 scale
    // Just parse the number directly
    riskScore = parseFloat(riskMatch[1]);
    // Cap at 10 for database constraint
    if (riskScore > 10) riskScore = 10;
    if (riskScore < 0) riskScore = 0;
  } else {
    // For legitimate accounts: use low scores (0-5)
    // For scammers: use high scores (5-10)
    const isLegitimate = ['LEGITIMATE', 'VERIFIED SAFE', 'VERIFIED', 'PAID PROMOTER', 'RESOLVED', 'NORMAL USER', 'PROJECT ACCOUNT', 'MEDIA OUTLET', 'INFLUENCER', 'NEWS AGGREGATOR', 'EVENT TRACKER', 'TRACKER', 'BLOCK EXPLORER', 'PUBLIC FIGURE'].includes(verificationLevel.toUpperCase());
    
    // Default risk scores (0-10 scale for database)
    const scoreMap: Record<string, number> = {
      // High risk / scammer levels
      'HIGH RISK': 10,
      'CRITICAL': 10,
      'PARTIALLY VERIFIED': 7,
      'UNVERIFIED': 5,
      
      // Legitimate levels
      'LEGITIMATE': 1,
      'VERIFIED SAFE': 0.5,
      'VERIFIED': isLegitimate ? 1 : 9,
      'PAID PROMOTER': 2.5,
      'RESOLVED': 1,
      'NORMAL USER': 1.5,
      'PROJECT ACCOUNT': 0.5,
      'MEDIA OUTLET': 0.5,
      'INFLUENCER': 0.5,
      'NEWS AGGREGATOR': 1,
      'EVENT TRACKER': 1,
      'TRACKER': 0.5,
      'BLOCK EXPLORER': 0.5,
      'PUBLIC FIGURE': 0.5,
    };
    
    riskScore = scoreMap[verificationLevel.toUpperCase()] || 5;
  }
  
  // Map verification level
  const verificationMap: Record<string, string> = {
    'UNVERIFIED': 'Unverified',
    'PARTIALLY VERIFIED': 'Partially Verified',
    'VERIFIED': 'Verified',
    'HIGH RISK': 'High Risk',
    'LEGITIMATE': 'Legitimate',
    'PAID PROMOTER': 'Paid Promoter',
    'RESOLVED': 'Resolved',
  };
  const mappedVerification = verificationMap[verificationLevel.toUpperCase()] || verificationLevel;
  
  const threatLevel = getThreatLevel(riskScore);
  
  // Determine status
  const status = 'active';
  
  // Extract red flags
  const flags: string[] = [];
  const level = verificationLevel.toUpperCase();
  if (level.includes('VERIFIED') && !level.includes('PARTIALLY')) flags.push('verified_scammer');
  if (level === 'HIGH RISK') flags.push('high_risk');
  if (level === 'PARTIALLY VERIFIED') flags.push('suspicious_patterns');
  if (level === 'PAID PROMOTER') flags.push('paid_promotions');
  
  // Extract scan notes
  const scanNotes: string[] = [];
  if (riskMatch) scanNotes.push(`Risk: ${riskMatch[1]}`);
  const ageMatch = notes.match(/(\d+\+?\s*years?\s*(?:on\s+X|old))/i);
  if (ageMatch) scanNotes.push(`Age: ${ageMatch[1]}`);
  const followerMatch = notes.match(/([\d.]+[KM]?)\s*(?:followers?|Followers)/i);
  if (followerMatch) scanNotes.push(`Followers: ${followerMatch[1]}`);
  
  return {
    platform,
    username,
    display_name: displayName,
    x_handle: xHandle || null,
    telegram_channel: telegramHandle || null,
    scam_type: scamType,
    victim_count: victimsCount,
    total_lost_usd: totalLostUsd,
    verification_level: mappedVerification,
    threat_level: threatLevel,
    status: status,
    risk_score: riskScore,
    notes: notes,
    wallet_address: csvRecord['Wallet Address'] || null,
    evidence_links: evidenceLinks.length > 0 ? evidenceLinks : null,
    evidence_urls: evidenceLinks.length > 0 ? evidenceLinks : null,
    red_flags: flags,
    scan_notes: scanNotes.join(' | '),
    last_seen: formatDate(csvRecord['Last Updated']),
    first_reported: formatDate(csvRecord['Scan Date']),
  };
}

/**
 * Sync CSV records to Supabase
 */
async function sync(): Promise<SyncResult> {
  const result: SyncResult = {
    timestamp: new Date().toISOString(),
    added: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
    totalRecords: 0,
  };

  try {
    // Parse CSV
    const csvRecords = parseCSV();
    result.totalRecords = csvRecords.length;

    console.log(`[Sync] Processing ${csvRecords.length} records from CSV`);

    for (const csvRecord of csvRecords) {
      try {
        const dbRecord = mapToDatabaseRecord(csvRecord);
        
        if (!dbRecord.username) {
          console.log(`[Sync] Skipping record with no username: ${csvRecord['Scammer Name']}`);
          continue;
        }

        // Determine which table to use based on verification level
        // Note: 'VERIFIED' in CSV context for legitimate section means "verified as legitimate"
        // 'VERIFIED' in scammer section means "verified as scammer" (5+ victims)
        const legitimateLevels = ['LEGITIMATE', 'VERIFIED', 'VERIFIED SAFE', 'PAID PROMOTER'];
        const isLegitimate = legitimateLevels.includes(dbRecord.verification_level.toUpperCase()) && !csvRecord['Scam Type']?.includes('Scam');
        const tableName = isLegitimate ? 'legitimate_accounts' : 'known_scammers';

        if (isLegitimate) {
          // Map to legitimate_accounts schema
          // For legitimate accounts, risk score must be 0-10 per database constraint
          // Extract from notes if available, otherwise default to 1
          const notes = csvRecord['Notes'] || '';
          const notesRiskMatch = notes.match(/Risk Score[:\s]+([\d.]+)\/10/i);
          let legitimateRiskScore = 1;  // Default LOW for legitimate
          if (notesRiskMatch) {
            // Risk scores in notes are already in 0-10 scale
            legitimateRiskScore = Math.min(parseFloat(notesRiskMatch[1]), 10);
          }
          const legitimateRiskLevel = 'LOW';  // Always LOW for legitimate accounts
          
          const legitimateRecord = {
            account_name: dbRecord.display_name || dbRecord.username,
            platform: dbRecord.platform === 'twitter' ? 'X' : dbRecord.platform,
            x_handle: dbRecord.x_handle,
            telegram_channel: dbRecord.telegram_channel,
            verification_level: 'Legitimate',
            followers: parseInt(csvRecord['Followers'] || '0'),
            account_age_years: parseInt(csvRecord['Account Age'] || '0'),
            posts_count: parseInt(csvRecord['Posts'] || '0'),
            bio: csvRecord['Bio'] || null,
            website: null,
            verification_badge: dbRecord.verification_level.toUpperCase() === 'LEGITIMATE',
            red_flags_detected: [],
            scan_date: new Date().toISOString(),
            notes: dbRecord.notes,
            risk_score: legitimateRiskScore,
            risk_level: legitimateRiskLevel,
          };

          // Check if record exists in legitimate_accounts
          const existing = await supabaseRequest('legitimate_accounts', {
            method: 'GET',
            query: {
              x_handle: `eq.${dbRecord.x_handle}`,
              limit: '1',
            },
          });

          if (existing.length === 0) {
            await supabaseRequest('legitimate_accounts', {
              method: 'POST',
              body: legitimateRecord,
            });
            result.added++;
            console.log(`[Sync] Added to legitimate_accounts: ${dbRecord.username}`);
          } else {
            await supabaseRequest('legitimate_accounts', {
              method: 'PATCH',
              body: legitimateRecord,
              query: {
                id: `eq.${existing[0].id}`,
              },
            });
            result.updated++;
            console.log(`[Sync] Updated in legitimate_accounts: ${dbRecord.username}`);
          }
        } else {
          // Handle as scammer in known_scammers table
          const existing = await supabaseRequest('known_scammers', {
            method: 'GET',
            query: {
              username: `eq.${dbRecord.username}`,
              platform: `eq.${dbRecord.platform}`,
              limit: '1',
            },
          });

          if (existing.length === 0) {
            await supabaseRequest('known_scammers', {
              method: 'POST',
              body: dbRecord,
            });
            result.added++;
            console.log(`[Sync] Added: ${dbRecord.username} (${dbRecord.verification_level})`);
          } else {
            const existingRecord = existing[0];
            if (
              existingRecord.verification_level !== dbRecord.verification_level ||
              existingRecord.risk_score !== dbRecord.risk_score ||
              existingRecord.notes !== dbRecord.notes
            ) {
              await supabaseRequest('known_scammers', {
                method: 'PATCH',
                body: dbRecord,
                query: {
                  id: `eq.${existingRecord.id}`,
                },
              });
              result.updated++;
              console.log(`[Sync] Updated: ${dbRecord.username}`);
            } else {
              result.unchanged++;
            }
          }
        }
      } catch (error) {
        const errorMsg = `Error processing ${csvRecord['Scammer Name']}: ${error}`;
        result.errors.push(errorMsg);
        console.error(`[Sync] ${errorMsg}`);
      }
    }

    console.log(`[Sync] Complete: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged`);

  } catch (error) {
    result.errors.push(`Sync failed: ${error}`);
    console.error('[Sync] Failed:', error);
  }

  return result;
}

/**
 * Main entry point
 */
async function main() {
  console.log('[Sync] Starting scam database sync...');
  console.log(`[Sync] Supabase URL: ${SUPABASE_URL ? 'configured' : 'missing'}`);
  console.log(`[Sync] Service Key: ${SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing'}`);
  console.log(`[Sync] CSV Path: ${CSV_PATH}`);
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Sync] ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }

  const result = await sync();
  
  console.log('\n--- SYNC RESULT ---');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Total Records: ${result.totalRecords}`);
  console.log(`Added: ${result.added}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Unchanged: ${result.unchanged}`);
  console.log(`Errors: ${result.errors.length}`);
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch(console.error);