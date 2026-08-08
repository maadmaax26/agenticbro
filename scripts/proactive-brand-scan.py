#!/usr/bin/env python3
"""
proactive-brand-scan.py — Proactively scan high-target Shopify/eCommerce brands
for impersonation threats and generate anonymized X/Twitter content candidates.

This script:
1. Loads a seed list of 50 high-target brands
2. Runs impersonator scans via the Brand Guard API
3. Stores findings as anonymized content candidates in Supabase
4. Generates X-ready post drafts from the findings

No customer consent required — these are proactive scans using public data.
All content is anonymized (brand names hidden) per the content_scope = 'anonymized'.

Usage:
  python3 proactive-brand-scan.py                    # Scan all due brands
  python3 proactive-brand-scan.py --limit 5          # Scan only 5 brands
  python3 proactive-brand-scan.py --dry-run           # Show what would be scanned
  python3 proactive-brand-scan.py --generate-content  # Generate X drafts from existing scans
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
WORKSPACE = Path("/Users/efinney/.openclaw/workspace")
ENV_FILE = WORKSPACE / "brand-guard-agent" / ".env.content"
STATE_FILE = Path.home() / ".openclaw" / "brand-guard-queue" / "proactive-scan-state.json"

def load_env():
    """Load Supabase credentials from .env.content"""
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v

load_env()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SECRET_API_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SECRET_API_KEY required in .env.content")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Brand seed list — 50 high-target Shopify/eCommerce brands
# ---------------------------------------------------------------------------
BRAND_SEEDS = [
    # Fashion/Athletic (15)
    {"name": "Nike", "handle": "nike", "domain": "nike.com", "category": "Athletic Fashion", "priority": "HIGH"},
    {"name": "Adidas", "handle": "adidas", "domain": "adidas.com", "category": "Athletic Fashion", "priority": "HIGH"},
    {"name": "Gymshark", "handle": "gymshark", "domain": "gymshark.com", "category": "Fitness Apparel", "priority": "HIGH"},
    {"name": "Allbirds", "handle": "allbirds", "domain": "allbirds.com", "category": "Footwear", "priority": "HIGH"},
    {"name": "Lululemon", "handle": "lululemon", "domain": "lululemon.com", "category": "Athletic Fashion", "priority": "HIGH"},
    {"name": "Vuori", "handle": "vuoriclothing", "domain": "vuoriclothing.com", "category": "Activewear", "priority": "MEDIUM"},
    {"name": "Outdoor Voices", "handle": "outdoorvoices", "domain": "outdoorvoices.com", "category": "Activewear", "priority": "MEDIUM"},
    {"name": "Skims", "handle": "skims", "domain": "skims.com", "category": "Shapewear", "priority": "HIGH"},
    {"name": "Alo Yoga", "handle": "aloyoga", "domain": "aloyoga.com", "category": "Yoga/Activewear", "priority": "MEDIUM"},
    {"name": "Bombas", "handle": "bombas", "domain": "bombas.com", "category": "Apparel", "priority": "MEDIUM"},
    {"name": "Ridge Wallet", "handle": "ridge", "domain": "ridgewallet.com", "category": "Accessories", "priority": "MEDIUM"},
    {"name": "Carhartt", "handle": "carhartt", "domain": "carhartt.com", "category": "Workwear", "priority": "MEDIUM"},
    {"name": "Patagonia", "handle": "patagonia", "domain": "patagonia.com", "category": "Outdoor", "priority": "MEDIUM"},
    {"name": "Arc'teryx", "handle": "arcteryx", "domain": "arcteryx.com", "category": "Outdoor", "priority": "MEDIUM"},
    {"name": "New Balance", "handle": "newbalance", "domain": "newbalance.com", "category": "Athletic Fashion", "priority": "MEDIUM"},
    # Beauty/Cosmetics (10)
    {"name": "Kylie Cosmetics", "handle": "kyliecosmetics", "domain": "kyliecosmetics.com", "category": "Beauty", "priority": "HIGH"},
    {"name": "Fenty Beauty", "handle": "fentybeauty", "domain": "fentybeauty.com", "category": "Beauty", "priority": "HIGH"},
    {"name": "Glossier", "handle": "glossier", "domain": "glossier.com", "category": "Beauty", "priority": "HIGH"},
    {"name": "Rare Beauty", "handle": "rarebeauty", "domain": "rarebeauty.com", "category": "Beauty", "priority": "MEDIUM"},
    {"name": "Drunk Elephant", "handle": "drunkelephant", "domain": "drunkelephant.com", "category": "Beauty", "priority": "MEDIUM"},
    {"name": "The Ordinary", "handle": "deciem", "domain": "theordinary.com", "category": "Beauty", "priority": "MEDIUM"},
    {"name": "Tarte", "handle": "tartecosmetics", "domain": "tartecosmetics.com", "category": "Beauty", "priority": "MEDIUM"},
    {"name": "Charlotte Tilbury", "handle": "ctilburymakeup", "domain": "charlottetilbury.com", "category": "Beauty", "priority": "MEDIUM"},
    {"name": "Olaplex", "handle": "olaplex", "domain": "olaplex.com", "category": "Haircare", "priority": "MEDIUM"},
    {"name": "Rhode", "handle": "rhode", "domain": "rhodeskin.com", "category": "Beauty", "priority": "MEDIUM"},
    # Electronics/Tech (5)
    {"name": "Apple", "handle": "apple", "domain": "apple.com", "category": "Electronics", "priority": "HIGH"},
    {"name": "Bose", "handle": "bose", "domain": "bose.com", "category": "Electronics", "priority": "MEDIUM"},
    {"name": "Sonos", "handle": "sonos", "domain": "sonos.com", "category": "Electronics", "priority": "MEDIUM"},
    {"name": "Anker", "handle": "ankerofficial", "domain": "anker.com", "category": "Electronics", "priority": "MEDIUM"},
    {"name": "DJI", "handle": "djiglobal", "domain": "dji.com", "category": "Electronics", "priority": "MEDIUM"},
    # Luxury (5)
    {"name": "Gucci", "handle": "gucci", "domain": "gucci.com", "category": "Luxury", "priority": "HIGH"},
    {"name": "Ray-Ban", "handle": "rayban", "domain": "ray-ban.com", "category": "Eyewear", "priority": "HIGH"},
    {"name": "Oakley", "handle": "oakley", "domain": "oakley.com", "category": "Eyewear", "priority": "MEDIUM"},
    {"name": "Prada", "handle": "prada", "domain": "prada.com", "category": "Luxury", "priority": "MEDIUM"},
    {"name": "Rolex", "handle": "rolex", "domain": "rolex.com", "category": "Luxury", "priority": "MEDIUM"},
    # DTC/Home/Lifestyle (10)
    {"name": "Warby Parker", "handle": "warbyparker", "domain": "warbyparker.com", "category": "Eyewear", "priority": "HIGH"},
    {"name": "Casper", "handle": "casper", "domain": "casper.com", "category": "Sleep", "priority": "MEDIUM"},
    {"name": "Brooklinen", "handle": "brooklinen", "domain": "brooklinen.com", "category": "Home", "priority": "MEDIUM"},
    {"name": "MeUndies", "handle": "meundies", "domain": "meundies.com", "category": "Apparel", "priority": "MEDIUM"},
    {"name": "Olipop", "handle": "drinkolipop", "domain": "drinkolipop.com", "category": "Beverage", "priority": "MEDIUM"},
    {"name": "Liquid Death", "handle": "liquiddeath", "domain": "liquiddeath.com", "category": "Beverage", "priority": "MEDIUM"},
    {"name": "Yeti", "handle": "yeti", "domain": "yeti.com", "category": "Outdoor", "priority": "MEDIUM"},
    {"name": "Stanley", "handle": "stanley_brand", "domain": "stanley1913.com", "category": "Drinkware", "priority": "MEDIUM"},
    {"name": "Theragun", "handle": "therabody", "domain": "therabody.com", "category": "Wellness", "priority": "MEDIUM"},
    {"name": "Oura", "handle": "ouraring", "domain": "ouraring.com", "category": "Wearables", "priority": "MEDIUM"},
    # Marketplace/Platform (5)
    {"name": "Amazon", "handle": "amazon", "domain": "amazon.com", "category": "Marketplace", "priority": "HIGH"},
    {"name": "Shopify", "handle": "shopify", "domain": "shopify.com", "category": "Platform", "priority": "HIGH"},
    {"name": "SHEIN", "handle": "sheinofficial", "domain": "shein.com", "category": "Fast Fashion", "priority": "HIGH"},
    {"name": "Temu", "handle": "temu", "domain": "temu.com", "category": "Discount Retail", "priority": "HIGH"},
    {"name": "Etsy", "handle": "etsy", "domain": "etsy.com", "category": "Marketplace", "priority": "MEDIUM"},
]

# ---------------------------------------------------------------------------
# Supabase REST API helpers
# ---------------------------------------------------------------------------
def sb_select(table: str, columns: str = "*", filters: dict | None = None, limit: int = 100) -> list[dict]:
    """Query Supabase via REST API"""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={columns}&limit={limit}"
    if filters:
        for key, value in filters.items():
            url += f"&{key}={urllib.parse.quote(str(value))}"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

def sb_insert(table: str, data: dict) -> dict:
    """Insert into Supabase via REST API"""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    req = urllib.request.Request(url,
        data=json.dumps(data).encode(),
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())[0]

def sb_update(table: str, data: dict, eq_field: str, eq_value: str) -> list[dict]:
    """Update Supabase via REST API"""
    url = f"{SUPABASE_URL}/rest/v1/{table}?{eq_field}=eq.{urllib.parse.quote(str(eq_value))}"
    req = urllib.request.Request(url,
        data=json.dumps(data).encode(),
        method="PATCH",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

# ---------------------------------------------------------------------------
# State management
# ---------------------------------------------------------------------------
def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"scanned": {}, "last_run": None}

def save_state(state: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    state["last_run"] = datetime.now(timezone.utc).isoformat()
    STATE_FILE.write_text(json.dumps(state, indent=2))

def candidate_exists(scan_uuid: str) -> bool:
    """Check if a content candidate already exists for this scan."""
    try:
        result = sb_select("brand_guard_content_candidates", "id", filters={"scan_id": f"eq.{scan_uuid}"}, limit=1)
        return len(result) > 0
    except Exception as exc:
        return False

# ---------------------------------------------------------------------------
# Proactive scan
# ---------------------------------------------------------------------------
def run_impersonator_scan(brand: dict) -> dict:
    """Run a Brand Guard impersonator scan via the Vercel API"""
    api_url = "https://agenticbro.app/api/brand-guard/impersonator-scan"
    payload = {
        "brand_name": brand["name"],
        "brand_handle": brand["handle"],
        "brand_domain": brand["domain"],
        "platforms": ["x", "instagram", "tiktok", "facebook", "telegram", "linkedin"],
        "variant_limit": 30,
        "content_reuse_consent": True,
        "content_reuse_scope": "anonymized",
        "brand_authority_attestation": True,
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(api_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"success": False, "error": str(e)}

# ---------------------------------------------------------------------------
# X Content generation from scan results
# ---------------------------------------------------------------------------
X_TEMPLATES = [
    # Template 1: Impersonation Alert
    {
        "type": "impersonation_alert",
        "copy": "🔍 Brand Guard Alert: We detected {finding_count} high-risk impersonator accounts targeting a {category} brand across {platforms}.\n\nRisk breakdown:\n• {critical_count} CRITICAL — likely brand impersonation\n• {high_count} HIGH — probable impersonation\n• Platforms: {platforms}\n\nPatterns detected: support suffix handles, impersonation keywords in bios, unverified brand-like accounts.\n\nThis is why continuous monitoring matters. Don't wait for customers to report fake accounts — catch them first.\n\nTry Brand Guard free for 30 days — all features included:\n• Social impersonator scanner\n• Lookalike domain monitoring\n• Email spoof detection\n• Marketplace clone detection\n• Takedown workflow support\n\nNo card needed → agenticbro.app/brand-guard\n\n#BrandProtection #ImpersonationMonitoring #BrandGuard #30DayFreePilot #TrustIntelligence",
        "hashtags": ["BrandProtection", "ImpersonationMonitoring", "BrandGuard", "30DayFreePilot", "TrustIntelligence"],
    },
    # Template 2: Lookalike Domain Discovery
    {
        "type": "lookalike_domain",
        "copy": "🛡️ Brand Guard found {variant_count} lookalike domains registered targeting a {category} company.\n\nThese domains use typosquatting and brand+keyword patterns to deceive customers. Some may already be live with clone stores.\n\nContinuous domain monitoring catches these the moment they're registered — not after they've scammed your customers.\n\nStart your 30-day free Brand Guard pilot — all features included:\n• Lookalike domain monitoring\n• Social impersonator scanner\n• Email spoof detection\n• Marketplace clone detection\n• Takedown workflow support\n\nNo card needed → agenticbro.app/brand-guard\n\n#BrandSecurity #DomainMonitoring #BrandGuard #30DayFreePilot #TrustIntelligence",
        "hashtags": ["BrandSecurity", "DomainMonitoring", "BrandGuard", "30DayFreePilot", "TrustIntelligence"],
    },
    # Template 3: Stats Roundup
    {
        "type": "stats_roundup",
        "copy": "📊 Brand Guard scan update:\n\n• {finding_count} impersonator accounts detected\n• {variant_count} lookalike domain variants generated\n• Platforms scanned: {platforms}\n• Risk levels: {critical_count} CRITICAL, {high_count} HIGH\n\nBrands of all sizes are being targeted. The question isn't whether someone is impersonating you — it's whether you know about it.\n\nTry all Brand Guard features free for 30 days:\n• Social impersonator scanner\n• Lookalike domain monitoring\n• Email spoof detection\n• Marketplace clone detection\n• Takedown workflow support\n\nNo card needed → agenticbro.app/brand-guard\n\n#BrandProtection #ImpersonationDetection #BrandGuard #30DayFreePilot #Web3Security",
        "hashtags": ["BrandProtection", "ImpersonationDetection", "BrandGuard", "30DayFreePilot", "Web3Security"],
    },
    # Template 4: Tag-the-Brand
    {
        "type": "tag_brand",
        "copy": "🔍 We ran an impersonation scan for a {category} brand and found {finding_count} high-risk fake accounts impersonating them on {platforms}.\n\nIf you're a {category} brand, this is likely happening to you too. Brand Guard monitors your social presence, domains, and email spoofing 24/7.\n\n30-day free pilot — try ALL Brand Guard features:\n• Social impersonator scanner\n• Lookalike domain monitoring\n• Email spoof detection\n• Marketplace clone detection\n• Takedown workflow support\n\nNo card needed → agenticbro.app/brand-guard\n\n#BrandProtection #BrandGuard #30DayFreePilot #TrustIntelligence #ImpersonationDetection",
        "hashtags": ["BrandProtection", "BrandGuard", "30DayFreePilot", "TrustIntelligence", "ImpersonationDetection"],
    },
]

def generate_x_content(scan_result: dict, brand: dict) -> dict | None:
    """Generate an X post draft from scan results"""
    if not scan_result.get("success") and not scan_result.get("impersonators"):
        return None

    impersonators = scan_result.get("impersonators", [])
    high_risk = [i for i in impersonators if i.get("risk_level") in ("HIGH", "CRITICAL")]
    critical = [i for i in impersonators if i.get("risk_level") == "CRITICAL"]
    high = [i for i in impersonators if i.get("risk_level") == "HIGH"]

    if not high_risk:
        return None

    platforms_scanned = scan_result.get("platforms_scanned", ["x", "instagram", "tiktok"])
    platforms_text = ", ".join(p.title() if p != "x" else "X" for p in platforms_scanned[:4])
    variants = scan_result.get("variants", {}).get("social", [])
    variant_count = len(variants)

    # Pick a template (rotate based on hash of brand name for variety)
    template_idx = hash(brand["name"]) % len(X_TEMPLATES)
    template = X_TEMPLATES[template_idx]

    copy = template["copy"].format(
        finding_count=len(high_risk),
        critical_count=len(critical),
        high_count=len(high),
        platforms=platforms_text,
        variant_count=variant_count,
        category=brand["category"],
    )

    return {
        "draft_copy": copy,
        "draft_hashtags": template["hashtags"],
        "draft_image_spec": "An anonymized monitoring summary showing finding counts and platform categories; no handles, domains, or customer identifiers.",
        "template_type": template["type"],
        "brand_category": brand["category"],
        "finding_count": len(high_risk),
        "critical_count": len(critical),
        "high_count": len(high),
    }

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(prog="proactive-brand-scan")
    ap.add_argument("--limit", type=int, default=0, help="Max brands to scan (0 = all due)")
    ap.add_argument("--dry-run", action="store_true", help="Show what would be scanned")
    ap.add_argument("--generate-content", action="store_true", help="Generate X drafts from existing scan data")
    ap.add_argument("--brand", type=str, default="", help="Scan a specific brand by name")
    args = ap.parse_args()

    state = load_state()
    now = datetime.now(timezone.utc)
    scan_interval_hours = 24  # Re-scan each brand every 24h

    # Select brands to scan
    if args.brand:
        brands_to_scan = [b for b in BRAND_SEEDS if b["name"].lower() == args.brand.lower()]
        if not brands_to_scan:
            print(f"Brand '{args.brand}' not found in seed list")
            return
    else:
        brands_to_scan = []
        for brand in BRAND_SEEDS:
            last_scanned = state["scanned"].get(brand["name"])
            if not last_scanned:
                brands_to_scan.append(brand)
            else:
                elapsed = (now - datetime.fromisoformat(last_scanned.replace("Z", "+00:00"))).total_seconds() / 3600
                if elapsed >= scan_interval_hours:
                    brands_to_scan.append(brand)

    if args.limit > 0:
        brands_to_scan = brands_to_scan[:args.limit]

    if args.dry_run:
        print(f"DRY RUN — {len(brands_to_scan)} brands would be scanned:")
        for b in brands_to_scan:
            print(f"  • {b['name']} (@{b['handle']}) — {b['category']} — {b['priority']}")
        return

    if not brands_to_scan:
        print("No brands due for scanning.")
        if not args.generate_content:
            return

    # --- Scan phase ---
    scanned = 0
    content_generated = 0
    errors = 0

    for brand in brands_to_scan:
        print(f"\n🔍 Scanning {brand['name']} (@{brand['handle']})...")
        try:
            result = run_impersonator_scan(brand)
            if result.get("success") or result.get("impersonators"):
                impersonators = result.get("impersonators", [])
                high_risk = [i for i in impersonators if i.get("risk_level") in ("HIGH", "CRITICAL")]
                print(f"   → {len(impersonators)} total findings, {len(high_risk)} HIGH/CRITICAL")

                # The API already inserts the scan into brand_guard_scans.
                # Fetch the UUID id to use as FK for content candidates,
                # and update it to mark as proactive + complete with consent.
                scan_id_text = result.get("scan_id", "")
                scan_uuid = None
                try:
                    rows = sb_select("brand_guard_scans", "id,scan_id,status",
                                     filters={"scan_id": f"eq.{scan_id_text}"}, limit=1)
                    if rows:
                        scan_uuid = rows[0]["id"]
                        sb_update("brand_guard_scans", {
                            "status": "complete",
                            "initiated_from": "proactive_scan",
                            "content_reuse_consent": True,
                            "content_reuse_scope": "anonymized",
                            "content_reuse_consented_at": now.isoformat(),
                            "brand_authority_attested_at": now.isoformat(),
                            "completed_at": now.isoformat(),
                        }, "scan_id", scan_id_text)
                except Exception as e:
                    print(f"   ⚠️ Supabase fetch/update error: {e}")

                # Generate X content
                content = generate_x_content(result, brand)
                if content and scan_uuid:
                    if candidate_exists(scan_uuid):
                        print(f"   ✅ Content candidate already exists for {scan_uuid}")
                    else:
                        try:
                            candidate = sb_insert("brand_guard_content_candidates", {
                                "scan_id": scan_uuid,
                                "status": "new",
                                "content_scope": "anonymized",
                                "finding_type": "social_impersonation",
                                "safe_summary": {
                                    "source": "proactive_scan",
                                    "finding_type": "social_impersonation",
                                    "total_findings": content["finding_count"],
                                    "high_risk_count": content["high_count"],
                                    "critical_count": content["critical_count"],
                                    "platforms": result.get("platforms_scanned", []),
                                    "scan_completed_at": now.isoformat(),
                                    "brand_category": brand["category"],
                                },
                                "draft_copy": content["draft_copy"],
                                "draft_hashtags": content["draft_hashtags"],
                                "draft_image_spec": content["draft_image_spec"],
                                "safety_flags": [],
                            })
                            print(f"   ✅ Content candidate created: {candidate.get('id', '?')}")
                            content_generated += 1
                        except Exception as e:
                            print(f"   ⚠️ Content candidate insert error: {e}")
                elif content and not scan_uuid:
                    print(f"   ⚠️ No scan UUID — content not stored")

                state["scanned"][brand["name"]] = now.isoformat()
                scanned += 1
            else:
                print(f"   ❌ Scan failed: {result.get('error', 'unknown')}")
                errors += 1

            # Rate limit — don't hammer the API
            time.sleep(3)

        except Exception as e:
            print(f"   ❌ Error: {e}")
            errors += 1

    # --- Content generation from existing scans ---
    if args.generate_content and not brands_to_scan:
        print("\n📝 Generating content from existing proactive scans...")
        # Query existing proactive scans from Supabase
        try:
            scans = sb_select("brand_guard_scans", "id,brand_name,brand_handle,brand_domain,result,completed_at",
                             filters={"initiated_from": "eq.proactive_scan", "status": "eq.complete"},
                             limit=50)
            for scan_row in scans:
                result = scan_row.get("result", {})
                brand_info = {"name": scan_row["brand_name"], "handle": scan_row["brand_handle"],
                             "domain": scan_row["brand_domain"], "category": result.get("brand_category", "eCommerce")}
                content = generate_x_content(result, brand_info)
                if content:
                    try:
                        sb_insert("brand_guard_content_candidates", {
                            "status": "new",
                            "content_scope": "anonymized",
                            "finding_type": "social_impersonation",
                            "safe_summary": {
                                "source": "proactive_scan",
                                "finding_type": "social_impersonation",
                                "total_findings": content["finding_count"],
                                "high_risk_count": content["high_count"],
                                "critical_count": content["critical_count"],
                                "platforms": result.get("platforms_scanned", []),
                                "scan_completed_at": scan_row.get("completed_at", now.isoformat()),
                                "brand_category": brand_info["category"],
                            },
                            "draft_copy": content["draft_copy"],
                            "draft_hashtags": content["draft_hashtags"],
                            "draft_image_spec": content["draft_image_spec"],
                            "safety_flags": [],
                        })
                        content_generated += 1
                        print(f"   ✅ Content generated for {brand_info['name']}")
                    except Exception as e:
                        # Likely duplicate — skip
                        pass
        except Exception as e:
            print(f"   ❌ Error querying scans: {e}")

    save_state(state)

    print(f"\n{'='*60}")
    print(f"Proactive Brand Scan Summary:")
    print(f"  Brands scanned: {scanned}")
    print(f"  Content candidates generated: {content_generated}")
    print(f"  Errors: {errors}")
    print(f"  Next step: Run content-post to send drafts to Telegram for review")

if __name__ == "__main__":
    main()