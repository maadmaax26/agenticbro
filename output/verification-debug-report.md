# Chrome CDP Verification Check Debug Report

**Date:** 2026-04-13 15:35 EDT
**Task:** Debug the Chrome CDP verification check in the hybrid X profile scanner
**Status:** Analysis complete, solution provided

---

## Problem Summary

The hybrid scanner (`scan-x-hybrid.sh`) was incorrectly reporting "NOT VERIFIED" for accounts that actually have blue checkmarks. The CDP verification check was failing to detect the verification badge.

---

## Root Cause Analysis

### Issue 1: Incorrect OpenClaw Command Usage

**Problem:** The original script used `openclaw session_send request:browser` which doesn't exist.

**Evidence:**
```
[openclaw] Failed to start CLI: Error: The `openclaw session_send` command is unavailable because `plugins.allow` excludes "session_send".
```

**Impact:** The verification check was never actually running because the command was invalid.

**Solution:** Use the correct OpenClaw browser commands:
- `openclaw browser start` - Start the browser
- `openclaw browser navigate <url>` - Navigate to a URL
- `openclaw browser snapshot --format aria` - Take a snapshot in ARIA format

---

### Issue 2: Browser Infrastructure Not Working

**Problem:** Chrome CDP connection is not established.

**Evidence:**
```
GatewayClientRequestError: INVALID_REQUEST: Error: Could not connect to Chrome in /tmp/chrome-openclaw-final.
Cause: ENOENT: no such file or directory, open '/tmp/chrome-openclaw-final/DevToolsActivePort'
```

**Impact:** Even with correct commands, the browser automation won't work until Chrome is running with remote debugging enabled.

**Solution:** This is an infrastructure issue that needs to be resolved by:
1. Starting Chrome with remote debugging enabled
2. Ensuring the `/tmp/chrome-openclaw-final/DevToolsActivePort` file exists
3. Approving the browser attach prompt when it appears

---

### Issue 3: Single Selector Approach

**Problem:** The original script only tested one selector: `data-testid="icon-verified"`

**Impact:** If X changes their HTML structure or uses different selectors, the verification check will fail.

**Solution:** Test multiple selectors for the verification badge:
1. `data-testid="icon-verified"` - Classic selector
2. `aria-label="Verified"` - Accessibility label
3. `aria-label="Verified account"` - Full accessibility label
4. `aria-label=".*verified.*"` - Pattern match
5. `role="img".*verified` - Role with verification
6. `path.*d="M22.5 12.5c0-1.58"` - Blue checkmark SVG path
7. `Verified account` - Text match

---

## Solution Implemented

### Updated Script: `scan-x-hybrid-v2.sh`

**Key Improvements:**

1. **Correct OpenClaw Commands:**
   - Uses `openclaw browser start` instead of `openclaw session_send request:browser goto`
   - Uses `openclaw browser navigate` instead of `openclaw session_send request:browser goto`
   - Uses `openclaw browser snapshot --format aria` instead of `openclaw session_send request:browser snapshot`

2. **Multiple Selector Testing:**
   - Tests 7 different selectors for the verification badge
   - Falls through selectors until one is found
   - Provides debug output showing which selector worked

3. **Better Error Handling:**
   - Checks if browser start succeeded
   - Checks if navigation succeeded
   - Checks if snapshot was captured
   - Provides detailed debug information at each step

4. **Improved Debug Output:**
   - Shows which selector found the verification badge
   - Shows why verification check failed
   - Saves debug information to the report

---

## Verification Badge Selectors

Based on X's HTML structure, here are the selectors that should be tested:

### Primary Selectors (Most Likely to Work)

1. **`data-testid="icon-verified"`**
   - Classic X/Twitter selector
   - Used in most recent X implementations
   - Most reliable if present

2. **`aria-label="Verified"`**
   - Accessibility label
   - Used for screen readers
   - Should be present on all verified accounts

3. **`aria-label="Verified account"`**
   - Full accessibility label
   - More specific than just "Verified"
   - Less likely to have false positives

### Secondary Selectors (Fallback)

4. **`aria-label=".*verified.*"`**
   - Pattern match for any aria-label containing "verified"
   - Catches variations in labeling
   - May have false positives

5. **`role="img".*verified`**
   - Role attribute with verification
   - Used for SVG icons
   - Less specific but still useful

6. **`path.*d="M22.5 12.5c0-1.58"`**
   - SVG path for blue checkmark
   - Very specific to the verification badge
   - May change if X updates their icon

7. **`Verified account`**
   - Simple text match
   - Least specific
   - May have false positives

---

## Testing Results

### Current Status

**Browser Automation:** ❌ NOT WORKING
- Chrome CDP connection not established
- `/tmp/chrome-openclaw-final/DevToolsActivePort` doesn't exist
- Browser attach prompt not approved

**Verification Check:** ❌ CANNOT TEST
- Cannot test selectors without working browser automation
- Cannot capture snapshots to analyze HTML structure
- Cannot verify which selectors work

**Script Update:** ✅ COMPLETE
- Updated script with correct OpenClaw commands
- Added 7 different selector tests
- Improved error handling and debug output

---

## Next Steps

### Immediate Actions Required

1. **Fix Browser Infrastructure:**
   - Start Chrome with remote debugging enabled
   - Ensure `/tmp/chrome-openclaw-final/DevToolsActivePort` exists
   - Approve browser attach prompt when it appears

2. **Test Updated Script:**
   - Run `scan-x-hybrid-v2.sh` on a known verified account (e.g., @mktgweb3)
   - Run `scan-x-hybrid-v2.sh` on a known unverified account
   - Verify the check works correctly

3. **Verify Selectors:**
   - Test each selector individually
   - Identify which selectors work
   - Remove non-working selectors to improve performance

### Long-term Improvements

1. **Add Selector Caching:**
   - Cache which selector works
   - Use cached selector for future scans
   - Periodically re-test all selectors

2. **Add Fallback to Web Fetch:**
   - If CDP fails, try to extract verification from web fetch
   - Look for "Verified" in the page content
   - Less reliable but better than nothing

3. **Add Manual Verification Option:**
   - Allow user to manually specify verification status
   - Useful when automation fails
   - Improves user experience

---

## Conclusion

The original verification check was failing because:
1. It used incorrect OpenClaw commands (`session_send` instead of `browser`)
2. The browser infrastructure wasn't working (Chrome CDP not connected)
3. It only tested one selector, making it fragile

The updated script (`scan-x-hybrid-v2.sh`) addresses these issues by:
1. Using correct OpenClaw browser commands
2. Testing 7 different selectors for the verification badge
3. Providing better error handling and debug output

However, the verification check cannot be fully tested until the browser infrastructure is fixed. Once Chrome is running with remote debugging enabled, the updated script should work correctly.

---

## Files Updated

1. **`/Users/efinney/.openclaw/workspace/scripts/scan-x-hybrid-v2.sh`**
   - Updated hybrid scanner with correct commands and multiple selectors
   - Ready to test once browser infrastructure is fixed

2. **`/Users/efinney/.openclaw/workspace/output/verification-debug-report.md`**
   - This report documenting the issue and solution

---

## Recommendations

1. **Fix Browser Infrastructure First:**
   - This is a prerequisite for any browser-based verification
   - Without it, the verification check will always fail

2. **Test Updated Script:**
   - Once browser is working, test the updated script
   - Verify it correctly detects verified and unverified accounts

3. **Monitor for X Changes:**
   - X may change their HTML structure
   - Periodically test all selectors
   - Update selectors as needed

4. **Consider Alternative Approaches:**
   - If browser automation continues to be problematic
   - Consider using X API for verification status
   - Or rely more heavily on web fetch pattern analysis

---

**Report completed:** 2026-04-13 15:35 EDT
**Status:** Solution provided, awaiting browser infrastructure fix