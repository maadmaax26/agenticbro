#!/usr/bin/env python3
"""
Enhanced Token Impersonation Scanner with Multi-Source Search
Finds tokens impersonating legitimate tokens using multiple data sources
"""
import json
import requests
import sys
from datetime import datetime

def get_token_info_dexscreener(contract_address):
    """Get token info from DexScreener"""
    try:
        url = f"https://api.dexscreener.com/latest/dex/tokens/{contract_address}"
        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get('pairs') and len(data['pairs']) > 0:
            pair = data['pairs'][0]
            token = pair.get('baseToken', {})
            return {
                'found': True,
                'source': 'dexscreener',
                'symbol': token.get('symbol', ''),
                'name': token.get('name', ''),
                'address': token.get('address', ''),
                'price': pair.get('priceUsd', 'N/A'),
                'volume': pair.get('volume', {}).get('h24', 0),
                'liquidity': pair.get('liquidity', {}).get('usd', 0),
                'chain': pair.get('chainId', 'Unknown'),
                'dex': pair.get('dexId', 'Unknown'),
                'url': pair.get('url', ''),
                'pairAddress': pair.get('pairAddress', ''),
                'websites': pair.get('info', {}).get('websites', []),
                'socials': pair.get('info', {}).get('socials', []),
                'creation_date': pair.get('pairCreatedAt', None)
            }
        else:
            return {'found': False, 'source': 'dexscreener'}
    except Exception as e:
        return {'found': False, 'source': 'dexscreener', 'error': str(e)}

def search_similar_tokens_enhanced(symbol, name, legitimate_address):
    """Enhanced search for similar tokens using multiple methods"""
    print(f"🔍 Enhanced search for tokens similar to {symbol} ({name})")
    
    # Method 1: DexScreener search by symbol
    print("📊 Method 1: DexScreener symbol search...")
    symbol_tokens = search_by_symbol_dexscreener(symbol)
    
    # Method 2: DexScreener search by name parts
    print("📊 Method 2: DexScreener name parts search...")
    name_tokens = search_by_name_parts_dexscreener(name)
    
    # Method 3: Pump.fun specific search
    print("📊 Method 3: Pump.fun search...")
    pump_tokens = search_pump_fun(symbol, name)
    
    # Combine and deduplicate
    all_pairs = []
    seen_addresses = set(legitimate_address)  # Exclude legitimate token
    
    for method, tokens in [('symbol', symbol_tokens), ('name', name_tokens), ('pump', pump_tokens)]:
        print(f"   {method}: {len(tokens)} tokens found")
        for pair in tokens:
            address = pair.get('baseToken', {}).get('address', '')
            if address and address not in seen_addresses:
                pair['source_method'] = method
                all_pairs.append(pair)
                seen_addresses.add(address)
    
    return all_pairs

def search_by_symbol_dexscreener(symbol):
    """Search DexScreener by exact symbol"""
    try:
        url = f"https://api.dexscreener.com/latest/dex/search?q={symbol}"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data.get('pairs'):
            return [p for p in data['pairs'] 
                   if p.get('baseToken', {}).get('symbol', '').upper() == symbol.upper()]
        return []
    except Exception as e:
        print(f"   Error in symbol search: {e}")
        return []

def search_by_name_parts_dexscreener(name):
    """Search DexScreener by parts of the name"""
    tokens = []
    parts = name.split() if name else []
    
    for part in parts[:3]:  # Limit to first 3 parts
        if len(part) >= 3:  # Minimum 3 characters
            try:
                url = f"https://api.dexscreener.com/latest/dex/search?q={part}"
                response = requests.get(url, timeout=5)
                data = response.json()
                
                if data.get('pairs'):
                    for pair in data['pairs']:
                        pair_name = pair.get('baseToken', {}).get('name', '').lower()
                        if part.lower() in pair_name:
                            tokens.append(pair)
            except Exception as e:
                print(f"   Error searching for {part}: {e}")
    
    return tokens

def search_pump_fun(symbol, name):
    """Search pump.fun for similar tokens"""
    tokens = []
    
    # Pump.fun API doesn't provide public search, so we use DexScreener filter
    try:
        url = f"https://api.dexscreener.com/latest/dex/search?q={symbol}"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data.get('pairs'):
            for pair in data['pairs']:
                if 'pump' in pair.get('dexId', '').lower():
                    token = pair.get('baseToken', {})
                    # Check for similar symbol or name
                    if (symbol.lower() in token.get('symbol', '').lower() or
                        name.lower() in token.get('name', '').lower() or
                        'agentic' in token.get('name', '').lower()):
                        tokens.append(pair)
    except Exception as e:
        print(f"   Error in pump.fun search: {e}")
    
    return tokens

def analyze_token_similarity(token_data, legitimate_symbol, legitimate_name, legitimate_address):
    """Analyze how similar a token is to the legitimate one"""
    token = token_data.get('baseToken', {})
    symbol = token.get('symbol', '')
    name = token.get('name', '')
    address = token.get('address', '')
    
    similarity_score = 0
    similarity_factors = []
    
    # Exact symbol match (highest risk)
    if symbol.upper() == legitimate_symbol.upper():
        similarity_score += 50
        similarity_factors.append("🚨 EXACT SYMBOL MATCH")
    # Symbol contains legitimate symbol
    elif legitimate_symbol.upper() in symbol.upper():
        similarity_score += 25
        similarity_factors.append("⚠️ Symbol contains legitimate symbol")
    
    # Name similarity
    if legitimate_name.lower() in name.lower():
        similarity_score += 20
        similarity_factors.append("⚠️ Name contains legitimate name")
    elif any(word in name.lower() for word in ['agentic', 'bro', 'agent', 'ai']):
        similarity_score += 10
        similarity_factors.append("⚠️ Name contains related keywords")
    
    # Recent token (possible impersonator)
    creation_date = token_data.get('pairCreatedAt')
    if creation_date:
        token_age_days = (datetime.now().timestamp() - creation_date) / 86400
        if token_age_days < 30:  # Less than 30 days old
            similarity_score += 15
            similarity_factors.append(f"⚠️ Recent token ({int(token_age_days)} days old)")
    
    # Low liquidity (rug pull risk)
    liquidity = token_data.get('liquidity', {}).get('usd', 0)
    if liquidity == 0:
        similarity_score += 10
        similarity_factors.append("⚠️ Zero liquidity")
    elif liquidity < 1000:
        similarity_score += 5
        similarity_factors.append("⚠️ Very low liquidity")
    
    # High risk platform
    dex = token_data.get('dexId', '').lower()
    if 'pump' in dex:
        similarity_score += 5
        similarity_factors.append("⚠️ Pump.fun token")
    
    return {
        'similarity_score': similarity_score,
        'factors': similarity_factors,
        'is_exact_symbol_copy': symbol.upper() == legitimate_symbol.upper()
    }

def generate_enhanced_alert(legitimate_token, suspicious_tokens):
    """Generate enhanced alert with suspicious tokens"""
    
    if not suspicious_tokens:
        return f"""✅ {legitimate_token['symbol'].upper()} - No Impersonators Found

Enhanced scan completed successfully.
No tokens classified as impersonators.

Legitimate contract: {legitimate_token['address']}
Scan first, ape later!

{legitimate_token['symbol']} #SafeToken #Solana"""
    
    # Sort by similarity score
    sorted_tokens = sorted(suspicious_tokens, 
                          key=lambda x: x.get('analysis', {}).get('similarity_score', 0), 
                          reverse=True)
    
    exact_copies = [t for t in sorted_tokens if t.get('analysis', {}).get('is_exact_symbol_copy')]
    high_similarity = [t for t in sorted_tokens if t.get('analysis', {}).get('similarity_score', 0) >= 30 and not t.get('analysis', {}).get('is_exact_symbol_copy')]
    medium_similarity = [t for t in sorted_tokens if 20 <= t.get('analysis', {}).get('similarity_score', 0) < 30]
    
    alert = f"""🚨 AGNTCBRO IMPERSONATION ALERT 🚨

Enhanced scan detected {len(suspicious_tokens)} potentially impersonating tokens!

✅ LEGITIMATE {legitimate_token['symbol'].upper()}: Verified Safe
Contract: {legitimate_token['address']}
Price: ${legitimate_token['price']} | Volume: ${legitimate_token['volume']:,.2f}

"""
    
    if exact_copies:
        alert += f"""🚨 CRITICAL - EXACT SYMBOL COPIES ({len(exact_copies)}):
These tokens use the EXACT same symbol '{legitimate_token['symbol'].upper()}'!

"""
        for i, token in enumerate(exact_copies[:5], 1):
            t = token.get('token_data', {}).get('baseToken', {})
            analysis = token.get('analysis', {})
            alert += f"""{i}. 🚨 {t.get('symbol', 'N/A')} ({t.get('name', 'N/A')})
   Contract: {t.get('address', 'N/A')}
   Similarity: {analysis.get('similarity_score', 0)}%
   Chain: {t.get('chain', 'N/A')} | DEX: {t.get('dex', 'N/A')}
   Factors: {', '.join(analysis.get('factors', [])[:3])}

"""
    
    if high_similarity:
        alert += f"""⚠️ HIGH SIMILARITY TOKENS ({len(high_similarity)}):
"""
        for i, token in enumerate(high_similarity[:3], 1):
            t = token.get('token_data', {}).get('baseToken', {})
            analysis = token.get('analysis', {})
            alert += f"""{i}. {t.get('symbol', 'N/A')} ({t.get('name', 'N/A')})
   Similarity: {analysis.get('similarity_score', 0)}%
   Factors: {', '.join(analysis.get('factors', [])[:2])}

"""
    
    alert += f"""🛡️ PROTECTION:
✅ ALWAYS verify contract address
✅ ONLY trust {legitimate_token['symbol'].upper()} at {legitimate_token['address']}
✅ Check token age and liquidity
✅ Verify official social media accounts

📊 SCAN SUMMARY:
• Legitimate: {legitimate_token['symbol'].upper()}
• Exact copies: {len(exact_copies)}
• High similarity: {len(high_similarity)}
• Medium similarity: {len(medium_similarity)}
• Total suspicious: {len(suspicious_tokens)}

🔐 Scan first, ape later!

{legitimate_token['symbol']} #ImpersonationDetection #Solana #CryptoSafety"""

    return alert

def enhanced_scan_for_impersonators(contract_address):
    """Enhanced scan with multiple search methods"""
    print(f"🔍 Enhanced impersonation scan: {contract_address}")
    
    # Step 1: Get legitimate token info
    print("📋 Getting legitimate token info...")
    token_info = get_token_info_dexscreener(contract_address)
    
    if not token_info['found']:
        print(f"❌ Token not found on DexScreener")
        return {
            'found': False,
            'error': 'Token not found - may be very new or not listed',
            'alert': f"⚠️ Token {contract_address} not found on any exchange. May be new or not listed."
        }
    
    legitimate_token = token_info
    print(f"✅ Found: {legitimate_token['symbol']} ({legitimate_token['name']})")
    
    # Step 2: Enhanced search for similar tokens
    similar_tokens = search_similar_tokens_enhanced(
        legitimate_token['symbol'],
        legitimate_token['name'],
        legitimate_token['address']
    )
    
    print(f"📊 Found {len(similar_tokens)} potentially similar tokens")
    
    # Step 3: Analyze similarity
    print("🔍 Analyzing similarity and risk...")
    suspicious_tokens = []
    
    for token_data in similar_tokens:
        analysis = analyze_token_similarity(
            token_data,
            legitimate_token['symbol'],
            legitimate_token['name'],
            legitimate_token['address']
        )
        
        if analysis['similarity_score'] >= 20:  # Minimum threshold
            suspicious_tokens.append({
                'token_data': token_data,
                'analysis': analysis
            })
    
    # Step 4: Generate alert
    if suspicious_tokens:
        alert = generate_enhanced_alert(legitimate_token, suspicious_tokens)
        print(f"⚠️ Found {len(suspicious_tokens)} potentially impersonating tokens")
    else:
        alert = f"""✅ {legitimate_token['symbol'].upper()} - No Impersonators Found

Enhanced scan completed successfully.
{len(similar_tokens)} similar tokens analyzed, 0 classified as impersonators.

Legitimate contract: {legitimate_token['address']}
Scan first, ape later!

{legitimate_token['symbol']} #SafeToken #Solana"""
    
    # Save report
    report = {
        'scan_date': datetime.now().isoformat(),
        'legitimate_token': legitimate_token,
        'suspicious_tokens': suspicious_tokens,
        'total_analyzed': len(similar_tokens),
        'alert': alert
    }
    
    filename = f"enhanced_scan_{contract_address}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w') as f:
        json.dump(report, f, indent=2)
    
    return {
        'found': True,
        'legitimate_token': legitimate_token,
        'suspicious_tokens': suspicious_tokens,
        'similar_tokens_count': len(similar_tokens),
        'alert': alert,
        'report_file': filename
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python enhanced_token_scanner.py <CONTRACT_ADDRESS>")
        print("Example: python enhanced_token_scanner.py 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump")
        sys.exit(1)
    
    contract_address = sys.argv[1]
    results = enhanced_scan_for_impersonators(contract_address)
    
    print("\n" + "="*70)
    print("📢 ENHANCED SCAN RESULTS")
    print("="*70 + "\n")
    print(results['alert'])
    print("\n" + "="*70)
    print(f"\n📄 Report saved to: {results.get('report_file', 'N/A')}")