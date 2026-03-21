/**
 * server/telegram/scam-service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Integrated Scam Detection Service — bridges the OpenClaw scammer-detection
 * Python service capabilities into the aibro Node.js backend.
 *
 * Ported modules:
 *   • X/Twitter profile scraper   (from src/twitter_collector.py)
 *   • Wallet analyzer             (from src/wallet_analyzer.py)
 *   • Victim report searcher      (from src/victim_reporter.py)
 *   • Scammer database lookup     (from scammer-database.csv)
 *   • Enhanced risk scoring       (from scam-detection-framework.md)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface XProfileData {
  username:      string
  profileUrl:    string
  name?:         string
  bio?:          string
  followers?:    number
  following?:    number
  isVerified:    boolean
  profileImage?: string
  location?:     string
  website?:      string
  createdAt?:    string
  collectedAt:   string
}

export interface WalletAnalysis {
  address:     string
  blockchain:  'Solana' | 'Ethereum'
  balance:     number
  balanceUsd:  number
  transactions: WalletTransaction[]
  receivedFromVictims: { from: string; amount: number; timestamp: number }[]
  totalReceived: number
  totalSent:     number
  analyzedAt:  string
}

interface WalletTransaction {
  txHash:    string
  type:      string
  timestamp: number
  amount:    number
  from:      string
  to:        string
}

export interface VictimReport {
  title:     string
  url:       string
  snippet?:  string
  platform:  'Google' | 'Reddit' | 'Bitcointalk'
  subreddit?: string
  author?:   string
  score?:    number
}

export interface VictimAnalysis {
  totalReports:    number
  uniqueSources:   string[]
  platformCounts:  Record<string, number>
  reports:         VictimReport[]
}

export interface ScammerDbEntry {
  name:              string
  platform:          string
  xHandle?:          string
  telegramChannel?:  string
  status:            string
  riskScore?:        number
  victims:           number
  notes:             string
}

export interface EnhancedScamData {
  xProfile?:       XProfileData
  walletAnalysis?: WalletAnalysis
  victimAnalysis?: VictimAnalysis
  dbMatch?:        ScammerDbEntry
}

// ─── Config ─────────────────────────────────────────────────────────────────

const SOLSCAN_API  = 'https://public-api.solscan.io'
const ETHERSCAN_API = 'https://api.etherscan.io/api'

const SEARCH_TERMS = [
  'scammed by',
  'lost money to',
  'rugged by',
  'is a scammer',
  'scam',
]

// Scammer database CSV paths — try several locations
const HOME = process.env.HOME ?? '/root'
const SCAMMER_DB_PATHS = [
  // Project-local copy (most reliable)
  resolve(import.meta.dirname ?? __dirname, '../data/scammer-database.csv'),
  // OpenClaw workspace paths
  resolve(HOME, '.openclaw/workspace/scammer-database.csv'),
  resolve(HOME, '.openclaw/workspace/scammer-detection-service/scammer-database.csv'),
]

// ─── X/Twitter Profile Scraper ──────────────────────────────────────────────

/**
 * Fetch public X/Twitter profile data by scraping meta tags.
 * Mirrors: scammer-detection-service/src/twitter_collector.py → collect_profile()
 */
export async function fetchXProfile(username: string): Promise<XProfileData> {
  const handle = username.replace(/^@/, '').trim()

  const profile: XProfileData = {
    username:    handle,
    profileUrl:  `https://x.com/${handle}`,
    isVerified:  false,
    collectedAt: new Date().toISOString(),
  }

  try {
    // Fetch profile page — X (formerly Twitter) returns meta tags for public profiles
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)

    const res = await fetch(`https://x.com/${handle}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.warn(`[scam-service/x] profile fetch for @${handle} returned ${res.status}`)
      return profile
    }

    const html = await res.text()

    // Parse meta tags (same approach as Python version)
    const ogTitle       = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)
    const ogDescription = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
    const ogImage       = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
    const metaDesc      = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)

    if (ogTitle)       profile.name         = ogTitle[1]
    if (ogDescription) profile.bio          = ogDescription[1]
    if (ogImage)       profile.profileImage = ogImage[1]
    if (!profile.bio && metaDesc) profile.bio = metaDesc[1]

    // Try to extract follower info from embedded JSON-LD or meta tags
    const followersMatch = html.match(/(\d[\d,]+)\s*Followers/i)
    const followingMatch = html.match(/(\d[\d,]+)\s*Following/i)
    if (followersMatch) profile.followers = parseInt(followersMatch[1].replace(/,/g, ''), 10)
    if (followingMatch) profile.following = parseInt(followingMatch[1].replace(/,/g, ''), 10)

    // Check for verified badge
    if (html.includes('isVerified') || html.includes('verified_type')) {
      profile.isVerified = true
    }

    console.log(`[scam-service/x] ✓ profile scraped for @${handle}`)
  } catch (err) {
    console.warn(`[scam-service/x] profile scrape failed for @${handle}:`, err instanceof Error ? err.message : err)
  }

  return profile
}

// ─── X Profile Red-Flag Analysis ────────────────────────────────────────────

export interface XProfileRedFlags {
  flags:    string[]
  evidence: string[]
  riskContribution: number  // 0–4 points to add to risk score
}

/**
 * Analyze an X profile for scam red flags using the OpenClaw framework weights.
 */
export function analyzeXProfileFlags(profile: XProfileData): XProfileRedFlags {
  const flags: string[]    = []
  const evidence: string[] = []
  let risk = 0

  // Check bio for scam patterns
  const bio = (profile.bio ?? '').toLowerCase()

  if (/guarantee|100%|risk.?free|can't lose/i.test(bio)) {
    flags.push('Bio contains guaranteed-returns language (weight: 9/10)')
    evidence.push(`Bio text contains scam patterns commonly used by fraud accounts`)
    risk += 1.5
  }
  if (/send.*crypto|send.*sol|send.*eth|dm.*for.*signals|private.*alpha/i.test(bio)) {
    flags.push('Bio solicits crypto payments or "private alpha" (weight: 9/10)')
    evidence.push('Requesting crypto or private signals in bio is a major scam indicator')
    risk += 1.5
  }
  if (/limited.*spots|act.*now|last.*chance|hurry/i.test(bio)) {
    flags.push('Bio uses urgency tactics (weight: 8/10)')
    evidence.push('Urgency language in profile bio is a pressure tactic used by scammers')
    risk += 1
  }
  if (/x10|x100|1000%|moonshot/i.test(bio)) {
    flags.push('Bio makes unrealistic profit claims (weight: 9/10)')
    evidence.push('Claims of 10x-100x returns are unrealistic and characteristic of scams')
    risk += 1.5
  }

  // Check follower metrics (if available)
  if (profile.followers !== undefined && profile.following !== undefined) {
    if (profile.followers < 100) {
      flags.push(`Very low follower count (${profile.followers})`)
      evidence.push('Low follower count can indicate a new or fake account')
      risk += 0.5
    }
    if (profile.followers > 10000 && profile.following < 50) {
      flags.push(`Suspicious follower ratio (${profile.followers} followers / ${profile.following} following)`)
      evidence.push('Extremely high follower-to-following ratio may indicate purchased followers')
      risk += 0.5
    }
  }

  // No verification
  if (!profile.isVerified) {
    flags.push('Account is not verified (weight: 5/10)')
    evidence.push('Unverified accounts have lower credibility on X')
    risk += 0.3
  }

  return { flags, evidence, riskContribution: Math.min(risk, 4) }
}

// ─── Wallet Analyzer ────────────────────────────────────────────────────────

/**
 * Analyze a Solana wallet via Solscan public API.
 * Mirrors: scammer-detection-service/src/wallet_analyzer.py → analyze_solana_wallet()
 */
export async function analyzeSolanaWallet(address: string): Promise<WalletAnalysis> {
  const result: WalletAnalysis = {
    address,
    blockchain:  'Solana',
    balance:     0,
    balanceUsd:  0,
    transactions: [],
    receivedFromVictims: [],
    totalReceived: 0,
    totalSent:     0,
    analyzedAt: new Date().toISOString(),
  }

  try {
    // Get balance
    const balRes = await fetch(`${SOLSCAN_API}/account?address=${address}`, {
      headers: { 'User-Agent': 'AgenticBro/1.0' },
    })
    if (balRes.ok) {
      const data = await balRes.json() as { data?: { lamports?: number } }
      result.balance = (data.data?.lamports ?? 0) / 1e9
      result.balanceUsd = result.balance * 150  // approximate SOL price
    }

    // Get recent transactions
    const txRes = await fetch(`${SOLSCAN_API}/account/transactions?address=${address}&limit=20`, {
      headers: { 'User-Agent': 'AgenticBro/1.0' },
    })
    if (txRes.ok) {
      const txData = await txRes.json() as { data?: any[] }
      for (const tx of (txData.data ?? [])) {
        const info = tx?.parsedInstruction?.info ?? {}
        const transaction: WalletTransaction = {
          txHash:    tx.txHash ?? '',
          type:      tx.type ?? '',
          timestamp: tx.blockTime ?? 0,
          amount:    (info.lamports ?? 0) / 1e9,
          from:      info.source ?? '',
          to:        info.destination ?? '',
        }
        result.transactions.push(transaction)

        // Track receiving patterns
        if (transaction.type === 'transfer' && transaction.to === address) {
          result.receivedFromVictims.push({
            from:      transaction.from,
            amount:    transaction.amount,
            timestamp: transaction.timestamp,
          })
          result.totalReceived += transaction.amount
        }
        if (transaction.from === address) {
          result.totalSent += transaction.amount
        }
      }
    }

    console.log(`[scam-service/wallet] ✓ Solana wallet analyzed: ${address.slice(0, 8)}…`)
  } catch (err) {
    console.warn(`[scam-service/wallet] Solana analysis failed for ${address.slice(0, 8)}…:`, err instanceof Error ? err.message : err)
  }

  return result
}

/**
 * Analyze an Ethereum wallet via Etherscan public API.
 * Mirrors: scammer-detection-service/src/wallet_analyzer.py → analyze_ethereum_wallet()
 */
export async function analyzeEthWallet(address: string): Promise<WalletAnalysis> {
  const result: WalletAnalysis = {
    address,
    blockchain:  'Ethereum',
    balance:     0,
    balanceUsd:  0,
    transactions: [],
    receivedFromVictims: [],
    totalReceived: 0,
    totalSent:     0,
    analyzedAt: new Date().toISOString(),
  }

  try {
    // Get balance
    const balRes = await fetch(
      `${ETHERSCAN_API}?module=account&action=balance&address=${address}&tag=latest`,
    )
    if (balRes.ok) {
      const data = await balRes.json() as { result?: string }
      result.balance = parseInt(data.result ?? '0', 10) / 1e18
      result.balanceUsd = result.balance * 3000  // approximate ETH price
    }

    // Get recent transactions
    const txRes = await fetch(
      `${ETHERSCAN_API}?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=20`,
    )
    if (txRes.ok) {
      const txData = await txRes.json() as { result?: any[] }
      for (const tx of (txData.result ?? [])) {
        const valueEth = parseInt(tx.value ?? '0', 10) / 1e18
        const transaction: WalletTransaction = {
          txHash:    tx.hash ?? '',
          type:      tx.to?.toLowerCase() === address.toLowerCase() ? 'receive' : 'send',
          timestamp: parseInt(tx.timeStamp ?? '0', 10),
          amount:    valueEth,
          from:      tx.from ?? '',
          to:        tx.to ?? '',
        }
        result.transactions.push(transaction)

        if (transaction.to.toLowerCase() === address.toLowerCase()) {
          result.receivedFromVictims.push({
            from:      transaction.from,
            amount:    transaction.amount,
            timestamp: transaction.timestamp,
          })
          result.totalReceived += transaction.amount
        }
        if (transaction.from.toLowerCase() === address.toLowerCase()) {
          result.totalSent += transaction.amount
        }
      }
    }

    console.log(`[scam-service/wallet] ✓ Ethereum wallet analyzed: ${address.slice(0, 8)}…`)
  } catch (err) {
    console.warn(`[scam-service/wallet] Ethereum analysis failed for ${address.slice(0, 8)}…:`, err instanceof Error ? err.message : err)
  }

  return result
}

/**
 * Auto-detect blockchain and analyze wallet.
 */
export async function analyzeWallet(address: string): Promise<WalletAnalysis | null> {
  if (!address?.trim()) return null

  const addr = address.trim()
  // EVM addresses start with 0x and are 42 chars
  if (addr.startsWith('0x') && addr.length === 42) {
    return analyzeEthWallet(addr)
  }
  // Solana addresses are base58, typically 32-44 chars
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
    return analyzeSolanaWallet(addr)
  }

  console.warn(`[scam-service/wallet] unrecognized address format: ${addr.slice(0, 10)}…`)
  return null
}

// ─── Wallet Red-Flag Analysis ───────────────────────────────────────────────

export interface WalletRedFlags {
  flags:    string[]
  evidence: string[]
  riskContribution: number
}

export function analyzeWalletFlags(wallet: WalletAnalysis): WalletRedFlags {
  const flags: string[]    = []
  const evidence: string[] = []
  let risk = 0

  // Many inbound transactions from unique senders = potential victim pattern
  const uniqueSenders = new Set(wallet.receivedFromVictims.map(v => v.from))
  if (uniqueSenders.size >= 5) {
    flags.push(`Received from ${uniqueSenders.size} unique senders (potential victims)`)
    evidence.push(`Wallet received funds from ${uniqueSenders.size} different addresses — pattern consistent with collecting from victims`)
    risk += 1.5
  }

  // Large outflows relative to inflows
  if (wallet.totalSent > 0 && wallet.totalReceived > 0) {
    const outflowRatio = wallet.totalSent / wallet.totalReceived
    if (outflowRatio > 0.8) {
      flags.push('High outflow ratio — most received funds sent elsewhere')
      evidence.push(`${(outflowRatio * 100).toFixed(0)}% of received funds were sent out, consistent with laundering or consolidation`)
      risk += 1
    }
  }

  // Very low balance despite high activity
  if (wallet.transactions.length >= 10 && wallet.balance < 0.01) {
    flags.push('Near-zero balance despite transaction history')
    evidence.push('Wallet has been emptied — common scam pattern where funds are quickly moved out')
    risk += 0.5
  }

  return { flags, evidence, riskContribution: Math.min(risk, 3) }
}

// ─── Victim Report Searcher ─────────────────────────────────────────────────

/**
 * Search Reddit for victim reports about a username.
 * Mirrors: scammer-detection-service/src/victim_reporter.py → search_reddit()
 */
async function searchReddit(query: string, limit = 5): Promise<VictimReport[]> {
  const results: VictimReport[] = []

  try {
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=relevance`,
      {
        headers: {
          'User-Agent': 'AgenticBro/1.0 ScamDetection',
        },
      },
    )
    if (!res.ok) return results

    const data = await res.json() as {
      data?: { children?: { data: { title: string; permalink: string; subreddit: string; author: string; score: number } }[] }
    }

    for (const post of (data.data?.children ?? [])) {
      const d = post.data
      results.push({
        title:     d.title,
        url:       `https://reddit.com${d.permalink}`,
        platform:  'Reddit',
        subreddit: d.subreddit,
        author:    d.author,
        score:     d.score,
      })
    }
  } catch (err) {
    console.warn(`[scam-service/victim] Reddit search failed:`, err instanceof Error ? err.message : err)
  }

  return results
}

/**
 * Search multiple platforms for victim reports about a user.
 * Mirrors: scammer-detection-service/src/victim_reporter.py → search_reports()
 */
export async function searchVictimReports(username: string): Promise<VictimAnalysis> {
  const handle = username.replace(/^@/, '').trim()
  const allReports: VictimReport[] = []
  const platformCounts: Record<string, number> = {}

  // Build search queries (from OpenClaw config)
  const queries = SEARCH_TERMS.map(term => `${term} @${handle}`)

  // Search Reddit for each query (with rate limiting)
  for (const query of queries.slice(0, 3)) {  // limit to 3 queries to avoid rate limits
    const reports = await searchReddit(query, 5)
    allReports.push(...reports)
    platformCounts['reddit'] = (platformCounts['reddit'] ?? 0) + reports.length
    await new Promise(r => setTimeout(r, 1_500))  // rate limit
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const uniqueReports = allReports.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  return {
    totalReports:   uniqueReports.length,
    uniqueSources:  [...seen],
    platformCounts,
    reports:        uniqueReports,
  }
}

// ─── Scammer Database Lookup ────────────────────────────────────────────────

let scammerDbCache: ScammerDbEntry[] | null = null

/**
 * Load and parse the OpenClaw scammer database CSV.
 */
function loadScammerDb(): ScammerDbEntry[] {
  if (scammerDbCache) return scammerDbCache

  for (const csvPath of SCAMMER_DB_PATHS) {
    try {
      const raw = readFileSync(csvPath, 'utf-8')
      const lines = raw.trim().split('\n')
      if (lines.length < 2) continue  // header only

      const entries: ScammerDbEntry[] = []

      // CSV format: Scammer Name, Platform, X Handle, Telegram Channel, Victims Count,
      //             Total Lost USD, Verification Level, Scam Type, Last Updated, Notes, ...
      for (let i = 1; i < lines.length; i++) {
        // Handle quoted fields with commas inside them
        const cols: string[] = []
        let current = ''
        let inQuotes = false
        for (const ch of lines[i]) {
          if (ch === '"') { inQuotes = !inQuotes; continue }
          if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue }
          current += ch
        }
        cols.push(current.trim())

        if (cols.length < 7) continue

        entries.push({
          name:             cols[0] ?? '',
          platform:         cols[1] ?? '',
          xHandle:          cols[2] || undefined,
          telegramChannel:  cols[3] || undefined,
          status:           cols[6] ?? 'Unverified',   // Verification Level is col 6
          riskScore:        undefined,                  // extract from notes if needed
          victims:          parseInt(cols[4] ?? '0', 10) || 0,
          notes:            cols[9] ?? cols[7] ?? '',   // Notes is col 9, Scam Type fallback col 7
        })
      }

      scammerDbCache = entries
      console.log(`[scam-service/db] ✓ Loaded ${entries.length} scammer records from ${csvPath}`)
      return entries
    } catch {
      // try next path
    }
  }

  console.warn('[scam-service/db] could not load scammer database')
  scammerDbCache = []
  return []
}

/**
 * Look up a username in the scammer database.
 */
export function lookupScammerDb(username: string, platform?: 'X' | 'Telegram'): ScammerDbEntry | undefined {
  const db = loadScammerDb()
  const handle = username.replace(/^@/, '').toLowerCase()

  return db.find(entry => {
    const xMatch  = entry.xHandle?.replace(/^@/, '').toLowerCase() === handle
    const tgMatch = entry.telegramChannel?.replace(/^@/, '').toLowerCase() === handle
    const nameMatch = entry.name.toLowerCase() === handle

    if (platform === 'X')        return xMatch || nameMatch
    if (platform === 'Telegram') return tgMatch || nameMatch
    return xMatch || tgMatch || nameMatch
  })
}

// ─── Enhanced Risk Score Calculation ────────────────────────────────────────

/**
 * Compute enhanced risk score using the OpenClaw framework weighted formula.
 * Ref: scam-detection-framework.md § Risk Score Calculation
 *
 * Base risk comes from existing Telegram/X analysis, then we add:
 *   +0–4 pts from X profile red flags
 *   +0–3 pts from wallet red flags
 *   +0–2 pts from victim report volume
 *   +0–2 pts from scammer DB match
 */
export function computeEnhancedRiskScore(
  baseScore:       number,
  xFlags?:         XProfileRedFlags,
  walletFlags?:    WalletRedFlags,
  victimAnalysis?: VictimAnalysis,
  dbMatch?:        ScammerDbEntry,
): number {
  let score = baseScore

  // X profile contribution
  if (xFlags) score += xFlags.riskContribution

  // Wallet contribution
  if (walletFlags) score += walletFlags.riskContribution

  // Victim reports contribution
  if (victimAnalysis) {
    if (victimAnalysis.totalReports >= 5)      score += 2
    else if (victimAnalysis.totalReports >= 2) score += 1
    else if (victimAnalysis.totalReports >= 1) score += 0.5
  }

  // Known scammer DB match
  if (dbMatch) {
    if (dbMatch.status === 'Verified' || dbMatch.status === 'Highly Verified') score += 2
    else if (dbMatch.status === 'Partially Verified')                          score += 1
    else                                                                        score += 0.5
  }

  return Math.min(10, Math.max(1, parseFloat(score.toFixed(1))))
}

// ─── Full Enhanced Scam Analysis ────────────────────────────────────────────

/**
 * Run the full OpenClaw-enhanced scam analysis pipeline for any platform.
 * Returns enrichment data to merge into ScamDetectionResult.
 */
export async function runEnhancedAnalysis(
  username: string,
  platform: 'X' | 'Telegram',
  walletAddress?: string,
): Promise<EnhancedScamData> {
  const data: EnhancedScamData = {}

  // Run analyses in parallel where possible
  const promises: Promise<void>[] = []

  // X profile scraping (for X platform)
  if (platform === 'X') {
    promises.push(
      fetchXProfile(username).then(profile => { data.xProfile = profile }),
    )
  }

  // Wallet analysis (if wallet address provided)
  if (walletAddress) {
    promises.push(
      analyzeWallet(walletAddress).then(wallet => {
        if (wallet) data.walletAnalysis = wallet
      }),
    )
  }

  // Victim report search
  promises.push(
    searchVictimReports(username).then(analysis => { data.victimAnalysis = analysis }),
  )

  // Scammer database lookup (sync, fast)
  data.dbMatch = lookupScammerDb(username, platform)

  await Promise.allSettled(promises)

  return data
}
