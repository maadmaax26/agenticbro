/**
 * Scam Detection API Route
 * API endpoint for X/Twitter profile and Telegram channel scam detection
 * Integrates browser-based X scraper and Telegram channel web fetcher
 */

import { NextRequest, NextResponse } from 'next/server';
import { Browser } from '@openclaw/browser';
import { XProfileScraper } from '../../services/XProfileScraper';
import { ScamProfileData } from '@/types/scam-detection';

// Initialize browser singleton
let browser: Browser | null = null;

/**
 * Initialize browser (lazy initialization)
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = new Browser();
  }
  return browser;
}

/**
 * GET /api/scam-detection
 * Documentation endpoint
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Scam Detection API',
    version: '1.0.0',
    endpoint: '/api/scam-detection',
    method: 'POST',
    authentication: 'token-gated (Holder/Whale tiers)',
    description: 'Scan X/Twitter profiles and Telegram channels for scam detection',
    parameters: {
      platform: {
        type: 'string',
        required: true,
        enum: ['x', 'telegram']
      },
      identifier: {
        type: 'string',
        required: true,
        description: 'X username (@username) or Telegram channel (t.me/channel)'
      },
      scanType: {
        type: 'string',
        required: false,
        enum: ['quick', 'full'],
        default: 'quick'
      }
    },
    examples: [
      {
        platform: 'x',
        identifier: '@crypto_genius09',
        scanType: 'full'
      },
      {
        platform: 'telegram',
        identifier: 't.me/crytogeniusann',
        scanType: 'full'
      }
    ]
  });
}

/**
 * POST /api/scam-detection
 * Trigger a scan on X profile or Telegram channel
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { platform, identifier, scanType = 'quick' } = await req.json();

  // Validate platform
  if (!['x', 'telegram'].includes(platform)) {
    return NextResponse.json(
      { error: 'Invalid platform. Must be "x" or "telegram"' },
      { status: 400 }
    );
  }

  // Validate identifier
  if (!identifier) {
    return NextResponse.json(
      { error: 'Identifier is required' },
      { status: 400 }
    );
  }

  try {
    if (platform === 'x') {
      // X/Twitter profile scan
      return await scanXProfile(identifier, scanType);
    } else {
      // Telegram channel scan
      return await scanTelegramChannel(identifier, scanType);
    }
  } catch (error) {
    console.error('Scam detection API error:', error);
    return NextResponse.json(
      { error: `Failed to perform scam detection: ${error}` },
      { status: 500 }
    );
  }
}

/**
 * Scan X/Twitter profile
 */
async function scanXProfile(username: string, scanType: string): Promise<NextResponse> {
  try {
    // Initialize browser
    const browser = await getBrowser();

    // Create scraper
    const scraper = new XProfileScraper();

    // Navigate to profile
    await scraper.navigateToProfile(username);

    // Perform scan based on scan type
    const profileData = scanType === 'full'
      ? await scraper.getProfileSnapshot()
      : scraper.convertToFullData(await scraper.quickScan(username));

    // Return result
    return NextResponse.json({
      status: 'success',
      platform: 'x',
      identifier: username,
      scanType: scanType,
      data: formatScanResult(profileData),
      scannedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('X profile scan failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: `Failed to scan X profile @${username}: ${error}`
      },
      { status: 500 }
    );
  }
}

/**
 * Scan Telegram channel
 */
async function scanTelegramChannel(channel: string, scanType: string): Promise<NextResponse> {
  try {
    // Normalize channel URL
    const normalizedChannel = channel.startsWith('t.me/')
      ? `https://${channel}`
      : channel.startsWith('https://')
        ? channel
        : `https://t.me/${channel}`;

    // Fetch channel data via web fetch
    const fetchResponse = await fetch(normalizedChannel);
    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch channel: ${fetchResponse.status}`);
    }

    const html = await fetchResponse.text();

    // Extract channel data from HTML
    const channelData = extractTelegramChannelData(html, normalizedChannel, scanType);

    // Analyze red flags
    const redFlags = analyzeTelegramRedFlags(channelData);

    // Calculate risk score
    const riskScore = calculateRiskScore(redFlags, channelData);

    // Return result
    return NextResponse.json({
      status: 'success',
      platform: 'telegram',
      identifier: channel,
      scanType: scanType,
      data: formatScanResult({
        platform: 'telegram',
        identifier: channel,
        ...channelData,
        redFlags,
        riskScore
      }),
      scannedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Telegram channel scan failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: `Failed to scan Telegram channel ${channel}: ${error}`
      },
      { status: 500 }
    );
  }
}

/**
 * Extract Telegram channel data from HTML
 */
function extractTelegramChannelData(html: string, channelUrl: string, scanType: string): ScamProfileData {
  const data: ScamProfileData = {
    platform: 'telegram',
    identifier: channelUrl,
    username: '',
    displayName: '',
    bio: '',
    followerCount: 0,
    messageCount: 0,
    engagementRate: 0,
    isVerified: false,
    joinDate: '',
    website: '',
    pinnedPosts: [],
    recentPosts: [],
    links: [],
    riskScore: 0,
    riskLevel: 'LOW',
    verificationStatus: 'Unverified',
    confidence: 'LOW',
    redFlags: [],
    summary: '',
    notes: ''
  };

  try {
    // Extract channel name
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    if (titleMatch) {
      data.displayName = titleMatch[1].replace(' — Telegram', '').trim();
    }

    // Extract member count (format: "X subscribers")
    const memberMatch = html.match(/(\d+(?:[.,]?\d*)?)(?:K|M|B)?\s*(?:subscriber|subscribers|member|members)/gi);
    if (memberMatch) {
      const memberText = memberMatch[0];
      const memberMatch2 = memberText.match(/(\d+(?:[.,]?\d*)?)(?:K|M|B)?/);
      if (memberMatch2) {
        data.followerCount = parseLargeNumber(memberMatch2[0]);
      }
    }

    // Extract bio/description
    const bioMatch = html.match(/<meta name="description" content="([^"]*)"/);
    if (bioMatch) {
      data.bio = bioMatch[1];
    }

    // Extract username from URL
    const usernameMatch = channelUrl.match(/t\.me\/([^/]+)/);
    if (usernameMatch) {
      data.username = '@' + usernameMatch[1];
    }

    // Extract links
    const linkRegex = /<a[^>]+href="([^"]+)"/gi;
    const links = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const link = match[1];
      if (link.startsWith('https://') || link.startsWith('http://')) {
        links.push(link);
      }
    }
    data.links = links;

    // Extract messages (if available in HTML)
    const messageRegex = /<div class="message[^>]*>(.*?)<\/div>/gs;
    const messages = [];
    let messageMatch;
    let messageCount = 0;
    while ((messageMatch = messageRegex.exec(html)) !== null && messageCount < (scanType === 'full' ? 20 : 10)) {
      const messageText = messageMatch[1].replace(/<[^>]*>/g, '').trim();
      if (messageText.length > 0) {
        messages.push({
          id: `msg_${messageCount}`,
          text: messageText.substring(0, 280),
          url: channelUrl
        });
        messageCount++;
      }
    }
    data.recentPosts = messages;
    data.messageCount = messageCount;

  } catch (error) {
    console.error('Error extracting Telegram channel data:', error);
  }

  return data;
}

/**
 * Parse large numbers (e.g., "1.5K" -> 1500, "2M" -> 2000000)
 */
function parseLargeNumber(str: string): number {
  str = str.replace(/,/g, '');
  const multiplier = str.slice(-1);
  const number = parseFloat(str.slice(0, -1));

  switch (multiplier) {
    case 'K':
      return Math.floor(number * 1000);
    case 'M':
      return Math.floor(number * 1000000);
    case 'B':
      return Math.floor(number * 1000000000);
    default:
      return Math.floor(number);
  }
}

/**
 * Analyze red flags for Telegram channel
 */
function analyzeTelegramRedFlags(data: ScamProfileData) {
  const redFlags = [];

  try {
    const textToAnalyze = [
      data.displayName || '',
      data.bio || ''
    ].join(' ').toLowerCase();

    // Red flag patterns
    const patterns = [
      {
        type: 'Guaranteed Returns',
        weight: 9,
        regex: /guaranteed|guarantee|risk-free|100% win|riskless profit/i
      },
      {
        type: 'Private Alpha',
        weight: 9,
        regex: /private alpha|insider|insider information|exclusive access|private signals/i
      },
      {
        type: 'Unrealistic Claims',
        weight: 9,
        regex: /x10|x100|x500|x1000|500%|1000%/i
      },
      {
        type: 'Urgency Tactics',
        weight: 8,
        regex: /act now|limited spots|act fast|last chance|ending soon/i
      },
      {
        type: 'Requests Crypto',
        weight: 10,
        regex: /send crypto|transfer|deposit|investment required|vip tier|subscribe/i
      },
      {
        type: 'New Account',
        weight: 7,
        regex: /joined.*\d+ (day|month)/i
      }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(textToAnalyze)) {
        redFlags.push({
          type: pattern.type,
          weight: pattern.weight,
          evidence: `Found in channel: ${pattern.type} pattern detected`
        });
      }
    }

  } catch (error) {
    console.error('Error analyzing Telegram red flags:', error);
  }

  return redFlags;
}

/**
 * Calculate risk score based on red flags
 */
function calculateRiskScore(redFlags, data) {
  const totalWeight = redFlags.reduce((sum, flag) => sum + flag.weight, 0);
  const maxWeight = 90; // Sum of all red flag weights

  const riskScore = maxWeight > 0 ? (totalWeight / maxWeight * 10) : 0;

  let riskLevel = 'LOW';
  if (riskScore >= 7) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 5) {
    riskLevel = 'MEDIUM';
  } else if (riskScore >= 3) {
    riskLevel = 'MEDIUM';
  }

  let verificationStatus = 'Unverified';
  let confidence = 'LOW';

  if (data.followerCount > 100000) {
    confidence = 'HIGH';
  } else if (data.followerCount > 10000) {
    confidence = 'MEDIUM';
  }

  if (riskScore >= 7) {
    verificationStatus = 'Verified';
  } else if (redFlags.length > 0 && riskScore >= 5) {
    verificationStatus = 'Partially Verified';
  } else if (redFlags.length === 0 && confidence === 'HIGH') {
    verificationStatus = 'Legitimate';
  }

  return {
    riskScore,
    riskLevel,
    verificationStatus,
    confidence
  };
}

/**
 * Format scan result for API response
 */
function formatScanResult(data) {
  // Generate summary
  const summary = generateSummary(data);

  return {
    platform: data.platform,
    identifier: data.identifier,
    username: data.username,
    displayName: data.displayName,
    bio: data.bio,
    followerCount: data.followerCount,
    memberCount: data.memberCount,
    messageCount: data.messageCount,
    engagementRate: data.engagementRate || 0,
    isVerified: data.isVerified || false,
    joinDate: data.joinDate,
    website: data.website,
    location: data.location,
    pinnedPosts: data.pinnedPosts || [],
    recentPosts: data.recentPosts || [],
    links: data.links || [],
    riskScore: data.riskScore || 0,
    riskLevel: data.riskLevel || 'LOW',
    verificationStatus: data.verificationStatus || 'Unverified',
    confidence: data.confidence || 'LOW',
    redFlags: data.redFlags || [],
    summary: summary,
    notes: data.notes || '',
    scanType: data.scanType || 'quick'
  };
}

/**
 * Generate text summary of scan results
 */
function generateSummary(data) {
  const { platform, identifier, followerCount, memberCount, isVerified, riskScore, redFlags, verificationStatus, confidence } = data;

  const count = platform === 'x' ? followerCount : memberCount;
  const platformName = platform === 'x' ? 'X' : 'Telegram';
  const countLabel = platform === 'x' ? 'followers' : 'members';
  const verifiedStatus = isVerified ? 'verified' : 'unverified';

  if (riskScore === 0 && verificationStatus === 'Legitimate') {
    return `${identifier} (${count?.toLocaleString() || 0} ${countLabel}, ${verifiedStatus}) — Low risk profile. No red flags detected. Professional presence, clear purpose, legitimate track record. Recommended for engagement.`;
  } else if (riskScore >= 7) {
    return `${identifier} (${count?.toLocaleString() || 0} ${countLabel}, ${verifiedStatus}) — HIGH RISK (${riskScore.toFixed(1)}/10). Multiple red flags: ${redFlags.map(f => f.type).join(', ')}. ${verificationStatus === 'Verified' ? 'Verified' : 'Unverified'}. Caution advised. DO NOT send crypto or share private keys.`;
  } else if (riskScore >= 5) {
    return `${identifier} (${count?.toLocaleString() || 0} ${countLabel}, ${verifiedStatus}) — MEDIUM RISK (${riskScore.toFixed(1)}/10). Red flags: ${redFlags.map(f => f.type).join(', ')}. Proceed with caution. Verify track record before engagement.`;
  } else {
    return `${identifier} — LOW RISK (${riskScore.toFixed(1)}/10). Minimal red flags. Appears legitimate. Use for research and analysis.`;
  }
}