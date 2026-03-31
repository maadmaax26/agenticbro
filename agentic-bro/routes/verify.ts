/**
 * Profile Verifier API Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ProfileVerifier } from '../services/profile-verifier';
import { RateLimiter } from '../middleware/rate-limiter';
import { Auth } from '../middleware/auth';

const router = Router();

// Initialize services (conditionally)
let verifier: ProfileVerifier | null = null;
let limiter: RateLimiter | null = null;
let auth: Auth | null = null;

// Only initialize services if database is configured
if (process.env.DATABASE_URL) {
  verifier = new ProfileVerifier({
    twitterConfig: {
      apiKey: process.env.TWITTER_API_KEY!,
      apiSecret: process.env.TWITTER_API_SECRET!,
      bearerToken: process.env.TWITTER_BEARER_TOKEN!,
    },
    puppeteerEndpoint: process.env.PUPPETEER_ENDPOINT || 'http://localhost:18800',
    botometerApiKey: process.env.BOTOMETER_API_KEY!,
    deepfakeModelPath: process.env.DEEPFAKE_MODEL_PATH!,
    databaseUrl: process.env.DATABASE_URL!,
    redisUrl: process.env.REDIS_URL!,
  });
  
  limiter = new RateLimiter();
  auth = new Auth();
}

// Development mode auth middleware (bypass if no database)
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // In development mode without database, allow all requests
  if (!process.env.DATABASE_URL || process.env.NODE_ENV !== 'production') {
    (req as any).user = {
      id: 'dev-user',
      tier: 'enterprise',
      scansUsedToday: 0,
      scansResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };
    return next();
  }
  
  // In production, require valid API key
  if (!auth) {
    return res.status(500).json({
      success: false,
      error: { code: 'AUTH_NOT_CONFIGURED', message: 'Authentication service not available' }
    });
  }
  
  return auth.requireApiKey(req, res, next);
};

// Rate limit middleware (bypass if no Redis)
const checkRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  if (!limiter) {
    return next();
  }
  return limiter.verifyLimit(req, res, next);
};

/**
 * POST /api/v1/verify/profile
 * 
 * Verify a social media profile
 * 
 * Request Body:
 * {
 *   "platform": "twitter",
 *   "username": "elonmusk",
 *   "options": {
 *     "deepScan": true,
 *     "includeMedia": true,
 *     "sampleFollowers": false
 *   }
 * }
 */
router.post('/profile',
  requireAuth,
  checkRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { platform, username, options } = req.body;

      // Validate platform
      const SUPPORTED_PLATFORMS = ['twitter', 'telegram', 'discord', 'instagram', 'linkedin', 'facebook'];
      if (!SUPPORTED_PLATFORMS.includes(platform)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PLATFORM',
            message: `Platform must be one of: ${SUPPORTED_PLATFORMS.join(', ')}`,
            supported: SUPPORTED_PLATFORMS,
          },
        });
      }

      // Validate verificationContext if provided
      const SUPPORTED_CONTEXTS = ['crypto', 'romance', 'employment', 'marketplace', 'financial', 'general'];
      const { verificationContext } = req.body;
      if (verificationContext && !SUPPORTED_CONTEXTS.includes(verificationContext)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONTEXT',
            message: `verificationContext must be one of: ${SUPPORTED_CONTEXTS.join(', ')}`,
            supported: SUPPORTED_CONTEXTS,
          },
        });
      }

      // Validate username
      if (!username || typeof username !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USERNAME',
            message: 'Username is required',
          },
        });
      }

      // Clean username
      const cleanUsername = username.replace(/^@/, '').trim();

      if (cleanUsername.length < 1 || cleanUsername.length > 100) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USERNAME',
            message: 'Username must be between 1 and 100 characters',
          },
        });
      }

      // Perform verification
      let result;
      
      if (verifier) {
        // Use real verifier when available
        result = await verifier.verify(platform, cleanUsername, {
          deepScan: options?.deepScan || false,
          includeMedia: options?.includeMedia || false,
          sampleFollowers: options?.sampleFollowers || false,
          forceRefresh: options?.forceRefresh || false,
          verificationContext: verificationContext || 'general',
        });
      } else {
        // Development fallback - return demo result
        result = generateDemoResult(platform, cleanUsername, verificationContext || 'general');
      }

      // Track usage
      if (limiter) {
        await limiter.trackUsage((req as any).user!.id, 'verify');
      }

      res.json(result);

    } catch (error) {
      console.error('Profile verification error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VERIFICATION_ERROR',
          message: 'An unexpected error occurred during verification',
          details: process.env.NODE_ENV === 'development' 
            ? error instanceof Error ? error.message : 'Unknown error'
            : undefined,
        },
      });
    }
  }
);

/**
 * GET /api/v1/verify/profile/:username/history
 * 
 * Get verification history for a profile
 */
router.get('/profile/:username/history',
  requireAuth,
  checkRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      const { days = 30, platform = 'twitter' } = req.query;

      // Implementation would fetch from database
      const history = await getVerificationHistory(
        platform as string,
        username,
        Number(days)
      );

      res.json({
        success: true,
        data: history,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'HISTORY_ERROR',
          message: 'Failed to retrieve verification history',
        },
      });
    }
  }
);

/**
 * GET /api/v1/verify/profile/:username/scammers
 * 
 * Check if username matches known scammers
 */
router.get('/profile/:username/scammers',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { username } = req.params;

      const scammerCheck = await checkScammerDatabase(username);

      res.json({
        success: true,
        data: scammerCheck,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SCAMMER_CHECK_ERROR',
          message: 'Failed to check scammer database',
        },
      });
    }
  }
);

/**
 * POST /api/v1/scammers/report
 * 
 * Report a scammer
 */
router.post('/scammers/report',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const report = req.body;

      // Validate required fields
      if (!report.platform || !report.username || !report.scamType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'platform, username, and scamType are required',
          },
        });
      }

      // Submit report
      const result = await submitScammerReport({
        platform: report.platform,
        username: report.username,
        displayName: report.displayName,
        scamType: report.scamType,
        impersonating: report.impersonating,
        evidenceUrls: report.evidence || [],
        description: report.description,
        victimAmount: report.victimAmount,
        reporterId: req.user?.id,
      });

      res.status(201).json({
        success: true,
        data: {
          reportId: result.id,
          status: result.status,
          estimatedReview: '24-48 hours',
          message: 'Thank you for your report. Our team will review within 24-48 hours.',
        },
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'REPORT_ERROR',
          message: 'Failed to submit report',
        },
      });
    }
  }
);

/**
 * GET /api/v1/scammers/search
 * 
 * Search scammer database
 */
router.get('/scammers/search',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const filters = {
        platform: req.query.platform as string,
        scamType: req.query.scamType as string,
        status: req.query.status as string,
        search: req.query.q as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      };

      const results = await searchScammers(filters);

      res.json({
        success: true,
        data: results,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: 'Failed to search scammer database',
        },
      });
    }
  }
);

/**
 * GET /api/v1/scammers/stats
 * 
 * Get scammer database statistics
 */
router.get('/scammers/stats',
  async (req: Request, res: Response) => {
    try {
      const stats = await getScammerStats();

      res.json({
        success: true,
        data: stats,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: 'Failed to retrieve statistics',
        },
      });
    }
  }
);

// Helper functions (would be implemented in separate service files)

async function getVerificationHistory(
  platform: string,
  username: string,
  days: number
): Promise<any> {
  // Would query database for historical scans
  return {
    platform,
    username,
    history: [],
  };
}

async function checkScammerDatabase(username: string): Promise<any> {
  // Would query scammer database
  return {
    username,
    isScammer: false,
    scammerRecord: null,
    similarAccounts: [],
  };
}

async function submitScammerReport(report: any): Promise<any> {
  // Would insert into database
  return {
    id: `RPT-${Date.now()}`,
    status: 'pending_review',
  };
}

async function searchScammers(filters: any): Promise<any> {
  // Would query database
  return {
    results: [],
    pagination: {
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    },
  };
}

async function getScammerStats(): Promise<any> {
  // Would query database
  return {
    totalScammers: 0,
    totalVictims: 0,
    totalLostUsd: 0,
  };
}

// Demo result generator for development mode
function generateDemoResult(platform: string, username: string, verificationContext: string): any {
  // Detect common scam patterns in username
  const lowerUsername = username.toLowerCase();
  
  const scamPatterns: Record<string, { type: string; riskScore: number; flags: string[] }> = {
    'giveaway': { type: 'Giveaway Scam', riskScore: 90, flags: ['Giveaway scam pattern in username', 'Typical scammer naming convention', 'Likely impersonating legitimate account'] },
    'elon': { type: 'Celebrity Impersonation', riskScore: 85, flags: ['Celebrity name in username', 'Likely impersonation attempt', 'Common scam tactic'] },
    'crypto': { type: 'Crypto Scam', riskScore: 75, flags: ['Crypto-related username', 'Potential rug pull promoter', 'High-risk category'] },
    'airdrop': { type: 'Airdrop Scam', riskScore: 88, flags: ['Airdrop scam pattern', 'Wallet drainer likely', 'Do not connect wallet'] },
    'free': { type: 'Free Money Scam', riskScore: 80, flags: ['"Free" in username', 'Too good to be true', 'Classic scam pattern'] },
    'winner': { type: 'Lottery Scam', riskScore: 82, flags: ['Winner/lottery pattern', 'Fake prize offer', 'Advance fee scam likely'] },
    'support': { type: 'Support Scam', riskScore: 78, flags: ['Fake support account', 'Will ask for seed phrase', 'Social engineering'] },
    'admin': { type: 'Impersonation', riskScore: 75, flags: ['Admin impersonation', 'Not an official account', 'Will DM asking for info'] },
    'official': { type: 'Impersonation', riskScore: 72, flags: ['Fake "official" account', 'Not verified', 'Scam indicator'] },
  };

  // Check for scam patterns
  let detectedType: string | undefined;
  let riskScore = 25; // Default low risk
  let redFlags: string[] = ['Profile analyzed with available data'];
  
  for (const [pattern, data] of Object.entries(scamPatterns)) {
    if (lowerUsername.includes(pattern)) {
      detectedType = data.type;
      riskScore = data.riskScore;
      redFlags = data.flags;
      break;
    }
  }

  // Generate profile data
  const followerCount = Math.floor(Math.random() * 50000) + 100;
  const followingCount = Math.floor(Math.random() * 5000) + 50;
  const postCount = Math.floor(Math.random() * 1000) + 10;

  // Determine risk level
  const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 
    riskScore >= 75 ? 'CRITICAL' :
    riskScore >= 50 ? 'HIGH' :
    riskScore >= 30 ? 'MEDIUM' : 'LOW';

  // Generate recommendation
  let recommendation: string;
  if (riskLevel === 'CRITICAL') {
    recommendation = `🚨 AVOID THIS ACCOUNT. High probability of scam activity detected. Do not send funds, share personal information, or click any links. Report this account to ${platform}.`;
  } else if (riskLevel === 'HIGH') {
    recommendation = `⚠️ Exercise extreme caution. Multiple scam indicators detected. Verify through official channels before engaging. Never share wallet seed phrases or send funds.`;
  } else if (riskLevel === 'MEDIUM') {
    recommendation = `⚡ Proceed with caution. Some suspicious indicators found. Verify the account through official channels before engaging in any transactions.`;
  } else {
    recommendation = `✅ No major scam indicators detected. However, always verify accounts independently before sharing sensitive information or sending funds.`;
  }

  return {
    success: true,
    platform,
    username,
    displayName: `${username}'s Profile`,
    verified: false,
    riskScore,
    riskLevel,
    scamType: detectedType,
    redFlags,
    evidence: riskScore >= 50 
      ? ['Pattern matching indicates potential scam', 'Username contains suspicious elements', 'Recommend manual verification']
      : ['No strong scam indicators detected', 'Standard profile analysis complete'],
    recommendation,
    profileData: {
      followers: followerCount,
      following: followingCount,
      posts: postCount,
      bio: `${username} - Official account`,
      joinDate: new Date().toISOString().split('T')[0],
    },
    confidence: riskScore >= 50 ? 'HIGH' : 'MEDIUM',
    scanDate: new Date().toISOString(),
  };
}

export default router;