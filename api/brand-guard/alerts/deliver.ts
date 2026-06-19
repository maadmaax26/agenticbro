/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/alerts/deliver.ts — Alert Delivery Pipeline
 * ========================================================================
 * Delivers Brand Guard alert notifications via email (Resend) and in-app.
 *
 * POST /api/brand-guard/alerts/deliver
 *   Body: { alert_id: string } OR { all_unread: true, max_count?: number }
 *   Returns: { delivered: number, errors: string[] }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const resendApiKey = process.env.RESEND_API_KEY || '';

// ── Supabase Client ────────────────────────────────────────────────────────────
const getSupabase = () => createClient(supabaseUrl, supabaseServiceKey);

// ── Types ────────────────────────────────────────────────────────────────────
interface Alert {
  id: string;
  brand_monitor_id: string;
  alert_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message?: string;
  threat_id?: string;
  target?: string;
  platform?: string;
  risk_score?: number;
  risk_level?: string;
  created_at: string;
  brand_handle?: string;
  brand_name?: string;
}

// ── Email Delivery (Resend) ───────────────────────────────────────────────────

interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendEmailAlert(emailAddress: string, alert: Alert): Promise<{ success: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured, skipping email delivery');
    return { success: false, error: 'Email service not configured' };
  }

  const alertIcons: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
    info: '🔵'
  };

  const icon = alert.severity in alertIcons ? alertIcons[alert.severity] : '🟡';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Agentic Bro Brand Guard Alert</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 8px; padding: 30px;">
        <h1 style="margin: 0 0 20px 0; color: #333;">
          ${icon} ${alert.severity.toUpperCase()} Alert
        </h1>
        
        <h2 style="margin: 0 0 20px 0; color: #333;">${alert.title}</h2>
        
        ${alert.message ? `<p style="color: #666; margin-bottom: 20px;">${alert.message}</p>` : ''}
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
            <strong>Type:</strong> ${alert.alert_type}<br>
            ${alert.brand_handle ? `<strong>Brand:</strong> ${alert.brand_handle}<br>` : ''}
            ${alert.platform ? `<strong>Platform:</strong> ${alert.platform}<br>` : ''}
            ${alert.risk_score ? `<strong>Risk Score:</strong> ${alert.risk_score}/100<br>` : ''}
            ${alert.risk_level ? `<strong>Risk Level:</strong> ${alert.risk_level}<br>` : ''}
            ${alert.target ? `<strong>Target:</strong> ${alert.target}<br>` : ''}
            ${alert.threat_id ? `<strong>Threat ID:</strong> ${alert.threat_id}<br>` : ''}
          </p>
        </div>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          <strong>Created:</strong> ${new Date(alert.created_at).toLocaleString()}<br>
          <strong>Alert ID:</strong> ${alert.id}
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 11px;">
          This is an automated alert from Agentic Bro Brand Guard.<br>
          Manage your alerts at: https://agenticbro.app/brand-guard
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Brand Guard <alerts@agenticbro.app>',
        to: [emailAddress],
        subject: `[${alert.severity.toUpperCase()}] ${icon} ${alert.title}`,
        html,
        text: `${alert.severity.toUpperCase()}: ${alert.title}\n\n${alert.message || ''}\n\nCreated: ${new Date(alert.created_at).toLocaleString()}\nAlert ID: ${alert.id}`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error?.message || response.statusText };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ── In-App Notification Delivery ──────────────────────────────────────────────

async function deliverInAppNotification(supabase: SupabaseClient, alert: Alert): Promise<boolean> {
  try {
    // In-app notifications are handled via Supabase Realtime
    // The alert was already inserted, which triggers Realtime events
    // Clients subscribed to brand_guard_alerts will receive the new row
    
    // We could also create a separate in-app notifications table here
    // For now, Realtime handles the delivery
    
    return true;
  } catch (error) {
    console.error('In-app notification delivery error:', error);
    return false;
  }
}

// ── Alert Lookup Functions ────────────────────────────────────────────────────

async function getAlertById(supabase: SupabaseClient, alertId: string): Promise<Alert | null> {
  const { data, error } = await supabase
    .from('brand_guard_alerts')
    .select(`
      id,
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
      created_at,
      brand_monitors (
        brand_handle,
        brand_name
      )
    `)
    .eq('id', alertId)
    .single();

  if (error || !data) {
    console.error('Alert lookup error:', error);
    return null;
  }

  const row = data as Record<string, any>;
  return {
    id: row.id,
    brand_monitor_id: row.brand_monitor_id,
    alert_type: row.alert_type,
    severity: row.severity,
    title: row.title,
    message: row.message,
    threat_id: row.threat_id,
    target: row.target,
    platform: row.platform,
    risk_score: row.risk_score,
    risk_level: row.risk_level,
    created_at: row.created_at,
    brand_handle: row.brand_monitors?.brand_handle,
    brand_name: row.brand_monitors?.brand_name,
  };
}

async function getUnreadAlerts(
  supabase: SupabaseClient,
  brand_monitor_id: string,
  maxCount: number = 10
): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('brand_guard_alerts')
    .select(`
      id,
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
      created_at,
      brand_monitors (
        brand_handle,
        brand_name
      )
    `)
    .eq('brand_monitor_id', brand_monitor_id)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(maxCount);

  if (error) {
    console.error('Unread alerts lookup error:', error);
    return [];
  }

  return (data as any[]).map((d: any) => ({
    ...d,
    brand_handle: d.brand_monitors?.brand_handle,
    brand_name: d.brand_monitors?.brand_name,
  }));
}

async function getUserEmail(supabase: SupabaseClient, brandMonitorId: string): Promise<string | null> {
  // Get the owner_id for this brand monitor
  const { data: brandData, error: brandError } = await supabase
    .from('brand_monitors')
    .select('owner_id')
    .eq('id', brandMonitorId)
    .single();

  if (brandError || !brandData) {
    return null;
  }

  // Use admin API to get user email (safe — no direct auth.users SELECT)
  try {
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(brandData.owner_id);
    if (userError || !user) {
      return user?.email ?? null;
    }
    return user.email ?? null;
  } catch {
    return null;
  }
}

async function getBrandEmailPreferences(supabase: SupabaseClient, brandMonitorId: string): Promise<{
  alert_email: boolean;
  alert_email_address: string | null;
}> {
  const { data, error } = await supabase
    .from('dashboard_preferences')
    .select('alert_email, alert_email_address')
    .eq('brand_monitor_id', brandMonitorId)
    .single();

  if (error || !data) {
    // Default preferences
    return { alert_email: true, alert_email_address: null };
  }

  return {
    alert_email: data.alert_email !== false,
    alert_email_address: data.alert_email_address || null,
  };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

async function handleAlertDeliver(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const supabase = getSupabase();

  const body = req.body;
  if (!body) {
    res.status(400).json({ error: 'Request body is required' });
    return;
  }

  const { alert_id, all_unread, max_count = 10 } = body;
  
  const delivered = [];
  const errors: string[] = [];

  try {
    // Delivery mode 1: Single alert by ID
    if (alert_id) {
      const alert = await getAlertById(supabase, alert_id);
      if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }

      const email = await getUserEmail(supabase, alert.brand_monitor_id);
      if (!email) {
        errors.push(`No email found for brand monitor ${alert.brand_monitor_id}`);
      } else {
        const emailResult = await sendEmailAlert(email, alert);
        if (emailResult.success) {
          delivered.push({ type: 'email', to: email, alert_id: alert.id });
        } else {
          errors.push(`Email delivery failed for ${alert.id}: ${emailResult.error}`);
        }
      }

      // Mark as read
      await supabase
        .from('brand_guard_alerts')
        .update({ read: true })
        .eq('id', alert_id);

      res.status(200).json({
        delivered: delivered.length,
        errors,
        alerts: delivered,
      });
      return;
    }

    // Delivery mode 2: All unread alerts
    if (all_unread) {
      // Get all brand monitors for this user (if owner_id is passed)
      // For now, process all unread alerts system-wide
      const unreadAlerts = await getUnreadAlerts(supabase, 'ALL', max_count);
      
      if (unreadAlerts.length === 0) {
        res.status(200).json({ delivered: 0, errors: [], message: 'No unread alerts' });
        return;
      }

      for (const alert of unreadAlerts) {
        const email = await getUserEmail(supabase, alert.brand_monitor_id);
        
        if (email) {
          const emailResult = await sendEmailAlert(email, alert);
          if (emailResult.success) {
            delivered.push({ type: 'email', to: email, alert_id: alert.id });
          } else {
            errors.push(`Email delivery failed for ${alert.id}: ${emailResult.error}`);
          }
        } else {
          errors.push(`No email found for brand monitor ${alert.brand_monitor_id}`);
        }

        // Mark as read
        await supabase
          .from('brand_guard_alerts')
          .update({ read: true })
          .eq('id', alert.id);
      }

      res.status(200).json({
        delivered: delivered.length,
        errors,
        alerts: delivered,
      });
      return;
    }

    res.status(400).json({ error: 'Either alert_id or all_unread must be provided' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

export default handleAlertDeliver;
