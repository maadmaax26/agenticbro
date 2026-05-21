#!/usr/bin/env zsh

# Test if OpenClaw browser commands work

echo "Testing OpenClaw browser commands..."
echo ""

# Test 1: Check if browser command exists
echo "Test 1: Does 'openclaw browser' exist?"
if command -v openclaw &> /dev/null; then
    echo "   ✅ openclaw command exists"
    openclaw browser --help | head -5
else
    echo "   ❌ openclaw command not found"
fi
echo ""

# Test 2: Try to get browser status
echo "Test 2: Get browser status"
openclaw browser status 2>&1 | head -10
echo ""

# Test 3: Try to start browser
echo "Test 3: Start browser"
timeout 10 openclaw browser start 2>&1 || echo "   Timed out or failed"
echo ""

# Test 4: Check browser status again
echo "Test 4: Check browser status after start attempt"
openclaw browser status 2>&1 | head -10
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TEST COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"