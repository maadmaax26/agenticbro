#!/usr/bin/env node

/**
 * Profile Verifier Test with Mock Data
 * Tests scam detection logic using the same fixtures as automated tests
 */

const { ProfileVerifier } = require('./dist/services/profile-verifier');

// Mock profile data - romance scam
const romanceScamProfile = {
  platform: 'twitter',
  username: 'dr_johnson_military',
  displayName: 'Dr. James Johnson',
  verified: false,
  followers: 1250,
  following: 480,
  tweets: 88,
  bio: 'US Army doctor deployed overseas. Looking for love. Gift cards appreciated. Western Union accepted.',
  location: 'Afghanistan (deployed)',
  website: '',
  profileImage: 'https://example.com/doctor.jpg',
  createdAt: '2026-03-01',
  accountAgeDays: 30,
};

async function main() {
  console.log('🔍 Profile Verifier Test - Mock Data');
  console.log('Profile: @dr_johnson_military (Romance Scam)\n');

  const verifier = new ProfileVerifier({
    twitterConfig: {
      apiKey: 'mock-key',
      apiSecret: 'mock-secret',
      bearerToken: 'mock-token',
    },
    botometerApiKey: 'mock-key',
    deepfakeModelPath: '',
    databaseUrl: 'mock-url',
    redisUrl: 'redis://localhost:6379',
  });

  try {
    // Verify using romance context
    const result = await verifier.verify(
      'twitter',
      'dr_johnson_military',
      {
        verificationContext: 'romance',
        deepScan: false,
        includeMedia: false,
      }
    );

    console.log('=== VERIFICATION RESULT ===\n');
    console.log(`Success: ${result.success}`);

    if (result.data) {
      console.log(`\nAuthenticity Score: ${result.data.authenticityScore}/100`);
      console.log(`Risk Level: ${result.data.riskLevel}`);
      console.log(`Context: ${result.data.verificationContext}`);
      console.log(`\nCategories:`);
      for (const [category, catResult] of Object.entries(result.data.categories)) {
        console.log(`  ${category}: ${catResult.score}/${catResult.maxScore} (${catResult.status})`);
      }
      console.log(`\nRed Flags:`);
      result.data.redFlags.forEach(flag => console.log(`  • ${flag}`));
      console.log(`\nWarnings:`);
      result.data.warnings.forEach(warn => console.log(`  ⚠️  ${warn}`));
      console.log(`\nRecommendation:`);
      console.log(`  ${result.data.recommendation}`);
      console.log(`\nPlain Language Summary:`);
      console.log(`  ${result.data.plainLanguageSummary}`);
      console.log(`\nScan Duration: ${result.data.scanDuration}`);
    } else if (result.error) {
      console.log(`\nError: ${result.error.code}`);
      console.log(`Message: ${result.error.message}`);
    }

    console.log('\n=========================\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);