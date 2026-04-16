/**
 * api/social-scan.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Serverless Function — Social Media Profile Scan
 *
 * POST /api/social-scan
 *   Body:  { platform: 'instagram'|'tiktok'|'facebook', username: string }
 *   Returns: { success, riskScore, riskLevel, verificationLevel, flagDetails, ... }
 *
 * Key fix: Strips JS/CSS before scoring to avoid false positives from
 * platform boilerplate code. Detects login walls / error pages.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { calculateRiskScore, extractVisibleText } from '../lib/unified-scoring';

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

// Login wall / error page indicators per platform
const LOGIN_WALL_PATTERNS: Record<string, string[]> = {
  instagram: ['PolarisErrorRoot', 'show_lox_redesigned_404_page', 'httpErrorPage', 'loginWall'],
  tiktok:    ["Couldn't find this account", 'Page not found', 'tiktok-login'],
  facebook:  ["This page isn't available", 'Page Not Found', 'login_page'],
};

// Profile-not-found text patterns (visible text)
const NOT_FOUND_PATTERNS: Record<string, string[]> = {
  instagram: ["Sorry, this page isn't available", 'Unable to load this page'],
  tiktok:    ["Couldn't find this account", 'Page not found'],
  facebook:  ["This page isn't available", 'Page Not Found'],
};

function makeUnavailableResponse(platform: string, username: string, message: string) {
  return {
    success: false,
    error: 'PROFILE_LOGIN_REQUIRED',
    message,
    platform,
    username,
    riskScore: 0,
    riskLevel: 'UNAVAILABLE',
    verificationLevel: 'UNAVAILABLE',
    redFlagsDetected: 0,
    flagDetails: [],
  };
}

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

    const rawHtml = await fetchRes.text();

    // ── 1. Detect login walls / error pages ──────────────────────────────
    const loginWallPatterns = LOGIN_WALL_PATTERNS[platform] ?? [];
    if (loginWallPatterns.some((p) => rawHtml.includes(p))) {
      res.status(200).json(makeUnavailableResponse(
        platform,
        username,
        `${platform.charAt(0).toUpperCase() + platform.slice(1)} requires login to view this profile. For accurate scanning, use the Jeeevs Telegram bot or Chrome CDP scan.`,
      ));
      return;
    }

    // ── 2. Extract visible text (strip all JS/CSS/HTML) ──────────────────
    const visibleText = extractVisibleText(rawHtml);

    // ── 3. Check for profile-not-found in visible text ───────────────────
    const notFoundPatterns = NOT_FOUND_PATTERNS[platform] ?? [];
    if (notFoundPatterns.some((p) => visibleText.includes(p))) {
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

    // ── 4. Also extract OG/meta description for scoring ─────────────────
    const ogDesc = rawHtml.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i);
    const metaDesc = rawHtml.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const twDesc = rawHtml.match(/<meta\s+(?:property|name)=["']twitter:description["']\s+content=["']([^"']+)["']/i);

    let scoringText = visibleText;
    if (ogDesc?.[1]) scoringText += '\n' + ogDesc[1];
    if (metaDesc?.[1] && metaDesc[1] !== ogDesc?.[1]) scoringText += '\n' + metaDesc[1];
    if (twDesc?.[1] && twDesc[1] !== ogDesc?.[1]) scoringText += '\n' + twDesc[1];

    // ── 5. Extract follower count from HTML ──────────────────────────────
    const metadata: { followers?: number } = {};
    const followerMatch = rawHtml.toLowerCase().match(/(\d+[,.]?\d*[KkMm]?)\s*followers/);
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

    // ── 6. Run unified scoring on VISIBLE TEXT only ─────────────────────
    const result = calculateRiskScore(scoringText, platform, metadata);

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