/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/monitor-worker.ts — Scheduled Brand Monitor Worker
 * ========================================================================
 * Processes brand_monitors where last_scan_at is due for a re-scan.
 * Called by cron (pg_cron, Vercel cron, or OpenClaw cron) on a schedule.
 *
 * POST /api/brand-guard/monitor-worker
 *   Optional body: { dry_run?: boolean, brand_id?: string, force?: boolean }
 *   Returns: { processed: number, alerts_created: number, errors: number, details: [...] }
 *
 * Flow:
 *   1. Fetch active brand_monitors where is_active=true and scan is due
 *   2. For each monitor, run email-spoof + domain-monitor + impersonator-scan
 *   3. Compare results against previous scan (delta detection)
 *   4. Insert alerts for new threats, score changes, and status changes
 *   5. Update brand_monitors.last_scan_at and scan_count
 *   6. Trigger alert delivery pipeline for each new alert
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ── Vercel type shim ─────────────────────────────────────────────────────────
type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Types ────────────────────────────────────────────────────────────────────
interface BrandMonitor {
  id: string;
  owner_id: string;
  brand_name: string;
  brand_handle: string;
  brand_domain: string | null;
  platforms: string[];
  scan_frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  last_scan_at: string | null;
  scan_count: number;
  is_active: boolean;
}

interface ProcessResult {
  brand_id: string;
  brand_name: string;
  status: 'success' | 'error' | 'skipped';
  alerts_created: number;
  scans_run: string[];
  error?: string;
}

// ── Scan Frequency to Interval ───────────────────────────────────────────────
function getScanInterval(frequency: string): string {
  switch (frequency) {
    case 'daily': return '1 day';
    case 'weekly': return '7 days';
    case 'monthly': return '30 days';
    default: return '7 days';
  }
}

// ── Run Email Spoof Scan ─────────────────────────────────────────────────────
async function runEmailSpoofScan(domain: string, brandMonitorId: string, brandName: string): Promise<{
  score: number;
  level: string;
  spoofable: boolean;
  threats: number;
  result: Record<string, any>;
}> {
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.API_BASE_URL || 'http://localhost:3002';

  try {
    const res = await fetch(`${baseUrl}/api/brand-guard/email-spoof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        brand_name: brandName,
        brand_monitor_id: brandMonitorId,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Monitor Worker] Email spoof scan failed for ${domain}: ${err}`);
      return { score: 0, level: 'UNKNOWN', spoofable: false, threats: 0, result: {} };
    }

    const data = await res.json();
    const result = data.result || data;
    return {
      score: result.email_security?.overall_score ?? 0,
      level: result.email_security?.vulnerability_level ?? 'UNKNOWN',
      spoofable: result.email_security?.spoofable ?? false,
      threats: (result.new_domain_threats || []).length,
      result,
    };
  } catch (err) {
    console.error(`[Monitor Worker] Email spoof scan error for ${domain}:`, err);
    return { score: 0, level: 'UNKNOWN', spoofable: false, threats: 0, result: {} };
  }
}

// ── Run Impersonator Scan ─────────────────────────────────────────────────────
async function runImpersonatorScan(brandName: string, brandHandle: string, brandDomain: string | null, platforms: string[]): Promise<{
  impersonators: number;
  highRisk: number;
  result: Record<string, any>;
}> {
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.API_BASE_URL || 'http://localhost:3002';

  try {
    const res = await fetch(`${baseUrl}/api/brand-guard/impersonator-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_name: brandName,
        brand_handle: brandHandle,
        brand_domain: brandDomain,
        platforms,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Monitor Worker] Impersonator scan failed for ${brandHandle}: ${err}`);
      return { impersonators: 0, highRisk: 0, result: {} };
    }

    const data = await res.json();
    const results = data.results || data.impersonators || [];
    const highRisk = Array.isArray(results)
      ? results.filter((r: any) => r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL').length
      : 0;

    return {
      impersonators: Array.isArray(results) ? results.length : 0,
      highRisk,
      result: data,
    };
  } catch (err) {
    console.error(`[Monitor Worker] Impersonator scan error for ${brandHandle}:`, err);
    return { impersonators: 0, highRisk: 0, result: {} };
  }
}

// ── Run Domain Monitor Scan ───────────────────────────────────────────────────
async function runDomainMonitorScan(domain: string, brandMonitorId: string, brandName: string): Promise<{
  threats: number;
  result: Record<string, any>;
}> {
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.API_BASE_URL || 'http://localhost:3002';

  try {
    const res = await fetch(`${baseUrl}/api/brand-guard/domain-monitor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        brand_name: brandName,
        brand_monitor_id: brandMonitorId,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Monitor Worker] Domain monitor scan failed for ${domain}: ${err}`);
      return { threats: 0, result: {} };
    }

    const data = await res.json();
    const threats = data.threats_found || data.threats?.length || 0;
    return { threats, result: data };
  } catch (err) {
    console.error(`[Monitor Worker] Domain monitor error for ${domain}:`, err);
    return { threats: 0, result: {} };
  }
}

// ── Create Alerts ────────────────────────────────────────────────────────────
async function createAlerts(
  db: SupabaseClient,
  monitor: BrandMonitor,
  emailSpoofResult: { score: number; level: string; spoofable: boolean; threats: number },
  impersonatorResult: { impersonators: number; highRisk: number },
  domainMonitorResult: { threats: number },
  previousScan: Record<string, any> | null
): Promise<number> {
  let alertCount = 0;

  // ── Email security alerts ──────────────────────────────────────────────
  if (emailSpoofResult.spoofable) {
    const { error } = await db.from('brand_guard_alerts').insert({
      brand_monitor_id: monitor.id,
      alert_type: 'new_threat',
      severity: emailSpoofResult.level === 'CRITICAL' ? 'critical'
        : emailSpoofResult.level === 'HIGH' ? 'high'
        : emailSpoofResult.level === 'MEDIUM' ? 'medium' : 'low',
      title: `Email spoofing vulnerability detected on ${monitor.brand_domain || monitor.brand_name}`,
      message: `${monitor.brand_name}'s domain scored ${emailSpoofResult.score}/100 (${emailSpoofResult.level}). The domain is spoofable — attackers can send phishing emails appearing to come from this domain.`,
      target: monitor.brand_domain || monitor.brand_name,
      platform: 'email',
      risk_score: 100 - emailSpoofResult.score,
      risk_level: emailSpoofResult.level,
      evidence: [`Score: ${emailSpoofResult.score}/100`, `Level: ${emailSpoofResult.level}`, `Spoofable: ${emailSpoofResult.spoofable}`],
    });
    if (!error) alertCount++;
    else console.error('[Monitor Worker] Alert insert error:', error);
  }

  // ── Email score degradation alert ──────────────────────────────────────
  if (previousScan?.email_security?.overall_score) {
    const prevScore = previousScan.email_security.overall_score;
    const scoreDrop = prevScore - emailSpoofResult.score;
    if (scoreDrop >= 15) {
      const { error } = await db.from('brand_guard_alerts').insert({
        brand_monitor_id: monitor.id,
        alert_type: 'escalation',
        severity: 'high',
        title: `Email security score dropped by ${scoreDrop} points for ${monitor.brand_name}`,
        message: `${monitor.brand_name}'s email security score dropped from ${prevScore} to ${emailSpoofResult.score}. This may indicate a DNS misconfiguration or policy change.`,
        target: monitor.brand_domain || monitor.brand_name,
        platform: 'email',
        risk_score: scoreDrop,
        risk_level: 'HIGH',
        evidence: [`Previous score: ${prevScore}`, `Current score: ${emailSpoofResult.score}`, `Change: -${scoreDrop}`],
      });
      if (!error) alertCount++;
    }
  }

  // ── New lookalike domain threats ────────────────────────────────────────
  if (emailSpoofResult.threats > 0 || domainMonitorResult.threats > 0) {
    const totalThreats = emailSpoofResult.threats + domainMonitorResult.threats;
    const { error } = await db.from('brand_guard_alerts').insert({
      brand_monitor_id: monitor.id,
      alert_type: 'new_threat',
      severity: totalThreats > 3 ? 'high' : 'medium',
      title: `${totalThreats} lookalike domain${totalThreats > 1 ? 's' : ''} detected for ${monitor.brand_name}`,
      message: `Found ${totalThreats} domain${totalThreats > 1 ? 's' : ''} with active certificates that look similar to ${monitor.brand_domain || monitor.brand_name}. These could be used for phishing campaigns.`,
      target: monitor.brand_domain || monitor.brand_name,
      platform: 'domain',
      risk_score: totalThreats * 15,
      risk_level: totalThreats > 3 ? 'HIGH' : 'MEDIUM',
      evidence: [`Email spoof threats: ${emailSpoofResult.threats}`, `Domain monitor threats: ${domainMonitorResult.threats}`],
    });
    if (!error) alertCount++;
  }

  // ── Impersonator alerts ─────────────────────────────────────────────────
  if (impersonatorResult.impersonators > 0) {
    const { error } = await db.from('brand_guard_alerts').insert({
      brand_monitor_id: monitor.id,
      alert_type: 'new_threat',
      severity: impersonatorResult.highRisk > 0 ? 'high' : 'medium',
      title: `${impersonatorResult.impersonators} impersonator account${impersonatorResult.impersonators > 1 ? 's' : ''} found for ${monitor.brand_name}`,
      message: `Detected ${impersonatorResult.impersonators} potential impersonator accounts (${impersonatorResult.highRisk} high risk) across monitored platforms for ${monitor.brand_name}.`,
      target: monitor.brand_handle,
      platform: 'social',
      risk_score: impersonatorResult.highRisk * 30 + (impersonatorResult.impersonators - impersonatorResult.highRisk) * 10,
      risk_level: impersonatorResult.highRisk > 0 ? 'HIGH' : 'MEDIUM',
      evidence: [`Total impersonators: ${impersonatorResult.impersonators}`, `High risk: ${impersonatorResult.highRisk}`],
    });
    if (!error) alertCount++;
  }

  return alertCount;
}

// ── Main Handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // ── Auth: require CRON_SECRET Bearer token ───────────────────────────────
  // Vercel cron sends Authorization: Bearer <CRON_SECRET> automatically.
  // External callers without the token must be rejected to prevent abuse.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body || {};
  const dryRun = body.dry_run === true;
  const specificBrandId = body.brand_id || null;
  const force = body.force === true;

  console.log(`[Monitor Worker] Starting ${dryRun ? 'DRY RUN ' : ''}scan${specificBrandId ? ` for brand ${specificBrandId}` : ''}`);

  // ── 1. Fetch monitors due for scanning ──────────────────────────────────
  let query = supabase
    .from('brand_monitors')
    .select('*')
    .eq('is_active', true);

  if (specificBrandId) {
    query = query.eq('id', specificBrandId);
  }

  // Only scan monitors where scan_frequency is not 'once' (those are one-off scans)
  if (!force) {
    query = query.neq('scan_frequency', 'once');
  }

  const { data: monitors, error: fetchError } = await query;

  if (fetchError) {
    console.error('[Monitor Worker] Failed to fetch monitors:', fetchError);
    res.status(500).json({ error: 'Failed to fetch monitors', details: fetchError.message });
    return;
  }

  if (!monitors || monitors.length === 0) {
    res.status(200).json({ processed: 0, alerts_created: 0, errors: 0, details: [], message: 'No monitors due for scanning' });
    return;
  }

  // ── 2. Filter by scan_frequency timing ──────────────────────────────────
  const dueMonitors: BrandMonitor[] = [];
  const now = new Date();

  for (const monitor of monitors) {
    if (force || !monitor.last_scan_at) {
      dueMonitors.push(monitor);
      continue;
    }

    const lastScan = new Date(monitor.last_scan_at);
    const intervalMs = ({
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000,
    } as Record<string, number>)[String(monitor.scan_frequency)] || 7 * 24 * 60 * 60 * 1000;

    if (now.getTime() - lastScan.getTime() >= intervalMs) {
      dueMonitors.push(monitor);
    }
  }

  if (dueMonitors.length === 0) {
    res.status(200).json({ processed: 0, alerts_created: 0, errors: 0, details: [], message: 'No monitors due for scanning at this time' });
    return;
  }

  console.log(`[Monitor Worker] Processing ${dueMonitors.length} monitors (${dryRun ? 'DRY RUN' : 'LIVE'})`);

  // ── 3. Process each monitor ──────────────────────────────────────────────
  const results: ProcessResult[] = [];
  let totalAlerts = 0;
  let totalErrors = 0;

  for (const monitor of dueMonitors) {
    if (dryRun) {
      results.push({
        brand_id: monitor.id,
        brand_name: monitor.brand_name,
        status: 'skipped',
        alerts_created: 0,
        scans_run: [],
      });
      continue;
    }

    try {
      const scansRun: string[] = [];
      let emailSpoofResult = { score: 0, level: 'UNKNOWN', spoofable: false, threats: 0 };
      let impersonatorResult = { impersonators: 0, highRisk: 0 };
      let domainMonitorResult = { threats: 0 };

      // Run email spoof scan if domain is set
      if (monitor.brand_domain) {
        emailSpoofResult = await runEmailSpoofScan(monitor.brand_domain, monitor.id, monitor.brand_name);
        scansRun.push('email_spoof');
      }

      // Run impersonator scan across configured platforms
      if (monitor.platforms && monitor.platforms.length > 0) {
        impersonatorResult = await runImpersonatorScan(
          monitor.brand_name,
          monitor.brand_handle,
          monitor.brand_domain,
          monitor.platforms
        );
        scansRun.push('impersonator_scan');
      }

      // Run domain monitor if domain is set
      if (monitor.brand_domain) {
        domainMonitorResult = await runDomainMonitorScan(monitor.brand_domain, monitor.id, monitor.brand_name);
        scansRun.push('domain_monitor');
      }

      // ── Fetch previous scan for delta detection ────────────────────────
      let previousScan: Record<string, any> | null = null;
      if (monitor.brand_domain) {
        // .range(1, 1) = OFFSET 1 LIMIT 1 → second most recent scan (before current)
        // Note: do NOT add .limit() here — range() handles both offset and limit
        const { data: prevScan } = await supabase
          .from('email_spoof_checks')
          .select('result')
          .eq('brand_monitor_id', monitor.id)
          .order('created_at', { ascending: false })
          .range(1, 1);

        if (prevScan && prevScan.length > 0) {
          previousScan = prevScan[0].result;
        }
      }

      // ── Create alerts for new findings ───────────────────────────────────
      const alertCount = await createAlerts(
        supabase,
        monitor,
        emailSpoofResult,
        impersonatorResult,
        domainMonitorResult,
        previousScan
      );
      totalAlerts += alertCount;

      // ── Trigger alert delivery for new alerts (fire-and-forget) ──────────
      if (alertCount > 0) {
        const alertBaseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : process.env.API_BASE_URL || 'http://localhost:3002';
        fetch(`${alertBaseUrl}/api/brand-guard/alert-delivery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET || ''}` },
          body: JSON.stringify({ brand_monitor_id: monitor.id }),
        }).catch(err => console.error('[Monitor Worker] Alert delivery trigger failed:', err));
      }

      // ── Update monitor's last_scan_at ───────────────────────────────────
      await supabase
        .from('brand_monitors')
        .update({
          last_scan_at: new Date().toISOString(),
          scan_count: monitor.scan_count + 1,
        })
        .eq('id', monitor.id);

      results.push({
        brand_id: monitor.id,
        brand_name: monitor.brand_name,
        status: 'success',
        alerts_created: alertCount,
        scans_run: scansRun,
      });

      console.log(`[Monitor Worker] ✅ ${monitor.brand_name}: ${scansRun.join(', ')} | ${alertCount} alerts`);

    } catch (err: any) {
      totalErrors++;
      console.error(`[Monitor Worker] ❌ ${monitor.brand_name}:`, err);
      results.push({
        brand_id: monitor.id,
        brand_name: monitor.brand_name,
        status: 'error',
        alerts_created: 0,
        scans_run: [],
        error: err.message,
      });
    }

    // Rate limit: wait 2s between monitors to avoid API rate limits
    if (dueMonitors.indexOf(monitor) < dueMonitors.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // ── 4. Return summary ──────────────────────────────────────────────────
  const response = {
    processed: dueMonitors.length,
    alerts_created: totalAlerts,
    errors: totalErrors,
    details: results,
    timestamp: new Date().toISOString(),
  };

  console.log(`[Monitor Worker] Complete: ${dueMonitors.length} processed, ${totalAlerts} alerts, ${totalErrors} errors`);

  res.status(200).json(response);
}

export const config = {
  maxDuration: 300, // 5 minutes for batch processing
};
