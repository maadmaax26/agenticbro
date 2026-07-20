# Scammer Pattern Analysis Report

## Executive Summary

Analysis of 85 known scammers in the database reveals clear patterns that can be used for proactive detection.

---

## 1. Platform Distribution

| Platform | Count | % | Detection Method |
|----------|-------|---|-------------------|
| **Solana Token** | 60 | 71% | DexScreener API |
| **X (Twitter)** | 14 | 16% | Chrome CDP Scan |
| **Telegram** | 6 | 7% | Web Fetch |
| **Base Token** | 3 | 3% | DexScreener API |
| **BSC Token** | 1 | 1% | DexScreener API |

**Key Insight:** 77% of scammers are TOKEN-BASED (detectable via DexScreener API), 23% are PROFILE-BASED (require social scanning).

---

## 2. Token Impersonation Patterns

### Top Impersonated Symbols

| Symbol | Token Count | Pattern |
|--------|-------------|---------|
| **BRO** | 29 | Impersonates AGNTCBRO "Bro" branding |
| **AGENTIC** | 23 | Impersonates "Agentic" AI trend |
| **AGNT** | 12 | Direct AGNTCBRO impersonation |

### Detection Patterns

```
Pattern 1: Symbol Match
- Token uses AGNT, AGENTIC, BRO, AGNTCBRO symbol
- Contract address ≠ legitimate contract
- → HIGH RISK

Pattern 2: Name Similarity  
- Token name contains "Agentic", "Agent", "Bro"
- Symbol doesn't match but creates confusion
- → HIGH RISK

Pattern 3: Zero Liquidity
- Token exists on Pump.fun/DexScreener
- $0 liquidity, no volume
- → HIGH RISK (rug pull potential)
```

---

## 3. Profile Scam Patterns

### X (Twitter) Scammers

| Profile | Scam Type | Key Indicators |
|---------|-----------|----------------|
| LUNA GREY | Pump & Dump | "1000x claims", DM solicitation, Telegram redirect |
| CryptoWhale_ | DM Solicitation | "DM for alpha", multiple token promotion |
| GemHunter100x | Pump & Dump | "100x gains", presale promotion |
| PresaleKing_ | Presale Scam | Fake presale, wallet collection |
| AlphaCalls_ | DM Solicitation | "DM for alpha", generic promises |
| NFTMintFree | Wallet Drainer | "Connect wallet", fake claim page |
| ClaimYourSOL | Wallet Drainer | "Claim your SOL", fake airdrop |

### Telegram Scammers

| Profile | Scam Type | Key Indicators |
|---------|-----------|----------------|
| FreeSolAirdrop | Airdrop Scam | "Free SOL", wallet drainer |
| PresaleAlerts | Presale Scam | Fake presale channel |
| GemAlerts_ | Pump & Dump | Pump group signals |

---

## 4. Proactive Detection Rules

### Token Detection Rules

```
RULE 1: Symbol Impersonation
IF token.symbol IN ['AGNT', 'AGENTIC', 'BRO', 'AGNTCBRO', 'AGENT']
   AND token.contract ≠ LEGITIMATE_CONTRACT
THEN → ADD to database (HIGH RISK)

RULE 2: Name Confusion
IF token.name CONTAINS ['agentic', 'agent bro', 'bro']
   AND token.liquidity < $1000
THEN → ADD to database (HIGH RISK)

RULE 3: Zero Liquidity Pump.fun
IF token.platform = 'pump.fun'
   AND token.liquidity = $0
   AND token.age < 30 days
THEN → FLAG for review (HIGH RISK)

RULE 4: Multi-Chain Same Symbol
IF token.symbol EXISTS on > 3 chains
   AND no legitimate project verified
THEN → ADD to database (HIGH RISK)
```

### Profile Detection Rules

```
RULE 5: DM Solicitation Pattern
IF profile.bio CONTAINS ['DM me', 'DM for', 'check DM', 'sent you DM']
   AND profile.followers < 10000
   AND profile.verified = false
THEN → QUEUE for Chrome CDP scan (HIGH PRIORITY)

RULE 6: Unrealistic Returns
IF profile.recent_posts CONTAINS ['100x', '1000x', 'guaranteed', 'moon']
   AND profile.verified = false
THEN → QUEUE for Chrome CDP scan (HIGH PRIORITY)

RULE 7: Wallet Drainer Pattern
IF profile.posts CONTAINS ['connect wallet', 'claim now', 'free mint', 'claim your']
   AND profile.links CONTAINS unknown_domain
THEN → ADD to database (CRITICAL)

RULE 8: Pump Group Pattern
IF telegram_channel.name CONTAINS ['gem', 'alpha', 'calls', 'signals', 'pump']
   AND channel.member_count < 5000
   AND channel.created_recently
THEN → QUEUE for Telegram scan (HIGH PRIORITY)
```

---

## 5. Automated Discovery Strategy

### Primary Sources (Automated)

| Source | Method | Frequency | Yield |
|--------|--------|-----------|-------|
| **DexScreener API** | Search AGNT/AGENTIC/BRO | Every 4 hours | High |
| **Pump.fun API** | New token monitor | Real-time | Medium |
| **X Search** | Scam keywords | Every 6 hours | Medium |
| **Telegram Groups** | Community reports | Continuous | Low |

### Secondary Sources (Manual/Queued)

| Source | Method | Frequency | Yield |
|--------|--------|-----------|-------|
| **Chrome CDP** | Profile deep-scan | On-demand | High |
| **Community Reports** | User submissions | As received | Medium |
| **Reddit** | r/CryptoScam | Daily | Low |

---

## 6. Implementation Recommendations

### Immediate Actions (High Impact)

1. **DexScreener Monitor** (Already implemented)
   - Search for AGNT, AGENTIC, BRO every 4 hours
   - Auto-add HIGH RISK tokens
   - ✅ Working

2. **X Profile Keywords** (Add to automation)
   - Search: `"DM me for" crypto`, `"100x gains" solana`, `"connect wallet" free`
   - Queue profiles for Chrome CDP scan
   - Priority: HIGH

3. **Telegram Channel Scanner** (Add to automation)
   - Monitor channels with: "gem", "alpha", "calls", "pump"
   - Check for wallet drain patterns
   - Priority: MEDIUM

### Future Enhancements

1. **Real-time Pump.fun Monitor**
   - WebSocket connection to new token events
   - Auto-flag tokens matching impersonation patterns
   - Add to database within minutes of creation

2. **Victim Report Integration**
   - Form on website for scam reports
   - Auto-queue for investigation
   - Priority verification

3. **Chain-Hop Detection**
   - Track tokens that deploy on multiple chains
   - Flag as potential confusion attack
   - Cross-reference with legitimate projects

---

## 7. Confidence Scoring

### Token Scammers: 95%+ Confidence
- Clear pattern matching (symbol/name)
- Objective criteria (contract ≠ legitimate)
- Automated detection reliable

### Profile Scammers: 70-85% Confidence
- Requires verification scan
- Behavioral patterns can be mimicked
- False positive rate higher

### Community Reports: 50-70% Confidence
- Requires investigation
- May be disputes/competitors
- Always verify before adding

---

## 8. Recommendations for `profile-scammer-discovery.py`

Based on this analysis, update the discovery script with:

```python
# Priority 1: Token impersonation (95% confidence)
- Monitor DexScreener every 4 hours
- Search: AGNT, AGENTIC, BRO, AGNTCBRO, AGENT
- Auto-add if symbol matches + different contract

# Priority 2: DM solicitation (80% confidence)  
- X Search: "DM me for" + crypto terms
- Queue for Chrome CDP scan
- Priority score: +15 for DM patterns

# Priority 3: Wallet drainers (95% confidence)
- X Search: "connect wallet" + "claim" + "free"
- Telegram: "airdrop" + "connect wallet"
- Auto-add to HIGH RISK

# Priority 4: Pump groups (70% confidence)
- Telegram: channels with "gem", "alpha", "calls"
- Check for paid promotion patterns
- Queue for investigation
```

---

## Conclusion

The database reveals that **77% of scammers are token impersonators** detectable via API, while **23% are profile-based** requiring social scanning. The most effective proactive detection strategy is:

1. **Continuous DexScreener monitoring** for AGNT/AGENTIC/BRO tokens
2. **X keyword searches** for DM solicitation and wallet drainer patterns  
3. **Chrome CDP verification** of queued profiles
4. **Community reporting** integration for victim reports

This analysis should guide future automation efforts and improve the proactive discovery rate.