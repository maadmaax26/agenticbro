/**
 * Public bot detection interface.
 *
 * Proprietary bot scoring rules run in the private intelligence service. This
 * browser module intentionally keeps only shared types, rendering helpers, and
 * data mapping utilities used by the UI.
 */

import type {
  EngagementAnalysisResult,
  WorkerEngagementData,
} from './engagement-analysis';

export interface BotDetectionInput {
  followers?: number;
  following?: number;
  posts?: number;
  bio?: string;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
  isDefaultAvatar?: boolean;
  joinDate?: string;
  verified?: boolean;
  location?: string;
  website?: string;
  engagementData?: {
    views?: number;
    likes?: number;
    retweets?: number;
    replyCount?: number;
    visibleReplies?: number;
    bookmarkCount?: number;
    recentTweetCount?: number;
    replyRatio?: number;
    postingHours?: number[];
    recentPosts?: string[];
    engagementPodAccounts?: string[];
  };
}

export interface BotFlag {
  id: string;
  name: string;
  points: number;
  maxPoints: number;
  description: string;
  detail?: string;
}

export type BotClassification =
  | 'Insufficient Data'
  | 'Likely Authentic'
  | 'Mild Bot Activity'
  | 'Moderate Bot Inflation'
  | 'High Bot Inflation'
  | 'Highly Bot-Inflated';

export interface BotDetectionResult {
  botScore: number;
  classification: BotClassification;
  flags: BotFlag[];
  flagsDetected: number;
  scanTimestamp: string;
  platform: string;
  summary: string;
  engagementAnalysis?: EngagementAnalysisResult;
}

export function calculateBotScore(
  _input: BotDetectionInput,
  platform: string = 'twitter',
  _engagementData?: WorkerEngagementData,
): BotDetectionResult {
  return {
    botScore: 0,
    classification: 'Insufficient Data',
    flags: [],
    flagsDetected: 0,
    scanTimestamp: new Date().toISOString(),
    platform,
    summary: 'Bot activity scoring is performed by the private intelligence service.',
  };
}

export function formatBotClassification(classification: BotClassification): { emoji: string; color: string; label: string } {
  switch (classification) {
    case 'Insufficient Data':
      return { emoji: '?', color: '#9ca3af', label: 'Insufficient Data' };
    case 'Likely Authentic':
      return { emoji: 'OK', color: '#4ade80', label: 'Likely Authentic' };
    case 'Mild Bot Activity':
      return { emoji: '!', color: '#fbbf24', label: 'Mild Bot Activity' };
    case 'Moderate Bot Inflation':
      return { emoji: '!!', color: '#fb923c', label: 'Moderate Bot Inflation' };
    case 'High Bot Inflation':
      return { emoji: '!!!', color: '#f87171', label: 'High Bot Inflation' };
    case 'Highly Bot-Inflated':
      return { emoji: 'BLOCK', color: '#ef4444', label: 'Highly Bot-Inflated' };
  }
}

export function formatBotResultText(result: BotDetectionResult): string {
  const { emoji, label } = formatBotClassification(result.classification);
  const lines: string[] = [
    '--- BOT ACTIVITY ASSESSMENT ---',
    `Bot Score: ${result.botScore}/100 - ${label} ${emoji}`,
  ];

  if (result.flags.length > 0) {
    lines.push('');
    for (const flag of result.flags) {
      lines.push(`- ${flag.name} (${flag.points}pts)${flag.detail ? ` - ${flag.detail}` : ''}`);
    }
  }

  if (result.engagementAnalysis) {
    lines.push('');
    lines.push(...formatEngagementSection(result.engagementAnalysis));
  }

  lines.push('');
  lines.push(result.summary);
  lines.push('');
  lines.push('Disclaimer: Educational purposes only. Not a guarantee of authenticity. Always DYOR.');
  lines.push(`Scan date: ${new Date(result.scanTimestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`);

  return lines.join('\n');
}

function formatEngagementSection(analysis: EngagementAnalysisResult): string[] {
  const lines: string[] = ['--- ENGAGEMENT ANALYSIS ---'];
  const { patterns, flags, overallScore } = analysis;

  if (patterns.ghostComments.detected || patterns.ghostComments.replyCount > 0) {
    lines.push(`Ghost Comments: ${patterns.ghostComments.replyCount} shown, ${patterns.ghostComments.visibleReplies} visible (${Math.round(patterns.ghostComments.hiddenRatio * 100)}% hidden)`);
  }
  if (patterns.viewInflation.detected) {
    const viewStr = patterns.viewInflation.views >= 1000
      ? `${(patterns.viewInflation.views / 1000).toFixed(1)}K`
      : String(patterns.viewInflation.views);
    lines.push(`View Inflation: ${viewStr} views / ${patterns.viewInflation.followers.toLocaleString()} followers (${patterns.viewInflation.ratio}x ratio)`);
  }
  if (patterns.engagementPods.detected) {
    lines.push(`Engagement Pod: ${patterns.engagementPods.podAccounts.length} accounts appear in first comments consistently`);
  }
  if (patterns.coordinatedTiming.detected) {
    lines.push(`Coordinated Timing: Comments arrive in ${patterns.coordinatedTiming.waves} burst(s), avg ${patterns.coordinatedTiming.avgInterval}s apart`);
  }
  if (patterns.activityPattern.detected) {
    lines.push(`24/7 Activity: Posts ${patterns.activityPattern.activeHours.length}/24 hrs/day, no sleep pattern detected`);
  }

  if (overallScore > 60) lines.push('', 'HIGH BOT INFLATION DETECTED');
  else if (overallScore > 40) lines.push('', 'MODERATE ENGAGEMENT MANIPULATION');
  else if (flags.length > 0) lines.push('', 'MINOR ENGAGEMENT ANOMALIES');

  return lines;
}

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
              typeof scanResult.verified === 'boolean' ? scanResult.verified : undefined,
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

  const rawTweets = scanResult.recentTweets ?? scanResult.recent_tweets;
  const engagementDataAvailable = Array.isArray(rawTweets) && rawTweets.length > 0;
  const workerEngagement: WorkerEngagementData | undefined = engagementDataAvailable ? {
    recentTweets: rawTweets.map((t: Record<string, unknown>) => ({
      id: typeof t.id === 'string' ? t.id : '',
      views: typeof t.views === 'number' ? t.views : 0,
      replyCount: typeof t.replyCount === 'number' ? t.replyCount : (typeof t.reply_count === 'number' ? t.reply_count : 0),
      visibleReplies: typeof t.visibleReplies === 'number' ? t.visibleReplies : (typeof t.visible_replies === 'number' ? t.visible_replies : 0),
      firstCommenters: Array.isArray(t.firstCommenters) ? t.firstCommenters as string[] : (Array.isArray(t.first_commenters) ? t.first_commenters as string[] : []),
      commentTimes: Array.isArray(t.commentTimes) ? t.commentTimes as string[] : (Array.isArray(t.comment_times) ? t.comment_times as string[] : []),
      likes: typeof t.likes === 'number' ? t.likes : undefined,
      retweets: typeof t.retweets === 'number' ? t.retweets : undefined,
      bookmarkCount: typeof t.bookmarkCount === 'number' ? t.bookmarkCount : undefined,
      postedAt: typeof t.postedAt === 'string' ? t.postedAt : (typeof t.posted_at === 'string' ? t.posted_at : undefined),
    })),
    profileViews: typeof scanResult.profileViews === 'number' ? scanResult.profileViews :
                  typeof scanResult.profile_views === 'number' ? scanResult.profile_views : 0,
    followerHistory: Array.isArray(scanResult.followerHistory) ? scanResult.followerHistory as { date: string; count: number }[] :
                      Array.isArray(scanResult.follower_history) ? scanResult.follower_history as { date: string; count: number }[] : [],
    followers: input.followers,
    following: input.following,
    posts: input.posts,
  } : undefined;

  return { input, engagementData: workerEngagement };
}
