#!/usr/bin/env python3
"""
Profile Scan Script
===================
Scans a social media profile for scam indicators using Chrome CDP.

Usage:
  python3 profile_scan.py --username <handle> [--platform x|twitter|telegram] [--json]

Output:
  JSON with risk assessment, red flags, and verification level.
"""

import argparse
import json
import subprocess
import sys
import os
import re
from datetime import datetime
from typing import Dict, List, Any, Optional

CDP_URL = "http://localhost:18800"

# ─── Risk Weights (90-point system) ─────────────────────────────────────────────

RISK_WEIGHTS = {
    "guaranteed_returns": 15,
    "private_alpha": 15,
    "unrealistic_claims": 15,
    "urgency_tactics": 10,
    "no_track_record": 10,
    "requests_crypto": 10,
    "no_verification": 5,
    "fake_followers": 5,
    "new_account": 3,
    "vip_upsell": 2,
    "paid_promoter": 15,
}


def run_chrome_cdp_scan(username: str, platform: str = "twitter") -> Dict[str, Any]:
    """Run Chrome CDP scan via Node.js script."""
    # Path to the browser scan script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_dir = os.path.join(script_dir, "..", "..", ".openclaw", "workspace")
    scan_script = os.path.join(workspace_dir, "final_extract.js")
    
    # Check if Chrome CDP is available
    try:
        import urllib.request
        req = urllib.request.Request(f"{CDP_URL}/json", headers={"User-Agent": "AgenticBro/1.0"})
        response = urllib.request.urlopen(req, timeout=5)
        pages = json.loads(response.read().decode())
        x_page = next((p for p in pages if "x.com" in p.get("url", "")), None)
        if not x_page:
            return {"error": "No X.com tab found in Chrome. Open x.com in Chrome with CDP port 18800."}
    except Exception as e:
        return {"error": f"Chrome CDP not available: {str(e)}"}
    
    # Build the scan command
    profile_url = f"https://x.com/{username}" if platform in ("x", "twitter") else f"https://t.me/{username}"
    
    # Run the Node.js scan script
    try:
        result = subprocess.run(
            ["node", scan_script, "--username", username, "--platform", platform],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=workspace_dir
        )
        
        if result.returncode != 0:
            # Try alternative scan scripts
            for alt_script in ["browser_scan.js", "scan_profile_final.js"]:
                alt_path = os.path.join(workspace_dir, alt_script)
                if os.path.exists(alt_path):
                    result = subprocess.run(
                        ["node", alt_path],
                        capture_output=True,
                        text=True,
                        timeout=60,
                        cwd=workspace_dir,
                        env={**os.environ, "SCAN_USERNAME": username, "SCAN_PLATFORM": platform}
                    )
                    if result.returncode == 0:
                        break
        
        if result.returncode == 0 and result.stdout.strip():
            # Parse JSON output
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                # Try to extract JSON from mixed output
                lines = result.stdout.strip().split('\n')
                for line in reversed(lines):
                    if line.strip().startswith('{'):
                        return json.loads(line)
                return {"error": "Could not parse scan output", "raw": result.stdout[:500]}
        else:
            return {"error": result.stderr or "Scan failed"}
            
    except subprocess.TimeoutExpired:
        return {"error": "Scan timeout after 60s"}
    except FileNotFoundError:
        return {"error": "Node.js not found. Please install Node.js to run Chrome CDP scans."}
    except Exception as e:
        return {"error": f"Scan error: {str(e)}"}


def check_scan_report_cache(username: str) -> Optional[Dict[str, Any]]:
    """Check for existing scan report in output directory."""
    # Use fixed path to workspace
    workspace_dir = "/Users/efinney/.openclaw/workspace"
    output_dir = os.path.join(workspace_dir, "output", "scan_reports")
    
    if not os.path.exists(output_dir):
        return None
    
    # Look for existing report
    for filename in os.listdir(output_dir):
        if username.lower() in filename.lower() and filename.endswith('.json'):
            filepath = os.path.join(output_dir, filename)
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)
                    # Check if report is recent (within 24 hours)
                    scan_date = data.get("scan_date", "")
                    if scan_date:
                        from datetime import datetime, timedelta
                        try:
                            # Handle ISO format with timezone
                            scan_dt_str = scan_date.split("+")[0].split("Z")[0]
                            if "T" in scan_dt_str:
                                scan_dt = datetime.fromisoformat(scan_dt_str)
                                if datetime.now() - scan_dt.replace(tzinfo=None) < timedelta(hours=24):
                                    return data
                        except:
                            pass
            except:
                pass
    
    return None


def calculate_risk_score(profile_data: Dict[str, Any], username: str) -> Dict[str, Any]:
    """Calculate risk score from profile data."""
    red_flags = []
    total_weight = 0
    
    # Handle nested profile_data from cache
    if "profile_data" in profile_data and isinstance(profile_data.get("profile_data"), dict):
        pd = profile_data["profile_data"]
        bio = (pd.get("bio") or "").lower()
        display_name = pd.get("display_name") or ""
        followers_raw = pd.get("followers") or 0
        following_raw = pd.get("following") or 0
        verified = pd.get("verified") or False
        recent_tweets = pd.get("recent_tweets") or []
    else:
        # Flat structure
        bio = (profile_data.get("bio") or "").lower()
        display_name = profile_data.get("display_name") or ""
        followers_raw = profile_data.get("followers") or 0
        following_raw = profile_data.get("following") or 0
        verified = profile_data.get("verified") or False
        recent_tweets = profile_data.get("recent_tweets") or []
    
    # Parse follower/following counts (handle string format like "7,825")
    if isinstance(followers_raw, str):
        followers = int(re.sub(r'[^\d]', '', followers_raw) or 0)
    else:
        followers = followers_raw or 0
    
    if isinstance(following_raw, str):
        following = int(re.sub(r'[^\d]', '', following_raw) or 0)
    else:
        following = following_raw or 0
    
    # Check for verified
    if not verified:
        red_flags.append("No verification (+5)")
        total_weight += RISK_WEIGHTS["no_verification"]
    
    # Check follower ratio
    if followers > 0 and following > 0:
        ratio = followers / following
        if ratio < 1:
            red_flags.append(f"Low follower ratio ({ratio:.1f}:1) (+5)")
            total_weight += RISK_WEIGHTS["fake_followers"]
    
    # Check bio for red flags
    scam_patterns = [
        ("guaranteed", "guaranteed_returns"),
        ("dm me", "private_alpha"),
        ("pm me", "private_alpha"),
        ("100x", "unrealistic_claims"),
        ("1000x", "unrealistic_claims"),
        ("free airdrop", "guaranteed_returns"),
        ("private alpha", "private_alpha"),
        ("vip", "vip_upsell"),
        ("premium", "vip_upsell"),
        ("send", "requests_crypto"),
        ("wallet", "requests_crypto"),
    ]
    
    bio_lower = bio.lower()
    for pattern, flag_type in scam_patterns:
        if pattern in bio_lower:
            red_flags.append(f"{pattern} in bio (+{RISK_WEIGHTS[flag_type]})")
            total_weight += RISK_WEIGHTS[flag_type]
    
    # Check recent tweets for red flags
    for tweet in recent_tweets[:10]:
        tweet_lower = tweet.lower() if isinstance(tweet, str) else ""
        if "guaranteed" in tweet_lower or "100x" in tweet_lower:
            if "guaranteed" not in bio_lower:  # Don't double count
                red_flags.append(f"promotional language in tweets (+10)")
                total_weight += RISK_WEIGHTS["urgency_tactics"]
                break
    
    # Check for paid promoter indicators
    if any(kw in bio_lower for kw in ["kol", "influencer", "partnered", "promoter", "shill"]):
        red_flags.append("Paid promoter/KOL (+15)")
        total_weight += RISK_WEIGHTS["paid_promoter"]
    
    # Calculate final score
    risk_score = min((total_weight / 90) * 10, 10)
    
    # Determine risk level
    if risk_score < 3:
        risk_level = "LOW"
    elif risk_score < 5:
        risk_level = "MEDIUM"
    elif risk_score < 7:
        risk_level = "HIGH"
    else:
        risk_level = "CRITICAL"
    
    # Determine verification level
    if total_weight >= 50:
        verification_level = "HIGH RISK"
    elif total_weight >= 30:
        verification_level = "UNVERIFIED"
    elif total_weight >= 15:
        verification_level = "PARTIALLY VERIFIED"
    elif verified:
        verification_level = "VERIFIED"
    else:
        verification_level = "UNVERIFIED"
    
    # Override for paid promoter
    bio_lower = bio.lower() if bio else ""
    if "paid_promoter" in str(red_flags).lower() or "kol" in bio_lower or "promoter" in bio_lower:
        verification_level = "PAID PROMOTER"
    
    return {
        "risk_score": round(risk_score, 1),
        "risk_level": risk_level,
        "red_flags": red_flags,
        "verification_level": verification_level,
        "username": username,
        "display_name": display_name,
        "bio": bio[:500] if bio else None,
        "followers": followers_raw,  # Return original format
        "following": following_raw,  # Return original format
        "verified": verified,
        "platform": profile_data.get("platform", "twitter"),
        "profile_data": profile_data.get("profile_data", profile_data),  # Include nested data
    }


def main():
    parser = argparse.ArgumentParser(description="Scan social profile for scam indicators")
    parser.add_argument("--username", required=True, help="Profile username/handle")
    parser.add_argument("--platform", default="twitter", help="Platform (twitter, telegram, x)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--use-cache", action="store_true", help="Use cached scan report if available")
    args = parser.parse_args()
    
    # Normalize platform
    platform = args.platform.lower()
    if platform == "x":
        platform = "twitter"
    
    username = args.username.lstrip("@")
    
    # Check cache first
    if args.use_cache:
        cached = check_scan_report_cache(username)
        if cached:
            if args.json:
                print(json.dumps(cached, indent=2))
            else:
                print(f"Cached scan for @{username}")
                print(f"  Risk Score: {cached.get('risk_score', {}).get('score', 'N/A')}/10")
                print(f"  Verification: {cached.get('verification_level', 'N/A')}")
            return 0
    
    # Run Chrome CDP scan
    result = run_chrome_cdp_scan(username, platform)
    
    if "error" in result:
        # Fallback to pattern analysis
        result = {
            "risk_score": 0,
            "risk_level": "UNKNOWN",
            "red_flags": [f"Scan error: {result['error']}"],
            "verification_level": "UNVERIFIED",
            "username": username,
            "platform": platform,
            "followers": None,
            "following": None,
            "notes": result["error"],
        }
    else:
        # Calculate risk from scan data
        result = calculate_risk_score(result, username)
    
    # Add metadata
    result["scan_type"] = "profile"
    result["scan_date"] = datetime.utcnow().isoformat()
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Profile Scan Results for @{username}")
        print(f"  Platform: {platform}")
        print(f"  Risk Score: {result['risk_score']}/10 ({result['risk_level']})")
        print(f"  Verification: {result['verification_level']}")
        if result.get("red_flags"):
            print("  Red Flags:")
            for flag in result["red_flags"]:
                print(f"    - {flag}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())