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
import re
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

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
                if key.startswith("SUPABASE") or key in ("TELEGRAM_BOT_TOKEN", "CDP_PORT", "URLSCAN_API_KEY"):
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
URLSCAN_API_KEY = os.environ.get("URLSCAN_API_KEY", "")
WORKER_ID = f"url-{uuid.uuid4().hex[:8]}"
POLL_INTERVAL = 45  # seconds between polls; keep below the web UI polling window.
SCAN_TIMEOUT = 120  # hard cap for web-triggered scans
STALE_RUNNING_AFTER = 180  # recover jobs abandoned by worker restarts
URLSCAN_IO_ENABLED = os.environ.get("BRAND_GUARD_URLSCAN_IO_ENABLED", "true").lower() not in ("0", "false", "no")
URLSCAN_IO_MIN_RISK_SCORE = int(os.environ.get("BRAND_GUARD_URLSCAN_IO_MIN_RISK_SCORE", "60"))
URLSCAN_IO_POLL_SECONDS = max(5, int(os.environ.get("BRAND_GUARD_URLSCAN_IO_POLL_SECONDS", "10")))
URLSCAN_IO_TIMEOUT_SECONDS = max(30, int(os.environ.get("BRAND_GUARD_URLSCAN_IO_TIMEOUT_SECONDS", "120")))

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


def close_stale_running_jobs() -> None:
    """Move abandoned running jobs to completed timeout results."""
    threshold = (datetime.now(timezone.utc) - timedelta(seconds=STALE_RUNNING_AFTER)).isoformat()
    try:
        result = supabase.table("scan_jobs") \
            .select("id,started_at") \
            .eq("status", "running") \
            .eq("scan_type", "url_scan") \
            .lt("started_at", threshold) \
            .limit(10) \
            .execute()
        for job in result.data or []:
            log.warning("Closing stale running job %s", job.get("id"))
            complete_job(job["id"], {
                "error": f"Local scan exceeded {STALE_RUNNING_AFTER}s worker window",
                "scan_status": "timeout",
                "risk_score": 0,
                "risk_level": "ERROR",
                "verdict": "Local browser detonation timed out. Try again.",
                "findings": [],
                "finding_count": 0,
                "network_summary": {},
                "scripts_analyzed": 0,
                "scan_date": datetime.now(timezone.utc).isoformat(),
            })
    except Exception as exc:
        log.error("Close stale running jobs error: %s", exc)


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


def update_parent_brand_guard_scan(payload: dict, urlscan_job_id: str, result: dict) -> None:
    """Best-effort merge of async URL scan enrichment into parent Brand Guard result."""
    parent_id = str(payload.get("parent_brand_guard_scan_id") or "").strip()
    if not parent_id:
        return
    try:
        existing = supabase.table("brand_guard_scans") \
            .select("result") \
            .eq("id", parent_id) \
            .limit(1) \
            .execute()
        row = existing.data[0] if isinstance(existing.data, list) and existing.data else existing.data
        parent_result = row.get("result") if isinstance(row, dict) else {}
        if not isinstance(parent_result, dict):
            parent_result = {}

        parent_result["url_scan_job_id"] = urlscan_job_id
        parent_result["url_scan_url"] = result.get("url") or payload.get("url")
        parent_result["url_scan_status"] = result.get("scan_status", "completed")
        parent_result["js_detonation"] = {
            "risk_score": result.get("risk_score", 0),
            "risk_level": result.get("risk_level", "UNKNOWN"),
            "verdict": result.get("verdict", ""),
            "findings": result.get("findings", []),
            "finding_count": result.get("finding_count", 0),
            "network_summary": result.get("network_summary", {}),
            "scripts_analyzed": result.get("scripts_analyzed", 0),
        }
        if result.get("urlscan_io"):
            parent_result["urlscan_io"] = result["urlscan_io"]
        if result.get("urlscan_phishing"):
            parent_result["urlscan_phishing"] = result["urlscan_phishing"]

        supabase.table("brand_guard_scans") \
            .update({"result": parent_result}) \
            .eq("id", parent_id) \
            .execute()
    except Exception as exc:
        log.warning("Parent Brand Guard scan update failed for %s: %s", parent_id, exc)


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


# ── URLScan.io enrichment ─────────────────────────────────────────────────────

def parsed_domain(url: str) -> str:
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
        return (parsed.hostname or "").lower()
    except Exception:
        return ""


def get_active_paid_plan(owner_id: str) -> dict | None:
    """Return the active Brand Guard subscription for paid tiers, if present."""
    if not owner_id:
        return None
    try:
        result = supabase.table("brand_guard_subscriptions") \
            .select("id,plan_id,status,monthly_credits_included") \
            .eq("owner_id", owner_id) \
            .in_("status", ["active", "trialing", "trial_ending"]) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        sub = (result.data or [None])[0]
        if not sub:
            return None
        plan = str(sub.get("plan_id") or "free").lower()
        if plan in ("guardian", "sentinel", "fortress"):
            return sub
    except Exception as exc:
        log.warning("URLScan.io plan lookup failed for owner %s: %s", owner_id, exc)
    return None


def deduct_brand_guard_credit(owner_id: str, brand_monitor_id: str | None, job_id: str) -> dict:
    """Use the existing Brand Guard credit pool for URLScan.io enrichment."""
    try:
        data = supabase.rpc("deduct_brand_guard_credit", {
            "p_owner_id": owner_id,
            "p_brand_monitor_id": brand_monitor_id or None,
            "p_scan_id": f"urlscan:{job_id}",
        }).execute().data
        return data if isinstance(data, dict) else {"success": False, "message": "Invalid credit RPC response"}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


def should_run_urlscan_io(payload: dict, base_result: dict) -> tuple[bool, str, dict]:
    """Gate URLScan.io to paid Brand Guard contexts and suspicious scans."""
    if not URLSCAN_IO_ENABLED:
        return False, "disabled", {}
    if payload.get("urlscan_enrichment") is False:
        return False, "payload_disabled", {}
    if not URLSCAN_API_KEY:
        return False, "missing_api_key", {}

    owner_id = str(payload.get("owner_id") or payload.get("customer_id") or "").strip()
    if not owner_id:
        return False, "missing_owner_context", {}

    subscription = get_active_paid_plan(owner_id)
    if not subscription:
        return False, "paid_subscription_required", {}

    if payload.get("urlscan_force") is True:
        return True, "forced", {"owner_id": owner_id, "subscription": subscription}

    try:
        risk_score = int(base_result.get("risk_score") or 0)
    except (TypeError, ValueError):
        risk_score = 0
    risk_level = str(base_result.get("risk_level") or "").upper()
    finding_count = int(base_result.get("finding_count") or 0)
    suspicious_level = risk_level in ("MEDIUM", "HIGH", "CRITICAL", "CAUTION")

    if risk_score >= URLSCAN_IO_MIN_RISK_SCORE or suspicious_level or finding_count > 0:
        return True, "risk_gate_passed", {"owner_id": owner_id, "subscription": subscription}
    return False, "below_risk_threshold", {"owner_id": owner_id, "subscription": subscription}


def urlopen_json(request: Request, timeout: int) -> dict:
    with urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8", errors="replace")
        return json.loads(raw) if raw else {}


def submit_urlscan_io(url: str) -> str:
    body = json.dumps({"url": url, "visibility": "unlisted"}).encode("utf-8")
    request = Request(
        "https://urlscan.io/api/v1/scan/",
        data=body,
        headers={
            "API-Key": URLSCAN_API_KEY,
            "Content-Type": "application/json",
            "User-Agent": "AgenticBro-BrandGuard/1.0",
        },
        method="POST",
    )
    response = urlopen_json(request, timeout=30)
    scan_uuid = response.get("uuid")
    if not scan_uuid:
        raise RuntimeError(f"URLScan.io submit response missing uuid: {response}")
    return str(scan_uuid)


def poll_urlscan_io(scan_uuid: str) -> dict:
    deadline = time.time() + URLSCAN_IO_TIMEOUT_SECONDS
    last_error = ""
    while time.time() < deadline:
        request = Request(
            f"https://urlscan.io/api/v1/result/{scan_uuid}/",
            headers={"User-Agent": "AgenticBro-BrandGuard/1.0"},
            method="GET",
        )
        try:
            return urlopen_json(request, timeout=30)
        except HTTPError as exc:
            last_error = f"HTTP {exc.code}"
            if exc.code == 404:
                time.sleep(URLSCAN_IO_POLL_SECONDS)
                continue
            if exc.code == 429:
                time.sleep(min(URLSCAN_IO_POLL_SECONDS * 2, 30))
                continue
            raise
        except URLError as exc:
            last_error = str(exc)
            time.sleep(URLSCAN_IO_POLL_SECONDS)
    raise TimeoutError(f"URLScan.io result not ready after {URLSCAN_IO_TIMEOUT_SECONDS}s ({last_error})")


def page_text_from_urlscan(result: dict) -> str:
    page = result.get("page") if isinstance(result.get("page"), dict) else {}
    task = result.get("task") if isinstance(result.get("task"), dict) else {}
    lists = result.get("lists") if isinstance(result.get("lists"), dict) else {}
    parts = [
        str(page.get("title") or ""),
        str(page.get("url") or ""),
        str(page.get("domain") or ""),
        str(task.get("url") or ""),
        " ".join(str(x) for x in lists.get("domains", [])[:50]) if isinstance(lists.get("domains"), list) else "",
    ]
    return " ".join(parts).lower()


def score_urlscan_phishing(result: dict, brand_terms: list[str] | None = None) -> dict:
    """Score URLScan.io evidence without replacing the local CDP score."""
    data = result.get("data") if isinstance(result.get("data"), dict) else {}
    requests = data.get("requests") if isinstance(data.get("requests"), list) else []
    page = result.get("page") if isinstance(result.get("page"), dict) else {}
    lists = result.get("lists") if isinstance(result.get("lists"), dict) else {}

    serialized = json.dumps(result)[:500_000].lower()
    login_form = bool(re.search(r'type=["\']?password|name=["\']?(password|passwd|pwd)|autocomplete=["\']?current-password', serialized))

    terms = [t.lower().strip() for t in (brand_terms or []) if t and len(t.strip()) >= 3]
    text = page_text_from_urlscan(result)
    brand_keyword = any(term in text for term in terms)

    redirect_count = 0
    final_domain = str(page.get("domain") or "").lower()
    initial_domain = ""
    if isinstance(result.get("task"), dict):
        initial_domain = parsed_domain(str(result["task"].get("url") or ""))
    for item in requests:
        response = item.get("response") if isinstance(item, dict) else {}
        status = int(response.get("status") or 0) if isinstance(response, dict) else 0
        if 300 <= status < 400:
            redirect_count += 1
    redirect_chain = redirect_count > 2 or (initial_domain and final_domain and initial_domain != final_domain)

    certs = lists.get("certificates") if isinstance(lists.get("certificates"), list) else []
    cert_mismatch = bool(certs and final_domain and not any(final_domain in json.dumps(cert).lower() for cert in certs[:5]))

    signals = {
        "login_form": login_form,
        "brand_keyword": brand_keyword,
        "screenshot_similarity_pct": None,
        "redirect_chain": redirect_chain,
        "cert_mismatch": cert_mismatch,
        "phash_skipped": True,
    }
    score = 0
    if login_form:
        score += 25
    if brand_keyword:
        score += 25
    if redirect_chain:
        score += 15
    if cert_mismatch:
        score += 15

    if score >= 80:
        verdict = "confirmed"
    elif score >= 60:
        verdict = "high_confidence"
    elif score >= 40:
        verdict = "suspicious"
    else:
        verdict = "low_signal"

    return {
        "score": score,
        "verdict": verdict,
        "signals": signals,
        "alert_recommended": score >= 60,
    }


def run_urlscan_io_enrichment(job_id: str, url: str, payload: dict, base_result: dict) -> dict | None:
    should_run, reason, context = should_run_urlscan_io(payload, base_result)
    if not should_run:
        return {"status": "skipped", "reason": reason}

    owner_id = context["owner_id"]
    brand_monitor_id = payload.get("brand_monitor_id")
    credit = deduct_brand_guard_credit(owner_id, str(brand_monitor_id) if brand_monitor_id else None, job_id)
    if not credit.get("success"):
        return {"status": "skipped", "reason": "insufficient_credits", "credit": credit}

    submitted_at = datetime.now(timezone.utc).isoformat()
    try:
        scan_uuid = submit_urlscan_io(url)
        result = poll_urlscan_io(scan_uuid)
        completed_at = datetime.now(timezone.utc).isoformat()
        brand_terms = payload.get("brand_terms")
        if not isinstance(brand_terms, list):
            brand_terms = [payload.get("brand_name"), payload.get("brand_domain")]
        phishing = score_urlscan_phishing(result, [str(x) for x in brand_terms if x])
        return {
            "status": "completed",
            "uuid": scan_uuid,
            "submitted_at": submitted_at,
            "completed_at": completed_at,
            "result_url": f"https://urlscan.io/result/{scan_uuid}/",
            "screenshot_url": f"https://urlscan.io/screenshots/{scan_uuid}.png",
            "credit": {
                "deducted": True,
                "type": credit.get("type"),
                "remaining": credit.get("remaining"),
            },
            "phishing": phishing,
        }
    except Exception as exc:
        log.warning("URLScan.io enrichment failed for job %s: %s", job_id, exc)
        return {
            "status": "failed",
            "submitted_at": submitted_at,
            "error": str(exc)[:500],
            "credit": {
                "deducted": True,
                "type": credit.get("type"),
                "remaining": credit.get("remaining"),
            },
        }


# ── Scan execution ────────────────────────────────────────────────────────────

def run_url_scan(url: str, timeout: int = 30) -> dict:
    """Run CDP URL scan for a given URL."""
    try:
        requested_timeout = max(5, min(int(timeout or 30), 45))
    except (TypeError, ValueError):
        requested_timeout = 30

    process_timeout = max(60, min(SCAN_TIMEOUT, requested_timeout + 45))
    log.info("Running URL scan for %s (timeout=%ds, process_cap=%ds)", url, requested_timeout, process_timeout)

    cmd = [
        sys.executable, SCAN_SCRIPT, url,
        "--json",
        "--timeout", str(requested_timeout),
    ]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=process_timeout,
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
        log.error("Scan timed out after %ds", process_timeout)
        return {"error": f"Scan timed out after {process_timeout}s", "scan_status": "timeout"}
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
    enrichment = run_urlscan_io_enrichment(job_id, url, payload, result)
    if enrichment:
        if enrichment.get("phishing"):
            result["urlscan_phishing"] = enrichment["phishing"]
        result["urlscan_io"] = {k: v for k, v in enrichment.items() if k != "phishing"}
    update_parent_brand_guard_scan(payload, job_id, result)
    complete_job(job_id, result)


def main():
    log.info("URL Scan Worker started (worker_id=%s)", WORKER_ID)
    log.info("Polling every %ds for url_scan jobs", POLL_INTERVAL)
    log.info("Scan script: %s", SCAN_SCRIPT)

    while True:
        try:
            close_stale_running_jobs()
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
