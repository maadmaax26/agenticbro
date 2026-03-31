#!/bin/bash

# Profile Verifier System Status Check
# Checks status of all components

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

echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Profile Verifier System Status                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# ---------------------------------------------------------------------------
# Chrome CDP Status
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[1/3] Chrome CDP (Port $CHROME_CDP_PORT)${NC}"

if curl -s http://localhost:$CHROME_CDP_PORT/json/version > /dev/null 2>&1; then
    PAGES=$(curl -s http://localhost:$CHROME_CDP_PORT/json | jq '[.[] | select(.type == "page")] | length')
    echo -e "${GREEN}✓ Running${NC} - $PAGES page(s) available"
else
    echo -e "${RED}✗ Not running${NC}"
    echo -e "  Start with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=$CHROME_CDP_PORT"
fi

echo ""

# ---------------------------------------------------------------------------
# API Server Status
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[2/3] Agentic Bro API Server (Port $API_PORT)${NC}"

if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
    HEALTH=$(curl -s http://localhost:$API_PORT/health | jq '.status, .version' -r)
    echo -e "${GREEN}✓ Running${NC} - $HEALTH"

    if [ -f "$LOG_DIR/api-server.pid" ]; then
        PID=$(cat "$LOG_DIR/api-server.pid")
        echo -e "  PID: $PID"
    fi

    echo -e "  Endpoints:"
    echo -e "    - Health:  http://localhost:$API_PORT/health"
    echo -e "    - API:     http://localhost:$API_PORT/api/v1"
else
    echo -e "${RED}✗ Not running${NC}"
    echo -e "  Start with: cd $WORKSPACE/agentic-bro && npm start"
fi

echo ""

# ---------------------------------------------------------------------------
# OpenClaw Gateway Status
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[3/3] OpenClaw Gateway (Port 18789)${NC}"

if command -v openclaw > /dev/null 2>&1; then
    if openclaw status > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Running${NC}"
    else
        echo -e "${RED}✗ Not running${NC}"
        echo -e "  Start with: openclaw gateway start"
    fi
else
    echo -e "${YELLOW}⚠  Not installed${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Status Check Complete                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo "Quick Start:"
echo "  Start all:  $WORKSPACE/scripts/start-profile-verifier.sh"
echo "  Stop all:   $WORKSPACE/scripts/stop-profile-verifier.sh"
echo ""
echo "Logs:"
echo "  API Server:  $LOG_DIR/api-server.log"
echo "  Gateway:     $LOG_DIR/gateway.log"
echo ""