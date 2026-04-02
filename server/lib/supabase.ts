/**
 * Server-side Supabase client for AgenticBro backend
 *
 * Uses the service role key (bypasses Row Level Security) so the server
 * can freely read/write scan_results and known_scammers tables.
 *
 * Required env vars (add to .env.local):
 *   SUPABASE_URL            — same value as VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY — from Supabase Dashboard → Settings → API → service_role key
 *   SUPABASE_ANON_KEY       — (optional) same as VITE_SUPABASE_ANON_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Allow both VITE_ and bare env var names so the server can reuse .env.local
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''

const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''

const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''

if (!supabaseUrl || !serviceKey) {
  console.warn(
    '[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — ' +
    'scan results will NOT be persisted to Supabase. ' +
    'Add these to .env.local to enable cloud storage.'
  )
}

// ─── Admin client (service role — full DB access) ─────────────────────────────
export const supabaseAdmin: SupabaseClient | null =
  supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null

// ─── Read-only client (anon key) ──────────────────────────────────────────────
export const supabaseAnon: SupabaseClient | null =
  supabaseUrl && (anonKey || serviceKey)
    ? createClient(supabaseUrl, anonKey || serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null

export const isSupabaseConfigured = !!supabaseAdmin

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScanResultRow {
  id?: string
  username: string
  platform: 'X' | 'Telegram'
  risk_score: number
  red_flags: string[]
  verification_level?: string
  scam_type?: string
  recommended_action?: string
  full_report?: string
  x_profile?: Record<string, unknown>
  victim_reports?: Record<string, unknown>
  known_scammer_match?: Record<string, unknown>
  evidence: string[]
  data_source?: string
  wallet_address?: string
  scanned_at?: string
}

export interface KnownScammerRow {
  id?: string
  platform: string
  username: string
  display_name?: string
  x_handle?: string
  telegram_channel?: string
  impersonating?: string
  scam_type?: string
  victim_count?: number
  total_lost_usd?: string
  verification_level?: string
  threat_level?: string
  category?: string
  status?: string
  risk_score?: number
  notes?: string
  wallet_address?: string
  evidence_links?: string
  violations?: string[]
  red_flags?: string[]
  scan_notes?: string
  banned?: boolean
  banned_date?: string
  warn_count?: number
  harassment?: boolean
  ban_evasion?: boolean
}

// ─── Scan Results ─────────────────────────────────────────────────────────────

/**
 * Persist a scan result to Supabase. Returns the new row's UUID or null on failure.
 */
export async function storeScanResult(
  result: ScanResultRow
): Promise<string | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('scan_results')
    .insert(result)
    .select('id')
    .single()

  if (error) {
    console.error('[Supabase] storeScanResult error:', error.message)
    return null
  }

  return (data as any)?.id ?? null
}

/**
 * Fetch recent scan results, optionally filtered by username or wallet.
 */
export async function getRecentScanResults(opts: {
  username?: string
  walletAddress?: string
  limit?: number
}): Promise<ScanResultRow[]> {
  const client = supabaseAdmin ?? supabaseAnon
  if (!client) return []

  const { username, walletAddress, limit = 50 } = opts

  let query = client
    .from('scan_results')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(limit)

  if (username) {
    // case-insensitive match, strip leading @
    query = query.ilike('username', username.replace(/^@/, ''))
  }
  if (walletAddress) {
    query = query.eq('wallet_address', walletAddress)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Supabase] getRecentScanResults error:', error.message)
    return []
  }

  return (data as ScanResultRow[]) ?? []
}

// ─── Known Scammers ───────────────────────────────────────────────────────────

/**
 * Look up a username in the known_scammers table (checks username, x_handle,
 * and telegram_channel columns).  Returns null if not found.
 */
export async function queryKnownScammer(
  username: string
): Promise<KnownScammerRow | null> {
  const client = supabaseAdmin ?? supabaseAnon
  if (!client) return null

  const clean = username.replace(/^@/, '').toLowerCase()

  // Try exact username match first
  const { data: exact } = await client
    .from('known_scammers')
    .select('*')
    .ilike('username', clean)
    .neq('status', 'suspended')
    .limit(1)

  if (exact && exact.length > 0) return exact[0] as KnownScammerRow

  // Try x_handle or telegram_channel partial match
  const { data: handle } = await client
    .from('known_scammers')
    .select('*')
    .or(`x_handle.ilike.%${clean}%,telegram_channel.ilike.%${clean}%`)
    .neq('status', 'suspended')
    .limit(1)

  if (handle && handle.length > 0) return handle[0] as KnownScammerRow

  return null
}

/**
 * Insert or update a known scammer record.
 */
export async function upsertKnownScammer(
  scammer: KnownScammerRow
): Promise<boolean> {
  if (!supabaseAdmin) return false

  // Remove id so Supabase can generate it on insert, keep it for update
  const payload = scammer.id ? scammer : { ...scammer }

  const { error } = await supabaseAdmin
    .from('known_scammers')
    .upsert(payload, { onConflict: 'platform,username' })

  if (error) {
    console.error('[Supabase] upsertKnownScammer error:', error.message)
    return false
  }

  return true
}

/**
 * Bulk insert known scammers (for migration).  Skips duplicates.
 */
export async function bulkInsertKnownScammers(
  scammers: KnownScammerRow[]
): Promise<{ inserted: number; skipped: number; errors: number }> {
  if (!supabaseAdmin) {
    return { inserted: 0, skipped: 0, errors: scammers.length }
  }

  let inserted = 0
  let skipped = 0
  let errors = 0

  // Process in batches of 50
  const BATCH = 50
  for (let i = 0; i < scammers.length; i += BATCH) {
    const batch = scammers.slice(i, i + BATCH)

    const { data, error } = await supabaseAdmin
      .from('known_scammers')
      .upsert(batch, { onConflict: 'platform,username', ignoreDuplicates: false })
      .select('id')

    if (error) {
      console.error(`[Supabase] bulkInsert batch ${i / BATCH + 1} error:`, error.message)
      errors += batch.length
    } else {
      inserted += (data as any[])?.length ?? batch.length
    }
  }

  return { inserted, skipped, errors }
}

/**
 * Fetch all known scammers from Supabase.
 */
export async function getAllKnownScammers(): Promise<KnownScammerRow[]> {
  const client = supabaseAdmin ?? supabaseAnon
  if (!client) return []

  const { data, error } = await client
    .from('known_scammers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Supabase] getAllKnownScammers error:', error.message)
    return []
  }

  return (data as KnownScammerRow[]) ?? []
}
