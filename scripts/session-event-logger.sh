#!/usr/bin/env bash
# session-event-logger.sh
# Auto-log events to memory/SESSION_EVENTS.md with file locking and error handling
# Usage: bash session-event-logger.sh "Event Title" "Type" "Details" "Impact" ["Session ID"] ["Changed By"]

set -euo pipefail

# Parameters
EVENT_TITLE="${1:-Unknown Event}"
EVENT_TYPE="${2:-System}"
EVENT_DETAILS="${3:-No details provided}"
EVENT_IMPACT="${4:-No impact documented}"
SESSION_ID="${5:-$(hostname):$$}"
CHANGED_BY="${6:-Jeeevs agent}"

# Paths
EVENTS_FILE="/Users/efinney/.openclaw/workspace/memory/SESSION_EVENTS.md"
LOCK_FILE="/tmp/session-events.lock"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# Error handler
error_exit() {
    echo "❌ Error: $1" >&2
    exit 1
}

# Check if file exists
if [ ! -f "$EVENTS_FILE" ]; then
    error_exit "SESSION_EVENTS.md not found at $EVENTS_FILE"
fi

# Acquire file lock (timeout after 5 seconds)
acquire_lock() {
    local timeout=5
    local elapsed=0
    while [ -f "$LOCK_FILE" ]; do
        if [ "$elapsed" -ge "$timeout" ]; then
            error_exit "Could not acquire lock after ${timeout}s"
        fi
        sleep 0.1
        elapsed=$((elapsed + 1))
    done
    touch "$LOCK_FILE"
}

# Release file lock
release_lock() {
    rm -f "$LOCK_FILE"
}

# Ensure lock is released on exit
trap release_lock EXIT

# Create temp file with new entry
TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT

# Write formatted entry
cat > "$TMP_FILE" << EOF

### ${TIMESTAMP} - ${EVENT_TITLE}
- **Session:** ${SESSION_ID}
- **Event:** ${EVENT_TITLE}
- **Type:** ${EVENT_TYPE}
- **Details:** ${EVENT_DETAILS}
- **Impact:** ${EVENT_IMPACT}
- **Changed by:** ${CHANGED_BY}
EOF

# Acquire lock and update file
acquire_lock

# Insert before "## Event Types" section
awk -v tmpfile="$TMP_FILE" '
    /## Event Types/ {
        while ((getline line < tmpfile) > 0) {
            print line
        }
        close(tmpfile)
        print
        next
    }
    { print }
' "$EVENTS_FILE" > "${EVENTS_FILE}.tmp" && mv "${EVENTS_FILE}.tmp" "$EVENTS_FILE"

release_lock

echo "✅ Logged: ${EVENT_TITLE} at ${TIMESTAMP}"
