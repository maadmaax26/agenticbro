#!/usr/bin/env python3
"""
URL Scan Worker — JS Detonation Analysis via Chrome CDP
========================================================
Polls Supabase scan_jobs for pending url_scan jobs and processes them
using cdp-url-scan.py (headless Chrome JS detonation).

Queue pattern (same as x-scan-worker and brand-guard-scan-worker):
  1. Fetch pending jobs (status = 'pending', scan_type = 'url_scan')
  2. Claim job (status → 'running')
  3. Run cdp-url-scan.py
  4. Write results (status → 'completed')

Runs as a launchd service (com.agenticbro.url-scan-worker.plist).
"""

import json
import logging
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone

# ── Load env vars from keychain ──────────────────────────────────────────────
env_path = "/Users/efinney/.openclaw/workspace/scripts/keychain-env.sh"
if os.path.exists(env_path):
    try:
        import subprocess as _sp
        _env_out = _sp.run(["bash", "-c", f"source {env_path} && env"],
                           capture_output=True, text=True, timeout=10)
        for line in _env_out.stdout.splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key.startswith("SUPABASE") or key in ("TELEGRAM_BOT_TOKEN", "CDP_PORT"):
                    os.environ.setdefault(key, val)
    except Exception:
        pass

from typing import Optional
from supabase import create_client

# ── Logging ───────────────────────────────────────────────────────────────────

LOG_DIR = "/Users/efinney/.openclaw/workspace/output"
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [url-scan-worker] %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOG_DIR, "url-scan-worker.log"), mode="a"),
    ],
)
log = logging.getLogger("url-scan-worker")

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SECRET_API_KEY", "")
WORKER_ID = f"url-{uuid.uuid4().hex[:8]}"
POLL_INTERVAL = 45  # seconds between polls
SCAN_TIMEOUT = 600  # 10 minutes max

WORKSPACE = "/Users/efinney/.openclaw/workspace"
SCAN_SCRIPT = os.path.join(WORKSPACE, "scripts", "cdp-url-scan.py")

# ── Supabase client ──────────────────────────────────────────────────────────

if not SUPABASE_URL or not SUPABASE_KEY:
    log.error("SUPABASE_URL or SUPABASE_SECRET_API_KEY not set")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Job lifecycle ─────────────────────────────────────────────────────────────

def fetch_pending_jobs() -> list:
    """Fetch pending url_scan jobs ordered by creation time."""
    try:
        result = supabase.table("scan_jobs") \
            .select("id,scan_type,payload,created_at") \
            .eq("status", "pending") \
            .eq("scan_type", "url_scan") \
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

def run_url_scan(url: str, timeout: int = 30) -> dict:
    """Run CDP URL scan for a given URL."""
    log.info("Running URL scan for %s (timeout=%ds)", url, timeout)

    cmd = [
        "python3", SCAN_SCRIPT, url,
        "--json",
        "--timeout", str(timeout),
    ]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=SCAN_TIMEOUT,
        )

        if proc.returncode != 0:
            error_msg = proc.stderr[:500] if proc.stderr else "Unknown error"
            log.error("Scan failed (exit %d): %s", proc.returncode, error_msg)
            return {"error": error_msg, "scan_status": "failed"}

        result = json.loads(proc.stdout)

        # Extract key fields for summary
        summary = {
            "scan_id": result.get("scan_id"),
            "url": result.get("url"),
            "domain": result.get("domain"),
            "risk_score": result.get("risk_score", 0),
            "risk_level": result.get("risk_level", "UNKNOWN"),
            "verdict": result.get("verdict", ""),
            "findings": result.get("findings", []),
            "finding_count": result.get("finding_count", 0),
            "network_summary": result.get("network_summary", {}),
            "scripts_analyzed": result.get("scripts_analyzed", 0),
            "scan_date": result.get("scan_date"),
            "scan_status": "completed",
        }

        log.info("Scan complete: %s → %d/100 %s (%d findings)",
                 url, summary["risk_score"], summary["risk_level"], summary["finding_count"])

        return summary

    except subprocess.TimeoutExpired:
        log.error("Scan timed out after %ds", SCAN_TIMEOUT)
        return {"error": f"Scan timed out after {SCAN_TIMEOUT}s", "scan_status": "timeout"}
    except json.JSONDecodeError as e:
        log.error("Invalid JSON output: %s", e)
        return {"error": f"Invalid scan output: {e}", "scan_status": "failed"}
    except Exception as exc:
        log.error("Scan error: %s", exc)
        return {"error": str(exc), "scan_status": "error"}


# ── Main loop ─────────────────────────────────────────────────────────────────

def process_job(job: dict) -> None:
    """Process a single scan job."""
    job_id = job["id"]
    payload = job.get("payload") or {}
    url = payload.get("url", "")
    timeout = payload.get("timeout", 30)

    if not url:
        log.error("Job %s has no URL in payload", job_id)
        fail_job(job_id, "No URL in payload")
        return

    if not claim_job(job_id):
        return  # Another worker claimed it

    log.info("Claimed job %s for URL: %s", job_id, url)

    result = run_url_scan(url, timeout)
    complete_job(job_id, result)


def main():
    log.info("URL Scan Worker started (worker_id=%s)", WORKER_ID)
    log.info("Polling every %ds for url_scan jobs", POLL_INTERVAL)
    log.info("Scan script: %s", SCAN_SCRIPT)

    while True:
        try:
            jobs = fetch_pending_jobs()
            if jobs:
                log.info("Found %d pending url_scan job(s)", len(jobs))
                for job in jobs:
                    process_job(job)
            else:
                log.debug("No pending jobs")
        except KeyboardInterrupt:
            log.info("Shutting down (KeyboardInterrupt)")
            break
        except Exception as exc:
            log.error("Main loop error: %s", exc)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()