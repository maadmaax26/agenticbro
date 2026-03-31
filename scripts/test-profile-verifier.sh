#!/bin/bash

# Profile Verifier Manual Test Script
# Tests the verify endpoint with sample profiles

BASE_URL="${BASE_URL:-http://localhost:3001}"
OUTPUT_DIR="./output/profile-verifier-tests"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=================================="
echo "Profile Verifier Manual Tests"
echo "=================================="
echo "Base URL: $BASE_URL"
echo "Output Dir: $OUTPUT_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Test 1: Verified Company Account (Safe)
echo -e "${YELLOW}Test 1: Verified Company Account${NC}"
curl -s -X POST "$BASE_URL/api/verify/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "username": "solana",
    "verificationContext": "crypto",
    "options": {
      "deepScan": false,
      "includeMedia": false
    }
  }' | tee "$OUTPUT_DIR/test1-verified-company-$TIMESTAMP.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/test1-verified-company-$TIMESTAMP.json"
echo ""

# Test 2: Romance Scam Profile
echo -e "${YELLOW}Test 2: Romance Scam (Military Doctor)${NC}"
curl -s -X POST "$BASE_URL/api/verify/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "username": "dr_johnson_military",
    "verificationContext": "romance",
    "options": {
      "deepScan": false,
      "includeMedia": false
    }
  }' | tee "$OUTPUT_DIR/test2-romance-scam-$TIMESTAMP.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/test2-romance-scam-$TIMESTAMP.json"
echo ""

# Test 3: Crypto Giveaway Scam
echo -e "${YELLOW}Test 3: Crypto Giveaway Scam${NC}"
curl -s -X POST "$BASE_URL/api/verify/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "username": "elon_giveaway_real",
    "verificationContext": "crypto",
    "options": {
      "deepScan": false,
      "includeMedia": false
    }
  }' | tee "$OUTPUT_DIR/test3-crypto-giveaway-$TIMESTAMP.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/test3-crypto-giveaway-$TIMESTAMP.json"
echo ""

# Test 4: Job Offer Scam
echo -e "${YELLOW}Test 4: Job Offer Scam (Work from Home)${NC}"
curl -s -X POST "$BASE_URL/api/verify/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "username": "earn500daily_official",
    "verificationContext": "employment",
    "options": {
      "deepScan": false,
      "includeMedia": false
    }
  }' | tee "$OUTPUT_DIR/test4-job-scam-$TIMESTAMP.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/test4-job-scam-$TIMESTAMP.json"
echo ""

# Test 5: Normal Developer Account
echo -e "${YELLOW}Test 5: Normal Developer Account${NC}"
curl -s -X POST "$BASE_URL/api/verify/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "username": "vitalikbuterin",
    "verificationContext": "crypto",
    "options": {
      "deepScan": false,
      "includeMedia": false
    }
  }' | tee "$OUTPUT_DIR/test5-normal-developer-$TIMESTAMP.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/test5-normal-developer-$TIMESTAMP.json"
echo ""

# Test 6: Bank Impersonation
echo -e "${YELLOW}Test 6: Bank Impersonation Scam${NC}"
curl -s -X POST "$BASE_URL/api/verify/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "username": "the_chase_bank_helpline",
    "verificationContext": "financial",
    "options": {
      "deepScan": false,
      "includeMedia": false
    }
  }' | tee "$OUTPUT_DIR/test6-bank-impersonation-$TIMESTAMP.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/test6-bank-impersonation-$TIMESTAMP.json"
echo ""

# Test 7: Marketplace Seller Scam
echo -e "${YELLOW}Test 7: Marketplace Seller Scam${NC}"
curl -s -X POST "$BASE_URL/api/verify/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "instagram",
    "username": "luxury_seller_official",
    "verificationContext": "marketplace",
    "options": {
      "deepScan": false,
      "includeMedia": false
    }
  }' | tee "$OUTPUT_DIR/test7-marketplace-scam-$TIMESTAMP.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/test7-marketplace-scam-$TIMESTAMP.json"
echo ""

# Test 8: Deepfake Detection (with media)
echo -e "${YELLOW}Test 8: Deepfake Detection (with Media)${NC}"
curl -s -X POST "$BASE_URL/api/verify/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "username": "ai_influencer_fake",
    "verificationContext": "romance",
    "options": {
      "deepScan": false,
      "includeMedia": true
    }
  }' | tee "$OUTPUT_DIR/test8-deepfake-$TIMESTAMP.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/test8-deepfake-$TIMESTAMP.json"
echo ""

echo "=================================="
echo -e "${GREEN}All tests complete!${NC}"
echo "Results saved to: $OUTPUT_DIR"
echo ""
echo "To view all results:"
echo "  ls -la $OUTPUT_DIR"
echo ""
echo "To view a specific test:"
echo "  cat $OUTPUT_DIR/test1-verified-company-$TIMESTAMP.json | jq ."
echo ""