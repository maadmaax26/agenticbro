/**
 * api/social-scan.ts — Self-contained Vercel Serverless Function
 * ================================================================
 * Supports two modes:
 *   POST /api/social-scan          → Sync scan (original, for backward compat)
 *   POST /api/social-scan?async=1  → Returns job ID immediately, poll for result
 *   GET  /api/social-scan/[job_id] → Poll for async result
 *
 * All scoring logic inlined (Vercel can't import from ../lib/)
 * 90-point unified scoring identical to Python local scanner
 */

import type { IncomingMessage, ServerResponse } from 'http';

type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

// ── In-memory job queue (resets on cold start, fine for Vercel) ──────────────
interface ScanJob {
  id: string;
  platform: string;
  username: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: Record<string, unknown>;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, ScanJob>();

function cleanupOldJobs() {
  const cutoff = Date.now() - 10 * 60 * 1000; // 10 min
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}

function generateId(): string {
  return `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Inline: extractVisibleText ──────────────────────────────────────────────
function extractVisibleText(html: string): string {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

// ── Inline: calculateRiskScore (identical to Python unified_scoring.py) ──────
interface FlagDetail {
  flag: string; weight: number; description: string; patternMatched: string; platformSpecific?: boolean;
}

const RED_FLAGS: Record<string, { weight: number; patterns: string[]; description: string }> = {
  guaranteed_returns:  { weight: 25, patterns: ['guaranteed','guarantee','sure thing','100% profit','100x','1000x','1000x returns','guaranteed returns','risk-free','no risk','certain profit'], description: 'Claims of guaranteed profits or unrealistic returns' },
  giveaway_airdrop:    { weight: 20, patterns: ['giveaway','airdrop','free crypto','free bitcoin','free ethereum','free solana','claim free','free money','free tokens','free nft'], description: 'Free crypto giveaways or airdrops' },
  dm_solicitation:     { weight: 15, patterns: ['dm for','dm me','message me','contact me','dm for more','dm for info','dm for alpha','check dm','sent dm','dm for details'], description: 'Requests to DM for more information' },
  free_crypto:         { weight: 15, patterns: ['free','no cost','zero investment','no investment','free money','free cash','free profit'], description: 'Free money or crypto without clear source' },
  alpha_dm_scheme:     { weight: 15, patterns: ['alpha','private alpha','exclusive access','vip','premium access','exclusive','vip group','premium group','private group','exclusive signals'], description: 'Gatekeeping information behind DM/VIP' },
  unrealistic_claims:  { weight: 10, patterns: ['24h','overnight','instant','fast profits','quick profits','instant wealth','overnight wealth','fast money','quick money'], description: 'Unrealistic timeframes for profits' },
  download_install:    { weight: 10, patterns: ['.exe','.apk','.zip','.dmg','download','install app','install software','download app','install wallet','download wallet'], description: 'Requests to download files or install apps' },
  urgency_tactics:     { weight: 10, patterns: ['act now','limited time','last chance','ending soon','only few spots','limited spots','hurry',"don't wait",'time limited','expires soon'], description: 'Urgency to create FOMO' },
  emotional_manipulation: { weight: 10, patterns: ['family','emergency','sick','hospital','desperate','need help','please help','charity','donate','family need','sick family','hospital bills'], description: 'Emotional pleas for help' },
  low_credibility:     { weight: 10, patterns: ['new account','low followers','no track record','no history','just started','new to crypto','beginner','no experience'], description: 'Low credibility indicators' },
};

const PLATFORM_SPECIFIC: Record<string, Record<string, { weight: number; patterns: string[]; description: string }>> = {
  instagram: {
    affiliate_marketing: { weight: 10, patterns: ['affiliate','partner','referral','commission'], description: 'Affiliate marketing indicators' },
    short_links: { weight: 10, patterns: ['bit.ly','tinyurl.com','lnkd.in','afb.ink','cutt.ly'], description: 'Suspicious URL shorteners' },
  },
  facebook: {
    russian_scam_indicators: { weight: 10, patterns: ['trusted.*relationships.*acquisition','financial.*success'], description: 'Russian scam indicators' },
    virtual_companion_fraud: { weight: 10, patterns: ['messages to community','virtual companion'], description: 'Virtual companion fraud patterns' },
  },
  tiktok: {
    limited_content: { weight: 10, patterns: ['limited content','few videos','low video count'], description: 'Limited content on profile' },
    private_profile: { weight: 10, patterns: ['private','private account','hidden'], description: 'Private profile hiding information' },
  },
};

function calculateRiskScore(text: string, platform?: string, metadata?: { followers?: number }) {
  const textLower = text.toLowerCase();
  let totalWeight = 0;
  const detectedFlags: string[] = [];
  const flagDetails: FlagDetail[] = [];

  for (const [flagName, flagData] of Object.entries(RED_FLAGS)) {
    for (const pattern of flagData.patterns) {
      const matches = pattern.includes('.*') ? new RegExp(pattern, 'i').test(text) : textLower.includes(pattern);
      if (matches) {
        totalWeight += flagData.weight;
        detectedFlags.push(flagName);
        flagDetails.push({ flag: flagName, weight: flagData.weight, description: flagData.description, patternMatched: pattern });
        break;
      }
    }
  }

  if (platform && PLATFORM_SPECIFIC[platform]) {
    for (const [flagName, flagData] of Object.entries(PLATFORM_SPECIFIC[platform])) {
      for (const pattern of flagData.patterns) {
        const matches = pattern.includes('.*') ? new RegExp(pattern, 'i').test(text) : textLower.includes(pattern);
        if (matches) {
          totalWeight += flagData.weight;
          detectedFlags.push(flagName);
          flagDetails.push({ flag: flagName, weight: flagData.weight, description: flagData.description, patternMatched: pattern, platformSpecific: true });
          break;
        }
      }
    }
  }

  if (metadata && (metadata.followers ?? 0) < 1000 && totalWeight > 20) {
    totalWeight += 10; detectedFlags.push('low_followers_high_claims');
    flagDetails.push({ flag: 'low_followers_high_claims', weight: 10, description: 'Low followers with high claims', patternMatched: 'metadata', platformSpecific: true });
  }

  const riskScore = Math.min((totalWeight / 90) * 10, 10);
  const riskLevel = riskScore >= 7 ? 'CRITICAL' : riskScore >= 5 ? 'HIGH' : riskScore >= 3 ? 'MEDIUM' : 'LOW';
  const verificationLevel = detectedFlags.length === 0 ? 'LIKELY SAFE' : detectedFlags.length <= 2 ? 'PATTERN MATCHES' : detectedFlags.length <= 4 ? 'UNVERIFIED' : 'HIGH RISK';

  return { riskScore: Math.round(riskScore * 10) / 10, riskLevel, verificationLevel, redFlagsDetected: detectedFlags.length, flagDetails, weightsSum: totalWeight, maxPossibleWeight: 90, scanTimestamp: new Date().toISOString() };
}

// ── Platform config ─────────────────────────────────────────────────────────

const VALID_PLATFORMS = ['instagram', 'tiktok', 'facebook'];
const PROFILE_URLS: Record<string, (u: string) => string> = {
  instagram: (u) => `https://www.instagram.com/${u}/`,
  tiktok:    (u) => `https://www.tiktok.com/@${u}`,
  facebook:  (u) => `https://www.facebook.com/${u}`,
};

const LOGIN_WALL_PATTERNS: Record<string, string[]> = {
  instagram: ['PolarisErrorRoot', 'show_lox_redesigned_404_page', 'httpErrorPage', 'loginWall'],
  tiktok:    ["Couldn't find this account", 'Page not found', 'tiktok-login'],
  facebook:  ["This page isn't available", 'Page Not Found', 'login_page'],
};

const NOT_FOUND_PATTERNS: Record<string, string[]> = {
  instagram: ["Sorry, this page isn't available", 'Unable to load this page'],
  tiktok:    ["Couldn't find this account", 'Page not found'],
  facebook:  ["This page isn't available", 'Page Not Found'],
};

// ── Core scan function ──────────────────────────────────────────────────────

async function performScan(platform: string, username: string): Promise<Record<string, unknown>> {
  const url = PROFILE_URLS[platform](username);

  const fetchRes = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  });

  const rawHtml = await fetchRes.text();

  // Detect login walls / error pages
  const loginWallPatterns = LOGIN_WALL_PATTERNS[platform] ?? [];
  if (loginWallPatterns.some((p) => rawHtml.includes(p))) {
    return {
      success: false, error: 'PROFILE_LOGIN_REQUIRED',
      message: `${platform.charAt(0).toUpperCase() + platform.slice(1)} requires login to view this profile. For accurate scanning, use the Jeeevs Telegram bot or Chrome CDP scan.`,
      platform, username, riskScore: 0, riskLevel: 'UNAVAILABLE', verificationLevel: 'UNAVAILABLE', redFlagsDetected: 0, flagDetails: [],
    };
  }

  // Extract visible text (strip JS/CSS/HTML)
  const visibleText = extractVisibleText(rawHtml);

  // Check for not-found
  const notFoundPatterns = NOT_FOUND_PATTERNS[platform] ?? [];
  if (notFoundPatterns.some((p) => visibleText.includes(p))) {
    return {
      success: false, error: 'Profile not found or unreachable',
      platform, username, riskScore: 0, riskLevel: 'ERROR', verificationLevel: 'ERROR', redFlagsDetected: 0, flagDetails: [],
    };
  }

  // Include OG/meta description
  const ogDesc = rawHtml.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i);
  const metaDesc = rawHtml.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  let scoringText = visibleText;
  if (ogDesc?.[1]) scoringText += '\n' + ogDesc[1];
  if (metaDesc?.[1] && metaDesc[1] !== ogDesc?.[1]) scoringText += '\n' + metaDesc[1];

  // Extract follower count
  const metadata: { followers?: number } = {};
  const followerMatch = rawHtml.toLowerCase().match(/(\d+[,.]?\d*[KkMm]?)\s*followers/);
  if (followerMatch) {
    const raw = followerMatch[1].toLowerCase();
    metadata.followers = raw.includes('k') ? parseFloat(raw.replace('k','').replace(',','')) * 1000
      : raw.includes('m') ? parseFloat(raw.replace('m','').replace(',','')) * 1000000
      : parseFloat(raw.replace(',',''));
  }

  // Score VISIBLE TEXT only
  const result = calculateRiskScore(scoringText, platform, metadata);

  return {
    success: true, platform, username, url,
    riskScore: result.riskScore, riskLevel: result.riskLevel, verificationLevel: result.verificationLevel,
    redFlagsDetected: result.redFlagsDetected, flagDetails: result.flagDetails,
    weightsSum: result.weightsSum, maxPossibleWeight: result.maxPossibleWeight,
    scanTimestamp: result.scanTimestamp,
    disclaimer: 'This scan is an AI-powered threat assessment. For complete accuracy, verify information through multiple sources. Independent verification always recommended.',
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── GET: Poll for async job result ──────────────────────────────────────
  if (req.method === 'GET') {
    const url = (req.url ?? '').split('?')[0];
    const jobId = url.split('/').pop();
    if (!jobId || !jobs.has(jobId)) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const job = jobs.get(jobId)!;
    res.status(200).json({
      id: job.id,
      status: job.status,
      platform: job.platform,
      username: job.username,
      ...(job.status === 'done' ? job.result : {}),
      ...(job.status === 'error' ? { error: job.error } : {}),
    });
    return;
  }

  // ── POST: Start scan (sync or async) ────────────────────────────────────
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const body = req.body ?? {};
  const platform = String(body.platform ?? '').toLowerCase().trim();
  const username = String(body.username ?? '').replace(/^@/, '').trim();

  if (!VALID_PLATFORMS.includes(platform)) { res.status(400).json({ error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` }); return; }
  if (!username) { res.status(400).json({ error: 'username is required' }); return; }

  const isAsync = (req.url ?? '').includes('async=1');

  // ── Async mode: return job ID immediately ──────────────────────────────
  if (isAsync) {
    cleanupOldJobs();
    const id = generateId();
    const job: ScanJob = { id, platform, username, status: 'pending', createdAt: Date.now() };
    jobs.set(id, job);

    // Process in background (Vercel won't wait, but the function keeps running briefly)
    performScan(platform, username)
      .then((result) => {
        job.status = 'done';
        job.result = result;
      })
      .catch((err: any) => {
        job.status = 'error';
        job.error = err?.message ?? String(err);
      });

    res.status(202).json({ id, status: 'pending', platform, username, message: 'Scan started. Poll GET /api/social-scan/' + id + ' for results.' });
    return;
  }

  // ── Sync mode: scan and return immediately ──────────────────────────────
  try {
    const result = await performScan(platform, username);
    res.status(200).json(result);
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    res.status(200).json({
      success: false, error: isTimeout ? 'Request timeout — platform may be blocking direct access' : (err?.message ?? String(err)),
      platform, username, riskScore: 0, riskLevel: 'ERROR', verificationLevel: 'ERROR', redFlagsDetected: 0, flagDetails: [],
    });
  }
}