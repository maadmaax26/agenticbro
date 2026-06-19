#!/bin/bash
# Brand Guard — Cross-Channel Threat Correlation (bash wrapper for OpenClaw)
# Runs threat-correlate.sh which links threats across social, phone, domains
# Usage: bash /workspace/scripts/brand-guard-threat-correlate.sh "Brand Name" --handle brandhandle [--domain brand.com] [--input results.json] [--json]
set -euo pipefail
WORKSPACE="/Users/efinney/.openclaw/workspace"
exec bash "$WORKSPACE/brand-guard/threat-correlate.sh" "$@"