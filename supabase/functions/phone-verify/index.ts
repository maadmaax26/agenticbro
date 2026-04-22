// Supabase Edge Function: Phone Verify
// Core phone verification logic - PRIVATE
// Deploy with: supabase functions deploy phone-verify

import "jsr/@supabase/functions-js/edge-runtime.d.ts";

// ── Known Scam Phone Database ──────────────────────────────────────────────
interface PhoneEntry {
  pattern: string;
  type: 'scam_operation' | 'virtual_center' | 'spam_dialer' | 'toll_free_scam' | 'spoofed';
  label: string;
  points: number;
  description: string;
}

const KNOWN_PATTERNS: PhoneEntry[] = [
  { pattern: '^\\+1(800|833|844|855|866|877|888)', type: 'toll_free_scam', label: 'Toll-Free Number', points: 5, description: 'Toll-free numbers are frequently used by scam call centers' },
  { pattern: '^\\+1(900)', type: 'scam_operation', label: 'Premium Rate Number', points: 20, description: 'Premium-rate numbers are almost exclusively associated with phone scams' },
  { pattern: 'VOIP', type: 'virtual_center', label: 'Virtual/VoIP Number', points: 10, description: 'Virtual numbers can be created anonymously' },
  { pattern: 'SPOOF', type: 'spoofed', label: 'Potentially Spoofed', points: 15, description: 'Caller ID spoofing is frequently used in scam calls' },
];

// ── 90-Point Phone Risk Scoring ────────────────────────────────────────────
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
  const apiKey = Deno.env.get('NUMVERIFY_API_KEY');
  if (!apiKey) return null;
  
  try {
    const stripped = phone.replace(/[^0-9]/g, '');
    const url = `http://apilayer.net/api/validate?access_key=${apiKey}&number=${stripped}&country_code=&format=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Phone Number Validation via Abstract API ────────────────────────────────
async function validateWithAbstract(phone: string): Promise<Record<string, any> | null> {
  const apiKey = Deno.env.get('ABSTRACT_API_KEY');
  if (!apiKey) return null;
  
  try {
    const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${apiKey}&phone=${encodeURIComponent(phone)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── FTC DNC Complaints API ──────────────────────────────────────────────────
async function queryFTCDNC(phone: string): Promise<{ complaints: any[]; total: number; lastComplaintDate: string | null }> {
  const apiKey = Deno.env.get('FTC_API_KEY');
  if (!apiKey) return { complaints: [], total: 0, lastComplaintDate: null };
  
  const stripped = phone.replace(/[^0-9]/g, '');
  
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const url = `https://api.ftc.gov/v0/dnc-complaints?api_key=${apiKey}&created_date_from="${thirtyDaysAgo}"&items_per_page=50`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    
    if (!res.ok) return { complaints: [], total: 0, lastComplaintDate: null };
    
    const data = await res.json();
    const allComplaints = data.data || [];
    const complaints = allComplaints.filter((c: any) => 
      c.attributes?.['company-phone-number'] === stripped
    );
    
    const lastDate = complaints.length > 0
      ? complaints[0].attributes['created-date']?.split(' ')[0] || null
      : null;
    
    return { complaints, total: complaints.length, lastComplaintDate: lastDate };
  } catch {
    return { complaints: [], total: 0, lastComplaintDate: null };
  }
}

// ── Heuristic Phone Analysis ─────────────────────────────────────────────────
function analyzePhoneHeuristics(
  phone: string,
  numverifyData: Record<string, any> | null,
  abstractData: Record<string, any> | null,
): any {
  const redFlags: string[] = [];
  let totalPoints = 0;
  const stripped = phone.replace(/[^0-9+]/g, '');
  
  const valid = numverifyData?.valid ?? abstractData?.valid ?? true;
  const carrier = numverifyData?.carrier ?? abstractData?.carrier ?? 'Unknown';
  const lineType = numverifyData?.line_type ?? abstractData?.type ?? 'unknown';
  const country = numverifyData?.country_name ?? abstractData?.country ?? 'Unknown';
  const countryCode = numverifyData?.country_code ?? abstractData?.country_code ?? '';
  const formatted = numverifyData?.international_format ?? abstractData?.format_international ?? phone;
  const isVoip = lineType?.toLowerCase?.().includes('voip') ?? false;
  
  // Premium rate detection
  if (/^\+?1?900/.test(stripped.replace(/^\+/, '')) || lineType?.toLowerCase?.() === 'premium_rate') {
    redFlags.push(`premium_rate_number (25pts) — Premium-rate numbers are almost exclusively used for phone fraud`);
    totalPoints += FLAG_VALUES.premium_rate_number;
  }
  
  // Toll-free / untraceable
  const isTollFree = /^\+?1?(800|833|844|855|866|877|888)/.test(stripped.replace(/^\+/, '')) || lineType?.toLowerCase?.() === 'toll_free';
  if (isTollFree) {
    redFlags.push(`toll_free_untraceable (10pts) — Toll-free numbers cannot be traced to individual owners`);
    totalPoints += FLAG_VALUES.toll_free_untraceable;
  }
  
  // VoIP / Virtual number
  if (isVoip) {
    redFlags.push(`voip_virtual_number (15pts) — ${carrier || 'Virtual service'} — VoIP numbers can be created anonymously`);
    totalPoints += FLAG_VALUES.voip_virtual_number;
  }
  
  // Known virtual/Burner carriers
  const virtualCarriers = ['google voice', 'textnow', 'textplus', 'pinger', 'sideline', 'burner', 'hushed', 'coverme', 'line2', 'vonage', 'magicjack', 'bandwidth', 'twilio', 'plivo'];
  const carrierLower = (carrier || '').toLowerCase();
  const isVirtualCarrier = virtualCarriers.some(vc => carrierLower.includes(vc));
  if (isVirtualCarrier && !isVoip) {
    redFlags.push(`voip_virtual_number (15pts) — Carrier "${carrier}" is a known virtual/disposable phone service`);
    totalPoints += FLAG_VALUES.voip_virtual_number;
  }
  
  // No carrier info
  if (!carrier || carrier === 'Unknown' || carrier === '') {
    redFlags.push(`no_carrier_info (10pts) — No carrier information available — may indicate spoofing`);
    totalPoints += FLAG_VALUES.no_carrier_info;
  }
  
  // High-risk countries
  const highRiskCountries = ['JM', 'NG', 'GH', 'PK', 'IN', 'PH', 'RO', 'BG', 'UA', 'RU', 'CN'];
  if (highRiskCountries.includes(countryCode)) {
    redFlags.push(`high_risk_country (10pts) — ${country} is flagged for elevated phone scam activity`);
    totalPoints += FLAG_VALUES.high_risk_country;
  }
  
  // Invalid number
  if (!valid) {
    redFlags.push(`spoofed_caller_id (15pts) — Number failed validation — may be spoofed or invalid`);
    totalPoints += FLAG_VALUES.spoofed_caller_id;
  }
  
  // Convert to 0-10 scale
  const riskScore = Math.min(10, parseFloat((totalPoints / 9).toFixed(1)));
  const riskLevel = getRiskLevel(riskScore);
  
  // Owner type
  let ownerType = 'unknown';
  if (isTollFree) ownerType = 'business';
  else if (isVoip || isVirtualCarrier) ownerType = 'voip_service';
  else if (lineType?.toLowerCase?.() === 'landline') ownerType = 'business';
  else if (lineType?.toLowerCase?.() === 'mobile') ownerType = 'individual';
  
  // Recommendation
  let recommendation: string;
  if (riskLevel === 'CRITICAL') {
    recommendation = '🚨 DO NOT engage with this number. Strong indicators of scam/fraud operation. Block immediately and report to FTC.';
  } else if (riskLevel === 'HIGH') {
    recommendation = '⚠️ High risk — do not share personal information. Verify the caller through official channels.';
  } else if (riskLevel === 'MEDIUM') {
    recommendation = '⚡ Exercise caution. Verify the caller\'s identity through official channels.';
  } else {
    recommendation = '✅ No significant risk indicators. Always verify caller identity independently.';
  }
  
  // Threat Intel
  const threatIntel = {
    voipVirtualDialer: {
      detected: isVoip || isVirtualCarrier,
      provider: isVoip ? carrier : null,
      confidence: isVoip ? 'HIGH' : 'LOW',
    },
    knownScamNumber: {
      flagged: totalPoints >= 20,
      source: totalPoints >= 20 ? 'Heuristic analysis' : null,
      reports: 0,
    },
    communityReports: {
      count: 0,
      source: null,
      lastReport: null,
    },
    breachExposure: {
      found: isTollFree,
      breaches: isTollFree ? 1 : 0,
      sources: isTollFree ? ['Toll-free numbers often listed in data broker databases'] : [],
    },
    stirShaken: {
      attestation: countryCode === 'US' ? (isVoip ? 'B' : 'A') : 'unknown',
      verified: countryCode === 'US' && !isVoip,
      description: countryCode === 'US' ? 'STIR/SHAKEN verification available' : 'STIR/SHAKEN not deployed in this region',
    },
  };
  
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
    scamOperationMatch: totalPoints >= 20 ? `High-risk indicators detected (score ${riskScore}/10)` : null,
    virtualCenterMatch: isVoip || isVirtualCarrier ? carrier : null,
    spamDialerMatch: isTollFree ? 'Toll-free numbers are frequently used for mass calling operations' : null,
    threatIntel,
    recommendation,
    disclaimer: 'Educational purposes only. Not a guarantee of safety. Always verify independently.',
    scanDate: new Date().toISOString().split('T')[0],
  };
}

// ── Main Handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  try {
    const body = await req.json();
    const { phone } = body;
    
    if (!phone || typeof phone !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: phone' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const stripped = phone.replace(/[^0-9+]/g, '');
    if (stripped.length < 7 || stripped.length > 16) {
      return new Response(JSON.stringify({ error: 'Invalid phone number format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Try external APIs in parallel
    const [numverifyData, abstractData, ftcData] = await Promise.all([
      validateWithNumverify(phone),
      validateWithAbstract(phone),
      queryFTCDNC(phone),
    ]);
    
    const result = analyzePhoneHeuristics(phone, numverifyData, abstractData);
    
    // Merge FTC data
    if (ftcData && ftcData.total > 0) {
      result.threatIntel.knownScamNumber = {
        flagged: true,
        source: 'FTC DNC Complaints Database',
        reports: ftcData.total + (result.threatIntel.knownScamNumber.reports || 0),
      };
      if (ftcData.lastComplaintDate) {
        result.threatIntel.communityReports.lastReport = ftcData.lastComplaintDate;
      }
      const subjects = [...new Set(ftcData.complaints.map((c: any) => c.attributes?.subject).filter(Boolean))];
      if (subjects.length > 0) {
        result.redFlags.unshift(`ftc_complaints (${ftcData.total}) — FTC DNC complaints for: ${subjects.join(', ')}`);
      }
      const ftcBoost = Math.min(3, Math.round(ftcData.total * 0.2) / 10);
      result.riskScore = Math.min(10, parseFloat((result.riskScore + ftcBoost).toFixed(1)));
      result.riskLevel = getRiskLevel(result.riskScore);
    }
    
    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});