/**
 * Token Scanner API Routes
 * 
 * REST API endpoints for token scanning and profile verification
 */

import { Router, Request, Response } from 'express';
import { TokenScanner, TokenScanResult } from '../services/token-scanner';
import { Pool } from 'pg';
import { Cache } from '../utils/cache';
import { ChromeProfileFetcher } from '../clients/chrome-fetcher';

const router = Router();

// Dependencies (would be injected in production)
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const cache = new Cache(redisUrl);
const scanner = new TokenScanner({ cache, db });

// Chrome CDP endpoint
const CHROME_CDP_URL = process.env.CHROME_CDP_URL || 'http://localhost:18800';

// Initialize Chrome profile fetcher
const chromeFetcher = new ChromeProfileFetcher(CHROME_CDP_URL);

/**
 * POST /api/v1/scan/profile
 * 
 * Scan a social media profile using Chrome CDP
 */
router.post('/profile', async (req: Request, res: Response) => {
  try {
    const { platform, username } = req.body;

    // Validate required fields
    if (!platform || !username) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'platform and username are required',
        },
      });
    }

    // Clean username
    const cleanUsername = username.replace(/^@/, '').trim();
    
    // Only Twitter/X is supported via Chrome CDP
    if (platform !== 'twitter') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_PLATFORM',
          message: 'Only Twitter/X profiles are supported for real-time scanning',
          suggestion: 'Use pattern-based detection for other platforms',
        },
      });
    }

    // Scan profile via Chrome CDP
    const result = await scanTwitterProfile(cleanUsername);

    return res.json(result);

  } catch (error: any) {
    console.error('Profile scan error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SCAN_ERROR',
        message: 'Failed to scan profile',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    });
  }
});

/**
 * Scan Twitter profile using Chrome CDP
 */
/**
 * Scan Twitter profile using Chrome CDP via ChromeProfileFetcher
 * Falls back to web scrape if Chrome CDP is unavailable
 */
async function scanTwitterProfile(username: string): Promise<any> {
  console.log(`[scanTwitterProfile] Starting scan for @${username}`);
  
  // Try Chrome CDP first (more accurate)
  try {
    const chromeAvailable = await chromeFetcher.isAvailable();
    
    if (chromeAvailable) {
      console.log(`[scanTwitterProfile] Chrome CDP available, using real browser scan`);
      const profileData = await chromeFetcher.fetchProfile(username);
      
      if (profileData) {
        console.log(`[scanTwitterProfile] Successfully fetched profile via Chrome CDP`);
        
        // Calculate risk score based on profile data
        const riskAnalysis = analyzeProfileRisk(profileData);
        
        return {
          success: true,
          data: {
            platform: 'twitter',
            username: `@${profileData.username}`,
            displayName: profileData.displayName,
            verified: profileData.verified,
            verifiedType: profileData.verifiedType,
            followers: profileData.followers,
            following: profileData.following,
            posts_count: profileData.tweets,
            bio: profileData.bio,
            location: profileData.location,
            website: profileData.website,
            profileImage: profileData.profileImage,
            createdAt: profileData.createdAt,
            ...riskAnalysis,
          },
          source: 'chrome_cdp',
          scanTime: new Date().toISOString(),
        };
      }
    }
  } catch (error: any) {
    console.error(`[scanTwitterProfile] Chrome CDP error: ${error.message}`);
  }
  
  // Fallback: Web scrape (less accurate but always available)
  console.log(`[scanTwitterProfile] Falling back to web scrape`);
  return await scanTwitterProfileFallback(username);
}

/**
 * Fallback: Scan Twitter profile using simple web fetch
 * Used when Chrome CDP is not available
 */
async function scanTwitterProfileFallback(username: string): Promise<any> {
  const fetch = require('node-fetch');
  
  try {
    const response = await fetch(`https://x.com/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        source: 'web_scrape',
      };
    }
    
    const html = await response.text();
    const profileData = parseProfileHtml(html, username);
    
    if (!profileData) {
      return {
        success: false,
        error: 'Could not parse profile data from page',
        source: 'web_scrape',
      };
    }
    
    const riskAnalysis = analyzeProfileRisk(profileData);
    
    return {
      success: true,
      data: {
        platform: 'twitter',
        username: `@${username}`,
        ...profileData,
        ...riskAnalysis,
      },
      source: 'web_scrape',
      scanTime: new Date().toISOString(),
    };
    
  } catch (error: any) {
    console.error(`[scanTwitterProfileFallback] Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      source: 'web_scrape',
    };
  }
}

/**
 * Parse number with K/M suffix
 */
function parseNumber(str: string): number {
  const num = str.replace(/,/g, '');
  if (num.includes('K')) {
    return parseFloat(num) * 1000;
  }
  if (num.includes('M')) {
    return parseFloat(num) * 1000000;
  }
  return parseInt(num) || 0;
}

/**
 * Parse profile data from HTML response
 */
function parseProfileHtml(html: string, username: string): any {
  const profile: any = {
    username,
    displayName: username,
    verified: false,
    followers: 0,
    following: 0,
    tweets: 0,
    bio: '',
  };
  
  // Extract from meta tags
  const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
  const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  
  if (ogTitle) profile.displayName = ogTitle[1];
  if (ogDesc) {
    profile.bio = ogDesc[1];
    // Try to extract follower count from description
    const followerMatch = ogDesc[1].match(/([\d,\.]+[KM]?)\s*Followers?/i);
    if (followerMatch) profile.followers = parseNumber(followerMatch[1]);
  }
  if (ogImage) profile.profileImage = ogImage[1];
  
  // Check for verified badge
  if (html.includes('verified') || html.includes('isVerified')) {
    profile.verified = true;
  }
  
  return profile;
}

/**
 * Analyze profile for risk indicators using the 90-point unified scoring system
 * Red flags: guaranteed_returns(25), giveaway_airdrop(20), dm_solicitation(15),
 *   free_crypto(15), alpha_dm_scheme(15), unrealistic_claims(10), download_install(10),
 *   urgency_tactics(10), emotional_manipulation(10), low_credibility(10)
 * Risk levels: 0-3 LOW, 3-5 MEDIUM, 5-7 HIGH, 7+ CRITICAL (out of 10)
 */
function analyzeProfileRisk(profileData: any): any {
  const redFlags: { flag: string; points: number }[] = [];
  let totalPoints = 0; // Out of 90 max
  
  const bio = (profileData.bio || '').toLowerCase();
  const displayName = (profileData.displayName || '').toLowerCase();
  const combined = `${bio} ${displayName}`.toLowerCase();
  const followers = profileData.followers || 0;
  const following = profileData.following || 0;
  
  // guaranteed_returns (25pts) — promises of guaranteed profits, risk-free returns
  if (/guarantee|100%|risk.?free|can'?t lose|sure.?thing|guaranteed.?return|safe.?bet/i.test(combined)) {
    redFlags.push({ flag: 'Guaranteed returns language', points: 25 });
    totalPoints += 25;
  }
  
  // giveaway_airdrop (20pts) — giveaways, airdrops, free token promotions
  if (/giveaway|airdrop|free.*token|free.*crypto|claim.*now|give.?away|raffle/i.test(combined)) {
    redFlags.push({ flag: 'Giveaway/airdrop promotion', points: 20 });
    totalPoints += 20;
  }
  
  // dm_solicitation (15pts) — "DM me", "DM for", sliding into DMs requested
  if (/dm.?for|dm.?me|slide.?into|slide.?dm|dm.?to.?join|dm.?lfg|dm.?now|message.?me|hit.?my.?dm/i.test(combined)) {
    redFlags.push({ flag: 'DM solicitation in bio', points: 15 });
    totalPoints += 15;
  }
  
  // free_crypto (15pts) — offering free crypto, mining, staking rewards
  if (/free.*crypto|free.*sol|free.*btc|free.*eth|mining.*reward|passive.*income|stake.*earn|earn.*free/i.test(combined)) {
    redFlags.push({ flag: 'Free crypto/money offers', points: 15 });
    totalPoints += 15;
  }
  
  // alpha_dm_scheme (15pts) — private alpha, VIP groups, exclusive signals
  if (/private.*alpha|vip.*group|exclusive.*signal|signal.*group|premium.*group|inner.?circle|secret.?group|t\.me\//i.test(combined)) {
    redFlags.push({ flag: 'Alpha/DM scheme — private group funnel', points: 15 });
    totalPoints += 15;
  }
  
  // unrealistic_claims (10pts) — 10x, 100x, moonshot, get rich
  if (/\d+x(?!.*size)|100x|1000x|moonshot|to.?the.?moon|get.?rich|lamborghini|financial.?freedom|10x.?100x/i.test(combined)) {
    redFlags.push({ flag: 'Unrealistic profit claims', points: 10 });
    totalPoints += 10;
  }
  
  // download_install (10pts) — requests to download apps or install software
  if (/download|install.*app|get.*app|app.?store|play.?store|download.*now/i.test(combined)) {
    redFlags.push({ flag: 'Download/install request', points: 10 });
    totalPoints += 10;
  }
  
  // urgency_tactics (10pts) — act now, limited time, last chance
  if (/limited.*spot|act.?now|last.?chance|hurry|time.?sensitive|ending.?soon|closing.?soon|few.?left|don'?t.?wait|fomo/i.test(combined)) {
    redFlags.push({ flag: 'Urgency tactics', points: 10 });
    totalPoints += 10;
  }
  
  // emotional_manipulation (10pts) — fear of missing out, emotional appeals
  if (/you'?ll.?regret|don'?t.?miss.?out|life.?changing|once.?in.?lifetime|never.?again|must.?have|opportunity.?of/i.test(combined)) {
    redFlags.push({ flag: 'Emotional manipulation', points: 10 });
    totalPoints += 10;
  }
  
  // low_credibility (10pts) — suspicious follower ratios, new accounts, no verification
  const followRatio = followers > 0 ? following / followers : 0;
  if (followRatio > 2.0 && followers < 5000) {
    redFlags.push({ flag: `Suspicious follower ratio (${following}/${followers})`, points: 10 });
    totalPoints += 10;
  } else if (followRatio > 0.5 && following > 10000 && followers < following * 0.3) {
    redFlags.push({ flag: 'Engagement pod pattern (following >> followers)', points: 10 });
    totalPoints += 10;
  } else if (followers < 100) {
    redFlags.push({ flag: 'Very low follower count', points: 10 });
    totalPoints += 10;
  }
  
  // Additional: Telegram link (common scam vector)
  if (/t\.me\/|telegram\.me\//i.test(combined)) {
    // Only add if not already caught by alpha_dm_scheme
    if (!redFlags.some(f => f.flag.includes('Alpha/DM scheme'))) {
      redFlags.push({ flag: 'Telegram link in bio (common scam vector)', points: 5 });
      totalPoints += 5;
    }
  }
  
  // Additional: Marketing/advertising in bio
  if (/advertis|market.*agency|promo.*service|shill|paid.*promo|sponsored.*post/i.test(combined)) {
    redFlags.push({ flag: 'Marketing/advertising service (paid shill account)', points: 5 });
    totalPoints += 5;
  }
  
  // Convert 90-point total to 0-10 scale
  const riskScore = Math.min(totalPoints / 9, 10); // 90pts = 10/10
  
  // Determine risk level
  const riskLevel = riskScore >= 7 ? 'CRITICAL' : riskScore >= 5 ? 'HIGH' : riskScore >= 3 ? 'MEDIUM' : 'LOW';
  
  // Determine verification level
  let verificationLevel = 'Unverified';
  if (riskScore >= 7) verificationLevel = 'HIGH RISK';
  else if (profileData.verified && followers > 10000) verificationLevel = 'Verified';
  else if (followers > 5000) verificationLevel = 'Partially Verified';
  
  return {
    redFlags: redFlags.map(f => `${f.flag} (${f.points}pts)`),
    riskScore: Math.round(riskScore * 10) / 10,
    riskLevel,
    verificationLevel,
    totalPoints,
    maxPoints: 90,
  };
}

/**
 * POST /api/v1/scan/profile/queue
 * 
 * Submit a profile scan job to the Supabase queue
 * Returns job_id for frontend to poll for results
 */
router.post('/profile/queue', async (req: Request, res: Response) => {
  try {
    const { platform, username, walletAddress } = req.body;

    if (!platform || !username) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'platform and username are required',
        },
      });
    }

    const cleanUsername = username.replace(/^@/, '').trim();
    const jobId = crypto.randomUUID(); // UUID for Supabase

    // Submit to Supabase queue
    // Note: This requires Supabase client to be configured
    // For now, we'll return a job_id and process inline
    // TODO: Integrate with scan_worker.py via Supabase

    // Check if Supabase is configured
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      // Submit to Supabase scan_jobs table
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .from('scan_jobs')
        .insert({
          id: jobId,
          scan_type: 'profile',
          payload: {
            username: cleanUsername,
            platform: platform.toLowerCase(),
            wallet_address: walletAddress || null,
          },
          status: 'pending',
          priority: 5,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to submit job to queue:', error);
        // Fall back to inline processing
      } else {
        return res.json({
          success: true,
          job_id: jobId,
          status: 'pending',
          message: 'Scan job submitted to queue',
          poll_url: `/api/v1/scan/jobs/${jobId}`,
        });
      }
    }

    // Fallback: Process inline (no queue)
    const result = await scanTwitterProfile(cleanUsername);
    return res.json({
      success: true,
      job_id: jobId,
      status: 'completed',
      result: result,
    });

  } catch (error: any) {
    console.error('Queue submission error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'QUEUE_ERROR',
        message: 'Failed to submit scan job',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    });
  }
});

/**
 * GET /api/v1/scan/jobs/:jobId
 * 
 * Get status of a queued scan job
 */
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .from('scan_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        return res.status(404).json({
          success: false,
          error: { code: 'JOB_NOT_FOUND', message: 'Job not found' },
        });
      }

      return res.json({
        success: true,
        job: data,
      });
    }

    return res.status(503).json({
      success: false,
      error: { code: 'QUEUE_NOT_CONFIGURED', message: 'Job queue not available' },
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'JOB_ERROR', message: 'Failed to get job status' },
    });
  }
});

/**
 * POST /api/v1/scan/token
 * 
 * Scan a token by contract address
 */
router.post('/token', async (req: Request, res: Response) => {
  try {
    const { contractAddress, chain, forceRefresh } = req.body;

    // Validate required fields
    if (!contractAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ADDRESS',
          message: 'contractAddress is required',
        },
      });
    }

    // Normalize and validate address
    const normalized = contractAddress.trim();
    
    // Basic validation (base58, 32-44 chars)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!base58Regex.test(normalized)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Not a valid Solana token address',
          suggestion: 'Please enter a 32-44 character base58 address',
        },
      });
    }

    // Scan token
    const result = await scanner.scan(normalized, { forceRefresh });

    return res.json({
      success: true,
      data: result,
    });

  } catch (error: any) {
    console.error('Token scan error:', error);

    // Handle specific error codes
    if (error.message === 'TOKEN_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'No token found at this address',
        },
      });
    }

    if (error.message === 'NO_LIQUIDITY') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_LIQUIDITY',
          message: 'Token has no trading pairs or liquidity',
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'SCAN_ERROR',
        message: 'Failed to scan token',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    });
  }
});

/**
 * GET /api/v1/scan/token/:address/history
 * 
 * Get scan history for a token
 */
router.get('/token/:address/history', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const history = await scanner.getScanHistory(address, limit);

    return res.json({
      success: true,
      data: {
        contract: address,
        scans: history,
        total: history.length,
      },
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'HISTORY_ERROR',
        message: 'Failed to get scan history',
      },
    });
  }
});

/**
 * GET /api/v1/scan/trending
 * 
 * Get most scanned tokens
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const trending = await scanner.getTrending(limit);

    return res.json({
      success: true,
      data: {
        tokens: trending,
        timeframe: '24h',
      },
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'TRENDING_ERROR',
        message: 'Failed to get trending tokens',
      },
    });
  }
});

/**
 * POST /api/v1/scan/batch
 * 
 * Scan multiple tokens at once
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { addresses } = req.body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ADDRESSES',
          message: 'addresses array is required',
        },
      });
    }

    if (addresses.length > 10) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_LIMIT',
          message: 'Maximum 10 addresses per batch',
        },
      });
    }

    // Scan all addresses in parallel
    const results = await Promise.allSettled(
      addresses.map(addr => scanner.scan(addr))
    );

    const scans = results.map((result, idx) => ({
      address: addresses[idx],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? (result as any).reason?.message : null,
    }));

    return res.json({
      success: true,
      data: {
        scans,
        total: scans.length,
        successful: scans.filter(s => s.success).length,
      },
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'BATCH_ERROR',
        message: 'Failed to scan tokens',
      },
    });
  }
});

/**
 * GET /api/v1/scan/stats
 * 
 * Get scanner statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Get stats from database
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_scans,
        COUNT(DISTINCT contract_address) as unique_tokens,
        AVG(risk_score) as avg_risk,
        COUNT(CASE WHEN risk_level = 'SAFE' THEN 1 END) as safe_count,
        COUNT(CASE WHEN risk_level = 'LOW' THEN 1 END) as low_count,
        COUNT(CASE WHEN risk_level = 'MEDIUM' THEN 1 END) as medium_count,
        COUNT(CASE WHEN risk_level = 'HIGH' THEN 1 END) as high_count,
        COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) as critical_count
      FROM token_scan_history
      WHERE scan_time > NOW() - INTERVAL '24 hours'
    `);

    const stats = statsResult.rows[0];

    return res.json({
      success: true,
      data: {
        last24h: {
          totalScans: parseInt(stats.total_scans) || 0,
          uniqueTokens: parseInt(stats.unique_tokens) || 0,
          avgRiskScore: parseFloat(stats.avg_risk)?.toFixed(1) || '0',
          distribution: {
            safe: parseInt(stats.safe_count) || 0,
            low: parseInt(stats.low_count) || 0,
            medium: parseInt(stats.medium_count) || 0,
            high: parseInt(stats.high_count) || 0,
            critical: parseInt(stats.critical_count) || 0,
          },
        },
        sources: {
          dexscreener: 'operational',
          goplus: process.env.GOPUS_API_KEY ? 'operational' : 'limited',
          rugcheck: 'operational',
          solanaRpc: process.env.SOLANA_RPC_URL ? 'operational' : 'public',
        },
      },
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: 'Failed to get scanner statistics',
      },
    });
  }
});

export default router;