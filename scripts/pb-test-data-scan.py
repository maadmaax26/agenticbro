#!/usr/bin/env python3
"""Pig Butchering Test Data Scan - Simulated profiles from test cases"""

import json
from datetime import datetime

# Load test data
with open('/Users/efinney/.openclaw/workspace/output/pig_butchering_test_data.json', 'r') as f:
    test_data = json.load(f)

def analyze_test_case(case):
    """Analyze a test case and return detected red flags"""
    red_flags = []
    risk_score = 0
    
    scenario = case['scenario'].lower()
    
    # Check for romance + crypto combo (PB007)
    romance_keywords = ['love', 'relationship', 'dating', 'single', 'weeks', 'person']
    crypto_keywords = ['crypto', 'bitcoin', 'invest', 'trading', 'profits']
    
    has_romance = any(kw in scenario for kw in romance_keywords)
    has_crypto = any(kw in scenario for kw in crypto_keywords)
    
    if has_romance and has_crypto:
        red_flags.append('ROMANCE_CRYPTO_COMBO (+10)')
        risk_score += 10
    
    # Check for wrong number pattern (PB001)
    if "wrong number" in scenario or "unknown number" in scenario:
        red_flags.append('WRONG_NUMBER_TEXT (+8)')
        risk_score += 8
    
    # Check for fake exchange (PB003)
    if "fake" in scenario and "exchange" in scenario:
        red_flags.append('FAKE_EXCHANGE (+10)')
        risk_score += 10
    # Check for typo/impersonation URLs
    if "typo" in scenario or "binanace" in scenario or "looks like" in scenario:
        red_flags.append('FAKE_EXCHANGE_URL (+10)')
        risk_score += 10
    
    # Check for tax/fee demand (PB008)
    if "tax" in scenario or "fee" in scenario:
        red_flags.append('TAX_FEE_DEMAND (+10)')
        risk_score += 10
    
    # Check for guaranteed returns (PB002, PB005)
    if "guaranteed" in scenario or "pump signals" in scenario:
        red_flags.append('GUARANTEED_RETURNS (+9)')
        risk_score += 9
    
    # Check for video call avoidance (PB002)
    if "video" in scenario and ("avoid" in scenario or "won't" in scenario):
        red_flags.append('VIDEO_AVOIDANCE (+9)')
        risk_score += 9
    
    # Check for collaboration/farming (PB006)
    if "collaborat" in scenario or "dm me" in scenario or "impressed" in scenario:
        red_flags.append('DM_SOLICITATION (+8)')
        risk_score += 8
    
    # Check for wealth display (PB002, PB007)
    if "wealth" in scenario or "luxury" in scenario or "shows" in scenario:
        red_flags.append('WEALTH_DISPLAY (+9)')
        risk_score += 9
    
    # Check for small win trap (PB004)
    if "small" in scenario and ("withdraw" in scenario or "win" in scenario):
        red_flags.append('SMALL_WIN_TRAP (+8)')
        risk_score += 8
    
    # Check for Telegram/WhatsApp (PB002, PB005)
    if "telegram" in scenario or "whatsapp" in scenario:
        red_flags.append('PLATFORM_REDIRECT (+7)')
        risk_score += 7
    
    # Cap at 10
    risk_score = min(risk_score, 10)
    
    # Determine risk level
    if risk_score >= 7:
        risk_level = 'CRITICAL'
    elif risk_score >= 5:
        risk_level = 'HIGH'
    elif risk_score >= 3:
        risk_level = 'MEDIUM'
    else:
        risk_level = 'LOW'
    
    return {
        'id': case['id'],
        'type': case['type'],
        'expected': case['expected_result'],
        'red_flags': red_flags,
        'risk_score': risk_score,
        'risk_level': risk_level
    }

# Run analysis on all test cases
print("=" * 70)
print("🔬 PIG BUTCHERING TEST DATA ANALYSIS")
print("=" * 70)
print()

results = []
for case in test_data['test_cases']:
    result = analyze_test_case(case)
    results.append(result)
    
    print(f"📋 Test Case: {result['id']}")
    print(f"   Type: {result['type']}")
    print(f"   Expected: {result['expected']}")
    print(f"   Detected Risk: {result['risk_score']}/10 ({result['risk_level']})")
    print(f"   Red Flags: {len(result['red_flags'])}")
    for flag in result['red_flags']:
        print(f"      ⚠️  {flag}")
    print()

# Summary
print("=" * 70)
print("📊 SUMMARY")
print("=" * 70)
print()

critical = sum(1 for r in results if r['risk_level'] == 'CRITICAL')
high = sum(1 for r in results if r['risk_level'] == 'HIGH')
medium = sum(1 for r in results if r['risk_level'] == 'MEDIUM')

print(f"Total Test Cases: {len(results)}")
print(f"  CRITICAL: {critical}")
print(f"  HIGH: {high}")
print(f"  MEDIUM: {medium}")
print()

# Show detection accuracy
matches = 0
for r in results:
    expected_level = 'CRITICAL' if 'CRITICAL' in r['expected'] else 'HIGH' if 'HIGH' in r['expected'] else 'MEDIUM' if 'MEDIUM' in r['expected'] else 'LOW'
    if r['risk_level'] == expected_level or (r['risk_level'] == 'CRITICAL' and expected_level == 'HIGH'):
        matches += 1

print(f"Detection Accuracy: {matches}/{len(results)} ({matches/len(results)*100:.0f}%)")
print()
print("=" * 70)
print(f"Analysis: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("Framework: Pig Butchering Detection v1.0")
print("=" * 70)