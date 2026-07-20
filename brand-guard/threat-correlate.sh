# Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
# See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
# Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

#!/bin/bash
# Cross-Channel Threat Correlation — Brand Guard by Jeeevs / AgenticBro
# =====================================================================
# Links threats across social media, phone, domains, and wallet addresses
# into unified threat profiles. Cross-references the scammer database.
#
# Usage: bash threat-correlate.sh "Brand Name" --handle brandhandle [--domain brand.com] [--input results.json] [--json]
#
# Examples:
#   bash threat-correlate.sh "Agentic Bro" --handle agenticbro --domain agenticbro.app
#   bash threat-correlate.sh "Acme Corp" --handle acmecorp --input full-scan.json --json

set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
BRAND_GUARD="$WORKSPACE/brand-guard"

# ── Parse Arguments ──────────────────────────────────────────────────────────
BRAND_NAME=""
BRAND_HANDLE=""
BRAND_DOMAIN=""
INPUT_FILE=""
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --handle) BRAND_HANDLE="$2"; shift 2 ;;
        --domain) BRAND_DOMAIN="$2"; shift 2 ;;
        --input) INPUT_FILE="$2"; shift 2 ;;
        --json) JSON_OUTPUT=true; shift ;;
        --help|-h)
            echo "Cross-Channel Threat Correlation — Brand Guard"
            echo ""
            echo "Usage: bash threat-correlate.sh \"Brand Name\" --handle <handle> [options]"
            echo ""
            echo "Options:"
            echo "  --handle <handle>   Brand's primary handle (required)"
            echo "  --domain <domain>  Brand's website domain"
            echo "  --input <file>     JSON file with scan results from other Brand Guard features"
            echo "  --json             Output as JSON"
            echo "  --help             Show this help"
            echo ""
            echo "This script cross-references scan results across all channels and"
            echo "generates unified threat profiles with aggregate risk scores."
            exit 0
            ;;
        *) BRAND_NAME="$1"; shift ;;
    esac
done

if [[ -z "$BRAND_NAME" ]] || [[ -z "$BRAND_HANDLE" ]]; then
    echo "Error: Brand name and handle are required."
    echo "Usage: bash threat-correlate.sh \"Brand Name\" --handle brandhandle"
    exit 1
fi

# ── Setup ────────────────────────────────────────────────────────────────────
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
THREAT_ID="TC-$(date +%s)-$(openssl rand -hex 4 2>/dev/null || echo $RANDOM)"
RESULTS_DIR="$WORKSPACE/output/threat-correlate"
mkdir -p "$RESULTS_DIR"

if [[ "$JSON_OUTPUT" != "true" ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔗 CROSS-CHANNEL THREAT CORRELATION — Brand Guard"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Brand:      $BRAND_NAME"
    echo "📋 Handle:     @$BRAND_HANDLE"
    if [[ -n "$BRAND_DOMAIN" ]]; then
        echo "📋 Domain:    $BRAND_DOMAIN"
    fi
    echo "📋 Threat ID:  $THREAT_ID"
    echo "📋 Time:       $TIMESTAMP"
    echo ""
fi

# ── Step 1: Run Brand Impersonator Detection ─────────────────────────────────
if [[ "$JSON_OUTPUT" != "true" ]]; then
    echo "🔍 Step 1: Running brand impersonator detection..."
fi
IMPERSONATOR_FILE="$RESULTS_DIR/${THREAT_ID}-impersonator.json"
bash "$BRAND_GUARD/brand-impersonator-detect.sh" "$BRAND_NAME" --handle "$BRAND_HANDLE" --domain "$BRAND_DOMAIN" --platforms "x" --limit 10 --json > "$IMPERSONATOR_FILE" 2>/dev/null || true

# Also capture impersonator stdout in JSON mode (it may print banners — suppress)
if [[ "$JSON_OUTPUT" == "true" ]]; then
    bash "$BRAND_GUARD/brand-impersonator-detect.sh" "$BRAND_NAME" --handle "$BRAND_HANDLE" --domain "$BRAND_DOMAIN" --platforms "x" --limit 10 --json > /dev/null 2>&1 || true
fi

if [[ -s "$IMPERSONATOR_FILE" ]] && python3 -c "import json; json.load(open('$IMPERSONATOR_FILE'))" 2>/dev/null; then
    IMPERSONATOR_COUNT=$(python3 -c "import json; d=json.load(open('$IMPERSONATOR_FILE')); print(d.get('summary',{}).get('impersonators_found','N/A'))" 2>/dev/null || echo "0")
    if [[ "$JSON_OUTPUT" != "true" ]]; then
        echo "   ✅ Found $IMPERSONATOR_COUNT potential impersonator(s) on X"
    fi
else
    IMPERSONATOR_COUNT=0
    if [[ "$JSON_OUTPUT" != "true" ]]; then
        echo "   ⚠️  Impersonator scan skipped (no results)"
    fi
fi

# ── Step 2: Run Domain Lookalike Detection ───────────────────────────────────
if [[ -n "$BRAND_DOMAIN" ]]; then
    if [[ "$JSON_OUTPUT" != "true" ]]; then
        echo "🔍 Step 2: Running domain lookalike detection..."
    fi
    DOMAIN_FILE="$RESULTS_DIR/${THREAT_ID}-domain.json"
    python3 "$BRAND_GUARD/domain-lookalike-detector.py" "$BRAND_DOMAIN" --limit 30 --json > "$DOMAIN_FILE" 2>/dev/null || true
    
    if [[ -s "$DOMAIN_FILE" ]] && python3 -c "import json; json.load(open('$DOMAIN_FILE'))" 2>/dev/null; then
        DOMAIN_COUNT=$(python3 -c "import json; d=json.load(open('$DOMAIN_FILE')); print(d.get('total_variants','N/A'))" 2>/dev/null || echo "0")
        ACTIVE_COUNT=$(python3 -c "import json; d=json.load(open('$DOMAIN_FILE')); print(d.get('active_domains','N/A'))" 2>/dev/null || echo "0")
        if [[ "$JSON_OUTPUT" != "true" ]]; then
            echo "   ✅ Found $DOMAIN_COUNT domain variants ($ACTIVE_COUNT active)"
        fi
    else
        DOMAIN_COUNT=0
        ACTIVE_COUNT=0
        if [[ "$JSON_OUTPUT" != "true" ]]; then
            echo "   ⚠️  Domain scan skipped (no results)"
        fi
    fi
else
    DOMAIN_COUNT=0
    ACTIVE_COUNT=0
fi

# ── Step 3: Cross-Channel Correlation ─────────────────────────────────────────
if [[ "$JSON_OUTPUT" != "true" ]]; then
    echo "🔗 Step 3: Cross-referencing across channels..."
fi

# Build combined input for correlation engine
CORRELATION_INPUT="$RESULTS_DIR/${THREAT_ID}-input.json"
python3 -c "
import json

# Load impersonator results
try:
    with open('$IMPERSONATOR_FILE') as f:
        imp_data = json.load(f)
    social_results = imp_data.get('impersonator_results', [])
except:
    social_results = []

# Load domain results
domain_results = []
try:
    with open('$DOMAIN_FILE') as f:
        dom_data = json.load(f)
    domain_results = dom_data.get('variants', [])
except:
    pass

combined = {
    'social_results': social_results,
    'domain_results': domain_results,
    'phone_results': [],
}

with open('$CORRELATION_INPUT', 'w') as f:
    json.dump(combined, f, indent=2)
" 2>/dev/null

# Run correlation
CORRELATION_FILE="$RESULTS_DIR/${THREAT_ID}-correlation.json"
python3 "$BRAND_GUARD/threat-correlate.py" --brand "$BRAND_NAME" --handle "$BRAND_HANDLE" --domain "$BRAND_DOMAIN" --input "$CORRELATION_INPUT" --threat-id "$THREAT_ID" --json > "$CORRELATION_FILE" 2>/dev/null

if [[ "$JSON_OUTPUT" == "true" ]]; then
    # Output ONLY the correlation JSON to stdout — nothing else
    if [[ -s "$CORRELATION_FILE" ]] && python3 -c "import json; json.load(open('$CORRELATION_FILE'))" 2>/dev/null; then
        cat "$CORRELATION_FILE"
    else
        # Fallback: output minimal JSON with no findings
        python3 -c "
import json
print(json.dumps({
    'threat_id': '$THREAT_ID',
    'scan_date': '$TIMESTAMP',
    'brand': {'name': '$BRAND_NAME', 'handle': '$BRAND_HANDLE', 'domain': '$BRAND_DOMAIN'},
    'summary': {
        'aggregate_risk_score': 0,
        'aggregate_risk_level': 'LOW',
        'threat_type': 'none_detected',
        'channels_with_threats': 0,
        'total_linked_entities': 0,
        'scammer_db_matches': 0,
        'takedown_actions': 0
    },
    'risk_profile': {'evidence': []},
    'linked_entities': [],
    'takedown_recommendations': []
}))
"
    fi
else
    # Human-readable output
    if [[ -s "$CORRELATION_FILE" ]] && python3 -c "import json; json.load(open('$CORRELATION_FILE'))" 2>/dev/null; then
        # Pretty print the correlation results
        python3 -c "
import json
with open('$CORRELATION_FILE') as f:
    d = json.load(f)

s = d.get('summary', {})
print()
print(f'AGGREGATE RISK: {s.get(\"aggregate_risk_score\", \"N/A\")}/10 — {s.get(\"aggregate_risk_level\", \"UNKNOWN\")}')
print(f'Threat Type: {s.get(\"threat_type\", \"N/A\")}')
print(f'Channels with Threats: {s.get(\"channels_with_threats\", 0)}')
print(f'Linked Entities: {s.get(\"total_linked_entities\", 0)}')
print(f'Scammer DB Matches: {s.get(\"scammer_db_matches\", 0)}')
print(f'Takedown Actions: {s.get(\"takedown_actions\", 0)}')
print()

rp = d.get('risk_profile', {})
if rp.get('evidence'):
    print('EVIDENCE:')
    for e in rp['evidence']:
        print(f'  {e}')
    print()

le = d.get('linked_entities', [])
if le:
    print('LINKED ENTITIES:')
    for entity in le[:10]:
        print(f'  {entity[\"type\"]:10s}: {entity[\"value\"]:35s} ({entity[\"link_type\"]})')
    print()

td = d.get('takedown_recommendations', [])
if td:
    print('TAKEDOWN RECOMMENDATIONS:')
    for rec in td[:8]:
        print(f'  [{rec[\"priority\"]}] {rec[\"platform\"]:12s}: {rec[\"action\"]} → {rec[\"target\"]}')
"
    else
        echo "   ⚠️  Correlation engine error"
    fi
    
    echo ""
    echo "📁 Results saved to: $RESULTS_DIR/${THREAT_ID}-*.json"
    echo ""
    echo "🔐 Brand Guard — Verify trust before you act!"
fi