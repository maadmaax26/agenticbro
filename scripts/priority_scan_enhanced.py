#!/usr/bin/env python3
"""
Priority Scan Integration with Enhanced Token Impersonation Detection
Integrates the enhanced scanner with priority scan functionality
"""
import json
import requests
import sys
from datetime import datetime
from token_impersonation_scanner import scan_for_impersonators

def run_priority_scan(contracts, symbols, max_tokens=50):
    """
    Run priority scan for multiple tokens and symbols
    Using enhanced token impersonation detection
    """
    print("\n" + "="*70)
    print("━━━ 🔍 PRIORITY SCAN — AI POWERED THREAT ASSESSMENT ━━━")
    print("="*70)
    print("\n⚠️  DISCLAIMER NOTICE")
    print("This scan is an AI-powered threat assessment of token contracts and social media content.")
    print("For complete accuracy, verify information through multiple sources.")
    print("\nLIMITATIONS:")
    print("• Only scans publicly available data")
    print("• Does NOT verify contract ownership")
    print("• May miss sophisticated, well-hidden impersonators")
    print("• Subject to API rate limits and timing")
    print("\nINDEPENDENT VERIFICATION REQUIRED:")
    print("• Cross-check contract addresses manually")
    print("• Never send tokens based on AI assessment alone")
    print("• Verify official communication channels")
    print("\n" + "="*70)
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("\n🚀 PRIORITY SCAN - Enhanced Token Impersonation Detection")
    print("=" * 70)
    print(f"Target Contracts: {len(contracts)}")
    print(f"Target Symbols: {len(symbols)}")
    print(f"Max tokens to scan: {max_tokens}")
    print()
    
    all_results = []
    scan_count = 0
    
    # Scan contracts
    print("🔍 Scanning contract addresses...")
    for i, contract in enumerate(contracts[:max_tokens], 1):
        print(f"{i}/{len(contracts)}: Scanning {contract}...")
        result = scan_for_impersonators(contract)
        if result:
            all_results.append({
                'type': 'contract',
                'identifier': contract,
                'scan_type': 'token_impersonation',
                'result': result
            })
            scan_count += 1
    
    # Scan symbols (if any)
    if symbols:
        print("🔍 Scanning for symbol matches...")
        for symbol in symbols:
            # First find tokens with this symbol
            try:
                url = f"https://api.dexscreener.com/latest/dex/search?q={symbol}&limit=20"
                response = requests.get(url, timeout=10)
                data = response.json()
                
                for pair in data.get('pairs', []):
                    token = pair.get('baseToken', {})
                    address = token.get('address', '')
                    
                    # Skip if we already scanned this address
                    if address and address not in [r.get('identifier') for r in all_results if r['type'] == 'contract']:
                        print(f"  Found {symbol} token: {address} - running enhanced scan...")
                        result = scan_for_impersonators(address)
                        if result:
                            all_results.append({
                                'type': 'symbol',
                                'identifier': symbol,
                                'contract_address': address,
                                'scan_type': 'token_impersonation',
                                'result': result
                            })
                            scan_count += 1
                            
                            # Break after first token to avoid scanning all tokens
                            break
            except Exception as e:
                print(f"  Error searching for {symbol}: {e}")
    
    # Analyze results
    print(f"\n📊 PRIORITY SCAN RESULTS:")
    print("=" * 70)
    print(f"Total scans completed: {scan_count}")
    print(f"Results found: {len(all_results)}")
    print()
    
    # Find high-risk findings
    high_risk = []
    for scan_result in all_results:
        result = scan_result.get('result', {})
        impersonators = result.get('impersonators', {})
        
        # Check for exact symbol fakes
        if len(impersonators.get('exact_symbol_fakes', [])) > 0:
            high_risk.append({
                'type': scan_result['type'],
                'identifier': scan_result['identifier'],
                'risk_level': 'CRITICAL',
                'findings': f"{len(impersonators['exact_symbol_fakes'])} exact symbol fakes found"
            })
        
        # Check for high risk tokens
        if len(impersonators.get('high_risk', [])) > 0:
            high_risk.append({
                'type': scan_result['type'],
                'identifier': scan_result['identifier'],
                'risk_level': 'HIGH',
                'findings': f"{len(impersonators['high_risk'])} high-risk tokens found"
            })
    
    # Generate priority alert
    if high_risk:
        alert = generate_priority_alert(high_risk)
        print("🚨 PRIORITY ALERT GENERATED")
        print("=" * 70)
        print(alert)
        print("=" * 70)
    else:
        print("✅ PRIORITY SCAN COMPLETE - No Critical Threats Found")
        print("=" * 70)
    
    # Save detailed report
    report = {
        'scan_date': datetime.now().isoformat(),
        'priority_scan_config': {
            'contracts': contracts,
            'symbols': symbols,
            'max_tokens': max_tokens
        },
        'results': all_results,
        'scan_count': scan_count,
        'high_risk_count': len(high_risk),
        'high_risk_findings': high_risk
    }
    
    filename = f"priority_scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Report saved to: {filename}")
    
    return {
        'scan_count': scan_count,
        'results': all_results,
        'high_risk': high_risk,
        'report_file': filename,
        'alert': alert if high_risk else None
    }

def generate_priority_alert(high_risk_findings):
    """Generate priority alert for high-risk findings"""
    alert = f"""🚨 PRIORITY SCAN ALERT 🚨

Critical security threats detected!

HIGH RISK FINDINGS:

"""
    for i, finding in enumerate(high_risk_findings, 1):
        alert += f"""
{i}. {finding['type'].upper()}: {finding['identifier']}
   Risk Level: {finding['risk_level']}
   {finding['findings']}
"""
    
    alert += f"""
🛡️ IMMEDIATE ACTION REQUIRED:
• Investigate each high-risk finding
• Block/Report identified threats
• Update scammer database
• Warn community immediately

📊 SCAN SUMMARY:
• High-risk findings: {len(high_risk_findings)}
• Total scans: {len([f for f in high_risk_findings if f['type'] == 'contract'])} contracts + len([f for f in high_risk_findings if f['type'] == 'symbol'])} symbols

🔐 Scan first, ape later!

#PriorityScan #SecurityAlert #CryptoSafety"""

    return alert

if __name__ == "__main__":
    # Test with AGNTCBRO contract
    test_contracts = [
        "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"  # AGNTCBRO legitimate
    ]
    
    test_symbols = ["AGNTCBRO"]
    
    print("Running priority scan with enhanced detection...")
    results = run_priority_scan(test_contracts, test_symbols)
    
    print(f"\n✅ Priority scan complete")
    print(f"📊 Scans completed: {results['scan_count']}")
    print(f"🚨 High-risk findings: {results['high_risk_count']}")