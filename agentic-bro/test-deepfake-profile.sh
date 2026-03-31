#!/bin/bash
# Test Profile Verifier with Deepfake Detection

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 PROFILE VERIFIER - DEEPFAKE DETECTION TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Known suspicious profile (AI-generated image)
echo "Test 1: Suspected AI-generated profile image"
echo "---------------------------------------------"
curl -s -X POST http://localhost:3002/api/v1/verify/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ab_testkey123" \
  -d '{
    "platform": "twitter",
    "username": "cryptoalpha_trader",
    "options": {
      "includeMedia": true,
      "deepScan": true
    }
  }' | jq '{
    username: .data.profile.username,
    verified: .data.profile.verified,
    authenticityScore: .data.authenticityScore,
    riskLevel: .data.riskLevel,
    deepfake: .data.categories.deepfake,
    recommendation: .data.recommendation
  }'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 2: Known scammer from database
echo "Test 2: Known scammer from database"
echo "-----------------------------------"
curl -s -X POST http://localhost:3002/api/v1/verify/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ab_testkey123" \
  -d '{
    "platform": "twitter",
    "username": "solana_guru_2024",
    "options": {
      "includeMedia": true,
      "deepScan": true,
      "sampleFollowers": true
    }
  }' | jq '{
    username: .data.profile.username,
    verified: .data.profile.verified,
    authenticityScore: .data.authenticityScore,
    riskLevel: .data.riskLevel,
    verification: .data.categories.verification.status,
    botDetection: .data.categories.botDetection.status,
    deepfake: .data.categories.deepfake.status,
    impersonation: .data.categories.impersonation.status,
    recommendation: .data.recommendation
  }'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 3: High-risk impersonation account
echo "Test 3: Impersonation attempt"
echo "-----------------------------"
curl -s -X POST http://localhost:3002/api/v1/verify/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ab_testkey123" \
  -d '{
    "platform": "twitter",
    "username": "agenticbro_official",
    "options": {
      "includeMedia": true,
      "deepScan": true
    }
  }' | jq '{
    username: .data.profile.username,
    verified: .data.profile.verified,
    followers: .data.profile.followers,
    authenticityScore: .data.authenticityScore,
    riskLevel: .data.riskLevel,
    impersonation: .data.categories.impersonation,
    redFlags: .data.redFlags,
    recommendation: .data.recommendation
  }'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 4: New account with suspicious patterns
echo "Test 4: New account with bot signals"
echo "--------------------------------------"
curl -s -X POST http://localhost:3002/api/v1/verify/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ab_testkey123" \
  -d '{
    "platform": "twitter",
    "username": "solana millionaire_2025",
    "options": {
      "includeMedia": true,
      "deepScan": true,
      "sampleFollowers": true
    }
  }' | jq '{
    username: .data.profile.username,
    verified: .data.profile.verified,
    followers: .data.profile.followers,
    accountAge: .data.categories.activity.details.accountAge,
    authenticityScore: .data.authenticityScore,
    riskLevel: .data.riskLevel,
    botDetection: .data.categories.botDetection,
    recommendation: .data.recommendation
  }'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL TESTS COMPLETED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"