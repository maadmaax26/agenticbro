/**
 * Supabase Scam Database Sync Service
 * 
 * Syncs local CSV scam database to Supabase using REST API
 */

import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

export interface SyncResult {
  timestamp: Date;
  added: number;
  updated: number;
  unchanged: number;
  errors: string[];
  totalRecords: number;
}

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export class SupabaseScamDBSync {
  private supabaseUrl: string;
  private serviceRoleKey: string;
  private csvPath: string;
  private records: any[] = [];

  constructor(config: SupabaseConfig, csvPath: string) {
    this.supabaseUrl = config.url;
    this.serviceRoleKey = config.serviceRoleKey;
    this.csvPath = csvPath;
  }

  /**
   * Parse CSV file and return records
   */
  private parseCSV(): any[] {
    const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
    
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
   * Map CSV record to database record for Supabase known_scammers table
   */
  private mapToDatabaseRecord(csvRecord: Record<string, string>): any {
    const platform = this.normalizePlatform(csvRecord['Platform'] || '');
    const verificationLevel = csvRecord['Verification Level'] || 'Unverified';
    
    const xHandle = (csvRecord['X Handle'] || '').trim();
    const telegramHandle = (csvRecord['Telegram Channel'] || '').replace('@', '').replace('t.me/', '').trim();
    const displayName = csvRecord['Scammer Name'] || '';
    
    // Generate username from x_handle or telegram
    const username = xHandle.replace('@', '') || telegramHandle || displayName.toLowerCase().replace(/\s+/g, '_');
    
    const scamType = this.mapScamType(csvRecord['Scam Type'] || '');
    const victimsCount = parseInt(csvRecord['Victims Count'] || '0', 10) || 0;
    const totalLostUsd = csvRecord['Total Lost USD'] || '$0';
    
    const evidenceLinks = (csvRecord['Evidence Links'] || '')
      .split(',')
      .map((link: string) => link.trim())
      .filter((link: string) => link.length > 0);
    
    const riskScore = Math.round(this.calculateRiskScore(verificationLevel) * 10);
    
    // Map verification level to match existing schema
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
    
    // Determine threat level
    const threatLevel = this.getThreatLevel(riskScore);
    
    // Determine status - Supabase table has check constraint
    // Valid statuses: 'active', 'banned' (based on existing data)
    // Use 'active' for all records; verification_level differentiates legitimacy
    const status = 'active';

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
      notes: csvRecord['Notes'] || '',
      wallet_address: csvRecord['Wallet Address'] || null,
      evidence_links: evidenceLinks.length > 0 ? evidenceLinks : null,
      evidence_urls: evidenceLinks.length > 0 ? evidenceLinks : null,
      red_flags: this.extractRedFlags(csvRecord),
      scan_notes: this.extractScanNotes(csvRecord),
      last_seen: csvRecord['Last Updated'] || new Date().toISOString().split('T')[0],
      first_reported: csvRecord['Scan Date'] || new Date().toISOString().split('T')[0],
    };
  }

  /**
   * Extract red flags from CSV record
   */
  private extractRedFlags(csvRecord: Record<string, string>): string[] {
    const flags: string[] = [];
    const verificationLevel = (csvRecord['Verification Level'] || '').toUpperCase();
    
    // Add flags based on verification level
    if (verificationLevel.includes('VERIFIED') && !verificationLevel.includes('PARTIALLY')) {
      flags.push('verified_scammer');
    }
    if (verificationLevel === 'HIGH RISK') {
      flags.push('high_risk');
    }
    if (verificationLevel === 'PARTIALLY VERIFIED') {
      flags.push('suspicious_patterns');
    }
    if (verificationLevel === 'PAID PROMOTER') {
      flags.push('paid_promotions');
    }
    
    // Add flags from scam type
    const scamType = csvRecord['Scam Type'] || '';
    if (scamType.includes('Rug') || scamType.includes('Confusion')) {
      flags.push('rug_pull_risk');
    }
    if (scamType.includes('Phishing')) {
      flags.push('phishing');
    }
    if (scamType.includes('Drainer')) {
      flags.push('wallet_drainer');
    }
    
    // Add flags from notes
    const notes = csvRecord['Notes'] || '';
    if (notes.includes('717K') || notes.includes('followers')) {
      flags.push('high_followers');
    }
    if (notes.includes('14+ years') || notes.includes('established')) {
      flags.push('established_account');
    }
    
    return flags;
  }

  /**
   * Extract scan notes from CSV record
   */
  private extractScanNotes(csvRecord: Record<string, string>): string {
    const parts: string[] = [];
    
    // Risk score
    const riskMatch = (csvRecord['Notes'] || '').match(/Risk Score[:\s]+([\d.]+\/10)/i);
    if (riskMatch) {
      parts.push(`Risk: ${riskMatch[1]}`);
    }
    
    // Verification details
    const verificationLevel = csvRecord['Verification Level'] || '';
    if (verificationLevel && verificationLevel !== 'Unverified') {
      parts.push(`Verification: ${verificationLevel}`);
    }
    
    // Account age from notes
    const ageMatch = (csvRecord['Notes'] || '').match(/(\d+\+?\s*years?\s*(?:on\s+X|old))/i);
    if (ageMatch) {
      parts.push(`Age: ${ageMatch[1]}`);
    }
    
    // Follower count from notes
    const followerMatch = (csvRecord['Notes'] || '').match(/([\d.]+[KM]?)\s*(?:followers?|Followers)/i);
    if (followerMatch) {
      parts.push(`Followers: ${followerMatch[1]}`);
    }
    
    return parts.join(' | ');
  }

  /**
   * Get threat level from risk score
   */
  private getThreatLevel(riskScore: number): string {
    if (riskScore <= 30) return 'LOW';
    if (riskScore <= 50) return 'MEDIUM';
    if (riskScore <= 70) return 'HIGH';
    return 'CRITICAL';
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
  private mapScamType(scamType: string): string {
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
   * Make request to Supabase REST API
   */
  private async supabaseRequest(table: string, options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: any;
    query?: Record<string, string>;
  }): Promise<any> {
    const url = new URL(`${this.supabaseUrl}/rest/v1/${table}`);
    
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: options.method,
      headers: {
        'apikey': this.serviceRoleKey,
        'Authorization': `Bearer ${this.serviceRoleKey}`,
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
   * Ensure the table exists
   */
  private async ensureTableExists(): Promise<void> {
    // Table creation would typically be done via Supabase dashboard or migration
    // For now, we assume the table exists or create via raw SQL
    console.log('[SupabaseScamDBSync] Ensuring table exists...');
    
    // Check if table exists by trying to select from it
    try {
      await this.supabaseRequest('known_scammers', {
        method: 'GET',
        query: { limit: '1' },
      });
      console.log('[SupabaseScamDBSync] Table exists');
    } catch (error) {
      console.error('[SupabaseScamDBSync] Table may not exist:', error);
      throw error;
    }
  }

  /**
   * Sync CSV records to Supabase
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

      console.log(`[SupabaseScamDBSync] Processing ${csvRecords.length} records from CSV`);

      // Ensure table exists
      await this.ensureTableExists();

      for (const csvRecord of csvRecords) {
        try {
          const dbRecord = this.mapToDatabaseRecord(csvRecord);
          
          if (!dbRecord.username) {
            console.log(`[SupabaseScamDBSync] Skipping record with no username: ${csvRecord['Scammer Name']}`);
            continue;
          }

          // Check if record exists
          const existing = await this.supabaseRequest('known_scammers', {
            method: 'GET',
            query: {
              username: `eq.${dbRecord.username}`,
              platform: `eq.${dbRecord.platform}`,
              limit: '1',
            },
          });

          if (existing.length === 0) {
            // Insert new record
            await this.supabaseRequest('known_scammers', {
              method: 'POST',
              body: dbRecord,
            });
            result.added++;
            console.log(`[SupabaseScamDBSync] Added: ${dbRecord.username} (${dbRecord.verification_level})`);
          } else {
            // Update existing record if changed
            const existingRecord = existing[0];
            if (
              existingRecord.verification_level !== dbRecord.verification_level ||
              existingRecord.risk_score !== dbRecord.risk_score ||
              existingRecord.notes !== dbRecord.notes
            ) {
              await this.supabaseRequest('known_scammers', {
                method: 'PATCH',
                body: dbRecord,
                query: {
                  id: `eq.${existingRecord.id}`,
                },
              });
              result.updated++;
              console.log(`[SupabaseScamDBSync] Updated: ${dbRecord.username}`);
            } else {
              result.unchanged++;
            }
          }
        } catch (error) {
          const errorMsg = `Error processing ${csvRecord['Scammer Name']}: ${error}`;
          result.errors.push(errorMsg);
          console.error(`[SupabaseScamDBSync] ${errorMsg}`);
        }
      }

      console.log(`[SupabaseScamDBSync] Sync complete: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged`);

    } catch (error) {
      result.errors.push(`Sync failed: ${error}`);
      console.error('[SupabaseScamDBSync] Sync failed:', error);
    }

    // Also sync legitimate accounts
    await this.syncLegitimateAccounts();

    // Run integrity check to remove any overlaps
    const integrityResult = await this.checkIntegrity();
    result.errors.push(...integrityResult.errors);

    return result;
  }

  /**
   * Sync legitimate accounts to legitimate_accounts table
   */
  private async syncLegitimateAccounts(): Promise<void> {
    const legitimateRecords = this.records.filter((record: any) => {
      const level = (record['Verification Level'] || '').toLowerCase();
      return level === 'legitimate' || level === 'paid promoter' || level === 'resolved';
    });

    console.log(`[SupabaseScamDBSync] Found ${legitimateRecords.length} legitimate accounts`);

    for (const record of legitimateRecords) {
      try {
        const level = (record['Verification Level'] || '').toLowerCase();
        const xHandle = (record['X Handle'] || record['Username'] || '').replace('@', '');
        const name = record['Scammer Name'] || record['Display Name'] || '';
        const notes = record['Notes'] || '';
        
        const followers = this.extractNumber(notes, 'followers');
        const accountAge = this.extractAccountAge(notes);
        const riskScore = this.extractRiskScore(notes);

        const legitimateAccount = {
          account_name: name,
          platform: 'X',
          x_handle: `@${xHandle}`,
          telegram_channel: record['Telegram Channel'] || null,
          verification_level: 'Legitimate',
          followers: followers,
          account_age_years: accountAge,
          verification_badge: true,
          red_flags_detected: level === 'paid promoter' ? ['paid_promotions'] : [],
          risk_score: riskScore,
          risk_level: this.getRiskLevel(riskScore),
          notes: `${record['Verification Level']} - ${notes}`,
        };

        // Check if already exists
        const existing = await this.supabaseRequest('legitimate_accounts', {
          method: 'GET',
          query: { x_handle: `eq.@${xHandle}` },
        });

        if (existing.length === 0) {
          await this.supabaseRequest('legitimate_accounts', {
            method: 'POST',
            body: legitimateAccount,
          });
          console.log(`[SupabaseScamDBSync] Added legitimate: ${name}`);
        }
      } catch (error) {
        console.error(`[SupabaseScamDBSync] Error syncing legitimate: ${error}`);
      }
    }
  }

  private extractNumber(text: string, key: string): number {
    const match = text.match(new RegExp(`([\\d.]+[KM]?)\\s*${key}`, 'i'));
    if (!match) return 0;
    const num = match[1];
    if (num.endsWith('K')) return parseFloat(num) * 1000;
    if (num.endsWith('M')) return parseFloat(num) * 1000000;
    return parseInt(num) || 0;
  }

  private extractAccountAge(text: string): number {
    const match = text.match(/(\d+)\+?\s*years?\s*(?:on\s+X|old)/i);
    return match ? parseInt(match[1]) : 0;
  }

  private extractRiskScore(text: string): number {
    const match = text.match(/Risk\s*(?:Score)?[:\s]+([\d.]+)\/10/i);
    return match ? parseFloat(match[1]) : 0;
  }

  private getRiskLevel(score: number): string {
    if (score <= 3) return 'LOW';
    if (score <= 5) return 'MEDIUM';
    if (score <= 7) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Check for and remove overlaps between legitimate_accounts and known_scammers
   * Ensures no account appears in both tables
   */
  async checkIntegrity(): Promise<{ overlapsRemoved: number; errors: string[] }> {
    const result = { overlapsRemoved: 0, errors: [] as string[] };
    
    console.log('[SupabaseScamDBSync] Running integrity check...');

    try {
      // Fetch all legitimate accounts
      const legitimateAccounts = await this.supabaseRequest('legitimate_accounts', {
        method: 'GET',
        query: { select: 'id,account_name,x_handle,telegram_channel' },
      });

      // Fetch all known scammers
      const knownScammers = await this.supabaseRequest('known_scammers', {
        method: 'GET',
        query: { select: 'id,display_name,x_handle,telegram_channel' },
      });

      // Build lookup sets
      const scammerXHandles = new Set<string>();
      const scammerTelegramChannels = new Set<string>();

      for (const scammer of knownScammers) {
        if (scammer.x_handle) {
          scammerXHandles.add(scammer.x_handle.toLowerCase().replace(/^@/, ''));
        }
        if (scammer.telegram_channel) {
          const channel = scammer.telegram_channel.toLowerCase().replace(/^@/, '').replace(/^t\.me\//, '');
          scammerTelegramChannels.add(channel);
        }
      }

      // Check for overlaps
      for (const account of legitimateAccounts) {
        let overlap = false;
        let matchType = '';
        let matchValue = '';

        // Check X handle
        if (account.x_handle) {
          const handle = account.x_handle.toLowerCase().replace(/^@/, '');
          if (scammerXHandles.has(handle)) {
            overlap = true;
            matchType = 'x_handle';
            matchValue = account.x_handle;
          }
        }

        // Check Telegram channel
        if (account.telegram_channel) {
          const channel = account.telegram_channel.toLowerCase().replace(/^@/, '').replace(/^t\.me\//, '');
          if (scammerTelegramChannels.has(channel)) {
            overlap = true;
            matchType = 'telegram_channel';
            matchValue = account.telegram_channel;
          }
        }

        if (overlap) {
          console.log(`[SupabaseScamDBSync] Removing overlap: ${account.account_name} (${matchType}: ${matchValue})`);
          
          // Remove from legitimate_accounts
          try {
            await this.supabaseRequest('legitimate_accounts', {
              method: 'DELETE',
              query: { id: `eq.${account.id}` },
            });
            result.overlapsRemoved++;
            console.log(`[SupabaseScamDBSync] ✓ Removed ${account.account_name} from legitimate_accounts`);
          } catch (error) {
            result.errors.push(`Failed to remove ${account.account_name}: ${error}`);
            console.error(`[SupabaseScamDBSync] ✗ Failed to remove ${account.account_name}: ${error}`);
          }
        }
      }

      if (result.overlapsRemoved === 0) {
        console.log('[SupabaseScamDBSync] ✅ No overlaps found. Database integrity verified.');
      } else {
        console.log(`[SupabaseScamDBSync] ✅ Removed ${result.overlapsRemoved} overlapping account(s)`);
      }

    } catch (error) {
      result.errors.push(`Integrity check failed: ${error}`);
      console.error('[SupabaseScamDBSync] Integrity check failed:', error);
    }

    return result;
  }
}

/**
 * Run sync manually (for testing)
 */
export async function runSync(): Promise<SyncResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const csvPath = process.env.SCAM_DB_CSV_PATH || '/Users/efinney/.openclaw/workspace/scammer-database.csv';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const sync = new SupabaseScamDBSync(
    { url: supabaseUrl, serviceRoleKey },
    csvPath
  );
  
  return sync.sync();
}