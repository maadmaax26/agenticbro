/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply - contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/dashboard.ts - Reputation Dashboard API
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
  type: 'social_impersonator' | 'phone_scam' | 'domain_lookalike' | 'cross_channel' | 'scammer_db' | 'email';
  severity: 'critical' | 'high' | 'medium' | 'low';
  platform: string;
  target: string;
  risk_score: number;
  risk_level: string;
  evidence: string[];
  detected_at: string;
  status: 'new' | 'monitoring' | 'reported' | 'resolved' | 'dismissed' | 'active';
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
    email_health: number;
    phone_health: number;
    web_reputation: number;
  };
  improvement_tips: Record<string, string[]>;
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
  emailThreats: number,
  phoneThreats: number,
  webReputationFlags: number,
  criticalCount: number,
  highCount: number,
  domainCriticalCount: number,
  domainHighCount: number,
  domainMediumCount: number,
  domainLowCount: number
): BrandHealthScore {
  // Start at 100 (perfect health), subtract for threats
  let score = 100;

  // Social threats: -3 per threat, -10 per critical, -5 per high
  score -= Math.min(30, socialThreats * 3);
  score -= Math.min(20, criticalCount * 10);
  score -= Math.min(15, highCount * 5);

  // Domain threats: weighted by severity (not raw count, since variants inflate numbers)
  score -= Math.min(25, domainCriticalCount * 15);
  score -= Math.min(15, domainHighCount * 5);
  score -= Math.min(10, domainMediumCount);
  score -= Math.min(5, domainLowCount);

  // Email threats: -5 per threat (spoofable domains are serious)
  score -= Math.min(20, emailThreats * 5);

  // Phone threats: -2 per threat
  score -= Math.min(10, phoneThreats * 2);

  // Web reputation flags: -5 per flag
  score -= Math.min(20, webReputationFlags * 5);

  // Floor at 0
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: string;
  if (score >= 80) level = 'EXCELLENT';
  else if (score >= 60) level = 'GOOD';
  else if (score >= 40) level = 'FAIR';
  else if (score >= 20) level = 'POOR';
  else level = 'CRITICAL';

  // Determine trend
  const trend: string = score >= 60 ? 'stable' : 'declining';

  // Generate recommendations
  const recommendations: string[] = [];
  if (criticalCount > 0) recommendations.push('File urgent abuse reports for all critical threats');
  if (highCount > 0) recommendations.push('Monitor high-threat profiles and file abuse reports within 48 hours');
  if (domainThreats > 0) recommendations.push('Register key domain variants to prevent typosquatting');
  if (emailThreats > 0) recommendations.push('Set up DMARC p=reject and DKIM to prevent email spoofing');
  if (webReputationFlags > 0) recommendations.push('Check ScamAdviser and review any negative web reputation signals');
  if (socialThreats > 5) recommendations.push('Consider increasing scan frequency to daily for this brand');
  if (phoneThreats > 0) recommendations.push('Set up call screening for reported phone numbers');

  // Per-category health scores
  const socialHealth = Math.max(0, 100 - Math.min(60, socialThreats * 5) - Math.min(30, criticalCount * 15));
  const domainHealth = Math.max(0, 100 - Math.min(25, domainCriticalCount * 15) - Math.min(15, domainHighCount * 5) - Math.min(10, domainMediumCount) - Math.min(5, domainLowCount));
  const emailHealth = Math.max(0, 100 - Math.min(70, emailThreats * 10));
  const phoneHealth = Math.max(0, 100 - Math.min(40, phoneThreats * 10));
  const webRep = Math.max(0, 100 - Math.min(50, webReputationFlags * 10));

  // Generate per-category improvement tips
  const improvement_tips: Record<string, string[]> = {};
  if (socialHealth < 80) {
    improvement_tips.social = [];
    if (socialThreats > 0) improvement_tips.social.push('Report fake accounts on each platform to reduce active impersonators');
    if (criticalCount > 0) improvement_tips.social.push('File urgent abuse reports — critical threats drag your score down 15pts each');
    improvement_tips.social.push('Verify official accounts on all platforms to establish authenticity');
    improvement_tips.social.push('Increase scan frequency to catch new impersonators faster');
  }
  if (domainHealth < 80) {
    improvement_tips.domain = [];
    improvement_tips.domain.push('Register top .com, .net, .org, .io variants of your domain');
    improvement_tips.domain.push('File abuse reports with registrars for phishing domains');
    improvement_tips.domain.push('Set up DNS monitoring to catch new registrations immediately');
    if (domainThreats > 10) improvement_tips.domain.push('Focus on CRITICAL/HIGH variants first — they hurt your score most');
  }
  if (emailHealth < 80) {
    improvement_tips.email = [];
    improvement_tips.email.push('Set up DMARC with p=reject policy to block spoofed emails');
    improvement_tips.email.push('Publish DKIM records for all sending domains');
    improvement_tips.email.push('Configure SPF to authorize only your mail servers');
    improvement_tips.email.push('Monitor CertStream for lookalike domain registrations');
  }
  if (phoneHealth < 80) {
    improvement_tips.phone = [];
    improvement_tips.phone.push('Report scam numbers to the FTC and carrier abuse lines');
    improvement_tips.phone.push('Set up call screening for reported numbers');
    improvement_tips.phone.push('Add scam numbers to your brand\'s block list');
  }
  if (webRep < 80) {
    improvement_tips.web = [];
    improvement_tips.web.push('Claim and verify your business on Google, Trustpilot, and BBB');
    improvement_tips.web.push('Respond to negative reviews to improve reputation signals');
    improvement_tips.web.push('Submit takedown requests for scam listings impersonating your brand');
  }

  return {
    overall_score: score,
    overall_level: level,
    breakdown: {
      social_health: socialHealth,
      domain_health: domainHealth,
      email_health: emailHealth,
      phone_health: phoneHealth,
      web_reputation: webRep,
    },
    improvement_tips,
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

    // Fetch impersonator threats from brand_guard_scans (primary source)
    // Falls back to brand_impersonators if available
    const { data: impScans } = await supabase
      .from('brand_guard_scans')
      .select('*')
      .eq('brand_monitor_id', brandId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (impScans) {
      for (const scan of impScans) {
        const result = scan.result as Record<string, unknown> | null;
        if (!result) continue;
        const impersonators = (result.impersonators || result.impersonator_results || []) as Record<string, unknown>[];
        for (const imp of impersonators) {
          const riskLevel = (imp.risk_level as string) || 'LOW';
          threats.push({
            id: `${scan.scan_id}-${imp.handle}`,
            type: 'social_impersonator',
            severity: riskLevel === 'CRITICAL' ? 'critical' : riskLevel === 'HIGH' ? 'high' : riskLevel === 'MEDIUM' ? 'medium' : 'low',
            platform: (imp.platform as string) || 'unknown',
            target: (imp.handle as string) || 'unknown',
            risk_score: (imp.risk_score as number) || 0,
            risk_level: riskLevel,
            evidence: [(imp.type as string) || 'Impersonator', (imp.method as string) || ''].filter(Boolean),
            detected_at: (scan.created_at as string) || new Date().toISOString(),
            status: 'new',
            takedown_actions: [],
          });
        }
      }
    }

    // Also check brand_impersonators table (legacy / direct entries)
    const { data: impersonators } = await supabase
      .from('brand_impersonators')
      .select('*')
      .eq('brand_monitor_id', brandId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (impersonators) {
      for (const imp of impersonators) {
        // Skip duplicates already added from brand_guard_scans
        const existing = threats.some(t => t.target === (imp.username || imp.handle) && t.type === 'social_impersonator');
        if (existing) continue;
        threats.push({
          id: imp.id,
          type: 'social_impersonator',
          severity: imp.risk_level === 'CRITICAL' ? 'critical' : imp.risk_level === 'HIGH' ? 'high' : imp.risk_level === 'MEDIUM' ? 'medium' : 'low',
          platform: imp.platform || 'unknown',
          target: imp.username || imp.handle || 'unknown',
          risk_score: imp.impersonation_score || imp.risk_score || 0,
          risk_level: imp.risk_level || 'LOW',
          evidence: imp.evidence || [],
          detected_at: imp.first_seen_at || imp.created_at || new Date().toISOString(),
          status: imp.takedown_status || 'new',
          takedown_actions: [],
        });
      }
    }

    // Fetch domain lookalikes - expand each variant into its own threat
    const { data: domains } = await supabase
      .from('domain_lookalikes')
      .select('*')
      .eq('domain', ((brand as Record<string, unknown>)?.brand_domain as string) || ((brand as Record<string, unknown>)?.brand_handle as string) || '')
      .order('created_at', { ascending: false })
      .limit(10);

    if (domains) {
      for (const dom of domains) {
        const variants = (dom.variants as Record<string, unknown>[]) || [];
        const summary = dom.summary as Record<string, number> || {};
        // Show top variants as individual threats
        const topVariants = variants.slice(0, 10);
        for (const v of topVariants) {
          const vScore = (v.risk_score as number) || 0;
          const vLevel = (v.risk_level as string) || 'LOW';
          const vType = (v.variant_type as string) || 'unknown';
          const vDomain = (v.domain as string) || 'unknown';
          threats.push({
            id: `${dom.scan_id || dom.id}-${vDomain}`,
            type: 'domain_lookalike',
            severity: vLevel === 'CRITICAL' ? 'critical' : vLevel === 'HIGH' ? 'high' : vLevel === 'MEDIUM' ? 'medium' : 'low',
            platform: 'domain',
            target: vDomain,
            risk_score: vScore,
            risk_level: vLevel,
            evidence: (v.evidence as string[]) || [`${vType.replace(/_/g, ' ')} of ${dom.domain}`],
            detected_at: dom.created_at || new Date().toISOString(),
            status: 'new',
            takedown_actions: [],
          });
        }
        // If no variants parsed, add a single summary threat
        if (topVariants.length === 0) {
          threats.push({
            id: dom.scan_id || dom.id,
            type: 'domain_lookalike',
            severity: (summary.critical || 0) > 0 ? 'critical' : (summary.high || 0) > 0 ? 'high' : 'medium',
            platform: 'domain',
            target: dom.domain || 'unknown',
            risk_score: Math.max(summary.critical || 0, summary.high || 0, 1),
            risk_level: (summary.critical || 0) > 0 ? 'CRITICAL' : (summary.high || 0) > 0 ? 'HIGH' : 'MEDIUM',
            evidence: [`${(summary.critical || 0) + (summary.high || 0)} high-risk variants found`],
            detected_at: dom.created_at || new Date().toISOString(),
            status: 'new',
            takedown_actions: [],
          });
        }
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
        id: String(t.id || ''),
        platform: String(t.platform || 'unknown'),
        action_type: String(t.action_type || 'report') as TakedownAction['action_type'],
        target: String(t.evidence_url || 'unknown'),
        url: '',
        status: String(t.status || 'pending') as TakedownAction['status'],
        priority: t.status === 'pending' ? 'urgent' as const : 'medium' as const,
        evidence_needed: [],
        created_at: String(t.created_at || new Date().toISOString()),
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
          status: ['new','monitoring','reported','resolved','dismissed','active'].includes(String(tp.status)) ? String(tp.status) as ThreatItem['status'] : 'active' as ThreatItem['status'],
          takedown_actions: [],
        });
      }
    }

    // Fetch email spoof check threats
    const { data: emailSpoofChecks } = await supabase
      .from('email_spoof_checks')
      .select('*')
      .eq('brand_monitor_id', brandId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (emailSpoofChecks) {
      for (const esc of emailSpoofChecks) {
        const result = esc.result as Record<string, unknown> || {};
        const emailSec = result.email_security as Record<string, unknown> || {};
        const newDomainThreats = (Array.isArray(result.new_domain_threats) ? result.new_domain_threats : []) as Record<string, unknown>[];

        // Add email vulnerability as a threat if spoofable
        if (emailSec.spoofable === true) {
          threats.push({
            id: `es-${esc.scan_id}`,
            type: 'email',
            severity: 'high',
            platform: 'email',
            target: esc.domain || 'unknown',
            risk_score: 100 - (emailSec.overall_score as number || 0) / 10,
            risk_level: emailSec.vulnerability_level as string || 'HIGH',
            evidence: (Array.isArray(emailSec.spoof_methods) ? emailSec.spoof_methods as string[] : []).slice(0, 3),
            detected_at: esc.created_at as string || new Date().toISOString(),
            status: 'active',
            takedown_actions: [],
          });
        }

        // Add lookalike domain threats from CertStream
        for (const dt of newDomainThreats.slice(0, 10)) {
          threats.push({
            id: `es-dt-${esc.scan_id}-${dt.domain}`,
            type: 'email',
            severity: (dt.riskLevel === 'CRITICAL' || dt.riskLevel === 'HIGH') ? 'high' : (dt.riskLevel === 'MEDIUM') ? 'medium' : 'low',
            platform: 'email',
            target: (dt.domain as string) || 'unknown',
            risk_score: Math.round((dt.similarity as number || 0) * 10),
            risk_level: (dt.riskLevel as string) || 'LOW',
            evidence: (Array.isArray(dt.evidence) ? dt.evidence as string[] : []).slice(0, 3),
            detected_at: esc.created_at as string || new Date().toISOString(),
            status: 'active',
            takedown_actions: [],
          });
        }

        // Add to scan history
        scanHistory.push({
          scan_type: 'email_spoof',
          scan_date: esc.created_at as string || new Date().toISOString(),
          results_count: 1 + newDomainThreats.length,
        });
      }
    }

    // Build scan history from brand_guard_scans
    const { data: scanRows } = await supabase
      .from('brand_guard_scans')
      .select('scan_id, created_at, status, platforms, impersonators_found')
      .eq('brand_monitor_id', brandId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (scanRows) {
      scanHistory = scanRows.map((s: Record<string, unknown>) => ({
        scan_type: 'impersonator_scan',
        scan_date: s.created_at || new Date().toISOString(),
        results_count: (s.impersonators_found as number) || (s.status === 'complete' || s.status === 'completed' ? 1 : 0),
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
    threats.filter(t => t.type === 'email').length,
    threats.filter(t => t.type === 'phone_scam').length,
    threats.filter(t => t.type === 'cross_channel').length,
    criticalCount,
    highCount,
    threats.filter(t => t.type === 'domain_lookalike' && t.severity === 'critical').length,
    threats.filter(t => t.type === 'domain_lookalike' && t.severity === 'high').length,
    threats.filter(t => t.type === 'domain_lookalike' && t.severity === 'medium').length,
    Math.max(0, threats.filter(t => t.type === 'domain_lookalike').length - threats.filter(t => t.type === 'domain_lookalike' && ['critical','high','medium'].includes(t.severity)).length),
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