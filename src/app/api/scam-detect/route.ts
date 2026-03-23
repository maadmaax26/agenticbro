import { NextRequest, NextResponse } from 'next/server';

// ─── OpenClaw sub-agent integration for scam detection ────────────────────────

// OpenClaw sub-agent prompt for scam detection
const SCAM_DETECTION_PROMPT = (username: string, platform: 'X' | 'Telegram', walletAddress?: string): string => {
  return `
You are the OpenClaw Scam Detection Agent. Your task is to investigate ${platform} user "${username}" for scam patterns.

${walletAddress ? `Wallet address to analyze: ${walletAddress}\n` : ''}

Perform a comprehensive investigation using the following tools:
1. Browser automation to scrape profile data (${platform === 'X' ? 'X/Twitter' : 'Telegram'})
2. Web search for victim reports (Reddit, Google, Bitcointalk)
3. Check scammer database if available
${walletAddress ? '4. Blockchain analysis (Solscan/Etherscan)' : ''}

Risk Scoring (0-10 scale):
- 0-3: LOW RISK (safe to interact)
- 4-6: MEDIUM RISK (proceed with caution)
- 7-10: HIGH RISK/Critical (avoid)

Red Flag Indicators (check each):
1. Guaranteed returns (weight: 9)
2. Private alpha/early access (weight: 9)
3. Unrealistic claims (x5-x100 returns) (weight: 9)
4. Urgency tactics (weight: 8)
5. No track record (weight: 8)
6. Unverified account (weight: 5)
7. Fake followers (weight: 6)
8. New account (<3 months) (weight: 7)
9. VIP upsell tactics (weight: 6)
10. Requests crypto upfront (weight: 10)

Verification Levels:
- Unverified: Insufficient data
- Partially Verified: Pattern matches, limited evidence
- Verified: Confirmed scam (5+ victims)
- Highly Verified: Multiple evidence sources
- Legitimate: Verified safe account

Return ONLY a JSON object with this structure:
{
  "username": "${username}",
  "platform": "${platform}",
  "riskScore": number (0-10),
  "redFlags": string[],
  "verificationLevel": "Unverified" | "Partially Verified" | "Verified" | "Highly Verified" | "Legitimate",
  "scamType": string | undefined,
  "recommendedAction": string,
  "xProfile": {
    "name": string | undefined,
    "bio": string | undefined,
    "followers": number | undefined,
    "following": number | undefined,
    "isVerified": boolean,
    "profileImage": string | undefined,
    "profileUrl": string
  } | undefined,
  "walletAnalysis": {
    "address": string,
    "blockchain": string,
    "balance": number,
    "balanceUsd": number,
    "totalReceived": number,
    "totalSent": number,
    "txCount": number,
    "uniqueSenders": number
  } | undefined,
  "victimReports": {
    "totalReports": number,
    "reports": { title: string; url: string; platform: string; score?: number }[]
  } | undefined,
  "knownScammer": {
    "name": string;
    "status": string;
    "victims": number;
    "notes": string
  } | undefined,
  "evidence": string[],
  "fullReport": string
}

Do not include markdown formatting, explanations, or conversational text. Return ONLY valid JSON.
`;
};

interface ScamDetectionRequest {
  username: string;
  platform: 'X' | 'Telegram';
  walletAddress?: string;
}

interface ScamDetectionResult {
  username: string;
  platform: 'X' | 'Telegram';
  riskScore: number;
  redFlags: string[];
  verificationLevel: 'Unverified' | 'Partially Verified' | 'Verified' | 'Highly Verified' | 'Legitimate';
  scamType?: string;
  recommendedAction: string;
  xProfile?: {
    name?: string;
    bio?: string;
    followers?: number;
    following?: number;
    isVerified: boolean;
    profileImage?: string;
    profileUrl: string;
  };
  walletAnalysis?: {
    address: string;
    blockchain: string;
    balance: number;
    balanceUsd: number;
    totalReceived: number;
    totalSent: number;
    txCount: number;
    uniqueSenders: number;
  };
  victimReports?: {
    totalReports: number;
    reports: { title: string; url: string; platform: string; score?: number }[];
  };
  knownScammer?: {
    name: string;
    status: string;
    victims: number;
    notes: string;
  };
  evidence: string[];
  fullReport: string;
}

// ─── API Route Handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ScamDetectionRequest;
    const { username, platform, walletAddress } = body;

    // Validate request
    if (!username || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: username and platform' },
        { status: 400 }
      );
    }

    if (platform !== 'X' && platform !== 'Telegram') {
      return NextResponse.json(
        { error: 'Invalid platform. Must be "X" or "Telegram"' },
        { status: 400 }
      );
    }

    // For demo/demo mode, return mock data when backend is not available
    // In production, this would integrate with OpenClaw via an internal API
    const mockResult: ScamDetectionResult = {
      username,
      platform,
      riskScore: 5.5,
      redFlags: [
        'No public track record of trading performance',
        'High frequency of token calls without analysis',
        'Aggressive marketing tactics detected'
      ],
      verificationLevel: 'Partially Verified',
      scamType: 'Pump-and-Dump Channel',
      recommendedAction: 'PROCEED WITH CAUTION — Medium risk detected (5.5/10). Verify track record before engaging. Never send crypto without independent verification.',
      xProfile: platform === 'X' ? {
        name: username.startsWith('@') ? username : `@${username}`,
        bio: 'Alpha calls | 1000x gems | DM for VIP access',
        followers: 2500,
        following: 450,
        isVerified: false,
        profileUrl: `https://x.com/${username.replace('@', '')}`,
      } : undefined,
      walletAnalysis: walletAddress ? {
        address: walletAddress,
        blockchain: walletAddress.startsWith('0x') ? 'Ethereum' : 'Solana',
        balance: walletAddress.startsWith('0x') ? 0.45 : 12.3,
        balanceUsd: walletAddress.startsWith('0x') ? 1450 : 2150,
        totalReceived: walletAddress.startsWith('0x') ? 8.5 : 45.7,
        totalSent: walletAddress.startsWith('0x') ? 8.05 : 33.4,
        txCount: walletAddress.startsWith('0x') ? 45 : 127,
        uniqueSenders: walletAddress.startsWith('0x') ? 8 : 15,
      } : undefined,
      victimReports: {
        totalReports: 2,
        reports: [
          { title: 'Is this account legit?', url: 'https://reddit.com/r/CryptoScams/comments/abc', platform: 'Reddit', score: 45 },
          { title: 'Warning: High risk channel', url: 'https://bitcointalk.org/index.php?topic=123', platform: 'Bitcointalk' },
        ],
      },
      evidence: [
        'Account created less than 6 months ago',
        'No verification on platform',
        'Posting pattern suggests promotional content',
        'Multiple users raising concerns in forums',
      ],
      fullReport: `SCAM DETECTION REPORT\n====================\n\nTarget: ${username}\nPlatform: ${platform}\nInvestigation Date: ${new Date().toISOString()}\n\nRISK ASSESSMENT\nRisk Score: 5.5/10 (MEDIUM RISK)\nVerification Level: Partially Verified\n\nRECOMMENDED ACTION\nPROCEED WITH CAUTION — Medium risk detected. Verify track record before engaging.\n\nRED FLAGS FOUND\n- No public track record of trading performance\n- High frequency of token calls without analysis\n- Aggressive marketing tactics detected\n\nPROFILE ANALYSIS${platform === 'X' ? '\n- Account: ' + username + '\n- Followers: 2,500\n- Verified: No\n- Account Age: Less than 6 months' : '\n- Channel: ' + username + '\n- Members: Data not available\n- Created: Less than 6 months ago'}\n\nVICTIM REPORTS FOUND: 2\n1. "Is this account legit?" - Reddit (45 upvotes)\n2. "Warning: High risk channel" - Bitcointalk\n\nEVIDENCE\n- Account created less than 6 months ago\n- No verification on platform\n- Posting pattern suggests promotional content\n- Multiple users raising concerns in forums\n\nDISCLAIMER\nThis report contains only publicly available information. Use for legitimate awareness purposes only. Do not harass or contact scammers directly.`,
    };

    // Return mock result (would integrate with OpenClaw sub-agent in production)
    return NextResponse.json({ results: [mockResult], mock: true });
  } catch (error) {
    console.error('Scam detection error:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';