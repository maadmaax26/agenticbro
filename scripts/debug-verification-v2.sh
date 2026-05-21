#!/usr/bin/env zsh

# Debug script to capture CDP snapshot and inspect verification badge
# Uses correct OpenClaw browser commands

USERNAME="${1#@}"
PROFILE_URL="https://x.com/${USERNAME}"
DEBUG_DIR="/Users/efinney/.openclaw/workspace/output/debug-verification"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

mkdir -p "$DEBUG_DIR"

echo "🔍 Debugging verification check for: @$USERNAME"
echo "🔗 URL: $PROFILE_URL"
echo ""

# Start browser if not running
echo "🚀 Starting browser..."
openclaw browser start 2>/dev/null || true
sleep 2

# Navigate to profile
echo "📡 Navigating to profile..."
openclaw browser navigate "$PROFILE_URL" 2>/dev/null || true
sleep 3

# Take snapshot (default format is ai, but let's try aria for accessibility tree)
echo "📸 Taking CDP snapshot (aria format)..."
SNAPSHOT=$(openclaw browser snapshot --format aria 2>/dev/null || echo "")

# Save full snapshot
echo "$SNAPSHOT" > "$DEBUG_DIR/snapshot_aria_${USERNAME}_${TIMESTAMP}.txt"
echo "✅ ARIA snapshot saved to: $DEBUG_DIR/snapshot_aria_${USERNAME}_${TIMESTAMP}.txt"

# Also take AI format snapshot
echo "📸 Taking CDP snapshot (ai format)..."
SNAPSHOT_AI=$(openclaw browser snapshot 2>/dev/null || echo "")
echo "$SNAPSHOT_AI" > "$DEBUG_DIR/snapshot_ai_${USERNAME}_${TIMESTAMP}.txt"
echo "✅ AI snapshot saved to: $DEBUG_DIR/snapshot_ai_${USERNAME}_${TIMESTAMP}.txt"

# Extract and test different selectors
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 TESTING VERIFICATION SELECTORS (ARIA FORMAT)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: data-testid="icon-verified"
echo "Test 1: data-testid=\"icon-verified\""
if echo "$SNAPSHOT" | grep -q 'data-testid="icon-verified"'; then
    echo "   ✅ FOUND"
    echo "$SNAPSHOT" | grep -o 'data-testid="icon-verified"[^>]*>' | head -1 > "$DEBUG_DIR/selector1_${USERNAME}_${TIMESTAMP}.txt"
else
    echo "   ❌ NOT FOUND"
fi
echo ""

# Test 2: svg[aria-label="Verified"]
echo "Test 2: svg[aria-label=\"Verified\"]"
if echo "$SNAPSHOT" | grep -q 'aria-label="Verified"'; then
    echo "   ✅ FOUND"
    echo "$SNAPSHOT" | grep -o 'aria-label="Verified"[^>]*>' | head -1 > "$DEBUG_DIR/selector2_${USERNAME}_${TIMESTAMP}.txt"
else
    echo "   ❌ NOT FOUND"
fi
echo ""

# Test 3: Look for any SVG with "verified" in aria-label
echo "Test 3: Any SVG with 'verified' in aria-label"
if echo "$SNAPSHOT" | grep -qi 'aria-label=".*verified.*"'; then
    echo "   ✅ FOUND"
    echo "$SNAPSHOT" | grep -i 'aria-label=".*verified.*"' | head -3 > "$DEBUG_DIR/selector3_${USERNAME}_${TIMESTAMP}.txt"
else
    echo "   ❌ NOT FOUND"
fi
echo ""

# Test 4: Look for blue checkmark patterns
echo "Test 4: Blue checkmark patterns (path d=...)"
if echo "$SNAPSHOT" | grep -qi 'path.*d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6'; then
    echo "   ✅ FOUND (classic blue checkmark path)"
    echo "$SNAPSHOT" | grep -i 'path.*d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6' | head -1 > "$DEBUG_DIR/selector4_${USERNAME}_${TIMESTAMP}.txt"
else
    echo "   ❌ NOT FOUND"
fi
echo ""

# Test 5: Look for any verification-related text
echo "Test 5: Verification-related text in snapshot"
if echo "$SNAPSHOT" | grep -qi 'verified|verification|blue.*check'; then
    echo "   ✅ FOUND"
    echo "$SNAPSHOT" | grep -iE 'verified|verification|blue.*check' | head -5 > "$DEBUG_DIR/selector5_${USERNAME}_${TIMESTAMP}.txt"
else
    echo "   ❌ NOT FOUND"
fi
echo ""

# Test 6: Extract all aria-labels from the page
echo "Test 6: All aria-labels found in snapshot"
echo "$SNAPSHOT" | grep -o 'aria-label="[^"]*"' | sort -u > "$DEBUG_DIR/all_aria_labels_${USERNAME}_${TIMESTAMP}.txt"
echo "   Found $(wc -l < "$DEBUG_DIR/all_aria_labels_${USERNAME}_${TIMESTAMP}.txt") unique aria-labels"
echo ""

# Test 7: Look for the header section where verification badge should be
echo "Test 7: Header section extraction"
if echo "$SNAPSHOT" | grep -qi 'header.*UserDescription'; then
    echo "   ✅ FOUND header section"
    echo "$SNAPSHOT" | grep -iA 20 'header.*UserDescription' | head -25 > "$DEBUG_DIR/header_section_${USERNAME}_${TIMESTAMP}.txt"
else
    echo "   ❌ NOT FOUND"
fi
echo ""

# Test 8: Look for "Verified account" text
echo "Test 8: Looking for 'Verified account' text"
if echo "$SNAPSHOT" | grep -qi 'Verified account'; then
    echo "   ✅ FOUND"
    echo "$SNAPSHOT" | grep -i 'Verified account' | head -3 > "$DEBUG_DIR/selector8_${USERNAME}_${TIMESTAMP}.txt"
else
    echo "   ❌ NOT FOUND"
fi
echo ""

# Test 9: Look for any role="img" with verification-related content
echo "Test 9: role=\"img\" elements"
if echo "$SNAPSHOT" | grep -qi 'role="img"'; then
    echo "   ✅ FOUND"
    echo "$SNAPSHOT" | grep -i 'role="img"' | head -10 > "$DEBUG_DIR/selector9_${USERNAME}_${TIMESTAMP}.txt"
else
    echo "   ❌ NOT FOUND"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEBUG COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Debug files saved to: $DEBUG_DIR"
echo ""
echo "Review the following files:"
echo "  - snapshot_aria_${USERNAME}_${TIMESTAMP}.txt (ARIA format)"
echo "  - snapshot_ai_${USERNAME}_${TIMESTAMP}.txt (AI format)"
echo "  - all_aria_labels_${USERNAME}_${TIMESTAMP}.txt (all aria-labels)"
echo "  - header_section_${USERNAME}_${TIMESTAMP}.txt (header section)"
echo ""