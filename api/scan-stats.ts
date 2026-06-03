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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
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
        // Fallback: query scan_events directly
        const { data: eventsData, error: eventsErr } = await supabase
          .from('scan_events')
          .select('scan_type, platform, created_at, risk_score, risk_level')
          .gte('created_at', new Date(Date.now() - days * 86400000).toISOString())
          .order('created_at', { ascending: true });

        if (!eventsErr && eventsData) {
          // Aggregate by day
          const dayMap: Record<string, any> = {};
          eventsData.forEach((e: any) => {
            const date = (e.created_at || '').split('T')[0];
            if (!dayMap[date]) dayMap[date] = { stat_date: date, total_scans: 0, social_scans: 0, phone_scans: 0, website_scans: 0, token_scans: 0, wallet_scans: 0, x_cdp_scans: 0, high_risk_total: 0, critical_total: 0 };
            const d = dayMap[date];
            d.total_scans++;
            const t = (e.scan_type || 'social').toLowerCase();
            if (t === 'social') d.social_scans++;
            else if (t === 'phone') d.phone_scans++;
            else if (t === 'website') d.website_scans++;
            else if (t === 'token') d.token_scans++;
            else if (t === 'wallet') d.wallet_scans++;
            else if (t === 'x_cdp') d.x_cdp_scans++;
            const rl = String(e.risk_level || '').toUpperCase();
            if (['HIGH', 'HIGH RISK', 'CRITICAL'].includes(rl)) d.high_risk_total++;
            if (rl === 'CRITICAL') d.critical_total++;
          });
          res.status(200).json({ period: `${days}d`, trends: Object.values(dayMap) });
          return;
        }

        // Fallback 2: scan_results
        const { data: resultsData, error: resultsErr } = await supabase
          .from('scan_results')
          .select('platform, risk_score, risk_level, scanned_at')
          .gte('scanned_at', new Date(Date.now() - days * 86400000).toISOString())
          .order('scanned_at', { ascending: true });

        if (resultsErr) {
          res.status(200).json({ trends: [], error: 'No data source available' });
          return;
        }
        const dayMap2: Record<string, any> = {};
        (resultsData || []).forEach((r: any) => {
          const date = (r.scanned_at || '').split('T')[0];
          if (!dayMap2[date]) dayMap2[date] = { stat_date: date, total_scans: 0, social_scans: 0, phone_scans: 0, website_scans: 0, token_scans: 0, wallet_scans: 0, x_cdp_scans: 0, high_risk_total: 0, critical_total: 0 };
          dayMap2[date].total_scans++;
          dayMap2[date].social_scans++;
          const rl = String(r.risk_level || '').toUpperCase();
          if (['HIGH', 'HIGH RISK', 'CRITICAL'].includes(rl)) dayMap2[date].high_risk_total++;
          if (rl === 'CRITICAL') dayMap2[date].critical_total++;
        });
        res.status(200).json({ period: `${days}d`, trends: Object.values(dayMap2) });
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
      console.error('[scan-stats] get_scan_analytics error:', JSON.stringify(error));
      // Fallback 1: try scan_events table (migration 002)
      let scans: any[] = [];
      let fallbackSource = 'fallback';

      // Try scan_events first (has scan_type column)
      const { data: eventsData, error: eventsError } = await supabase
        .from('scan_events')
        .select('scan_type, platform, risk_score, risk_level, created_at, source')
        .gte('created_at', new Date(Date.now() - days * 86400000).toISOString())
        .order('created_at', { ascending: false });

      if (!eventsError && eventsData && eventsData.length > 0) {
        scans = eventsData;
        fallbackSource = 'scan_events';
      } else {
        // Fallback 2: scan_results (may not have scan_type column)
        const { data: resultsData, error: resultsError } = await supabase
          .from('scan_results')
          .select('platform, risk_score, risk_level, scanned_at, data_source')
          .gte('scanned_at', new Date(Date.now() - days * 86400000).toISOString())
          .order('scanned_at', { ascending: false });

        if (resultsError) {
          console.error('[scan-stats] all fallbacks failed:', JSON.stringify(resultsError));
          res.status(200).json({ ...getEmptyStats() });
          return;
        }
        scans = (resultsData || []).map((s: any) => ({ ...s, scan_type: 'social' }));
        fallbackSource = 'scan_results';
      }

      // Build analytics from raw data
      const totalScans = scans.length;
      const totalHighRisk = scans.filter((s: any) => ['HIGH', 'HIGH RISK', 'CRITICAL'].includes(String(s.risk_level || '').toUpperCase())).length;
      const totalCritical = scans.filter((s: any) => String((s.risk_level || '')).toUpperCase() === 'CRITICAL').length;
      const avgRisk = totalScans > 0 ? scans.reduce((sum: number, s: any) => sum + (Number(s.risk_score) || 0), 0) / totalScans : 0;

      const byType: Record<string, any> = {};
      const byPlatform: Record<string, any> = {};
      const dailyMap: Record<string, { date: string; count: number; high_risk: number; critical: number; total_risk: number }> = {};
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      let todayCount = 0, yesterdayCount = 0, last7d = 0, last30d = 0;
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      let thisWeekCount = 0, lastWeekCount = 0;

      scans.forEach((s: any) => {
        const type = s.scan_type || 'social';
        const platform = (s.platform || 'unknown').toLowerCase();
        const isHighRisk = ['HIGH', 'HIGH RISK', 'CRITICAL'].includes(String(s.risk_level || '').toUpperCase());
        const isCritical = String((s.risk_level || '')).toUpperCase() === 'CRITICAL';
        const dateStr = (s.created_at || s.scanned_at || '').split('T')[0];

        // By type
        if (!byType[type]) byType[type] = { count: 0, high_risk: 0, critical: 0, avg_risk: 0 };
        byType[type].count++;
        if (isHighRisk) byType[type].high_risk++;
        if (isCritical) byType[type].critical++;
        byType[type].avg_risk = ((byType[type].avg_risk * (byType[type].count - 1)) + (Number(s.risk_score) || 0)) / byType[type].count;

        // By platform
        if (!byPlatform[platform]) byPlatform[platform] = { count: 0, high_risk: 0, critical: 0, avg_risk: 0 };
        byPlatform[platform].count++;
        if (isHighRisk) byPlatform[platform].high_risk++;
        if (isCritical) byPlatform[platform].critical++;
        byPlatform[platform].avg_risk = ((byPlatform[platform].avg_risk * (byPlatform[platform].count - 1)) + (Number(s.risk_score) || 0)) / byPlatform[platform].count;

        // Daily map
        if (dateStr) {
          if (!dailyMap[dateStr]) dailyMap[dateStr] = { date: dateStr, count: 0, high_risk: 0, critical: 0, total_risk: 0 };
          dailyMap[dateStr].count++;
          if (isHighRisk) dailyMap[dateStr].high_risk++;
          if (isCritical) dailyMap[dateStr].critical++;
          dailyMap[dateStr].total_risk += Number(s.risk_score) || 0;
        }

        // Growth counts
        const ts = s.created_at || s.scanned_at || '';
        if (dateStr === today) todayCount++;
        if (dateStr === yesterday) yesterdayCount++;
        if (ts >= monthAgo) last30d++;
        if (ts >= weekAgo) { last7d++; thisWeekCount++; }
        if (ts >= twoWeeksAgo && ts < weekAgo) lastWeekCount++;
      });

      const growthPercent = lastWeekCount > 0 ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100 * 10) / 10 : null;

      res.status(200).json({
        total_scans: totalScans,
        total_high_risk: totalHighRisk,
        total_critical: totalCritical,
        avg_risk_score: Math.round(avgRisk * 10) / 10,
        unique_days: Object.keys(dailyMap).length,
        by_type: byType,
        by_platform: byPlatform,
        daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
        growth: {
          today: todayCount,
          yesterday: yesterdayCount,
          last_7d: last7d,
          last_30d: last30d,
          this_week_vs_last_week: growthPercent,
        },
        period: `${days}d`,
        source: fallbackSource,
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