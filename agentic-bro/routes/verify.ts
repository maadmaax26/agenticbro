/**
 * Profile Verifier API Routes
 */

import { Router, Request, Response } from 'express';
import { ProfileVerifier } from '../services/profile-verifier';
import { RateLimiter } from '../middleware/rate-limiter';
import { Auth } from '../middleware/auth';

const router = Router();

// Initialize services
const verifier = new ProfileVerifier({
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

const limiter = new RateLimiter();
const auth = new Auth();

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
  auth.requireApiKey,
  limiter.verifyLimit,
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
      const result = await verifier.verify(platform, cleanUsername, {
        deepScan: options?.deepScan || false,
        includeMedia: options?.includeMedia || false,
        sampleFollowers: options?.sampleFollowers || false,
        forceRefresh: options?.forceRefresh || false,
        verificationContext: verificationContext || 'general',
      });

      // Track usage
      await limiter.trackUsage(req.user!.id, 'verify');

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
  auth.requireApiKey,
  limiter.verifyLimit,
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
  auth.requireApiKey,
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
  auth.requireApiKey,
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
  auth.requireApiKey,
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

export default router;