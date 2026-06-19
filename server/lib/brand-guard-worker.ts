/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 *
 * server/lib/brand-guard-worker.ts
 * =================================
 * Background worker that processes brand_guard_scans with status='processing'.
 *
 * Flow:
 *   1. Poll Supabase every POLL_INTERVAL_MS for processing scans older than 30s
 *   2. For each scan: extract stored variants from preview result
 *   3. Run real X checks via CDP and local wrapper scans for other platforms
 *   4. Score each found profile using impersonation scoring
 *   5. Cross-reference scammer DB
 *   6. Insert real impersonators into brand_impersonators table
 *   7. Update brand_guard_scans with real results + status='complete'
 *
 * Runs as a singleton polling loop started once on server boot.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { scanVariantsOnX, type XProfile } from './x-impersonator-scanner.js';
import {
  scanVariantsLocally,
  type LocalSocialPlatform,
  type PlatformScanSummary,
} from './local-social-scanner.js';

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;       // how often to poll for new jobs
const CLAIM_DELAY_SECONDS = 30;        // only pick up scans older than this (preview was already returned)
const MAX_VARIANTS_PER_SCAN = 20;      // top N variants to actually check on X
const MIN_SCORE_TO_REPORT = 15;        // only include impersonators scoring above this

type ScannableProfile = Pick<XProfile,
  'username' | 'displayName' | 'followers' | 'verified' | 'bio' | 'profileUrl'
> & {
  platform: 'x' | LocalSocialPlatform;
  scannerRiskScore?: number;
  scannerRiskLevel?: string;
  scannerEvidence?: string[];
};

// ── Scoring (mirrors api/brand-guard/impersonator-scan.ts) ───────────────────

function levenshtein(a: string, b: string): number {
  const m: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b[i - 1] === a[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}

function similarity(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  return 1.0 - levenshtein(a, b) / Math.max(a.length, b.length);
}

const SUPPORT_SUFFIXES = ['support', 'admin', 'help', 'service', 'official', 'real', 'team', 'care', 'security', 'info'];
const SCAM_KEYWORDS = ['giveaway', 'airdrop', 'claim', 'free', 'dm me', 'pm me', 'invest', 'wallet', 'send', 'profit'];

interface ScoreResult {
  impersonation_score: number;
  risk_level: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threat_type: string;
  handle_similarity: number;
  name_similarity: number;
  patterns_detected: Array<{ pattern: string; detail: string; severity: string; points: number }>;
  evidence: string[];
  takedown_recommended: boolean;
}

function scoreImpersonation(
  profile: ScannableProfile,
  brandHandle: string,
  brandName: string,
  isScammerDbMatch: boolean
): ScoreResult {
  const u = profile.username.toLowerCase();
  const brand = brandHandle.toLowerCase();
  const bio = (profile.bio || '').toLowerCase();

  const handleSim = similarity(u, brand);
  const nameSim = profile.displayName ? similarity(profile.displayName, brandName) : 0;

  const patterns: ScoreResult['patterns_detected'] = [];
  const evidence: string[] = [];
  let score = 0;

  // Handle similarity (0–40 pts)
  if (handleSim >= 0.9) { score += 40; evidence.push(`Near-identical handle: @${profile.username} vs @${brandHandle} (${Math.round(handleSim * 100)}%)`); }
  else if (handleSim >= 0.7) { score += 30; evidence.push(`Very similar handle: @${profile.username} vs @${brandHandle} (${Math.round(handleSim * 100)}%)`); }
  else if (handleSim >= 0.5) { score += 15; evidence.push(`Similar handle: @${profile.username} vs @${brandHandle} (${Math.round(handleSim * 100)}%)`); }
  else if (handleSim >= 0.3) { score += 5; evidence.push(`Slightly similar handle: @${profile.username} vs @${brandHandle} (${Math.round(handleSim * 100)}%)`); }

  // Display name similarity (0–20 pts)
  if (nameSim >= 0.8) { score += 20; evidence.push(`Near-identical display name: "${profile.displayName}" vs "${brandName}"`); }
  else if (nameSim >= 0.5) { score += 10; evidence.push(`Similar display name: "${profile.displayName}" vs "${brandName}"`); }

  // Support/admin suffix pattern
  for (const suffix of SUPPORT_SUFFIXES) {
    if (u.endsWith(suffix) && u.includes(brand)) {
      patterns.push({ pattern: 'support_suffix', detail: `@${profile.username} ends with '${suffix}' after brand name`, severity: 'high', points: 8 });
      score += 8;
      break;
    }
  }

  // Impersonation prefix
  for (const prefix of ['the', 'real', 'official', 'my', 'get']) {
    if (u.startsWith(prefix) && u.includes(brand)) {
      patterns.push({ pattern: 'impersonation_prefix', detail: `@${profile.username} starts with '${prefix}' before brand name`, severity: 'medium', points: 5 });
      score += 5;
      break;
    }
  }

  // Scam keywords in bio
  for (const kw of SCAM_KEYWORDS) {
    if (bio.includes(kw) && bio.includes(brand)) {
      const sev = ['giveaway', 'airdrop', 'claim'].includes(kw) ? 'high' : 'medium';
      patterns.push({ pattern: 'scam_keyword_in_bio', detail: `Bio contains '${kw}' with brand reference`, severity: sev, points: sev === 'high' ? 7 : 4 });
      score += sev === 'high' ? 7 : 4;
      break;
    }
  }

  // Unverified but brand-like (up to 10 pts)
  if (!profile.verified && (handleSim >= 0.5 || nameSim >= 0.5)) {
    score += 10;
    evidence.push('Unverified account using brand-like name/handle');
  }

  // Low follower count (suspicious for impersonators) (up to 10 pts)
  if (profile.followers < 200 && handleSim >= 0.5) {
    score += 10;
    evidence.push(`Very low follower count (${profile.followers}) for brand-like account`);
  } else if (profile.followers < 1000 && handleSim >= 0.6) {
    score += 5;
    evidence.push(`Low follower count (${profile.followers}) for brand-like account`);
  }

  // Scammer DB match (0–20 pts)
  if (isScammerDbMatch) {
    score += 20;
    evidence.push('Username matches known scammer database entry');
  }

  score = Math.min(score, 100);
  patterns.forEach(p => evidence.push(`[${p.severity.toUpperCase()}] ${p.detail}`));

  let risk_level: ScoreResult['risk_level'];
  let threat_type: string;

  if (score >= 70)      { risk_level = 'CRITICAL'; threat_type = 'Confirmed brand impersonation'; }
  else if (score >= 45) { risk_level = 'HIGH';     threat_type = 'Probable brand impersonation'; }
  else if (score >= 25) { risk_level = 'MEDIUM';   threat_type = 'Possible brand impersonation'; }
  else if (score >= 10) { risk_level = 'LOW';      threat_type = 'Unlikely brand impersonation'; }
  else                  { risk_level = 'MINIMAL';  threat_type = 'No significant impersonation risk'; }

  return {
    impersonation_score: Math.round(score * 10) / 10,
    risk_level,
    threat_type,
    handle_similarity: Math.round(handleSim * 1000) / 1000,
    name_similarity: Math.round(nameSim * 1000) / 1000,
    patterns_detected: patterns,
    evidence,
    takedown_recommended: risk_level === 'CRITICAL' || risk_level === 'HIGH',
  };
}

// ── Job Processor ─────────────────────────────────────────────────────────────

interface PendingScan {
  id: string;
  scan_id: string;
  brand_monitor_id: string | null;
  brand_name: string;
  brand_handle: string;
  brand_domain: string | null;
  platforms: string[];
  result: {
    variants?: { social?: Array<{ variant: string; risk_boost: number; type: string }> };
    [key: string]: unknown;
  } | null;
}

async function processOneScan(scan: PendingScan, supabase: SupabaseClient): Promise<void> {
  const { id, scan_id, brand_name, brand_handle, brand_domain, brand_monitor_id } = scan;
  console.log(`[BG Worker] Processing scan ${scan_id} for brand @${brand_handle}`);

  // ── Step 1: Extract stored variants from the preview result ──────────────
  const storedVariants = (scan.result?.variants?.social || []) as Array<{
    variant: string;
    risk_boost: number;
    type: string;
  }>;

  if (!storedVariants.length) {
    console.warn(`[BG Worker] No variants found in scan ${scan_id}, marking failed`);
    await supabase.from('brand_guard_scans').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      result: { ...scan.result, error: 'No variants to scan', real_scan: false },
    }).eq('scan_id', scan_id);
    return;
  }

  // Only check the highest-risk variants (sort by risk_boost descending, skip pure typos)
  const prioritized = storedVariants
    .filter(v => v.risk_boost >= 0.3)          // skip low-risk typos
    .sort((a, b) => b.risk_boost - a.risk_boost)
    .slice(0, MAX_VARIANTS_PER_SCAN)
    .map(v => v.variant);

  const normalizedPlatforms = Array.from(new Set((scan.platforms?.length ? scan.platforms : ['x'])
    .map(platform => platform.toLowerCase() === 'twitter' ? 'x' : platform.toLowerCase())
    .filter(platform => ['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin'].includes(platform))));
  const requestedPlatforms = normalizedPlatforms.length ? normalizedPlatforms : ['x'];
  console.log(`[BG Worker] Checking ${prioritized.length} variants across ${requestedPlatforms.join(', ')}`);

  // ── Step 2: Run platform scanners ────────────────────────────────────────
  const platformSummaries: Array<PlatformScanSummary | {
    platform: 'x'; checked: number; found: ScannableProfile[]; inaccessible: number; errors: number;
  }> = await Promise.all(requestedPlatforms.map(async platform => {
    if (platform === 'x') {
      const profiles = await scanVariantsOnX(prioritized, {
        maxVariants: MAX_VARIANTS_PER_SCAN,
        rateDelayMs: 2500,
      });
      return {
        platform: 'x' as const,
        checked: Math.min(prioritized.length, MAX_VARIANTS_PER_SCAN),
        found: profiles.map(profile => ({ ...profile, platform: 'x' as const })),
        inaccessible: 0,
        errors: 0,
      };
    }

    return scanVariantsLocally(platform as LocalSocialPlatform, prioritized, {
      maxVariants: Number(process.env.BRAND_GUARD_LOCAL_VARIANTS || 5),
      concurrency: Number(process.env.BRAND_GUARD_LOCAL_CONCURRENCY || 2),
      timeoutMs: Number(process.env.BRAND_GUARD_SCANNER_TIMEOUT_MS || 45_000),
    });
  }));

  const foundProfiles: ScannableProfile[] = platformSummaries.flatMap(summary =>
    summary.found.map(profile => 'rawStatus' in profile
      ? {
          username: profile.username,
          displayName: profile.displayName,
          followers: profile.followers,
          verified: profile.verified,
          bio: profile.bio,
          profileUrl: profile.profileUrl,
          platform: profile.platform,
          scannerRiskScore: profile.scannerRiskScore,
          scannerRiskLevel: profile.scannerRiskLevel,
          scannerEvidence: profile.evidence,
        }
      : profile)
  );

  // ── Step 3: Cross-reference scammer DB ──────────────────────────────────
  const scammerHandles = new Set<string>();
  if (foundProfiles.length > 0) {
    const usernames = foundProfiles.map(p => p.username);
    const { data: scammerMatches } = await supabase
      .from('known_scammers')
      .select('username')
      .in('username', usernames);
    (scammerMatches || []).forEach((r: { username: string }) => scammerHandles.add(r.username.toLowerCase()));
  }

  // ── Step 4: Score each found profile ────────────────────────────────────
  const scoredImpersonators = foundProfiles
    .map(profile => {
      const isDbMatch = scammerHandles.has(profile.username.toLowerCase());
      const score = scoreImpersonation(profile, brand_handle, brand_name, isDbMatch);
      const combinedScore = Math.min(100, score.impersonation_score + (profile.scannerRiskScore || 0) * 2);
      const risk_level: ScoreResult['risk_level'] = combinedScore >= 70 ? 'CRITICAL'
        : combinedScore >= 45 ? 'HIGH'
        : combinedScore >= 25 ? 'MEDIUM'
        : combinedScore >= 10 ? 'LOW'
        : 'MINIMAL';
      return {
        ...profile,
        ...score,
        impersonation_score: combinedScore,
        risk_level,
        threat_type: risk_level === 'CRITICAL' ? 'Confirmed brand impersonation'
          : risk_level === 'HIGH' ? 'Probable brand impersonation'
          : risk_level === 'MEDIUM' ? 'Possible brand impersonation'
          : 'Unlikely brand impersonation',
        takedown_recommended: risk_level === 'CRITICAL' || risk_level === 'HIGH',
        evidence: [...score.evidence, ...(profile.scannerEvidence || [])].slice(0, 20),
        scammer_db_match: isDbMatch,
      };
    })
    .filter(r => r.impersonation_score >= MIN_SCORE_TO_REPORT)
    .sort((a, b) => b.impersonation_score - a.impersonation_score);

  console.log(`[BG Worker] Found ${scoredImpersonators.length} real impersonators (score ≥ ${MIN_SCORE_TO_REPORT}) for @${brand_handle}`);

  // ── Step 5: Insert real impersonators into brand_impersonators table ─────
  if (scoredImpersonators.length > 0) {
    const impersonatorRows = scoredImpersonators.map(imp => ({
      scan_id: id,                            // FK to brand_guard_scans.id (UUID)
      brand_monitor_id,
      platform: imp.platform,
      username: imp.username,
      display_name: imp.displayName,
      bio: imp.bio,
      handle_similarity: imp.handle_similarity,
      name_similarity: imp.name_similarity,
      impersonation_score: imp.impersonation_score,
      risk_level: imp.risk_level,
      threat_type: imp.threat_type,
      patterns_detected: imp.patterns_detected,
      evidence: imp.evidence,
      scammer_db_match: imp.scammer_db_match,
      profile_url: imp.profileUrl,
      followers: imp.followers,
      verified: imp.verified,
      takedown_status: 'pending',
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await supabase
      .from('brand_impersonators')
      .upsert(impersonatorRows, { onConflict: 'username,platform' })
      .select();

    if (insertErr) {
      console.error(`[BG Worker] Failed to insert impersonators:`, insertErr.message);
    }
  }

  // ── Step 6: Build the final result and update the scan record ────────────
  const criticalCount = scoredImpersonators.filter(i => i.risk_level === 'CRITICAL').length;
  const highCount = scoredImpersonators.filter(i => i.risk_level === 'HIGH').length;

  const overallRisk =
    criticalCount > 0 ? 'CRITICAL' :
    highCount > 0 ? 'HIGH' :
    scoredImpersonators.some(i => i.risk_level === 'MEDIUM') ? 'MEDIUM' :
    scoredImpersonators.length > 0 ? 'LOW' : 'CLEAN';

  const finalResult = {
    ...(scan.result || {}),
    real_scan: true,
    real_scan_pending: false,
    scan_completed_at: new Date().toISOString(),
    scan_source: 'local_multi_platform',

    // Override preview data with real data
    total_found: scoredImpersonators.length,
    risk_level: overallRisk,
    profiles_scanned: foundProfiles.length,
    impersonators: scoredImpersonators.map(imp => ({
      username: imp.username,
      display_name: imp.displayName,
      platform: imp.platform,
      followers: imp.followers,
      verified: imp.verified,
      bio: imp.bio,
      profile_url: imp.profileUrl,
      handle_similarity: imp.handle_similarity,
      name_similarity: imp.name_similarity,
      impersonation_score: imp.impersonation_score,
      risk_level: imp.risk_level,
      threat_type: imp.threat_type,
      patterns_detected: imp.patterns_detected,
      evidence: imp.evidence,
      scammer_db_match: imp.scammer_db_match,
      takedown_recommended: imp.takedown_recommended,
    })),
    summary: {
      platforms_scanned: requestedPlatforms,
      variants_checked: platformSummaries.reduce((sum, platform) => sum + platform.checked, 0),
      profiles_found: foundProfiles.length,
      impersonators_found: scoredImpersonators.length,
      critical: criticalCount,
      high: highCount,
      medium: scoredImpersonators.filter(i => i.risk_level === 'MEDIUM').length,
      low: scoredImpersonators.filter(i => i.risk_level === 'LOW').length,
      scammer_db_matches: scoredImpersonators.filter(i => i.scammer_db_match).length,
      platform_status: platformSummaries.map(platform => ({
        platform: platform.platform,
        checked: platform.checked,
        found: platform.found.length,
        inaccessible: platform.inaccessible,
        errors: platform.errors,
      })),
    },
  };

  const { error: updateErr } = await supabase
    .from('brand_guard_scans')
    .update({
      status: 'complete',
      profiles_scanned: foundProfiles.length,
      impersonators_found: scoredImpersonators.length,
      scammer_db_matches: scoredImpersonators.filter(i => i.scammer_db_match).length,
      completed_at: new Date().toISOString(),
      result: finalResult,
    })
    .eq('scan_id', scan_id);

  if (updateErr) {
    console.error(`[BG Worker] Failed to update scan ${scan_id}:`, updateErr.message);
  } else {
    console.log(`[BG Worker] ✓ Scan ${scan_id} complete — ${scoredImpersonators.length} real impersonators found across ${requestedPlatforms.join(', ')}`);
  }
}

// ── Main Worker Loop ──────────────────────────────────────────────────────────

let isRunning = false;

async function pollAndProcess(supabase: SupabaseClient): Promise<void> {
  if (isRunning) {
    console.log('[BG Worker] Still processing previous scan, skipping poll');
    return;
  }

  try {
    // Fetch the oldest processing scan that's been waiting at least CLAIM_DELAY_SECONDS
    // (giving the Vercel API time to return the preview to the client)
    const claimBefore = new Date(Date.now() - CLAIM_DELAY_SECONDS * 1000).toISOString();

    const { data: scans, error } = await supabase
      .from('brand_guard_scans')
      .select('id, scan_id, brand_monitor_id, brand_name, brand_handle, brand_domain, platforms, result')
      .eq('status', 'processing')
      .lt('created_at', claimBefore)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error('[BG Worker] Poll error:', error.message);
      return;
    }

    if (!scans || scans.length === 0) return;

    const scan = scans[0] as PendingScan;
    isRunning = true;

    try {
      await processOneScan(scan, supabase);
    } finally {
      isRunning = false;
    }

  } catch (err) {
    console.error('[BG Worker] Unexpected error in poll:', err);
    isRunning = false;
  }
}

/**
 * Start the Brand Guard background worker.
 * Call once on server boot — it runs indefinitely until process exit.
 */
export function startBrandGuardWorker(supabase: SupabaseClient): void {
  console.log(`[BG Worker] Brand Guard worker starting — polling every ${POLL_INTERVAL_MS / 1000}s`);

  // Initial poll after a short delay
  setTimeout(() => pollAndProcess(supabase), 5000);

  // Recurring poll
  setInterval(() => pollAndProcess(supabase), POLL_INTERVAL_MS);
}
