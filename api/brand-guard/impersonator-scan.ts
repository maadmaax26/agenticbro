/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/impersonator-scan.ts — Brand Impersonator Detection API
 * ========================================================================
 * POST /api/brand-guard/impersonator-scan
 *   Body: { brand_name: string, brand_handle: string, brand_domain?: string, platforms?: string[] }
 *   Returns: { scan_id, status, results_url }
 *
 * GET /api/brand-guard/impersonator-scan?scan_id=xxx
 *   Returns: Full scan results with impersonation scores
 *
 * Features:
 *   - Generates brand variants (typosquatting, impersonator patterns, homoglyphs)
 *   - Scans 6 platforms for each variant
 *   - Scores similarity between found profiles and the legitimate brand
 *   - Cross-references scammer database
 *   - Returns risk-scored impersonator report
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ── Types ────────────────────────────────────────────────────────────────────
interface BrandScanRequest {
  brand_name: string;
  brand_handle: string;
  brand_domain?: string;
  platforms?: string[];
  variant_limit?: number;
}

interface BrandVariant {
  variant: string;
  type: string;
  method: string;
  risk_boost: number;
}

interface ImpersonatorResult {
  username: string;
  platform: string;
  handle_similarity: number;
  name_similarity: number;
  impersonation_score: number;
  risk_level: string;
  threat_type: string;
  patterns_detected: Array<{ pattern: string; detail: string; severity: string; points: number }>;
  evidence: string[];
  takedown_actions: Array<{ platform: string; action: string; priority: string; evidence: string[] }>;
}

interface BrandScanResult {
  scan_id: string;
  scan_date: string;
  brand: {
    name: string;
    handle: string;
    domain?: string;
  };
  success?: boolean;
  total_found?: number;
  risk_level?: string;
  platforms_scanned?: string[];
  impersonators?: ImpersonatorResult[];
  scam_patterns?: { type: string; pattern: string; description: string }[];
  summary: {
    platforms_scanned: string[];
    variants_generated: number;
    profiles_scanned: number;
    impersonators_found: number;
    scammer_db_matches: number;
  };
  variants: {
    social: BrandVariant[];
    domain: BrandVariant[];
  };
  impersonator_results: ImpersonatorResult[];
  disclaimer: string;
}

// ── Brand Variant Generation ─────────────────────────────────────────────────
const IMPOSTOR_SUFFIXES = [
  'official', 'real', 'support', 'help', 'service', 'team',
  'admin', 'info', 'customer', 'care', 'security', 'alerts',
  'news', 'update', 'verified', 'authentic', 'live', 'global',
  'defi', 'crypto', 'airdrop', 'free', 'promo', 'claim',
];

const IMPOSTOR_PREFIXES = ['the', 'real', 'my', 'get', 'join', 'official', 'we'];

const HOMOGLYPHS: Record<string, string[]> = {
  a: ['4', '@'], e: ['3'], g: ['9'], i: ['1', 'l'],
  l: ['1', 'i'], o: ['0'], s: ['5', '$'], t: ['7'],
};

function generateBrandVariants(handle: string, limit: number = 30): BrandVariant[] {
  const variants: BrandVariant[] = [];
  const seen = new Set<string>();
  const handleLower = handle.toLowerCase();

  function addVariant(variant: string, type: string, method: string, riskBoost: number) {
    const v = variant.toLowerCase();
    if (v !== handleLower && !seen.has(v) && variants.length < limit) {
      seen.add(v);
      variants.push({ variant: v, type, method, risk_boost: riskBoost });
    }
  }

  // 1. Impersonator suffixes (highest risk)
  for (const suffix of IMPOSTOR_SUFFIXES.slice(0, 15)) {
    addVariant(`${handle}_${suffix}`, 'impersonator_suffix', `handle+_${suffix}`, 0.5);
    addVariant(`${handle}${suffix}`, 'impersonator_suffix', `handle+${suffix}`, 0.5);
  }

  // 2. Impersonator prefixes
  for (const prefix of IMPOSTOR_PREFIXES) {
    addVariant(`${prefix}${handle}`, 'impersonator_prefix', `${prefix}+handle`, 0.4);
    addVariant(`${prefix}_${handle}`, 'impersonator_prefix', `${prefix}_+handle`, 0.4);
  }

  // 3. Character omission (common typo)
  for (let i = 0; i < Math.min(handle.length, 8); i++) {
    addVariant(handle.slice(0, i) + handle.slice(i + 1), 'typo', `omit_pos${i}`, 0.2);
  }

  // 4. Homoglyph substitution
  for (let i = 0; i < Math.min(handle.length, 8); i++) {
    const char = handle[i].toLowerCase();
    if (HOMOGLYPHS[char]) {
      for (const replacement of HOMOGLYPHS[char]) {
        addVariant(handle.slice(0, i) + replacement + handle.slice(i + 1), 'homoglyph', `homo_${char}->${replacement}`, 0.4);
      }
    }
  }

  // Sort by risk (highest first)
  variants.sort((a, b) => b.risk_boost - a.risk_boost);
  return variants.slice(0, limit);
}

// ── Similarity Scoring ───────────────────────────────────────────────────────
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function similarityScore(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  const maxLen = Math.max(a.length, b.length);
  return 1.0 - levenshteinDistance(a, b) / maxLen;
}

// ── Impersonation Pattern Detection ─────────────────────────────────────────
const IMPOSTOR_KEYWORDS = [
  'official', 'real', 'verified', 'support', 'help', 'service',
  'admin', 'team', 'security', 'giveaway', 'airdrop', 'claim',
  'free', 'dm me', 'pm me', 'invest', 'wallet', 'send',
];

function detectImpersonationPatterns(
  username: string, display_name: string, bio: string, brand_handle: string
): Array<{ pattern: string; detail: string; severity: string; points: number }> {
  const patterns: Array<{ pattern: string; detail: string; severity: string; points: number }> = [];
  const u = username.toLowerCase();
  const b = (bio || '').toLowerCase();
  const brand = brand_handle.toLowerCase();

  // Support/admin suffix pattern
  for (const suffix of ['support', 'admin', 'help', 'service', 'official', 'real', 'team', 'care', 'security', 'info']) {
    if (u.endsWith(suffix) && brand && u.includes(brand)) {
      patterns.push({
        pattern: 'support_suffix',
        detail: `Username '${username}' ends with '${suffix}' after brand name`,
        severity: 'high',
        points: 8,
      });
      break;
    }
  }

  // Impersonation prefix pattern
  for (const prefix of ['the', 'real', 'official', 'my', 'get']) {
    if (u.startsWith(prefix) && brand && u.includes(brand)) {
      patterns.push({
        pattern: 'impersonation_prefix',
        detail: `Username '${username}' starts with '${prefix}' before brand name`,
        severity: 'medium',
        points: 5,
      });
      break;
    }
  }

  // Impersonation keywords in bio
  for (const keyword of IMPOSTOR_KEYWORDS) {
    if (b.includes(keyword) && brand && b.includes(brand)) {
      const severity = ['giveaway', 'airdrop', 'claim', 'free', 'dm me'].includes(keyword) ? 'high' : 'medium';
      patterns.push({
        pattern: 'impersonation_keyword_in_bio',
        detail: `Bio contains '${keyword}' alongside brand reference`,
        severity,
        points: severity === 'high' ? 7 : 4,
      });
      break;
    }
  }

  return patterns;
}

// ── Score a discovered profile ───────────────────────────────────────────────
function scoreImpersonation(
  brand_name: string, brand_handle: string, brand_domain: string | undefined,
  profile: { username: string; display_name?: string; bio?: string; followers?: number; verified?: boolean; platform: string },
  scammerDbMatch: boolean
): ImpersonatorResult {
  const handleSim = similarityScore(profile.username, brand_handle);
  const nameSim = profile.display_name ? similarityScore(profile.display_name, brand_name) : 0;
  const patterns = detectImpersonationPatterns(profile.username, profile.display_name || '', profile.bio || '', brand_handle);

  let score = 0;
  const evidence: string[] = [];

  // Handle similarity (0-40)
  if (handleSim >= 0.9) { score += 40; evidence.push(`Very similar handle: @${profile.username} vs @${brand_handle} (${(handleSim * 100).toFixed(0)}% match)`); }
  else if (handleSim >= 0.7) { score += 30; evidence.push(`Similar handle: @${profile.username} vs @${brand_handle} (${(handleSim * 100).toFixed(0)}% match)`); }
  else if (handleSim >= 0.5) { score += 15; evidence.push(`Somewhat similar handle: @${profile.username} vs @${brand_handle} (${(handleSim * 100).toFixed(0)}% match)`); }
  else if (handleSim >= 0.3) { score += 5; evidence.push(`Slightly similar handle: @${profile.username} vs @${brand_handle} (${(handleSim * 100).toFixed(0)}% match)`); }

  // Display name similarity (0-20)
  if (nameSim >= 0.8) { score += 20; evidence.push(`Very similar display name: '${profile.display_name}' vs '${brand_name}'`); }
  else if (nameSim >= 0.5) { score += 10; evidence.push(`Similar display name: '${profile.display_name}' vs '${brand_name}'`); }

  // Pattern points (0-30 max)
  const patternPoints = patterns.reduce((sum, p) => sum + p.points, 0);
  score += Math.min(patternPoints, 30);
  patterns.forEach(p => evidence.push(`[${p.severity.toUpperCase()}] ${p.detail}`));

  // Unverified brand-like (0-10)
  if (!profile.verified && (handleSim >= 0.5 || nameSim >= 0.5)) {
    score += 10;
    evidence.push('Unverified account using brand-like name');
  }

  // Low followers for brand (0-10)
  if (profile.followers && profile.followers < 100 && handleSim >= 0.5) {
    score += 10;
    evidence.push(`Low followers (${profile.followers}) for brand-like account`);
  }

  // Scammer DB match (0-20)
  if (scammerDbMatch) { score += 20; evidence.push('Match found in scammer database'); }

  score = Math.min(score, 100);

  let riskLevel: string, threatType: string;
  if (score >= 70) { riskLevel = 'CRITICAL'; threatType = 'Likely brand impersonation'; }
  else if (score >= 45) { riskLevel = 'HIGH'; threatType = 'Probable brand impersonation'; }
  else if (score >= 25) { riskLevel = 'MEDIUM'; threatType = 'Possible brand impersonation'; }
  else if (score >= 10) { riskLevel = 'LOW'; threatType = 'Unlikely brand impersonation'; }
  else { riskLevel = 'MINIMAL'; threatType = 'No significant impersonation risk'; }

  const takedownActions: ImpersonatorResult['takedown_actions'] = [];
  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    takedownActions.push({
      platform: profile.platform,
      action: 'Report for impersonation',
      priority: 'Urgent',
      evidence: [`Handle similarity: ${(handleSim * 100).toFixed(0)}%`, `Patterns: ${patterns.length}`],
    });
  }

  return {
    username: profile.username,
    platform: profile.platform,
    handle_similarity: Math.round(handleSim * 1000) / 1000,
    name_similarity: Math.round(nameSim * 1000) / 1000,
    impersonation_score: Math.round(score * 10) / 10,
    risk_level: riskLevel,
    threat_type: threatType,
    patterns_detected: patterns,
    evidence,
    takedown_actions: takedownActions,
  };
}

// ── Main Handler ──────────────────────────────────────────────────────────────
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

  // ── GET: Retrieve scan results ───────────────────────────────────────────
  if (req.method === 'GET') {
    const scanId = (req.url?.split('scan_id=')[1]?.split('&')[0]) || '';
    if (!scanId) {
      res.status(400).json({ error: 'Missing scan_id parameter' });
      return;
    }

    // Check Supabase for stored results
    if (supabase) {
      const { data, error } = await supabase
        .from('brand_guard_scans')
        .select('*')
        .eq('scan_id', scanId)
        .single();

      if (data && !error) {
        res.status(200).json(data);
        return;
      }
    }

    res.status(404).json({ error: 'Scan not found', scan_id: scanId });
    return;
  }

  // ── POST: Start brand impersonator scan ──────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // ── Auth + Credit Check ────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  let userId: string | null = null;

  if (authToken && supabase) {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authToken);
    if (!authErr && user) userId = user.id;
  }

  // If authenticated, verify credits exist before allowing scan
  // (Frontend handles the actual deduction via /credits/deduct before calling this API)
  if (userId && supabase) {
    const { data: credits, error: creditErr } = await supabase
      .from('brand_guard_credits')
      .select('free_credits_total, free_credits_used, paid_credits')
      .eq('owner_id', userId)
      .single();

    if (creditErr && creditErr.code !== 'PGRST116') {
      res.status(500).json({ error: 'Failed to check credits', details: creditErr.message });
      return;
    }

    const freeRemaining = credits ? credits.free_credits_total - credits.free_credits_used : 25;
    const totalRemaining = credits ? freeRemaining + credits.paid_credits : 10;

    if (totalRemaining <= 0) {
      res.status(402).json({
        error: 'Insufficient credits',
        message: 'No credits available. Purchase credits or set up a subscription to continue scanning.',
        remaining: 0,
        upgrade_url: '/brand-guard?buy_credits=true',
      });
      return;
    }
  }
  // Unauthenticated users: allow scan but do not deduct (for now, could gate later)

  const body = req.body || (typeof req === 'object' ? {} : {});
  const brandName = (body.brand_name as string) || '';
  const brandHandle = (body.brand_handle as string) || '';
  const brandDomain = (body.brand_domain as string) || '';
  const platforms = (body.platforms as string[]) || ['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin'];
  const variantLimit = (body.variant_limit as number) || 30;

  if (!brandName || !brandHandle) {
    res.status(400).json({ error: 'brand_name and brand_handle are required' });
    return;
  }

  // ── Queue-based scan: create pending job, local worker processes it ─────────
  // Generate scan ID
  const scanId = `bg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // Determine scan type from request
  const scanType = (body.scan_type as string) || 'impersonator';

  // Generate quick variants for immediate preview (theoretical, for UX feedback)
  const socialVariants = generateBrandVariants(brandHandle, variantLimit);
  const previewImpersonators = socialVariants.map((v, idx) => ({
    handle: v.variant,
    platform: platforms[idx % platforms.length],
    risk_score: Math.round((0.3 + v.risk_boost) * 10),
    risk_level: v.risk_boost >= 0.5 ? 'HIGH' : v.risk_boost >= 0.3 ? 'MEDIUM' : 'LOW',
    type: v.type,
    method: v.method,
    status: 'potential',
  }));

  // Build initial preview result (theoretical variants, not real scans)
  const previewResult: BrandScanResult = {
    scan_id: scanId,
    scan_date: new Date().toISOString(),
    brand: {
      name: brandName,
      handle: brandHandle,
      domain: brandDomain || undefined,
    },
    success: true,
    total_found: previewImpersonators.length,
    risk_level: previewImpersonators.some(p => p.risk_level === 'HIGH') ? 'HIGH' : previewImpersonators.some(p => p.risk_level === 'MEDIUM') ? 'MEDIUM' : 'LOW',
    platforms_scanned: platforms,
    impersonators: previewImpersonators,
    scam_patterns: socialVariants.filter(v => v.risk_boost >= 0.5).map(v => ({
      type: v.type,
      pattern: v.variant,
      description: `Potential impersonator: ${v.variant} (${v.method})`,
    })),
    variants: {
      social: socialVariants,
      domain: [],
    },
    summary: {
      platforms_scanned: platforms,
      variants_generated: socialVariants.length,
      profiles_scanned: 0, // Will be updated by worker with real data
      impersonators_found: previewImpersonators.length,
      scammer_db_matches: 0,
    },
    impersonator_results: previewImpersonators,
    disclaimer: 'Educational purposes only. Not financial advice. Not a guarantee of safety. Always verify independently.',
    real_scan_pending: true, // Flag: real platform scans are pending
  };

  // Store as pending job in Supabase — local worker will pick it up
  if (supabase) {
    try {
      await supabase.from('brand_guard_scans').insert({
        scan_id: scanId,
        brand_monitor_id: (body.brand_monitor_id as string) || null,
        brand_name: brandName,
        brand_handle: brandHandle,
        brand_domain: brandDomain || null,
        status: 'processing', // Worker will change to 'complete' when done
        platforms: platforms,
        variants_generated: socialVariants.length,
        profiles_scanned: 0,
        impersonators_found: 0,
        scammer_db_matches: 0,
        created_at: new Date().toISOString(),
        result: {
          ...previewResult,
          scan_type: scanType,
          real_scan_pending: true, // Tell frontend to poll for real results
        },
      });
    } catch (err) {
      console.error('[Brand Guard] Supabase insert error:', err);
    }
  }

  // Return preview results immediately + scan_id for polling
  res.status(200).json({
    success: true,
    ...previewResult,
    real_scan_pending: true, // Frontend should poll for updated results
    poll_interval: 10, // seconds between polls
  });
}