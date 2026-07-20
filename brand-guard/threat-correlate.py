# Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
# See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
# Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

#!/usr/bin/env python3
"""
Cross-Channel Threat Correlation — Brand Guard by Jeeevs / AgenticBro
======================================================================
Links threats across social media, phone numbers, domains, and wallet
addresses into unified threat profiles. When one threat is detected on
one channel, this engine automatically cross-references all other channels
to build a complete picture of the operation.

Core capabilities:
  - Link social impersonators → phone numbers → domains → wallets
  - Cross-reference scammer database (278+ entries)
  - Detect multi-channel scam operations
  - Generate unified threat profiles with aggregate risk scores
  - Provide takedown recommendations per channel

Usage:
  python3 threat-correlate.py --brand "Agentic Bro" --handle agenticbro --input results.json
  python3 threat-correlate.py --brand "Agentric Bro" --handle agenticbro --threat-id THREAT-001 --json
"""

import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse


# ── Cross-channel linking rules ──────────────────────────────────────────────
# When we find a threat on one channel, these rules define what to look for
# on other channels to establish correlation.

LINKING_RULES = {
    'social_to_phone': {
        'description': 'Social profile → phone number correlation',
        'sources': ['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin'],
        'targets': ['phone'],
        'link_types': ['phone_in_bio', 'phone_in_comments', 'phone_in_dm', 'phone_on_linked_website'],
        'confidence': 'high',
    },
    'social_to_domain': {
        'description': 'Social profile → domain correlation',
        'sources': ['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin'],
        'targets': ['domain'],
        'link_types': ['link_in_bio', 'link_in_post', 'link_in_dm', 'pinned_link'],
        'confidence': 'high',
    },
    'social_to_wallet': {
        'description': 'Social profile → wallet address correlation',
        'sources': ['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin'],
        'targets': ['wallet'],
        'link_types': ['wallet_in_bio', 'wallet_in_post', 'wallet_in_dm', 'payment_address'],
        'confidence': 'high',
    },
    'phone_to_social': {
        'description': 'Phone number → social profile correlation',
        'sources': ['phone'],
        'targets': ['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin'],
        'link_types': ['phone_registered_on_platform', 'phone_in_profile', 'phone_in_bio'],
        'confidence': 'medium',
    },
    'domain_to_social': {
        'description': 'Domain → social profile correlation',
        'sources': ['domain'],
        'targets': ['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin'],
        'link_types': ['domain_registered_by_same_entity', 'domain_links_to_social', 'domain_content_matches'],
        'confidence': 'medium',
    },
    'social_to_social': {
        'description': 'Cross-platform social profile correlation',
        'sources': ['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin'],
        'targets': ['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin'],
        'link_types': ['same_username', 'same_display_name', 'same_profile_photo', 'same_bio_text', 'same_links'],
        'confidence': 'high',
    },
}


def load_scammer_database(db_path: str = '/Users/efinney/.openclaw/workspace/scammer-database.csv') -> List[Dict[str, Any]]:
    """Load the scammer database for cross-referencing."""
    scammers = []
    try:
        with open(db_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                scammers.append(row)
    except Exception as e:
        print(f"[threat-correlate] Warning: Could not load scammer database: {e}", file=sys.stderr)
    return scammers


def extract_identifiers(text: str) -> Dict[str, List[str]]:
    """Extract phone numbers, URLs, wallet addresses, and social handles from text."""
    identifiers = {
        'phones': [],
        'domains': [],
        'urls': [],
        'wallets': [],
        'social_handles': [],
        'emails': [],
    }
    
    if not text:
        return identifiers
    
    text_lower = text.lower()
    
    # Phone numbers (international format)
    phone_patterns = re.findall(r'\+?1?\d{10,15}', text.replace('-', '').replace(' ', '').replace('(', '').replace(')', ''))
    identifiers['phones'] = list(set(phone_patterns))
    
    # URLs
    url_patterns = re.findall(r'https?://[^\s<>"\']+', text)
    identifiers['urls'] = list(set(url_patterns))
    
    # Extract domains from URLs
    for url in identifiers['urls']:
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.replace('www.', '')
            if domain and domain not in identifiers['domains']:
                identifiers['domains'].append(domain)
        except:
            pass
    
    # Also find bare domains
    domain_patterns = re.findall(r'\b([a-zA-Z0-9-]+\.[a-zA-Z]{2,10})\b', text)
    for d in domain_patterns:
        if d not in identifiers['domains'] and d not in ['http', 'https', 'www']:
            identifiers['domains'].append(d)
    
    # Solana wallet addresses (base58, 32-44 chars)
    wallet_patterns = re.findall(r'\b[1-9A-HJ-NP-Za-km-z]{32,44}\b', text)
    # Filter to likely Solana addresses (start with common prefixes)
    for w in wallet_patterns:
        if len(w) >= 32 and not w.startswith('http') and not w.startswith('@'):
            identifiers['wallets'].append(w)
    
    # Social handles (@username)
    handle_patterns = re.findall(r'@([a-zA-Z0-9_]{3,30})', text)
    identifiers['social_handles'] = list(set(handle_patterns))
    
    # Email addresses
    email_patterns = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
    identifiers['emails'] = list(set(email_patterns))
    
    return identifiers


def similarity(s1: str, s2: str) -> float:
    """Calculate string similarity ratio."""
    if not s1 or not s2:
        return 0.0
    return SequenceMatcher(None, s1.lower(), s2.lower()).ratio()


def correlate_social_profiles(
    brand_name: str,
    brand_handle: str,
    scan_results: List[Dict[str, Any]] = None,
    scammer_db: List[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Cross-reference social profiles across platforms.
    Find profiles using the same username, display name, or bio text
    across multiple platforms.
    """
    channels = {}
    linked_entities = []
    
    # Process scan results
    if scan_results:
        for result in scan_results:
            platform = result.get('platform', 'unknown')
            username = (result.get('username') or '').lower().lstrip('@')
            display_name = result.get('display_name') or ''
            bio = result.get('bio') or ''
            risk_score = result.get('risk_score', 0)
            risk_level = result.get('risk_level', 'LOW')
            
            # Extract identifiers from bio
            identifiers = extract_identifiers(bio)
            
            channel_entry = {
                'platform': platform,
                'username': username,
                'display_name': display_name,
                'bio': bio[:200] if bio else None,
                'risk_score': risk_score,
                'risk_level': risk_level,
                'identifiers': identifiers,
                'profile_url': result.get('profile_url'),
            }
            
            if platform not in channels:
                channels[platform] = []
            channels[platform].append(channel_entry)
            
            # Link any found identifiers
            for phone in identifiers['phones']:
                linked_entities.append({
                    'type': 'phone',
                    'value': phone,
                    'source': f'{platform}:{username}',
                    'confidence': 'high',
                    'link_type': 'phone_in_bio',
                })
            
            for domain in identifiers['domains']:
                linked_entities.append({
                    'type': 'domain',
                    'value': domain,
                    'source': f'{platform}:{username}',
                    'confidence': 'high',
                    'link_type': 'link_in_bio',
                })
            
            for wallet in identifiers['wallets']:
                linked_entities.append({
                    'type': 'wallet',
                    'value': wallet,
                    'source': f'{platform}:{username}',
                    'confidence': 'high',
                    'link_type': 'wallet_in_bio',
                })
    
    # Cross-reference scammer database
    scammer_matches = []
    if scammer_db:
        brand_lower = brand_name.lower()
        handle_lower = brand_handle.lower()
        
        for scammer in scammer_db:
            name = (scammer.get('Scammer Name') or '').lower()
            x_handle = (scammer.get('X Handle') or '').lower().lstrip('@')
            tg_channel = (scammer.get('Telegram Channel') or '').lower()
            platform = scammer.get('Platform') or ''
            scam_type = scammer.get('Scam Type') or ''
            risk = scammer.get('Verification Level') or ''
            wallet = scammer.get('Wallet Address') or ''
            notes = scammer.get('Notes') or ''
            
            # Check if this scammer references the brand
            is_related = (
                brand_lower in name or
                handle_lower in name or
                brand_lower in notes.lower() or
                handle_lower in x_handle or
                handle_lower in tg_channel
            )
            
            if is_related:
                match = {
                    'name': scammer.get('Scammer Name', 'Unknown'),
                    'platform': platform,
                    'scam_type': scam_type,
                    'risk_level': risk,
                    'x_handle': x_handle,
                    'telegram': tg_channel,
                    'wallet': wallet,
                }
                scammer_matches.append(match)
                
                # Link identifiers from scammer DB
                if x_handle:
                    linked_entities.append({
                        'type': 'social_x',
                        'value': x_handle,
                        'source': f'scammer_db:{name}',
                        'confidence': 'high',
                        'link_type': 'known_scammer',
                    })
                if tg_channel:
                    linked_entities.append({
                        'type': 'social_telegram',
                        'value': tg_channel,
                        'source': f'scammer_db:{name}',
                        'confidence': 'high',
                        'link_type': 'known_scammer',
                    })
                if wallet and wallet not in ('Unknown', 'N/A', ''):
                    linked_entities.append({
                        'type': 'wallet',
                        'value': wallet,
                        'source': f'scammer_db:{name}',
                        'confidence': 'high',
                        'link_type': 'known_scammer_wallet',
                    })
    
    # Deduplicate linked entities
    seen = set()
    unique_entities = []
    for entity in linked_entities:
        key = f"{entity['type']}:{entity['value'].lower()}"
        if key not in seen:
            seen.add(key)
            unique_entities.append(entity)
    
    return {
        'channels': channels,
        'linked_entities': unique_entities,
        'scammer_db_matches': scammer_matches,
        'scammer_db_match_count': len(scammer_matches),
    }


def calculate_aggregate_risk(
    social_results: List[Dict[str, Any]] = None,
    phone_results: List[Dict[str, Any]] = None,
    domain_results: List[Dict[str, Any]] = None,
    scammer_matches: List[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Calculate aggregate risk score across all channels.
    Uses weighted combination where cross-channel confirmation increases risk.
    """
    risk_scores = {}
    evidence = []
    channel_count = 0
    
    # ── Social risk ──────────────────────────────────────────────────────
    if social_results:
        social_max = max((r.get('risk_score', 0) for r in social_results), default=0)
        social_avg = sum(r.get('risk_score', 0) for r in social_results) / max(len(social_results), 1)
        risk_scores['social'] = {
            'max': social_max,
            'avg': round(social_avg, 1),
            'count': len(social_results),
            'weight': 0.35,
        }
        channel_count += 1
        if social_max >= 7:
            evidence.append(f'🚨 Social: {len(social_results)} impersonator(s) found (max risk: {social_max}/10)')
        elif social_max >= 5:
            evidence.append(f'⚠️ Social: {len(social_results)} suspicious profile(s) found (max risk: {social_max}/10)')
    
    # ── Phone risk ────────────────────────────────────────────────────────
    if phone_results:
        phone_max = max((r.get('risk_score', r.get('verification', {}).get('score', 0)) for r in phone_results), default=0)
        phone_avg = sum(r.get('risk_score', r.get('verification', {}).get('score', 0)) for r in phone_results) / max(len(phone_results), 1)
        # Normalize phone score to 0-10 scale if it's on 0-100
        if phone_max > 10:
            phone_max = round(phone_max / 10, 1)
            phone_avg = round(phone_avg / 10, 1)
        risk_scores['phone'] = {
            'max': phone_max,
            'avg': round(phone_avg, 1),
            'count': len(phone_results),
            'weight': 0.25,
        }
        channel_count += 1
        if phone_max >= 7:
            evidence.append(f'🚨 Phone: {len(phone_results)} suspicious number(s) found (max risk: {phone_max}/10)')
        elif phone_max >= 5:
            evidence.append(f'⚠️ Phone: {len(phone_results)} risky number(s) found (max risk: {phone_max}/10)')
    
    # ── Domain risk ──────────────────────────────────────────────────────
    if domain_results:
        domain_max = max((r.get('risk_score', 0) for r in domain_results), default=0)
        domain_avg = sum(r.get('risk_score', 0) for r in domain_results) / max(len(domain_results), 1)
        # Normalize domain score to 0-10 scale if it's on 0-100
        if domain_max > 10:
            domain_max = round(domain_max / 10, 1)
            domain_avg = round(domain_avg / 10, 1)
        risk_scores['domain'] = {
            'max': domain_max,
            'avg': round(domain_avg, 1),
            'count': len(domain_results),
            'weight': 0.25,
        }
        channel_count += 1
        if domain_max >= 7:
            evidence.append(f'🚨 Domain: {len(domain_results)} lookalike domain(s) found (max risk: {domain_max}/10)')
        elif domain_max >= 5:
            evidence.append(f'⚠️ Domain: {len(domain_results)} suspicious domain(s) found (max risk: {domain_max}/10)')
    
    # ── Scammer DB risk ──────────────────────────────────────────────────
    scammer_count = len(scammer_matches) if scammer_matches else 0
    if scammer_count > 0:
        risk_scores['scammer_db'] = {
            'count': scammer_count,
            'weight': 0.15,
        }
        channel_count += 1
        if scammer_count >= 5:
            evidence.append(f'🚨 Scammer DB: {scammer_count} known scam operations targeting this brand')
        else:
            evidence.append(f'⚠️ Scammer DB: {scammer_count} known scam operation(s) targeting this brand')
    
    # ── Calculate weighted aggregate ──────────────────────────────────────
    weighted_sum = 0
    total_weight = 0
    
    for channel, data in risk_scores.items():
        weight = data['weight']
        if 'max' in data:
            weighted_sum += data['max'] * weight
        elif channel == 'scammer_db' and data['count'] > 0:
            # Scammer DB contributes 3 points per match, max 10
            scammer_score = min(10, data['count'] * 3)
            weighted_sum += scammer_score * weight
        total_weight += weight
    
    aggregate_risk = round(weighted_sum / total_weight, 1) if total_weight > 0 else 0
    
    # ── Cross-channel bonus ──────────────────────────────────────────────
    # If threats are found on multiple channels, increase aggregate risk
    cross_channel_bonus = 0
    if channel_count >= 3:
        cross_channel_bonus = 2.0
        evidence.append('🚨 CROSS-CHANNEL THREAT: Confirmed across 3+ channels — coordinated operation likely')
    elif channel_count >= 2:
        cross_channel_bonus = 1.0
        evidence.append('⚠️ Cross-channel correlation: Threats found across multiple channels')
    
    aggregate_risk = min(10, aggregate_risk + cross_channel_bonus)
    
    # ── Determine aggregate risk level ────────────────────────────────────
    if aggregate_risk >= 7:
        risk_level = 'CRITICAL'
        threat_type = 'Coordinated multi-channel scam operation'
    elif aggregate_risk >= 5:
        risk_level = 'HIGH'
        threat_type = 'Multi-channel brand impersonation detected'
    elif aggregate_risk >= 3:
        risk_level = 'MEDIUM'
        threat_type = 'Some cross-channel correlation found'
    elif aggregate_risk >= 1:
        risk_level = 'LOW'
        threat_type = 'Minor cross-channel overlap'
    else:
        risk_level = 'MINIMAL'
        threat_type = 'No significant cross-channel threats detected'
    
    return {
        'aggregate_risk_score': aggregate_risk,
        'aggregate_risk_level': risk_level,
        'threat_type': threat_type,
        'channel_count': channel_count,
        'cross_channel_bonus': cross_channel_bonus,
        'risk_scores': risk_scores,
        'evidence': evidence,
    }


def generate_takedown_recommendations(
    threat_profile: Dict[str, Any],
    channels: Dict[str, Any],
    linked_entities: List[Dict[str, Any]],
    scammer_matches: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Generate platform-specific takedown recommendations."""
    recommendations = []
    risk_level = threat_profile.get('aggregate_risk_level', 'MINIMAL')
    
    # Platform-specific takedown actions
    platform_actions = {
        'x': {
            'url': 'https://help.x.com/en/forms/general/safety',
            'action': 'Report for impersonation',
            'evidence': 'Screenshot of profile, risk report, and impersonation evidence',
        },
        'instagram': {
            'url': 'https://help.instagram.com/contact/complaint_form',
            'action': 'Report for impersonation',
            'evidence': 'Screenshot of profile, link to legitimate account',
        },
        'tiktok': {
            'url': 'https://www.tiktok.com/legal/report',
            'action': 'Report for impersonation',
            'evidence': 'Screenshot, legitimate brand account link',
        },
        'facebook': {
            'url': 'https://www.facebook.com/help/contact/361417823876055',
            'action': 'Report for impersonation',
            'evidence': 'Screenshot, business verification documents',
        },
        'telegram': {
            'url': 'https://t.me/abuse',
            'action': 'Report channel for scam',
            'evidence': 'Channel screenshots, scam evidence',
        },
        'linkedin': {
            'url': 'https://www.linkedin.com/help/linking/answer/83592',
            'action': 'Report for impersonation',
            'evidence': 'Screenshot, company page link',
        },
    }
    
    # Add recommendations for each channel with threats
    for platform, entries in channels.items():
        platform_key = platform.lower()
        if platform_key in platform_actions:
            for entry in entries[:3]:  # Top 3 per platform
                recommendations.append({
                    'platform': platform,
                    'action': platform_actions[platform_key]['action'],
                    'url': platform_actions[platform_key]['url'],
                    'target': entry.get('username', 'Unknown'),
                    'priority': 'Urgent' if risk_level in ['CRITICAL', 'HIGH'] else 'Medium',
                    'evidence_needed': platform_actions[platform_key]['evidence'],
                    'risk_score': entry.get('risk_score', 0),
                })
    
    # Add domain takedown if linked
    domain_entities = [e for e in linked_entities if e['type'] == 'domain']
    for entity in domain_entities[:3]:
        recommendations.append({
            'platform': 'domain_registrar',
            'action': 'File abuse report with registrar',
            'url': f'https://www.whois.com/whois/{entity["value"]}',
            'target': entity['value'],
            'priority': 'Urgent' if risk_level in ['CRITICAL', 'HIGH'] else 'Medium',
            'evidence_needed': 'Domain registration evidence, brand trademark documentation',
            'risk_score': 0,
        })
    
    # Add phone number takedown
    phone_entities = [e for e in linked_entities if e['type'] == 'phone']
    for entity in phone_entities[:3]:
        recommendations.append({
            'platform': 'phone_carrier',
            'action': 'Report to carrier for fraud',
            'url': 'https://reportfraud.ftc.gov/',
            'target': entity['value'],
            'priority': 'Urgent' if risk_level in ['CRITICAL', 'HIGH'] else 'Medium',
            'evidence_needed': 'Phone risk report, call logs, scam evidence',
            'risk_score': 0,
        })
    
    # Legal recommendations for high-risk
    if risk_level in ['CRITICAL', 'HIGH']:
        recommendations.append({
            'platform': 'legal',
            'action': 'Cease and desist letter',
            'url': '',
            'target': 'All identified threat actors',
            'priority': 'Urgent',
            'evidence_needed': 'All collected evidence, brand trademark registration, financial damages documentation',
            'risk_score': 0,
        })
    
    return recommendations


def main():
    parser = argparse.ArgumentParser(description='Cross-Channel Threat Correlation — Brand Guard')
    parser.add_argument('--brand', required=True, help='Brand name (e.g., "Agentic Bro")')
    parser.add_argument('--handle', required=True, help='Brand handle (e.g., "agenticbro")')
    parser.add_argument('--domain', default='', help='Brand domain (e.g., "agenticbro.app")')
    parser.add_argument('--input', default='', help='JSON file with scan results from other Brand Guard features')
    parser.add_argument('--scammer-db', default='/Users/efinney/.openclaw/workspace/scammer-database.csv', help='Path to scammer database')
    parser.add_argument('--threat-id', default='', help='Threat ID for tracking')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    args = parser.parse_args()
    
    timestamp = datetime.now(timezone.utc).isoformat()
    threat_id = args.threat_id or f"THREAT-{int(datetime.now().timestamp())}"
    
    # Load input data
    scan_data = {}
    if args.input:
        try:
            with open(args.input, 'r') as f:
                scan_data = json.load(f)
        except Exception as e:
            print(f"Warning: Could not load input file: {e}", file=sys.stderr)
    
    # Load scammer database
    scammer_db = load_scammer_database(args.scammer_db)
    
    # Extract scan results by type
    social_results = scan_data.get('social_results', scan_data.get('impersonator_results', []))
    phone_results = scan_data.get('phone_results', scan_data.get('vendor_results', []))
    domain_results = scan_data.get('domain_results', scan_data.get('lookalike_results', []))
    
    # Run cross-channel correlation
    correlation = correlate_social_profiles(
        brand_name=args.brand,
        brand_handle=args.handle,
        scan_results=social_results,
        scammer_db=scammer_db,
    )
    
    # Calculate aggregate risk
    risk_profile = calculate_aggregate_risk(
        social_results=social_results,
        phone_results=phone_results,
        domain_results=domain_results,
        scammer_matches=correlation['scammer_db_matches'],
    )
    
    # Generate takedown recommendations
    takedowns = generate_takedown_recommendations(
        threat_profile=risk_profile,
        channels=correlation['channels'],
        linked_entities=correlation['linked_entities'],
        scammer_matches=correlation['scammer_db_matches'],
    )
    
    # Build final threat profile
    profile = {
        'threat_id': threat_id,
        'brand': {
            'name': args.brand,
            'handle': args.handle,
            'domain': args.domain or None,
        },
        'scan_date': timestamp,
        'channels': correlation['channels'],
        'linked_entities': correlation['linked_entities'],
        'scammer_db_matches': correlation['scammer_db_matches'],
        'scammer_db_match_count': correlation['scammer_db_match_count'],
        'risk_profile': risk_profile,
        'takedown_recommendations': takedowns,
        'summary': {
            'channels_with_threats': len(correlation['channels']),
            'total_linked_entities': len(correlation['linked_entities']),
            'aggregate_risk_score': risk_profile['aggregate_risk_score'],
            'aggregate_risk_level': risk_profile['aggregate_risk_level'],
            'threat_type': risk_profile['threat_type'],
            'cross_channel_bonus': risk_profile['cross_channel_bonus'],
            'takedown_actions': len(takedowns),
            'scammer_db_matches': correlation['scammer_db_match_count'],
        },
        'disclaimer': 'Educational purposes only. Not financial advice. Not a guarantee of safety. Always verify independently.',
    }
    
    if args.json:
        print(json.dumps(profile, indent=2))
    else:
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('🔗 CROSS-CHANNEL THREAT CORRELATION — Brand Guard')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print()
        print(f'Brand: {args.brand} (@{args.handle})')
        if args.domain:
            print(f'Domain: {args.domain}')
        print(f'Threat ID: {threat_id}')
        print(f'Scan Date: {timestamp}')
        print()
        print(f'AGGREGATE RISK: {risk_profile["aggregate_risk_score"]}/10 — {risk_profile["aggregate_risk_level"]}')
        print(f'Threat Type: {risk_profile["threat_type"]}')
        print(f'Channels with Threats: {risk_profile["channel_count"]}')
        if risk_profile['cross_channel_bonus'] > 0:
            print(f'Cross-Channel Bonus: +{risk_profile["cross_channel_bonus"]} (threats confirmed across multiple channels)')
        print()
        
        # Risk by channel
        if risk_profile['risk_scores']:
            print('RISK BY CHANNEL:')
            for channel, data in risk_profile['risk_scores'].items():
                if 'max' in data:
                    print(f'  {channel:12s}: {data["max"]:4.1f}/10 (avg: {data["avg"]:.1f}, count: {data["count"]})')
                else:
                    print(f'  {channel:12s}: {data["count"]} matches')
            print()
        
        # Evidence
        if risk_profile['evidence']:
            print('EVIDENCE:')
            for e in risk_profile['evidence']:
                print(f'  {e}')
            print()
        
        # Linked entities
        if correlation['linked_entities']:
            print('LINKED ENTITIES:')
            for entity in correlation['linked_entities'][:15]:
                print(f'  {entity["type"]:10s}: {entity["value"]:40s} (source: {entity["source"]}, {entity["link_type"]})')
            print()
        
        # Scammer DB matches
        if correlation['scammer_db_matches']:
            print(f'SCAMMER DATABASE: {correlation["scammer_db_match_count"]} match(es)')
            for match in correlation['scammer_db_matches'][:5]:
                print(f'  • {match["name"]} ({match["platform"]}) — {match["scam_type"]} [{match["risk_level"]}]')
            print()
        
        # Takedown recommendations
        if takedowns:
            print('TAKEDOWN RECOMMENDATIONS:')
            for rec in takedowns[:10]:
                print(f'  [{rec["priority"]}] {rec["platform"]:12s}: {rec["action"]} → {rec["target"]}')
            print()
        
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('⚠️ DISCLAIMER: Educational purposes only. Not financial advice.')
        print('   Not a guarantee of safety. Always verify independently.')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    return 0


if __name__ == '__main__':
    sys.exit(main())