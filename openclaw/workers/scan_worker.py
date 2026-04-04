#!/usr/bin/env python3
"""
AgenticBro Scan Worker — Mac Studio / OpenClaw
==============================================
Replaces ngrok tunnel with Supabase as a durable job queue.

• Polls Supabase scan_jobs table for pending work
• Claims jobs atomically using FOR UPDATE SKIP LOCKED (via RPC)
• Runs local scan scripts (token / wallet / profile)
• Writes results back to Supabase
• Frontend receives instant push via Supabase Realtime

Setup:
  pip3 install supabase
  export SUPABASE_URL=https://drvasofyghnxfxvkkwad.supabase.co
  export SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
  python3 scan_worker.py

Or use the launchd plist to run automatically on startup.
"""

# Add user site-packages to path for launchd
import sys
import os
user_site = os.path.expanduser('~/Library/Python/3.9/lib/python/site-packages')
if user_site not in sys.path:
    sys.path.insert(0, user_site)

import json
import logging
import os
import subprocess
import time
import uuid
from datetime import datetime, timezone

from supabase import create_client

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [scan-worker] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("scan-worker")

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

WORKER_ID = f"mac-studio-{uuid.uuid4().hex[:8]}"
POLL_INTERVAL = 5       # seconds between polls when queue is empty
REQUEUE_TICK  = 12      # call requeue_timed_out_jobs every N ticks (~60 s)

# ── Scan script paths ─────────────────────────────────────────────────────────
# Adjust these paths to match your actual scam-detection-framework layout.

BASE = "/Users/efinney/agenticbro/scam-detection-framework"

SCAN_SCRIPTS = {
    "token":   os.path.join(BASE, "token_scan.py"),
    "wallet":  os.path.join(BASE, "wallet_scan.py"),
    "profile": os.path.join(BASE, "profile_scan.py"),
}

# ── Supabase client ───────────────────────────────────────────────────────────

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

from typing import Any, Dict, Optional

# ── Job lifecycle helpers ─────────────────────────────────────────────────────

def claim_job() -> Optional[Dict[str, Any]]:
    """Atomically claim the next pending job (SKIP LOCKED, race-condition safe)."""
    try:
        result = supabase.rpc(
            "claim_next_scan_job",
            {"p_worker_id": WORKER_ID, "p_max_retries": 3},
        ).execute()
        return result.data[0] if result.data else None
    except Exception as exc:
        log.error("claim_job error: %s", exc)
        return None


def _update_job(job_id: str, **fields: object) -> None:
    supabase.table("scan_jobs").update(fields).eq("id", job_id).execute()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def fail_job(job_id: str, error: str) -> None:
    """Retry if under max_retries; mark failed otherwise."""
    try:
        row = (
            supabase.table("scan_jobs")
            .select("retry_count, max_retries")
            .eq("id", job_id)
            .single()
            .execute()
            .data
        )
        if row and row["retry_count"] < row["max_retries"]:
            _update_job(
                job_id,
                status="pending",
                worker_id=None,
                error=f"Retry: {error}",
                retry_count=row["retry_count"] + 1,
            )
            log.warning("Job %s requeued for retry (attempt %d)", job_id, row["retry_count"] + 1)
        else:
            _update_job(
                job_id,
                status="failed",
                error=error,
                completed_at=_now_iso(),
            )
            log.error("Job %s permanently failed: %s", job_id, error)
    except Exception as exc:
        log.error("fail_job error for %s: %s", job_id, exc)

# ── Scan execution ────────────────────────────────────────────────────────────

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
                        try:
                            from datetime import datetime, timedelta
                            # Handle various date formats
                            scan_dt_str = scan_date.split("+")[0].split("Z")[0]
                            if "T" in scan_dt_str:
                                scan_dt = datetime.fromisoformat(scan_dt_str)
                                if datetime.now() - scan_dt.replace(tzinfo=None) < timedelta(hours=24):
                                    log.info("Found cached report: %s", filename)
                                    return data
                        except Exception as e:
                            log.warning("Failed to parse scan_date: %s", e)
            except Exception as e:
                log.warning("Failed to read cache: %s", e)
    
    return None


def normalize_profile_result(data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize profile scan result to flat structure expected by API."""
    # If data has nested profile_data, flatten it
    if "profile_data" in data and isinstance(data.get("profile_data"), dict):
        pd = data["profile_data"]
        
        # Extract followers/following as strings
        followers = pd.get("followers", "")
        following = pd.get("following", "")
        
        # Extract verified status
        verified = pd.get("verified", False)
        
        # Extract risk score
        risk_score = data.get("risk_score", {})
        if isinstance(risk_score, dict):
            score = risk_score.get("score", 0)
        else:
            score = risk_score
        
        # Build flat structure
        return {
            "scan_type": data.get("scan_type", "profile"),
            "target_handle": data.get("target_handle", ""),
            "scan_date": data.get("scan_date", ""),
            "platform": data.get("platform", "twitter"),
            "username": pd.get("username", ""),
            "display_name": pd.get("display_name", ""),
            "followers": followers,
            "following": following,
            "verified": verified,
            "bio": pd.get("bio", ""),
            "risk_score": score,
            "risk_level": risk_score.get("risk_level", "UNKNOWN") if isinstance(risk_score, dict) else "UNKNOWN",
            "verification_level": data.get("verification_level", "UNVERIFIED"),
            "red_flags": data.get("red_flags", []) or list(data.get("red_flag_analysis", {}).keys()) if data.get("red_flag_analysis") else [],
            "evidence": data.get("evidence", []),
            "profile_data": pd,  # Keep nested data for reference
            "final_verdict": data.get("final_verdict", {}),
        }
    
    # Already flat, return as-is
    return data


def run_scan(job: Dict[str, Any]) -> Dict[str, Any]:
    """Run the appropriate local scan script and return parsed JSON result."""
    scan_type = job["scan_type"]
    payload   = job["payload"]

    script = SCAN_SCRIPTS.get(scan_type, SCAN_SCRIPTS["token"])
    if not os.path.exists(script):
        raise FileNotFoundError(f"Scan script not found: {script}")
    
    # For profile scans, check cache first
    if scan_type == "profile" and payload.get("username"):
        username = payload["username"].lstrip("@")
        cached = check_scan_report_cache(username)
        if cached:
            log.info("Using cached scan report for %s", username)
            # Normalize cached data to flat structure
            return normalize_profile_result(cached)

    # Build CLI args
    cmd = ["python3", script, "--json"]
    if payload.get("address"):
        cmd += ["--address", payload["address"]]
    if payload.get("username"):
        cmd += ["--username", payload["username"]]
    if payload.get("platform"):
        cmd += ["--platform", payload["platform"]]
    if payload.get("options", {}).get("chain"):
        cmd += ["--chain", payload["options"]["chain"]]
    if payload.get("options", {}).get("deepScan"):
        cmd.append("--deep")
    
    # Always use cache for profile scans
    if scan_type == "profile":
        cmd.append("--use-cache")

    log.info("Running: %s", " ".join(cmd))

    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
    )

    if proc.returncode != 0:
        raise RuntimeError(f"Scan script exited {proc.returncode}: {proc.stderr.strip()}")

    return json.loads(proc.stdout)


def process_job(job: Dict[str, Any]) -> None:
    """Orchestrate the full lifecycle of one scan job."""
    job_id = job["id"]
    log.info(
        "Processing job %s | type=%s | target=%s",
        job_id,
        job["scan_type"],
        str(job["payload"].get("address") or job["payload"].get("username", "?"))[:24],
    )

    try:
        # Mark running
        _update_job(job_id, status="running", started_at=_now_iso())

        result = run_scan(job)

        # Mark completed
        _update_job(
            job_id,
            status="completed",
            result=result,
            completed_at=_now_iso(),
        )
        log.info("SUCCESS job %s", job_id)

    except subprocess.TimeoutExpired:
        fail_job(job_id, "Scan timeout after 120s")
    except FileNotFoundError as exc:
        fail_job(job_id, str(exc))
    except json.JSONDecodeError as exc:
        fail_job(job_id, f"Invalid JSON from scan script: {exc}")
    except Exception as exc:
        fail_job(job_id, str(exc))
        log.error("FAIL job %s: %s", job_id, exc)

# ── Main loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("Scan worker started — %s", WORKER_ID)
    log.info("Supabase: %s", SUPABASE_URL)
    log.info("Scripts: %s", SCAN_SCRIPTS)

    tick = 0
    while True:
        try:
            # Periodic requeue of timed-out jobs
            if tick % REQUEUE_TICK == 0:
                supabase.rpc("requeue_timed_out_jobs").execute()

            job = claim_job()
            if job:
                process_job(job)
            else:
                time.sleep(POLL_INTERVAL)

            tick += 1

        except KeyboardInterrupt:
            log.info("Worker stopped by keyboard interrupt")
            break
        except Exception as exc:
            log.error("Main loop error: %s", exc)
            time.sleep(10)


if __name__ == "__main__":
    main()
