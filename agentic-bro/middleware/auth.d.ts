/**
 * Authentication Middleware
 *
 * Validates API keys and manages user sessions
 */
import { Request, Response, NextFunction } from 'express';
interface User {
    id: string;
    telegramId?: number;
    email?: string;
    tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';
    scansUsedToday: number;
    scansResetAt: Date;
    createdAt: Date;
}
export declare class Auth {
    private db;
    private redis;
    constructor();
    /**
     * Require valid API key
     */
    requireApiKey: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Optional API key (doesn't fail if missing)
     */
    optionalApiKey: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Require specific tier
     */
    requireTier: (...tiers: string[]) => (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Extract API key from request
     */
    private extractApiKey;
    /**
     * Validate API key and return user
     */
    private validateApiKey;
    /**
     * Update last used timestamp
     */
    private updateLastUsed;
    /**
     * Reset daily scan count
     */
    private resetDailyScans;
    /**
     * Hash API key for storage
     */
    private hashApiKey;
    /**
     * Generate new API key
     */
    generateApiKey(): string;
    /**
     * Create API key for user
     */
    createApiKey(userId: string, name?: string): Promise<string>;
    /**
     * Revoke API key
     */
    revokeApiKey(apiKeyId: string): Promise<void>;
    /**
     * Create new user
     */
    createUser(data: {
        telegramId?: number;
        email?: string;
        tier?: string;
    }): Promise<User>;
    /**
     * Get user by ID
     */
    getUser(userId: string): Promise<User | null>;
    /**
     * Update user tier
     */
    updateTier(userId: string, tier: string): Promise<void>;
}
export default Auth;
//# sourceMappingURL=auth.d.ts.map