/**
 * migrate-local-to-supabase.ts
 *
 * Loads all local scammer JSON databases into the Supabase known_scammers table.
 * Run once to seed the cloud database, then all new scans are persisted automatically.
 *
 * Usage:
 *   npx tsx scripts/migrate-local-to-supabase.ts
 *
 * Required env vars in .env.local:
 *   SUPABASE_URL             (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ─── Load .env.local ──────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const content = readFileSync(resolve(ROOT, '.env.local'), 'utf-8')
    for (const raw of content.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (key && !process.env[key]) process.env[key] = val
    }
  } catch {
    // .env.local not present — rely on shell environment
  }
}

loadEnv()

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !serviceKey) {
  console.error(
    '\n❌  Missing Supabase credentials.\n' +
    '    Add to .env.local:\n' +
    '      SUPABASE_URL=https://xxxx.supabase.co\n' +
    '      SUPABASE_SERVICE_ROLE_KEY=eyJ...\n'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScammerRow {
  platform: string
  username: string
  display_name?: string
  x_handle?: string
  telegram_channel?: string
  scam_type: string
  victim_count: number
  total_lost_usd: string
  verification_level?: string
  threat_level?: string
  category?: string
  status: string
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

// ─── Source 1: api/scammer-database.json ─────────────────────────────────────

function loadApiScammerDatabase(): ScammerRow[] {
  const raw: any[] = JSON.parse(
    readFileSync(resolve(ROOT, 'api/scammer-database.json'), 'utf-8')
  )

  return raw.map((entry): ScammerRow => {
    const xHandle = entry['X Handle'] !== '-' ? entry['X Handle'] : undefined
    const telegramChannel = entry['Telegram Channel'] !== '-' ? entry['Telegram Channel'] : undefined
    const platformRaw = String(entry['Platform'] || 'other').toLowerCase()

    // Normalise platform to known values
    const platform =
      platformRaw === 'x'
        ? 'twitter'          // stored as 'twitter' in DB; x_handle column holds @handle
        : platformRaw === 'telegram'
          ? 'telegram'
          : 'other'

    // Derive username from whichever handle is available
    const username = (xHandle || telegramChannel || entry['Scammer Name'] || 'unknown')
      .replace(/^@/, '')
      .toLowerCase()

    // Parse victim count
    const vcRaw = String(entry['Victims Count'] || '0')
    const victimCount = /^\d+$/.test(vcRaw) ? parseInt(vcRaw) : 0

    // Determine threat level from verification level
    const verificationLevel = String(entry['Verification Level'] || 'Unverified')
    const threatLevelMap: Record<string, string> = {
      'High Risk': 'HIGH',
      'Verified': 'HIGH',
      'Partially Verified': 'MEDIUM',
      'Legitimate': 'LEGITIMATE',
      'Insufficient Data': 'UNKNOWN',
      'Unverified': 'LOW',
    }
    const threatLevel = threatLevelMap[verificationLevel] ?? 'UNKNOWN'

    // Map scam type
    const scamTypeRaw = String(entry['Scam Type'] || 'other').toLowerCase()
    const scamTypeMap: Record<string, string> = {
      'wallet drainer': 'wallet_drainer',
      'automated trading': 'investment_fraud',
      'alpha calls': 'investment_fraud',
      'alpha caller': 'investment_fraud',
      'n/a': 'other',
      '?': 'other',
      'unknown': 'other',
    }
    const scamType = scamTypeMap[scamTypeRaw] ?? 'other'

    return {
      platform,
      username,
      x_handle: xHandle,
      telegram_channel: telegramChannel,
      scam_type: scamType,
      victim_count: victimCount,
      total_lost_usd: String(entry['Total Lost USD'] || '0'),
      verification_level: verificationLevel,
      threat_level: threatLevel,
      status: verificationLevel === 'Legitimate' ? 'Legitimate' : 'active',
      notes: entry['Notes'] || undefined,
      wallet_address:
        entry['Wallet Address'] && entry['Wallet Address'] !== '-'
          ? entry['Wallet Address']
          : undefined,
      evidence_links:
        entry['Evidence Links'] && entry['Evidence Links'] !== '-'
          ? entry['Evidence Links']
          : undefined,
    }
  })
}

// ─── Source 2: scammer_database.json ─────────────────────────────────────────

function loadScammerDatabase(): ScammerRow[] {
  const raw: any = JSON.parse(
    readFileSync(resolve(ROOT, 'scammer_database.json'), 'utf-8')
  )

  const entries: any[] = Array.isArray(raw) ? raw : (raw.scammers ?? [])

  return entries.map((entry): ScammerRow => {
    const username = String(entry.username || entry.name || 'unknown')
      .replace(/^@/, '')
      .toLowerCase()

    // Telegram bot entries — platform is telegram
    const platform = 'telegram'

    const violations: string[] = Array.isArray(entry.violations)
      ? entry.violations
      : []
    const redFlags: string[] = Array.isArray(entry.red_flags)
      ? entry.red_flags
      : []

    return {
      platform,
      username,
      display_name: entry.name || undefined,
      scam_type: 'other',
      victim_count: 0,
      total_lost_usd: '0',
      threat_level: String(entry.threat_level || 'HIGH'),
      category: entry.category || undefined,
      status: entry.banned ? 'active' : 'active',
      violations,
      red_flags: redFlags,
      scan_notes: entry.scan_notes || undefined,
      notes: entry.scan_notes || undefined,
      banned: Boolean(entry.banned),
      banned_date: entry.banned_date || undefined,
      warn_count: typeof entry.warn_count === 'number' ? entry.warn_count : 0,
      harassment: Boolean(entry.harassment),
      ban_evasion: Boolean(entry.ban_evasion),
    }
  })
}

// ─── Deduplication ───────────────────────────────────────────────────────────

function deduplicateScammers(scammers: ScammerRow[]): ScammerRow[] {
  const seen = new Map<string, ScammerRow>()

  for (const s of scammers) {
    const key = `${s.platform}::${s.username}`
    if (!seen.has(key)) {
      seen.set(key, s)
    } else {
      // Merge: prefer higher victim count, more detailed notes
      const existing = seen.get(key)!
      if ((s.victim_count ?? 0) > (existing.victim_count ?? 0)) {
        seen.set(key, { ...existing, ...s })
      }
    }
  }

  return Array.from(seen.values())
}

// ─── Batch Upsert ─────────────────────────────────────────────────────────────

async function batchUpsert(scammers: ScammerRow[]): Promise<{ ok: number; err: number }> {
  let ok = 0
  let err = 0
  const BATCH = 50

  for (let i = 0; i < scammers.length; i += BATCH) {
    const batch = scammers.slice(i, i + BATCH)

    const { data, error } = await supabase
      .from('known_scammers')
      .upsert(batch, { onConflict: 'platform,username' })
      .select('id')

    if (error) {
      console.error(`  ✗ Batch ${Math.floor(i / BATCH) + 1} failed:`, error.message)
      err += batch.length
    } else {
      const count = (data as any[])?.length ?? batch.length
      ok += count
      process.stdout.write(`  ✓ ${ok} / ${scammers.length} upserted\r`)
    }
  }

  console.log() // newline after progress
  return { ok, err }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 AgenticBro → Supabase migration\n')
  console.log(`   URL: ${supabaseUrl}`)
  console.log(`   Key: ${serviceKey.slice(0, 20)}...\n`)

  // Verify connection
  const { error: pingError } = await supabase.from('known_scammers').select('id').limit(1)
  if (pingError) {
    console.error('❌  Cannot reach Supabase. Check credentials and that the migration SQL has been run.')
    console.error('   Error:', pingError.message)
    console.error('\n   Run supabase/migrations/001_scan_results_and_scammers.sql in your Supabase SQL Editor first.\n')
    process.exit(1)
  }

  console.log('✅  Connected to Supabase\n')

  // ── Load local databases ──────────────────────────────────────────────────
  let allScammers: ScammerRow[] = []

  console.log('📂  Loading local databases...')

  try {
    const source1 = loadApiScammerDatabase()
    console.log(`   api/scammer-database.json  → ${source1.length} entries`)
    allScammers.push(...source1)
  } catch (e) {
    console.warn('   ⚠  api/scammer-database.json not found or unreadable')
  }

  try {
    const source2 = loadScammerDatabase()
    console.log(`   scammer_database.json      → ${source2.length} entries`)
    allScammers.push(...source2)
  } catch (e) {
    console.warn('   ⚠  scammer_database.json not found or unreadable')
  }

  if (allScammers.length === 0) {
    console.log('\n⚠  No local scammer data found. Nothing to migrate.\n')
    process.exit(0)
  }

  // ── Deduplicate ───────────────────────────────────────────────────────────
  const deduped = deduplicateScammers(allScammers)
  console.log(`\n🔎  After deduplication: ${deduped.length} unique scammers (from ${allScammers.length} total)\n`)

  // ── Upsert to Supabase ────────────────────────────────────────────────────
  console.log('⬆️   Uploading to Supabase known_scammers...\n')
  const { ok, err } = await batchUpsert(deduped)

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────')
  console.log(`✅  Migration complete`)
  console.log(`   Upserted : ${ok}`)
  console.log(`   Errors   : ${err}`)
  console.log('─────────────────────────────────────────\n')

  if (err > 0) {
    console.log('⚠  Some records failed. Check errors above.')
    process.exit(1)
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  const { count } = await supabase
    .from('known_scammers')
    .select('*', { count: 'exact', head: true })

  console.log(`📊  Total records in Supabase known_scammers: ${count}\n`)
}

main().catch(err => {
  console.error('\n💥  Unexpected error:', err)
  process.exit(1)
})
