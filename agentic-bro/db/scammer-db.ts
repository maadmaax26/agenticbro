/**
 * Scammer Database Client
 * 
 * Manages the database of known scammers for profile verification
 */

import { Pool, PoolClient, QueryResult } from 'pg';

export interface ScammerRecord {
  id: string;
  platform: 'twitter' | 'telegram' | 'discord' | 'instagram' | 'linkedin' | 'facebook' | 'other';
  username: string;
  displayName?: string;
  impersonating?: string;
  scamType: ScamType;
  victimCount: number;
  totalLostUsd: number;
  evidenceUrls: string[];
  firstReported: Date;
  lastSeen: Date;
  status: 'active' | 'suspended' | 'unknown';
  riskScore: number;
  aliases: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ScamType =
  // Crypto-specific
  | 'giveaway_fraud'
  | 'rug_pull'
  | 'wallet_drainer'
  | 'pig_butchering'
  // General fraud
  | 'investment_fraud'
  | 'ponzi_scheme'
  | 'phishing'
  | 'impersonation'
  | 'romance_scam'
  // General audience additions
  | 'job_offer_fraud'
  | 'landlord_rental_scam'
  | 'tech_support_fraud'
  | 'government_impersonation'
  | 'bank_impersonation'
  | 'fake_charity'
  | 'celebrity_endorsement_scam'
  | 'marketplace_seller_fraud'
  | 'other';

export interface ScammerSearchResult {
  results: ScammerRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export class ScammerDatabase {
  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Find scammer by username
   */
  async findByUsername(username: string): Promise<ScammerRecord | null> {
    const normalizedUsername = username.toLowerCase().replace(/^@/, '');

    const query = `
      SELECT * FROM known_scammers
      WHERE LOWER(username) = $1
      AND status != 'suspended'
      LIMIT 1
    `;

    const result = await this.pool.query(query, [normalizedUsername]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToRecord(result.rows[0]);
  }

  /**
   * Find similar usernames (for impersonation detection)
   */
  async findSimilarUsernames(
    username: string,
    displayName: string,
    limit: number = 10
  ): Promise<{ username: string; similarity: number; isScammer: boolean }[]> {
    const normalizedUsername = username.toLowerCase();
    const normalizedDisplayName = displayName.toLowerCase();

    const query = `
      SELECT 
        username,
        similarity(LOWER(username), $1) as username_similarity,
        similarity(LOWER(display_name), $2) as display_similarity,
        true as is_scammer
      FROM known_scammers
      WHERE 
        status != 'suspended'
        AND (
          similarity(LOWER(username), $1) > 0.5
          OR similarity(LOWER(display_name), $2) > 0.5
          OR $1 ILIKE '%' || LOWER(username) || '%'
          OR LOWER(username) ILIKE '%' || $1 || '%'
        )
      ORDER BY GREATEST(
        similarity(LOWER(username), $1),
        similarity(LOWER(display_name), $2)
      ) DESC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [normalizedUsername, normalizedDisplayName, limit]);

    return result.rows.map(row => ({
      username: row.username,
      similarity: Math.max(row.username_similarity, row.display_similarity),
      isScammer: row.is_scammer,
    }));
  }

  /**
   * Check if username is impersonating a known entity
   */
  async checkImpersonation(
    username: string,
    knownEntities: string[]
  ): Promise<{ isImpersonating: boolean; impersonating?: string; confidence: number }> {
    const normalizedUsername = username.toLowerCase().replace(/^@/, '');

    // Remove common suffixes to detect impersonation
    const baseUsername = normalizedUsername
      .replace(/_?(giveaway|airdrop|official|real|live|support|help|bot)$/i, '')
      .replace(/^(the_?)?/i, '');

    // Check if base username matches known entities
    for (const entity of knownEntities) {
      const normalizedEntity = entity.toLowerCase();
      
      if (baseUsername === normalizedEntity || 
          normalizedUsername.includes(normalizedEntity)) {
        return {
          isImpersonating: true,
          impersonating: entity,
          confidence: 0.9,
        };
      }
    }

    // Check against verified accounts database
    const verifiedQuery = `
      SELECT username, display_name
      FROM verified_accounts
      WHERE LOWER(username) = $1
         OR LOWER(display_name) = $1
    `;

    const verifiedResult = await this.pool.query(verifiedQuery, [baseUsername]);
    
    if (verifiedResult.rows.length > 0) {
      return {
        isImpersonating: true,
        impersonating: verifiedResult.rows[0].username,
        confidence: 0.85,
      };
    }

    return {
      isImpersonating: false,
      confidence: 0,
    };
  }

  /**
   * Report a new scammer
   */
  async report(report: ScammerReport): Promise<{ id: string; status: string }> {
    const query = `
      INSERT INTO scammer_reports (
        platform, username, display_name, scam_type, impersonating,
        evidence_urls, description, victim_amount, reporter_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, status
    `;

    const result = await this.pool.query(query, [
      report.platform,
      report.username.toLowerCase().replace(/^@/, ''),
      report.displayName,
      report.scamType,
      report.impersonating,
      report.evidenceUrls,
      report.description,
      report.victimAmount,
      report.reporterId,
    ]);

    return {
      id: result.rows[0].id,
      status: result.rows[0].status,
    };
  }

  /**
   * Search scammers with filters
   */
  async search(filters: ScammerSearchFilters): Promise<ScammerSearchResult> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (filters.platform) {
      conditions.push(`platform = $${paramIndex++}`);
      params.push(filters.platform);
    }

    if (filters.scamType) {
      conditions.push(`scam_type = $${paramIndex++}`);
      params.push(filters.scamType);
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.search) {
      conditions.push(`(
        username ILIKE $${paramIndex}
        OR display_name ILIKE $${paramIndex}
        OR notes ILIKE $${paramIndex}
      )`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM known_scammers ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const limit = filters.limit || 20;
    const offset = ((filters.page || 1) - 1) * limit;

    const query = `
      SELECT * FROM known_scammers
      ${whereClause}
      ORDER BY victim_count DESC, last_seen DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);

    return {
      results: result.rows.map(this.mapRowToRecord),
      pagination: {
        total,
        page: filters.page || 1,
        limit,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<ScammerStats> {
    const query = `
      SELECT
        COUNT(*) as total_scammers,
        SUM(victim_count) as total_victims,
        SUM(total_lost_usd) as total_lost,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_scammers,
        COUNT(CASE WHEN platform = 'twitter' THEN 1 END) as twitter_scammers,
        COUNT(CASE WHEN platform = 'telegram' THEN 1 END) as telegram_scammers,
        COUNT(CASE WHEN platform = 'instagram' THEN 1 END) as instagram_scammers,
        COUNT(CASE WHEN platform = 'linkedin' THEN 1 END) as linkedin_scammers,
        COUNT(CASE WHEN platform = 'facebook' THEN 1 END) as facebook_scammers,
        COUNT(CASE WHEN scam_type = 'giveaway_fraud' THEN 1 END) as giveaway_scams,
        COUNT(CASE WHEN scam_type = 'pig_butchering' THEN 1 END) as pig_butchering,
        COUNT(CASE WHEN scam_type = 'romance_scam' THEN 1 END) as romance_scams,
        COUNT(CASE WHEN scam_type = 'job_offer_fraud' THEN 1 END) as job_offer_fraud,
        COUNT(CASE WHEN scam_type = 'tech_support_fraud' THEN 1 END) as tech_support_fraud,
        COUNT(CASE WHEN scam_type = 'government_impersonation' THEN 1 END) as gov_impersonation,
        COUNT(CASE WHEN scam_type = 'bank_impersonation' THEN 1 END) as bank_impersonation,
        COUNT(CASE WHEN scam_type = 'fake_charity' THEN 1 END) as fake_charity,
        COUNT(CASE WHEN scam_type = 'marketplace_seller_fraud' THEN 1 END) as marketplace_fraud,
        MAX(updated_at) as last_updated
      FROM known_scammers
    `;

    const result = await this.pool.query(query);
    const row = result.rows[0];

    return {
      totalScammers: parseInt(row.total_scammers),
      totalVictims: parseInt(row.total_victims || 0),
      totalLostUsd: parseFloat(row.total_lost || 0),
      activeScammers: parseInt(row.active_scammers),
      byPlatform: {
        twitter: parseInt(row.twitter_scammers),
        telegram: parseInt(row.telegram_scammers),
        instagram: parseInt(row.instagram_scammers),
        linkedin: parseInt(row.linkedin_scammers),
        facebook: parseInt(row.facebook_scammers),
      },
      byType: {
        giveaway: parseInt(row.giveaway_scams),
        pigButchering: parseInt(row.pig_butchering),
        romanceScam: parseInt(row.romance_scams),
        jobOfferFraud: parseInt(row.job_offer_fraud),
        techSupportFraud: parseInt(row.tech_support_fraud),
        governmentImpersonation: parseInt(row.gov_impersonation),
        bankImpersonation: parseInt(row.bank_impersonation),
        fakeCharity: parseInt(row.fake_charity),
        marketplaceSellerFraud: parseInt(row.marketplace_fraud),
      },
      lastUpdated: row.last_updated,
    };
  }

  /**
   * Add or update scammer record
   */
  async upsert(scammer: Partial<ScammerRecord>): Promise<ScammerRecord> {
    const query = `
      INSERT INTO known_scammers (
        id, platform, username, display_name, impersonating,
        scam_type, victim_count, total_lost_usd, evidence_urls,
        first_reported, last_seen, status, risk_score, aliases, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      ON CONFLICT (platform, username) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        impersonating = EXCLUDED.impersonating,
        scam_type = EXCLUDED.scam_type,
        victim_count = EXCLUDED.victim_count,
        total_lost_usd = EXCLUDED.total_lost_usd,
        evidence_urls = array_cat(known_scammers.evidence_urls, EXCLUDED.evidence_urls),
        last_seen = GREATEST(known_scammers.last_seen, EXCLUDED.last_seen),
        status = EXCLUDED.status,
        risk_score = GREATEST(known_scammers.risk_score, EXCLUDED.risk_score),
        aliases = array_cat(known_scammers.aliases, EXCLUDED.aliases),
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      scammer.id || this.generateId(),
      scammer.platform,
      scammer.username?.toLowerCase().replace(/^@/, ''),
      scammer.displayName,
      scammer.impersonating,
      scammer.scamType,
      scammer.victimCount || 0,
      scammer.totalLostUsd || 0,
      scammer.evidenceUrls || [],
      scammer.firstReported || new Date(),
      scammer.lastSeen || new Date(),
      scammer.status || 'active',
      scammer.riskScore || 50,
      scammer.aliases || [],
      scammer.notes,
    ]);

    return this.mapRowToRecord(result.rows[0]);
  }

  /**
   * Map database row to ScammerRecord
   */
  private mapRowToRecord(row: any): ScammerRecord {
    return {
      id: row.id,
      platform: row.platform,
      username: row.username,
      displayName: row.display_name,
      impersonating: row.impersonating,
      scamType: row.scam_type,
      victimCount: row.victim_count,
      totalLostUsd: parseFloat(row.total_lost_usd),
      evidenceUrls: row.evidence_urls,
      firstReported: row.first_reported,
      lastSeen: row.last_seen,
      status: row.status,
      riskScore: row.risk_score,
      aliases: row.aliases,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `SCM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Type definitions
interface ScammerReport {
  platform: 'twitter' | 'telegram' | 'discord' | 'instagram' | 'linkedin' | 'facebook' | 'other';
  username: string;
  displayName?: string;
  scamType: ScamType;
  impersonating?: string;
  evidenceUrls: string[];
  description: string;
  victimAmount?: number;
  reporterId?: string;
}

interface ScammerSearchFilters {
  platform?: string;
  scamType?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface ScammerStats {
  totalScammers: number;
  totalVictims: number;
  totalLostUsd: number;
  activeScammers: number;
  byPlatform: {
    twitter: number;
    telegram: number;
    instagram: number;
    linkedin: number;
    facebook: number;
  };
  byType: {
    // Crypto
    giveaway: number;
    pigButchering: number;
    // General
    romanceScam: number;
    jobOfferFraud: number;
    techSupportFraud: number;
    governmentImpersonation: number;
    bankImpersonation: number;
    fakeCharity: number;
    marketplaceSellerFraud: number;
  };
  lastUpdated: Date;
}

export default ScammerDatabase;