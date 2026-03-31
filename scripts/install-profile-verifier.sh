#!/bin/bash

# Profile Verifier System Installation Script
# Sets up launchd agent for auto-start on system boot

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
WORKSPACE="/Users/efinney/.openclaw/workspace"
PLIST_FILE="$WORKSPACE/com.agenticbro.profile-verifier.plist"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
LAUNCHD_DEST="$LAUNCHD_DIR/com.agenticbro.profile-verifier.plist"

echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Profile Verifier - System Installation       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# ---------------------------------------------------------------------------
# Check Prerequisites
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

# Check Node.js
if command -v node > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Node.js installed: $(node --version)${NC}"
else
    echo -e "${RED}✗ Node.js not installed${NC}"
    echo -e "  Install with: brew install node"
    exit 1
fi

# Check npm
if command -v npm > /dev/null 2>&1; then
    echo -e "${GREEN}✓ npm installed: $(npm --version)${NC}"
else
    echo -e "${RED}✗ npm not installed${NC}"
    exit 1
fi

# Check OpenClaw
if command -v openclaw > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OpenClaw installed${NC}"
else
    echo -e "${YELLOW}⚠  OpenClaw not found (optional for Gateway)${NC}"
fi

echo ""

# ---------------------------------------------------------------------------
# Build Agentic Bro
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[2/5] Building Agentic Bro...${NC}"

cd "$WORKSPACE/agentic-bro"

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
else
    echo -e "${YELLOW}  Installing dependencies...${NC}"
    npm install
fi

echo -e "${YELLOW}  Building TypeScript...${NC}"
npm run build

if [ -f "dist/src/index.js" ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo ""

# ---------------------------------------------------------------------------
# Create Log Directory
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[3/5] Setting up log directory...${NC}"

mkdir -p "$WORKSPACE/logs"
echo -e "${GREEN}✓ Log directory created: $WORKSPACE/logs${NC}"

echo ""

# ---------------------------------------------------------------------------
# Install Launchd Agent
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[4/5] Installing launchd agent...${NC}"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCHD_DIR"

# Copy plist file
cp "$PLIST_FILE" "$LAUNCHD_DEST"

# Load the agent
launchctl unload "$LAUNCHD_DEST" 2>/dev/null || true
launchctl load "$LAUNCHD_DEST"

echo -e "${GREEN}✓ Launchd agent installed${NC}"
echo -e "  Location: $LAUNCHD_DEST"
echo ""

# ---------------------------------------------------------------------------
# Test Startup
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[5/5] Testing startup...${NC}"

"$WORKSPACE/scripts/start-profile-verifier.sh" > /dev/null 2>&1

sleep 3

# Check status
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API server started successfully${NC}"
else
    echo -e "${RED}✗ API server failed to start${NC}"
    echo -e "  Check logs: $WORKSPACE/logs/api-server.log"
fi

echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Installation Complete                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo "The Profile Verifier system will start automatically on system boot."
echo ""
echo "Manual Control:"
echo "  Start:    $WORKSPACE/scripts/start-profile-verifier.sh"
echo "  Stop:     $WORKSPACE/scripts/stop-profile-verifier.sh"
echo "  Status:   $WORKSPACE/scripts/status-profile-verifier.sh"
echo ""
echo "Launchd Agent:"
echo "  Unload:   launchctl unload $LAUNCHD_DEST"
echo "  Load:     launchctl load $LAUNCHD_DEST"
echo "  Restart:  launchctl kickstart -k gui/$(id -u)/com.agenticbro.profile-verifier"
echo ""
echo "Logs:"
echo "  API Server:  $WORKSPACE/logs/api-server.log"
echo "  Gateway:     $WORKSPACE/logs/gateway.log"
echo "  Profile Verifier:  $WORKSPACE/logs/profile-verifier-*.log"
echo ""