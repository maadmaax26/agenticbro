#!/bin/bash
# Scam Detection Automation Wrapper
# Runs the automation loop with proper environment

cd /Users/efinney/.openclaw/workspace

# Ensure directories exist
mkdir -p output/scan_queue
mkdir -p output/scan_reports

# Run automation
python3 scripts/scam-automation-loop.py "$@"