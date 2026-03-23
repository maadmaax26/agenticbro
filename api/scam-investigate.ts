/**
 * api/scam-investigate.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Serverless Function — runs the full OpenClaw scam detection pipeline
 * entirely in TypeScript (no Python dependency). Mirrors the Express backend
 * route at /api/telegram/scam-investigate but works on Vercel's edge.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'
import { TelegramClient, Api } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'

// Vercel request/response extend Node's http types
type VercelRequest = IncomingMessage & { body?: any; method?: string }
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse
  json: (data: any) => void
  setHeader: (name: string, value: string) => VercelResponse
  end: () => void
}

// ─── Inline scammer database ────────────────────────────────────────────────
// Use readFileSync + __dirname which is reliable in Vercel serverless
let scammerDb: any[] = []
try {
  const raw = readFileSync(join(__dirname, 'scammer-database.json'), 'utf-8')
  scammerDb = JSON.parse(raw)
} catch {
  // fallback: empty database
  scammerDb = []
}

// ─── Telegram group intelligence ────────────────────────────────────────────
// Search the AgenticBro scam intel Telegram group for mentions of the target
const SCAM_INTEL_GROUP_ID = BigInt('-100' + '5183433558') // Telegram supergroup prefix

interface TelegramIntelMessage {
  date: string
  sender: string
  text: string
}

interface TelegramIntelResult {
  groupId: string
  messagesSearched: number
  matchingMessages: TelegramIntelMessage[]
  error?: string
}

async function searchTelegramGroup(targetUsername: string): Promise<TelegramIntelResult> {
  const result: TelegramIntelResult = {
    groupId: '5183433558',
    messagesSearched: 0,
    matchingMessages: [],
  }

  const apiId = process.env.TELEGRAM_API_ID
  const apiHash = process.env.TELEGRAM_API_HASH
  const sessionStr = process.env.TELEGRAM_SESSION_STRING

  if (!apiId || !apiHash || !sessionStr) {
    result.error = 'Telegram credentials not configured'
    return result
  }

  let client: TelegramClient | null = null
  try {
    const session = new StringSession(sessionStr)
    client = new TelegramClient(session, parseInt(apiId, 10), apiHash, {
      connectionRetries: 2,
      retryDelay: 1000,
      autoReconnect: false,
    })

    await client.connect()

    const handle = targetUsername.replace(/^@/, '').toLowerCase()

    // Search for messages mentioning the target in the scam intel group
    const searchResult = await client.invoke(
      new Api.messages.Search({
        peer: SCAM_INTEL_GROUP_ID,
        q: handle,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate: 0,
        maxDate: 0,
        offsetId: 0,
        addOffset: 0,
        limit: 50,
        maxId: 0,
        minId: 0,
        hash: BigInt(0),
      }),
    )

    if ('messages' in searchResult) {
      result.messagesSearched = searchResult.messages.length

      for (const msg of searchResult.messages) {
        if ('message' in msg && msg.message) {
          const text = msg.message
          // Only include messages that actually reference the target
          if (text.toLowerCase().includes(handle)) {
            let sender = 'Unknown'
            if ('fromId' in msg && msg.fromId) {
              if ('userId' in msg.fromId) {
                sender = `User ${msg.fromId.userId}`
              }
            }

            result.matchingMessages.push({
              date: msg.date ? new Date(msg.date * 1000).toISOString() : 'Unknown',
              sender,
              text: text.length > 500 ? text.slice(0, 500) + '…' : text,
            })
          }
        }
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    if (client) {
      try { await client.disconnect() } catch {}
    }
  }

  return result
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScammerDbRow {
  'Scammer Name': string
  'Platform': string
  'X Handle': string
  'Telegram Channel': string
  'Victims Count': string
  'Total Lost USD': string
  'Verification Level': string
  'Scam Type': string
  'Last Updated': string
  'Notes': string
  'Wallet Address': string
  'Evidence Links': string
}

interface WalletTx {
  tx_hash: string
  type: string
  timestamp: number
  amount: number
  from: string
  to: string
}

interface WalletAnalysis {
  address: string
  blockchain: string
  balance_sol?: number
  balance_eth?: number
  balance_usd: number
  transactions: WalletTx[]
  received_from_victims: { from: string; amount: number; timestamp: number }[]
  total_received: number
  total_sent: number
  analyzed_at: string
}

interface VictimReport {
  title: string
  url: string
  snippet?: string
  platform: string
  subreddit?: string
  author?: string
  score?: number
}

interface XProfile {
  username: string
  profile_url: string
  name?: string
  bio?: string
  followers?: number
  following?: number
  is_verified: boolean
  profile_image?: string
  location?: string
  website?: string
  created_at?: string
  collected_at: string
}

// ─── Scammer Database Lookup ────────────────────────────────────────────────

function lookupDatabase(username: string, platform: 'X' | 'Telegram'): ScammerDbRow | undefined {
  const handle = username.replace(/^@/, '').toLowerCase()
  const db = scammerDb as ScammerDbRow[]

  return db.find(entry => {
    const xMatch = entry['X Handle']?.replace(/^@/, '').toLowerCase() === handle
    const tgMatch = entry['Telegram Channel']?.replace(/^@/, '').toLowerCase() === handle
    const nameMatch = entry['Scammer Name']?.toLowerCase() === handle

    if (platform === 'X') return xMatch || nameMatch
    if (platform === 'Telegram') return tgMatch || nameMatch
    return xMatch || tgMatch || nameMatch
  })
}

// ─── X Profile Scraper ──────────────────────────────────────────────────────

async function fetchXProfile(username: string): Promise<XProfile> {
  const handle = username.replace(/^@/, '').trim()
  const profile: XProfile = {
    username: handle,
    profile_url: `https://x.com/${handle}`,
    is_verified: false,
    collected_at: new Date().toISOString(),
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)

    const res = await fetch(`https://x.com/${handle}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return profile

    const html = await res.text()

    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)
    const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
    const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)

    if (ogTitle) profile.name = ogTitle[1]
    if (ogDesc) profile.bio = ogDesc[1]
    if (ogImage) profile.profile_image = ogImage[1]
    if (!profile.bio && metaDesc) profile.bio = metaDesc[1]

    const followersMatch = html.match(/(\d[\d,]+)\s*Followers/i)
    const followingMatch = html.match(/(\d[\d,]+)\s*Following/i)
    if (followersMatch) profile.followers = parseInt(followersMatch[1].replace(/,/g, ''), 10)
    if (followingMatch) profile.following = parseInt(followingMatch[1].replace(/,/g, ''), 10)

    if (html.includes('isVerified') || html.includes('verified_type')) {
      profile.is_verified = true
    }
  } catch {
    // scrape failed — return basic profile
  }

  return profile
}

// ─── X Profile Red Flags ────────────────────────────────────────────────────

function analyzeXFlags(profile: XProfile): { flags: string[]; evidence: string[]; risk: number } {
  const flags: string[] = []
  const evidence: string[] = []
  let risk = 0
  const bio = (profile.bio ?? '').toLowerCase()

  if (/guarantee|100%|risk.?free|can't lose/i.test(bio)) {
    flags.push('Bio contains guaranteed-returns language (weight: 9/10)')
    evidence.push('Bio text contains scam patterns commonly used by fraud accounts')
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
  if (profile.followers !== undefined && profile.followers < 100) {
    flags.push(`Very low follower count (${profile.followers})`)
    evidence.push('Low follower count can indicate a new or fake account')
    risk += 0.5
  }
  if (!profile.is_verified) {
    flags.push('Account is not verified (weight: 5/10)')
    evidence.push('Unverified accounts have lower credibility on X')
    risk += 0.3
  }

  return { flags, evidence, risk: Math.min(risk, 4) }
}

// ─── Wallet Analyzer ────────────────────────────────────────────────────────

const SOLSCAN_API = 'https://public-api.solscan.io'
const ETHERSCAN_API = 'https://api.etherscan.io/api'

async function analyzeSolanaWallet(address: string): Promise<WalletAnalysis> {
  const result: WalletAnalysis = {
    address,
    blockchain: 'Solana',
    balance_sol: 0,
    balance_usd: 0,
    transactions: [],
    received_from_victims: [],
    total_received: 0,
    total_sent: 0,
    analyzed_at: new Date().toISOString(),
  }

  try {
    const balRes = await fetch(`${SOLSCAN_API}/account?address=${address}`, {
      headers: { 'User-Agent': 'AgenticBro/1.0' },
    })
    if (balRes.ok) {
      const data = (await balRes.json()) as { data?: { lamports?: number } }
      result.balance_sol = (data.data?.lamports ?? 0) / 1e9
      result.balance_usd = result.balance_sol * 150
    }

    const txRes = await fetch(`${SOLSCAN_API}/account/transactions?address=${address}&limit=20`, {
      headers: { 'User-Agent': 'AgenticBro/1.0' },
    })
    if (txRes.ok) {
      const txData = (await txRes.json()) as { data?: any[] }
      for (const tx of txData.data ?? []) {
        const info = tx?.parsedInstruction?.info ?? {}
        const transaction: WalletTx = {
          tx_hash: tx.txHash ?? '',
          type: tx.type ?? '',
          timestamp: tx.blockTime ?? 0,
          amount: (info.lamports ?? 0) / 1e9,
          from: info.source ?? '',
          to: info.destination ?? '',
        }
        result.transactions.push(transaction)

        if (transaction.type === 'transfer' && transaction.to === address) {
          result.received_from_victims.push({
            from: transaction.from,
            amount: transaction.amount,
            timestamp: transaction.timestamp,
          })
          result.total_received += transaction.amount
        }
        if (transaction.from === address) {
          result.total_sent += transaction.amount
        }
      }
    }
  } catch {
    // wallet analysis failed
  }

  return result
}

async function analyzeEthWallet(address: string): Promise<WalletAnalysis> {
  const result: WalletAnalysis = {
    address,
    blockchain: 'Ethereum',
    balance_eth: 0,
    balance_usd: 0,
    transactions: [],
    received_from_victims: [],
    total_received: 0,
    total_sent: 0,
    analyzed_at: new Date().toISOString(),
  }

  try {
    const balRes = await fetch(
      `${ETHERSCAN_API}?module=account&action=balance&address=${address}&tag=latest`,
    )
    if (balRes.ok) {
      const data = (await balRes.json()) as { result?: string }
      result.balance_eth = parseInt(data.result ?? '0', 10) / 1e18
      result.balance_usd = result.balance_eth * 3000
    }

    const txRes = await fetch(
      `${ETHERSCAN_API}?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=20`,
    )
    if (txRes.ok) {
      const txData = (await txRes.json()) as { result?: any[] }
      for (const tx of txData.result ?? []) {
        const valueEth = parseInt(tx.value ?? '0', 10) / 1e18
        const transaction: WalletTx = {
          tx_hash: tx.hash ?? '',
          type: tx.to?.toLowerCase() === address.toLowerCase() ? 'receive' : 'send',
          timestamp: parseInt(tx.timeStamp ?? '0', 10),
          amount: valueEth,
          from: tx.from ?? '',
          to: tx.to ?? '',
        }
        result.transactions.push(transaction)

        if (transaction.to.toLowerCase() === address.toLowerCase()) {
          result.received_from_victims.push({
            from: transaction.from,
            amount: transaction.amount,
            timestamp: transaction.timestamp,
          })
          result.total_received += transaction.amount
        }
        if (transaction.from.toLowerCase() === address.toLowerCase()) {
          result.total_sent += transaction.amount
        }
      }
    }
  } catch {
    // wallet analysis failed
  }

  return result
}

async function analyzeWallet(address: string): Promise<WalletAnalysis | null> {
  if (!address?.trim()) return null
  const addr = address.trim()
  if (addr.startsWith('0x') && addr.length === 42) return analyzeEthWallet(addr)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) return analyzeSolanaWallet(addr)
  return null
}

function analyzeWalletFlags(wallet: WalletAnalysis): { flags: string[]; evidence: string[]; risk: number } {
  const flags: string[] = []
  const evidence: string[] = []
  let risk = 0

  const uniqueSenders = new Set(wallet.received_from_victims.map(v => v.from))
  if (uniqueSenders.size >= 5) {
    flags.push(`Received from ${uniqueSenders.size} unique senders (potential victims)`)
    evidence.push(
      `Wallet received funds from ${uniqueSenders.size} different addresses — pattern consistent with collecting from victims`,
    )
    risk += 1.5
  }

  if (wallet.total_sent > 0 && wallet.total_received > 0) {
    const outflowRatio = wallet.total_sent / wallet.total_received
    if (outflowRatio > 0.8) {
      flags.push('High outflow ratio — most received funds sent elsewhere')
      evidence.push(
        `${(outflowRatio * 100).toFixed(0)}% of received funds were sent out, consistent with laundering or consolidation`,
      )
      risk += 1
    }
  }

  if (wallet.transactions.length >= 10 && (wallet.balance_sol ?? wallet.balance_eth ?? 0) < 0.01) {
    flags.push('Near-zero balance despite transaction history')
    evidence.push('Wallet has been emptied — common scam pattern where funds are quickly moved out')
    risk += 0.5
  }

  return { flags, evidence, risk: Math.min(risk, 3) }
}

// ─── Victim Report Search ───────────────────────────────────────────────────

async function searchReddit(query: string, limit = 5): Promise<VictimReport[]> {
  const results: VictimReport[] = []
  try {
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=relevance`,
      { headers: { 'User-Agent': 'AgenticBro/1.0 ScamDetection' } },
    )
    if (!res.ok) return results

    const data = (await res.json()) as {
      data?: {
        children?: {
          data: { title: string; permalink: string; subreddit: string; author: string; score: number }
        }[]
      }
    }

    for (const post of data.data?.children ?? []) {
      const d = post.data
      results.push({
        title: d.title,
        url: `https://reddit.com${d.permalink}`,
        platform: 'Reddit',
        subreddit: d.subreddit,
        author: d.author,
        score: d.score,
      })
    }
  } catch {
    // search failed
  }
  return results
}

const SEARCH_TERMS = ['scammed by', 'lost money to', 'rugged by', 'is a scammer', 'scam']

async function searchVictimReports(
  username: string,
): Promise<{ total_reports: number; unique_sources: string[]; common_platforms: Record<string, number>; reports: Record<string, VictimReport[]> }> {
  const handle = username.replace(/^@/, '').trim()
  const allReports: VictimReport[] = []
  const platformCounts: Record<string, number> = {}

  const queries = SEARCH_TERMS.map(term => `${term} @${handle}`)

  // Run queries in parallel (no rate limiting needed per invocation)
  const queryResults = await Promise.allSettled(
    queries.slice(0, 3).map(q => searchReddit(q, 5)),
  )

  for (const result of queryResults) {
    if (result.status === 'fulfilled') {
      allReports.push(...result.value)
      platformCounts['reddit'] = (platformCounts['reddit'] ?? 0) + result.value.length
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const uniqueReports = allReports.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  return {
    total_reports: uniqueReports.length,
    unique_sources: [...seen],
    common_platforms: platformCounts,
    reports: { reddit: uniqueReports },
  }
}

// ─── Risk Score Calculation ─────────────────────────────────────────────────

function computeRiskScore(
  xFlagRisk: number,
  walletFlagRisk: number,
  victimCount: number,
  dbMatch: ScammerDbRow | undefined,
): number {
  let score = 1 // base

  score += xFlagRisk
  score += walletFlagRisk

  if (victimCount >= 5) score += 2
  else if (victimCount >= 2) score += 1
  else if (victimCount >= 1) score += 0.5

  if (dbMatch) {
    const level = dbMatch['Verification Level']
    if (level === 'Verified' || level === 'High Risk') score += 2
    else if (level === 'Partially Verified') score += 1
    else if (level === 'Legitimate') score -= 2
    else score += 0.5
  }

  return Math.min(10, Math.max(1, parseFloat(score.toFixed(1))))
}

function getRecommendation(score: number): string {
  if (score >= 7)
    return 'DO NOT INVEST \u2014 HIGH RISK SCAM. Multiple red flags detected. Avoid all calls and interactions.'
  if (score >= 4)
    return 'PROCEED WITH CAUTION \u2014 MODERATE RISK. Cross-reference with other sources before engaging.'
  return 'LOW RISK. No major red flags detected, but always DYOR (Do Your Own Research).'
}

function getScamType(
  xFlags: string[],
  walletFlags: string[],
  dbMatch: ScammerDbRow | undefined,
): string | undefined {
  if (dbMatch && dbMatch['Scam Type'] && dbMatch['Scam Type'] !== 'Unknown' && dbMatch['Scam Type'] !== 'N/A') {
    return dbMatch['Scam Type']
  }
  if (xFlags.some(f => f.includes('guaranteed-returns'))) return 'Guaranteed Returns Scam'
  if (xFlags.some(f => f.includes('solicits crypto'))) return 'Advance Fee / Payment Solicitation'
  if (walletFlags.some(f => f.includes('unique senders'))) return 'Wallet Drainer'
  return undefined
}

// ─── Generate Full Report ───────────────────────────────────────────────────

function generateFullReport(
  username: string,
  platform: string,
  xProfile: XProfile | null,
  walletAnalysis: WalletAnalysis | null,
  victimData: { total_reports: number; reports: Record<string, VictimReport[]> },
  dbMatch: ScammerDbRow | undefined,
  riskScore: number,
  allFlags: string[],
  telegramIntel?: TelegramIntelResult,
): string {
  const lines: string[] = [
    '=' .repeat(60),
    'OPENCLAW SCAMMER DETECTION SERVICE',
    'Full Investigation Report',
    '=' .repeat(60),
    '',
    `Target: @${username}`,
    `Platform: ${platform}`,
    `Investigation Date: ${new Date().toISOString()}`,
    `Risk Score: ${riskScore}/10`,
    '',
  ]

  // Database status
  if (dbMatch) {
    lines.push(`DATABASE STATUS: KNOWN ${dbMatch['Verification Level'].toUpperCase()} — ${dbMatch['Scam Type']}`)
    lines.push(`  Victims: ${dbMatch['Victims Count']} | Total Lost: $${dbMatch['Total Lost USD']}`)
    if (dbMatch['Notes']) lines.push(`  Notes: ${dbMatch['Notes']}`)
    lines.push('')
  } else {
    lines.push('DATABASE STATUS: Not in known scammer database')
    lines.push('')
  }

  // Red flags
  if (allFlags.length > 0) {
    lines.push('-'.repeat(40))
    lines.push(`RED FLAGS (${allFlags.length}):`)
    allFlags.forEach(f => lines.push(`  \u26a0 ${f}`))
    lines.push('')
  }

  // X Profile
  if (xProfile) {
    lines.push('-'.repeat(40))
    lines.push('X/TWITTER PROFILE:')
    lines.push(`  Name: ${xProfile.name ?? 'N/A'}`)
    lines.push(`  Bio: ${xProfile.bio ?? 'N/A'}`)
    lines.push(`  Followers: ${xProfile.followers ?? 'N/A'}`)
    lines.push(`  Following: ${xProfile.following ?? 'N/A'}`)
    lines.push(`  Verified: ${xProfile.is_verified ? 'Yes' : 'No'}`)
    lines.push(`  URL: ${xProfile.profile_url}`)
    lines.push('')
  }

  // Wallet
  if (walletAnalysis) {
    lines.push('-'.repeat(40))
    lines.push('WALLET ANALYSIS:')
    lines.push(`  Address: ${walletAnalysis.address}`)
    lines.push(`  Blockchain: ${walletAnalysis.blockchain}`)
    lines.push(`  Balance: $${walletAnalysis.balance_usd.toFixed(2)}`)
    lines.push(`  Total Received: ${walletAnalysis.total_received.toFixed(4)}`)
    lines.push(`  Total Sent: ${walletAnalysis.total_sent.toFixed(4)}`)
    lines.push(`  Unique Senders: ${new Set(walletAnalysis.received_from_victims.map(v => v.from)).size}`)
    lines.push(`  Transactions Analyzed: ${walletAnalysis.transactions.length}`)
    lines.push('')
  }

  // Victim reports
  lines.push('-'.repeat(40))
  lines.push(`VICTIM REPORTS: ${victimData.total_reports} found`)
  const allVictimReports = Object.values(victimData.reports).flat()
  allVictimReports.slice(0, 5).forEach(r => {
    lines.push(`  - ${r.title}`)
    lines.push(`    ${r.url}`)
  })
  lines.push('')

  // Telegram group intelligence
  if (telegramIntel) {
    lines.push('-'.repeat(40))
    lines.push(`TELEGRAM GROUP INTELLIGENCE (Group ID: ${telegramIntel.groupId}):`)
    if (telegramIntel.error) {
      lines.push(`  Status: ${telegramIntel.error}`)
    } else if (telegramIntel.matchingMessages.length > 0) {
      lines.push(`  Messages Found: ${telegramIntel.matchingMessages.length} mention(s) of @${username}`)
      lines.push('')
      telegramIntel.matchingMessages.slice(0, 10).forEach((msg, i) => {
        lines.push(`  [${i + 1}] ${msg.date} — ${msg.sender}`)
        lines.push(`      ${msg.text}`)
        lines.push('')
      })
    } else {
      lines.push(`  No mentions of @${username} found in scam intel group (${telegramIntel.messagesSearched} messages searched)`)
    }
    lines.push('')
  }

  // Recommendation
  lines.push('-'.repeat(40))
  lines.push(`RECOMMENDATION: ${getRecommendation(riskScore)}`)
  lines.push('')
  lines.push('=' .repeat(60))
  lines.push('DISCLAIMER: This report contains only publicly available information.')
  lines.push('Do not harass or contact subjects directly. File reports with authorities.')
  lines.push('=' .repeat(60))

  return lines.join('\n')
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { username, platform, walletAddress } = req.body ?? {}

  if (!username || !platform) {
    return res.status(400).json({ error: 'Missing username or platform' })
  }

  const handle = String(username).replace(/^@/, '').trim()
  const plat = platform as 'X' | 'Telegram'

  try {
    // Run all analyses in parallel (including Telegram group intel)
    const [xProfile, walletResult, victimData, telegramIntel] = await Promise.all([
      plat === 'X' ? fetchXProfile(handle) : Promise.resolve(null),
      walletAddress ? analyzeWallet(String(walletAddress)) : Promise.resolve(null),
      searchVictimReports(handle),
      searchTelegramGroup(handle),
    ])

    // Database lookup (sync)
    const dbMatch = lookupDatabase(handle, plat)

    // Analyze flags
    const xFlags = xProfile ? analyzeXFlags(xProfile) : { flags: [], evidence: [], risk: 0 }
    const walletFlags = walletResult
      ? analyzeWalletFlags(walletResult)
      : { flags: [], evidence: [], risk: 0 }

    // Compute risk score
    const allFlags = [...xFlags.flags, ...walletFlags.flags]
    const riskScore = computeRiskScore(
      xFlags.risk,
      walletFlags.risk,
      victimData.total_reports,
      dbMatch,
    )

    const scamType = getScamType(xFlags.flags, walletFlags.flags, dbMatch)

    // Add Telegram intel to red flags if matches found
    if (telegramIntel.matchingMessages.length > 0) {
      allFlags.push(`${telegramIntel.matchingMessages.length} mention(s) found in Telegram scam intel group`)
    }

    // Generate full text report
    const fullReport = generateFullReport(
      handle,
      plat,
      xProfile,
      walletResult,
      victimData,
      dbMatch,
      riskScore,
      allFlags,
      telegramIntel,
    )

    // Build response in the shape the frontend expects
    const investigation = {
      scammer_data: {
        x_handle: plat === 'X' ? `@${handle}` : undefined,
        telegram_channel: plat === 'Telegram' ? `@${handle}` : undefined,
        wallet_address: walletAddress || undefined,
        blockchain: walletResult?.blockchain || undefined,
      },
      investigation_date: new Date().toISOString(),
      twitter_profile: xProfile
        ? {
            username: xProfile.username,
            profile_url: xProfile.profile_url,
            name: xProfile.name,
            bio: xProfile.bio,
            followers: xProfile.followers,
            following: xProfile.following,
            is_verified: xProfile.is_verified,
            profile_image: xProfile.profile_image,
            location: xProfile.location,
            website: xProfile.website,
            collected_at: xProfile.collected_at,
          }
        : undefined,
      wallet_analysis: walletResult || undefined,
      victim_reports: victimData.reports,
      victim_analysis: {
        total_reports: victimData.total_reports,
        unique_sources: victimData.unique_sources,
        common_platforms: victimData.common_platforms,
      },
      database_match: dbMatch || undefined,
      enhanced: {
        riskScore,
        redFlags: allFlags,
        verificationLevel: dbMatch?.['Verification Level'] ?? 'Unverified',
        scamType,
        recommendedAction: getRecommendation(riskScore),
      },
      full_report: fullReport,
      telegram_intel: telegramIntel.matchingMessages.length > 0 || telegramIntel.error
        ? {
            group_id: telegramIntel.groupId,
            messages_found: telegramIntel.matchingMessages.length,
            messages: telegramIntel.matchingMessages,
            error: telegramIntel.error,
          }
        : undefined,
    }

    return res.status(200).json({ investigation })
  } catch (err) {
    console.error('[scam-investigate] Error:', err)
    return res.status(500).json({
      error: 'Investigation failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}
