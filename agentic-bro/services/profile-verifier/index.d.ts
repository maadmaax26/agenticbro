/**
 * Profile Verifier Service
 *
 * Verifies social media profiles for authenticity, detecting:
 * - Bot followers
 * - AI-generated/deepfake content
 * - Known scammers
 * - Impersonation attempts
 */
export interface ProfileVerifyRequest {
    platform: 'twitter' | 'telegram' | 'discord';
    username: string;
    options?: {
        deepScan?: boolean;
        includeMedia?: boolean;
        sampleFollowers?: boolean;
        forceRefresh?: boolean;
    };
}
export interface VerifyResult {
    success: boolean;
    data?: {
        profile: ProfileInfo;
        authenticityScore: number;
        riskLevel: RiskLevel;
        categories: {
            verification: CategoryResult;
            botDetection: CategoryResult;
            deepfake: CategoryResult;
            impersonation: CategoryResult;
            activity: CategoryResult;
        };
        redFlags: string[];
        warnings: string[];
        recommendation: string;
        scanTime: string;
        scanDuration: string;
        cacheHit: boolean;
    };
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}
export interface ProfileInfo {
    platform: string;
    username: string;
    displayName: string;
    verified: boolean;
    verifiedType?: string;
    followers: number;
    following: number;
    tweets?: number;
    createdAt: string;
    profileImage?: string;
    bio?: string;
    location?: string;
    website?: string;
}
export interface CategoryResult {
    score: number;
    maxScore: number;
    status: 'VERIFIED' | 'SAFE' | 'SKIPPED' | 'LOW' | 'MEDIUM' | 'HIGH' | 'UNSAFE' | 'SCAM';
    weight: number;
    details: Record<string, any>;
}
export type RiskLevel = 'VERIFIED' | 'SAFE' | 'CAUTION' | 'UNSAFE' | 'SCAM';
export declare class ProfileVerifier {
    private twitter;
    private botometer;
    private deepfake;
    private scammerDb;
    private cache;
    private calculator;
    constructor(config: VerifierConfig);
    /**
     * Verify a social media profile
     */
    verify(platform: string, username: string, options?: VerifyOptions): Promise<VerifyResult>;
    /**
     * Fetch profile data from platform
     */
    private fetchProfileData;
    /**
     * Check verification status
     */
    private checkVerification;
    /**
     * Analyze follower authenticity for bot detection
     */
    private analyzeBots;
    /**
     * Analyze profile media for deepfake detection
     */
    private analyzeDeepfake;
    /**
     * Check for impersonation and known scammers
     */
    private checkImpersonation;
    /**
     * Analyze account activity patterns
     */
    private analyzeActivity;
    private normalizeUsername;
    private determineRiskLevel;
    private extractProfileInfo;
    private extractRedFlags;
    private extractWarnings;
    private generateRecommendation;
    private getCacheTTL;
    private estimateFakeFollowers;
    private calculateEngagementAuthenticity;
    private findSimilarUsernames;
    private calculateImpersonationRisk;
    private analyzePostingPatterns;
    private detectSuspiciousPatterns;
    private formatAge;
    private fetchImage;
    private fetchTelegramProfile;
    private fetchDiscordProfile;
}
interface VerifierConfig {
    twitterConfig: any;
    botometerApiKey: string;
    deepfakeModelPath: string;
    databaseUrl: string;
    redisUrl: string;
}
interface VerifyOptions {
    deepScan?: boolean;
    includeMedia?: boolean;
    sampleFollowers?: boolean;
    forceRefresh?: boolean;
}
export default ProfileVerifier;
//# sourceMappingURL=index.d.ts.map