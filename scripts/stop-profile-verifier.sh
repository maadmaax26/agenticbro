#!/bin/bash

# Profile Verifier System Stop Script
# Stops all components: API server, Gateway

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
WORKSPACE="/Users/efinney/.openclaw/workspace"
LOG_DIR="$WORKSPACE/logs"

echo -e "${RED}╔════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║   Stopping Profile Verifier System            ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════╝${NC}"
echo ""

# ---------------------------------------------------------------------------
# Stop API Server
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[1/3] Stopping API Server...${NC}"

if [ -f "$LOG_DIR/api-server.pid" ]; then
    API_PID=$(cat "$LOG_DIR/api-server.pid")
    if ps -p $API_PID > /dev/null 2>&1; then
        kill $API_PID
        echo -e "${GREEN}✓ API server stopped (PID: $API_PID)${NC}"
    else
        echo -e "${YELLOW}  API server not running (PID file exists but process not found)${NC}"
    fi
    rm -f "$LOG_DIR/api-server.pid"
else
    # Kill by process name
    if pgrep -f "node.*dist/src/index.js" > /dev/null 2>&1; then
        pkill -f "node.*dist/src/index.js"
        echo -e "${GREEN}✓ API server stopped${NC}"
    else
        echo -e "${YELLOW}  API server not running${NC}"
    fi
fi

echo ""

# ---------------------------------------------------------------------------
# Stop OpenClaw Gateway (Optional)
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[2/3] Stopping OpenClaw Gateway (optional)...${NC}"

read -p "Stop OpenClaw Gateway? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v openclaw > /dev/null 2>&1; then
        openclaw gateway stop > /dev/null 2>&1 || true
        echo -e "${GREEN}✓ Gateway stopped${NC}"
    else
        echo -e "${YELLOW}  Gateway not installed${NC}"
    fi
else
    echo -e "${YELLOW}  Gateway left running${NC}"
fi

echo ""

# ---------------------------------------------------------------------------
# Status Check
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[3/3] Status Check${NC}"
echo ""

if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${RED}✗ API Server still running (port 8080)${NC}"
else
    echo -e "${GREEN}✓ API Server stopped${NC}"
fi

if curl -s http://localhost:18789/health > /dev/null 2>&1 2>/dev/null || openclaw status > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠  Gateway still running${NC}"
else
    echo -e "${GREEN}✓ Gateway stopped${NC}"
fi

echo ""
echo -e "${RED}╔════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║   Profile Verifier System Stopped              ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo "To start services again:"
echo "  $WORKSPACE/scripts/start-profile-verifier.sh"
echo ""