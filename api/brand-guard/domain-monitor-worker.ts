/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restricted — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/domain-monitor-worker.ts — Domain Lookalike Detection Worker
 * ========================================================================
 * Background worker that runs crt.sh Certificate Transparency lookalike detection
 * on schedule for active domain_monitors.
 *
 * GET /api/brand-guard/domain-monitor-worker
 *   Returns: Processing report with counts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ── Types ────────────────────────────────────────────────────────────────────
interface DomainVariant {
  domain: string;
  similarity: number;
  variant_type: string;
  risk_score: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
  threat_type: string;
  evidence: string[];
  registeredDate: string | null;
  issuer: string | null;
  source: 'certstream' | 'crt.sh' | 'generated';
}

// ── Utility Functions ─────────────────────────────────────────────────────────

function isScanStale(last_scan_at: string | null, scan_frequency: string, now: Date): boolean {
  if (!last_scan_at) return true;
  const diffHours = (now.getTime() - new Date(last_scan_at).getTime()) / (1000 * 60 * 60);
  switch (scan_frequency) {
    case 'daily': return diffHours >= 24;
    case 'weekly': return diffHours >= 168;
    case 'monthly': return diffHours >= 720;
    case 'once': return false;
    default: return true;
  }
}

/**
 * Query crt.sh for certificates matching a domain pattern.
 * Returns an array of distinct domain names found.
 */
async function queryCrtSh(domain: string): Promise<string[]> {
  try {
    const url = `https://crt.sh/?q=%25.${domain}&output=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AgenticBro-BrandGuard/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`[domain-monitor] crt.sh returned ${res.status} for ${domain}`);
      return [];
    }
    const data = await res.json();
    const domains = new Set<string>();
    for (const entry of data) {
      if (entry.name_value) {
        for (const name of entry.name_value.split('\n')) {
          const trimmed = name.trim().toLowerCase();
          // Filter out wildcards and the exact domain itself
          if (trimmed && !trimmed.startsWith('*') && trimmed !== domain && trimmed !== `www.${domain}`) {
            domains.add(trimmed);
          }
        }
      }
    }
    return Array.from(domains);
  } catch (err) {
    console.error('[domain-monitor] crt.sh query error:', err);
    return [];
  }
}

/**
 * Score a lookalike domain for risk.
 */
function scoreLookalike(baseDomain: string, lookalike: string): DomainVariant {
  const base = baseDomain.toLowerCase();
  const look = lookalike.toLowerCase();

  // Compute simple similarity (Levenshtein-style heuristic)
  const baseParts = base.split('.');
  const lookParts = look.split('.');
  const baseName = baseParts[0];
  const lookName = lookParts[0];

  const lengthDiff = Math.abs(baseName.length - lookName.length);
  let matchChars = 0;
  const minLen = Math.min(baseName.length, lookName.length);
  for (let i = 0; i < minLen; i++) {
    if (baseName[i] === lookName[i]) matchChars++;
  }
  const similarity = minLen > 0 ? Math.round((matchChars / Math.max(baseName.length, lookName.length)) * 100) : 0;

  // Detect variant type
  const phishingKeywords = ['login', 'signin', 'secure', 'verify', 'update', 'auth', 'wallet', 'claim', 'bonus', 'free', 'reward', 'account', 'support', 'help', 'service', 'portal', 'app'];
  const hasPhishingKeyword = phishingKeywords.some(kw => look.includes(kw));
  const isHomoglyph = lookName.length === baseName.length && similarity >= 80 && lookName !== baseName;
  const isTyposquat = lengthDiff <= 2 && similarity >= 60 && lookName !== baseName;
  const isSubdomain = look.endsWith(`.${base}`);

  let variantType = 'unknown';
  let threatType = 'Lookalike';
  let riskScore = 30;
  let riskLevel: DomainVariant['risk_level'] = 'LOW';
  const evidence: string[] = [];

  if (hasPhishingKeyword) {
    variantType = 'phishing_keyword';
    threatType = 'Phishing';
    riskScore = 85;
    riskLevel = 'HIGH';
    evidence.push(`Contains phishing keyword in domain`);
  } else if (isHomoglyph) {
    variantType = 'homoglyph';
    threatType = 'Homoglyph attack';
    riskScore = 90;
    riskLevel = 'CRITICAL';
    evidence.push('Visually similar domain (homoglyph)');
  } else if (isTyposquat) {
    variantType = 'typosquat';
    threatType = 'Typosquatting';
    riskScore = 70;
    riskLevel = 'HIGH';
    evidence.push('Typo-like domain variation');
  } else if (isSubdomain) {
    variantType = 'subdomain';
    threatType = 'Subdomain takeover';
    riskScore = 50;
    riskLevel = 'MEDIUM';
    evidence.push('Subdomain of monitored domain');
  } else if (similarity >= 60) {
    variantType = 'similar';
    threatType = 'Domain impersonation';
    riskScore = similarity;
    riskLevel = similarity >= 80 ? 'HIGH' : similarity >= 60 ? 'MEDIUM' : 'LOW';
    evidence.push(`${similarity}% similar to ${base}`);
  } else {
    variantType = 'related';
    riskScore = 20;
    riskLevel = 'MINIMAL';
    evidence.push(`Found in CT logs for ${base}`);
  }

  return {
    domain: look,
    similarity,
    variant_type: variantType,
    risk_score: riskScore,
    risk_level: riskLevel,
    threat_type: threatType,
    evidence,
    registeredDate: null,
    issuer: null,
    source: 'crt.sh',
  };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const report = {
    total_processed: 0,
    total_scanned: 0,
    alerts_created: 0,
    successful: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();

    const { data: monitors, error: monitorsError } = await supabase
      .from('domain_monitors')
      .select('id, owner_id, brand_monitor_id, domain, last_scan_at, scan_frequency, is_active')
      .eq('is_active', true);

    if (monitorsError) {
      throw new Error(`Failed to fetch domain monitors: ${monitorsError.message}`);
    }

    if (!monitors || monitors.length === 0) {
      res.status(200).json({ ...report, message: 'No active domain monitors found' });
      return;
    }

    for (const monitor of monitors) {
      if (!isScanStale(monitor.last_scan_at, monitor.scan_frequency, now)) {
        continue;
      }

      report.total_processed++;
      report.total_scanned++;

      try {
        const domain = monitor.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

        // Query crt.sh for lookalike domains
        const lookalikes = await queryCrtSh(domain);

        // Score each lookalike
        const variants: DomainVariant[] = lookalikes.slice(0, 50).map(look => scoreLookalike(domain, look));

        // Filter for dangerous variants only
        const dangerousVariants = variants.filter(v => v.risk_level === 'CRITICAL' || v.risk_level === 'HIGH');

        // Create alerts for dangerous lookalikes
        let alertsCreated = 0;
        for (const variant of dangerousVariants) {
          const { data: alertData, error: alertErr } = await supabase
            .from('brand_guard_alerts')
            .insert({
              brand_monitor_id: monitor.brand_monitor_id,
              alert_type: 'new_threat',
              severity: variant.risk_level === 'CRITICAL' ? 'critical' : 'high',
              title: `Dangerous Lookalike Domain: ${variant.domain}`,
              message: `Potential ${variant.threat_type.toLowerCase()} domain ${variant.domain} detected for ${domain}. Risk: ${variant.risk_level}`,
              threat_id: `lookalike_${variant.domain}_${Date.now()}`,
              target: domain,
              platform: 'domain',
              risk_score: variant.risk_score,
              risk_level: variant.risk_level,
              evidence: variant.evidence,
            })
            .select('id')
            .single();

          if (!alertErr && alertData) alertsCreated++;
        }

        // Store scan results in domain_lookalikes
        await supabase.from('domain_lookalikes').insert({
          scan_id: `lookalike_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          domain,
          total_variants: variants.length,
          summary: {
            critical_count: variants.filter(v => v.risk_level === 'CRITICAL').length,
            high_count: variants.filter(v => v.risk_level === 'HIGH').length,
            medium_count: variants.filter(v => v.risk_level === 'MEDIUM').length,
            low_count: variants.filter(v => v.risk_level === 'LOW').length,
            min_count: variants.filter(v => v.risk_level === 'MINIMAL').length,
          },
          variants: variants,
          created_at: new Date().toISOString(),
        });

        // Update last_scan_at
        await supabase
          .from('domain_monitors')
          .update({ last_scan_at: now.toISOString(), updated_at: now.toISOString() })
          .eq('id', monitor.id);

        report.successful++;
        report.alerts_created += alertsCreated;
      } catch (error) {
        report.failed++;
        report.errors.push(`Domain scan error for ${monitor.domain}: ${String(error)}`);
      }
    }

    res.status(200).json({
      ...report,
      message: `Processed ${report.total_processed} domain monitors, ${report.total_scanned} scanned, ${report.alerts_created} alerts created`,
    });
  } catch (error) {
    console.error('[domain-monitor-worker] Fatal error:', error);
    res.status(500).json({ error: String(error) });
  }
}