# Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
# See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
# Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

#!/usr/bin/env python3
"""
Brand Similarity Scorer — Brand Guard by Jeeevs / AgenticBro
=============================================================
Scores how similar a discovered profile is to the legitimate brand.
Detects impersonation patterns beyond exact username matches.

Uses:
  - Levenshtein distance for handle similarity
  - Display name similarity
  - Bio keyword matching (brand + common impersonation terms)
  - Cross-platform identity patterns
  - Scammer database cross-reference

Input: JSON from stdin (scan results + brand context)
Output: JSON with similarity scores and impersonation assessment
"""

import json
import sys
import re
from difflib import SequenceMatcher
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone


# ── Impersonation indicator keywords in bios ──────────────────────────────────
IMPERSONATION_KEYWORDS = [
    "official", "real", "verified", "support", "help", "service",
    "customer", "admin", "team", "security", "alert", "update",
    "giveaway", "airdrop", "claim", "free", "reward", "bonus",
    "dm me", "pm me", "message us", "contact us", "join now",
    "limited time", "hurry", "act now", "last chance",
]

# ── Brand protection keywords (things that make impersonation more dangerous) ──
HIGH_RISK_BIO_TERMS = [
    "send", "wallet", "deposit", "transfer", "invest",
    "presale", "token", "contract", "address", "crypto",
    "defi", "nft", "mint", "staking", "yield",
]


def levenshtein_distance(s1: str, s2: str) -> int:
    """Calculate Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]


def similarity_score(s1: str, s2: str) -> float:
    """Calculate similarity ratio (0.0-1.0) using SequenceMatcher + Levenshtein."""
    s1_lower = s1.lower().strip()
    s2_lower = s2.lower().strip()
    
    if s1_lower == s2_lower:
        return 1.0
    if not s1_lower or not s2_lower:
        return 0.0
    
    # Combine SequenceMatcher ratio with Levenshtein distance
    seq_ratio = SequenceMatcher(None, s1_lower, s2_lower).ratio()
    max_len = max(len(s1_lower), len(s2_lower))
    lev_dist = levenshtein_distance(s1_lower, s2_lower)
    lev_ratio = 1.0 - (lev_dist / max_len) if max_len > 0 else 0.0
    
    # Weighted combination (SequenceMatcher catches rearrangements better)
    return (seq_ratio * 0.6 + lev_ratio * 0.4)


def detect_impersonation_patterns(username: str, display_name: str, bio: str, brand_handle: str) -> List[Dict[str, Any]]:
    """Detect common impersonation patterns in profile data."""
    patterns = []
    username_lower = username.lower()
    bio_lower = (bio or "").lower()
    brand_lower = brand_handle.lower()
    
    # Pattern 1: Brand name + support/admin/help suffix
    support_suffixes = ["support", "admin", "help", "service", "official", "real", "team", "care", "security", "info"]
    for suffix in support_suffixes:
        if username_lower.endswith(suffix) and brand_lower in username_lower:
            patterns.append({
                "pattern": "support_suffix",
                "detail": f"Username '{username}' ends with '{suffix}' after brand name",
                "severity": "high",
                "points": 8,
            })
            break
    
    # Pattern 2: Brand name + impersonation prefix
    impersonation_prefixes = ["the", "real", "official", "my", "get", "join"]
    for prefix in impersonation_prefixes:
        if username_lower.startswith(prefix) and brand_lower in username_lower:
            patterns.append({
                "pattern": "impersonation_prefix",
                "detail": f"Username '{username}' starts with '{prefix}' before brand name",
                "severity": "medium",
                "points": 5,
            })
            break
    
    # Pattern 3: Impersonation keywords in bio
    for keyword in IMPERSONATION_KEYWORDS:
        if keyword in bio_lower and brand_lower in bio_lower:
            patterns.append({
                "pattern": "impersonation_keyword_in_bio",
                "detail": f"Bio contains '{keyword}' alongside brand reference",
                "severity": "high" if keyword in ["giveaway", "airdrop", "claim", "free", "dm me"] else "medium",
                "points": 7 if keyword in ["giveaway", "airdrop", "claim", "free", "dm me"] else 4,
            })
            break  # Only flag once per keyword category
    
    # Pattern 4: High-risk terms in bio (financial solicitation)
    for term in HIGH_RISK_BIO_TERMS:
        if term in bio_lower:
            patterns.append({
                "pattern": "high_risk_bio_term",
                "detail": f"Bio contains financial term '{term}'",
                "severity": "high",
                "points": 6,
            })
            break
    
    # Pattern 5: Verified claim without verification
    if "verified" in bio_lower or "✓" in (bio or "") or "✅" in (bio or ""):
        patterns.append({
            "pattern": "false_verification_claim",
            "detail": "Bio claims verification or contains checkmark symbols",
            "severity": "high",
            "points": 7,
        })
    
    # Pattern 6: New account with brand name (account age < 30 days is suspicious)
    # This would be checked by the caller with actual account data
    
    return patterns


def score_brand_impersonation(
    brand_name: str,
    brand_domain: str,
    brand_handle: str,
    profile_data: Dict[str, Any],
    scammer_db_matches: List[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Score a profile for brand impersonation risk.
    
    Args:
        brand_name: The legitimate brand name
        brand_domain: The legitimate brand domain
        brand_handle: The legitimate brand handle
        profile_data: Discovered profile data from scan
        scammer_db_matches: Any matches from the scammer database
    
    Returns:
        Impersonation assessment with scores and evidence
    """
    username = profile_data.get("username", "").lower().lstrip("@")
    display_name = (profile_data.get("display_name") or "").lower()
    bio = profile_data.get("bio") or ""
    followers = profile_data.get("followers", 0)
    verified = profile_data.get("verified", False)
    platform = profile_data.get("platform", "unknown")
    
    # Parse numeric followers
    if isinstance(followers, str):
        followers = int(re.sub(r'[^\d]', '', followers) or '0')
    
    # ── Handle Similarity Score ─────────────────────────────────────────────
    handle_similarity = similarity_score(username, brand_handle)
    
    # Also check display name similarity
    name_similarity = similarity_score(display_name, brand_name.lower()) if display_name else 0.0
    
    # ── Impersonation Pattern Detection ─────────────────────────────────────
    patterns = detect_impersonation_patterns(username, display_name, bio, brand_handle)
    
    # ── Calculate Impersonation Score ────────────────────────────────────────
    impersonation_score = 0.0
    evidence = []
    
    # Handle similarity (0-40 points)
    if handle_similarity >= 0.9:
        impersonation_score += 40
        evidence.append(f"Very similar handle: @{username} vs @{brand_handle} ({handle_similarity:.0%} match)")
    elif handle_similarity >= 0.7:
        impersonation_score += 30
        evidence.append(f"Similar handle: @{username} vs @{brand_handle} ({handle_similarity:.0%} match)")
    elif handle_similarity >= 0.5:
        impersonation_score += 15
        evidence.append(f"Somewhat similar handle: @{username} vs @{brand_handle} ({handle_similarity:.0%} match)")
    elif handle_similarity >= 0.3:
        impersonation_score += 5
        evidence.append(f"Slightly similar handle: @{username} vs @{brand_handle} ({handle_similarity:.0%} match)")
    
    # Display name similarity (0-20 points)
    if name_similarity >= 0.8:
        impersonation_score += 20
        evidence.append(f"Very similar display name: '{display_name}' vs '{brand_name}'")
    elif name_similarity >= 0.5:
        impersonation_score += 10
        evidence.append(f"Similar display name: '{display_name}' vs '{brand_name}'")
    
    # Impersonation patterns (0-30 points max)
    pattern_points = sum(p["points"] for p in patterns)
    impersonation_score += min(pattern_points, 30)
    for p in patterns:
        evidence.append(f"[{p['severity'].upper()}] {p['detail']}")
    
    # Unverified account using brand name (0-10 points)
    if not verified and (handle_similarity >= 0.5 or name_similarity >= 0.5):
        impersonation_score += 10
        evidence.append("Unverified account using brand-like name")
    
    # Low follower count for a brand account (0-10 points)
    if followers > 0 and followers < 100 and handle_similarity >= 0.5:
        impersonation_score += 10
        evidence.append(f"Low followers ({followers}) for brand-like account")
    elif followers > 0 and followers < 1000 and handle_similarity >= 0.7:
        impersonation_score += 5
        evidence.append(f"Moderate followers ({followers}) for brand-like account")
    
    # Scammer database match (0-20 points)
    if scammer_db_matches:
        impersonation_score += 20
        for match in scammer_db_matches[:3]:
            evidence.append(f"Known scammer: {match.get('name', match.get('username', 'Unknown'))} - {match.get('scam_type', 'Unknown scam')}")
    
    # Cap at 100
    impersonation_score = min(impersonation_score, 100)
    
    # ── Determine Risk Level ────────────────────────────────────────────────
    if impersonation_score >= 70:
        risk_level = "CRITICAL"
        threat_type = "Likely brand impersonation"
    elif impersonation_score >= 45:
        risk_level = "HIGH"
        threat_type = "Probable brand impersonation"
    elif impersonation_score >= 25:
        risk_level = "MEDIUM"
        threat_type = "Possible brand impersonation"
    elif impersonation_score >= 10:
        risk_level = "LOW"
        threat_type = "Unlikely brand impersonation"
    else:
        risk_level = "MINIMAL"
        threat_type = "No significant impersonation risk"
    
    # ── Takedown Recommendations ─────────────────────────────────────────────
    takedown_actions = []
    if risk_level in ["CRITICAL", "HIGH"]:
        takedown_actions.append({
            "platform": platform,
            "action": "Report for impersonation",
            "priority": "Urgent",
            "evidence": [f"Handle similarity: {handle_similarity:.0%}", f"Patterns detected: {len(patterns)}"],
        })
    if patterns and risk_level in ["CRITICAL", "HIGH", "MEDIUM"]:
        financial_patterns = [p for p in patterns if p["pattern"] == "high_risk_bio_term"]
        if financial_patterns:
            takedown_actions.append({
                "platform": platform,
                "action": "Report for financial solicitation",
                "priority": "Urgent",
                "evidence": [p["detail"] for p in financial_patterns],
            })
    if risk_level == "MEDIUM":
        takedown_actions.append({
            "platform": platform,
            "action": "Monitor and document",
            "priority": "Medium",
            "evidence": [f"Similarity: {handle_similarity:.0%}", f"Unverified account"],
        })
    
    return {
        "brand": {
            "name": brand_name,
            "domain": brand_domain,
            "handle": brand_handle,
        },
        "profile": {
            "username": username,
            "display_name": display_name,
            "platform": platform,
            "verified": verified,
            "followers": followers,
        },
        "scores": {
            "handle_similarity": round(handle_similarity, 3),
            "name_similarity": round(name_similarity, 3),
            "impersonation_score": round(impersonation_score, 1),
            "risk_level": risk_level,
        },
        "threat_type": threat_type,
        "patterns_detected": patterns,
        "evidence": evidence,
        "scammer_db_matches": scammer_db_matches or [],
        "takedown_actions": takedown_actions,
        "scan_date": datetime.now(timezone.utc).isoformat(),
        "disclaimer": "Educational purposes only. Not a guarantee of impersonation. Always verify independently.",
    }


def main():
    """Read scan results from stdin and score for brand impersonation."""
    if sys.stdin.isatty():
        print("Usage: echo '<scan_json>' | python3 brand-similarity-scorer.py --brand 'Acme Corp' --handle acmecorp [--domain acmecorp.com]")
        print("   or: python3 brand-similarity-scorer.py --brand 'Acme Corp' --handle acmecorp --scan-file results.json")
        sys.exit(1)
    
    import argparse
    parser = argparse.ArgumentParser(description="Score brand impersonation risk")
    parser.add_argument("--brand", required=True, help="Legitimate brand name")
    parser.add_argument("--handle", required=True, help="Legitimate brand handle")
    parser.add_argument("--domain", default="", help="Legitimate brand domain")
    parser.add_argument("--scammer-db", default="/Users/efinney/.openclaw/workspace/scammer-database.csv", help="Path to scammer database")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()
    
    # Read scan results from stdin
    try:
        scan_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Load scammer database for cross-reference
    scammer_matches = []
    try:
        import csv
        with open(args.scammer_db, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Exact match or very close match on handles
                x_handle = (row.get("X Handle") or "").lower().lstrip("@")
                tg_channel = (row.get("Telegram Channel") or "").lower().replace("t.me/", "")
                scan_username = (scan_data.get("username") or "").lower().lstrip("@")
                if scan_username and (scan_username == x_handle or scan_username == tg_channel):
                    scammer_matches.append(row)
    except Exception:
        pass  # Scammer DB not available, skip
    
    # Score the profile
    result = score_brand_impersonation(
        brand_name=args.brand,
        brand_domain=args.domain,
        brand_handle=args.handle,
        profile_data=scan_data,
        scammer_db_matches=scammer_matches,
    )
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Brand Impersonation Assessment")
        print(f"{'='*50}")
        print(f"Brand: {args.brand} (@{args.handle})")
        print(f"Profile: @{result['profile']['username']} on {result['profile']['platform']}")
        print(f"\nHandle Similarity: {result['scores']['handle_similarity']:.0%}")
        print(f"Name Similarity: {result['scores']['name_similarity']:.0%}")
        print(f"Impersonation Score: {result['scores']['impersonation_score']}/100")
        print(f"Risk Level: {result['scores']['risk_level']}")
        print(f"Threat Type: {result['threat_type']}")
        print(f"\nEvidence:")
        for e in result["evidence"]:
            print(f"  • {e}")
        if result["takedown_actions"]:
            print(f"\nTakedown Actions:")
            for t in result["takedown_actions"]:
                print(f"  • [{t['priority']}] {t['action']} on {t['platform']}")
    
    return 0


if __name__ == "__main__":
    main()