# Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
# See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
# Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

#!/usr/bin/env python3
"""
Takedown Template Generator — Brand Guard by Jeeevs / AgenticBro
================================================================
Generates pre-populated takedown request templates for each platform.
Includes platform abuse report forms, cease & desist letters, and
evidence package summaries.

Usage:
  python3 takedown-templates.py --platform x --target "@agenticbro_support" --brand "Agentic Bro" --type impersonation
  python3 takedown-templates.py --platform domain --target "loginagenticbro.app" --brand "Agentic Bro" --type phishing [--json]
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional


# ── Platform Abuse Report URLs ────────────────────────────────────────────────
PLATFORM_REPORT_URLS = {
    'x': {
        'name': 'X (Twitter)',
        'url': 'https://help.x.com/en/forms/general/safety',
        'form_type': 'online_form',
        'report_category': 'Impersonation',
        'steps': [
            'Go to https://help.x.com/en/forms/general/safety',
            'Select "Impersonation" as the issue type',
            'Enter the impersonating account @handle',
            'Provide your legitimate account @handle',
            'Upload screenshot evidence of the impersonation',
            'Submit and note the reference number',
        ],
    },
    'instagram': {
        'name': 'Instagram',
        'url': 'https://help.instagram.com/contact/complaint_form',
        'form_type': 'online_form',
        'report_category': 'Impersonation',
        'steps': [
            'Go to https://help.instagram.com/contact/complaint_form',
            'Select "Impersonation" as the issue',
            'Enter the impersonating account username',
            'Provide your legitimate account username',
            'Upload screenshot evidence',
            'Instagram typically responds within 24-48 hours',
        ],
    },
    'tiktok': {
        'name': 'TikTok',
        'url': 'https://www.tiktok.com/legal/report',
        'form_type': 'online_form',
        'report_category': 'Impersonation',
        'steps': [
            'Go to https://www.tiktok.com/legal/report',
            'Select "Impersonation" as the violation type',
            'Enter the impersonating account username',
            'Provide your legitimate account link',
            'Upload screenshot evidence',
            'TikTok typically responds within 1-3 business days',
        ],
    },
    'facebook': {
        'name': 'Facebook',
        'url': 'https://www.facebook.com/help/contact/361417823876055',
        'form_type': 'online_form',
        'report_category': 'Impersonation',
        'steps': [
            'Go to https://www.facebook.com/help/contact/361417823876055',
            'Select the type of impersonation (Profile, Page, or Group)',
            'Enter the impersonating account URL',
            'Provide your legitimate Page or Profile URL',
            'Upload government ID or business documentation',
            'Facebook typically responds within 24-48 hours',
        ],
    },
    'telegram': {
        'name': 'Telegram',
        'url': 'https://t.me/abuse',
        'form_type': 'bot_report',
        'report_category': 'Scam/Phishing',
        'steps': [
            'Open https://t.me/abuse in Telegram',
            'Follow the bot instructions to report the channel',
            'Provide the channel username or link',
            'Describe the scam or impersonation',
            'Note: Telegram requires clear evidence of fraud or impersonation',
        ],
    },
    'linkedin': {
        'name': 'LinkedIn',
        'url': 'https://www.linkedin.com/help/linking/answer/83592',
        'form_type': 'online_form',
        'report_category': 'Impersonation',
        'steps': [
            'Go to https://www.linkedin.com/help/linking/answer/83592',
            'Select "Impersonation" as the issue',
            'Enter the impersonating profile URL',
            'Provide your legitimate LinkedIn Company Page URL',
            'Upload business verification documentation',
            'LinkedIn typically responds within 1-3 business days',
        ],
    },
    'domain_registrar': {
        'name': 'Domain Registrar',
        'url': 'https://www.icann.org/resources/pages/complaints',
        'form_type': 'registrar_complaint',
        'report_category': 'Phishing/Trademark Infringement',
        'steps': [
            'Look up the domain registrar via WHOIS (https://www.whois.com/whois/DOMAIN)',
            'File an abuse report with the registrar directly',
            'If registrar is unresponsive, file with ICANN',
            'Include trademark registration documentation',
            'Domain suspensions typically take 24-72 hours after abuse report',
        ],
    },
    'phone_carrier': {
        'name': 'Phone Carrier',
        'url': 'https://reportfraud.ftc.gov/',
        'form_type': 'ftc_report',
        'report_category': 'Phone Fraud',
        'steps': [
            'File a report with the FTC at https://reportfraud.ftc.gov/',
            'Report the phone number and describe the scam',
            'If the number is VoIP, report to the VoIP provider (TextNow, Google Voice, etc.)',
            'For business impersonation, also file with the carrier',
            'Consider adding the number to the National Do Not Call Registry',
        ],
    },
    'legal': {
        'name': 'Legal Action',
        'url': '',
        'form_type': 'cease_and_desist',
        'report_category': 'Cease and Desist',
        'steps': [
            'Consult with an intellectual property attorney',
            'Draft a cease and desist letter (template available below)',
            'Send via certified mail to the infringing party',
            'Document all communications',
            'If no response within 14 days, consider filing a DMCA takedown or lawsuit',
        ],
    },
}


def generate_cease_and_desist(
    brand_name: str,
    brand_handle: str,
    brand_domain: str,
    target_name: str,
    target_platform: str,
    target_url: str,
    threat_type: str,
    evidence: List[str],
    owner_name: str = 'Brand Owner',
    owner_title: str = 'Brand Protection Officer',
) -> str:
    """Generate a cease and desist letter template."""
    date = datetime.now(timezone.utc).strftime('%B %d, %Y')
    
    letter = f"""CEASE AND DESIST LETTER

Date: {date}

FROM: {owner_name}
      {owner_title}
      {brand_name}

TO: [Infringing Party Name]
    [Infringing Party Address, if known]
    Via: {target_platform}

RE: Unauthorized Use of "{brand_name}" Brand and Impersonation

Dear Sir/Madam,

This letter serves as formal notice that you are hereby directed to CEASE AND DESIST all unauthorized use of the "{brand_name}" brand, including but not limited to the following:

1. IMPERSONATION: The account/profile at {target_url} is impersonating the legitimate {brand_name} brand (@{brand_handle}).

2. TRADEMARK INFRINGEMENT: Your use of the "{brand_name}" name, likeness, and/or branding constitutes trademark infringement under applicable federal and state laws.

3. EVIDENCE: The following evidence documents the infringement:
"""
    
    for i, e in enumerate(evidence[:10], 1):
        letter += f"   {i}. {e}\n"
    
    letter += f"""
4. DEMAND: We demand that you immediately:
   a) Remove all infringing content, profiles, and accounts;
   b) Cease all use of the "{brand_name}" name, branding, and trademarks;
   c) Transfer or delete any domain names that incorporate the "{brand_name}" trademark;
   d) Provide written confirmation of compliance within 14 days.

5. RESERVATION OF RIGHTS: {brand_name} reserves all rights and remedies available under law, including but not limited to:
   - The Lanham Act (15 U.S.C. §§ 1114, 1125)
   - State unfair competition laws
   - Common law trademark rights
   - Anti-cybersquatting Consumer Protection Act (15 U.S.C. § 1125(d))

6. FAILURE TO COMPLY: If you do not comply with this demand within 14 days of receipt, we will pursue all available legal remedies, including seeking injunctive relief, actual damages, and statutory damages.

This letter does not constitute a complete statement of our rights, and we reserve the right to assert additional claims and remedies.

Sincerely,

{owner_name}
{owner_title}
{brand_name}
{brand_domain}

---
DISCLAIMER: This template is provided for educational purposes only and does not constitute legal advice. Consult with a qualified attorney before sending any legal correspondence.
"""
    return letter


def generate_evidence_package(
    brand_name: str,
    brand_handle: str,
    target_name: str,
    target_platform: str,
    threat_type: str,
    risk_score: float,
    risk_level: str,
    evidence: List[str],
) -> str:
    """Generate an evidence package summary for takedown requests."""
    date = datetime.now(timezone.utc).strftime('%B %d, %Y %H:%M UTC')
    
    package = f"""EVIDENCE PACKAGE — Brand Guard by Jeeevs / AgenticBro
=====================================================

Generated: {date}
Report Type: {threat_type.replace('_', ' ').title()}
Brand: {brand_name} (@{brand_handle})
Target: {target_name} on {target_platform}
Risk Score: {risk_score}/10 ({risk_level})

EVIDENCE SUMMARY:
"""
    for i, e in enumerate(evidence, 1):
        package += f"  {i}. {e}\n"
    
    package += f"""
RECOMMENDED ACTIONS:
  1. Take screenshots of the infringing content (with timestamps)
  2. Save the profile URL and any relevant posts/DMs
  3. Document the risk score and red flags from Brand Guard scan
  4. Compile this evidence package with the platform-specific abuse report
  5. Submit the abuse report via the platform's reporting mechanism

PLATFORM ABUSE REPORT URL: {PLATFORM_REPORT_URLS.get(target_platform.lower(), {}).get('url', 'N/A')}

---
This evidence package was generated by Brand Guard by Jeeevs / AgenticBro.
Educational purposes only. Not financial advice. Not a guarantee of safety.
"""
    return package


def generate_template(
    platform: str,
    target: str,
    brand_name: str,
    brand_handle: str,
    brand_domain: str,
    threat_type: str,
    risk_score: float = 0,
    risk_level: str = 'MEDIUM',
    evidence: List[str] = None,
    owner_name: str = 'Brand Owner',
) -> Dict[str, Any]:
    """Generate a complete takedown template for a given platform and threat."""
    evidence = evidence or []
    platform_lower = platform.lower()
    
    # Get platform info
    platform_info = PLATFORM_REPORT_URLS.get(platform_lower, {
        'name': platform,
        'url': '',
        'form_type': 'online_form',
        'report_category': 'Impersonation',
        'steps': ['File a report with the platform directly'],
    })
    
    template = {
        'platform': platform,
        'platform_name': platform_info['name'],
        'target': target,
        'threat_type': threat_type,
        'risk_score': risk_score,
        'risk_level': risk_level,
        'report_url': platform_info['url'],
        'report_category': platform_info['report_category'],
        'form_type': platform_info['form_type'],
        'filing_steps': platform_info['steps'],
        'evidence_items': evidence,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'brand': {
            'name': brand_name,
            'handle': brand_handle,
            'domain': brand_domain,
        },
    }
    
    # Add platform-specific template content
    if threat_type == 'impersonation':
        template['report_subject'] = f'Impersonation Report: {target} impersonating {brand_name}'
        template['report_body'] = (
            f'I am writing to report an account that is impersonating {brand_name} (@{brand_handle}).\n\n'
            f'The account {target} on {platform_info["name"]} is using our brand name, '
            f'branding, and/or trademarks without authorization.\n\n'
            f'Our legitimate account is @{brand_handle} ({brand_domain}).\n\n'
            f'This impersonation constitutes trademark infringement and may be '
            f'used to deceive customers and business partners.\n\n'
            f'Please remove this impersonating account as soon as possible.'
        )
    elif threat_type == 'phishing':
        template['report_subject'] = f'Phishing Report: {target} phishing for {brand_name}'
        template['report_body'] = (
            f'I am writing to report a phishing site/account that is targeting {brand_name} customers.\n\n'
            f'The domain/profile {target} is designed to deceive users into believing '
            f'they are interacting with the legitimate {brand_name} brand.\n\n'
            f'Our legitimate website is {brand_domain}.\n\n'
            f'This phishing operation poses a significant risk to our customers and brand reputation.'
        )
    elif threat_type == 'phone_scam':
        template['report_subject'] = f'Phone Scam Report: {target} impersonating {brand_name}'
        template['report_body'] = (
            f'I am writing to report a phone number that is being used to impersonate {brand_name}.\n\n'
            f'The number {target} is being used in a business impersonation scam, '
            f'claiming to represent {brand_name}.\n\n'
            f'Our legitimate contact information is available at {brand_domain}.'
        )
    else:
        template['report_subject'] = f'Brand Protection Report: {target}'
        template['report_body'] = (
            f'I am writing to report unauthorized use of the {brand_name} brand.\n\n'
            f'The entity at {target} is misusing our brand name and/or trademarks.\n\n'
            f'Our legitimate brand information is at {brand_domain}.'
        )
    
    # Add cease and desist if legal
    if platform_lower == 'legal':
        template['cease_and_desist'] = generate_cease_and_desist(
            brand_name, brand_handle, brand_domain,
            target, platform, target, threat_type, evidence,
            owner_name=owner_name,
        )
    
    # Add evidence package
    template['evidence_package'] = generate_evidence_package(
        brand_name, brand_handle, target, platform,
        threat_type, risk_score, risk_level, evidence,
    )
    
    return template


def main():
    parser = argparse.ArgumentParser(description='Takedown Template Generator — Brand Guard')
    parser.add_argument('--platform', required=True, 
                       choices=['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin', 'domain_registrar', 'phone_carrier', 'legal'],
                       help='Target platform')
    parser.add_argument('--target', required=True, help='Target account/domain/phone to report')
    parser.add_argument('--brand', required=True, help='Your brand name')
    parser.add_argument('--handle', required=True, help='Your brand handle (e.g., @agenticbro)')
    parser.add_argument('--domain', default='', help='Your brand domain (e.g., agenticbro.app)')
    parser.add_argument('--type', default='impersonation',
                       choices=['impersonation', 'phishing', 'phone_scam', 'trademark'],
                       help='Type of takedown request')
    parser.add_argument('--risk-score', type=float, default=0, help='Risk score from scan')
    parser.add_argument('--risk-level', default='MEDIUM',
                       choices=['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
                       help='Risk level from scan')
    parser.add_argument('--evidence', nargs='*', default=[], help='Evidence items (space-separated)')
    parser.add_argument('--owner-name', default='Brand Owner', help='Name of brand owner for legal letters')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    args = parser.parse_args()
    
    template = generate_template(
        platform=args.platform,
        target=args.target,
        brand_name=args.brand,
        brand_handle=args.handle,
        brand_domain=args.domain,
        threat_type=args.type,
        risk_score=args.risk_score,
        risk_level=args.risk_level,
        evidence=args.evidence,
        owner_name=args.owner_name,
    )
    
    if args.json:
        print(json.dumps(template, indent=2))
    else:
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('📋 TAKEDOWN REQUEST — Brand Guard')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print()
        print(f'Platform:  {template["platform_name"]}')
        print(f'Target:   {template["target"]}')
        print(f'Type:     {template["report_category"]}')
        print(f'Brand:    {template["brand"]["name"]} (@{template["brand"]["handle"]})')
        print(f'Risk:     {template["risk_score"]}/10 ({template["risk_level"]})')
        print()
        print('REPORT SUBJECT:')
        print(f'  {template["report_subject"]}')
        print()
        print('FILING STEPS:')
        for i, step in enumerate(template['filing_steps'], 1):
            print(f'  {i}. {step}')
        print()
        print(f'REPORT URL: {template["report_url"]}')
        print()
        print('REPORT BODY:')
        for line in template['report_body'].split('\n'):
            print(f'  {line}')
        print()
        if args.evidence:
            print('EVIDENCE:')
            for i, e in enumerate(args.evidence, 1):
                print(f'  {i}. {e}')
            print()
        if 'cease_and_desist' in template:
            print('CEASE AND DESIST LETTER:')
            print('  (See JSON output for full letter)')
            print()
        print('EVIDENCE PACKAGE:')
        print('  (See JSON output for full package)')
        print()
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('⚠️ DISCLAIMER: Educational purposes only. Not legal advice.')
        print('   Consult with a qualified attorney before sending legal correspondence.')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    return 0


if __name__ == '__main__':
    sys.exit(main())