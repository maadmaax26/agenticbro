#!/usr/bin/env python3
"""
AGNTCBRO Scam Token Scanner
Scans for tokens copying the legitimate AGNTCBRO token
"""
import json
import requests

LEGITIMATE_CONTRACT = "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
LEGITIMATE_NAME = "Agentic Bro"
LEGITIMATE_SYMBOL = "AGNTCBRO"

def search_dexscreener(query):
    """Search DexScreener for tokens matching query"""
    url = f"https://api.dexscreener.com/latest/dex/search?q={query}"
    try:
        response = requests.get(url)
        data = response.json()
        return data.get('pairs', [])
    except Exception as e:
        print(f"Error searching DexScreener: {e}")
        return []

def scan_for_scam_tokens():
    """Scan for potential scam tokens"""
    print("🔍 AGNTCBRO Scam Token Scanner")
    print("=" * 50)
    print(f"Legitimate Contract: {LEGITIMATE_CONTRACT}")
    print(f"Legitimate Symbol: {LEGITIMATE_SYMBOL}")
    print(f"Legitimate Name: {LEGITIMATE_NAME}")
    print("=" * 50)

    search_queries = [
        "AGNTCBRO",
        "AGENTIC BRO",
        "AGENTICBRO",
        "AGNTCB",
        "AgenticBro"
    ]

    all_pairs = []
    seen_addresses = set()

    for query in search_queries:
        print(f"\nSearching for: {query}")
        pairs = search_dexscreener(query)
        for pair in pairs:
            address = pair.get('baseToken', {}).get('address', '')
            if address and address not in seen_addresses:
                all_pairs.append(pair)
                seen_addresses.add(address)

    print(f"\n📊 Found {len(all_pairs)} unique tokens\n")

    legitimate_tokens = []
    potential_scams = []

    for pair in all_pairs:
        token = pair.get('baseToken', {})
        address = token.get('address', '')
        symbol = token.get('symbol', '')
        name = token.get('name', '')

        if address == LEGITIMATE_CONTRACT:
            legitimate_tokens.append(pair)
        else:
            # Check if it's copying AGNTCBRO
            if (LEGITIMATE_SYMBOL.lower() in symbol.lower() or
                LEGITIMATE_NAME.lower() in name.lower() or
                "agentic" in name.lower() and "bro" in name.lower()):
                potential_scams.append(pair)

    print("✅ LEGITIMATE TOKEN:")
    print("-" * 50)
    for token in legitimate_tokens:
        t = token.get('baseToken', {})
        print(f"Symbol: {t.get('symbol', 'N/A')}")
        print(f"Name: {t.get('name', 'N/A')}")
        print(f"Contract: {t.get('address', 'N/A')}")
        print(f"Price: ${token.get('priceUsd', 'N/A')}")
        print(f"DEX: {token.get('dexId', 'N/A')}")
        print(f"Volume (24h): ${token.get('volume', {}).get('h24', 0):,.2f}")
        print(f"Liquidity: ${token.get('liquidity', {}).get('usd', 0):,.2f}")

    if potential_scams:
        print(f"\n⚠️ POTENTIAL SCAM TOKENS ({len(potential_scams)}):")
        print("-" * 50)
        for i, token in enumerate(potential_scams, 1):
            t = token.get('baseToken', {})
            print(f"\n{i}. {t.get('symbol', 'N/A')} - HIGH RISK")
            print(f"   Name: {t.get('name', 'N/A')}")
            print(f"   Contract: {t.get('address', 'N/A')}")
            print(f"   Price: ${token.get('priceUsd', 'N/A')}")
            print(f"   DEX: {token.get('dexId', 'N/A')}")
            print(f"   Volume (24h): ${token.get('volume', {}).get('h24', 0):,.2f}")
            print(f"   Liquidity: ${token.get('liquidity', {}).get('usd', 0):,.2f}")
            print(f"   URL: {token.get('url', 'N/A')}")

            # Calculate risk score
            risk_score = 0
            if t.get('symbol', '').lower() == LEGITIMATE_SYMBOL.lower():
                risk_score += 3
            if "agentic" in t.get('name', '').lower():
                risk_score += 2
            if token.get('liquidity', {}).get('usd', 0) < 1000:
                risk_score += 2
            if token.get('volume', {}).get('h24', 0) < 100:
                risk_score += 1

            print(f"   Risk Score: {risk_score}/8")
            print(f"   Risk Level: {'CRITICAL' if risk_score >= 6 else 'HIGH' if risk_score >= 4 else 'MEDIUM'}")
    else:
        print("\n✅ No potential scam tokens found")

    print("\n" + "=" * 50)
    print("⚠️ WARNING: Always verify contract addresses before trading!")
    print(f"✅ Legitimate AGNTCBRO: {LEGITIMATE_CONTRACT}")
    print("=" * 50)

if __name__ == "__main__":
    scan_for_scam_tokens()