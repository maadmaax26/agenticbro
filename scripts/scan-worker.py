#!/usr/bin/env python3
"""
Supabase Scan Job Worker — Processes profile scan jobs from the queue
Polls Supabase scan_jobs table, runs Chrome CDP scans, writes results back.

Usage: python3 scan-worker.py [--once] [--poll-interval 5]
  --once          Process one job and exit
  --poll-interval Seconds between polls (default: 5)
"""

import asyncio
import json
import os
import ssl
import sys
import time
import urllib.request
import websockets

from datetime import datetime

# ─── Config ──────────────────────────────────────────────────────────────────
CHROME_CDP_PORT = 18801
CHROME_WS_URL = f"http://localhost:{CHROME_CDP_PORT}"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://drvasofyghnxfxvkkwad.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

POLL_INTERVAL = 5  # seconds
RUN_ONCE = "--once" in sys.argv

# ─── 90-Point Unified Scoring ────────────────────────────────────────────────
RED_FLAGS = {
    "guaranteed_returns": {"weight": 25, "patterns": ["guaranteed", "guarantee", "sure thing", "100% profit", "100x", "1000x", "risk-free", "no risk", "10x-100x", "10x 100x"], "description": "Claims of guaranteed profits or unrealistic returns"},
    "giveaway_airdrop": {"weight": 20, "patterns": ["giveaway", "airdrop", "free crypto", "free bitcoin", "free ethereum", "free solana", "claim free", "free money", "free tokens", "free nft"], "description": "Free crypto giveaways or airdrops"},
    "dm_solicitation": {"weight": 15, "patterns": ["dm for", "dm me", "message me", "contact me", "dm for more", "dm for info", "dm for alpha", "dm lfg", "dm now", "hit my dm"], "description": "Requests to DM for more information"},
    "free_crypto": {"weight": 15, "patterns": ["free", "no cost", "zero investment", "no investment", "free money", "free cash", "free profit"], "description": "Free money or crypto without clear source"},
    "alpha_dm_scheme": {"weight": 15, "patterns": ["alpha", "private alpha", "exclusive access", "vip", "premium access", "exclusive", "vip group", "premium group", "private group", "exclusive signals", "t.me/", "telegram.me/"], "description": "Gatekeeping information behind DM/VIP/Telegram"},
    "unrealistic_claims": {"weight": 10, "patterns": ["24h", "overnight", "instant", "fast profits", "quick profits", "instant wealth", "overnight wealth", "fast money", "quick money", "to the moon", "moonshot", "financial freedom"], "description": "Unrealistic timeframes for profits"},
    "download_install": {"weight": 10, "patterns": [".exe", ".apk", ".zip", ".dmg", "download app", "install app", "install software", "install wallet", "download wallet"], "description": "Requests to download files or install apps"},
    "urgency_tactics": {"weight": 10, "patterns": ["act now", "limited time", "last chance", "ending soon", "only few spots", "limited spots", "hurry", "don't wait", "time limited", "expires soon", "fomo"], "description": "Urgency to create FOMO"},
    "emotional_manipulation": {"weight": 10, "patterns": ["family", "emergency", "sick", "hospital", "desperate", "need help", "please help", "charity", "donate"], "description": "Emotional pleas for help"},
    "low_credibility": {"weight": 10, "patterns": ["new account", "low followers", "no track record", "no history", "just started", "new to crypto", "beginner"], "description": "Low credibility indicators"},
}


def calculate_risk_score(text: str, metadata: dict = None) -> dict:
    text_lower = text.lower()
    total_weight = 0
    detected_flags = []
    flag_details = []

    for flag_name, flag_data in RED_FLAGS.items():
        for pattern in flag_data["patterns"]:
            if pattern.lower() in text_lower:
                total_weight += flag_data["weight"]
                detected_flags.append(flag_name)
                flag_details.append({
                    "flag": flag_name,
                    "weight": flag_data["weight"],
                    "description": flag_data["description"],
                    "patternMatched": pattern,
                })
                break

    # Follower ratio check
    if metadata and metadata.get("followers") and metadata.get("following"):
        followers = metadata["followers"]
        following = metadata["following"]
        ratio = following / followers if followers > 0 else 0
        if ratio > 2.0 and followers < 5000:
            total_weight += 10
            detected_flags.append("low_credibility")
            flag_details.append({"flag": "low_credibility", "weight": 10, "description": "Suspicious follower ratio (engagement pod)", "patternMatched": f"following/followers ratio {ratio:.1f}"})
        elif following > 10000 and followers < following * 0.3:
            total_weight += 10
            detected_flags.append("low_credibility")
            flag_details.append({"flag": "low_credibility", "weight": 10, "description": "Engagement pod pattern (following >> followers)", "patternMatched": f"following {following} >> followers {followers}"})

    # Marketing/shill detection
    import re
    if re.search(r"advertis|market.*agency|promo.*service|shill|paid.*promo|sponsored.*post", text_lower):
        total_weight += 5
        detected_flags.append("marketing_shill")
        flag_details.append({"flag": "marketing_shill", "weight": 5, "description": "Marketing/advertising service (paid shill account)", "patternMatched": "marketing keywords in bio"})

    risk_score = min((total_weight / 90) * 10, 10)
    risk_level = "CRITICAL" if risk_score >= 7 else "HIGH" if risk_score >= 5 else "MEDIUM" if risk_score >= 3 else "LOW"

    return {
        "riskScore": round(risk_score * 10) / 10,
        "riskLevel": risk_level,
        "redFlagsDetected": len(detected_flags),
        "flagDetails": flag_details,
        "weightsSum": total_weight,
        "maxPossibleWeight": 90,
    }


# ─── Chrome CDP Profile Scanner ──────────────────────────────────────────────

async def get_browser_ws():
    """Get WebSocket URL for a new or existing page. Retries on failure."""
    for attempt in range(3):
        try:
            with urllib.request.urlopen(f"{CHROME_WS_URL}/json/version", timeout=5) as resp:
                info = json.loads(resp.read().decode())
                ws_url = info.get("webSocketDebuggerUrl", "")
                if ws_url:
                    return ws_url
        except Exception as e:
            print(f"[CDP] get_browser_ws attempt {attempt+1} failed: {e}")
            if attempt < 2:
                await asyncio.sleep(2)
    return ""

async def get_or_create_page(browser_ws, url):
    """Create a new tab and navigate to URL. Retries on failure."""
    for attempt in range(3):
        try:
            async with websockets.connect(browser_ws, max_size=50*1024*1024) as ws:
                await ws.send(json.dumps({
                    "id": 1, "method": "Target.createTarget",
                    "params": {"url": url}
                }))
                result = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                target_id = result.get("result", {}).get("targetId", "")
                
                if not target_id:
                    print(f"[CDP] No targetId in response: {result}")
                    if attempt < 2:
                        await asyncio.sleep(2)
                        continue
                    return None, ""
        except Exception as e:
            print(f"[CDP] create_target attempt {attempt+1} failed: {e}")
            if attempt < 2:
                await asyncio.sleep(2)
                continue
            return None, ""
        break
    
    await asyncio.sleep(8)  # Wait for page to load
    
    # Find the page's WebSocket URL with retries
    for attempt in range(5):
        try:
            with urllib.request.urlopen(f"{CHROME_WS_URL}/json", timeout=5) as resp:
                pages = json.loads(resp.read().decode())
            for page in pages:
                if target_id in page.get("id", ""):
                    return page.get("webSocketDebuggerUrl"), target_id
            if attempt < 4:
                await asyncio.sleep(2)
        except Exception as e:
            print(f"[CDP] find_page attempt {attempt+1} failed: {e}")
            if attempt < 4:
                await asyncio.sleep(2)
    
    return None, target_id


async def close_target(browser_ws, target_id):
    """Close a tab."""
    async with websockets.connect(browser_ws, max_size=50*1024*1024) as ws:
        await ws.send(json.dumps({
            "id": 1, "method": "Target.closeTarget",
            "params": {"targetId": target_id}
        }))
        try:
            await asyncio.wait_for(ws.recv(), timeout=3)
        except:
            pass


async def scan_x_profile(username: str) -> dict:
    """Scan an X/Twitter profile via Chrome CDP. Retries on failure."""
    url = f"https://x.com/{username}"
    
    for attempt in range(2):
        try:
            browser_ws = await get_browser_ws()
            if not browser_ws:
                if attempt < 1:
                    print(f"[CDP] Retry {attempt+1}: browser_ws empty, waiting...")
                    await asyncio.sleep(3)
                    continue
                return {"success": False, "error": "Chrome CDP not available after retries"}
            
            page_ws_url, target_id = await get_or_create_page(browser_ws, url)
            if not page_ws_url:
                if target_id:
                    await close_target(browser_ws, target_id)
                if attempt < 1:
                    print(f"[CDP] Retry {attempt+1}: page_ws_url empty, waiting...")
                    await asyncio.sleep(3)
                    continue
                return {"success": False, "error": "Could not create page after retries"}
            
            try:
                async with websockets.connect(page_ws_url, max_size=50*1024*1024) as page_ws:
                    await page_ws.send(json.dumps({
                        "id": 2, "method": "Runtime.evaluate",
                        "params": {"expression": """
                        (function() {
                            const bio = document.querySelector('[data-testid="UserDescription"]')?.innerText || '';
                            const displayName = document.querySelector('[data-testid="UserName"]')?.innerText || '';
                            const followersText = document.querySelector('a[href$="/verified_followers"] span, a[href$="/followers"] span')?.innerText || '0';
                            const followingText = document.querySelector('a[href$="/following"] span')?.innerText || '0';
                            function parseNum(s) {
                                s = s.replace(/,/g, '');
                                if (s.includes('K')) return parseFloat(s) * 1000;
                                if (s.includes('M')) return parseFloat(s) * 1000000;
                                return parseInt(s) || 0;
                            }
                            return JSON.stringify({
                                bio: bio,
                                displayName: displayName,
                                followers: parseNum(followersText),
                                following: parseNum(followingText),
                                bodyText: document.body?.innerText?.substring(0, 8000) || ''
                            });
                        })()
                        """, "returnByValue": True}
                    }))
                    result = json.loads(await asyncio.wait_for(page_ws.recv(), timeout=15))
                    value = result.get("result", {}).get("result", {}).get("value", "{}")
                    
                    try:
                        profile = json.loads(value)
                    except:
                        profile = {"bio": "", "displayName": "", "followers": 0, "following": 0, "bodyText": ""}
                    
                    scoring_text = f"{profile.get('displayName', '')} {profile.get('bio', '')} {profile.get('bodyText', '')}"
                    metadata = {"followers": profile.get("followers", 0), "following": profile.get("following", 0)}
                    risk_result = calculate_risk_score(scoring_text, metadata)
                    
                    return {
                        "success": True,
                        "platform": "twitter",
                        "username": username,
                        "displayName": profile.get("displayName", ""),
                        "bio": profile.get("bio", ""),
                        "followers": metadata["followers"],
                        "following": metadata["following"],
                        **risk_result,
                        "scanTimestamp": datetime.utcnow().isoformat() + "Z",
                        "disclaimer": "This scan is an AI-powered threat assessment. For complete accuracy, verify information through multiple sources. Independent verification always recommended.",
                    }
            finally:
                await close_target(browser_ws, target_id)
        
        except Exception as e:
            if attempt < 1:
                print(f"[CDP] Scan exception attempt {attempt+1}: {e}, retrying...")
                await asyncio.sleep(3)
                continue
            return {"success": False, "error": str(e)}


# ─── Supabase Job Worker ─────────────────────────────────────────────────────

def get_supabase_client():
    """Use REST API since we don't want to require supabase-py."""
    import urllib.request
    
    class SupabaseREST:
        def __init__(self, url, key):
            self.url = url.rstrip("/")
            self.key = key
        
        def _request(self, method, path, body=None, params=None):
            url = f"{self.url}/rest/v1{path}"
            if params:
                query = "&".join(f"{k}={v}" for k, v in params.items())
                url += f"?{query}"
            
            data = json.dumps(body).encode() if body else None
            req = urllib.request.Request(url, data=data, method=method)
            req.add_header("apikey", self.key)
            req.add_header("Authorization", f"Bearer {self.key}")
            req.add_header("Content-Type", "application/json")
            req.add_header("Prefer", "return=representation")
            
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    return json.loads(resp.read().decode())
            except urllib.error.HTTPError as e:
                body = e.read().decode()
                print(f"[Supabase] HTTP {e.code}: {body[:200]}")
                return None
        
        def select(self, table, columns="*", params=None):
            params = params or {}
            params["select"] = columns
            return self._request("GET", f"/{table}", params=params)
        
        def update(self, table, body, params=None):
            return self._request("PATCH", f"/{table}", body=body, params=params)
    
    return SupabaseREST(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def claim_next_job(client):
    """Atomically claim a pending profile scan job."""
    # Get oldest pending job (profile or x_cdp)
    jobs = client.select("scan_jobs", columns="id,scan_type,payload,status,created_at",
                         params={"status": "eq.pending", "order": "created_at.asc", "limit": "1"})
    if not jobs:
        return None
    
    # Filter for profile or x_cdp scan types
    job = None
    for j in jobs:
        if j.get("scan_type") in ("profile", "x_cdp"):
            job = j
            break
    
    if not job:
        return None
    
    job = jobs[0]
    
    # Try to claim it (optimistic locking)
    updated = client.update("scan_jobs",
                            {"status": "claimed", "started_at": datetime.utcnow().isoformat()},
                            params={"id": f"eq.{job['id']}", "status": "eq.pending"})
    
    if updated:
        return job
    return None  # Another worker got it


def write_result(client, job_id, result):
    """Write scan result back to job row."""
    client.update("scan_jobs",
                  {"status": "completed", "result": result, "completed_at": datetime.utcnow().isoformat()},
                  params={"id": f"eq.{job_id}"})
    
    # Also write to scan_results for caching
    if result.get("success"):
        platform_label = {"twitter": "X (Twitter)", "telegram": "Telegram", "instagram": "Instagram"}.get(result.get("platform", ""), result.get("platform", ""))
        scan_date = result.get("scanTimestamp", datetime.utcnow().isoformat())
        risk_score = result.get("riskScore", 0) / 10  # Store as 0-1 for the DB
        risk_level = result.get("riskLevel", "LOW")
        verification = "HIGH RISK" if risk_level in ("CRITICAL", "HIGH") else "Pattern Match" if result.get("redFlagsDetected", 0) > 0 else "Likely Safe"
        
        insert_body = {
            "target_name": result.get("displayName", f"@{result.get('username', '')}"),
            "platform": platform_label,
            "target_handle": f"@{result.get('username', '')}",
            "scan_date": scan_date,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "verification_level": verification,
        }
        # Add optional fields only if they have values
        flags = [f["flag"] for f in result.get("flagDetails", [])]
        if flags:
            insert_body["red_flags"] = flags
        if result.get("bio"):
            insert_body["bio"] = result["bio"]
        if result.get("followers"):
            insert_body["followers"] = result["followers"]
        if result.get("following"):
            insert_body["following"] = result["following"]
        
        try:
            client._request("POST", "/scan_results", body=insert_body)
        except Exception as e:
            print(f"[Worker] scan_results insert failed (non-critical): {e}")


async def process_job(job):
    """Process a single scan job."""
    payload = job.get("payload", {})
    scan_type = job.get("scan_type", "profile")
    platform = payload.get("platform", "twitter")
    username = (payload.get("username") or payload.get("target") or "").replace("@", "")
    
    if not username:
        return {"success": False, "error": "No username provided"}
    
    print(f"[Worker] Scanning @{username} on {platform} (type: {scan_type})")
    
    # Handle x_cdp scan_type same as twitter profile
    if platform == "twitter" or scan_type == "x_cdp":
        result = await scan_x_profile(username)
    else:
        result = {"success": False, "error": f"Platform '{platform}' not supported by CDP worker"}
    
    print(f"[Worker] Result for @{username}: {result.get('riskLevel', 'ERROR')} {result.get('riskScore', 'N/A')}/10")
    return result


async def main():
    if not SUPABASE_SERVICE_KEY:
        print("[Worker] ERROR: SUPABASE_SERVICE_ROLE_KEY not set")
        print("[Worker] Get it from: Supabase Dashboard → Settings → API → service_role key")
        sys.exit(1)
    
    print(f"[Worker] Starting scan job worker (CDP port {CHROME_CDP_PORT})")
    print(f"[Worker] Supabase: {SUPABASE_URL}")
    print(f"[Worker] Mode: {'once' if RUN_ONCE else 'continuous'}")
    
    client = get_supabase_client()
    
    while True:
        try:
            job = claim_next_job(client)
            if job:
                print(f"[Worker] Claimed job {job['id']}: @{job['payload'].get('username', '?')} on {job['payload'].get('platform', '?')}")
                result = await process_job(job)
                write_result(client, job["id"], result)
                
                if RUN_ONCE:
                    break
            else:
                if RUN_ONCE:
                    print("[Worker] No pending jobs")
                    break
            
            await asyncio.sleep(POLL_INTERVAL)
        except (ssl.SSLError, ConnectionError, TimeoutError, OSError) as e:
            print(f"[Worker] Connection error: {e}, retrying in 30s...")
            await asyncio.sleep(30)
            client = get_supabase_client()  # Reconnect
        except Exception as e:
            print(f"[Worker] Unexpected error: {e}, retrying in 15s...")
            await asyncio.sleep(15)
            client = get_supabase_client()  # Reconnect


if __name__ == "__main__":
    asyncio.run(main())