#!/usr/bin/env python3
"""
Detailed AGNTCBRO Token Analysis
Shows all tokens found with detailed analysis
"""
import json
import requests

LEGITIMATE_CONTRACT = "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"

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

def analyze_all_tokens():
    """Analyze all found tokens"""
    print("🔍 Detailed AGNTCBRO Token Analysis")
    print("=" * 70)

    search_queries = [
        "AGNTCBRO",
        "AGENTIC BRO",
        "AGENTICBRO",
        "AGNTCB",
        "AgenticBro",
        "AGNT",
        "BRO"
    ]

    all_pairs = []
    seen_addresses = set()

    for query in search_queries:
        pairs = search_dexscreener(query)
        for pair in pairs:
            address = pair.get('baseToken', {}).get('address', '')
            if address and address not in seen_addresses:
                all_pairs.append(pair)
                seen_addresses.add(address)

    print(f"\n📊 Found {len(all_pairs)} unique tokens\n")

    for i, pair in enumerate(all_pairs, 1):
        t = pair.get('baseToken', {})
        address = t.get('address', '')
        symbol = t.get('symbol', '')
        name = t.get('name', '')

        print(f"{i}. {symbol} ({name})")
        print(f"   Contract: {address}")

        if address == LEGITIMATE_CONTRACT:
            print(f"   ✅ LEGITIMATE TOKEN")
        else:
            # Analyze suspicious indicators
            suspicious = []

            if symbol.upper() == "AGNTCBRO":
                suspicious.append("⚠️ Exact symbol match (AGNTCBRO)")
            elif "AGNT" in symbol.upper() and "BRO" in symbol.upper():
                suspicious.append("⚠️ Similar symbol structure")
            elif "AGENTIC" in name.upper() and "BRO" in name.upper():
                suspicious.append("⚠️ Similar name structure")

            if "pump" in address.lower():
                suspicious.append("⚠️ Pump.fun token")

            liquidity = pair.get('liquidity', {}).get('usd', 0)
            if liquidity < 100:
                suspicious.append("⚠️ Very low liquidity")

            volume = pair.get('volume', {}).get('h24', 0)
            if volume < 50:
                suspicious.append("⚠️ Very low volume")

            if suspicious:
                print(f"   RISK FACTORS:")
                for factor in suspicious:
                    print(f"   {factor}")

                # Calculate risk score
                risk_score = len(suspicious)
                print(f"   Risk Score: {risk_score}/5")
                print(f"   Risk Level: {'CRITICAL' if risk_score >= 4 else 'HIGH' if risk_score >= 3 else 'MEDIUM' if risk_score >= 2 else 'LOW'}")
            else:
                print(f"   ℹ️ Unrelated token")

        print(f"   Price: ${pair.get('priceUsd', 'N/A')}")
        print(f"   DEX: {pair.get('dexId', 'N/A')}")
        print(f"   Liquidity: ${liquidity:,.2f}" if 'liquidity' in locals() else "   Liquidity: $0.00")
        print(f"   Volume (24h): ${volume:,.2f}" if 'volume' in locals() else "   Volume (24h): $0.00")
        print(f"   Chain: {pair.get('chainId', 'N/A')}")
        print(f"   URL: {pair.get('url', 'N/A')}")
        print()

    print("=" * 70)
    print("⚠️ ALWAYS VERIFY CONTRACT ADDRESSES BEFORE TRADING!")
    print(f"✅ Legitimate AGNTCBRO: {LEGITIMATE_CONTRACT}")
    print("=" * 70)

if __name__ == "__main__":
    analyze_all_tokens()