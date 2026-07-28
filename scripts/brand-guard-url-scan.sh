#!/bin/bash
# Brand Guard — URL Threat Scanner (JS Detonation Analysis)
# =====================================================================
# Wraps cdp-url-scan.py for Brand Guard domain threat checks.
# Scans a URL in headless Chrome and detects in-memory malware,
# wallet drainers, and malicious JavaScript patterns.
#
# Usage: bash brand-guard-url-scan.sh <url> [--json] [--timeout 30]
# Example: bash brand-guard-url-scan.sh https://suspicious-site.com --json
#
# Used by Brand Guard when a domain needs deep JS analysis beyond
# typosquatting/SSL checks.

set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
exec python3 "$WORKSPACE/scripts/cdp-url-scan.py" "$@"