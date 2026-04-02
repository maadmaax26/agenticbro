/**
 * Scam Database Sync Service
 * 
 * Syncs local CSV scam database to AgenticBro website PostgreSQL database
 * Runs on schedule (hourly) to keep website updated with local scan results
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';

export interface SyncResult {
  timestamp: Date;
  added: number;
  updated: number;
  unchanged: number;
  errors: string[];
  totalRecords: number;
}

export interface CSVScammerRecord {
  scammerName: string;
  platform: string;
  xHandle: string;
  telegramChannel: string;
  victimsCount: number;
  totalLostUsd: string;
  verificationLevel: string;
  scamType: string;
  lastUpdated: string;
  notes: string;
  walletAddress: string;
  evidenceLinks: string;
  scanDate?: string;
  scanner?: string;
  additionalNotes?: string;
}

export class ScamDBSync {
  private pool: Pool;
  private csvPath: string;

  constructor(databaseUrl: string, csvPath: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    this.csvPath = csvPath;
  }

  /**
   * Parse CSV file and return records
   */
  private parseCSV(): CSVScammerRecord[] {
    const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
    
    // Parse CSV with headers
    type CSVRow = Record<string, string>;
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as CSVRow[];

    return records.filter((record) => {
      // Skip section headers and empty rows
      if (!record['Scammer Name'] || 
          record['Scammer Name'].startsWith('===') || 
          record['Scammer Name'].trim() === '') {
        return false;
      }
      return true;
    }) as unknown as CSVScammerRecord[];
  }

  /**
   * Map CSV record to database record
   */
  private mapToDatabaseRecord(csvRecord: CSVScammerRecord): any {
    const platform = this.normalizePlatform(csvRecord['Platform']);
    const verificationLevel = csvRecord['Verification Level']?.toUpperCase() || 'UNVERIFIED';
    
    // Determine if this is a legitimate/low-risk entry
    const isLegitimate = verificationLevel === 'LEGITIMATE' || 
                         verificationLevel === 'PAID PROMOTER' ||
                         verificationLevel === 'RESOLVED';
    
    // Map scam type
    const scamType = this.mapScamType(csvRecord['Scam Type'], isLegitimate);
    
    // Parse numeric values
    const victimsCount = parseInt(csvRecord['Victims Count'] || '0', 10) || 0;
    const totalLostUsd = this.parseUsdAmount(csvRecord['Total Lost USD'] || '$0');
    
    // Parse evidence links
    const evidenceLinks = (csvRecord['Evidence Links'] || '')
      .split(',')
      .map((link: string) => link.trim())
      .filter((link: string) => link.length > 0);
    
    // Handle X handle - extract username without @
    const xHandle = (csvRecord['X Handle'] || '').replace('@', '').trim();
    const telegramHandle = (csvRecord['Telegram Channel'] || '').replace('@', '').trim();
    
    // Build username based on platform
    let username = '';
    if (platform === 'twitter' && xHandle) {
      username = xHandle;
    } else if (platform === 'telegram' && telegramHandle) {
      username = telegramHandle;
    } else if (xHandle) {
      username = xHandle;
    } else if (telegramHandle) {
      username = telegramHandle;
    }

    return {
      platform,
      username,
      display_name: csvRecord['Scammer Name'] || username,
      scam_type: scamType,
      victim_count: victimsCount,
      total_lost_usd: totalLostUsd,
      evidence_urls: evidenceLinks,
      wallet_address: csvRecord['Wallet Address'] || null,
      notes: csvRecord['Notes'] || '',
      verification_level: verificationLevel,
      risk_score: this.calculateRiskScore(verificationLevel),
      status: isLegitimate ? 'resolved' : 'active',
      last_seen: csvRecord['Last Updated'] ? new Date(csvRecord['Last Updated']) : new Date(),
      source: 'local_scan',
      scanner: csvRecord['Scanner'] || 'jarvis',
      scan_date: csvRecord['Scan Date'] ? new Date(csvRecord['Scan Date']) : new Date(),
    };
  }

  /**
   * Normalize platform name
   */
  private normalizePlatform(platform: string): string {
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
  private mapScamType(scamType: string, isLegitimate: boolean): string {
    if (isLegitimate) {
      return 'other'; // Legitimate accounts get 'other' type
    }

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
    };
    return typeMap[scamType] || 'other';
  }

  /**
   * Parse USD amount string
   */
  private parseUsdAmount(amount: string): number {
    if (!amount) return 0;
    const cleaned = amount.replace(/[$,]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Calculate risk score from verification level
   */
  private calculateRiskScore(verificationLevel: string): number {
    const scoreMap: Record<string, number> = {
      'UNVERIFIED': 5.0,
      'PARTIALLY VERIFIED': 7.0,
      'VERIFIED': 9.0,
      'HIGH RISK': 10.0,
      'LEGITIMATE': 0.5,
      'PAID PROMOTER': 2.5,
      'RESOLVED': 1.0,
    };
    return scoreMap[verificationLevel] || 5.0;
  }

  /**
   * Sync CSV records to database
   */
  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      timestamp: new Date(),
      added: 0,
      updated: 0,
      unchanged: 0,
      errors: [],
      totalRecords: 0,
    };

    try {
      // Parse CSV
      const csvRecords = this.parseCSV();
      result.totalRecords = csvRecords.length;

      console.log(`[ScamDBSync] Processing ${csvRecords.length} records from CSV`);

      // Connect to database
      const client = await this.pool.connect();

      try {
        // Ensure table exists
        await this.ensureTableExists(client);

        for (const csvRecord of csvRecords) {
          try {
            const dbRecord = this.mapToDatabaseRecord(csvRecord);
            
            // Skip if no username
            if (!dbRecord.username) {
              console.log(`[ScamDBSync] Skipping record with no username: ${csvRecord['Scammer Name']}`);
              continue;
            }

            // Check if record exists
            const existingQuery = `
              SELECT id FROM known_scammers 
              WHERE username = $1 AND platform = $2
            `;
            const existing = await client.query(existingQuery, [dbRecord.username, dbRecord.platform]);

            if (existing.rows.length === 0) {
              // Insert new record
              await this.insertRecord(client, dbRecord);
              result.added++;
              console.log(`[ScamDBSync] Added: ${dbRecord.username} (${dbRecord.verification_level})`);
            } else {
              // Update existing record
              const updateResult = await this.updateRecord(client, dbRecord);
              if (updateResult) {
                result.updated++;
                console.log(`[ScamDBSync] Updated: ${dbRecord.username}`);
              } else {
                result.unchanged++;
              }
            }
          } catch (error) {
            const errorMsg = `Error processing ${csvRecord['Scammer Name']}: ${error}`;
            result.errors.push(errorMsg);
            console.error(`[ScamDBSync] ${errorMsg}`);
          }
        }

        // Update sync metadata
        await this.updateSyncMetadata(client, result);

      } finally {
        client.release();
      }

      console.log(`[ScamDBSync] Sync complete: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged`);

    } catch (error) {
      result.errors.push(`Sync failed: ${error}`);
      console.error('[ScamDBSync] Sync failed:', error);
    }

    return result;
  }

  /**
   * Ensure database table exists
   */
  private async ensureTableExists(client: any): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS known_scammers (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        username VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        scam_type VARCHAR(100),
        victim_count INTEGER DEFAULT 0,
        total_lost_usd DECIMAL(15, 2) DEFAULT 0,
        evidence_urls TEXT[],
        wallet_address VARCHAR(255),
        notes TEXT,
        verification_level VARCHAR(50) DEFAULT 'UNVERIFIED',
        risk_score DECIMAL(3, 1) DEFAULT 5.0,
        status VARCHAR(50) DEFAULT 'active',
        first_reported TIMESTAMP DEFAULT NOW(),
        last_seen TIMESTAMP,
        source VARCHAR(50) DEFAULT 'manual',
        scanner VARCHAR(100),
        scan_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(platform, username)
      );

      CREATE INDEX IF NOT EXISTS idx_scammers_username ON known_scammers(username);
      CREATE INDEX IF NOT EXISTS idx_scammers_platform ON known_scammers(platform);
      CREATE INDEX IF NOT EXISTS idx_scammers_verification ON known_scammers(verification_level);
    `;

    await client.query(createTableQuery);
  }

  /**
   * Insert new record
   */
  private async insertRecord(client: any, record: any): Promise<void> {
    const query = `
      INSERT INTO known_scammers (
        platform, username, display_name, scam_type, victim_count,
        total_lost_usd, evidence_urls, wallet_address, notes,
        verification_level, risk_score, status, last_seen,
        source, scanner, scan_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `;

    await client.query(query, [
      record.platform, record.username, record.display_name, record.scam_type,
      record.victim_count, record.total_lost_usd, record.evidence_urls,
      record.wallet_address, record.notes, record.verification_level,
      record.risk_score, record.status, record.last_seen,
      record.source, record.scanner, record.scan_date,
    ]);
  }

  /**
   * Update existing record
   */
  private async updateRecord(client: any, record: any): Promise<boolean> {
    const query = `
      UPDATE known_scammers SET
        display_name = $3,
        scam_type = $4,
        victim_count = $5,
        total_lost_usd = $6,
        evidence_urls = $7,
        wallet_address = $8,
        notes = $9,
        verification_level = $10,
        risk_score = $11,
        status = $12,
        last_seen = $13,
        scanner = $14,
        scan_date = $15,
        updated_at = NOW()
      WHERE username = $1 AND platform = $2
      AND (
        display_name != $3 OR
        verification_level != $10 OR
        risk_score != $11 OR
        notes != $9
      )
    `;

    const result = await client.query(query, [
      record.username, record.platform, record.display_name, record.scam_type,
      record.victim_count, record.total_lost_usd, record.evidence_urls,
      record.wallet_address, record.notes, record.verification_level,
      record.risk_score, record.status, record.last_seen,
      record.scanner, record.scan_date,
    ]);

    return result.rowCount > 0;
  }

  /**
   * Update sync metadata
   */
  private async updateSyncMetadata(client: any, result: SyncResult): Promise<void> {
    const query = `
      INSERT INTO scam_db_sync_log (timestamp, added, updated, unchanged, errors, total_records)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await client.query(query, [
      result.timestamp, result.added, result.updated, result.unchanged,
      result.errors, result.totalRecords,
    ]);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Run sync manually (for testing)
 */
export async function runSync(databaseUrl: string, csvPath: string): Promise<SyncResult> {
  const sync = new ScamDBSync(databaseUrl, csvPath);
  const result = await sync.sync();
  await sync.close();
  return result;
}