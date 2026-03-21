/**
 * server/telegram/ingestion.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pulls messages from tracked Telegram channels, parses them into alpha calls,
 * enriches each call with DEX market data, and scores them.
 *
 * Two modes:
 *   fetchAlphaFeed()     – fast, uses rolling in-process cache (60s TTL)
 *   runPriorityScan()    – always fetches fresh data, bypasses cache
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getTelegramClient, getTrackedChannels, type TrackedChannel } from './client.js'
import { parseMessages, scoreShillProbability, scoreUrgency, type RawMessage } from './parser.js'
import { getTokenData, getTokenSecurity } from './dex.js'
import { scoreCall, filterGems, computeSummary, buildScamAnalysis, type ScoredCall, type GemAdviseOptions } from './scorer.js'
import { Api } from 'telegram'
import {
  runEnhancedAnalysis,
  analyzeXProfileFlags,
  analyzeWalletFlags,
  computeEnhancedRiskScore,
  type EnhancedScamData,
  type XProfileData,
  type WalletAnalysis,
  type VictimAnalysis,
  type ScammerDbEntry,
} from './scam-service.js'

// ─── Channel resolver ─────────────────────────────────────────────────────────
// Tries the exact username first; on failure, searches Telegram for a match.

async function resolveChannelUsername(input: string): Promise<string> {
  const client = await getTelegramClient()

  // 1. Try direct entity resolve (fast — works if the username is correct)
  try {
    const entity = await client.getEntity(input)
    // Return the canonical username (or the original input if entity has no username)
    const resolved = (entity as any).username ?? input
    console.log(`[telegram/resolve] "${input}" → resolved as @${resolved}`)
    return resolved
  } catch {
    // Username not found — fall through to search
  }

  // 2. Search Telegram by name/query (slower but handles fuzzy input)
  try {
    // Strip underscores / hyphens and search the "human-readable" name
    const searchQuery = input.replace(/[_\-]/g, ' ').trim()
    console.log(`[telegram/resolve] "${input}" not found, searching for "${searchQuery}"…`)

    const result = await client.invoke(
      new Api.contacts.Search({ q: searchQuery, limit: 5 }),
    )

    // Look for a channel/supergroup match (ignore users)
    const chats = (result.chats ?? []) as any[]
    for (const chat of chats) {
      if (chat.username) {
        console.log(`[telegram/resolve] search found @${chat.username} (${chat.title})`)
        return chat.username
      }
    }
  } catch (err) {
    console.warn(`[telegram/resolve] search failed:`, err instanceof Error ? err.message : err)
  }

  // 3. Nothing found — return original input so the caller can show a clear error
  return input
}

// ─── Rolling feed cache ───────────────────────────────────────────────────────

interface FeedCache {
  calls:     ScoredCall[]
  fetchedAt: number
}

let feedCache: FeedCache | null = null
const FEED_CACHE_TTL = 60_000    // 60 seconds

// ─── Message fetcher ──────────────────────────────────────────────────────────

async function fetchChannelMessages(
  channelUsername: string,
  limit: number,
): Promise<RawMessage[]> {
  const client = await getTelegramClient()

  const messages = await client.getMessages(channelUsername, { limit })

  return messages
    .filter(m => m.text && m.text.length > 0)
    .map(m => ({
      id:              m.id,
      text:            m.text,
      date:            m.date,
      channelUsername,
    }))
}

/**
 * Paginate through a channel's history, collecting all messages since
 * `cutoffUnixSec` (Unix seconds). Stops when the oldest message in a batch
 * pre-dates the cutoff, or when `maxMessages` is reached.
 *
 * Telegram's getMessages API returns messages newest-first.
 * We walk backwards using `offsetId` (the ID of the last message seen).
 */
async function fetchChannelMessagesSince(
  channelUsername: string,
  cutoffUnixSec:   number,
  maxMessages      = 1_000,
): Promise<RawMessage[]> {
  const client   = await getTelegramClient()
  const all: RawMessage[] = []
  let   offsetId = 0          // 0 = start from newest

  console.log(`[telegram/ingestion] fetching ${channelUsername} since ${new Date(cutoffUnixSec * 1000).toISOString().slice(0, 10)} (max ${maxMessages} msgs)`)

  while (all.length < maxMessages) {
    const batchSize = Math.min(100, maxMessages - all.length)

    const batch = await client.getMessages(channelUsername, {
      limit:    batchSize,
      offsetId: offsetId === 0 ? undefined : offsetId,
    })

    if (batch.length === 0) break    // channel exhausted

    for (const m of batch) {
      if (!m.text || m.text.length === 0) continue
      if (m.date < cutoffUnixSec) {
        // Reached messages older than cutoff — stop entirely
        console.log(`[telegram/ingestion] ${channelUsername}: reached cutoff at msg ${m.id} (${new Date(m.date * 1000).toISOString().slice(0, 10)}), collected ${all.length} msgs`)
        return all
      }
      all.push({ id: m.id, text: m.text, date: m.date, channelUsername })
    }

    if (batch.length < batchSize) break    // fewer than requested = no more messages

    offsetId = batch[batch.length - 1].id  // oldest in this batch → next page starts here
    await new Promise(r => setTimeout(r, 350))  // respect Telegram rate limits
  }

  console.log(`[telegram/ingestion] ${channelUsername}: collected ${all.length} msgs (limit reached)`)
  return all
}

// ─── Rate-limited parallel fetch ─────────────────────────────────────────────

async function fetchAllChannels(
  channels: TrackedChannel[],
  limit:    number,
): Promise<{ channel: TrackedChannel; messages: RawMessage[] }[]> {
  const results: { channel: TrackedChannel; messages: RawMessage[] }[] = []

  // Sequential with small delay to respect Telegram rate limits
  for (const channel of channels) {
    try {
      const messages = await fetchChannelMessages(channel.username, limit)
      results.push({ channel, messages })
      await new Promise(r => setTimeout(r, 300))   // 300ms between channels
    } catch (err) {
      console.warn(`[telegram/ingestion] failed to fetch ${channel.username}:`, err instanceof Error ? err.message : err)
    }
  }

  return results
}

// ─── Enrich + score pipeline ──────────────────────────────────────────────────

async function enrichAndScore(
  parsed:  ReturnType<typeof parseMessages>,
  channel: TrackedChannel,
  now:     number,
): Promise<ScoredCall[]> {
  const scored: ScoredCall[] = []

  // Rate-limit DEX calls — max 4 concurrent
  const BATCH = 4
  for (let i = 0; i < parsed.length; i += BATCH) {
    const batch = parsed.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map(async call => {
        const dex  = await getTokenData(call.ticker, call.contract)
        const ageMs = now - new Date(call.timestamp).getTime()
        return scoreCall(call, dex, channel, ageMs)
      })
    )
    for (const r of results) {
      if (r.status === 'fulfilled') scored.push(r.value)
    }
  }

  return scored
}

// ─── GoPlus security enrichment ───────────────────────────────────────────────

/**
 * Enrich the top N scored calls with GoPlus on-chain security data.
 * Runs sequentially to avoid rate-limiting GoPlus (free tier).
 */
async function enrichWithSecurity(calls: ScoredCall[], topN = 10): Promise<ScoredCall[]> {
  const enriched = [...calls]
  const toCheck  = enriched.slice(0, topN)

  for (let i = 0; i < toCheck.length; i++) {
    const call = toCheck[i]
    if (!call.contract || !call.chainId) continue
    try {
      const sec  = await getTokenSecurity(call.contract, call.chainId)
      enriched[i] = { ...call, scamAnalysis: buildScamAnalysis(sec) }
    } catch {
      // leave default UNKNOWN scamAnalysis
    }
  }

  return enriched
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Fetch and score alpha calls. Uses cache if fresh enough. */
export async function fetchAlphaFeed(limit = 10): Promise<ScoredCall[]> {
  if (feedCache && Date.now() - feedCache.fetchedAt < FEED_CACHE_TTL) {
    return feedCache.calls
  }

  const channels = getTrackedChannels()
  const now      = Date.now()
  const allCalls: ScoredCall[] = []

  const channelData = await fetchAllChannels(channels, limit)

  for (const { channel, messages } of channelData) {
    const parsed = parseMessages(messages)
    const scored = await enrichAndScore(parsed, channel, now)
    allCalls.push(...scored)
  }

  // Sort newest first
  const sorted = allCalls.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  feedCache = { calls: sorted, fetchedAt: Date.now() }
  return sorted
}

export interface PriorityScanOptions {
  wallet?:  string   // Solana or EVM wallet address
  channel?: string   // specific channel username / display name
  token?:   string   // ticker or contract address
}

/** Priority scan — always fresh, no cache. Used by PriorityScan tab. */
export async function runPriorityScan(
  target: 'all' | 'wallet' | 'channels' | 'token',
  opts:   PriorityScanOptions = {},
): Promise<ScoredCall[]> {
  // Invalidate cache so next fetchAlphaFeed also gets fresh data
  feedCache = null

  const channels = getTrackedChannels()
  const now      = Date.now()
  const allCalls: ScoredCall[] = []

  // ── Token scan: search every channel for a specific ticker / contract ──────
  if (target === 'token' && opts.token) {
    const searchTerm = opts.token.replace('$', '')
    for (const channel of channels) {
      try {
        const client   = await getTelegramClient()
        const messages = await client.getMessages(channel.username, { limit: 50, search: searchTerm })
        const rawMsgs: RawMessage[] = messages
          .filter(m => m.text)
          .map(m => ({ id: m.id, text: m.text, date: m.date, channelUsername: channel.username }))
        const parsed = parseMessages(rawMsgs)
        const scored = await enrichAndScore(parsed, channel, now)
        allCalls.push(...scored)
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        console.warn(`[telegram/scan] ${channel.username} token search failed:`, err instanceof Error ? err.message : err)
      }
    }
    return enrichWithSecurity(allCalls.sort((a, b) => b.edgeScore - a.edgeScore))
  }

  // ── Wallet scan: search channels for wallet mentions + cross-ref feed ──────
  if (target === 'wallet' && opts.wallet) {
    const addr = opts.wallet.trim()
    for (const channel of channels) {
      try {
        const client   = await getTelegramClient()
        // Search for short-form address (first 6 chars is enough to avoid false positives)
        const searchTerm = addr.startsWith('0x') ? addr.slice(0, 10) : addr.slice(0, 6)
        const messages = await client.getMessages(channel.username, { limit: 50, search: searchTerm })
        const rawMsgs: RawMessage[] = messages
          .filter(m => m.text)
          .map(m => ({ id: m.id, text: m.text, date: m.date, channelUsername: channel.username }))
        const parsed = parseMessages(rawMsgs)
        const scored = await enrichAndScore(parsed, channel, now)
        allCalls.push(...scored)
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        console.warn(`[telegram/scan] ${channel.username} wallet search failed:`, err instanceof Error ? err.message : err)
      }
    }
    // Fallback: if no channel results found, return scored feed filtered by recency
    if (allCalls.length === 0) {
      const feed = await fetchAlphaFeed(20)
      return feed.slice(0, 10)
    }
    return enrichWithSecurity(allCalls.sort((a, b) => b.edgeScore - a.edgeScore))
  }

  // ── Channel scan: deep-scan a specific channel (6 months of history) ────────
  if (target === 'channels' && opts.channel) {
    const rawInput = opts.channel.replace(/^@/, '').replace(/^t\.me\//, '').trim()

    // Resolve the username — tries direct entity lookup first, then Telegram search
    const resolvedUsername = await resolveChannelUsername(rawInput)

    // Try to match against tracked channels by resolved username
    const tracked = channels.find(
      c => c.username.toLowerCase() === resolvedUsername.toLowerCase() ||
           c.username.toLowerCase() === rawInput.toLowerCase() ||
           c.displayName.toLowerCase().includes(rawInput.toLowerCase())
    )
    const channelEntry = tracked
      ? { ...tracked, username: resolvedUsername }    // use resolved username but keep tracked metadata
      : {
          username:       resolvedUsername,
          displayName:    resolvedUsername,
          score:          0.60,
          classification: 'alpha' as const,
        }
    try {
      // 6 months back in Unix seconds
      const sixMonthsAgo = Math.floor((Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) / 1000)
      const messages = await fetchChannelMessagesSince(channelEntry.username, sixMonthsAgo)
      const parsed   = parseMessages(messages)
      const scored   = await enrichAndScore(parsed, channelEntry, now)

      // Deduplicate: keep only the highest-scored call per ticker
      const bestByTicker = new Map<string, typeof scored[number]>()
      for (const s of scored) {
        const key = s.ticker.toLowerCase()
        if (!bestByTicker.has(key) || s.edgeScore > bestByTicker.get(key)!.edgeScore) {
          bestByTicker.set(key, s)
        }
      }
      const deduped = [...bestByTicker.values()]

      console.log(
        `[telegram/scan] ${channelEntry.username}: ` +
        `${messages.length} msgs fetched → ${parsed.length} parsed → ` +
        `${scored.length} scored → ${deduped.length} unique tickers`,
      )

      return enrichWithSecurity(deduped.sort((a, b) => b.edgeScore - a.edgeScore))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Re-throw "not found" errors so the route can return a useful message to the user
      if (
        msg.includes('No user has') ||
        msg.includes('USERNAME_INVALID') ||
        msg.includes('CHANNEL_INVALID') ||
        msg.includes('cannot find')
      ) {
        throw new Error(
          `Channel "@${channelEntry.username}" was not found on Telegram. ` +
          `Check that the username is spelled correctly — it must match exactly (e.g. use the channel link: t.me/username).`,
        )
      }
      console.warn(`[telegram/scan] channel scan failed for ${channelEntry.username}:`, msg)
      return []
    }
  }

  // ── All channels scan ─────────────────────────────────────────────────────
  const channelData = await fetchAllChannels(channels, 30)
  for (const { channel, messages } of channelData) {
    const parsed = parseMessages(messages)
    const scored = await enrichAndScore(parsed, channel, now)
    allCalls.push(...scored)
  }
  return enrichWithSecurity(allCalls.sort((a, b) => b.edgeScore - a.edgeScore))
}

/** Get gem recommendations from the current feed cache or a fresh fetch. */
export async function getGemAdvise(options: GemAdviseOptions = {}): Promise<{
  gems: ScoredCall[]
  summary: ReturnType<typeof computeSummary>
}> {
  const calls = await fetchAlphaFeed(15)

  // Only consider 'gem' type calls for the gem advise tab
  const gemCalls = calls.filter(c => c.callType === 'gem')
  const gems     = filterGems(gemCalls, options)
  const summary  = computeSummary(gems)

  return { gems, summary }
}

// ─── Scam Detection ──────────────────────────────────────────────────────────

export interface ScamDetectionResult {
  username:           string
  platform:           'X' | 'Telegram'
  riskScore:          number   // 1–10
  redFlags:           string[]
  verificationLevel:  'Unverified' | 'Partially Verified' | 'Verified' | 'Highly Verified'
  scamType?:          string
  evidence:           string[]
  recommendedAction:  string
  stats?: {
    totalMessages:    number
    shillAvg:         number
    urgencyAvg:       number
    rugRate:          number
    uniqueTickers:    number
  }
  // ── Enhanced fields from OpenClaw integration ──
  xProfile?: {
    name?:          string
    bio?:           string
    followers?:     number
    following?:     number
    isVerified:     boolean
    profileImage?:  string
    profileUrl:     string
  }
  walletAnalysis?: {
    address:        string
    blockchain:     string
    balance:        number
    balanceUsd:     number
    totalReceived:  number
    totalSent:      number
    txCount:        number
    uniqueSenders:  number
  }
  victimReports?: {
    totalReports:   number
    reports:        { title: string; url: string; platform: string; score?: number }[]
  }
  knownScammer?: {
    name:           string
    status:         string
    victims:        number
    notes:          string
  }
}

/**
 * Analyze a Telegram channel/user or X account for scam patterns.
 *
 * For Telegram: fetches recent messages and computes aggregate shill/urgency/rug metrics.
 * For X: scrapes public profile, analyzes bio red flags, searches victim reports.
 * Both: enriches with OpenClaw scam-service (wallet analysis, victim reports, scammer DB).
 */
export async function runScamDetection(
  username: string,
  platform: 'X' | 'Telegram',
  walletAddress?: string,
): Promise<ScamDetectionResult> {

  // ── X (Twitter) analysis — FULL PIPELINE (integrated with OpenClaw) ──
  if (platform === 'X') {
    const handle = username.replace(/^@/, '').trim()

    // Run OpenClaw enhanced analysis (profile scrape + victim reports + wallet + DB)
    const enhanced = await runEnhancedAnalysis(handle, 'X', walletAddress)

    const redFlags:  string[] = []
    const evidence:  string[] = []
    let baseRisk = 2  // baseline

    // ── X profile red-flag analysis ──
    if (enhanced.xProfile) {
      const profileFlags = analyzeXProfileFlags(enhanced.xProfile)
      redFlags.push(...profileFlags.flags)
      evidence.push(...profileFlags.evidence)
      baseRisk += profileFlags.riskContribution
    } else {
      redFlags.push('Could not scrape X profile — profile may be private or suspended')
      evidence.push('X profile data unavailable; risk assessment is limited')
      baseRisk += 0.5
    }

    // ── Wallet red-flag analysis ──
    let walletFlags
    if (enhanced.walletAnalysis) {
      walletFlags = analyzeWalletFlags(enhanced.walletAnalysis)
      redFlags.push(...walletFlags.flags)
      evidence.push(...walletFlags.evidence)
    }

    // ── Victim reports ──
    if (enhanced.victimAnalysis && enhanced.victimAnalysis.totalReports > 0) {
      redFlags.push(`${enhanced.victimAnalysis.totalReports} victim report(s) found online`)
      evidence.push(
        `Found ${enhanced.victimAnalysis.totalReports} public reports across Reddit and web searches — ` +
        `cross-reference these before trusting calls from this account`,
      )
    }

    // ── Known scammer DB match ──
    if (enhanced.dbMatch) {
      const db = enhanced.dbMatch
      if (db.status === 'Verified' || db.status === 'Highly Verified') {
        redFlags.push(`⚠️ KNOWN SCAMMER in OpenClaw database (${db.status})`)
        evidence.push(`Previously investigated: "${db.notes}" — ${db.victims} victim(s) reported`)
      } else {
        redFlags.push(`Found in OpenClaw scammer database (${db.status})`)
        evidence.push(`Database entry: "${db.notes}"`)
      }
    }

    // ── Enhanced risk score ──
    const riskScore = computeEnhancedRiskScore(
      baseRisk,
      enhanced.xProfile ? analyzeXProfileFlags(enhanced.xProfile) : undefined,
      walletFlags,
      enhanced.victimAnalysis,
      enhanced.dbMatch,
    )

    // ── Verification level ──
    const verificationLevel: ScamDetectionResult['verificationLevel'] =
      enhanced.dbMatch?.status === 'Verified' || enhanced.dbMatch?.status === 'Highly Verified'
        ? 'Verified'
      : (enhanced.victimAnalysis?.totalReports ?? 0) >= 3 ? 'Partially Verified'
      : 'Unverified'

    // ── Scam type ──
    let scamType: string | undefined = enhanced.dbMatch?.notes?.match(/scam|pump|rug|drainer|phishing/i)?.[0]
    if (!scamType) {
      if (redFlags.some(f => /guaranteed/i.test(f)))   scamType = 'Guaranteed Returns Scam'
      else if (redFlags.some(f => /private.*alpha|send.*crypto/i.test(f))) scamType = 'Private Alpha Scam'
      else if (redFlags.some(f => /urgency/i.test(f))) scamType = 'Pump-and-Dump Promotion'
    }

    // ── Recommended action ──
    let recommendedAction: string
    if (riskScore >= 7) {
      recommendedAction = `DO NOT TRUST — HIGH RISK (${riskScore}/10). Multiple red flags detected across profile analysis, victim reports, and scammer databases. Avoid all calls from @${handle}.`
    } else if (riskScore >= 4) {
      recommendedAction = `PROCEED WITH CAUTION — MODERATE RISK (${riskScore}/10). Some concerning patterns detected. Cross-reference any calls from @${handle} with other sources before investing.`
    } else {
      recommendedAction = `LOW RISK (${riskScore}/10). No major red flags detected for @${handle}. Profile appears relatively clean, but always DYOR.`
    }

    // ── Build result ──
    const result: ScamDetectionResult = {
      username: handle,
      platform,
      riskScore,
      redFlags,
      verificationLevel,
      scamType,
      evidence,
      recommendedAction,
    }

    // ── Attach enhanced data ──
    if (enhanced.xProfile) {
      result.xProfile = {
        name:         enhanced.xProfile.name,
        bio:          enhanced.xProfile.bio,
        followers:    enhanced.xProfile.followers,
        following:    enhanced.xProfile.following,
        isVerified:   enhanced.xProfile.isVerified,
        profileImage: enhanced.xProfile.profileImage,
        profileUrl:   enhanced.xProfile.profileUrl,
      }
    }
    if (enhanced.walletAnalysis) {
      const w = enhanced.walletAnalysis
      result.walletAnalysis = {
        address:       w.address,
        blockchain:    w.blockchain,
        balance:       w.balance,
        balanceUsd:    w.balanceUsd,
        totalReceived: w.totalReceived,
        totalSent:     w.totalSent,
        txCount:       w.transactions.length,
        uniqueSenders: new Set(w.receivedFromVictims.map(v => v.from)).size,
      }
    }
    if (enhanced.victimAnalysis && enhanced.victimAnalysis.totalReports > 0) {
      result.victimReports = {
        totalReports: enhanced.victimAnalysis.totalReports,
        reports:      enhanced.victimAnalysis.reports.slice(0, 10).map(r => ({
          title:    r.title,
          url:      r.url,
          platform: r.platform,
          score:    r.score,
        })),
      }
    }
    if (enhanced.dbMatch) {
      result.knownScammer = {
        name:    enhanced.dbMatch.name,
        status:  enhanced.dbMatch.status,
        victims: enhanced.dbMatch.victims,
        notes:   enhanced.dbMatch.notes,
      }
    }

    return result
  }

  // ── Telegram analysis ──
  const rawInput = username.replace(/^@/, '').replace(/^t\.me\//, '').trim()
  let resolvedUsername: string

  try {
    resolvedUsername = await resolveChannelUsername(rawInput)
  } catch {
    return {
      username: rawInput,
      platform,
      riskScore:         7,
      redFlags:          ['Channel/user not found on Telegram'],
      verificationLevel: 'Unverified',
      evidence:          [`"${rawInput}" could not be resolved to a Telegram entity`],
      recommendedAction: 'HIGH RISK — Channel does not exist or is private. Do not trust calls from this source.',
    }
  }

  // Fetch last 100 messages (roughly last few days of activity)
  let messages: RawMessage[]
  try {
    messages = await fetchChannelMessages(resolvedUsername, 100)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      username: resolvedUsername,
      platform,
      riskScore:         6,
      redFlags:          ['Could not fetch messages from channel'],
      verificationLevel: 'Unverified',
      evidence:          [`Fetch error: ${msg}`],
      recommendedAction: 'UNABLE TO ANALYZE — Channel may be private or restricted.',
    }
  }

  if (messages.length === 0) {
    return {
      username: resolvedUsername,
      platform,
      riskScore:         6,
      redFlags:          ['No messages found — channel may be empty or private'],
      verificationLevel: 'Unverified',
      evidence:          ['0 public text messages found'],
      recommendedAction: 'UNABLE TO ANALYZE — No content to evaluate.',
    }
  }

  // Parse + compute aggregate metrics
  const parsed = parseMessages(messages)
  const shillScores   = messages.map(m => scoreShillProbability(m.text))
  const urgencyScores = messages.map(m => scoreUrgency(m.text))
  const shillAvg      = shillScores.reduce((a, b) => a + b, 0) / shillScores.length
  const urgencyAvg    = urgencyScores.reduce((a, b) => a + b, 0) / urgencyScores.length
  const highShillPct  = shillScores.filter(s => s > 0.5).length / shillScores.length

  // Unique tickers mentioned
  const tickers = new Set(parsed.map(p => p.ticker.toUpperCase()))

  // Check posting frequency (high volume of calls = suspicious)
  const callDensity = parsed.length / messages.length   // ratio of calls to total messages

  // ── Build red flags ──
  const redFlags: string[] = []
  const evidence: string[] = []

  if (shillAvg > 0.4) {
    redFlags.push(`High shill language density (${(shillAvg * 100).toFixed(0)}% avg)`)
    evidence.push(`${(highShillPct * 100).toFixed(0)}% of messages contain shill patterns ("guaranteed", "100x", "all in", etc.)`)
  }
  if (urgencyAvg > 0.35) {
    redFlags.push(`Excessive urgency tactics (${(urgencyAvg * 100).toFixed(0)}% avg)`)
    evidence.push('Frequent use of "now", "hurry", "last chance", excessive exclamation marks')
  }
  if (callDensity > 0.7) {
    redFlags.push(`Almost every message is a token call (${(callDensity * 100).toFixed(0)}% call density)`)
    evidence.push('Channels that only post token calls with no analysis are often pump-and-dump groups')
  }
  if (tickers.size > 15 && messages.length <= 100) {
    redFlags.push(`${tickers.size} different tokens promoted in ${messages.length} messages`)
    evidence.push('Extremely high token churn — typical of "spray and pray" scam channels')
  }
  if (parsed.length > 0) {
    // Check for "guaranteed returns" language
    const guaranteedCount = messages.filter(m => /guarantee|100%|risk.?free|can't lose|no risk/i.test(m.text)).length
    if (guaranteedCount > 2) {
      redFlags.push(`Claims guaranteed returns (${guaranteedCount} occurrences)`)
      evidence.push('"Guaranteed returns" is a hallmark of scam operations')
    }

    // Check for advance fee patterns
    const feePatterns = messages.filter(m => /pay.*first|send.*fee|deposit.*to|unlock.*access|VIP.*pay|premium.*join/i.test(m.text)).length
    if (feePatterns > 0) {
      redFlags.push(`Advance fee payment pattern detected (${feePatterns} messages)`)
      evidence.push('Requesting payment for "premium access" or "VIP signals" is a common scam model')
    }

    // Check for private messaging solicitation
    const dmPatterns = messages.filter(m => /DM me|PM me|message me|private.*chat|write me|contact.*private/i.test(m.text)).length
    if (dmPatterns > 2) {
      redFlags.push('Frequently solicits private messages')
      evidence.push('Directing users to private chats is a tactic to avoid public accountability')
    }
  }

  // Low message count could mean new/unestablished channel
  if (messages.length < 20) {
    redFlags.push(`Very few public messages (${messages.length})`)
    evidence.push('New or low-activity channels are harder to evaluate — proceed with caution')
  }

  // ── Compute base risk score ──
  let baseRisk = 2   // baseline: slightly above minimum
  baseRisk += Math.min(shillAvg * 4, 2)       // max +2 from shill
  baseRisk += Math.min(urgencyAvg * 3, 1.5)   // max +1.5 from urgency
  baseRisk += callDensity > 0.7 ? 1.5 : callDensity > 0.5 ? 0.5 : 0
  baseRisk += tickers.size > 15 ? 1 : tickers.size > 10 ? 0.5 : 0
  baseRisk += redFlags.length >= 4 ? 1 : 0

  // ── OpenClaw enhanced analysis (victim reports + scammer DB + optional wallet) ──
  let enhanced: EnhancedScamData = {}
  try {
    enhanced = await runEnhancedAnalysis(resolvedUsername, 'Telegram', walletAddress)
  } catch (err) {
    console.warn('[scam-detect] enhanced analysis failed, continuing with base analysis:', err instanceof Error ? err.message : err)
  }

  // ── Merge enhanced red flags ──
  let walletFlags
  if (enhanced.walletAnalysis) {
    walletFlags = analyzeWalletFlags(enhanced.walletAnalysis)
    redFlags.push(...walletFlags.flags)
    evidence.push(...walletFlags.evidence)
  }

  if (enhanced.victimAnalysis && enhanced.victimAnalysis.totalReports > 0) {
    redFlags.push(`${enhanced.victimAnalysis.totalReports} victim report(s) found online`)
    evidence.push(
      `Found ${enhanced.victimAnalysis.totalReports} public reports on Reddit/web — cross-reference before trusting this channel`,
    )
  }

  if (enhanced.dbMatch) {
    const db = enhanced.dbMatch
    if (db.status === 'Verified' || db.status === 'Highly Verified') {
      redFlags.push(`⚠️ KNOWN SCAMMER in OpenClaw database (${db.status})`)
      evidence.push(`Previously investigated: "${db.notes}" — ${db.victims} victim(s)`)
    } else if (db.status !== 'Not Scam') {
      redFlags.push(`Found in OpenClaw scammer database (${db.status})`)
      evidence.push(`Database entry: "${db.notes}"`)
    }
  }

  // ── Enhanced risk score ──
  const riskScore = computeEnhancedRiskScore(
    baseRisk,
    undefined,  // no X profile flags for Telegram
    walletFlags,
    enhanced.victimAnalysis,
    enhanced.dbMatch,
  )

  // ── Determine verification level ──
  let verificationLevel: ScamDetectionResult['verificationLevel']
  if (enhanced.dbMatch?.status === 'Verified' || enhanced.dbMatch?.status === 'Highly Verified') {
    verificationLevel = 'Verified'
  } else if (enhanced.dbMatch?.status === 'Not Scam') {
    verificationLevel = 'Verified'
  } else if (messages.length >= 50 && redFlags.length === 0) {
    verificationLevel = 'Verified'
  } else if (messages.length >= 30) {
    verificationLevel = 'Partially Verified'
  } else {
    verificationLevel = 'Unverified'
  }

  // ── Detect scam type ──
  let scamType: string | undefined
  if (redFlags.some(f => f.includes('Advance fee')))        scamType = 'Advance Fee / VIP Scam'
  else if (redFlags.some(f => f.includes('guaranteed')))     scamType = 'Guaranteed Returns Scam'
  else if (callDensity > 0.7 && shillAvg > 0.3)             scamType = 'Pump-and-Dump Channel'
  else if (redFlags.some(f => f.includes('private messages'))) scamType = 'Social Engineering'

  // ── Recommended action ──
  let recommendedAction: string
  if (riskScore >= 7) {
    recommendedAction = `DO NOT INVEST — HIGH RISK SCAM (${riskScore}/10). Multiple red flags detected. Avoid all calls from this source.`
  } else if (riskScore >= 4) {
    recommendedAction = `PROCEED WITH CAUTION — MODERATE RISK (${riskScore}/10). Some concerning patterns detected. Cross-reference any calls with other sources.`
  } else {
    recommendedAction = `LOW RISK (${riskScore}/10). No major red flags detected, but always DYOR. Channel appears relatively clean.`
  }

  // ── Build result ──
  const result: ScamDetectionResult = {
    username: resolvedUsername,
    platform,
    riskScore,
    redFlags,
    verificationLevel,
    scamType,
    evidence,
    recommendedAction,
    stats: {
      totalMessages: messages.length,
      shillAvg:      parseFloat(shillAvg.toFixed(3)),
      urgencyAvg:    parseFloat(urgencyAvg.toFixed(3)),
      rugRate:       parseFloat(callDensity.toFixed(3)),
      uniqueTickers: tickers.size,
    },
  }

  // ── Attach enhanced data ──
  if (enhanced.walletAnalysis) {
    const w = enhanced.walletAnalysis
    result.walletAnalysis = {
      address:       w.address,
      blockchain:    w.blockchain,
      balance:       w.balance,
      balanceUsd:    w.balanceUsd,
      totalReceived: w.totalReceived,
      totalSent:     w.totalSent,
      txCount:       w.transactions.length,
      uniqueSenders: new Set(w.receivedFromVictims.map(v => v.from)).size,
    }
  }
  if (enhanced.victimAnalysis && enhanced.victimAnalysis.totalReports > 0) {
    result.victimReports = {
      totalReports: enhanced.victimAnalysis.totalReports,
      reports:      enhanced.victimAnalysis.reports.slice(0, 10).map(r => ({
        title:    r.title,
        url:      r.url,
        platform: r.platform,
        score:    r.score,
      })),
    }
  }
  if (enhanced.dbMatch) {
    result.knownScammer = {
      name:    enhanced.dbMatch.name,
      status:  enhanced.dbMatch.status,
      victims: enhanced.dbMatch.victims,
      notes:   enhanced.dbMatch.notes,
    }
  }

  return result
}
