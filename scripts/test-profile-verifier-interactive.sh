#!/bin/bash

# Profile Verifier Interactive Test Menu
# Test different scam types and contexts interactively

BASE_URL="${BASE_URL:-http://localhost:3001}"
OUTPUT_DIR="./output/profile-verifier-tests"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to run a single test
run_test() {
    local name="$1"
    local platform="$2"
    local username="$3"
    local context="$4"
    local include_media="$5"

    echo -e "${BLUE}Testing: $name${NC}"
    echo -e "  Platform: $platform"
    echo -e "  Username: @$username"
    echo -e "  Context: $context"
    echo -e "  Media: $include_media"
    echo ""

    curl -s -X POST "$BASE_URL/api/verify/profile" \
      -H "Content-Type: application/json" \
      -d "{
        \"platform\": \"$platform\",
        \"username\": \"$username\",
        \"verificationContext\": \"$context\",
        \"options\": {
          \"deepScan\": false,
          \"includeMedia\": $include_media
        }
      }" | tee "$OUTPUT_DIR/$(echo "$name" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')-$TIMESTAMP.json" | jq '.' 2>/dev/null || echo "Raw JSON saved to file"

    echo ""
    echo "────────────────────────────────────────"
    echo ""
}

# Function to display summary
show_summary() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Profile Verifier Test Summary      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
    echo ""
    echo "Test runs saved to: $OUTPUT_DIR"
    echo ""
    echo "View all results:"
    echo "  ls -la $OUTPUT_DIR"
    echo ""
    echo "View a specific result:"
    echo "  cat $OUTPUT_DIR/<test-name>-*.json | jq ."
    echo ""
}

# Main menu
while true; do
    clear
    echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Profile Verifier - Manual Test Menu        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Base URL: $BASE_URL"
    echo ""
    echo "Select a test to run:"
    echo ""
    echo "  [1] Verified Company Account (Safe)"
    echo "  [2] Normal Developer Account (Safe)"
    echo "  [3] Crypto Giveaway Scam"
    echo "  [4] Rug Pull Scam"
    echo "  [5] Wallet Drainer Scam"
    echo "  [6] Romance Scam - Military Doctor"
    echo "  [7] Romance Scam - Oil Rig Engineer"
    echo "  [8] Job Offer Scam - $500/day"
    echo "  [9] Job Offer Scam - Passive Income"
    echo " [10] Tech Support Scam"
    echo " [11] Government Impersonation - IRS"
    echo " [12] Bank Impersonation - Chase"
    echo " [13] Fake Charity Scam"
    echo " [14] Celebrity Endorsement Scam"
    echo " [15] Rental Scam"
    echo " [16] Marketplace Seller Scam"
    echo " [17] Investment Fraud - Ponzi"
    echo " [18] Deepfake Detection (with Media)"
    echo " [19] Custom Username Test"
    echo " [20] Run All Tests"
    echo ""
    echo "  [q] Quit"
    echo ""
    echo -n "Select option [1-20, q]: "
    read -r choice

    case $choice in
        1)
            run_test "Verified Company Account" "twitter" "solana" "crypto" "false"
            ;;
        2)
            run_test "Normal Developer Account" "twitter" "vitalikbuterin" "crypto" "false"
            ;;
        3)
            run_test "Crypto Giveaway Scam" "twitter" "elon_giveaway_real" "crypto" "false"
            ;;
        4)
            run_test "Rug Pull Scam" "twitter" "solana_official_dev" "crypto" "false"
            ;;
        5)
            run_test "Wallet Drainer Scam" "twitter" "real_metamask_support" "crypto" "false"
            ;;
        6)
            run_test "Romance Scam Military" "twitter" "dr_johnson_military" "romance" "false"
            ;;
        7)
            run_test "Romance Scam Oil Rig" "twitter" "engineer_petro_worker" "romance" "false"
            ;;
        8)
            run_test "Job Offer $500/day" "twitter" "earn500daily_official" "employment" "false"
            ;;
        9)
            run_test "Job Offer Passive Income" "twitter" "unlimited_earnings_now" "employment" "false"
            ;;
        10)
            run_test "Tech Support Scam" "twitter" "microsoft_helpline_real" "financial" "false"
            ;;
        11)
            run_test "IRS Impersonation" "twitter" "irs_official_verify" "financial" "false"
            ;;
        12)
            run_test "Chase Bank Impersonation" "twitter" "the_chase_bank_helpline" "financial" "false"
            ;;
        13)
            run_test "Fake Charity Scam" "twitter" "ukraine_aid_giveaway" "crypto" "false"
            ;;
        14)
            run_test "Celebrity Endorsement" "twitter" "elon_musk_real_official" "crypto" "false"
            ;;
        15)
            run_test "Rental Scam" "instagram" "cheap_rentals_official" "marketplace" "false"
            ;;
        16)
            run_test "Marketplace Seller Scam" "instagram" "luxury_seller_official" "marketplace" "false"
            ;;
        17)
            run_test "Investment Fraud Ponzi" "twitter" "guaranteed_10k_weekly" "financial" "false"
            ;;
        18)
            run_test "Deepfake Detection" "twitter" "ai_influencer_fake" "romance" "true"
            ;;
        19)
            echo ""
            echo -n "Enter platform (twitter/instagram/linkedin): "
            read -r platform
            echo -n "Enter username (without @): "
            read -r username
            echo -n "Enter context (crypto/romance/employment/marketplace/financial/general): "
            read -r context
            echo -n "Include media analysis? (y/n): "
            read -r media
            include_media="false"
            [[ "$media" =~ ^[Yy]$ ]] && include_media="true"
            run_test "Custom Test" "$platform" "$username" "$context" "$include_media"
            ;;
        20)
            echo -e "${YELLOW}Running all tests...${NC}"
            echo ""
            run_test "Verified Company Account" "twitter" "solana" "crypto" "false"
            run_test "Normal Developer Account" "twitter" "vitalikbuterin" "crypto" "false"
            run_test "Crypto Giveaway Scam" "twitter" "elon_giveaway_real" "crypto" "false"
            run_test "Rug Pull Scam" "twitter" "solana_official_dev" "crypto" "false"
            run_test "Wallet Drainer Scam" "twitter" "real_metamask_support" "crypto" "false"
            run_test "Romance Scam Military" "twitter" "dr_johnson_military" "romance" "false"
            run_test "Romance Scam Oil Rig" "twitter" "engineer_petro_worker" "romance" "false"
            run_test "Job Offer $500/day" "twitter" "earn500daily_official" "employment" "false"
            run_test "Tech Support Scam" "twitter" "microsoft_helpline_real" "financial" "false"
            run_test "IRS Impersonation" "twitter" "irs_official_verify" "financial" "false"
            run_test "Bank Impersonation" "twitter" "the_chase_bank_helpline" "financial" "false"
            run_test "Fake Charity Scam" "twitter" "ukraine_aid_giveaway" "crypto" "false"
            run_test "Celebrity Endorsement" "twitter" "elon_musk_real_official" "crypto" "false"
            run_test "Rental Scam" "instagram" "cheap_rentals_official" "marketplace" "false"
            run_test "Marketplace Seller Scam" "instagram" "luxury_seller_official" "marketplace" "false"
            run_test "Investment Fraud Ponzi" "twitter" "guaranteed_10k_weekly" "financial" "false"
            ;;
        q|Q)
            show_summary
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option. Please try again.${NC}"
            sleep 2
            ;;
    esac

    echo -n "Press Enter to continue..."
    read -r
done