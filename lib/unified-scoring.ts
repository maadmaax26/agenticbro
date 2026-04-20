/**
 * Unified Scoring System for Social Media Scanners
 * ==================================================
 * Ported from Python unified_scoring.py — identical weights, patterns, thresholds.
 * 90-point weighted scoring for consistent scam detection across all platforms.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type VerificationLevel = 'LIKELY SAFE' | 'PATTERN MATCHES' | 'UNVERIFIED' | 'HIGH RISK';

export interface FlagDetail {
  flag: string;
  weight: number;
  description: string;
  patternMatched: string;
  platformSpecific?: boolean;
}

export interface RiskResult {
  riskScore: number;
  riskLevel: RiskLevel;
  verificationLevel: VerificationLevel;
  redFlagsDetected: number;
  flagDetails: FlagDetail[];
  weightsSum: number;
  maxPossibleWeight: number;
  scanTimestamp: string;
}

// ── Red flag definitions (identical to Python) ──────────────────────────────

interface RedFlag {
  weight: number;
  patterns: string[];
  description: string;
}

const RED_FLAGS: Record<string, RedFlag> = {
  guaranteed_returns: {
    weight: 25,
    patterns: [
      'guaranteed', 'guarantee', 'sure thing', '100% profit',
      '100x', '1000x', '1000x returns', 'guaranteed returns',
      'risk-free', 'no risk', 'certain profit',
    ],
    description: 'Claims of guaranteed profits or unrealistic returns',
  },
  giveaway_airdrop: {
    weight: 20,
    patterns: [
      'giveaway', 'airdrop', 'free crypto', 'free bitcoin',
      'free ethereum', 'free solana', 'claim free', 'free money',
      'free tokens', 'free nft',
    ],
    description: 'Free crypto giveaways or airdrops',
  },
  dm_solicitation: {
    weight: 15,
    patterns: [
      'dm for', 'dm me', 'message me', 'contact me',
      'dm for more', 'dm for info', 'dm for alpha',
      'check dm', 'sent dm', 'dm for details',
    ],
    description: 'Requests to DM for more information',
  },
  free_crypto: {
    weight: 15,
    patterns: [
      'free', 'no cost', 'zero investment', 'no investment',
      'free money', 'free cash', 'free profit',
    ],
    description: 'Free money or crypto without clear source',
  },
  alpha_dm_scheme: {
    weight: 15,
    patterns: [
      'alpha', 'private alpha', 'exclusive access', 'vip',
      'premium access', 'exclusive', 'vip group', 'premium group',
      'private group', 'exclusive signals',
    ],
    description: 'Gatekeeping information behind DM/VIP',
  },
  unrealistic_claims: {
    weight: 10,
    patterns: [
      '24h', 'overnight', 'instant', 'fast profits',
      'quick profits', 'instant wealth', 'overnight wealth',
      'fast money', 'quick money',
    ],
    description: 'Unrealistic timeframes for profits',
  },
  download_install: {
    weight: 10,
    patterns: [
      '.exe', '.apk', '.zip', '.dmg', 'download',
      'install app', 'install software', 'download app',
      'install wallet', 'download wallet',
    ],
    description: 'Requests to download files or install apps',
  },
  urgency_tactics: {
    weight: 10,
    patterns: [
      'act now', 'limited time', 'last chance', 'ending soon',
      'only few spots', 'limited spots', 'hurry', "don't wait",
      'time limited', 'expires soon',
    ],
    description: 'Urgency to create FOMO',
  },
  emotional_manipulation: {
    weight: 10,
    patterns: [
      'family', 'emergency', 'sick', 'hospital', 'desperate',
      'need help', 'please help', 'charity', 'donate',
      'family need', 'sick family', 'hospital bills',
    ],
    description: 'Emotional pleas for help',
  },
  low_credibility: {
    weight: 10,
    patterns: [
      'new account', 'low followers', 'no track record',
      'no history', 'just started', 'new to crypto',
      'beginner', 'no experience',
    ],
    description: 'Low credibility indicators',
  },
};

// ── Platform-specific flags (identical to Python) ──────────────────────────

const PLATFORM_SPECIFIC: Record<string, Record<string, RedFlag>> = {
  instagram: {
    affiliate_marketing: {
      weight: 10,
      patterns: ['affiliate', 'partner', 'referral', 'commission'],
      description: 'Affiliate marketing indicators',
    },
    short_links: {
      weight: 10,
      patterns: ['bit.ly', 'tinyurl.com', 'lnkd.in', 'afb.ink', 'cutt.ly'],
      description: 'Suspicious URL shorteners',
    },
  },
  facebook: {
    russian_scam_indicators: {
      weight: 10,
      patterns: ['trusted.*relationships.*acquisition', 'financial.*success'],
      description: 'Russian scam indicators',
    },
    virtual_companion_fraud: {
      weight: 10,
      patterns: ['messages to community', 'virtual companion'],
      description: 'Virtual companion fraud patterns',
    },
  },
  tiktok: {
    limited_content: {
      weight: 10,
      patterns: ['limited content', 'few videos', 'low video count'],
      description: 'Limited content on profile',
    },
    private_profile: {
      weight: 10,
      patterns: ['private', 'private account', 'hidden'],
      description: 'Private profile hiding information',
    },
  },
  x: {
    low_followers_high_claims: {
      weight: 10,
      patterns: ['low followers', 'few followers'],
      description: 'Low followers with high claims',
    },
  },
};

// ── Risk level thresholds (identical to Python) ────────────────────────────

const RISK_THRESHOLDS = { LOW: 3.0, MEDIUM: 5.0, HIGH: 7.0 };
const VERIFICATION_THRESHOLDS = { LIKELY_SAFE: 0, PATTERN_MATCHES: 2, UNVERIFIED: 4 };

// ── HTML text extraction (strip JS/CSS, keep visible text only) ─────────────

/**
 * Extract visible text from HTML, stripping all script/style tags and HTML markup.
 * This prevents the scoring engine from flagging JavaScript/CSS boilerplate
 * (which contains words like 'free', 'alpha', 'download', 'vip' etc.)
 */
export function extractVisibleText(html: string): string {
  // 1. Remove all <script> blocks (including content)
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  // 2. Remove all <style> blocks (including content)
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  // 3. Remove all <noscript> blocks
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  // 4. Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // 5. Decode common HTML entities
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  // 6. Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

// ── Core scoring function ──────────────────────────────────────────────────

export interface ScoringMetadata {
  followers?: number;
  accountAgeDays?: number;
}

export function calculateRiskScore(
  text: string,
  platform?: string,
  metadata?: ScoringMetadata,
): RiskResult {
  const textLower = text.toLowerCase();
  let totalWeight = 0;
  const detectedFlags: string[] = [];
  const flagDetails: FlagDetail[] = [];

  // Check standard red flags
  for (const [flagName, flagData] of Object.entries(RED_FLAGS)) {
    for (const pattern of flagData.patterns) {
      // Use simple substring for most, regex for .* patterns
      const matches = pattern.includes('.*')
        ? new RegExp(pattern, 'i').test(text)
        : textLower.includes(pattern);

      if (matches) {
        totalWeight += flagData.weight;
        detectedFlags.push(flagName);
        flagDetails.push({
          flag: flagName,
          weight: flagData.weight,
          description: flagData.description,
          patternMatched: pattern,
        });
        break; // only count each flag once
      }
    }
  }

  // Check platform-specific flags
  if (platform && PLATFORM_SPECIFIC[platform]) {
    for (const [flagName, flagData] of Object.entries(PLATFORM_SPECIFIC[platform])) {
      for (const pattern of flagData.patterns) {
        const matches = pattern.includes('.*')
          ? new RegExp(pattern, 'i').test(text)
          : textLower.includes(pattern);

        if (matches) {
          totalWeight += flagData.weight;
          detectedFlags.push(flagName);
          flagDetails.push({
            flag: flagName,
            weight: flagData.weight,
            description: flagData.description,
            patternMatched: pattern,
            platformSpecific: true,
          });
          break;
        }
      }
    }
  }

  // Metadata-based flags
  if (metadata) {
    if ((metadata.followers ?? 0) < 1000 && totalWeight > 20) {
      totalWeight += 10;
      detectedFlags.push('low_followers_high_claims');
      flagDetails.push({
        flag: 'low_followers_high_claims',
        weight: 10,
        description: 'Low followers with high claims',
        patternMatched: 'metadata',
        platformSpecific: true,
      });
    }
    if ((metadata.accountAgeDays ?? 365) < 30) {
      totalWeight += 10;
      detectedFlags.push('new_account');
      flagDetails.push({
        flag: 'new_account',
        weight: 10,
        description: 'New account (less than 30 days)',
        patternMatched: 'metadata',
        platformSpecific: true,
      });
    }
  }

  // Normalize to 0-10 scale (identical to Python)
  const riskScore = Math.min((totalWeight / 90) * 10, 10);
  const riskLevel: RiskLevel =
    riskScore >= RISK_THRESHOLDS.HIGH ? 'CRITICAL' :
    riskScore >= RISK_THRESHOLDS.MEDIUM ? 'HIGH' :
    riskScore >= RISK_THRESHOLDS.LOW ? 'MEDIUM' : 'LOW';

  const flagCount = detectedFlags.length;
  const verificationLevel: VerificationLevel =
    flagCount === 0 ? 'LIKELY SAFE' :
    flagCount <= VERIFICATION_THRESHOLDS.PATTERN_MATCHES ? 'PATTERN MATCHES' :
    flagCount <= VERIFICATION_THRESHOLDS.UNVERIFIED ? 'UNVERIFIED' : 'HIGH RISK';

  return {
    riskScore: Math.round(riskScore * 10) / 10,
    riskLevel,
    verificationLevel,
    redFlagsDetected: flagCount,
    flagDetails,
    weightsSum: totalWeight,
    maxPossibleWeight: 90,
    scanTimestamp: new Date().toISOString(),
  };
}