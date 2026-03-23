// ─── OpenClaw Live Scam Detection API ─────────────────────────────────────────────

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
  fullReport?: string;
  xProfile?: {
    name?: string;
    bio?: string;
    followers?: number;
    following?: number;
    isVerified: boolean;
    profileImage?: string;
    profileUrl: string;
    createdDate?: string;
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
  dataSource: 'live' | 'mock';
}

// ─── Risk Scoring Logic ────────────────────────────────────────────────────────

function calculateRiskScore(
  redFlags: string[],
  verificationLevel: string,
  victimReportCount: number,
  isKnownScammer: boolean
): number {
  let score = 0;

  // Red flag weights
  redFlags.forEach(flag => {
    if (flag.includes('Guaranteed returns') || flag.includes('x100')) score += 2.0;
    else if (flag.includes('Private alpha') || flag.includes('VIP')) score += 1.5;
    else if (flag.includes('Urgency') || flag.includes('act now')) score += 1.2;
    else if (flag.includes('No track record') || flag.includes('New account')) score += 1.0;
    else if (flag.includes('Unverified')) score += 0.5;
    else score += 0.8;
  });

  // Known scammer penalty
  if (isKnownScammer) score += 3.0;

  // Victim reports penalty
  if (victimReportCount > 10) score += 2.0;
  else if (victimReportCount > 5) score += 1.5;
  else if (victimReportCount > 0) score += 1.0;

  // Cap at 10
  return Math.min(Math.round(score * 10) / 10, 10);
}

function getVerificationLevel(riskScore: number, victimReportCount: number): string {
  if (riskScore < 3 && victimReportCount === 0) return 'Legitimate';
  if (riskScore >= 7 && victimReportCount >= 5) return 'Highly Verified';
  if (riskScore >= 7 || victimReportCount >= 5) return 'Verified';
  if (riskScore >= 4 || victimReportCount > 0) return 'Partially Verified';
  return 'Unverified';
}

function getRecommendedAction(riskScore: number, verificationLevel: string): string {
  if (riskScore < 3) return 'LOW RISK — Safe to interact. Still exercise normal caution.';
  if (riskScore < 5) return 'PROCEED WITH CAUTION — Medium risk detected. Verify track record before engaging.';
  if (riskScore < 7) return 'HIGH RISK DETECTED — Avoid interaction. Multiple red flags present.';
  return 'CRITICAL RISK — Block/Report immediately. Strong evidence of scam activity.';
}

// ─── Live Data Fetchers ───────────────────────────────────────────────────────

async function fetchXProfile(username: string): Promise<ScamDetectionResult['xProfile']> {
  try {
    // Use OpenClaw's browser automation if available, fallback to public data
    // For now, we'll fetch from public endpoints
    const cleanUsername = username.replace('@', '');
    const response = await fetch(`https://nitter.net/${cleanUsername}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (response.ok) {
      // Parse Nitter response for profile data
      const html = await response.text();
      const nameMatch = html.match(/<title>(.+?) \(@.+?\) <\/title>/);
      const bioMatch = html.match(/<meta name="description" content="(.+?)">/);
      const followersMatch = html.match(/<strong>([\d,]+)<\/strong>\s*<span class="profile-stat-header">Followers<\/span>/);
      const followingMatch = html.match(/<strong>([\d,]+)<\/strong>\s*<span class="profile-stat-header">Following<\/span>/);
      const joinedMatch = html.match(/Joined (.+?)<\/li>/);
      const isVerified = html.includes('<svg class="icon verified"') || html.includes('verified-badge');

      return {
        name: nameMatch?.[1]?.split(' (')[0]?.trim() || undefined,
        bio: bioMatch?.[1]?.trim() || undefined,
        followers: followersMatch?.[1] ? parseInt(followersMatch[1].replace(/,/g, '')) : undefined,
        following: followingMatch?.[1] ? parseInt(followingMatch[1].replace(/,/g, '')) : undefined,
        isVerified,
        profileUrl: `https://x.com/${cleanUsername}`,
        createdDate: joinedMatch?.[1]?.trim() || undefined,
      };
    }
  } catch (error) {
    console.error('Error fetching X profile:', error);
  }

  // Fallback to minimal profile data
  return {
    name: username.startsWith('@') ? username : `@${username}`,
    isVerified: false,
    profileUrl: `https://x.com/${username.replace('@', '')}`,
  };
}

async function fetchWalletAnalysis(walletAddress: string): Promise<ScamDetectionResult['walletAnalysis'] | undefined> {
  if (!walletAddress) return undefined;

  const isSolana = !walletAddress.startsWith('0x');
  const blockchain = isSolana ? 'Solana' : 'Ethereum';

  try {
    // For Solana wallets, use Solscan API
    if (isSolana) {
      const response = await fetch(`https://public-api.solscan.io/account/${walletAddress}`, {
        headers: { 'token': process.env.SOLSCAN_API_KEY || '' }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          address: walletAddress,
          blockchain,
          balance: parseFloat(data.data?.lamports || 0) / 1e9,
          balanceUsd: parseFloat(data.data?.lamports || 0) / 1e9 * 150, // Approximate SOL price
          totalReceived: 0, // Would need transaction history endpoint
          totalSent: 0,
          txCount: parseInt(data.data?.transactionCount || 0),
          uniqueSenders: 0,
        };
      }
    } else {
      // For Ethereum wallets, use Etherscan API
      const response = await fetch(`https://api.etherscan.io/api?module=account&action=balance&address=${walletAddress}&tag=latest&apikey=${process.env.ETHERSCAN_API_KEY || ''}`);

      if (response.ok) {
        const data = await response.json();
        const balanceEth = parseFloat(data.result || 0) / 1e18;
        return {
          address: walletAddress,
          blockchain,
          balance: balanceEth,
          balanceUsd: balanceEth * 3000, // Approximate ETH price
          totalReceived: 0,
          totalSent: 0,
          txCount: 0,
          uniqueSenders: 0,
        };
      }
    }
  } catch (error) {
    console.error('Error fetching wallet analysis:', error);
  }

  return undefined;
}

async function searchVictimReports(username: string): Promise<ScamDetectionResult['victimReports']> {
  const reports: ScamDetectionResult['victimReports']['reports'] = [];

  try {
    // Search Reddit for victim reports
    const redditQuery = encodeURIComponent(`${username.replace('@', '')} scam`);
    const redditResponse = await fetch(`https://www.reddit.com/search.json?q=${redditQuery}&limit=5`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (redditResponse.ok) {
      const data = await redditResponse.json();
      if (data.data?.children) {
        data.data.children.forEach((post: any) => {
          reports.push({
            title: post.data.title,
            url: `https://reddit.com${post.data.permalink}`,
            platform: 'Reddit',
            score: post.data.score,
          });
        });
      }
    }
  } catch (error) {
    console.error('Error searching Reddit:', error);
  }

  return {
    totalReports: reports.length,
    reports,
  };
}

async function checkScammerDatabase(username: string, platform: string): Promise<ScamDetectionResult['knownScammer']> {
  try {
    // Check local scammer database CSV if available
    const response = await fetch('/scammer-database.csv');

    if (response.ok) {
      const csvText = await response.text();
      const lines = csvText.split('\n').slice(1); // Skip header

      for (const line of lines) {
        const columns = line.split(',');
        if (columns[2]?.toLowerCase() === username.toLowerCase() ||
            columns[0]?.toLowerCase().includes(username.toLowerCase())) {
          return {
            name: columns[0] || username,
            status: columns[7] || 'Verified',
            victims: parseInt(columns[4] || '0'),
            notes: columns[9] || 'Known scammer in database',
          };
        }
      }
    }
  } catch (error) {
    console.error('Error checking scammer database:', error);
  }

  return undefined;
}

// ─── Red Flag Detection ───────────────────────────────────────────────────────

function detectRedFlags(
  username: string,
  profile: ScamDetectionResult['xProfile'],
  victimReports: ScamDetectionResult['victimReports']
): string[] {
  const flags: string[] = [];

  if (!profile?.isVerified) {
    flags.push('Unverified account');
  }

  if (profile?.followers && profile.followers < 500) {
    flags.push('Low follower count (possible bot/fake account)');
  }

  if (profile?.bio) {
    const bioLower = profile.bio.toLowerCase();

    if (bioLower.includes('guaranteed') || bioLower.includes('100x') || bioLower.includes('1000x')) {
      flags.push('Claims guaranteed returns or unrealistic profits');
    }

    if (bioLower.includes('private') && bioLower.includes('alpha')) {
      flags.push('Private alpha/early access model (requires payment for information)');
    }

    if (bioLower.includes('vip') || bioLower.includes('premium')) {
      flags.push('VIP upsell tactics (paid tiers for access)');
    }

    if (bioLower.includes('act now') || bioLower.includes('limited time') || bioLower.includes('fomo')) {
      flags.push('Urgency tactics to create fear of missing out');
    }
  }

  if (profile?.createdDate) {
    const createdDate = new Date(profile.createdDate);
    const accountAge = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30); // months

    if (accountAge < 3) {
      flags.push(`New account (${Math.round(accountAge)} months old)`);
    }
  }

  if (victimReports.totalReports > 0) {
    flags.push(`${victimReports.totalReports} victim report(s) found on Reddit`);
  }

  return flags;
}

// ─── Generate Full Report ───────────────────────────────────────────────────────

function generateFullReport(
  result: ScamDetectionResult
): string {
  let report = `SCAM DETECTION REPORT
=====================

Target: ${result.username}
Platform: ${result.platform}
Investigation Date: ${new Date().toISOString()}
Data Source: ${result.dataSource.toUpperCase()}

RISK ASSESSMENT
Risk Score: ${result.riskScore}/10 (${result.riskScore < 4 ? 'LOW' : result.riskScore < 7 ? 'MEDIUM' : 'HIGH'} RISK)
Verification Level: ${result.verificationLevel}

RECOMMENDED ACTION
${result.recommendedAction}

RED FLAGS FOUND (${result.redFlags.length})
${result.redFlags.map(flag => `- ${flag}`).join('\n')}`;

  if (result.scamType) {
    report += `\n\nSCAM TYPE\n${result.scamType}`;
  }

  if (result.xProfile) {
    report += `\n\nPROFILE ANALYSIS
${result.xProfile.name || result.username}
${result.xProfile.isVerified ? '✓ Verified' : '✗ Unverified'}`;
    if (result.xProfile.followers !== undefined) {
      report += `\nFollowers: ${result.xProfile.followers.toLocaleString()}`;
    }
    if (result.xProfile.following !== undefined) {
      report += `\nFollowing: ${result.xProfile.following.toLocaleString()}`;
    }
    if (result.xProfile.createdDate) {
      report += `\nAccount Created: ${result.xProfile.createdDate}`;
    }
    if (result.xProfile.bio) {
      report += `\nBio: ${result.xProfile.bio}`;
    }
    report += `\nProfile URL: ${result.xProfile.profileUrl}`;
  }

  if (result.victimReports && result.victimReports.totalReports > 0) {
    report += `\n\nVICTIM REPORTS FOUND: ${result.victimReports.totalReports}`;
    result.victimReports.reports.forEach((report, idx) => {
      report += `\n${idx + 1}. "${report.title}" - ${report.platform}`;
      if (report.score !== undefined) {
        report += ` (${report.score} ${report.score === 1 ? 'upvote' : 'upvotes'})`;
      }
      report += `\n   ${report.url}`;
    });
  }

  report += `\n\nEVIDENCE
${result.evidence.map(ev => `- ${ev}`).join('\n')}`;

  if (result.knownScammer) {
    report += `\n\n⚠️ KNOWN SCAMMER DETECTED\nStatus: ${result.knownScammer.status}\nVictims: ${result.knownScammer.victims}\nNotes: ${result.knownScammer.notes}`;
  }

  report += `\n\nDISCLAIMER
This report contains only publicly available information. Use for legitimate awareness purposes only. Do not harass, dox, or contact scammers directly — file reports with proper authorities.`;

  return report;
}

// ─── API Route Handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json() as ScamDetectionRequest;
    const { username, platform, walletAddress } = body;

    // Validate request
    if (!username || !platform) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: username and platform' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (platform !== 'X' && platform !== 'Telegram') {
      return new Response(
        JSON.stringify({ error: 'Invalid platform. Must be "X" or "Telegram"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch live data
    const [xProfile, walletAnalysis, victimReports, knownScammer] = await Promise.all([
      platform === 'X' ? fetchXProfile(username) : Promise.resolve(undefined),
      fetchWalletAnalysis(walletAddress || ''),
      searchVictimReports(username),
      checkScammerDatabase(username, platform),
    ]);

    // Detect red flags
    const redFlags = detectRedFlags(username, xProfile, victimReports);

    // Add wallet-related red flags if provided
    if (walletAnalysis && walletAnalysis.uniqueSenders >= 5) {
      redFlags.push(`High number of unique wallet senders (${walletAnalysis.uniqueSenders}) — possible victim aggregation`);
    }

    // Calculate risk score
    const riskScore = calculateRiskScore(
      redFlags,
      'unknown',
      victimReports.totalReports,
      !!knownScammer
    );

    // Determine verification level
    const verificationLevel = getVerificationLevel(riskScore, victimReports.totalReports);

    // Get recommended action
    const recommendedAction = getRecommendedAction(riskScore, verificationLevel);

    // Determine scam type
    let scamType: string | undefined;
    if (redFlags.some(f => f.includes('guaranteed') || f.includes('unrealistic'))) {
      scamType = 'Investment Fraud / High-Yield Scam';
    } else if (redFlags.some(f => f.includes('private alpha') || f.includes('VIP'))) {
      scamType = 'Paid Signal / Premium Alpha Scam';
    } else if (redFlags.some(f => f.includes('urgency'))) {
      scamType = 'Pump-and-Dump / FOMO Scheme';
    } else if (redFlags.some(f => f.includes('wallet') || f.includes('aggregation'))) {
      scamType = 'Wallet Drainer / Phishing Scheme';
    }

    // Generate evidence
    const evidence = [
      redFlags.length > 0 ? `${redFlags.length} red flag(s) detected` : 'No red flags detected',
      xProfile ? `Profile data analyzed: ${xProfile.isVerified ? 'Verified' : 'Unverified'}, ${xProfile.followers?.toLocaleString() || 'N/A'} followers` : 'Profile data unavailable',
      victimReports.totalReports > 0 ? `${victimReports.totalReports} victim report(s) found on Reddit` : 'No victim reports found',
      walletAnalysis ? `Wallet analyzed on ${walletAnalysis.blockchain}` : 'No wallet analysis performed',
      `Investigation timestamp: ${new Date().toISOString()}`,
    ];

    // Build result
    const result: ScamDetectionResult = {
      username,
      platform,
      riskScore,
      redFlags,
      verificationLevel: verificationLevel as any,
      scamType,
      recommendedAction,
      xProfile,
      walletAnalysis,
      victimReports,
      knownScammer,
      evidence,
      dataSource: 'live',
      fullReport: '', // Will be generated below
    };

    // Generate full report
    result.fullReport = generateFullReport(result);

    // Return result
    return new Response(
      JSON.stringify({ results: [result], mock: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scam detection error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}