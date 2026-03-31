/**
 * Test Fixture Profiles
 *
 * Realistic mock profile data for every scam type and context.
 * Each fixture includes the real-world signals that a genuine scam account
 * would exhibit, so we can verify the detection logic fires correctly.
 *
 * Scam types covered:
 *  CRYPTO:    giveaway_fraud, rug_pull, wallet_drainer, pig_butchering
 *  GENERAL:   investment_fraud, ponzi_scheme, phishing, impersonation
 *  ROMANCE:   romance_scam
 *  EMPLOYMENT: job_offer_fraud
 *  TECH:      tech_support_fraud
 *  AUTHORITY: government_impersonation, bank_impersonation
 *  CHARITY:   fake_charity
 *  CELEBRITY: celebrity_endorsement_scam
 *  RENTAL:    landlord_rental_scam
 *  MARKET:    marketplace_seller_fraud
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Helper — build an ISO date string N days ago */
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

// ---------------------------------------------------------------------------
// CANONICAL CLEAN PROFILES — should score SAFE or VERIFIED
// ---------------------------------------------------------------------------

export const cleanVerifiedProfile = {
  platform: 'twitter',
  username: 'realcompany',
  displayName: 'RealCompany Inc.',
  verified: true,
  verifiedType: 'blue',
  followers: 250_000,
  following: 800,
  tweets: 12_000,
  accountAgeDays: 3650,
  createdAt: daysAgo(3650),
  profileImage: 'https://pbs.twimg.com/profile_images/real.jpg',
  bio: 'Official account of RealCompany. Building the future of software.',
  location: 'San Francisco, CA',
  website: 'https://realcompany.com',
  engagementRate: 0.025,
  postingFrequency: 'consistent',
  growthPattern: 'organic',
  lastActive: daysAgo(1),
};

export const cleanNormalProfile = {
  platform: 'twitter',
  username: 'johndoe_dev',
  displayName: 'John Doe',
  verified: false,
  followers: 11_000,   // >10k so verification scores 15/30 instead of 5/30
  following: 800,
  tweets: 3_400,
  accountAgeDays: 730,
  createdAt: daysAgo(730),
  profileImage: 'https://pbs.twimg.com/profile_images/johndoe.jpg',
  bio: 'Software engineer. I build things. Opinions my own.',
  location: 'Austin, TX',
  website: 'https://johndoe.dev',
  engagementRate: 0.025,
  postingFrequency: 'consistent',
  growthPattern: 'organic',
  lastActive: daysAgo(2),
};

// ---------------------------------------------------------------------------
// CRYPTO SCAM PROFILES
// ---------------------------------------------------------------------------

/** giveaway_fraud — classic "send X get 2X back" impersonation */
export const cryptoGiveawayScam = {
  platform: 'twitter',
  username: 'elonmusk_giveaway',           // _giveaway suffix pattern
  displayName: 'Elon Musk',               // impersonating a public figure
  verified: false,
  followers: 480,
  following: 3_200,
  tweets: 34,
  accountAgeDays: 3,                       // 3 days old
  createdAt: daysAgo(3),
  profileImage: 'https://example.com/stolen-elon.jpg',
  bio: 'Official giveaway account. Free airdrop — send 0.5 ETH receive 1 ETH back. Claim now!',
  location: 'Earth',
  website: 'https://elonmusk-giveaway.fake',
  engagementRate: 0.18,                    // suspiciously high
  postingFrequency: 'burst',
  growthPattern: 'spike',
  lastActive: daysAgo(0),
};

/** rug_pull — fake DeFi project with airdrop lure */
export const rugPullScam = {
  platform: 'twitter',
  username: 'solana_moonshot_official',    // _official suffix
  displayName: 'Solana Moonshot Finance',
  verified: false,
  followers: 12_000,
  following: 11_800,                       // nearly equal follow-back ratio
  tweets: 210,
  accountAgeDays: 18,
  createdAt: daysAgo(18),
  profileImage: 'https://example.com/ai-logo.jpg',
  bio: 'Next-gen DeFi protocol on Solana. Earn bonus rewards. Airdrop live. Send to receive.',
  location: 'Metaverse',
  website: 'https://solana-moonshot.fake',
  engagementRate: 0.12,
  postingFrequency: 'high',
  growthPattern: 'spike',
  lastActive: daysAgo(0),
};

/** wallet_drainer — phishing link disguised as NFT claim */
export const walletDrainerScam = {
  platform: 'twitter',
  username: 'nft_free_claim_real',         // _real suffix
  displayName: 'Free NFT Claim Portal',
  verified: false,
  followers: 320,
  following: 4_100,
  tweets: 15,
  accountAgeDays: 2,
  createdAt: daysAgo(2),
  profileImage: 'https://example.com/nft-fake.jpg',
  bio: 'Claim your FREE NFT airdrop now before it expires! Connect wallet to receive bonus.',
  location: '',
  website: 'https://nft-claim-portal.fake',
  engagementRate: 0.2,
  postingFrequency: 'burst',
  growthPattern: 'spike',
  lastActive: daysAgo(0),
};

/** pig_butchering — romance + crypto investment hybrid */
export const pigButcheringScam = {
  platform: 'telegram',
  username: 'sophia_crypto_advisor',
  displayName: 'Sophia Li',
  verified: false,
  followers: 210,
  following: 1_800,
  tweets: 88,
  accountAgeDays: 21,
  createdAt: daysAgo(21),
  profileImage: 'https://example.com/sophia-ai-generated.jpg',
  bio: 'Crypto investment advisor. I can help you grow your portfolio. Airdrop bonus available for new clients.',
  location: 'Hong Kong',
  website: '',
  engagementRate: 0.04,
  postingFrequency: 'moderate',
  growthPattern: 'unknown',
  lastActive: daysAgo(1),
};

// ---------------------------------------------------------------------------
// ROMANCE SCAM PROFILES
// ---------------------------------------------------------------------------

/** romance_scam — "military doctor deployed overseas" classic persona */
export const romanceMilitaryScam = {
  platform: 'instagram',
  username: 'dr_james_richardson_usarmy',
  displayName: 'Dr. James Richardson',
  verified: false,
  followers: 95,
  following: 1_400,
  tweets: 42,
  accountAgeDays: 14,
  createdAt: daysAgo(14),
  profileImage: 'https://example.com/stolen-military-photo.jpg',
  bio: 'US Army military doctor deployed overseas on peacekeeping mission. Widowed father of one. Looking for honest love. Cannot talk on phone — contact via email.',
  location: 'Kabul, Afghanistan',
  website: '',
  engagementRate: 0.01,
  postingFrequency: 'low',
  growthPattern: 'unknown',
  lastActive: daysAgo(3),
};

/** romance_scam — "oil rig engineer" variant */
export const romanceOilRigScam = {
  platform: 'instagram',
  username: 'mark_oilrig_engineer',
  displayName: 'Mark Johnson',
  verified: false,
  followers: 78,
  following: 890,
  tweets: 29,
  accountAgeDays: 9,
  createdAt: daysAgo(9),
  profileImage: 'https://example.com/stolen-handsome-man.jpg',
  bio: 'Offshore oil rig engineer working abroad. Widower looking for a genuine connection. Can help with western union if needed.',
  location: 'North Sea',
  website: '',
  engagementRate: 0.01,
  postingFrequency: 'low',
  growthPattern: 'unknown',
  lastActive: daysAgo(2),
};

// ---------------------------------------------------------------------------
// EMPLOYMENT SCAM PROFILES
// ---------------------------------------------------------------------------

/** job_offer_fraud — fake recruiter on LinkedIn */
export const fakeRecruiterScam = {
  platform: 'linkedin',
  username: 'recruiter_sarah_hr123',       // generic recruiter + numbers
  displayName: 'Sarah Thompson',
  verified: false,
  followers: 38,
  following: 2_900,
  tweets: 12,
  accountAgeDays: 6,
  createdAt: daysAgo(6),
  profileImage: 'https://example.com/ai-professional-woman.jpg',
  bio: 'Work from home and earn $500/day! No experience needed. Flexible hours, be your own boss. DM to apply now.',
  location: 'Remote',
  website: 'https://work-from-home-jobs.fake',
  engagementRate: 0.02,
  postingFrequency: 'burst',
  growthPattern: 'unknown',
  lastActive: daysAgo(1),
};

/** job_offer_fraud — "unlimited earning potential" MLM-style scam */
export const mlmJobScam = {
  platform: 'twitter',
  username: 'jobs_offer_unlimited',        // jobs_offer pattern
  displayName: 'Dream Jobs Now',
  verified: false,
  followers: 215,
  following: 3_400,
  tweets: 55,
  accountAgeDays: 11,
  createdAt: daysAgo(11),
  profileImage: 'https://example.com/stock-office.jpg',
  bio: 'Passive income opportunity. Unlimited earning potential. Hiring now — no experience needed. Make money online from home.',
  location: '',
  website: 'https://dream-jobs-now.fake',
  engagementRate: 0.09,
  postingFrequency: 'burst',
  growthPattern: 'spike',
  lastActive: daysAgo(0),
};

// ---------------------------------------------------------------------------
// TECH SUPPORT SCAM PROFILES
// ---------------------------------------------------------------------------

/** tech_support_fraud — fake Microsoft/Apple helpdesk */
export const techSupportScam = {
  platform: 'twitter',
  username: 'microsoft_official_help',     // _official + _help patterns
  displayName: 'Microsoft Support',
  verified: false,
  followers: 640,
  following: 5_200,
  tweets: 320,
  accountAgeDays: 25,
  createdAt: daysAgo(25),
  profileImage: 'https://example.com/fake-ms-logo.png',
  bio: 'Microsoft official helpline. Account suspended? Unusual activity detected? Call us now toll free 24/7 support.',
  location: 'Redmond, WA',
  website: 'https://microsoft-support-help.fake',
  engagementRate: 0.03,
  postingFrequency: 'moderate',
  growthPattern: 'unknown',
  lastActive: daysAgo(0),
};

// ---------------------------------------------------------------------------
// GOVERNMENT / AUTHORITY IMPERSONATION PROFILES
// ---------------------------------------------------------------------------

/** government_impersonation — IRS scam */
export const irsImpersonationScam = {
  platform: 'twitter',
  username: 'irs_official_helpline',       // irs_official pattern
  displayName: 'IRS Official',
  verified: false,
  followers: 1_200,
  following: 480,
  tweets: 180,
  accountAgeDays: 30,
  createdAt: daysAgo(30),
  profileImage: 'https://example.com/irs-seal.png',
  bio: 'IRS official helpline. Your account is suspended — verify your account immediately or face penalties. Call us now.',
  location: 'Washington, D.C.',
  website: 'https://irs-official-help.fake',
  engagementRate: 0.02,
  postingFrequency: 'moderate',
  growthPattern: 'unknown',
  lastActive: daysAgo(1),
};

/** government_impersonation — Social Security Administration scam */
export const ssaImpersonationScam = {
  platform: 'twitter',
  username: 'social_security_official_help',
  displayName: 'Social Security Administration',
  verified: false,
  followers: 890,
  following: 210,
  tweets: 145,
  accountAgeDays: 22,
  createdAt: daysAgo(22),
  profileImage: 'https://example.com/ssa-seal.png',
  bio: 'Social security helpline. Unusual activity on your account. Verify your account now. 24/7 official support.',
  location: 'Washington, D.C.',
  website: 'https://ssa-official-help.fake',
  engagementRate: 0.015,
  postingFrequency: 'moderate',
  growthPattern: 'unknown',
  lastActive: daysAgo(2),
};

// ---------------------------------------------------------------------------
// BANK IMPERSONATION PROFILES
// ---------------------------------------------------------------------------

/** bank_impersonation — fake Chase customer service */
export const fakeBankSupportScam = {
  platform: 'twitter',
  username: 'the_chase_bank_support',      // _chase_bank_ pattern + the_ prefix
  displayName: 'Chase Bank Support',
  verified: false,
  followers: 2_100,
  following: 680,
  tweets: 430,
  accountAgeDays: 45,
  createdAt: daysAgo(45),
  profileImage: 'https://example.com/chase-logo-fake.png',
  bio: 'Chase bank security team. Account suspended — verify your account now. Unusual activity detected. Official helpline.',
  location: 'New York, NY',
  website: 'https://chase-bank-support.fake',
  engagementRate: 0.02,
  postingFrequency: 'moderate',
  growthPattern: 'unknown',
  lastActive: daysAgo(0),
};

// ---------------------------------------------------------------------------
// FAKE CHARITY PROFILES
// ---------------------------------------------------------------------------

/** fake_charity — disaster relief donation scam */
export const fakeCharityScam = {
  platform: 'twitter',
  username: 'disaster_relief_fund_official',
  displayName: 'Global Disaster Relief Fund',
  verified: false,
  followers: 340,
  following: 2_800,
  tweets: 62,
  accountAgeDays: 5,                       // created right after a disaster
  createdAt: daysAgo(5),
  profileImage: 'https://example.com/charity-logo.png',
  bio: 'Help earthquake victims. Donate now to receive free bonus. Send crypto or gift card to help those in need.',
  location: 'Global',
  website: 'https://disaster-relief-fund.fake',
  engagementRate: 0.1,
  postingFrequency: 'burst',
  growthPattern: 'spike',
  lastActive: daysAgo(0),
};

// ---------------------------------------------------------------------------
// CELEBRITY ENDORSEMENT SCAM PROFILES
// ---------------------------------------------------------------------------

/** celebrity_endorsement_scam — fake Oprah weight loss product endorsement */
export const celebEndorsementScam = {
  platform: 'instagram',
  username: 'oprah_official_health',       // celebrity name + _official pattern
  displayName: 'Oprah Winfrey',
  verified: false,
  followers: 4_500,
  following: 120,
  tweets: 88,
  accountAgeDays: 12,
  createdAt: daysAgo(12),
  profileImage: 'https://example.com/oprah-stolen.jpg',
  bio: 'Official health and wellness account. Exclusive giveaway — free product. Limited time bonus offer.',
  location: '',
  website: 'https://oprah-official-weight.fake',
  engagementRate: 0.14,
  postingFrequency: 'burst',
  growthPattern: 'spike',
  lastActive: daysAgo(0),
};

// ---------------------------------------------------------------------------
// LANDLORD / RENTAL SCAM PROFILES
// ---------------------------------------------------------------------------

/** landlord_rental_scam — fake property listing on social media */
export const rentalScam = {
  platform: 'facebook',
  username: 'dream_homes_rental_deals',    // deals + numbers
  displayName: 'Dream Home Rentals',
  verified: false,
  followers: 195,
  following: 3_100,
  tweets: 35,
  accountAgeDays: 7,
  createdAt: daysAgo(7),
  profileImage: 'https://example.com/stock-house.jpg',
  bio: 'Beautiful homes for rent — deals of the day. Cashapp only. No returns. Zelle preferred for holding deposit. Ship worldwide.',
  location: 'Various Cities',
  website: 'https://dream-home-rentals.fake',
  engagementRate: 0.08,
  postingFrequency: 'burst',
  growthPattern: 'spike',
  lastActive: daysAgo(0),
};

// ---------------------------------------------------------------------------
// MARKETPLACE SELLER FRAUD PROFILES
// ---------------------------------------------------------------------------

/** marketplace_seller_fraud — Facebook Marketplace disappearing seller */
export const marketplaceSellerScam = {
  platform: 'facebook',
  username: 'quick_deals_seller99',        // deals + numbers
  displayName: 'Quick Deals',
  verified: false,
  followers: 88,
  following: 2_400,
  tweets: 18,
  accountAgeDays: 4,
  createdAt: daysAgo(4),
  profileImage: 'https://example.com/stolen-product-photo.jpg',
  bio: 'Best prices — deal of the day! Cashapp only, no refunds, no returns. DM price. Limited time offer.',
  location: 'Your City',
  website: '',
  engagementRate: 0.06,
  postingFrequency: 'burst',
  growthPattern: 'spike',
  lastActive: daysAgo(0),
};

// ---------------------------------------------------------------------------
// INVESTMENT FRAUD (non-crypto) PROFILES
// ---------------------------------------------------------------------------

/** investment_fraud — fake stock/Forex trading signal provider */
export const investmentFraudScam = {
  platform: 'instagram',
  username: 'forex_trading_guru_official', // _official suffix
  displayName: 'Elite Trading Academy',
  verified: false,
  followers: 8_900,
  following: 7_800,
  tweets: 420,
  accountAgeDays: 35,
  createdAt: daysAgo(35),
  profileImage: 'https://example.com/luxury-lifestyle.jpg',
  bio: 'Make $10,000/week with our proven Forex signals. DM for exclusive bonus access. No experience needed. Passive income.',
  location: 'Dubai',
  website: 'https://elite-trading-academy.fake',
  engagementRate: 0.11,
  postingFrequency: 'high',
  growthPattern: 'spike',
  lastActive: daysAgo(0),
};

/** ponzi_scheme — fake high-yield investment program */
export const ponziSchemeScam = {
  platform: 'twitter',
  username: 'guaranteed_returns_official', // _official suffix
  displayName: 'Guaranteed Returns Capital',
  verified: false,
  followers: 5_400,
  following: 4_900,
  tweets: 280,
  accountAgeDays: 60,
  createdAt: daysAgo(60),
  profileImage: 'https://example.com/finance-logo.jpg',
  bio: 'Guaranteed 50% monthly returns. Investment bonus for new members. Send to receive more. Passive income program.',
  location: 'London',
  website: 'https://guaranteed-returns-capital.fake',
  engagementRate: 0.09,
  postingFrequency: 'high',
  growthPattern: 'spike',
  lastActive: daysAgo(1),
};

/** phishing — fake account verification / credential harvest */
export const phishingScam = {
  platform: 'twitter',
  username: 'twitter_verify_official',     // _verify + _official
  displayName: 'Twitter Verification Team',
  verified: false,
  followers: 1_800,
  following: 3_200,
  tweets: 95,
  accountAgeDays: 8,
  createdAt: daysAgo(8),
  profileImage: 'https://example.com/twitter-logo-fake.png',
  bio: 'Official account verification. Your account is suspended — verify your account now to restore access. Click link.',
  location: 'San Francisco',
  website: 'https://twitter-verify-account.fake',
  engagementRate: 0.04,
  postingFrequency: 'burst',
  growthPattern: 'spike',
  lastActive: daysAgo(0),
};

// ---------------------------------------------------------------------------
// KNOWN SCAMMER DATABASE MATCH
// ---------------------------------------------------------------------------

/** Simulates a profile that exists in the known_scammers table */
export const knownScammerProfile = {
  platform: 'twitter',
  username: 'confirmed_scammer_acc',
  displayName: 'John Smith',
  verified: false,
  followers: 120,
  following: 900,
  tweets: 22,
  accountAgeDays: 45,
  createdAt: daysAgo(45),
  profileImage: 'https://example.com/photo.jpg',
  bio: 'Generic bio with no obvious red flags',
  location: 'Unknown',
  website: '',
  engagementRate: 0.03,
  postingFrequency: 'low',
  growthPattern: 'unknown',
  lastActive: daysAgo(5),
};

/** The corresponding scammer DB record for the above */
export const knownScammerRecord = {
  id: 'SCM-TEST-001',
  platform: 'twitter',
  username: 'confirmed_scammer_acc',
  displayName: 'John Smith',
  impersonating: null,
  scamType: 'romance_scam',
  victimCount: 14,
  totalLostUsd: 28_000,
  evidenceUrls: ['https://evidence.example.com/1'],
  firstReported: new Date(Date.now() - 30 * DAY_MS),
  lastSeen: new Date(Date.now() - 2 * DAY_MS),
  status: 'active',
  riskScore: 95,
  aliases: ['john_smith_love', 'johnsmith_us_army'],
  notes: 'Confirmed romance scammer with 14 victims',
  createdAt: new Date(Date.now() - 30 * DAY_MS),
  updatedAt: new Date(Date.now() - 2 * DAY_MS),
};
