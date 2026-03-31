#!/bin/bash
# Test Profile Verifier - Scam Detection Demonstration

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚨 PROFILE VERIFIER - SCAM DETECTION DEMO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: DEEPFAKE DETECTION - AI-generated profile image
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📸 TEST 1: DEEPFAKE DETECTION"
echo "Profile: @crypto_beauty_99"
echo "Red flags: AI-generated profile image, high engagement, claims $50K profit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST http://localhost:3002/api/v1/verify/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ab_testkey123" \
  -d '{
    "platform": "twitter",
    "username": "crypto_beauty_99",
    "options": {
      "includeMedia": true,
      "deepScan": true
    }
  }' | jq '{
    success: .success,
    username: .data.profile.username,
    displayName: .data.profile.displayName,
    verified: .data.profile.verified,
    followers: .data.profile.followers,
    bio: .data.profile.bio,
    authenticityScore: .data.authenticityScore,
    riskLevel: .data.riskLevel,
    verification: .data.categories.verification.status,
    deepfake: .data.categories.deepfake,
    redFlags: .data.redFlags,
    recommendation: .data.recommendation
  }'
echo ""

# Test 2: BOT DETECTION - Suspicious posting patterns
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 TEST 2: BOT DETECTION"
echo "Profile: @solana_moonshot_bot"
echo "Red flags: 5,678 tweets in 8 months, spammy bio, bot activity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST http://localhost:3002/api/v1/verify/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ab_testkey123" \
  -d '{
    "platform": "twitter",
    "username": "solana_moonshot_bot",
    "options": {
      "includeMedia": true,
      "deepScan": true,
      "sampleFollowers": true
    }
  }' | jq '{
    success: .success,
    username: .data.profile.username,
    displayName: .data.profile.displayName,
    verified: .data.profile.verified,
    followers: .data.profile.followers,
    tweetCount: .data.profile.tweetCount,
    bio: .data.profile.bio,
    authenticityScore: .data.authenticityScore,
    riskLevel: .data.riskLevel,
    botDetection: .data.categories.botDetection,
    postingFrequency: .data.profile.postingFrequency,
    recommendation: .data.recommendation
  }'
echo ""

# Test 3: IMPERSONATION - Copying legitimate project
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎭 TEST 3: IMPERSONATION DETECTION"
echo "Profile: @agenticbro_real (trying to copy @agenticbro11)"
echo "Red flags: Similar display name, unverified, impersonating known account"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST http://localhost:3002/api/v1/verify/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ab_testkey123" \
  -d '{
    "platform": "twitter",
    "username": "agenticbro_real",
    "options": {
      "includeMedia": true,
      "deepScan": true
    }
  }' | jq '{
    success: .success,
    username: .data.profile.username,
    displayName: .data.profile.displayName,
    verified: .data.profile.verified,
    followers: .data.profile.followers,
    bio: .data.profile.bio,
    authenticityScore: .data.authenticityScore,
    riskLevel: .data.riskLevel,
    impersonation: .data.categories.impersonation,
    redFlags: .data.redFlags,
    recommendation: .data.recommendation
  }'
echo ""

# Test 4: LEGITIMATE PROFILE - Your project
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TEST 4: LEGITIMATE PROFILE"
echo "Profile: @agenticbro11 (AGNTCBRO official account)"
echo "Status: VERIFIED - Safe to interact with"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST http://localhost:3002/api/v1/verify/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ab_testkey123" \
  -d '{
    "platform": "twitter",
    "username": "agenticbro11",
    "options": {
      "includeMedia": true,
      "deepScan": true
    }
  }' | jq '{
    success: .success,
    username: .data.profile.username,
    displayName: .data.profile.displayName,
    verified: .data.profile.verified,
    verifiedType: .data.profile.verifiedType,
    authenticityScore: .data.authenticityScore,
    riskLevel: .data.riskLevel,
    recommendation: .data.recommendation
  }'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL SCAM DETECTION TESTS COMPLETED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"