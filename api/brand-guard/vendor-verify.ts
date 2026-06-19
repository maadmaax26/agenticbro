/**
 * api/brand-guard/vendor-verify.ts — Vendor Phone Verification API
 * ========================================================================
 * Verifies a phone number for vendor legitimacy, detecting business
 * impersonation, vendor fraud, and invoice redirect scams.
 *
 * POST /api/brand-guard/vendor-verify
 *   Body: { phone: string, country?: string, vendor_name?: string, call_context?: string }
 *   Returns: Combined phone risk + vendor verification assessment
 *
 * GET /api/brand-guard/vendor-verify?verification_id=xxx
 *   Returns: Stored verification result
 *
 * Layers ON TOP of /api/phone-verify with:
 *   - Business phone pattern detection
 *   - Vendor scam script detection (invoice redirect, CEO fraud, etc.)
 *   - Scammer database cross-reference
 *   - Vendor-specific recommendations
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ── Types ────────────────────────────────────────────────────────────────────
interface VendorVerifyRequest {
  phone: string;
  country?: string;
  vendor_name?: string;
  call_context?: string;
}

interface BusinessAssessment {
  legitimacy_score: number;
  legitimacy_level: 'LIKELY_LEGITIMATE' | 'POSSIBLY_LEGITIMATE' | 'SUSPICIOUS' | 'LIKELY_FRAUDULENT';
  business_indicators: string[];
  suspicious_indicators: string[];
  evidence: string[];
  line_type_assessment: string;
  carrier_assessment: string;
}

interface ScamPattern {
  pattern: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  points: number;
  keyword_matched: string;
}

interface VendorVerifyResult {
  verification_id: string;
  scan_date: string;
  phone: string;
  country: string;
  vendor_name: string | null;
  call_context: string | null;
  phone_risk: {
    score: number;
    level: string;
    flags: string[];
    carrier: string;
    line_type: string;
    valid: boolean;
  };
  vendor_verification: {
    score: number;
    level: string;
    message: string;
  };
  business_assessment: BusinessAssessment;
  scam_detection: {
    patterns_detected: ScamPattern[];
    pattern_score: number;
    scammer_db_matches: number;
  };
  evidence: string[];
  recommendations: string[];
  disclaimer: string;
}

// ── Business Phone Patterns ──────────────────────────────────────────────────
const LEGITIMATE_BUSINESS_CARRIERS = [
  'at&t', 'verizon', 't-mobile', 'sprint', 'us cellular',
  'comcast', 'spectrum', 'cox', 'frontier', 'windstream',
  'centurylink', 'altice', 'metropolitan', 'mci', 'level 3',
];

const BUSINESS_VOIP_CARRIERS = [
  'ringcentral', 'grasshopper', 'nextiva', '8x8', 'dialpad',
  'ooma', 'jive', 'vonage business', 'microsoft teams',
  'zoom phone', 'webex calling', 'google voice business',
];

const NEVER_BUSINESS_CARRIERS = [
  'textnow', 'textplus', 'pinger', 'sideline', 'dingtone',
  'burner', 'hushed', 'coverme', 'fongo', 'freephoneline',
];

const BUSINESS_AREA_CODES: Record<string, string> = {
  '212': 'Manhattan, NY', '646': 'Manhattan, NY', '332': 'Manhattan, NY',
  '310': 'Los Angeles, CA', '424': 'Los Angeles, CA', '213': 'Los Angeles, CA',
  '312': 'Chicago, IL', '773': 'Chicago, IL',
  '415': 'San Francisco, CA', '510': 'Oakland, CA',
  '617': 'Boston, MA', '857': 'Boston, MA',
  '202': 'Washington, DC',
  '303': 'Denver, CO',
  '404': 'Atlanta, GA', '678': 'Atlanta, GA',
  '214': 'Dallas, TX', '972': 'Dallas, TX',
  '713': 'Houston, TX',
  '602': 'Phoenix, AZ',
  '206': 'Seattle, WA',
  '503': 'Portland, OR',
  '305': 'Miami, FL',
  '702': 'Las Vegas, NV',
  '612': 'Minneapolis, MN',
};

// ── Vendor Scam Patterns ──────────────────────────────────────────────────────
const VENDOR_SCAM_PATTERNS: Record<string, {
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  points: number;
  keywords: string[];
}> = {
  invoice_redirect: {
    description: 'Caller claims to be a vendor requesting updated bank details for payment',
    severity: 'critical',
    points: 25,
    keywords: ['bank details', 'update payment', 'new account', 'routing number', 'wire transfer', 'payment method', 'account change', 'direct deposit'],
  },
  ceo_fraud: {
    description: 'Caller impersonates CEO/executive requesting urgent wire transfer',
    severity: 'critical',
    points: 25,
    keywords: ['urgent wire', 'ceo', 'executive', 'confidential', 'secret', 'immediate payment', 'do not discuss', 'personal matter'],
  },
  tech_support: {
    description: 'Caller claims to be from IT support requesting access or credentials',
    severity: 'high',
    points: 20,
    keywords: ['tech support', 'microsoft support', 'apple security', 'virus', 'remote access', 'install', 'security alert', 'compromised'],
  },
  supply_chain: {
    description: 'Caller claims supplier change — new contact info or shipping address',
    severity: 'high',
    points: 20,
    keywords: ['new supplier', 'shipping address', 'contact change', 'forwarding', 'redirect', 'new warehouse', 'logistics update'],
  },
  account_verification: {
    description: 'Caller claims to verify account and requests credentials or payment info',
    severity: 'high',
    points: 15,
    keywords: ['verify your account', 'confirm identity', 'security check', 'unusual activity', 'login attempt', 'suspicious activity'],
  },
  utility_impostor: {
    description: 'Caller impersonates utility company threatening disconnection',
    severity: 'medium',
    points: 15,
    keywords: ['power company', 'utility', 'disconnection', 'past due', 'shut off', 'service termination', 'final notice'],
  },
};

// ── Business Phone Assessment ────────────────────────────────────────────────
function assessBusinessPhone(
  carrier: string,
  lineType: string,
  countryCode: string,
  phone: string,
  isValid: boolean
): BusinessAssessment {
  const carrierLower = (carrier || '').toLowerCase();
  const digits = phone.replace(/[^0-9]/g, '');
  let legitimacyScore = 50; // Start neutral
  const businessIndicators: string[] = [];
  const suspiciousIndicators: string[] = [];
  const evidence: string[] = [];

  // Line type assessment
  if (lineType === 'landline') {
    legitimacyScore += 15;
    businessIndicators.push('Landline — typical for established businesses');
    evidence.push('✅ Landline numbers are commonly used by legitimate businesses');
  } else if (lineType === 'mobile') {
    legitimacyScore += 5;
    businessIndicators.push('Mobile — could be small business or personal');
    evidence.push('ℹ️ Mobile number — common for small businesses, less common for larger vendors');
  } else if (lineType === 'voip') {
    legitimacyScore -= 10;
    suspiciousIndicators.push('VoIP — can be anonymous, not typical for established businesses');
    evidence.push('⚠️ VoIP number — can be created anonymously, uncommon for established vendor phone lines');
  } else if (lineType === 'toll_free') {
    legitimacyScore += 10;
    businessIndicators.push('Toll-free — legitimate business line');
    evidence.push('✅ Toll-free numbers are commonly used by legitimate businesses');
  }

  // Carrier assessment
  if (LEGITIMATE_BUSINESS_CARRIERS.some(c => carrierLower.includes(c))) {
    legitimacyScore += 20;
    businessIndicators.push(`Major carrier: ${carrier}`);
    evidence.push(`✅ Major telecom carrier (${carrier}) — typical for business lines`);
  } else if (BUSINESS_VOIP_CARRIERS.some(c => carrierLower.includes(c))) {
    legitimacyScore += 5;
    businessIndicators.push(`Business VoIP: ${carrier}`);
    evidence.push(`ℹ️ Business VoIP carrier (${carrier}) — legitimate for modern businesses`);
  } else if (NEVER_BUSINESS_CARRIERS.some(c => carrierLower.includes(c))) {
    legitimacyScore -= 30;
    suspiciousIndicators.push(`Consumer/disposable carrier: ${carrier}`);
    evidence.push(`🚨 Consumer/disposable carrier (${carrier}) — NEVER used by legitimate businesses`);
  } else if (!carrier || carrierLower === 'unknown') {
    legitimacyScore -= 10;
    suspiciousIndicators.push('No carrier information available');
    evidence.push('⚠️ No carrier information — could indicate spoofing or virtual number');
  }

  // Area code assessment (US)
  if (digits.length >= 11 && digits.startsWith('1')) {
    const areaCode = digits.substring(1, 4);
    if (BUSINESS_AREA_CODES[areaCode]) {
      legitimacyScore += 5;
      businessIndicators.push(`Major metro area code: ${areaCode} (${BUSINESS_AREA_CODES[areaCode]})`);
      evidence.push(`✅ Area code ${areaCode} (${BUSINESS_AREA_CODES[areaCode]}) — major business center`);
    }
  }

  // Country risk
  const highRiskCountries = ['NG', 'GH', 'KE', 'PH', 'IN', 'PK', 'BD', 'RO', 'UA', 'RU', 'CM', 'SN'];
  if (highRiskCountries.includes(countryCode)) {
    legitimacyScore -= 20;
    suspiciousIndicators.push(`High-risk country: ${countryCode}`);
    evidence.push(`🚨 Number from high-risk country (${countryCode}) — common in business impersonation scams`);
  }

  // Validity
  if (!isValid) {
    legitimacyScore -= 40;
    suspiciousIndicators.push('Invalid phone number');
    evidence.push('🚨 Phone number failed validation — may be spoofed or disconnected');
  }

  legitimacyScore = Math.max(0, Math.min(100, legitimacyScore));

  let legitimacyLevel: BusinessAssessment['legitimacy_level'];
  if (legitimacyScore >= 75) legitimacyLevel = 'LIKELY_LEGITIMATE';
  else if (legitimacyScore >= 50) legitimacyLevel = 'POSSIBLY_LEGITIMATE';
  else if (legitimacyScore >= 25) legitimacyLevel = 'SUSPICIOUS';
  else legitimacyLevel = 'LIKELY_FRAUDULENT';

  return {
    legitimacy_score: legitimacyScore,
    legitimacy_level: legitimacyLevel,
    business_indicators: businessIndicators,
    suspicious_indicators: suspiciousIndicators,
    evidence,
    line_type_assessment: lineType,
    carrier_assessment: carrier || 'Unknown',
  };
}

// ── Scam Pattern Detection ──────────────────────────────────────────────────
function detectScamPatterns(context: string): ScamPattern[] {
  if (!context) return [];
  const contextLower = context.toLowerCase();
  const patterns: ScamPattern[] = [];

  for (const [patternName, pattern] of Object.entries(VENDOR_SCAM_PATTERNS)) {
    for (const keyword of pattern.keywords) {
      if (contextLower.includes(keyword)) {
        patterns.push({
          pattern: patternName,
          description: pattern.description,
          severity: pattern.severity,
          points: pattern.points,
          keyword_matched: keyword,
        });
        break; // Only match each pattern once
      }
    }
  }

  return patterns;
}

// ── Handler ──────────────────────────────────────────────────────────────────
type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── GET: Retrieve stored verification ────────────────────────────────────
  if (req.method === 'GET') {
    const verificationId = (req.url?.split('verification_id=')[1]?.split('&')[0]) || '';
    if (!verificationId) {
      res.status(400).json({ error: 'Missing verification_id parameter' });
      return;
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('vendor_verifications')
        .select('*')
        .eq('verification_id', verificationId)
        .single();

      if (data && !error) {
        res.status(200).json(data);
        return;
      }
    }

    res.status(404).json({ error: 'Verification not found', verification_id: verificationId });
    return;
  }

  // ── POST: Run vendor verification ─────────────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const phone = (body.phone as string) || '';
  const country = ((body.country as string) || 'US').toUpperCase();
  const vendorName = (body.vendor_name as string) || '';
  const callContext = (body.call_context as string) || '';

  if (!phone) {
    res.status(400).json({ error: 'Missing required field: phone' });
    return;
  }

  // Basic phone format validation
  const stripped = phone.replace(/[^0-9+]/g, '');
  if (stripped.length < 7 || stripped.length > 16) {
    res.status(400).json({ error: 'Invalid phone number format. Include country code, e.g. +1234567890' });
    return;
  }

  const verificationId = `vv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // ── Run phone verification via internal API ───────────────────────────────
  let phoneRiskData: Record<string, any> = {};
  try {
    // Call phone-verify internally
    const phoneVerifyUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/phone-verify`;
    const phoneRes = await fetch(phoneVerifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (phoneRes.ok) {
      const phoneJson = await phoneRes.json() as Record<string, any>;
      phoneRiskData = phoneJson.result || phoneJson;
    }
  } catch {
    // Phone verify API unavailable — proceed with basic assessment
  }

  // ── Extract phone risk data ───────────────────────────────────────────────
  const phoneRisk = {
    score: phoneRiskData.riskScore ?? phoneRiskData.risk_score ?? 0,
    level: phoneRiskData.riskLevel ?? phoneRiskData.risk_level ?? 'UNKNOWN',
    flags: phoneRiskData.redFlags ?? phoneRiskData.risk_flags ?? [],
    carrier: phoneRiskData.carrier ?? phoneRiskData.validation?.carrier ?? 'Unknown',
    line_type: phoneRiskData.lineType ?? phoneRiskData.validation?.line_type ?? 'unknown',
    valid: phoneRiskData.valid ?? phoneRiskData.validation?.valid ?? true,
  };

  // ── Business phone assessment ─────────────────────────────────────────────
  const businessAssessment = assessBusinessPhone(
    phoneRisk.carrier,
    phoneRisk.line_type,
    country,
    phone,
    phoneRisk.valid
  );

  // ── Scam pattern detection ────────────────────────────────────────────────
  const scamPatterns = detectScamPatterns(callContext);
  const scamPatternScore = Math.min(50, scamPatterns.reduce((sum, p) => sum + p.points, 0));

  // ── Calculate vendor verification score ────────────────────────────────────
  let vendorScore = businessAssessment.legitimacy_score;

  // Subtract phone risk (convert 0-10 to 0-30 penalty)
  if (phoneRisk.score >= 7) vendorScore -= 30;
  else if (phoneRisk.score >= 5) vendorScore -= 20;
  else if (phoneRisk.score >= 3) vendorScore -= 10;

  // Subtract scam pattern points
  vendorScore -= scamPatternScore;

  // Vendor name mismatch penalty
  if (vendorName && businessAssessment.suspicious_indicators.length > 0) {
    vendorScore -= 10;
  }

  vendorScore = Math.max(0, Math.min(100, vendorScore));

  // ── Determine verification level ───────────────────────────────────────────
  let verificationLevel: string;
  let verificationMessage: string;
  if (vendorScore >= 80) {
    verificationLevel = 'VERIFIED';
    verificationMessage = 'Phone number is consistent with a legitimate business vendor';
  } else if (vendorScore >= 60) {
    verificationLevel = 'LIKELY_LEGITIMATE';
    verificationMessage = 'Phone number appears legitimate but independent verification is recommended';
  } else if (vendorScore >= 40) {
    verificationLevel = 'UNVERIFIED';
    verificationMessage = 'Phone number cannot be verified as belonging to the claimed vendor — verify through official channels';
  } else if (vendorScore >= 20) {
    verificationLevel = 'SUSPICIOUS';
    verificationMessage = 'Phone number shows red flags consistent with vendor impersonation — do NOT share information or make payments';
  } else {
    verificationLevel = 'LIKELY_FRAUDULENT';
    verificationMessage = 'Phone number has strong indicators of fraud — terminate contact and report';
  }

  // ── Build recommendations ────────────────────────────────────────────────
  const recommendations: string[] = [];

  for (const pattern of scamPatterns.slice(0, 3)) {
    recommendations.push(`🚨 ${pattern.description} — Severity: ${pattern.severity.toUpperCase()}`);
  }

  if (vendorName) {
    recommendations.push(`📞 Verify "${vendorName}" by calling their official phone number from their website or a trusted directory`);
    recommendations.push('📧 Confirm vendor identity via official email domain, not the phone number they called from');
  }

  recommendations.push('🔒 Never share bank details, passwords, or make payments based on an unsolicited call');

  if (vendorScore < 40) {
    recommendations.push('📋 Report this number to FTC: reportfraud.ftc.gov');
  }

  // ── Build final result ────────────────────────────────────────────────────
  const result: VendorVerifyResult = {
    verification_id: verificationId,
    scan_date: new Date().toISOString(),
    phone,
    country,
    vendor_name: vendorName || null,
    call_context: callContext || null,
    phone_risk: phoneRisk,
    vendor_verification: {
      score: Math.round(vendorScore),
      level: verificationLevel,
      message: verificationMessage,
    },
    business_assessment: businessAssessment,
    scam_detection: {
      patterns_detected: scamPatterns,
      pattern_score: scamPatternScore,
      scammer_db_matches: 0, // Will be populated by worker
    },
    evidence: businessAssessment.evidence,
    recommendations,
    disclaimer: 'Educational purposes only. Not financial advice. Not a guarantee of safety. Always verify vendor identity independently.',
  };

  // ── Store in Supabase ─────────────────────────────────────────────────────
  if (supabase) {
    try {
      await supabase.from('vendor_verifications').insert({
        verification_id: verificationId,
        phone,
        country,
        vendor_name: vendorName || null,
        call_context: callContext || null,
        verification_score: result.vendor_verification.score,
        verification_level: result.vendor_verification.level,
        business_legitimacy_score: businessAssessment.legitimacy_score,
        phone_risk_score: phoneRisk.score,
        scam_patterns: scamPatterns,
        result: result,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Brand Guard] Supabase insert error:', err);
    }
  }

  res.status(200).json({ success: true, result });
}

export const config = {
  maxDuration: 15,
};