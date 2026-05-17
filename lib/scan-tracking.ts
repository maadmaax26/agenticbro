/**
 * lib/scan-tracking.ts — Shared scan event tracking helper
 * ================================================================
 * Single entry point for recording ALL scan types to the scan_events table.
 * Every API endpoint should call recordScanEvent() on each scan.
 *
 * Actual Supabase schema (scan_events):
 *   id, created_at, event_date, scan_type, platform, username,
 *   risk_score, risk_level, scam_type, verification_level,
 *   source_table, source_id, metadata,
 *   target, source, wallet_address, country_code
 *
 * Usage in API endpoints:
 *   import { recordScanEvent } from '../lib/scan-tracking';
 *   await recordScanEvent({ scan_type: 'social', platform: 'instagram', target: 'elonmusk', ... });
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Types ───────────────────────────────────────────────────────────────────

export type ScanType =
  | 'social'                // Instagram, TikTok, Facebook profile scans
  | 'x_cdp'                 // X/Twitter via Chrome CDP
  | 'phone'                  // Phone number verification
  | 'website'                // Website deep scan
  | 'token_impersonation'   // Token impersonation scan
  | 'token'                  // Token contract scan
  | 'wallet';                // Wallet analysis scan

export type ScanPlatform = 'instagram' | 'tiktok' | 'facebook' | 'twitter' | null;

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;

export type ScanSource = 'website' | 'telegram' | 'api';

export interface ScanEventParams {
  /** What type of scan was performed */
  scan_type: ScanType;
  /** Which platform (null for non-social scans) */
  platform?: ScanPlatform;
  /** Username, phone, URL, or contract address that was scanned */
  target: string;
  /** Risk score 0.0–10.0 (null for pending/queued) */
  risk_score?: number | null;
  /** Risk level label (null for pending) */
  risk_level?: RiskLevel;
  /** Where the scan originated */
  source?: ScanSource;
  /** Connected wallet address (if any) */
  wallet_address?: string | null;
  /** Country code for phone scans */
  country_code?: string | null;
}

// ── Supabase singleton ───────────────────────────────────────────────────────

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('[scan-tracking] Supabase not configured — scan events will not be recorded');
    return null;
  }

  supabaseInstance = createClient(url, key);
  return supabaseInstance;
}

// ── recordScanEvent ─────────────────────────────────────────────────────────

/**
 * Record a scan event to the scan_events table.
 * Non-blocking: logs errors but never throws.
 * Call this AFTER a successful scan result is produced.
 */
export async function recordScanEvent(params: ScanEventParams): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase.from('scan_events').insert({
      scan_type: params.scan_type,
      platform: params.platform ?? null,
      target: params.target,
      username: params.target,         // also populate legacy 'username' column
      risk_score: params.risk_score ?? null,
      risk_level: params.risk_level ?? null,
      source: params.source ?? 'website',
      source_table: 'direct_insert',   // distinguish from scan_jobs backfill
      event_date: new Date().toISOString().split('T')[0],  // today's date
      wallet_address: params.wallet_address ?? null,
      country_code: params.country_code ?? null,
    });

    if (error) {
      console.error('[scan-tracking] Insert error:', error.message);
    }
  } catch (err) {
    console.error('[scan-tracking] Unexpected error:', err);
  }
}

// ── Convenience wrappers per scan type ───────────────────────────────────────

/** Record a social profile scan (Instagram, TikTok, Facebook) */
export async function recordSocialScan(
  platform: 'instagram' | 'tiktok' | 'facebook',
  username: string,
  risk_score: number,
  risk_level: RiskLevel,
  source: ScanSource = 'website',
): Promise<void> {
  return recordScanEvent({
    scan_type: 'social',
    platform,
    target: username,
    risk_score,
    risk_level,
    source,
  });
}

/** Record an X/Twitter CDP scan */
export async function recordXScan(
  username: string,
  risk_score?: number | null,
  risk_level?: RiskLevel,
  source: ScanSource = 'website',
): Promise<void> {
  return recordScanEvent({
    scan_type: 'x_cdp',
    platform: 'twitter',
    target: username,
    risk_score,
    risk_level,
    source,
  });
}

/** Record a phone verification scan */
export async function recordPhoneScan(
  phone: string,
  risk_score: number,
  risk_level: RiskLevel,
  country_code?: string | null,
  source: ScanSource = 'website',
): Promise<void> {
  return recordScanEvent({
    scan_type: 'phone',
    platform: null,
    target: phone,
    risk_score,
    risk_level,
    source,
    country_code,
  });
}

/** Record a website deep scan */
export async function recordWebsiteScan(
  url: string,
  risk_score?: number | null,
  risk_level?: RiskLevel,
  source: ScanSource = 'website',
): Promise<void> {
  return recordScanEvent({
    scan_type: 'website',
    platform: null,
    target: url,
    risk_score,
    risk_level,
    source,
  });
}

/** Record a token impersonation scan */
export async function recordTokenImpersonationScan(
  contractAddress: string,
  risk_score?: number | null,
  risk_level?: RiskLevel,
  source: ScanSource = 'website',
): Promise<void> {
  return recordScanEvent({
    scan_type: 'token_impersonation',
    platform: null,
    target: contractAddress,
    risk_score,
    risk_level,
    source,
  });
}

/** Record a token or wallet scan (from the job queue) */
export async function recordTokenScan(
  address: string,
  scan_type: 'token' | 'wallet',
  risk_score?: number | null,
  risk_level?: RiskLevel,
  source: ScanSource = 'website',
): Promise<void> {
  return recordScanEvent({
    scan_type,
    platform: null,
    target: address,
    risk_score,
    risk_level,
    source,
  });
}

// ── Analytics queries ───────────────────────────────────────────────────────

export async function getDailyScanStats(
  startDate: string = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
  endDate: string = new Date().toISOString().split('T')[0],
): Promise<ScanDailyStatsRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('get_daily_scan_stats', {
    start_date: startDate,
    end_date: endDate,
  });

  if (error) {
    console.error('[scan-tracking] getDailyScanStats error:', error.message);
    return [];
  }

  return data ?? [];
}

export async function getTotalScanCounts(): Promise<ScanTotalCountsRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('get_total_scan_counts');

  if (error) {
    console.error('[scan-tracking] getTotalScanCounts error:', error.message);
    return [];
  }

  return data ?? [];
}

export async function getScanGrowth(): Promise<ScanGrowthRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('get_scan_growth');

  if (error) {
    console.error('[scan-tracking] getScanGrowth error:', error.message);
    return [];
  }

  return data ?? [];
}

// ── Types for RPC results ───────────────────────────────────────────────────

export interface ScanDailyStatsRow {
  scan_date: string;
  scan_type: string;
  platform: string | null;
  total_scans: number;
  unique_targets: number;
  avg_risk_score: number | null;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

export interface ScanTotalCountsRow {
  scan_type: string;
  total: number;
  today: number;
  this_week: number;
  this_month: number;
  last_7_days: number;
  last_30_days: number;
}

export interface ScanGrowthRow {
  scan_type: string;
  this_week: number;
  last_week: number;
  growth_pct: number | null;
  this_month: number;
  last_month: number;
  month_growth_pct: number | null;
}