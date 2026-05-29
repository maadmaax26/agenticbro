/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/dashboard.ts — Reputation Dashboard API
 * ========================================================================
 * Aggregates data from all Brand Guard features into a unified dashboard.
 * Provides threat feed, brand health score, takedown actions, and alerts.
 *
 * GET /api/brand-guard/dashboard?brand_id=xxx
 *   Returns: Full dashboard data for a brand
 *
 * GET /api/brand-guard/dashboard?brand_id=xxx&section=threats
 *   Returns: Threat feed only
 *
 * GET /api/brand-guard/dashboard?brand_id=xxx&section=health
 *   Returns: Brand health score only
 *
 * GET /api/brand-guard/dashboard?brand_id=xxx&section=takedowns
 *   Returns: Takedown actions only
 *
 * GET /api/brand-guard/dashboard?brand_id=xxx&section=alerts
 *   Returns: Recent alerts only
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ── Types ────────────────────────────────────────────────────────────────────
interface ThreatItem {
  id: string;
  type: 'social_impersonator' | 'phone_scam' | 'domain_lookalike' | 'cross_channel' | 'scammer_db';
  severity: 'critical' | 'high' | 'medium' | 'low';
  platform: string;
  target: string;
  risk_score: number;
  risk_level: string;
  evidence: string[];
  detected_at: string;
  status: 'new' | 'monitoring' | 'reported' | 'resolved' | 'dismissed';
  takedown_actions: TakedownAction[];
}

interface TakedownAction {
  id: string;
  platform: string;
  action_type: 'report' | 'cease_desist' | 'evidence_package' | 'monitor';
  target: string;
  url: string;
  status: 'pending' | 'submitted' | 'acknowledged' | 'removed' | 'rejected';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  evidence_needed: string[];
  submitted_at?: string;
  completed_at?: string;
  created_at: string;
}

interface BrandHealthScore {
  overall_score: number;
  overall_level: string;
  breakdown: {
    social_health: number;
    domain_health: number;
    phone_health: number;
    scammer_db_exposure: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  last_scan: string;
  recommendations: string[];
}

interface AlertItem {
  id: string;
  brand_id: string;
  type: 'new_threat' | 'escalation' | 'resolved' | 'scan_complete';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  threat_id?: string;
  read: boolean;
  created_at: string;
}

interface DashboardData {
  brand: {
    id: string;
    name: string;
    handle: string;
    domain?: string;
  };
  health_score: BrandHealthScore;
  threats: ThreatItem[];
  takedown_actions: TakedownAction[];
  alerts: AlertItem[];
  summary: {
    total_threats: number;
    critical_threats: number;
    high_threats: number;
    medium_threats: number;
    low_threats: number;
    pending_takedowns: number;
    completed_takedowns: number;
    unresolved_alerts: number;
  };
  scan_history: Array<{
    scan_type: string;
    scan_date: string;
    results_count: number;
  }>;
}

// ── Brand Health Score Calculation ────────────────────────────────────────────
function calculateHealthScore(
  socialThreats: number,
  domainThreats: number,
  phoneThreats: number,
  scammerDbMatches: number,
  criticalCount: number,
  highCount: number
): BrandHealthScore {
  // Start at 100 (perfect health), subtract for threats
  let score = 100;

  // Social threats: -3 per threat, -10 per critical, -5 per high
  score -= Math.min(30, socialThreats * 3);
  score -= Math.min(20, criticalCount * 10);
  score -= Math.min(15, highCount * 5);

  // Domain threats: -2 per threat
  score -= Math.min(20, domainThreats * 2);

  // Phone threats: -2 per threat
  score -= Math.min(10, phoneThreats * 2);

  // Scammer DB exposure: -5 per match
  score -= Math.min(20, scammerDbMatches * 5);

  // Floor at 0
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: string;
  if (score >= 80) level = 'EXCELLENT';
  else if (score >= 60) level = 'GOOD';
  else if (score >= 40) level = 'FAIR';
  else if (score >= 20) level = 'POOR';
  else level = 'CRITICAL';

  // Determine trend (would need historical data in production)
  const trend: string = score >= 60 ? 'stable' : 'declining';

  // Generate recommendations
  const recommendations: string[] = [];
  if (criticalCount > 0) recommendations.push('File urgent abuse reports for all critical threats');
  if (highCount > 0) recommendations.push('Monitor high-threat profiles and file abuse reports within 48 hours');
  if (domainThreats > 0) recommendations.push('Register key domain variants to prevent typosquatting');
  if (scammerDbMatches > 0) recommendations.push('Review scammer database entries and update monitoring keywords');
  if (socialThreats > 5) recommendations.push('Consider increasing scan frequency to daily for this brand');
  if (phoneThreats > 0) recommendations.push('Set up call screening for reported phone numbers');

  return {
    overall_score: score,
    overall_level: level,
    breakdown: {
      social_health: Math.max(0, 100 - socialThreats * 5 - criticalCount * 15),
      domain_health: Math.max(0, 100 - domainThreats * 5),
      phone_health: Math.max(0, 100 - phoneThreats * 10),
      scammer_db_exposure: Math.max(0, 100 - scammerDbMatches * 15),
    },
    trend: trend as 'improving' | 'stable' | 'declining',
    last_scan: new Date().toISOString(),
    recommendations,
  };
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const brandId = (req.url?.split('brand_id=')[1]?.split('&')[0]) || '';
  const section = (req.url?.split('section=')[1]?.split('&')[0]) || 'all';

  if (!brandId) {
    res.status(400).json({ error: 'brand_id is required' });
    return;
  }

  // ── Fetch brand data from Supabase ────────────────────────────────────────
  let brand: Record<string, unknown> | null = null;
  let threats: ThreatItem[] = [];
  let takedownActions: TakedownAction[] = [];
  let alerts: AlertItem[] = [];
  let scanHistory: Array<Record<string, unknown>> = [];

  if (supabase) {
    // Fetch brand
    const { data: brandData } = await supabase
      .from('brand_monitors')
      .select('*')
      .eq('id', brandId)
      .single();
    brand = brandData;

    // Fetch impersonator threats
    const { data: impersonators } = await supabase
      .from('brand_impersonators')
      .select('*')
      .eq('brand_monitor_id', brandId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (impersonators) {
      for (const imp of impersonators) {
        threats.push({
          id: imp.id,
          type: 'social_impersonator',
          severity: imp.risk_level === 'CRITICAL' ? 'critical' : imp.risk_level === 'HIGH' ? 'high' : imp.risk_level === 'MEDIUM' ? 'medium' : 'low',
          platform: imp.platform || 'unknown',
          target: imp.username || 'unknown',
          risk_score: imp.impersonation_score || 0,
          risk_level: imp.risk_level || 'LOW',
          evidence: imp.evidence || [],
          detected_at: imp.first_seen_at || imp.created_at || new Date().toISOString(),
          status: imp.takedown_status || 'new',
          takedown_actions: [],
        });
      }
    }

    // Fetch domain lookalikes
    const { data: domains } = await supabase
      .from('domain_lookalikes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (domains) {
      for (const dom of domains) {
        const summary = dom.summary as Record<string, number> || {};
        threats.push({
          id: dom.scan_id || dom.id,
          type: 'domain_lookalike',
          severity: (summary.critical || 0) > 0 ? 'critical' : (summary.high || 0) > 0 ? 'high' : 'medium',
          platform: 'domain',
          target: dom.domain || 'unknown',
          risk_score: 0,
          risk_level: (summary.critical || 0) > 0 ? 'CRITICAL' : (summary.high || 0) > 0 ? 'HIGH' : 'MEDIUM',
          evidence: [],
          detected_at: dom.created_at || new Date().toISOString(),
          status: 'new',
          takedown_actions: [],
        });
      }
    }

    // Fetch vendor verifications
    const { data: verifications } = await supabase
      .from('vendor_verifications')
      .select('*')
      .eq('verification_level', 'SUSPICIOUS')
      .or('verification_level=eq.LIKELY_FRAUDULENT')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (verifications) {
      for (const v of verifications) {
        threats.push({
          id: v.verification_id || v.id,
          type: 'phone_scam',
          severity: v.verification_level === 'LIKELY_FRAUDULENT' ? 'critical' : 'high',
          platform: 'phone',
          target: v.phone || 'unknown',
          risk_score: v.verification_score || 0,
          risk_level: v.verification_level || 'UNKNOWN',
          evidence: [],
          detected_at: v.created_at || new Date().toISOString(),
          status: 'new',
          takedown_actions: [],
        });
      }
    }

    // Fetch takedown actions
    const { data: takedowns } = await supabase
      .from('takedown_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (takedowns) {
      takedownActions = takedowns.map((t: Record<string, unknown>) => ({
        id: t.id,
        platform: t.platform || 'unknown',
        action_type: t.action_type || 'report',
        target: t.evidence_url || 'unknown',
        url: '',
        status: t.status || 'pending',
        priority: t.status === 'pending' ? 'urgent' : 'medium',
        evidence_needed: [],
        created_at: t.created_at || new Date().toISOString(),
      }));
    }

    // Fetch threat profiles
    const { data: threatProfiles } = await supabase
      .from('threat_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (threatProfiles) {
      for (const tp of threatProfiles) {
        const result = tp.result as Record<string, unknown> || {};
        const riskProfile = result.risk_profile as Record<string, unknown> || {};
        threats.push({
          id: tp.threat_id || tp.id,
          type: 'cross_channel',
          severity: tp.risk_level === 'CRITICAL' ? 'critical' : tp.risk_level === 'HIGH' ? 'high' : 'medium',
          platform: 'cross_channel',
          target: 'Multiple channels',
          risk_score: tp.aggregate_risk as number || 0,
          risk_level: tp.risk_level as string || 'UNKNOWN',
          evidence: (riskProfile.evidence as string[]) || [],
          detected_at: tp.created_at as string || new Date().toISOString(),
          status: tp.status as string || 'active',
          takedown_actions: [],
        });
      }
    }

    // Build scan history from brand_guard_scans
    const { data: scans } = await supabase
      .from('brand_guard_scans')
      .select('scan_id, created_at, status, platforms')
      .eq('brand_monitor_id', brandId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (scans) {
      scanHistory = scans.map((s: Record<string, unknown>) => ({
        scan_type: 'impersonator_scan',
        scan_date: s.created_at || new Date().toISOString(),
        results_count: s.status === 'complete' ? 1 : 0,
      }));
    }
  }

  // If no brand found, use defaults
  if (!brand) {
    brand = { id: brandId, brand_name: 'Unknown', brand_handle: 'unknown', brand_domain: null };
  }

  // ── Calculate summary ─────────────────────────────────────────────────────
  const criticalCount = threats.filter(t => t.severity === 'critical').length;
  const highCount = threats.filter(t => t.severity === 'high').length;
  const mediumCount = threats.filter(t => t.severity === 'medium').length;
  const lowCount = threats.filter(t => t.severity === 'low').length;

  const healthScore = calculateHealthScore(
    threats.filter(t => t.type === 'social_impersonator').length,
    threats.filter(t => t.type === 'domain_lookalike').length,
    threats.filter(t => t.type === 'phone_scam').length,
    threats.filter(t => t.type === 'scammer_db').length,
    criticalCount,
    highCount,
  );

  const summary = {
    total_threats: threats.length,
    critical_threats: criticalCount,
    high_threats: highCount,
    medium_threats: mediumCount,
    low_threats: lowCount,
    pending_takedowns: takedownActions.filter(t => t.status === 'pending').length,
    completed_takedowns: takedownActions.filter(t => t.status === 'removed').length,
    unresolved_alerts: alerts.filter(a => !a.read).length,
  };

  const dashboardData: DashboardData = {
    brand: {
      id: (brand as Record<string, unknown>).id as string || brandId,
      name: (brand as Record<string, unknown>).brand_name as string || 'Unknown',
      handle: (brand as Record<string, unknown>).brand_handle as string || 'unknown',
      domain: (brand as Record<string, unknown>).brand_domain as string || undefined,
    },
    health_score: healthScore,
    threats,
    takedown_actions: takedownActions,
    alerts,
    summary,
    scan_history: scanHistory as DashboardData['scan_history'],
  };

  // ── Return section or full dashboard ──────────────────────────────────────
  switch (section) {
    case 'threats':
      res.status(200).json({ success: true, threats, summary });
      break;
    case 'health':
      res.status(200).json({ success: true, health_score: healthScore });
      break;
    case 'takedowns':
      res.status(200).json({ success: true, takedown_actions: takedownActions });
      break;
    case 'alerts':
      res.status(200).json({ success: true, alerts });
      break;
    default:
      res.status(200).json({ success: true, dashboard: dashboardData });
  }
}

export const config = {
  maxDuration: 15,
};