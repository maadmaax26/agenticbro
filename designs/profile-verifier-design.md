# Profile Verifier — Feature Design

## Overview

AI-powered social media profile verification to detect impersonators, fake followers, bot activity, and deepfake content. Users input a Twitter/X username and receive a comprehensive authenticity score.

---

## User Flow

```
User Input: X/Twitter Username
        ↓
    Fetch Profile Data
    ├── Profile info (bio, verified, created)
    ├── Follower/following counts
    ├── Recent tweets (last 100)
    ├── Engagement metrics
    └── Media content (profile pic, banners)
        ↓
    Multi-Analysis Engine
    ├── Bot Detection (followers, engagement patterns)
    ├── Deepfake Detection (profile images, videos)
    ├── Impersonation Check (known scammers DB)
    └── Account Age/Activity Analysis
        ↓
    Authenticity Calculation
        ↓
    Results Display
    ├── Authenticity Score (0-100)
    ├── Risk Level (VERIFIED/SAFE/CAUTION/UNSAFE/SCAM)
    ├── Breakdown by Category
    └── Recommendations
```

---

## API Endpoints

### `POST /api/verify/profile`

**Request:**
```json
{
  "platform": "twitter",
  "username": "elonmusk",
  "deepScan": true,
  "includeMedia": true
}
```

**Response:**
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
      "createdAt": "2009-06-02",
      "profileImage": "https://pbs.twimg.com/profile_images/...",
      "bio": "Mars & Cars, Chips & Dips"
    },
    "authenticityScore": 98,
    "riskLevel": "VERIFIED",
    "categories": {
      "verification": {
        "score": 100,
        "status": "VERIFIED",
        "details": {
          "platformVerified": true,
          "verificationType": "blue",
          "verifiedSince": "2021-06-01"
        }
      },
      "botDetection": {
        "score": 96,
        "status": "SAFE",
        "details": {
          "fakeFollowersPercent": 0.5,
          "botScore": 2,
          "suspiciousFollowers": 975000,
          "engagementAuthenticity": 94
        }
      },
      "deepfake": {
        "score": 100,
        "status": "SAFE",
        "details": {
          "profileImageAnalysis": "authentic",
          "manipulationProbability": 0.02,
          "faceMatch": true,
          "aiGeneratedProbability": 0.01
        }
      },
      "impersonation": {
        "score": 100,
        "status": "SAFE",
        "details": {
          "isKnownImpersonator": false,
          "impersonatingAccount": null,
          "similarAccounts": [],
          "reportCount": 0
        }
      },
      "activity": {
        "score": 94,
        "status": "SAFE",
        "details": {
          "accountAge": "16 years",
          "postingFrequency": "consistent",
          "engagementRate": 0.15,
          "suspiciousPatterns": []
        }
      }
    },
    "redFlags": [],
    "warnings": [],
    "recommendation": "✅ VERIFIED ACCOUNT - Official account of a public figure.",
    "scanTime": "2026-03-30T20:50:00Z",
    "scanDuration": "4.2s"
  }
}
```

---

## Scoring System

### Category Weights

| Category | Weight | Max Score |
|----------|--------|-----------|
| Verification | 30% | 30 |
| Bot Detection | 25% | 25 |
| Deepfake | 20% | 20 |
| Impersonation | 15% | 15 |
| Activity | 10% | 10 |
| **Total** | **100%** | **100** |

---

## Bot Detection Algorithm

### Fake Follower Analysis

**Signals:**
1. **Follower Quality Score**
   - Ratio of followers with profile pictures
   - Ratio of followers with tweets
   - Follower account age distribution
   - Geographic distribution of followers

2. **Engagement Authenticity**
   - Likes/tweets ratio (normal: 1-5%)
   - Retweets/tweets ratio (normal: 0.5-2%)
   - Reply/tweets ratio
   - Comment sentiment analysis

3. **Suspicious Patterns**
   - Sudden follower spikes
   - Engagement from bot-like accounts
   - Coordinated engagement patterns
   - Copy-paste comments

### Bot Score Calculation

```python
def calculate_bot_score(profile_data):
    score = 100  # Start with perfect score
    
    # Fake followers penalty
    fake_percent = detect_fake_followers(profile_data['followers_sample'])
    score -= fake_percent * 0.3  # Up to -30 points
    
    # Engagement anomalies
    engagement_rate = profile_data['likes'] / profile_data['tweets'] / profile_data['followers']
    if engagement_rate > 0.05:  # Suspiciously high engagement
        score -= min((engagement_rate - 0.05) * 100, 20)
    elif engagement_rate < 0.001:  # Suspiciously low engagement
        score -= min((0.001 - engagement_rate) * 1000, 15)
    
    # Account age of followers
    avg_follower_age = calculate_average_follower_age(profile_data)
    if avg_follower_age < 30:  # Days
        score -= (30 - avg_follower_age) * 0.5  # Up to -15 points
    
    # Posting patterns
    posting_regularity = analyze_posting_patterns(profile_data['tweets'])
    if posting_regularity['bot_likelihood'] > 0.5:
        score -= posting_regularity['bot_likelihood'] * 20
    
    return max(score, 0)
```

---

## Deepfake Detection

### Image Analysis

**Profile Image Checks:**
1. **Face Detection** — Is there a face? How many?
2. **AI Generation Detection** — GAN artifacts, synthetic features
3. **Manipulation Detection** — Photoshop/editing analysis
4. **Reverse Image Search** — Where else does this image appear?
5. **Face Match** — Does face match claimed identity?

**AI Generation Probability Calculation:**

```python
def detect_ai_generated(image_url):
    # Use pre-trained model (e.g., DIRE, DetectFakes)
    features = extract_image_features(image_url)
    
    # Check for GAN artifacts
    gan_score = analyze_gan_artifacts(features)
    
    # Check for synthetic textures
    texture_score = analyze_texture_consistency(features)
    
    # Check facial landmarks for distortions
    landmark_score = analyze_facial_landmarks(features)
    
    # Ensemble prediction
    ai_probability = (gan_score + texture_score + landmark_score) / 3
    
    return ai_probability
```

### Deepfake Video Analysis

**For video content in tweets:**
1. Lip-sync detection
2. Facial movement artifacts
3. Audio-visual sync analysis
4. Temporal consistency

---

## Impersonation Detection

### Known Scammer Database

**Database Schema:**
```sql
CREATE TABLE known_scammers (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50),
    username VARCHAR(100),
    real_identity VARCHAR(100),
    impersonating VARCHAR(100),
    scam_type VARCHAR(100),
    victim_count INTEGER,
    total_lost_usd DECIMAL(15,2),
    evidence_urls TEXT[],
    first_reported TIMESTAMP,
    last_seen TIMESTAMP,
    status VARCHAR(20) -- 'active', 'suspended', 'unknown'
);
```

### Similarity Matching

```python
def check_impersonation(username, display_name, profile_image):
    # Username similarity
    similar_usernames = find_similar_usernames(username, known_scammers)
    
    # Display name similarity
    similar_names = find_similar_names(display_name, known_entities)
    
    # Profile image similarity (face embedding)
    if has_face(profile_image):
        face_embedding = extract_face_embedding(profile_image)
        similar_faces = find_similar_faces(face_embedding, known_entities)
    
    # Combine signals
    impersonation_score = calculate_impersonation_score(
        similar_usernames, similar_names, similar_faces
    )
    
    return impersonation_score
```

---

## Risk Level Thresholds

| Level | Score Range | Display | Description |
|-------|-------------|---------|-------------|
| VERIFIED | 95-100 | 🟢✅ | Platform-verified account |
| SAFE | 80-94 | 🟢 | Authentic profile, low risk |
| CAUTION | 60-79 | 🟡 | Some concerns, investigate further |
| UNSAFE | 40-59 | 🟠 | Significant red flags detected |
| SCAM | 0-39 | 🔴 | Known scammer or high-confidence detection |

---

## Data Sources

### Primary APIs

1. **Twitter/X API v2**
   - User lookup, followers, tweets
   - Rate limit: 900 requests/15min (user auth)

2. **Botometer API**
   - Bot probability scoring
   - Uses ML on account features

3. **Deepfake Detection Models**
   - DIRE (Diffusion Reconstruction Error)
   - Custom-trained model on latest deepfakes

4. **Reverse Image Search**
   - Google Images API
   - TinEye API
   - Yandex Images

### Internal Database

- Known scammers (updated daily from reports)
- Verified accounts whitelist
- Historical scan results

---

## UI Components

### Profile Input

```
┌─────────────────────────────────────────────────────┐
│  🔍 Profile Verifier                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Platform                                           │
│  [Twitter/X ▼]  [Telegram]  [Discord]              │
│                                                     │
│  Username                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ @elonmusk                                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ☑ Include media analysis (deepfake check)        │
│  ☑ Deep scan (followers sample)                   │
│                                                     │
│  [Verify Profile]  [Clear]                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Results Display

```
┌─────────────────────────────────────────────────────┐
│  @elonmusk - Elon Musk                              │
│  Authenticity: 98/100  🟢✅ VERIFIED                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📋 Profile Summary                                 │
│  ┌─────────────────────────────────────────────┐   │
│  │ [Profile Image]                              │   │
│  │                                               │   │
│  │ Elon Musk                                     │   │
│  │ @elonmusk • ✓ Blue Verified                  │   │
│  │                                               │   │
│  │ Followers: 195M                               │   │
│  │ Following: 750                                │   │
│  │ Tweets: 54K                                   │   │
│  │ Joined: June 2009                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ✅ Verification        30/30  ━━━━━━━━━━━ VERIFIED │
│     • Platform verified (Blue checkmark)           │
│     • Verified since 2021                          │
│                                                     │
│  ✅ Bot Detection       24/25  ━━━━━━━━━━━ SAFE    │
│     • Fake followers: 0.5%                         │
│     • Engagement authenticity: 94%                 │
│     • Bot score: 2/100 (very low)                  │
│                                                     │
│  ✅ Deepfake           20/20  ━━━━━━━━━━━ SAFE      │
│     • Profile image: Authentic photo              │
│     • AI-generated probability: 1%                 │
│     • Manipulation: None detected                  │
│                                                     │
│  ✅ Impersonation       15/15  ━━━━━━━━━━━ SAFE    │
│     • Not in scammer database                      │
│     • No similar suspicious accounts found        │
│     • Face matches known identity                  │
│                                                     │
│  ✅ Activity            9/10  ━━━━━━━━━━━ SAFE      │
│     • Account age: 16 years                        │
│     • Posting frequency: Consistent                │
│     • Engagement rate: 0.15% (normal)              │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Warnings:                                          │
│  ℹ️ Very high follower count may include some      │
│     inactive accounts (normal for large profiles)  │
│                                                     │
│  Recommendation:                                    │
│  ✅ VERIFIED ACCOUNT - Official account of a       │
│     public figure. Safe to interact with.         │
│                                                     │
│  [Share Results] [Export PDF] [Report Issue]       │
│                                                     │
│  Scanned: 2026-03-30 20:50 UTC · 4.2s             │
└─────────────────────────────────────────────────────┘
```

---

## Telegram Bot Integration

### Command Format

```
/verify @username
/verify @username --deep
/verify @username --media

Example:
/verify @elonmusk
/verify @suspicious_account --deep --media
```

### Bot Response Format

```
🔍 Profile Verification

@elonmusk - Elon Musk
Authenticity: 98/100 🟢✅ VERIFIED

✅ Verification: Platform verified
✅ Bot Detection: 0.5% fake followers
✅ Deepfake: Authentic photo
✅ Impersonation: Not a known scammer
✅ Activity: 16 years, consistent

Recommendation: ✅ VERIFIED ACCOUNT

Scan: 4.2s · agenticbro.app/verify/elonmusk
```

---

## Scam Example Response

```
┌─────────────────────────────────────────────────────┐
│  @elon_musk_giveaway - Elon Musk                    │
│  Authenticity: 12/100  🔴 SCAM DETECTED              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🚨 CRITICAL WARNINGS:                              │
│                                                     │
│  ❌ IMPERSONATION DETECTED                          │
│     • Username mimics @elonmusk                     │
│     • Account created 2 days ago                    │
│     • Previously reported 47 times                  │
│                                                     │
│  ❌ KNOWN SCAMMER                                   │
│     • In scammer database since 2026-03-28          │
│     • 23 victims reported                           │
│     • $47,000 total stolen                          │
│                                                     │
│  ❌ BOT ACTIVITY DETECTED                           │
│     • 89% fake followers                            │
│     • Bot score: 94/100                             │
│     • Engagement from suspicious accounts          │
│                                                     │
│  ❌ DEEPFAKE CONTENT                                │
│     • Profile image: AI-generated (99% probability) │
│     • Video content: Lip-sync artifacts detected   │
│                                                     │
│  ⚠️ RED FLAGS:                                      │
│     • Account age: 2 days                           │
│     • "Giveaway" in bio - classic scam pattern      │
│     • Asking users to send crypto                   │
│                                                     │
│  Recommendation:                                    │
│  🛑 DO NOT INTERACT - Known scam account           │
│     Report and block immediately                   │
│                                                     │
│  [Report to X/Twitter] [Share Warning]             │
│                                                     │
│  Scanned: 2026-03-30 20:55 UTC · 5.8s             │
└─────────────────────────────────────────────────────┘
```

---

## Caching Strategy

- **Verified Accounts:** 7 days (rarely change)
- **Normal Accounts:** 24 hours
- **Suspicious Accounts:** 1 hour
- **Scammer Accounts:** Never cache (always fresh)

---

## Rate Limiting

| Tier | Scans/Day | Deep Scans/Day |
|------|-----------|----------------|
| Free | 3 | 0 |
| Basic ($29) | 25 | 5 |
| Pro ($99) | 100 | 25 |
| Team ($299) | 500 | 100 |
| Enterprise ($999) | Unlimited | Unlimited |

---

## Error Handling

```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_SUSPENDED",
    "message": "This account has been suspended",
    "suggestion": "Unable to scan suspended accounts"
  }
}
```

**Error Codes:**
- `ACCOUNT_NOT_FOUND` — Username doesn't exist
- `ACCOUNT_SUSPENDED` — Account has been suspended
- `ACCOUNT_PRIVATE` — Account is private (limited data)
- `RATE_LIMITED` — Twitter API rate limit hit
- `API_ERROR` — External API failure
- `USER_LIMIT_EXCEEDED` — User exceeded scan quota

---

## Future Enhancements

1. **Multi-Platform Support** — Telegram, Discord, Instagram verification
2. **Real-Time Monitoring** — Alert when followed account becomes suspicious
3. **Bulk Verification** — Verify multiple accounts for events/giveaways
4. **Browser Extension** — Verify profiles while browsing
5. **API for Developers** — Public API for integration
6. **Historical Reports** — Track when accounts went bad
7. **Community Reporting** — User-submitted scammer reports

---

## Competitive Analysis

| Feature | Agentic Bro | Botometer | SparkToro | Twitter Audit |
|---------|-------------|-----------|-----------|---------------|
| Bot Detection | ✅ | ✅ | ✅ | ✅ |
| Deepfake Detection | ✅ | ❌ | ❌ | ❌ |
| Impersonation Check | ✅ | ❌ | ❌ | ❌ |
| Scammer Database | ✅ | ❌ | ❌ | ❌ |
| Risk Score | ✅ | ✅ | ❌ | ✅ |
| Telegram Bot | ✅ | ❌ | ❌ | ❌ |
| Free Tier | 3/day | 500/day | Limited | 1/day |
| Real-time Alerts | ✅ | ❌ | ❌ | ❌ |

---

## Implementation Priority

### Phase 1 (MVP)
- [ ] Twitter API integration
- [ ] Bot detection (basic)
- [ ] Account age/verification check
- [ ] Known scammer database lookup
- [ ] Telegram bot integration

### Phase 2 (Enhanced)
- [ ] Deepfake image detection
- [ ] Advanced bot scoring
- [ ] Follower sampling
- [ ] Engagement analysis

### Phase 3 (Advanced)
- [ ] Deepfake video detection
- [ ] Multi-platform support
- [ ] Real-time monitoring
- [ ] Historical tracking