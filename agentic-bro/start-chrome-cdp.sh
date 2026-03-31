#!/bin/bash
# Start Chrome with remote debugging for Agentic Bro Profile Verifier

echo "Starting Chrome with remote debugging on port 18800..."

# Kill any existing Chrome instances on port 18800
pkill -f "Google Chrome.*--remote-debugging-port=18800" 2>/dev/null
sleep 2

# Start Chrome with remote debugging
nohup /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=18800 \
  --user-data-dir=/tmp/chrome-agenticbro \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-networking \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-breakpad \
  --disable-component-extensions-with-background-pages \
  --disable-extensions \
  --disable-features=TranslateUI \
  --disable-ipc-flooding-protection \
  --disable-renderer-backgrounding \
  --enable-features=NetworkService,NetworkServiceInProcess \
  --force-color-profile=srgb \
  --metrics-recording-only \
  --mute-audio \
  --no-sandbox > /tmp/chrome-cdp.log 2>&1 &

CHROME_PID=$!
echo "Chrome started (PID: $CHROME_PID)"
echo "Waiting for Chrome CDP initialization..."

# Wait up to 15 seconds for Chrome to initialize
for i in {1..15}; do
    if curl -s http://localhost:18800/json/version > /dev/null 2>&1; then
        echo "✅ Chrome CDP is accessible on port 18800"
        echo "Ready for profile verification scans!"
        exit 0
    fi
    echo "Waiting... ($i/15)"
    sleep 1
done

echo "❌ Failed to connect to Chrome CDP after 15 seconds"
echo "Chrome log:"
cat /tmp/chrome-cdp.log
echo ""
echo "Please check if Chrome is running and port 18800 is available"