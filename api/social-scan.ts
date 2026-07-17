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
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client for scan tracking ───────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// ── Inline scan event tracking for analytics ──────────────────────────────
async function trackScanEvent(params: { scan_type: string; platform?: string | null; target: string; risk_score?: number | null; risk_level?: string | null; source?: string; country_code?: string | null }) {
  if (!supabase) return;
  try {
    await supabase.from('scan_events').insert({
      scan_type: params.scan_type,
      platform: params.platform ?? null,
      target: params.target,
      username: params.target,
      risk_score: params.risk_score ?? null,
      risk_level: params.risk_level ?? null,
      source: params.source ?? 'website',
      source_table: 'direct_insert',
      event_date: new Date().toISOString().split('T')[0],
      country_code: params.country_code ?? null,
    });
  } catch (e) {
    console.error('[scan-tracking] Error:', e);
  }
}

// ── Record scan to Supabase ────────────────────────────────────────────────
async function recordScan(data: {
  platform: string;
  username: string;
  risk_score: number;
  risk_level: string;
  red_flags: string[];
  wallet_address?: string;
  source: string;
}) {
  if (!supabase) return;
  
  try {
    await supabase.from('scan_results').insert({
      username: data.username,
      platform: data.platform,
      risk_score: data.risk_score,
      risk_level: data.risk_level,
      red_flags: data.red_flags,
      wallet_address: data.wallet_address || null,
      data_source: data.source,
      scanned_at: new Date().toISOString(),
    });
    
    // Update stats counter
    await supabase.rpc('increment_scan_count');
  } catch (err) {
    console.error('[Supabase] recordScan error:', err);
  }
}

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
  text = decodeHtml(text);
  return text.replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractMetaContent(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const keyEscaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta\\b(?=[^>]*(?:property|name|itemprop)=["']${keyEscaped}["'])(?=[^>]*content=["']([^"']*)["'])[^>]*>`, 'i'),
      new RegExp(`<meta\\b(?=[^>]*content=["']([^"']*)["'])(?=[^>]*(?:property|name|itemprop)=["']${keyEscaped}["'])[^>]*>`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return stripTags(match[1]);
    }
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? stripTags(title) : undefined;
}

function parseCount(raw?: string | number | null): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const match = String(raw).trim().match(/([\d,.]+)\s*([KkMmBb])?/);
  if (!match) return undefined;
  const base = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(base)) return undefined;
  const suffix = (match[2] || '').toLowerCase();
  if (suffix === 'k') return Math.round(base * 1_000);
  if (suffix === 'm') return Math.round(base * 1_000_000);
  if (suffix === 'b') return Math.round(base * 1_000_000_000);
  return Math.round(base);
}

function firstCount(text: string, labelPatterns: RegExp[], jsonKeys: string[]): number | undefined {
  for (const key of jsonKeys) {
    const keyEscaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`"${keyEscaped}"\\s*:\\s*"?([\\d,.]+)"?`, 'i'),
      new RegExp(`'${keyEscaped}'\\s*:\\s*'?([\\d,.]+)'?`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const parsed = parseCount(match?.[1]);
      if (parsed !== undefined) return parsed;
    }
  }

  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    const parsed = parseCount(match?.[1]);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function cleanDisplayName(raw?: string, username?: string, platform?: string): string | undefined {
  if (!raw) return undefined;
  let value = raw
    .replace(/\s*\(@[^)]+\)\s*.*$/i, '')
    .replace(/\s*\|\s*(Instagram|TikTok|Facebook).*$/i, '')
    .replace(/\s*on\s*(Instagram|TikTok|Facebook).*$/i, '')
    .replace(/\s*-\s*(Instagram|TikTok|Facebook).*$/i, '')
    .replace(/\s*\(@.*$/, '')
    .trim();
  if (platform === 'tiktok') value = value.replace(/\s*\| TikTok Search.*$/i, '').trim();
  if (!value || value.toLowerCase() === username?.toLowerCase()) return undefined;
  return value.slice(0, 120);
}

function cleanBio(raw?: string): string | undefined {
  if (!raw) return undefined;
  const value = raw
    .replace(/\s+/g, ' ')
    .replace(/^.*?on Instagram:\s*/i, '')
    .replace(/^.*?on TikTok:\s*/i, '')
    .replace(/^.*?on Facebook:\s*/i, '')
    .replace(/\s*See Instagram photos and videos from.*$/i, '')
    .trim();
  return value ? value.slice(0, 500) : undefined;
}

function extractWebsite(text: string): string | undefined {
  const urls = text.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return urls.find((url) => !/(instagram\.com|tiktok\.com|facebook\.com|fb\.com|schema\.org)/i.test(url));
}

interface ProfileMetadata {
  displayName?: string;
  verified?: boolean;
  followers?: number;
  following?: number;
  posts?: number;
  bio?: string;
  location?: string;
  website?: string;
  profileImage?: string;
  sourceFields: string[];
  evidence: string[];
}

function extractProfileMetadata(platform: string, username: string, rawHtml: string, visibleText: string): ProfileMetadata {
  const title = extractMetaContent(rawHtml, ['og:title', 'twitter:title']) || extractTitle(rawHtml);
  const description = extractMetaContent(rawHtml, ['og:description', 'description', 'twitter:description']);
  const combined = `${rawHtml}\n${visibleText}\n${title || ''}\n${description || ''}`;
  const sourceFields: string[] = [];
  const evidence: string[] = [];

  const followers = firstCount(combined, [
    /([\d,.]+\s*[KkMmBb]?)\s+(?:followers|Follower)/i,
    /(?:followers|Follower)[^\d]{0,20}([\d,.]+\s*[KkMmBb]?)/i,
  ], ['followerCount', 'followers', 'follower_count', 'fans', 'fansCount']);
  const following = firstCount(combined, [
    /([\d,.]+\s*[KkMmBb]?)\s+(?:following|Following)/i,
    /(?:following|Following)[^\d]{0,20}([\d,.]+\s*[KkMmBb]?)/i,
  ], ['followingCount', 'following', 'following_count']);
  const posts = firstCount(combined, [
    /([\d,.]+\s*[KkMmBb]?)\s+(?:posts|videos|photos|likes)/i,
    /(?:posts|videos|photos|likes)[^\d]{0,20}([\d,.]+\s*[KkMmBb]?)/i,
  ], ['media_count', 'videoCount', 'awemeCount', 'postCount', 'statuses_count']);

  if (followers !== undefined) { sourceFields.push('followers'); evidence.push(`Public metadata shows ${followers.toLocaleString()} followers.`); }
  if (following !== undefined) { sourceFields.push('following'); evidence.push(`Public metadata shows ${following.toLocaleString()} following.`); }
  if (posts !== undefined) { sourceFields.push('posts'); evidence.push(`Public metadata shows ${posts.toLocaleString()} posts/videos.`); }

  const displayName = cleanDisplayName(title, username, platform);
  if (displayName) sourceFields.push('displayName');

  const bio = cleanBio(description);
  if (bio) { sourceFields.push('bio'); evidence.push(`Bio/description extracted: "${bio.slice(0, 160)}${bio.length > 160 ? '...' : ''}"`); }

  const profileImage = extractMetaContent(rawHtml, ['og:image', 'twitter:image', 'image']);
  if (profileImage) sourceFields.push('profileImage');

  const website = extractWebsite(`${description || ''}\n${visibleText}`);
  if (website) sourceFields.push('website');

  const verified = /"isVerified"\s*:\s*true|"verified"\s*:\s*true|"blue_verified"\s*:\s*true|Verified account|verified badge/i.test(combined)
    ? true
    : /"isVerified"\s*:\s*false|"verified"\s*:\s*false/i.test(combined)
      ? false
      : undefined;
  if (verified !== undefined) sourceFields.push('verified');

  return { displayName, verified, followers, following, posts, bio, website, profileImage, sourceFields, evidence };
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
  telegram: {
    tiktok_funnel: { weight: 10, patterns: ['from tiktok','open in browser','use 3 dots','tiktok to telegram'], description: 'TikTok-to-Telegram funnel pattern' },
    signal_selling: { weight: 10, patterns: ['callouts','signals','vip group','premium group','private group','exclusive signals'], description: 'Signal-selling or callout channel' },
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

function levelFromWeight(totalWeight: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const score = Math.min((totalWeight / 90) * 10, 10);
  return score >= 7 ? 'CRITICAL' : score >= 5 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW';
}

function verificationFromSignals(totalWeight: number, flags: FlagDetail[], verified?: boolean): string {
  if (flags.some((flag) => flag.flag === 'paid_promoter_kol')) return 'PAID PROMOTER';
  if (totalWeight >= 50) return 'HIGH RISK';
  if (totalWeight >= 30) return 'UNVERIFIED';
  if (totalWeight >= 15) return 'PARTIALLY VERIFIED';
  if (verified) return 'VERIFIED';
  return flags.length === 0 ? 'LIKELY SAFE' : 'UNVERIFIED';
}

function addLocalProfileSignals(
  result: ReturnType<typeof calculateRiskScore>,
  profile: ProfileMetadata,
  scoringText: string,
) {
  let totalWeight = result.weightsSum;
  const flagDetails = [...result.flagDetails];

  const addFlag = (detail: FlagDetail) => {
    if (flagDetails.some((flag) => flag.flag === detail.flag)) return;
    flagDetails.push(detail);
    totalWeight += detail.weight;
  };

  if (profile.verified === false) {
    addFlag({
      flag: 'no_verification',
      weight: 5,
      description: 'Profile is not verified by the platform',
      patternMatched: 'verified=false',
      platformSpecific: true,
    });
  }

  if (profile.followers != null && profile.following != null && profile.followers > 0 && profile.following > 0) {
    const ratio = profile.followers / profile.following;
    if (ratio < 1) {
      addFlag({
        flag: 'low_follower_ratio',
        weight: 5,
        description: `Low follower ratio (${ratio.toFixed(1)}:1)`,
        patternMatched: 'followers/following',
        platformSpecific: true,
      });
    }
  }

  const profileText = `${profile.bio || ''}\n${profile.displayName || ''}\n${scoringText}`.toLowerCase();
  if (/\b(kol|influencer|partnered|promoter|shill)\b/i.test(profileText)) {
    addFlag({
      flag: 'paid_promoter_kol',
      weight: 15,
      description: 'Paid promoter/KOL language detected',
      patternMatched: 'kol|influencer|partnered|promoter|shill',
      platformSpecific: true,
    });
  }

  const riskScore = Math.min((totalWeight / 90) * 10, 10);
  return {
    ...result,
    riskScore: Math.round(riskScore * 10) / 10,
    riskLevel: levelFromWeight(totalWeight),
    verificationLevel: verificationFromSignals(totalWeight, flagDetails, profile.verified),
    redFlagsDetected: flagDetails.length,
    flagDetails,
    weightsSum: totalWeight,
  };
}

function buildRecommendation(riskLevel: string, redFlagsDetected: number): string {
  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    return 'High-risk scam indicators detected. Do not send funds, connect wallets, download files, or move to DMs without independent verification.';
  }
  if (riskLevel === 'MEDIUM') {
    return 'Some concerning profile patterns were detected. Verify identity, links, and claims through independent sources before engaging.';
  }
  return redFlagsDetected > 0
    ? 'Minor warning signs detected. Treat the profile as unverified and verify links or claims independently.'
    : 'No major scam patterns were detected from publicly available profile data.';
}

function confidenceFromProfile(profile: ProfileMetadata, flagCount: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (profile.sourceFields.includes('bio') && profile.sourceFields.some((field) => ['followers', 'following', 'posts'].includes(field))) return 'HIGH';
  if (profile.sourceFields.length >= 2 || flagCount > 0) return 'MEDIUM';
  return 'LOW';
}

// ── Platform config ─────────────────────────────────────────────────────────

const VALID_PLATFORMS = ['instagram', 'tiktok', 'facebook', 'telegram'];
const PROFILE_URLS: Record<string, (u: string) => string> = {
  instagram: (u) => `https://www.instagram.com/${u}/`,
  tiktok:    (u) => `https://www.tiktok.com/@${u}`,
  facebook:  (u) => `https://www.facebook.com/${u}`,
  telegram:  (u) => `https://t.me/${u}`,
};

const LOGIN_WALL_PATTERNS: Record<string, string[]> = {
  instagram: ['PolarisErrorRoot', 'show_lox_redesigned_404_page', 'httpErrorPage', 'loginWall'],
  tiktok:    ["Couldn't find this account", 'Page not found', 'tiktok-login'],
  facebook:  ["This page isn't available", 'Page Not Found', 'login_page'],
  telegram:  ['Telegram Messenger'], // Generic homepage = not a valid channel
};

const NOT_FOUND_PATTERNS: Record<string, string[]> = {
  instagram: ["Sorry, this page isn't available", 'Unable to load this page'],
  tiktok:    ["Couldn't find this account", 'Page not found'],
  facebook:  ["This page isn't available", 'Page Not Found'],
  telegram:  ['Page not found', 'If you have Telegram, you can view and join'], // t.me generic fallback
};

// ── Core scan function ──────────────────────────────────────────────────────

async function performScan(platform: string, username: string): Promise<Record<string, unknown>> {
  // Telegram has a different page structure — use dedicated handler
  if (platform === 'telegram') {
    return performTelegramScan(username);
  }

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
      platform, username, url, riskScore: 0, riskLevel: 'UNAVAILABLE', verificationLevel: 'UNAVAILABLE', redFlagsDetected: 0, flagDetails: [],
      redFlags: [],
      evidence: ['Direct public HTML scan was blocked by a platform login wall.'],
      recommendation: 'Run the local OpenClaw/Chrome scan or Telegram bot path for full authenticated profile evidence.',
      confidence: 'LOW',
      scanDate: new Date().toISOString(),
      profileData: {},
    };
  }

  // Extract visible text (strip JS/CSS/HTML)
  const visibleText = extractVisibleText(rawHtml);

  // Check for not-found
  const notFoundPatterns = NOT_FOUND_PATTERNS[platform] ?? [];
  if (notFoundPatterns.some((p) => visibleText.includes(p))) {
    return {
      success: false, error: 'Profile not found or unreachable',
      platform, username, url, riskScore: 0, riskLevel: 'ERROR', verificationLevel: 'ERROR', redFlagsDetected: 0, flagDetails: [],
      redFlags: [],
      evidence: ['Platform returned a not-found or unreachable profile page.'],
      recommendation: 'Confirm the handle and platform, then retry. If the profile is private or region-blocked, use the local OpenClaw scan path.',
      confidence: 'LOW',
      scanDate: new Date().toISOString(),
      profileData: {},
    };
  }

  const profileMeta = extractProfileMetadata(platform, username, rawHtml, visibleText);
  const scoringText = [
    visibleText,
    profileMeta.displayName,
    profileMeta.bio,
    profileMeta.website,
  ].filter(Boolean).join('\n');

  // Score public page content plus extracted profile metadata.
  const result = addLocalProfileSignals(
    calculateRiskScore(scoringText, platform, { followers: profileMeta.followers }),
    profileMeta,
    scoringText,
  );

  // Bot detection (lightweight, profile-level only)
  const botDetection = calculateBotScoreLite({
    followers: profileMeta.followers,
    following: profileMeta.following,
    posts: profileMeta.posts,
    username,
    bio: profileMeta.bio,
    website: profileMeta.website,
    verified: profileMeta.verified,
  }, platform);

  const redFlags = result.flagDetails.map((flag) => `${flag.description} (+${flag.weight})`);
  const evidence = [
    ...profileMeta.evidence,
    ...result.flagDetails.map((flag) => `Matched ${flag.flag}: ${flag.patternMatched}`),
  ];
  const confidence = confidenceFromProfile(profileMeta, result.flagDetails.length);

  return {
    success: true, platform, username, url,
    displayName: profileMeta.displayName,
    verified: profileMeta.verified ?? false,
    riskScore: result.riskScore, riskLevel: result.riskLevel, verificationLevel: result.verificationLevel,
    redFlagsDetected: result.redFlagsDetected, redFlags, flagDetails: result.flagDetails,
    evidence,
    recommendation: buildRecommendation(result.riskLevel, result.redFlagsDetected),
    profileData: {
      displayName: profileMeta.displayName,
      verified: profileMeta.verified ?? false,
      followers: profileMeta.followers,
      following: profileMeta.following,
      posts: profileMeta.posts,
      bio: profileMeta.bio,
      location: profileMeta.location,
      website: profileMeta.website,
      profileImage: profileMeta.profileImage,
      sourceFields: profileMeta.sourceFields,
    },
    confidence,
    weightsSum: result.weightsSum, maxPossibleWeight: result.maxPossibleWeight,
    scanTimestamp: result.scanTimestamp,
    scanDate: result.scanTimestamp,
    dataQuality: profileMeta.sourceFields.length >= 3 ? 'rich_public_profile' : profileMeta.sourceFields.length > 0 ? 'limited_public_profile' : 'sparse_public_profile',
    botDetection,
    disclaimer: 'This scan is an AI-powered threat assessment. For complete accuracy, verify information through multiple sources. Independent verification always recommended.',
  };
}

// ── Telegram-specific scan ──────────────────────────────────────────────────
// t.me pages have a unique structure: og:title for channel name, og:description
// for channel description, and subscriber count in the visible text.

async function performTelegramScan(username: string): Promise<Record<string, unknown>> {
  const url = `https://t.me/${username}`;

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

  // t.me returns the generic Telegram homepage when the channel doesn't exist
  // Check for actual channel content via og:title
  const ogTitleMatch = rawHtml.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const ogDescMatch = rawHtml.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  const ogTitle = ogTitleMatch?.[1] || '';
  const ogDesc = ogDescMatch?.[1] || '';

  // If og:title is just "Telegram Messenger" or empty, it's not a real channel
  if (!ogTitle || ogTitle === 'Telegram Messenger' || ogTitle === 'Telegram') {
    return {
      success: false, error: 'TELEGRAM_CHANNEL_NOT_FOUND',
      message: `No public Telegram channel found for @${username}. This may be a private user account (not a public channel/group). Private accounts cannot be scanned without Bot API access.`,
      platform: 'telegram', username, riskScore: 0, riskLevel: 'UNAVAILABLE',
      verificationLevel: 'UNAVAILABLE', redFlagsDetected: 0, flagDetails: [],
    };
  }

  // Extract visible text
  const visibleText = extractVisibleText(rawHtml);

  // Extract subscriber count — t.me shows "N subscribers" or "N member"
  const subscriberMatch = rawHtml.match(/(\d[\d\s.,]*)\s*(?:subscribers|members|subscriber)/i);
  let subscribers: number | undefined;
  if (subscriberMatch) {
    const raw = subscriberMatch[1].replace(/[\s,]/g, '');
    subscribers = parseInt(raw, 10);
    if (isNaN(subscribers)) subscribers = undefined;
  }

  // Build scoring text from channel name + description + visible content
  let scoringText = ogTitle;
  if (ogDesc) scoringText += '\n' + ogDesc;
  scoringText += '\n' + visibleText;

  // Run the same 90-point unified scoring as the local CLI scanner
  const result = calculateRiskScore(scoringText, 'telegram', { followers: subscribers });

  // Bot detection (lightweight)
  const botDetection = calculateBotScoreLite({
    followers: subscribers,
    username,
    bio: ogDesc,
  }, 'telegram');

  return {
    success: true, platform: 'telegram', username, url,
    displayName: ogTitle,
    bio: ogDesc,
    followers: subscribers,
    riskScore: result.riskScore, riskLevel: result.riskLevel, verificationLevel: result.verificationLevel,
    redFlagsDetected: result.redFlagsDetected, flagDetails: result.flagDetails,
    weightsSum: result.weightsSum, maxPossibleWeight: result.maxPossibleWeight,
    scanTimestamp: result.scanTimestamp,
    botDetection,
    disclaimer: 'This scan is an AI-powered threat assessment. For complete accuracy, verify information through multiple sources. Independent verification always recommended.',
  };
}

// ── Inline: calculateBotScore (lightweight, for serverless) ───────────────────
// Full version lives in src/lib/bot-detection.ts (used by frontend)
// This is a simplified version for the serverless API

interface BotFlagLite {
  id: string;
  name: string;
  points: number;
  description: string;
  detail?: string;
}

function calculateBotScoreLite(
  input: {
    followers?: number;
    following?: number;
    posts?: number;
    bio?: string;
    username?: string;
    isDefaultAvatar?: boolean;
    joinDate?: string;
    location?: string;
    website?: string;
    verified?: boolean;
  },
  _platform: string,
): { botScore: number; classification: string; flags: BotFlagLite[] } {
  const flags: BotFlagLite[] = [];

  // Suspicious Follow Ratio
  if (input.following != null && input.followers != null && input.followers > 0) {
    const ratio = input.followers > 0 ? input.following / input.followers : Infinity;
    if (input.following > 5000 && input.followers < 50) {
      flags.push({ id: 'suspicious_follow_ratio', name: 'Suspicious Follow Ratio', points: 15, description: 'Following far exceeds followers', detail: `Following ${input.following.toLocaleString()} vs ${input.followers.toLocaleString()} followers` });
    } else if (ratio > 3) {
      flags.push({ id: 'suspicious_follow_ratio', name: 'Suspicious Follow Ratio', points: 8, description: 'Follow ratio > 3:1', detail: `Ratio: ${ratio.toFixed(1)}:1` });
    }
  }

  // No Profile Image
  if (input.isDefaultAvatar) {
    flags.push({ id: 'no_profile_image', name: 'No Profile Image', points: 10, description: 'Default avatar detected' });
  }

  // No Bio
  if (!input.bio || input.bio.trim().length === 0) {
    flags.push({ id: 'no_bio', name: 'No Bio', points: 5, description: 'Empty profile description' });
  }

  // New Account
  if (input.joinDate) {
    const ageDays = (Date.now() - new Date(input.joinDate).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 30) flags.push({ id: 'new_account', name: 'New Account', points: 10, description: 'Account < 30 days old', detail: `${Math.floor(ageDays)} days old` });
    else if (ageDays < 90) flags.push({ id: 'new_account', name: 'New Account', points: 3, description: 'Relatively new account', detail: `~${Math.floor(ageDays / 30)} months old` });
  }

  // Low Post Count
  if (input.posts != null && input.posts < 50) {
    flags.push({ id: 'low_tweet_count', name: 'Low Post Count', points: input.posts < 10 ? 5 : 3, description: `Only ${input.posts} posts` });
  }

  // Generic Username
  if (input.username) {
    if (/_\d{4,}$/.test(input.username) || /\d{6,}$/.test(input.username)) {
      flags.push({ id: 'generic_username', name: 'Generic Username Pattern', points: 5, description: 'Username matches auto-generated pattern', detail: `Username: ${input.username}` });
    }
  }

  // No Location or URL
  const hasLocation = !!(input.location && input.location.trim());
  const hasWebsite = !!(input.website && input.website.trim());
  if (!hasLocation && !hasWebsite) {
    flags.push({ id: 'no_location_url', name: 'No Location or URL', points: 5, description: 'Both location and website empty' });
  }

  const totalPoints = flags.reduce((sum, f) => sum + f.points, 0);
  const botScore = Math.min(100, totalPoints);
  const classification = botScore <= 20 ? 'Likely Authentic' : botScore <= 40 ? 'Mild Bot Activity' : botScore <= 60 ? 'Moderate Bot Inflation' : botScore <= 80 ? 'High Bot Inflation' : 'Highly Bot-Inflated';

  return { botScore, classification, flags };
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
    
    // Record scan to Supabase for tracking (legacy scan_results table)
    if (result.success) {
      await recordScan({
        platform: result.platform,
        username: result.username,
        risk_score: result.riskScore,
        risk_level: result.riskLevel,
        red_flags: result.flagDetails?.map((f: any) => f.name || f.id) || [],
        source: 'website',
      });

      // Also record to analytics with scan_type
      try {
        await fetch('https://agenticbro.app/api/scan-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'social',
            platform: result.platform,
            username: result.username,
            risk_score: result.riskScore,
            risk_level: result.riskLevel,
            source: 'website',
          }),
        });
      } catch (e) {
        console.error('[social-scan] analytics tracking error:', e);
      }
    }
    
    // Record to unified scan_events table for analytics
    try {
      await trackScanEvent({
        scan_type: 'social',
        platform: result.platform as any,
        target: result.username,
        risk_score: result.riskScore,
        risk_level: result.riskLevel as any,
        source: 'website',
      });
    } catch (e) {
      console.error('[scan-tracking] social-scan event error:', e);
    }
    
    res.status(200).json(result);
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    res.status(200).json({
      success: false, error: isTimeout ? 'Request timeout — platform may be blocking direct access' : (err?.message ?? String(err)),
      platform, username, riskScore: 0, riskLevel: 'ERROR', verificationLevel: 'ERROR', redFlagsDetected: 0, flagDetails: [],
    });
  }
}
