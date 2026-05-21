#!/bin/bash

# Launch Chrome CDP instances for batch scanning
# Ports: 18801, 18802, 18803

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
USER_DATA_DIRS=("/tmp/chrome-batch-18801" "/tmp/chrome-batch-18802" "/tmp/chrome-batch-18803")
PORTS=(18801 18802 18803)

echo "🚀 Launching Chrome CDP instances..."
echo ""

for i in "${!PORTS[@]}"; do
    PORT=${PORTS[$i]}
    USER_DIR=${USER_DATA_DIRS[$i]}
    
    # Kill existing instance on this port
    pkill -f "chrome.*--remote-debugging-port=$PORT" 2>/dev/null || true
    
    # Launch Chrome
    echo "  Port $PORT: Launching..."
    "$CHROME" --remote-debugging-port=$PORT '--remote-allow-origins=*' --user-data-dir="$USER_DIR" &>/dev/null &
    
    # Wait for Chrome to start
    sleep 2
done

# Verify Chrome instances are running
echo ""
echo "🔍 Verifying Chrome CDP connections..."
for PORT in "${PORTS[@]}"; do
    if curl -s "http://localhost:$PORT/json/list" &>/dev/null; then
        echo "  ✅ Port $PORT: Connected"
    else
        echo "  ❌ Port $PORT: Failed"
    fi
done

echo ""
echo "✅ Chrome CDP instances ready!"