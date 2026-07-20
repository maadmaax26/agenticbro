> Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
> See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
> Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.

# Brand Guard — Design & Deployment Plan

**Product:** Brand Guard by Jeeevs / AgenticBro  
**Date:** May 2026 | **Version:** 1.0  
**Author:** Agentic Insights LLC  

---

## 1. Overview

Brand Guard extends AgenticBro's existing scam detection infrastructure to serve Small & Medium Businesses (SMBs). This plan covers **only features that can be built by enhancing current AgenticBro capabilities** — no new core technology required.

**Current AgenticBro Capabilities Leveraged:**
- 6-platform social profile scanning (X, Instagram, TikTok, Facebook, LinkedIn, Telegram)
- Chrome CDP real-time scanning (port 18801)
- Phone Number Identifier (12-signal risk scoring, Numverify + CallControl + FTC)
- Website Deep Scanner (domain reputation, WHOIS, SSL, phishing DBs)
- Cross-platform identity matching (unified scammer database, 278+ entries)
- Unified 90-point risk scoring system
- Supabase backend (scan tracking, job queues, results storage)
- REST API (10+ endpoints live on agenticbro.app)
- Stripe + USDC payment rails (already integrated)

---

## 2. Feature Build-Out — What We Can Build Now

### ✅ Feature 1: Brand Impersonator Detection
**Existing:** Multi-platform profile scanner (scan-source.sh), Chrome CDP, behavioral AI scoring  
**What to Build:** Brand-name matching layer on top of existing profile scan

#### Design
```
Input:  Brand name (e.g., "Acme Corp") + optional domain (e.g., "acmecorp.com")
Process:
  1. Generate search variants (brand name + common suffixes: "official", "real", "support")
  2. For each platform (X, IG, TikTok, FB, LinkedIn, Telegram):
     a. Search for brand name matches via existing scan pipelines
     b. Score each match using existing 90-point risk system
     c. Flag accounts with: stolen logos, bio keyword matches, impersonation patterns
  3. Cross-reference matches against scammer database (278+ known scammers)
  4. Return risk-scored list per platform with takedown recommendations
Output: Brand Impersonation Report (per-platform matches + cross-platform correlation)
```

#### Implementation Steps
| Step | Task | Effort | Dependency |
|------|------|--------|------------|
| 1.1 | Create `brand-guard/impersonator-detect.sh` — wraps scan-source.sh with brand name input | 1 day | scan-source.sh (exists) |
| 1.2 | Build brand variant generator (Levenshtein distance + common impersonator suffixes) | 2 days | New script |
| 1.3 | Add brand-name similarity scoring to existing profile_scan.py | 2 days | profile_scan.py (exists) |
| 1.4 | Create Supabase `brand_monitors` table (brand_name, domain, variants, scan_frequency, owner_id) | 1 day | Supabase (exists) |
| 1.5 | Build API endpoint `POST /api/brand-guard/impersonator-scan` | 2 days | social-scan.ts (exists) |
| 1.6 | Add scheduled brand monitoring cron (daily scan of registered brands) | 1 day | OpenClaw cron (exists) |
| **Total** | | **9 days** | |

#### Pricing: $29/mo (5 brands, weekly) | $99/mo (multi-brand, daily monitoring)

---

### ✅ Feature 2: Vendor Verification Phone Service
**Existing:** Phone Identifier API (phone-verify.ts), 12-signal scoring, Numverify + CallControl + FTC  
**What to Build:** SMB-facing wrapper with vendor-specific verification flow

#### Design
```
Input:  Phone number + optional context ("vendor claiming to be Acme Corp supplier")
Process:
  1. Run existing phone-verify.ts (12-signal scoring)
  2. Enhanced: Add vendor verification context
     a. Cross-reference phone against known scammer DB for business impersonation
     b. Check if phone appears in FTC complaints as "business impersonation"
     c. Flag VoIP/disposable numbers claiming to be business landlines
  3. New: Business phone pattern matching
     a. Legitimate business phones → landline, registered carrier, same area code as business
     b. Suspicious → VoIP, disposable, different country, spoofing indicators
  4. Return verification result with confidence score
Output: Vendor Verification Report (legitimate/suspicious/fraudulent + evidence)
```

#### Implementation Steps
| Step | Task | Effort | Dependency |
|------|------|--------|------------|
| 2.1 | Create `brand-guard/vendor-verify.sh` — wraps phone-scan-api.sh with vendor context | 1 day | phone-scan-api.sh (exists) |
| 2.2 | Add business phone pattern detection to phone_scorer.py | 2 days | phone_scorer.py (exists) |
| 2.3 | Create `api/vendor-verify.ts` — new endpoint with vendor context field | 2 days | phone-verify.ts (exists) |
| 2.4 | Add vendor verification results to Supabase `vendor_verifications` table | 1 day | Supabase (exists) |
| 2.5 | Build one-tap verify UI component (PhoneNumberVerifier.tsx pattern) | 2 days | PhoneNumberVerifier.tsx (exists on site) |
| **Total** | | **8 days** | |

#### Pricing: $1/scan PAYG | $20/mo (50 verifications)

---

### ✅ Feature 3: Website Lookalike Detector
**Existing:** Website Deep Scanner (website-deep-scan.ts), Supabase queue, domain analysis  
**What to Build:** Typosquatting variant generator + continuous domain monitoring

#### Design
```
Input:  Domain (e.g., "acmecorp.com")
Process:
  1. Generate typosquatting variants:
     a. Common misspellings (acmecop.com, acmecor.com)
     b. TLD swaps (acmecorp.net, acmecorp.co, acmecorp.io)
     c. Hyphen insertion (acme-corp.com, acmecorp-us.com)
     d. Character substitution (acmec0rp.com, acrnecorp.com)
     e. Prefix/suffix additions (myacmecorp.com, acmecorplogin.com)
  2. For each variant, run existing website-deep-scan.ts:
     a. Check domain registration (WHOIS)
     b. Check SSL certificate age/validity
     c. Check hosting provider reputation
     d. Cross-reference phishing databases
     e. Check domain age (< 30 days = high risk)
  3. Score and rank variants by threat level
  4. Store baseline: legitimate domain characteristics for comparison
  5. Schedule weekly re-scans for ongoing monitoring
Output: Lookalike Report (risk-scored variant list + priority takedown order)
```

#### Implementation Steps
| Step | Task | Effort | Dependency |
|------|------|--------|------------|
| 3.1 | Build typosquatting variant generator script | 3 days | New |
| 3.2 | Create batch wrapper around website-deep-scan.ts for multiple domains | 2 days | website-deep-scan.ts (exists) |
| 3.3 | Add WHOIS integration (python-whois or RDAP API) | 2 days | New dependency |
| 3.4 | Create Supabase `domain_monitors` table (domain, variants, baseline, scan_history) | 1 day | Supabase (exists) |
| 3.5 | Build API endpoint `POST /api/brand-guard/domain-monitor` | 2 days | website-deep-scan.ts (exists) |
| 3.6 | Add weekly domain monitoring cron | 1 day | OpenClaw cron (exists) |
| **Total** | | **11 days** | |

#### Pricing: $49/mo (1 domain, continuous monitoring, weekly threat report)

---

### ✅ Feature 4: Cross-Channel Threat Correlation
**Existing:** Cross-platform identity matching, phone identifier, unified scammer DB, behavioral consistency tracking  
**What to Build:** Correlation engine that links social + phone + domain threats into unified profiles

#### Design
```
Input:  Brand name or detected threat from any single channel
Process:
  1. When impersonator detected on social:
     a. Extract phone numbers from bio/comments/DMs
     b. Run phone identifier on each number
     c. Extract URLs/domains from profile
     d. Run website deep scan on each domain
  2. When suspicious phone number detected:
     a. Search scammer DB for associated social accounts
     b. Cross-reference domain in caller ID info
  3. When lookalike domain detected:
     a. Search social platforms for accounts linking to that domain
     b. Cross-reference phone numbers in domain WHOIS/registration
  4. Build unified threat profile:
     a. Link all channels to single operator (same phone, same bio text, same domain)
     b. Calculate aggregate risk score across all channels
     c. Assign threat ID for tracking
Output: Unified Threat Profile (linked channels + aggregate risk + takedown priority)
```

#### Implementation Steps
| Step | Task | Effort | Dependency |
|------|------|--------|------------|
| 4.1 | Create `brand-guard/correlate-threats.ts` — cross-references scan results | 3 days | All existing scanners |
| 4.2 | Add `threat_profiles` Supabase table (threat_id, channels, linked_entities, risk_aggregate) | 1 day | Supabase (exists) |
| 4.3 | Build correlation engine: phone→social, social→domain, domain→phone | 3 days | scammer-database.csv (exists) |
| 4.4 | Create API endpoint `POST /api/brand-guard/correlate` | 2 days | New |
| 4.5 | Integrate correlation into impersonator + domain monitor scan flows | 2 days | Features 1, 2, 3 |
| **Total** | | **11 days** | |

#### Pricing: Bundled in Brand Guard Premium ($149/mo)

---

### ✅ Feature 5: Reputation Dashboard + Takedown Automation
**Existing:** REST API (all endpoints), Supabase, scan results, phone identifier  
**What to Build:** SMB-facing dashboard aggregating all threats + pre-built takedown templates

#### Design
```
Dashboard Components:
  1. Threat Feed — unified list of all detected threats across channels
  2. Risk Heatmap — threat density by platform (visual)
  3. Brand Health Score — aggregate brand protection score (0-100)
  4. Takedown Center:
     a. Pre-populated platform abuse report forms (X, IG, TikTok, FB, LinkedIn)
     b. Cease & desist letter templates (US jurisdiction)
     c. Evidence package generator (screenshot + risk report PDF)
  5. Alert Configuration:
     a. Email alerts for new threats
     b. Severity thresholds (LOW/MEDIUM/HIGH/CRITICAL)
     c. Weekly digest option
```

#### Implementation Steps
| Step | Task | Effort | Dependency |
|------|------|--------|------------|
| 5.1 | Design dashboard wireframes (Figma) | 3 days | New |
| 5.2 | Build React dashboard shell + routing | 3 days | Next.js (exists on site) |
| 5.3 | Build Threat Feed component (aggregates from Supabase scan results) | 3 days | Supabase (exists) |
| 5.4 | Build Brand Health Score component | 2 days | Scoring engine (exists) |
| 5.5 | Build Takedown Center (template generator + pre-populated forms) | 4 days | New |
| 5.6 | Build Alert Configuration UI | 2 days | New (email service) |
| 5.7 | Add email alert service (Resend or SendGrid) | 2 days | New dependency |
| 5.8 | Integrate all Brand Guard features into unified dashboard | 3 days | Features 1-4 |
| **Total** | | **22 days** | |

#### Pricing: Free (5 brands, weekly scan) | Pro $79/mo (unlimited, daily scans, takedown automation)

---

### ⚠️ Feature 6: Email Spoofing Monitor (DEFERRED — Needs New Infrastructure)
**Why Deferred:** Requires email parsing infrastructure, DMARC/SPF/DKIM analysis tools, and email monitoring that don't exist in AgenticBro today. The website scanner can check domain reputation but cannot monitor email traffic or parse DMARC records yet.

**Path to V1:** Build DMARC/SPF/DKIM lookup module (3-4 weeks additional), then integrate into dashboard. Estimate: 15-18 days once started.

---

### ⚠️ Feature 7: Integration Ecosystem (DEFERRED — Requires Stable Dashboard)
**Why Deferred:** Zapier/Shopify/Wave integrations need a stable, tested dashboard and API surface first. Premature until Features 1-5 are validated with real SMB users.

**Path to V1:** After dashboard is live with 50+ beta users, build Zapier connector (5 days), Shopify app (10 days), Wave integration (5 days). Estimate: 20 days once started.

---

## 3. Build Sequence & Sprint Plan

### Sprint 1: Foundation (Days 1-14)

**Week 1 — Core Scanning Features**
| Day | Feature 1 (Impersonator) | Feature 2 (Phone) | Feature 3 (Domain) |
|-----|--------------------------|--------------------|--------------------|
| 1-2 | brand variant generator + impersonator-detect.sh | vendor-verify.sh wrapper | typosquatting generator (start) |
| 3-4 | brand-name similarity scoring in profile_scan.py | business phone pattern detection | typosquatting generator (finish) |
| 5 | Supabase brand_monitors table | Supabase vendor_verifications table | batch domain scanner wrapper |
| 6-7 | API endpoint + testing | API endpoint + one-tap UI | WHOIS integration |

**Week 2 — Integration + Monitoring**
| Day | Feature 1 | Feature 2 | Feature 3 |
|-----|-----------|-----------|-----------|
| 8-9 | Scheduled brand monitoring cron | Vendor verify testing + edge cases | Domain monitor cron setup |
| 10 | Cross-platform testing (6 platforms) | Load testing | Variant accuracy testing |
| 11-12 | Bug fixes + documentation | Bug fixes + documentation | Bug fixes + documentation |
| 13-14 | Beta tester onboarding | Beta tester onboarding | Beta tester onboarding |

### Sprint 2: Correlation + Dashboard (Days 15-35)

**Week 3 — Cross-Channel Correlation**
| Day | Feature 4 (Correlation) | Feature 5 (Dashboard) |
|-----|--------------------------|------------------------|
| 15-17 | Correlation engine build | Dashboard wireframes |
| 18-19 | Threat profiles + DB schema | React dashboard shell |
| 20-21 | API endpoint + integration | Threat Feed component |

**Week 4-5 — Dashboard Build**
| Day | Feature 4 | Feature 5 |
|-----|-----------|-----------|
| 22-24 | Integration with Features 1-3 | Brand Health Score + Risk Heatmap |
| 25-27 | End-to-end correlation testing | Takedown Center + templates |
| 28-30 | Performance optimization | Alert Configuration + email service |
| 31-35 | Bug fixes + edge cases | Integration + polish + beta testing |

### Sprint 3: Polish + Launch (Days 36-60)

| Day | Task |
|-----|------|
| 36-40 | Full integration testing (all 5 features) |
| 41-45 | Security audit + load testing |
| 46-50 | Landing page + onboarding flow + free trial |
| 51-55 | Documentation + support knowledge base |
| 56-60 | Public launch: Product Hunt + LinkedIn + r/smallbusiness |

---

## 4. Technical Architecture

### API Endpoints (New)
```
POST /api/brand-guard/impersonator-scan
  Body: { brand_name: string, domain?: string, platforms?: string[] }
  Returns: { scan_id, results: [{ platform, matches, risk_scores }] }

POST /api/brand-guard/vendor-verify
  Body: { phone: string, vendor_context?: string }
  Returns: { verification_id, risk_score, risk_level, flags, recommendation }

POST /api/brand-guard/domain-monitor
  Body: { domain: string, monitoring?: "once" | "weekly" | "daily" }
  Returns: { monitor_id, variants: [{ domain, risk_score, threat_level }] }

POST /api/brand-guard/correlate
  Body: { brand_name?: string, threat_id?: string }
  Returns: { threat_profile: { channels, linked_entities, aggregate_risk } }

GET  /api/brand-guard/dashboard?brand_id=xxx
  Returns: { threats: [], health_score, alerts: [], takedown_actions: [] }
```

### Supabase Tables (New)
```sql
-- Brand monitoring configuration
brand_monitors (
  id, owner_id, brand_name, domain, variants,
  platforms, scan_frequency, created_at, updated_at
)

-- Vendor verification history
vendor_verifications (
  id, owner_id, phone, vendor_context, risk_score, risk_level,
  flags, recommendation, created_at
)

-- Domain monitoring + lookalike tracking
domain_monitors (
  id, owner_id, domain, variants, baseline_score,
  last_scan, scan_frequency, created_at
)

-- Cross-channel threat profiles
threat_profiles (
  id, threat_id, brand_id, channels, linked_entities,
  aggregate_risk, status, created_at, updated_at
)

-- Takedown actions
takedown_actions (
  id, threat_id, platform, action_type, status,
  template_id, evidence_url, created_at, completed_at
)
```

### Cron Jobs (New)
```
brand-guard-daily-scan     → 6:00 AM EST daily → scan all registered brands
brand-guard-domain-check    → Every 15 min → check domain variants queue
brand-guard-weekly-report   → Monday 9:00 AM EST → generate threat digest emails
```

---

## 5. What We're NOT Building (Yet)

| Feature | Reason | Timeline |
|---------|--------|----------|
| Email Spoofing Monitor | Needs email parsing + DMARC infrastructure | Sprint 4 (15-18 days) |
| Zapier/Make Integration | Needs stable dashboard + 50+ beta users | Sprint 5 (5 days) |
| Shopify App | Needs App Store approval process (2-4 weeks) | Sprint 5-6 (10 days) |
| Wave Accounting Integration | Needs partnership + API access | Sprint 6 (5 days) |
| Google My Business API | Needs GMB API approval | Sprint 6 (5 days) |

---

## 6. Current Infrastructure Mapping

| Brand Guard Feature | AgenticBro Existing Capability | Enhancement Needed |
|---------------------|-------------------------------|-------------------|
| Brand Impersonator Detection | scan-source.sh (6 platforms) + profile_scan.py + 90-point scoring | Brand variant generator + similarity matching |
| Vendor Phone Verification | phone-verify.ts + phone_scorer.py + Numverify/CallControl/FTC | Vendor context layer + business phone patterns |
| Website Lookalike Detector | website-deep-scan.ts + Supabase queue | Typosquatting generator + WHOIS + batch scanning |
| Cross-Channel Correlation | scammer-database.csv + cross-platform identity matching | Correlation engine + threat profile schema |
| Reputation Dashboard | REST API + Supabase + all scan results | Dashboard UI + takedown templates + email alerts |
| Email Spoofing Monitor | Domain analysis (partial) | DMARC/SPF/DKIM parser + email monitoring (NEW) |
| Integration Ecosystem | REST API + Stripe | Zapier/Shopify connectors (NEW, post-launch) |

---

## 7. Success Metrics

| Metric | Sprint 1 Target | Sprint 2 Target | Launch Target |
|--------|----------------|----------------|---------------|
| Beta testers onboarded | 10 | 25 | 100 |
| Brand scans completed | 50 | 200 | 1,000 |
| Phone verifications | 50 | 500 | 5,000 |
| Domain variants monitored | 20 | 100 | 500 |
| Cross-channel correlations | 10 | 50 | 200 |
| Paying customers | — | 10 | 100 |
| Monthly recurring revenue | — | $500 | $4,900 |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Platform rate limiting (IG, TikTok) | Scans fail or slow | Use Chrome CDP fallback + staggered scheduling |
| WHOIS data accuracy | Domain lookalike false positives | Cross-reference 3+ sources + manual review flag |
| Brand name ambiguity (generic names) | Too many impersonator matches | Require domain + brand name for disambiguation |
| Dashboard development time | Delays Sprint 2-3 | Use existing Next.js patterns from agenticbro.app |
| Email deliverability for alerts | Alerts land in spam | Use Resend + proper SPF/DKIM setup |
| SMB onboarding friction | Low conversion | 14-day free trial + 1-click brand setup wizard |

---

## 9. Key Decisions Needed

1. **Dashboard first or Shopify first?** → Recommend standalone dashboard first (faster, no app store approval)
2. **Brand name: "Brand Guard" or "AgenticBro Brand Guard"?** → "Brand Guard" standalone for SMB market (they don't know crypto)
3. **Phone Verify: mobile app or web dashboard?** → Web dashboard for MVP (faster to ship)
4. **Pricing validation:** Run 10 SMB owner interviews before locking tiers
5. **Legal template scope:** Start with US jurisdiction cease & desist only, expand later

---

**Scan first, protect your brand later! 🔐**

*Agentic Insights LLC — agenticbro.app — $AGNTCBRO on Solana*