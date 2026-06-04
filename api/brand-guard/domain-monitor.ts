/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

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
  domain_age?: { days?: number; created_date?: string; registrar?: string; is_new?: boolean; source?: string };
  active_page?: { is_active: boolean; status?: number; title?: string; has_brand_content: boolean; brand_matches?: string[]; impersonation_confidence: number; content_snippet?: string };
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

// ── Domain Age Lookup (WHOIS via free APIs) ──────────────────────────────────────

async function lookupDomainAge(domain: string): Promise<DomainVariant['domain_age']> {
  try {
    // Use whoisjson.com free tier (10 req/hr without key)
    const res = await fetch(`https://whoisjson.com/api/v1/whois?domain=${encodeURIComponent(domain)}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { source: 'whois_failed' };
    const data = await res.json();

    // Try multiple date fields
    const createdStr = data.creation_date || data.created_date || data.creationDate || null;
    const registrar = data.registrar || data.registrarName || null;

    if (!createdStr) return { registrar, source: 'whois_no_date' };

    // Parse date (handles ISO, RFC, and Unix timestamp formats)
    let createdDate: Date | null = null;
    if (typeof createdStr === 'string') {
      createdDate = new Date(createdStr);
    } else if (typeof createdStr === 'number') {
      createdDate = new Date(createdStr * 1000); // Unix timestamp
    } else if (Array.isArray(createdStr) && createdStr.length > 0) {
      createdDate = new Date(createdStr[0]);
    }

    if (!createdDate || isNaN(createdDate.getTime())) return { registrar, source: 'whois_invalid_date' };

    const days = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    const isNew = days < 90; // Less than 90 days = suspicious new domain

    return {
      days,
      created_date: createdDate.toISOString().split('T')[0],
      registrar: registrar || undefined,
      is_new: isNew,
      source: 'whois',
    };
  } catch {
    // Fallback: try dns0.eu free API
    try {
      const res2 = await fetch(`https://dns0.eu/whois/${encodeURIComponent(domain)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res2.ok) return { source: 'whois_unavailable' };
      const text = await res2.text();
      // Parse WHOIS text output for creation date
      const dateMatch = text.match(/Creation Date:\s*(.+)/i) || text.match(/Created Date:\s*(.+)/i) || text.match(/Registered On:\s*(.+)/i);
      if (dateMatch) {
        const createdDate = new Date(dateMatch[1].trim());
        if (!isNaN(createdDate.getTime())) {
          const days = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          return { days, created_date: createdDate.toISOString().split('T')[0], is_new: days < 90, source: 'whois_text' };
        }
      }
      return { source: 'whois_no_date' };
    } catch {
      return { source: 'whois_unavailable' };
    }
  }
}

// ── Active Page & Impersonation Detection ──────────────────────────────────────

async function checkActiveImpersonation(
  domain: string,
  brandName: string,
  brandDomain: string
): Promise<DomainVariant['active_page']> {
  const result: DomainVariant['active_page'] = {
    is_active: false,
    has_brand_content: false,
    impersonation_confidence: 0,
  };

  try {
    const urls = [`https://${domain}`, `http://${domain}`, `https://www.${domain}`];
    let response: Response | null = null;
    let finalUrl = '';

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(8000),
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });
        if (res.ok) {
          response = res;
          finalUrl = res.url || url;
          break;
        }
      } catch { /* try next URL */ }
    }

    if (!response) return result;

    result.is_active = true;
    result.status = response.status;

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    result.title = titleMatch ? titleMatch[1].trim().substring(0, 200) : undefined;

    // Check for brand name mentions in visible content
    const visibleText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 5000)
      .toLowerCase();

    const brandLower = brandName.toLowerCase();
    const brandParts = brandLower.split(/\s+/).filter(p => p.length > 2);

    // Check title for brand name
    const titleLower = (result.title || '').toLowerCase();
    const titleHasBrand = brandParts.some(p => titleLower.includes(p));

    // Check meta tags for brand references
    const metaMatches = html.match(/<meta[^>]*(?:content|property|name)=["'][^"']*?["'][^>]*>/gi) || [];
    const metaText = metaMatches.join(' ').toLowerCase();
    const metaHasBrand = brandParts.some(p => metaText.includes(p));

    // Check for brand domain references (impersonators often reference the real site)
    const domainLower = brandDomain.toLowerCase().replace(/^www\./, '');
    const htmlLower = html.toLowerCase();
    const referencesRealDomain = htmlLower.includes(domainLower);

    // Check for login/wallet/connect phrases (common in crypto phishing)
    const phishingPhrases = [
      'connect wallet', 'connect your wallet', 'link wallet',
      'claim airdrop', 'claim your', 'free claim', 'connect to claim',
      'verify wallet', 'wallet verification', 'sync wallet',
      'sign transaction', 'approve transaction',
    ];
    const foundPhishing = phishingPhrases.filter(p => visibleText.includes(p));

    // Check for copied site indicators (same CSS frameworks, same image hashes, etc.)
    const hasReact = htmlLower.includes('react') || htmlLower.includes('__next');
    const hasLogin = visibleText.includes('log in') || visibleText.includes('sign in') || visibleText.includes('login');
    const hasCryptoWallet = visibleText.includes('phantom') || visibleText.includes('solflare') || visibleText.includes('metamask');

    // Calculate impersonation confidence (0-100)
    let confidence = 0;
    const brandMatches: string[] = [];

    if (titleHasBrand) { confidence += 25; brandMatches.push('title_contains_brand'); }
    if (metaHasBrand) { confidence += 15; brandMatches.push('meta_contains_brand'); }
    if (referencesRealDomain) { confidence += 15; brandMatches.push('references_real_domain'); }
    if (foundPhishing.length > 0) { confidence += 20 * Math.min(foundPhishing.length, 2); brandMatches.push(`phishing_phrases:${foundPhishing.join(',')}`); }
    if (hasLogin) { confidence += 10; brandMatches.push('has_login_form'); }
    if (hasCryptoWallet) { confidence += 15; brandMatches.push('crypto_wallet_connect'); }

    // Extract a snippet around the brand name
    const brandIdx = visibleText.indexOf(brandLower);
    if (brandIdx >= 0) {
      const start = Math.max(0, brandIdx - 60);
      const end = Math.min(visibleText.length, brandIdx + brandLower.length + 60);
      result.content_snippet = visibleText.substring(start, end).trim();
    }

    result.has_brand_content = confidence > 0;
    result.impersonation_confidence = Math.min(100, confidence);
    result.brand_matches = brandMatches;

  } catch {
    // Domain not reachable or other error — that's fine
  }

  return result;
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

  // ── Enrich variants with domain age & active page checks ──────────────────
  const brandName = (body.brand_name as string) || domain.split('.')[0];
  const checkActive = body.check_active !== false; // default true

  // Run enrichment in parallel (with concurrency limit)
  const CONCURRENCY = 5;
  const topVariants = variants.slice(0, Math.min(limit, 20)); // Check top 20 highest-risk variants

  for (let i = 0; i < topVariants.length; i += CONCURRENCY) {
    const batch = topVariants.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (v) => {
        // Domain age lookup
        const age = await lookupDomainAge(v.domain);
        v.domain_age = age;

        // Active page check + impersonation detection
        if (checkActive) {
          const activePage = await checkActiveImpersonation(v.domain, brandName, domain);
          v.active_page = activePage;
        }

        // Recalculate risk score with new factors
        let bonusScore = 0;

        // Domain age scoring: newer = more suspicious
        if (age?.is_new) {
          bonusScore += 15;
          v.evidence.push(`New domain: registered ${age.days} days ago (${age.created_date})`);
        } else if (age?.days !== undefined && age.days < 180) {
          bonusScore += 8;
          v.evidence.push(`Recent domain: ${age.days} days old`);
        } else if (age?.days !== undefined && age.days > 365) {
          bonusScore -= 3; // Older domains slightly less suspicious
        }

        // Active page scoring
        if (v.active_page?.is_active) {
          bonusScore += 5; // Any active page on a lookalike is worth noting
          if (v.active_page.impersonation_confidence > 50) {
            bonusScore += 20;
            v.evidence.push(`Active impersonation page (confidence: ${v.active_page.impersonation_confidence}%)`);
          } else if (v.active_page.impersonation_confidence > 20) {
            bonusScore += 10;
            v.evidence.push(`Possible brand content detected (confidence: ${v.active_page.impersonation_confidence}%)`);
          }
          if (v.active_page.has_brand_content) {
            bonusScore += 10;
            v.evidence.push(`Brand name found on active page`);
          }
          if (v.active_page.brand_matches?.some(m => m.startsWith('phishing_phrases'))) {
            bonusScore += 10;
            v.evidence.push(`Phishing wallet-connect language detected`);
          }
        }

        v.risk_score = Math.min(100, Math.max(0, v.risk_score + bonusScore));

        // Recalculate risk level based on updated score
        if (v.risk_score >= 70) {
          v.risk_level = 'CRITICAL'; v.threat_type = 'Active phishing domain'; v.takedown_priority = 'Urgent'; v.takedown_action = 'File abuse report with registrar + submit to phishing databases';
        } else if (v.risk_score >= 45) {
          v.risk_level = 'HIGH'; v.threat_type = 'Probable lookalike domain'; v.takedown_priority = 'High'; v.takedown_action = 'File abuse report + monitor for active content';
        } else if (v.risk_score >= 25) {
          v.risk_level = 'MEDIUM'; v.threat_type = 'Possible lookalike domain'; v.takedown_priority = 'Medium'; v.takedown_action = 'Monitor weekly and file abuse report if site becomes active';
        } else if (v.risk_score >= 10) {
          v.risk_level = 'LOW'; v.threat_type = 'Unlikely threat'; v.takedown_priority = 'Monitor'; v.takedown_action = 'Add to periodic monitoring';
        } else {
          v.risk_level = 'MINIMAL'; v.threat_type = 'No significant risk'; v.takedown_priority = 'Monitor'; v.takedown_action = 'Add to periodic monitoring';
        }

        return v;
      })
    );
    // Apply results back to variants array
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        Object.assign(batch[idx], r.value);
      }
    });
  }

  // Re-sort by updated risk score
  variants.sort((a, b) => b.risk_score - a.risk_score);

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