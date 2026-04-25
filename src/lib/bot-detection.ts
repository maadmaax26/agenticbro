/**
 * Bot Detection Scoring Module for Agentic Bro
 *
 * Calculates a bot activity score (0-100) for social media profiles.
 * Runs alongside the existing 90-point scam risk system (0-10 scale)
 * and appears as a separate "🤖 BOT ACTIVITY ASSESSMENT" section.
 *
 * Enhanced with Engagement Analysis for deeper detection of:
 * - Ghost comments, view inflation, engagement pods
 * - Coordinated timing, 24/7 activity patterns
 *
 * Based on research in /workspace/bot-follower-detection-research.md
 */

// ─── Engagement Analysis Integration ───────────────────────────────────────────

import {
  type EngagementAnalysisResult,
  type WorkerEngagementData,
  analyzeEngagement,
  mergeEngagementToBotInput,
} from './engagement-analysis';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BotDetectionInput {
  // Profile data
  followers?: number;
  following?: number;
  posts?: number;
  bio?: string;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
  isDefaultAvatar?: boolean;
  joinDate?: string;          // ISO date string
  verified?: boolean;
  location?: string;
  website?: string;

  // Engagement data (from CDP/tweet scraping)
  engagementData?: {
    views?: number;
    likes?: number;
    retweets?: number;
    replyCount?: number;       // Total reply count shown
    visibleReplies?: number;   // Actual visible replies
    bookmarkCount?: number;
    recentTweetCount?: number; // Tweets in last 30 days
    replyRatio?: number;       // replies / total posts (0-1)
    postingHours?: number[];   // Hours of day when posts were made (0-23)
    recentPosts?: string[];    // Text content of recent posts for duplication check
    engagementPodAccounts?: string[]; // Accounts repeatedly engaging
  };
}

export interface BotFlag {
  id: string;
  name: string;
  points: number;
  maxPoints: number;
  description: string;
  detail?: string;  // E.g. "20 shown, 0 visible" for ghost comments
}

export type BotClassification =
  | 'Likely Authentic'
  | 'Mild Bot Activity'
  | 'Moderate Bot Inflation'
  | 'High Bot Inflation'
  | 'Highly Bot-Inflated';

export interface BotDetectionResult {
  botScore: number;           // 0-100
  classification: BotClassification;
  flags: BotFlag[];
  flagsDetected: number;
  scanTimestamp: string;
  platform: string;
  summary: string;
  engagementAnalysis?: EngagementAnalysisResult;
}

// ─── Bot Detection Flags (15 flags, max 150 raw points → clamped to 100) ────────

interface FlagDefinition {
  id: string;
  name: string;
  maxPoints: number;
  description: string;
  evaluate: (input: BotDetectionInput) => { points: number; detail?: string };
}

const BOT_FLAGS: FlagDefinition[] = [
  // ── Profile completeness (static signals) ────────────────────────────────

  {
    id: 'suspicious_follow_ratio',
    name: 'Suspicious Follow Ratio',
    maxPoints: 15,
    description: 'Following count far exceeds followers',
    evaluate: (input) => {
      if (input.following == null || input.followers == null || input.followers === 0) return { points: 0 };
      const ratio = input.following / input.followers;
      if (input.following > 5000 && input.followers < 50) return { points: 15, detail: `Following ${input.following.toLocaleString()} vs ${input.followers.toLocaleString()} followers` };
      if (ratio > 10) return { points: 12, detail: `Follow ratio: ${ratio.toFixed(1)}:1 (${input.following.toLocaleString()} following, ${input.followers.toLocaleString()} followers)` };
      if (ratio > 3) return { points: 8, detail: `Follow ratio: ${ratio.toFixed(1)}:1` };
      return { points: 0 };
    },
  },

  {
    id: 'no_profile_image',
    name: 'No Profile Image',
    maxPoints: 10,
    description: 'Default avatar or missing profile image',
    evaluate: (input) => {
      if (input.isDefaultAvatar) return { points: 10, detail: 'Default/egg avatar detected' };
      if (!input.profileImageUrl || input.profileImageUrl.includes('default') || input.profileImageUrl.includes('empty')) {
        return { points: 10, detail: 'No custom profile image' };
      }
      return { points: 0 };
    },
  },

  {
    id: 'no_bio',
    name: 'No Bio',
    maxPoints: 5,
    description: 'Empty or missing profile description',
    evaluate: (input) => {
      if (!input.bio || input.bio.trim().length === 0) return { points: 5, detail: 'Profile has no bio/description' };
      return { points: 0 };
    },
  },

  {
    id: 'new_account',
    name: 'New Account',
    maxPoints: 10,
    description: 'Account created less than 30 days ago',
    evaluate: (input) => {
      if (!input.joinDate) return { points: 0 };
      const joinDate = new Date(input.joinDate);
      const ageDays = (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < 7) return { points: 10, detail: `Account is ${Math.floor(ageDays)} days old` };
      if (ageDays < 30) return { points: 7, detail: `Account is ${Math.floor(ageDays)} days old (< 1 month)` };
      if (ageDays < 90) return { points: 3, detail: `Account is ~${Math.floor(ageDays / 30)} months old` };
      return { points: 0 };
    },
  },

  {
    id: 'low_tweet_count',
    name: 'Low Post Count',
    maxPoints: 5,
    description: 'Fewer than 50 total posts',
    evaluate: (input) => {
      if (input.posts == null) return { points: 0 };
      if (input.posts < 10) return { points: 5, detail: `Only ${input.posts} posts` };
      if (input.posts < 50) return { points: 3, detail: `Only ${input.posts} posts` };
      return { points: 0 };
    },
  },

  // ── Behavioral signals ───────────────────────────────────────────────────

  {
    id: 'high_reply_ratio',
    name: 'High Reply Ratio',
    maxPoints: 10,
    description: 'Over 70% of content is replies rather than original posts',
    evaluate: (input) => {
      if (!input.engagementData?.replyRatio) return { points: 0 };
      const ratio = input.engagementData.replyRatio;
      if (ratio > 0.9) return { points: 10, detail: `${(ratio * 100).toFixed(0)}% replies — almost no original content` };
      if (ratio > 0.7) return { points: 7, detail: `${(ratio * 100).toFixed(0)}% replies vs original posts` };
      return { points: 0 };
    },
  },

  {
    id: 'engagement_pod_pattern',
    name: 'Engagement Pod Pattern',
    maxPoints: 15,
    description: 'Same accounts consistently engage with this profile',
    evaluate: (input) => {
      const podAccounts = input.engagementData?.engagementPodAccounts;
      if (!podAccounts || podAccounts.length === 0) return { points: 0 };
      if (podAccounts.length >= 5) return { points: 15, detail: `Same ${podAccounts.length} accounts engage across multiple posts` };
      if (podAccounts.length >= 3) return { points: 10, detail: `Same ${podAccounts.length} accounts repeatedly engage` };
      return { points: 5, detail: `${podAccounts.length} accounts show repeated engagement` };
    },
  },

  {
    id: 'ghost_comments',
    name: 'Ghost Comments',
    maxPoints: 20,
    description: 'Reply count far exceeds visible replies (X spam filtering hides bot replies)',
    evaluate: (input) => {
      const replyCount = input.engagementData?.replyCount;
      const visibleReplies = input.engagementData?.visibleReplies;
      if (replyCount == null || visibleReplies == null) return { points: 0 };
      const hidden = replyCount - visibleReplies;
      if (replyCount > 10 && visibleReplies < 3) return { points: 20, detail: `${replyCount} replies shown, ${visibleReplies} visible — ${hidden} hidden by spam filter` };
      if (replyCount > visibleReplies * 3 && replyCount > 5) return { points: 15, detail: `${replyCount} replies vs ${visibleReplies} visible (${hidden} hidden)` };
      if (replyCount > visibleReplies * 2) return { points: 8, detail: `${replyCount} replies vs ${visibleReplies} visible` };
      return { points: 0 };
    },
  },

  {
    id: 'view_inflation',
    name: 'View Inflation',
    maxPoints: 15,
    description: 'View count disproportionate to follower count',
    evaluate: (input) => {
      const views = input.engagementData?.views;
      const followers = input.followers;
      if (views == null || followers == null || followers === 0) return { points: 0 };
      const ratio = views / followers;
      if (views > 10000 && followers < 1000) return { points: 15, detail: `${(views / 1000).toFixed(1)}K views with only ${followers.toLocaleString()} followers` };
      if (ratio > 50) return { points: 12, detail: `${ratio.toFixed(0)}x more views than followers` };
      if (ratio > 20) return { points: 7, detail: `${ratio.toFixed(0)}x more views than followers` };
      return { points: 0 };
    },
  },

  {
    id: 'mass_follow_unfollow',
    name: 'Mass Follow/Unfollow',
    maxPoints: 10,
    description: 'Following count extremely high relative to followers (follow-churn pattern)',
    evaluate: (input) => {
      if (input.following == null || input.followers == null) return { points: 0 };
      if (input.following > 10000 && input.followers < 100) return { points: 10, detail: `Following ${input.following.toLocaleString()} with only ${input.followers.toLocaleString()} followers — classic follow-churn` };
      if (input.following > 5000 && input.following / Math.max(input.followers, 1) > 50) return { points: 7, detail: 'Massive following with minimal followers' };
      return { points: 0 };
    },
  },

  {
    id: 'generic_username',
    name: 'Generic Username Pattern',
    maxPoints: 5,
    description: 'Username contains random numbers or generated patterns',
    evaluate: (input) => {
      if (!input.username) return { points: 0 };
      const u = input.username;
      // Ends with 4+ digits (auto-generated pattern)
      if (/_\d{4,}$/.test(u) || /\d{6,}$/.test(u)) return { points: 5, detail: `Username "${u}" matches auto-generated pattern` };
      // Mostly numbers
      if (/^\d{5,}$/.test(u)) return { points: 5, detail: `All-numeric username` };
      // Random-looking suffix
      if (/[a-z]{2,8}\d{4,}$/i.test(u)) return { points: 3, detail: `Username has numeric suffix pattern` };
      return { points: 0 };
    },
  },

  {
    id: 'no_location_url',
    name: 'No Location or URL',
    maxPoints: 5,
    description: 'Both location and website fields are empty',
    evaluate: (input) => {
      const hasLocation = !!(input.location && input.location.trim());
      const hasWebsite = !!(input.website && input.website.trim());
      if (!hasLocation && !hasWebsite) return { points: 5, detail: 'No location or website in profile' };
      if (!hasLocation || !hasWebsite) return { points: 2, detail: `Missing ${!hasLocation ? 'location' : 'website'}` };
      return { points: 0 };
    },
  },

  // ── Temporal / activity patterns ──────────────────────────────────────────

  {
    id: 'all_hours_activity',
    name: '24/7 Activity',
    maxPoints: 10,
    description: 'Posts at all hours with no sleep cycle — bot behavior',
    evaluate: (input) => {
      const hours = input.engagementData?.postingHours;
      if (!hours || hours.length < 10) return { points: 0 };
      const uniqueHours = new Set(hours);
      // Check if active across 18+ different hours (no sleep pattern)
      if (uniqueHours.size >= 20) return { points: 10, detail: `Active ${uniqueHours.size}/24 hours — no sleep cycle detected` };
      if (uniqueHours.size >= 16) return { points: 7, detail: `Active ${uniqueHours.size}/24 hours — minimal sleep pattern` };
      if (uniqueHours.size >= 14) return { points: 4, detail: `Active ${uniqueHours.size}/24 hours` };
      return { points: 0 };
    },
  },

  {
    id: 'identical_comments',
    name: 'Identical Comments',
    maxPoints: 10,
    description: 'Copy-pasted content across multiple posts',
    evaluate: (input) => {
      const posts = input.engagementData?.recentPosts;
      if (!posts || posts.length < 3) return { points: 0 };
      // Check for duplicate content
      const normalized = posts.map(p => p.toLowerCase().trim().replace(/\s+/g, ' '));
      const seen = new Set<string>();
      let duplicates = 0;
      for (const text of normalized) {
        if (seen.has(text)) duplicates++;
        seen.add(text);
      }
      const dupRatio = duplicates / posts.length;
      if (dupRatio > 0.3) return { points: 10, detail: `${duplicates} duplicate posts out of ${posts.length} total` };
      if (dupRatio > 0.1) return { points: 5, detail: `${duplicates} duplicate posts detected` };
      return { points: 0 };
    },
  },

  {
    id: 'coordinated_timing',
    name: 'Coordinated Timing',
    maxPoints: 10,
    description: 'Comments arrive in coordinated waves rather than organically',
    evaluate: (input) => {
      // This flag is harder to detect without time-series data.
      // For now, we check if the engagement data includes timing hints.
      // The worker can set this flag explicitly when CDP analysis detects waves.
      const hours = input.engagementData?.postingHours;
      if (!hours || hours.length < 8) return { points: 0 };
      // Cluster analysis: if posts cluster within narrow windows, that's a signal
      const sortedHours = [...hours].sort((a, b) => a - b);
      let clusters = 0;
      for (let i = 1; i < sortedHours.length; i++) {
        if (sortedHours[i] - sortedHours[i - 1] === 0) clusters++;
      }
      const clusterRatio = clusters / sortedHours.length;
      if (clusterRatio > 0.6) return { points: 10, detail: 'Posts cluster at identical times — coordinated timing' };
      if (clusterRatio > 0.4) return { points: 6, detail: 'Significant timing overlap in posts' };
      return { points: 0 };
    },
  },
];

// ─── Classification ─────────────────────────────────────────────────────────────

function classifyBotScore(score: number): BotClassification {
  if (score <= 20) return 'Likely Authentic';
  if (score <= 40) return 'Mild Bot Activity';
  if (score <= 60) return 'Moderate Bot Inflation';
  if (score <= 80) return 'High Bot Inflation';
  return 'Highly Bot-Inflated';
}

function generateSummary(result: BotDetectionResult): string {
  const { botScore, flags } = result;
  if (flags.length === 0) {
    return 'No bot activity indicators detected. Profile appears authentic based on available data.';
  }
  const topFlags = flags.slice(0, 3);
  const flagNames = topFlags.map(f => f.name).join(', ');
  if (botScore <= 20) {
    return `Minor signals detected (${flagNames}), but overall profile appears authentic.`;
  }
  if (botScore <= 40) {
    return `Some bot indicators present (${flagNames}). Profile may have minor bot engagement but is mostly authentic.`;
  }
  if (botScore <= 60) {
    return `Notable bot indicators (${flagNames}). Mixed audience with likely bot-inflated metrics. Exercise caution.`;
  }
  if (botScore <= 80) {
    return `Strong indicators of bot activity (${flagNames}). Engagement metrics are likely artificially inflated. Do not trust follower/view counts.`;
  }
  return `Overwhelming evidence of bot inflation (${flagNames}). This profile's engagement is heavily manipulated. Assume most interactions are fake.`;
}

// ─── Main Scoring Function ────────────────────────────────────────────────────

export function calculateBotScore(
  input: BotDetectionInput,
  platform: string = 'twitter',
  engagementData?: WorkerEngagementData,
): BotDetectionResult {
  const flags: BotFlag[] = [];

  // ── If engagement data is provided, merge it into input ────────────────────
  let enrichedInput = input;
  if (engagementData) {
    const mergedEngagement = mergeEngagementToBotInput(engagementData);
    enrichedInput = {
      ...input,
      engagementData: {
        ...input.engagementData,
        ...mergedEngagement.engagementData,
      },
    };
  }

  for (const flagDef of BOT_FLAGS) {
    const { points, detail } = flagDef.evaluate(enrichedInput);
    if (points > 0) {
      flags.push({
        id: flagDef.id,
        name: flagDef.name,
        points,
        maxPoints: flagDef.maxPoints,
        description: flagDef.description,
        detail,
      });
    }
  }

  // ── Run engagement analysis if worker data provided ────────────────────────
  let engagementAnalysis: EngagementAnalysisResult | undefined;
  if (engagementData && engagementData.recentTweets.length > 0) {
    try {
      engagementAnalysis = analyzeEngagement(engagementData);

      // Boost bot score based on engagement analysis flags
      for (const eFlag of engagementAnalysis.flags) {
        // Only add if not already detected by base bot detection
        const alreadyDetected = flags.some(f => f.id === `engagement_${eFlag.id}`);
        if (!alreadyDetected) {
          flags.push({
            id: `engagement_${eFlag.id}`,
            name: eFlag.name,
            points: eFlag.points,
            maxPoints: eFlag.maxPoints,
            description: eFlag.description,
            detail: eFlag.detail,
          });
        }
      }
    } catch (e) {
      console.warn('[BotDetection] Engagement analysis failed:', e);
    }
  }

  // Sum points, cap at 100
  const totalPoints = flags.reduce((sum, f) => sum + f.points, 0);
  const botScore = Math.min(100, totalPoints);
  const classification = classifyBotScore(botScore);

  const result: BotDetectionResult = {
    botScore,
    classification,
    flags,
    flagsDetected: flags.length,
    scanTimestamp: new Date().toISOString(),
    platform,
    summary: '', // Will be filled after construction
    engagementAnalysis,
  };

  result.summary = generateSummary(result);
  return result;
}

// ─── Formatting Helpers ─────────────────────────────────────────────────────────

export function formatBotClassification(classification: BotClassification): { emoji: string; color: string; label: string } {
  switch (classification) {
    case 'Likely Authentic':
      return { emoji: '✅', color: '#4ade80', label: 'Likely Authentic' };
    case 'Mild Bot Activity':
      return { emoji: '🟡', color: '#fbbf24', label: 'Mild Bot Activity' };
    case 'Moderate Bot Inflation':
      return { emoji: '🟠', color: '#fb923c', label: 'Moderate Bot Inflation' };
    case 'High Bot Inflation':
      return { emoji: '🔴', color: '#f87171', label: 'High Bot Inflation' };
    case 'Highly Bot-Inflated':
      return { emoji: '🚨', color: '#ef4444', label: 'Highly Bot-Inflated' };
  }
}

/**
 * Format a BotDetectionResult as plain text (for copy-to-clipboard and Telegram bot output)
 */
export function formatBotResultText(result: BotDetectionResult): string {
  const { emoji, label } = formatBotClassification(result.classification);
  const lines: string[] = [
    `━━━ 🤖 BOT ACTIVITY ASSESSMENT ━━━`,
    `Bot Score: ${result.botScore}/100 — ${label} ${emoji}`,
  ];

  if (result.flags.length > 0) {
    lines.push('');
    for (const flag of result.flags) {
      lines.push(`• ${flag.name} (${flag.points}pts)${flag.detail ? ` — ${flag.detail}` : ''}`);
    }
  }

  // Engagement Analysis section
  if (result.engagementAnalysis) {
    lines.push('');
    lines.push(...formatEngagementSection(result.engagementAnalysis));
  }

  lines.push('');
  lines.push(result.summary);
  lines.push('');
  lines.push('📋 Disclaimer: Educational purposes only. Not a guarantee of authenticity. Always DYOR.');
  lines.push(`Scan date: ${new Date(result.scanTimestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`);

  return lines.join('\n');
}

/**
 * Format engagement analysis as plain text lines
 */
function formatEngagementSection(analysis: EngagementAnalysisResult): string[] {
  const lines: string[] = ['\u2501\u2501\u2501 \ud83d\udcca ENGAGEMENT ANALYSIS \u2501\u2501\u2501'];
  const { patterns, flags, overallScore } = analysis;

  // Ghost Comments
  if (patterns.ghostComments.detected || patterns.ghostComments.replyCount > 0) {
    lines.push(`Ghost Comments: ${patterns.ghostComments.replyCount} shown, ${patterns.ghostComments.visibleReplies} visible (${Math.round(patterns.ghostComments.hiddenRatio * 100)}% hidden)`);
  }

  // View Inflation
  if (patterns.viewInflation.detected) {
    const viewStr = patterns.viewInflation.views >= 1000
      ? `${(patterns.viewInflation.views / 1000).toFixed(1)}K`
      : String(patterns.viewInflation.views);
    lines.push(`View Inflation: ${viewStr} views / ${patterns.viewInflation.followers.toLocaleString()} followers (${patterns.viewInflation.ratio}x ratio)`);
  }

  // Engagement Pods
  if (patterns.engagementPods.detected) {
    lines.push(`Engagement Pod: ${patterns.engagementPods.podAccounts.length} accounts appear in first comments consistently`);
  }

  // Coordinated Timing
  if (patterns.coordinatedTiming.detected) {
    lines.push(`Coordinated Timing: Comments arrive in ${patterns.coordinatedTiming.waves} burst(s), avg ${patterns.coordinatedTiming.avgInterval}s apart`);
  }

  // 24/7 Activity
  if (patterns.activityPattern.detected) {
    lines.push(`24/7 Activity: Posts ${patterns.activityPattern.activeHours.length}/24 hrs/day, no sleep pattern detected`);
  }

  // Overall verdict
  if (overallScore > 60) {
    lines.push('');
    lines.push('\ud83d\udea1 HIGH BOT INFLATION DETECTED');
  } else if (overallScore > 40) {
    lines.push('');
    lines.push('\u26a0\ufe0f MODERATE ENGAGEMENT MANIPULATION');
  } else if (flags.length > 0) {
    lines.push('');
    lines.push('\u26a1 MINOR ENGAGEMENT ANOMALIES');
  }

  return lines;
}

/**
 * Merge bot detection data from the worker/CDP scan result into BotDetectionInput.
 * Maps the raw worker response fields to the bot detection input structure.
 * Also extracts WorkerEngagementData when available.
 */
export function mapScanResultToBotInput(scanResult: Record<string, unknown>): { input: BotDetectionInput; engagementData?: WorkerEngagementData } {
  const profileData = (scanResult.profileData ?? scanResult.result ?? {}) as Record<string, unknown>;
  const engagementData = (scanResult.engagementData ?? scanResult.engagement_data ?? {}) as Record<string, unknown>;

  const input: BotDetectionInput = {
    followers: typeof profileData.followers === 'number' ? profileData.followers : undefined,
    following: typeof profileData.following === 'number' ? profileData.following : undefined,
    posts: typeof profileData.posts === 'number' ? profileData.posts :
           typeof profileData.posts_count === 'number' ? profileData.posts_count : undefined,
    bio: typeof profileData.bio === 'string' ? profileData.bio : undefined,
    username: typeof scanResult.username === 'string' ? scanResult.username : undefined,
    displayName: typeof profileData.displayName === 'string' ? profileData.displayName :
                 typeof profileData.display_name === 'string' ? profileData.display_name : undefined,
    profileImageUrl: typeof profileData.profileImage === 'string' ? profileData.profileImage :
                     typeof profileData.avatar === 'string' ? profileData.avatar : undefined,
    isDefaultAvatar: typeof profileData.isDefaultAvatar === 'boolean' ? profileData.isDefaultAvatar :
                     typeof profileData.default_profile_image === 'boolean' ? profileData.default_profile_image : undefined,
    joinDate: typeof profileData.joinDate === 'string' ? profileData.joinDate :
              typeof profileData.join_date === 'string' ? profileData.join_date :
              typeof profileData.created_at === 'string' ? profileData.created_at : undefined,
    verified: typeof profileData.verified === 'boolean' ? profileData.verified :
              typeof scanResult.verified === 'boolean' ? scanResult.verified as boolean : undefined,
    location: typeof profileData.location === 'string' ? profileData.location : undefined,
    website: typeof profileData.website === 'string' ? profileData.website : undefined,
    engagementData: {
      views: typeof engagementData.views === 'number' ? engagementData.views : undefined,
      likes: typeof engagementData.likes === 'number' ? engagementData.likes : undefined,
      retweets: typeof engagementData.retweets === 'number' ? engagementData.retweets : undefined,
      replyCount: typeof engagementData.replyCount === 'number' ? engagementData.replyCount :
                  typeof engagementData.reply_count === 'number' ? engagementData.reply_count : undefined,
      visibleReplies: typeof engagementData.visibleReplies === 'number' ? engagementData.visibleReplies :
                      typeof engagementData.visible_replies === 'number' ? engagementData.visible_replies : undefined,
      bookmarkCount: typeof engagementData.bookmarkCount === 'number' ? engagementData.bookmarkCount : undefined,
      recentTweetCount: typeof engagementData.recentTweetCount === 'number' ? engagementData.recentTweetCount : undefined,
      replyRatio: typeof engagementData.replyRatio === 'number' ? engagementData.replyRatio : undefined,
      postingHours: Array.isArray(engagementData.postingHours) ? engagementData.postingHours as number[] : undefined,
      recentPosts: Array.isArray(engagementData.recentPosts) ? engagementData.recentPosts as string[] : undefined,
      engagementPodAccounts: Array.isArray(engagementData.engagementPodAccounts) ? engagementData.engagementPodAccounts as string[] : undefined,
    },
  };

  // Extract worker engagement data if present
  let workerEngagement: WorkerEngagementData | undefined;
  const rawTweets = scanResult.recentTweets ?? scanResult.recent_tweets;
  if (Array.isArray(rawTweets) && rawTweets.length > 0) {
    workerEngagement = {
      recentTweets: rawTweets.map((t: any) => ({
        id: t.id ?? '',
        views: typeof t.views === 'number' ? t.views : 0,
        replyCount: typeof t.replyCount === 'number' ? t.replyCount : (typeof t.reply_count === 'number' ? t.reply_count : 0),
        visibleReplies: typeof t.visibleReplies === 'number' ? t.visibleReplies : (typeof t.visible_replies === 'number' ? t.visible_replies : 0),
        firstCommenters: Array.isArray(t.firstCommenters) ? t.firstCommenters : (Array.isArray(t.first_commenters) ? t.first_commenters : []),
        commentTimes: Array.isArray(t.commentTimes) ? t.commentTimes : (Array.isArray(t.comment_times) ? t.comment_times : []),
        likes: typeof t.likes === 'number' ? t.likes : undefined,
        retweets: typeof t.retweets === 'number' ? t.retweets : undefined,
        bookmarkCount: typeof t.bookmarkCount === 'number' ? t.bookmarkCount : undefined,
        postedAt: typeof t.postedAt === 'string' ? t.postedAt : (typeof t.posted_at === 'string' ? t.posted_at : undefined),
      })),
      profileViews: typeof scanResult.profileViews === 'number' ? scanResult.profileViews :
                    typeof scanResult.profile_views === 'number' ? scanResult.profile_views as number : 0,
      followerHistory: Array.isArray(scanResult.followerHistory) ? scanResult.followerHistory as { date: string; count: number }[] :
                        Array.isArray(scanResult.follower_history) ? scanResult.follower_history as { date: string; count: number }[] : [],
      followers: input.followers,
      following: input.following,
      posts: input.posts,
    };
  }

  return { input, engagementData: workerEngagement };
}