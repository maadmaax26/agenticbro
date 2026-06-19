/**
 * api/brand-guard/domain-monitor.ts — Website Lookalike Detector API
 * ========================================================================
 * Generates typosquatting domain variants and scores them for phishing risk.
 * Supports one-time scans and continuous monitoring subscriptions.
 *
 * POST /api/brand-guard/domain-monitor
 *   Body: { domain: string, limit?: number, check_active?: boolean }
 *   Returns: { scan_id, domain, variants, summary }
 *
 * GET /api/brand-guard/domain-monitor?scan_id=xxx
 *   Returns: Stored scan results
 *
 * GET /api/brand-guard/domain-monitor?domain=xxx&status=monitoring
 *   Returns: All monitoring subscriptions for a domain
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ── Types ────────────────────────────────────────────────────────────────────
interface DomainMonitorRequest {
  domain: string;
  limit?: number;
  check_active?: boolean;
  monitoring?: 'once' | 'weekly' | 'daily';
}

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
  dns_info?: { resolves: boolean; ip_addresses?: string[]; has_www?: boolean };
  ssl_info?: { has_ssl: boolean; issuer?: string; is_self_signed?: boolean; is_lets_encrypt?: boolean };
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
    method: string,
    riskBoost: number,
    description: string
  ) {
    const vd = variantDomain.toLowerCase();
    if (vd !== full && !seen.has(vd) && variants.length < limit) {
      seen.add(vd);
      // Calculate similarity
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

      // Calculate risk score
      let riskScore = 0;
      if (similarity >= 0.9) riskScore += 30;
      else if (similarity >= 0.75) riskScore += 22;
      else if (similarity >= 0.5) riskScore += 12;
      else if (similarity >= 0.3) riskScore += 5;

      // Type risk
      const highRiskTypes = ['phishing_prefix', 'phishing_suffix', 'subdomain_phishing'];
      const mediumRiskTypes = ['homoglyph', 'tld_swap'];
      if (highRiskTypes.includes(type)) riskScore += 25;
      else if (mediumRiskTypes.includes(type)) riskScore += 15;
      else riskScore += 8;

      // Risk boost
      if (riskBoost >= 0.7) riskScore += 15;
      else if (riskBoost >= 0.5) riskScore += 10;
      else if (riskBoost >= 0.3) riskScore += 5;

      // Suspicious TLD
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
        riskLevel = 'CRITICAL'; threatType = 'Active phishing domain';
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

  // TLD swaps
  for (const swapTld of TLD_SWAPS) {
    if (swapTld !== tld) {
      const risk = ['.io', '.xyz', '.coin', '.crypto', '.site', '.online'].includes(swapTld) ? 0.5 : 0.3;
      addVariant(`${base}${swapTld}`, 'tld_swap', `tld${tld}->${swapTld}`, risk, `TLD swap: ${base}${swapTld}`);
    }
  }

  // Phishing prefixes
  for (const prefix of PHISHING_PREFIXES) {
    addVariant(`${prefix}${base}${tld}`, 'phishing_prefix', `prefix_${prefix}`, 0.7, `Phishing prefix: "${prefix}" added`);
  }

  // Phishing suffixes
  for (const suffix of PHISHING_SUFFIXES) {
    addVariant(`${base}${suffix}${tld}`, 'phishing_suffix', `suffix${suffix}`, 0.7, `Phishing suffix: "${suffix}" added`);
  }

  // Character omission
  for (let i = 0; i < Math.min(base.length, 8); i++) {
    const variant = base.slice(0, i) + base.slice(i + 1);
    addVariant(`${variant}${tld}`, 'char_omission', `omit_pos${i}`, 0.3, `Missing character at position ${i}`);
  }

  // Homoglyph substitution
  for (let i = 0; i < Math.min(base.length, 8); i++) {
    const char = base[i].toLowerCase();
    if (HOMOGLYPHS[char]) {
      for (const replacement of HOMOGLYPHS[char]) {
        const variant = base.slice(0, i) + replacement + base.slice(i + 1);
        addVariant(`${variant}${tld}`, 'homoglyph', `homo_${char}->${replacement}`, 0.5, `Visual lookalike: ${char} → ${replacement}`);
      }
    }
  }

  // Subdomain phishing
  for (const sub of ['login', 'signin', 'verify', 'secure', 'account']) {
    addVariant(`${base}.${sub}.com`, 'subdomain_phishing', `subdomain_${sub}`, 0.8, `Subdomain phishing: ${base}.${sub}.com`);
  }

  // Sort by risk (highest first)
  variants.sort((a, b) => b.risk_score - a.risk_score);
  return variants.slice(0, limit);
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

  // ── GET: Retrieve scan results ───────────────────────────────────────────
  if (req.method === 'GET') {
    const scanId = (req.url?.split('scan_id=')[1]?.split('&')[0]) || '';

    if (scanId && supabase) {
      const { data, error } = await supabase
        .from('domain_lookalikes')
        .select('*')
        .eq('scan_id', scanId)
        .single();
      if (data && !error) {
        res.status(200).json(data);
        return;
      }
    }

    // List monitors for a domain
    const domainParam = (req.url?.split('domain=')[1]?.split('&')[0]) || '';
    if (domainParam && supabase) {
      const { data, error } = await supabase
        .from('domain_monitors')
        .select('*')
        .eq('domain', domainParam);
      if (data && !error) {
        res.status(200).json({ success: true, monitors: data });
        return;
      }
    }

    res.status(404).json({ error: 'Not found' });
    return;
  }

  // ── POST: Run domain lookalike scan ──────────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const domain = (body.domain as string) || '';
  const limit = (body.limit as number) || 50;
  const monitoring = (body.monitoring as string) || 'once';

  if (!domain) {
    res.status(400).json({ error: 'domain is required' });
    return;
  }

  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
  if (!domainRegex.test(domain)) {
    res.status(400).json({ error: 'Invalid domain format' });
    return;
  }

  const scanId = `dl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // Generate variants
  const variants = generateDomainVariants(domain, limit);

  // Build result
  const result = {
    scan_id: scanId,
    scan_date: new Date().toISOString(),
    domain,
    total_variants: variants.length,
    summary: {
      critical: variants.filter(v => v.risk_level === 'CRITICAL').length,
      high: variants.filter(v => v.risk_level === 'HIGH').length,
      medium: variants.filter(v => v.risk_level === 'MEDIUM').length,
      low: variants.filter(v => v.risk_level === 'LOW').length,
      minimal: variants.filter(v => v.risk_level === 'MINIMAL').length,
    },
    top_threats: variants.slice(0, 10),
    variants,
    monitoring,
    disclaimer: 'Educational purposes only. Not financial advice. Not a guarantee of safety. Always verify independently.',
  };

  // Store in Supabase
  if (supabase) {
    try {
      // Store scan result
      await supabase.from('domain_lookalikes').insert({
        scan_id: scanId,
        domain,
        total_variants: variants.length,
        summary: result.summary,
        variants: variants.slice(0, 50), // Store top 50
        created_at: new Date().toISOString(),
      });

      // If monitoring requested, create/update domain monitor
      if (monitoring !== 'once') {
        await supabase.from('domain_monitors').upsert({
          domain,
          scan_frequency: monitoring,
          is_active: true,
          last_scan_at: new Date().toISOString(),
          variants: variants.slice(0, 20),
          baseline_score: 0,
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