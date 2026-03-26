#!/usr/bin/env python3
"""
Investigative Scanner for Specific Token Address
Tries multiple methods to find token information
"""
import json
import requests
import re
import sys
from datetime import datetime

def investigate_specific_token(contract_address, target_name="AGNTCBRO"):
    """Comprehensive investigation of a specific token"""
    print(f"🔍 Investigating token: {contract_address}")
    print(f"🎯 Target: {target_name}\n")

    # Method 1: Direct DexScreener search
    print("📊 Method 1: Direct DexScreener search...")
    results = search_dexscreener_direct(contract_address)
    
    # Method 2: Search for potential related tokens
    print("📊 Method 2: Search for related tokens...")
    related = search_related_tokens(target_name)
    
    # Method 3: Look for exact symbol matches
    print("📊 Method 3: Exact symbol match search...")
    exact_matches = find_exact_symbol_matches(target_name)
    
    # Method 4: Search for recent suspicious tokens
    print("📊 Method 4: Recent token search...")
    recent_tokens = search_recent_suspicious_tokens()

    # Generate investigation report
    report = {
        'investigation_date': datetime.now().isoformat(),
        'target_address': contract_address,
        'target_name': target_name,
        'findings': {
            'direct_search': results,
            'related_tokens': len(related),
            'exact_matches': len(exact_matches),
            'recent_suspicious': len(recent_tokens)
        },
        'recommendations': generate_recommendations(contract_address, results, related, exact_matches)
    }

    # Print summary
    print("\n" + "="*70)
    print("📊 INVESTIGATION SUMMARY")
    print("="*70)
    print(f"Target Token: {target_name}")
    print(f"Target Address: {contract_address}")
    print(f"\n📈 Findings:")
    print(f"  Direct Search: {'✅ Found' if results else '❌ Not Found'}")
    print(f"  Related Tokens: {len(related)}")
    print(f"  Exact Symbol Matches: {len(exact_matches)}")
    print(f"  Recent Suspicious: {len(recent_tokens)}")
    print("\n" + report['recommendations'])
    print("\n" + "="*70)

    # Save report
    filename = f"investigation_{contract_address}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\n📄 Report saved to: {filename}")

    return report

def search_dexscreener_direct(contract_address):
    """Direct search by contract address"""
    try:
        url = f"https://api.dexscreener.com/latest/dex/tokens/{contract_address}"
        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get('pairs') and len(data['pairs']) > 0:
            return {
                'found': True,
                'data': data['pairs'][0]
            }
        else:
            return {
                'found': False,
                'reason': 'Not indexed by DexScreener'
            }
    except Exception as e:
        return {
            'found': False,
            'reason': f'API Error: {str(e)}'
        }

def search_related_tokens(target_name):
    """Search for tokens that might be related"""
    tokens = []
    
    # Search for name variations
    variations = [
        target_name,
        target_name.lower(),
        target_name.replace(" ", ""),
        "agentic bro",
        "agentic",
        "bro"
    ]
    
    for term in variations:
        try:
            url = f"https://api.dexscreener.com/latest/dex/search?q={term}"
            response = requests.get(url, timeout=5)
            data = response.json()
            
            if data.get('pairs'):
                tokens.extend(data['pairs'])
        except Exception as e:
            print(f"   Error searching for {term}: {e}")
    
    # Deduplicate
    seen = set()
    unique_tokens = []
    for token in tokens:
        address = token.get('baseToken', {}).get('address', '')
        if address and address not in seen:
            unique_tokens.append(token)
            seen.add(address)
    
    return unique_tokens

def find_exact_symbol_matches(target_symbol):
    """Find tokens with the exact same symbol"""
    try:
        url = f"https://api.dexscreener.com/latest/dex/search?q={target_symbol}"
        response = requests.get(url, timeout=10)
        data = response.json()

        exact_matches = []
        if data.get('pairs'):
            for pair in data['pairs']:
                token = pair.get('baseToken', {})
                if token.get('symbol', '').upper() == target_symbol.upper():
                    exact_matches.append(pair)

        return exact_matches
    except Exception as e:
        print(f"   Error finding exact matches: {e}")
        return []

def search_recent_suspicious_tokens():
    """Search for recently created suspicious tokens"""
    suspicious = []
    
    # Search for pump.fun tokens with suspicious names
    suspicious_terms = ['agentic', 'bro', 'ai', 'agent']
    
    for term in suspicious_terms:
        try:
            url = f"https://api.dexscreener.com/latest/dex/search?q={term}"
            response = requests.get(url, timeout=5)
            data = response.json()

            if data.get('pairs'):
                for pair in data['pairs']:
                    # Check if it's on pump.fun
                    if 'pump' in pair.get('dexId', '').lower():
                        # Check if very recent or has zero liquidity
                        liquidity = pair.get('liquidity', {}).get('usd', 0)
                        if liquidity < 100:  # Low liquidity
                            suspicious.append(pair)
        except Exception as e:
            print(f"   Error searching recent tokens: {e}")

    return suspicious

def generate_recommendations(contract_address, direct_result, related_tokens, exact_matches):
    """Generate actionable recommendations based on investigation"""

    recommendations = []
    
    if direct_result.get('found'):
        recommendations.append("✅ Token is indexed and listed on exchanges")
        recommendations.append("✅ Token is legitimate and traceable")
    else:
        recommendations.append("⚠️ Token not found on major exchanges")
        recommendations.append("⚠️ Token may be very new or not yet indexed")
        recommendations.append("⚠️ Token might not be legitimate or could be a scam")
        
        if len(related_tokens) > 0:
            recommendations.append(f"📊 Found {len(related_tokens)} related tokens that might be impersonators")
        
        if len(exact_matches) > 1:  # More than just legitimate
            recommendations.append(f"🚨 Found {len(exact_matches)-1} exact symbol matches - potential impersonators!")
        
        if len(related_tokens) > 5:
            recommendations.append("⚠️ High number of related tokens - may be confusion campaign")

    recommendations.append("\n🛡️ RECOMMENDED ACTIONS:")
    recommendations.append("1. Verify the contract address on Solscan")
    recommendations.append("2. Check if the token is listed on Raydium/Jupiter")
    recommendations.append("3. Look for official announcements from legitimate project")
    recommendations.append("4. Be cautious if token has zero liquidity or is very new")
    recommendations.append("5. Never send funds to unverified contract addresses")

    return "\n".join(recommendations)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python investigate_token.py <CONTRACT_ADDRESS> [TARGET_NAME]")
        print("Example: python investigate_token.py 9U2p5SMjWkk8SUhM6prFB89EYY3MtBvVvuoNr9cpUwNw AGNTCBRO")
        sys.exit(1)

    contract_address = sys.argv[1]
    target_name = sys.argv[2] if len(sys.argv) > 2 else "AGNTCBRO"

    investigation_result = investigate_specific_token(contract_address, target_name)