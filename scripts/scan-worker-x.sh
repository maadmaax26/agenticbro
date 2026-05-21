#!/bin/bash
# X/Twitter CDP Scan Worker
# Polls Supabase for pending scan_jobs of type x_cdp and processes them
# using Chrome CDP on localhost:18801

set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
SCAN_SCRIPT="$WORKSPACE/scripts/scan-source.sh"
LOG_FILE="$WORKSPACE/output/scan-worker.log"
CDP_PORT="${CDP_PORT:-18801}"

# Load env vars
if [ -f "$WORKSPACE/.env" ]; then
  set -a
  source "$WORKSPACE/.env"
  set +a
fi

# Supabase config
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_SECRET_API_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "ERROR: SUPABASE_URL and SUPABASE_SECRET_API_KEY must be set" >&2
  exit 1
fi

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Check Chrome CDP is available
check_cdp() {
  if curl -s "http://localhost:$CDP_PORT/json/version" > /dev/null 2>&1; then
    return 0
  else
    log "Chrome CDP not available on port $CDP_PORT"
    return 1
  fi
}

# Fetch pending scan jobs from Supabase
fetch_pending_jobs() {
  local response
  response=$(curl -s \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    "${SUPABASE_URL}/rest/v1/scan_jobs?status=eq.pending&scan_type=eq.x_cdp&order=created_at.asc&limit=5" \
    2>/dev/null)
  
  echo "$response"
}

# Claim a job (mark as running)
claim_job() {
  local job_id="$1"
  curl -s \
    -X PATCH \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"status":"running","started_at":"'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"}' \
    "${SUPABASE_URL}/rest/v1/scan_jobs?id=eq.${job_id}" \
    > /dev/null 2>&1
}

# Update job with result
complete_job() {
  local job_id="$1"
  local result_json="$2"
  
  # Escape JSON for embedding
  local escaped_json
  escaped_json=$(echo "$result_json" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '"scan completed"')
  
  curl -s \
    -X PATCH \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"status\":\"completed\",\"result\":${result_json},\"completed_at\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}" \
    "${SUPABASE_URL}/rest/v1/scan_jobs?id=eq.${job_id}" \
    > /dev/null 2>&1
}

# Mark job as failed
fail_job() {
  local job_id="$1"
  local error_msg="$2"
  
  curl -s \
    -X PATCH \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"status\":\"failed\",\"result\":{\"error\":\"${error_msg}\"},\"completed_at\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}" \
    "${SUPABASE_URL}/rest/v1/scan_jobs?id=eq.${job_id}" \
    > /dev/null 2>&1
}

# Run scan for a username
run_scan() {
  local username="$1"
  local output_file="$WORKSPACE/output/x_scan_worker_${username}.json"
  
  # Run the local scan script
  bash "$SCAN_SCRIPT" "x" "$username" > /dev/null 2>&1 || true
  
  # Find the most recent scan output for this username
  local result_file
  result_file=$(ls -t "$WORKSPACE/output/x_profile_reports/${username}_"*.json 2>/dev/null | head -1)
  
  if [ -n "$result_file" ] && [ -f "$result_file" ]; then
    cat "$result_file"
    return 0
  else
    echo '{"success":false,"error":"Scan completed but no output file found"}'
    return 1
  fi
}

# Main processing loop
main() {
  log "X Scan Worker starting..."
  
  if ! check_cdp; then
    log "Chrome CDP not available, exiting"
    exit 1
  fi
  
  local jobs
  jobs=$(fetch_pending_jobs)
  
  # Parse jobs using python3
  local job_count
  job_count=$(echo "$jobs" | python3 -c "import sys,json; data=json.load(sys.stdin); print(len(data))" 2>/dev/null || echo "0")
  
  if [ "$job_count" = "0" ]; then
    log "No pending X scan jobs"
    exit 0
  fi
  
  log "Found $job_count pending job(s)"
  
  # Process each job
  echo "$jobs" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for job in data:
    print(f\"{job.get('id','')}|{job.get('payload',{}).get('username','')}\")
" 2>/dev/null | while IFS='|' read -r job_id username; do
    if [ -z "$job_id" ] || [ -z "$username" ]; then
      continue
    fi
    
    log "Processing job $job_id for @${username}"
    
    # Claim the job
    claim_job "$job_id"
    
    # Run the scan
    local scan_result
    if scan_result=$(run_scan "$username"); then
      # Parse and update Supabase with result
      log "Scan completed for @${username}"
      
      # Extract risk score from result
      local risk_score risk_level
      risk_score=$(echo "$scan_result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('risk_score', d.get('riskScore', 0)))" 2>/dev/null || echo "0")
      risk_level=$(echo "$scan_result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('risk_level', d.get('riskLevel', 'UNKNOWN')))" 2>/dev/null || echo "UNKNOWN")
      
      log "Result: @${username} - Risk ${risk_score}/10 - ${risk_level}"
      
      # Complete the job with scan data
      complete_job "$job_id" "$scan_result"
    else
      log "Scan failed for @${username}"
      fail_job "$job_id" "Scan execution failed"
    fi
  done
  
  log "X Scan Worker complete"
}

main "$@"