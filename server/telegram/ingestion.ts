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
import { getTokenData } from './dex.js'
import { scoreCall, filterGems, computeSummary, type ScoredCall, type GemAdviseOptions } from './scorer.js'
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
    return allCalls.sort((a, b) => b.edgeScore - a.edgeScore)
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
    return allCalls.sort((a, b) => b.edgeScore - a.edgeScore)
  }

  // ── Channel scan: deep-scan a specific channel ────────────────────────────
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
      const messages = await fetchChannelMessages(channelEntry.username, 50)
      const parsed   = parseMessages(messages)
      const scored   = await enrichAndScore(parsed, channelEntry, now)
      return scored.sort((a, b) => b.edgeScore - a.edgeScore)
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
  return allCalls.sort((a, b) => b.edgeScore - a.edgeScore)
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
