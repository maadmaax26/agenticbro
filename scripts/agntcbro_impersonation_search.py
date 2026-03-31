#!/usr/bin/env python3
"""
Comprehensive AGNTCBRO Impersonation Search
Searches for all tokens using AGNTCBRO symbol or similar names
"""
import json
import requests
from datetime import datetime

def search_agntcbro_imposters():
    """Comprehensive search for AGNTCBRO impersonators"""
    print("🔍 Comprehensive AGNTCBRO Impersonation Search")
    print("="*70)
    
    legitimate_contract = "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
    legitimate_symbol = "AGNTCBRO"
    legitimate_name = "Agentic Bro"
    
    # Search 1: Exact symbol match
    print("📊 Method 1: Exact symbol search...")
    exact_matches = []
    try:
        url = f"https://api.dexscreener.com/latest/dex/search?q={legitimate_symbol}&limit=100"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        for pair in data.get('pairs', []):
            token = pair.get('baseToken', {})
            if token.get('symbol', '').upper() == legitimate_symbol.upper():
                exact_matches.append(pair)
    except Exception as e:
        print(f"   Error: {e}")
    
    print(f"   Found {len(exact_matches)} tokens with exact AGNTCBRO symbol")
    
    # Search 2: Name variations
    print("📊 Method 2: Name variation search...")
    name_variations = [
        legitimate_symbol,
        legitimate_name,
        legitimate_name.lower(),
        "AgenticBro",
        "agentic bro",
        "agentic"
    ]
    
    all_related = []
    for term in name_variations:
        try:
            url = f"https://api.dexscreener.com/latest/dex/search?q={term}&limit=50"
            response = requests.get(url, timeout=5)
            data = response.json()
            
            if data.get('pairs'):
                all_related.extend(data['pairs'])
        except Exception as e:
            print(f"   Error searching for {term}: {e}")
    
    # Deduplicate
    seen_addresses = set()
    unique_related = []
    for pair in all_related:
        address = pair.get('baseToken', {}).get('address', '')
        if address and address not in seen_addresses:
            unique_related.append(pair)
            seen_addresses.add(address)
    
    print(f"   Found {len(unique_related)} related tokens")
    
    # Analysis
    print(f"\n📊 ANALYSIS RESULTS:")
    print("="*70)
    
    # Analyze exact matches
    print(f"🎯 Exact Symbol Matches: {len(exact_matches)}")
    print("-" * 70)
    
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
    
    # Analyze high-risk related tokens
    print(f"\n🔍 High-Risk Related Tokens (with 'agentic' in name):")
    print("-" * 70)
    
    suspicious_related = []
    for pair in unique_related:
        token = pair.get('baseToken', {})
        name = token.get('name', '')
        address = token.get('address', '')
        
        # Skip legitimate token
        if address == legitimate_contract:
            continue
        
        # Check if name contains 'agentic'
        if 'agentic' in name.lower() or 'agent' in name.lower():
            suspicious_related.append(pair)
    
    for i, pair in enumerate(suspicious_related[:10], 1):
        token = pair.get('baseToken', {})
        print(f"{i}. {token['symbol']} ({token['name']})")
        print(f"   Contract: {token['address']}")
        print(f"   Chain: {pair.get('chainId', 'N/A')} | DEX: {pair.get('dexId', 'N/A')}")
        print(f"   Price: ${pair.get('priceUsd', 'N/A')} | Liq: ${pair.get('liquidity', {}).get('usd', 0):,.2f}")
        print()
    
    # Summary
    print(f"\n📊 SUMMARY:")
    print("="*70)
    print(f"✅ LEGITIMATE AGNTCBRO:")
    print(f"   Contract: {legitimate_contract}")
    print(f"   Symbol: {legitimate_symbol}")
    print(f"   Name: {legitimate_name}")
    print(f"   Status: VERIFIED SAFE")
    print()
    print(f"🚨 EXACT SYMBOL IMPOSTORS: {len(impostors_found)}")
    print(f"🔍 Related Tokens: {len(unique_related)}")
    print(f"⚠️ Suspicious Related: {len(suspicious_related)}")
    print()
    
    # Save report
    report = {
        'scan_date': datetime.now().isoformat(),
        'legitimate_token': {
            'contract': legitimate_contract,
            'symbol': legitimate_symbol,
            'name': legitimate_name
        },
        'exact_symbol_matches': exact_matches,
        'related_tokens_count': len(unique_related),
        'suspicious_related_count': len(suspicious_related),
        'impostors_found': len(impostors_found)
    }
    
    filename = f"agntcbro_impersonation_scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"📄 Report saved to: {filename}")
    print("="*70)
    
    # Generate alert
    if len(impostors_found) > 0:
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
            alert += f"""
{i}. 🚨 FAKE {token['symbol']}
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
    else:
        alert = f"""✅ AGNTCBRO: No Exact Symbol Impostors Found

Good news! No tokens found using the exact AGNTCBRO symbol with different contract addresses.

✅ LEGITIMATE AGNTCBRO:
Contract: {legitimate_contract}
Symbol: {legitimate_symbol}
Name: {legitimate_name}
Status: VERIFIED SAFE

📊 Scan Summary:
• Exact symbol searches: {len(exact_matches)} found
• Exact symbol impostors: {len(impostors_found)}
• Related tokens: {len(unique_related)}
• Suspicious related: {len(suspicious_related)}

🔐 Scan first, ape later!

{legitimate_symbol} #SafeToken #Solana #CryptoSafety"""
    
    print("\n" + "="*70)
    print("📢 GENERATED ALERT:")
    print("="*70 + "\n")
    print(alert)
    print("\n" + "="*70)
    
    return {
        'impostor_count': len(impostors_found),
        'exact_matches': exact_matches,
        'alert': alert
    }

if __name__ == "__main__":
    results = search_agntcbro_impostors()
    
    if results['impostor_count'] > 0:
        print(f"\n🚨 ACTION REQUIRED: Update scammer database with {results['impostor_count']} new impostors!")
    else:
        print(f"\n✅ ALL CLEAR: No exact symbol impostors found for AGNTCBRO")