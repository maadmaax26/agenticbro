/**
 * Token Scanner API Routes
 * 
 * REST API endpoints for token scanning and profile verification
 */

import { Router, Request, Response } from 'express';
import { TokenScanner, TokenScanResult } from '../services/token-scanner';
import { Pool } from 'pg';
import { Cache } from '../utils/cache';

const router = Router();

// Dependencies (would be injected in production)
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const cache = new Cache(redisUrl);
const scanner = new TokenScanner({ cache, db });

// Chrome CDP endpoint
const CHROME_CDP_URL = process.env.CHROME_CDP_URL || 'http://localhost:18800';

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
async function scanTwitterProfile(username: string): Promise<any> {
  const WebSocket = require('ws');
  const fetch = require('node-fetch');
  
  try {
    // Get Chrome DevTools Protocol tabs
    const tabsResponse = await fetch(`${CHROME_CDP_URL}/json`);
    const tabs = await tabsResponse.json();
    
    // Find or create a tab for X
    let targetTab = tabs.find((t: any) => t.url?.includes('x.com') || t.url?.includes('twitter.com'));
    
    if (!targetTab) {
      // Open new tab
      const newTabResponse = await fetch(`${CHROME_CDP_URL}/json/new?https://x.com/${username}`, {
        method: 'PUT'
      });
      targetTab = await newTabResponse.json();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for page load
    } else {
      // Navigate existing tab
      const ws = new WebSocket(targetTab.webSocketDebuggerUrl);
      
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            id: 1,
            method: 'Page.navigate',
            params: { url: `https://x.com/${username}` }
          }));
        });
        
        ws.on('message', (data: string) => {
          const msg = JSON.parse(data);
          if (msg.id === 1) {
            setTimeout(resolve, 3000); // Wait for navigation
          }
        });
        
        setTimeout(reject, 10000); // 10s timeout
      });
      
      ws.close();
    }
    
    // Get fresh tabs list after navigation
    const freshTabsResponse = await fetch(`${CHROME_CDP_URL}/json`);
    const freshTabs = await freshTabsResponse.json();
    const xTab = freshTabs.find((t: any) => t.url?.includes(username) || t.url?.includes('x.com'));
    
    if (!xTab) {
      throw new Error('Could not find X tab after navigation');
    }
    
    // Connect and extract data
    const ws = new WebSocket(xTab.webSocketDebuggerUrl);
    
    const profileData = await new Promise((resolve, reject) => {
      ws.on('open', () => {
        // Get page text content
        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: 'document.body.innerText'
          }
        }));
      });
      
      ws.on('message', (data: string) => {
        try {
          const msg = JSON.parse(data);
          if (msg.id === 1 && msg.result?.result?.value) {
            resolve(parseProfileText(msg.result.result.value, username));
          }
        } catch (e) {
          reject(e);
        }
      });
      
      setTimeout(() => reject(new Error('Timeout extracting profile data')), 15000);
    });
    
    ws.close();
    
    return {
      success: true,
      data: profileData,
      source: 'chrome_cdp',
      scanTime: new Date().toISOString(),
    };
    
  } catch (error: any) {
    console.error('Chrome CDP scan error:', error);
    return {
      success: false,
      error: error.message,
      source: 'chrome_cdp',
    };
  }
}

/**
 * Parse profile text content from X
 */
function parseProfileText(text: string, username: string): any {
  const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
  
  const profile: any = {
    platform: 'twitter',
    username: `@${username}`,
    name: '',
    verified: false,
    followers: 0,
    following: 0,
    posts_count: 0,
    bio: '',
    location: '',
    join_date: '',
    account_age_years: 0,
    red_flags: [],
    promoted_tokens: [],
    recent_posts: [],
  };
  
  // Extract basic info
  for (let i = 0; i < Math.min(50, lines.length); i++) {
    const line = lines[i];
    
    // Name (usually first line with uppercase)
    if (!profile.name && /^[A-Z][a-z]+/.test(line) && !line.includes('@')) {
      profile.name = line;
    }
    
    // Verified badge
    if (line.includes('Verified') || line.includes('✓')) {
      profile.verified = true;
    }
    
    // Followers
    if (line.toLowerCase().includes('follower')) {
      const match = line.match(/([\d,\.]+[KM]?)\s*Follower/i);
      if (match) {
        profile.followers = parseNumber(match[1]);
      }
    }
    
    // Following
    if (line.toLowerCase().includes('following')) {
      const match = line.match(/([\d,\.]+[KM]?)\s*Following/i);
      if (match) {
        profile.following = parseNumber(match[1]);
      }
    }
    
    // Posts
    if (line.toLowerCase().includes('post')) {
      const match = line.match(/([\d,\.]+[KM]?)\s*Post/i);
      if (match) {
        profile.posts_count = parseNumber(match[1]);
      }
    }
    
    // Join date
    if (line.includes('Joined')) {
      const match = line.match(/Joined\s+(\w+\s+\d{4})/);
      if (match) {
        profile.join_date = match[1];
        // Calculate account age
        const yearMatch = match[1].match(/\d{4}/);
        if (yearMatch) {
          const joinYear = parseInt(yearMatch[0]);
          profile.account_age_years = new Date().getFullYear() - joinYear;
        }
      }
    }
    
    // Location
    if (line.includes('·') && !profile.location) {
      const parts = line.split('·');
      for (const part of parts) {
        if (part.match(/^[A-Z]/) && !part.includes('http') && !part.includes('@')) {
          profile.location = part.trim();
          break;
        }
      }
    }
    
    // Bio (longer lines with keywords)
    if (line.length > 20 && !profile.bio && !line.startsWith('http') && !line.startsWith('@')) {
      if (/[A-Za-z]/.test(line) && !line.includes('Follower') && !line.includes('Following')) {
        profile.bio = line.substring(0, 200);
      }
    }
  }
  
  // Calculate red flags from bio
  if (profile.bio) {
    const bioLower = profile.bio.toLowerCase();
    
    if (bioLower.includes('dm ') || bioLower.includes('dm me')) {
      profile.red_flags.push('DM solicitation in bio');
    }
    if (bioLower.includes('1000x') || bioLower.includes('100x') || bioLower.includes('moonshot')) {
      profile.red_flags.push('Unrealistic returns claims (1000x/100x)');
    }
    if (bioLower.includes('project promoter') || bioLower.includes('crypto promoter')) {
      profile.red_flags.push('Self-described shill account');
    }
    if (bioLower.includes('presale')) {
      profile.red_flags.push('Presale promotion (high risk)');
    }
    if (bioLower.includes('trusted source') || bioLower.includes('your trusted')) {
      profile.red_flags.push('False authority claim');
    }
    if (bioLower.includes('t.me/') || bioLower.includes('telegram')) {
      profile.red_flags.push('Telegram redirect in bio');
    }
  }
  
  // Check account age
  if (profile.account_age_years < 1) {
    profile.red_flags.push('Account less than 1 year old');
  }
  
  // Check verification
  if (!profile.verified && profile.followers < 10000) {
    profile.red_flags.push('Not verified');
  }
  
  // Check follower ratio
  if (profile.following > 0 && profile.followers > 0) {
    const ratio = profile.followers / profile.following;
    if (ratio < 1.5) {
      profile.red_flags.push(`Low follower ratio (${ratio.toFixed(1)}:1)`);
    }
  }
  
  // Calculate risk score
  let riskScore = 2.0;
  for (const flag of profile.red_flags) {
    if (flag.includes('DM')) riskScore += 2.0;
    else if (flag.includes('Unrealistic')) riskScore += 2.5;
    else if (flag.includes('shill')) riskScore += 2.0;
    else if (flag.includes('presale')) riskScore += 2.0;
    else if (flag.includes('Telegram')) riskScore += 1.5;
    else if (flag.includes('alpha') || flag.includes('gem')) riskScore += 1.0;
    else if (flag.includes('follower ratio')) riskScore += 0.5;
    else if (flag.includes('Not verified')) riskScore += 0.3;
    else riskScore += 0.5;
  }
  
  profile.risk_score = Math.min(riskScore, 10.0);
  profile.risk_level = riskScore >= 7 ? 'CRITICAL' : riskScore >= 5 ? 'HIGH' : riskScore >= 3 ? 'MEDIUM' : 'LOW';
  
  // Determine verification level
  if (riskScore >= 8) {
    profile.verification_level = 'HIGH RISK';
  } else if (riskScore >= 5) {
    profile.verification_level = 'Unverified';
  } else if (profile.verified && profile.account_age_years >= 2) {
    profile.verification_level = 'Verified';
  } else if (profile.account_age_years >= 5) {
    profile.verification_level = 'Legitimate';
  } else {
    profile.verification_level = 'Partially Verified';
  }
  
  return profile;
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