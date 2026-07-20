# Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
# See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
# Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

#!/usr/bin/env python3
"""
Vendor Phone Verification — Brand Guard by Jeeevs / AgenticBro
===============================================================
Extends the existing phone scoring system with vendor-specific verification.
Detects business impersonation calls, verifies vendor legitimacy, and
cross-references phone numbers against scam operations.

This module layers ON TOP of phone_scorer.py — it adds:
  - Business phone pattern detection (legitimate vs. suspicious)
  - Vendor verification context (who they claim to be)
  - Cross-reference with scammer database
  - Impersonation script detection
  - Vendor-specific risk assessment and recommendations

Usage: python3 vendor-verify.py --phone "+1234567890" [--vendor "Acme Corp"] [--context "claiming to be our supplier"]
       echo '<phone_json>' | python3 vendor-verify.py --phone "+1234567890" --vendor "Acme Corp" --json
"""

import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

# ── Business Phone Patterns ──────────────────────────────────────────────────
# Legitimate business phones tend to have these characteristics
LEGITIMATE_BUSINESS_CARRIERS = [
    'at&t', 'verizon', 't-mobile', 'sprint', 'us cellular',
    'comcast', 'spectrum', 'cox', 'frontier', 'windstream',
    'centurylink', 'altice', 'cablevision', 'consolidated',
    'metropolitan', 'mci', 'level 3', 'zayo', 'cogent',
]

# VoIP carriers commonly used for business (legitimate)
BUSINESS_VOIP_CARRIERS = [
    'ringcentral', 'grasshopper', 'nextiva', '8x8', 'dialpad',
    'ooma', 'jive', 'vonage business', 'microsoft teams',
    'zoom phone', 'webex calling', 'google voice business',
]

# Carriers that are NEVER used by legitimate businesses
NEVER_BUSINESS_CARRIERS = [
    'textnow', 'textplus', 'pinger', 'sideline', 'dingtone',
    'burner', 'hushed', 'coverme', 'fongo', 'freephoneline',
]

# Known business area codes (US) - major metro areas
BUSINESS_AREA_CODES = {
    '212': 'Manhattan, NY', '646': 'Manhattan, NY', '332': 'Manhattan, NY',
    '310': 'Los Angeles, CA', '424': 'Los Angeles, CA', '213': 'Los Angeles, CA',
    '312': 'Chicago, IL', '773': 'Chicago, IL',
    '415': 'San Francisco, CA', '510': 'Oakland, CA',
    '617': 'Boston, MA', '857': 'Boston, MA',
    '202': 'Washington, DC',
    '303': 'Denver, CO',
    '404': 'Atlanta, GA', '678': 'Atlanta, GA',
    '214': 'Dallas, TX', '972': 'Dallas, TX',
    '713': 'Houston, TX',
    '602': 'Phoenix, AZ',
    '206': 'Seattle, WA',
    '503': 'Portland, OR',
    '305': 'Miami, FL',
    '702': 'Las Vegas, NV',
    '612': 'Minneapolis, MN',
}

# ── Vendor Impersonation Scam Scripts ────────────────────────────────────────
VENDOR_SCAM_PATTERNS = {
    'invoice_redirect': {
        'description': 'Caller claims to be a vendor requesting updated bank details for payment',
        'severity': 'critical',
        'points': 25,
        'keywords': ['bank details', 'update payment', 'new account', 'routing number',
                     'wire transfer', 'payment method', 'account change', 'direct deposit'],
    },
    'ceo_fraud': {
        'description': 'Caller impersonates CEO/executive requesting urgent wire transfer',
        'severity': 'critical',
        'points': 25,
        'keywords': ['urgent wire', 'ceo', 'executive', 'confidential', 'secret',
                     'immediate payment', 'do not discuss', 'personal matter'],
    },
    'tech_support': {
        'description': 'Caller claims to be from IT support requesting access or credentials',
        'severity': 'high',
        'points': 20,
        'keywords': ['tech support', 'microsoft support', 'apple security', 'virus',
                     'remote access', 'install', 'security alert', 'compromised'],
    },
    'supply_chain': {
        'description': 'Caller claims supplier change — new contact info or shipping address',
        'severity': 'high',
        'points': 20,
        'keywords': ['new supplier', 'shipping address', 'contact change', 'forwarding',
                     'redirect', 'new warehouse', 'logistics update'],
    },
    'account_verification': {
        'description': 'Caller claims to verify account and requests credentials or payment info',
        'severity': 'high',
        'points': 15,
        'keywords': ['verify your account', 'confirm identity', 'security check',
                     'unusual activity', 'login attempt', 'suspicious activity'],
    },
    'utility_impostor': {
        'description': 'Caller impersonates utility company threatening disconnection',
        'severity': 'medium',
        'points': 15,
        'keywords': ['power company', 'utility', 'disconnection', 'past due',
                     'shut off', 'service termination', 'final notice'],
    },
    'directory_listing': {
        'description': 'Caller claims to update business directory listing for a fee',
        'severity': 'low',
        'points': 10,
        'keywords': ['directory listing', 'google listing', 'yelp page', 'yellow pages',
                     'business listing', 'update your listing'],
    },
}


def load_scammer_database(db_path: str = '/Users/efinney/.openclaw/workspace/scammer-database.csv') -> List[Dict[str, Any]]:
    """Load the scammer database for cross-referencing."""
    scammers = []
    try:
        with open(db_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                scammers.append(row)
    except Exception:
        pass
    return scammers


def detect_vendor_scam_patterns(context: str) -> List[Dict[str, Any]]:
    """Detect known vendor impersonation scam patterns in the call context."""
    if not context:
        return []
    
    context_lower = context.lower()
    detected = []
    
    for pattern_name, pattern in VENDOR_SCAM_PATTERNS.items():
        for keyword in pattern['keywords']:
            if keyword in context_lower:
                detected.append({
                    'pattern': pattern_name,
                    'description': pattern['description'],
                    'severity': pattern['severity'],
                    'points': pattern['points'],
                    'keyword_matched': keyword,
                })
                break  # Only match each pattern once
    
    return detected


def assess_business_phone(phone_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Assess whether a phone number matches legitimate business patterns.
    
    Args:
        phone_data: Result from phone-verify.ts or phone_scorer.py
    
    Returns:
        Business phone assessment with legitimacy score and evidence.
    """
    carrier = (phone_data.get('carrier') or '').lower()
    line_type = (phone_data.get('line_type') or phone_data.get('lineType') or 'unknown').lower()
    country_code = (phone_data.get('country_code') or phone_data.get('countryCode') or '').upper()
    phone_num = phone_data.get('phone_number') or phone_data.get('phone') or ''
    is_valid = phone_data.get('valid', True) or phone_data.get('isValid', True)
    
    evidence = []
    legitimacy_score = 50  # Start neutral (0-100 scale)
    business_indicators = []
    suspicious_indicators = []
    
    # ── Line Type Assessment ────────────────────────────────────────────
    if line_type == 'landline':
        legitimacy_score += 15
        business_indicators.append('Landline — typical for established businesses')
        evidence.append('✅ Landline numbers are commonly used by legitimate businesses')
    elif line_type == 'mobile':
        legitimacy_score += 5
        business_indicators.append('Mobile — could be small business or personal')
        evidence.append('ℹ️ Mobile number — common for small businesses, less common for larger vendors')
    elif line_type == 'voip':
        legitimacy_score -= 10
        suspicious_indicators.append('VoIP — can be anonymous, not typical for established businesses')
        evidence.append('⚠️ VoIP number — can be created anonymously, uncommon for established vendor phone lines')
    elif line_type == 'toll_free':
        legitimacy_score += 10
        business_indicators.append('Toll-free — legitimate business line')
        evidence.append('✅ Toll-free numbers are commonly used by legitimate businesses')
    
    # ── Carrier Assessment ──────────────────────────────────────────────
    if any(c in carrier for c in LEGITIMATE_BUSINESS_CARRIERS):
        legitimacy_score += 20
        business_indicators.append(f'Major carrier: {carrier.title()}')
        evidence.append(f'✅ Major telecom carrier ({carrier.title()}) — typical for business lines')
    elif any(c in carrier for c in BUSINESS_VOIP_CARRIERS):
        legitimacy_score += 5
        business_indicators.append(f'Business VoIP: {carrier.title()}')
        evidence.append(f'ℹ️ Business VoIP carrier ({carrier.title()}) — legitimate for modern businesses')
    elif any(c in carrier for c in NEVER_BUSINESS_CARRIERS):
        legitimacy_score -= 30
        suspicious_indicators.append(f'Consumer/disposable carrier: {carrier.title()}')
        evidence.append(f'🚨 Consumer/disposable carrier ({carrier.title()}) — NEVER used by legitimate businesses')
    elif carrier and carrier not in ('unknown', ''):
        legitimacy_score += 0  # Unknown carrier, neutral
        evidence.append(f'ℹ️ Unknown carrier: {carrier.title()}')
    else:
        legitimacy_score -= 10
        suspicious_indicators.append('No carrier information available')
        evidence.append('⚠️ No carrier information — could indicate spoofing or virtual number')
    
    # ── Area Code Assessment ─────────────────────────────────────────────
    # Extract area code from US numbers
    digits = re.sub(r'[^0-9]', '', phone_num)
    if len(digits) >= 10 and digits.startswith('1'):
        area_code = digits[1:4]
        if area_code in BUSINESS_AREA_CODES:
            legitimacy_score += 5
            business_indicators.append(f'Major metro area code: {area_code} ({BUSINESS_AREA_CODES[area_code]})')
            evidence.append(f'✅ Area code {area_code} ({BUSINESS_AREA_CODES[area_code]}) — major business center')
    
    # ── Country Assessment ──────────────────────────────────────────────
    if country_code == 'US':
        legitimacy_score += 5
        evidence.append('✅ US number — common for domestic business vendors')
    elif country_code in ('CA', 'GB', 'AU', 'DE', 'JP'):
        legitimacy_score += 0  # Neutral — international but common business countries
        evidence.append(f'ℹ️ International number ({country_code}) — verify vendor has operations in this country')
    elif country_code in ('NG', 'GH', 'KE', 'PH', 'IN', 'PK', 'BD', 'RO', 'UA', 'RU', 'CM', 'SN'):
        legitimacy_score -= 20
        suspicious_indicators.append(f'High-risk country: {country_code}')
        evidence.append(f'🚨 Number from high-risk country ({country_code}) — common in business impersonation scams')
    
    # ── Toll-Free Assessment ─────────────────────────────────────────────
    if line_type == 'toll_free':
        # Toll-free is legitimate for businesses but can't be traced to a person
        legitimacy_score += 5
        evidence.append('ℹ️ Toll-free number — legitimate for businesses but cannot be traced to an individual')
    
    # ── Validity ──────────────────────────────────────────────────────────
    if not is_valid:
        legitimacy_score -= 40
        suspicious_indicators.append('Invalid phone number')
        evidence.append('🚨 Phone number failed validation — may be spoofed or disconnected')
    
    # Cap at 0-100
    legitimacy_score = max(0, min(100, legitimacy_score))
    
    # ── Determine Legitimacy Level ───────────────────────────────────────
    if legitimacy_score >= 75:
        legitimacy_level = 'LIKELY_LEGITIMATE'
        assessment = 'Phone number matches patterns of a legitimate business line'
    elif legitimacy_score >= 50:
        legitimacy_level = 'POSSIBLY_LEGITIMATE'
        assessment = 'Phone number has some legitimate business indicators but verification is recommended'
    elif legitimacy_score >= 25:
        legitimacy_level = 'SUSPICIOUS'
        assessment = 'Phone number has significant red flags for business impersonation'
    else:
        legitimacy_level = 'LIKELY_FRAUDULENT'
        assessment = 'Phone number shows strong indicators of vendor impersonation or fraud'
    
    return {
        'legitimacy_score': legitimacy_score,
        'legitimacy_level': legitimacy_level,
        'assessment': assessment,
        'business_indicators': business_indicators,
        'suspicious_indicators': suspicious_indicators,
        'evidence': evidence,
        'line_type_assessment': line_type,
        'carrier_assessment': carrier.title() if carrier else 'Unknown',
    }


def verify_vendor_phone(
    phone: str,
    vendor_name: str = '',
    context: str = '',
    phone_data: Optional[Dict[str, Any]] = None,
    scammer_db_path: str = '/Users/efinney/.openclaw/workspace/scammer-database.csv',
) -> Dict[str, Any]:
    """
    Main vendor verification function.
    
    Args:
        phone: Phone number to verify (E.164 format preferred)
        vendor_name: Name of the vendor the caller claims to be
        context: Additional context about the call (what they said, claimed, etc.)
        phone_data: Pre-existing phone scan data (if available)
        scammer_db_path: Path to scammer database CSV
    
    Returns:
        Vendor verification result with business assessment, scam detection, and recommendations.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # ── Step 1: Business Phone Assessment ──────────────────────────────────
    if phone_data:
        business_assessment = assess_business_phone(phone_data)
    else:
        # Minimal assessment from phone number alone
        business_assessment = assess_business_phone({
            'phone': phone,
            'carrier': '',
            'line_type': 'unknown',
            'country_code': phone[:2] if phone.startswith('+') else '1',
            'valid': True,
        })
    
    # ── Step 2: Vendor Scam Pattern Detection ──────────────────────────────
    scam_patterns = detect_vendor_scam_patterns(context) if context else []
    scam_pattern_score = sum(p['points'] for p in scam_patterns)
    scam_pattern_score = min(scam_pattern_score, 50)  # Cap at 50
    
    # ── Step 3: Scammer Database Cross-Reference ────────────────────────────
    scammer_matches = []
    scammers = load_scammer_database(scammer_db_path)
    phone_digits = re.sub(r'[^0-9]', '', phone)
    
    for scammer in scammers:
        # Check if phone appears in scammer data
        scammer_text = json.dumps(scammer).lower()
        # Look for phone patterns in the scammer entry
        if phone_digits[-7:] in scammer_text or phone_digits[-10:] in scammer_text:
            scammer_matches.append({
                'name': scammer.get('Scammer Name', 'Unknown'),
                'platform': scammer.get('Platform', 'Unknown'),
                'type': scammer.get('Scam Type', 'Unknown'),
                'risk': scammer.get('Verification Level', 'Unknown'),
            })
    
    # Also check vendor name against scammer database
    if vendor_name:
        vendor_lower = vendor_name.lower()
        for scammer in scammers:
            scammer_name = (scammer.get('Scammer Name') or '').lower()
            if vendor_lower in scammer_name or scammer_name in vendor_lower:
                scammer_matches.append({
                    'name': scammer.get('Scammer Name', 'Unknown'),
                    'platform': scammer.get('Platform', 'Unknown'),
                    'type': scammer.get('Scam Type', 'Unknown'),
                    'risk': scammer.get('Verification Level', 'Unknown'),
                    'match': f'Vendor name "{vendor_name}" matches known scammer "{scammer.get("Scammer Name")}"',
                })
    
    # ── Step 4: Calculate Vendor Verification Score ─────────────────────────
    # Start with business legitimacy assessment (0-100)
    vendor_score = business_assessment['legitimacy_score']
    
    # Subtract scam pattern points (converted to 0-50 penalty)
    vendor_score -= scam_pattern_score
    
    # Subtract for scammer database matches
    if scammer_matches:
        vendor_score -= min(25, len(scammer_matches) * 10)
    
    # Vendor name mismatch check (if they claim to be from a specific company
    # but the phone doesn't match expected patterns)
    if vendor_name and business_assessment['suspicious_indicators']:
        vendor_score -= 10  # Suspicious phone for someone claiming to be a vendor
    
    # Cap at 0-100
    vendor_score = max(0, min(100, vendor_score))
    
    # ── Step 5: Determine Verification Level ──────────────────────────────
    if vendor_score >= 80:
        verification_level = 'VERIFIED'
        verification_message = 'Phone number is consistent with a legitimate business vendor'
    elif vendor_score >= 60:
        verification_level = 'LIKELY_LEGITIMATE'
        verification_message = 'Phone number appears legitimate but independent verification is recommended'
    elif vendor_score >= 40:
        verification_level = 'UNVERIFIED'
        verification_message = 'Phone number cannot be verified as belonging to the claimed vendor — verify through official channels'
    elif vendor_score >= 20:
        verification_level = 'SUSPICIOUS'
        verification_message = 'Phone number shows red flags consistent with vendor impersonation — do NOT share information or make payments'
    else:
        verification_level = 'LIKELY_FRAUDULENT'
        verification_message = 'Phone number has strong indicators of fraud — terminate contact and report'
    
    # ── Step 6: Generate Recommendations ─────────────────────────────────────
    recommendations = []
    
    if scam_patterns:
        for pattern in scam_patterns[:3]:
            recommendations.append(f'🚨 {pattern["description"]} — Severity: {pattern["severity"].upper()}')
    
    if scammer_matches:
        recommendations.append(f'🚨 Phone number found in scammer database ({len(scammer_matches)} match(es))')
    
    if business_assessment['suspicious_indicators']:
        for indicator in business_assessment['suspicious_indicators'][:3]:
            recommendations.append(f'⚠️ {indicator}')
    
    # Always add verification recommendation
    if vendor_name:
        recommendations.append(f'📞 Verify "{vendor_name}" by calling their official phone number from their website or a trusted directory')
        recommendations.append('📧 Confirm vendor identity via official email domain, not the phone number they called from')
    
    recommendations.append('🔒 Never share bank details, passwords, or make payments based on an unsolicited call')
    
    if vendor_score < 40:
        recommendations.append('📋 Report this number to FTC: reportfraud.ftc.gov')
    
    # ── Step 7: Build Final Result ──────────────────────────────────────────
    result = {
        'success': True,
        'phone': phone,
        'vendor_name': vendor_name or None,
        'context': context or None,
        'verification': {
            'score': vendor_score,
            'level': verification_level,
            'message': verification_message,
        },
        'business_assessment': {
            'legitimacy_score': business_assessment['legitimacy_score'],
            'legitimacy_level': business_assessment['legitimacy_level'],
            'line_type': business_assessment['line_type_assessment'],
            'carrier': business_assessment['carrier_assessment'],
            'business_indicators': business_assessment['business_indicators'],
            'suspicious_indicators': business_assessment['suspicious_indicators'],
        },
        'scam_detection': {
            'patterns_detected': scam_patterns,
            'pattern_score': scam_pattern_score,
            'scammer_db_matches': scammer_matches,
            'scammer_db_match_count': len(scammer_matches),
        },
        'evidence': business_assessment['evidence'],
        'recommendations': recommendations,
        'scan_date': timestamp,
        'disclaimer': 'Educational purposes only. Not financial advice. Not a guarantee of safety. Always verify vendor identity independently.',
    }
    
    return result


def main():
    parser = argparse.ArgumentParser(description='Vendor Phone Verification — Brand Guard')
    parser.add_argument('--phone', required=True, help='Phone number (E.164 format, e.g., +1234567890)')
    parser.add_argument('--vendor', default='', help='Vendor name the caller claims to represent')
    parser.add_argument('--context', default='', help='Context about the call (what they said, claimed, etc.)')
    parser.add_argument('--scammer-db', default='/Users/efinney/.openclaw/workspace/scammer-database.csv', help='Path to scammer database')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    args = parser.parse_args()
    
    result = verify_vendor_phone(
        phone=args.phone,
        vendor_name=args.vendor,
        context=args.context,
        scammer_db_path=args.scammer_db,
    )
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('📞 VENDOR PHONE VERIFICATION — Brand Guard')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print()
        print(f'Phone: {args.phone}')
        if args.vendor:
            print(f'Claimed Vendor: {args.vendor}')
        if args.context:
            print(f'Call Context: {args.context}')
        print()
        print(f'Verification Score: {result["verification"]["score"]}/100')
        print(f'Verification Level: {result["verification"]["level"]}')
        print(f'Assessment: {result["verification"]["message"]}')
        print()
        print('Business Phone Assessment:')
        print(f'  Legitimacy: {result["business_assessment"]["legitimacy_score"]}/100 ({result["business_assessment"]["legitimacy_level"]})')
        print(f'  Line Type: {result["business_assessment"]["line_type"]}')
        print(f'  Carrier: {result["business_assessment"]["carrier"]}')
        if result["business_assessment"]["business_indicators"]:
            print('  ✅ Business Indicators:')
            for i in result["business_assessment"]["business_indicators"]:
                print(f'    • {i}')
        if result["business_assessment"]["suspicious_indicators"]:
            print('  ⚠️ Suspicious Indicators:')
            for s in result["business_assessment"]["suspicious_indicators"]:
                print(f'    • {s}')
        print()
        if result["scam_detection"]["patterns_detected"]:
            print('🚨 Scam Patterns Detected:')
            for p in result["scam_detection"]["patterns_detected"]:
                print(f'  • [{p["severity"].upper()}] {p["description"]} (matched: "{p["keyword_matched"]}")')
            print()
        if result["scam_detection"]["scammer_db_match_count"] > 0:
            print(f'🚨 Scammer Database Matches: {result["scam_detection"]["scammer_db_match_count"]}')
            for m in result["scam_detection"]["scammer_db_matches"][:3]:
                print(f'  • {m["name"]} — {m["type"]} ({m["risk"]})')
            print()
        print('Evidence:')
        for e in result["evidence"]:
            print(f'  {e}')
        print()
        print('Recommendations:')
        for r in result["recommendations"]:
            print(f'  {r}')
        print()
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('⚠️ DISCLAIMER: Educational purposes only. Not financial advice.')
        print('   Not a guarantee of safety. Always verify independently.')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    return 0


if __name__ == '__main__':
    sys.exit(main())