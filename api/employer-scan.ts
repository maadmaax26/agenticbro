/**
 * api/employer-scan.ts — Vercel Serverless Function
 * ================================================================
 * Employer Trust Score API endpoint
 * 
 * POST /api/employer-scan          → Run employer trust scan
 * GET  /api/employer-scan?handle=x → Get cached/recent scan for employer
 * POST /api/employer-scan/report   → Submit a community report
 * GET  /api/employer-scan/reports  → Get reports for an employer
 * 
 * Scoring logic inlined for Vercel compatibility.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Supabase ────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// ── Types ───────────────────────────────────────────────────────────────────
type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string; query?: Record<string, string> };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

interface EmployerScanRequest {
  handle: string;
  platform?: string;
  text?: string;
  account_age_days?: number;
  followers?: number;
  website_domain?: string;
  website_age_days?: number;
  wallet_address?: string;
  has_public_founders?: boolean;
  has_payment_history?: boolean;
  contact_verified?: boolean;
  username_changes?: number;
  hiring_post_count?: number;
}

interface EmployerReportRequest {
  employer_handle: string;
  employer_platform?: string;
  report_type: string;
  reporter_handle?: string;
  reporter_role?: string;
  role_applied_for?: string;
  amount_owed?: string;
  description?: string;
  evidence_links?: string[];
  project_name?: string;
  employer_website?: string;
  employer_wallet?: string;
  contract_address?: string;
  incident_date?: string;
}

// ── Employer Red Flags ──────────────────────────────────────────────────────
const EMPLOYER_RED_FLAGS: Record<string, { weight: number; description: string }> = {
  anonymous_founder: { weight: 10, description: 'No verifiable identity linked to the employer/project' },
  new_domain: { weight: 10, description: 'Website domain is less than 90 days old' },
  no_payment_history: { weight: 10, description: 'Wallet shows no history of paying contributors' },
  account_rebrand: { weight: 10, description: 'Recent username or display name changes detected' },
  hiring_spam: { weight: 10, description: 'Repeated hiring posts across multiple accounts' },
  prior_rug_pull: { weight: 15, description: 'Project or founder has history of rug pulls or abandoned projects' },
  community_nonpayment_reports: { weight: 15, description: 'Community reports of non-payment to contractors' },
  no_public_founders: { weight: 5, description: 'Founders are not publicly identified' },
  unverified_contact: { weight: 5, description: 'Phone and email not verified' },
};

const EMPLOYER_TRUST_SIGNALS: Record<string, { weight: number; description: string }> = {
  positive_payment_history: { weight: -15, description: 'Wallet shows regular payments to multiple contributors' },
  established_domain: { weight: -10, description: 'Website domain is older than 2 years' },
  public_founders: { weight: -10, description: 'Founders have verifiable public identity' },
  positive_contractor_reviews: { weight: -10, description: 'Community vouches for payment reliability' },
};

const EMPLOYER_TRUST_THRESHOLDS = {
  HIGHLY_TRUSTED: 1.5,
  TRUSTED: 3.0,
  MODERATE: 5.0,
  HIGH_RISK: 7.0,
};

// ── Standard profile scam detection (inline for Vercel) ─────────────────────
const RED_FLAGS: Record<string, { weight: number; patterns: string[]; description: string }> = {
  guaranteed_returns: { weight: 25, patterns: ['guaranteed', 'guarantee', 'sure thing', '100% profit', '100x', '1000x', 'risk-free', 'no risk', 'certain profit'], description: 'Claims of guaranteed profits or unrealistic returns' },
  giveaway_airdrop: { weight: 20, patterns: ['giveaway', 'airdrop', 'free crypto', 'free bitcoin', 'free ethereum', 'free solana', 'claim free', 'free money', 'free tokens', 'free nft'], description: 'Free crypto giveaways or airdrops' },
  dm_solicitation: { weight: 15, patterns: ['dm for', 'dm me', 'message me', 'contact me', 'dm for more', 'dm for info', 'dm for alpha', 'check dm', 'sent dm'], description: 'Requests to DM for more information' },
  free_crypto: { weight: 15, patterns: ['free', 'no cost', 'zero investment', 'no investment', 'free money', 'free cash', 'free profit'], description: 'Free money or crypto without clear source' },
  alpha_dm_scheme: { weight: 15, patterns: ['alpha', 'private alpha', 'exclusive access', 'vip', 'premium access', 'exclusive', 'vip group', 'premium group', 'private group', 'exclusive signals'], description: 'Gatekeeping information behind DM/VIP' },
  unrealistic_claims: { weight: 10, patterns: ['24h', 'overnight', 'instant', 'fast profits', 'quick profits', 'instant wealth', 'overnight wealth', 'fast money', 'quick money'], description: 'Unrealistic timeframes for profits' },
  download_install: { weight: 10, patterns: ['.exe', '.apk', '.zip', '.dmg', 'download', 'install app', 'install software', 'download app', 'install wallet', 'download wallet'], description: 'Requests to download files or install apps' },
  urgency_tactics: { weight: 10, patterns: ['act now', 'limited time', 'last chance', 'ending soon', 'only few spots', 'limited spots', 'hurry', "don't wait", 'time limited', 'expires soon'], description: 'Urgency to create FOMO' },
  emotional_manipulation: { weight: 10, patterns: ['family', 'emergency', 'sick', 'hospital', 'desperate', 'need help', 'please help', 'charity', 'donate', 'family need', 'sick family', 'hospital bills'], description: 'Emotional pleas for help' },
  low_credibility: { weight: 10, patterns: ['new account', 'low followers', 'no track record', 'no history', 'just started', 'new to crypto', 'beginner', 'no experience'], description: 'Low credibility indicators' },
};

function calculateProfileRisk(text: string): { weight: number; flags: { name: string; weight: number; description: string }[] } {
  const textLower = text.toLowerCase();
  let totalWeight = 0;
  const flags: { name: string; weight: number; description: string }[] = [];

  for (const [name, flag] of Object.entries(RED_FLAGS)) {
    for (const pattern of flag.patterns) {
      if (textLower.includes(pattern)) {
        totalWeight += flag.weight;
        flags.push({ name, weight: flag.weight, description: flag.description });
        break;
      }
    }
  }

  return { weight: totalWeight, flags };
}

// ── Fetch community reports from Supabase ──────────────────────────────────
async function fetchCommunityReports(handle: string, platform: string): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('get_employer_trust_metadata', {
      p_handle: handle,
      p_platform: platform,
    });
    if (error || !data || data.length === 0) return null;
    return data[0];
  } catch {
    return null;
  }
}

// ── Check wallet payment history via Solana RPC ────────────────────────────
async function checkWalletPaymentHistory(walletAddress: string): Promise<boolean | null> {
  try {
    const resp = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [walletAddress, { limit: 50 }],
      }),
    });
    const data = await resp.json();
    const sigs = data?.result || [];
    if (sigs.length >= 10) return true;
    if (sigs.length === 0) return false;
    return null;
  } catch {
    return null;
  }
}

// ── Fetch website age from crt.sh ──────────────────────────────────────────
async function fetchWebsiteAge(domain: string): Promise<number | null> {
  try {
    const resp = await fetch(`https://crt.sh/?q=${domain}&output=json`, {
      headers: { 'User-Agent': 'AgenticBro/1.0' },
    });
    const data = await resp.json();
    if (!data || data.length === 0) return null;
    const earliest = data.reduce((min: string, entry: { not_before?: string }) => {
      const nb = entry.not_before || '9999-01-01';
      return nb < min ? nb : min;
    }, '9999-01-01');
    if (earliest === '9999-01-01') return null;
    const ageMs = Date.now() - new Date(earliest).getTime();
    return Math.max(Math.floor(ageMs / (1000 * 60 * 60 * 24)), 0);
  } catch {
    return null;
  }
}

// ── Calculate Employer Trust Score ─────────────────────────────────────────
function calculateEmployerTrustScore(
  text: string,
  platform: string,
  metadata: Record<string, unknown>
): Record<string, unknown> {
  let totalRiskWeight = 0;
  let totalTrustWeight = 0;
  const detectedRiskFlags: string[] = [];
  const detectedTrustSignals: string[] = [];
  const signalDetails: { type: string; flag: string; weight: number; description: string }[] = [];

  // Evaluate employer red flags
  const checks: Record<string, { key: string; trigger: 'boolean_false' | 'lt' | 'gte'; value: number | boolean | undefined; threshold?: number }> = {
    anonymous_founder: { key: 'has_public_founders', trigger: 'boolean_false', value: metadata.has_public_founders as boolean | undefined },
    new_domain: { key: 'website_age_days', trigger: 'lt', value: metadata.website_age_days as number | undefined, threshold: 90 },
    no_payment_history: { key: 'has_payment_history', trigger: 'boolean_false', value: metadata.has_payment_history as boolean | undefined },
    account_rebrand: { key: 'username_changes', trigger: 'gte', value: metadata.username_changes as number | undefined, threshold: 2 },
    hiring_spam: { key: 'hiring_post_count', trigger: 'gte', value: metadata.hiring_post_count as number | undefined, threshold: 5 },
    prior_rug_pull: { key: 'prior_rug_flags', trigger: 'gte', value: metadata.prior_rug_flags as number | undefined, threshold: 1 },
    community_nonpayment_reports: { key: 'community_reports', trigger: 'gte', value: metadata.community_reports as number | undefined, threshold: 1 },
    no_public_founders: { key: 'has_public_founders', trigger: 'boolean_false', value: metadata.has_public_founders as boolean | undefined },
    unverified_contact: { key: 'contact_verified', trigger: 'boolean_false', value: metadata.contact_verified as boolean | undefined },
  };

  for (const [flagName, flagData] of Object.entries(EMPLOYER_RED_FLAGS)) {
    const check = checks[flagName];
    if (check.value === undefined || check.value === null) continue;
    
    let triggered = false;
    if (check.trigger === 'boolean_false') triggered = check.value === false;
    else if (check.trigger === 'lt' && check.threshold !== undefined) triggered = (check.value as number) < check.threshold;
    else if (check.trigger === 'gte' && check.threshold !== undefined) triggered = (check.value as number) >= check.threshold;

    if (triggered) {
      totalRiskWeight += flagData.weight;
      detectedRiskFlags.push(flagName);
      signalDetails.push({ type: 'risk', flag: flagName, weight: flagData.weight, description: flagData.description });
    }
  }

  // Evaluate trust signals
  const trustChecks: Record<string, { key: string; trigger: 'boolean_true' | 'gte'; value: number | boolean | undefined; threshold?: number }> = {
    positive_payment_history: { key: 'has_payment_history', trigger: 'boolean_true', value: metadata.has_payment_history as boolean | undefined },
    established_domain: { key: 'website_age_days', trigger: 'gte', value: metadata.website_age_days as number | undefined, threshold: 730 },
    public_founders: { key: 'has_public_founders', trigger: 'boolean_true', value: metadata.has_public_founders as boolean | undefined },
    positive_contractor_reviews: { key: 'positive_reviews', trigger: 'gte', value: metadata.positive_reviews as number | undefined, threshold: 3 },
  };

  for (const [signalName, signalData] of Object.entries(EMPLOYER_TRUST_SIGNALS)) {
    const check = trustChecks[signalName];
    if (check.value === undefined || check.value === null) continue;
    
    let triggered = false;
    if (check.trigger === 'boolean_true') triggered = check.value === true;
    else if (check.trigger === 'gte' && check.threshold !== undefined) triggered = (check.value as number) >= check.threshold;

    if (triggered) {
      totalTrustWeight += Math.abs(signalData.weight);
      detectedTrustSignals.push(signalName);
      signalDetails.push({ type: 'trust', flag: signalName, weight: signalData.weight, description: signalData.description });
    }
  }

  // Profile scam risk
  const profileResult = calculateProfileRisk(text);
  const profileRiskWeight = profileResult.weight;

  // Combined score
  const netWeight = totalRiskWeight - totalTrustWeight + profileRiskWeight;
  const maxRisk = 90 + 95; // 185
  const trustScore = Math.min(Math.max((netWeight / maxRisk) * 10, 0), 10);

  let trustLevel: string;
  let recommendation: string;
  if (trustScore < EMPLOYER_TRUST_THRESHOLDS.HIGHLY_TRUSTED) {
    trustLevel = 'HIGHLY TRUSTED';
    if (detectedTrustSignals.length > 0) {
      const signalNames: string[] = [];
      if (detectedTrustSignals.includes('positive_payment_history')) signalNames.push('verified payment history');
      if (detectedTrustSignals.includes('established_domain')) signalNames.push('established domain');
      if (detectedTrustSignals.includes('public_founders')) signalNames.push('public founders');
      if (detectedTrustSignals.includes('positive_contractor_reviews')) signalNames.push('positive contractor reviews');
      recommendation = `✅ This employer shows strong trust signals. ${signalNames.slice(0, 3).join(', ')}.`;
    } else {
      recommendation = '✅ No risk signals detected. No community reports on file. Standard due diligence recommended before accepting work.';
    }
  } else if (trustScore < EMPLOYER_TRUST_THRESHOLDS.TRUSTED) {
    trustLevel = 'TRUSTED';
    if (detectedTrustSignals.length > 0) {
      recommendation = '🟢 This employer appears reliable with some trust signals. Verify details before accepting work.';
    } else {
      recommendation = '🟢 Low risk profile. No red flags detected. Verify details before accepting work.';
    }
  } else if (trustScore < EMPLOYER_TRUST_THRESHOLDS.MODERATE) {
    trustLevel = 'MODERATE';
    recommendation = '🟡 Exercise caution. Request payment terms in writing and verify references.';
  } else if (trustScore < EMPLOYER_TRUST_THRESHOLDS.HIGH_RISK) {
    trustLevel = 'HIGH RISK';
    recommendation = '🔴 High risk employer. Do NOT accept work without verified payment terms. Check community reports.';
  } else {
    trustLevel = 'CRITICAL RISK';
    recommendation = '🚨 Critical risk. Multiple red flags detected. Avoid engaging with this employer.';
  }

  return {
    employer_trust_score: Math.round(trustScore * 10) / 10,
    trust_level: trustLevel,
    trust_recommendation: recommendation,
    risk_flags_detected: detectedRiskFlags.length,
    trust_signals_detected: detectedTrustSignals.length,
    risk_flags: detectedRiskFlags,
    trust_signals: detectedTrustSignals,
    signal_details: signalDetails,
    profile_risk_weight: profileRiskWeight,
    profile_flags: profileResult.flags,
    net_weight: netWeight,
    total_risk_weight: totalRiskWeight,
    total_trust_weight: totalTrustWeight,
    max_possible_weight: maxRisk,
    scan_timestamp: new Date().toISOString(),
    scan_type: 'employer',
    handle: metadata.handle,
    platform,
  };
}

// ── Main handler ────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const url = (req.url || '').split('?')[0];
  const path = url.replace(/^\/api\/employer-scan/, '') || '/';

  // ── POST /api/employer-scan → Run employer trust scan ─────────────────────
  if (req.method === 'POST' && (path === '/' || path === '')) {
    const body = req.body as unknown as EmployerScanRequest;
    if (!body?.handle) {
      res.status(400).json({ error: 'handle is required' });
      return;
    }

    const platform = body.platform || 'x';
    const handle = body.handle.replace(/^@/, '');
    const text = body.text || '';

    // Build metadata
    const metadata: Record<string, unknown> = {
      handle: `@${handle}`,
      account_age_days: body.account_age_days,
      followers: body.followers,
      website_domain: body.website_domain,
      website_age_days: body.website_age_days,
      wallet_address: body.wallet_address,
      has_public_founders: body.has_public_founders,
      has_payment_history: body.has_payment_history,
      contact_verified: body.contact_verified,
      username_changes: body.username_changes,
      hiring_post_count: body.hiring_post_count,
    };

    // Auto-fetch community reports from Supabase
    const reports = await fetchCommunityReports(handle, platform);
    if (reports) {
      if (metadata.community_reports === undefined) metadata.community_reports = reports.community_reports || 0;
      if (metadata.prior_rug_flags === undefined) metadata.prior_rug_flags = reports.prior_rug_flags || 0;
      if (metadata.positive_reviews === undefined) metadata.positive_reviews = reports.positive_reviews || 0;
      if (metadata.username_changes === undefined) metadata.username_changes = reports.username_changes || 0;
      if (metadata.hiring_post_count === undefined) metadata.hiring_post_count = reports.hiring_post_count || 0;
      if (!metadata.website_domain && reports.website) metadata.website_domain = reports.website;
      if (!metadata.wallet_address && reports.wallet) metadata.wallet_address = reports.wallet;
    }

    // Auto-fetch website age from crt.sh
    if (metadata.website_domain && metadata.website_age_days === undefined) {
      const age = await fetchWebsiteAge(metadata.website_domain as string);
      if (age !== null) metadata.website_age_days = age;
    }

    // Auto-check wallet payment history
    if (metadata.wallet_address && metadata.has_payment_history === undefined) {
      const hasPayments = await checkWalletPaymentHistory(metadata.wallet_address as string);
      if (hasPayments !== null) metadata.has_payment_history = hasPayments;
    }

    // Calculate score
    const result = calculateEmployerTrustScore(text, platform, metadata);

    // Record scan to Supabase
    if (supabase) {
      try {
        await supabase.from('scan_events').insert({
          scan_type: 'employer',
          platform,
          target: handle,
          username: handle,
          risk_score: result.employer_trust_score as number,
          risk_level: result.trust_level as string,
          source: 'website',
          source_table: 'direct_insert',
          event_date: new Date().toISOString().split('T')[0],
        });
      } catch { /* analytics only */ }
    }

    res.status(200).json(result);
    return;
  }

  // ── GET /api/employer-scan?handle=x → Get recent scan ─────────────────────
  if (req.method === 'GET' && (path === '/' || path === '')) {
    const query = req.query || {};
    const handle = query.handle?.replace(/^@/, '');
    if (!handle) {
      res.status(400).json({ error: 'handle query param is required' });
      return;
    }

    if (supabase) {
      try {
        const { data } = await supabase
          .from('scan_events')
          .select('*')
          .eq('scan_type', 'employer')
          .eq('username', handle)
          .order('event_date', { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          res.status(200).json({ cached: true, ...data[0] });
          return;
        }
      } catch { /* fall through */ }
    }

    res.status(404).json({ error: 'No scan found for this employer' });
    return;
  }

  // ── POST /api/employer-scan/report → Submit community report ───────────────
  if (req.method === 'POST' && path === '/report') {
    const body = req.body as unknown as EmployerReportRequest;
    if (!body?.employer_handle || !body?.report_type) {
      res.status(400).json({ error: 'employer_handle and report_type are required' });
      return;
    }

    if (!supabase) {
      res.status(500).json({ error: 'Database not configured' });
      return;
    }

    try {
      const { data, error } = await supabase.from('employer_reports').insert({
        employer_handle: body.employer_handle.replace(/^@/, ''),
        employer_platform: body.employer_platform || 'x',
        report_type: body.report_type,
        report_status: 'pending',
        reporter_handle: body.reporter_handle?.replace(/^@/, ''),
        reporter_role: body.reporter_role || 'other',
        role_applied_for: body.role_applied_for,
        amount_owed: body.amount_owed,
        description: body.description,
        evidence_links: body.evidence_links || [],
        project_name: body.project_name,
        employer_website: body.employer_website,
        employer_wallet: body.employer_wallet,
        contract_address: body.contract_address,
        incident_date: body.incident_date,
      }).select();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(201).json({ success: true, report_id: data?.[0]?.id, status: 'pending' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to submit report' });
    }
    return;
  }

  // ── GET /api/employer-scan/reports?handle=x → Get reports ─────────────────
  if (req.method === 'GET' && path === '/reports') {
    const query = req.query || {};
    const handle = query.handle?.replace(/^@/, '');
    if (!handle) {
      res.status(400).json({ error: 'handle query param is required' });
      return;
    }

    if (!supabase) {
      res.status(500).json({ error: 'Database not configured' });
      return;
    }

    try {
      // Get summary
      const { data: summary } = await supabase.rpc('get_employer_trust_metadata', {
        p_handle: handle,
        p_platform: query.platform || 'x',
      });

      // Get individual reports
      let reportsQuery = supabase
        .from('employer_reports')
        .select('*')
        .eq('employer_handle', handle)
        .order('created_at', { ascending: false })
        .limit(50);

      if (query.status) {
        reportsQuery = reportsQuery.eq('report_status', query.status);
      }

      const { data: reports } = await reportsQuery;

      res.status(200).json({
        handle: `@${handle}`,
        summary: summary?.[0] || null,
        reports: reports || [],
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
    return;
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  res.status(404).json({ error: 'Not found' });
}