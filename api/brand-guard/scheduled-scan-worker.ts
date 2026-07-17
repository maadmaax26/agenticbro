/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restricted — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/scheduled-scan-worker.ts — Scheduled Scan Worker
 * ========================================================================
 * Polls brand_monitors where is_active = true and last_scan_at is stale,
 * runs the appropriate scan type (email_spoof, marketplace, domain_lookalike)
 * via internal HTTP calls to the existing scan endpoints, and writes alerts
 * to brand_guard_alerts.
 *
 * This is a background worker intended to be called by a cron job.
 *
 * GET /api/brand-guard/scheduled-scan-worker
 *   Returns: Processing report with counts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_BASE_URL || 'https://agenticbro.app';

// ── Types ────────────────────────────────────────────────────────────────────
interface ScanReport {
  total_processed: number;
  successful: number;
  failed: number;
  alerts_created: number;
  errors: string[];
}

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Check if a brand's last_scan_at is stale based on its scan_frequency
 */
function isScanStale(last_scan_at: string | null, scan_frequency: string, now: Date): boolean {
  if (!last_scan_at) return true;

  const lastScan = new Date(last_scan_at);
  const diffMs = now.getTime() - lastScan.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  switch (scan_frequency) {
    case 'daily':
      return diffHours >= 24;
    case 'weekly':
      return diffHours >= 168;
    case 'monthly':
      return diffHours >= 720;
    case 'once':
      return false;
    default:
      return true;
  }
}

/**
 * Create an alert for a new threat or scan result
 */
async function createAlert(
  supabase: SupabaseClient,
  brand_monitor_id: string,
  alert_type: string,
  severity: string,
  title: string,
  message?: string,
  threat_id?: string,
  target?: string,
  platform?: string,
  risk_score?: number,
  risk_level?: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('brand_guard_alerts')
    .insert({
      brand_monitor_id,
      alert_type,
      severity,
      title,
      message,
      threat_id,
      target,
      platform,
      risk_score,
      risk_level,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[scan-worker] Alert creation error:', error);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Internal HTTP call to the email-spoof endpoint
 */
async function runEmailSpoofScan(domain: string, brandMonitorId: string): Promise<any> {
  try {
    const url = `${baseUrl}/api/brand-guard/email-spoof?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      console.error(`[scan-worker] Email spoof scan failed: ${res.status}`);
      return null;
    }
    const result = await res.json();
    return result;
  } catch (err) {
    console.error('[scan-worker] Email spoof scan error:', err);
    return null;
  }
}

/**
 * Internal HTTP call to the impersonator-scan endpoint
 */
async function runImpersonatorScan(brandHandle: string, platform: string): Promise<any> {
  try {
    const url = `${baseUrl}/api/brand-guard/impersonator-scan?handle=${encodeURIComponent(brandHandle)}&platform=${encodeURIComponent(platform)}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      console.error(`[scan-worker] Impersonator scan failed: ${res.status}`);
      return null;
    }
    const result = await res.json();
    return result;
  } catch (err) {
    console.error('[scan-worker] Impersonator scan error:', err);
    return null;
  }
}

/**
 * Internal HTTP call to the domain-monitor endpoint
 */
async function runDomainMonitorScan(domain: string): Promise<any> {
  try {
    const url = `${baseUrl}/api/brand-guard/domain-monitor?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      console.error(`[scan-worker] Domain monitor scan failed: ${res.status}`);
      return null;
    }
    const result = await res.json();
    return result;
  } catch (err) {
    console.error('[scan-worker] Domain monitor scan error:', err);
    return null;
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Allow cron secret for auth
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const report: ScanReport = {
    total_processed: 0,
    successful: 0,
    failed: 0,
    alerts_created: 0,
    errors: [],
  };

  try {
    const now = new Date();
    const { data: brands, error: brandsError } = await supabase
      .from('brand_monitors')
      .select('id, brand_handle, brand_domain, platforms, scan_frequency, last_scan_at')
      .eq('is_active', true);

    if (brandsError) {
      throw new Error(`Failed to fetch brands: ${brandsError.message}`);
    }

    if (!brands || brands.length === 0) {
      res.status(200).json({ ...report, message: 'No active brands found' });
      return;
    }

    for (const brand of brands) {
      if (!isScanStale(brand.last_scan_at, brand.scan_frequency, now)) {
        continue;
      }

      report.total_processed++;
      let brandSuccess = true;

      // 1) Email spoof scan (if domain available)
      if (brand.brand_domain) {
        const emailResult = await runEmailSpoofScan(brand.brand_domain, brand.id);
        if (emailResult?.email_security) {
          const vuln = emailResult.email_security.vulnerability_level;
          if (vuln === 'CRITICAL' || vuln === 'HIGH') {
            const alertId = await createAlert(
              supabase, brand.id, 'new_threat',
              vuln === 'CRITICAL' ? 'critical' : 'high',
              'Email Spoofing Vulnerability Detected',
              `Domain ${brand.brand_domain} has ${vuln} spoofing vulnerability`,
              `email_${brand.id}`, brand.brand_domain, undefined,
              emailResult.email_security.overall_score, vuln
            );
            if (alertId) report.alerts_created++;
          }
        }
      }

      // 2) Impersonator scan for each platform
      const platforms: string[] = brand.platforms || ['x', 'instagram', 'tiktok', 'facebook', 'telegram'];
      for (const platform of platforms) {
        if (brand.brand_handle) {
          const impResult = await runImpersonatorScan(brand.brand_handle, platform);
          if (impResult?.impersonators_found && impResult.impersonators_found > 0) {
            const alertId = await createAlert(
              supabase, brand.id, 'new_threat', 'high',
              `${impResult.impersonators_found} Impersonator${impResult.impersonators_found > 1 ? 's' : ''} on ${platform.toUpperCase()}`,
              `Detected ${impResult.impersonators_found} impersonator(s) of ${brand.brand_handle} on ${platform}`,
              `imp_${brand.id}_${platform}`, brand.brand_handle, platform,
              85, 'HIGH'
            );
            if (alertId) report.alerts_created++;
          }
        }
      }

      // 3) Domain monitor scan (if domain available)
      if (brand.brand_domain) {
        const domResult = await runDomainMonitorScan(brand.brand_domain);
        if (domResult?.variants && Array.isArray(domResult.variants)) {
          const dangerous = domResult.variants.filter(
            (v: any) => v.riskLevel === 'CRITICAL' || v.riskLevel === 'HIGH'
          );
          if (dangerous.length > 0) {
            const alertId = await createAlert(
              supabase, brand.id, 'new_threat',
              dangerous.length >= 3 ? 'critical' : 'high',
              'Dangerous Lookalike Domains Detected',
              `${dangerous.length} potentially malicious domain(s): ${dangerous.map((v: any) => v.domain).join(', ')}`,
              `domain_${Date.now()}`, brand.brand_domain, undefined,
              90, dangerous.length >= 3 ? 'CRITICAL' : 'HIGH'
            );
            if (alertId) report.alerts_created++;
          }
        }
      }

      // Update last_scan_at
      const { error: updateErr } = await supabase
        .from('brand_monitors')
        .update({ last_scan_at: now.toISOString() })
        .eq('id', brand.id);
      if (updateErr) {
        console.error(`[scan-worker] Failed to update last_scan_at for ${brand.brand_handle}:`, updateErr);
        brandSuccess = false;
        report.errors.push(`Update failed for ${brand.brand_handle}: ${updateErr.message}`);
      }

      // Create scan-complete info alert
      await createAlert(
        supabase, brand.id, 'scan_complete', 'info',
        'Brand Guard Scan Complete',
        `Automated scan completed for ${brand.brand_handle}`,
        undefined, brand.brand_handle
      );

      if (brandSuccess) {
        report.successful++;
      } else {
        report.failed++;
      }
    }

    // Trigger alert delivery for any new alerts
    try {
      await fetch(`${baseUrl}/api/brand-guard/alerts/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET || ''}` },
        body: JSON.stringify({ all_unread: true, max_count: 50 }),
      });
    } catch (e) {
      console.error('[scan-worker] Alert delivery trigger failed:', e);
    }

    res.status(200).json({
      ...report,
      message: `Processed ${report.total_processed} brands, ${report.alerts_created} alerts created`,
    });
  } catch (error) {
    console.error('[scan-worker] Fatal error:', error);
    res.status(500).json({ error: String(error) });
  }
}
