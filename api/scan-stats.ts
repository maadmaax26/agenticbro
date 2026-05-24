/**
 * api/scan-stats.ts — Scan Analytics API
 * 
 * GET /api/scan-stats              → Overview: totals, breakdown by type & platform, growth
 * GET /api/scan-stats?trends=1    → Day-by-day trend data for charts
 * GET /api/scan-stats?days=7       → Last 7 days instead of default 30
 * GET /api/scan-stats&type=social  → Filter to a specific scan type
 * 
 * POST /api/scan-stats             → Record a scan event (called by other API routes)
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://***REMOVED***';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY;

type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Use service key for both reads and writes (Vercel serverless env doesn't expose VITE_ vars)
  const key = supabaseServiceKey || supabaseAnonKey;
  const supabase = supabaseUrl && key ? createClient(supabaseUrl, key) : null;

  if (!supabase) {
    res.status(200).json({ error: 'Supabase not configured', stats: getEmptyStats() });
    return;
  }

  // ── POST: Record a scan event ──────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body ?? {};
    const eventType = String(body.event_type ?? body.scan_type ?? 'social').toLowerCase();
    const platform = String(body.platform ?? 'unknown').toLowerCase();
    const username = body.username ? String(body.username) : null;
    const riskScore = body.risk_score != null ? Number(body.risk_score) : null;
    const riskLevel = body.risk_level ? String(body.risk_level) : null;
    const source = String(body.source ?? 'website').toLowerCase();

    const validTypes = ['social', 'phone', 'website', 'token', 'wallet', 'x_cdp'];
    if (!validTypes.includes(eventType)) {
      res.status(400).json({ error: `Invalid event_type. Must be one of: ${validTypes.join(', ')}` });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('record_scan_event', {
        p_event_type: eventType,
        p_platform: platform,
        p_username: username,
        p_risk_score: riskScore,
        p_risk_level: riskLevel,
        p_source: source,
      });

      if (error) {
        console.error('[scan-stats] record_scan_event error:', error);
        // Fallback: insert directly into scan_event_log
        await supabase.from('scan_event_log').insert({
          event_type: eventType,
          platform,
          username,
          risk_score: riskScore,
          risk_level: riskLevel,
          source,
        });
      }

      res.status(200).json({ recorded: true, event_type: eventType, platform });
    } catch (err: any) {
      console.error('[scan-stats] POST error:', err);
      res.status(500).json({ error: err?.message ?? 'Failed to record scan event' });
    }
    return;
  }

  // ── GET: Return analytics ───────────────────────────────────────────────
  const url = new URL(req.url ?? '', 'https://agenticbro.app');
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '30') || 30, 365);
  const scanType = url.searchParams.get('type') || null;
  const trends = url.searchParams.get('trends') === '1';

  try {
    if (trends) {
      // Return day-by-day trend data
      const { data, error } = await supabase.rpc('get_scan_trends', { p_days: days });

      if (error) {
        console.error('[scan-stats] get_scan_trends error:', error);
        res.status(200).json({ trends: [], error: 'RPC not available' });
        return;
      }

      res.status(200).json({
        period: `${days}d`,
        trends: data || [],
      });
      return;
    }

    // Return full analytics overview
    const { data, error } = await supabase.rpc('get_scan_analytics', {
      p_days: days,
      p_scan_type: scanType,
    });

    if (error) {
      console.error('[scan-stats] get_scan_analytics error:', error);
      // Fallback: query scan_results directly
      const { data: recentScans, error: scanError } = await supabase
        .from('scan_results')
        .select('platform, scan_type, risk_score, risk_level, scanned_at, data_source')
        .gte('scanned_at', new Date(Date.now() - days * 86400000).toISOString())
        .order('scanned_at', { ascending: false });

      if (scanError) {
        res.status(200).json(getEmptyStats());
        return;
      }

      // Build stats from raw data
      const scans = recentScans || [];
      const byType: Record<string, number> = {};
      const byPlatform: Record<string, number> = {};

      scans.forEach(s => {
        const type = s.scan_type || 'social';
        byType[type] = (byType[type] || 0) + 1;
        byPlatform[s.platform] = (byPlatform[s.platform] || 0) + 1;
      });

      res.status(200).json({
        total_scans: scans.length,
        by_type: byType,
        by_platform: byPlatform,
        period: `${days}d`,
        source: 'fallback',
      });
      return;
    }

    res.status(200).json({
      ...data,
      period: `${days}d`,
      source: 'rpc',
    });
  } catch (err: any) {
    console.error('[scan-stats] GET error:', err);
    res.status(200).json(getEmptyStats());
  }
}

function getEmptyStats() {
  return {
    total_scans: 0,
    total_high_risk: 0,
    total_critical: 0,
    avg_risk_score: 0,
    unique_days: 0,
    by_type: {},
    by_platform: {},
    daily: [],
    growth: {
      today: 0,
      yesterday: 0,
      last_7d: 0,
      last_30d: 0,
      this_week_vs_last_week: null,
    },
    period: '30d',
    source: 'empty',
  };
}