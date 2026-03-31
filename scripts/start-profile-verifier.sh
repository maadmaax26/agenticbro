#!/bin/bash

# Profile Verifier System Startup Script
# Starts all components: Chrome CDP, API server, Gateway

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
CHROME_CDP_PORT=18800
API_PORT=8080
WORKSPACE="/Users/efinney/.openclaw/workspace"
LOG_DIR="$WORKSPACE/logs"

# Create log directory
mkdir -p "$LOG_DIR"

echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Profile Verifier System Startup               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Check Chrome CDP
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[1/4] Checking Chrome CDP...${NC}"

if curl -s http://localhost:$CHROME_CDP_PORT/json/version > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Chrome CDP already running on port $CHROME_CDP_PORT${NC}"
else
    echo -e "${RED}✗ Chrome CDP not running${NC}"
    echo -e "${YELLOW}  Please start Chrome with remote debugging:${NC}"
    echo -e "${YELLOW}  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=$CHROME_CDP_PORT${NC}"
    echo ""
    echo -e "${YELLOW}  Or use OpenClaw browser automation:${NC}"
    echo -e "${YELLOW}  openclaw browser start${NC}"
    echo ""
    read -p "Press Enter to continue anyway (CDP required for X profile scanning)..."
fi

echo ""

# ---------------------------------------------------------------------------
# Step 2: Start Agentic Bro API Server
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[2/4] Starting Agentic Bro API server...${NC}"

# Check if API server is already running
if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API server already running on port $API_PORT${NC}"
else
    cd "$WORKSPACE/agentic-bro"

    # Kill any existing process on port
    pkill -f "node.*dist/src/index.js" 2>/dev/null || true
    sleep 2

    # Start API server in background
    PORT=$API_PORT npm start > "$LOG_DIR/api-server.log" 2>&1 &
    API_PID=$!
    echo $API_PID > "$LOG_DIR/api-server.pid"

    # Wait for server to start
    echo -e "${YELLOW}  Waiting for API server to start...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ API server started (PID: $API_PID)${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}✗ API server failed to start${NC}"
            echo -e "${YELLOW}  Check logs: $LOG_DIR/api-server.log${NC}"
            exit 1
        fi
        sleep 1
    done
fi

echo ""

# ---------------------------------------------------------------------------
# Step 3: Check OpenClaw Gateway
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[3/4] Checking OpenClaw Gateway...${NC}"

if curl -s http://localhost:18789/health > /dev/null 2>&1 2>/dev/null || openclaw status > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OpenClaw Gateway running${NC}"
else
    echo -e "${YELLOW}  Starting OpenClaw Gateway...${NC}"
    openclaw gateway start > "$LOG_DIR/gateway.log" 2>&1 &
    sleep 3

    if openclaw status > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OpenClaw Gateway started${NC}"
    else
        echo -e "${RED}✗ Failed to start Gateway${NC}"
        echo -e "${YELLOW}  Check logs: $LOG_DIR/gateway.log${NC}"
    fi
fi

echo ""

# ---------------------------------------------------------------------------
# Step 4: Display Status
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[4/4] System Status${NC}"
echo ""
echo "Chrome CDP:      http://localhost:$CHROME_CDP_PORT"
echo "API Server:      http://localhost:$API_PORT"
echo "API Health:      http://localhost:$API_PORT/health"
echo "API Info:        http://localhost:$API_PORT/api/v1"
echo ""

echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Profile Verifier System Running              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo "Log files:"
echo "  API Server:  $LOG_DIR/api-server.log"
echo "  Gateway:     $LOG_DIR/gateway.log"
echo ""
echo "To stop all services:"
echo "  $WORKSPACE/scripts/stop-profile-verifier.sh"
echo ""