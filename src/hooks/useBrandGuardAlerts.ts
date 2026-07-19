/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * useBrandGuardAlerts.ts — Realtime alert subscription hook for Brand Guard
 *
 * Subscribes to Supabase realtime for new brand_guard_alerts and provides
 * toast notifications for incoming alerts.
 *
 * Usage:
 *   const { alerts, unreadCount, markRead } = useBrandGuardAlerts(userId);
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────
export interface BrandGuardAlert {
  id: string;
  brand_monitor_id: string;
  alert_type: 'new_threat' | 'escalation' | 'resolved' | 'scan_complete';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string | null;
  threat_id: string | null;
  target: string | null;
  platform: string | null;
  risk_score: number;
  risk_level: string | null;
  evidence: string[];
  read: boolean;
  created_at: string;
}

// ── Severity config ───────────────────────────────────────────────────────────
const SEVERITY_CONFIG: Record<string, { emoji: string; color: string; bg: string; priority: number }> = {
  critical: { emoji: '🔴', color: '#dc2626', bg: '#dc262620', priority: 0 },
  high:     { emoji: '🟠', color: '#ea580c', bg: '#ea580c20', priority: 1 },
  medium:   { emoji: '🟡', color: '#ca8a04', bg: '#ca8a0420', priority: 2 },
  low:      { emoji: '🟢', color: '#16a34a', bg: '#16a34a20', priority: 3 },
  info:     { emoji: '🔵', color: '#2563eb', bg: '#2563eb20', priority: 4 },
};

export function useBrandGuardAlerts(userId: string | null) {
  const [alerts, setAlerts] = useState<BrandGuardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Array<{ id: string; alert: BrandGuardAlert; timestamp: number }>>([]);

  // ── Fetch initial alerts ─────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }

    try {
      // Get all brand_monitor_ids for this user
      const { data: monitors } = await supabase
        .from('brand_monitors')
        .select('id')
        .eq('owner_id', userId);

      if (!monitors || monitors.length === 0) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      const monitorIds = monitors.map(m => m.id);

      const { data, error } = await supabase
        .from('brand_guard_alerts')
        .select('*')
        .in('brand_monitor_id', monitorIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[BrandGuard Alerts] Fetch error:', error);
      } else {
        setAlerts((data || []) as BrandGuardAlert[]);
      }
    } catch (err) {
      console.error('[BrandGuard Alerts] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ── Mark alert as read ──────────────────────────────────────────────────
  const markRead = useCallback(async (alertId: string) => {
    if (!supabase) return;

    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));

    await supabase
      .from('brand_guard_alerts')
      .update({ read: true })
      .eq('id', alertId);
  }, []);

  // ── Mark all as read ────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!supabase) return;

    const unreadIds = alerts.filter(a => !a.read).map(a => a.id);
    if (unreadIds.length === 0) return;

    setAlerts(prev => prev.map(a => ({ ...a, read: true })));

    await supabase
      .from('brand_guard_alerts')
      .update({ read: true })
      .in('id', unreadIds);
  }, [alerts]);

  // ── Dismiss toast ───────────────────────────────────────────────────────
  const dismissToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);

  // ── Subscribe to realtime alerts ────────────────────────────────────────
  useEffect(() => {
    fetchAlerts();

    if (!supabase || !userId) return;
    const client = supabase;

    // Subscribe to new alerts on brand_guard_alerts table
    const channel = client
      .channel('brand-guard-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'brand_guard_alerts',
        },
        (payload: { new: BrandGuardAlert }) => {
          const newAlert = payload.new as BrandGuardAlert;
          console.log('[BrandGuard Alerts] New alert:', newAlert.title);

          // Add to alerts list
          setAlerts(prev => [newAlert, ...prev].slice(0, 50));

          // Show toast notification
          setToasts(prev => [...prev, {
            id: newAlert.id,
            alert: newAlert,
            timestamp: Date.now(),
          }]);

          // Auto-dismiss toast after 10 seconds (for info/low) or 30 seconds (for critical/high)
          const config = SEVERITY_CONFIG[newAlert.severity] || SEVERITY_CONFIG.info;
          const dismissMs = config.priority <= 1 ? 30000 : 10000;
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== newAlert.id));
          }, dismissMs);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'brand_guard_alerts',
        },
        (payload: { new: BrandGuardAlert }) => {
          const updated = payload.new as BrandGuardAlert;
          setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));
        }
      )
      .subscribe((status: string) => {
        console.log('[BrandGuard Alerts] Subscription status:', status);
      });

    return () => {
      if (channel) {
        client.removeChannel(channel);
      }
    };
  }, [userId, fetchAlerts]);

  // ── Derived state ───────────────────────────────────────────────────────
  const unreadCount = alerts.filter(a => !a.read).length;
  const criticalCount = alerts.filter(a => !a.read && (a.severity === 'critical' || a.severity === 'high')).length;

  return {
    alerts,
    unreadCount,
    criticalCount,
    loading,
    toasts,
    markRead,
    markAllRead,
    dismissToast,
    refresh: fetchAlerts,
    severityConfig: SEVERITY_CONFIG,
  };
}
