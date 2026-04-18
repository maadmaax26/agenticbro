/**
 * Profile Verifier Service
 *
 * Verifies social media profiles for authenticity, detecting:
 * - Bot followers
 * - AI-generated/deepfake content
 * - Known scammers
 * - Impersonation attempts
 *
 * Supports context-aware scoring for crypto, romance, employment,
 * marketplace, financial, and general use cases.
 */

import { TwitterClient } from '../../clients/twitter';
import { InstagramClient } from '../../clients/instagram';
import { LinkedInClient } from '../../clients/linkedin';
import { BotometerClient } from '../../clients/botometer';
import { DeepfakeDetector } from '../../utils/deepfake';
import { ScammerDatabase } from '../../db/scammer-db';
import { Cache } from '../../utils/cache';
import { AuthenticityCalculator, VerificationContext } from './scoring';

export type SupportedPlatform =
  | 'twitter'
  | 'telegram'
  | 'discord'
  | 'instagram'
  | 'linkedin'
  | 'facebook';

export interface ProfileVerifyRequest {
  platform: SupportedPlatform;
  username: string;
  /**
   * The context in which this profile is being checked.
   * Adjusts scoring weights to reflect what matters most for each use case.
   *   - crypto:      Is this the real project lead / KOL? (default)
   *   - romance:     Is this dating profile a real person?
   *   - employment:  Is this recruiter or job offer legitimate?
   *   - marketplace: Is this seller trustworthy?
   *   - financial:   Is this advisor credentialed and real?
   *   - general:     Balanced, no specific context.
   */
  verificationContext?: VerificationContext;
  options?: {
    deepScan?: boolean;
    includeMedia?: boolean;
    sampleFollowers?: boolean;
    forceRefresh?: boolean;
  };
}

export interface VerifyResult {
  success: boolean;
  data?: {
    profile: ProfileInfo;
    authenticityScore: number;
    riskLevel: RiskLevel;
    verificationContext: VerificationContext;
    categories: {
      verification: CategoryResult;
      botDetection: CategoryResult;
      deepfake: CategoryResult;
      impersonation: CategoryResult;
      activity: CategoryResult;
    };
    redFlags: string[];
    warnings: string[];
    recommendation: string;
    /** Plain-English summary suitable for non-technical users */
    plainLanguageSummary: string;
    scanTime: string;
    scanDuration: string;
    cacheHit: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ProfileInfo {
  platform: string;
  username: string;
  displayName: string;
  verified: boolean;
  verifiedType?: string;
  followers: number;
  following: number;
  tweets?: number;
  createdAt: string;
  profileImage?: string;
  bio?: string;
  location?: string;
  website?: string;
}

export interface CategoryResult {
  score: number;
  maxScore: number;
  status: 'VERIFIED' | 'SAFE' | 'SKIPPED' | 'LOW' | 'MEDIUM' | 'HIGH' | 'UNSAFE' | 'SCAM';
  weight: number;
  details: Record<string, any>;
}

export type RiskLevel = 'VERIFIED' | 'SAFE' | 'CAUTION' | 'UNSAFE' | 'SCAM';

// ---------------------------------------------------------------------------
// Keyword signal sets — organised by scam type / context
// ---------------------------------------------------------------------------

/** Crypto giveaway / airdrop patterns */
const CRYPTO_SCAM_BIO_KEYWORDS = [
  'giveaway', 'airdrop', 'free crypto', 'send', 'receive',
  'bonus', 'claim now', 'nft drop',
];

const CRYPTO_SCAM_USERNAME_PATTERNS = [
  { pattern: /_giveaway$/i, score: 8, factor: 'Username ends with "_giveaway"' },
  { pattern: /_airdrop$/i, score: 8, factor: 'Username ends with "_airdrop"' },
  { pattern: /_official$/i, score: 5, factor: 'Username ends with "_official"' },
  { pattern: /_real$/i, score: 5, factor: 'Username ends with "_real"' },
  { pattern: /^the_/i, score: 3, factor: 'Username starts with "the_"' },
];

/** Romance scam bio signals */
const ROMANCE_SCAM_BIO_KEYWORDS = [
  'widowed', 'widower', 'deployed', 'overseas contract', 'oil rig',
  'us army', 'us military', 'military doctor', 'peacekeeping mission',
  'cannot talk on phone', 'gift card', 'western union', 'moneygram',
  'working abroad', 'on a ship', 'offshore platform',
];

const ROMANCE_SCAM_USERNAME_PATTERNS = [
  { pattern: /love\d+$/i, score: 4, factor: 'Username ends with "love" + numbers' },
  { pattern: /single(mom|dad|parent)/i, score: 3, factor: 'Username contains single-parent claim' },
];

/** Fake job / recruiter signals */
const JOB_SCAM_BIO_KEYWORDS = [
  'work from home', 'earn $500/day', 'earn $1000/week', 'hiring now',
  'no experience needed', 'flexible hours', 'be your own boss',
  'dm for opportunity', 'dm to apply', 'passive income', 'financial freedom',
  'make money online', 'drop shipping', 'unlimited earning potential',
];

const JOB_SCAM_USERNAME_PATTERNS = [
  { pattern: /recruiter\d+$/i, score: 5, factor: 'Username is "recruiter" + numbers (generic recruiter account)' },
  { pattern: /hr_?manager/i, score: 4, factor: 'Generic HR manager username without company name' },
  { pattern: /jobs?_?offer/i, score: 5, factor: 'Username contains "job offer"' },
];

/** Government / authority / bank impersonation */
const AUTHORITY_SCAM_BIO_KEYWORDS = [
  'irs official', 'social security', 'medicare helpline', 'dmv official',
  'account suspended', 'verify your account', 'unusual activity detected',
  'call us now', 'toll free', '24/7 support', 'official helpline',
  'customer support', 'help desk', 'bank security',
];

const AUTHORITY_SCAM_USERNAME_PATTERNS = [
  { pattern: /support_?help/i, score: 5, factor: 'Username contains generic "support help"' },
  { pattern: /official_?help/i, score: 5, factor: 'Username contains "official help"' },
  { pattern: /irs_?official/i, score: 10, factor: 'Username impersonates IRS' },
  { pattern: /_(bank|chase|wellsfargo|bofa|citibank)_?/i, score: 8, factor: 'Username impersonates a bank' },
];

/** Marketplace seller fraud */
const MARKETPLACE_SCAM_BIO_KEYWORDS = [
  'cashapp only', 'cash app only', 'zelle only', 'zelle preferred',
  'no returns', 'no refunds', 'no returns no refunds',
  'dm price', 'ship worldwide', 'deal of the day', 'limited time',
];

const MARKETPLACE_SCAM_USERNAME_PATTERNS = [
  { pattern: /deals?\d+$/i, score: 4, factor: 'Username is "deals" + numbers' },
  { pattern: /shop_?legit/i, score: 5, factor: 'Username defensively claims legitimacy' },
];

// ---------------------------------------------------------------------------
// Context → keyword sets mapping
// ---------------------------------------------------------------------------

type KeywordSet = {
  bioKeywords: string[];
  usernamePatterns: Array<{ pattern: RegExp; score: number; factor: string }>;
};

const CONTEXT_KEYWORD_SETS: Record<VerificationContext, KeywordSet> = {
  crypto: {
    bioKeywords: CRYPTO_SCAM_BIO_KEYWORDS,
    usernamePatterns: CRYPTO_SCAM_USERNAME_PATTERNS,
  },
  romance: {
    bioKeywords: [...ROMANCE_SCAM_BIO_KEYWORDS, ...CRYPTO_SCAM_BIO_KEYWORDS],
    usernamePatterns: ROMANCE_SCAM_USERNAME_PATTERNS,
  },
  employment: {
    bioKeywords: JOB_SCAM_BIO_KEYWORDS,
    usernamePatterns: JOB_SCAM_USERNAME_PATTERNS,
  },
  marketplace: {
    bioKeywords: MARKETPLACE_SCAM_BIO_KEYWORDS,
    usernamePatterns: MARKETPLACE_SCAM_USERNAME_PATTERNS,
  },
  financial: {
    bioKeywords: [...AUTHORITY_SCAM_BIO_KEYWORDS, ...CRYPTO_SCAM_BIO_KEYWORDS],
    usernamePatterns: [...AUTHORITY_SCAM_USERNAME_PATTERNS],
  },
  general: {
    bioKeywords: [
      ...CRYPTO_SCAM_BIO_KEYWORDS,
      ...ROMANCE_SCAM_BIO_KEYWORDS,
      ...JOB_SCAM_BIO_KEYWORDS,
      ...AUTHORITY_SCAM_BIO_KEYWORDS,
      ...MARKETPLACE_SCAM_BIO_KEYWORDS,
    ],
    usernamePatterns: [
      ...CRYPTO_SCAM_USERNAME_PATTERNS,
      ...ROMANCE_SCAM_USERNAME_PATTERNS,
      ...JOB_SCAM_USERNAME_PATTERNS,
      ...AUTHORITY_SCAM_USERNAME_PATTERNS,
      ...MARKETPLACE_SCAM_USERNAME_PATTERNS,
    ],
  },
};

// ---------------------------------------------------------------------------
// Context-aware plain-language recommendation copy
// ---------------------------------------------------------------------------

type ContextCopy = Record<RiskLevel, string>;

const RECOMMENDATION_COPY: Record<VerificationContext, ContextCopy> = {
  crypto: {
    VERIFIED: '✅ VERIFIED ACCOUNT — Official account of a public figure or project. Safe to interact with.',
    SAFE: '✅ SAFE — Authentic profile with no significant red flags. Standard caution recommended.',
    CAUTION: '⚠️ CAUTION — Some concerns detected. Investigate further before sending funds or engaging.',
    UNSAFE: '❌ UNSAFE — Significant red flags detected. Do not send crypto or share wallet information.',
    SCAM: '🛑 DO NOT INTERACT — Known crypto scam account. Report and block immediately.',
  },
  romance: {
    VERIFIED: '✅ This profile appears authentic. The person matches their claimed identity.',
    SAFE: '✅ This profile shows no significant red flags. Use normal caution as you would with anyone you meet online.',
    CAUTION: '⚠️ Some signals are unusual. Before sharing personal details or meeting in person, ask for a live video call to confirm identity.',
    UNSAFE: '❌ Several red flags detected typical of romance scams. Do not send money, gift cards, or personal financial information.',
    SCAM: '🛑 This profile matches known romance scam patterns. Stop all contact and report to the platform. If you have already sent money, contact your bank and report to the FTC at reportfraud.ftc.gov.',
  },
  employment: {
    VERIFIED: '✅ This recruiter or job posting appears legitimate. Proceed with normal due diligence.',
    SAFE: '✅ No significant red flags detected. Verify the company independently through their official website before providing personal documents.',
    CAUTION: '⚠️ Some concerns detected with this recruiter or job offer. Look up the company independently — do not pay any fees or provide financial information yet.',
    UNSAFE: '❌ This job offer shows multiple red flags. Legitimate employers never charge application fees or ask for bank details upfront.',
    SCAM: '🛑 This appears to be a fraudulent job posting or fake recruiter. Do not provide personal documents or pay any fees. Report to the FTC at reportfraud.ftc.gov.',
  },
  marketplace: {
    VERIFIED: '✅ This seller has a strong, established track record. Safe to proceed with normal caution.',
    SAFE: '✅ This seller profile looks authentic. Review transaction terms carefully before paying.',
    CAUTION: '⚠️ Some concerns with this seller. Prefer payment methods with buyer protection (credit card, PayPal Goods & Services) and avoid irreversible payments.',
    UNSAFE: '❌ Significant red flags. Avoid irreversible payment methods like Zelle, Cash App, or wire transfers — there is no recourse if this is a scam.',
    SCAM: '🛑 This seller matches known marketplace scam patterns. Do not send payment. Report to the platform and your local consumer protection agency.',
  },
  financial: {
    VERIFIED: '✅ This account appears to represent a verified financial professional or firm.',
    SAFE: '✅ No significant red flags detected. Always verify credentials independently with FINRA BrokerCheck or your state securities regulator.',
    CAUTION: '⚠️ Some concerns about this financial account. Do not invest until you have verified their credentials through official regulatory databases.',
    UNSAFE: '❌ Multiple red flags for financial impersonation. Do not transfer funds or share account information.',
    SCAM: '🛑 This account is likely impersonating a financial professional. Report to the SEC (sec.gov/tcr), FINRA, or your state securities regulator.',
  },
  general: {
    VERIFIED: '✅ VERIFIED ACCOUNT — This account appears authentic and legitimate.',
    SAFE: '✅ SAFE — No significant red flags. Use normal caution.',
    CAUTION: '⚠️ CAUTION — Some concerns detected. Investigate further before sharing personal information or sending money.',
    UNSAFE: '❌ UNSAFE — Significant red flags detected. Do not send money or share personal information.',
    SCAM: '🛑 DO NOT INTERACT — This account has been flagged as a scam. Report and block immediately.',
  },
};

const PLAIN_LANGUAGE_COPY: Record<VerificationContext, ContextCopy> = {
  crypto: {
    VERIFIED: "This is a verified, official account. It's safe to interact with for crypto purposes.",
    SAFE: "This account looks real. Be cautious, but no major red flags were found.",
    CAUTION: "A few things about this account seem off. Don't send any funds without doing more research.",
    UNSAFE: "This account has several warning signs of a scam. Do not send any cryptocurrency.",
    SCAM: "This account is a known scam. Do not interact with it.",
  },
  romance: {
    VERIFIED: "This profile appears to be a real person matching their claimed identity.",
    SAFE: "No major warning signs found. Still, take your time getting to know someone before sharing personal details.",
    CAUTION: "Something about this profile doesn't add up. Ask for a live video call before sharing any personal or financial information.",
    UNSAFE: "This profile has several warning signs of a romance scam. Never send money or gift cards to someone you've only met online.",
    SCAM: "This looks like a romance scam. Stop all contact, don't send money, and report this profile to the app or site.",
  },
  employment: {
    VERIFIED: "This recruiter or job listing appears legitimate.",
    SAFE: "No major red flags found. Still, verify the company through its official website before applying.",
    CAUTION: "Something about this job offer seems off. Don't pay any fees or share your bank account details.",
    UNSAFE: "This has the hallmarks of a fake job offer. Real employers don't ask for payment to apply.",
    SCAM: "This is likely a fake job scam. Don't send money or provide personal documents.",
  },
  marketplace: {
    VERIFIED: "This seller has a strong history and appears trustworthy.",
    SAFE: "This seller looks legitimate. Review the listing carefully before paying.",
    CAUTION: "Be careful with this seller. Use a payment method that offers buyer protection.",
    UNSAFE: "This seller has multiple warning signs. Avoid payment methods you can't reverse.",
    SCAM: "This seller is likely a scammer. Don't send any money.",
  },
  financial: {
    VERIFIED: "This appears to be a verified financial professional.",
    SAFE: "No major red flags, but always verify financial credentials independently.",
    CAUTION: "Something about this financial account seems off. Do not invest until credentials are confirmed.",
    UNSAFE: "This account has warning signs of investment fraud. Do not transfer any funds.",
    SCAM: "This account appears to be impersonating a financial professional. Report it immediately.",
  },
  general: {
    VERIFIED: "This account appears to be real and legitimate.",
    SAFE: "No major warning signs found. Use normal caution.",
    CAUTION: "A few things seem off. Be careful before sharing personal information or sending money.",
    UNSAFE: "Several warning signs found. Do not send money or share personal details.",
    SCAM: "This account is likely a scam. Don't interact with it.",
  },
};

// ---------------------------------------------------------------------------
// ProfileVerifier class
// ---------------------------------------------------------------------------

export class ProfileVerifier {
  private twitter: TwitterClient;
  private instagram: InstagramClient;
  private linkedin: LinkedInClient;
  private botometer: BotometerClient;
  private deepfake: DeepfakeDetector;
  private scammerDb: ScammerDatabase;
  private cache: Cache;
  private calculator: AuthenticityCalculator;

  constructor(config: VerifierConfig) {
    this.twitter = new TwitterClient(config.twitterConfig);
    this.instagram = new InstagramClient(config.puppeteerEndpoint);
    this.linkedin = new LinkedInClient(config.puppeteerEndpoint);
    this.botometer = new BotometerClient({ apiKey: config.botometerApiKey });
    this.deepfake = new DeepfakeDetector(config.deepfakeModelPath);
    this.scammerDb = new ScammerDatabase(config.databaseUrl);
    this.cache = new Cache(config.redisUrl);
    this.calculator = new AuthenticityCalculator();
  }

  /**
   * Verify a social media profile
   */
  async verify(
    platform: string,
    username: string,
    options: VerifyOptions = {}
  ): Promise<VerifyResult> {
    const startTime = Date.now();
    const normalizedUsername = this.normalizeUsername(username);
    const context: VerificationContext = options.verificationContext || 'crypto';

    try {
      // Check cache first
      const cacheKey = `verify:${platform}:${normalizedUsername}:${context}`;
      if (!options.forceRefresh) {
        const cached = await this.cache.get(cacheKey);
        if (cached && typeof cached === 'object' && 'success' in cached) {
          return { ...cached as VerifyResult, data: { ...(cached as VerifyResult).data!, cacheHit: true } };
        }
      }

      // Fetch profile data
      const profileData = await this.fetchProfileData(platform, normalizedUsername, options);

      if (!profileData) {
        return {
          success: false,
          error: {
            code: 'ACCOUNT_NOT_FOUND',
            message: `Account @${normalizedUsername} not found on ${platform}`,
          },
        };
      }

      // Run all verification checks in parallel
      const [verification, botAnalysis, deepfakeAnalysis, impersonation, activity] =
        await Promise.all([
          this.checkVerification(profileData),
          this.analyzeBots(profileData, options),
          this.analyzeDeepfake(profileData, options),
          this.checkImpersonation(profileData, context),
          this.analyzeActivity(profileData),
        ]);

      // Calculate overall authenticity score using context weights
      const categories = {
        verification,
        botDetection: botAnalysis,
        deepfake: deepfakeAnalysis,
        impersonation,
        activity,
      };

      const authenticityScore = this.calculator.calculateScore(categories, context);
      const riskLevel = this.determineRiskLevel(authenticityScore);

      // Build result
      const result: VerifyResult = {
        success: true,
        data: {
          profile: this.extractProfileInfo(profileData),
          authenticityScore,
          riskLevel,
          verificationContext: context,
          categories,
          redFlags: this.extractRedFlags(categories, context),
          warnings: this.extractWarnings(categories, context),
          recommendation: RECOMMENDATION_COPY[context][riskLevel],
          plainLanguageSummary: PLAIN_LANGUAGE_COPY[context][riskLevel],
          scanTime: new Date().toISOString(),
          scanDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
          cacheHit: false,
        },
      };

      // Cache the result
      const ttl = this.getCacheTTL(riskLevel);
      await this.cache.set(cacheKey, result, ttl);

      return result;

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'VERIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
        },
      };
    }
  }

  /**
   * Fetch profile data from platform
   */
  private async fetchProfileData(
    platform: string,
    username: string,
    options: VerifyOptions
  ): Promise<ProfileData | null> {
    switch (platform) {
      case 'twitter':
        return this.twitter.getProfile(username, options);
      case 'instagram':
        return this.instagram.getProfile(username, options);
      case 'linkedin':
        return this.linkedin.getProfile(username, options);
      case 'facebook':
        return this.fetchFacebookProfile(username);
      case 'telegram':
        return this.fetchTelegramProfile(username);
      case 'discord':
        return this.fetchDiscordProfile(username);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Check verification status
   */
  private async checkVerification(profileData: ProfileData): Promise<CategoryResult> {
    const score = profileData.verified ? 30 :
                  profileData.verifiedType === 'blue' ? 25 :
                  profileData.followers > 10000 ? 15 : 5;

    return {
      score,
      maxScore: 30,
      status: score >= 30 ? 'VERIFIED' : score >= 20 ? 'SAFE' : 'LOW',
      weight: 0.30,
      details: {
        platformVerified: profileData.verified || false,
        verificationType: profileData.verifiedType || null,
        verifiedSince: profileData.verifiedDate || null,
        verificationConfidence: profileData.verified ? 100 : 0,
      },
    };
  }

  /**
   * Analyze follower authenticity for bot detection
   */
  private async analyzeBots(
    profileData: ProfileData,
    options: VerifyOptions
  ): Promise<CategoryResult> {
    let botScore = 0;
    let fakeFollowersPercent = 0;
    let engagementAuthenticity = 100;

    if (options.sampleFollowers && profileData.followers > 0) {
      const botometerResult = await this.botometer.getScore(profileData.username);
      botScore = botometerResult.botProbability * 100;
      fakeFollowersPercent = botometerResult.fakeFollowersPercent;
      engagementAuthenticity = botometerResult.engagementAuthenticity;
    } else {
      fakeFollowersPercent = this.estimateFakeFollowers(profileData);
      engagementAuthenticity = this.calculateEngagementAuthenticity(profileData);
    }

    let score = 25;
    score -= fakeFollowersPercent * 0.2;
    score -= Math.min(botScore * 0.1, 10);
    score -= engagementAuthenticity < 50 ? 5 : 0;

    return {
      score: Math.max(score, 0),
      maxScore: 25,
      status: score >= 20 ? 'SAFE' : score >= 15 ? 'LOW' : score >= 10 ? 'MEDIUM' : 'HIGH',
      weight: 0.25,
      details: {
        fakeFollowersPercent,
        botScore,
        suspiciousFollowersCount: Math.floor(profileData.followers * fakeFollowersPercent / 100),
        engagementAuthenticity,
        followerGrowthPattern: profileData.growthPattern || 'unknown',
        engagementRate: profileData.engagementRate || 0,
      },
    };
  }

  /**
   * Analyze profile media for deepfake detection
   */
  private async analyzeDeepfake(
    profileData: ProfileData,
    options: VerifyOptions
  ): Promise<CategoryResult> {
    if (!options.includeMedia) {
      return {
        score: 0,
        maxScore: 20,
        status: 'SKIPPED',
        weight: 0.20,
        details: { reason: 'Media analysis not requested' },
      };
    }

    const profileImage = profileData.profileImage;
    if (!profileImage) {
      return {
        score: 20,
        maxScore: 20,
        status: 'SAFE',
        weight: 0.20,
        details: { reason: 'No profile image to analyze' },
      };
    }

    try {
      const imageData = await this.fetchImage(profileImage);
      const analysis = await this.deepfake.analyze(imageData);

      const aiProb = analysis.aiGeneratedProbability;
      let score = 20;
      if (aiProb > 0.9) score = 0;
      else if (aiProb > 0.7) score = 5;
      else if (aiProb > 0.5) score = 10;
      else if (aiProb > 0.3) score = 15;

      return {
        score,
        maxScore: 20,
        status: score >= 15 ? 'SAFE' : score >= 10 ? 'MEDIUM' : 'HIGH',
        weight: 0.20,
        details: {
          profileImageAnalysis: score >= 15 ? 'authentic' : 'suspicious',
          manipulationProbability: analysis.manipulationProbability,
          faceMatch: analysis.faceMatch,
          aiGeneratedProbability: aiProb,
          deepfakeConfidence: Math.round((1 - aiProb) * 100),
        },
      };
    } catch (error) {
      return {
        score: 10,
        maxScore: 20,
        status: 'MEDIUM',
        weight: 0.20,
        details: {
          error: 'Failed to analyze profile image',
          reason: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Check for impersonation and known scammers.
   * Uses context-specific keyword sets so the right patterns are applied
   * for each use case (crypto, romance, employment, etc.).
   */
  private async checkImpersonation(
    profileData: ProfileData,
    context: VerificationContext
  ): Promise<CategoryResult> {
    const username = profileData.username;
    const displayName = profileData.displayName;

    // Check if in known scammer database (gracefully skip if DB is unavailable)
    let scammerMatch = null;
    try {
      scammerMatch = await this.scammerDb.findByUsername(username);
    } catch {
      // Database not reachable — scammer-DB lookup skipped
    }
    if (scammerMatch) {
      return {
        score: 0,
        maxScore: 15,
        status: 'SCAM',
        weight: 0.15,
        details: {
          isKnownImpersonator: true,
          impersonatingAccount: scammerMatch.impersonating,
          reportCount: scammerMatch.victimCount,
          scammerDbMatch: true,
          scammerId: scammerMatch.id,
          scamType: scammerMatch.scamType,
        },
      };
    }

    // Find similar usernames in scammer db
    const similarAccounts = await this.findSimilarUsernames(username, displayName);

    // Calculate impersonation risk using context-appropriate keywords
    const impersonationRisk = this.calculateImpersonationRisk(
      username,
      displayName,
      similarAccounts,
      profileData,
      context
    );

    const score = Math.max(15 - impersonationRisk.score, 0);

    return {
      score,
      maxScore: 15,
      status: impersonationRisk.score >= 10 ? 'SCAM' :
              impersonationRisk.score >= 5 ? 'UNSAFE' : 'SAFE',
      weight: 0.15,
      details: {
        isKnownImpersonator: false,
        impersonatingAccount: impersonationRisk.impersonating || null,
        similarAccounts: similarAccounts.slice(0, 5),
        reportCount: 0,
        scammerDbMatch: false,
        riskFactors: impersonationRisk.factors,
        contextApplied: context,
      },
    };
  }

  /**
   * Analyze account activity patterns
   */
  private async analyzeActivity(profileData: ProfileData): Promise<CategoryResult> {
    const now = new Date();
    const createdAt = new Date(profileData.createdAt);
    const accountAgeDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    let score = 10;

    if (accountAgeDays < 7) score -= 5;
    else if (accountAgeDays < 30) score -= 3;
    else if (accountAgeDays < 90) score -= 1;

    const postingScore = this.analyzePostingPatterns(profileData);
    score -= Math.max(0, 5 - postingScore);

    const engagementRate = profileData.engagementRate || 0;
    if (engagementRate > 0.1) score -= 2;
    if (engagementRate < 0.001) score -= 1;

    const suspiciousPatterns = this.detectSuspiciousPatterns(profileData);
    score -= suspiciousPatterns.length;

    return {
      score: Math.max(score, 0),
      maxScore: 10,
      status: score >= 8 ? 'SAFE' : score >= 5 ? 'LOW' : 'MEDIUM',
      weight: 0.10,
      details: {
        accountAge: this.formatAge(accountAgeDays),
        accountAgeDays,
        postingFrequency: profileData.postingFrequency || 'unknown',
        postingFrequencyScore: postingScore,
        engagementRate,
        suspiciousPatterns,
        lastActive: profileData.lastActive || null,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private normalizeUsername(username: string): string {
    return username.replace(/^@/, '').toLowerCase().trim();
  }

  private determineRiskLevel(score: number): RiskLevel {
    if (score >= 95) return 'VERIFIED';
    if (score >= 80) return 'SAFE';
    if (score >= 60) return 'CAUTION';
    if (score >= 40) return 'UNSAFE';
    return 'SCAM';
  }

  private extractProfileInfo(profileData: ProfileData): ProfileInfo {
    return {
      platform: profileData.platform,
      username: profileData.username,
      displayName: profileData.displayName,
      verified: profileData.verified,
      verifiedType: profileData.verifiedType,
      followers: profileData.followers,
      following: profileData.following,
      tweets: profileData.tweets,
      createdAt: profileData.createdAt,
      profileImage: profileData.profileImage,
      bio: profileData.bio,
      location: profileData.location,
      website: profileData.website,
    };
  }

  private extractRedFlags(categories: any, context: VerificationContext): string[] {
    const flags: string[] = [];

    if (categories.impersonation.status === 'SCAM') {
      flags.push('🚨 KNOWN SCAMMER — Account found in scammer database');
      if (categories.impersonation.details.victimCount > 10) {
        flags.push(`⚠️ ${categories.impersonation.details.victimCount} victims reported`);
      }
    }

    if (categories.botDetection.details.fakeFollowersPercent > 50) {
      flags.push(`🤖 ${categories.botDetection.details.fakeFollowersPercent}% fake followers detected`);
    }

    if (categories.deepfake.details.aiGeneratedProbability > 0.7) {
      const label = context === 'romance'
        ? '📷 Profile photo appears to be AI-generated or stolen — a common romance scam tactic'
        : '🎭 AI-generated profile image detected';
      flags.push(label);
    }

    if (categories.activity.details.accountAgeDays < 7) {
      const label = context === 'marketplace'
        ? '⏰ Seller account is less than 7 days old — very high risk'
        : '⏰ Account created less than 7 days ago';
      flags.push(label);
    }

    if (categories.impersonation.details.riskFactors?.length > 0) {
      for (const factor of categories.impersonation.details.riskFactors) {
        flags.push(`⚠️ ${factor}`);
      }
    }

    return flags;
  }

  private extractWarnings(categories: any, context: VerificationContext): string[] {
    const warnings: string[] = [];

    if (categories.botDetection.details.fakeFollowersPercent > 20) {
      warnings.push(`${categories.botDetection.details.fakeFollowersPercent}% of followers appear to be bots`);
    }

    if (categories.activity.details.accountAgeDays < 30) {
      const label = context === 'romance'
        ? `This account is only ${categories.activity.details.accountAgeDays} days old — romance scammers often use newly created profiles`
        : context === 'employment'
        ? `This recruiter account is only ${categories.activity.details.accountAgeDays} days old — verify through official company channels`
        : `Account is only ${categories.activity.details.accountAgeDays} days old — newer accounts carry higher risk`;
      warnings.push(label);
    }

    if (categories.verification.score < 20 && categories.verification.maxScore === 30) {
      if (context === 'financial') {
        warnings.push('This account is not verified — financial professionals typically have verified credentials on LinkedIn or their firm website');
      } else {
        warnings.push('Account is not platform verified');
      }
    }

    if (categories.activity.details.engagementRate > 0.05) {
      warnings.push('Engagement rate is unusually high — may indicate fake engagement');
    }

    return warnings;
  }

  private getCacheTTL(riskLevel: RiskLevel): number {
    const ttlMap: Record<RiskLevel, number> = {
      VERIFIED: 7 * 24 * 60 * 60,
      SAFE: 24 * 60 * 60,
      CAUTION: 12 * 60 * 60,
      UNSAFE: 1 * 60 * 60,
      SCAM: 30 * 60,
    };
    return ttlMap[riskLevel];
  }

  private estimateFakeFollowers(profileData: ProfileData): number {
    if (profileData.followers < 1000) return 5;
    if (profileData.followers < 10000) return 10;
    const ratio = profileData.followers / (profileData.engagementRate || 0.01);
    if (ratio > 1000000) return 50;
    if (ratio > 100000) return 30;
    if (ratio > 10000) return 15;
    return 10;
  }

  private calculateEngagementAuthenticity(profileData: ProfileData): number {
    const rate = profileData.engagementRate || 0;
    if (rate < 0.001) return 50;
    if (rate < 0.01) return 90;
    if (rate < 0.05) return 85;
    if (rate < 0.1) return 60;
    return 30;
  }

  private async findSimilarUsernames(username: string, displayName: string): Promise<any[]> {
    return [];
  }

  /**
   * Calculate impersonation risk using context-appropriate keyword sets.
   */
  private calculateImpersonationRisk(
    username: string,
    displayName: string,
    similarAccounts: any[],
    profileData: ProfileData,
    context: VerificationContext
  ): { score: number; factors: string[]; impersonating?: string } {
    let score = 0;
    const factors: string[] = [];
    const keywordSet = CONTEXT_KEYWORD_SETS[context];

    // Apply context-specific username patterns
    for (const { pattern, score: add, factor } of keywordSet.usernamePatterns) {
      if (pattern.test(username)) {
        score += add;
        factors.push(factor);
      }
    }

    // Check if account is new
    const accountAgeDays = Math.floor(
      (Date.now() - new Date(profileData.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (accountAgeDays < 30) {
      score += 3;
      factors.push(`Account is only ${accountAgeDays} days old`);
    }

    // Apply context-specific bio keywords
    const bio = (profileData.bio || '').toLowerCase();
    for (const keyword of keywordSet.bioKeywords) {
      if (bio.includes(keyword.toLowerCase())) {
        score += 2;
        factors.push(`Bio contains "${keyword}"`);
      }
    }

    // Check verification status
    if (!profileData.verified && profileData.followers < 10000) {
      score += 2;
      factors.push('Unverified account with low follower count');
    }

    return { score, factors };
  }

  private analyzePostingPatterns(profileData: ProfileData): number {
    if (!profileData.tweets || !profileData.accountAgeDays) return 3;
    const tweetsPerDay = profileData.tweets / profileData.accountAgeDays;
    if (tweetsPerDay > 50) return 1;
    if (tweetsPerDay > 20) return 2;
    if (tweetsPerDay > 10) return 3;
    if (tweetsPerDay > 1) return 4;
    return 5;
  }

  private detectSuspiciousPatterns(profileData: ProfileData): string[] {
    const patterns: string[] = [];
    if (profileData.following > profileData.followers * 2) {
      patterns.push('Mass following detected');
    }
    if (!profileData.bio && profileData.followers > 10000) {
      patterns.push('High followers with empty bio');
    }
    if (!profileData.profileImage || profileData.profileImage.includes('default')) {
      patterns.push('Default profile image');
    }
    return patterns;
  }

  private formatAge(days: number): string {
    if (days < 1) return 'less than 1 day';
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? 's' : ''}`;
  }

  private async fetchImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async fetchTelegramProfile(username: string): Promise<ProfileData | null> {
    // Implementation for Telegram profile fetching via Telegram API / web scraping
    return null;
  }

  private async fetchDiscordProfile(username: string): Promise<ProfileData | null> {
    // Implementation for Discord profile fetching
    return null;
  }

  private async fetchFacebookProfile(username: string): Promise<ProfileData | null> {
    // Implementation for Facebook public profile fetching via Puppeteer
    return null;
  }
}

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

interface VerifierConfig {
  twitterConfig: any;
  /** Chrome DevTools Protocol endpoint for Puppeteer-based scrapers */
  puppeteerEndpoint?: string;
  botometerApiKey: string;
  deepfakeModelPath: string;
  databaseUrl: string;
  redisUrl: string;
}

interface VerifyOptions {
  deepScan?: boolean;
  includeMedia?: boolean;
  sampleFollowers?: boolean;
  forceRefresh?: boolean;
  verificationContext?: VerificationContext;
}

interface ProfileData {
  platform: string;
  username: string;
  displayName: string;
  verified: boolean;
  verifiedType?: string;
  verifiedDate?: string;
  followers: number;
  following: number;
  tweets?: number;
  accountAgeDays?: number;
  createdAt: string;
  profileImage?: string;
  bio?: string;
  location?: string;
  website?: string;
  engagementRate?: number;
  postingFrequency?: string;
  growthPattern?: string;
  lastActive?: string;
}

export default ProfileVerifier;
