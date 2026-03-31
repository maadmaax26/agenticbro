#!/usr/bin/env node

/**
 * Direct Profile Verifier Test
 * Bypasses API layer and tests ProfileVerifier service directly
 */

const { ProfileVerifier } = require('./dist/services/profile-verifier');

async function main() {
  const verifier = new ProfileVerifier({
    twitterConfig: {
      apiKey: process.env.TWITTER_API_KEY || 'mock-key',
      apiSecret: process.env.TWITTER_API_SECRET || 'mock-secret',
      bearerToken: process.env.TWITTER_BEARER_TOKEN || 'mock-token',
    },
    botometerApiKey: process.env.BOTOMETER_API_KEY || 'mock-key',
    deepfakeModelPath: process.env.DEEPFAKE_MODEL_PATH,
    databaseUrl: process.env.DATABASE_URL || 'mock-url',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  console.log('🔍 Profile Verifier Test - @dr_johnson_military');
  console.log('Context: romance\n');

  try {
    const result = await verifier.verify(
      'twitter',
      'dr_johnson_military',
      {
        verificationContext: 'romance',
        deepScan: false,
        includeMedia: false,
      }
    );

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);