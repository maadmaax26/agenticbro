#!/usr/bin/env python3
"""
prospect_intelligence_sync.py — Sync outreach intelligence to Supabase prospects table.

Reads existing prospects, categorizes them using the outreach intelligence system,
and updates threat_category, financial_impact_score, threat_tier, threat_loss_usd,
and threat_incident_count columns.

Usage:
  python3 prospect_intelligence_sync.py --sync          # Categorize all existing prospects
  python3 prospect_intelligence_sync.py --sync --domain example.com  # Categorize single prospect
  python3 prospect_intelligence_sync.py --stats         # Show threat category distribution
"""
import argparse
import json
import os
import sys
from pathlib import Path

# Add brand-guard-agent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "brand-guard-agent"))
from outreach_intelligence import categorize_lead, rank_industries, BASELINE_LOSS_DATA

# Supabase config
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://drvasofyghnxfxvkkwad.supabase.co")

def get_supabase_client():
    """Get Supabase client with service role key."""
    try:
        from supabase import create_client
        # Read key from .env
        env_path = Path("/Users/efinney/.openclaw/workspace/agentic-bro/.env")
        service_key = None
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("SUPABASE_SECRET_API_KEY="):
                    service_key = line.split("=", 1)[1].strip()
        
        if not service_key:
            print("⚠️  No Supabase secret key found")
            return None
        
        return create_client(SUPABASE_URL, service_key)
    except ImportError:
        print("⚠️  supabase-py not installed, using REST API")
        return None
    except Exception as e:
        print(f"⚠️  Supabase client error: {e}")
        return None


def get_prospect_ranking(vertical: str, category: str) -> dict:
    """Get the industry ranking for a prospect's vertical + threat category."""
    rankings = rank_industries()
    for r in rankings:
        if r.industry == vertical and r.category == category:
            return r.to_dict()
    # Default if no exact match
    return {"financial_impact_score": 30, "tier": "C", "loss_usd": 0, "incident_count": 0}


def sync_prospect(client, prospect: dict) -> dict:
    """Categorize a single prospect and update Supabase."""
    domain = prospect.get("primary_domain", "")
    company = prospect.get("company_name", "")
    vertical = prospect.get("vertical", "")
    dmarc = prospect.get("dmarc_policy", "")
    crt_lookalikes = prospect.get("crt_lookalikes", [])
    
    # Determine if ecommerce
    is_ecommerce = vertical in ("ecommerce", "cosmetics", "fashion", "luxury_goods", "pharma", "electronics", "toys")
    
    # Categorize
    result = categorize_lead(
        domain=domain,
        company_name=company,
        vertical=vertical,
        has_lookalike_domains=len(crt_lookalikes) > 0,
        dmarc_policy=dmarc,
        is_ecommerce=is_ecommerce,
        sells_physical_products=is_ecommerce,
    )
    
    primary_cat = result.get("primary_category")
    if not primary_cat:
        return {"domain": domain, "skipped": True, "reason": "no categories"}
    
    # Get ranking data
    ranking = get_prospect_ranking(vertical, primary_cat)
    
    # Update Supabase
    update_fields = {
        "threat_category": primary_cat,
        "financial_impact_score": ranking["financial_impact_score"],
        "threat_tier": ranking["tier"],
        "threat_loss_usd": ranking["loss_usd"],
        "threat_incident_count": ranking["incident_count"],
    }
    
    try:
        client.table("prospects").update(update_fields).eq("primary_domain", domain).execute()
        return {
            "domain": domain,
            "company": company,
            "category": primary_cat,
            "tier": ranking["tier"],
            "score": ranking["financial_impact_score"],
            "loss_usd": ranking["loss_usd"],
            "updated": True
        }
    except Exception as e:
        return {"domain": domain, "error": str(e), "updated": False}


def main():
    parser = argparse.ArgumentParser(description="Sync outreach intelligence to prospects")
    parser.add_argument("--sync", action="store_true", help="Categorize and update prospects")
    parser.add_argument("--domain", help="Sync single domain only")
    parser.add_argument("--stats", action="store_true", help="Show threat distribution stats")
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()
    
    client = get_supabase_client()
    if not client:
        print("❌ Cannot connect to Supabase. Check credentials.")
        sys.exit(1)
    
    if args.stats:
        print("\n📊 Threat Category Distribution in Prospects:")
        try:
            result = client.table("prospects").select("threat_category, threat_tier, financial_impact_score").execute()
            rows = result.data or []
            total = len(rows)
            categorized = [r for r in rows if r.get("threat_category")]
            uncategorized = total - len(categorized)
            
            print(f"   Total prospects: {total}")
            print(f"   Categorized: {len(categorized)}")
            print(f"   Uncategorized: {uncategorized}")
            
            # Count by category
            from collections import Counter
            cats = Counter(r["threat_category"] for r in categorized)
            tiers = Counter(r.get("threat_tier") for r in categorized)
            
            print(f"\n   By category: {dict(cats)}")
            print(f"   By tier: {dict(tiers)}")
            
            # Top scores
            scored = sorted(categorized, key=lambda x: x.get("financial_impact_score") or 0, reverse=True)
            print(f"\n   Top 5 by score:")
            for s in scored[:5]:
                print(f"     {s['threat_category']:<25} tier={s.get('threat_tier','?'):<3} score={s.get('financial_impact_score','?')}")
        except Exception as e:
            print(f"   Error: {e}")
        return
    
    if args.sync:
        # Fetch prospects
        if args.domain:
            query = client.table("prospects").select("*").eq("primary_domain", args.domain)
        else:
            query = client.table("prospects").select("*").limit(500)
        
        try:
            result = query.execute()
            prospects = result.data or []
        except Exception as e:
            print(f"❌ Error fetching prospects: {e}")
            sys.exit(1)
        
        if not prospects:
            print("No prospects found to sync.")
            return
        
        print(f"\n🔄 Syncing {len(prospects)} prospects...")
        
        results = []
        for p in prospects:
            r = sync_prospect(client, p)
            results.append(r)
            if r.get("updated"):
                print(f"  ✅ {r['domain']:<30} → {r['category']:<25} tier={r['tier']} score={r['score']}")
            elif r.get("skipped"):
                print(f"  ⏭️  {r['domain']:<30} — skipped ({r['reason']})")
            else:
                print(f"  ❌ {r['domain']:<30} — error: {r.get('error', 'unknown')}")
        
        # Summary
        updated = sum(1 for r in results if r.get("updated"))
        skipped = sum(1 for r in results if r.get("skipped"))
        errors = sum(1 for r in results if r.get("error"))
        
        print(f"\n✅ Sync complete: {updated} updated, {skipped} skipped, {errors} errors")
        
        if args.json:
            print(json.dumps(results, indent=2))
        return
    
    parser.print_help()


if __name__ == "__main__":
    main()