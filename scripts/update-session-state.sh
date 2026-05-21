#!/bin/bash
# Session State Updater — Agentic Bro
# Updates SESSION_STATE.json for cross-session awareness
# Usage: bash update-session-state.sh [command] [args...]
#
# Commands:
#   add-task "description" — mark a task as in_progress
#   complete-task "description" "result_summary" — move task to completed
#   add-issue "issue" "status" "workaround" — add a known issue
#   update-feature "feature_name" "status" "details" — update feature status
#   register-session "session_id" "task" — register an active session
#   remove-session "session_id" — remove an active session

set -euo pipefail

STATE_FILE="/Users/efinney/.openclaw/workspace/SESSION_STATE.json"
LOCK_FILE="/tmp/session_state.lock"
COMMAND="${1:?Usage: bash update-session-state.sh [add-task|complete-task|add-issue|update-feature|register-session|remove-session] [args...]}"

# Ensure jq is available
if ! command -v jq &>/dev/null; then
    echo '{"error": "jq is required but not installed"}' >&2
    exit 1
fi

# File locking for concurrent safety
acquire_lock() {
    local max_wait=10
    local waited=0
    while [ -f "$LOCK_FILE" ] && [ $waited -lt $max_wait ]; do
        sleep 1
        waited=$((waited + 1))
    done
    if [ -f "$LOCK_FILE" ]; then
        echo '{"error": "Could not acquire lock on SESSION_STATE.json"}' >&2
        exit 1
    fi
    echo $$ > "$LOCK_FILE"
}

release_lock() {
    rm -f "$LOCK_FILE"
}

# Timestamp
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SESSION_ID="${OPENCLAW_SESSION_ID:-agent:agentic-bro:unknown}"

case "$COMMAND" in
    add-task)
        DESC="${2:?Usage: add-task \"description\"}"
        acquire_lock
        jq --arg desc "$DESC" \
           --arg now "$NOW" \
           --arg sid "$SESSION_ID" \
           '.last_updated = $now | 
            .in_progress += [{"task": $desc, "started_at": $now, "by_session": $sid, "details": ""}]' \
            "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
        release_lock
        echo '{"success": true, "action": "add-task", "task": "'"$DESC"'"}'
        ;;

    complete-task)
        DESC="${2:?Usage: complete-task \"description\" \"result_summary\"}"
        RESULT="${3:-Task completed}"
        acquire_lock
        # Remove from in_progress and add to completed_tasks
        jq --arg desc "$DESC" \
           --arg result "$RESULT" \
           --arg now "$NOW" \
           --arg sid "$SESSION_ID" \
           '.last_updated = $now |
            .in_progress = [.in_progress[] | select(.task != $desc)] |
            .completed_tasks += [{"task": $desc, "completed_at": $now, "by_session": $sid, "result_summary": $result}]' \
            "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
        release_lock
        echo '{"success": true, "action": "complete-task", "task": "'"$DESC"'"}'
        ;;

    add-issue)
        ISSUE="${2:?Usage: add-issue \"issue\" \"status\" \"workaround\"}"
        STATUS="${3:-open}"
        WORKAROUND="${4:-None}"
        acquire_lock
        jq --arg issue "$ISSUE" \
           --arg status "$STATUS" \
           --arg wa "$WORKAROUND" \
           --arg now "$NOW" \
           '.last_updated = $now |
            .known_issues += [{"issue": $issue, "status": $status, "workaround": $wa}]' \
            "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
        release_lock
        echo '{"success": true, "action": "add-issue", "issue": "'"$ISSUE"'"}'
        ;;

    update-feature)
        FEATURE="${2:?Usage: update-feature \"feature_name\" \"status\" \"details\"}"
        FSTATUS="${3:-live}"
        FDETAILS="${4:-}"
        acquire_lock
        jq --arg feat "$FEATURE" \
           --arg fstatus "$FSTATUS" \
           --arg fdetails "$FDETAILS" \
           --arg now "$NOW" \
           '.last_updated = $now |
            .feature_status[$feat] = {"status": $fstatus, "details": $fdetails, "last_updated": $now}' \
            "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
        release_lock
        echo '{"success": true, "action": "update-feature", "feature": "'"$FEATURE"'", "status": "'"$FSTATUS"'"}'
        ;;

    register-session)
        SID="${2:?Usage: register-session \"session_id\" \"task\"}"
        TASK="${3:-active}"
        acquire_lock
        jq --arg sid "$SID" \
           --arg task "$TASK" \
           --arg now "$NOW" \
           '.last_updated = $now |
            .active_sessions += [{"session_id": $sid, "started_at": $now, "task": $task, "status": "active"}]' \
            "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
        release_lock
        echo '{"success": true, "action": "register-session", "session_id": "'"$SID"'"}'
        ;;

    remove-session)
        SID="${2:?Usage: remove-session \"session_id\"}"
        acquire_lock
        jq --arg sid "$SID" \
           --arg now "$NOW" \
           '.last_updated = $now |
            .active_sessions = [.active_sessions[] | select(.session_id != $sid)]' \
            "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
        release_lock
        echo '{"success": true, "action": "remove-session", "session_id": "'"$SID"'"}'
        ;;

    *)
        echo '{"error": "Unknown command: '"$COMMAND"'. Use: add-task, complete-task, add-issue, update-feature, register-session, remove-session"}' >&2
        exit 1
        ;;
esac