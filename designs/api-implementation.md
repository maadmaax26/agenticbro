# API Implementation Specification

## Overview

This document defines the complete API architecture for Agentic Bro's Token Scanner and Profile Verifier features.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                   │
│  │   Web     │  │ Telegram  │  │  Mobile   │                   │
│  │   App     │  │   Bot     │  │   App     │                   │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘                   │
└────────┼──────────────┼──────────────┼─────────────────────────┘
         │              │              │
         └──────────────┴──────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Rate Limiting  │  Auth  │  Routing  │  Logging          │  │
│  └───────────────────────────────────────────────────────────┘  │
│  Port: 3000                                                    │
└────────────────────────────────────────────────────────────────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
         ▼                             ▼
┌──────────────────┐        ┌──────────────────┐
│  Token Service   │        │ Profile Service  │
│  Port: 3001      │        │ Port: 3002       │
├──────────────────┤        ├──────────────────┤
│ - DexScreener    │        │ - Twitter API    │
│ - GoPlus API     │        │ - Botometer API  │
│ - RugCheck API   │        │ - Deepfake ML    │
│ - Solana RPC     │        │ - Scammer DB     │
└──────────────────┘        └──────────────────┘
         │                             │
         └──────────────┬──────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │   Redis    │  │ PostgreSQL │  │  Scammer   │                │
│  │   Cache    │  │   Storage  │  │    DB      │                │
│  └────────────┘  └────────────┘  └────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Base Configuration

### Base URL
```
Production: https://api.agenticbro.app
Staging: https://staging-api.agenticbro.app
Local: http://localhost:3000
```

### Authentication
```http
Authorization: Bearer <api_key>
X-Request-ID: <uuid>
```

### Rate Limits
| Tier | Requests/Minute | Requests/Day |
|------|-----------------|---------------|
| Free | 10 | 5 scans |
| Basic | 60 | 50 scans |
| Pro | 300 | 200 scans |
| Team | 1000 | 1000 scans |
| Enterprise | 10000 | Unlimited |

---

## Token Scanner API

### Endpoints

#### `POST /api/v1/scan/token`

Scan a token by contract address.

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <api_key>
```

**Request Body:**
```json
{
  "contractAddress": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
  "chain": "solana",
  "options": {
    "includeHolders": true,
    "includeTransactions": false,
    "forceRefresh": false
  }
}
```

**Request Schema:**
```typescript
interface TokenScanRequest {
  contractAddress: string;      // Required: 44-char base58 Solana address
  chain: 'solana' | 'ethereum' | 'bsc' | 'polygon';  // Default: 'solana'
  options?: {
    includeHolders?: boolean;   // Include top holder analysis (default: true)
    includeTransactions?: boolean; // Include recent transaction analysis (default: false)
    forceRefresh?: boolean;     // Force fresh scan, ignore cache (default: false)
  };
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": {
      "symbol": "AGNTCBRO",
      "name": "Agentic Bro",
      "contract": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
      "platform": "pump.fun",
      "createdAt": "2025-03-15T10:30:00Z",
      "decimals": 6,
      "totalSupply": "1000000000000000"
    },
    "riskScore": 2.5,
    "riskLevel": "LOW",
    "categories": {
      "honeypot": {
        "score": 0,
        "status": "SAFE",
        "weight": 0.35,
        "details": {
          "buyable": true,
          "sellable": true,
          "buyTax": 0,
          "sellTax": 0,
          "maxSellPercent": 100,
          "hiddenOwner": false,
          "simulationPassed": true
        }
      },
      "developer": {
        "score": 0.75,
        "status": "LOW",
        "weight": 0.25,
        "details": {
          "devHoldingsPercent": 8.5,
          "top10HoldersPercent": 25,
          "devWalletAddress": "ABC123...",
          "devTransactions": 12,
          "devSoldPercent": 0,
          "devLastActive": "2025-03-28T15:00:00Z"
        }
      },
      "liquidity": {
        "score": 0.5,
        "status": "LOW",
        "weight": 0.20,
        "details": {
          "locked": true,
          "lockContract": "ABC123...",
          "lockDuration": "1 year",
          "lockPercent": 80,
          "liquidityUsd": 125000,
          "liquidityToken": 500000000,
          "pairs": [
            {
              "dex": "Raydium",
              "pairAddress": "DEF456...",
              "liquidityUsd": 100000
            },
            {
              "dex": "Orca",
              "pairAddress": "GHI789...",
              "liquidityUsd": 25000
            }
          ]
        }
      },
      "authority": {
        "score": 0.25,
        "status": "LOW",
        "weight": 0.15,
        "details": {
          "mintAuthority": "revoked",
          "freezeAuthority": "none",
          "permanentDelegate": false,
          "authorityTransfers": 0,
          "updatableAuthority": false
        }
      },
      "market": {
        "score": 0.5,
        "status": "LOW",
        "weight": 0.05,
        "details": {
          "marketCap": 850000,
          "fdv": 1200000,
          "volume24h": 45000,
          "holders": 3420,
          "transactions24h": 892,
          "priceUsd": 0.00085,
          "priceChange24h": 12.5
        }
      }
    },
    "redFlags": [],
    "warnings": [
      "Token created 15 days ago - newer tokens carry higher risk"
    ],
    "recommendation": "✅ SAFE TO TRADE - Low risk profile. Standard due diligence recommended.",
    "scanTime": "2026-03-30T20:44:00Z",
    "scanDuration": "2.3s",
    "cacheHit": false,
    "dataSources": [
      "dexscreener",
      "goplus",
      "rugcheck",
      "solana-rpc"
    ]
  }
}
```

**Error Responses:**

```json
// 400 Bad Request - Invalid address
{
  "success": false,
  "error": {
    "code": "INVALID_ADDRESS",
    "message": "Not a valid Solana token address",
    "details": {
      "input": "invalid-address",
      "expected": "44-character base58 string"
    }
  }
}

// 404 Not Found - Token not found
{
  "success": false,
  "error": {
    "code": "TOKEN_NOT_FOUND",
    "message": "No token found at this address",
    "details": {
      "contractAddress": "ABC123...",
      "suggestions": ["Verify the address on Solscan", "Check if token has migrated"]
    }
  }
}

// 429 Too Many Requests - Rate limited
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Scan limit exceeded for your tier",
    "details": {
      "tier": "free",
      "usedToday": 5,
      "limitToday": 5,
      "resetAt": "2026-03-31T00:00:00Z"
    }
  }
}
```

---

#### `GET /api/v1/scan/token/:address/history`

Get historical scan results for a token.

**Request:**
```http
GET /api/v1/scan/token/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump/history?days=7
Authorization: Bearer <api_key>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "contract": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
    "symbol": "AGNTCBRO",
    "history": [
      {
        "date": "2026-03-30",
        "riskScore": 2.5,
        "riskLevel": "LOW",
        "changes": []
      },
      {
        "date": "2026-03-29",
        "riskScore": 2.8,
        "riskLevel": "LOW",
        "changes": [
          {
            "field": "market.holders",
            "from": 3100,
            "to": 3420,
            "impact": "positive"
          }
        ]
      }
    ],
    "trend": "improving"
  }
}
```

---

#### `GET /api/v1/scan/token/:address/holders`

Get top holder distribution.

**Request:**
```http
GET /api/v1/scan/token/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump/holders?limit=20
Authorization: Bearer <api_key>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "contract": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
    "totalHolders": 3420,
    "topHolders": [
      {
        "rank": 1,
        "address": "ABC123...",
        "balance": "85000000000",
        "percent": 8.5,
        "type": "developer",
        "firstTransaction": "2025-03-15T10:30:00Z"
      },
      {
        "rank": 2,
        "address": "DEF456...",
        "balance": "50000000000",
        "percent": 5.0,
        "type": "unknown",
        "firstTransaction": "2025-03-15T11:00:00Z"
      }
    ],
    "distribution": {
      "top10Percent": 25,
      "top100Percent": 45,
      "gini": 0.72
    }
  }
}
```

---

## Profile Verifier API

### Endpoints

#### `POST /api/v1/verify/profile`

Verify a social media profile.

**Request Body:**
```json
{
  "platform": "twitter",
  "username": "elonmusk",
  "options": {
    "deepScan": true,
    "includeMedia": true,
    "sampleFollowers": true
  }
}
```

**Request Schema:**
```typescript
interface ProfileVerifyRequest {
  platform: 'twitter' | 'telegram' | 'discord';
  username: string;            // @ prefix optional
  options?: {
    deepScan?: boolean;         // Include follower sampling (default: false)
    includeMedia?: boolean;     // Deepfake image analysis (default: false)
    sampleFollowers?: boolean;  // Analyze follower authenticity (default: false)
    forceRefresh?: boolean;     // Force fresh scan (default: false)
  };
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "profile": {
      "platform": "twitter",
      "username": "elonmusk",
      "displayName": "Elon Musk",
      "verified": true,
      "verifiedType": "blue",
      "followers": 195000000,
      "following": 750,
      "tweets": 54000,
      "createdAt": "2009-06-02T00:00:00Z",
      "profileImage": "https://pbs.twimg.com/profile_images/...",
      "bio": "Mars & Cars, Chips & Dips",
      "location": "Austin, Texas",
      "website": "https://x.com"
    },
    "authenticityScore": 98,
    "riskLevel": "VERIFIED",
    "categories": {
      "verification": {
        "score": 30,
        "maxScore": 30,
        "status": "VERIFIED",
        "weight": 0.30,
        "details": {
          "platformVerified": true,
          "verificationType": "blue",
          "verifiedSince": "2021-06-01T00:00:00Z",
          "verificationConfidence": 100
        }
      },
      "botDetection": {
        "score": 24,
        "maxScore": 25,
        "status": "SAFE",
        "weight": 0.25,
        "details": {
          "fakeFollowersPercent": 0.5,
          "botScore": 2,
          "suspiciousFollowersCount": 975000,
          "engagementAuthenticity": 94,
          "followerGrowthPattern": "organic",
          "engagementRate": 0.15
        }
      },
      "deepfake": {
        "score": 20,
        "maxScore": 20,
        "status": "SAFE",
        "weight": 0.20,
        "details": {
          "profileImageAnalysis": "authentic",
          "manipulationProbability": 0.02,
          "faceMatch": true,
          "aiGeneratedProbability": 0.01,
          "deepfakeConfidence": 98
        }
      },
      "impersonation": {
        "score": 15,
        "maxScore": 15,
        "status": "SAFE",
        "weight": 0.15,
        "details": {
          "isKnownImpersonator": false,
          "impersonatingAccount": null,
          "similarAccounts": [],
          "reportCount": 0,
          "scammerDbMatch": false
        }
      },
      "activity": {
        "score": 9,
        "maxScore": 10,
        "status": "SAFE",
        "weight": 0.10,
        "details": {
          "accountAge": "16 years",
          "accountAgeDays": 6083,
          "postingFrequency": "consistent",
          "postingFrequencyScore": 85,
          "engagementRate": 0.15,
          "suspiciousPatterns": [],
          "lastActive": "2026-03-30T18:00:00Z"
        }
      }
    },
    "redFlags": [],
    "warnings": [
      "Very high follower count may include some inactive accounts"
    ],
    "recommendation": "✅ VERIFIED ACCOUNT - Official account of a public figure. Safe to interact with.",
    "scanTime": "2026-03-30T20:50:00Z",
    "scanDuration": "4.2s",
    "cacheHit": false
  }
}
```

---

#### `GET /api/v1/verify/profile/:username/scammers`

Check if username matches known scammers.

**Request:**
```http
GET /api/v1/verify/profile/elon_musk_giveaway/scammers
Authorization: Bearer <api_key>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "username": "elon_musk_giveaway",
    "isScammer": true,
    "scammerRecord": {
      "id": "SCM-2026-03421",
      "platform": "twitter",
      "impersonating": "elonmusk",
      "scamType": "giveaway_fraud",
      "victimCount": 47,
      "totalLostUsd": 125000,
      "firstReported": "2026-03-28T00:00:00Z",
      "lastSeen": "2026-03-30T15:00:00Z",
      "status": "active",
      "evidenceUrls": [
        "https://twitter.com/...",
        "https://t.me/..."
      ]
    },
    "similarAccounts": [
      {
        "username": "elon_musk_geo",
        "similarity": 0.92,
        "isScammer": true
      }
    ]
  }
}
```

---

## Scammer Database API

### Endpoints

#### `POST /api/v1/scammers/report`

Report a scammer.

**Request Body:**
```json
{
  "platform": "twitter",
  "username": "scammer_username",
  "scamType": "giveaway_fraud",
  "impersonating": "elonmusk",
  "evidence": [
    "https://twitter.com/...",
    "https://t.me/..."
  ],
  "description": "Asked me to send 0.5 SOL for a fake giveaway",
  "victimAmount": 500
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "reportId": "RPT-2026-05678",
    "status": "pending_review",
    "estimatedReview": "24-48 hours",
    "rewardEligible": true,
    "message": "Thank you for your report. Our team will review within 24-48 hours."
  }
}
```

---

#### `GET /api/v1/scammers/search`

Search scammer database.

**Request:**
```http
GET /api/v1/scammers/search?platform=twitter&scamType=giveaway_fraud&limit=20
Authorization: Bearer <api_key>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "SCM-2026-03421",
        "username": "elon_musk_geo",
        "platform": "twitter",
        "scamType": "giveaway_fraud",
        "impersonating": "elonmusk",
        "victimCount": 47,
        "totalLostUsd": 125000,
        "status": "active"
      }
    ],
    "pagination": {
      "total": 1234,
      "page": 1,
      "limit": 20,
      "hasMore": true
    }
  }
}
```

---

## Telegram Bot Integration

### Webhook Endpoint

#### `POST /api/v1/telegram/webhook`

Handle Telegram bot updates.

**Request Body (from Telegram):**
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 2122311885,
      "username": "maadmaax22"
    },
    "chat": {
      "id": 2122311885,
      "type": "private"
    },
    "text": "/scan 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
  }
}
```

**Internal Processing:**
```typescript
async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  if (!message?.text) return;

  const command = parseCommand(message.text);
  
  switch (command.type) {
    case 'scan':
      return await handleScanCommand(message.chat.id, command.address);
    case 'verify':
      return await handleVerifyCommand(message.chat.id, command.username);
    case 'help':
      return await handleHelpCommand(message.chat.id);
    default:
      return await handleUnknownCommand(message.chat.id);
  }
}
```

### Bot Commands

```
/scan <address>     - Scan a token contract
/verify <username>  - Verify a social profile
/scammer <username> - Check scammer database
/report <username>  - Report a scammer
/help               - Show help
/status             - Show account status
```

---

## Implementation Code

### Token Scanner Service

```typescript
// services/token-scanner.ts

import { DexScreenerClient } from './clients/dexscreener';
import { GoPlusClient } from './clients/goplus';
import { RugCheckClient } from './clients/rugcheck';
import { SolanaRPC } from './clients/solana-rpc';
import { Cache } from './cache/redis';
import { RiskCalculator } from './scoring/risk-calculator';

export class TokenScanner {
  private dexScreener: DexScreenerClient;
  private goPlus: GoPlusClient;
  private rugCheck: RugCheckClient;
  private solana: SolanaRPC;
  private cache: Cache;
  private riskCalculator: RiskCalculator;

  constructor(config: ScannerConfig) {
    this.dexScreener = new DexScreenerClient(config.dexScreenerApiKey);
    this.goPlus = new GoPlusClient(config.goPlusApiKey);
    this.rugCheck = new RugCheckClient(config.rugCheckApiKey);
    this.solana = new SolanaRPC(config.solanaRpcUrl);
    this.cache = new Cache(config.redisUrl);
    this.riskCalculator = new RiskCalculator();
  }

  async scan(address: string, options: ScanOptions = {}): Promise<ScanResult> {
    const startTime = Date.now();
    
    // Check cache first
    if (!options.forceRefresh) {
      const cached = await this.cache.get(`scan:${address}`);
      if (cached) {
        return { ...cached, cacheHit: true };
      }
    }

    // Validate address
    if (!this.isValidSolanaAddress(address)) {
      throw new InvalidAddressError(address);
    }

    // Parallel API calls
    const [dexData, securityData, rugData, onChainData] = await Promise.all([
      this.dexScreener.getTokenData(address).catch(() => null),
      this.goPlus.getTokenSecurity(address).catch(() => null),
      this.rugCheck.getTokenReport(address).catch(() => null),
      this.solana.getAccountInfo(address).catch(() => null),
    ]);

    // Calculate risk scores
    const categories = this.riskCalculator.calculate({
      dex: dexData,
      security: securityData,
      rug: rugData,
      chain: onChainData,
    });

    const riskScore = this.calculateTotalScore(categories);
    const riskLevel = this.determineRiskLevel(riskScore);

    // Build result
    const result: ScanResult = {
      token: this.extractTokenInfo(dexData, onChainData),
      riskScore,
      riskLevel,
      categories,
      redFlags: this.extractRedFlags(categories),
      warnings: this.extractWarnings(categories),
      recommendation: this.generateRecommendation(riskLevel, categories),
      scanTime: new Date().toISOString(),
      scanDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      cacheHit: false,
      dataSources: this.getDataSources(dexData, securityData, rugData, onChainData),
    };

    // Cache result
    await this.cache.set(`scan:${address}`, result, this.getCacheTTL(riskLevel));

    return result;
  }

  private calculateTotalScore(categories: Categories): number {
    const weights = {
      honeypot: 0.35,
      developer: 0.25,
      liquidity: 0.20,
      authority: 0.15,
      market: 0.05,
    };

    let totalScore = 0;
    for (const [key, category] of Object.entries(categories)) {
      totalScore += category.score * weights[key as keyof typeof weights];
    }
    
    return Math.min(totalScore, 10);
  }

  private determineRiskLevel(score: number): RiskLevel {
    if (score <= 1.5) return 'SAFE';
    if (score <= 3.0) return 'LOW';
    if (score <= 5.0) return 'MEDIUM';
    if (score <= 7.0) return 'HIGH';
    return 'CRITICAL';
  }

  private getCacheTTL(riskLevel: RiskLevel): number {
    const ttlMap = {
      SAFE: 7 * 24 * 60 * 60,      // 7 days
      LOW: 24 * 60 * 60,           // 24 hours
      MEDIUM: 12 * 60 * 60,        // 12 hours
      HIGH: 1 * 60 * 60,           // 1 hour
      CRITICAL: 30 * 60,           // 30 minutes
    };
    return ttlMap[riskLevel];
  }
}
```

### Profile Verifier Service

```typescript
// services/profile-verifier.ts

import { TwitterClient } from './clients/twitter';
import { BotometerClient } from './clients/botometer';
import { DeepfakeDetector } from './ml/deepfake';
import { ScammerDatabase } from './db/scammer';
import { Cache } from './cache/redis';
import { AuthenticityCalculator } from './scoring/authenticity';

export class ProfileVerifier {
  private twitter: TwitterClient;
  private botometer: BotometerClient;
  private deepfake: DeepfakeDetector;
  private scammerDb: ScammerDatabase;
  private cache: Cache;
  private authenticityCalculator: AuthenticityCalculator;

  constructor(config: VerifierConfig) {
    this.twitter = new TwitterClient(config.twitterApiKey);
    this.botometer = new BotometerClient(config.botometerApiKey);
    this.deepfake = new DeepfakeDetector(config.deepfakeModel);
    this.scammerDb = new ScammerDatabase(config.dbUrl);
    this.cache = new Cache(config.redisUrl);
    this.authenticityCalculator = new AuthenticityCalculator();
  }

  async verify(
    platform: string,
    username: string,
    options: VerifyOptions = {}
  ): Promise<VerifyResult> {
    const startTime = Date.now();
    const normalizedUsername = this.normalizeUsername(username);

    // Check cache
    if (!options.forceRefresh) {
      const cached = await this.cache.get(`verify:${platform}:${normalizedUsername}`);
      if (cached) {
        return { ...cached, cacheHit: true };
      }
    }

    // Fetch profile data
    const profileData = await this.fetchProfileData(platform, normalizedUsername, options);

    // Run all checks in parallel
    const [verification, botAnalysis, deepfakeAnalysis, impersonation, activity] = 
      await Promise.all([
        this.checkVerification(profileData),
        this.analyzeBots(profileData, options),
        this.analyzeDeepfake(profileData, options),
        this.checkImpersonation(profileData),
        this.analyzeActivity(profileData),
      ]);

    // Calculate authenticity score
    const categories = {
      verification,
      botDetection: botAnalysis,
      deepfake: deepfakeAnalysis,
      impersonation,
      activity,
    };

    const authenticityScore = this.calculateAuthenticityScore(categories);
    const riskLevel = this.determineRiskLevel(authenticityScore);

    const result: VerifyResult = {
      profile: this.extractProfileInfo(profileData),
      authenticityScore,
      riskLevel,
      categories,
      redFlags: this.extractRedFlags(categories),
      warnings: this.extractWarnings(categories),
      recommendation: this.generateRecommendation(riskLevel, categories),
      scanTime: new Date().toISOString(),
      scanDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      cacheHit: false,
    };

    // Cache based on risk level
    await this.cache.set(
      `verify:${platform}:${normalizedUsername}`,
      result,
      this.getCacheTTL(riskLevel)
    );

    return result;
  }

  private async analyzeDeepfake(
    profileData: ProfileData,
    options: VerifyOptions
  ): Promise<CategoryResult> {
    if (!options.includeMedia) {
      return {
        score: 0,
        maxScore: 20,
        status: 'SKIPPED',
        details: { reason: 'Media analysis not requested' },
      };
    }

    const profileImage = profileData.profileImage;
    if (!profileImage) {
      return {
        score: 20,
        maxScore: 20,
        status: 'SAFE',
        details: { reason: 'No profile image to analyze' },
      };
    }

    // Download and analyze image
    const imageData = await this.fetchImage(profileImage);
    const analysis = await this.deepfake.analyze(imageData);

    // Calculate score based on AI generation probability
    let score = 20;
    if (analysis.aiGeneratedProbability > 0.9) {
      score = 0;
    } else if (analysis.aiGeneratedProbability > 0.7) {
      score = 5;
    } else if (analysis.aiGeneratedProbability > 0.5) {
      score = 10;
    } else if (analysis.aiGeneratedProbability > 0.3) {
      score = 15;
    }

    return {
      score,
      maxScore: 20,
      status: this.getDeepfakeStatus(score),
      details: {
        profileImageAnalysis: score > 15 ? 'authentic' : 'suspicious',
        manipulationProbability: analysis.manipulationProbability,
        faceMatch: analysis.faceMatch,
        aiGeneratedProbability: analysis.aiGeneratedProbability,
        deepfakeConfidence: 100 - (analysis.aiGeneratedProbability * 100),
      },
    };
  }

  private async checkImpersonation(profileData: ProfileData): Promise<CategoryResult> {
    const username = profileData.username;
    const displayName = profileData.displayName;

    // Check if in known scammer database
    const scammerMatch = await this.scammerDb.findByUsername(username);
    if (scammerMatch) {
      return {
        score: 0,
        maxScore: 15,
        status: 'SCAM',
        details: {
          isKnownImpersonator: true,
          impersonatingAccount: scammerMatch.impersonating,
          reportCount: scammerMatch.victimCount,
          scammerDbMatch: true,
        },
      };
    }

    // Find similar usernames
    const similarAccounts = await this.findSimilarUsernames(username, displayName);
    
    // Check if impersonating a verified account
    const impersonationScore = this.calculateImpersonationScore(
      username,
      displayName,
      similarAccounts
    );

    return {
      score: 15 - impersonationScore,
      maxScore: 15,
      status: impersonationScore > 10 ? 'SCAM' : impersonationScore > 5 ? 'UNSAFE' : 'SAFE',
      details: {
        isKnownImpersonator: false,
        impersonatingAccount: null,
        similarAccounts: similarAccounts.slice(0, 5),
        reportCount: 0,
        scammerDbMatch: false,
      },
    };
  }

  private determineRiskLevel(score: number): RiskLevel {
    if (score >= 95) return 'VERIFIED';
    if (score >= 80) return 'SAFE';
    if (score >= 60) return 'CAUTION';
    if (score >= 40) return 'UNSAFE';
    return 'SCAM';
  }
}
```

### API Routes

```typescript
// routes/scanner.ts

import { Router } from 'express';
import { TokenScanner } from '../services/token-scanner';
import { RateLimiter } from '../middleware/rate-limiter';
import { Auth } from '../middleware/auth';

const router = Router();
const scanner = new TokenScanner(config);
const limiter = new RateLimiter();
const auth = new Auth();

// POST /api/v1/scan/token
router.post('/token', 
  auth.requireApiKey,
  limiter.scanLimit,
  async (req, res) => {
    try {
      const { contractAddress, chain = 'solana', options } = req.body;
      
      const result = await scanner.scan(contractAddress, {
        chain,
        ...options,
        userId: req.user.id,
        tier: req.user.tier,
      });

      res.json(result);
    } catch (error) {
      if (error instanceof InvalidAddressError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ADDRESS',
            message: error.message,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        });
      }
    }
  }
);

// GET /api/v1/scan/token/:address/history
router.get('/token/:address/history',
  auth.requireApiKey,
  limiter.scanLimit,
  async (req, res) => {
    const { address } = req.params;
    const { days = 7 } = req.query;

    const history = await scanner.getHistory(address, Number(days));
    res.json(history);
  }
);

// GET /api/v1/scan/token/:address/holders
router.get('/token/:address/holders',
  auth.requireApiKey,
  limiter.scanLimit,
  async (req, res) => {
    const { address } = req.params;
    const { limit = 20 } = req.query;

    const holders = await scanner.getHolders(address, Number(limit));
    res.json(holders);
  }
);

export default router;
```

---

## Database Schema

### PostgreSQL

```sql
-- Scammer database
CREATE TABLE known_scammers (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    username VARCHAR(100) NOT NULL,
    real_identity VARCHAR(100),
    impersonating VARCHAR(100),
    scam_type VARCHAR(100) NOT NULL,
    victim_count INTEGER DEFAULT 0,
    total_lost_usd DECIMAL(15,2) DEFAULT 0,
    evidence_urls TEXT[],
    first_reported TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(platform, username)
);

-- Scan history
CREATE TABLE scan_history (
    id SERIAL PRIMARY KEY,
    contract_address VARCHAR(100) NOT NULL,
    chain VARCHAR(20) NOT NULL,
    risk_score DECIMAL(3,1) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    categories JSONB NOT NULL,
    user_id INTEGER,
    scan_time TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_contract_time (contract_address, scan_time DESC)
);

-- User accounts
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    email VARCHAR(255) UNIQUE,
    tier VARCHAR(20) DEFAULT 'free',
    scans_used_today INTEGER DEFAULT 0,
    scans_reset_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- API keys
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);
```

---

## Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/agenticbro
      - REDIS_URL=redis://cache:6379
      - DEXSCREENER_API_KEY=${DEXSCREENER_API_KEY}
      - GOPLUS_API_KEY=${GOPLUS_API_KEY}
      - RUGCHECK_API_KEY=${RUGCHECK_API_KEY}
      - TWITTER_API_KEY=${TWITTER_API_KEY}
      - BOTOMETER_API_KEY=${BOTOMETER_API_KEY}
    depends_on:
      - db
      - cache

  token-service:
    build: ./services/token-scanner
    ports:
      - "3001:3001"
    environment:
      - SOLANA_RPC_URL=${SOLANA_RPC_URL}
      - REDIS_URL=redis://cache:6379
    depends_on:
      - cache

  profile-service:
    build: ./services/profile-verifier
    ports:
      - "3002:3002"
    environment:
      - TWITTER_API_KEY=${TWITTER_API_KEY}
      - BOTOMETER_API_KEY=${BOTOMETER_API_KEY}
      - DEEPFAKE_MODEL_PATH=/models/deepfake.onnx
      - DATABASE_URL=postgresql://user:pass@db:5432/agenticbro
      - REDIS_URL=redis://cache:6379
    depends_on:
      - db
      - cache

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=agenticbro
    volumes:
      - postgres_data:/var/lib/postgresql/data

  cache:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## Monitoring

### Health Check Endpoint

```typescript
// GET /api/v1/health
router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      dexscreener: await checkDexScreener(),
      goplus: await checkGoPlus(),
      twitter: await checkTwitter(),
    },
    version: process.env.npm_package_version,
  };

  const allHealthy = Object.values(health.services).every(s => s.status === 'ok');
  res.status(allHealthy ? 200 : 503).json(health);
});
```

### Prometheus Metrics

```typescript
// Metrics middleware
app.use(promBundle({
  includeMethod: true,
  includePath: true,
  customLabels: { tier: 'unknown' },
}));

// Custom metrics
const scanCounter = new Counter({
  name: 'agenticbro_scans_total',
  help: 'Total number of scans',
  labelNames: ['type', 'tier', 'risk_level'],
});

const scanDuration = new Histogram({
  name: 'agenticbro_scan_duration_seconds',
  help: 'Scan duration in seconds',
  labelNames: ['type', 'tier'],
  buckets: [0.5, 1, 2, 5, 10, 30],
});
```

---

## Future Enhancements

1. **WebSocket Support** — Real-time scan updates
2. **Batch Scanning** — Scan multiple tokens/profiles at once
3. **Webhooks** — Notify on scan completion
4. **SDK Libraries** — JavaScript, Python, Go clients
5. **GraphQL API** — Alternative query interface