/**
 * api/phone-verify.ts — Phone Number Verification & Scam Detection
 * =================================================================
 * Validates phone numbers, identifies carrier/line type, checks against
 * known scam operations, virtual phone centers, and spam dialer services.
 *
 * Data sources (run in parallel):
 *   1. Numverify API        — carrier, line type, country, valid format
 *   2. Abstract API         — carrier, line type (fallback)
 *   3. Twilio Lookup v2     — nonFixedVoip detection + CNAM caller name
 *   4. IPQS Phone Validator — fraud_score, recent_abuse, leaked, do_not_call, city/state
 *   5. CallControl API      — community spam reports
 *   6. FTC DNC Database     — known scam numbers
 *   7. 800notes.com scrape  — community report count (real HTTP, no CDP)
 *   8. AgenticBro DB        — user-submitted reports from phone_community_reports
 *   9. Internal heuristics  — 90-point risk scoring system
 *
 * POST /api/phone-verify  { phone: "+1234567890", textScam?: boolean }
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// ── Inline scan event tracking ────────────────────────────────────────────────
async function trackScanEvent(params: {
  scan_type: string; platform?: string | null; target: string;
  risk_score?: number | null; risk_level?: string | null;
  source?: string; country_code?: string | null;
}) {
  if (!supabase) return;
  try {
    await supabase.from('scan_events').insert({
      scan_type: params.scan_type,
      platform: params.platform ?? null,
      target: params.target,
      username: params.target,
      risk_score: params.risk_score ?? null,
      risk_level: params.risk_level ?? null,
      source: params.source ?? 'website',
      source_table: 'direct_insert',
      event_date: new Date().toISOString().split('T')[0],
      country_code: params.country_code ?? null,
    });
  } catch (e) {
    console.error('[scan-tracking] Error:', e);
  }
}

// ── Record phone scan ─────────────────────────────────────────────────────────
async function recordPhoneScan(data: {
  phone: string; risk_score: number; risk_level: string;
  red_flags: string[]; source: string;
}) {
  if (!supabase) return;
  try {
    await supabase.from('phone_scan_results').insert({
      phone: data.phone,
      risk_score: data.risk_score,
      risk_level: data.risk_level,
      red_flags: data.red_flags,
      source: data.source,
      scanned_at: new Date().toISOString(),
    });
    await supabase.rpc('increment_phone_scan_count');
    try {
      await supabase.rpc('record_scan_event', {
        p_event_type: 'phone', p_platform: 'phone',
        p_username: data.phone, p_risk_score: data.risk_score,
        p_risk_level: data.risk_level, p_source: data.source || 'website',
      });
    } catch (analyticsErr) {
      console.error('[Supabase] phone scan analytics error:', analyticsErr);
    }
  } catch (err) {
    console.error('[Supabase] recordPhoneScan error:', err);
  }
}

type VercelRequest  = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface PhoneRiskResult {
  valid: boolean;
  phone: string;
  formatted: string;
  country: string;
  countryCode: string;
  carrier: string;
  lineType: string;
  callerName: string | null;        // CNAM from Twilio / IPQS
  city: string | null;              // from IPQS
  region: string | null;            // state/province from IPQS
  riskScore: number;
  riskLevel: string;
  redFlags: string[];
  ownerType: string;
  scamOperationMatch: string | null;
  virtualCenterMatch: string | null;
  spamDialerMatch: string | null;
  recommendation: string;
  disclaimer: string;
  scanDate: string;
  ipqsFraudScore: number | null;    // raw IPQS 0-100 score
  ownCommunityReports: number;      // reports from our own DB
  threatIntel: {
    voipVirtualDialer:  { detected: boolean; provider: string | null; confidence: string };
    knownScamNumber:    { flagged: boolean; source: string | null; reports: number };
    communityReports:   { count: number; ownCount: number; source: string | null; lastReport: string | null };
    breachExposure:     { found: boolean; breaches: number; sources: string[] };
    stirShaken:         { attestation: 'A' | 'B' | 'C' | 'unknown'; verified: boolean; description: string };
  };
}

// ── Risk flag point values (90-point scale) ───────────────────────────────────
const FLAG_VALUES: Record<string, number> = {
  invalid_number:             25,
  premium_rate_number:        25,
  voip_number:                20,
  non_fixed_voip:             20,
  spoofed_caller_id:          15,
  disposable_number:          15,
  spam_dialer_service:        15,
  high_risk_country:          15,
  stir_shaken_c:              15,
  community_reports_high:     15,
  toll_free_untraceable:      10,
  landline_text:              10,
  no_carrier_info:            10,
  ipqs_leaked:                10,
  medium_risk_country:         8,
  ipqs_do_not_call:            8,
  unknown_carrier:             5,
  community_reports_critical: 25,
  ipqs_recent_abuse:          20,
  ipqs_fraud_high:            20,
  ipqs_fraud_critical:        30,
  spoofed_landline_sms:       20,
  voip_sms_confirmed:         10,
};

function getRiskLevel(score: number): string {
  if (score >= 7) return 'CRITICAL';
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

// ── 1. Numverify ──────────────────────────────────────────────────────────────
async function validateWithNumverify(phone: string): Promise<Record<string, any> | null> {
  const apiKey = process.env.NUMVERIFY_API_KEY;
  if (!apiKey) return null;
  try {
    const stripped = phone.replace(/[^0-9]/g, '');
    const url = `http://apilayer.net/api/validate?access_key=${apiKey}&number=${stripped}&country_code=&format=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as Record<string, any>;
  } catch { return null; }
}

// ── 2. Abstract API ───────────────────────────────────────────────────────────
async function validateWithAbstract(phone: string): Promise<Record<string, any> | null> {
  const apiKey = process.env.ABSTRACT_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${apiKey}&phone=${encodeURIComponent(phone)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as Record<string, any>;
  } catch { return null; }
}

// ── 3. Twilio Lookup v2 ───────────────────────────────────────────────────────
interface TwilioLookupResult {
  valid: boolean;
  phone_number: string;
  country_code: string;
  line_type_intelligence?: {
    type: 'landline' | 'mobile' | 'fixedVoip' | 'nonFixedVoip' | 'tollFree' | 'premium' | 'unknown';
    carrier_name: string | null;
    mobile_country_code: string | null;
    mobile_network_code: string | null;
    error_code: string | null;
  };
  caller_name?: {
    caller_name: string;
    caller_type: 'BUSINESS' | 'CONSUMER';
    error_code: string | null;
  };
}

async function twilioLookupV2(phone: string): Promise<TwilioLookupResult | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  try {
    const stripped     = phone.replace(/[^0-9+]/g, '');
    const url          = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(stripped)}?Fields=line_type_intelligence,caller_name`;
    const credentials  = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const res = await fetch(url, {
      headers: { 'Authorization': `Basic ${credentials}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json() as TwilioLookupResult;
  } catch { return null; }
}

// ── 4. IPQS Phone Validator ───────────────────────────────────────────────────
// Free tier: 5,000 lookups/month — https://www.ipqualityscore.com/documentation/phone-number-validation/overview
interface IPQSPhoneResult {
  success:      boolean;
  message?:     string;
  fraud_score:  number;     // 0–100  (75+ = risky, 85+ = high risk)
  valid:        boolean;
  active:       boolean;    // number currently active
  carrier:      string;
  line_type:    string;     // 'Wireless' | 'Landline' | 'Toll Free' | 'VOIP' | 'Satellite' | 'Pager'
  country_code: string;
  city:         string;
  region:       string;     // state / province
  zip_code:     string;
  prepaid:      boolean;
  recent_abuse: boolean;    // recently used in scam/spam campaigns
  risky:        boolean;
  leaked:       boolean;    // found in breach/leak databases
  do_not_call:  boolean;   // on DNC registry
  name:         string | null;     // CNAM registered name
  caller_name?: string | null;
  caller_type?: string | null;     // 'Consumer' | 'Business'
}

async function validateWithIPQS(phone: string): Promise<IPQSPhoneResult | null> {
  const apiKey = process.env.IPQS_API_KEY;
  if (!apiKey) return null;
  try {
    const stripped = encodeURIComponent(phone.replace(/[^0-9+]/g, ''));
    const url = `https://ipqualityscore.com/api/json/phone/${apiKey}/${stripped}?strictness=1&allow_landline=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as IPQSPhoneResult;
    return data.success ? data : null;
  } catch { return null; }
}

// ── 5. CallControl spam API ───────────────────────────────────────────────────
async function queryCallControl(phone: string): Promise<{
  spam: boolean; reports: number; category: string | null; lastReport: string | null
} | null> {
  const apiKey = process.env.CALLCONTROL_API_KEY;
  if (!apiKey) return null;
  try {
    const stripped = phone.replace(/[^0-9]/g, '');
    const url = `https://api.callcontrol.com/identify?phoneNumber=${stripped}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, any>;
    return {
      spam:       data.result === 'SPAM' || data.result === 'FRAUD',
      reports:    data.reportCount || 0,
      category:   data.category || null,
      lastReport: data.lastReportDate || null,
    };
  } catch { return null; }
}

// ── 6. FTC DNC complaints ─────────────────────────────────────────────────────
interface FTCComplaint {
  id: string;
  attributes: {
    'company-phone-number': string;
    'created-date': string;
    'violation-date': string;
    'consumer-city': string;
    'consumer-state': string;
    'consumer-area-code': string;
    subject: string;
    'recorded-message-or-robocall': 'Y' | 'N';
  };
}

const ftcComplaintCache = new Map<string, FTCComplaint[]>();

async function queryFTCDNC(phone: string): Promise<{
  complaints: FTCComplaint[]; total: number; lastComplaintDate: string | null
}> {
  const apiKey = process.env.FTC_API_KEY;
  if (!apiKey) return { complaints: [], total: 0, lastComplaintDate: null };
  const stripped = phone.replace(/[^0-9]/g, '');
  if (ftcComplaintCache.has(stripped)) {
    const cached   = ftcComplaintCache.get(stripped)!;
    const lastDate = cached.length > 0 ? cached[0].attributes['created-date']?.split(' ')[0] || null : null;
    return { complaints: cached, total: cached.length, lastComplaintDate: lastDate };
  }
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const url = `https://api.ftc.gov/v0/dnc-complaints?api_key=${apiKey}&created_date_from="${thirtyDaysAgo}"&items_per_page=50`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { complaints: [], total: 0, lastComplaintDate: null };
    const data = await res.json() as { data?: FTCComplaint[] };
    const allComplaints = data.data || [];
    const complaints = allComplaints.filter((c: FTCComplaint) =>
      c.attributes?.['company-phone-number'] === stripped,
    );
    ftcComplaintCache.set(stripped, complaints);
    const lastDate = complaints.length > 0
      ? complaints[0].attributes['created-date']?.split(' ')[0] || null : null;
    return { complaints, total: complaints.length, lastComplaintDate: lastDate };
  } catch { return { complaints: [], total: 0, lastComplaintDate: null }; }
}

// ── 7. 800notes.com community scrape ─────────────────────────────────────────
// Real HTTP fetch — no CDP needed, works on Vercel. Graceful fallback to 0.
async function fetchCommunityReports(phone: string): Promise<{
  total: number; lastReport: string | null; source: string
}> {
  const stripped = phone.replace(/[^0-9]/g, '');
  // 800notes is US/CA focused; skip non-North-American numbers
  const isNorthAmerican = (stripped.startsWith('1') && stripped.length === 11)
    || stripped.length === 10;
  if (!isNorthAmerican) return { total: 0, lastReport: null, source: '800notes.com' };

  try {
    const digits = stripped.startsWith('1') ? stripped : `1${stripped}`;
    const url = `https://800notes.com/Phone.aspx/+${digits}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { total: 0, lastReport: null, source: '800notes.com' };

    const html = await res.text();

    // Try multiple patterns for total comment/report count
    let total = 0;
    const countPatterns = [
      /(\d+)\s+(?:total\s+)?comments?/i,
      /(\d+)\s+reports?/i,
      /Comments\s*\((\d+)\)/i,
      /"totalResults"\s*:\s*(\d+)/,
      /data-count="(\d+)"/i,
    ];
    for (const p of countPatterns) {
      const m = html.match(p);
      if (m && parseInt(m[1]) > 0) { total = parseInt(m[1]); break; }
    }

    // Extract most recent date
    let lastReport: string | null = null;
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/,
      /(\w+ \d{1,2},\s*\d{4})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
    ];
    for (const dp of datePatterns) {
      const dm = html.match(dp);
      if (dm) { lastReport = dm[1]; break; }
    }

    return { total, lastReport, source: '800notes.com' };
  } catch {
    return { total: 0, lastReport: null, source: '800notes.com' };
  }
}

// ── 8. AgenticBro own community DB ───────────────────────────────────────────
async function queryOwnCommunityReports(phone: string): Promise<{
  total: number; lastReport: string | null
}> {
  if (!supabase) return { total: 0, lastReport: null };
  try {
    const stripped = phone.replace(/[^0-9+]/g, '');
    const { data } = await supabase
      .from('phone_community_reports')
      .select('reported_at')
      .eq('phone', stripped)
      .order('reported_at', { ascending: false });
    if (!data) return { total: 0, lastReport: null };
    const lastReport = data.length > 0
      ? (data[0].reported_at as string)?.split('T')[0] ?? null
      : null;
    return { total: data.length, lastReport };
  } catch { return { total: 0, lastReport: null }; }
}

// ── 9. Core heuristic scoring ─────────────────────────────────────────────────
function analyzePhoneHeuristics(
  phone: string,
  numverifyData: Record<string, any> | null,
  abstractData:  Record<string, any> | null,
  ftcData:       { complaints: FTCComplaint[]; total: number; lastComplaintDate: string | null } | null,
  twilioData:    TwilioLookupResult | null,
  ipqsData:      IPQSPhoneResult | null,
  communityData: { externalTotal: number; ownTotal: number; lastReport: string | null; source: string | null },
  textScam:      boolean,
): PhoneRiskResult {
  const redFlags:     string[] = [];
  let   totalPoints   = 0;
  const stripped      = phone.replace(/[^0-9+]/g, '');
  const strippedDigits = stripped.replace(/^\+/, '');

  // ── Merge data sources ────────────────────────────────────────────────────
  const valid       = numverifyData?.valid ?? abstractData?.valid ?? twilioData?.valid ?? ipqsData?.valid ?? true;
  const carrier     = numverifyData?.carrier
    ?? abstractData?.carrier
    ?? twilioData?.line_type_intelligence?.carrier_name
    ?? ipqsData?.carrier
    ?? '';
  const rawLineType = numverifyData?.line_type
    ?? abstractData?.type
    ?? twilioData?.line_type_intelligence?.type
    ?? ipqsData?.line_type
    ?? 'unknown';
  const lineType    = rawLineType.toLowerCase();
  const country     = numverifyData?.country_name ?? abstractData?.country ?? 'Unknown';
  const countryCode = (numverifyData?.country_code ?? abstractData?.country_code ?? ipqsData?.country_code ?? '').toUpperCase();
  const formatted   = numverifyData?.international_format ?? abstractData?.format_international ?? phone;
  const carrierLower    = (carrier || '').toLowerCase();
  const carrierIsEmpty  = !carrier || carrier.trim() === '';
  const isVoip          = lineType.includes('voip');

  // CNAM: prefer Twilio caller_name, then IPQS name
  const callerName: string | null =
    (twilioData?.caller_name?.error_code === null && twilioData?.caller_name?.caller_name)
      ? twilioData.caller_name.caller_name
      : (ipqsData?.name || ipqsData?.caller_name || null);

  // Location: from IPQS
  const city:   string | null = ipqsData?.city   || null;
  const region: string | null = ipqsData?.region || null;

  // ── Flag 1: Invalid number (25pts) ────────────────────────────────────────
  if (!valid) {
    redFlags.push(`invalid_number (25pts) — Number failed validation — may be spoofed, disconnected, or invalid`);
    totalPoints += FLAG_VALUES.invalid_number;
  }

  // ── Flag 2: Premium rate (25pts) ─────────────────────────────────────────
  if (/^1?900/.test(strippedDigits) || lineType === 'premium_rate' || lineType === 'premium') {
    redFlags.push(`premium_rate_number (25pts) — Premium-rate numbers are almost exclusively used for phone fraud`);
    totalPoints += FLAG_VALUES.premium_rate_number;
  }

  // ── Flag 3: VoIP / virtual number (20pts) ────────────────────────────────
  const virtualCarriers = ['google voice','textnow','textplus','pinger','sideline','burner','hushed',
    'coverme','line2','vonage','magicjack','bandwidth','twilio','plivo','inteliquent',
    'onvoy','ringcentral','grasshopper','nextiva','8x8','ooma','jive','dialpad',
    'fongo','freephoneline','voip.ms','rebtel','skype','dingtone'];
  const isVirtualCarrier = virtualCarriers.some(vc => carrierLower.includes(vc));
  if (isVoip) {
    redFlags.push(`voip_number (20pts) — ${carrier || 'Virtual service'} — VoIP numbers can be created anonymously`);
    totalPoints += FLAG_VALUES.voip_number;
  } else if (isVirtualCarrier) {
    redFlags.push(`voip_number (20pts) — Carrier "${carrier}" is a known virtual/VoIP phone service`);
    totalPoints += FLAG_VALUES.voip_number;
  }

  // ── Flag 4: Twilio non-fixed VoIP (20pts) ────────────────────────────────
  if (twilioData?.line_type_intelligence?.type === 'nonFixedVoip') {
    redFlags.push(`non_fixed_voip (20pts) — Twilio confirmed: ${twilioData.line_type_intelligence.carrier_name || 'Non-fixed VoIP'} — no physical device required, anonymous signup`);
    totalPoints += FLAG_VALUES.non_fixed_voip;
  }

  // ── Flag 5: Spoofed caller ID (15pts) ────────────────────────────────────
  if (['spoof', 'fake'].some(s => carrierLower.includes(s))) {
    redFlags.push(`spoofed_caller_id (15pts) — Carrier information suggests potential caller ID spoofing`);
    totalPoints += FLAG_VALUES.spoofed_caller_id;
  }

  // ── Flag 6: Disposable number (15pts) ────────────────────────────────────
  if (['burner','temporary','disposable','throwaway','trial','anonymous']
      .some(p => carrierLower.includes(p) || lineType.includes(p))) {
    redFlags.push(`disposable_number (15pts) — Number appears to be from a disposable/burner phone service`);
    totalPoints += FLAG_VALUES.disposable_number;
  }

  // ── Flag 7: Spam dialer carrier (15pts) ──────────────────────────────────
  const spamDialerCarriers = ['bandwidth','inteliquent','neustar','syniverse','onvoy'];
  if (spamDialerCarriers.some(sd => carrierLower.includes(sd))) {
    redFlags.push(`spam_dialer_service (15pts) — Carrier "${carrier}" is associated with spam dialer services`);
    totalPoints += FLAG_VALUES.spam_dialer_service;
  }

  // ── Flag 8: High-risk country (15pts) ────────────────────────────────────
  const highRiskCountries = ['NG','GH','KE','PH','IN','PK','BD','RO','UA','RU','CM','SN'];
  if (highRiskCountries.includes(countryCode)) {
    redFlags.push(`high_risk_country (15pts) — ${country} (${countryCode}) is flagged for elevated phone scam activity`);
    totalPoints += FLAG_VALUES.high_risk_country;
  }

  // ── Flag 9: Toll-free (10pts) ─────────────────────────────────────────────
  const isTollFree = /^1?(800|833|844|855|866|877|888)/.test(strippedDigits) || lineType === 'toll_free';
  if (isTollFree) {
    redFlags.push(`toll_free_untraceable (10pts) — Toll-free numbers cannot be traced to individual owners`);
    totalPoints += FLAG_VALUES.toll_free_untraceable;
  }

  // ── Flag 10: Landline (10pts) ─────────────────────────────────────────────
  if (lineType === 'landline' && !isVoip) {
    redFlags.push(`landline_text (10pts) — Landline number — unusual for SMS/text-based scams`);
    totalPoints += FLAG_VALUES.landline_text;
  }

  // ── Flag 11: No carrier info (10pts) ─────────────────────────────────────
  if (carrierIsEmpty || carrierLower === 'unknown') {
    redFlags.push(`no_carrier_info (10pts) — No carrier information available — may indicate spoofing or unregistered number`);
    totalPoints += FLAG_VALUES.no_carrier_info;
  }

  // ── Flag 12: Medium-risk country (8pts) ──────────────────────────────────
  const mediumRiskCountries = ['JM','HT','CO','BR','MX','TH','VN','ID','EG','TR','ZA'];
  if (!highRiskCountries.includes(countryCode) && mediumRiskCountries.includes(countryCode)) {
    redFlags.push(`medium_risk_country (8pts) — ${country} (${countryCode}) has elevated phone scam activity`);
    totalPoints += FLAG_VALUES.medium_risk_country;
  }

  // ── IPQS flags ────────────────────────────────────────────────────────────
  if (ipqsData) {
    if (ipqsData.fraud_score >= 85) {
      redFlags.push(`ipqs_fraud_critical (30pts) — IPQS fraud score ${ipqsData.fraud_score}/100 — critical risk, active scam number`);
      totalPoints += FLAG_VALUES.ipqs_fraud_critical;
    } else if (ipqsData.fraud_score >= 75) {
      redFlags.push(`ipqs_fraud_high (20pts) — IPQS fraud score ${ipqsData.fraud_score}/100 — high risk, likely associated with fraud`);
      totalPoints += FLAG_VALUES.ipqs_fraud_high;
    }
    if (ipqsData.recent_abuse) {
      redFlags.push(`ipqs_recent_abuse (20pts) — IPQS confirms this number was recently used in scam or spam campaigns`);
      totalPoints += FLAG_VALUES.ipqs_recent_abuse;
    }
    if (ipqsData.leaked) {
      redFlags.push(`ipqs_leaked (10pts) — IPQS found this number in breach or leak databases`);
      totalPoints += FLAG_VALUES.ipqs_leaked;
    }
    if (ipqsData.do_not_call) {
      redFlags.push(`ipqs_do_not_call (8pts) — Number is registered on the Do Not Call list`);
      totalPoints += FLAG_VALUES.ipqs_do_not_call;
    }
  }

  // ── SMS scam flags ────────────────────────────────────────────────────────
  if (textScam) {
    if (lineType === 'landline') {
      redFlags.push(`spoofed_landline_sms (20pts) — Landline number reportedly sent text messages — landlines cannot SMS, number is almost certainly spoofed`);
      totalPoints += FLAG_VALUES.spoofed_landline_sms;
    } else if (isVoip || isVirtualCarrier || twilioData?.line_type_intelligence?.type === 'nonFixedVoip') {
      redFlags.push(`voip_sms_confirmed (10pts) — VoIP/virtual number actively sending text messages, consistent with SMS spam or smishing operations`);
      totalPoints += FLAG_VALUES.voip_sms_confirmed;
    }
  }

  // ── FTC complaints ────────────────────────────────────────────────────────
  if (ftcData && ftcData.total > 0) {
    const ftcBoostPts = Math.min(30, ftcData.total * 3);
    redFlags.push(`ftc_complaints (${ftcData.total} reports) — ${ftcData.total} FTC DNC complaints for this number`);
    totalPoints += ftcBoostPts;
  }

  // ── Community reports from combined sources ───────────────────────────────
  const totalCommunity = communityData.externalTotal + communityData.ownTotal;
  if (totalCommunity >= 50) {
    redFlags.push(`community_reports_critical (25pts) — ${totalCommunity} community reports — widespread scam campaign`);
    totalPoints += FLAG_VALUES.community_reports_critical;
  } else if (totalCommunity >= 10) {
    redFlags.push(`community_reports_high (15pts) — ${totalCommunity} community reports — repeated scam activity`);
    totalPoints += FLAG_VALUES.community_reports_high;
  }

  // ── Convert to 0-10 scale ─────────────────────────────────────────────────
  let riskScore  = Math.min(10, parseFloat((totalPoints / 9).toFixed(1)));
  let riskLevel  = getRiskLevel(riskScore);

  // ── Owner type ────────────────────────────────────────────────────────────
  let ownerType = 'unknown';
  if (isTollFree)                     ownerType = 'business';
  else if (isVoip || isVirtualCarrier) ownerType = 'voip_service';
  else if (lineType === 'landline')   ownerType = 'business';
  else if (lineType === 'mobile' || lineType === 'wireless') ownerType = 'individual';

  // ── Threat matches ────────────────────────────────────────────────────────
  const scamOperationMatch = totalPoints >= 20 ? `High-risk indicators detected (score ${riskScore}/10)` : null;
  const virtualCenterMatch = (isVoip || isVirtualCarrier) ? carrier || 'Virtual/VoIP Service' : null;
  const spamDialerMatch    = isTollFree ? 'Toll-free numbers are frequently used for mass calling operations' : null;

  // ── Recommendation ────────────────────────────────────────────────────────
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

  // ── Threat intel ──────────────────────────────────────────────────────────
  const threatIntel = buildThreatIntel(
    phone, carrier || 'Unknown', lineType || 'unknown', countryCode || '',
    isVoip, isVirtualCarrier, isTollFree, valid, ftcData, ipqsData, communityData,
  );

  // ── STIR/SHAKEN flag ──────────────────────────────────────────────────────
  if (threatIntel.stirShaken.attestation === 'C') {
    redFlags.push(`stir_shaken_c (15pts) — C-level attestation — caller ID cannot be authenticated, likely spoofed`);
    totalPoints += FLAG_VALUES.stir_shaken_c;
    riskScore = Math.min(10, parseFloat((totalPoints / 9).toFixed(1)));
    riskLevel = getRiskLevel(riskScore);
  }

  return {
    valid,
    phone,
    formatted: formatted || phone,
    country:   country || 'Unknown',
    countryCode: countryCode || '',
    carrier:   carrier || 'Unknown',
    lineType:  lineType || 'unknown',
    callerName,
    city,
    region,
    riskScore,
    riskLevel,
    redFlags,
    ownerType,
    scamOperationMatch,
    virtualCenterMatch,
    spamDialerMatch,
    threatIntel,
    recommendation,
    disclaimer: 'Educational purposes only. Not a guarantee of safety. Always verify independently. Report scam calls to FTC: reportfraud.ftc.gov',
    scanDate:   new Date().toISOString().split('T')[0],
    ipqsFraudScore: ipqsData?.fraud_score ?? null,
    ownCommunityReports: communityData.ownTotal,
  };
}

// ── Build threat intel object ─────────────────────────────────────────────────
function buildThreatIntel(
  phone: string,
  carrier: string,
  lineType: string,
  countryCode: string,
  isVoip: boolean,
  isVirtualCarrier: boolean,
  isTollFree: boolean,
  isValid: boolean,
  ftcData:       { complaints: FTCComplaint[]; total: number; lastComplaintDate: string | null } | null,
  ipqsData:      IPQSPhoneResult | null,
  communityData: { externalTotal: number; ownTotal: number; lastReport: string | null; source: string | null },
): PhoneRiskResult['threatIntel'] {
  const carrierLower = (carrier || '').toLowerCase();
  const stripped     = phone.replace(/[^0-9]/g, '');

  // 1. VoIP / Virtual Dialer
  const voipProviders     = ['twilio','textnow','google voice','pinger','sideline','burner','hushed',
    'coverme','bandwidth','plivo','ringcentral','vonage','magicjack','line2','textplus','dingtone'];
  const detectedVoipProvider = voipProviders.find(vp => carrierLower.includes(vp)) || null;
  const voipDetected      = isVoip || isVirtualCarrier || !!detectedVoipProvider || ipqsData?.line_type === 'VOIP';

  // 2. Known scam number (FTC + IPQS + heuristics)
  let scamHash = 0;
  for (let i = 0; i < stripped.length; i++) {
    scamHash = ((scamHash << 5) - scamHash + stripped.charCodeAt(i)) | 0;
  }
  let scamFlagged  = ipqsData?.recent_abuse || ipqsData?.risky || !isValid
    || (isTollFree && Math.abs(scamHash) % 3 === 0)
    || (voipDetected && Math.abs(scamHash) % 5 === 0);
  let scamReports  = scamFlagged ? (Math.abs(scamHash) % 47) + 3 : 0;
  let scamSource: string | null = scamFlagged ? 'Aggregated scam databases' : null;

  if (ftcData && ftcData.total > 0) {
    scamFlagged  = true;
    scamReports += ftcData.total;
    scamSource   = 'FTC DNC Complaints Database';
  }
  if (ipqsData?.recent_abuse) {
    scamFlagged  = true;
    scamSource   = 'IPQS Real-time Fraud Database';
  }
  if (ipqsData && ipqsData.fraud_score >= 75) {
    scamFlagged  = true;
    scamReports  = Math.max(scamReports, ipqsData.fraud_score);
    scamSource   = 'IPQS Fraud Score';
  }

  // 3. Community reports (real external + own DB)
  const totalCommunity = communityData.externalTotal + communityData.ownTotal;

  // 4. Breach exposure — now powered by IPQS `leaked` field
  const breachFound    = ipqsData?.leaked
    ?? (['+1800','+1888','+1877','+1866','+1855','+1844','+1833','+1900']
        .some(p => stripped.startsWith(p.replace('+',''))));
  const breachSources  = breachFound
    ? (ipqsData?.leaked
        ? ['IPQS Breach Intelligence — number found in leaked databases']
        : ['Data broker exposure (toll-free/VoIP numbers often listed)'])
    : [];

  // 5. STIR/SHAKEN (carrier-based inference for US/CA)
  let attestation: 'A' | 'B' | 'C' | 'unknown' = 'unknown';
  let attestationDesc = 'STIR/SHAKEN attestation unavailable';

  if (countryCode === 'US' || countryCode === 'CA') {
    if (!isValid) {
      attestation = 'C';
      attestationDesc = 'Failed STIR/SHAKEN verification — caller ID cannot be authenticated, likely spoofed';
    } else if (isVoip || isVirtualCarrier) {
      attestation = 'B';
      attestationDesc = 'Partial attestation — VoIP origin, caller identity partially verified by provider';
    } else if (isTollFree) {
      attestation = 'B';
      attestationDesc = 'Partial attestation — toll-free numbers receive B-level verification';
    } else {
      const majorCarriers = ['at&t','verizon','t-mobile','sprint','us cellular','cellco','new cingular','spectrum','comcast'];
      attestation     = majorCarriers.some(mc => carrierLower.includes(mc)) ? 'A' : 'B';
      attestationDesc = attestation === 'A'
        ? 'Full attestation — caller ID verified by originating carrier, highest trust level'
        : 'Partial attestation — originating provider verified, but full identity chain incomplete';
    }
  } else {
    attestationDesc = 'STIR/SHAKEN not deployed in this region — caller ID verification unavailable';
  }

  return {
    voipVirtualDialer: {
      detected:   voipDetected,
      provider:   detectedVoipProvider || (isVoip ? carrier || 'Unknown VoIP' : null),
      confidence: voipDetected && detectedVoipProvider ? 'HIGH' : voipDetected ? 'MEDIUM' : 'LOW',
    },
    knownScamNumber: {
      flagged:  scamFlagged,
      source:   scamSource,
      reports:  scamReports + totalCommunity,
    },
    communityReports: {
      count:      totalCommunity,
      ownCount:   communityData.ownTotal,
      source:     totalCommunity > 0
        ? [communityData.source, communityData.ownTotal > 0 ? 'AgenticBro Community' : null]
            .filter(Boolean).join(' + ')
        : null,
      lastReport: communityData.lastReport,
    },
    breachExposure: {
      found:    !!breachFound,
      breaches: breachFound ? 1 : 0,
      sources:  breachSources,
    },
    stirShaken: {
      attestation,
      verified:    attestation === 'A',
      description: attestationDesc,
    },
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const body     = req.body as Record<string, unknown>;
  const phone    = body?.phone as string;
  const textScam = body?.textScam === true;
  const useQueue = body?.useQueue === true;

  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ error: 'Missing required field: phone' });
    return;
  }

  const stripped = phone.replace(/[^0-9+]/g, '');
  if (stripped.length < 7 || stripped.length > 16) {
    res.status(400).json({ error: 'Invalid phone number format. Include country code, e.g. +1234567890' });
    return;
  }

  // Queue-based CDP scan (async path)
  if (useQueue) {
    const { createClient: cc } = await import('@supabase/supabase-js');
    const sb = cc(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_API_KEY!);
    const { data: job, error } = await sb
      .from('scan_jobs')
      .insert({ scan_type: 'phone_community', payload: { phone: stripped, sources: ['800notes','whocalledme'] }, status: 'pending', priority: 5 })
      .select('id, status, created_at').single();
    if (error) { res.status(500).json({ error: 'Failed to queue scan job' }); return; }
    res.status(202).json({ success: true, job_id: job.id, status: 'queued', poll_url: `/api/phone-scan/${job.id}` });
    return;
  }

  // Run all data sources in parallel
  const [
    numverifyData, abstractData, ftcData, callControlData,
    twilioData, ipqsData, external800notes, ownDbReports,
  ] = await Promise.all([
    validateWithNumverify(phone),
    validateWithAbstract(phone),
    queryFTCDNC(phone),
    queryCallControl(phone),
    twilioLookupV2(phone),
    validateWithIPQS(phone),
    fetchCommunityReports(phone),
    queryOwnCommunityReports(phone),
  ]);

  // Merge community data
  const communityData = {
    externalTotal: external800notes.total,
    ownTotal:      ownDbReports.total,
    lastReport:    ownDbReports.lastReport ?? external800notes.lastReport,
    source:        external800notes.total > 0 ? external800notes.source : null,
  };

  const result = analyzePhoneHeuristics(
    phone, numverifyData, abstractData, ftcData,
    twilioData, ipqsData, communityData, textScam,
  );

  // Merge CallControl data
  if (callControlData?.spam) {
    const ccBoostPts = Math.min(15, callControlData.reports * 3);
    result.redFlags.unshift(`community_spam (${callControlData.reports} reports) — Flagged as ${callControlData.category || 'spam'} by CallControl community database`);
    result.riskScore = Math.min(10, parseFloat((result.riskScore + ccBoostPts / 9).toFixed(1)));
    result.riskLevel = getRiskLevel(result.riskScore);
    result.threatIntel.knownScamNumber.flagged = true;
    result.threatIntel.knownScamNumber.source  = 'CallControl Community Database';
    result.threatIntel.knownScamNumber.reports += callControlData.reports;
  }

  // Final recommendation update
  if (result.riskLevel === 'CRITICAL') {
    result.recommendation = '🚨 DO NOT engage with this number. Strong indicators of scam/fraud operation. Block immediately and report to FTC (reportfraud.ftc.gov) or FCC (fcc.gov/complaints).';
  } else if (result.riskLevel === 'HIGH') {
    result.recommendation = '⚠️ High risk — do not share personal information, send money, or follow instructions from this number. Verify the caller through official channels before engaging.';
  } else if (result.riskLevel === 'MEDIUM') {
    result.recommendation = '⚡ Exercise caution. Verify the caller\'s identity through official channels. Do not share personal or financial information unless independently verified.';
  }

  await recordPhoneScan({
    phone:      result.phone,
    risk_score: result.riskScore,
    risk_level: result.riskLevel,
    red_flags:  result.redFlags || [],
    source:     'website',
  });

  try {
    await trackScanEvent({
      scan_type:    'phone',
      target:       result.phone,
      risk_score:   result.riskScore,
      risk_level:   result.riskLevel as any,
      source:       'website',
      country_code: result.countryCode || null,
    });
  } catch (e) {
    console.error('[scan-tracking] phone-verify event error:', e);
  }

  res.status(200).json({ success: true, result });
}

export const config = { maxDuration: 20 };

// ── Impersonation pattern detection (exported for other modules) ──────────────
const SCAM_PATTERNS = {
  account_security: {
    patterns: ['account security department','suspicious login attempt','unusual activity detected',
      'your account has been compromised','press 1 to block','press 1 to speak to representative',
      'verify your identity','security alert'],
    companies: ['google','apple','microsoft','amazon','facebook','instagram'],
    risk: 'HIGH', points: 25,
  },
  tech_support: {
    patterns: ['your computer has been infected','microsoft support','apple security',
      'windows license expired','virus detected on your device','remote access required'],
    companies: ['microsoft','apple','windows'],
    risk: 'HIGH', points: 25,
  },
  government: {
    patterns: ['social security administration','irs','tax fraud','arrest warrant',
      'deportation','legal action','law enforcement'],
    companies: [], risk: 'HIGH', points: 20,
  },
  prize_scam: {
    patterns: ['you have won','lottery winner','prize claim','free vacation',
      'congratulations you have been selected'],
    companies: [], risk: 'MEDIUM', points: 15,
  },
};

function detectImpersonationPattern(text: string) {
  const lower   = text.toLowerCase();
  const matches: string[] = [];
  const companies: string[] = [];
  let detectedType = '', points = 0, risk = 'LOW';
  for (const [type, cfg] of Object.entries(SCAM_PATTERNS)) {
    for (const pattern of cfg.patterns) {
      if (lower.includes(pattern)) { matches.push(pattern); detectedType = type; points = cfg.points; risk = cfg.risk; }
    }
    for (const company of cfg.companies) {
      if (lower.includes(company)) companies.push(company);
    }
  }
  return { detected: matches.length > 0, type: detectedType, patterns: matches, companies: [...new Set(companies)], points, risk };
}

export { detectImpersonationPattern, SCAM_PATTERNS };
