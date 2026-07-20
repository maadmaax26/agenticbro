# Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
# See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
# Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

#!/bin/bash
# Brand Impersonator Detection — Brand Guard by Jeeevs / AgenticBro
# =====================================================================
# Scans all 6 platforms for accounts impersonating a brand.
# Wraps existing scan-source.sh with brand variant generation + similarity scoring.
#
# Usage: bash brand-impersonator-detect.sh "Brand Name" --handle brandhandle [--domain brand.com] [--platforms x,instagram,tiktok] [--limit 20] [--json]
#
# Examples:
#   bash brand-impersonator-detect.sh "Agentic Bro" --handle agenticbro --domain agenticbro.app
#   bash brand-impersonator-detect.sh "Acme Corp" --handle acmecorp --platforms x,instagram --json

set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
BRAND_GUARD="$WORKSPACE/brand-guard"

# ── Parse Arguments ──────────────────────────────────────────────────────────
BRAND_NAME=""
BRAND_HANDLE=""
BRAND_DOMAIN=""
PLATFORMS="x,instagram,tiktok,facebook,telegram,linkedin"
VARIANT_LIMIT=30
JSON_OUTPUT=false
SCAN_RESULTS_DIR="$WORKSPACE/output/brand-guard"

while [[ $# -gt 0 ]]; do
    case $1 in
        --handle) BRAND_HANDLE="$2"; shift 2 ;;
        --domain) BRAND_DOMAIN="$2"; shift 2 ;;
        --platforms) PLATFORMS="$2"; shift 2 ;;
        --limit) VARIANT_LIMIT="$2"; shift 2 ;;
        --json) JSON_OUTPUT=true; shift ;;
        --help|-h)
            echo "Brand Impersonator Detection — Brand Guard"
            echo ""
            echo "Usage: bash brand-impersonator-detect.sh \"Brand Name\" --handle <handle> [options]"
            echo ""
            echo "Options:"
            echo "  --handle <handle>     Brand's primary handle (required)"
            echo "  --domain <domain>    Brand's website domain"
            echo "  --platforms <list>   Platforms to scan (comma-separated, default: all)"
            echo "  --limit <n>          Max variant usernames to scan per platform (default: 30)"
            echo "  --json               Output results as JSON"
            echo "  --help               Show this help"
            echo ""
            echo "Platforms: x, instagram, tiktok, facebook, telegram, linkedin"
            exit 0
            ;;
        *) BRAND_NAME="$1"; shift ;;
    esac
done

if [[ -z "$BRAND_NAME" ]] || [[ -z "$BRAND_HANDLE" ]]; then
    echo "Error: Brand name and handle are required."
    echo "Usage: bash brand-impersonator-detect.sh \"Brand Name\" --handle brandhandle"
    exit 1
fi

# ── Setup ────────────────────────────────────────────────────────────────────
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SCAN_ID="bg-$(date +%s)-$(openssl rand -hex 4 2>/dev/null || echo $RANDOM)"
mkdir -p "$SCAN_RESULTS_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 BRAND GUARD — Impersonator Detection"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Brand:     $BRAND_NAME"
echo "📋 Handle:    @$BRAND_HANDLE"
if [[ -n "$BRAND_DOMAIN" ]]; then
    echo "📋 Domain:    $BRAND_DOMAIN"
fi
echo "📋 Platforms:  $PLATFORMS"
echo "📋 Scan ID:   $SCAN_ID"
echo "📋 Time:      $TIMESTAMP"
echo ""

# ── Step 1: Generate Variants ───────────────────────────────────────────────
echo "⚙️  Step 1: Generating brand variants..."
VARIANTS_JSON="$SCAN_RESULTS_DIR/${SCAN_ID}-variants.json"
python3 "$BRAND_GUARD/brand-variant-generator.py" "$BRAND_NAME" --domain "$BRAND_DOMAIN" --json --limit "$VARIANT_LIMIT" > "$VARIANTS_JSON" 2>/dev/null

if [[ $? -ne 0 ]] || [[ ! -s "$VARIANTS_JSON" ]]; then
    echo "❌ Error generating variants"
    exit 1
fi

# Extract variant count
SOCIAL_COUNT=$(python3 -c "import json; d=json.load(open('$VARIANTS_JSON')); print(d['social_variants']['total'])")
DOMAIN_COUNT=$(python3 -c "import json; d=json.load(open('$VARIANTS_JSON')); print(d['domain_variants']['total'])")
echo "   ✅ Generated $SOCIAL_COUNT social variants, $DOMAIN_COUNT domain variants"
echo ""

# ── Step 2: Scan Platforms for Variants ──────────────────────────────────────
echo "🔍 Step 2: Scanning platforms for impersonator accounts..."
echo ""

# Parse platforms
IFS=',' read -ra PLATFORM_LIST <<< "$PLATFORMS"
TOTAL_SCANNED=0
TOTAL_FOUND=0
SCAN_RESULTS_FILE="$SCAN_RESULTS_DIR/${SCAN_ID}-results.json"
echo '[]' > "$SCAN_RESULTS_FILE"

# Get high-priority variants (scan these first)
HIGH_PRIORITY_VARIANTS=$(python3 -c "
import json
d = json.load(open('$VARIANTS_JSON'))
variants = [v['variant'] for v in d['scan_priority']['high']]
print('\n'.join(variants))
" 2>/dev/null | head -"$VARIANT_LIMIT")

# Also get medium and low priority
MEDIUM_PRIORITY_VARIANTS=$(python3 -c "
import json
d = json.load(open('$VARIANTS_JSON'))
variants = [v['variant'] for v in d['scan_priority']['medium']]
print('\n'.join(variants[:10]))
" 2>/dev/null)

# Combine and deduplicate variants
ALL_VARIANTS=$(echo -e "$HIGH_PRIORITY_VARIANTS\n$MEDIUM_PRIORITY_VARIANTS" | sort -u | head -"$VARIANT_LIMIT")

for PLATFORM in "${PLATFORM_LIST[@]}"; do
    echo "   📡 Scanning $PLATFORM..."
    PLATFORM_COUNT=0
    
    while IFS= read -r VARIANT; do
        [[ -z "$VARIANT" ]] && continue
        
        # Skip exact brand handle (we know it's the real one)
        if [[ "$VARIANT" == "$BRAND_HANDLE" ]]; then
            continue
        fi
        
        PLATFORM_COUNT=$((PLATFORM_COUNT + 1))
        
        # Run scan via existing scan-source.sh
        # Capture output and check if profile exists
        SCAN_OUTPUT=$($WORKSPACE/scripts/scan-source.sh "$PLATFORM" "$VARIANT" 2>/dev/null) || continue
        
        # Check if the scan found a real profile (not just "not found")
        if echo "$SCAN_OUTPUT" | grep -qi "risk\|score\|flag\|warning\|scam\|suspicious"; then
            # Profile exists and was scored — save it
            echo "      ⚠️  Found @$VARIANT on $PLATFORM"
            
            # Run similarity scorer on this result
            echo "$SCAN_OUTPUT" | python3 "$BRAND_GUARD/brand-similarity-scorer.py" \
                --brand "$BRAND_NAME" \
                --handle "$BRAND_HANDLE" \
                --domain "$BRAND_DOMAIN" \
                --json 2>/dev/null >> "$SCAN_RESULTS_FILE.tmp" || true
            
            TOTAL_FOUND=$((TOTAL_FOUND + 1))
        fi
        
        # Rate limiting: small delay between scans
        sleep 1
        
    done <<< "$ALL_VARIANTS"
    
    echo "   ✅ $PLATFORM: Scanned $PLATFORM_COUNT variants"
    TOTAL_SCANNED=$((TOTAL_SCANNED + PLATFORM_COUNT))
done

echo ""
echo "📊 Scan Summary: $TOTAL_SCANNED variants scanned, $TOTAL_FOUND potential impersonators found"
echo ""

# ── Step 3: Cross-Reference Scammer Database ─────────────────────────────────
echo "🔎 Step 3: Cross-referencing with scammer database..."
SCAMMER_MATCHES=0
if [[ -f "$WORKSPACE/scammer-database.csv" ]]; then
    # Search scammer DB for brand name
    MATCHES=$(grep -i "$BRAND_NAME\|$BRAND_HANDLE" "$WORKSPACE/scammer-database.csv" 2>/dev/null | wc -l || echo 0)
    SCAMMER_MATCHES=$MATCHES
    if [[ "$MATCHES" -gt 0 ]]; then
        echo "   ⚠️  Found $MATCHES entries in scammer database mentioning '$BRAND_NAME'"
    else
        echo "   ✅ No known scammer entries for '$BRAND_NAME'"
    fi
fi
echo ""

# ── Step 4: Generate Report ──────────────────────────────────────────────────
echo "📝 Step 4: Generating impersonation report..."

REPORT_FILE="$SCAN_RESULTS_DIR/${SCAN_ID}-report.json"

python3 -c "
import json
from datetime import datetime

# Load variants
try:
    with open('$VARIANTS_JSON') as f:
        variants = json.load(f)
except:
    variants = {}

# Load individual scan results if they exist
results = []
try:
    with open('$SCAN_RESULTS_FILE') as f:
        results = json.load(f)
except:
    pass

report = {
    'scan_id': '$SCAN_ID',
    'scan_date': datetime.utcnow().isoformat() + 'Z',
    'brand': {
        'name': '$BRAND_NAME',
        'handle': '$BRAND_HANDLE',
        'domain': '$BRAND_DOMAIN' or None,
    },
    'summary': {
        'platforms_scanned': '$PLATFORMS'.split(','),
        'variants_generated': variants.get('social_variants', {}).get('total', 0),
        'profiles_scanned': $TOTAL_SCANNED,
        'impersonators_found': $TOTAL_FOUND,
        'scammer_db_matches': $SCAMMER_MATCHES,
    },
    'variants': variants,
    'impersonator_results': results,
    'disclaimer': 'Educational purposes only. Not financial advice. Not a guarantee of safety. Always verify independently.',
}

with open('$REPORT_FILE', 'w') as f:
    json.dump(report, f, indent=2)

# Print summary
if '$JSON_OUTPUT' == 'true':
    print(json.dumps(report, indent=2))
else:
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('🔒 BRAND IMPERSONATION REPORT')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print()
    print(f'Brand: {report[\"brand\"][\"name\"]} (@{report[\"brand\"][\"handle\"]})')
    if report['brand']['domain']:
        print(f'Domain: {report[\"brand\"][\"domain\"]}')
    print(f'Scan ID: {report[\"scan_id\"]}')
    print(f'Scan Date: {report[\"scan_date\"]}')
    print()
    print('RESULTS:')
    print(f'  Platforms Scanned: {len(report[\"summary\"][\"platforms_scanned\"])}')
    print(f'  Variants Generated: {report[\"summary\"][\"variants_generated\"]}')
    print(f'  Profiles Checked: {report[\"summary\"][\"profiles_scanned\"]}')
    print(f'  Impersonators Found: {report[\"summary\"][\"impersonators_found\"]}')
    print(f'  Scammer DB Matches: {report[\"summary\"][\"scammer_db_matches\"]}')
    print()
    
    # Risk summary
    total = report['summary']['impersonators_found'] + report['summary']['scammer_db_matches']
    if total >= 5:
        print('⚠️  RISK LEVEL: CRITICAL — Multiple impersonators detected')
    elif total >= 3:
        print('⚠️  RISK LEVEL: HIGH — Several impersonators detected')
    elif total >= 1:
        print('⚠️  RISK LEVEL: MEDIUM — Some impersonators detected')
    else:
        print('✅ RISK LEVEL: LOW — No significant impersonators found')
    
    print()
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('⚠️  DISCLAIMER: Educational purposes only. Not financial advice.')
    print('   Not a guarantee of safety. Always verify independently.')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
" 2>/dev/null

echo ""
echo "📁 Report saved to: $REPORT_FILE"
echo "📁 Variants saved to: $VARIANTS_JSON"
echo ""
echo "🔐 Brand Guard — Scan first, trust later!"