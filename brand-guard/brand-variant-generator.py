# Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
# See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
# Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

#!/usr/bin/env python3
"""
Brand Variant Generator — Brand Guard by Jeeevs / AgenticBro
=============================================================
Generates typosquatting and impersonation variants for a brand name.
Used by brand-impersonator-detect.sh to search across platforms.

Usage:
  python3 brand-variant-generator.py "Acme Corp" --domain acmecorp.com

Output: JSON array of variant objects with type classification.
"""

import argparse
import json
import re
import sys
from itertools import product
from typing import List, Dict, Any

# ── Impersonator username suffixes (what scammers add to brand names) ──────────
IMPERSONATOR_SUFFIXES = [
    "official", "real", "support", "help", "service", "team",
    "admin", "info", "customer", "care", "security", "alerts",
    "news", "update", "verified", "authentic", "live", "global",
    "intl", "us", "uk", "asia", "defi", "crypto", "airdrop",
    "free", "promo", "claim", "rewards", "bonus", "giveaway",
    "nft", "token", "coin", "swap", "trade", "invest",
]

# ── Common TLD swaps for domain monitoring ─────────────────────────────────────
TLD_SWAPS = [".com", ".io", ".co", ".net", ".org", ".app", ".xyz", ".dev", ".tech", ".finance"]

# ── Common impersonation prefixes ─────────────────────────────────────────────
IMPERSONATOR_PREFIXES = [
    "the", "real", "my", "get", "join", "official", "we",
]


def normalize_brand(brand_name: str) -> Dict[str, str]:
    """Extract normalized components from a brand name."""
    # Remove common business suffixes for matching
    suffixes = ["inc", "llc", "ltd", "corp", "co", "group", "holdings", "ventures", "labs"]
    clean = brand_name.lower().strip()
    base = clean
    for suffix in suffixes:
        clean = re.sub(rf"\b{suffix}\b\.?", "", clean).strip()
    # Also remove trailing punctuation
    clean = clean.rstrip(".,").strip()
    
    # Split into words
    words = clean.split()
    # Generate handle version (no spaces, lowercase)
    handle = "".join(words).lower()
    # Generate snake case
    snake = "_".join(words).lower()
    # Generate kebab case
    kebab = "-".join(words).lower()
    
    return {
        "original": brand_name,
        "clean": clean,
        "handle": handle,
        "snake": snake,
        "kebab": kebab,
        "words": words,
    }


def generate_typosquatting_variants(handle: str) -> List[Dict[str, Any]]:
    """Generate common typosquatting variations of a handle."""
    variants = []
    
    # 1. Adjacent key swaps (common typos)
    keyboard_adjacent = {
        'a': ['q', 's', 'z'], 'b': ['v', 'g', 'n'], 'c': ['x', 'd', 'f'],
        'd': ['s', 'e', 'c', 'f'], 'e': ['w', 'r', 'd', '3'],
        'f': ['d', 'g', 'v', 'c'], 'g': ['f', 'h', 'b', 'v'],
        'h': ['g', 'j', 'n', 'b'], 'i': ['u', 'o', 'k', '8'],
        'j': ['h', 'k', 'm', 'n'], 'k': ['j', 'l', 'i', 'm'],
        'l': ['k', 'o'], 'm': ['n', 'j', 'k'],
        'n': ['b', 'm', 'j', 'h'], 'o': ['i', 'p', 'l', '9'],
        'p': ['o', '0'], 'q': ['w', 'a', '1'],
        'r': ['e', 't', 'f', 'd'], 's': ['a', 'd', 'w', 'e'],
        't': ['r', 'y', 'g', 'f'], 'u': ['y', 'i', 'j', '7'],
        'v': ['c', 'b', 'g', 'f'], 'w': ['q', 'e', 's', 'a'],
        'x': ['z', 'c', 's', 'd'], 'y': ['t', 'u', 'g', 'h'],
        'z': ['x', 'a', 's'],
        '0': ['o', '9'], '1': ['q', 'l', 'i'], '2': ['w', '3'],
        '3': ['e', '4', '2'], '5': ['6', 't'], '8': ['i', '9', '7'],
        '9': ['o', '0', '8'],
    }
    
    # Generate single-character swaps (limit to prevent explosion)
    for i, char in enumerate(handle[:12]):  # Cap at 12 chars for safety
        if char in keyboard_adjacent:
            for replacement in keyboard_adjacent[char][:2]:  # Max 2 per position
                variant = handle[:i] + replacement + handle[i+1:]
                variants.append({
                    "variant": variant,
                    "type": "typo",
                    "method": f"key_swap_{char}->{replacement}_pos{i}",
                    "risk_boost": 0.3,
                })
    
    # 2. Character omission (dropping a letter)
    for i in range(min(len(handle), 10)):
        variant = handle[:i] + handle[i+1:]
        if variant:  # Don't create empty
            variants.append({
                "variant": variant,
                "type": "typo",
                "method": f"omit_pos{i}",
                "risk_boost": 0.2,
            })
    
    # 3. Character duplication
    for i in range(min(len(handle), 10)):
        variant = handle[:i] + handle[i] + handle[i:]
        if len(variant) <= 20:  # Cap length
            variants.append({
                "variant": variant,
                "type": "typo",
                "method": f"dup_pos{i}",
                "risk_boost": 0.2,
            })
    
    # 4. Homoglyph substitution (visually similar characters)
    homoglyphs = {
        'a': ['4', '@'], 'e': ['3'], 'g': ['9'], 'i': ['1', 'l'],
        'l': ['1', 'i'], 'o': ['0'], 's': ['5', '$'], 't': ['7'],
    }
    for i, char in enumerate(handle[:10]):
        if char in homoglyphs:
            for replacement in homoglyphs[char]:
                variant = handle[:i] + replacement + handle[i+1:]
                variants.append({
                    "variant": variant,
                    "type": "homoglyph",
                    "method": f"homo_{char}->{replacement}_pos{i}",
                    "risk_boost": 0.4,
                })
    
    return variants


def generate_impersonator_variants(handle: str, words: List[str]) -> List[Dict[str, Any]]:
    """Generate common impersonation patterns scammers use."""
    variants = []
    
    # 1. Brand + impersonator suffix (most common pattern)
    for suffix in IMPERSONATOR_SUFFIXES[:15]:  # Top 15 only for scan speed
        # Handle format: brandname_support
        variants.append({
            "variant": f"{handle}_{suffix}",
            "type": "impersonator_suffix",
            "method": f"handle+_{suffix}",
            "risk_boost": 0.5,
        })
        # Also try: brandnamesupport (no separator)
        variants.append({
            "variant": f"{handle}{suffix}",
            "type": "impersonator_suffix",
            "method": f"handle+{suffix}",
            "risk_boost": 0.5,
        })
    
    # 2. Prefix + brand
    for prefix in IMPERSONATOR_PREFIXES:
        variants.append({
            "variant": f"{prefix}{handle}",
            "type": "impersonator_prefix",
            "method": f"{prefix}+handle",
            "risk_boost": 0.4,
        })
        variants.append({
            "variant": f"{prefix}_{handle}",
            "type": "impersonator_prefix",
            "method": f"{prefix}_+handle",
            "risk_boost": 0.4,
        })
    
    # 3. Multi-word brand patterns
    if len(words) > 1:
        # Swap word order: "corpacme" for "acmecorp"
        reversed_handle = "".join(reversed(words)).lower()
        variants.append({
            "variant": reversed_handle,
            "type": "word_swap",
            "method": "reversed_word_order",
            "risk_boost": 0.3,
        })
    
    return variants


def generate_domain_variants(domain: str, handle: str) -> List[Dict[str, Any]]:
    """Generate domain typosquatting variants."""
    variants = []
    
    if not domain:
        return variants
    
    # Extract base domain (without TLD)
    parts = domain.rsplit(".", 1)
    if len(parts) == 2:
        base, tld = parts
    else:
        base = domain
        tld = "com"
    
    # 1. TLD swaps: acmecorp.io, acmecorp.net, etc.
    for swap_tld in TLD_SWAPS:
        if f".{swap_tld.lstrip('.')}" != f".{tld}":
            swap_domain = f"{base}.{swap_tld.lstrip('.')}"
            variants.append({
                "variant": swap_domain,
                "type": "tld_swap",
                "method": f"tld_swap_{tld}->{swap_tld}",
                "risk_boost": 0.5,
            })
    
    # 2. Hyphenated: acme-corp.com
    if len(handle) > 4:
        # Insert hyphen at common positions
        for pos in [len(handle)//2, len(handle)//3, len(handle)*2//3]:
            if 0 < pos < len(handle):
                hyphenated = f"{handle[:pos]}-{handle[pos:]}.{tld}"
                variants.append({
                    "variant": hyphenated,
                    "type": "hyphen_insertion",
                    "method": f"hyphen_pos{pos}",
                    "risk_boost": 0.4,
                })
    
    # 3. Prefix additions: myacmecorp.com, getacmecorp.com
    for prefix in ["my", "get", "app", "login", "secure", "account", "verify"]:
        prefixed_domain = f"{prefix}{base}.{tld}"
        variants.append({
            "variant": prefixed_domain,
            "type": "domain_prefix",
            "method": f"prefix_{prefix}",
            "risk_boost": 0.6,  # Higher risk — these are classic phishing
        })
    
    # 4. Character swaps in domain (same as typosquatting but for domains)
    for i in range(min(len(base), 6)):  # Limit to 6 positions
        if base[i] in "aeiou":
            # Swap vowel for another vowel
            for vowel in "aeiou":
                if vowel != base[i]:
                    swapped = base[:i] + vowel + base[i+1:] + f".{tld}"
                    variants.append({
                        "variant": swapped,
                        "type": "domain_typo",
                        "method": f"vowel_swap_{base[i]}->{vowel}_pos{i}",
                        "risk_boost": 0.3,
                    })
    
    return variants


def generate_all_variants(brand_name: str, domain: str = "") -> Dict[str, Any]:
    """Generate all variant types for a brand."""
    norm = normalize_brand(brand_name)
    handle = norm["handle"]
    words = norm["words"]
    
    # Generate each category
    typosquatting = generate_typosquatting_variants(handle)
    impersonators = generate_impersonator_variants(handle, words)
    domain_variants = generate_domain_variants(domain or f"{handle}.com", handle)
    
    # Deduplicate variants
    seen = set()
    all_variants = []
    for v in typosquatting + impersonators:
        key = v["variant"].lower()
        if key not in seen and key != handle.lower():  # Don't include exact brand
            seen.add(key)
            all_variants.append(v)
    
    # Deduplicate domain variants separately
    seen_domains = set()
    unique_domain_variants = []
    for v in domain_variants:
        key = v["variant"].lower()
        if key not in seen_domains and key != (domain or f"{handle}.com").lower():
            seen_domains.add(key)
            unique_domain_variants.append(v)
    
    # Sort by risk boost (highest first = scan most dangerous first)
    all_variants.sort(key=lambda x: x["risk_boost"], reverse=True)
    unique_domain_variants.sort(key=lambda x: x["risk_boost"], reverse=True)
    
    return {
        "brand": {
            "name": brand_name,
            "domain": domain,
            "handle": handle,
            "normalized": norm["clean"],
        },
        "social_variants": {
            "total": len(all_variants),
            "typosquatting": len([v for v in all_variants if v["type"] == "typo"]),
            "homoglyph": len([v for v in all_variants if v["type"] == "homoglyph"]),
            "impersonator": len([v for v in all_variants if v["type"].startswith("impersonator")]),
            "word_swap": len([v for v in all_variants if v["type"] == "word_swap"]),
            "variants": all_variants,
        },
        "domain_variants": {
            "total": len(unique_domain_variants),
            "tld_swap": len([v for v in unique_domain_variants if v["type"] == "tld_swap"]),
            "hyphen": len([v for v in unique_domain_variants if v["type"] == "hyphen_insertion"]),
            "domain_prefix": len([v for v in unique_domain_variants if v["type"] == "domain_prefix"]),
            "domain_typo": len([v for v in unique_domain_variants if v["type"] == "domain_typo"]),
            "variants": unique_domain_variants,
        },
        "scan_priority": {
            "high": [v for v in all_variants if v["risk_boost"] >= 0.5],
            "medium": [v for v in all_variants if 0.3 <= v["risk_boost"] < 0.5],
            "low": [v for v in all_variants if v["risk_boost"] < 0.3],
        }
    }


def main():
    parser = argparse.ArgumentParser(description="Generate brand impersonation variants")
    parser.add_argument("brand_name", help="Brand name (e.g., 'Acme Corp')")
    parser.add_argument("--domain", default="", help="Brand domain (e.g., 'acmecorp.com')")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--limit", type=int, default=50, help="Max social variants to return (default 50)")
    args = parser.parse_args()
    
    result = generate_all_variants(args.brand_name, args.domain)
    
    # Limit social variants for scan speed
    if len(result["social_variants"]["variants"]) > args.limit:
        result["social_variants"]["variants"] = result["social_variants"]["variants"][:args.limit]
        result["social_variants"]["total"] = len(result["social_variants"]["variants"])
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Brand: {args.brand_name}")
        if args.domain:
            print(f"Domain: {args.domain}")
        print(f"Handle: {result['brand']['handle']}")
        print(f"\nSocial Variants: {result['social_variants']['total']}")
        print(f"  Typosquatting: {result['social_variants']['typosquatting']}")
        print(f"  Homoglyphs: {result['social_variants']['homoglyph']}")
        print(f"  Impersonator patterns: {result['social_variants']['impersonator']}")
        print(f"\nDomain Variants: {result['domain_variants']['total']}")
        print(f"  TLD swaps: {result['domain_variants']['tld_swap']}")
        print(f"  Hyphen insertions: {result['domain_variants']['hyphen']}")
        print(f"  Domain prefixes: {result['domain_variants']['domain_prefix']}")
        print(f"\nHigh Priority Scans ({len(result['scan_priority']['high'])}):")
        for v in result["scan_priority"]["high"][:10]:
            print(f"  @{v['variant']} ({v['type']}, +{v['risk_boost']})")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())