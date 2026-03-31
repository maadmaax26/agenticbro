/**
 * Authenticity Score Calculator
 *
 * Calculates the overall authenticity score for a profile
 * based on weighted category scores. Weights are context-aware:
 * the same five signals matter differently depending on whether
 * you're vetting a crypto project, a dating match, a job recruiter,
 * a marketplace seller, or a financial advisor.
 */

export type VerificationContext =
  | 'crypto'        // Crypto/DeFi: is this the real project lead or a rug-pull?
  | 'romance'       // Dating apps: is this person who they claim to be?
  | 'employment'    // Job/recruiter vetting: is this offer legitimate?
  | 'marketplace'   // Online seller/buyer: is this transaction safe?
  | 'financial'     // Financial advisor/investment: is this person credentialed?
  | 'general';      // No specific context: balanced defaults

interface WeightProfile {
  verification: number;   // 0-100, how much platform verification matters
  botDetection: number;   // 0-100, how much fake-follower signals matter
  deepfake: number;       // 0-100, how much image authenticity matters
  impersonation: number;  // 0-100, how much identity deception matters
  activity: number;       // 0-100, how much account age/patterns matter
  // Must sum to 100
}

/**
 * Context-specific weight profiles.
 * All weights sum to 100 within each profile.
 */
const CONTEXT_WEIGHTS: Record<VerificationContext, WeightProfile> = {
  crypto: {
    // Platform verification is the highest signal (is this the real dev/KOL?)
    // Bot detection is critical (fake pump-and-dump communities)
    verification: 30,
    botDetection: 25,
    deepfake: 20,
    impersonation: 15,
    activity: 10,
  },
  romance: {
    // Deepfake/stolen photos are the #1 signal for romance scams
    // Impersonation (fake military, fake doctors) is second
    // Platform verification matters less (scammers rarely use verified accounts)
    verification: 10,
    botDetection: 15,
    deepfake: 35,
    impersonation: 30,
    activity: 10,
  },
  employment: {
    // Platform verification matters (is this a real recruiter at a real company?)
    // Activity/account age is critical (fake jobs spike around layoffs, using new accounts)
    // Bot signals are lower priority
    verification: 30,
    botDetection: 15,
    deepfake: 15,
    impersonation: 20,
    activity: 20,
  },
  marketplace: {
    // Account age and history are the top signals (new accounts = higher risk)
    // Impersonation of known sellers/brands is common
    // Deepfake/bot signals matter less in marketplace context
    verification: 20,
    botDetection: 15,
    deepfake: 10,
    impersonation: 30,
    activity: 25,
  },
  financial: {
    // Verification dominates: regulatory credentials, firm affiliation
    // Impersonation of real advisors/firms is the primary threat
    // Activity and bots matter less
    verification: 40,
    botDetection: 10,
    deepfake: 10,
    impersonation: 35,
    activity: 5,
  },
  general: {
    // Balanced defaults for unknown or mixed-use cases
    verification: 25,
    botDetection: 20,
    deepfake: 20,
    impersonation: 20,
    activity: 15,
  },
};

export class AuthenticityCalculator {
  /**
   * Calculate total authenticity score (0-100).
   *
   * Each category is first normalized to a 0-100 percentage,
   * then multiplied by the context-specific weight. This allows
   * the category maxScores to differ (30/25/20/15/10) while still
   * applying context weights correctly.
   */
  calculateScore(categories: CategoryScores, context: VerificationContext = 'crypto'): number {
    const weights = CONTEXT_WEIGHTS[context];

    // Normalize each raw category score to 0-100
    const vNorm = (categories.verification.score / categories.verification.maxScore) * 100;
    const bNorm = (categories.botDetection.score / categories.botDetection.maxScore) * 100;
    const dNorm = (categories.deepfake.score / categories.deepfake.maxScore) * 100;
    const iNorm = (categories.impersonation.score / categories.impersonation.maxScore) * 100;
    const aNorm = (categories.activity.score / categories.activity.maxScore) * 100;

    // Apply context weights (sum of weights = 100, so dividing by 100 yields 0-100 total)
    const total =
      (vNorm * weights.verification / 100) +
      (bNorm * weights.botDetection / 100) +
      (dNorm * weights.deepfake / 100) +
      (iNorm * weights.impersonation / 100) +
      (aNorm * weights.activity / 100);

    return Math.min(Math.max(Math.round(total), 0), 100);
  }

  /**
   * Get the weight profile for a given context
   */
  getWeights(context: VerificationContext = 'crypto'): WeightProfile {
    return { ...CONTEXT_WEIGHTS[context] };
  }

  /**
   * Calculate score breakdown for display, including context weights
   */
  calculateBreakdown(categories: CategoryScores, context: VerificationContext = 'crypto'): ScoreBreakdown {
    const weights = CONTEXT_WEIGHTS[context];

    const vNorm = (categories.verification.score / categories.verification.maxScore) * 100;
    const bNorm = (categories.botDetection.score / categories.botDetection.maxScore) * 100;
    const dNorm = (categories.deepfake.score / categories.deepfake.maxScore) * 100;
    const iNorm = (categories.impersonation.score / categories.impersonation.maxScore) * 100;
    const aNorm = (categories.activity.score / categories.activity.maxScore) * 100;

    return {
      total: this.calculateScore(categories, context),
      context,
      weightsApplied: weights,
      categories: {
        verification: {
          score: categories.verification.score,
          maxScore: categories.verification.maxScore,
          percent: Math.round(vNorm),
          weight: weights.verification,
          status: categories.verification.status,
        },
        botDetection: {
          score: categories.botDetection.score,
          maxScore: categories.botDetection.maxScore,
          percent: Math.round(bNorm),
          weight: weights.botDetection,
          status: categories.botDetection.status,
        },
        deepfake: {
          score: categories.deepfake.score,
          maxScore: categories.deepfake.maxScore,
          percent: Math.round(dNorm),
          weight: weights.deepfake,
          status: categories.deepfake.status,
        },
        impersonation: {
          score: categories.impersonation.score,
          maxScore: categories.impersonation.maxScore,
          percent: Math.round(iNorm),
          weight: weights.impersonation,
          status: categories.impersonation.status,
        },
        activity: {
          score: categories.activity.score,
          maxScore: categories.activity.maxScore,
          percent: Math.round(aNorm),
          weight: weights.activity,
          status: categories.activity.status,
        },
      },
    };
  }

  /**
   * Determine which categories are dragging down the score
   */
  identifyWeaknesses(categories: CategoryScores): CategoryWeakness[] {
    const weaknesses: CategoryWeakness[] = [];

    for (const [name, category] of Object.entries(categories)) {
      const percent = category.score / category.maxScore;
      if (percent < 0.5) {
        weaknesses.push({
          category: name,
          severity: percent < 0.25 ? 'high' : 'medium',
          score: category.score,
          maxScore: category.maxScore,
          percent: percent * 100,
        });
      }
    }

    return weaknesses.sort((a, b) => a.percent - b.percent);
  }

  /**
   * Generate context-appropriate improvement suggestions
   */
  generateSuggestions(categories: CategoryScores, context: VerificationContext = 'crypto'): string[] {
    const suggestions: string[] = [];
    const weaknesses = this.identifyWeaknesses(categories);

    for (const weakness of weaknesses) {
      switch (weakness.category) {
        case 'verification':
          if (context === 'employment') {
            suggestions.push('Verify your professional credentials on the platform and link to your company profile');
          } else if (context === 'financial') {
            suggestions.push('Add regulatory credentials (CFA, CFP, RIA license number) to your profile and get platform verified');
          } else {
            suggestions.push('Get verified on the platform to increase authenticity');
          }
          break;
        case 'botDetection':
          suggestions.push('Remove suspicious followers and improve engagement quality');
          break;
        case 'deepfake':
          if (context === 'romance') {
            suggestions.push('Use an authentic profile photo — avoid stock images or AI-generated pictures that may trigger fraud detection');
          } else {
            suggestions.push('Use an authentic profile photo instead of AI-generated images');
          }
          break;
        case 'impersonation':
          if (context === 'romance') {
            suggestions.push('Ensure your username and display name do not resemble known romance scam personas');
          } else {
            suggestions.push('Change username to avoid impersonation patterns');
          }
          break;
        case 'activity':
          if (context === 'marketplace') {
            suggestions.push('Build account history over time with consistent, legitimate activity before selling high-value items');
          } else {
            suggestions.push('Maintain consistent posting activity over time');
          }
          break;
      }
    }

    return suggestions;
  }
}

// Type definitions

interface CategoryScores {
  verification: { score: number; maxScore: number; status: string };
  botDetection: { score: number; maxScore: number; status: string };
  deepfake: { score: number; maxScore: number; status: string };
  impersonation: { score: number; maxScore: number; status: string };
  activity: { score: number; maxScore: number; status: string };
}

interface ScoreBreakdown {
  total: number;
  context: VerificationContext;
  weightsApplied: WeightProfile;
  categories: {
    [key: string]: {
      score: number;
      maxScore: number;
      percent: number;
      weight: number;
      status: string;
    };
  };
}

interface CategoryWeakness {
  category: string;
  severity: 'low' | 'medium' | 'high';
  score: number;
  maxScore: number;
  percent: number;
}

export default AuthenticityCalculator;
