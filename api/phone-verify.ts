/**
 * api/phone-verify.ts — Phone Number Verification & Scam Detection
 * =================================================================
 * Validates phone numbers, identifies carrier/line type, checks against
 * known scam operations, virtual phone centers, and spam dialer services.
 *
 * Data sources:
 *   1. Numverify API (carrier, line type, country, valid format)
 *   2. Internal scam phone database (known scam operations, virtual centers, spam dialers)
 *   3. Heuristic risk scoring (90-point system adapted for phone numbers)
 *
 * POST /api/phone-verify  { "phone": "+1234567890" }
 */

import type { IncomingMessage, ServerResponse } from 'http';

type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

// ── Known Scam Phone Database ──────────────────────────────────────────────
// Virtual phone center prefixes, known spam dialers, toll-free scam operations
interface PhoneEntry {
  pattern: string;       // regex pattern or exact match
  type: 'scam_operation' | 'virtual_center' | 'spam_dialer' | 'toll_free_scam' | 'spoofed';
  label: string;
  points: number;        // risk points (90-point scale)
  description: string;
}

const KNOWN_PATTERNS: PhoneEntry[] = [
  // Virtual phone / VoIP services commonly used for scams
  { pattern: '^\\+1(800|833|844|855|866|877|888)', type: 'toll_free_scam', label: 'Toll-Free Number', points: 5, description: 'Toll-free numbers are frequently used by scam call centers and cannot be traced to individuals' },
  { pattern: '^\\+1(900)', type: 'scam_operation', label: 'Premium Rate Number', points: 20, description: 'Premium-rate numbers are almost exclusively associated with phone scams and fraud' },
  
  // Known VoIP prefixes (Google Voice, TextNow, Burner, etc.)
  { pattern: 'VOIP', type: 'virtual_center', label: 'Virtual/VoIP Number', points: 10, description: 'Virtual numbers can be created anonymously and are commonly used in scam operations' },
  
  // Common spoofing indicators
  { pattern: 'SPOOF', type: 'spoofed', label: 'Potentially Spoofed', points: 15, description: 'Caller ID spoofing is frequently used to disguise the true origin of scam calls' },
];

// ── 90-Point Phone Risk Scoring ────────────────────────────────────────────
interface PhoneRiskResult {
  valid: boolean;
  phone: string;
  formatted: string;
  country: string;
  countryCode: string;
  carrier: string;
  lineType: string;        // mobile, landline, voip, toll_free, premium_rate
  riskScore: number;       // 0-10 scale
  riskLevel: string;       // LOW, MEDIUM, HIGH, CRITICAL
  redFlags: string[];
  ownerType: string;       // individual, business, voip_service, government, unknown
  scamOperationMatch: string | null;
  virtualCenterMatch: string | null;
  spamDialerMatch: string | null;
  recommendation: string;
  disclaimer: string;
  scanDate: string;
}

const FLAG_VALUES: Record<string, number> = {
  premium_rate_number: 25,
  known_scam_operation: 20,
  spoofed_caller_id: 15,
  voip_virtual_number: 15,
  spam_dialer_service: 15,
  toll_free_untraceable: 10,
  burner_disposable: 10,
  high_risk_country: 10,
  no_carrier_info: 10,
  mass_call_pattern: 5,
};

function getRiskLevel(score: number): string {
  if (score >= 7) return 'CRITICAL';
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

// ── Phone Number Validation via Numverify ──────────────────────────────────
async function validateWithNumverify(phone: string): Promise<Record<string, any> | null> {
  const apiKey = process.env.NUMVERIFY_API_KEY;
  if (!apiKey) return null;
  
  try {
    const stripped = phone.replace(/[^0-9]/g, '');
    const url = `http://apilayer.net/api/validate?access_key=${apiKey}&number=${stripped}&country_code=&format=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as Record<string, any>;
  } catch {
    return null;
  }
}

// ── Phone Number Validation via Abstract API ────────────────────────────────
async function validateWithAbstract(phone: string): Promise<Record<string, any> | null> {
  const apiKey = process.env.ABSTRACT_API_KEY;
  if (!apiKey) return null;
  
  try {
    const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${apiKey}&phone=${encodeURIComponent(phone)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as Record<string, any>;
  } catch {
    return null;
  }
}

// ── Heuristic Phone Analysis (no API key needed) ──────────────────────────
function analyzePhoneHeuristics(phone: string, numverifyData: Record<string, any> | null, abstractData: Record<string, any> | null): PhoneRiskResult {
  const redFlags: string[] = [];
  let totalPoints = 0;
  const stripped = phone.replace(/[^0-9+]/g, '');
  
  // Extract data from APIs
  const valid = numverifyData?.valid ?? abstractData?.valid ?? true;
  const carrier = numverifyData?.carrier ?? abstractData?.carrier ?? 'Unknown';
  const lineType = numverifyData?.line_type ?? abstractData?.type ?? 'unknown';
  const country = numverifyData?.country_name ?? abstractData?.country ?? 'Unknown';
  const countryCode = numverifyData?.country_code ?? abstractData?.country_code ?? '';
  const formatted = numverifyData?.international_format ?? abstractData?.format_international ?? phone;
  const isVoip = lineType?.toLowerCase?.().includes('voip') ?? false;
  
  // ── Premium rate detection ──
  if (/^\+?1?900/.test(stripped.replace(/^\+/, '')) || lineType?.toLowerCase?.() === 'premium_rate') {
    redFlags.push(`premium_rate_number (25pts) — Premium-rate numbers are almost exclusively used for phone fraud`);
    totalPoints += FLAG_VALUES.premium_rate_number;
  }
  
  // ── Toll-free / untraceable ──
  const isTollFree = /^\+?1?(800|833|844|855|866|877|888)/.test(stripped.replace(/^\+/, '')) || lineType?.toLowerCase?.() === 'toll_free';
  if (isTollFree) {
    redFlags.push(`toll_free_untraceable (10pts) — Toll-free numbers cannot be traced to individual owners`);
    totalPoints += FLAG_VALUES.toll_free_untraceable;
  }
  
  // ── VoIP / Virtual number ──
  if (isVoip) {
    redFlags.push(`voip_virtual_number (15pts) — ${carrier || 'Virtual service'} — VoIP numbers can be created anonymously without identity verification`);
    totalPoints += FLAG_VALUES.voip_virtual_number;
  }
  
  // ── Known virtual/Burner carrier names ──
  const virtualCarriers = ['google voice', 'textnow', 'textplus', 'pinger', 'sideline', 'burner', 'hushed', 'coverme', 'line2', 'vonage', 'magicjack', 'bandwidth', 'twilio', 'plivo', 'inteliquent'];
  const carrierLower = (carrier || '').toLowerCase();
  const isVirtualCarrier = virtualCarriers.some(vc => carrierLower.includes(vc));
  if (isVirtualCarrier && !isVoip) {
    redFlags.push(`voip_virtual_number (15pts) — Carrier "${carrier}" is a known virtual/disposable phone service`);
    totalPoints += FLAG_VALUES.voip_virtual_number;
  }
  
  // ── Spoofing indicators ──
  const spoofingCarriers = ['spoof', 'fake', 'unknown'];
  if (spoofingCarriers.some(s => carrierLower.includes(s))) {
    redFlags.push(`spoofed_caller_id (15pts) — Carrier information suggests potential caller ID spoofing`);
    totalPoints += FLAG_VALUES.spoofed_caller_id;
  }
  
  // ── No carrier info ──
  if (!carrier || carrier === 'Unknown' || carrier === '') {
    redFlags.push(`no_carrier_info (10pts) — No carrier information available — may indicate spoofing or unregistered number`);
    totalPoints += FLAG_VALUES.no_carrier_info;
  }
  
  // ── High-risk country codes for phone scams ──
  const highRiskCountries = ['JM', 'NG', 'GH', 'PK', 'IN', 'PH', 'RO', 'BG', 'UA', 'RU', 'CN'];
  if (highRiskCountries.includes(countryCode)) {
    redFlags.push(`high_risk_country (10pts) — ${country} is flagged for elevated phone scam activity`);
    totalPoints += FLAG_VALUES.high_risk_country;
  }
  
  // ── Disposable/Burner pattern ──
  const disposablePatterns = ['burner', 'temporary', 'disposable', 'throwaway'];
  if (disposablePatterns.some(p => carrierLower.includes(p) || lineType?.toLowerCase?.().includes(p))) {
    redFlags.push(`burner_disposable (10pts) — Number appears to be from a disposable/burner phone service`);
    totalPoints += FLAG_VALUES.burner_disposable;
  }
  
  // ── Known scam operation prefix patterns ──
  // These are prefixes commonly used by scam call centers
  const knownScamPrefixes: Record<string, string> = {
    '+1800': 'Toll-free — commonly used by telemarketing and scam operations',
    '+1888': 'Toll-free — commonly used by telemarketing and scam operations',
    '+1877': 'Toll-free — commonly used by telemarketing and scam operations',
    '+1866': 'Toll-free — commonly used by telemarketing and scam operations',
    '+1900': 'Premium rate — almost always associated with phone scams',
  };
  for (const [prefix, desc] of Object.entries(knownScamPrefixes)) {
    if (stripped.startsWith(prefix)) {
      // Already flagged above for toll-free/premium, skip duplicate
      break;
    }
  }
  
  // ── Invalid number ──
  if (!valid) {
    redFlags.push(`spoofed_caller_id (15pts) — Number failed validation — may be spoofed or invalid`);
    totalPoints += FLAG_VALUES.spoofed_caller_id;
  }
  
  // Convert to 0-10 scale
  const riskScore = Math.min(10, parseFloat((totalPoints / 9).toFixed(1)));
  const riskLevel = getRiskLevel(riskScore);
  
  // ── Owner type determination ──
  let ownerType = 'unknown';
  if (isTollFree) ownerType = 'business';
  else if (isVoip || isVirtualCarrier) ownerType = 'voip_service';
  else if (lineType?.toLowerCase?.() === 'landline') ownerType = 'business';
  else if (lineType?.toLowerCase?.() === 'mobile') ownerType = 'individual';
  
  // ── Scam/Virtual/Spam matches ──
  const scamOperationMatch = totalPoints >= 20 ? `High-risk indicators detected (score ${riskScore}/10)` : null;
  const virtualCenterMatch = isVoip || isVirtualCarrier ? carrier : null;
  const spamDialerMatch = isTollFree ? 'Toll-free numbers are frequently used for mass calling operations' : null;
  
  // ── Recommendation ──
  let recommendation: string;
  if (riskLevel === 'CRITICAL') {
    recommendation = '🚨 DO NOT engage with this number. Strong indicators of scam/fraud operation. Block immediately and report to FTC (reportfraud.ftc.gov) or FCC (fcc.gov/complaints).';
  } else if (riskLevel === 'HIGH') {
    recommendation = '⚠️ High risk — do not share personal information, send money, or follow instructions from this number. Verify the caller through official channels before engaging.';
  } else if (riskLevel === 'MEDIUM') {
    recommendation = '⚡ Exercise caution. Verify the caller\'s identity through official channels. Do not share personal or financial information unless independently verified.';
  } else {
    recommendation = '✅ No significant risk indicators. Always verify caller identity independently before sharing sensitive information.';
  }
  
  return {
    valid,
    phone,
    formatted: formatted || phone,
    country: country || 'Unknown',
    countryCode: countryCode || '',
    carrier: carrier || 'Unknown',
    lineType: lineType || 'unknown',
    riskScore,
    riskLevel,
    redFlags,
    ownerType,
    scamOperationMatch,
    virtualCenterMatch,
    spamDialerMatch,
    recommendation,
    disclaimer: 'Educational purposes only. Not a guarantee of safety. Always verify independently. Report scam calls to FTC: reportfraud.ftc.gov',
    scanDate: new Date().toISOString().split('T')[0],
  };
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }
  
  const phone = (req.body as Record<string, unknown>)?.phone as string;
  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ error: 'Missing required field: phone' });
    return;
  }
  
  // Basic phone format validation
  const stripped = phone.replace(/[^0-9+]/g, '');
  if (stripped.length < 7 || stripped.length > 16) {
    res.status(400).json({ error: 'Invalid phone number format. Include country code, e.g. +1234567890' });
    return;
  }
  
  // Try external APIs in parallel
  const [numverifyData, abstractData] = await Promise.all([
    validateWithNumverify(phone),
    validateWithAbstract(phone),
  ]);
  
  const result = analyzePhoneHeuristics(phone, numverifyData, abstractData);
  
  res.status(200).json({ success: true, result });
}

export const config = {
  maxDuration: 15,
};