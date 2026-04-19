/**
 * api/twitter-scan.ts — Vercel Serverless Function
 *
 * POST /api/twitter-scan  { username: "someuser" }
 *
 * Fetches a Twitter/X profile page, extracts visible text + OG meta,
 * then scores using the 90-point unified system (inline, identical to social-scan.ts).
 */

import type { IncomingMessage, ServerResponse } from 'http';

type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

// ── Inline: extractVisibleText ──────────────────────────────────────────────
function extractVisibleText(html: string): string {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

// ── Inline: 90-point unified scoring ────────────────────────────────────────
interface FlagDetail {
  flag: string; weight: number; description: string; patternMatched: string;
}

const RED_FLAGS: Record<string, { weight: number; patterns: string[]; description: string }> = {
  guaranteed_returns:  { weight: 25, patterns: ['guaranteed','guarantee','sure thing','100% profit','100x','1000x','risk-free','no risk','certain profit','10x-100x','10x 100x'], description: 'Claims of guaranteed profits or unrealistic returns' },
  giveaway_airdrop:    { weight: 20, patterns: ['giveaway','airdrop','free crypto','free bitcoin','free ethereum','free solana','claim free','free money','free tokens','free nft'], description: 'Free crypto giveaways or airdrops' },
  dm_solicitation:     { weight: 15, patterns: ['dm for','dm me','message me','contact me','dm for more','dm for info','dm for alpha','check dm','sent dm','dm for details','dm lfg','dm now','hit my dm'], description: 'Requests to DM for more information' },
  free_crypto:         { weight: 15, patterns: ['free','no cost','zero investment','no investment','free money','free cash','free profit'], description: 'Free money or crypto without clear source' },
  alpha_dm_scheme:     { weight: 15, patterns: ['alpha','private alpha','exclusive access','vip','premium access','exclusive','vip group','premium group','private group','exclusive signals','t.me/','telegram.me/'], description: 'Gatekeeping information behind DM/VIP/Telegram' },
  unrealistic_claims:  { weight: 10, patterns: ['24h','overnight','instant','fast profits','quick profits','instant wealth','overnight wealth','fast money','quick money','to the moon','moonshot','financial freedom'], description: 'Unrealistic timeframes for profits' },
  download_install:    { weight: 10, patterns: ['.exe','.apk','.zip','.dmg','download app','install app','install software','install wallet','download wallet'], description: 'Requests to download files or install apps' },
  urgency_tactics:     { weight: 10, patterns: ['act now','limited time','last chance','ending soon','only few spots','limited spots','hurry',"don't wait",'time limited','expires soon','fomo'], description: 'Urgency to create FOMO' },
  emotional_manipulation: { weight: 10, patterns: ['family','emergency','sick','hospital','desperate','need help','please help','charity','donate'], description: 'Emotional pleas for help' },
  low_credibility:     { weight: 10, patterns: ['new account','low followers','no track record','no history','just started','new to crypto','beginner'], description: 'Low credibility indicators' },
};

function calculateRiskScore(text: string, metadata?: { followers?: number; following?: number }) {
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

  // Follower ratio check (engagement pod / purchased followers)
  if (metadata?.followers && metadata?.following) {
    const ratio = metadata.following / metadata.followers;
    if (ratio > 2.0 && metadata.followers < 5000) {
      totalWeight += 10; detectedFlags.push('low_credibility');
      flagDetails.push({ flag: 'low_credibility', weight: 10, description: 'Suspicious follower ratio (engagement pod)', patternMatched: `following/followers ratio ${ratio.toFixed(1)}` });
    } else if (metadata.following > 10000 && metadata.followers < metadata.following * 0.3) {
      totalWeight += 10; detectedFlags.push('low_credibility');
      flagDetails.push({ flag: 'low_credibility', weight: 10, description: 'Engagement pod pattern (following >> followers)', patternMatched: `following ${metadata.following} >> followers ${metadata.followers}` });
    }
  }

  if (metadata && (metadata.followers ?? 0) < 1000 && totalWeight > 20) {
    totalWeight += 10; detectedFlags.push('low_followers_high_claims');
    flagDetails.push({ flag: 'low_followers_high_claims', weight: 10, description: 'Low followers with high claims', patternMatched: 'metadata' });
  }

  // Marketing/shill detection
  if (/advertis|market.*agency|promo.*service|shill|paid.*promo|sponsored.*post/i.test(text)) {
    totalWeight += 5; detectedFlags.push('marketing_shill');
    flagDetails.push({ flag: 'marketing_shill', weight: 5, description: 'Marketing/advertising service (paid shill account)', patternMatched: 'marketing keywords in bio' });
  }

  const riskScore = Math.min((totalWeight / 90) * 10, 10);
  const riskLevel = riskScore >= 7 ? 'CRITICAL' : riskScore >= 5 ? 'HIGH' : riskScore >= 3 ? 'MEDIUM' : 'LOW';

  return {
    riskScore: Math.round(riskScore * 10) / 10,
    riskLevel,
    redFlagsDetected: detectedFlags.length,
    flagDetails,
    weightsSum: totalWeight,
    maxPossibleWeight: 90,
  };
}

// ── Extract profile metadata from HTML ──────────────────────────────────────
function extractProfileMetadata(html: string) {
  const metadata: { followers?: number; following?: number; bio?: string; displayName?: string; verified?: boolean } = {};

  // OG meta tags
  const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);

  if (ogTitle) metadata.displayName = ogTitle[1];
  if (ogDesc) metadata.bio = ogDesc[1];

  // Follower count from OG description (X puts "X Followers" in og:description)
  if (ogDesc) {
    const followerMatch = ogDesc[1].toLowerCase().match(/([\d,.]+[kKmM]?)\s*followers?/i);
    if (followerMatch) {
      const raw = followerMatch[1].toLowerCase().replace(/,/g, '');
      metadata.followers = raw.includes('k') ? parseFloat(raw) * 1000
        : raw.includes('m') ? parseFloat(raw) * 1000000
        : parseFloat(raw) || undefined;
    }
    const followingMatch = ogDesc[1].toLowerCase().match(/([\d,.]+[kKmM]?)\s*following/i);
    if (followingMatch) {
      const raw = followingMatch[1].toLowerCase().replace(/,/g, '');
      metadata.following = raw.includes('k') ? parseFloat(raw) * 1000
        : raw.includes('m') ? parseFloat(raw) * 1000000
        : parseFloat(raw) || undefined;
    }
  }

  // Verified check
  metadata.verified = html.includes('verified') || html.includes('isVerified');

  return metadata;
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const body = req.body ?? {};
  const username = String(body.username ?? '').replace(/^@/, '').trim();

  if (!username) {
    res.status(400).json({ error: 'username is required' });
    return;
  }

  try {
    const url = `https://x.com/${username}`;
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    const rawHtml = await fetchRes.text();
    const visibleText = extractVisibleText(rawHtml);

    // Check if profile loaded vs login wall / suspended
    const isLoginWall = rawHtml.includes('login') && !visibleText.toLowerCase().includes(username.toLowerCase());
    const isSuspended = visibleText.includes('Account suspended') || visibleText.includes('This account is suspended');

    if (isSuspended) {
      res.status(200).json({
        success: true, platform: 'twitter', username,
        riskScore: 9.0, riskLevel: 'CRITICAL',
        redFlagsDetected: 1,
        flagDetails: [{ flag: 'account_suspended', weight: 50, description: 'Account has been suspended by X', patternMatched: 'suspended' }],
        weightsSum: 50, maxPossibleWeight: 90,
        disclaimer: 'This scan is an AI-powered threat assessment. For complete accuracy, verify information through multiple sources.',
      });
      return;
    }

    // Extract metadata
    const metadata = extractProfileMetadata(rawHtml);

    // Build scoring text from bio + visible profile content
    let scoringText = visibleText.substring(0, 8000);
    if (metadata.bio) scoringText += '\n' + metadata.bio;
    if (metadata.displayName) scoringText += '\n' + metadata.displayName;

    // Calculate risk score
    const result = calculateRiskScore(scoringText, metadata);

    res.status(200).json({
      success: true,
      platform: 'twitter',
      username,
      displayName: metadata.displayName,
      bio: metadata.bio,
      verified: metadata.verified,
      followers: metadata.followers,
      following: metadata.following,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      redFlagsDetected: result.redFlagsDetected,
      flagDetails: result.flagDetails,
      weightsSum: result.weightsSum,
      maxPossibleWeight: result.maxPossibleWeight,
      scanTimestamp: new Date().toISOString(),
      disclaimer: 'This scan is an AI-powered threat assessment. For complete accuracy, verify information through multiple sources. Independent verification always recommended.',
    });

  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    res.status(200).json({
      success: false,
      error: isTimeout ? 'Request timeout — X may be blocking access' : (err?.message ?? String(err)),
      platform: 'twitter', username, riskScore: 0, riskLevel: 'ERROR',
      redFlagsDetected: 0, flagDetails: [], weightsSum: 0, maxPossibleWeight: 90,
    });
  }
}