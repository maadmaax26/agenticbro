#!/usr/bin/env python3
"""
AgenticBro Brand Guard Scan Worker — Mac Studio
=================================================
Polls Supabase brand_guard_scans for pending jobs and processes them
using the local Brand Guard CLI scripts (impersonator, domain, vendor, threat).

Uses the same queue pattern as x-scan-worker:
  1. Fetch pending jobs (status = 'pending')
  2. Claim job (status → 'running')
  3. Run local CLI scan
  4. Write results (status → 'complete')

Runs as a launchd service (com.agenticbro.brand-guard-scan-worker.plist).
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

# ── Load env vars from keychain ──────────────────────────────────────────────
env_path = "/Users/efinney/.openclaw/workspace/scripts/keychain-env.sh"
if os.path.exists(env_path):
    # Source keychain env (sets SUPABASE_URL, SUPABASE_SECRET_API_KEY, etc.)
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
                if key.startswith("SUPABASE") or key in ("TELEGRAM_BOT_TOKEN",):
                    os.environ.setdefault(key, val)
    except Exception:
        pass

from typing import Optional
from supabase import create_client

# ── Logging ────────────────────────────────────────────────────────────────

LOG_DIR = "/Users/efinney/.openclaw/workspace/output"
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [bg-scan-worker] %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOG_DIR, "brand-guard-scan-worker.log"), mode="a"),
    ],
)
log = logging.getLogger("bg-scan-worker")

# ── Config ────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SECRET_API_KEY", "")
WORKER_ID = f"bg-{uuid.uuid4().hex[:8]}"
POLL_INTERVAL = 300  # seconds between polls (increased from 45s to reduce Supabase IO)
SCAN_TIMEOUT = 600   # 10 minutes max per scan (increased from 300s)

# ── Paths ────────────────────────────────────────────────────────────────
WORKSPACE = "/Users/efinney/.openclaw/workspace"
SCRIPTS_DIR = os.path.join(WORKSPACE, "scripts")

# Map scan_type → LLM critical function name (for Gemini routing)
SCAN_TYPE_TO_LLM_FUNCTION = {
    "impersonator": "impersonator_scan",
    "domain": "domain_scan",
    "vendor": "vendor_verify",
    "threat": "threat_correlate",
}

# ── Gemini Fallback Integration ────────────────────────────────────────────
try:
    sys.path.insert(0, SCRIPTS_DIR)
    from brand_guard_llm import BrandGuardLLM
    _bg_llm = BrandGuardLLM()
    log.info("Gemini fallback integrated — critical functions bypass Ollama for SLA")
except ImportError:
    _bg_llm = None
    log.warning("brand_guard_llm not available — Gemini fallback disabled")
except Exception as _e:
    _bg_llm = None
    log.warning("Gemini fallback init failed: %s — continuing without it", _e)

# Map scan_type → CLI script
SCAN_SCRIPTS = {
    "impersonator": os.path.join(SCRIPTS_DIR, "brand-guard-impersonator.sh"),
    "domain": os.path.join(SCRIPTS_DIR, "brand-guard-domain.sh"),
    "vendor": os.path.join(SCRIPTS_DIR, "brand-guard-vendor-verify.sh"),
    "threat": os.path.join(SCRIPTS_DIR, "brand-guard-threat-correlate.sh"),
}


def extract_json(output: str) -> dict:
    """Extract the first valid JSON object from output that may have trailing text."""
    output = output.strip()
    # Find the first '{' or '['
    start = output.find('{')
    if start == -1:
        start = output.find('[')
    if start == -1:
        raise RuntimeError("No JSON found in output")
    # Try parsing from start, progressively trimming trailing text
    text = output[start:]
    # Use a JSON decoder that stops at the end of the first object
    decoder = json.JSONDecoder()
    obj, end = decoder.raw_decode(text)
    return obj

# ── Supabase client ──────────────────────────────────────────────────────────

if not SUPABASE_URL or not SUPABASE_KEY:
    log.error("SUPABASE_URL or SUPABASE_SECRET_API_KEY not set")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def is_recent_scan(brand_handle: str) -> bool:
    """Check if a scan for this brand handle occurred in the last 24 hours."""
    try:
        now = datetime.now(timezone.utc)
        yesterday = (now - timedelta(hours=24)).isoformat()
        result = supabase.table("brand_guard_scans") \
            .select("id") \
            .eq("brand_handle", brand_handle) \
            .eq("status", "complete") \
            .gt("completed_at", yesterday) \
            .limit(1) \
            .execute()
        return len(result.data) > 0
    except Exception as exc:
        log.error("Error checking recent scan: %s", exc)
        return False
    """Fetch processing/pending brand_guard_scans ordered by creation time.
    
    DB constraint: status IN ('processing', 'complete', 'failed')
    'processing' = pending/running (our queue uses this as the initial status)
    """
    try:
        result = supabase.table("brand_guard_scans") \
            .select("id,scan_id,owner_id,brand_monitor_id,brand_name,brand_handle,brand_domain,platforms,status,result,created_at") \
            .eq("status", "processing") \
            .order("created_at", desc=False) \
            .limit(5) \
            .execute()
        # Filter to only truly pending jobs (those without _claimed_at in result)
        jobs = result.data or []
        pending = []
        for job in jobs:
            result_data = job.get("result") or {}
            if isinstance(result_data, dict) and result_data.get("_claimed_at"):
                continue  # Already claimed by another worker
            if isinstance(result_data, dict) and result_data.get("_worker_id"):
                continue  # Already being processed
            pending.append(job)
        return pending
    except Exception as exc:
        log.error("Fetch pending jobs error: %s", exc)
        return []


def claim_job(job_id: str) -> bool:
    """Mark a job as running, claimed by this worker."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("brand_guard_scans") \
            .update({
                "status": "processing",  # DB constraint: IN ('processing', 'complete', 'failed')
                "completed_at": now,  # Use as claimed_at since column doesn't exist separately
                "result": {
                    "_worker_id": WORKER_ID,
                    "_claimed_at": now,
                    "_scan_started": True,
                },
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
        now = datetime.now(timezone.utc).isoformat()
        # Merge worker metadata into result
        result["_worker_id"] = WORKER_ID
        result["_completed_at"] = now

        # Calculate summary fields from result
        impersonators_found = len(result.get("impersonator_results",
                                  result.get("impersonators", []))) if isinstance(
                                      result.get("impersonator_results",
                                      result.get("impersonators", [])), list) else 0
        variants_generated = result.get("summary", {}).get("variants_generated", 0)
        profiles_scanned = result.get("summary", {}).get("profiles_scanned", 0)

        supabase.table("brand_guard_scans") \
            .update({
                "status": "complete",  # DB constraint: IN ('processing', 'complete', 'failed')
                "result": result,
                "completed_at": now,
                "impersonators_found": impersonators_found,
                "variants_generated": variants_generated,
                "profiles_scanned": profiles_scanned,
            }) \
            .eq("id", job_id) \
            .execute()
        return True
    except Exception as exc:
        log.error("Complete job error: %s", exc)
        return False


def fail_job(job_id: str, error: str) -> None:
    """Mark a job as failed with error info."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("brand_guard_scans") \
            .update({
                "status": "failed",
                "result": {
                    "_worker_id": WORKER_ID,
                    "_failed_at": now,
                    "error": error,
                },
                "completed_at": now,
            }) \
            .eq("id", job_id) \
            .execute()
    except Exception as exc:
        log.error("Fail job error: %s", exc)


# ── URL scan chaining (JS Detonation) ─────────────────────────────────────────

def submit_url_scan_job(
    url: str,
    timeout: int = 20,
    parent_brand_guard_scan_id: str | None = None,
    owner_id: str | None = None,
    brand_monitor_id: str | None = None,
    brand_name: str | None = None,
    brand_domain: str | None = None,
) -> str | None:
    """Submit a URL scan job to the scan_jobs queue for JS detonation analysis."""
    try:
        import uuid as _uuid
        job_id = str(_uuid.uuid4())
        payload = {
            "url": url,
            "timeout": timeout,
            "urlscan_enrichment": True,
        }
        if owner_id:
            payload["owner_id"] = owner_id
        if parent_brand_guard_scan_id:
            payload["parent_brand_guard_scan_id"] = parent_brand_guard_scan_id
        if brand_monitor_id:
            payload["brand_monitor_id"] = brand_monitor_id
        if brand_name:
            payload["brand_name"] = brand_name
        if brand_domain:
            payload["brand_domain"] = brand_domain
        payload["brand_terms"] = [term for term in [brand_name, brand_domain] if term]
        supabase.table("scan_jobs").insert({
            "id": job_id,
            "scan_type": "url_scan",
            "payload": payload,
            "status": "pending",
            "priority": 5,
        }).execute()
        return job_id
    except Exception as exc:
        log.warning("Failed to submit URL scan job: %s", exc)
        return None


# ── Scan execution ───────────────────────────────────────────────────────────

def run_impersonator_scan(brand_name: str, brand_handle: str, brand_domain: str,
                          platforms: list) -> dict:
    """Run brand impersonator scan using local CLI."""
    # ── LLM-enhanced analysis via Gemini fallback (SLA-critical) ────────────
    if _bg_llm:
        try:
            llm_prompt = (
                f"Analyze brand impersonation risk for:\n"
                f"  Brand: {brand_name}\n"
                f"  Handle: @{brand_handle}\n"
                f"  Domain: {brand_domain or 'N/A'}\n"
                f"  Platforms: {', '.join(platforms) if platforms else 'all'}\n\n"
                f"Generate search variants for impersonation detection. "
                f"Return JSON with: variants (list of username variants to search), "
                f"risk_indicators (list), and confidence_score (0-100)."
            )
            llm_result = _bg_llm.analyze(
                "impersonator_scan", llm_prompt, json_mode=True
            )
            if llm_result.get("text"):
                try:
                    llm_data = json.loads(llm_result["text"]) if isinstance(llm_result["text"], str) else llm_result["text"]
                    log.info("LLM impersonator analysis: model=%s, latency=%dms, source=%s",
                             llm_result.get("model", "?"),
                             llm_result.get("latency_ms", 0),
                             llm_result.get("source", "?"))
                except json.JSONDecodeError:
                    log.warning("LLM returned non-JSON, using CLI scan only")
        except Exception as e:
            log.warning("LLM impersonator analysis failed (non-blocking): %s", e)

    script = SCAN_SCRIPTS["impersonator"]
    cmd = ["bash", script, brand_name, "--handle", brand_handle, "--json"]
    if brand_domain:
        cmd.extend(["--domain", brand_domain])
    if platforms:
        cmd.extend(["--platforms", ",".join(platforms)])

    log.info("Running impersonator scan: %s", " ".join(cmd))
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=SCAN_TIMEOUT,
            cwd=WORKSPACE,
        )
        if proc.returncode != 0:
            log.error("Impersonator scan stderr: %s", proc.stderr[-500:] if proc.stderr else "none")
            raise RuntimeError(f"Impersonator scan failed (exit {proc.returncode}): {proc.stderr[:200]}")

        # Parse JSON output
        output = proc.stdout.strip()
        if not output:
            raise RuntimeError("Impersonator scan returned empty output")

        result = extract_json(output)
        log.info("Impersonator scan complete: %d impersonators found",
                 result.get("summary", {}).get("impersonators_found",
                 len(result.get("impersonator_results", result.get("impersonators", [])))))
        return result

    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Impersonator scan timeout after {SCAN_TIMEOUT}s")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Impersonator scan returned invalid JSON: {e}")
    except Exception as exc:
        raise RuntimeError(f"Impersonator scan error: {exc}")


def run_domain_scan(domain: str, check_active: bool = False, limit: int = 50) -> dict:
    """Run domain lookalike scan using local CLI."""
    # ── LLM-enhanced analysis via Gemini fallback (SLA-critical) ────────────
    if _bg_llm:
        try:
            llm_prompt = (
                f"Analyze domain lookalike/typosquat risk for: {domain}\n"
                f"Generate potential lookalike domain variants. "
                f"Return JSON with: variants (list of {domain, risk_level, category}), "
                f"high_risk_count, and analysis_summary."
            )
            llm_result = _bg_llm.analyze(
                "domain_scan", llm_prompt, json_mode=True
            )
            if llm_result.get("text"):
                log.info("LLM domain analysis: model=%s, latency=%dms, source=%s",
                         llm_result.get("model", "?"),
                         llm_result.get("latency_ms", 0),
                         llm_result.get("source", "?"))
        except Exception as e:
            log.warning("LLM domain analysis failed (non-blocking): %s", e)

    script = SCAN_SCRIPTS["domain"]
    cmd = ["bash", script, domain, "--json", "--limit", str(limit)]
    if check_active:
        cmd.append("--check-active")

    log.info("Running domain scan: %s", " ".join(cmd))
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=SCAN_TIMEOUT,
            cwd=WORKSPACE,
        )
        if proc.returncode != 0:
            log.error("Domain scan stderr: %s", proc.stderr[-500:] if proc.stderr else "none")
            raise RuntimeError(f"Domain scan failed (exit {proc.returncode}): {proc.stderr[:200]}")

        output = proc.stdout.strip()
        if not output:
            raise RuntimeError("Domain scan returned empty output")

        result = extract_json(output)
        log.info("Domain scan complete: %d variants", result.get("total_variants", 0))
        return result

    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Domain scan timeout after {SCAN_TIMEOUT}s")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Domain scan returned invalid JSON: {e}")
    except Exception as exc:
        raise RuntimeError(f"Domain scan error: {exc}")


def run_vendor_scan(phone: str, country: str, vendor_name: str = "",
                    context: str = "") -> dict:
    """Run vendor phone verification scan using local CLI."""
    # ── LLM-enhanced analysis via Gemini fallback (SLA-critical) ────────────
    if _bg_llm:
        try:
            llm_prompt = (
                f"Analyze vendor/seller trust risk:\n"
                f"  Phone: {phone} ({country})\n"
                f"  Vendor: {vendor_name or 'Unknown'}\n"
                f"  Context: {context or 'N/A'}\n\n"
                f"Assess legitimacy. Return JSON with: risk_score (0-90), "
                f"red_flags (list of {{flag, points, reason}}), verdict, and analysis."
            )
            llm_result = _bg_llm.analyze(
                "vendor_verify", llm_prompt, json_mode=True
            )
            if llm_result.get("text"):
                log.info("LLM vendor analysis: model=%s, latency=%dms, source=%s",
                         llm_result.get("model", "?"),
                         llm_result.get("latency_ms", 0),
                         llm_result.get("source", "?"))
        except Exception as e:
            log.warning("LLM vendor analysis failed (non-blocking): %s", e)

    script = SCAN_SCRIPTS["vendor"]
    cmd = ["bash", script, phone, country, "--json"]
    if vendor_name:
        cmd.extend(["--vendor", vendor_name])
    if context:
        cmd.extend(["--context", context])

    log.info("Running vendor scan for %s", phone)
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=SCAN_TIMEOUT,
            cwd=WORKSPACE,
        )
        if proc.returncode != 0:
            log.error("Vendor scan stderr: %s", proc.stderr[-500:] if proc.stderr else "none")
            raise RuntimeError(f"Vendor scan failed (exit {proc.returncode}): {proc.stderr[:200]}")

        output = proc.stdout.strip()
        if not output:
            raise RuntimeError("Vendor scan returned empty output")

        result = extract_json(output)
        log.info("Vendor scan complete: risk_score=%s",
                 result.get("risk_score", result.get("vendor_verification", {}).get("risk_score", "N/A")))
        return result

    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Vendor scan timeout after {SCAN_TIMEOUT}s")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Vendor scan returned invalid JSON: {e}")
    except Exception as exc:
        raise RuntimeError(f"Vendor scan error: {exc}")


def run_threat_correlate(brand_name: str, brand_handle: str,
                         brand_domain: str = "") -> dict:
    """Run cross-channel threat correlation using local CLI."""
    # ── LLM-enhanced analysis via Gemini fallback (SLA-critical) ────────────
    if _bg_llm:
        try:
            llm_prompt = (
                f"Correlate threat signals across channels for:\n"
                f"  Brand: {brand_name}\n"
                f"  Handle: @{brand_handle}\n"
                f"  Domain: {brand_domain or 'N/A'}\n\n"
                f"Synthesize cross-channel threat intelligence. "
                f"Return JSON with: aggregate_risk_score (0-90), "
                f"channel_threats (list), correlated_patterns, and threat_summary."
            )
            llm_result = _bg_llm.analyze(
                "threat_correlate", llm_prompt, json_mode=True
            )
            if llm_result.get("text"):
                log.info("LLM threat correlation: model=%s, latency=%dms, source=%s",
                         llm_result.get("model", "?"),
                         llm_result.get("latency_ms", 0),
                         llm_result.get("source", "?"))
        except Exception as e:
            log.warning("LLM threat correlation failed (non-blocking): %s", e)

    script = SCAN_SCRIPTS["threat"]
    cmd = ["bash", script, brand_name, "--handle", brand_handle, "--json"]
    if brand_domain:
        cmd.extend(["--domain", brand_domain])

    log.info("Running threat correlation for %s", brand_name)
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=SCAN_TIMEOUT,
            cwd=WORKSPACE,
        )
        if proc.returncode != 0:
            log.error("Threat correlate stderr: %s", proc.stderr[-500:] if proc.stderr else "none")
            raise RuntimeError(f"Threat correlate failed (exit {proc.returncode}): {proc.stderr[:200]}")

        output = proc.stdout.strip()
        result = None

        if output:
            try:
                result = extract_json(output)
            except RuntimeError:
                result = None

        if result is None:
            # Threat correlate saves to file instead of stdout
            # Check for recent result files in threat-correlate output dir
            import glob as _glob
            result_files = sorted(
                _glob.glob('/Users/efinney/.openclaw/workspace/output/threat-correlate/*correlation*.json'),
                key=os.path.getmtime, reverse=True
            )
            if result_files:
                with open(result_files[0], 'r') as f:
                    result = json.load(f)
                log.info("Threat correlate complete (from file %s): aggregate_risk=%s",
                         os.path.basename(result_files[0]),
                         result.get("aggregate_risk_score", result.get("aggregate_risk", "N/A")))
                return result
            raise RuntimeError("Threat correlate returned no JSON output and no result file found")

        log.info("Threat correlate complete: aggregate_risk=%s",
                 result.get("aggregate_risk_score", result.get("aggregate_risk", "N/A")))
        return result

    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Threat correlate timeout after {SCAN_TIMEOUT}s")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Threat correlate returned invalid JSON: {e}")
    except Exception as exc:
        raise RuntimeError(f"Threat correlate error: {exc}")


# ── Determine scan type from job ──────────────────────────────────────────────

def determine_scan_type(job: dict) -> str:
    """Determine scan type from job data. Default: impersonator."""
    # Check payload for scan_type
    result = job.get("result", {}) or {}
    if isinstance(result, dict):
        st = result.get("scan_type", "")
        if st:
            return st
    # Check platforms for clues
    platforms = job.get("platforms", []) or []
    # Default to impersonator scan
    return "impersonator"


# ── Process single job ───────────────────────────────────────────────────────

def process_job(job: dict) -> None:
    """Process one brand guard scan job."""
    job_id = job["id"]
    scan_id = job.get("scan_id", "")
    owner_id = job.get("owner_id", "")
    brand_monitor_id = job.get("brand_monitor_id", "")
    brand_name = job.get("brand_name", "")
    brand_handle = job.get("brand_handle", "")
    brand_domain = job.get("brand_domain", "") or ""
    platforms = job.get("platforms", []) or []

    if not brand_name or not brand_handle:
        fail_job(job_id, "Missing brand_name or brand_handle")
        return

    # ── Job Throttling: Check for recent scans ──────────────────────────────
    if is_recent_scan(brand_handle):
        log.info("Skipping job %s — recent scan found for @%s", job_id, brand_handle)
        complete_job(job_id, {"status": "skipped", "reason": "recent_scan_exists"})
        return

    log.info("Processing job %s (scan_id=%s) for brand: %s/@%s",
             job_id, scan_id, brand_name, brand_handle)

    if not claim_job(job_id):
        return  # Another worker claimed it

    # Determine scan type
    scan_type = determine_scan_type(job)
    log.info("Scan type: %s", scan_type)

    try:
        if scan_type == "impersonator":
            result = run_impersonator_scan(brand_name, brand_handle, brand_domain, platforms)
        elif scan_type == "domain":
            result = run_domain_scan(brand_domain or f"{brand_handle}.com")
        elif scan_type == "vendor":
            # Extract phone from payload/result
            payload = job.get("result", {}) or {}
            phone = payload.get("phone", "")
            country = payload.get("country", "US")
            vendor_name = payload.get("vendor_name", "")
            context = payload.get("context", "")
            if not phone:
                raise RuntimeError("Vendor scan requires phone number in payload")
            result = run_vendor_scan(phone, country, vendor_name, context)
        elif scan_type == "threat":
            result = run_threat_correlate(brand_name, brand_handle, brand_domain)
        else:
            raise RuntimeError(f"Unknown scan type: {scan_type}")

        # Add metadata
        result["scan_type"] = scan_type
        result["real_scan"] = True  # Flag that this was a real scan, not theoretical
        result["data_source"] = "local_cli"
        result["llm_enhanced"] = _bg_llm is not None
        result["gemini_fallback_active"] = _bg_llm is not None

        # ── Auto-chain URL detonation for active domains ────────────────────
        # When a domain scan finds active lookalike domains, auto-submit
        # a JS detonation URL scan for the most suspicious active variant.
        if scan_type == "domain":
            try:
                variants = result.get("variants", []) or result.get("active_variants", [])
                active_variants = [v for v in variants if isinstance(v, dict) and v.get("is_active")]
                if active_variants:
                    # Submit URL scan for the top active variant
                    top_domain = active_variants[0].get("domain", "") or ""
                    if top_domain:
                        url_to_scan = f"https://{top_domain}"
                        url_job_id = submit_url_scan_job(
                            url_to_scan,
                            timeout=20,
                            parent_brand_guard_scan_id=job_id,
                            owner_id=owner_id,
                            brand_monitor_id=brand_monitor_id,
                            brand_name=brand_name,
                            brand_domain=brand_domain,
                        )
                        if url_job_id:
                            result["url_scan_job_id"] = url_job_id
                            result["url_scan_url"] = url_to_scan
                            log.info("Chained URL scan for active domain %s → job %s",
                                     url_to_scan, url_job_id)
            except Exception as chain_exc:
                log.warning("URL chain failed (non-critical): %s", chain_exc)

        complete_job(job_id, result)
        log.info("SUCCESS job %s — %s scan for %s",
                 job_id, scan_type, brand_name)

    except Exception as exc:
        log.error("FAIL job %s: %s", job_id, exc)
        # Check retry count from the job's result metadata
        result_data = job.get("result", {}) or {}
        retry_count = result_data.get("_retry_count", 0) if isinstance(result_data, dict) else 0
        if retry_count < MAX_SCAN_RETRIES:
            log.warning("Retrying job %s (attempt %d/%d) in %ds...",
                        job_id, retry_count + 1, MAX_SCAN_RETRIES, SCAN_RETRY_DELAY)
            time.sleep(SCAN_RETRY_DELAY)
            # Requeue for another attempt
            try:
                now_iso = datetime.now(timezone.utc).isoformat()
                supabase.table("brand_guard_scans") \
                    .update({
                        "status": "processing",
                        "result": {
                            "_worker_id": WORKER_ID,
                            "_retry_count": retry_count + 1,
                            "_retry_reason": str(exc)[:200],
                            "_requeued_at": now_iso,
                        },
                    }) \
                    .eq("id", job_id) \
                    .execute()
                log.info("Requeued job %s for retry #%d", job_id, retry_count + 1)
            except Exception as requeue_exc:
                log.error("Failed to requeue job %s: %s", job_id, requeue_exc)
                fail_job(job_id, str(exc))
        else:
            log.error("Job %s exceeded max retries (%d) — permanent fail", job_id, MAX_SCAN_RETRIES)
            fail_job(job_id, f"Max retries ({MAX_SCAN_RETRIES}) reached. Last error: {exc}")


# ── Main loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("Brand Guard Scan Worker started — %s", WORKER_ID)
    log.info("Supabase: %s", SUPABASE_URL)
    log.info("Scripts: %s", ", ".join(f"{k}={v}" for k, v in SCAN_SCRIPTS.items()))
    log.info("Gemini fallback: %s", "ENABLED" if _bg_llm else "DISABLED")

    # Verify all scripts exist
    for scan_type, script_path in SCAN_SCRIPTS.items():
        if not os.path.exists(script_path):
            log.error("Script not found: %s (%s)", scan_type, script_path)
            sys.exit(1)

    consecutive_errors = 0
    max_errors = 10

    while True:
        try:
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
