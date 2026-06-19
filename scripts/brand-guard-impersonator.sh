#!/bin/bash
# Brand Guard — Impersonator Scan (bash wrapper for OpenClaw)
# Runs brand-impersonator-detect.sh which wraps scan-source.sh
# Usage: bash /workspace/scripts/brand-guard-impersonator.sh "Brand Name" --handle brandhandle [--domain brand.com] [--platforms x,instagram] [--json]
set -euo pipefail
WORKSPACE="/Users/efinney/.openclaw/workspace"
exec bash "$WORKSPACE/brand-guard/brand-impersonator-detect.sh" "$@"