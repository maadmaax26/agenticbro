# Telegram Bot Scam Detection - Feature #8

**Date:** March 28, 2026  
**Feature:** Telegram Bot Scam Detection  
**Purpose:** Identify and flag scam Telegram bots that steal crypto, impersonate legitimate services, or trick users

---

## 📊 Overview

**What:** Detect and flag scam Telegram bots that impersonate legitimate services, request crypto, or trick users into connecting wallets

**Current State:** System scans X/Twitter profiles, Telegram channels, Facebook pages
**Enhancement:** Add Telegram bot scanning capability

**Scam Types Detected:**
1. **Impersonation Bots** - Fake bots pretending to be legitimate services
2. **Wallet Drainer Bots** - Bots that request wallet connection to drain funds
3. **Giveaway Scam Bots** - Fake giveaway bots that request crypto deposits
4. **Support Scam Bots** - Fake support bots that request sensitive info
5. **Airdrop Scam Bots** - Fake airdrop bots that steal wallet access
6. **Investment Scam Bots** - Bots that promise guaranteed returns

---

## 🔍 Telegram Bot Scam Patterns

### 1. Impersonation Bots

**What:** Bots pretending to be legitimate services (Binance, Solana, Phantom, etc.)

**Red Flags:**
- Username similar but not identical to official bot
- Missing verification badge (if applicable)
- Requests for crypto deposits
- Asks for private keys or seed phrases
- Urgency tactics ("act now", "limited time")

**Example:**
```
@Binance_Support_Bot (FAKE)
@Solana_Airdrop_Bot (FAKE)
@Phantom_Wallet_Support (FAKE)

vs.

@BinanceBot (OFFICIAL)
@SolanaOfficialBot (OFFICIAL)
```

### 2. Wallet Drainer Bots

**What:** Bots that request wallet connection to steal funds

**Red Flags:**
- **🚨 Asks for private key or seed phrase** (CRITICAL +12)
- **🚨 Asks for wallet.json file** (CRITICAL +10)
- **🚨 Asks for recovery phrase or mnemonic phrase** (CRITICAL +12)
- **🚨 Requests signing transactions** (CRITICAL +8)
- Asks to "verify" wallet
- Asks to connect wallet
- Requests wallet file access
- Requests full wallet export

**Example:**
```
Bot: "Connect your wallet to verify your tokens"
Bot: "Enter your seed phrase to secure your account"
Bot: "Sign this transaction to claim your airdrop"
```

### 3. Giveaway Scam Bots

**What:** Fake giveaway bots that request crypto deposits

**Red Flags:**
- "Send 1 SOL, receive 2 SOL back"
- "Double your crypto" offers
- Requires minimum deposit
- "First 100 participants" urgency
- No official announcement link

**Example:**
```
Bot: "🎁 SOLANA GIVEAWAY 🎁
Send 1-10 SOL to participate
Receive 2-20 SOL back instantly!
Limited to first 100 participants"
```

### 4. Support Scam Bots

**What:** Fake support bots that request sensitive info

**Red Flags:**
- Unsolicited contact
- Asks for password, email, or 2FA
- Requests wallet access
- Asks for KYC documents
- Requires payment for "support"

**Example:**
```
Bot: "Hello! This is Binance Support.
We detected suspicious activity on your account.
Please provide your email and password to secure your account."
```

### 5. Airdrop Scam Bots

**What:** Fake airdrop bots that steal wallet access

**Red Flags:**
- Requires wallet connection
- Asks for private key to "receive" airdrop
- Requires gas fee payment
- No official project announcement
- "Exclusive" or "limited" airdrops

**Example:**
```
Bot: "🌟 EXCLUSIVE AIRDROP 🌟
You've been selected for a 1000 SOL airdrop!
Connect your wallet to claim.
Hurry - expires in 24 hours!"
```

### 6. Investment Scam Bots

**What:** Bots that promise guaranteed returns on crypto investments

**Red Flags:**
- Guaranteed returns (e.g., "5% daily")
- Minimum investment required
- VIP tiers for "premium" returns
- Pool trading investments
- Referral commissions

**Example:**
```
Bot: "💰 INVESTMENT OPPORTUNITY 💰
Earn 5% daily on your SOL investment!
Minimum investment: 10 SOL
Premium tier: 10% daily (50 SOL minimum)
Join our VIP group for exclusive signals!"
```

---

## 🛠️ Detection Algorithm

### Step 1: Identify Bot Type

```javascript
function identifyBotType(botData) {
  const botTypes = {
    impersonation: checkImpersonation(botData),
    walletDrainer: checkWalletDrainer(botData),
    giveaway: checkGiveaway(botData),
    support: checkSupport(botData),
    airdrop: checkAirdrop(botData),
    investment: checkInvestment(botData)
  };
  
  return Object.entries(botTypes)
    .filter(([type, isMatch]) => isMatch)
    .map(([type]) => type);
}
```

### Step 2: Check for Impersonation

```javascript
function checkImpersonation(botData) {
  const legitimateBots = [
    '@BinanceBot',
    '@SolanaOfficialBot',
    '@PhantomWalletBot',
    '@CoinbaseBot',
    '@UniswapBot',
    '@MetamaskBot',
    '@OpenSeaBot',
    '@MagicEdenBot'
  ];
  
  // Check if bot name is similar to legitimate bot
  for (const official of legitimateBots) {
    const similarity = calculateSimilarity(botData.username, official);
    if (similarity > 0.8 && botData.username !== official) {
      return true; // Likely impersonation
    }
  }
  
  // Check for support/admin suffix
  if (botData.username.includes('_Support') || 
      botData.username.includes('_Admin') ||
      botData.username.includes('_Official')) {
    return true; // Support bots are often scams
  }
  
  return false;
}
```

### Step 3: Check for Wallet Draining

```javascript
function checkWalletDrainer(botData) {
  // CRITICAL: Private key and seed phrase requests
  const criticalKeywords = [
    'private key',
    'seed phrase',
    'mnemonic phrase',
    'recovery phrase',
    'wallet.json',
    'full wallet export'
  ];

  const botText = `${botData.description} ${botData.welcomeMessage}`.toLowerCase();

  // Check for CRITICAL keywords (immediate red flag)
  for (const keyword of criticalKeywords) {
    if (botText.includes(keyword)) {
      return {
        isDrainer: true,
        reason: `Critical keyword detected: "${keyword}"`,
        score: 12 // Maximum weight for private key requests
      };
    }
  }

  // Check for wallet-related requests
  const drainKeywords = [
    'connect wallet',
    'sign transaction',
    'verify wallet'
  ];

  for (const keyword of drainKeywords) {
    if (botText.includes(keyword)) {
      return {
        isDrainer: true,
        reason: `Wallet request detected: "${keyword}"`,
        score: 8 // Lower score for general wallet requests
      };
    }
  }

  return false;
}
```

### Step 4: Check for Giveaway Scam

```javascript
function checkGiveaway(botData) {
  const giveawayKeywords = [
    'send',
    'receive back',
    'double your',
    'giveaway',
    'first',
    'participants',
    'limited time',
    'bonus'
  ];
  
  const botText = `${botData.description} ${botData.welcomeMessage}`.toLowerCase();
  
  // Check for "send X, receive Y" pattern
  const sendReceivePattern = /send\s+(\d+\.?\d*)\s+\w+.*receive\s+(\d+\.?\d*)\s+\w+/i;
  if (sendReceivePattern.test(botText)) {
    return true;
  }
  
  // Check for giveaway keywords
  let keywordCount = 0;
  for (const keyword of giveawayKeywords) {
    if (botText.includes(keyword)) {
      keywordCount++;
    }
  }
  
  return keywordCount >= 3; // 3+ giveaway keywords = likely scam
}
```

### Step 5: Check for Support Scam

```javascript
function checkSupport(botData) {
  const supportKeywords = [
    'support',
    'help desk',
    'customer service',
    'verify account',
    'suspicious activity',
    'secure account',
    'account locked',
    'password',
    '2fa',
    'kyc'
  ];
  
  const botText = `${botData.description} ${botData.welcomeMessage}`.toLowerCase();
  
  // Check for support-related keywords
  for (const keyword of supportKeywords) {
    if (botText.includes(keyword)) {
      // Check for requests for sensitive info
      if (botText.includes('password') || 
          botText.includes('email') ||
          botText.includes('2fa') ||
          botText.includes('kyc')) {
        return true;
      }
    }
  }
  
  return false;
}
```

### Step 6: Check for Airdrop Scam

```javascript
function checkAirdrop(botData) {
  const airdropKeywords = [
    'airdrop',
    'claim',
    'free tokens',
    'exclusive',
    'selected',
    'connect wallet',
    'gas fee',
    'limited'
  ];
  
  const botText = `${botData.description} ${botData.welcomeMessage}`.toLowerCase();
  
  let keywordCount = 0;
  for (const keyword of airdropKeywords) {
    if (botText.includes(keyword)) {
      keywordCount++;
    }
  }
  
  // Check for wallet connection + airdrop = likely scam
  if (keywordCount >= 3 && botText.includes('connect wallet')) {
    return true;
  }
  
  return false;
}
```

### Step 7: Check for Investment Scam

```javascript
function checkInvestment(botData) {
  const investmentKeywords = [
    'guaranteed returns',
    'daily profit',
    'investment',
    'vip tier',
    'pool trading',
    'referral commission',
    'minimum investment',
    'premium returns'
  ];
  
  const botText = `${botData.description} ${botData.welcomeMessage}`.toLowerCase();
  
  let keywordCount = 0;
  for (const keyword of investmentKeywords) {
    if (botText.includes(keyword)) {
      keywordCount++;
    }
  }
  
  // Check for guaranteed returns = definite scam
  if (botText.includes('guaranteed') && botText.includes('returns')) {
    return true;
  }
  
  // Check for daily profit promises
  const dailyProfitPattern = /\d+%?\s+daily/i;
  if (dailyProfitPattern.test(botText)) {
    return true;
  }
  
  return keywordCount >= 3;
}
```

---

## 📊 Risk Scoring

### Red Flags & Weights

| Red Flag | Weight | Description |
|----------|--------|-------------|
| **Impersonation** | +10 | Bot name similar to official bot |
| **Wallet Draining - Private Key** | +12 | Requests private key or seed phrase (CRITICAL) |
| **Wallet Draining - General** | +8 | Requests wallet connection or signing |
| **Giveaway Scam** | +8 | "Send X, receive Y" pattern |
| **Support Scam** | +7 | Requests password, 2FA, or KYC |
| **Airdrop Scam** | +7 | Airdrop + wallet connection |
| **Investment Scam** | +9 | Guaranteed returns or daily profit |
| **Unverified Bot** | +5 | No verification badge (if applicable) |
| **New Bot** | +4 | Created < 30 days ago |
| **Urgency Tactics** | +6 | "Limited time", "Act now", "First 100" |
| **Requests Crypto** | +10 | Asks to send crypto to address |
| **No Official Link** | +3 | No link to official website/announcement |

### Risk Score Calculation

```javascript
function calculateRiskScore(botData, redFlags) {
  const baseScore = 0;
  
  // Add red flag weights
  const redFlagScore = redFlags.reduce((sum, flag) => sum + flag.weight, 0);
  
  // Normalize to 0-10 scale (based on max possible score of ~70)
  const normalizedScore = (redFlagScore / 70) * 10;
  
  return Math.min(Math.round(normalizedScore * 10) / 10, 10);
}
```

### Risk Levels

| Risk Score | Risk Level | Action |
|------------|------------|--------|
| **0-3** | LOW | Verify bot is legitimate |
| **3-5** | MEDIUM | Exercise caution, verify official link |
| **5-7** | HIGH | Do not interact, report to Telegram |
| **7-10** | CRITICAL | Avoid interaction, warn community |

---

## 🎯 Example Scans

### Example 1: Legitimate Bot

**Bot:** @BinanceBot (Official)

**Expected Result:**
```
🔍 Telegram Bot Scan: @BinanceBot

Bot Type: Exchange Bot
Risk Score: 0/10 (NO RISK)
Risk Level: LOW
Verification Status: OFFICIAL

Key Findings:
• ✅ Verified official Binance bot
• ✅ No red flags detected
• ✅ Official website link present
• ✅ No requests for sensitive info
• ✅ Clear purpose and functionality

Recommendation: ✅ LEGITIMATE OFFICIAL BOT

$AGNTCBRO #ScamDetection #TelegramSafety
```

### Example 2: Wallet Drainer Bot (Private Key Request)

**Bot:** @Solana_Wallet_Airdrop_Bot (FAKE)

**Expected Result:**
```
🔍 Telegram Bot Scan: @Solana_Wallet_Airdrop_Bot (CRITICAL RISK)

Bot Type: Wallet Drainer Bot
Risk Score: 10/10 (CRITICAL RISK)
Risk Level: CRITICAL
Verification Status: UNVERIFIED

Red Flags Detected (2):
• 🚨 CRITICAL: Requests private key (+12)
• 🚨 CRITICAL: Requests recovery phrase (+12)

Key Findings:
• Bot claims to offer exclusive airdrop
• "Enter your seed phrase to secure your account"
• "Please provide your private key for verification"
• "Recovery phrase required to claim SOL airdrop"
• Created 3 days ago (very new)
• No verification badge
• No official Solana announcement link

🚨 CRITICAL ALERT: DO NOT INTERACT!

This bot is actively requesting your private key or seed phrase - this is an immediate scam!

• Do not provide ANY sensitive information
• Do not connect your wallet
• Do not send any SOL
• Report to Telegram (@notoscam)
• Block bot immediately
• Warn community about this bot

$AGNTCBRO #ScamDetection #TelegramSafety
```

---

### Example 3: Impersonation Bot

**Bot:** @Binance_Support_Bot (Fake)

**Expected Result:**
```
🔍 Telegram Bot Scan: @Binance_Support_Bot (FAKE)

Bot Type: Impersonation Bot
Risk Score: 9.5/10 (CRITICAL RISK)
Risk Level: CRITICAL
Verification Status: UNVERIFIED

Red Flags Detected (5):
• 🚨 Impersonation of BinanceBot (+10)
• ⚠️ Unverified bot (+5)
• ⚠️ Support bot suffix (+4)
• ⚠️ Requests password and 2FA (+7)
• ⚠️ Urgency tactics: "Act now" (+6)

Key Findings:
• Username similar to official BinanceBot
• Not verified by Telegram
• Requests sensitive info (password, 2FA)
• No official Binance link
• Uses support scam tactics

Recommendation: 🚨 CRITICAL RISK - Do not interact!
• Do not provide any information
• Report to Telegram (@notoscam)
• Warn others in community
• Block bot immediately

$AGNTCBRO #ScamDetection #TelegramSafety
```

### Example 3: Giveaway Scam Bot

**Bot:** @Solana_Giveaway_Bot (Fake)

**Expected Result:**
```
🔍 Telegram Bot Scan: @Solana_Giveaway_Bot (SCAM)

Bot Type: Giveaway Scam Bot
Risk Score: 8.0/10 (HIGH RISK)
Risk Level: HIGH
Verification Status: UNVERIFIED

Red Flags Detected (4):
• 🚨 Giveaway scam: "Send SOL, receive double" (+8)
• ⚠️ Unverified bot (+5)
• ⚠️ Urgency tactics: "First 100 participants" (+6)
• ⚠️ Requests crypto deposit (+10)

Key Findings:
• Classic "send X, receive Y" scam pattern
• No official Solana announcement link
• Requests SOL deposit
• Urgency tactics to pressure quick decisions
• Bot created 2 weeks ago

Recommendation: 🚨 HIGH RISK - Do not send crypto!
• This is a classic giveaway scam
• Report to Telegram (@notoscam)
• Warn community about this bot
• Do not deposit any SOL

$AGNTCBRO #ScamDetection #TelegramSafety
```

---

## 📝 Bot Data Extraction

### How to Extract Bot Data

```javascript
async function extractBotData(botUsername) {
  // Method 1: Use web_fetch for public bot pages
  const botPageUrl = `https://t.me/${botUsername}`;
  const botPage = await web_fetch(botPageUrl);
  
  // Extract bot information
  const botData = {
    username: botUsername,
    name: extractName(botPage),
    description: extractDescription(botPage),
    welcomeMessage: extractWelcomeMessage(botPage),
    memberCount: extractMemberCount(botPage),
    createdAt: estimateCreationDate(botPage),
    verified: checkVerification(botPage),
    officialLink: extractOfficialLink(botPage),
    commands: extractCommands(botPage)
  };
  
  return botData;
}
```

### Data Points to Extract

| Data Point | Description | How to Extract |
|------------|-------------|----------------|
| **Username** | Bot username | Direct from URL |
| **Name** | Bot display name | From page title |
| **Description** | Bot description | From meta description |
| **Welcome Message** | First message from bot | From page content |
| **Member Count** | Number of users | If visible |
| **Created** | Creation date | Estimated from activity |
| **Verified** | Verification status | Check for badge |
| **Official Link** | Link to official site | From description |
| **Commands** | Bot commands | From page content |

---

## 🚨 CRITICAL: Private Key Detection (NEW)

### Why This Matters

**PRIVATE KEYS AND SEED PHRASES = IMMINENT LOSS OF FUNDS**

Any Telegram bot requesting your private key, seed phrase, or recovery phrase is **immediately flagged as CRITICAL RISK**. There is no legitimate reason for a bot to ask for this information.

### Detection Rules

**CRITICAL Keywords (IMMEDIATE RED FLAG):**
- "private key"
- "seed phrase"
- "mnemonic phrase"
- "recovery phrase"
- "wallet.json"
- "full wallet export"
- "all your tokens"

**If ANY of these are detected, bot is flagged as CRITICAL RISK regardless of other factors.**

### Example: Immediate Action Required

```
🔍 Telegram Bot Scan: @Crypto_Scam_Bot (CRITICAL RISK)

🚨 CRITICAL ALERT: PRIVATE KEY REQUEST DETECTED

Bot says: "Enter your seed phrase to verify your tokens"

Risk Score: 10/10 (CRITICAL RISK)
Reason: Bot is requesting private key/seed phrase - IMMEDIATE SCAM

🚨 DO NOT INTERACT - LOSS IMMINENT

This bot will drain your wallet. Block immediately.
Report: @notoscam
```

### No Exceptions

**NEVER trust a bot that asks for:**
- ✅ Private key
- ✅ Seed phrase/mnemonic
- ✅ Recovery phrase
- ✅ wallet.json file
- ✅ Full wallet export
- ✅ "All your tokens"

**Even if the bot claims to be:**
- Exchange support
- Wallet service
- Airdrop provider
- Security verification
- Government agency

**These are ALL scams.**

---

## 🔧 Integration with Scam Detection

### Add to Scam Detection Framework

```javascript
// In scam-detection-framework.js

function scanTelegramBot(botUsername) {
  // Step 1: Extract bot data
  const botData = await extractBotData(botUsername);
  
  // Step 2: Identify bot type
  const botTypes = identifyBotType(botData);
  
  // Step 3: Check for red flags
  const redFlags = analyzeRedFlags(botData);
  
  // Step 4: Calculate risk score
  const riskScore = calculateRiskScore(botData, redFlags);
  
  // Step 5: Determine risk level
  const riskLevel = getRiskLevel(riskScore);
  
  // Step 6: Generate report
  const report = generateBotReport(botData, botTypes, redFlags, riskScore, riskLevel);
  
  return report;
}
```

### Add to Web Scraper Agent

```javascript
// In /agents/web-scraper/AGENT.md

### Telegram Bot Scanning

**Triggers:**
- Content contains "t.me/" and "bot"
- Content contains "@xxx_bot" or "@xxxBot"
- Content mentions "scan this bot" or "check this bot"

**Action:** Use web_fetch to scan bot page
- URL: https://t.me/[bot_username]
- Tools: web_fetch (API)
- Expected response: Bot risk score, red flags, recommendations

**Workflow:**
1. Extract bot username from message
2. Fetch bot page: https://t.me/[username]
3. Extract bot data (name, description, welcome message)
4. Analyze for 6 bot scam types
5. Check for CRITICAL private key requests (IMMEDIATE RED FLAG)
6. Calculate risk score (0-10)
7. Generate report with recommendations
```

---

## 🚀 Implementation Status

### Complete
✅ Algorithm designed
✅ 6 bot scam types defined
✅ 11 red flags with weights
✅ Risk scoring formula
✅ Example scans documented
✅ Integration plan created

### In Progress
⏳ Integration with web-scraper agent
⏳ Testing with real bots
⏳ Performance monitoring

### Ready For
✅ Implementation in scam detection framework
✅ Integration with Agentic Bro workflow
✅ Testing with legitimate and scam bots

---

## 📊 Success Metrics

### Performance Targets
| Metric | Target |
|--------|--------|
| **Bot scan time** | < 3 seconds |
| **Red flag detection accuracy** | > 90% |
| **False positive rate** | < 10% |
| **Bot type identification** | > 85% |

### Success Indicators
- Detect impersonation bots accurately
- Flag wallet drainer bots
- Identify giveaway scams
- Warn users about support scams
- Reduce victim reports from Telegram bot scams

---

## 📝 Notes

### Limitations
- Cannot access private bots
- Cannot see bot interactions (only public info)
- Cannot verify bot owner identity
- Some bots may be legitimate but have scam-like patterns

### Mitigations
- Focus on public bot pages only
- Use multiple red flags before flagging
- Always recommend user verification
- Cross-reference with official websites
- Report suspicious bots to Telegram

### Privacy
- Only collect publicly available data
- Respect Telegram's terms of service
- Use scans for community protection only
- Do not share bot data without permission

---

## 🔗 Related Files

- `/workspace/scam-detection-framework/SCANNER_IMPLEMENTATION_COMPLETE.md`
- `/workspace/scam-detection-framework/TOKEN_IMPERSONATION_SCANNER.md`
- `/workspace/scam-detection-framework/RESEARCH_BASED_ENHANCEMENTS.md`
- `/workspace/scam-detection-framework/FACEBOOK_PAGE_SCANNING.md`
- `/agents/web-scraper/AGENT.md`

---

**Created:** March 28, 2026  
**Feature:** #8 - Telegram Bot Scam Detection  
**Status:** Algorithm complete, integration in progress  
**Next:** Implement in web-scraper agent, test with real bots  

---

**Remember:** Scan first, ape later! 🔐