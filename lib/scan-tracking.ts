/**
 * lib/scan-tracking.ts — Shared scan event tracking helper
 * ================================================================
 * 
 * IMPORTANT: This file CANNOT be imported by Vercel serverless functions
 * in /api/*.ts because Vercel doesn't bundle cross-directory imports
 * for serverless functions. Each API endpoint inlines the tracking call.
 * 
 * This file is still used by:
 * - Non-Vercel Node.js scripts (migrations, backfills)
 * - Frontend analytics components
 * - Local dev server
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type ScanType = 'social' | 'x_cdp' | 'phone' | 'website' | 'token_impersonation' | 'token' | 'wallet';
export type ScanPlatform = 'instagram' | 'tiktok' | 'facebook' | 'twitter' | null;
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
export type ScanSource = 'website' | 'telegram' | 'api';

export interface ScanEventParams {
  scan_type: ScanType;
  platform?: ScanPlatform;
  target: string;
  risk_score?: number | null;
  risk_level?: RiskLevel;
  source?: ScanSource;
  wallet_address?: string | null;
  country_code?: string | null;
}

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  supabaseInstance = createClient(url, key);
  return supabaseInstance;
}

export async function recordScanEvent(params: ScanEventParams): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('scan_events').insert({
      scan_type: params.scan_type,
      platform: params.platform ?? null,
      target: params.target,
      username: params.target,
      risk_score: params.risk_score ?? null,
      risk_level: params.risk_level ?? null,
      source: params.source ?? 'website',
      source_table: 'direct_insert',
      event_date: new Date().toISOString().split('T')[0],
      wallet_address: params.wallet_address ?? null,
      country_code: params.country_code ?? null,
    });
    if (error) console.error('[scan-tracking] Insert error:', error.message);
  } catch (err) {
    console.error('[scan-tracking] Unexpected error:', err);
  }
}

export async function getDailyScanStats(startDate?: string, endDate?: string) {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_daily_scan_stats', {
    start_date: startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    end_date: endDate || new Date().toISOString().split('T')[0],
  });
  if (error) { console.error('[scan-tracking] Error:', error.message); return []; }
  return data ?? [];
}

export async function getTotalScanCounts() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_total_scan_counts');
  if (error) { console.error('[scan-tracking] Error:', error.message); return []; }
  return data ?? [];
}

export async function getScanGrowth() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_scan_growth');
  if (error) { console.error('[scan-tracking] Error:', error.message); return []; }
  return data ?? [];
}