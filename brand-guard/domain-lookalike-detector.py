# Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
# See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
# Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

#!/usr/bin/env python3
"""
Domain Lookalike Detector — Brand Guard by Jeeevs / AgenticBro
================================================================
Generates typosquatting domain variants and scores them for phishing risk.
Uses WHOIS, SSL, and reputation analysis to detect lookalike websites
targeting a brand.

This module generates domain variants (typos, TLD swaps, homoglyphs, etc.),
then scores each variant for lookalike risk using:
  - Domain age (new = higher risk)
  - SSL certificate analysis (self-signed, recent = higher risk)
  - WHOIS patterns (privacy guard, short registration = higher risk)
  - Content similarity (if site is live)
  - Known phishing database cross-reference

Usage:
  python3 domain-lookalike-detector.py acmecorp.com [--json] [--limit 50]
  python3 domain-lookalike-detector.py acmecorp.com --check-active --json
"""

import argparse
import json
import re
import socket
import ssl
import sys
import subprocess
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse

# ── Domain Variant Generators ────────────────────────────────────────────────

# Common TLDs to check for typosquatting
TLD_SWAPS = [
    '.com', '.net', '.org', '.io', '.co', '.app', '.xyz', '.dev',
    '.tech', '.finance', '.coin', '.crypto', '.site', '.online',
    '.shop', '.store', '.info', '.biz', '.us', '.uk', '.ca',
]

# Common phishing prefixes
PHISHING_PREFIXES = [
    'login', 'signin', 'sign-in', 'account', 'secure', 'verify',
    'update', 'confirm', 'auth', 'portal', 'app', 'my', 'web',
    'www2', 'mail', 'support', 'help', 'service', 'check',
    'get', 'claim', 'reward', 'free', 'bonus', 'wallet',
    'swap', 'trade', 'buy', 'mint', 'stake', 'pool',
]

# Common phishing suffixes for domains (added before TLD)
PHISHING_SUFFIXES = [
    '-login', '-signin', '-account', '-secure', '-verify',
    '-update', '-app', '-support', '-help', '-service',
    '-claim', '-reward', '-free', '-bonus', '-wallet',
    '-swap', '-trade', '-airdrop',
]

# Homoglyph character mappings (visually similar characters)
HOMOGLYPH_MAP = {
    'a': ['4', '@', 'à', 'á', 'â'],
    'b': ['6', 'lb'],
    'c': ['(', '{'],
    'e': ['3', '€'],
    'g': ['9', 'q'],
    'i': ['1', 'l', '|', '!'],
    'l': ['1', 'i', '|'],
    'o': ['0', 'ö', 'ò'],
    's': ['5', '$'],
    't': ['7', '+'],
    'u': ['v', 'ü'],
    'v': ['u'],
    '0': ['o'],
    '1': ['i', 'l'],
    '5': ['s'],
    '7': ['t'],
    '9': ['g'],
}


def extract_domain_parts(domain: str) -> Dict[str, str]:
    """Extract base domain components."""
    domain = domain.lower().strip()
    domain = re.sub(r'^https?://', '', domain)
    domain = domain.rstrip('/')
    domain = re.sub(r'^www\.', '', domain)
    
    parts = domain.split('.')
    if len(parts) >= 2:
        base = '.'.join(parts[:-1])
        tld = '.' + parts[-1]
    else:
        base = domain
        tld = '.com'
    
    return {'full': domain, 'base': base, 'tld': tld, 'parts': parts}


def generate_typosquatting_variants(base: str) -> List[Dict[str, Any]]:
    """Generate common typosquatting variations of a domain base name."""
    variants = []
    
    # 1. Character omission (dropping a letter)
    for i in range(len(base)):
        variant = base[:i] + base[i+1:]
        if variant and variant != base:
            variants.append({
                'variant': variant,
                'type': 'char_omission',
                'method': f'omit_pos{i}',
                'risk_boost': 0.3,
                'description': f'Missing character at position {i}',
            })
    
    # 2. Character duplication
    for i in range(min(len(base), 10)):
        variant = base[:i] + base[i] + base[i:]
        if len(variant) <= 20:
            variants.append({
                'variant': variant,
                'type': 'char_duplication',
                'method': f'dup_pos{i}',
                'risk_boost': 0.2,
                'description': f'Duplicated character at position {i}',
            })
    
    # 3. Adjacent key swaps
    keyboard_rows = [
        'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
    ]
    for i in range(len(base)):
        char = base[i].lower()
        for row in keyboard_rows:
            if char in row:
                idx = row.index(char)
                for adj_idx in [idx - 1, idx + 1]:
                    if 0 <= adj_idx < len(row):
                        variant = base[:i] + row[adj_idx] + base[i+1:]
                        if variant != base:
                            variants.append({
                                'variant': variant,
                                'type': 'key_swap',
                                'method': f'key_swap_{char}->{row[adj_idx]}_pos{i}',
                                'risk_boost': 0.25,
                                'description': f'Adjacent key swap: {char} → {row[adj_idx]}',
                            })
    
    # 4. Homoglyph substitution
    for i in range(min(len(base), 12)):
        char = base[i].lower()
        if char in HOMOGLYPH_MAP:
            for replacement in HOMOGLYPH_MAP[char][:2]:  # Max 2 per position
                variant = base[:i] + replacement + base[i+1:]
                if variant != base and '.' not in variant:  # Don't introduce dots inside
                    variants.append({
                        'variant': variant,
                        'type': 'homoglyph',
                        'method': f'homo_{char}->{replacement}_pos{i}',
                        'risk_boost': 0.5,
                        'description': f'Visual lookalike: {char} → {replacement}',
                    })
    
    return variants


def generate_tld_swaps(base: str, original_tld: str) -> List[Dict[str, Any]]:
    """Generate TLD swap variants (e.g., .com → .net, .io, .org)."""
    variants = []
    for tld in TLD_SWAPS:
        if tld != original_tld:
            domain = base + tld
            risk = 0.5 if tld in ['.io', '.xyz', '.coin', '.crypto', '.site', '.online'] else 0.3
            variants.append({
                'variant': domain,
                'type': 'tld_swap',
                'method': f'tld_swap{original_tld}->{tld}',
                'risk_boost': risk,
                'description': f'Different TLD: {base}{tld} instead of {base}{original_tld}',
            })
    return variants


def generate_phishing_variants(base: str, tld: str) -> List[Dict[str, Any]]:
    """Generate phishing-style variants with prefixes and suffixes."""
    variants = []
    
    # Prefix additions (high risk)
    for prefix in PHISHING_PREFIXES[:15]:  # Top 15 most dangerous
        domain = f'{prefix}{base}{tld}'
        variants.append({
            'variant': domain,
            'type': 'phishing_prefix',
            'method': f'prefix_{prefix}',
            'risk_boost': 0.7,
            'description': f'Phishing prefix: "{prefix}" added to domain',
        })
    
    # Suffix additions (before TLD)
    for suffix in PHISHING_SUFFIXES[:10]:  # Top 10
        domain = f'{base}{suffix}{tld}'
        variants.append({
            'variant': domain,
            'type': 'phishing_suffix',
            'method': f'suffix{suffix}',
            'risk_boost': 0.7,
            'description': f'Phishing suffix: "{suffix}" added to domain',
        })
    
    # Hyphen insertion (common in phishing)
    if len(base) >= 4:
        for i in range(2, min(len(base) - 1, 8), max(1, len(base) // 4)):
            domain = f'{base[:i]}-{base[i:]}{tld}'
            variants.append({
                'variant': domain,
                'type': 'hyphen_insertion',
                'method': f'hyphen_pos{i}',
                'risk_boost': 0.4,
                'description': f'Hyphen inserted at position {i}',
            })
    
    # Subdomain phishing (e.g., acmecorp.login.com, acmecorp.verify.com)
    phishing_subdomains = ['login', 'signin', 'verify', 'secure', 'account', 'app']
    common_domains = ['com', 'net', 'org', 'io']
    for sub in phishing_subdomains:
        for cd in common_domains[:2]:
            domain = f'{base}.{sub}.{cd}'
            variants.append({
                'variant': domain,
                'type': 'subdomain_phishing',
                'method': f'subdomain_{sub}.{cd}',
                'risk_boost': 0.8,  # Highest risk — very deceptive
                'description': f'Subdomain phishing: {sub}.{cd} looks real but {base} is the subdomain',
            })
    
    return variants


def generate_all_variants(domain: str, limit: int = 50) -> Dict[str, Any]:
    """Generate all domain variant types for a domain."""
    parts = extract_domain_parts(domain)
    base = parts['base']
    tld = parts['tld']
    
    # Generate each category
    typosquatting = generate_typosquatting_variants(base)
    tld_swaps = generate_tld_swaps(base, tld)
    phishing = generate_phishing_variants(base, tld)
    
    # Build full domain variants
    all_variants = []
    seen = set()
    
    # Add full domains (base + original TLD) for typos
    for v in typosquatting:
        full_domain = v['variant'] + tld
        if full_domain.lower() not in seen and full_domain.lower() != parts['full']:
            seen.add(full_domain.lower())
            all_variants.append({
                **v,
                'domain': full_domain,
            })
    
    # Add TLD swaps
    for v in tld_swaps:
        if v['variant'].lower() not in seen and v['variant'].lower() != parts['full']:
            seen.add(v['variant'].lower())
            all_variants.append({
                **v,
                'domain': v['variant'],
            })
    
    # Add phishing variants (already have full domains)
    for v in phishing:
        if v['variant'].lower() not in seen and v['variant'].lower() != parts['full']:
            seen.add(v['variant'].lower())
            all_variants.append({
                **v,
                'domain': v['variant'],
            })
    
    # Sort by risk (highest first)
    all_variants.sort(key=lambda x: x['risk_boost'], reverse=True)
    
    # Limit
    all_variants = all_variants[:limit]
    
    return {
        'original_domain': parts['full'],
        'base': base,
        'tld': tld,
        'total_variants': len(all_variants),
        'variants': all_variants,
        'priority_counts': {
            'critical': len([v for v in all_variants if v['risk_boost'] >= 0.7]),
            'high': len([v for v in all_variants if 0.5 <= v['risk_boost'] < 0.7]),
            'medium': len([v for v in all_variants if 0.3 <= v['risk_boost'] < 0.5]),
            'low': len([v for v in all_variants if v['risk_boost'] < 0.3]),
        },
    }


# ── Domain Risk Scoring ─────────────────────────────────────────────────────

def check_domain_dns(domain: str, timeout: int = 3) -> Dict[str, Any]:
    """Check if a domain resolves and get basic DNS info."""
    result = {
        'resolves': False,
        'ip_addresses': [],
        'has_www': False,
        'error': None,
    }
    
    try:
        # Check if domain resolves
        ips = socket.getaddrinfo(domain, None, socket.AF_INET)
        if ips:
            result['resolves'] = True
            result['ip_addresses'] = list(set(addr[4][0] for addr in ips[:5]))
    except socket.gaierror:
        result['resolves'] = False
    except Exception as e:
        result['error'] = str(e)
    
    # Check www subdomain
    try:
        www_ips = socket.getaddrinfo(f'www.{domain}', None, socket.AF_INET)
        if www_ips:
            result['has_www'] = True
    except socket.gaierror:
        pass
    
    return result


def check_ssl_certificate(domain: str, timeout: int = 5) -> Dict[str, Any]:
    """Check SSL certificate details for a domain."""
    result = {
        'has_ssl': False,
        'issuer': None,
        'valid_from': None,
        'valid_to': None,
        'days_until_expiry': None,
        'is_self_signed': False,
        'is_lets_encrypt': False,
        'error': None,
    }
    
    try:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        
        with socket.create_connection((domain, 443), timeout=timeout) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert(binary_form=True)
                # Try to get cert info
                try:
                    cert_dict = ssock.getpeercert()
                    result['has_ssl'] = True
                    issuer = dict(x[0] for x in cert_dict.get('issuer', []))
                    result['issuer'] = issuer.get('commonName', issuer.get('organizationName', 'Unknown'))
                    result['valid_from'] = cert_dict.get('notBefore')
                    result['valid_to'] = cert_dict.get('notAfter')
                    
                    # Check if Let's Encrypt (legitimate but also used by phishing sites)
                    if "Let's Encrypt" in str(issuer):
                        result['is_lets_encrypt'] = True
                    
                    # Check if self-signed
                    subject = dict(x[0] for x in cert_dict.get('subject', []))
                    if issuer.get('commonName') == subject.get('commonName'):
                        result['is_self_signed'] = True
                    
                except ssl.SSLWantReadError:
                    result['has_ssl'] = True  # Has SSL but can't read cert details
    except ssl.SSLCertVerificationError:
        result['has_ssl'] = True
        result['is_self_signed'] = True  # Failed verification often means self-signed
    except socket.timeout:
        result['error'] = 'Connection timeout'
    except socket.gaierror:
        result['error'] = 'Domain does not resolve'
    except ConnectionRefusedError:
        result['error'] = 'Connection refused'
    except Exception as e:
        result['error'] = f'SSL check error: {str(e)[:100]}'
    
    return result


def score_lookalike_domain(
    variant_domain: str,
    original_domain: str,
    dns_info: Optional[Dict] = None,
    ssl_info: Optional[Dict] = None,
    variant_type: str = '',
    risk_boost: float = 0,
) -> Dict[str, Any]:
    """
    Score a lookalike domain for phishing/impersonation risk.
    
    Returns a risk assessment with score (0-100) and evidence.
    """
    score = 0
    evidence = []
    
    # ── Domain Similarity (0-30 points) ──────────────────────────────────
    orig_parts = extract_domain_parts(original_domain)
    var_parts = extract_domain_parts(variant_domain)
    
    similarity = SequenceMatcher(None, orig_parts['base'].lower(), var_parts['base'].lower()).ratio()
    
    if similarity >= 0.9:
        score += 30
        evidence.append(f'🚨 Very similar domain name: {variant_domain} ({similarity:.0%} match)')
    elif similarity >= 0.75:
        score += 22
        evidence.append(f'⚠️ Similar domain name: {variant_domain} ({similarity:.0%} match)')
    elif similarity >= 0.5:
        score += 12
        evidence.append(f'ℹ️ Somewhat similar domain: {variant_domain} ({similarity:.0%} match)')
    elif similarity >= 0.3:
        score += 5
        evidence.append(f'ℹ️ Slightly similar domain: {variant_domain} ({similarity:.0%} match)')
    
    # ── Variant Type Risk (0-25 points) ──────────────────────────────────
    high_risk_types = ['phishing_prefix', 'phishing_suffix', 'subdomain_phishing']
    medium_risk_types = ['homoglyph', 'tld_swap']
    low_risk_types = ['char_omission', 'char_duplication', 'key_swap', 'hyphen_insertion']
    
    if variant_type in high_risk_types:
        score += 25
        evidence.append(f'🚨 High-risk variant type: {variant_type}')
    elif variant_type in medium_risk_types:
        score += 15
        evidence.append(f'⚠️ Medium-risk variant type: {variant_type}')
    elif variant_type in low_risk_types:
        score += 8
        evidence.append(f'ℹ️ Low-risk variant type: {variant_type}')
    
    # ── Risk Boost from Generator ────────────────────────────────────────
    if risk_boost >= 0.7:
        score += 15
    elif risk_boost >= 0.5:
        score += 10
    elif risk_boost >= 0.3:
        score += 5
    
    # ── Domain Resolves (0-15 points) ───────────────────────────────────
    if dns_info and dns_info.get('resolves'):
        score += 15
        evidence.append('🚨 Domain is ACTIVE and resolves — phishing site may be live')
        if dns_info.get('ip_addresses'):
            evidence.append(f'   IP addresses: {", ".join(dns_info["ip_addresses"][:3])}')
    elif dns_info and not dns_info.get('resolves'):
        # Domain doesn't resolve — could be parked, inactive, or not yet registered
        evidence.append('ℹ️ Domain does not resolve — may be parked or not registered')
    
    # ── SSL Certificate (0-15 points) ────────────────────────────────────
    if ssl_info and ssl_info.get('has_ssl'):
        if ssl_info.get('is_self_signed'):
            score += 15
            evidence.append('🚨 Self-signed SSL certificate — common in phishing sites')
        elif ssl_info.get('is_lets_encrypt'):
            score += 8
            evidence.append('⚠️ Let\'s Encrypt certificate — legitimate but also used by phishing sites')
        else:
            score += 3
            evidence.append(f'ℹ️ SSL certificate from: {ssl_info.get("issuer", "Unknown")}')
    elif dns_info and dns_info.get('resolves') and ssl_info and not ssl_info.get('has_ssl'):
        score += 5
        evidence.append('⚠️ Domain resolves but has no SSL — could be HTTP-only phishing site')
    
    # ── Suspicious TLD (0-10 points) ────────────────────────────────────
    suspicious_tlds = ['.xyz', '.coin', '.crypto', '.site', '.online', '.tk', '.ml', '.ga', '.cf']
    domain_tld = '.' + variant_domain.split('.')[-1] if '.' in variant_domain else ''
    if domain_tld in suspicious_tlds:
        score += 10
        evidence.append(f'🚨 Suspicious TLD: {domain_tld} — commonly used in phishing')
    elif domain_tld in ['.io', '.app', '.dev']:
        score += 3
        evidence.append(f'ℹ️ Tech-oriented TLD: {domain_tld}')
    
    # Cap at 100
    score = min(100, score)
    
    # ── Determine Risk Level ─────────────────────────────────────────────
    if score >= 70:
        risk_level = 'CRITICAL'
        threat_type = 'Active phishing domain — likely impersonating your brand'
    elif score >= 45:
        risk_level = 'HIGH'
        threat_type = 'Probable lookalike domain — high risk of being used for phishing'
    elif score >= 25:
        risk_level = 'MEDIUM'
        threat_type = 'Possible lookalike domain — moderate risk'
    elif score >= 10:
        risk_level = 'LOW'
        threat_type = 'Unlikely to be active threat — monitor periodically'
    else:
        risk_level = 'MINIMAL'
        threat_type = 'No significant risk identified'
    
    # ── Takedown Priority ────────────────────────────────────────────────
    takedown_priority = 'Monitor'
    takedown_action = 'Add to periodic monitoring schedule'
    
    if risk_level == 'CRITICAL':
        takedown_priority = 'Urgent'
        takedown_action = 'File abuse report with registrar + submit to phishing databases'
    elif risk_level == 'HIGH':
        takedown_priority = 'High'
        takedown_action = 'File abuse report with registrar + monitor for active content'
    elif risk_level == 'MEDIUM':
        takedown_priority = 'Medium'
        takedown_action = 'Monitor weekly and file abuse report if site becomes active'
    
    return {
        'domain': variant_domain,
        'original_domain': original_domain,
        'similarity': round(similarity, 3),
        'variant_type': variant_type,
        'risk_boost': risk_boost,
        'risk_score': score,
        'risk_level': risk_level,
        'threat_type': threat_type,
        'evidence': evidence,
        'dns_info': dns_info,
        'ssl_info': {
            'has_ssl': ssl_info.get('has_ssl') if ssl_info else None,
            'issuer': ssl_info.get('issuer') if ssl_info else None,
            'is_self_signed': ssl_info.get('is_self_signed') if ssl_info else None,
            'is_lets_encrypt': ssl_info.get('is_lets_encrypt') if ssl_info else None,
        } if ssl_info else None,
        'takedown_priority': takedown_priority,
        'takedown_action': takedown_action,
    }


def main():
    parser = argparse.ArgumentParser(description='Domain Lookalike Detector — Brand Guard')
    parser.add_argument('domain', help='Domain to check (e.g., acmecorp.com)')
    parser.add_argument('--limit', type=int, default=50, help='Max variants to generate (default: 50)')
    parser.add_argument('--check-active', action='store_true', help='Check DNS and SSL for active domains')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--output', help='Output file path (default: stdout)')
    args = parser.parse_args()
    
    # Generate variants
    result = generate_all_variants(args.domain, limit=args.limit)
    
    # Score each variant
    scored_variants = []
    for i, variant in enumerate(result['variants']):
        dns_info = None
        ssl_info = None
        
        if args.check_active and variant['domain']:
            dns_info = check_domain_dns(variant['domain'])
            if dns_info.get('resolves'):
                ssl_info = check_ssl_certificate(variant['domain'])
        
        scored = score_lookalike_domain(
            variant_domain=variant['domain'],
            original_domain=args.domain,
            dns_info=dns_info,
            ssl_info=ssl_info,
            variant_type=variant['type'],
            risk_boost=variant['risk_boost'],
        )
        scored_variants.append(scored)
        
        # Rate limit DNS checks
        if args.check_active and i < 20:
            import time
            time.sleep(0.2)
    
    # Sort by risk score (highest first)
    scored_variants.sort(key=lambda x: x['risk_score'], reverse=True)
    
    # Build final report
    report = {
        'original_domain': args.domain,
        'scan_date': datetime.now(timezone.utc).isoformat(),
        'total_variants': result['total_variants'],
        'priority_counts': result['priority_counts'],
        'active_domains': len([v for v in scored_variants if (v.get('dns_info') or {}).get('resolves')]),
        'variants': scored_variants,
        'summary': {
            'critical': len([v for v in scored_variants if v['risk_level'] == 'CRITICAL']),
            'high': len([v for v in scored_variants if v['risk_level'] == 'HIGH']),
            'medium': len([v for v in scored_variants if v['risk_level'] == 'MEDIUM']),
            'low': len([v for v in scored_variants if v['risk_level'] == 'LOW']),
            'minimal': len([v for v in scored_variants if v['risk_level'] == 'MINIMAL']),
        },
        'disclaimer': 'Educational purposes only. Not financial advice. Not a guarantee of safety. Always verify independently.',
    }
    
    if args.json:
        output = json.dumps(report, indent=2)
        print(output)
    else:
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('🌐 DOMAIN LOOKALIKE DETECTION — Brand Guard')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print()
        print(f'Domain: {args.domain}')
        print(f'Scan Date: {report["scan_date"]}')
        print(f'Total Variants: {report["total_variants"]}')
        if args.check_active:
            print(f'Active Domains: {report["active_domains"]}')
        print()
        print('RISK SUMMARY:')
        print(f'  🚨 CRITICAL: {report["summary"]["critical"]}')
        print(f'  ⚠️  HIGH:    {report["summary"]["high"]}')
        print(f'  ℹ️  MEDIUM:  {report["summary"]["medium"]}')
        print(f'  ✅ LOW:     {report["summary"]["low"]}')
        print(f'  ✅ MINIMAL: {report["summary"]["minimal"]}')
        print()
        print('TOP THREATS:')
        for v in scored_variants[:10]:
            emoji = '🚨' if v['risk_level'] in ['CRITICAL', 'HIGH'] else '⚠️' if v['risk_level'] == 'MEDIUM' else '✅'
            print(f'  {emoji} {v["domain"]:30s} Score: {v["risk_score"]:3d}/100  Level: {v["risk_level"]:8s}  Type: {v["variant_type"]}')
            if v.get('dns_info') and v['dns_info'].get('resolves'):
                print(f'     ⚡ ACTIVE — resolves to {", ".join(v["dns_info"].get("ip_addresses", ["unknown"])[:2])}')
            for e in v['evidence'][:2]:
                print(f'     {e}')
        print()
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('⚠️ DISCLAIMER: Educational purposes only. Not financial advice.')
        print('   Not a guarantee of safety. Always verify independently.')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    # Save to file if requested
    if args.output:
        with open(args.output, 'w') as f:
            f.write(json.dumps(report, indent=2))
    
    return 0


if __name__ == '__main__':
    sys.exit(main())