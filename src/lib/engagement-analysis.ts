/**
 * Enhanced Engagement Analysis Module for Agentic Bro
 *
 * Provides deeper analysis of engagement patterns to detect bot activity
 * more accurately. Works alongside the existing 90-point scam risk system
 * and 100-point bot detection system.
 *
 * Detects:
 * - Ghost Comments (reply count >> visible replies)
 * - View Inflation (views >> followers)
 * - Engagement Pods (same accounts always engage)
 * - Coordinated Timing (comments arrive in waves)
 * - 24/7 Activity (no sleep cycle)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TweetEngagementData {
  id: string;
  views: number;
  replyCount: number;
  visibleReplies: number;
  firstCommenters: string[];
  commentTimes: number[]; // seconds after post
  likes?: number;
  retweets?: number;
  bookmarkCount?: number;
  postedAt?: string; // ISO timestamp
}

export interface EngagementPatterns {
  ghostComments: {
    detected: boolean;
    replyCount: number;
    visibleReplies: number;
    hiddenRatio: number; // hidden/total
  };

  viewInflation: {
    detected: boolean;
    views: number;
    followers: number;
    ratio: number; // views/followers
  };

  engagementPods: {
    detected: boolean;
    podAccounts: string[]; // usernames
    overlapScore: number; // 0-1
    firstCommenters: string[]; // usually same accounts
  };

  coordinatedTiming: {
    detected: boolean;
    waves: number; // number of timing clusters
    avgInterval: number; // seconds between comments
    burstScore: number; // 0-1
  };

  activityPattern: {
    detected: boolean;
    activeHours: number[]; // hours with activity (0-23)
    sleepGapHours: number; // longest gap without activity
    botScore: number; // 0-1
  };
}

export interface EngagementAnalysisResult {
  patterns: EngagementPatterns;
  flags: EngagementFlag[];
  overallScore: number; // 0-100 engagement bot score
  summary: string;
  timestamp: string;
}

export interface EngagementFlag {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  points: number;
  maxPoints: number;
  description: string;
  detail: string;
}

// ─── Worker Data Interface ─────────────────────────────────────────────────────

export interface WorkerEngagementData {
  recentTweets: TweetEngagementData[];
  profileViews: number;
  followerHistory: { date: string; count: number }[];
  followers?: number;
  following?: number;
  posts?: number;
}

// ─── Cache ─────────────────────────────────────────────────────────────────────

const engagementCache = new Map<string, { result: EngagementAnalysisResult; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearEngagementCache(key?: string): void {
  if (key) {
    engagementCache.delete(key);
  } else {
    engagementCache.clear();
  }
}

// ─── Detection Algorithms ─────────────────────────────────────────────────────

/**
 * Detect ghost comments: reply count far exceeds visible replies.
 * X's spam filter hides bot replies, so a high hidden ratio indicates
 * many bot comments were filtered out.
 */
function detectGhostComments(tweets: TweetEngagementData[]): EngagementPatterns['ghostComments'] {
  if (tweets.length === 0) {
    return { detected: false, replyCount: 0, visibleReplies: 0, hiddenRatio: 0 };
  }

  let totalReplyCount = 0;
  let totalVisibleReplies = 0;

  for (const tweet of tweets) {
    totalReplyCount += tweet.replyCount;
    totalVisibleReplies += tweet.visibleReplies;
  }

  const hiddenCount = totalReplyCount - totalVisibleReplies;
  const hiddenRatio = totalReplyCount > 0 ? hiddenCount / totalReplyCount : 0;

  return {
    detected: hiddenRatio > 0.5 && totalReplyCount > 5,
    replyCount: totalReplyCount,
    visibleReplies: totalVisibleReplies,
    hiddenRatio: Math.round(hiddenRatio * 100) / 100,
  };
}

/**
 * Detect view inflation: view count disproportionate to follower count.
 * Bots inflate views to make accounts appear more popular than they are.
 */
function detectViewInflation(
  tweets: TweetEngagementData[],
  followers: number,
): EngagementPatterns['viewInflation'] {
  if (tweets.length === 0 || followers === 0) {
    return { detected: false, views: 0, followers, ratio: 0 };
  }

  // Use average views across recent tweets
  const avgViews = tweets.reduce((sum, t) => sum + t.views, 0) / tweets.length;
  const ratio = avgViews / followers;

  return {
    detected: ratio > 10 && avgViews > 1000,
    views: Math.round(avgViews),
    followers,
    ratio: Math.round(ratio * 10) / 10,
  };
}

/**
 * Detect engagement pods: same accounts consistently appear as first commenters.
 * Uses set intersection to find accounts that overlap across multiple posts.
 */
function detectEngagementPods(tweets: TweetEngagementData[]): EngagementPatterns['engagementPods'] {
  if (tweets.length < 3) {
    return { detected: false, podAccounts: [], overlapScore: 0, firstCommenters: [] };
  }

  // Count how many times each account appears as a first commenter
  const commenterCounts = new Map<string, number>();
  let totalTweetsWithComments = 0;

  for (const tweet of tweets) {
    if (tweet.firstCommenters.length > 0) {
      totalTweetsWithComments++;
      for (const commenter of tweet.firstCommenters) {
        commenterCounts.set(commenter, (commenterCounts.get(commenter) || 0) + 1);
      }
    }
  }

  if (totalTweetsWithComments === 0) {
    return { detected: false, podAccounts: [], overlapScore: 0, firstCommenters: [] };
  }

  // Pod accounts appear in >40% of posts
  const podThreshold = Math.max(2, totalTweetsWithComments * 0.4);
  const podAccounts: string[] = [];
  // topCommenters derived from sorted commenterCounts below

  for (const [account, count] of commenterCounts) {
    if (count >= podThreshold) {
      podAccounts.push(account);
    }
  }

  // Sort by frequency for top commenters list
  const sorted = [...commenterCounts.entries()].sort((a, b) => b[1] - a[1]);
  const firstCommenters = sorted.slice(0, 5).map(([account]) => account);

  // Overlap score: how many accounts appear in multiple posts
  const overlappingAccounts = [...commenterCounts.values()].filter(c => c >= 2).length;
  const overlapScore = totalTweetsWithComments > 0
    ? Math.min(1, overlappingAccounts / (totalTweetsWithComments * 0.5))
    : 0;

  return {
    detected: podAccounts.length >= 3,
    podAccounts,
    overlapScore: Math.round(overlapScore * 100) / 100,
    firstCommenters,
  };
}

/**
 * Detect coordinated timing: comments arrive in waves (bursts)
 * rather than organically distributed over time.
 */
function detectCoordinatedTiming(tweets: TweetEngagementData[]): EngagementPatterns['coordinatedTiming'] {
  // Collect all comment times across tweets
  const allTimes: number[] = [];
  for (const tweet of tweets) {
    allTimes.push(...tweet.commentTimes);
  }

  if (allTimes.length < 5) {
    return { detected: false, waves: 0, avgInterval: 0, burstScore: 0 };
  }

  // Sort times
  allTimes.sort((a, b) => a - b);

  // Calculate average interval between comments
  const intervals: number[] = [];
  for (let i = 1; i < allTimes.length; i++) {
    intervals.push(allTimes[i] - allTimes[i - 1]);
  }
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  // Detect burst patterns: clusters of comments within 5-second windows
  const BURST_WINDOW = 5; // seconds
  let bursts = 0;
  let inBurst = false;

  for (let i = 1; i < allTimes.length; i++) {
    const gap = allTimes[i] - allTimes[i - 1];
    if (gap <= BURST_WINDOW) {
      if (!inBurst) {
        bursts++;
        inBurst = true;
      }
    } else {
      inBurst = false;
    }
  }

  // Burst score: proportion of comments that arrive in clusters vs organically
  const clusteredComments = allTimes.filter((_, i) => {
    if (i === 0) return false;
    return allTimes[i] - allTimes[i - 1] <= BURST_WINDOW;
  }).length;
  const burstScore = allTimes.length > 0 ? clusteredComments / allTimes.length : 0;

  return {
    detected: burstScore > 0.5 && bursts >= 2,
    waves: bursts,
    avgInterval: Math.round(avgInterval),
    burstScore: Math.round(burstScore * 100) / 100,
  };
}

/**
 * Detect 24/7 activity: accounts that post at all hours with no sleep cycle.
 * Real humans have clear circadian patterns; bots post around the clock.
 */
function detectActivityPattern(tweets: TweetEngagementData[]): EngagementPatterns['activityPattern'] {
  if (tweets.length < 5) {
    return { detected: false, activeHours: [], sleepGapHours: 24, botScore: 0 };
  }

  // Extract hours from tweet timestamps
  const hours: number[] = [];
  for (const tweet of tweets) {
    if (tweet.postedAt) {
      const hour = new Date(tweet.postedAt).getHours();
      hours.push(hour);
    }
  }

  if (hours.length < 5) {
    return { detected: false, activeHours: [], sleepGapHours: 24, botScore: 0 };
  }

  const uniqueHours = [...new Set(hours)].sort((a, b) => a - b);

  // Calculate longest gap without activity (sleep period)
  let maxGap = 0;
  for (let i = 1; i < uniqueHours.length; i++) {
    const gap = uniqueHours[i] - uniqueHours[i - 1];
    if (gap > maxGap) maxGap = gap;
  }
  // Also check the wrap-around gap (e.g., 23 → 0)
  const wrapGap = (24 - uniqueHours[uniqueHours.length - 1]) + uniqueHours[0];
  if (wrapGap > maxGap) maxGap = wrapGap;

  // Bot score: accounts active across many hours with small gaps look more bot-like
  // A human should have at least a 6-8 hour sleep gap
  let botScore = 0;
  if (uniqueHours.length >= 20) {
    botScore = 1.0; // Active 20+ hours/day
  } else if (uniqueHours.length >= 16) {
    botScore = 0.8;
  } else if (uniqueHours.length >= 14) {
    botScore = 0.6;
  } else if (maxGap < 4) {
    botScore = 0.7; // No meaningful sleep gap
  } else if (maxGap < 6) {
    botScore = 0.4;
  } else {
    botScore = 0.1; // Normal human pattern
  }

  return {
    detected: botScore > 0.5,
    activeHours: uniqueHours,
    sleepGapHours: maxGap,
    botScore: Math.round(botScore * 100) / 100,
  };
}

// ─── Main Analysis Function ────────────────────────────────────────────────────

/**
 * Analyze engagement patterns from CDP/worker data.
 * Returns a comprehensive EngagementAnalysisResult with patterns, flags, and score.
 */
export function analyzeEngagement(
  data: WorkerEngagementData,
): EngagementAnalysisResult {
  const { recentTweets, followers = 0 } = data;

  // Run all pattern detectors
  const ghostComments = detectGhostComments(recentTweets);
  const viewInflation = detectViewInflation(recentTweets, followers);
  const engagementPods = detectEngagementPods(recentTweets);
  const coordinatedTiming = detectCoordinatedTiming(recentTweets);
  const activityPattern = detectActivityPattern(recentTweets);

  const patterns: EngagementPatterns = {
    ghostComments,
    viewInflation,
    engagementPods,
    coordinatedTiming,
    activityPattern,
  };

  // Build flags from detected patterns
  const flags: EngagementFlag[] = [];

  // Ghost Comments flag
  if (ghostComments.detected) {
    const severity = ghostComments.hiddenRatio > 0.9 ? 'critical' :
                     ghostComments.hiddenRatio > 0.7 ? 'high' : 'medium';
    const points = ghostComments.hiddenRatio > 0.9 ? 20 :
                   ghostComments.hiddenRatio > 0.7 ? 15 : 10;
    flags.push({
      id: 'engagement_ghost_comments',
      name: 'Ghost Comments',
      severity,
      points,
      maxPoints: 20,
      description: 'Reply count far exceeds visible replies (X spam filter hides bot replies)',
      detail: `${ghostComments.replyCount} shown, ${ghostComments.visibleReplies} visible (${Math.round(ghostComments.hiddenRatio * 100)}% hidden)`,
    });
  }

  // View Inflation flag
  if (viewInflation.detected) {
    const severity = viewInflation.ratio > 50 ? 'critical' :
                     viewInflation.ratio > 20 ? 'high' : 'medium';
    const points = viewInflation.ratio > 50 ? 15 :
                   viewInflation.ratio > 20 ? 12 : 7;
    flags.push({
      id: 'engagement_view_inflation',
      name: 'View Inflation',
      severity,
      points,
      maxPoints: 15,
      description: 'View count disproportionate to follower count',
      detail: `${viewInflation.views >= 1000 ? `${(viewInflation.views / 1000).toFixed(1)}K` : viewInflation.views} views / ${viewInflation.followers.toLocaleString()} followers (${viewInflation.ratio}x ratio)`,
    });
  }

  // Engagement Pod flag
  if (engagementPods.detected) {
    const severity = engagementPods.podAccounts.length >= 5 ? 'critical' :
                     engagementPods.podAccounts.length >= 3 ? 'high' : 'medium';
    const points = engagementPods.podAccounts.length >= 5 ? 15 :
                   engagementPods.podAccounts.length >= 3 ? 12 : 8;
    flags.push({
      id: 'engagement_pod',
      name: 'Engagement Pod',
      severity,
      points,
      maxPoints: 15,
      description: 'Same accounts consistently appear in first comments',
      detail: `${engagementPods.podAccounts.length} accounts appear in first comments consistently`,
    });
  }

  // Coordinated Timing flag
  if (coordinatedTiming.detected) {
    const severity = coordinatedTiming.burstScore > 0.8 ? 'high' : 'medium';
    const points = coordinatedTiming.burstScore > 0.8 ? 10 : 6;
    flags.push({
      id: 'engagement_coordinated_timing',
      name: 'Coordinated Timing',
      severity,
      points,
      maxPoints: 10,
      description: 'Comments arrive in coordinated waves rather than organically',
      detail: `Comments arrive in ${coordinatedTiming.waves} burst(s), avg ${coordinatedTiming.avgInterval}s apart`,
    });
  }

  // 24/7 Activity flag
  if (activityPattern.detected) {
    const severity = activityPattern.botScore > 0.8 ? 'critical' :
                     activityPattern.botScore > 0.6 ? 'high' : 'medium';
    const points = activityPattern.botScore > 0.8 ? 10 :
                   activityPattern.botScore > 0.6 ? 7 : 4;
    flags.push({
      id: 'engagement_all_hours',
      name: '24/7 Activity',
      severity,
      points,
      maxPoints: 10,
      description: 'Posts at all hours with no sleep cycle — bot behavior',
      detail: `Posts ${activityPattern.activeHours.length}/24 hrs/day, longest sleep gap: ${activityPattern.sleepGapHours}hrs`,
    });
  }

  // Calculate overall engagement bot score (0-100)
  const totalPoints = flags.reduce((sum, f) => sum + f.points, 0);
  const maxPossiblePoints = 70; // 20+15+15+10+10
  const overallScore = Math.min(100, Math.round((totalPoints / maxPossiblePoints) * 100));

  // Generate summary
  const summary = generateEngagementSummary(patterns, flags, overallScore);

  return {
    patterns,
    flags,
    overallScore,
    summary,
    timestamp: new Date().toISOString(),
  };
}

function generateEngagementSummary(
  _patterns: EngagementPatterns,
  flags: EngagementFlag[],
  score: number,
): string {
  if (flags.length === 0) {
    return 'No engagement anomalies detected. Profile appears to have organic audience interaction.';
  }

  const flagNames = flags.map(f => f.name).join(', ');

  if (score <= 20) {
    return `Minor engagement anomalies (${flagNames}), but overall patterns appear organic.`;
  }
  if (score <= 40) {
    return `Some engagement irregularities (${flagNames}). Mixed organic and potentially artificial activity.`;
  }
  if (score <= 60) {
    return `Notable engagement anomalies (${flagNames}). Likely artificial engagement boosting. Do not trust interaction metrics.`;
  }
  if (score <= 80) {
    return `Strong indicators of engagement manipulation (${flagNames}). Metrics are likely artificially inflated. Assume fake engagement.`;
  }
  return `Overwhelming evidence of engagement manipulation (${flagNames}). This profile's engagement is heavily bot-driven. Assume most interactions are fake.`;
}

// ─── Formatting ────────────────────────────────────────────────────────────────

export function formatEngagementResultText(result: EngagementAnalysisResult): string {
  const { patterns, flags, overallScore } = result;

  const lines: string[] = [
    `━━━ 📊 ENGAGEMENT ANALYSIS ━━━`,
  ];

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
    if (patterns.engagementPods.podAccounts.length <= 5) {
      lines.push(`  Pod members: ${patterns.engagementPods.podAccounts.join(', ')}`);
    }
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
    lines.push(`🚨 HIGH BOT INFLATION DETECTED`);
  } else if (overallScore > 40) {
    lines.push('');
    lines.push(`⚠️ MODERATE ENGAGEMENT MANIPULATION`);
  } else if (flags.length > 0) {
    lines.push('');
    lines.push(`⚡ MINOR ENGAGEMENT ANOMALIES`);
  }

  // Flags detail
  if (flags.length > 0) {
    lines.push('');
    for (const flag of flags) {
      lines.push(`• ${flag.name} (${flag.points}/${flag.maxPoints}pts) — ${flag.detail}`);
    }
  }

  lines.push('');
  lines.push(result.summary);

  return lines.join('\n');
}

export function formatEngagementClassification(score: number): { emoji: string; color: string; label: string } {
  if (score <= 20) return { emoji: '✅', color: '#4ade80', label: 'Organic Engagement' };
  if (score <= 40) return { emoji: '🟡', color: '#fbbf24', label: 'Minor Anomalies' };
  if (score <= 60) return { emoji: '🟠', color: '#fb923c', label: 'Moderate Manipulation' };
  if (score <= 80) return { emoji: '🔴', color: '#f87171', label: 'High Bot Inflation' };
  return { emoji: '🚨', color: '#ef4444', label: 'Severe Bot Inflation' };
}

// ─── Cached Analysis ───────────────────────────────────────────────────────────

/**
 * Run engagement analysis with caching (5-minute TTL).
 * Key format: platform:username
 */
export function analyzeEngagementCached(
  key: string,
  data: WorkerEngagementData,
): EngagementAnalysisResult {
  const cached = engagementCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }

  const result = analyzeEngagement(data);
  engagementCache.set(key, { result, expires: Date.now() + CACHE_TTL_MS });
  return result;
}

// ─── Merge with Bot Detection ──────────────────────────────────────────────────

/**
 * Merge engagement analysis data into BotDetectionInput.
 * Takes WorkerEngagementData and converts it into the format expected
 * by the existing bot detection system.
 */
export function mergeEngagementToBotInput(
  engagementData: WorkerEngagementData,
): Pick<import('./bot-detection').BotDetectionInput, 'engagementData'> {
  const { recentTweets } = engagementData;

  // Aggregate tweet data
  const totalViews = recentTweets.reduce((s, t) => s + t.views, 0);
  const avgViews = recentTweets.length > 0 ? totalViews / recentTweets.length : 0;
  const totalReplyCount = recentTweets.reduce((s, t) => s + t.replyCount, 0);
  const totalVisibleReplies = recentTweets.reduce((s, t) => s + t.visibleReplies, 0);
  const allFirstCommenters = recentTweets.flatMap(t => t.firstCommenters);
  // allCommentTimes is aggregated per-tweet in the detection algorithms, not here
  const allPostingHours = recentTweets
    .filter(t => t.postedAt !== undefined)
    .map(t => new Date(t.postedAt!).getHours());
  const allPostTexts: string[] = []; // Not available in engagement data

  // Find engagement pod accounts (accounts appearing in >40% of first comments)
  const commenterCounts = new Map<string, number>();
  for (const commenter of allFirstCommenters) {
    commenterCounts.set(commenter, (commenterCounts.get(commenter) || 0) + 1);
  }
  const threshold = Math.max(2, recentTweets.length * 0.4);
  const podAccounts = [...commenterCounts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([account]) => account);

  return {
    engagementData: {
      views: Math.round(avgViews),
      replyCount: totalReplyCount,
      visibleReplies: totalVisibleReplies,
      recentTweetCount: recentTweets.length,
      postingHours: allPostingHours,
      recentPosts: allPostTexts,
      engagementPodAccounts: podAccounts,
    },
  };
}