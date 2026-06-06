/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/email-spoof.ts — Email Spoofing & Domain Registration Monitor
 * ========================================================================
 * Checks a domain's email authentication (SPF, DKIM, DMARC) for spoofing
 * vulnerability and monitors newly registered lookalike domains using
 * Certificate Transparency logs.
 *
 * POST /api/brand-guard/email-spoof
 *   Body: { domain: string, brand_name?: string, brand_monitor_id?: string }
 *   Returns: Email spoofing vulnerability report
 *
 * GET /api/brand-guard/email-spoof?domain=xxx
 *   Returns: Cached results for a domain
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ── Types ────────────────────────────────────────────────────────────────────
interface SPFRecord {
  raw: string;
  mechanisms: string[];
  allQualifier: string; // '+all', '-all', '~all', '?all'
  includes: string[];
  ipRanges: string[];
  isStrict: boolean;    // -all (hard fail)
  isSoftFail: boolean;  // ~all (soft fail)
  isPassAll: boolean;   // +all or missing (allow all — SPOOFABLE)
  dnsLookups: number;
  issues: string[];
}

interface DMARCRecord {
  raw: string;
  policy: 'none' | 'quarantine' | 'reject' | '';
  subdomainPolicy: 'none' | 'quarantine' | 'reject' | '';
  pct: number;
  rua: string[];  // aggregate report URIs
  ruf: string[];  // forensic report URIs
  aspf: 'strict' | 'relaxed' | '';
  adkim: 'strict' | 'relaxed' | '';
  isEnforced: boolean;
  issues: string[];
}

interface DKIMResult {
  found: boolean;
  selectors: string[];
  records: string[];
  issues: string[];
}

interface MXRecord {
  host: string;
  priority: number;
}

interface NewDomainMatch {
  domain: string;
  registeredDate: string | null;
  issuer: string | null;
  source: 'certstream' | 'whois' | 'generated';
  similarity: number;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
  variantType: string;
  evidence: string[];
}

interface SpoofCheckResult {
  scan_id: string;
  scan_date: string;
  domain: string;
  brand_name: string | null;
  brand_monitor_id: string | null;
  email_security: {
    spf: SPFRecord | null;
    dmarc: DMARCRecord | null;
    dkim: DKIMResult;
    mx: MXRecord[];
    overall_score: number;     // 0-100, 100 = fully protected
    vulnerability_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PROTECTED';
    spoofable: boolean;
    spoof_methods: string[];
  };
  new_domain_threats: NewDomainMatch[];
  recommendations: string[];
  disclaimer: string;
}

// ── DNS Lookup (using Google DNS-over-HTTPS — free, no API key) ──────────────
async function dnsLookup(domain: string, recordType: string): Promise<string[]> {
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${recordType}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/dns-json' } });
    if (!res.ok) return [];
    const data = await res.json() as Record<string, any>;
    if (!data.Answer || !Array.isArray(data.Answer)) return [];
    return data.Answer.map((a: Record<string, any>) => a.data || a.rdata || '').filter(Boolean);
  } catch {
    return [];
  }
}

// ── SPF Parsing ──────────────────────────────────────────────────────────────
function parseSPF(raw: string): SPFRecord {
  const mechanisms: string[] = [];
  const includes: string[] = [];
  const ipRanges: string[] = [];
  const issues: string[] = [];
  let allQualifier = '';
  let dnsLookups = 0;

  const parts = raw.split(' ').filter(Boolean);
  for (const part of parts) {
    if (part === 'v=spf1') continue;

    const mechanism = part.toLowerCase();

    if (mechanism.startsWith('include:')) {
      includes.push(part.substring(8));
      dnsLookups++;
    } else if (mechanism.startsWith('ip4:') || mechanism.startsWith('ip6:')) {
      ipRanges.push(part);
    } else if (mechanism.startsWith('a') || mechanism.startsWith('mx')) {
      dnsLookups++;
    } else if (mechanism.startsWith('redirect=')) {
      dnsLookups++;
    } else if (mechanism === '+all' || mechanism === 'all') {
      allQualifier = '+all';
    } else if (mechanism === '-all') {
      allQualifier = '-all';
    } else if (mechanism === '~all') {
      allQualifier = '~all';
    } else if (mechanism === '?all') {
      allQualifier = '?all';
    }

    mechanisms.push(part);
  }

  // If no 'all' mechanism at all, it's effectively open
  if (!allQualifier) {
    allQualifier = '+all'; // implicit
    issues.push('SPF record has no "all" mechanism — treated as ?all (neutral/permit)');
  }

  const isStrict = allQualifier === '-all';
  const isSoftFail = allQualifier === '~all';
  const isPassAll = allQualifier === '+all';

  // SPF has a maximum of 10 DNS lookups
  if (dnsLookups > 10) {
    issues.push(`SPF record requires ${dnsLookups} DNS lookups (max 10) — some mechanisms will be ignored`);
  }

  if (isPassAll) {
    issues.push('SPF allows ALL senders (+all) — domain is fully spoofable');
  } else if (allQualifier === '?all') {
    issues.push('SPF uses ?all (neutral) — no enforcement, effectively open');
  }

  return {
    raw,
    mechanisms,
    allQualifier,
    includes,
    ipRanges,
    isStrict,
    isSoftFail,
    isPassAll,
    dnsLookups,
    issues,
  };
}

// ── DMARC Parsing ────────────────────────────────────────────────────────────
function parseDMARC(raw: string): DMARCRecord {
  const parts = raw.split(';').map(p => p.trim());
  let policy: DMARCRecord['policy'] = '';
  let subdomainPolicy: DMARCRecord['subdomainPolicy'] = '';
  let pct = 100;
  const rua: string[] = [];
  const ruf: string[] = [];
  let aspf: DMARCRecord['aspf'] = '';
  let adkim: DMARCRecord['adkim'] = '';
  const issues: string[] = [];

  for (const part of parts) {
    const [key, ...valArr] = part.split('=');
    const val = valArr.join('=').trim();
    const k = key.trim().toLowerCase();

    if (k === 'p') policy = val as DMARCRecord['policy'];
    else if (k === 'sp') subdomainPolicy = val as DMARCRecord['subdomainPolicy'];
    else if (k === 'pct') pct = parseInt(val, 10) || 100;
    else if (k === 'rua') rua.push(val);
    else if (k === 'ruf') ruf.push(val);
    else if (k === 'aspf') aspf = val as DMARCRecord['aspf'];
    else if (k === 'adkim') adkim = val as DMARCRecord['adkim'];
  }

  if (!policy) {
    issues.push('No DMARC policy specified');
  } else if (policy === 'none') {
    issues.push('DMARC policy is p=none — no enforcement, spoofing is not prevented');
  }

  if (pct < 100) {
    issues.push(`DMARC applies to only ${pct}% of mail — ${(100 - pct)}% bypasses policy`);
  }

  const isEnforced = policy === 'quarantine' || policy === 'reject';

  return {
    raw,
    policy,
    subdomainPolicy,
    pct,
    rua,
    ruf,
    aspf,
    adkim,
    isEnforced,
    issues,
  };
}

// ── DKIM Check (common selectors) ────────────────────────────────────────────
const COMMON_DKIM_SELECTORS = [
  // Batch 1: Most common modern selectors
  'default', 'google', 's1', 's2', 'selector1', 'selector2',
  'zoho', 'amazonses', 'sendgrid', 'mail',
  // Batch 2: Secondary / provider-specific selectors
  'dkim', 'k1', 'k2', 'selector', 'sg', 'mandrill', 'mailgun',
  'azurecomm', 'postmark', 'protonmail',
  // Batch 3: Date-based selectors (older patterns)
  'yandex', '20161001', '20170101', '20180101',
  '20190101', '20200101', '20210101', '20220101', '20230101', '20240101',
];

async function checkDKIM(domain: string): Promise<DKIMResult> {
  const foundSelectors: string[] = [];
  const records: string[] = [];

  // Check top 10 most common selectors in parallel
  const batch1 = COMMON_DKIM_SELECTORS.slice(0, 10);
  const results1 = await Promise.all(
    batch1.map(async (sel) => {
      const txtRecords = await dnsLookup(`${sel}._domainkey.${domain}`, 'TXT');
      return { selector: sel, records: txtRecords };
    })
  );

  for (const r of results1) {
    if (r.records.length > 0) {
      foundSelectors.push(r.selector);
      records.push(...r.records);
    }
  }

  // If we found DKIM, no need to check more
  if (foundSelectors.length === 0) {
    const batch2 = COMMON_DKIM_SELECTORS.slice(10, 20);
    const results2 = await Promise.all(
      batch2.map(async (sel) => {
        const txtRecords = await dnsLookup(`${sel}._domainkey.${domain}`, 'TXT');
        return { selector: sel, records: txtRecords };
      })
    );

    for (const r of results2) {
      if (r.records.length > 0) {
        foundSelectors.push(r.selector);
        records.push(...r.records);
      }
    }
  }

  // Check remaining selectors (batch 3)
  if (foundSelectors.length === 0) {
    const batch3 = COMMON_DKIM_SELECTORS.slice(20);
    const results3 = await Promise.all(
      batch3.map(async (sel) => {
        const txtRecords = await dnsLookup(`${sel}._domainkey.${domain}`, 'TXT');
        return { selector: sel, records: txtRecords };
      })
    );

    for (const r of results3) {
      if (r.records.length > 0) {
        foundSelectors.push(r.selector);
        records.push(...r.records);
      }
    }
  }

  const issues: string[] = [];
  if (foundSelectors.length === 0) {
    issues.push('No DKIM records found for common selectors — email signatures cannot be verified');
  }

  return {
    found: foundSelectors.length > 0,
    selectors: foundSelectors,
    records,
    issues,
  };
}

// ── MX Record Lookup ─────────────────────────────────────────────────────────
async function getMXRecords(domain: string): Promise<MXRecord[]> {
  const records = await dnsLookup(domain, 'MX');
  return records
    .filter(r => r.includes(' '))
    .map(r => {
      const parts = r.split(' ');
      return { priority: parseInt(parts[0], 10) || 0, host: (parts[1] || '').replace(/\.$/, '') };
    })
    .sort((a, b) => a.priority - b.priority);
}

// ── CertStream New Domain Check ──────────────────────────────────────────────
// Uses crt.sh (free Certificate Transparency log search) to find recently
// issued certificates for lookalike domains.
async function checkCertStream(domain: string, brandName: string): Promise<NewDomainMatch[]> {
  const matches: NewDomainMatch[] = [];
  const baseDomain = domain.replace(/^www\./, '').replace(/\..+$/, '');
  const brand = brandName || baseDomain;

  try {
    // Query crt.sh for certificates matching the brand/domain
    const url = `https://crt.sh/?q=%25${encodeURIComponent(brand)}%25&output=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AgenticBro-BrandGuard/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const data = await res.json() as Array<Record<string, any>>;
      const seen = new Set<string>();

      for (const cert of data.slice(0, 50)) {
        const nameValue = (cert.name_value || '').toLowerCase();
        const commonName = (cert.common_name || '').toLowerCase();

        // Check all names in the certificate
        const names = [...nameValue.split('\n'), commonName].filter(Boolean);
        for (const name of names) {
          const cleanName = name.trim().replace(/^\*\./, ''); // Remove wildcard prefix

          // Skip the brand's own domain
          if (cleanName === domain.toLowerCase() || cleanName === `www.${domain}`.toLowerCase()) continue;

          // Skip duplicates
          if (seen.has(cleanName)) continue;
          seen.add(cleanName);

          // Calculate similarity
          const similarity = calculateSimilarity(cleanName, domain.toLowerCase());
          if (similarity < 0.3) continue; // Skip very different domains

          const variantType = classifyVariant(cleanName, domain.toLowerCase());
          const riskLevel = getVariantRiskLevel(similarity, variantType);

          matches.push({
            domain: cleanName,
            registeredDate: cert.not_before || cert.entry_timestamp || null,
            issuer: cert.issuer_name || null,
            source: 'certstream',
            similarity: Math.round(similarity * 100) / 100,
            riskLevel,
            variantType,
            evidence: [
              `Certificate found in CT log: ${cleanName}`,
              `Similarity to ${domain}: ${Math.round(similarity * 100)}%`,
              variantType !== 'exact' ? `Variant type: ${variantType}` : '',
              cert.issuer_name ? `Issuer: ${cert.issuer_name}` : '',
            ].filter(Boolean),
          });
        }
      }
    }
  } catch {
    // crt.sh may be slow or rate-limited — skip gracefully
  }

  // Sort by risk level then similarity
  const riskOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, MINIMAL: 4 };
  matches.sort((a, b) => (riskOrder[a.riskLevel] ?? 5) - (riskOrder[b.riskLevel] ?? 5) || b.similarity - a.similarity);

  return matches.slice(0, 30);
}

// ── Similarity Scoring ───────────────────────────────────────────────────────
function calculateSimilarity(candidate: string, original: string): number {
  const a = candidate.replace(/^www\./, '').split('.')[0];
  const b = original.replace(/^www\./, '').split('.')[0];

  if (a === b) return 1.0;
  if (a.includes(b)) return 0.85;
  if (b.includes(a)) return 0.75;

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return maxLen > 0 ? 1 - matrix[a.length][b.length] / maxLen : 0;
}

function classifyVariant(candidate: string, original: string): string {
  const a = candidate.replace(/^www\./, '');
  const b = original.replace(/^www\./, '');

  const baseA = a.split('.')[0];
  const baseB = b.split('.')[0];
  const tldA = a.includes('.') ? '.' + a.split('.').slice(1).join('.') : '';
  const tldB = b.includes('.') ? '.' + b.split('.').slice(1).join('.') : '';

  // TLD swap
  if (baseA === baseB && tldA !== tldB) return 'tld_swap';

  // Subdomain phishing (e.g., login.agenticbro.com)
  const phishingPrefixes = ['login', 'signin', 'sign-in', 'account', 'secure', 'verify', 'update', 'auth', 'portal', 'app', 'support', 'help'];
  for (const prefix of phishingPrefixes) {
    if (a.startsWith(`${prefix}.`)) return 'subdomain_phishing';
  }

  // Homoglyph
  const homoglyphs: Record<string, string[]> = { a: ['4', '@'], e: ['3'], g: ['9'], i: ['1', 'l'], l: ['1', 'i'], o: ['0'], s: ['5', '$'], t: ['7'] };
  for (const [char, subs] of Object.entries(homoglyphs)) {
    if (baseA.includes(...subs) && baseB.includes(char)) return 'homoglyph';
  }

  // Prefix/suffix addition
  if (baseA.startsWith(baseB) || baseA.endsWith(baseB)) return 'prefix_suffix';

  // Character omission/addition
  if (Math.abs(baseA.length - baseB.length) <= 1) {
    const shorter = baseA.length < baseB.length ? baseA : baseB;
    const longer = baseA.length < baseB.length ? baseB : baseA;
    let i = 0, j = 0, diff = 0;
    while (i < shorter.length && j < longer.length) {
      if (shorter[i] === longer[j]) { i++; j++; }
      else { diff++; j++; }
    }
    if (diff <= 1) return 'char_omission';
  }

  return 'similarity';
}

function getVariantRiskLevel(similarity: number, variantType: string): NewDomainMatch['riskLevel'] {
  // TLD swaps and homoglyphs are highest risk
  if (['tld_swap', 'homoglyph', 'subdomain_phishing'].includes(variantType) && similarity >= 0.7) return 'CRITICAL';
  if (similarity >= 0.85) return 'HIGH';
  if (similarity >= 0.6) return 'MEDIUM';
  if (similarity >= 0.4) return 'LOW';
  return 'MINIMAL';
}

// ── Score Calculation ─────────────────────────────────────────────────────────
function calculateEmailSecurityScore(spf: SPFRecord | null, dmarc: DMARCRecord | null, dkim: DKIMResult, mx: MXRecord[]): {
  score: number;
  level: SpoofCheckResult['email_security']['vulnerability_level'];
  spoofable: boolean;
  methods: string[];
} {
  let score = 0;
  const methods: string[] = [];

  // SPF scoring (0-35 points)
  if (!spf) {
    score += 0;
    methods.push('No SPF record — anyone can send email as this domain');
  } else if (spf.isPassAll) {
    score += 5;
    methods.push('SPF allows all senders (+all) — domain is fully spoofable');
  } else if (!spf.isStrict && !spf.isSoftFail && !spf.isPassAll) {
    // ?all or missing all qualifier
    score += 5;
    methods.push('SPF has ?all or no "all" mechanism — effectively allows all senders');
  } else if (spf.isSoftFail) {
    score += 20;
    // Soft fail doesn't block — just marks
  } else if (spf.isStrict) {
    score += 35;
  }

  // DMARC scoring (0-40 points)
  if (!dmarc) {
    score += 0;
    methods.push('No DMARC record — receiving servers have no policy guidance');
  } else if (dmarc.policy === 'none' || dmarc.policy === '') {
    score += 10;
    methods.push('DMARC policy is p=none — no enforcement action taken on failures');
  } else if (dmarc.policy === 'quarantine') {
    score += 25;
    if (dmarc.pct < 100) {
      methods.push(`DMARC quarantine applies to only ${dmarc.pct}% of mail`);
      score -= 10;
    }
  } else if (dmarc.policy === 'reject') {
    score += 40;
    if (dmarc.pct < 100) {
      methods.push(`DMARC reject applies to only ${dmarc.pct}% of mail`);
      score -= 10;
    }
  }

  // DKIM scoring (0-15 points)
  if (dkim.found) {
    score += 15;
  } else {
    methods.push('No DKIM record found — email signatures cannot be cryptographically verified');
  }

  // MX record existence (0-10 points)
  if (mx.length > 0) {
    score += 10;
  } else {
    methods.push('No MX records — domain may not send email, but also can\'t authenticate it');
  }

  score = Math.max(0, Math.min(100, score));

  // Determine vulnerability level
  let level: SpoofCheckResult['email_security']['vulnerability_level'];
  if (score >= 80) level = 'PROTECTED';
  else if (score >= 60) level = 'LOW';
  else if (score >= 40) level = 'MEDIUM';
  else if (score >= 20) level = 'HIGH';
  else level = 'CRITICAL';

  // A domain is spoofable if SPF doesn't hard-fail AND DMARC doesn't reject
  const spoofable = !spf?.isStrict && (!dmarc || dmarc.policy === 'none' || dmarc.policy === '');

  return { score, level, spoofable, methods };
}

// ── Build Recommendations ────────────────────────────────────────────────────
function buildRecommendations(
  spf: SPFRecord | null,
  dmarc: DMARCRecord | null,
  dkim: DKIMResult,
  spoofable: boolean,
  newThreats: NewDomainMatch[]
): string[] {
  const recs: string[] = [];

  if (!spf) {
    recs.push('📧 Add an SPF record with "-all" to specify which servers can send email for your domain');
  } else if (spf.isPassAll) {
    recs.push('🔒 Change SPF from "+all" to "-all" — currently allows ANYONE to send email as your domain');
  } else if (spf.isSoftFail) {
    recs.push('⚠️ Change SPF from "~all" to "-all" — soft fail only marks spam, it doesn\'t reject it');
  } else if (spf.dnsLookups > 10) {
    recs.push('⚠️ SPF has too many DNS lookups (>10) — some mechanisms will be ignored by receivers');
  }

  if (!dmarc) {
    recs.push('📧 Add a DMARC record starting with "v=DMARC1; p=none" and gradually move to p=reject');
  } else if (dmarc.policy === 'none') {
    recs.push('⚠️ Upgrade DMARC from p=none to p=quarantine, then to p=reject once you verify legitimate mail passes');
  } else if (dmarc.policy === 'quarantine') {
    recs.push('🔒 Consider upgrading DMARC from p=quarantine to p=reject for maximum protection');
  }

  if (dmarc && dmarc.pct < 100) {
    recs.push(`⚠️ Increase DMARC pct from ${dmarc.pct}% to 100% — currently ${100 - dmarc.pct}% of mail bypasses the policy`);
  }

  if (!dkim.found) {
    recs.push('📧 Set up DKIM signing for your email — it enables receivers to verify emails are actually from you');
  }

  if (spoofable) {
    recs.push('🚨 Your domain is currently SPOOFABLE — attackers can send emails pretending to be you');
  }

  const criticalThreats = newThreats.filter(t => t.riskLevel === 'CRITICAL' || t.riskLevel === 'HIGH');
  if (criticalThreats.length > 0) {
    recs.push(`🔍 Found ${criticalThreats.length} high-risk lookalike domain${criticalThreats.length > 1 ? 's' : ''} with active certificates — monitor for phishing campaigns`);
  }

  if (recs.length === 0) {
    recs.push('✅ Your email authentication is well-configured — continue monitoring for new threats');
  }

  return recs;
}

// ── Main Handler ─────────────────────────────────────────────────────────────
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── GET: Retrieve cached results ─────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url || '', 'https://placeholder');
    const domain = url.searchParams.get('domain');
    if (!domain) { res.status(400).json({ error: 'Missing domain parameter' }); return; }

    if (supabase) {
      const { data, error } = await supabase
        .from('email_spoof_checks')
        .select('*')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        res.status(200).json({ success: true, result: data.result });
        return;
      }
    }

    res.status(404).json({ error: 'No cached results found for this domain' });
    return;
  }

  // ── POST: Run email spoof check ──────────────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const domain = ((body.domain as string) || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/^www\./, '');
  const brandName = (body.brand_name as string) || null;
  const brandMonitorId = (body.brand_monitor_id as string) || '';

  if (!domain) {
    res.status(400).json({ error: 'Missing required field: domain' });
    return;
  }

  // Validate domain format
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/;
  if (!domainRegex.test(domain)) {
    res.status(400).json({ error: 'Invalid domain format' });
    return;
  }

  const scanId = `es-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // ── Auth check (optional — allow unauthenticated for now) ────────────────
  // Will add credit deduction later

  // ── Run DNS checks in parallel ──────────────────────────────────────────
  const [spfRecords, dmarcRecords, dkimResult, mxRecords, certStreamMatches] = await Promise.all([
    dnsLookup(domain, 'TXT'),
    dnsLookup(`_dmarc.${domain}`, 'TXT'),
    checkDKIM(domain),
    getMXRecords(domain),
    checkCertStream(domain, brandName || domain),
  ]);

  // ── Parse SPF ───────────────────────────────────────────────────────────
  let spf: SPFRecord | null = null;
  const spfRaw = spfRecords.find(r => r.startsWith('"v=spf1') || r.startsWith('v=spf1'));
  if (spfRaw) {
    spf = parseSPF(spfRaw.replace(/^"|"$/g, ''));
  } else {
    // Check if SPF is embedded in multi-record TXT
    for (const record of spfRecords) {
      const unwrapped = record.replace(/^"|"$/g, '');
      if (unwrapped.startsWith('v=spf1')) {
        spf = parseSPF(unwrapped);
        break;
      }
    }
  }

  // ── Parse DMARC ────────────────────────────────────────────────────────
  let dmarc: DMARCRecord | null = null;
  const dmarcRaw = dmarcRecords.find(r => r.includes('v=DMARC1') || r.includes('v=dmarc1'));
  if (dmarcRaw) {
    dmarc = parseDMARC(dmarcRaw.replace(/^"|"$/g, ''));
  }

  // ── Calculate Security Score ────────────────────────────────────────────
  const { score, level, spoofable, methods: spoofMethods } = calculateEmailSecurityScore(spf, dmarc, dkimResult, mxRecords);

  // ── Build Result ────────────────────────────────────────────────────────
  const result: SpoofCheckResult = {
    scan_id: scanId,
    scan_date: new Date().toISOString(),
    domain,
    brand_name: brandName,
    brand_monitor_id: brandMonitorId || null,
    email_security: {
      spf,
      dmarc,
      dkim: dkimResult,
      mx: mxRecords,
      overall_score: score,
      vulnerability_level: level,
      spoofable,
      spoof_methods: spoofMethods,
    },
    new_domain_threats: certStreamMatches,
    recommendations: buildRecommendations(spf, dmarc, dkimResult, spoofable, certStreamMatches),
    disclaimer: 'Educational purposes only. Not financial advice. Not a guarantee of email security. Always verify domain configurations independently.',
  };

  // ── Store in Supabase ──────────────────────────────────────────────────
  if (supabase) {
    try {
      await supabase.from('email_spoof_checks').insert({
        scan_id: scanId,
        domain,
        brand_monitor_id: brandMonitorId || null,
        overall_score: score,
        vulnerability_level: level,
        spoofable,
        new_threats_count: certStreamMatches.length,
        result,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Brand Guard] Supabase insert error:', err);
    }
  }

  res.status(200).json({ success: true, result });
}

export const config = {
  maxDuration: 30,
};