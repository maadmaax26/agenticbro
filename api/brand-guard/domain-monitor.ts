/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/domain-monitor.ts — Website Lookalike Detector API
 * ========================================================================
 * Generates typosquatting domain variants, then VERIFIES which ones are
 * actually registered and active before reporting them as threats.
 *
 * Without verification every scan was a false-positive factory — this fix
 * adds three verification layers before flagging a domain as a real threat:
 *
 *   Layer 1 — DNS:     Does it resolve? (NXDOMAIN = theoretical, skip)
 *   Layer 2 — HTTP:    Is the site live? (registered ≠ active phishing)
 *   Layer 3 — Content: Does the page mention the brand? Phishing signals?
 *                       Is it a parked/for-sale page?
 *
 * POST /api/brand-guard/domain-monitor
 *   Body: { domain: string, limit?: number, brand_keywords?: string[], monitoring?: string }
 *   Returns: { scan_id, domain, variants, verified_threats, theoretical_threats, summary }
 *
 * GET /api/brand-guard/domain-monitor?scan_id=xxx
 *   Returns: Stored scan results
 *
 * GET /api/brand-guard/domain-monitor?domain=xxx
 *   Returns: All monitoring subscriptions for a domain
 */

import type { IncomingMessage, ServerResponse } from 'http';
import * as dnsPromises from 'dns/promises';
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ── Types ────────────────────────────────────────────────────────────────────

interface DomainVariant {
  domain: string;
  original_domain: string;
  similarity: number;
  variant_type: string;
  risk_boost: number;
  risk_score: number;
  risk_level: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threat_type: string;
  evidence: string[];
  takedown_priority: string;
  takedown_action: string;
  verification?: DomainVerification;
}

interface DomainVerification {
  verified: boolean;           // true = we actually checked this
  dns_resolves: boolean;       // DNS A record exists
  ip_addresses: string[];      // resolved IPs
  is_live: boolean;            // HTTP/HTTPS responded with non-5xx
  has_ssl: boolean;            // HTTPS worked
  is_parking_page: boolean;    // GoDaddy/Sedo/for-sale page
  brand_mentioned: boolean;    // brand keywords found in page content
  content_signals: string[];   // detected phishing signals
  verified_threat: boolean;    // DNS + live + (brand_mentioned or phishing signals)
  status: 'active_threat' | 'active_clean' | 'registered_inactive' | 'not_registered' | 'unverified';
  checked_at: string;
}

// ── Domain Variant Generation ─────────────────────────────────────────────────

const TLD_SWAPS = [
  '.com', '.net', '.org', '.io', '.co', '.app', '.xyz', '.dev',
  '.tech', '.finance', '.coin', '.crypto', '.site', '.online',
  '.shop', '.store', '.info', '.biz', '.us', '.uk', '.ca',
];

const PHISHING_PREFIXES = [
  'login', 'signin', 'sign-in', 'account', 'secure', 'verify',
  'update', 'confirm', 'auth', 'portal', 'app', 'my', 'web',
  'www2', 'mail', 'support', 'help', 'service', 'check',
  'get', 'claim', 'reward', 'free', 'bonus', 'wallet',
];

const PHISHING_SUFFIXES = [
  '-login', '-signin', '-account', '-secure', '-verify',
  '-update', '-app', '-support', '-help', '-service',
  '-claim', '-reward', '-free', '-bonus', '-wallet',
];

const HOMOGLYPHS: Record<string, string[]> = {
  a: ['4', '@'], e: ['3'], g: ['9'], i: ['1', 'l'],
  l: ['1', 'i'], o: ['0'], s: ['5', '$'], t: ['7'],
};

// Parking page fingerprints — these domains are registered but not active threats
const PARKING_PATTERNS = [
  /sedo\.com/i, /godaddy\.com\/.*for-sale/i, /namecheap.*parking/i,
  /this domain (is|has been) (parked|for sale)/i,
  /domain for sale/i, /buy this domain/i,
  /hugedomains\.com/i, /dan\.com/i, /afternic\.com/i,
  /parking.*page/i, /underconstruction/i,
];

// Phishing content signals — things that should not appear on a lookalike site
const PHISHING_SIGNALS: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /connect.*wallet|wallet.*connect|metamask|phantom.*wallet/i, signal: 'wallet_connect_prompt' },
  { pattern: /seed.?phrase|private.?key|recovery.?phrase/i, signal: 'seed_phrase_request' },
  { pattern: /airdrop.*claim|claim.*airdrop|free.*token.*claim/i, signal: 'airdrop_scam' },
  { pattern: /<form[^>]*>[\s\S]{0,500}password/i, signal: 'login_form' },
  { pattern: /verify.*account|confirm.*identity|update.*billing/i, signal: 'account_verification_scam' },
  { pattern: /you.ve been selected|congratulations.*winner/i, signal: 'lottery_scam' },
  { pattern: /investment.*returns?|guaranteed.*profit|double.*your/i, signal: 'investment_scam' },
];

function extractDomainParts(domain: string): { base: string; tld: string; full: string } {
  let d = domain.toLowerCase().trim();
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  const parts = d.split('.');
  const base = parts.length >= 2 ? parts.slice(0, -1).join('.') : d;
  const tld = parts.length >= 2 ? '.' + parts[parts.length - 1] : '.com';
  return { base, tld, full: d };
}

function generateDomainVariants(domain: string, limit: number = 50): DomainVariant[] {
  const { base, tld, full } = extractDomainParts(domain);
  const variants: DomainVariant[] = [];
  const seen = new Set<string>();

  function addVariant(
    variantDomain: string,
    type: string,
    _method: string,
    riskBoost: number,
    description: string
  ) {
    const vd = variantDomain.toLowerCase();
    if (vd !== full && !seen.has(vd) && variants.length < limit) {
      seen.add(vd);

      const varBase = extractDomainParts(variantDomain).base;
      let similarity = 0;
      if (base.length > 0 && varBase.length > 0) {
        const longer = base.length > varBase.length ? base : varBase;
        const shorter = base.length > varBase.length ? varBase : base;
        let matches = 0;
        for (let i = 0; i < shorter.length; i++) {
          if (base[i]?.toLowerCase() === varBase[i]?.toLowerCase()) matches++;
        }
        similarity = matches / longer.length;
      }

      let riskScore = 0;
      if (similarity >= 0.9) riskScore += 30;
      else if (similarity >= 0.75) riskScore += 22;
      else if (similarity >= 0.5) riskScore += 12;
      else if (similarity >= 0.3) riskScore += 5;

      const highRiskTypes = ['phishing_prefix', 'phishing_suffix', 'subdomain_phishing'];
      const mediumRiskTypes = ['homoglyph', 'tld_swap'];
      if (highRiskTypes.includes(type)) riskScore += 25;
      else if (mediumRiskTypes.includes(type)) riskScore += 15;
      else riskScore += 8;

      if (riskBoost >= 0.7) riskScore += 15;
      else if (riskBoost >= 0.5) riskScore += 10;
      else if (riskBoost >= 0.3) riskScore += 5;

      const suspiciousTlds = ['.xyz', '.coin', '.crypto', '.site', '.online', '.tk', '.ml', '.ga', '.cf'];
      const varTld = '.' + variantDomain.split('.').pop();
      if (suspiciousTlds.includes(varTld)) riskScore += 10;
      else if (['.io', '.app', '.dev'].includes(varTld)) riskScore += 3;

      riskScore = Math.min(100, riskScore);

      let riskLevel: DomainVariant['risk_level'];
      let threatType: string;
      let takedownPriority: string;
      let takedownAction: string;

      if (riskScore >= 70) {
        riskLevel = 'CRITICAL'; threatType = 'Potential active phishing domain';
        takedownPriority = 'Urgent'; takedownAction = 'File abuse report with registrar + submit to phishing databases';
      } else if (riskScore >= 45) {
        riskLevel = 'HIGH'; threatType = 'Probable lookalike domain';
        takedownPriority = 'High'; takedownAction = 'File abuse report + monitor for active content';
      } else if (riskScore >= 25) {
        riskLevel = 'MEDIUM'; threatType = 'Possible lookalike domain';
        takedownPriority = 'Medium'; takedownAction = 'Monitor weekly and file abuse report if site becomes active';
      } else if (riskScore >= 10) {
        riskLevel = 'LOW'; threatType = 'Unlikely threat';
        takedownPriority = 'Monitor'; takedownAction = 'Add to periodic monitoring';
      } else {
        riskLevel = 'MINIMAL'; threatType = 'No significant risk';
        takedownPriority = 'Monitor'; takedownAction = 'Add to periodic monitoring';
      }

      variants.push({
        domain: variantDomain,
        original_domain: full,
        similarity: Math.round(similarity * 1000) / 1000,
        variant_type: type,
        risk_boost: riskBoost,
        risk_score: riskScore,
        risk_level: riskLevel,
        threat_type: threatType,
        evidence: [description],
        takedown_priority: takedownPriority,
        takedown_action: takedownAction,
      });
    }
  }

  for (const swapTld of TLD_SWAPS) {
    if (swapTld !== tld) {
      const risk = ['.io', '.xyz', '.coin', '.crypto', '.site', '.online'].includes(swapTld) ? 0.5 : 0.3;
      addVariant(`${base}${swapTld}`, 'tld_swap', `tld${tld}->${swapTld}`, risk, `TLD swap: ${base}${swapTld}`);
    }
  }

  for (const prefix of PHISHING_PREFIXES) {
    addVariant(`${prefix}${base}${tld}`, 'phishing_prefix', `prefix_${prefix}`, 0.7, `Phishing prefix: "${prefix}" added`);
  }

  for (const suffix of PHISHING_SUFFIXES) {
    addVariant(`${base}${suffix}${tld}`, 'phishing_suffix', `suffix${suffix}`, 0.7, `Phishing suffix: "${suffix}" added`);
  }

  for (let i = 0; i < Math.min(base.length, 8); i++) {
    const variant = base.slice(0, i) + base.slice(i + 1);
    addVariant(`${variant}${tld}`, 'char_omission', `omit_pos${i}`, 0.3, `Missing character at position ${i}`);
  }

  for (let i = 0; i < Math.min(base.length, 8); i++) {
    const char = base[i].toLowerCase();
    if (HOMOGLYPHS[char]) {
      for (const replacement of HOMOGLYPHS[char]) {
        const variant = base.slice(0, i) + replacement + base.slice(i + 1);
        addVariant(`${variant}${tld}`, 'homoglyph', `homo_${char}->${replacement}`, 0.5, `Visual lookalike: ${char} → ${replacement}`);
      }
    }
  }

  for (const sub of ['login', 'signin', 'verify', 'secure', 'account']) {
    addVariant(`${base}.${sub}.com`, 'subdomain_phishing', `subdomain_${sub}`, 0.8, `Subdomain phishing: ${base}.${sub}.com`);
  }

  variants.sort((a, b) => b.risk_score - a.risk_score);
  return variants.slice(0, limit);
}

// ── Domain Verification ───────────────────────────────────────────────────────

/**
 * Verify whether a domain variant is actually active and threatening.
 * Three-layer check: DNS → HTTP live → content analysis.
 * Runs with per-check timeouts so a slow/dead domain doesn't block the scan.
 */
export async function verifyDomainActive(
  domain: string,
  brandKeywords: string[] = []
): Promise<DomainVerification> {
  const result: DomainVerification = {
    verified: true,
    dns_resolves: false,
    ip_addresses: [],
    is_live: false,
    has_ssl: false,
    is_parking_page: false,
    brand_mentioned: false,
    content_signals: [],
    verified_threat: false,
    status: 'not_registered',
    checked_at: new Date().toISOString(),
  };

  // ── Layer 1: DNS A record lookup ─────────────────────────────────────────
  try {
    const addrs = await Promise.race([
      dnsPromises.resolve4(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('dns_timeout')), 3000)),
    ]);
    result.dns_resolves = true;
    result.ip_addresses = addrs as string[];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'dns_timeout') {
      // DNS timed out — treat as unresolved to avoid false positives
      result.status = 'unverified';
    } else {
      result.status = 'not_registered'; // NXDOMAIN or similar
    }
    return result; // No point checking HTTP if DNS fails
  }

  result.status = 'registered_inactive';

  // ── Layer 2: HTTP live check ──────────────────────────────────────────────
  let pageBody = '';

  const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BrandGuardBot/1.0; +https://agenticbro.app)',
        },
      });
    } finally {
      clearTimeout(t);
    }
  };

  // Try HTTPS first
  try {
    const httpsRes = await fetchWithTimeout(`https://${domain}`, 4000);
    if (httpsRes.status < 500) {
      result.is_live = true;
      result.has_ssl = true;
      result.status = 'active_clean';
      // Read up to 32KB of body for content analysis
      const buffer = await httpsRes.arrayBuffer();
      pageBody = new TextDecoder().decode(buffer.slice(0, 32768));
    }
  } catch {
    // HTTPS failed — try plain HTTP
    try {
      const httpRes = await fetchWithTimeout(`http://${domain}`, 3000);
      if (httpRes.status < 500) {
        result.is_live = true;
        result.has_ssl = false;
        result.status = 'active_clean';
        const buffer = await httpRes.arrayBuffer();
        pageBody = new TextDecoder().decode(buffer.slice(0, 32768));
      }
    } catch {
      // Not live at all
      return result; // status remains 'registered_inactive'
    }
  }

  if (!pageBody) return result;

  // ── Layer 3: Content analysis ─────────────────────────────────────────────

  // Parking page detection — registered but not an active threat
  result.is_parking_page = PARKING_PATTERNS.some(p => p.test(pageBody));
  if (result.is_parking_page) {
    result.status = 'registered_inactive';
    return result; // Parking pages are not active threats
  }

  // Brand keyword detection
  const bodyLower = pageBody.toLowerCase();
  result.brand_mentioned = brandKeywords.some(kw => bodyLower.includes(kw.toLowerCase()));

  // Phishing signal detection
  const signals: string[] = [];
  for (const { pattern, signal } of PHISHING_SIGNALS) {
    if (pattern.test(pageBody)) signals.push(signal);
  }
  result.content_signals = signals;

  // A domain is a verified threat if:
  // - It's live AND
  // - It either mentions the brand OR has phishing signals
  result.verified_threat = result.is_live && (result.brand_mentioned || signals.length > 0);
  result.status = result.verified_threat ? 'active_threat' : 'active_clean';

  return result;
}

/**
 * Re-score a variant after verification — bump scores for confirmed active threats,
 * downgrade scores for parking pages and unregistered domains.
 */
function applyVerificationToScore(variant: DomainVariant, v: DomainVerification): DomainVariant {
  let { risk_score, evidence } = variant;
  const newEvidence = [...evidence];

  if (!v.dns_resolves && v.status !== 'unverified') {
    // Domain doesn't exist — clearly theoretical
    risk_score = Math.round(risk_score * 0.2);
    newEvidence.push('⚪ DNS: Not registered (theoretical)');
  } else if (v.status === 'unverified') {
    newEvidence.push('⚠️ DNS: Lookup timed out — could not verify');
  } else if (v.is_parking_page) {
    // Registered but parked — keep a modest score, it could become active
    risk_score = Math.min(risk_score, 30);
    newEvidence.push('🅿️ Active: Registered but currently parked/for-sale');
  } else if (v.dns_resolves && !v.is_live) {
    // Registered but no web server
    risk_score = Math.round(risk_score * 0.5);
    newEvidence.push(`🟡 Active: DNS resolves (${v.ip_addresses[0] || 'unknown'}) but no web server`);
  } else if (v.is_live) {
    // Live site — boost the base score
    risk_score = Math.min(100, risk_score + 15);
    newEvidence.push(`🔴 Active: Live website (${v.has_ssl ? 'HTTPS' : 'HTTP only'})`);

    if (v.brand_mentioned) {
      risk_score = Math.min(100, risk_score + 20);
      newEvidence.push('🔴 Content: Brand name mentioned on the page');
    }

    for (const signal of v.content_signals) {
      const label: Record<string, string> = {
        wallet_connect_prompt: '🚨 Content: Wallet connection prompt detected',
        seed_phrase_request: '🚨 Content: Seed phrase / private key request detected',
        airdrop_scam: '🚨 Content: Airdrop or free token claim page',
        login_form: '🟠 Content: Login form detected',
        account_verification_scam: '🟠 Content: Account verification flow detected',
        lottery_scam: '🚨 Content: Lottery / prize scam language detected',
        investment_scam: '🚨 Content: Investment return scam language detected',
      };
      const pointBoost = signal.includes('seed_phrase') || signal.includes('wallet') ? 25 : 15;
      risk_score = Math.min(100, risk_score + pointBoost);
      newEvidence.push(label[signal] || `🟠 Content signal: ${signal}`);
    }
  }

  // Recompute risk level
  let risk_level: DomainVariant['risk_level'];
  let threat_type: string;
  let takedown_priority: string;
  let takedown_action: string;

  if (risk_score >= 70) {
    risk_level = 'CRITICAL'; threat_type = 'Active phishing domain — immediate action required';
    takedown_priority = 'Urgent'; takedown_action = 'File abuse report with registrar + submit to Google Safe Browsing + PhishTank';
  } else if (risk_score >= 45) {
    risk_level = 'HIGH'; threat_type = v.is_live ? 'Live lookalike domain' : 'Probable lookalike domain';
    takedown_priority = 'High'; takedown_action = 'File abuse report + monitor for active phishing content';
  } else if (risk_score >= 25) {
    risk_level = 'MEDIUM'; threat_type = v.dns_resolves ? 'Registered lookalike domain' : 'Possible lookalike pattern';
    takedown_priority = 'Medium'; takedown_action = 'Monitor weekly — file abuse report if site becomes active';
  } else if (risk_score >= 10) {
    risk_level = 'LOW'; threat_type = 'Low-risk variant';
    takedown_priority = 'Monitor'; takedown_action = 'Add to periodic monitoring';
  } else {
    risk_level = 'MINIMAL'; threat_type = 'Theoretical pattern — domain not registered';
    takedown_priority = 'None'; takedown_action = 'No action needed';
  }

  return {
    ...variant,
    risk_score: Math.round(risk_score),
    risk_level,
    threat_type,
    evidence: newEvidence,
    takedown_priority,
    takedown_action,
    verification: v,
  };
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

  // ── GET: Retrieve scan results ────────────────────────────────────────────
  if (req.method === 'GET') {
    const scanId = (req.url?.split('scan_id=')[1]?.split('&')[0]) || '';

    if (scanId && supabase) {
      const { data, error } = await supabase
        .from('domain_lookalikes')
        .select('*')
        .eq('scan_id', scanId)
        .single();
      if (data && !error) { res.status(200).json(data); return; }
    }

    const domainParam = (req.url?.split('domain=')[1]?.split('&')[0]) || '';
    if (domainParam && supabase) {
      const { data, error } = await supabase
        .from('domain_monitors')
        .select('*')
        .eq('domain', domainParam);
      if (data && !error) { res.status(200).json({ success: true, monitors: data }); return; }
    }

    res.status(404).json({ error: 'Not found' });
    return;
  }

  // ── POST: Run domain lookalike scan ───────────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' }); return;
  }

  const body = req.body || {};
  const domain = (body.domain as string) || '';
  const limit = Math.min((body.limit as number) || 50, 100);
  const monitoring = (body.monitoring as string) || 'once';

  // Brand keywords used for content-analysis verification.
  // Defaults to the domain base name — callers can pass a richer list.
  const { base: domainBase } = extractDomainParts(domain);
  const brandKeywords = (body.brand_keywords as string[]) ||
    [domainBase, domain.replace(/\.[^.]+$/, '')].filter(Boolean);

  if (!domain) { res.status(400).json({ error: 'domain is required' }); return; }

  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
  if (!domainRegex.test(domain)) { res.status(400).json({ error: 'Invalid domain format' }); return; }

  const scanId = `dl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // ── Step 1: Generate variants ──────────────────────────────────────────────
  const rawVariants = generateDomainVariants(domain, limit);

  // ── Step 2: Verify top variants in parallel ────────────────────────────────
  // Only verify variants with meaningful risk scores (saves time + avoids
  // hammering DNS for clearly theoretical low-risk variants)
  const VERIFY_LIMIT = 15;
  const toVerify = rawVariants.filter(v => v.risk_score >= 35).slice(0, VERIFY_LIMIT);
  const skipVerify = rawVariants.filter(v => !toVerify.includes(v));

  console.log(`[Domain Monitor] Verifying ${toVerify.length} of ${rawVariants.length} variants for ${domain}`);

  const verificationResults = await Promise.allSettled(
    toVerify.map(v => verifyDomainActive(v.domain, brandKeywords))
  );

  // Apply verification results back to variants
  const verifiedVariants: DomainVariant[] = toVerify.map((variant, idx) => {
    const settled = verificationResults[idx];
    if (settled.status === 'fulfilled') {
      return applyVerificationToScore(variant, settled.value);
    }
    // Verification threw — leave scores as-is but mark unverified
    return {
      ...variant,
      evidence: [...variant.evidence, '⚠️ Verification error — scores are theoretical'],
      verification: {
        verified: false,
        dns_resolves: false,
        ip_addresses: [],
        is_live: false,
        has_ssl: false,
        is_parking_page: false,
        brand_mentioned: false,
        content_signals: [],
        verified_threat: false,
        status: 'unverified' as const,
        checked_at: new Date().toISOString(),
      },
    };
  });

  // Combine verified + unverified (unverified keep their original theoretical scores)
  const allVariants = [
    ...verifiedVariants,
    ...skipVerify,
  ].sort((a, b) => b.risk_score - a.risk_score);

  // ── Step 3: Separate confirmed threats from theoretical ones ──────────────
  const verifiedThreats = allVariants.filter(v =>
    v.verification?.verified_threat === true
  );
  const activeRegistered = allVariants.filter(v =>
    v.verification?.dns_resolves && v.verification.is_live && !v.verification.verified_threat
  );
  const registeredInactive = allVariants.filter(v =>
    v.verification?.dns_resolves && !v.verification.is_live && !v.verification.is_parking_page
  );
  const parked = allVariants.filter(v => v.verification?.is_parking_page);
  const theoretical = allVariants.filter(v => !v.verification?.verified);

  // ── Step 4: Build summary ─────────────────────────────────────────────────
  const afterVerification = allVariants.filter(v => v.verification?.verified);

  const summary = {
    // Post-verification counts (what actually matters)
    verified_threats: verifiedThreats.length,
    active_registered: activeRegistered.length,
    registered_inactive: registeredInactive.length,
    parked_domains: parked.length,
    theoretical_variants: theoretical.length,
    // Legacy risk level counts across all variants
    critical: allVariants.filter(v => v.risk_level === 'CRITICAL').length,
    high: allVariants.filter(v => v.risk_level === 'HIGH').length,
    medium: allVariants.filter(v => v.risk_level === 'MEDIUM').length,
    low: allVariants.filter(v => v.risk_level === 'LOW').length,
    minimal: allVariants.filter(v => v.risk_level === 'MINIMAL').length,
    domains_verified: afterVerification.length,
    total_variants: allVariants.length,
  };

  const result = {
    scan_id: scanId,
    scan_date: new Date().toISOString(),
    domain,
    // Verified threats first — these are confirmed active risks
    verified_threats: verifiedThreats,
    // Split view for UI: real vs theoretical
    active_registered: activeRegistered,
    registered_inactive: registeredInactive,
    parked_domains: parked,
    theoretical_variants: theoretical.slice(0, 20), // cap theoretical list
    // Legacy: all variants sorted by score (for backward compat)
    top_threats: allVariants.slice(0, 10),
    variants: allVariants,
    summary,
    monitoring,
    disclaimer: 'Educational purposes only. Not financial advice. Not a guarantee of safety. Always verify independently.',
  };

  // ── Step 5: Store in Supabase ─────────────────────────────────────────────
  if (supabase) {
    try {
      await supabase.from('domain_lookalikes').insert({
        scan_id: scanId,
        domain,
        total_variants: allVariants.length,
        summary,
        variants: allVariants.slice(0, 50),
        created_at: new Date().toISOString(),
      });

      if (monitoring !== 'once') {
        await supabase.from('domain_monitors').upsert({
          domain,
          scan_frequency: monitoring,
          is_active: true,
          last_scan_at: new Date().toISOString(),
          variants: allVariants.slice(0, 20),
          baseline_score: verifiedThreats.length > 0
            ? Math.max(...verifiedThreats.map(v => v.risk_score))
            : 0,
        }, { onConflict: 'domain' });
      }
    } catch (err) {
      console.error('[Brand Guard] Supabase error:', err);
    }
  }

  res.status(200).json({ success: true, result });
}

export const config = {
  maxDuration: 30,
};
