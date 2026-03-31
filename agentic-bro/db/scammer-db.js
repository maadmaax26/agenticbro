"use strict";
/**
 * Scammer Database Client
 *
 * Manages the database of known scammers for profile verification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScammerDatabase = void 0;
const pg_1 = require("pg");
class ScammerDatabase {
    pool;
    constructor(databaseUrl) {
        this.pool = new pg_1.Pool({
            connectionString: databaseUrl,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }
    /**
     * Find scammer by username
     */
    async findByUsername(username) {
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
    async findSimilarUsernames(username, displayName, limit = 10) {
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
    async checkImpersonation(username, knownEntities) {
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
    async report(report) {
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
    async search(filters) {
        const conditions = [];
        const params = [];
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
    async getStats() {
        const query = `
      SELECT 
        COUNT(*) as total_scammers,
        SUM(victim_count) as total_victims,
        SUM(total_lost_usd) as total_lost,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_scammers,
        COUNT(CASE WHEN platform = 'twitter' THEN 1 END) as twitter_scammers,
        COUNT(CASE WHEN platform = 'telegram' THEN 1 END) as telegram_scammers,
        COUNT(CASE WHEN scam_type = 'giveaway_fraud' THEN 1 END) as giveaway_scams,
        COUNT(CASE WHEN scam_type = 'pig_butchering' THEN 1 END) as pig_butchering,
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
            },
            byType: {
                giveaway: parseInt(row.giveaway_scams),
                pigButchering: parseInt(row.pig_butchering),
            },
            lastUpdated: row.last_updated,
        };
    }
    /**
     * Add or update scammer record
     */
    async upsert(scammer) {
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
    mapRowToRecord(row) {
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
    generateId() {
        return `SCM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
    }
    /**
     * Close database connection
     */
    async close() {
        await this.pool.end();
    }
}
exports.ScammerDatabase = ScammerDatabase;
exports.default = ScammerDatabase;
//# sourceMappingURL=scammer-db.js.map