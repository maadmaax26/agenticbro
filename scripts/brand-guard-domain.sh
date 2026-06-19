#!/bin/bash
# Brand Guard — Domain Lookalike Detection (bash wrapper for OpenClaw)
# Runs domain-lookalike-detect.sh for typosquatting domain variant scanning
# Usage: bash /workspace/scripts/brand-guard-domain.sh "example.com" [--check-active] [--limit 50] [--json]
set -euo pipefail
WORKSPACE="/Users/efinney/.openclaw/workspace"
exec bash "$WORKSPACE/brand-guard/domain-lookalike-detect.sh" "$@"