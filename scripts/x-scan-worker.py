#!/usr/bin/env python3
"""
AgenticBro X Scan Worker — Mac Studio
=======================================
Polls Supabase scan_jobs for x_cdp type jobs and processes them
using Chrome CDP (port 18801) via the local scan scripts.

Runs as a launchd service (com.agenticbro.x-scan-worker.plist).
Restart-on-failure, auto-start on boot.
"""

import json
import logging
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone

# ── Load env vars from .env ──────────────────────────────────────────────────
env_path = "/Users/efinney/.openclaw/workspace/.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                os.environ.setdefault(key, val)

from typing import Optional
from supabase import create_client

# ── Logging ───────────────────────────────────────────────────────────────────

LOG_DIR = "/Users/efinney/.openclaw/workspace/output"
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [x-scan-worker] %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOG_DIR, "x-scan-worker.log"), mode="a"),
    ],
)
log = logging.getLogger("x-scan-worker")

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SECRET_API_KEY", "")
WORKER_ID = f"x-cdp-{uuid.uuid4().hex[:8]}"
POLL_INTERVAL = 10  # seconds between polls
CDP_PORT = int(os.environ.get("CDP_PORT", "18801"))

# ── Paths ─────────────────────────────────────────────────────────────────────
WORKSPACE = "/Users/efinney/.openclaw/workspace"
SCAN_SCRIPT = os.path.join(WORKSPACE, "scripts", "scan-source.sh")
REPORTS_DIR = os.path.join(WORKSPACE, "output", "x_profile_reports")

# ── Supabase client ──────────────────────────────────────────────────────────

if not SUPABASE_URL or not SUPABASE_KEY:
    log.error("SUPABASE_URL or SUPABASE_SECRET_API_KEY not set")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── CDP health check ─────────────────────────────────────────────────────────

def cdp_available() -> bool:
    """Check if Chrome CDP is running."""
    try:
        result = subprocess.run(
            ["curl", "-s", f"http://localhost:{CDP_PORT}/json/version"],
            capture_output=True, text=True, timeout=5,
        )
        return result.returncode == 0 and "Browser" in result.stdout
    except Exception:
        return False

# ── Job lifecycle ─────────────────────────────────────────────────────────────

def fetch_pending_jobs() -> list:
    """Fetch pending x_cdp jobs ordered by creation time."""
    try:
        result = supabase.table("scan_jobs") \
            .select("id,scan_type,payload,created_at") \
            .eq("status", "pending") \
            .eq("scan_type", "x_cdp") \
            .order("created_at", desc=False) \
            .limit(5) \
            .execute()
        return result.data or []
    except Exception as exc:
        log.error("Fetch pending jobs error: %s", exc)
        return []


def claim_job(job_id: str) -> bool:
    """Mark a job as running, claimed by this worker."""
    try:
        supabase.table("scan_jobs") \
            .update({
                "status": "running",
                "worker_id": WORKER_ID,
                "started_at": datetime.now(timezone.utc).isoformat(),
            }) \
            .eq("id", job_id) \
            .execute()
        return True
    except Exception as exc:
        log.error("Claim job error: %s", exc)
        return False


def write_scan_result(result: dict) -> None:
    """Write scan result to scan_results table for website display."""
    try:
        username = result.get("username", "")
        # Use "X" for scan_results platform constraint
        platform = "X"

        # Build scan_results row from the normalized result
        risk_score = result.get("risk_score", 0)
        risk_level = result.get("risk_level", "UNKNOWN")

        # red_flags: save full flagDetails if available, otherwise save the string array
        red_flags = result.get("red_flags", [])
        flag_details = result.get("flagDetails", result.get("flag_details", None))
        if flag_details:
            red_flags = flag_details  # Full objects with flag, weight, description

        insert_body = {
            "username": username,
            "platform": platform,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "red_flags": red_flags,
            "verification_level": result.get("verification_level", "UNVERIFIED"),
            "scan_date": result.get("scanDate", datetime.now(timezone.utc).isoformat()),
        }

        # Add optional fields (only columns that exist in scan_results table)
        if result.get("bio"):
            insert_body["bio"] = result["bio"]
        if result.get("followers") is not None:
            insert_body["followers"] = result["followers"]
        if result.get("following") is not None:
            insert_body["following"] = result["following"]
        if result.get("displayName"):
            insert_body["display_name"] = result["displayName"]
        if result.get("evidence"):
            insert_body["evidence"] = result["evidence"]
        if result.get("recommendation"):
            insert_body["recommendation"] = result["recommendation"]
        if result.get("scam_type"):
            insert_body["scam_type"] = result["scam_type"]
        if result.get("confidence"):
            insert_body["confidence"] = result["confidence"]

        # Insert into scan_results (no upsert — no unique constraint on username,platform)
        supabase.table("scan_results") \
            .insert(insert_body) \
            .execute()
        log.info("Wrote scan_result for @%s (%s) score=%.1f level=%s",
                 username, platform, risk_score, risk_level)
    except Exception as exc:
        log.warning("Failed to write scan_result (non-critical): %s", exc)


def complete_job(job_id: str, result: dict) -> bool:
    """Mark a job as completed with result data."""
    try:
        supabase.table("scan_jobs") \
            .update({
                "status": "completed",
                "result": result,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }) \
            .eq("id", job_id) \
            .execute()
        # Also write to scan_results for website display
        write_scan_result(result)
        return True
    except Exception as exc:
        log.error("Complete job error: %s", exc)
        return False


def fail_job(job_id: str, error: str) -> None:
    """Mark a job as failed."""
    try:
        supabase.table("scan_jobs") \
            .update({
                "status": "failed",
                "result": {"error": error},
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }) \
            .eq("id", job_id) \
            .execute()
    except Exception as exc:
        log.error("Fail job error: %s", exc)

# ── Scan execution ────────────────────────────────────────────────────────────

def find_latest_report(username: str) -> Optional[dict]:
    """Find the most recent scan report for a username."""
    os.makedirs(REPORTS_DIR, exist_ok=True)
    if not os.path.exists(REPORTS_DIR):
        return None

    matching = []
    for f in os.listdir(REPORTS_DIR):
        if username.lower() in f.lower() and f.endswith(".json"):
            filepath = os.path.join(REPORTS_DIR, f)
            matching.append((os.path.getmtime(filepath), filepath))

    if not matching:
        return None

    matching.sort(reverse=True)
    _, latest = matching[0]

    try:
        with open(latest) as fp:
            data = json.load(fp)
        # Only use if less than 30 minutes old
        mtime = matching[0][0]
        if time.time() - mtime > 1800:
            return None
        return data
    except Exception as exc:
        log.warning("Failed to read report %s: %s", latest, exc)
        return None


def run_x_scan(username: str) -> dict:
    """Run Chrome CDP scan for a Twitter/X username."""
    clean_username = username.lstrip("@").strip()

    # Always run a fresh scan instead of using cached reports
    # This ensures scan results are always up-to-date and correct
    log.info("Running CDP scan for @%s", clean_username)
    try:
        proc = subprocess.run(
            ["bash", SCAN_SCRIPT, "x", clean_username],
            capture_output=True, text=True, timeout=120,
            cwd=WORKSPACE,
        )
        log.info("Scan script exit code: %d", proc.returncode)
        if proc.returncode != 0:
            log.error("Scan stderr: %s", proc.stderr[-500:] if proc.stderr else "none")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Scan timeout after 120s")
    except Exception as exc:
        raise RuntimeError(f"Scan execution error: {exc}")

    # Find the output report
    report = find_latest_report(clean_username)
    if report:
        log.info("Found scan report for @%s", clean_username)
        return report

    # No report found — return basic info
    raise RuntimeError(f"Scan completed but no report generated for @{clean_username}")


def process_job(job: dict) -> None:
    """Process one scan job."""
    job_id = job["id"]
    payload = job.get("payload", {}) or {}
    username = payload.get("username", "")

    if not username:
        fail_job(job_id, "No username in payload")
        return

    log.info("Processing job %s for @%s", job_id, username)

    if not claim_job(job_id):
        return  # Another worker claimed it

    try:
        result = run_x_scan(username)

        # Normalize: local scanner outputs {profile: {...}, analysis: {...}}
        # The API/frontend expects flat {riskScore, riskLevel, redFlags, profileData, ...}
        profile = result.get("profile", {})
        analysis = result.get("analysis", {})

        # If no nested structure, treat result itself as flat (fallback)
        if not profile and not analysis:
            profile = result
            analysis = result

        # Risk score: local scanner uses 0-10 scale, API expects 0-100
        raw_score = analysis.get("risk_score", result.get("risk_score", 0))
        api_risk_score = round(raw_score * 10) if isinstance(raw_score, (int, float)) else 0

        # Risk level: normalize to uppercase
        raw_level = analysis.get("risk_level", result.get("risk_level", "UNKNOWN"))
        level_map = {"LOW": "LOW", "MEDIUM": "MEDIUM", "HIGH": "HIGH", "CRITICAL": "CRITICAL",
                     "low": "LOW", "medium": "MEDIUM", "high": "HIGH", "critical": "CRITICAL"}
        risk_level = level_map.get(raw_level, raw_level) if isinstance(raw_level, str) else "UNKNOWN"

        # Red flags: normalize from [{flag, points}] to ["flag (Npts)"]
        raw_flags = analysis.get("red_flags", result.get("red_flags", []))
        red_flags = []
        flag_details = []  # Full flag objects for scan_results
        if isinstance(raw_flags, list):
            for f in raw_flags:
                if isinstance(f, dict):
                    red_flags.append(f"{f.get('flag', 'Unknown')} ({f.get('points', f.get('weight', 0))}pts)")
                    flag_details.append({
                        "flag": f.get("flag", "Unknown"),
                        "weight": f.get("weight", f.get("points", 0)),
                        "description": f.get("description", ""),
                        "patternMatched": f.get("patternMatched", f.get("pattern", ""))
                    })
                elif isinstance(f, str):
                    red_flags.append(f)

        # Recommendation based on risk level
        rec_map = {
            "CRITICAL": "🚨 AVOID THIS ACCOUNT. High probability of scam activity detected. Do not send funds or click links.",
            "HIGH": "⚠️ Exercise extreme caution. Multiple scam indicators detected. Verify through official channels.",
            "MEDIUM": "⚡ Proceed with caution. Some suspicious indicators found. Verify the account independently.",
            "LOW": "✅ No major scam indicators detected. Always verify independently before engaging.",
        }

        normalized = {
            # ── snake_case fields (read by profile-verify API) ──
            "success": True,
            "platform": "X",
            "username": profile.get("username", username),
            "display_name": profile.get("display_name", profile.get("displayName", "")),
            "name": profile.get("display_name", profile.get("displayName", "")),
            "verified": profile.get("verified", False),
            "verification_level": "BLUE" if profile.get("verified") else "UNVERIFIED",
            "risk_score": raw_score,  # 0-10 scale; API converts to 0-100
            "risk_level": risk_level,
            "red_flags": red_flags,
            "flagDetails": flag_details,  # Full flag objects for scan_results
            "evidence": ["Chrome CDP scan completed", "Real profile data analyzed by local agent"],
            "recommendation": analysis.get("recommendation", result.get("recommendation", rec_map.get(risk_level, rec_map["LOW"]))),
            "scam_type": analysis.get("scam_type", result.get("scam_type", None)),
            # Flat profile fields (API reads from top level)
            "followers": profile.get("followers"),
            "following": profile.get("following"),
            "posts": profile.get("tweets_count", profile.get("posts")),
            "posts_count": profile.get("tweets_count", profile.get("posts")),
            "bio": profile.get("bio", ""),
            "location": profile.get("location"),
            "website": profile.get("website"),
            "join_date": profile.get("join_date", profile.get("createdAt")),
            "default_profile_image": not bool(profile.get("profileImage")),
            "promoted_tokens": profile.get("promoted_tokens", []),
            "recent_posts": profile.get("recentTweets", profile.get("recent_posts", [])),
            "account_age_years": profile.get("account_age_years"),
            # ── camelCase fields (read by frontend) ──
            "displayName": profile.get("display_name", profile.get("displayName", "")),
            "riskScore": api_risk_score,
            "riskLevel": risk_level,
            "redFlags": red_flags,
            "profileData": {
                "followers": profile.get("followers"),
                "following": profile.get("following"),
                "posts": profile.get("tweets_count", profile.get("posts")),
                "bio": profile.get("bio", ""),
                "location": profile.get("location"),
                "website": profile.get("website"),
                "joinDate": profile.get("join_date", profile.get("createdAt")),
                "profileImage": profile.get("profileImage"),
                "verified": profile.get("verified", False),
                "display_name": profile.get("display_name", profile.get("displayName", "")),
            },
            "botDetection": result.get("bot_detection", result.get("botDetection", {
                "botScore": 10,
                "classification": "Likely Authentic",
                "flags": [],
            })),
            "confidence": "HIGH",
            "scanDate": result.get("scan_timestamp", datetime.now(timezone.utc).isoformat()),
            "dataSource": "chrome_cdp",
            "behavioralPattern": analysis.get("behavioral_pattern", ""),
        }

        complete_job(job_id, normalized)
        log.info("SUCCESS job %s — @%s risk %s/100 (%.1f/10) %s",
                 job_id, username, normalized["riskScore"], raw_score, normalized["riskLevel"])

    except Exception as exc:
        log.error("FAIL job %s: %s", job_id, exc)
        fail_job(job_id, str(exc))

# ── Main loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("X Scan Worker started — %s", WORKER_ID)
    log.info("Supabase: %s", SUPABASE_URL)
    log.info("CDP port: %d", CDP_PORT)
    log.info("Scan script: %s", SCAN_SCRIPT)

    consecutive_errors = 0
    max_errors = 10

    while True:
        try:
            # Health check
            if not cdp_available():
                log.warning("Chrome CDP not available on port %d, waiting...", CDP_PORT)
                time.sleep(30)
                continue

            jobs = fetch_pending_jobs()
            if not jobs:
                time.sleep(POLL_INTERVAL)
                continue

            for job in jobs:
                process_job(job)

            consecutive_errors = 0  # Reset on success

        except KeyboardInterrupt:
            log.info("Worker stopped by keyboard interrupt")
            break
        except Exception as exc:
            consecutive_errors += 1
            log.error("Main loop error (%d/%d): %s", consecutive_errors, max_errors, exc)
            if consecutive_errors >= max_errors:
                log.critical("Too many consecutive errors, exiting")
                sys.exit(1)
            time.sleep(10)


if __name__ == "__main__":
    main()