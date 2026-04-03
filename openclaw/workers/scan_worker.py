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

# ── Job lifecycle helpers ─────────────────────────────────────────────────────

def claim_job() -> dict | None:
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

def run_scan(job: dict) -> dict:
    """Run the appropriate local scan script and return parsed JSON result."""
    scan_type = job["scan_type"]
    payload   = job["payload"]

    script = SCAN_SCRIPTS.get(scan_type, SCAN_SCRIPTS["token"])
    if not os.path.exists(script):
        raise FileNotFoundError(f"Scan script not found: {script}")

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


def process_job(job: dict) -> None:
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
