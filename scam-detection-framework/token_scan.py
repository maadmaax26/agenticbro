#!/usr/bin/env python3
"""
Token Scan Script
=================
Scans a token address for scam indicators.

Usage:
  python3 token_scan.py --address <contract_address> [--json] [--chain solana|eth|base]

Output:
  JSON with risk assessment, red flags, and verification level.
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, List, Any

# DexScreener API
DEXSCREENER_API = "https://api.dexscreener.com/latest/dex"

# Known legitimate contracts
LEGITIMATE_CONTRACTS = {
    "AGNTCBRO": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
    "SOL": "So11111111111111111111111111111111111111112",
}

# Risk scoring weights
RISK_WEIGHTS = {
    "no_liquidity": 25,
    "low_liquidity": 15,
    "no_holders": 20,
    "new_token": 10,
    "suspicious_name": 15,
    "impersonation": 20,
    "missing_socials": 10,
    "unverified": 5,
}


def fetch_token_info(address: str, chain: str = "solana") -> Dict[str, Any]:
    """Fetch token info from DexScreener."""
    url = f"{DEXSCREENER_API}/tokens/{address}"
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AgenticBro/1.0"})
        response = urllib.request.urlopen(req, timeout=30)
        data = json.loads(response.read().decode())
        return data
    except Exception as e:
        return {"error": str(e)}


def calculate_risk_score(token_data: Dict[str, Any], address: str, chain: str = "solana") -> Dict[str, Any]:
    """Calculate risk score and identify red flags."""
    risk_score = 0
    red_flags = []
    
    pairs = token_data.get("pairs", [])
    if not pairs:
        return {
            "risk_score": 100,
            "risk_level": "CRITICAL",
            "red_flags": ["Token not found on any DEX"],
            "verification_level": "UNVERIFIED",
        }
    
    # Use the first pair (most liquid)
    pair = pairs[0]
    
    # Check liquidity
    liquidity = pair.get("liquidity", {}).get("usd", 0) or 0
    if liquidity == 0:
        risk_score += RISK_WEIGHTS["no_liquidity"]
        red_flags.append("No liquidity")
    elif liquidity < 1000:
        risk_score += RISK_WEIGHTS["low_liquidity"]
        red_flags.append(f"Low liquidity (${liquidity:.2f})")
    
    # Check holders
    holders = pair.get("holders", 0) or 0
    if holders == 0:
        risk_score += RISK_WEIGHTS["no_holders"]
        red_flags.append("No holders")
    
    # Check token age
    created_at = pair.get("pairCreatedAt")
    if created_at:
        age_days = (datetime.now().timestamp() - created_at / 1000) / 86400
        if age_days < 7:
            risk_score += RISK_WEIGHTS["new_token"]
            red_flags.append(f"New token ({age_days:.1f} days)")
    
    # Check if verified
    info = pair.get("info", {})
    if not info.get("verified"):
        risk_score += RISK_WEIGHTS["unverified"]
        red_flags.append("Unverified token")
    
    # Check socials
    socials = info.get("socials", [])
    if not socials:
        risk_score += RISK_WEIGHTS["missing_socials"]
        red_flags.append("No social links")
    
    # Check for impersonation
    base_token = pair.get("baseToken", {})
    symbol = base_token.get("symbol", "").upper()
    name = base_token.get("name", "").lower()
    
    for legit_symbol, legit_addr in LEGITIMATE_CONTRACTS.items():
        if symbol == legit_symbol and address.lower() != legit_addr.lower():
            risk_score += RISK_WEIGHTS["impersonation"]
            red_flags.append(f"Potential {legit_symbol} impersonation")
    
    # Check for suspicious names
    suspicious_words = ["airdrop", "free", "giveaway", "moon", "100x", "1000x"]
    for word in suspicious_words:
        if word in name:
            risk_score += RISK_WEIGHTS["suspicious_name"]
            red_flags.append(f"Suspicious name: '{word}'")
            break
    
    # Determine risk level
    if risk_score >= 70:
        risk_level = "CRITICAL"
    elif risk_score >= 50:
        risk_level = "HIGH"
    elif risk_score >= 30:
        risk_level = "MEDIUM"
    elif risk_score >= 10:
        risk_level = "LOW"
    else:
        risk_level = "MINIMAL"
    
    # Determine verification level
    if risk_score >= 50:
        verification_level = "HIGH RISK"
    elif risk_score >= 30:
        verification_level = "UNVERIFIED"
    elif risk_score >= 10:
        verification_level = "PARTIALLY VERIFIED"
    else:
        verification_level = "VERIFIED"
    
    return {
        "risk_score": min(risk_score, 100),
        "risk_level": risk_level,
        "red_flags": red_flags,
        "verification_level": verification_level,
        "token_name": base_token.get("name"),
        "token_symbol": symbol,
        "liquidity_usd": liquidity,
        "holders": holders,
        "chain": pair.get("chain", chain),
        "pair_address": pair.get("pairAddress"),
    }


def main():
    parser = argparse.ArgumentParser(description="Scan token for scam indicators")
    parser.add_argument("--address", required=True, help="Token contract address")
    parser.add_argument("--chain", default="solana", help="Blockchain (solana, eth, base)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()
    
    # Fetch token info
    token_data = fetch_token_info(args.address, args.chain)
    
    if "error" in token_data:
        result = {
            "error": token_data["error"],
            "risk_score": 100,
            "risk_level": "ERROR",
            "red_flags": [f"Failed to fetch token info: {token_data['error']}"],
        }
    else:
        result = calculate_risk_score(token_data, args.address, args.chain)
    
    result["address"] = args.address
    result["scan_type"] = "token"
    result["scan_date"] = datetime.utcnow().isoformat()
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Token Scan Results for {args.address}")
        print(f"  Risk Score: {result['risk_score']}/100 ({result['risk_level']})")
        print(f"  Verification: {result.get('verification_level', 'UNKNOWN')}")
        if result.get("red_flags"):
            print("  Red Flags:")
            for flag in result["red_flags"]:
                print(f"    - {flag}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())