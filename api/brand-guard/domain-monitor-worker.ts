/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/domain-monitor-worker.ts — Domain Monitoring Cron Job
 * ========================================================================
 * Processes active domain_monitors subscriptions and verifies whether
 * registered lookalike domains have become active threats since last scan.
 *
 * Runs every 6 hours via Vercel Cron.
 * Uses the same three-layer verification as domain-monitor.ts:
 *   Layer 1 — DNS:     Does it resolve?
 *   Layer 2 — HTTP:    Is the site live?
 *   Layer 3 — Content: Brand mentions? Phishing signals?
 *
 * New confirmed threats trigger alerts via the brand_guard_alerts table.
 *
 * GET /api/brand-guard/domain-monitor-worker
 *   (Called by Vercel Cron or manually by admin)
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import { verifyDomainActive } from './domain-monitor.js';

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ── Config ─────────────────────────────────────────────────────────────────────
const MAX_MONITORS_PER_RUN = 10;      // process at most this many monitors per cron tick
const VERIFY_TOP_N = 10;             // verify the top N variants per monitor

// ── Types ──────────────────────────────────────────────────────────────────────
interface StoredVariant {
  domain: string;
  risk_score: number;
  risk_level: string;
  variant_type: string;
}

interface DomainMonitorRow {
  id: string;
  owner_id: string | null;
  brand_monitor_id: string | null;
  domain: string;
  variants: StoredVariant[] | null;
  scan_frequency: 'daily' | 'weekly' | 'monthly' | 'once';
  last_scan_at: string | null;
  is_active: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDue(monitor: DomainMonitorRow): boolean {
  if (!monitor.last_scan_at) return true;
  const last = new Date(monitor.last_scan_at).getTime();
  const now = Date.now();
  const intervals: Record<string, number> = {
    daily:   24 * 60 * 60 * 1000,
    weekly:  7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    once:    Infinity,
  };
  const interval = intervals[monitor.scan_frequency] ?? Infinity;
  return now - last >= interval;
}

function extractBrandKeywords(domain: string): string[] {
  // Strip TLD and split on hyphens/dots to get brand words
  const base = domain.replace(/\.[^.]+$/, '').replace(/^www\./, '');
  const words = base.split(/[-.]/).filter(w => w.length > 2);
  return [base, domain.replace(/\.[^.]+$/, ''), ...words].filter(Boolean);
}

// ── Main Handler ──────────────────────────────────────────────────────────────

type VercelRequest = IncomingMessage & { method?: string; headers: Record<string, string | string[] | undefined> };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Vercel Cron provides Authorization: Bearer <CRON_SECRET>
  // We also allow manual admin calls with the same token
  const authHeader = req.headers['authorization'] || '';
  const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && token !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  if (!supabase) {
    res.status(503).json({ error: 'Supabase not configured' }); return;
  }

  const startedAt = Date.now();
  const results: Array<{
    domain: string;
    new_threats: number;
    checked_variants: number;
    error?: string;
  }> = [];

  // ── Fetch active monitors ──────────────────────────────────────────────────
  const { data: monitors, error: fetchErr } = await supabase
    .from('domain_monitors')
    .select('id, owner_id, brand_monitor_id, domain, variants, scan_frequency, last_scan_at, is_active')
    .eq('is_active', true)
    .neq('scan_frequency', 'once')
    .order('last_scan_at', { ascending: true, nullsFirst: true })
    .limit(MAX_MONITORS_PER_RUN);

  if (fetchErr) {
    console.error('[Domain Worker] Failed to fetch monitors:', fetchErr.message);
    res.status(500).json({ error: fetchErr.message }); return;
  }

  const dueMonitors = (monitors || []).filter(isDue) as DomainMonitorRow[];
  console.log(`[Domain Worker] ${dueMonitors.length} monitors due for verification`);

  // ── Process each monitor ───────────────────────────────────────────────────
  for (const monitor of dueMonitors) {
    const { id, domain, owner_id, brand_monitor_id, variants } = monitor;
    const brandKeywords = extractBrandKeywords(domain);

    try {
      // Take the stored high-risk variants and re-verify them
      const storedVariants = (variants || []) as StoredVariant[];
      const toCheck = storedVariants
        .filter(v => v.risk_score >= 35)
        .sort((a, b) => b.risk_score - a.risk_score)
        .slice(0, VERIFY_TOP_N)
        .map(v => v.domain);

      if (toCheck.length === 0) {
        console.log(`[Domain Worker] No high-risk variants for ${domain}, skipping`);
        await supabase.from('domain_monitors').update({ last_scan_at: new Date().toISOString() }).eq('id', id);
        continue;
      }

      console.log(`[Domain Worker] Verifying ${toCheck.length} variants for ${domain}`);

      // Verify in parallel with a reasonable timeout
      const verifications = await Promise.allSettled(
        toCheck.map(d => verifyDomainActive(d, brandKeywords))
      );

      const newThreats: Array<{ domain: string; signals: string[]; brand_mentioned: boolean; risk: string }> = [];

      for (let i = 0; i < toCheck.length; i++) {
        const settled = verifications[i];
        if (settled.status !== 'fulfilled') continue;

        const v = settled.value;
        if (!v.verified_threat) continue;

        const storedVariant = storedVariants.find(sv => sv.domain === toCheck[i]);
        newThreats.push({
          domain: toCheck[i],
          signals: v.content_signals,
          brand_mentioned: v.brand_mentioned,
          risk: storedVariant?.risk_level || 'HIGH',
        });
      }

      // ── Create alerts for new verified threats ──────────────────────────
      if (newThreats.length > 0 && (owner_id || brand_monitor_id)) {
        const alertRows = newThreats.map(threat => ({
          owner_id,
          brand_monitor_id,
          alert_type: 'domain_threat',
          severity: threat.risk === 'CRITICAL' ? 'critical' : 'high',
          title: `Active lookalike domain detected: ${threat.domain}`,
          message: [
            `The domain ${threat.domain} is live and appears to be targeting your brand.`,
            threat.brand_mentioned ? 'Your brand name was found on the page.' : null,
            threat.signals.length > 0 ? `Phishing signals: ${threat.signals.join(', ')}.` : null,
            'Consider filing an abuse report with the domain registrar.',
          ].filter(Boolean).join(' '),
          data: { threat_domain: threat.domain, signals: threat.signals, brand_mentioned: threat.brand_mentioned },
          is_read: false,
          created_at: new Date().toISOString(),
        }));

        const { error: alertErr } = await supabase.from('brand_guard_alerts').insert(alertRows);
        if (alertErr) {
          console.error(`[Domain Worker] Failed to insert alerts for ${domain}:`, alertErr.message);
        }
      }

      // ── Update monitor's last_scan_at ────────────────────────────────────
      await supabase
        .from('domain_monitors')
        .update({ last_scan_at: new Date().toISOString() })
        .eq('id', id);

      results.push({ domain, new_threats: newThreats.length, checked_variants: toCheck.length });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Domain Worker] Error processing ${domain}:`, msg);
      results.push({ domain, new_threats: 0, checked_variants: 0, error: msg });
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(`[Domain Worker] Done in ${durationMs}ms — processed ${results.length} monitors`);

  res.status(200).json({
    success: true,
    monitors_processed: results.length,
    monitors_due: dueMonitors.length,
    duration_ms: durationMs,
    results,
  });
}

export const config = {
  maxDuration: 60,
};
