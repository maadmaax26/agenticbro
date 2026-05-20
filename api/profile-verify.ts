/**
 * Profile Verification API - Vercel Serverless Function
 *
 * Endpoint: POST /api/profile-verify
 * Verifies social media profiles for scam detection
 *
 * For Twitter/X: Submits job to Supabase queue; Mac Studio worker
 *                (OpenClaw) picks it up and returns real CDP scan data.
 * For other platforms: Pattern-based detection fallback.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────────
interface ProfileVerifyRequest {
    platform: 'twitter' | 'telegram' | 'instagram' | 'discord' | 'linkedin' | 'facebook';
    username: string;
    verificationContext?: 'crypto' | 'romance' | 'employment' | 'marketplace' | 'financial' | 'general';
    options?: {
      deepScan?: boolean;
      includeMedia?: boolean;
      sampleFollowers?: boolean;
      forceRefresh?: boolean;
    };
}

interface ProfileVerifyResult {
    success: boolean;
    platform: string;
    username: string;
    displayName?: string;
    verified?: boolean;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    verificationLevel: string;
    scamType?: string;
    redFlags: string[];
    evidence: string[];
    recommendation: string;
    profileData?: {
      followers?: number;
      following?: number;
      posts?: number;
      bio?: string;
      location?: string;
      website?: string;
      joinDate?: string;
      profileImage?: string;
      accountAge?: string;
      promotedTokens?: string[];
      recentPosts?: string[];
    };
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    scanDate: string;
    dataSource: 'supabase_queue' | 'pattern_analysis' | 'fallback';
    botDetection?: { botScore: number; classification: string; flags: BotFlagLite[]; engagementAnalysis?: EngagementAnalysisLite };
}

// ─── Supabase Queue-Based Scanner ────────────────────────────────────────────────
// Submits a profile scan job to Supabase; Mac Studio OpenClaw worker picks it up async.
async function callLocalScanner(platform: string, username: string): Promise<any> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
        console.warn('[profile-verify] Supabase env vars not set — skipping queue scan');
        return null;
  }

  try {
        // Lazy-import to avoid module-level crash if env vars are absent
      const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

      // 1. Enqueue the job
      const { data: job, error: insertErr } = await supabase
          .from('scan_jobs')
          .insert({
                    scan_type: 'profile',
                    payload: { username, platform },
                    status: 'pending',
                    priority: 3,
          })
          .select('id')
          .single();

      if (insertErr || !job) {
              console.error('[profile-verify] Failed to enqueue scan job:', insertErr?.message);
              return null;
      }

      console.log('[profile-verify] Job enqueued:', job.id);

      // 2. Poll for completion (max 15 s, 1 s interval)
      const deadline = Date.now() + 15_000;
        while (Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, 1000));
                const { data: row } = await supabase
                  .from('scan_jobs')
                  .select('status, result')
                  .eq('id', job.id)
                  .single();

          if (row?.status === 'completed' && row.result) {
                    console.log('[profile-verify] Job completed:', job.id);
                    return { success: true, data: row.result };
          }
                if (row?.status === 'failed' || row?.status === 'timeout') {
                          console.error('[profile-verify] Scan job failed/timed-out:', row);
                          return null;
                }
        }

      console.warn('[profile-verify] Scan job timed out waiting for result:', job.id);
        return null;
  } catch (error) {
        console.error('[profile-verify] Queue scan error:', error);
        return null;
  }
}

// ─── Scam Pattern Detection ───────────────────────────────────────────────────────
const SCAM_PATTERNS: Record<string, { type: string; riskScore: number; flags: string[] }> = {
    'giveaway': { type: 'Giveaway Scam', riskScore: 90, flags: ['Giveaway scam pattern in username', 'Typical scammer naming convention', 'Likely impersonating legitimate account'] },
    'airdrop':  { type: 'Airdrop Scam',  riskScore: 88, flags: ['Airdrop scam pattern', 'Wallet drainer likely', 'Do not connect wallet'] },
    'free':     { type: 'Free Money Scam', riskScore: 80, flags: ['"Free" in username', 'Too good to be true', 'Classic scam pattern'] },
    'winner':   { type: 'Lottery Scam',  riskScore: 82, flags: ['Winner/lottery pattern', 'Fake prize offer', 'Advance fee scam likely'] },
    'crypto_':  { type: 'Crypto Impersonation', riskScore: 75, flags: ['Crypto-related username pattern', 'Potential rug pull promoter', 'High-risk category'] },
    'defi_':    { type: 'DeFi Scam',     riskScore: 78, flags: ['DeFi impersonation', 'Likely fake project', 'Do not invest'] },
    'nft_':     { type: 'NFT Scam',      riskScore: 76, flags: ['NFT impersonation', 'Fake collection', 'Wallet drainer risk'] },
    'elon':     { type: 'Celebrity Impersonation', riskScore: 85, flags: ['Celebrity name in username', 'Likely impersonation attempt', 'Common scam tactic'] },
    'vitalik':  { type: 'Celebrity Impersonation', riskScore: 85, flags: ['Vitalik impersonation', 'Ethereum founder fake', 'Never share keys'] },
    'satoshi':  { type: 'Celebrity Impersonation', riskScore: 88, flags: ['Satoshi impersonation', 'Bitcoin creator fake', 'Classic scam'] },
    'support':  { type: 'Support Scam',  riskScore: 78, flags: ['Fake support account', 'Will ask for seed phrase', 'Social engineering'] },
    'admin':    { type: 'Impersonation', riskScore: 75, flags: ['Admin impersonation', 'Not an official account', 'Will DM asking for info'] },
    'official': { type: 'Impersonation', riskScore: 72, flags: ['Fake "official" account', 'Not verified', 'Scam indicator'] },
    'help':     { type: 'Support Scam',  riskScore: 70, flags: ['Help/support pattern', 'Likely asking for credentials', 'Social engineering'] },
    '_give':    { type: 'Giveaway Scam', riskScore: 88, flags: ['Giveaway pattern detected', 'Fake giveaway account', 'Do not send funds'] },
    '_airdrop': { type: 'Airdrop Scam',  riskScore: 85, flags: ['Airdrop scam pattern', 'Wallet drainer likely', 'Never share seed phrase'] },
    '_official':{ type: 'Impersonation', riskScore: 75, flags: ['Fake official account', 'Not affiliated', 'Scam indicator'] },
    '_support': { type: 'Support Scam',  riskScore: 80, flags: ['Fake support account', 'Will request private keys', 'Do not engage'] },
    'real':     { type: 'Impersonation', riskScore: 65, flags: ['"real" in username often indicates fake', 'Impersonation tactic', 'Verify independently'] },
    'promoter': { type: 'Shill Account', riskScore: 70, flags: ['Self-described promoter', 'Likely paid shill', 'Multiple token promotions'] },
    'alpha':    { type: 'Alpha Bait',    riskScore: 65, flags: ['Alpha hunting pattern', 'Likely pump promoter', 'High-risk category'] },
    'gem':      { type: 'Gem Hunter',    riskScore: 60, flags: ['Gem/promoter pattern', 'Likely token shill', 'Verify independently'] },
    '1000x':   { type: 'Unrealistic Returns', riskScore: 85, flags: ['1000x claims', 'Too good to be true', 'Classic pump pattern'] },
    '100x':    { type: 'Unrealistic Returns', riskScore: 80, flags: ['100x claims', 'Unrealistic promise', 'Pump and dump likely'] },
    'moonshot': { type: 'Moonshot Scam', riskScore: 75, flags: ['Moonshot terminology', 'Pump pattern', 'Exit liquidity warning'] },
};

const BIO_RED_FLAGS = [
  { pattern: /dm me|dm now|dm for|dm to/i,              score: 15, flag: 'DM solicitation' },
  { pattern: /1000x|100x|moonshot|gem|alpha/i,           score: 10, flag: 'Unrealistic returns claims' },
  { pattern: /project promoter|crypto promoter|shill/i,  score: 12, flag: 'Self-described shill account' },
  { pattern: /limited time|act now|hurry|last chance/i,  score: 8,  flag: 'Urgency tactics' },
  { pattern: /presale|presale live|presale now/i,        score: 10, flag: 'Presale promotion (high risk)' },
  { pattern: /guaranteed|guarantee|sure thing/i,         score: 15, flag: 'Guaranteed returns (scam)' },
  { pattern: /airdrop|free|giveaway/i,                   score: 12, flag: 'Giveaway/airdrop pattern' },
  { pattern: /trusted source|your trusted|verified source/i, score: 8, flag: 'False authority claim' },
  ];

function analyzeBio(bio: string): { score: number; flags: string[] } {
    let score = 0;
    const flags: string[] = [];
    for (const { pattern, score: add, flag } of BIO_RED_FLAGS) {
          if (pattern.test(bio)) { score += add; flags.push(flag); }
    }
    return { score, flags };
}

function detectScamPatterns(username: string, bio?: string): { type: string; riskScore: number; flags: string[] } | null {
    const lowerUsername = username.toLowerCase();
    let bestMatch: { type: string; riskScore: number; flags: string[] } | null = null;
    let maxScore = 0;

  for (const [pattern, data] of Object.entries(SCAM_PATTERNS)) {
        if (lowerUsername.includes(pattern)) {
                if (data.riskScore > maxScore) { maxScore = data.riskScore; bestMatch = data; }
        }
  }

  if (lowerUsername.includes('_') && (lowerUsername.includes('give') || lowerUsername.includes('free'))) {
        if (!bestMatch || 85 > maxScore) {
                bestMatch = { type: 'Giveaway Scam', riskScore: 85, flags: ['Suspicious username pattern', 'Giveaway scam indicator', 'Do not engage'] };
        }
  }

  if (bio) {
        const bioAnalysis = analyzeBio(bio);
        if (bioAnalysis.score > 0) {
                if (bestMatch) {
                          bestMatch.riskScore = Math.min(100, bestMatch.riskScore + bioAnalysis.score);
                          bestMatch.flags = [...bestMatch.flags, ...bioAnalysis.flags];
                } else if (bioAnalysis.score >= 15) {
                          bestMatch = { type: 'Suspicious Profile', riskScore: bioAnalysis.score, flags: bioAnalysis.flags };
                }
        }
  }
    return bestMatch;
}

function calculateRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 70) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
}

// ─── Known Scammers Database Check ───────────────────────────────────────────────
async function checkKnownScammers(username: string): Promise<{
    found: boolean; level?: string; scamType?: string; riskScore?: number; notes?: string;
}> {
    const handle = username.replace(/^@/, '').toLowerCase();

  try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SECRET_API_KEY;

      console.log('[profile-verify] Checking known scammers for:', handle);

      if (!supabaseUrl || !supabaseKey) {
              // Fallback to local JSON
          console.log('[profile-verify] Using local JSON fallback');
              const dbPath = path.join(process.cwd(), 'api', 'scammer-database.json');
              if (fs.existsSync(dbPath)) {
                        const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
                        const match = db.find((row: any) =>
                                    (row['X Handle'] || row.x_handle || '').toLowerCase().replace('@', '') === handle ||
                                    (row.username || '').toLowerCase() === handle
                                                      );
                        if (match) {
                                    const level = (match['Verification Level'] || match.verification_level || 'UNVERIFIED').toUpperCase();
                                    return {
                                                  found: true, level,
                                                  scamType: match['Scam Type'] || match.scam_type || 'Unknown',
                                                  riskScore: level === 'HIGH RISK' ? 95 : level === 'LEGITIMATE' ? 5 : 50,
                                                  notes: match['Notes'] || match.notes || '',
                                    };
                        }
              }
              return { found: false };
      }

      const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

      const { data } = await supabase
          .from('known_scammers')
          .select('*')
          .or(`x_handle.ilike.%${handle}%,username.ilike.%${handle}%`)
          .limit(1);

      console.log('[profile-verify] Supabase returned:', data?.length ?? 0, 'records');

      if (data && data.length > 0) {
              const row = data[0];
              const rawLevel = row.verification_level || row.threat_level || 'UNVERIFIED';
              const level = rawLevel.toUpperCase();
              console.log('[profile-verify] Found:', row.username, 'level:', level);
              return {
                        found: true, level,
                        scamType: row.scam_type || 'Unknown',
                        riskScore: row.risk_score || (level === 'HIGH RISK' || level === 'CRITICAL' ? 95 : level === 'LEGITIMATE' ? 5 : 50),
                        notes: row.notes || '',
              };
      }
        return { found: false };
  } catch (error) {
        console.error('[profile-verify] Error checking known scammers:', error);
        return { found: false };
  }
}

function determineVerificationLevel(score: number, verified: boolean, accountAge?: number): string {
    if (score >= 80) return 'HIGH RISK';
    if (score >= 60) return 'Unverified';
    if (score >= 40) return 'Partially Verified';
    if (verified) return 'Verified';
    if (accountAge && accountAge > 365) return 'Legitimate';
    return 'Unverified';
}

function generateRecommendation(riskLevel: string, platform: string): string {
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    switch (riskLevel) {
      case 'CRITICAL': return `🚨 AVOID THIS ACCOUNT. High probability of scam activity detected. Do not send funds, share personal information, or click any links. Report this account to ${platformName}.`;
      case 'HIGH':     return `⚠️ Exercise extreme caution. Multiple scam indicators detected. Verify through official channels before engaging. Never share wallet seed phrases or send funds.`;
      case 'MEDIUM':   return `⚡ Proceed with caution. Some suspicious indicators found. Verify the account through official channels before engaging in any transactions.`;
      default:         return `✅ No major scam indicators detected. However, always verify accounts independently before sharing sensitive information or sending funds.`;
    }
}

function formatAccountAge(days: number): string {
    if (days < 1)   return 'less than 1 day';
    if (days < 7)   return `${days} days`;
    if (days < 30)  return `${Math.floor(days / 7)} weeks`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)}+ years`;
}

// ── Inline: Bot Detection (lightweight, for serverless) ──────────────────────
// Full version lives in src/lib/bot-detection.ts (used by frontend)

interface BotFlagLite {
  id: string; name: string; points: number; description: string; detail?: string;
}

// ── Inline: Engagement Analysis (lightweight, for serverless) ────────────────
// Full version lives in src/lib/engagement-analysis.ts (used by frontend)

interface EngagementPatternsLite {
  ghostComments: { detected: boolean; replyCount: number; visibleReplies: number; hiddenRatio: number };
  viewInflation: { detected: boolean; views: number; followers: number; ratio: number };
  engagementPods: { detected: boolean; podAccounts: string[]; overlapScore: number; firstCommenters: string[] };
  coordinatedTiming: { detected: boolean; waves: number; avgInterval: number; burstScore: number };
  activityPattern: { detected: boolean; activeHours: number[]; sleepGapHours: number; botScore: number };
}

interface EngagementAnalysisLite {
  patterns: EngagementPatternsLite;
  flags: { id: string; name: string; severity: string; points: number; maxPoints: number; description: string; detail: string }[];
  overallScore: number;
  summary: string;
}

function analyzeEngagementLite(workerData: WorkerEngagementDataLite): EngagementAnalysisLite | null {
  if (!workerData.recentTweets || workerData.recentTweets.length === 0) return null;

  const tweets = workerData.recentTweets;
  const followers = workerData.followers || 0;

  // Ghost Comments
  let totalReply = 0, totalVisible = 0;
  for (const t of tweets) { totalReply += t.replyCount; totalVisible += t.visibleReplies; }
  const hidden = totalReply - totalVisible;
  const hiddenRatio = totalReply > 0 ? hidden / totalReply : 0;
  const ghostComments: EngagementPatternsLite['ghostComments'] = {
    detected: hiddenRatio > 0.5 && totalReply > 5,
    replyCount: totalReply, visibleReplies: totalVisible,
    hiddenRatio: Math.round(hiddenRatio * 100) / 100,
  };

  // View Inflation
  const avgViews = tweets.reduce((s, t) => s + t.views, 0) / tweets.length;
  const viewRatio = followers > 0 ? avgViews / followers : 0;
  const viewInflation: EngagementPatternsLite['viewInflation'] = {
    detected: viewRatio > 10 && avgViews > 1000,
    views: Math.round(avgViews), followers,
    ratio: Math.round(viewRatio * 10) / 10,
  };

  // Engagement Pods
  const commenterCounts = new Map<string, number>();
  let tweetsWithComments = 0;
  for (const t of tweets) {
    if (t.firstCommenters.length > 0) {
      tweetsWithComments++;
      for (const c of t.firstCommenters) commenterCounts.set(c, (commenterCounts.get(c) || 0) + 1);
    }
  }
  const podThreshold = Math.max(2, tweetsWithComments * 0.4);
  const podAccounts = [...commenterCounts.entries()].filter(([, c]) => c >= podThreshold).map(([a]) => a);
  const firstCommenters = [...commenterCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([a]) => a);
  const overlapScore = tweetsWithComments > 0
    ? Math.min(1, [...commenterCounts.values()].filter(c => c >= 2).length / (tweetsWithComments * 0.5)) : 0;
  const engagementPods: EngagementPatternsLite['engagementPods'] = {
    detected: podAccounts.length >= 3, podAccounts,
    overlapScore: Math.round(overlapScore * 100) / 100, firstCommenters,
  };

  // Coordinated Timing
  const allTimes = tweets.flatMap(t => t.commentTimes).sort((a, b) => a - b);
  const BURST_WINDOW = 5;
  let bursts = 0, inBurst = false, clustered = 0;
  for (let i = 1; i < allTimes.length; i++) {
    if (allTimes[i] - allTimes[i - 1] <= BURST_WINDOW) {
      if (!inBurst) { bursts++; inBurst = true; }
      clustered++;
    } else { inBurst = false; }
  }
  const avgInterval = allTimes.length > 1 ? Math.round(allTimes.reduce((s, _, i) => i > 0 ? s + (allTimes[i] - allTimes[i - 1]) : s, 0) / (allTimes.length - 1)) : 0;
  const burstScore = allTimes.length > 0 ? clustered / allTimes.length : 0;
  const coordinatedTiming: EngagementPatternsLite['coordinatedTiming'] = {
    detected: burstScore > 0.5 && bursts >= 2, waves: bursts,
    avgInterval, burstScore: Math.round(burstScore * 100) / 100,
  };

  // 24/7 Activity
  const hours = tweets.filter(t => t.postedAt).map(t => new Date(t.postedAt).getHours());
  const uniqueHours = [...new Set(hours)].sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < uniqueHours.length; i++) maxGap = Math.max(maxGap, uniqueHours[i] - uniqueHours[i - 1]);
  if (uniqueHours.length > 1) maxGap = Math.max(maxGap, (24 - uniqueHours[uniqueHours.length - 1]) + uniqueHours[0]);
  let botScore = 0;
  if (uniqueHours.length >= 20) botScore = 1.0;
  else if (uniqueHours.length >= 16) botScore = 0.8;
  else if (uniqueHours.length >= 14 || maxGap < 4) botScore = 0.6;
  else if (maxGap < 6) botScore = 0.4;
  else botScore = 0.1;
  const activityPattern: EngagementPatternsLite['activityPattern'] = {
    detected: botScore > 0.5, activeHours: uniqueHours,
    sleepGapHours: maxGap, botScore: Math.round(botScore * 100) / 100,
  };

  // Build flags
  const flags: EngagementAnalysisLite['flags'] = [];
  if (ghostComments.detected) {
    const pts = hiddenRatio > 0.9 ? 20 : hiddenRatio > 0.7 ? 15 : 10;
    flags.push({ id: 'engagement_ghost_comments', name: 'Ghost Comments', severity: hiddenRatio > 0.9 ? 'critical' : hiddenRatio > 0.7 ? 'high' : 'medium', points: pts, maxPoints: 20, description: 'Reply count far exceeds visible replies', detail: `${totalReply} shown, ${totalVisible} visible (${Math.round(hiddenRatio * 100)}% hidden)` });
  }
  if (viewInflation.detected) {
    const pts = viewRatio > 50 ? 15 : viewRatio > 20 ? 12 : 7;
    flags.push({ id: 'engagement_view_inflation', name: 'View Inflation', severity: viewRatio > 50 ? 'critical' : viewRatio > 20 ? 'high' : 'medium', points: pts, maxPoints: 15, description: 'View count disproportionate to follower count', detail: `${avgViews >= 1000 ? `${(avgViews / 1000).toFixed(1)}K` : Math.round(avgViews)} views / ${followers.toLocaleString()} followers (${viewInflation.ratio}x ratio)` });
  }
  if (engagementPods.detected) {
    const pts = podAccounts.length >= 5 ? 15 : 12;
    flags.push({ id: 'engagement_pod', name: 'Engagement Pod', severity: podAccounts.length >= 5 ? 'critical' : 'high', points: pts, maxPoints: 15, description: 'Same accounts consistently appear in first comments', detail: `${podAccounts.length} accounts appear in first comments consistently` });
  }
  if (coordinatedTiming.detected) {
    const pts = burstScore > 0.8 ? 10 : 6;
    flags.push({ id: 'engagement_coordinated_timing', name: 'Coordinated Timing', severity: burstScore > 0.8 ? 'high' : 'medium', points: pts, maxPoints: 10, description: 'Comments arrive in coordinated waves', detail: `Comments arrive in ${bursts} burst(s), avg ${avgInterval}s apart` });
  }
  if (activityPattern.detected) {
    const pts = botScore > 0.8 ? 10 : 7;
    flags.push({ id: 'engagement_all_hours', name: '24/7 Activity', severity: botScore > 0.8 ? 'critical' : 'high', points: pts, maxPoints: 10, description: 'Posts at all hours with no sleep cycle', detail: `Posts ${uniqueHours.length}/24 hrs/day, longest sleep gap: ${maxGap}hrs` });
  }

  const totalPts = flags.reduce((s, f) => s + f.points, 0);
  const overallScore = Math.min(100, Math.round((totalPts / 70) * 100));
  const flagNames = flags.map(f => f.name).join(', ');
  let summary = 'No engagement anomalies detected.';
  if (flags.length > 0) {
    if (overallScore <= 20) summary = `Minor engagement anomalies (${flagNames}), but overall patterns appear organic.`;
    else if (overallScore <= 40) summary = `Some engagement irregularities (${flagNames}). Mixed organic and potentially artificial activity.`;
    else if (overallScore <= 60) summary = `Notable engagement anomalies (${flagNames}). Likely artificial engagement boosting.`;
    else if (overallScore <= 80) summary = `Strong indicators of engagement manipulation (${flagNames}). Metrics are likely artificially inflated.`;
    else summary = `Overwhelming evidence of engagement manipulation (${flagNames}). This profile's engagement is heavily bot-driven.`;
  }

  return { patterns: { ghostComments, viewInflation, engagementPods, coordinatedTiming, activityPattern }, flags, overallScore, summary };
}

interface WorkerEngagementDataLite {
  recentTweets: { id: string; views: number; replyCount: number; visibleReplies: number; firstCommenters: string[]; commentTimes: number[]; postedAt?: string }[];
  followers?: number;
}

function calculateBotScoreLite(input: {
  followers?: number; following?: number; posts?: number; bio?: string;
  username?: string; isDefaultAvatar?: boolean; joinDate?: string;
  location?: string; website?: string; verified?: boolean;
  // Engagement data from CDP scan
  replyCount?: number; visibleReplies?: number; views?: number;
  replyRatio?: number; recentPosts?: string[]; postingHours?: number[];
  engagementPodAccounts?: string[];
}, workerEngagement?: WorkerEngagementDataLite): { botScore: number; classification: string; flags: BotFlagLite[]; engagementAnalysis?: EngagementAnalysisLite } {
  const flags: BotFlagLite[] = [];

  // Suspicious Follow Ratio (15pts)
  if (input.following != null && input.followers != null && input.followers > 0) {
    const ratio = input.following / input.followers;
    if (input.following > 5000 && input.followers < 50) {
      flags.push({ id: 'suspicious_follow_ratio', name: 'Suspicious Follow Ratio', points: 15, description: 'Following far exceeds followers', detail: `Following ${input.following.toLocaleString()} vs ${input.followers.toLocaleString()} followers` });
    } else if (ratio > 3) {
      flags.push({ id: 'suspicious_follow_ratio', name: 'Suspicious Follow Ratio', points: 8, description: 'Follow ratio > 3:1', detail: `Ratio: ${ratio.toFixed(1)}:1` });
    }
  }

  // No Profile Image (10pts)
  if (input.isDefaultAvatar) {
    flags.push({ id: 'no_profile_image', name: 'No Profile Image', points: 10, description: 'Default avatar detected' });
  }

  // No Bio (5pts)
  if (!input.bio || input.bio.trim().length === 0) {
    flags.push({ id: 'no_bio', name: 'No Bio', points: 5, description: 'Empty profile description' });
  }

  // New Account (10pts)
  if (input.joinDate) {
    const ageDays = (Date.now() - new Date(input.joinDate).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 30) flags.push({ id: 'new_account', name: 'New Account', points: 10, description: 'Account < 30 days old', detail: `${Math.floor(ageDays)} days old` });
    else if (ageDays < 90) flags.push({ id: 'new_account', name: 'New Account', points: 3, description: 'Relatively new account', detail: `~${Math.floor(ageDays / 30)} months old` });
  }

  // Low Post Count (5pts)
  if (input.posts != null && input.posts < 50) {
    flags.push({ id: 'low_tweet_count', name: 'Low Post Count', points: input.posts < 10 ? 5 : 3, description: `Only ${input.posts} posts` });
  }

  // Generic Username (5pts)
  if (input.username && (/_\d{4,}$/.test(input.username) || /\d{6,}$/.test(input.username))) {
    flags.push({ id: 'generic_username', name: 'Generic Username Pattern', points: 5, description: 'Auto-generated username pattern', detail: `Username: ${input.username}` });
  }

  // No Location or URL (5pts)
  if (!(input.location && input.location.trim()) && !(input.website && input.website.trim())) {
    flags.push({ id: 'no_location_url', name: 'No Location or URL', points: 5, description: 'Both location and website empty' });
  }

  // High Reply Ratio (10pts)
  if (input.replyRatio != null && input.replyRatio > 0.7) {
    flags.push({ id: 'high_reply_ratio', name: 'High Reply Ratio', points: input.replyRatio > 0.9 ? 10 : 7, description: 'Mostly replies, not original content', detail: `${(input.replyRatio * 100).toFixed(0)}% replies` });
  }

  // Ghost Comments (20pts)
  if (input.replyCount != null && input.visibleReplies != null) {
    if (input.replyCount > 10 && input.visibleReplies < 3) {
      flags.push({ id: 'ghost_comments', name: 'Ghost Comments', points: 20, description: 'Reply count >> visible replies (X spam filter)', detail: `${input.replyCount} replies, ${input.visibleReplies} visible` });
    } else if (input.replyCount > input.visibleReplies * 3) {
      flags.push({ id: 'ghost_comments', name: 'Ghost Comments', points: 15, description: 'Reply count exceeds visible replies', detail: `${input.replyCount} vs ${input.visibleReplies} visible` });
    }
  }

  // View Inflation (15pts)
  if (input.views != null && input.followers != null && input.followers > 0) {
    if (input.views > 10000 && input.followers < 1000) {
      flags.push({ id: 'view_inflation', name: 'View Inflation', points: 15, description: 'Views disproportionate to followers', detail: `${(input.views / 1000).toFixed(1)}K views, ${input.followers.toLocaleString()} followers` });
    } else if (input.views / input.followers > 20) {
      flags.push({ id: 'view_inflation', name: 'View Inflation', points: 7, description: 'View count high relative to followers' });
    }
  }

  // Engagement Pod (15pts)
  if (input.engagementPodAccounts && input.engagementPodAccounts.length >= 3) {
    flags.push({ id: 'engagement_pod_pattern', name: 'Engagement Pod Pattern', points: input.engagementPodAccounts.length >= 5 ? 15 : 10, description: 'Same accounts repeatedly engage', detail: `${input.engagementPodAccounts.length} pod accounts detected` });
  }

  const totalPoints = flags.reduce((s, f) => s + f.points, 0);
  const botScore = Math.min(100, totalPoints);
  const classification = botScore <= 20 ? 'Likely Authentic' : botScore <= 40 ? 'Mild Bot Activity' : botScore <= 60 ? 'Moderate Bot Inflation' : botScore <= 80 ? 'High Bot Inflation' : 'Highly Bot-Inflated';

  // Run engagement analysis if worker data provided
  let engagementAnalysis: EngagementAnalysisLite | undefined;
  if (workerEngagement) {
    engagementAnalysis = analyzeEngagementLite(workerEngagement) ?? undefined;
  }

  return { botScore, classification, flags, engagementAnalysis };
}

// ─── Nitter Web Scrape for X/Twitter ──────────────────────────────────────────────
// Tries multiple Nitter mirrors to scrape profile data and calculate risk score.
// Uses the same 90-point unified scoring as the local scanner.
const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.1d4.us',
  'https://xcancel.com',
];

async function scanXViaNitter(username: string): Promise<ProfileVerifyResult | null> {
  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `${instance}/${username}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });

      if (!res.ok) continue;
      const html = await res.text();

      // Check for not-found / error pages
      if (html.includes('not found') || html.includes('does not exist') || html.includes('No status found')) continue;

      // Parse profile data from Nitter HTML
      const bioMatch = html.match(/<div[^>]*class="profile-bio"[^>]*>([\s\S]*?)<\/div>/i);
      const followersMatch = html.match(/Followers<\/span[^>]*>[\s\S]*?<span[^>]*>([\d,\.]+[KkMm]?)<\/span>/i);
      const followingMatch = html.match(/Following<\/span[^>]*>[\s\S]*?<span[^>]*>([\d,\.]+[KkMm]?)<\/span>/i);
      const joinDateMatch = html.match(/Joined\s*([\w\s]+\d{4})/i);
      const displayNameMatch = html.match(/<div[^>]*class="profile-fullname"[^>]*>([\s\S]*?)<\/div>/i);
      const verifiedMatch = html.match(/verified-icon|blue-check/i);
      const locationMatch = html.match(/<div[^>]*class="profile-location"[^>]*>([\s\S]*?)<\/div>/i);
      const websiteMatch = html.match(/<a[^>]*class="profile-website"[^>]*href="([^"]+)"/i);

      // Extract text values
      const bio = bioMatch ? bioMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const parseCount = (s: string) => {
        if (!s) return 0;
        const lower = s.toLowerCase().replace(/,/g, '');
        if (lower.endsWith('k')) return Math.round(parseFloat(lower) * 1000);
        if (lower.endsWith('m')) return Math.round(parseFloat(lower) * 1000000);
        return parseInt(lower) || 0;
      };
      const followers = followersMatch ? parseCount(followersMatch[1]) : 0;
      const following = followingMatch ? parseCount(followingMatch[1]) : 0;
      const displayName = displayNameMatch ? displayNameMatch[1].replace(/<[^>]+>/g, '').trim() : username;
      const verified = !!verifiedMatch;
      const location = locationMatch ? locationMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const website = websiteMatch ? websiteMatch[1] : '';
      const joinDate = joinDateMatch ? joinDateMatch[1].trim() : '';

      // ── Calculate risk score using 90-point unified scoring ──
      const allText = `${bio} ${displayName} ${username}`.toLowerCase();
      let totalPoints = 0;
      const redFlags: string[] = [];

      // guaranteed_returns (25pts)
      if (/guarantee|100%|risk.?free|can'?t lose|sure.?thing|guaranteed.?return|safe.?bet/i.test(allText)) {
        redFlags.push('guaranteed_returns (25pts) — Claims of guaranteed profits');
        totalPoints += 25;
      }
      // giveaway_airdrop (20pts)
      if (/giveaway|airdrop|free.*token|free.*crypto|claim.*now|give.?away|raffle/i.test(allText)) {
        redFlags.push('giveaway_airdrop (20pts) — Giveaway or airdrop promotion');
        totalPoints += 20;
      }
      // dm_solicitation (15pts)
      if (/dm.?for|dm.?me|slide.?into|slide.?dm|dm.?to.?join|dm.?lfg|dm.?now|message.?me|hit.?my.?dm|check.?dm|sent.?dm|dm.?for.?details/i.test(allText)) {
        redFlags.push('dm_solicitation (15pts) — Requests to DM for more information');
        totalPoints += 15;
      }
      // free_crypto (15pts)
      if (/free.*crypto|free.*sol|free.*btc|free.*eth|mining.*reward|passive.*income|stake.*earn|earn.*free/i.test(allText)) {
        redFlags.push('free_crypto (15pts) — Free crypto/money offers');
        totalPoints += 15;
      }
      // alpha_dm_scheme (15pts)
      if (/private.*alpha|vip.*group|exclusive.*signal|signal.*group|premium.*group|inner.?circle|secret.?group|t\.me\//i.test(allText)) {
        redFlags.push('alpha_dm_scheme (15pts) — Alpha/DM scheme — private group funnel');
        totalPoints += 15;
      }
      // unrealistic_claims (10pts)
      if (/\d+x(?!.*size)|100x|1000x|moonshot|to.?the.?moon|get.?rich|lamborghini|financial.?freedom|10x.?100x/i.test(allText)) {
        redFlags.push('unrealistic_claims (10pts) — Unrealistic profit claims');
        totalPoints += 10;
      }
      // download_install (10pts)
      if (/download|install.*app|get.*app|app.?store|play.?store|download.*now/i.test(allText)) {
        redFlags.push('download_install (10pts) — Download/install request');
        totalPoints += 10;
      }
      // urgency_tactics (10pts)
      if (/limited.*spot|act.?now|last.?chance|hurry|time.?sensitive|ending.?soon|closing.?soon|few.?left|don'?t.?wait|fomo/i.test(allText)) {
        redFlags.push('urgency_tactics (10pts) — Urgency tactics');
        totalPoints += 10;
      }
      // emotional_manipulation (10pts)
      if (/you'?ll.?regret|don'?t.?miss.?out|life.?changing|once.?in.?lifetime|never.?again|must.?have|opportunity.?of/i.test(allText)) {
        redFlags.push('emotional_manipulation (10pts) — Emotional manipulation');
        totalPoints += 10;
      }
      // low_credibility (10pts) — suspicious follower ratios
      const followRatio = followers > 0 ? following / followers : 0;
      if (followRatio > 2.0 && followers < 5000) {
        redFlags.push(`low_credibility (10pts) — Suspicious follower ratio (${following}/${followers})`);
        totalPoints += 10;
      } else if (followRatio > 0.5 && following > 10000 && followers < following * 0.3) {
        redFlags.push('low_credibility (10pts) — Engagement pod pattern (following >> followers)');
        totalPoints += 10;
      } else if (followers < 100) {
        redFlags.push('low_credibility (10pts) — Very low follower count');
        totalPoints += 10;
      }
      // marketing/shill (5pts bonus)
      if (/advertis|market.*agency|promo.*service|shill|paid.*promo|sponsored.*post|marketing.*expert/i.test(allText)) {
        redFlags.push('marketing_shill (5pts) — Marketing/advertising service (paid shill account)');
        totalPoints += 5;
      }
      // telegram link (5pts bonus, only if not already caught by alpha_dm_scheme)
      if (/t\.me\/|telegram\.me\//i.test(allText) && !redFlags.some(f => f.includes('alpha_dm_scheme'))) {
        redFlags.push('telegram_link (5pts) — Telegram link in bio (common scam vector)');
        totalPoints += 5;
      }

      // Convert 90-point total to 0-100 scale (for API consistency)
      const riskScore0to10 = Math.min(totalPoints / 9, 10);
      const apiRiskScore = Math.round(riskScore0to10 * 10); // 0-100 scale
      const riskLevel = calculateRiskLevel(apiRiskScore);

      // Bot detection
      const botDetection = calculateBotScoreLite({
        followers, following,
        bio, username,
        joinDate, location, website, verified,
      });

      return {
        success: true,
        platform: 'twitter',
        username: username, // parameter, not outer scope
        displayName,
        verified,
        riskScore: apiRiskScore,
        riskLevel,
        verificationLevel: determineVerificationLevel(apiRiskScore, verified),
        redFlags: redFlags.length > 0 ? redFlags : ['Profile analyzed via web scan — no major scam indicators found in bio/display name'],
        evidence: redFlags.length > 0
          ? ['Web scan completed via Nitter', `${redFlags.length} risk indicator(s) detected from profile text`]
          : ['Web scan completed — no significant scam indicators found'],
        recommendation: generateRecommendation(riskLevel, 'twitter'),
        profileData: {
          followers: followers || undefined,
          following: following || undefined,
          bio: bio || undefined,
          location: location || undefined,
          website: website || undefined,
          joinDate: joinDate || undefined,
          accountAge: joinDate ? formatAccountAge(Math.floor((Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24))) : undefined,
        },
        confidence: 'MEDIUM', // Web scan is less confident than CDP
        scanDate: new Date().toISOString(),
        dataSource: 'nitter_web',
        botDetection,
      };
    } catch (err: any) {
      console.warn(`[profile-verify] Nitter ${instance} failed:`, err?.message || err);
      continue;
    }
  }
  // All Nitter instances failed
  return null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
        const { platform, username, verificationContext, options } = req.body as ProfileVerifyRequest;

      const SUPPORTED_PLATFORMS = ['twitter', 'telegram', 'instagram', 'discord', 'linkedin', 'facebook'];
        if (!platform || !SUPPORTED_PLATFORMS.includes(platform)) {
                return res.status(400).json({
                          success: false,
                          error: { code: 'INVALID_PLATFORM', message: `Platform must be one of: ${SUPPORTED_PLATFORMS.join(', ')}` },
                });
        }
        if (!username || typeof username !== 'string') {
                return res.status(400).json({ success: false, error: { code: 'INVALID_USERNAME', message: 'Username is required' } });
        }

      const cleanUsername = username.replace(/^@/, '').trim();
        if (cleanUsername.length < 1 || cleanUsername.length > 100) {
                return res.status(400).json({ success: false, error: { code: 'INVALID_USERNAME', message: 'Username must be between 1 and 100 characters' } });
        }

      let result: ProfileVerifyResult;

      // ── Try Supabase queue scan (Twitter only) ──────────────────────────────────
      if (platform === 'twitter') {
              // Try CDP queue scan with 15s timeout (reduced from 30s)
              const scannerResult = await callLocalScanner(platform, cleanUsername);

          if (scannerResult && scannerResult.success) {
                    const data = scannerResult.data;
                    const accountAgeDays = data.accountAgeDays || (data.account_age_years ? data.account_age_years * 365 : null);

                let riskScore = 2.0;
                    let verificationLevel: string | undefined;
                    let scamType: string | undefined;
                    const redFlags: string[] = [...(data.red_flags || [])];

                for (const flag of redFlags) {
                            if (flag.includes('DM') || flag.includes('solicitation')) riskScore += 2.0;
                            else if (flag.includes('Unrealistic') || flag.includes('1000x')) riskScore += 2.5;
                            else if (flag.includes('shill') || flag.includes('promoter'))  riskScore += 2.0;
                            else if (flag.includes('presale'))   riskScore += 2.0;
                            else if (flag.includes('Telegram'))  riskScore += 1.5;
                            else if (flag.includes('alpha') || flag.includes('gem')) riskScore += 1.0;
                            else riskScore += 0.5;
                }

                const knownScammer = await checkKnownScammers(cleanUsername);
                    if (knownScammer?.found) {
                                if (knownScammer.level === 'HIGH RISK' || knownScammer.level === 'CRITICAL') {
                                              riskScore = Math.max(riskScore, 8.0);
                                              redFlags.unshift('KNOWN SCAMMER - In database as HIGH RISK');
                                              verificationLevel = 'HIGH RISK';
                                } else if (knownScammer.level === 'LEGITIMATE') {
                                              riskScore = Math.min(riskScore, 2.0);
                                              redFlags.unshift('Known legitimate account');
                                              verificationLevel = 'LEGITIMATE';
                                } else if (knownScammer.level === 'PAID PROMOTER') {
                                              riskScore = Math.max(riskScore, 3.0);
                                              redFlags.unshift('Known paid promoter - verify promoted projects independently');
                                              verificationLevel = 'PAID PROMOTER';
                                } else if (knownScammer.level === 'VERIFIED') {
                                              riskScore = Math.max(riskScore, 9.0);
                                              redFlags.unshift('VERIFIED SCAMMER - Multiple victim reports');
                                              verificationLevel = 'VERIFIED';
                                }
                                if (knownScammer.scamType) scamType = knownScammer.scamType;
                    }

                riskScore = Math.min(riskScore, 10.0);
                    const apiRiskScore = Math.round(riskScore * 10);
                    const riskLevel = calculateRiskLevel(apiRiskScore);

                result = {
                            success: true, platform, username: cleanUsername,
                            displayName: data.display_name || data.name || cleanUsername,
                            verified: data.verified || false,
                            riskScore: apiRiskScore, riskLevel,
                            verificationLevel: verificationLevel || data.verification_level || determineVerificationLevel(apiRiskScore, data.verified || false, accountAgeDays || undefined),
                            scamType: scamType || data.scam_type,
                            redFlags,
                            evidence: data.evidence || ['Supabase queue scan completed', 'Real profile data analyzed by local agent'],
                            recommendation: generateRecommendation(riskLevel, platform),
                            profileData: {
                                          followers: data.followers, following: data.following,
                                          posts: data.posts_count || data.posts, bio: data.bio,
                                          location: data.location, website: data.website,
                                          joinDate: data.join_date,
                                          accountAge: accountAgeDays ? formatAccountAge(accountAgeDays) : undefined,
                                          promotedTokens: data.promoted_tokens, recentPosts: data.recent_posts,
                            },
                            confidence: 'HIGH', scanDate: new Date().toISOString(), dataSource: 'supabase_queue',
                            botDetection: calculateBotScoreLite({
                              followers: data.followers, following: data.following,
                              posts: data.posts_count || data.posts, bio: data.bio,
                              username: cleanUsername, joinDate: data.join_date,
                              location: data.location, website: data.website,
                              verified: data.verified, isDefaultAvatar: data.default_profile_image,
                              replyCount: data.reply_count, visibleReplies: data.visible_replies,
                              views: data.views, replyRatio: data.reply_ratio,
                              recentPosts: data.recent_posts,
                              postingHours: data.posting_hours,
                              engagementPodAccounts: data.engagement_pod_accounts,
                            }, data.recent_tweets ? {
                              recentTweets: (data.recent_tweets || []).map((t: any) => ({
                                id: t.id || '',
                                views: t.views || 0,
                                replyCount: t.reply_count || t.replyCount || 0,
                                visibleReplies: t.visible_replies || t.visibleReplies || 0,
                                firstCommenters: t.first_commenters || t.firstCommenters || [],
                                commentTimes: t.comment_times || t.commentTimes || [],
                                postedAt: t.posted_at || t.postedAt,
                              })),
                              followers: data.followers,
                            } : undefined),
                };
                    return res.status(200).json(result);
          }
      }

      // ── X/Twitter: If queue scan failed, try Nitter web scrape ──────────────────
      if (platform === 'twitter') {
              const nitterResult = await scanXViaNitter(cleanUsername);
              if (nitterResult) {
                    // Also check known scammers DB
                    const knownScammer = await checkKnownScammers(cleanUsername);
                    if (knownScammer?.found) {
                              if (knownScammer.level === 'HIGH RISK' || knownScammer.level === 'CRITICAL') {
                                            nitterResult.riskScore = Math.max(nitterResult.riskScore, 80);
                                            nitterResult.redFlags.unshift('KNOWN SCAMMER - In database as HIGH RISK');
                                            nitterResult.verificationLevel = 'HIGH RISK';
                              } else if (knownScammer.level === 'PAID PROMOTER') {
                                            nitterResult.riskScore = Math.max(nitterResult.riskScore, 30);
                                            nitterResult.redFlags.unshift('Known paid promoter - verify promoted projects independently');
                                            nitterResult.verificationLevel = 'PAID PROMOTER';
                              }
                              if (knownScammer.scamType) nitterResult.scamType = knownScammer.scamType;
                    }
                    nitterResult.riskLevel = calculateRiskLevel(nitterResult.riskScore);
                    nitterResult.riskScore = Math.round(nitterResult.riskScore);
                    return res.status(200).json(nitterResult);
              }
      }

      // ── Fallback: pattern-based detection ──────────────────────────────────────
      const scamDetection = detectScamPatterns(cleanUsername);
        let riskScore = scamDetection ? scamDetection.riskScore : 25;
        const context = verificationContext || 'general';
        if (context === 'crypto' && scamDetection) riskScore = Math.min(100, riskScore + 10);
        const riskLevel = calculateRiskLevel(riskScore);

      result = {
              success: true, platform, username: cleanUsername,
              displayName: `${cleanUsername}'s Profile`,
              verified: false, riskScore, riskLevel,
              verificationLevel: scamDetection ? 'Unverified' : 'Unknown',
              scamType: scamDetection?.type,
              redFlags: scamDetection?.flags || ['Pattern analysis only - limited data available'],
              evidence: riskScore >= 50
                ? ['Username pattern indicates potential scam', 'Recommend manual verification']
                        : ['No strong scam indicators from username pattern'],
              recommendation: generateRecommendation(riskLevel, platform),
              profileData: undefined,
              confidence: riskScore >= 50 ? 'MEDIUM' : 'LOW',
              scanDate: new Date().toISOString(),
              dataSource: 'pattern_analysis',
              botDetection: calculateBotScoreLite({ username: cleanUsername }),
      };
        return res.status(200).json(result);

  } catch (error) {
        console.error('[profile-verify] Unexpected error:', error);
        return res.status(500).json({
                success: false,
                error: { code: 'VERIFICATION_ERROR', message: 'An unexpected error occurred during verification' },
        });
  }
}
