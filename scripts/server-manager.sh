#!/usr/bin/env bash
# Local Server Service Manager
# Agentic Bro Backend Server - Port 3001
# This script starts, stops, and monitors the backend server

set -e

# Configuration
PROJECT_DIR="/Users/efinney/.openclaw/workspace/aibro"
SERVER_DIR="$PROJECT_DIR"
LOG_DIR="$PROJECT_DIR/logs"
PID_FILE="$LOG_DIR/server.pid"
LOG_FILE="$LOG_DIR/server.log"
PORT=3001
NODE_ENV="production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure directories exist
mkdir -p "$LOG_DIR"

# Function: Check if server is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        else
            # PID file exists but process not running
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Function: Start server
start_server() {
    echo -e "${BLUE}[INFO]${NC} Starting Agentic Bro backend server..."

    # Check if already running
    if is_running; then
        echo -e "${YELLOW}[WARN]${NC} Server is already running (PID: $(cat $PID_FILE))"
        return 0
    fi

    # Check if node_modules exists
    if [ ! -d "$PROJECT_DIR/node_modules" ]; then
        echo -e "${YELLOW}[WARN]${NC} node_modules not found. Running npm install..."
        cd "$PROJECT_DIR"
        npm install
    fi

    # Change to project directory
    cd "$PROJECT_DIR"

    # Start server in background
    nohup npm run dev > "$LOG_FILE" 2>&1 &
    SERVER_PID=$!

    # Save PID
    echo $SERVER_PID > "$PID_FILE"

    # Wait a moment and check if it started successfully
    sleep 3

    if ps -p $SERVER_PID > /dev/null 2>&1; then
        echo -e "${GREEN}[SUCCESS]${NC} Server started successfully (PID: $SERVER_PID)"
        echo -e "${GREEN}[INFO]${NC} Port: $PORT"
        echo -e "${GREEN}[INFO]${NC} Environment: $NODE_ENV"
        echo -e "${GREEN}[INFO]${NC} Logs: $LOG_FILE"
    else
        echo -e "${RED}[ERROR]${NC} Failed to start server"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Function: Stop server
stop_server() {
    echo -e "${BLUE}[INFO]${NC} Stopping Agentic Bro backend server..."

    if ! is_running; then
        echo -e "${YELLOW}[WARN]${NC} Server is not running"
        return 0
    fi

    PID=$(cat "$PID_FILE")
    echo -e "${BLUE}[INFO]${NC} Killing process $PID..."

    kill $PID 2>/dev/null || true

    # Wait for process to terminate
    for i in {1..10}; do
        if ! ps -p $PID > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    # Force kill if still running
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}[WARN]${NC} Server still running, forcing kill..."
        kill -9 $PID 2>/dev/null || true
        sleep 1
    fi

    rm -f "$PID_FILE"
    echo -e "${GREEN}[SUCCESS]${NC} Server stopped"
}

# Function: Restart server
restart_server() {
    echo -e "${BLUE}[INFO]${NC} Restarting Agentic Bro backend server..."
    stop_server
    sleep 2
    start_server
}

# Function: Check server status
status_server() {
    echo -e "${BLUE}[INFO]${NC} Checking Agentic Bro backend server status..."

    if is_running; then
        PID=$(cat "$PID_FILE")
        echo -e "${GREEN}[RUNNING]${NC} Server is running"
        echo -e "PID: $PID"
        echo -e "Port: $PORT"
        echo -e "Environment: $NODE_ENV"
        echo -e "Logs: $LOG_FILE"

        # Show recent logs
        echo -e "\n${BLUE}[RECENT LOGS]${NC} (last 10 lines):"
        tail -10 "$LOG_FILE" 2>/dev/null || echo "No logs available"
    else
        echo -e "${RED}[STOPPED]${NC} Server is not running"
        echo -e "Port: $PORT"
        echo -e "Logs: $LOG_FILE"
    fi
}

# Function: Monitor server (with auto-restart)
monitor_server() {
    echo -e "${BLUE}[INFO]${NC} Monitoring Agentic Bro backend server (auto-restart enabled)..."
    echo -e "${BLUE}[INFO]${NC} Press Ctrl+C to stop monitoring"

    while true; do
        if ! is_running; then
            echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ${RED}[ALERT]${NC} Server is not running! Attempting to restart..."
            start_server
        else
            # Optional: Log periodic status
            echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}[OK]${NC} Server is running (PID: $(cat $PID_FILE))"
        fi

        # Check every 30 seconds
        sleep 30
    done
}

# Function: Show usage
show_usage() {
    echo "Usage: $0 {start|stop|restart|status|monitor}"
    echo ""
    echo "Commands:"
    echo "  start    Start the backend server"
    echo "  stop     Stop the backend server"
    echo "  restart  Restart the backend server"
    echo "  status   Check server status"
    echo "  monitor  Monitor server and auto-restart if it stops"
    echo ""
    echo "Configuration:"
    echo "  Port: $PORT"
    echo "  Project: $PROJECT_DIR"
    echo "  Logs: $LOG_DIR"
}

# Main script logic
case "${1:-}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        status_server
        ;;
    monitor)
        monitor_server
        ;;
    *)
        show_usage
        exit 1
        ;;
esac

exit 0