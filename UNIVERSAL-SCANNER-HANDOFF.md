# Universal Scanner Handoff Plan

**Deployment Target:** Windows WSL (Windows Subsystem for Linux)  
**Source System:** macOS (Earl's Mac Studio)  
**Created:** April 15, 2026  
**Status:** Ready for Deployment

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Prerequisites](#prerequisites)
4. [Dependencies](#dependencies)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Database Schema](#database-schema)
8. [Usage Guide](#usage-guide)
9. [Testing Procedures](#testing-procedures)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance](#maintenance)
12. [File Reference](#file-reference)

---

## Executive Summary

### What You're Deploying

A **Universal Scam Detection Scanner** that can scan profiles across 5 major platforms:

| Platform | Method | Status |
|----------|--------|--------|
| **TikTok** | Direct HTTP requests | ✅ Implemented |
| **Instagram** | Direct HTTP requests | ✅ Implemented |
| **X/Twitter** | Chrome CDP Browser Automation | ⚠️ Requires Chrome |
| **Telegram** | Web Fetch + Bot API | ✅ Implemented |
| **Facebook** | Chrome CDP Browser Automation | ⚠️ Requires Chrome |

### Key Features

- **Unified 90-point weighted scoring system** for consistent results across platforms
- **Platform-specific red flag detection** tailored to each platform
- **Unified risk score** (0-10 scale) with consistent thresholds
- **Cross-platform comparison** capability
- **CLI and programmatic API** support
- **Comprehensive documentation** and test suite

### Quick Start

```bash
# 1. Install dependencies
cd /path/to/scam-detection-framework
pip install -r requirements.txt

# 2. Run unified scanner
python universal-scanner.py @username --platform tiktok

# 3. Run with auto-detection (detects platform from URL)
python universal-scanner.py "https://www.tiktok.com/@username"

# 4. Batch scan multiple profiles
python universal-scanner.py @user1 @user2 @user3 --platform instagram
```

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Universal Scanner Entry Point                  │
│                          (universal-scanner.py)                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Platform Detection Layer                      │
│                     (Auto-detect platform from URL/username)          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
        │   TikTok      │   │   Instagram   │   │   X/Twitter   │
        │   Scanner     │   │   Scanner      │   │   Scanner     │
        │(Direct HTTP) │   │(Direct HTTP)  │   │(Chrome CDP)   │
        └───────────────┘   └───────────────┘   └───────────────┘
                    │               │               │
        ┌───────────────┐   ┌───────────────┐
        │   Telegram    │   │   Facebook    │
        │   Scanner     │   │   Scanner     │
        │ (Web Fetch)   │   │ (Chrome CDP)  │
        └───────────────┘   └───────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Unified Scoring System                          │
│                    (unified_scoring.py - 90 pts)                      │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Report Generator                               │
│                  (Risk Score + Red Flags + Recommendations)            │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Database (CSV)                                   │
│                  (scammer-database.csv)                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Platform-Specific Implementation Details

#### TikTok Scanner
- **Method:** Direct HTTP requests to `https://www.tiktok.com/@{username}`
- **Data Extracted:** Username, bio, follower count, video count, content
- **Rate Limits:** May be blocked if too many requests
- **Accuracy:** High (real-time data)

#### Instagram Scanner
- **Method:** Direct HTTP requests to `https://www.instagram.com/{username}/`
- **Data Extracted:** Username, bio, follower count, post count, content
- **Rate Limits:** Instagram may block requests (use session cookies if needed)
- **Accuracy:** Medium (may require login for full data)

#### X/Twitter Scanner
- **Method:** Chrome CDP (Chrome DevTools Protocol) browser automation
- **Port:** 18800
- **Data Extracted:** Full profile including join date, verification status
- **Rate Limits:** None (browser automation)
- **Accuracy:** Very High (real-time browser data)
- **Note:** Requires Chrome browser running on WSL (see setup-wsl.sh)

#### Telegram Scanner
- **Method:** Web fetch for public channels, Bot API for private
- **Data Extracted:** Channel info, member count, recent messages
- **Rate Limits:** Bot API limits
- **Accuracy:** Medium (limited to public data)

#### Facebook Scanner
- **Method:** Chrome CDP browser automation
- **Data Extracted:** Page name, followers, posts, content
- **Rate Limits:** Facebook may show login wall
- **Accuracy:** Medium (may require login)

---

## Prerequisites

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **OS** | Windows 10+ with WSL2 | Windows 11 with WSL2 |
| **RAM** | 8 GB | 16 GB |
| **Storage** | 5 GB free | 10 GB free |
| **Python** | 3.8+ | 3.11+ |
| **Node.js** | 18+ | 20+ |
| **Chrome** | 100+ | Latest |

### WSL Requirements

```bash
# Ensure WSL2 is installed
wsl --version

# If not installed, run:
wsl --install

# Restart Windows after installation
```

### Chrome CDP Requirements (for X/Twitter and Facebook)

**Important:** Chrome CDP requires a GUI browser. On WSL, you have two options:

1. **Use Chrome on Windows** (Recommended):
   - Install Chrome on Windows (not in WSL)
   - Start Chrome with remote debugging from Windows
   - Connect from WSL using `localhost:18800`

2. **Use Headless Chrome** (Limited):
   - Install Chrome in WSL
   - Use headless mode with virtual display
   - Limited functionality but works

---

## Dependencies

### Python Packages (requirements.txt)

```txt
# Core dependencies
requests>=2.31.0
beautifulsoup4>=4.12.0
lxml>=4.9.0

# Chrome CDP support
websocket-client>=1.6.0

# Optional enhancements
fake-useragent>=1.4.0
python-dateutil>=2.8.0
```

### System Dependencies

```bash
# Ubuntu/Debian (WSL)
sudo apt update
sudo apt install -y python3-pip python3-venv chromium-browser

# For Chrome CDP
sudo apt install -y xvfb
```

---

## Installation

### Step 1: Clone/Copy Framework Files

```bash
# Create framework directory
mkdir -p ~/scam-detection-framework
cd ~/scam-detection-framework

# Copy files from source (or download)
# Files needed:
# - unified_scoring.py
# - scan-instagram.py
# - tiktok-scan.py
# - universal-scanner.py (NEW - created by this handoff)
# - requirements.txt (NEW)
# - setup-wsl.sh (NEW)
```

### Step 2: Install Python Dependencies

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 3: Run Setup Script

```bash
# Make setup script executable
chmod +x setup-wsl.sh

# Run setup
./setup-wsl.sh
```

### Step 4: Verify Installation

```bash
# Test unified scoring
python test-unified-scoring.py

# Test individual scanners
python universal-scanner.py --test
```

---

## Configuration

### Environment Variables

Create a `.env` file in the framework directory:

```env
# Scanner Configuration
SCANNER_TIMEOUT=30
SCANNER_USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# Chrome CDP Configuration (for X/Twitter, Facebook)
CHROME_CDP_PORT=18800
CHROME_CDP_HOST=localhost
CHROME_PROFILE_DIR=/tmp/chrome-openclaw

# Telegram Bot API (optional)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here

# Database Path
SCAMMER_DATABASE_PATH=/path/to/scammer-database.csv

# Output Configuration
OUTPUT_DIR=/path/to/output/scammer_reports
LOG_LEVEL=INFO
```

### Platform-Specific Configuration

#### TikTok Configuration

```python
# In universal-scanner.py or config file
TIKTOK_CONFIG = {
    "base_url": "https://www.tiktok.com/@{username}",
    "timeout": 15,
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "retry_count": 3,
    "retry_delay": 5
}
```

#### Instagram Configuration

```python
INSTAGRAM_CONFIG = {
    "base_url": "https://www.instagram.com/{username}/",
    "timeout": 15,
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "session_cookies": None,  # Add if needed
    "retry_count": 3,
    "retry_delay": 5
}
```

#### X/Twitter Configuration (Chrome CDP)

```python
TWITTER_CONFIG = {
    "base_url": "https://x.com/{username}",
    "chrome_cdp_port": 18800,
    "chrome_cdp_host": "localhost",
    "timeout": 20,
    "wait_for_load": 5,
    "user_data_dir": "/tmp/chrome-openclaw"
}
```

#### Telegram Configuration

```python
TELEGRAM_CONFIG = {
    "base_url": "https://t.me/{username}",
    "timeout": 15,
    "bot_token": os.getenv("TELEGRAM_BOT_TOKEN"),
    "api_id": os.getenv("TELEGRAM_API_ID"),
    "api_hash": os.getenv("TELEGRAM_API_HASH")
}
```

#### Facebook Configuration (Chrome CDP)

```python
FACEBOOK_CONFIG = {
    "base_url": "https://www.facebook.com/{username}",
    "chrome_cdp_port": 18800,
    "chrome_cdp_host": "localhost",
    "timeout": 20,
    "wait_for_load": 5
}
```

---

## Database Schema

### Scammer Database (CSV)

**File:** `scammer-database.csv`

**Schema:**

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| Scammer Name | String | Display name or identifier | Yes |
| Platform | String | Platform (X, Telegram, TikTok, Instagram, Facebook) | Yes |
| X Handle | String | X/Twitter username (@username) | No |
| Telegram Channel | String | Telegram channel URL | No |
| Victims Count | Integer | Number of known victims | No |
| Total Lost USD | Currency | Estimated total losses | No |
| Verification Level | Enum | LIKELY SAFE, PATTERN MATCHES, UNVERIFIED, HIGH RISK, LEGITIMATE | Yes |
| Scam Type | String | Type of scam (Pump & Dump, Rug Pull, etc.) | No |
| Last Updated | Date | YYYY-MM-DD | Yes |
| Notes | String | Additional information | No |
| Wallet Address | String | Crypto wallet address | No |
| Evidence Links | String | Comma-separated URLs | No |
| Scan Date | Date | Date of last scan | Yes |
| Scanner | String | Scanner method used | Yes |
| Additional Notes | String | Extra notes | No |

### Sync Process

```bash
# Sync database between systems
# Option 1: Git-based sync
cd ~/scam-detection-framework
git pull origin main
# After updates:
git add scammer-database.csv
git commit -m "Update scammer database"
git push origin main

# Option 2: Cloud sync (Dropbox, Google Drive, etc.)
# Use symbolic links:
ln -s ~/Dropbox/scammer-database.csv scammer-database.csv

# Option 3: Scheduled sync (cron)
# Add to crontab:
0 * * * * rsync -avz ~/scam-detection-framework/scammer-database.csv backup-server:/path/to/backup/
```

---

## Usage Guide

### CLI Usage

#### Basic Scanning

```bash
# Scan single profile (auto-detect platform from URL)
python universal-scanner.py "https://www.tiktok.com/@username"

# Scan with explicit platform
python universal-scanner.py @username --platform tiktok
python universal-scanner.py @username --platform instagram
python universal-scanner.py @username --platform x
python universal-scanner.py @username --platform telegram
python universal-scanner.py @username --platform facebook

# Batch scan multiple profiles
python universal-scanner.py @user1 @user2 @user3 --platform tiktok

# Specify output format
python universal-scanner.py @username --platform tiktok --format json
python universal-scanner.py @username --platform tiktok --format markdown
python universal-scanner.py @username --platform tiktok --format csv
```

#### Advanced Options

```bash
# Include detailed red flag breakdown
python universal-scanner.py @username --platform tiktok --verbose

# Save results to file
python universal-scanner.py @username --platform tiktok --output results.json

# Update database after scan
python universal-scanner.py @username --platform tiktok --update-db

# Use Chrome CDP for X/Twitter (requires Chrome running)
python universal-scanner.py @username --platform x --chrome-cdp

# Test mode (no network calls)
python universal-scanner.py --test
```

### Programmatic API Usage

```python
from universal_scanner import UniversalScanner

# Initialize scanner
scanner = UniversalScanner()

# Scan single profile
result = scanner.scan(
    username="example_user",
    platform="tiktok"
)

# Scan with URL (auto-detect platform)
result = scanner.scan_url("https://www.tiktok.com/@example_user")

# Access results
print(f"Risk Score: {result['risk_score']}/10")
print(f"Risk Level: {result['risk_level']}")
print(f"Red Flags: {result['red_flags_detected']}")

# Get detailed flag breakdown
for flag in result['flag_details']:
    print(f"  - {flag['description']} ({flag['weight']} pts)")

# Batch scan
results = scanner.batch_scan(
    usernames=["user1", "user2", "user3"],
    platform="instagram"
)

# Export results
scanner.export_results(results, format="json", output="results.json")
```

### Output Format

#### JSON Output

```json
{
  "scan_id": "SCAN-2026-04-15-001",
  "platform": "tiktok",
  "username": "example_user",
  "url": "https://www.tiktok.com/@example_user",
  "scan_timestamp": "2026-04-15T18:00:00Z",
  "risk_score": 6.7,
  "risk_level": "HIGH",
  "verification_level": "UNVERIFIED",
  "red_flags_detected": 4,
  "flag_details": [
    {
      "flag": "giveaway_airdrop",
      "weight": 20,
      "description": "Free crypto giveaways or airdrops",
      "pattern_matched": "giveaway"
    },
    {
      "flag": "dm_solicitation",
      "weight": 15,
      "description": "Requests to DM for more information",
      "pattern_matched": "dm for"
    }
  ],
  "metadata": {
    "followers": 5000,
    "video_count": 12,
    "account_age_days": 30
  },
  "recommendation": "🔴 Warn - Alert community and investigate further"
}
```

#### Markdown Output

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 TIKTOK PROFILE SCAN — AI POWERED ASSESSMENT

📊 RISK ASSESSMENT:
────────────────────────────────────────────────────────────────────

Risk Score: 6.7/10
Risk Level: HIGH 🔴
Verification: UNVERIFIED
Red Flags: 4

🚨 Red Flags Detected:
   • Free crypto giveaways or airdrops (20 pts)
   • Requests to DM for more information (15 pts)
   • Free money or crypto without clear source (15 pts)
   • Urgency to create FOMO (10 pts)

🔮 Verification: AI Assessment Only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 Warn - Alert community and investigate further

   • Verify information from multiple independent sources
   • Be extremely cautious before any money transfer
   • Do NOT provide personal or financial information

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Testing Procedures

### Automated Tests

```bash
# Run all tests
python -m pytest tests/

# Run specific test file
python test-unified-scoring.py

# Run with verbose output
python test-unified-scoring.py -v

# Run with coverage
pytest --cov=unified_scoring tests/
```

### Manual Testing Checklist

#### Unit Tests

- [ ] Test unified scoring with known scam profiles
- [ ] Test unified scoring with legitimate profiles
- [ ] Test platform-specific flags for each platform
- [ ] Test risk score calculation (0-10 scale)
- [ ] Test risk level assignment (LOW/MEDIUM/HIGH/CRITICAL)

#### Integration Tests

- [ ] Test TikTok scanner with real profiles
- [ ] Test Instagram scanner with real profiles
- [ ] Test X/Twitter scanner with real profiles (requires Chrome CDP)
- [ ] Test Telegram scanner with real channels
- [ ] Test Facebook scanner with real pages (requires Chrome CDP)

#### Cross-Platform Tests

- [ ] Test same profile across platforms
- [ ] Verify consistent scoring
- [ ] Test platform auto-detection
- [ ] Test URL parsing

#### Edge Case Tests

- [ ] Test non-existent profiles
- [ ] Test private profiles
- [ ] Test suspended profiles
- [ ] Test rate limiting
- [ ] Test timeout handling

### Test Cases

```python
# Test Case 1: Known Scam
test_scam = {
    "text": "DM for alpha! Guaranteed 100x returns overnight! Free crypto giveaway - act now!",
    "platform": "instagram",
    "expected_min_score": 8.0,
    "expected_max_score": 10.0,
    "expected_level": "CRITICAL"
}

# Test Case 2: Legitimate Profile
test_legit = {
    "text": "Crypto enthusiast sharing insights and analysis. Educational content about blockchain technology. No financial advice.",
    "platform": "tiktok",
    "expected_min_score": 0.0,
    "expected_max_score": 2.0,
    "expected_level": "LOW"
}

# Test Case 3: Suspicious Profile
test_suspicious = {
    "text": "DM for private alpha signals. Exclusive VIP access. Join now for premium trading signals.",
    "platform": "facebook",
    "expected_min_score": 3.0,
    "expected_max_score": 6.0,
    "expected_level": "MEDIUM"
}
```

---

## Troubleshooting

### Common Issues

#### 1. Chrome CDP Connection Failed

**Error:** `Failed to connect to Chrome CDP at localhost:18800`

**Solution:**

```bash
# Check if Chrome is running with debugging port
curl http://localhost:18800/json/list

# If not, start Chrome with debugging
# On Windows (from PowerShell):
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=18800 --user-data-dir="C:\tmp\chrome-openclaw"

# On WSL (if Chrome installed in WSL):
chromium-browser --remote-debugging-port=18800 --user-data-dir=/tmp/chrome-openclaw
```

#### 2. Instagram Rate Limiting

**Error:** `429 Too Many Requests` from Instagram

**Solution:**

```python
# Add session cookies for authenticated requests
import requests

session = requests.Session()
# Add your Instagram session cookies
session.cookies.set('sessionid', 'your_session_id')
# Use session for requests
response = session.get(url, headers=headers)
```

#### 3. TikTok Blocking Requests

**Error:** TikTok returns empty or error page

**Solution:**

```python
# Rotate user agents
from fake_useragent import UserAgent

ua = UserAgent()
headers = {
    'User-Agent': ua.random
}

# Add random delays between requests
import time
import random
time.sleep(random.randint(5, 15))
```

#### 4. WSL Chrome Issues

**Error:** Chrome won't start in WSL

**Solution:**

```bash
# Option 1: Use Chrome on Windows
# Start Chrome from Windows PowerShell:
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=18800

# Access from WSL:
# Chrome is accessible at localhost:18800 from WSL

# Option 2: Use headless Chrome in WSL
sudo apt install chromium-browser
chromium-browser --headless --disable-gpu --remote-debugging-port=18800
```

#### 5. Database Permission Errors

**Error:** `Permission denied: scammer-database.csv`

**Solution:**

```bash
# Check file permissions
ls -la scammer-database.csv

# Fix permissions
chmod 644 scammer-database.csv

# If owned by root (from sudo)
sudo chown $USER:$USER scammer-database.csv
```

### Debugging Mode

```bash
# Enable verbose logging
python universal-scanner.py @username --platform tiktok --verbose --debug

# Save detailed logs
python universal-scanner.py @username --platform tiktok --log-level DEBUG --log-file scan.log
```

---

## Maintenance

### Regular Maintenance Tasks

#### Daily

```bash
# Update scammer database
git pull origin main

# Run health check
python universal-scanner.py --health-check
```

#### Weekly

```bash
# Run full test suite
python test-unified-scoring.py

# Update Python packages
pip install --upgrade -r requirements.txt

# Clean old output files
find output/ -name "*.json" -mtime +30 -delete
```

#### Monthly

```bash
# Review and update red flag patterns
# Edit unified_scoring.py

# Review and update platform-specific flags
# Edit unified_scoring.py PLATFORM_SPECIFIC_FLAGS

# Archive old scans
tar -czf archives/scans-$(date +%Y%m).tar.gz output/
```

### Updating Red Flag Patterns

Edit `unified_scoring.py`:

```python
# Add new red flag
RED_FLAGS["new_flag"] = {
    "weight": 15,
    "patterns": [
        "new pattern 1",
        "new pattern 2",
        "new pattern 3"
    ],
    "description": "Description of new red flag"
}

# Add platform-specific flag
PLATFORM_SPECIFIC_FLAGS["instagram"]["new_instagram_flag"] = {
    "weight": 10,
    "patterns": ["pattern1", "pattern2"],
    "description": "Description"
}
```

### Adding New Platform

Create new scanner file (e.g., `scan-newplatform.py`):

```python
#!/usr/bin/env python3
"""New Platform Scanner"""

import requests
from unified_scoring import calculate_risk_score, format_scan_result

def scan_newplatform_profile(username: str) -> dict:
    """Scan a New Platform profile and return risks"""
    url = f"https://newplatform.com/{username}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        content = response.text
        
        # Extract metadata
        metadata = {}
        # ... extraction logic ...
        
        # Use unified scoring
        risk_result = calculate_risk_score(
            content,
            platform="newplatform",
            metadata=metadata
        )
        
        return {
            "url": url,
            "error": None,
            **risk_result
        }
    except Exception as e:
        return {
            "url": url,
            "error": str(e),
            "risk_score": 0,
            "risk_level": "ERROR",
            "verification_level": "ERROR"
        }
```

Update `universal-scanner.py` to include new platform:

```python
PLATFORM_SCANNERS = {
    "tiktok": scan_tiktok_profile,
    "instagram": scan_instagram_profile,
    "x": scan_x_profile,
    "telegram": scan_telegram_channel,
    "facebook": scan_facebook_page,
    "newplatform": scan_newplatform_profile  # Add here
}
```

---

## File Reference

### Core Files

| File | Purpose | Size |
|------|---------|------|
| `unified_scoring.py` | Core scoring engine (90-point system) | ~16 KB |
| `universal-scanner.py` | Unified entry point for all platforms | ~10 KB |
| `scan-instagram.py` | Instagram-specific scanner | ~4 KB |
| `tiktok-scan.py` | TikTok-specific scanner | ~4 KB |
| `requirements.txt` | Python dependencies | < 1 KB |
| `setup-wsl.sh` | WSL setup script | ~5 KB |

### Documentation Files

| File | Purpose |
|------|---------|
| `UNIFIED-SCORING-GUIDE.md` | Scoring system documentation |
| `PROFILE_SCAN_METHOD.md` | Profile scanning methodology |
| `TELEGRAM_BOT_SCAM_DETECTION.md` | Telegram bot detection guide |
| `UNIVERSAL-SCANNER-HANDOFF.md` | This handoff document |

### Database Files

| File | Purpose |
|------|---------|
| `scammer-database.csv` | Master database of tracked scammers |
| `output/scanner_reports/` | Directory for scan reports |

---

## Contact & Support

### For Questions About This Handoff

- Review this document thoroughly
- Check the troubleshooting section
- Review `unified_scoring.py` for scoring logic
- Review individual scanner files for platform specifics

### For Technical Issues

1. Check Chrome CDP connection (for X/Facebook)
2. Verify network connectivity
3. Check rate limiting (for Instagram/TikTok)
4. Review error logs
5. Test with `--verbose` flag

### For Scoring Issues

1. Review detected flags in output
2. Check `unified_scoring.py` for weight values
3. Verify pattern matching logic
4. Test with known profiles (scam and legitimate)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-15 | Initial handoff from macOS system |

---

**End of Handoff Document**

**Remember:** Scan first, trust later! 🔐