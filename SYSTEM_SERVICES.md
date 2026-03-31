# Profile Verifier - System Services

Auto-start scripts for Profile Verifier system components on macOS.

---

## Components

1. **Chrome CDP** (Port 18800) - Required for X profile scanning
2. **Agentic Bro API Server** (Port 8080) - Profile verification API
3. **OpenClaw Gateway** (Port 18789) - Agent routing (optional)

---

## Quick Start

### Installation

Run the installation script to set up auto-start:

```bash
cd /Users/efinney/.openclaw/workspace
./scripts/install-profile-verifier.sh
```

This will:
- ✅ Check prerequisites (Node.js, npm)
- ✅ Build Agentic Bro (TypeScript)
- ✅ Install launchd agent for auto-start
- ✅ Test startup
- ✅ Start all services

---

## Manual Control

### Start All Services

```bash
./scripts/start-profile-verifier.sh
```

### Stop All Services

```bash
./scripts/stop-profile-verifier.sh
```

### Check Status

```bash
./scripts/status-profile-verifier.sh
```

---

## Auto-Start on System Boot

The installation script sets up a launchd agent that:
- Starts automatically on system boot
- Restarts if services crash
- Logs output to `~/workspace/logs/`

### Launchd Agent

**Location:** `~/Library/LaunchAgents/com.agenticbro.profile-verifier.plist`

**Manual Control:**

```bash
# Unload (stop auto-start)
launchctl unload ~/Library/LaunchAgents/com.agenticbro.profile-verifier.plist

# Load (enable auto-start)
launchctl load ~/Library/LaunchAgents/com.agenticbro.profile-verifier.plist

# Restart
launchctl kickstart -k gui/$(id -u)/com.agenticbro.profile-verifier

# Check status
launchctl list | grep agenticbro
```

---

## Component Details

### 1. Chrome CDP (Required for X Profile Scanning)

**Port:** 18800

**Purpose:** Chrome DevTools Protocol for extracting X profile data

**How to Start:**

```bash
# Option A: Manual start
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=18800 \
  --user-data-dir=/tmp/chrome-openclaw

# Option B: OpenClaw browser automation
openclaw browser start

# Option C: Keep existing Chrome and add flag
# 1. Quit Chrome
# 2. Open Terminal and run:
#  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
#    --remote-debugging-port=18800
```

**Verify:**

```bash
curl -s http://localhost:18800/json | jq '.'
```

**Note:** Chrome CDP is NOT started by the startup script. You must start Chrome manually or use OpenClaw browser automation.

---

### 2. Agentic Bro API Server

**Port:** 8080

**Purpose:** REST API for profile verification

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1` | API info |
| POST | `/api/v1/verify/profile` | Verify profile |
| POST | `/api/v1/scan/token` | Scan token |

**Health Check:**

```bash
curl http://localhost:8080/health | jq .
```

**API Info:**

```bash
curl http://localhost:8080/api/v1 | jq .
```

**Logs:** `~/workspace/logs/api-server.log`

---

### 3. OpenClaw Gateway

**Port:** 18789

**Purpose:** Agent routing (local-router ↔ agentic-bro)

**Status:**

```bash
openclaw status
```

**Start/Stop:**

```bash
openclaw gateway start
openclaw gateway stop
openclaw gateway restart
```

**Logs:** `~/workspace/logs/gateway.log`

---

## Log Files

All logs are stored in `~/workspace/logs/`:

| Log File | Description |
|----------|-------------|
| `api-server.log` | API server output |
| `api-server.pid` | API server process ID |
| `gateway.log` | Gateway output |
| `profile-verifier-stdout.log` | Launchd agent stdout |
| `profile-verifier-stderr.log` | Launchd agent stderr |

---

## Troubleshooting

### API Server Not Starting

**Check logs:**
```bash
tail -50 ~/workspace/logs/api-server.log
```

**Port in use:**
```bash
lsof -i :8080
```

**Kill existing process:**
```bash
pkill -f "node.*dist/src/index.js"
```

---

### Chrome CDP Not Available

**Verify Chrome is running:**
```bash
curl -s http://localhost:18800/json/version
```

**Start Chrome with CDP:**
```bash
open -a "Google Chrome" --args --remote-debugging-port=18800
```

---

### Gateway Not Running

**Check status:**
```bash
openclaw status
```

**Restart Gateway:**
```bash
openclaw gateway restart
```

---

### Launchd Agent Not Starting

**Check status:**
```bash
launchctl list | grep agenticbro
```

**View logs:**
```bash
tail -50 ~/workspace/logs/profile-verifier-stderr.log
```

**Reload agent:**
```bash
launchctl unload ~/Library/LaunchAgents/com.agenticbro.profile-verifier.plist
launchctl load ~/Library/LaunchAgents/com.agenticbro.profile-verifier.plist
```

---

## Architecture

```
System Boot
    ↓
Launchd Agent
    ↓
start-profile-verifier.sh
    ↓
┌─────────────────────────────────────┐
│  1. Check Chrome CDP (manual start) │
│  2. Start API Server                │
│  3. Start Gateway                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Chrome CDP (18800)                 │
│  API Server (8080)                  │
│  Gateway (18789)                    │
└─────────────────────────────────────┘
    ↓
User Request (Telegram/Webchat)
    ↓
local-router → agentic-bro → ProfileVerifier
    ↓
Chrome CDP → X Profile → Scam Detection
    ↓
Result (0-100 score, risk level)
```

---

## Files

| File | Description |
|------|-------------|
| `scripts/install-profile-verifier.sh` | Installation script (sets up launchd) |
| `scripts/start-profile-verifier.sh` | Start all services |
| `scripts/stop-profile-verifier.sh` | Stop all services |
| `scripts/status-profile-verifier.sh` | Check service status |
| `com.agenticbro.profile-verifier.plist` | Launchd agent configuration |

---

## Next Steps

1. **Install:**
   ```bash
   ./scripts/install-profile-verifier.sh
   ```

2. **Start Chrome CDP:**
   ```bash
   open -a "Google Chrome" --args --remote-debugging-port=18800
   ```

3. **Test API:**
   ```bash
   curl http://localhost:8080/health
   ```

4. **Run tests:**
   ```bash
   cd agentic-bro
   npm test
   ```

---

**Created:** 2026-03-31
**Platform:** macOS (launchd)
**Status:** Ready for production