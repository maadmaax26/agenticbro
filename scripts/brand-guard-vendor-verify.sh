#!/bin/bash
# Brand Guard — Vendor Phone Verification (bash wrapper for OpenClaw)
# Runs vendor-verify.sh which wraps phone-scan-api.sh with business context
# Usage: bash /workspace/scripts/brand-guard-vendor-verify.sh "+14158586273" US [--vendor "Company Name"] [--context "claiming to be supplier"] [--json]
set -euo pipefail
WORKSPACE="/Users/efinney/.openclaw/workspace"
exec bash "$WORKSPACE/brand-guard/vendor-verify.sh" "$@"