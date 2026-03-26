#!/usr/bin/env python3
"""
AGNTCBRO Impersonation Search - Simple Version
"""
import json
import requests
from datetime import datetime

def main():
    print("🔍 AGNTCBRO Impersonation Search")
    print("="*70)
    
    legitimate_contract = "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
    legitimate_symbol = "AGNTCBRO"
    legitimate_name = "Agentic Bro"
    
    print(f"✅ Legitimate Token: {legitimate_symbol}")
    print(f"   Contract: {legitimate_contract}")
    print(f"   Name: {legitimate_name}")
    print()
    
    # Search for exact symbol matches
    print("🔍 Searching for exact symbol matches...")
    try:
        url = f"https://api.dexscreener.com/latest/dex/search?q={legitimate_symbol}&limit=100"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        exact_matches = []
        for pair in data.get('pairs', []):
            token = pair.get('baseToken', {})
            if token.get('symbol', '').upper() == legitimate_symbol.upper():
                exact_matches.append(pair)
        
        print(f"📊 Found {len(exact_matches)} tokens with exact AGNTCBRO symbol")
        print()
        
        # Analyze results
        impostors_found = []
        for i, pair in enumerate(exact_matches, 1):
            token = pair.get('baseToken', {})
            address = token.get('address', '')
            is_legitimate = address == legitimate_contract
            
            status = "✅ LEGITIMATE" if is_legitimate else "🚨 IMPOSTOR"
            print(f"{i}. {token['symbol']} - {status}")
            print(f"   Contract: {address}")
            print(f"   Chain: {pair.get('chainId', 'N/A')} | DEX: {pair.get('dexId', 'N/A')}")
            print(f"   Price: ${pair.get('priceUsd', 'N/A')} | Liq: ${pair.get('liquidity', {}).get('usd', 0):,.2f}")
            
            if is_legitimate:
                print(f"   ✅ THIS IS THE OFFICIAL AGNTCBRO TOKEN")
            else:
                print(f"   🚨 THIS IS AN IMPOSTOR - Different address!")
                impostors_found.append(pair)
            print()
        
        # Generate alert
        if len(impostors_found) > 0:
            print("🚨 IMPOSTOR ALERT GENERATED")
            print("="*70)
            alert = f"""🚨 AGNTCBRO IMPOSTOR ALERT 🚨

Found {len(impostors_found)} tokens using the EXACT AGNTCBRO symbol!

⚠️ CRITICAL WARNING:
These tokens use the exact same symbol '{legitimate_symbol}' but have DIFFERENT contract addresses!

✅ LEGITIMATE AGNTCBRO:
Contract: {legitimate_contract}
Status: VERIFIED SAFE

"""
            for i, pair in enumerate(impostors_found, 1):
                token = pair.get('baseToken', {})
                alert += f"""{i}. 🚨 FAKE {token['symbol']}
   Contract: {token['address']}
   Chain: {pair.get('chainId', 'N/A')} | DEX: {pair.get('dexId', 'N/A')}
   Price: ${pair.get('priceUsd', 'N/A')}
"""
            alert += f"""
🛡️ PROTECT YOURSELF:
✅ ONLY TRUST: {legitimate_contract}
✅ VERIFY: agenticbro.app
✅ CHECK: Official social media accounts
✅ AVOID: Any other contract address

🔐 Scan first, ape later!

{legitimate_symbol} #ScamDetection #Solana #CryptoSafety"""
            print(alert)
            print("="*70)
        else:
            print("✅ NO IMPOSTORS FOUND")
            print("="*70)
            print(f"Good news! No tokens found using the exact AGNTCBRO symbol with different contract addresses.")
            print()
            print(f"✅ LEGITIMATE AGNTCBRO:")
            print(f"   Contract: {legitimate_contract}")
            print(f"   Symbol: {legitimate_symbol}")
            print(f"   Status: VERIFIED SAFE")
            print("="*70)
        
        return len(impostors_found) > 0
        
    except Exception as e:
        print(f"❌ Error during search: {e}")
        return False

if __name__ == "__main__":
    has_impostors = main()
    if has_impostors:
        print("\n🚨 ACTION REQUIRED: Update scammer database with new impostors!")
    else:
        print("\n✅ ALL CLEAR: No exact symbol impostors found for AGNTCBRO")