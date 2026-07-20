# Phone Scam Detection Research — Agentic Bro Phone Identifier

**Date:** April 26, 2026  
**Context:** User received scam call from +1-864-866-8857 (now disconnected) with 51 community reports. Classic "account security" impersonation pattern targeting Google/Apple/Microsoft users.

---

## 1. Current Capabilities Summary

### Existing Data Sources

| Source | Status | What It Provides |
|--------|--------|------------------|
| Numverify API | ✅ Live | Carrier, line type, country, format validation |
| CallControl API | ✅ Live | Spam reports, community complaints |
| FTC DNC Database | ⚠️ Partial | Known scam numbers (inefficient API filtering) |
| Community Scraper | ✅ Live | 800notes.com, whocalledme.org via Chrome CDP |
| Internal Heuristics | ✅ Live | 90-point risk scoring system |

### Current 90-Point Risk Flags

| Flag | Points | Description |
|------|--------|-------------|
| `invalid_number` | 25 | Failed validation - may be spoofed/disconnected |
| `premium_rate_number` | 25 | 900 numbers - almost always fraud |
| `voip_number` | 20 | Virtual numbers - anonymous creation |
| `spoofed_caller_id` | 15 | Caller ID manipulation detected |
| `disposable_number` | 15 | Burner/temporary phone services |
| `spam_dialer_service` | 15 | Known robocall operations |
| `high_risk_country` | 15 | Nigeria, India, Pakistan, etc. |
| `toll_free_untraceable` | 10 | 800/888 numbers - untraceable |
| `landline_text` | 10 | Landline claiming to send texts |
| `no_carrier_info` | 10 | Missing carrier metadata |
| `medium_risk_country` | 8 | Secondary risk countries |
| `unknown_carrier` | 5 | Unrecognized carrier |

### Current Threat Intel Structure

```typescript
threatIntel: {
  voipVirtualDialer: { detected, provider, confidence },
  knownScamNumber: { flagged, source, reports },
  communityReports: { count, source, lastReport },
  breachExposure: { found, breaches, sources },
  stirShaken: { attestation: 'A'|'B'|'C'|'unknown', verified, description }
}
```

---

## 2. STIR/SHAKEN Attestation Deep Dive

### What STIR/SHAKEN Means

STIR/SHAKEN is an FCC-mandated caller ID authentication framework. Carriers digitally "sign" calls to verify the calling number is legitimate.

### Attestation Levels

| Level | Meaning | Risk Interpretation |
|-------|---------|---------------------|
| **A (Full)** | Carrier knows customer AND authorizes the Caller ID | ✅ Lowest spoofing risk |
| **B (Partial)** | Carrier knows customer BUT can't verify Caller ID authorization | ⚠️ Medium risk - could be spoofed |
| **C (Gateway)** | Carrier doesn't know caller's identity | 🚨 High risk - likely spam/spoofed |

### Practical Application

- **A-Attestation calls:** Should be trusted for Caller ID
- **B-Attestation calls:** Caller exists but may be using different number
- **C-Attestation calls:** Often blocked by carriers; high spam correlation

### Detection Challenges

1. **Attestation is set by originating carrier** - receiving carrier validates
2. **Not all carriers support STIR/SHAKEN** - smaller VoIP providers lag
3. **International calls** - limited coverage outside North America
4. **Twilio Lookup API** - provides line type but NOT STIR/SHAKEN attestation directly

---

## 3. Recommended New Data Sources

### Tier 1: High Impact, Low Effort (Implement First)

#### 3.1 Twilio Lookup API v2

**Why:** Industry standard, reliable, already using Twilio ecosystem  
**Cost:** $0.008-0.01 per lookup for line type intelligence  
**Coverage:** Worldwide

**Key Data Packages:**

| Package | Cost | What It Detects |
|---------|------|-----------------|
| `line_type_intelligence` | $0.008 | Fixed VoIP vs Non-Fixed VoIP (critical!) |
| `caller_name` | $0.01 | US only - verifies business name matches |
| `sms_pumping_risk` | $0.025 | Detects mass SMS fraud operations |
| `reassigned_number` | $0.002-0.02 | Check if number changed owners recently |

**Critical Enhancement:** Twilio distinguishes between:
- `fixedVoip` - Comcast, Vonage (physical device required)
- `nonFixedVoip` - Google Voice, TextNow, Burner (anonymous)

```typescript
// Twilio Lookup v2 Integration
const twilio = require('twilio')(accountSid, authToken);

async function enhancedLineTypeLookup(phone: string) {
  const result = await twilio.lookups.v2
    .phoneNumbers(phone)
    .fetch({ 
      fields: 'line_type_intelligence,caller_name,sms_pumping_risk' 
    });
  
  return {
    lineType: result.lineTypeIntelligence?.type, // nonFixedVoip = HIGH RISK
    carrier: result.lineTypeIntelligence?.carrier_name,
    callerName: result.callerName?.caller_name,
    callerType: result.callerName?.caller_type, // BUSINESS vs CONSUMER
    smsPumpingRisk: result.smsPumpingRisk?.risk_score,
    isNonFixedVoip: result.lineTypeIntelligence?.type === 'nonFixedVoip'
  };
}
```

---

#### 3.2 IPQualityScore Phone Reputation API

**Why:** Provides disconnected number detection, recent abuse history  
**Cost:** $0.005-0.02 per lookup (volume discounts)  
**Coverage:** Worldwide with NPAC data

**Unique Capabilities:**
- **Disconnected number detection** - identifies numbers that were recently active
- **Abuse velocity** - how actively the number is being used for spam
- **Disposable number detection** - identifies temporary number services
- **Active status** - is the number currently reachable

```typescript
// IPQualityScore Integration
async function ipqsPhoneLookup(phone: string, ip?: string) {
  const url = `https://ipqualityscore.com/api/json/phone/${IPQS_API_KEY}/${phone}`;
  
  const params = new URLSearchParams({
    country: 'US',
    ...(ip && { ip }) // Optional: link phone to IP for better scoring
  });
  
  const response = await fetch(`${url}?${params}`);
  const data = await response.json();
  
  return {
    active: data.active,           // Is number currently active?
    disconnected: !data.active,    // Recently disconnected?
    risky: data.risky,             // Overall risk score
    spam: data.spam,               // Spam reports
    fraudScore: data.fraud_score,  // 0-100 scale
    recentAbuse: data.recent_abuse, // Active in spam campaigns
    voip: data.VOIP,               // Is it VoIP?
    carrier: data.carrier,
    lineType: data.line_type,
    Prepaid: data.prepaid          // Prepaid = higher risk
  };
}
```

---

#### 3.3 YouMail Data API

**Why:** Industry's largest robocall database, powers carrier spam filters  
**Cost:** Enterprise pricing (contact sales)  
**Coverage:** US/Canada primarily

**Key Features:**
- Real-time spam risk level (1-5 scale)
- Robocall pattern detection
- Spam call categorization (telemarketing, scam, fraud)
- Used by major carriers for spam labeling

```typescript
// YouMail Spam Risk Lookup
async function youmailSpamLookup(phone: string) {
  const response = await fetch(
    `https://data.youmail.com/api/v1/phone/${phone}`,
    { headers: { 'Authorization': `Bearer ${YOUMAIL_API_KEY}` }}
  );
  
  return {
    spamRiskLevel: response.lookup.spamRisk.level, // 1-5 scale
    isSpam: response.lookup.spamRisk.level >= 3,
    category: response.lookup.category // SCAM, TELEMARKETING, etc.
  };
}
```

---

### Tier 2: Medium Impact, Medium Effort

#### 3.4 Hiya Developer API

**Why:** Powers Samsung/AT&T built-in spam detection  
**Cost:** Enterprise pricing  
**Coverage:** 40+ countries

**Key Features:**
- Spam/fraud classification
- Caller name verification
- Business number registration status
- Real-time voice deepfake detection (new!)

```typescript
// Hiya Protect API
async function hiyaLookup(phone: string) {
  const response = await fetch(
    `https://api.hiya.com/v2/lookup/${phone}`,
    { headers: { 'Authorization': `Bearer ${HIYA_API_KEY}` }}
  );
  
  return {
    reputation: response.reputation, // CLEAN, SPAM, FRAUD
    category: response.category,
    confidence: response.confidence,
    callerName: response.caller_name,
    isVerified: response.verified
  };
}
```

---

#### 3.5 RoboKiller Enterprise API

**Why:** 99% spam detection accuracy, 600M+ numbers blocked  
**Cost:** Enterprise (contact for pricing)  
**Coverage:** US/Canada

**Key Features:**
- "Call Confidence" API for real-time spam scoring
- Answerbot technology (detects robocall patterns)
- Script analysis (detects common scam scripts)

---

#### 3.6 CallerAPI.com

**Why:** Cheapest option at $0.0039 per lookup  
**Cost:** $0.0039/lookup  
**Coverage:** US

**Key Features:**
- Simple spam/non-spam classification
- Caller name lookup
- Good for high-volume, budget-conscious use

```typescript
// CallerAPI - Budget Option
async function callerApiLookup(phone: string) {
  const response = await fetch(
    `https://callerapi.com/api/v1/lookup?phone=${phone}`,
    { headers: { 'Authorization': `Bearer ${API_KEY}` }}
  );
  
  return {
    spam: response.spam,
    spamType: response.spam_type, // SCAM, TELEMARKETING, etc.
    callerName: response.caller_name,
    carrier: response.carrier
  };
}
```

---

### Tier 3: Specialized Data (Situational)

#### 3.7 FCC Robocall Mitigation Database

**What it is:** Registry of carrier STIR/SHAKEN compliance  
**Use case:** Check if originating carrier is compliant  
**Free access:** https://fcc.gov/robocall-mitigation-database

**Limitation:** Doesn't tell you if a specific number is spam - tells you if the carrier has implemented anti-spoofing.

---

#### 3.8 NPAC (Number Portability Administration Center)

**What it is:** Official database of number porting history  
**Use case:** Detect recent carrier changes (scammer number rotation)  
**Access:** Restricted to telecom providers and law enforcement

**Alternative:** IPQualityScore and Twilio provide NPAC-sourced data without direct access.

---

## 4. New Risk Flags for 90-Point System

### Proposed New Flags

| Flag | Points | Detection Method | Priority |
|------|--------|------------------|----------|
| `non_fixed_voip` | 20 | Twilio/IPQS line type | HIGH |
| `recently_disconnected` | 15 | IPQS active status | HIGH |
| `recent_abuse_activity` | 20 | IPQS recent_abuse flag | HIGH |
| `sms_pumping_detected` | 15 | Twilio SMS pumping risk | MEDIUM |
| `reassigned_number` | 10 | Twilio reassigned_number | MEDIUM |
| `carrier_mismatch` | 15 | Caller name vs carrier type | MEDIUM |
| `impersonation_pattern` | 25 | Script pattern matching | MEDIUM |
| `mass_dialer_pattern` | 15 | High call volume indicators | LOW |
| `geographic_mismatch` | 10 | Area code vs claimed location | LOW |
| `stir_shaken_c` | 15 | C-level attestation | HIGH |

### Updated FLAG_VALUES

```typescript
const FLAG_VALUES: Record<string, number> = {
  // Existing
  invalid_number: 25,
  premium_rate_number: 25,
  voip_number: 20,
  spoofed_caller_id: 15,
  disposable_number: 15,
  spam_dialer_service: 15,
  high_risk_country: 15,
  toll_free_untraceable: 10,
  landline_text: 10,
  no_carrier_info: 10,
  medium_risk_country: 8,
  unknown_carrier: 5,
  
  // NEW FLAGS
  non_fixed_voip: 20,           // Google Voice, TextNow, Burner (anonymous)
  recently_disconnected: 15,    // Was active, now dead (scammer rotation)
  recent_abuse_activity: 20,    // Active in spam campaigns recently
  sms_pumping_detected: 15,     // Mass SMS fraud operation
  reassigned_number: 10,        // Changed owners recently
  carrier_mismatch: 15,         // Business name doesn't match carrier
  impersonation_pattern: 25,    // "Account security" / "suspicious activity"
  mass_dialer_pattern: 15,      // High call volume indicators
  geographic_mismatch: 10,      // Area code vs claimed location
  stir_shaken_c: 15,            // C-level attestation (unverified caller)
};
```

---

## 5. Implementation Priority Matrix

### Phase 1: Immediate (1-2 weeks)

| Task | Effort | Impact | Cost |
|------|--------|--------|------|
| Add Twilio Lookup v2 with `line_type_intelligence` | LOW | HIGH | ~$8/1000 lookups |
| Add IPQualityScore integration | LOW | HIGH | ~$10/1000 lookups |
| Update FLAG_VALUES with new flags | LOW | MEDIUM | Free |
| Enhance `nonFixedVoip` detection | LOW | HIGH | Free (Twilio provides) |

**Implementation Code:**

```typescript
// Enhanced phone verification with Twilio v2
async function enhancedPhoneVerify(phone: string) {
  // Parallel lookups
  const [numverify, twilio, ipqs, callcontrol, ftc] = await Promise.all([
    validateWithNumverify(phone),
    twilioLookupV2(phone),
    ipqsPhoneLookup(phone),
    queryCallControl(phone),
    queryFTCDNC(phone)
  ]);
  
  // Calculate risk with new flags
  const result = analyzePhoneRisk({
    numverify,
    twilio,
    ipqs,
    callcontrol,
    ftc
  });
  
  return result;
}

async function twilioLookupV2(phone: string) {
  const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  
  return await client.lookups.v2
    .phoneNumbers(phone)
    .fetch({ 
      fields: 'line_type_intelligence,caller_name,sms_pumping_risk' 
    });
}
```

---

### Phase 2: Short-term (2-4 weeks)

| Task | Effort | Impact | Cost |
|------|--------|--------|------|
| Add YouMail Data API | MEDIUM | HIGH | Enterprise pricing |
| Implement `recently_disconnected` scoring | MEDIUM | HIGH | Uses IPQS |
| Add impersonation pattern detection | MEDIUM | HIGH | Pattern matching |
| Build scam script keyword database | MEDIUM | MEDIUM | Manual curation |

**Impersonation Pattern Detection:**

```typescript
// Common scam script patterns
const SCAM_PATTERNS = {
  account_security: [
    'account security department',
    'suspicious login attempt',
    'unusual activity detected',
    'your account has been compromised',
    'press 1 to block',
    'press 1 to speak to representative'
  ],
  tech_support: [
    'your computer has been infected',
    'microsoft support',
    'apple security',
    'google account security',
    'windows license expired',
    'virus detected on your device'
  ],
  government: [
    'social security administration',
    'irs',
    'tax fraud',
    'arrest warrant',
    'deportation',
    'legal action'
  ],
  prize_scam: [
    'you have won',
    'lottery winner',
    'prize claim',
    'free vacation',
    'congratulations you have been selected'
  ]
};

function detectImpersonationPattern(transcript: string): { 
  detected: boolean; 
  type: string; 
  matches: string[];
  points: number;
} {
  const lower = transcript.toLowerCase();
  const matches: string[] = [];
  let type = '';
  
  for (const [category, patterns] of Object.entries(SCAM_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        matches.push(pattern);
        type = category;
      }
    }
  }
  
  // Score based on pattern severity
  const severityScore: Record<string, number> = {
    account_security: 25,
    tech_support: 25,
    government: 20,
    prize_scam: 15
  };
  
  return {
    detected: matches.length > 0,
    type,
    matches,
    points: matches.length > 0 ? severityScore[type] || 15 : 0
  };
}
```

---

### Phase 3: Medium-term (1-2 months)

| Task | Effort | Impact | Cost |
|------|--------|--------|------|
| Add Hiya API integration | MEDIUM | MEDIUM | Enterprise |
| Add RoboKiller API | MEDIUM | MEDIUM | Enterprise |
| Build real-time STIR/SHAKEN verification | HIGH | HIGH | Carrier integration |
| Implement geographic mismatch detection | MEDIUM | MEDIUM | Free |

---

### Phase 4: Long-term (3+ months)

| Task | Effort | Impact | Cost |
|------|--------|--------|------|
| Machine learning scam voice detection | HIGH | HIGH | GPU costs |
| Real-time call audio analysis | HIGH | HIGH | Infrastructure |
| FCC database bulk import pipeline | MEDIUM | MEDIUM | Free data, infra cost |

---

## 6. UI Recommendations

### Scan Results Page Enhancements

#### 6.1 Scam Call Warning Banner

```
┌─────────────────────────────────────────────────────────────────┐
│  🚨 SCAM CALL DETECTED                                          │
│                                                                 │
│  This call shows STRONG indicators of a scam operation:         │
│  • Classic "account security" impersonation pattern             │
│  • Number was recently disconnected (scammer rotation)          │
│  • 51 community reports flagging as scam                        │
│  • Non-fixed VoIP number (anonymous, untraceable)               │
│                                                                 │
│  DO NOT press 1 or provide any information.                     │
│  Block this number immediately.                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2 Risk Score Breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│  Risk Score: 8.5/10 — CRITICAL                                  │
│                                                                 │
│  Red Flags Detected:                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ⛔ non_fixed_voip (+20pts)                                     │
│      Google Voice/TextNow/Burner - anonymous, no ID required    │
│                                                                 │
│  ⛔ recently_disconnected (+15pts)                              │
│      Number active 3 days ago, now dead - scammer rotation      │
│                                                                 │
│  ⛔ impersonation_pattern (+25pts)                              │
│      "account security" / "suspicious login" detected           │
│                                                                 │
│  ⛔ community_reports (+10pts)                                  │
│      51 reports on 800notes/whocalledme                         │
│                                                                 │
│  ⛔ sms_pumping_risk (+5pts)                                    │
│      Number associated with mass SMS operations                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.3 Scam Type Classification

```
┌─────────────────────────────────────────────────────────────────┐
│  Scam Type: ACCOUNT SECURITY IMPERSONATION                      │
│                                                                 │
│  This is a common scam pattern where fraudsters claim:          │
│  • Your Google/Apple/Microsoft account is compromised           │
│  • A suspicious login was detected                              │
│  • You must "press 1" to block the access                       │
│                                                                 │
│  What they want:                                                │
│  • Your login credentials                                       │
│  • 2FA codes                                                    │
│  • Remote access to your device                                 │
│                                                                 │
│  How to protect yourself:                                       │
│  ✓ Hang up immediately                                          │
│  ✓ Do NOT press any buttons                                    │
│  ✓ Check your account directly at the official website         │
│  ✓ Block the number                                             │
│  ✓ Report to reportfraud.ftc.gov                               │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.4 Number History Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│  Number History: +1-864-866-8857                                │
│                                                                 │
│  Timeline:                                                      │
│  ─────────────────────────────────────────────────────────────  │
│  Apr 20, 2026  First community report (800notes)                │
│  Apr 21, 2026  12 reports - "account security scam"             │
│  Apr 22, 2026  25 reports - multiple victims                    │
│  Apr 23, 2026  40 reports - FTC complaint filed                 │
│  Apr 24, 2026  51 reports - number disconnected                 │
│  Apr 26, 2026  SCAN - YOU ARE HERE                              │
│                                                                 │
│  ⚠️ Number was disconnected 2 days ago after scam campaign.    │
│     Scammers likely moved to a new number.                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Code Snippets for Key Integrations

### 7.1 Complete Enhanced Phone Verify Handler

```typescript
// Enhanced phone-verify.ts with new integrations
import twilio from 'twilio';

interface EnhancedPhoneResult extends PhoneRiskResult {
  enhancedIntel: {
    lineTypeIntelligence: {
      type: 'mobile' | 'landline' | 'fixedVoip' | 'nonFixedVoip' | 'tollFree';
      carrier: string;
      mobileCountryCode?: string;
      mobileNetworkCode?: string;
    } | null;
    callerIdentity: {
      name: string | null;
      type: 'BUSINESS' | 'CONSUMER' | 'UNKNOWN';
    } | null;
    smsPumpingRisk: {
      score: number;
      level: 'LOW' | 'MEDIUM' | 'HIGH';
    } | null;
    numberStatus: {
      active: boolean;
      disconnected: boolean;
      disconnectedDate?: string;
      lastActive?: string;
    } | null;
    abuseHistory: {
      recentAbuse: boolean;
      fraudScore: number;
      spamReports: number;
    } | null;
    impersonationAnalysis: {
      detected: boolean;
      type: string;
      patterns: string[];
    } | null;
  };
}

async function performEnhancedLookup(phone: string): Promise<EnhancedPhoneResult> {
  // Run all lookups in parallel
  const [numverify, twilioData, ipqs, callcontrol, ftc, community] = await Promise.all([
    validateWithNumverify(phone),
    twilioEnhancedLookup(phone),
    ipqsPhoneLookup(phone),
    queryCallControl(phone),
    queryFTCDNC(phone),
    scrapeCommunityReports(phone)
  ]);
  
  // Build enhanced intel
  const enhancedIntel = {
    lineTypeIntelligence: twilioData?.lineTypeIntelligence ? {
      type: twilioData.lineTypeIntelligence.type,
      carrier: twilioData.lineTypeIntelligence.carrier_name,
      mobileCountryCode: twilioData.lineTypeIntelligence.mobile_country_code,
      mobileNetworkCode: twilioData.lineTypeIntelligence.mobile_network_code
    } : null,
    callerIdentity: twilioData?.callerName ? {
      name: twilioData.callerName.caller_name,
      type: twilioData.callerName.caller_type
    } : null,
    smsPumpingRisk: twilioData?.smsPumpingRisk ? {
      score: twilioData.smsPumpingRisk.risk_score,
      level: getRiskLevel(twilioData.smsPumpingRisk.risk_score)
    } : null,
    numberStatus: ipqs ? {
      active: ipqs.active,
      disconnected: !ipqs.active,
      lastActive: ipqs.last_active
    } : null,
    abuseHistory: ipqs ? {
      recentAbuse: ipqs.recent_abuse,
      fraudScore: ipqs.fraud_score,
      spamReports: ipqs.spam
    } : null,
    impersonationAnalysis: null // Would need transcript
  };
  
  // Calculate enhanced risk score
  const riskAnalysis = calculateEnhancedRisk({
    numverify,
    twilio: twilioData,
    ipqs,
    callcontrol,
    ftc,
    community,
    enhancedIntel
  });
  
  return {
    ...riskAnalysis,
    enhancedIntel
  };
}

async function twilioEnhancedLookup(phone: string) {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  
  try {
    return await client.lookups.v2
      .phoneNumbers(phone)
      .fetch({ 
        fields: 'line_type_intelligence,caller_name,sms_pumping_risk' 
      });
  } catch (error) {
    console.error('Twilio lookup failed:', error);
    return null;
  }
}

function calculateEnhancedRisk(data: any): PhoneRiskResult {
  let totalPoints = 0;
  const redFlags: string[] = [];
  
  // 1. Non-fixed VoIP detection (NEW - HIGH VALUE)
  if (data.twilio?.lineTypeIntelligence?.type === 'nonFixedVoip') {
    redFlags.push(`non_fixed_voip (20pts) — ${data.twilio.lineTypeIntelligence.carrier_name} — Anonymous VoIP number requiring no identity verification`);
    totalPoints += 20;
  }
  
  // 2. Recently disconnected (NEW)
  if (data.ipqs?.active === false) {
    redFlags.push(`recently_disconnected (15pts) — Number was recently active but now unreachable — classic scammer rotation pattern`);
    totalPoints += 15;
  }
  
  // 3. Recent abuse activity (NEW)
  if (data.ipqs?.recent_abuse) {
    redFlags.push(`recent_abuse_activity (20pts) — Number actively used in spam/fraud campaigns within last 30 days`);
    totalPoints += 20;
  }
  
  // 4. SMS pumping risk (NEW)
  if (data.twilio?.smsPumpingRisk?.risk_score >= 50) {
    redFlags.push(`sms_pumping_detected (15pts) — High SMS pumping fraud risk score: ${data.twilio.smsPumpingRisk.risk_score}`);
    totalPoints += 15;
  }
  
  // 5. Existing checks...
  // [Include existing flag logic from current implementation]
  
  // Convert to 0-10 scale
  const riskScore = Math.min(10, totalPoints / 9);
  const riskLevel = getRiskLevel(riskScore);
  
  return {
    valid: data.numverify?.valid ?? true,
    phone: data.phone,
    formatted: data.numverify?.international_format || data.phone,
    country: data.numverify?.country_name || 'Unknown',
    countryCode: data.numverify?.country_code || '',
    carrier: data.twilio?.lineTypeIntelligence?.carrier_name || data.numverify?.carrier || '',
    lineType: data.twilio?.lineTypeIntelligence?.type || 'unknown',
    riskScore,
    riskLevel,
    redFlags,
    ownerType: determineOwnerType(data),
    scamOperationMatch: null,
    virtualCenterMatch: data.twilio?.lineTypeIntelligence?.type?.includes('Voip') 
      ? data.twilio.lineTypeIntelligence.carrier_name 
      : null,
    spamDialerMatch: null,
    recommendation: generateRecommendation(riskLevel, redFlags),
    disclaimer: 'Educational purposes only. Not financial advice. Not a guarantee of safety. Always do your own due diligence.',
    scanDate: new Date().toISOString(),
    threatIntel: buildThreatIntel(data)
  };
}
```

### 7.2 Impersonation Pattern Analysis (for voicemail transcription)

```typescript
// Call transcript analysis
function analyzeCallTranscript(transcript: string): {
  isScam: boolean;
  scamType: string;
  impersonatedCompany: string | null;
  actionRequested: string | null;
  urgencyLevel: 'low' | 'medium' | 'high';
} {
  const lower = transcript.toLowerCase();
  
  // Detect impersonated company
  const companies = {
    'google': ['google', 'gmail', 'google account'],
    'apple': ['apple', 'icloud', 'apple id', 'iphone'],
    'microsoft': ['microsoft', 'windows', 'outlook', 'office 365'],
    'amazon': ['amazon', 'prime', 'alexa'],
    'facebook': ['facebook', 'instagram', 'meta'],
    'bank': ['bank', 'credit union', 'chase', 'wells fargo', 'bank of america']
  };
  
  let impersonatedCompany: string | null = null;
  for (const [company, keywords] of Object.entries(companies)) {
    if (keywords.some(kw => lower.includes(kw))) {
      impersonatedCompany = company;
      break;
    }
  }
  
  // Detect action requested
  const actions = {
    'press_1': ['press 1', 'press one', 'hit 1'],
    'callback': ['call back', 'return call', 'call us'],
    'verify_account': ['verify your account', 'confirm your identity'],
    'provide_code': ['security code', 'verification code', 'one-time password']
  };
  
  let actionRequested: string | null = null;
  for (const [action, keywords] of Object.entries(actions)) {
    if (keywords.some(kw => lower.includes(kw))) {
      actionRequested = action;
      break;
    }
  }
  
  // Detect urgency tactics
  const urgencyKeywords = [
    'immediately', 'urgent', 'expire', 'suspend', 'block',
    '24 hours', '48 hours', 'final notice', 'last warning'
  ];
  const urgencyLevel = urgencyKeywords.filter(kw => lower.includes(kw)).length >= 2 
    ? 'high' 
    : urgencyKeywords.some(kw => lower.includes(kw)) 
      ? 'medium' 
      : 'low';
  
  // Determine scam type
  let scamType = 'unknown';
  if (lower.includes('account security') || lower.includes('suspicious') || lower.includes('login')) {
    scamType = 'account_security_impersonation';
  } else if (lower.includes('computer') || lower.includes('virus') || lower.includes('infected')) {
    scamType = 'tech_support_scam';
  } else if (lower.includes('won') || lower.includes('prize') || lower.includes('lottery')) {
    scamType = 'prize_scam';
  } else if (lower.includes('irs') || lower.includes('tax') || lower.includes('arrest')) {
    scamType = 'government_impersonation';
  }
  
  return {
    isScam: urgencyLevel === 'high' || !!impersonatedCompany || scamType !== 'unknown',
    scamType,
    impersonatedCompany,
    actionRequested,
    urgencyLevel
  };
}
```

---

## 8. Quick Wins: What to Implement Tomorrow

### 1. Add Twilio Lookup v2 (30 minutes)

```bash
# Install Twilio
npm install twilio

# Add to phone-verify.ts
```

### 2. Add IPQualityScore Integration (30 minutes)

```bash
# Sign up at ipqualityscore.com
# Get API key
# Add IPQS_PHONE_API_KEY to env
```

### 3. Update FLAG_VALUES (5 minutes)

Just add the new flags to the scoring system.

### 4. Add "Recently Disconnected" Badge to UI (1 hour)

When IPQS reports `active: false`, show a warning that this number was recently active but is now dead - classic scammer behavior.

---

## 9. Cost Estimates

| API | Cost per 1000 Lookups | Monthly Cost (10K scans) |
|-----|----------------------|--------------------------|
| Twilio Line Type | $8 | $80 |
| Twilio Caller Name | $10 | $100 |
| IPQualityScore | $10-20 | $100-200 |
| CallControl | Free tier available | $0-50 |
| YouMail | Enterprise | $200-500 |
| Hiya | Enterprise | $200-500 |
| CallerAPI | $4 | $40 |

**Recommended minimum stack:** Twilio Line Type + IPQualityScore = ~$15/1000 lookups

---

## 10. Next Steps

1. **Immediate:** Add Twilio Lookup v2 with line_type_intelligence
2. **This Week:** Add IPQualityScore for disconnected number detection
3. **Next Week:** Implement impersonation pattern detection in community reports
4. **Next Month:** Add YouMail or Hiya for carrier-grade spam detection

---

**Document prepared for Agentic Bro Phone Identifier enhancement project.**  
**Questions? Contact the development team.**