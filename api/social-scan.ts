/**
 * api/social-scan.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Serverless Function — Social Media Profile Scan
 *
 * POST /api/social-scan
 *   Body:  { platform: 'instagram'|'tiktok'|'facebook', username: string }
 *   Returns: { success, riskScore, riskLevel, verificationLevel, flagDetails, ... }
 *
 * Uses the same unified 90-point weighted scoring as the local Python scanners,
 * ensuring consistent results between website and local CLI scans.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { calculateRiskScore } from '../lib/unified-scoring';

type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

const VALID_PLATFORMS = ['instagram', 'tiktok', 'facebook'];

const PROFILE_URLS: Record<string, (u: string) => string> = {
  instagram: (u) => `https://www.instagram.com/${u}/`,
  tiktok:    (u) => `https://www.tiktok.com/@${u}`,
  facebook:  (u) => `https://www.facebook.com/${u}`,
};

const NOT_FOUND_PATTERNS: Record<string, string[]> = {
  instagram: ["Sorry, this page isn't available", 'Unable to load this page'],
  tiktok:    ["Couldn't find this account", 'Page not found'],
  facebook:  ["This page isn't available", 'Page Not Found'],
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const body = req.body ?? {};
  const platform = String(body.platform ?? '').toLowerCase().trim();
  const username = String(body.username ?? '').replace(/^@/, '').trim();

  // Validate
  if (!VALID_PLATFORMS.includes(platform)) {
    res.status(400).json({ error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` });
    return;
  }
  if (!username) {
    res.status(400).json({ error: 'username is required' });
    return;
  }

  const url = PROFILE_URLS[platform](username);

  try {
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    const content = await fetchRes.text();

    // Check for profile not found
    const notFoundPatterns = NOT_FOUND_PATTERNS[platform] ?? [];
    if (notFoundPatterns.some((p) => content.includes(p))) {
      res.status(200).json({
        success: false,
        error: 'Profile not found or unreachable',
        platform,
        username,
        riskScore: 0,
        riskLevel: 'ERROR',
        verificationLevel: 'ERROR',
        redFlagsDetected: 0,
        flagDetails: [],
      });
      return;
    }

    // Extract follower count
    const metadata: { followers?: number } = {};
    const followerMatch = content.toLowerCase().match(/(\d+[,.]?\d*[KkMm]?)\s*followers/);
    if (followerMatch) {
      const raw = followerMatch[1].toLowerCase();
      if (raw.includes('k')) {
        metadata.followers = parseFloat(raw.replace('k', '').replace(',', '')) * 1000;
      } else if (raw.includes('m')) {
        metadata.followers = parseFloat(raw.replace('m', '').replace(',', '')) * 1000000;
      } else {
        metadata.followers = parseFloat(raw.replace(',', ''));
      }
    }

    // Run unified scoring (identical to Python)
    const result = calculateRiskScore(content, platform, metadata);

    res.status(200).json({
      success: true,
      platform,
      username,
      url,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      verificationLevel: result.verificationLevel,
      redFlagsDetected: result.redFlagsDetected,
      flagDetails: result.flagDetails,
      weightsSum: result.weightsSum,
      maxPossibleWeight: result.maxPossibleWeight,
      scanTimestamp: result.scanTimestamp,
      disclaimer: 'This scan is an AI-powered threat assessment. For complete accuracy, verify information through multiple sources. Independent verification always recommended.',
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    res.status(200).json({
      success: false,
      error: isTimeout ? 'Request timeout — platform may be blocking direct access' : (err?.message ?? String(err)),
      platform,
      username,
      riskScore: 0,
      riskLevel: 'ERROR',
      verificationLevel: 'ERROR',
      redFlagsDetected: 0,
      flagDetails: [],
    });
  }
}