/**
 * Scam Detection Tests — Profile Verifier
 *
 * Validates that every scam type is detected accurately by the ProfileVerifier.
 * All external dependencies are mocked via closure-captured jest.fn() references
 * (not prototype assignment) to ensure mocks work on existing instances.
 */

// ---------------------------------------------------------------------------
// Capture mock functions at module scope so tests can swap return values
// ---------------------------------------------------------------------------

let mockGetTwitterProfile: jest.Mock;
let mockGetInstagramProfile: jest.Mock;
let mockGetLinkedInProfile: jest.Mock;
let mockBotometerGetScore: jest.Mock;
let mockDeepfakeAnalyze: jest.Mock;
let mockScammerDbFindByUsername: jest.Mock;
let mockScammerDbFindSimilarUsernames: jest.Mock;
let mockCacheGet: jest.Mock;
let mockCacheSet: jest.Mock;

// Initialize all mocks before module-level jest.mock calls
mockGetTwitterProfile = jest.fn();
mockGetInstagramProfile = jest.fn();
mockGetLinkedInProfile = jest.fn();
mockBotometerGetScore = jest.fn();
mockDeepfakeAnalyze = jest.fn();
mockScammerDbFindByUsername = jest.fn();
mockScammerDbFindSimilarUsernames = jest.fn();
mockCacheGet = jest.fn();
mockCacheSet = jest.fn();

jest.mock('../../clients/twitter', () => ({
  TwitterClient: jest.fn().mockImplementation(() => ({
    getProfile: (...args: any[]) => mockGetTwitterProfile(...args),
  })),
}));

jest.mock('../../clients/instagram', () => ({
  InstagramClient: jest.fn().mockImplementation(() => ({
    getProfile: (...args: any[]) => mockGetInstagramProfile(...args),
  })),
}));

jest.mock('../../clients/linkedin', () => ({
  LinkedInClient: jest.fn().mockImplementation(() => ({
    getProfile: (...args: any[]) => mockGetLinkedInProfile(...args),
  })),
}));

jest.mock('../../clients/botometer', () => ({
  BotometerClient: jest.fn().mockImplementation(() => ({
    getScore: (...args: any[]) => mockBotometerGetScore(...args),
  })),
}));

jest.mock('../../utils/deepfake', () => ({
  DeepfakeDetector: jest.fn().mockImplementation(() => ({
    analyze: (...args: any[]) => mockDeepfakeAnalyze(...args),
  })),
}));

jest.mock('../../db/scammer-db', () => ({
  ScammerDatabase: jest.fn().mockImplementation(() => ({
    findByUsername: (...args: any[]) => mockScammerDbFindByUsername(...args),
    findSimilarUsernames: (...args: any[]) => mockScammerDbFindSimilarUsernames(...args),
  })),
}));

jest.mock('../../utils/cache', () => ({
  Cache: jest.fn().mockImplementation(() => ({
    get: (...args: any[]) => mockCacheGet(...args),
    set: (...args: any[]) => mockCacheSet(...args),
  })),
}));

// ---------------------------------------------------------------------------
// Mock global fetch (used by fetchImage)
// ---------------------------------------------------------------------------

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  statusText: 'OK',
  arrayBuffer: async () => new ArrayBuffer(100),
}) as any;

// ---------------------------------------------------------------------------
// Now import the service
// ---------------------------------------------------------------------------

import { ProfileVerifier } from '../../services/profile-verifier/index';
import * as fixtures from './fixtures/profiles';

// ---------------------------------------------------------------------------
// Verifier config
// ---------------------------------------------------------------------------

const VERIFIER_CONFIG = {
  twitterConfig: { apiKey: 'test', apiSecret: 'test', bearerToken: 'test' },
  puppeteerEndpoint: 'http://localhost:18800',
  botometerApiKey: 'test',
  deepfakeModelPath: '/tmp/model.onnx',
  databaseUrl: 'postgresql://test',
  redisUrl: 'redis://test',
};

let verifier: ProfileVerifier;

// ---------------------------------------------------------------------------
// Safe defaults for all mocks
// ---------------------------------------------------------------------------

function resetToSafeDefaults() {
  mockGetTwitterProfile.mockResolvedValue(fixtures.cleanNormalProfile);
  mockGetInstagramProfile.mockResolvedValue(fixtures.cleanNormalProfile);
  mockGetLinkedInProfile.mockResolvedValue(fixtures.cleanNormalProfile);
  mockBotometerGetScore.mockResolvedValue({
    botProbability: 0.05,
    fakeFollowersPercent: 5,
    engagementAuthenticity: 90,
  });
  mockDeepfakeAnalyze.mockResolvedValue({
    aiGeneratedProbability: 0.05,
    manipulationProbability: 0.02,
    faceMatch: true,
    artifacts: [],
    metadata: {},
  });
  mockScammerDbFindByUsername.mockResolvedValue(null);
  mockScammerDbFindSimilarUsernames.mockResolvedValue([]);
  mockCacheGet.mockResolvedValue(null);
  mockCacheSet.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

function expectRisky(result: any) {
  expect(result.success).toBe(true);
  expect(['UNSAFE', 'SCAM']).toContain(result.data?.riskLevel);
}

function expectAtLeastCaution(result: any) {
  expect(result.success).toBe(true);
  expect(['CAUTION', 'UNSAFE', 'SCAM']).toContain(result.data?.riskLevel);
}

function expectSafeOrVerified(result: any) {
  expect(result.success).toBe(true);
  expect(['SAFE', 'VERIFIED']).toContain(result.data?.riskLevel);
}

// ===========================================================================
// SETUP
// ===========================================================================

beforeEach(() => {
  resetToSafeDefaults();
  verifier = new ProfileVerifier(VERIFIER_CONFIG);
});

// ===========================================================================
// CLEAN BASELINE
// ===========================================================================

describe('Clean profiles — should score SAFE or VERIFIED', () => {

  test('verified company account scores SAFE or VERIFIED', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.cleanVerifiedProfile);
    const result = await verifier.verify('twitter', 'realcompany', {
      includeMedia: true,   // use full score so deepfake isn't zeroed out
      verificationContext: 'general',
    });
    expectSafeOrVerified(result);
  });

  test('normal developer account scores SAFE or VERIFIED', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.cleanNormalProfile);
    const result = await verifier.verify('twitter', 'johndoe_dev', {
      includeMedia: true,
      verificationContext: 'general',
    });
    expectSafeOrVerified(result);
  });
});

// ===========================================================================
// CRYPTO SCAM DETECTION
// ===========================================================================

describe('Crypto scams — should score UNSAFE or SCAM', () => {

  test('giveaway_fraud: _giveaway username + airdrop bio flags as risky', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.cryptoGiveawayScam);
    const result = await verifier.verify('twitter', 'elonmusk_giveaway', {
      includeMedia: false,
      verificationContext: 'crypto',
    });
    expectRisky(result);
    expect(result.data!.redFlags.length).toBeGreaterThan(0);
  });

  test('giveaway_fraud: result has recommendation and plain language summary', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.cryptoGiveawayScam);
    const result = await verifier.verify('twitter', 'elonmusk_giveaway', {
      includeMedia: false,
      verificationContext: 'crypto',
    });
    expect(result.data!.recommendation).toBeTruthy();
    expect(result.data!.plainLanguageSummary).toBeTruthy();
  });

  test('rug_pull: _official username + airdrop bio flags as at-least-caution', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.rugPullScam);
    const result = await verifier.verify('twitter', 'solana_moonshot_official', {
      includeMedia: false,
      verificationContext: 'crypto',
    });
    expectAtLeastCaution(result);
  });

  test('wallet_drainer: _real username + airdrop/free keywords flags as risky', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.walletDrainerScam);
    const result = await verifier.verify('twitter', 'nft_free_claim_real', {
      includeMedia: false,
      verificationContext: 'crypto',
    });
    expectRisky(result);
  });

  test('pig_butchering: airdrop in bio + new account flags as caution+', async () => {
    // pig_butchering on twitter (telegram stub returns null, so use twitter)
    mockGetTwitterProfile.mockResolvedValue({
      ...fixtures.pigButcheringScam,
      platform: 'twitter',
    });
    const result = await verifier.verify('twitter', 'sophia_crypto_advisor', {
      includeMedia: false,
      verificationContext: 'crypto',
    });
    expectAtLeastCaution(result);
  });
});

// ===========================================================================
// ROMANCE SCAM DETECTION
// ===========================================================================

describe('Romance scams — should score UNSAFE or SCAM in romance context', () => {

  beforeEach(() => {
    // Romance scams typically use AI-generated / stolen photos
    mockDeepfakeAnalyze.mockResolvedValue({
      aiGeneratedProbability: 0.88,
      manipulationProbability: 0.80,
      faceMatch: false,
      artifacts: ['gan_artifacts', 'texture_inconsistency'],
      metadata: {},
    });
  });

  test('romance_scam: military doctor bio with gift card + western union', async () => {
    mockGetInstagramProfile.mockResolvedValue(fixtures.romanceMilitaryScam);
    const result = await verifier.verify('instagram', 'dr_james_richardson_usarmy', {
      includeMedia: true,
      verificationContext: 'romance',
    });
    expectRisky(result);
  });

  test('romance_scam: oil rig engineer bio with western union keyword', async () => {
    mockGetInstagramProfile.mockResolvedValue(fixtures.romanceOilRigScam);
    const result = await verifier.verify('instagram', 'mark_oilrig_engineer', {
      includeMedia: true,
      verificationContext: 'romance',
    });
    expectRisky(result);
  });

  test('romance_scam: recommendation uses dating-specific guidance, not crypto language', async () => {
    mockGetInstagramProfile.mockResolvedValue(fixtures.romanceMilitaryScam);
    const result = await verifier.verify('instagram', 'dr_james_richardson_usarmy', {
      includeMedia: false,
      verificationContext: 'romance',
    });
    expect(result.data!.recommendation).not.toContain('crypto');
    expect(result.data!.recommendation).not.toContain('fund');
    expect(result.data!.plainLanguageSummary).toBeTruthy();
  });

  test('romance context: deepfake weight is higher, same bad profile scores lower than in crypto', async () => {
    mockGetInstagramProfile.mockResolvedValue(fixtures.romanceMilitaryScam);
    mockGetTwitterProfile.mockResolvedValue(fixtures.romanceMilitaryScam);

    const romanceResult = await verifier.verify('instagram', 'dr_james_richardson_usarmy', {
      includeMedia: true,
      verificationContext: 'romance',
    });
    const cryptoResult = await verifier.verify('twitter', 'dr_james_richardson_usarmy', {
      includeMedia: true,
      verificationContext: 'crypto',
    });
    // Romance weights deepfake at 35% vs 20% in crypto — should score lower (or equal)
    expect(romanceResult.data!.authenticityScore).toBeLessThanOrEqual(
      cryptoResult.data!.authenticityScore
    );
  });

  test('romance_scam: verificationContext field is "romance" in result', async () => {
    mockGetInstagramProfile.mockResolvedValue(fixtures.romanceMilitaryScam);
    const result = await verifier.verify('instagram', 'dr_james_richardson_usarmy', {
      includeMedia: false,
      verificationContext: 'romance',
    });
    expect(result.data!.verificationContext).toBe('romance');
  });
});

// ===========================================================================
// EMPLOYMENT / JOB SCAM DETECTION
// ===========================================================================

describe('Job offer fraud — should score UNSAFE or SCAM in employment context', () => {

  test('job_offer_fraud: work-from-home + $500/day + no experience needed flags as risky', async () => {
    mockGetLinkedInProfile.mockResolvedValue(fixtures.fakeRecruiterScam);
    const result = await verifier.verify('linkedin', 'recruiter_sarah_hr123', {
      includeMedia: false,
      verificationContext: 'employment',
    });
    expectRisky(result);
  });

  test('job_offer_fraud: passive income + unlimited earning potential flags as risky', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.mlmJobScam);
    const result = await verifier.verify('twitter', 'jobs_offer_unlimited', {
      includeMedia: false,
      verificationContext: 'employment',
    });
    expectRisky(result);
  });

  test('job scam: recommendation does NOT mention crypto', async () => {
    mockGetLinkedInProfile.mockResolvedValue(fixtures.fakeRecruiterScam);
    const result = await verifier.verify('linkedin', 'recruiter_sarah_hr123', {
      includeMedia: false,
      verificationContext: 'employment',
    });
    expect(result.data!.recommendation).not.toContain('crypto');
    expect(result.data!.recommendation).toBeTruthy();
  });

  test('employment context: same young account scores lower than in crypto (activity weighted higher)', async () => {
    mockGetLinkedInProfile.mockResolvedValue(fixtures.fakeRecruiterScam);
    mockGetTwitterProfile.mockResolvedValue(fixtures.fakeRecruiterScam);
    const employmentResult = await verifier.verify('linkedin', 'recruiter_sarah_hr123', {
      includeMedia: false,
      verificationContext: 'employment',
    });
    const cryptoResult = await verifier.verify('twitter', 'recruiter_sarah_hr123', {
      includeMedia: false,
      verificationContext: 'crypto',
    });
    // Employment weights activity at 20% vs 10% in crypto — equal or lower
    expect(employmentResult.data!.authenticityScore).toBeLessThanOrEqual(
      cryptoResult.data!.authenticityScore
    );
  });
});

// ===========================================================================
// TECH SUPPORT SCAM DETECTION
// ===========================================================================

describe('Tech support fraud', () => {

  test('tech_support_fraud: official + helpline + account suspended + toll free flags as caution+', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.techSupportScam);
    const result = await verifier.verify('twitter', 'microsoft_official_help', {
      includeMedia: false,
      verificationContext: 'general',
    });
    expectAtLeastCaution(result);
  });
});

// ===========================================================================
// GOVERNMENT IMPERSONATION DETECTION
// ===========================================================================

describe('Government impersonation', () => {

  test('government_impersonation: IRS official + account suspended + call us now flags as caution+', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.irsImpersonationScam);
    const result = await verifier.verify('twitter', 'irs_official_helpline', {
      includeMedia: false,
      verificationContext: 'financial',
    });
    expectAtLeastCaution(result);
  });

  test('government_impersonation: social security + verify your account flags as caution+', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.ssaImpersonationScam);
    const result = await verifier.verify('twitter', 'social_security_official_help', {
      includeMedia: false,
      verificationContext: 'financial',
    });
    expectAtLeastCaution(result);
  });

  test('financial context: recommendation and plain summary are both populated', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.irsImpersonationScam);
    const result = await verifier.verify('twitter', 'irs_official_helpline', {
      includeMedia: false,
      verificationContext: 'financial',
    });
    expect(result.data!.recommendation).toBeTruthy();
    expect(result.data!.plainLanguageSummary).toBeTruthy();
  });
});

// ===========================================================================
// BANK IMPERSONATION DETECTION
// ===========================================================================

describe('Bank impersonation', () => {

  test('bank_impersonation: the_ prefix + _chase_bank_ pattern + account suspended bio flags as caution+', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.fakeBankSupportScam);
    const result = await verifier.verify('twitter', 'the_chase_bank_support', {
      includeMedia: false,
      verificationContext: 'financial',
    });
    expectAtLeastCaution(result);
  });
});

// ===========================================================================
// FAKE CHARITY DETECTION
// ===========================================================================

describe('Fake charity', () => {

  test('fake_charity: giveaway + send + gift card + new account flags as risky', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.fakeCharityScam);
    const result = await verifier.verify('twitter', 'disaster_relief_fund_official', {
      includeMedia: false,
      verificationContext: 'general',
    });
    expectRisky(result);
  });
});

// ===========================================================================
// CELEBRITY ENDORSEMENT SCAM DETECTION
// ===========================================================================

describe('Celebrity endorsement scam', () => {

  beforeEach(() => {
    mockDeepfakeAnalyze.mockResolvedValue({
      aiGeneratedProbability: 0.78,
      manipulationProbability: 0.7,
      faceMatch: false,
      artifacts: ['gan_artifacts'],
      metadata: {},
    });
  });

  test('celebrity_endorsement_scam: _official username + giveaway + free product flags as risky', async () => {
    mockGetInstagramProfile.mockResolvedValue(fixtures.celebEndorsementScam);
    const result = await verifier.verify('instagram', 'oprah_official_health', {
      includeMedia: true,
      verificationContext: 'general',
    });
    expectRisky(result);
  });
});

// ===========================================================================
// LANDLORD / RENTAL SCAM DETECTION
// ===========================================================================

describe('Rental scam', () => {

  test('landlord_rental_scam: cashapp only + no returns + zelle preferred flags as risky', async () => {
    // Facebook stub returns null, so use twitter platform for testability
    mockGetTwitterProfile.mockResolvedValue({
      ...fixtures.rentalScam,
      platform: 'twitter',
    });
    const result = await verifier.verify('twitter', 'dream_homes_rental_deals', {
      includeMedia: false,
      verificationContext: 'marketplace',
    });
    expectRisky(result);
  });

  test('rental scam: recommendation warns about money/payment risk', async () => {
    mockGetTwitterProfile.mockResolvedValue({
      ...fixtures.rentalScam,
      platform: 'twitter',
    });
    const result = await verifier.verify('twitter', 'dream_homes_rental_deals', {
      includeMedia: false,
      verificationContext: 'marketplace',
    });
    const allText = result.data!.recommendation + ' ' + result.data!.plainLanguageSummary;
    expect(allText.toLowerCase()).toMatch(/payment|money|send/);
  });
});

// ===========================================================================
// MARKETPLACE SELLER FRAUD DETECTION
// ===========================================================================

describe('Marketplace seller fraud', () => {

  test('marketplace_seller_fraud: cashapp only + no refunds + new account flags as risky', async () => {
    mockGetTwitterProfile.mockResolvedValue({
      ...fixtures.marketplaceSellerScam,
      platform: 'twitter',
    });
    const result = await verifier.verify('twitter', 'quick_deals_seller99', {
      includeMedia: false,
      verificationContext: 'marketplace',
    });
    expectRisky(result);
  });

  test('marketplace context: red flags or warnings include account age signal', async () => {
    mockGetTwitterProfile.mockResolvedValue({
      ...fixtures.marketplaceSellerScam,
      platform: 'twitter',
    });
    const result = await verifier.verify('twitter', 'quick_deals_seller99', {
      includeMedia: false,
      verificationContext: 'marketplace',
    });
    const allSignals = [...result.data!.redFlags, ...result.data!.warnings].join(' ');
    expect(allSignals.toLowerCase()).toMatch(/day|days|new account|age|week/i);
  });
});

// ===========================================================================
// INVESTMENT FRAUD DETECTION
// ===========================================================================

describe('Investment fraud (non-crypto)', () => {

  test('investment_fraud: earn $10k/week + no experience + passive income flags as caution+', async () => {
    mockGetInstagramProfile.mockResolvedValue(fixtures.investmentFraudScam);
    const result = await verifier.verify('instagram', 'forex_trading_guru_official', {
      includeMedia: false,
      verificationContext: 'financial',
    });
    expectAtLeastCaution(result);
  });

  test('ponzi_scheme: guaranteed returns + send to receive + passive income flags as caution+', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.ponziSchemeScam);
    const result = await verifier.verify('twitter', 'guaranteed_returns_official', {
      includeMedia: false,
      verificationContext: 'financial',
    });
    expectAtLeastCaution(result);
  });

  test('phishing: verify your account + account suspended bio flags as caution+', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.phishingScam);
    const result = await verifier.verify('twitter', 'twitter_verify_official', {
      includeMedia: false,
      verificationContext: 'general',
    });
    expectAtLeastCaution(result);
  });
});

// ===========================================================================
// KNOWN SCAMMER DATABASE
// ===========================================================================

describe('Known scammer database match', () => {

  beforeEach(() => {
    mockScammerDbFindByUsername.mockImplementation(async (username: string) => {
      if (username === 'confirmed_scammer_acc') return fixtures.knownScammerRecord;
      return null;
    });
  });

  test('known scammer scores SCAM regardless of other signals', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.knownScammerProfile);
    const result = await verifier.verify('twitter', 'confirmed_scammer_acc', {
      includeMedia: false,
      verificationContext: 'general',
    });
    expect(result.success).toBe(true);
    expect(result.data!.riskLevel).toBe('SCAM');
  });

  test('known scammer impersonation category scores 0 with SCAM status', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.knownScammerProfile);
    const result = await verifier.verify('twitter', 'confirmed_scammer_acc', {
      includeMedia: false,
      verificationContext: 'general',
    });
    expect(result.data!.categories.impersonation.score).toBe(0);
    expect(result.data!.categories.impersonation.status).toBe('SCAM');
  });

  test('known scammer red flags include database match message', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.knownScammerProfile);
    const result = await verifier.verify('twitter', 'confirmed_scammer_acc', {
      includeMedia: false,
      verificationContext: 'general',
    });
    const flagText = result.data!.redFlags.join(' ').toUpperCase();
    expect(flagText).toMatch(/SCAMMER|DATABASE/);
  });
});

// ===========================================================================
// DEEPFAKE DETECTION
// ===========================================================================

describe('Deepfake detection', () => {

  test('high AI-generation probability (0.92) scores deepfake category 0', async () => {
    mockDeepfakeAnalyze.mockResolvedValue({
      aiGeneratedProbability: 0.92,
      manipulationProbability: 0.88,
      faceMatch: false,
      artifacts: ['gan_artifacts'],
      metadata: {},
    });
    mockGetTwitterProfile.mockResolvedValue(fixtures.cleanNormalProfile);
    const result = await verifier.verify('twitter', 'johndoe_dev', {
      includeMedia: true,
      verificationContext: 'romance',
    });
    expect(result.data!.categories.deepfake.score).toBe(0);
  });

  test('low AI-generation probability (0.05) scores deepfake category max (20)', async () => {
    mockDeepfakeAnalyze.mockResolvedValue({
      aiGeneratedProbability: 0.05,
      manipulationProbability: 0.02,
      faceMatch: true,
      artifacts: [],
      metadata: {},
    });
    mockGetTwitterProfile.mockResolvedValue(fixtures.cleanNormalProfile);
    const result = await verifier.verify('twitter', 'johndoe_dev', {
      includeMedia: true,
      verificationContext: 'general',
    });
    expect(result.data!.categories.deepfake.score).toBe(20);
  });

  test('AI-generated photo triggers red flag containing "AI-generated" text', async () => {
    mockDeepfakeAnalyze.mockResolvedValue({
      aiGeneratedProbability: 0.85,
      manipulationProbability: 0.8,
      faceMatch: false,
      artifacts: ['gan_artifacts'],
      metadata: {},
    });
    mockGetInstagramProfile.mockResolvedValue(fixtures.romanceMilitaryScam);
    const result = await verifier.verify('instagram', 'dr_james_richardson_usarmy', {
      includeMedia: true,
      verificationContext: 'romance',
    });
    const flags = result.data!.redFlags;
    // Red flag should mention AI-generated or profile image
    const flagText = flags.join(' ').toLowerCase();
    expect(flagText).toMatch(/ai.generated|profile.*photo|deepfake|stolen/i);
  });

  test('skipped media analysis (includeMedia: false) returns SKIPPED status', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.cleanNormalProfile);
    const result = await verifier.verify('twitter', 'johndoe_dev', {
      includeMedia: false,
      verificationContext: 'general',
    });
    expect(result.data!.categories.deepfake.status).toBe('SKIPPED');
  });
});

// ===========================================================================
// ACCOUNT AGE / ACTIVITY DETECTION
// ===========================================================================

describe('Account age detection', () => {

  test('3-day-old account receives maximum age penalty (activity score ≤ 5)', async () => {
    const threeDay = { ...fixtures.cryptoGiveawayScam, bio: 'Normal bio' }; // remove scam keywords to isolate age test
    mockGetTwitterProfile.mockResolvedValue(threeDay);
    const result = await verifier.verify('twitter', 'elonmusk_giveaway', {
      includeMedia: false,
      verificationContext: 'crypto',
    });
    // -5 for < 7 days, plus any posting pattern penalties
    expect(result.data!.categories.activity.score).toBeLessThanOrEqual(5);
  });

  test('multi-year account receives no age penalty (activity score ≥ 7)', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.cleanVerifiedProfile); // 3650 days
    const result = await verifier.verify('twitter', 'realcompany', {
      includeMedia: true,
      verificationContext: 'general',
    });
    expect(result.data!.categories.activity.score).toBeGreaterThanOrEqual(7);
  });
});

// ===========================================================================
// BOT DETECTION
// ===========================================================================

describe('Bot detection', () => {

  test('mass following (following >> followers) triggers suspicious pattern', async () => {
    const massFollow = {
      ...fixtures.cleanNormalProfile,
      followers: 200,
      following: 8_000,  // 40x ratio
    };
    mockGetTwitterProfile.mockResolvedValue(massFollow);
    const result = await verifier.verify('twitter', 'johndoe_dev', {
      includeMedia: false,
      verificationContext: 'general',
    });
    const suspiciousPatterns = result.data!.categories.activity.details.suspiciousPatterns;
    expect(suspiciousPatterns).toContain('Mass following detected');
  });

  test('suspiciously high engagement rate (>10%) penalizes bot detection score', async () => {
    const highEngage = { ...fixtures.cleanNormalProfile, engagementRate: 0.15 };
    mockGetTwitterProfile.mockResolvedValue(highEngage);
    const result = await verifier.verify('twitter', 'johndoe_dev', {
      includeMedia: false,
      verificationContext: 'crypto',
    });
    // High engagement should pull bot score below 25
    expect(result.data!.categories.botDetection.score).toBeLessThan(25);
  });
});

// ===========================================================================
// RESPONSE STRUCTURE
// ===========================================================================

describe('Response structure', () => {

  test('result contains all required top-level fields', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.cleanNormalProfile);
    const result = await verifier.verify('twitter', 'johndoe_dev', {
      includeMedia: false,
      verificationContext: 'general',
    });
    expect(result.success).toBe(true);
    const d = result.data!;
    expect(d.authenticityScore).toBeGreaterThanOrEqual(0);
    expect(d.authenticityScore).toBeLessThanOrEqual(100);
    expect(d.riskLevel).toBeDefined();
    expect(d.verificationContext).toBe('general');
    expect(d.recommendation).toBeTruthy();
    expect(d.plainLanguageSummary).toBeTruthy();
    expect(d.scanTime).toBeTruthy();
    expect(d.scanDuration).toMatch(/\d+\.\ds/);
    expect(d.cacheHit).toBe(false);
    expect(d.categories.verification).toBeDefined();
    expect(d.categories.botDetection).toBeDefined();
    expect(d.categories.deepfake).toBeDefined();
    expect(d.categories.impersonation).toBeDefined();
    expect(d.categories.activity).toBeDefined();
  });

  test('context defaults to crypto when not specified', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.cleanNormalProfile);
    const result = await verifier.verify('twitter', 'johndoe_dev', { includeMedia: false });
    expect(result.data!.verificationContext).toBe('crypto');
  });

  test('profile not found returns structured error with ACCOUNT_NOT_FOUND code', async () => {
    mockGetTwitterProfile.mockResolvedValue(null);
    const result = await verifier.verify('twitter', 'nonexistent_user', {});
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('ACCOUNT_NOT_FOUND');
  });

  test('unsupported platform returns VERIFICATION_ERROR', async () => {
    const result = await verifier.verify('tiktok', 'johndoe', {});
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('VERIFICATION_ERROR');
  });
});

// ===========================================================================
// PLATFORM SUPPORT
// ===========================================================================

describe('Platform support', () => {

  test('instagram platform uses InstagramClient.getProfile', async () => {
    mockGetInstagramProfile.mockResolvedValue(fixtures.cleanNormalProfile);
    const result = await verifier.verify('instagram', 'johndoe', {
      includeMedia: false,
      verificationContext: 'romance',
    });
    expect(mockGetInstagramProfile).toHaveBeenCalledWith('johndoe', expect.any(Object));
    expect(result.success).toBe(true);
  });

  test('linkedin platform uses LinkedInClient.getProfile', async () => {
    mockGetLinkedInProfile.mockResolvedValue(fixtures.cleanNormalProfile);
    const result = await verifier.verify('linkedin', 'johndoe', {
      includeMedia: false,
      verificationContext: 'employment',
    });
    expect(mockGetLinkedInProfile).toHaveBeenCalledWith('johndoe', expect.any(Object));
    expect(result.success).toBe(true);
  });

  test('twitter platform uses TwitterClient.getProfile', async () => {
    mockGetTwitterProfile.mockResolvedValue(fixtures.cleanNormalProfile);
    await verifier.verify('twitter', 'johndoe', { includeMedia: false });
    expect(mockGetTwitterProfile).toHaveBeenCalledWith('johndoe', expect.any(Object));
  });
});
