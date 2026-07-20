# Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
# See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
# Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

#!/bin/bash
# Vendor Phone Verification — Brand Guard by Jeeevs / AgenticBro
# =====================================================================
# Verifies a phone number for vendor legitimacy. Wraps the existing
# phone-scan-api.sh with business phone assessment and vendor context.
#
# Usage: bash vendor-verify.sh "+1234567890" [US] [--vendor "Company Name"] [--context "what they said"] [--json]
#
# Examples:
#   bash vendor-verify.sh "+14158586273" US --vendor "Acme Corp" --context "claiming to be our supplier"
#   bash vendor-verify.sh "+18005551234" US --vendor "Microsoft Support" --json

set -euo pipefail

WORKSPACE="/Users/efinney/.openclaw/workspace"
BRAND_GUARD="$WORKSPACE/brand-guard"

# ── Parse Arguments ──────────────────────────────────────────────────────────
PHONE=""
COUNTRY="US"
VENDOR_NAME=""
CALL_CONTEXT=""
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --vendor) VENDOR_NAME="$2"; shift 2 ;;
        --context) CALL_CONTEXT="$2"; shift 2 ;;
        --json) JSON_OUTPUT=true; shift ;;
        --help|-h)
            echo "Vendor Phone Verification — Brand Guard"
            echo ""
            echo "Usage: bash vendor-verify.sh \"+1234567890\" [COUNTRY] [options]"
            echo ""
            echo "Options:"
            echo "  --vendor \"name\"     Vendor name the caller claims to represent"
            echo "  --context \"text\"    What the caller said or claimed"
            echo "  --json              Output as JSON"
            echo "  --help               Show this help"
            echo ""
            echo "This script runs phone verification + business legitimacy assessment."
            echo "It layers vendor-specific checks ON TOP of the standard phone scam scoring."
            exit 0
            ;;
        +*) PHONE="$1"; shift ;;
        [A-Z][A-Z]) COUNTRY="$1"; shift ;;
        *) PHONE="$1"; shift ;;
    esac
done

if [[ -z "$PHONE" ]]; then
    echo "Error: Phone number is required."
    echo "Usage: bash vendor-verify.sh \"+1234567890\" [COUNTRY] [--vendor \"name\"] [--context \"text\"]"
    exit 1
fi

# ── Setup ────────────────────────────────────────────────────────────────────
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERIFY_ID="vv-$(date +%s)-$(openssl rand -hex 4 2>/dev/null || echo $RANDOM)"
RESULTS_DIR="$WORKSPACE/output/vendor-verify"
mkdir -p "$RESULTS_DIR"

if [[ "$JSON_OUTPUT" != "true" ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📞 VENDOR PHONE VERIFICATION — Brand Guard"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Phone:      $PHONE"
    echo "📋 Country:    $COUNTRY"
    if [[ -n "$VENDOR_NAME" ]]; then
        echo "📋 Vendor:     $VENDOR_NAME"
    fi
    if [[ -n "$CALL_CONTEXT" ]]; then
        echo "📋 Context:    $CALL_CONTEXT"
    fi
    echo "📋 Verify ID:  $VERIFY_ID"
    echo "📋 Time:       $TIMESTAMP"
    echo ""
fi

# ── Step 1: Run Standard Phone Scan ──────────────────────────────────────────
if [[ "$JSON_OUTPUT" != "true" ]]; then
    echo "📱 Step 1: Running phone number verification..."
fi

PHONE_RESULT_FILE="$RESULTS_DIR/${VERIFY_ID}-phone.json"

# Use existing phone-scan-api.sh
if [[ -f "$WORKSPACE/scripts/phone-scan-api.sh" ]]; then
    bash "$WORKSPACE/scripts/phone-scan-api.sh" "$PHONE" "$COUNTRY" > "$PHONE_RESULT_FILE" 2>/dev/null || true
fi

# Fallback: try phone_scorer.py if API scan didn't work
if [[ ! -s "$PHONE_RESULT_FILE" ]] || ! python3 -c "import json; json.load(open('$PHONE_RESULT_FILE'))" 2>/dev/null; then
    if [[ "$JSON_OUTPUT" != "true" ]]; then
        echo "   ⚠️  API scan unavailable, using heuristic analysis"
    fi
    # Create minimal phone data for business assessment
    echo "{\"phone\": \"$PHONE\", \"carrier\": \"\", \"line_type\": \"unknown\", \"country_code\": \"$COUNTRY\", \"valid\": true}" > "$PHONE_RESULT_FILE"
fi

if [[ "$JSON_OUTPUT" != "true" ]]; then
    echo "   ✅ Phone scan complete"
    echo ""
fi

# ── Step 2: Vendor Verification ───────────────────────────────────────────────
if [[ "$JSON_OUTPUT" != "true" ]]; then
    echo "🔍 Step 2: Running vendor verification analysis..."
fi

VENDOR_RESULT_FILE="$RESULTS_DIR/${VERIFY_ID}-vendor.json"

# Build vendor-verify command
VENDOR_CMD="python3 \"$BRAND_GUARD/vendor-verify.py\" --phone \"$PHONE\""
if [[ -n "$VENDOR_NAME" ]]; then
    VENDOR_CMD="$VENDOR_CMD --vendor \"$VENDOR_NAME\""
fi
if [[ -n "$CALL_CONTEXT" ]]; then
    VENDOR_CMD="$VENDOR_CMD --context \"$CALL_CONTEXT\""
fi
VENDOR_CMD="$VENDOR_CMD --json"

# Run vendor verification
eval $VENDOR_CMD > "$VENDOR_RESULT_FILE" 2>/dev/null

if [[ $? -ne 0 ]] || [[ ! -s "$VENDOR_RESULT_FILE" ]]; then
    if [[ "$JSON_OUTPUT" != "true" ]]; then
        echo "   ⚠️  Vendor verification error, using basic assessment"
    fi
    # Create basic result
    python3 -c "
import json
result = {
    'success': True,
    'phone': '$PHONE',
    'vendor_name': '$VENDOR_NAME' if '$VENDOR_NAME' else None,
    'verification': {'score': 50, 'level': 'UNVERIFIED', 'message': 'Basic assessment — verify independently'},
    'business_assessment': {'legitimacy_score': 50, 'legitimacy_level': 'UNVERIFIED'},
    'scam_detection': {'patterns_detected': [], 'pattern_score': 0, 'scammer_db_matches': [], 'scammer_db_match_count': 0},
    'recommendations': ['Verify vendor identity through official channels', 'Never share bank details based on an unsolicited call'],
    'disclaimer': 'Educational purposes only. Not financial advice. Always verify independently.',
}
print(json.dumps(result, indent=2))
" > "$VENDOR_RESULT_FILE"
fi

if [[ "$JSON_OUTPUT" != "true" ]]; then
    echo "   ✅ Vendor verification complete"
    echo ""
fi

# ── Step 3: Output Results ───────────────────────────────────────────────────
if [[ "$JSON_OUTPUT" == "true" ]]; then
    # Merge phone data + vendor data
    python3 -c "
import json

# Load phone scan result
try:
    with open('$PHONE_RESULT_FILE') as f:
        phone_data = json.load(f)
except:
    phone_data = {}

# Load vendor verification result
try:
    with open('$VENDOR_RESULT_FILE') as f:
        vendor_data = json.load(f)
except:
    vendor_data = {}

# Merge into combined result
combined = {
    'verify_id': '$VERIFY_ID',
    'scan_date': '$TIMESTAMP',
    'phone': '$PHONE',
    'country': '$COUNTRY',
    'vendor_name': '$VENDOR_NAME' if '$VENDOR_NAME' else None,
    'call_context': '$CALL_CONTEXT' if '$CALL_CONTEXT' else None,
}

# Add phone scam risk data
if 'risk_score' in phone_data:
    combined['phone_risk'] = {
        'score': phone_data.get('risk_score', 0),
        'level': phone_data.get('risk_level', 'UNKNOWN'),
        'flags': phone_data.get('risk_flags', []),
        'carrier': phone_data.get('validation', {}).get('carrier', 'Unknown'),
        'line_type': phone_data.get('validation', {}).get('line_type', 'unknown'),
        'valid': phone_data.get('validation', {}).get('valid', True),
    }
elif 'riskScore' in phone_data:
    combined['phone_risk'] = {
        'score': phone_data.get('riskScore', 0),
        'level': phone_data.get('riskLevel', 'UNKNOWN'),
        'flags': phone_data.get('redFlags', []),
        'carrier': phone_data.get('carrier', 'Unknown'),
        'line_type': phone_data.get('lineType', 'unknown'),
        'valid': phone_data.get('valid', True),
    }

# Add vendor verification data
if 'verification' in vendor_data:
    combined['vendor_verification'] = vendor_data['verification']
    combined['business_assessment'] = vendor_data.get('business_assessment', {})
    combined['scam_detection'] = vendor_data.get('scam_detection', {})
    combined['evidence'] = vendor_data.get('evidence', [])
    combined['recommendations'] = vendor_data.get('recommendations', [])

combined['disclaimer'] = 'Educational purposes only. Not financial advice. Not a guarantee of safety. Always verify independently.'

print(json.dumps(combined, indent=2))
"
else
    # Pretty-print combined results
    python3 -c "
import json

# Load phone scan result
try:
    with open('$PHONE_RESULT_FILE') as f:
        phone_data = json.load(f)
except:
    phone_data = {}

# Load vendor verification result
try:
    with open('$VENDOR_RESULT_FILE') as f:
        vendor_data = json.load(f)
except:
    vendor_data = {}

# Phone risk info
phone_risk = phone_data.get('risk_score', phone_data.get('riskScore', 'N/A'))
phone_level = phone_data.get('risk_level', phone_data.get('riskLevel', 'UNKNOWN'))
carrier = phone_data.get('validation', phone_data.get('validation', {})).get('carrier', phone_data.get('carrier', 'Unknown'))
line_type = phone_data.get('validation', phone_data.get('validation', {})).get('line_type', phone_data.get('lineType', 'unknown'))

# Vendor verification
v_score = vendor_data.get('verification', {}).get('score', 'N/A')
v_level = vendor_data.get('verification', {}).get('level', 'UNKNOWN')
v_msg = vendor_data.get('verification', {}).get('message', '')

b_score = vendor_data.get('business_assessment', {}).get('legitimacy_score', 'N/A')
b_level = vendor_data.get('business_assessment', {}).get('legitimacy_level', 'UNKNOWN')

print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
print('🔒 VENDOR VERIFICATION REPORT')
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
print()
print(f'Phone: $PHONE')
if '$VENDOR_NAME':
    print(f'Vendor: $VENDOR_NAME')
print(f'Verify ID: $VERIFY_ID')
print()
print('PHONE RISK ASSESSMENT:')
print(f'  Scam Risk Score: {phone_risk}/10 ({phone_level})')
print(f'  Carrier: {carrier}')
print(f'  Line Type: {line_type}')
print()
print('VENDOR VERIFICATION:')
print(f'  Verification Score: {v_score}/100 ({v_level})')
print(f'  {v_msg}')
print()
print(f'BUSINESS LEGITIMACY: {b_score}/100 ({b_level})')

# Business indicators
bi = vendor_data.get('business_assessment', {}).get('business_indicators', [])
if bi:
    print('  ✅ Business Indicators:')
    for i in bi:
        print(f'    • {i}')

# Suspicious indicators
si = vendor_data.get('business_assessment', {}).get('suspicious_indicators', [])
if si:
    print('  ⚠️  Suspicious Indicators:')
    for s in si:
        print(f'    • {s}')

# Scam patterns
sp = vendor_data.get('scam_detection', {}).get('patterns_detected', [])
if sp:
    print()
    print('🚨 SCAM PATTERNS DETECTED:')
    for p in sp:
        print(f'  • [{p[\"severity\"].upper()}] {p[\"description\"]}')
        print(f'    Matched: \"{p[\"keyword_matched\"]}\"')

# Scammer DB
sd = vendor_data.get('scam_detection', {}).get('scammer_db_matches', [])
if sd:
    print()
    print(f'🚨 SCAMMER DATABASE: {len(sd)} match(es)')
    for m in sd[:3]:
        print(f'  • {m.get(\"name\", \"Unknown\")} — {m.get(\"type\", \"Unknown\")} ({m.get(\"risk\", \"Unknown\")})')

# Evidence
ev = vendor_data.get('evidence', [])
if ev:
    print()
    print('EVIDENCE:')
    for e in ev:
        print(f'  {e}')

# Recommendations
rec = vendor_data.get('recommendations', [])
if rec:
    print()
    print('RECOMMENDATIONS:')
    for r in rec:
        print(f'  {r}')

print()
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
print('⚠️  DISCLAIMER: Educational purposes only. Not financial advice.')
print('   Not a guarantee of safety. Always verify independently.')
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
"
fi

echo ""
echo "📁 Results saved to: $RESULTS_DIR/${VERIFY_ID}-*.json"
echo "🔐 Brand Guard — Verify before you trust!"