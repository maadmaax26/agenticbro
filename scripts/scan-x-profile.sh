#!/bin/bash
# X/Twitter Profile Scanner - Wrapper for macOS-compatible scanner
# Usage: scan-x-profile.sh <username>

USERNAME="${1#@}"

if [ -z "$USERNAME" ]; then
    echo "❌ Error: No username provided"
    echo "Usage: $0 <username>"
    echo "Example: $0 Sommy_web3"
    exit 1
fi

# Call the macOS-compatible scanner
exec bash /Users/efinney/.openclaw/workspace/scripts/scan-x-macos.sh "$USERNAME"