#!/bin/bash
# Setup script to install and enable the Agentic Bro backend server service

set -e

PLIST_FILE="$HOME/.openclaw/workspace/agenticbro-backend-server.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
SERVICE_NAME="com.agenticbro.backend-server"

# Create logs directory if it doesn't exist
mkdir -p "$HOME/.openclaw/logs"

echo "🔧 Installing Agentic Bro Backend Server service..."

# Copy plist to LaunchAgents
cp "$PLIST_FILE" "$LAUNCH_AGENTS_DIR/"

echo "✓ Plist file copied to LaunchAgents"

# Load the service
launchctl load "$LAUNCH_AGENTS_DIR/$SERVICE_NAME.plist"

echo "✓ Service loaded with launchctl"

# Start the service
launchctl start "$SERVICE_NAME"

echo "✓ Service started"

echo ""
echo "🎉 Agentic Bro Backend Server service is now installed and running!"
echo ""
echo "Service details:"
echo "  - Name: $SERVICE_NAME"
echo "  - Logs: $HOME/.openclaw/logs/agenticbro-backend-server.log"
echo "  - Errors: $HOME/.openclaw/logs/agenticbro-backend-server.err.log"
echo ""
echo "Management commands:"
echo "  - Start:   launchctl start $SERVICE_NAME"
echo "  - Stop:    launchctl stop $SERVICE_NAME"
echo "  - Restart: launchctl restart $SERVICE_NAME"
echo "  - Status:  launchctl list | grep $SERVICE_NAME"
echo "  - Unload:  launchctl unload $LAUNCH_AGENTS_DIR/$SERVICE_NAME.plist"