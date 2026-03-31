/**
 * Token Scanner API Routes
 * 
 * REST API endpoints for token scanning
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