/**
 * Scammer Database Client
 *
 * Manages the database of known scammers for profile verification
 */
export interface ScammerRecord {
    id: string;
    platform: 'twitter' | 'telegram' | 'discord' | 'other';
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
export type ScamType = 'giveaway_fraud' | 'investment_fraud' | 'pig_butchering' | 'phishing' | 'impersonation' | 'rug_pull' | 'wallet_drainer' | 'ponzi_scheme' | 'romance_scam' | 'other';
export interface ScammerSearchResult {
    results: ScammerRecord[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        hasMore: boolean;
    };
}
export declare class ScammerDatabase {
    private pool;
    constructor(databaseUrl: string);
    /**
     * Find scammer by username
     */
    findByUsername(username: string): Promise<ScammerRecord | null>;
    /**
     * Find similar usernames (for impersonation detection)
     */
    findSimilarUsernames(username: string, displayName: string, limit?: number): Promise<{
        username: string;
        similarity: number;
        isScammer: boolean;
    }[]>;
    /**
     * Check if username is impersonating a known entity
     */
    checkImpersonation(username: string, knownEntities: string[]): Promise<{
        isImpersonating: boolean;
        impersonating?: string;
        confidence: number;
    }>;
    /**
     * Report a new scammer
     */
    report(report: ScammerReport): Promise<{
        id: string;
        status: string;
    }>;
    /**
     * Search scammers with filters
     */
    search(filters: ScammerSearchFilters): Promise<ScammerSearchResult>;
    /**
     * Get statistics
     */
    getStats(): Promise<ScammerStats>;
    /**
     * Add or update scammer record
     */
    upsert(scammer: Partial<ScammerRecord>): Promise<ScammerRecord>;
    /**
     * Map database row to ScammerRecord
     */
    private mapRowToRecord;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Close database connection
     */
    close(): Promise<void>;
}
interface ScammerReport {
    platform: 'twitter' | 'telegram' | 'discord' | 'other';
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
    };
    byType: {
        giveaway: number;
        pigButchering: number;
    };
    lastUpdated: Date;
}
export default ScammerDatabase;
//# sourceMappingURL=scammer-db.d.ts.map