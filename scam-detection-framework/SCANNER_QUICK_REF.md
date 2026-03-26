# Token Impersonation Scanner - Quick Reference

## What It Does

Automatically scans for tokens impersonating legitimate projects by analyzing:
- Symbol and name similarities
- Contract address verification
- Liquidity and volume risks
- Platform-based scam probability

## Quick Start

```bash
# Easy usage with wrapper script
./scripts/scan_token.sh <CONTRACT_ADDRESS>

# Or direct Python usage
python3 scripts/token_impersonation_scanner.py <CONTRACT_ADDRESS>
```

## Example

```bash
./scan_token.sh 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
```

## Output

1. **Formatted Alert** - Ready-to-post scam warning
2. **JSON Report** - Detailed analysis of all tokens
3. **Risk Categories** - High/Medium/Low risk impersonators

## Risk Scoring

- **High Risk (5+ points)**: Exact symbol match, immediate threat
- **Medium Risk (3-4 points)**: Similar names, suspicious patterns  
- **Low Risk (1-2 points)**: Minor similarities, low threat

## Risk Factors

- Exact symbol match: +5 points
- Symbol contains legitimate symbol: +3 points
- Name contains legitimate name: +3 points
- Zero liquidity: +2 points
- Very low liquidity (<$100): +1 point
- Very low volume (<$10): +1 point
- Pump.fun platform: +1 point

## Recent Scan Results (AGNTCBRO)

- **Tokens Analyzed:** 54
- **Suspicious Found:** 34
- **High Risk:** 0
- **Medium Risk:** 19
- **Low Risk:** 15
- **Direct Copies:** 0 ✅

## Integration

### Automatic Database Updates
Parse JSON reports and add to scammer-database.csv

### Social Media Posting
Copy formatted alerts directly to X/Twitter, Telegram

### Regular Monitoring
Schedule automated scans for known tokens

## Files

- **Scanner:** `scripts/token_impersonation_scanner.py`
- **Wrapper:** `scripts/scan_token.sh`
- **Docs:** `scam-detection-framework/TOKEN_IMPERSONATION_SCANNER.md`
- **Reports:** `impersonation_scan_[CONTRACT]_[DATE].json`

## Tips

1. **Scan weekly** for tokens you hold or promote
2. **Scan immediately** if you see suspicious activity
3. **Post alerts** for high/medium risk findings
4. **Update database** with confirmed scammers
5. **Monitor patterns** for impersonation tactics

## Common Use Cases

- **New Token Launch:** Scan for immediate copycats
- **Community Warnings:** Alert followers to impersonators
- **Competitor Analysis:** Check for brand confusion
- **Regular Audits:** Weekly protection scans

---

🔐 **Remember:** Scan first, ape later!