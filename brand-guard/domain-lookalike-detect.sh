# Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
# See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
# Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

#!/bin/bash
# Domain Lookalike Detector — Brand Guard by Jeeevs / AgenticBro
# =====================================================================
# Generates typosquatting domain variants and scores them for phishing risk.
# Wraps domain-lookalike-detector.py with website deep scanning integration.
#
# Usage: bash domain-lookalike-detect.sh "example.com" [--check-active] [--limit 50] [--json]
#
# Examples:
#   bash domain-lookalike-detect.sh "agenticbro.app"
#   bash domain-lookalike-detect.sh "acmecorp.com" --check-active --json
#   bash domain-lookalike-detect.sh "mybrand.io" --limit 100 --check-active

set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
BRAND_GUARD="$WORKSPACE/brand-guard"

# ── Parse Arguments ──────────────────────────────────────────────────────────
DOMAIN=""
LIMIT=50
CHECK_ACTIVE=false
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --limit) LIMIT="$2"; shift 2 ;;
        --check-active) CHECK_ACTIVE=true; shift ;;
        --json) JSON_OUTPUT=true; shift ;;
        --help|-h)
            echo "Domain Lookalike Detector — Brand Guard"
            echo ""
            echo "Usage: bash domain-lookalike-detect.sh \"domain.com\" [options]"
            echo ""
            echo "Options:"
            echo "  --limit <n>        Max variants to generate (default: 50)"
            echo "  --check-active     Check DNS and SSL for active domains (slower)"
            echo "  --json             Output as JSON"
            echo "  --help             Show this help"
            echo ""
            echo "Generates typosquatting domain variants and scores them for phishing risk."
            exit 0
            ;;
        *) DOMAIN="$1"; shift ;;
    esac
done

if [[ -z "$DOMAIN" ]]; then
    echo "Error: Domain is required."
    echo "Usage: bash domain-lookalike-detect.sh \"domain.com\" [--check-active] [--json]"
    exit 1
fi

# ── Setup ────────────────────────────────────────────────────────────────────
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SCAN_ID="dl-$(date +%s)-$(openssl rand -hex 4 2>/dev/null || echo $RANDOM)"
RESULTS_DIR="$WORKSPACE/output/domain-lookalike"
mkdir -p "$RESULTS_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 DOMAIN LOOKALIKE DETECTION — Brand Guard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Domain:   $DOMAIN"
echo "📋 Scan ID:  $SCAN_ID"
echo "📋 Time:     $TIMESTAMP"
echo "📋 Check Active: $CHECK_ACTIVE"
echo ""

# ── Step 1: Generate Variants ─────────────────────────────────────────────────
echo "⚙️  Step 1: Generating domain variants..."

CHECK_FLAG=""
if [[ "$CHECK_ACTIVE" == "true" ]]; then
    CHECK_FLAG="--check-active"
fi

VARIANTS_FILE="$RESULTS_DIR/${SCAN_ID}-variants.json"
python3 "$BRAND_GUARD/domain-lookalike-detector.py" "$DOMAIN" --limit "$LIMIT" --json $CHECK_FLAG > "$VARIANTS_FILE" 2>/dev/null

if [[ $? -ne 0 ]] || [[ ! -s "$VARIANTS_FILE" ]]; then
    echo "❌ Error generating domain variants"
    exit 1
fi

VARIANT_COUNT=$(python3 -c "import json; d=json.load(open('$VARIANTS_FILE')); print(d.get('total_variants', 0))")
ACTIVE_COUNT=$(python3 -c "import json; d=json.load(open('$VARIANTS_FILE')); print(d.get('active_domains', 'N/A'))")
echo "   ✅ Generated $VARIANT_COUNT domain variants"
if [[ "$CHECK_ACTIVE" == "true" ]] && [[ "$ACTIVE_COUNT" != "N/A" ]]; then
    echo "   ✅ Found $ACTIVE_COUNT active domains"
fi
echo ""

# ── Step 2: Cross-reference with Scammer Database ────────────────────────────
echo "🔎 Step 2: Cross-referencing with scammer database..."
SCAMMER_MATCHES=0
if [[ -f "$WORKSPACE/scammer-database.csv" ]]; then
    # Check if any variant domains appear in scammer data
    MATCHES=$(grep -ic "$DOMAIN" "$WORKSPACE/scammer-database.csv" 2>/dev/null || echo 0)
    SCAMMER_MATCHES=${MATCHES:-0}
    if [[ "$SCAMMER_MATCHES" -gt 0 ]] 2>/dev/null; then
        echo "   ⚠️  Found $SCAMMER_MATCHES entries in scammer database mentioning '$DOMAIN'"
    else
        echo "   ✅ No scammer database entries for '$DOMAIN'"
    fi
fi
echo ""

# ── Step 3: Output Results ────────────────────────────────────────────────────
if [[ "$JSON_OUTPUT" == "true" ]]; then
    # Add metadata and output JSON
    python3 -c "
import json
with open('$VARIANTS_FILE') as f:
    data = json.load(f)
data['scan_id'] = '$SCAN_ID'
data['scammer_db_matches'] = $SCAMMER_MATCHES
print(json.dumps(data, indent=2))
"
else
    # Pretty print from the variants file
    cat "$VARIANTS_FILE" | python3 -c "
import json, sys
data = json.load(sys.stdin)

print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
print('🔒 DOMAIN LOOKALIKE REPORT')
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
print()
print(f'Domain: {data[\"original_domain\"]}')
print(f'Scan Date: {data[\"scan_date\"]}')
print(f'Total Variants: {data[\"total_variants\"]}')
if 'active_domains' in data:
    print(f'Active Domains: {data[\"active_domains\"]}')
print()

print('RISK SUMMARY:')
summary = data.get('summary', {})
print(f'  🚨 CRITICAL: {summary.get(\"critical\", 0)}')
print(f'  ⚠️  HIGH:    {summary.get(\"high\", 0)}')
print(f'  ℹ️  MEDIUM:  {summary.get(\"medium\", 0)}')
print(f'  ✅ LOW:     {summary.get(\"low\", 0)}')
print(f'  ✅ MINIMAL: {summary.get(\"minimal\", 0)}')
print()

print('TOP THREATS (by risk score):')
variants = data.get('variants', [])
for v in variants[:15]:
    emoji = '🚨' if v['risk_level'] in ['CRITICAL', 'HIGH'] else '⚠️' if v['risk_level'] == 'MEDIUM' else '✅'
    domain = v.get('domain', v.get('variant', 'unknown'))
    print(f'  {emoji} {domain:35s} Score: {v[\"risk_score\"]:3d}/100  Level: {v[\"risk_level\"]:8s}  Type: {v.get(\"variant_type\", \"unknown\")}')
    dns = v.get('dns_info', {})
    if dns and dns.get('resolves'):
        ips = ', '.join(dns.get('ip_addresses', ['unknown'])[:2])
        print(f'     ⚡ ACTIVE — resolves to {ips}')
    for e in v.get('evidence', [])[:2]:
        print(f'     {e}')
print()

print('TAKEDOWN PRIORITY:')
for v in variants[:5]:
    if v.get('takedown_priority') and v['takedown_priority'] != 'Monitor':
        domain = v.get('domain', v.get('variant', 'unknown'))
        print(f'  [{v[\"takedown_priority\"]}] {domain}: {v.get(\"takedown_action\", \"\")}')
print()

print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
print('⚠️ DISCLAIMER: Educational purposes only. Not financial advice.')
print('   Not a guarantee of safety. Always verify independently.')
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
"
fi

echo ""
echo "📁 Results saved to: $VARIANTS_FILE"
echo "🔐 Brand Guard — Monitor your domain, protect your brand!"