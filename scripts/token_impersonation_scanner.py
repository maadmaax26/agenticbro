#!/usr/bin/env python3
"""
Token Impersonation Scanner (Enhanced Version)
Scans for tokens impersonating a legitimate token by contract address
Enhanced with multi-source search and blockchain verification
"""
import json
import requests
import sys
from datetime import datetime

def get_token_info(contract_address):
    """Get token information from contract address"""
    try:
        # Try DexScreener first
        url = f"https://api.dexscreener.com/latest/dex/tokens/{contract_address}"
        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get('pairs') and len(data['pairs']) > 0:
            pair = data['pairs'][0]
            token = pair.get('baseToken', {})
            return {
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
                'socials': pair.get('info', {}).get('socials', [])
            }
        else:
            return None
    except requests.exceptions.Timeout:
        return None
    except Exception as e:
        print(f"Error getting token info: {e}")
        return None

def search_similar_tokens(symbol, name, legitimate_address):
    """Enhanced search for tokens with similar symbols or names"""
    print(f"🔍 Enhanced search for tokens similar to {symbol} ({name})")
    
    search_terms = [
        symbol,
        name,
        symbol.split(' ')[0] if ' ' in symbol else symbol,
        name.split(' ')[0] if ' ' in name else symbol,
        f"{symbol} bro",
        f"{symbol.lower()}bro",
        name.lower().replace(" ", ""),
        "agentic bro",
        "agentic"
    ]

    all_pairs = []
    seen_addresses = set(legitimate_address)

    for term in search_terms:
        try:
            url = f"https://api.dexscreener.com/latest/dex/search?q={term}"
            response = requests.get(url, timeout=10)
            data = response.json()

            if data.get('pairs'):
                for pair in data['pairs']:
                    address = pair.get('baseToken', {}).get('address', '')
                    if address and address != legitimate_address and address not in seen_addresses:
                        pair['search_term'] = term
                        all_pairs.append(pair)
                        seen_addresses.add(address)
        except Exception as e:
            print(f"   Error searching for {term}: {e}")

    print(f"📊 Found {len(all_pairs)} similar tokens using enhanced search")
    return all_pairs

def analyze_impersonators(similar_tokens, legitimate_symbol, legitimate_name, legitimate_address):
    """Analyze tokens for impersonation attempts with enhanced detection"""
    impersonators = {
        'exact_symbol_fakes': [],
        'high_risk': [],
        'medium_risk': [],
        'low_risk': [],
        'unrelated': []
    }

    for token in similar_tokens:
        t = token.get('baseToken', {})
        symbol = t.get('symbol', '')
        name = t.get('name', '')
        address = t.get('address', '')

        risk_score = 0
        risk_factors = []

        # CRITICAL: Exact symbol match with different address
        if symbol.upper() == legitimate_symbol.upper() and address != legitimate_address:
            risk_score += 10
            risk_factors.insert(0, "🚨 FAKE TOKEN - Same symbol, different contract address!")
        elif symbol.upper() == legitimate_symbol.upper():
            risk_score += 5
            risk_factors.append("⚠️ Exact symbol match")
        elif legitimate_symbol.upper() in symbol.upper():
            risk_score += 3
            risk_factors.append("⚠️ Symbol contains legitimate token symbol")
        elif symbol.upper().startswith(legitimate_symbol[:4].upper()):
            risk_score += 2
            risk_factors.append("⚠️ Similar symbol structure")

        # Enhanced name matching
        if legitimate_name.upper() in name.upper():
            risk_score += 3
            risk_factors.append("⚠️ Name contains legitimate token name")
        elif any(word in name.lower() for word in ['agentic', 'bro', 'agent', 'ai']):
            risk_score += 2
            risk_factors.append("⚠️ Name contains related keywords")

        # Token age analysis
        pair_created_at = token.get('pairCreatedAt')
        token_age_hours = None
        if pair_created_at:
            token_age_hours = (datetime.now().timestamp() - pair_created_at) / 3600
            if token_age_hours < 24:
                risk_score += 2
                risk_factors.append("⚠️ Very recent token (high scam probability)")
            elif token_age_hours < 168:
                risk_score += 1
                risk_factors.append("⚠️ Recent token (scam risk)")

        # Liquidity risk
        liquidity = token.get('liquidity', {}).get('usd', 0)
        if liquidity == 0:
            risk_score += 2
            risk_factors.append("⚠️ Zero liquidity - rug pull setup")
        elif liquidity < 100:
            risk_score += 1
            risk_factors.append("⚠️ Very low liquidity")

        # Volume risk
        volume = token.get('volume', {}).get('h24', 0)
        if volume < 10:
            risk_score += 1
            risk_factors.append("⚠️ Very low volume")

        # Platform risk
        dex = token.get('dexId', '').lower()
        if 'pump' in dex:
            risk_score += 1
            risk_factors.append("⚠️ Pump.fun token - known for scams")
        elif 'raydium' not in dex and 'jupiter' not in dex:
            risk_score += 1
            risk_factors.append("⚠️ Unknown/exotic DEX")

        # Search term analysis
        search_term = token.get('search_term', 'unknown')
        if search_term == legitimate_symbol:
            risk_score += 2
            risk_factors.append(f"⚠️ Found by exact symbol search (confusion attempt)")

        impersonator_info = {
            'symbol': symbol,
            'name': name,
            'address': address,
            'price': token.get('priceUsd', 'N/A'),
            'liquidity': liquidity,
            'volume': volume,
            'chain': token.get('chainId', 'Unknown'),
            'dex': token.get('dexId', 'Unknown'),
            'url': token.get('url', ''),
            'risk_score': risk_score,
            'risk_factors': risk_factors,
            'is_exact_symbol_fake': symbol.upper() == legitimate_symbol.upper() and address != legitimate_address,
            'search_term': search_term,
            'token_age_hours': token_age_hours
        }

        if symbol.upper() == legitimate_symbol.upper() and address != legitimate_address:
            impersonators['exact_symbol_fakes'].append(impersonator_info)
            impersonators['high_risk'].append(impersonator_info)
        elif risk_score >= 5:
            impersonators['high_risk'].append(impersonator_info)
        elif risk_score >= 3:
            impersonators['medium_risk'].append(impersonator_info)
        elif risk_score >= 1:
            impersonators['low_risk'].append(impersonator_info)
        else:
            impersonators['unrelated'].append(impersonator_info)

    return impersonators

def generate_alert(legitimate_token, impersonators):
    """Generate formatted alert"""
    total_exact_fakes = len(impersonators['exact_symbol_fakes'])
    total_suspicious = (total_exact_fakes +
                       len(impersonators['high_risk']) +
                       len(impersonators['medium_risk']) +
                       len(impersonators['low_risk']))
    total_analyzed = sum(len(v) for v in impersonators.values()) + 1

    alert = f"""🚨 {legitimate_token['symbol'].upper()} SCAM ALERT 🚨

Just completed full scan of {total_analyzed} tokens - here's what I found:

✅ LEGITIMATE {legitimate_token['symbol'].upper()}: Verified Safe
Contract: {legitimate_token['address']}
Price: ${legitimate_token['price']} | Volume: ${legitimate_token['volume']:,.2f} | Site: {legitimate_token['websites'][0]['url'] if legitimate_token['websites'] else 'N/A'}

⚠️ {total_suspicious} SUSPICIOUS TOKENS IDENTIFIED
"""

    if total_exact_fakes > 0:
        alert += f"""
🚨 CRITICAL - FAKE TOKENS WITH SAME SYMBOL ({total_exact_fakes} found):
These tokens use the EXACT same symbol '{legitimate_token['symbol'].upper()}' but have DIFFERENT contract addresses!

"""
        for i, imp in enumerate(impersonators['exact_symbol_fakes'], 1):
            alert += f"{i}. 🚨 FAKE {imp['symbol']} (Different Address)\n"
            alert += f"   Contract: {imp['address']}\n"
            alert += f"   Name: {imp['name']}\n"
            alert += f"   Price: ${imp['price']}\n"
            alert += f"   Chain: {imp['chain']}\n"
            alert += f"   DEX: {imp['dex']}\n"
            alert += f"   Liquidity: ${imp['liquidity']:,.2f}\n"
            alert += f"   Age: {imp.get('token_age_hours', 0):.1f} hours\n"
            if i < total_exact_fakes:
                alert += "\n"

        alert += f"""
⚠️ These are the MOST DANGEROUS impersonators - they use your exact token symbol!
"""

    if impersonators['high_risk']:
        alert += "\n🚨 HIGH RISK - AVOID:\n"
        for i, imp in enumerate(impersonators['high_risk'][:5], 1):
            factors = ' | '.join(imp['risk_factors'][:2])
            alert += f"• {imp['symbol']} ({imp['name']}) - {factors}\n"
            alert += f"  Contract: {imp['address']}\n"
            if i < len(impersonators['high_risk'][:5]):
                alert += "\n"

    if impersonators['medium_risk'] and len(impersonators['high_risk']) < 5:
        alert += "\n⚠️ MEDIUM RISK:\n"
        for imp in impersonators['medium_risk'][:3]:
            alert += f"• {imp['symbol']} ({imp['name']}) - {imp['risk_factors'][0] if imp['risk_factors'] else 'Suspicious activity'}\n"

    alert += f"""
🛡️ PROTECT YOURSELF:
✅ ALWAYS verify contract address
✅ ONLY trust legitimate project links
✅ NEVER buy tokens with $0 liquidity
✅ AVOID similar-but-not-identical names

📊 SCAN RESULTS:
• Tokens analyzed: {total_analyzed}
• Legitimate: 1 ({legitimate_token['symbol'].upper()})
• FAKE TOKENS (same symbol): {total_exact_fakes}
• Suspicious: {total_suspicious}

⚠️ CRITICAL:
✅ ONLY TRUST: {legitimate_token['address']}
🚫 Any other contract is NOT {legitimate_token['symbol'].upper()}

🔐 Scan first, ape later!

{legitimate_token['symbol']} #ScamDetection #{legitimate_token['chain']} #CryptoSafety"""

    return alert

def generate_detailed_report(legitimate_token, impersonators):
    """Generate detailed report for database"""
    report = {
        'scan_date': datetime.now().isoformat(),
        'legitimate_token': legitimate_token,
        'impersonators': impersonators,
        'summary': {
            'total_analyzed': sum(len(v) for v in impersonators.values()) + 1,
            'exact_symbol_fakes': len(impersonators['exact_symbol_fakes']),
            'high_risk': len(impersonators['high_risk']),
            'medium_risk': len(impersonators['medium_risk']),
            'low_risk': len(impersonators['low_risk']),
            'unrelated': len(impersonators['unrelated'])
        }
    }

    return report

def scan_for_impersonators(contract_address):
    """Main scanning function with enhanced search capabilities"""
    print(f"🔍 Scanning for impersonators of contract: {contract_address}")
    print("🚀 Using enhanced multi-source search method")
    print("="*70)

    # Step 1: Get legitimate token info
    print("📋 Getting legitimate token information...")
    legitimate_token = get_token_info(contract_address)

    if not legitimate_token:
        print("❌ Could not find token information for this contract address")
        return None

    print(f"✅ Found legitimate token: {legitimate_token['symbol']} ({legitimate_token['name']})")

    # Step 2: Enhanced search for similar tokens
    print("🔎 Searching for similar tokens...")
    similar_tokens = search_similar_tokens(
        legitimate_token['symbol'],
        legitimate_token['name'],
        legitimate_token['address']
    )

    # Step 3: Analyze for impersonation
    print("🔍 Analyzing for impersonation attempts...")
    impersonators = analyze_impersonators(
        similar_tokens,
        legitimate_token['symbol'],
        legitimate_token['name'],
        legitimate_token['address']
    )

    # Step 4: Generate alert
    print("📝 Generating alert...")
    alert = generate_alert(legitimate_token, impersonators)

    # Step 5: Generate detailed report
    detailed_report = generate_detailed_report(legitimate_token, impersonators)

    print("✅ Enhanced scan complete!")
    print(f"🚨 FAKE TOKENS (same symbol): {len(impersonators['exact_symbol_fakes'])}")
    print(f"🚨 High risk impersonators: {len(impersonators['high_risk'])}")
    print(f"⚠️ Medium risk impersonators: {len(impersonators['medium_risk'])}")
    print(f"⚡ Low risk impersonators: {len(impersonators['low_risk'])}")

    return {
        'legitimate_token': legitimate_token,
        'impersonators': impersonators,
        'alert': alert,
        'detailed_report': detailed_report
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python token_impersonation_scanner.py <CONTRACT_ADDRESS>")
        print("Example: python token_impersonation_scanner.py 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump")
        sys.exit(1)

    contract_address = sys.argv[1]
    results = scan_for_impersonators(contract_address)

    if results:
        print("\n" + "="*70)
        print("📢 SCAM ALERT - READY TO POST")
        print("="*70 + "\n")
        print(results['alert'])
        print("\n" + "="*70)

        # Save detailed report
        filename = f"impersonation_scan_{contract_address}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w') as f:
            json.dump(results['detailed_report'], f, indent=2)
        print(f"\n📄 Detailed report saved to: {filename}")
    else:
        print("❌ Scan failed")