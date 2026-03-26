# Token Impersonation Scanner Integration

## Overview

The Token Impersonation Scanner is a powerful tool that automatically detects tokens attempting to impersonate legitimate projects by:
- Analyzing token symbols and names
- Checking for contract address mismatches
- Evaluating liquidity and volume risks
- Identifying suspicious trading patterns

## Usage

### Basic Usage

```bash
python3 scripts/token_impersonation_scanner.py <CONTRACT_ADDRESS>
```

### Example - AGNTCBRO Scan

```bash
python3 scripts/token_impersonation_scanner.py 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
```

### Output

The scanner generates:
1. **Formatted Alert** - Ready-to-post scam warning for social media
2. **Detailed JSON Report** - Complete analysis with all found tokens
3. **Risk Categorization** - High, Medium, and Low risk impersonators

## How It Works

### 1. Token Identification
- Takes legitimate contract address as input
- Fetches token information from DexScreener API
- Extracts symbol, name, and metadata

### 2. Similar Token Search
- Searches for tokens with similar symbols
- Searches for tokens with similar names
- Searches for partial matches and variations

### 3. Risk Analysis
Calculates risk scores based on:
- **Symbol matching** (exact match = 5 points)
- **Name matching** (contains legitimate name = 3 points)
- **Liquidity** ($0 = 2 points, <$100 = 1 point)
- **Volume** (<$10 = 1 point)
- **Platform** (Pump.fun = 1 point)

### 4. Risk Categorization
- **High Risk (5+ points)**: Exact symbol matches, immediate threats
- **Medium Risk (3-4 points)**: Similar names, suspicious patterns
- **Low Risk (1-2 points)**: Minor similarities, low threat
- **Unrelated (0 points)**: No threat detected

## Integration with Scam Detection System

### Adding to Database

After running a scan, add high-risk impersonators to the scammer database:

```bash
# The scanner saves detailed reports as JSON
# Parse the report and add to scammer-database.csv
```

### Automated Alerts

Use the generated alert format for immediate posting:
- Twitter/X posts
- Telegram announcements
- Community warnings

### Regular Scanning

Schedule regular scans to monitor for new impersonators:
- Daily automated scans
- Weekly comprehensive reviews
- Monthly deep analysis

## Alert Format

The scanner generates alerts in this format:

```
🚨 [TOKEN_SYMBOL] SCAM ALERT 🚨

Just completed full scan of [N] tokens - here's what I found:

✅ LEGITIMATE [TOKEN_SYMBOL]: Verified Safe
Contract: [CONTRACT_ADDRESS]
Price: $[PRICE] | Volume: $[VOLUME] | Site: [WEBSITE]

⚠️ [N] SUSPICIOUS TOKENS IDENTIFIED

🚨 HIGH RISK - AVOID:
• [TOKEN_SYMBOL] ([TOKEN_NAME]) - [RISK_FACTORS]
  Contract: [CONTRACT_ADDRESS]

⚠️ MEDIUM RISK:
• [TOKEN_SYMBOL] ([TOKEN_NAME]) - [RISK_FACTOR]

🛡️ PROTECT YOURSELF:
✅ ALWAYS verify contract address
✅ ONLY trust legitimate project links
✅ NEVER buy tokens with $0 liquidity
✅ AVOID similar-but-not-identical names

📊 SCAN RESULTS:
• Tokens analyzed: [N]
• Legitimate: 1 ([TOKEN_SYMBOL])
• Suspicious: [N]
• Direct copies: [N]

⚠️ CRITICAL:
✅ ONLY TRUST: [CONTRACT_ADDRESS]
🚫 Any other contract is NOT [TOKEN_SYMBOL]

🔐 Scan first, ape later!

$[TOKEN_SYMBOL] #ScamDetection #[CHAIN] #CryptoSafety
```

## Example Results

### AGNTCBRO Scan Results
- **Tokens Analyzed:** 54
- **Legitimate:** 1 (AGNTCBRO)
- **Suspicious:** 34
- **High Risk:** 0
- **Medium Risk:** 19
- **Low Risk:** 15
- **Direct Copies:** 0

### Key Findings
- No direct AGNTCBRO contract address copies
- Multiple "agentic" themed tokens (potential confusion)
- Several zero-liquidity tokens (rug pull setups)
- Pump.fun platform tokens (higher scam probability)

## Best Practices

### 1. Regular Scanning
- Scan weekly for known tokens
- Scan daily during high-activity periods
- Monitor new token launches

### 2. Immediate Action
- Post alerts for high-risk findings
- Update scammer database
- Notify community channels

### 3. Documentation
- Save all scan reports
- Track impersonator patterns
- Maintain historical data

### 4. Community Protection
- Share alerts on social media
- Pin warnings in groups
- Educate on verification

## Troubleshooting

### No Results Found
- Check contract address format
- Verify token is listed on DEX
- Ensure DexScreener API is accessible

### API Errors
- Check internet connection
- Verify DexScreener API status
- Try again after rate limit reset

### False Positives
- Review risk factors manually
- Adjust risk scoring thresholds
- Update scanner logic as needed

## File Locations

- **Scanner:** `/workspace/scripts/token_impersonation_scanner.py`
- **Reports:** `/workspace/impersonation_scan_[CONTRACT]_[DATE].json`
- **Database:** `/workspace/scammer-database.csv`
- **Alerts:** `/workspace/x-posts/` and `/workspace/telegram-posts/`

## Future Enhancements

- [ ] Multi-chain support
- [ ] Real-time monitoring
- [ ] Automatic database updates
- [ ] Integration with scam detection dashboard
- [ ] API endpoint for automated scanning
- [ ] Historical trend analysis
- [ ] Machine learning for pattern recognition

## Support

For issues or questions:
1. Check the detailed JSON report
2. Review risk factors and scoring
3. Verify token information manually
4. Cross-reference with other detection tools

---

**Remember:** Scan first, ape later! 🔐