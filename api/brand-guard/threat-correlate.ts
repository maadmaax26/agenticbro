/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/threat-correlate.ts — Cross-Channel Threat Correlation API
 * ========================================================================
 * Links threats across social media, phone, domains, and wallet addresses
 * into unified threat profiles. Cross-references the scammer database.
 *
 * POST /api/brand-guard/threat-correlate
 *   Body: { brand_name, brand_handle, brand_domain?, scan_results? }
 *   Returns: Unified threat profile with aggregate risk score
 *
 * GET /api/brand-guard/threat-correlate?threat_id=xxx
 *   Returns: Stored threat profile
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ── Types ────────────────────────────────────────────────────────────────────
interface CorrelateRequest {
  brand_name: string;
  brand_handle: string;
  brand_domain?: string;
  scan_results?: {
    social?: Array<{
      platform: string;
      username: string;
      display_name?: string;
      bio?: string;
      risk_score: number;
      risk_level: string;
    }>;
    phone?: Array<{
      phone: string;
      risk_score: number;
      risk_level: string;
      verification?: { score: number; level: string };
    }>;
    domain?: Array<{
      domain: string;
      risk_score: number;
      risk_level: string;
      variant_type: string;
    }>;
  };
}

interface LinkedEntity {
  type: string;
  value: string;
  source: string;
  confidence: string;
  link_type: string;
}

interface ThreatProfile {
  threat_id: string;
  brand: { name: string; handle: string; domain?: string };
  scan_date: string;
  channels: Record<string, Array<Record<string, unknown>>>;
  linked_entities: LinkedEntity[];
  scammer_db_matches: Array<Record<string, unknown>>;
  risk_profile: {
    aggregate_risk_score: number;
    aggregate_risk_level: string;
    threat_type: string;
    channel_count: number;
    cross_channel_bonus: number;
    risk_scores: Record<string, { max?: number; avg?: number; count: number; weight: number }>;
    evidence: string[];
  };
  takedown_recommendations: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
  disclaimer: string;
}

// ── Identifier Extraction ────────────────────────────────────────────────────
function extractIdentifiers(text: string): { phones: string[]; domains: string[]; urls: string[]; wallets: string[]; social_handles: string[] } {
  if (!text) return { phones: [], domains: [], urls: [], wallets: [], social_handles: [] };
  
  const phones = [...new Set((text.replace(/[-() ]/g, '').match(/\+?1?\d{10,15}/g) || []))];
  const urls = [...new Set((text.match(/https?:\/\/[^\s<>"']+/g) || []))];
  const domains: string[] = [];
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const domain = parsed.hostname.replace('www.', '');
      if (domain && !domains.includes(domain)) domains.push(domain);
    } catch {}
  }
  const wallets = [...new Set((text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g) || [])
    .filter(w => w.length >= 32 && !w.startsWith('http') && !w.startsWith('@')))];
  const social_handles = [...new Set((text.match(/@([a-zA-Z0-9_]{3,30})/g) || [])
    .map(h => h.slice(1)))];
  
  return { phones, domains, urls, wallets, social_handles };
}

// ── Aggregate Risk Calculation ──────────────────────────────────────────────
function calculateAggregateRisk(
  socialResults: Array<{ risk_score: number }> | undefined,
  phoneResults: Array<{ risk_score: number; verification?: { score: number } }> | undefined,
  domainResults: Array<{ risk_score: number }> | undefined,
  scammerMatchCount: number,
  channels?: Record<string, Array<Record<string, unknown>>>
): { score: number; level: string; threatType: string; channelCount: number; crossBonus: number; riskScores: Record<string, unknown>; evidence: string[] } {
  const riskScores: Record<string, unknown> = {};
  const evidence: string[] = [];
  let channelCount = 0;
  let weightedSum = 0;
  let totalWeight = 0;

  // Social risk (weight 0.35)
  if (socialResults && socialResults.length > 0) {
    const maxRisk = Math.max(...socialResults.map(r => r.risk_score));
    const avgRisk = socialResults.reduce((s, r) => s + r.risk_score, 0) / socialResults.length;
    const normalized = maxRisk > 10 ? maxRisk / 10 : maxRisk;
    riskScores['social'] = { max: normalized, avg: avgRisk > 10 ? avgRisk / 10 : avgRisk, count: socialResults.length, weight: 0.35 };
    weightedSum += normalized * 0.35;
    totalWeight += 0.35;
    channelCount++;
    if (normalized >= 7) evidence.push(`🚨 Social: ${socialResults.length} impersonator(s) found (max risk: ${normalized.toFixed(1)}/10)`);
    else if (normalized >= 5) evidence.push(`⚠️ Social: ${socialResults.length} suspicious profile(s) found (max risk: ${normalized.toFixed(1)}/10)`);
  }

  // Phone risk (weight 0.25)
  if (phoneResults && phoneResults.length > 0) {
    const maxRisk = Math.max(...phoneResults.map(r => r.verification?.score ?? r.risk_score));
    const normalized = maxRisk > 10 ? maxRisk / 10 : maxRisk;
    riskScores['phone'] = { max: normalized, count: phoneResults.length, weight: 0.25 };
    weightedSum += normalized * 0.25;
    totalWeight += 0.25;
    channelCount++;
    if (normalized >= 7) evidence.push(`🚨 Phone: ${phoneResults.length} suspicious number(s) found (max risk: ${normalized.toFixed(1)}/10)`);
  }

  // Domain risk (weight 0.25)
  if (domainResults && domainResults.length > 0) {
    const maxRisk = Math.max(...domainResults.map(r => r.risk_score));
    const normalized = maxRisk > 10 ? maxRisk / 10 : maxRisk;
    riskScores['domain'] = { max: normalized, count: domainResults.length, weight: 0.25 };
    weightedSum += normalized * 0.25;
    totalWeight += 0.25;
    channelCount++;
    if (normalized >= 7) evidence.push(`🚨 Domain: ${domainResults.length} lookalike domain(s) found (max risk: ${normalized.toFixed(1)}/10)`);
  }

  // Scammer DB risk (weight 0.15)
  if (scammerMatchCount > 0) {
    const scammerScore = Math.min(10, scammerMatchCount * 3);
    riskScores['scammer_db'] = { count: scammerMatchCount, weight: 0.15 };
    weightedSum += scammerScore * 0.15;
    totalWeight += 0.15;
    channelCount++;
    if (scammerMatchCount >= 5) evidence.push(`🚨 Scammer DB: ${scammerMatchCount} known scam operations targeting this brand`);
    else evidence.push(`⚠️ Scammer DB: ${scammerMatchCount} known scam operation(s) targeting this brand`);
  }

  let aggregateRisk = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Cross-channel bonus
  let crossBonus = 0;
  // If no scan results were provided but we have channels with brand threats, calculate from channels
  if (totalWeight === 0 && channels && Object.keys(channels).length > 0) {
    channelCount = Object.keys(channels).length;
    // Base risk from channel presence
    for (const [ch, items] of Object.entries(channels)) {
      const maxItemRisk = Array.isArray(items) ? Math.max(...items.map((i: Record<string, unknown>) => Number(i.risk_score || 0)), 0) : 0;
      const weight = ch === 'social' ? 0.35 : ch === 'domain' ? 0.25 : ch === 'telegram' ? 0.2 : 0.15;
      const normalized = Math.min(10, maxItemRisk);
      riskScores[ch] = { max: normalized, count: Array.isArray(items) ? items.length : 0, weight };
      weightedSum += normalized * weight;
      totalWeight += weight;
    }
    aggregateRisk = totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  if (channelCount >= 3) {
    crossBonus = 2.0;
    evidence.push('🚨 CROSS-CHANNEL THREAT: Confirmed across 3+ channels — coordinated operation likely');
  } else if (channelCount >= 2) {
    crossBonus = 1.0;
    evidence.push('⚠️ Cross-channel correlation: Threats found across multiple channels');
  }
  aggregateRisk = Math.min(10, aggregateRisk + crossBonus);

  // Determine risk level
  let level: string;
  let threatType: string;
  if (aggregateRisk >= 7) { level = 'CRITICAL'; threatType = 'Coordinated multi-channel scam operation'; }
  else if (aggregateRisk >= 5) { level = 'HIGH'; threatType = 'Multi-channel brand impersonation detected'; }
  else if (aggregateRisk >= 3) { level = 'MEDIUM'; threatType = 'Some cross-channel correlation found'; }
  else if (aggregateRisk >= 1) { level = 'LOW'; threatType = 'Minor cross-channel overlap'; }
  else { level = 'MINIMAL'; threatType = 'No significant cross-channel threats detected'; }

  return { score: Math.round(aggregateRisk * 10) / 10, level, threatType, channelCount, crossBonus, riskScores, evidence };
}

// ── Takedown Recommendations ────────────────────────────────────────────────
function generateTakedowns(
  channels: Record<string, unknown>,
  linkedEntities: LinkedEntity[],
  riskLevel: string
): Array<Record<string, unknown>> {
  const recommendations: Array<Record<string, unknown>> = [];
  const priority = riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'Urgent' : 'Medium';

  const platformActions: Record<string, { action: string; url: string; evidence: string }> = {
    x: { action: 'Report for impersonation', url: 'https://help.x.com/en/forms/general/safety', evidence: 'Screenshot, risk report, impersonation evidence' },
    instagram: { action: 'Report for impersonation', url: 'https://help.instagram.com/contact/complaint_form', evidence: 'Screenshot, link to legitimate account' },
    tiktok: { action: 'Report for impersonation', url: 'https://www.tiktok.com/legal/report', evidence: 'Screenshot, legitimate brand account link' },
    facebook: { action: 'Report for impersonation', url: 'https://www.facebook.com/help/contact/361417823876055', evidence: 'Screenshot, business verification documents' },
    telegram: { action: 'Report channel for scam', url: 'https://t.me/abuse', evidence: 'Channel screenshots, scam evidence' },
    linkedin: { action: 'Report for impersonation', url: 'https://www.linkedin.com/help/linking/answer/83592', evidence: 'Screenshot, company page link' },
  };

  for (const [platform, action] of Object.entries(platformActions)) {
    const channelEntries = channels[platform] as Array<Record<string, unknown>> | undefined;
    if (channelEntries && channelEntries.length > 0) {
      for (const entry of channelEntries.slice(0, 3)) {
        recommendations.push({
          platform,
          action: action.action,
          url: action.url,
          target: entry.username || 'Unknown',
          priority,
          evidence_needed: action.evidence,
        });
      }
    }
  }

  // Domain takedowns
  const domainEntities = linkedEntities.filter(e => e.type === 'domain');
  for (const entity of domainEntities.slice(0, 3)) {
    recommendations.push({
      platform: 'domain_registrar',
      action: 'File abuse report with registrar',
      url: `https://www.whois.com/whois/${entity.value}`,
      target: entity.value,
      priority,
      evidence_needed: 'Domain registration evidence, brand trademark documentation',
    });
  }

  // Phone takedowns
  const phoneEntities = linkedEntities.filter(e => e.type === 'phone');
  for (const entity of phoneEntities.slice(0, 3)) {
    recommendations.push({
      platform: 'phone_carrier',
      action: 'Report to carrier for fraud',
      url: 'https://reportfraud.ftc.gov/',
      target: entity.value,
      priority,
      evidence_needed: 'Phone risk report, call logs, scam evidence',
    });
  }

  // Legal for high risk
  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    recommendations.push({
      platform: 'legal',
      action: 'Cease and desist letter',
      url: '',
      target: 'All identified threat actors',
      priority: 'Urgent',
      evidence_needed: 'All collected evidence, brand trademark registration, financial damages documentation',
    });
  }

  return recommendations;
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── GET: Retrieve stored threat profile ───────────────────────────────────
  if (req.method === 'GET') {
    const threatId = (req.url?.split('threat_id=')[1]?.split('&')[0]) || '';
    if (!threatId) {
      res.status(400).json({ error: 'Missing threat_id parameter' });
      return;
    }
    if (supabase) {
      const { data, error } = await supabase.from('threat_profiles').select('*').eq('threat_id', threatId).single();
      if (data && !error) { res.status(200).json(data); return; }
    }
    res.status(404).json({ error: 'Threat profile not found', threat_id: threatId });
    return;
  }

  // ── POST: Run cross-channel correlation ────────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const brandName = (body.brand_name as string) || '';
  const brandHandle = (body.brand_handle as string) || '';
  const brandDomain = (body.brand_domain as string) || '';
  const scanResults = (body.scan_results as CorrelateRequest['scan_results']) || {};

  if (!brandName || !brandHandle) {
    res.status(400).json({ error: 'brand_name and brand_handle are required' });
    return;
  }

  const threatId = `TC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // Extract identifiers from social results
  const linkedEntities: LinkedEntity[] = [];
  const channels: Record<string, Array<Record<string, unknown>>> = {};
  let scammerMatchCount = 0;

  // Process social results
  if (scanResults.social) {
    for (const result of scanResults.social) {
      const platform = result.platform;
      if (!channels[platform]) channels[platform] = [];
      channels[platform].push(result as Record<string, unknown>);

      // Extract identifiers from bio
      if (result.bio) {
        const identifiers = extractIdentifiers(result.bio);
        for (const phone of identifiers.phones) {
          linkedEntities.push({ type: 'phone', value: phone, source: `${platform}:${result.username}`, confidence: 'high', link_type: 'phone_in_bio' });
        }
        for (const domain of identifiers.domains) {
          linkedEntities.push({ type: 'domain', value: domain, source: `${platform}:${result.username}`, confidence: 'high', link_type: 'link_in_bio' });
        }
        for (const wallet of identifiers.wallets) {
          linkedEntities.push({ type: 'wallet', value: wallet, source: `${platform}:${result.username}`, confidence: 'high', link_type: 'wallet_in_bio' });
        }
      }
    }
  }

  // Query scammer DB for brand-related threats
  if (supabase) {
    try {
      const { data: scammerMatches } = await supabase
        .from('scan_events')
        .select('platform, username, risk_score, risk_level, scam_type, target')
        .or(`target.ilike.%${brandName}%,target.ilike.%${brandHandle}%`)
        .gte('risk_score', 5)
        .order('created_at', { ascending: false })
        .limit(20);

      if (scammerMatches && scammerMatches.length > 0) {
        scammerMatchCount = scammerMatches.length;
        for (const match of scammerMatches) {
          const platform = match.platform || 'unknown';
          if (!channels[platform]) channels[platform] = [];
          channels[platform].push(match as Record<string, unknown>);
          linkedEntities.push({
            type: 'scammer',
            value: match.username || match.target || 'unknown',
            source: `${platform}:scammer_db`,
            confidence: 'high',
            link_type: 'known_scammer',
          });
        }
      }
    } catch (err) {
      console.error('[Brand Guard] Scammer DB query error:', err);
    }
  }

  // Calculate aggregate risk
  const riskResult = calculateAggregateRisk(
    scanResults.social, scanResults.phone, scanResults.domain, scammerMatchCount, channels
  );

  // Generate takedowns
  const takedowns = generateTakedowns(channels, linkedEntities, riskResult.level);

  // Build threat profile
  const profile: ThreatProfile = {
    threat_id: threatId,
    brand: { name: brandName, handle: brandHandle, domain: brandDomain || undefined },
    scan_date: new Date().toISOString(),
    channels,
    linked_entities: linkedEntities,
    scammer_db_matches: [],
    risk_profile: {
      aggregate_risk_score: riskResult.score,
      aggregate_risk_level: riskResult.level,
      threat_type: riskResult.threatType,
      channel_count: riskResult.channelCount,
      cross_channel_bonus: riskResult.crossBonus,
      risk_scores: riskResult.riskScores,
      evidence: riskResult.evidence,
    },
    takedown_recommendations: takedowns,
    summary: {
      channels_with_threats: Object.keys(channels).length,
      total_linked_entities: linkedEntities.length,
      aggregate_risk_score: riskResult.score,
      aggregate_risk_level: riskResult.level,
      threat_type: riskResult.threatType,
      cross_channel_bonus: riskResult.crossBonus,
      takedown_actions: takedowns.length,
      scammer_db_matches: scammerMatchCount,
    },
    disclaimer: 'Educational purposes only. Not financial advice. Not a guarantee of safety. Always verify independently.',
  };

  // Store in Supabase
  if (supabase) {
    try {
      await supabase.from('threat_profiles').insert({
        threat_id: threatId,
        brand_name: brandName,
        brand_handle: brandHandle,
        brand_domain: brandDomain || null,
        channels: channels,
        linked_entities: linkedEntities,
        aggregate_risk: riskResult.score,
        risk_level: riskResult.level,
        result: profile,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Brand Guard] Supabase insert error:', err);
    }
  }

  res.status(200).json({
    success: true,
    result: {
      ...profile,
      // Flatten key fields for frontend compatibility
      aggregate_risk_score: profile.risk_profile.aggregate_risk_score,
      risk_level: profile.risk_profile.aggregate_risk_level,
      threat_indicators: profile.risk_profile.evidence.map((e: Record<string, unknown>, i: number) => ({
        type: e.type || 'threat',
        description: e.description || String(e),
        risk_score: e.risk_score ?? profile.risk_profile.aggregate_risk_score,
        channel: e.channel || 'unknown',
      })),
      channels_analyzed: Object.keys(profile.channels).length,
      recommendations: profile.takedown_recommendations.map((t: Record<string, unknown>) => String(t.action || t.description || t)),
    },
  });
}

export const config = {
  maxDuration: 30,
};