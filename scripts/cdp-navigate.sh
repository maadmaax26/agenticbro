#!/bin/bash
# Navigate Chrome CDP to a URL and wait for load
# Usage: cdp-navigate.sh <url> [wait_seconds]
URL="$1"
WAIT="${2:-3}"

# Get the first page target
TARGET=$(curl -s http://localhost:18801/json/list | python3 -c "import json,sys; tabs=json.load(sys.stdin); page=[t for t in tabs if t.get('type')=='page']; print(page[0]['id'] if page else '')" 2>/dev/null)

if [ -z "$TARGET" ]; then
    echo "ERROR: No page target found"
    exit 1
fi

# Navigate using Page.navigate via CDP
WS_URL=$(curl -s http://localhost:18801/json/list | python3 -c "import json,sys; tabs=json.load(sys.stdin); page=[t for t in tabs if t.get('id')=='$TARGET']; print(page[0]['webSocketDebuggerUrl'] if page else '')" 2>/dev/null)

# Use simple HTTP endpoint for navigation
curl -s "http://localhost:18801/json/new?$URL" > /dev/null 2>&1

sleep "$WAIT"
echo "OK"