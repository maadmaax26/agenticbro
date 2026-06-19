/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/alert-delivery.ts — Alert Delivery Pipeline
 * ========================================================================
 * Reads unread alerts from brand_guard_alerts and delivers them via:
 *   1. Email notification (Resend)
 *   2. In-app notification (Supabase realtime push via alerts channel)
 *
 * Called by cron after monitor-worker completes, or on-demand.
 *
 * POST /api/brand-guard/alert-delivery
 *   Body: { alert_id?: string, brand_monitor_id?: string, dry_run?: boolean }
 *   Returns: { delivered: number, errors: number, details: [...] }
 *
 * Email templates are built inline — no external template engine needed.
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

// ── Resend Configuration ─────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Brand Guard <alerts@agenticbro.app>';
const RESEND_FROM_NAME = 'Agentic Bro Brand Guard';

// ── Types ────────────────────────────────────────────────────────────────────
interface Alert {
  id: string;
  brand_monitor_id: string;
  alert_type: 'new_threat' | 'escalation' | 'resolved' | 'scan_complete';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  threat_id: string | null;
  target: string | null;
  platform: string | null;
  risk_score: number;
  risk_level: string | null;
  evidence: string[];
  read: boolean;
  created_at: string;
}

interface BrandMonitor {
  id: string;
  owner_id: string;
  brand_name: string;
  brand_handle: string;
  brand_domain: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

// ── Severity styling ─────────────────────────────────────────────────────────
const SEVERITY_STYLES: Record<string, { emoji: string; color: string; label: string }> = {
  critical: { emoji: '🔴', color: '#dc2626', label: 'CRITICAL' },
  high:     { emoji: '🟠', color: '#ea580c', label: 'HIGH' },
  medium:   { emoji: '🟡', color: '#ca8a04', label: 'MEDIUM' },
  low:      { emoji: '🟢', color: '#16a34a', label: 'LOW' },
  info:     { emoji: '🔵', color: '#2563eb', label: 'INFO' },
};

// ── Build Email HTML ──────────────────────────────────────────────────────────
function buildEmailHTML(alert: Alert, monitor: BrandMonitor, user: UserProfile): string {
  const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
  const dashboardUrl = `https://agenticbro.app/brand-guard?tab=alerts&monitor=${monitor.id}`;
  const scanDate = new Date(alert.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brand Guard Alert: ${alert.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color: #141414; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${style.color}22, #141414); padding: 32px 40px; border-bottom: 1px solid #262626;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 14px; color: ${style.color}; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                      ${style.emoji} ${style.label} ALERT
                    </h1>
                    <h2 style="margin: 8px 0 0 0; font-size: 20px; color: #fafafa; font-weight: 600;">
                      ${alert.title}
                    </h2>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alert Details -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #d4d4d4; line-height: 1.6;">
                ${alert.message}
              </p>

              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden; border: 1px solid #262626;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #737373; width: 120px;">Brand</td>
                        <td style="padding: 8px 0; font-size: 14px; color: #fafafa; font-weight: 500;">${monitor.brand_name}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #737373;">Platform</td>
                        <td style="padding: 8px 0; font-size: 14px; color: #fafafa; text-transform: capitalize;">${(alert.platform || 'unknown').replace('_', ' ')}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #737373;">Risk Level</td>
                        <td style="padding: 8px 0; font-size: 14px; color: ${style.color}; font-weight: 600;">${style.label}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #737373;">Risk Score</td>
                        <td style="padding: 8px 0; font-size: 14px; color: #fafafa;">${alert.risk_score}/100</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #737373;">Detected</td>
                        <td style="padding: 8px 0; font-size: 14px; color: #fafafa;">${scanDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${alert.evidence && alert.evidence.length > 0 ? `
              <!-- Evidence -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #1a1a1a; border-radius: 8px; border: 1px solid #262626;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #737373; text-transform: uppercase; letter-spacing: 1px;">Evidence</p>
                    <ul style="margin: 0; padding-left: 16px;">
                      ${alert.evidence.map(e => `<li style="font-size: 13px; color: #a3a3a3; line-height: 1.6; margin-bottom: 4px;">${e}</li>`).join('')}
                    </ul>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, ${style.color}, ${style.color}cc); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.5px;">
                      View Full Report →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f0f0f; border-top: 1px solid #262626;">
              <p style="margin: 0; font-size: 12px; color: #525252; text-align: center;">
                Agentic Bro Brand Guard — Monitoring ${monitor.brand_name}<br>
                You're receiving this because you have active monitoring for this brand.<br>
                <a href="https://agenticbro.app/brand-guard/settings" style="color: #737373; text-decoration: underline;">Notification settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Build plain text email ────────────────────────────────────────────────────
function buildEmailText(alert: Alert, monitor: BrandMonitor, user: UserProfile): string {
  const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
  const dashboardUrl = `https://agenticbro.app/brand-guard?tab=alerts&monitor=${monitor.id}`;
  const scanDate = new Date(alert.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  let text = `${style.emoji} ${style.label} ALERT\n`;
  text += `${'='.repeat(50)}\n\n`;
  text += `${alert.title}\n\n`;
  text += `${alert.message}\n\n`;
  text += `Brand: ${monitor.brand_name}\n`;
  text += `Platform: ${(alert.platform || 'unknown').replace('_', ' ')}\n`;
  text += `Risk Level: ${style.label}\n`;
  text += `Risk Score: ${alert.risk_score}/100\n`;
  text += `Detected: ${scanDate}\n\n`;

  if (alert.evidence && alert.evidence.length > 0) {
    text += `Evidence:\n`;
    for (const e of alert.evidence) {
      text += `  • ${e}\n`;
    }
    text += '\n';
  }

  text += `View full report: ${dashboardUrl}\n\n`;
  text += `—\nAgentic Bro Brand Guard\n`;
  text += `Notification settings: https://agenticbro.app/brand-guard/settings`;

  return text;
}

// ── Send Email via Resend ─────────────────────────────────────────────────────
async function sendAlertEmail(
  alert: Alert,
  monitor: BrandMonitor,
  user: UserProfile
): Promise<{ sent: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn('[Alert Delivery] RESEND_API_KEY not configured — skipping email delivery');
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: user.email,
        subject: `${SEVERITY_STYLES[alert.severity]?.emoji || '🔔'} Brand Guard: ${alert.title}`,
        html: buildEmailHTML(alert, monitor, user),
        text: buildEmailText(alert, monitor, user),
        tags: [
          { name: 'category', value: 'brand_guard_alert' },
          { name: 'severity', value: alert.severity },
          { name: 'brand_monitor_id', value: monitor.id },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Alert Delivery] Resend API error:', err);
      return { sent: false, error: err };
    }

    const data = await res.json();
    console.log(`[Alert Delivery] ✅ Email sent to ${user.email}: ${data.id}`);
    return { sent: true };
  } catch (err: any) {
    console.error('[Alert Delivery] Email send error:', err);
    return { sent: false, error: err.message };
  }
}

// ── Push In-App Notification via Supabase Realtime ────────────────────────────
async function pushInAppNotification(alert: Alert, monitor: BrandMonitor): Promise<void> {
  try {
    // The alert is already in brand_guard_alerts table (inserted by monitor-worker).
    // Supabase realtime will automatically push INSERT events to subscribed clients.
    // We just need to ensure the frontend subscribes to the brand_guard_alerts channel.
    // 
    // For extra reliability, we also publish to a named channel for immediate push:
    const channel = supabase.channel(`brand-alerts:${monitor.owner_id}`, {
      config: { broadcast: { self: true } },
    });

    await channel.send({
      type: 'broadcast',
      event: 'alert',
      payload: {
        id: alert.id,
        brand_monitor_id: alert.brand_monitor_id,
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        platform: alert.platform,
        risk_score: alert.risk_score,
        risk_level: alert.risk_level,
        brand_name: monitor.brand_name,
        created_at: alert.created_at,
      },
    });

    supabase.removeChannel(channel);
    console.log(`[Alert Delivery] 📢 In-app notification pushed for ${monitor.brand_name}`);
  } catch (err) {
    console.error('[Alert Delivery] In-app push error:', err);
  }
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

  const body = req.body || {};
  const alertId = body.alert_id || null;
  const brandMonitorId = body.brand_monitor_id || null;
  const dryRun = body.dry_run === true;

  // ── 1. Fetch unread alerts ──────────────────────────────────────────────
  let alertQuery = supabase
    .from('brand_guard_alerts')
    .select('*')
    .eq('read', false);

  if (alertId) {
    alertQuery = alertQuery.eq('id', alertId);
  }
  if (brandMonitorId) {
    alertQuery = alertQuery.eq('brand_monitor_id', brandMonitorId);
  }

  // Only process alerts from the last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  alertQuery = alertQuery.gte('created_at', yesterday);

  const { data: alerts, error: alertError } = await alertQuery.order('created_at', { ascending: true });

  if (alertError) {
    console.error('[Alert Delivery] Failed to fetch alerts:', alertError);
    res.status(500).json({ error: 'Failed to fetch alerts', details: alertError.message });
    return;
  }

  if (!alerts || alerts.length === 0) {
    res.status(200).json({ delivered: 0, errors: 0, details: [], message: 'No unread alerts to deliver' });
    return;
  }

  console.log(`[Alert Delivery] Processing ${alerts.length} unread alerts`);

  // ── 2. Get unique brand_monitor_ids to fetch monitor details ────────────
  const monitorIds = [...new Set(alerts.map((a: Alert) => a.brand_monitor_id).filter(Boolean))];

  const { data: monitors } = await supabase
    .from('brand_monitors')
    .select('*')
    .in('id', monitorIds);

  const monitorMap = new Map<string, BrandMonitor>();
  if (monitors) {
    for (const m of monitors) {
      monitorMap.set(m.id, m);
    }
  }

  // ── 3. Get unique owner_ids to fetch user emails ───────────────────────
  const ownerIds = [...new Set(monitors?.map((m: BrandMonitor) => m.owner_id).filter(Boolean) || [])];

  // Fetch user emails from auth.users via admin API (service role key has access).
  // perPage: 1000 avoids silently truncating at the default 50-user page limit.
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  const userMap = new Map<string, UserProfile>();
  if (users?.users) {
    for (const u of users.users) {
      if (ownerIds.includes(u.id)) {
        userMap.set(u.id, {
          id: u.id,
          email: u.email || '',
          full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
        });
      }
    }
  }

  // ── 4. Process each alert ───────────────────────────────────────────────
  const results: Array<{
    alert_id: string;
    title: string;
    email_sent: boolean;
    email_error?: string;
    push_sent: boolean;
  }> = [];

  let delivered = 0;
  let errors = 0;

  for (const alert of alerts as Alert[]) {
    const monitor = monitorMap.get(alert.brand_monitor_id);
    const owner = monitor ? userMap.get(monitor.owner_id) : null;

    const result = {
      alert_id: alert.id,
      title: alert.title,
      email_sent: false,
      email_error: undefined as string | undefined,
      push_sent: false,
    };

    if (!monitor) {
      result.email_error = 'Monitor not found';
      errors++;
      results.push(result);
      continue;
    }

    // Push in-app notification (always attempt, even without email)
    if (!dryRun) {
      await pushInAppNotification(alert, monitor);
      result.push_sent = true;
    }

    // Send email if user has email on file
    if (owner?.email && !dryRun) {
      const emailResult = await sendAlertEmail(alert, monitor, owner);
      result.email_sent = emailResult.sent;
      result.email_error = emailResult.error;

      if (emailResult.sent) {
        delivered++;
      } else {
        errors++;
      }
    } else if (!owner?.email) {
      result.email_error = 'No email on file for owner';
    }

    // Mark alert as read only after at least one delivery channel succeeded.
    // If email was attempted and failed, leave the alert unread so it retries.
    const deliverySucceeded = result.email_sent || (!owner?.email && result.push_sent);
    if (!dryRun && deliverySucceeded) {
      await supabase
        .from('brand_guard_alerts')
        .update({ read: true })
        .eq('id', alert.id);
    }

    results.push(result);
  }

  const response = {
    delivered,
    errors,
    details: results,
    dry_run: dryRun,
    timestamp: new Date().toISOString(),
  };

  console.log(`[Alert Delivery] Complete: ${delivered} delivered, ${errors} errors`);

  res.status(200).json(response);
}

export const config = {
  maxDuration: 60,
};