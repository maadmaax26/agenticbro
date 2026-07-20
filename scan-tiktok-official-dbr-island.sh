#!/bin/bash
# Quick scan for @official.dbr.island on TikTok

echo "━━━ 🔍 TIKTOK PROFILE SCAN — @official.dbr.island ━━━"
echo ""
echo "⚠️  DISCLAIMER: AI-POWERED THREAT ASSESSMENT"
echo ""
echo "LIMITATIONS:"
echo "• Only scans public profile data"
echo "• Does NOT verify user identity"
echo "• May miss sophisticated scams"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

OUTPUT_FILE="/workspace/output/tiktok_official.dbr.island_$(date +%Y%m%d_%H%M%S).json"

python3 << 'PYTHON_EOF'
import requests
import json
import re
from datetime import datetime

profile_url = "https://www.tiktok.com/@official.dbr.island"
username = "official.dbr.island"

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
}

try:
    response = requests.get(profile_url, headers=headers, timeout=15)
    content = response.text

    # Extract profile information
    bio_match = re.search(r'(?s)<p class="::cza0q">([^<]+)</p>', content)
    bio = bio_match.group(1) if bio_match else "Not available"

    # Check for specific red flags
    red_flags = []

    # Crypto keywords
    crypto_keywords = ['crypto', 'cryptocurrency', 'bitcoin', 'eth', 'solana', 'defi', 'nft', 'stonks']
    for keyword in crypto_keywords:
        if keyword in bio.lower():
            red_flags.append(f"Crypto keyword: '{keyword}'")
            break

    # DM solicitation
    if 'dm' in bio.lower() and ('me' in bio.lower() or 'message' in bio.lower()):
        red_flags.append("DM solicitation detected")

    # Airdrops/Giveaways
    if 'airdrop' in bio.lower() or 'giveaway' in bio.lower():
        red_flags.append("Airdrops/Giveaways claimed")

    # Investment/Profit claims
    if any(word in bio.lower() for word in ['guaranteed', 'investment', 'profit', 'returns', '100%', 'up 100%']):
        red_flags.append("Unrealistic profit claims")

    # Easy money
    if any(word in bio.lower() for word in ['make money', 'easy money', 'passive income']):
        red_flags.append("Easy money claims")

    # Contract/Token mentions
    if re.search(r'[0-9a-zA-Z]{32,}', bio) and any(word in bio.lower() for word in ['token', 'contract', 'wallet']):
        red_flags.append("Contract/Token address visible")

    # VIP/Premium claims
    if any(word in bio.lower() for word in ['vip', 'premium', 'exclusive', 'access']):
        red_flags.append("VIP/Exclusive access claim")

    # Follow/Share button
    if 'Follow' in bio:
        red_flags.append("Follow button present - may recruit new victims")

    # Calculate risk
    risk_score = len(red_flags) * 2
    risk_score = min(risk_score, 10)

    if risk_score >= 8:
        risk_level = "CRITICAL"
    elif risk_score >= 6:
        risk_level = "HIGH"
    elif risk_score >= 4:
        risk_level = "MEDIUM"
    elif risk_score >= 2:
        risk_level = "LOW"
    else:
        risk_level = "LIKELY SAFE"

    # Additional metadata
    try:
        favicon_match = re.search(r'href="(https://www\.tiktok\.com/favicon\.ico[^"]*)"', content)
        favicon = favicon_match.group(1) if favicon_match else None
    except:
        favicon = None

    result = {
        "scan_time": datetime.utcnow().isoformat() + "Z",
        "tested_username": username,
        "profile_url": profile_url,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "red_flags_detected": len(red_flags),
        "flag_details": red_flags,
        "profile_data": {
            "username": username,
            "profile_url": profile_url,
            "bio": bio[:500],  # Truncate if too long
            "favicon_url": favicon
        },
        "scan_method": "direct_http_bypass_ssrf",
        "disclaimer_version": "v1_final"
    }

    print(json.dumps(result, indent=2))

except requests.exceptions.RequestException as e:
    print(json.dumps({
        "username": username,
        "scan_time": datetime.utcnow().isoformat() + "Z",
        "error": f"Network error: {str(e)}",
        "risk_score": 0,
        "risk_level": "ERROR"
    }))

PYTHON_EOF

echo ""
echo "━━━ SCAN COMPLETE ━━━"
echo ""
echo "💡 Save JSON to: $OUTPUT_FILE"
echo ""
echo "⚠️  SUMMARY:"
echo "• Risk Score: [see above]"
echo "• Risk Level: [see above]"
echo "• Red Flags: [see above]"
echo ""
echo "────────────────────────────────────────────────────────────────"
echo "────────────────────────────────────────────────────────────────"
echo "⚠️  INDEPENDENT VERIFICATION REQUIRED"
echo "✅ Cross-check username across multiple platforms"
echo "✅ Verify any contract addresses manually"
echo "✅ Be wary of guaranteed returns or insider information"
echo "✅ Never send money or share private keys"
echo "────────────────────────────────────────────────────────────────"