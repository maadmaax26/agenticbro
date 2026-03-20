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
import { parseMessages, type RawMessage } from './parser.js'
import { getTokenData, getTokenSecurity } from './dex.js'
import { scoreCall, filterGems, computeSummary, buildScamAnalysis, type ScoredCall, type GemAdviseOptions } from './scorer.js'
import { Api } from 'telegram'

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
    // Try to match against tracked channels by username or display name
    const tracked = channels.find(
      c => c.username.toLowerCase() === rawInput.toLowerCase() ||
           c.displayName.toLowerCase().includes(rawInput.toLowerCase())
    )
    const channelEntry = tracked ?? {
      username:       rawInput,
      displayName:    rawInput,
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
      console.warn(`[telegram/scan] channel scan failed for ${channelEntry.username}:`, err instanceof Error ? err.message : err)
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
