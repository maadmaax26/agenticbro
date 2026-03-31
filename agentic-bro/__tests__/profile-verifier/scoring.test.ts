/**
 * Tests for AuthenticityCalculator — context-aware scoring weights
 *
 * Validates that:
 * 1. Each context applies the correct weight profile (weights sum to 100)
 * 2. A profile with a bad deepfake score hurts MORE in romance context than crypto
 * 3. A profile with bad activity hurts MORE in marketplace context than crypto
 * 4. A profile with bad verification hurts MORE in financial context than general
 * 5. Scores stay in the 0-100 range under extreme inputs
 */

import { AuthenticityCalculator, VerificationContext } from '../../services/profile-verifier/scoring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a "perfect" category set (full scores) */
const perfectCategories = () => ({
  verification: { score: 30, maxScore: 30, status: 'VERIFIED' as const },
  botDetection: { score: 25, maxScore: 25, status: 'SAFE' as const },
  deepfake: { score: 20, maxScore: 20, status: 'SAFE' as const },
  impersonation: { score: 15, maxScore: 15, status: 'SAFE' as const },
  activity: { score: 10, maxScore: 10, status: 'SAFE' as const },
});

/** Build a "zero" category set (all zeros) */
const zeroCategories = () => ({
  verification: { score: 0, maxScore: 30, status: 'SCAM' as const },
  botDetection: { score: 0, maxScore: 25, status: 'SCAM' as const },
  deepfake: { score: 0, maxScore: 20, status: 'SCAM' as const },
  impersonation: { score: 0, maxScore: 15, status: 'SCAM' as const },
  activity: { score: 0, maxScore: 10, status: 'SCAM' as const },
});

/** Build a category set with ONLY ONE category zeroed out */
const withZeroed = (category: string) => {
  const cats = perfectCategories() as any;
  cats[category].score = 0;
  return cats;
};

const calc = new AuthenticityCalculator();

// ---------------------------------------------------------------------------
// 1. Perfect and zero scores
// ---------------------------------------------------------------------------

describe('AuthenticityCalculator — edge scores', () => {
  const contexts: VerificationContext[] = ['crypto', 'romance', 'employment', 'marketplace', 'financial', 'general'];

  test.each(contexts)('perfect profile scores 100 in %s context', (context) => {
    expect(calc.calculateScore(perfectCategories(), context)).toBe(100);
  });

  test.each(contexts)('all-zero profile scores 0 in %s context', (context) => {
    expect(calc.calculateScore(zeroCategories(), context)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Weight profiles are internally consistent
// ---------------------------------------------------------------------------

describe('AuthenticityCalculator — weight profile consistency', () => {
  const contexts: VerificationContext[] = ['crypto', 'romance', 'employment', 'marketplace', 'financial', 'general'];

  test.each(contexts)('%s weights sum to exactly 100', (context) => {
    const weights = calc.getWeights(context);
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  test('romance weights deepfake higher than crypto', () => {
    expect(calc.getWeights('romance').deepfake).toBeGreaterThan(calc.getWeights('crypto').deepfake);
  });

  test('financial weights verification highest of all contexts', () => {
    const verificationWeights = (['crypto', 'romance', 'employment', 'marketplace', 'general'] as VerificationContext[])
      .map(c => calc.getWeights(c).verification);
    const financialVerification = calc.getWeights('financial').verification;
    verificationWeights.forEach(w => {
      expect(financialVerification).toBeGreaterThanOrEqual(w);
    });
  });

  test('marketplace weights activity higher than crypto', () => {
    expect(calc.getWeights('marketplace').activity).toBeGreaterThan(calc.getWeights('crypto').activity);
  });

  test('employment weights activity higher than crypto', () => {
    expect(calc.getWeights('employment').activity).toBeGreaterThan(calc.getWeights('crypto').activity);
  });

  test('romance weights impersonation higher than crypto', () => {
    expect(calc.getWeights('romance').impersonation).toBeGreaterThan(calc.getWeights('crypto').impersonation);
  });
});

// ---------------------------------------------------------------------------
// 3. Context-specific score sensitivity
// ---------------------------------------------------------------------------

describe('AuthenticityCalculator — context score sensitivity', () => {

  test('zeroing deepfake hurts MORE in romance than in crypto', () => {
    const cats = withZeroed('deepfake');
    const romanceScore = calc.calculateScore(cats, 'romance');
    const cryptoScore = calc.calculateScore(cats, 'crypto');
    // Romance weights deepfake at 35% vs crypto at 20%
    expect(romanceScore).toBeLessThan(cryptoScore);
  });

  test('zeroing verification hurts MORE in financial than in romance', () => {
    const cats = withZeroed('verification');
    const financialScore = calc.calculateScore(cats, 'financial');
    const romanceScore = calc.calculateScore(cats, 'romance');
    // Financial weights verification at 40% vs romance at 10%
    expect(financialScore).toBeLessThan(romanceScore);
  });

  test('zeroing activity hurts MORE in marketplace than in crypto', () => {
    const cats = withZeroed('activity');
    const marketplaceScore = calc.calculateScore(cats, 'marketplace');
    const cryptoScore = calc.calculateScore(cats, 'crypto');
    // Marketplace weights activity at 25% vs crypto at 10%
    expect(marketplaceScore).toBeLessThan(cryptoScore);
  });

  test('zeroing impersonation hurts MORE in romance than in employment', () => {
    const cats = withZeroed('impersonation');
    const romanceScore = calc.calculateScore(cats, 'romance');
    const employmentScore = calc.calculateScore(cats, 'employment');
    // Romance weights impersonation at 30% vs employment at 20%
    expect(romanceScore).toBeLessThan(employmentScore);
  });

  test('crypto context is backward compatible — scores same as original manual sum', () => {
    // Original code just summed scores directly (30+25+20+15+10=100 max)
    // New context-aware code should produce the same result for crypto
    const cats = perfectCategories();
    cats.verification.score = 25; // partial
    cats.botDetection.score = 20;
    cats.deepfake.score = 15;
    cats.impersonation.score = 10;
    cats.activity.score = 7;

    const cryptoScore = calc.calculateScore(cats, 'crypto');
    // Manual: (25/30)*30 + (20/25)*25 + (15/20)*20 + (10/15)*15 + (7/10)*10
    //       = 25 + 20 + 15 + 10 + 7 = 77
    expect(cryptoScore).toBe(77);
  });
});

// ---------------------------------------------------------------------------
// 4. Score breakdown
// ---------------------------------------------------------------------------

describe('AuthenticityCalculator — calculateBreakdown', () => {
  test('breakdown total matches calculateScore', () => {
    const cats = withZeroed('deepfake');
    const score = calc.calculateScore(cats, 'romance');
    const breakdown = calc.calculateBreakdown(cats, 'romance');
    expect(breakdown.total).toBe(score);
  });

  test('breakdown includes context and weightsApplied', () => {
    const breakdown = calc.calculateBreakdown(perfectCategories(), 'employment');
    expect(breakdown.context).toBe('employment');
    expect(breakdown.weightsApplied).toEqual(calc.getWeights('employment'));
  });

  test('breakdown category percents are 0-100', () => {
    const cats = perfectCategories();
    cats.botDetection.score = 12; // partial
    const breakdown = calc.calculateBreakdown(cats, 'crypto');
    for (const cat of Object.values(breakdown.categories)) {
      expect(cat.percent).toBeGreaterThanOrEqual(0);
      expect(cat.percent).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Weakness identification
// ---------------------------------------------------------------------------

describe('AuthenticityCalculator — identifyWeaknesses', () => {
  test('identifies zeroed category as high severity weakness', () => {
    const cats = withZeroed('deepfake');
    const weaknesses = calc.identifyWeaknesses(cats);
    const deepfakeWeakness = weaknesses.find(w => w.category === 'deepfake');
    expect(deepfakeWeakness).toBeDefined();
    expect(deepfakeWeakness!.severity).toBe('high');
  });

  test('returns empty array for perfect profile', () => {
    const weaknesses = calc.identifyWeaknesses(perfectCategories());
    expect(weaknesses).toHaveLength(0);
  });

  test('weaknesses are sorted with worst first', () => {
    const cats = perfectCategories() as any;
    cats.deepfake.score = 0;    // worst
    cats.activity.score = 4;    // medium
    cats.botDetection.score = 10; // mild
    const weaknesses = calc.identifyWeaknesses(cats);
    expect(weaknesses[0].percent).toBeLessThanOrEqual(weaknesses[weaknesses.length - 1].percent);
  });
});

// ---------------------------------------------------------------------------
// 6. Context-appropriate suggestion text
// ---------------------------------------------------------------------------

describe('AuthenticityCalculator — generateSuggestions', () => {
  test('romance deepfake suggestion mentions authentic photo', () => {
    const cats = withZeroed('deepfake');
    const suggestions = calc.generateSuggestions(cats, 'romance');
    expect(suggestions.some(s => s.toLowerCase().includes('authentic'))).toBe(true);
  });

  test('financial verification suggestion mentions credentials', () => {
    const cats = withZeroed('verification');
    const suggestions = calc.generateSuggestions(cats, 'financial');
    expect(suggestions.some(s => s.toLowerCase().includes('credential') || s.toLowerCase().includes('regulat'))).toBe(true);
  });

  test('marketplace activity suggestion mentions building history', () => {
    const cats = withZeroed('activity');
    const suggestions = calc.generateSuggestions(cats, 'marketplace');
    expect(suggestions.some(s => s.toLowerCase().includes('history') || s.toLowerCase().includes('account'))).toBe(true);
  });
});
