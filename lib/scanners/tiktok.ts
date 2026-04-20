/**
 * TikTok Profile Scanner
 * ======================
 * Fetches TikTok profile HTML and runs unified scoring.
 * Identical logic to Python tiktok-scan-fixed.py
 */

import { calculateRiskScore, type RiskResult, type ScoringMetadata } from '../unified-scoring';

export interface TikTokScanResult {
  url: string;
  error: string | null;
  riskScore: number;
  riskLevel: string;
  verificationLevel: string;
  redFlagsDetected: number;
  flagDetails: RiskResult['flagDetails'];
}

export async function scanTikTok(username: string): Promise<TikTokScanResult> {
  const url = `https://www.tiktok.com/@${username}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    const content = await response.text();

    if (content.includes('Couldn\'t find this account') || content.includes('Page not found')) {
      return {
        url,
        error: 'Profile not found or unreachable',
        riskScore: 0,
        riskLevel: 'ERROR',
        verificationLevel: 'ERROR',
        redFlagsDetected: 0,
        flagDetails: [],
      };
    }

    // Extract follower count
    const metadata: ScoringMetadata = {};
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

    const result = calculateRiskScore(content, 'tiktok', metadata);

    return {
      url,
      error: null,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      verificationLevel: result.verificationLevel,
      redFlagsDetected: result.redFlagsDetected,
      flagDetails: result.flagDetails,
    };
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return {
        url,
        error: 'Request timeout — TikTok blocking direct access',
        riskScore: 0,
        riskLevel: 'ERROR',
        verificationLevel: 'ERROR',
        redFlagsDetected: 0,
        flagDetails: [],
      };
    }
    return {
      url,
      error: err?.message ?? String(err),
      riskScore: 0,
      riskLevel: 'ERROR',
      verificationLevel: 'ERROR',
      redFlagsDetected: 0,
      flagDetails: [],
    };
  }
}