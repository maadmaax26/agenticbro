/**
 * Rate Limiting Middleware
 *
 * Enforces rate limits based on user tier
 */
import { Request, Response, NextFunction } from 'express';
export declare class RateLimiter {
    private redis;
    constructor();
    /**
     * Rate limit middleware for scan endpoints
     */
    scanLimit: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Rate limit middleware for verify endpoints
     */
    verifyLimit: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Track API usage for analytics
     */
    trackUsage: (userId: string, endpoint: string) => Promise<void>;
    /**
     * Get usage stats for a user
     */
    getUsageStats: (userId: string, days?: number) => Promise<UsageStats>;
}
interface UsageStats {
    scans: number;
    verifications: number;
    byDay: Record<string, {
        scans: number;
        verifications: number;
    }>;
}
export default RateLimiter;
//# sourceMappingURL=rate-limiter.d.ts.map