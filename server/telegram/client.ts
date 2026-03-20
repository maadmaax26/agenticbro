/**
 * server/telegram/client.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Singleton Telegram MTProto client using GramJS.
 *
 * Auth flow:
 *   1. First run: execute `npx tsx server/telegram/setup.ts` to authenticate
 *      with your phone number + OTP and print the session string.
 *   2. Set TELEGRAM_SESSION_STRING in your .env — the server reuses it every time.
 *
 * Required env vars:
 *   TELEGRAM_API_ID        – integer from my.telegram.org
 *   TELEGRAM_API_HASH      – string from my.telegram.org
 *   TELEGRAM_SESSION_STRING – serialised StringSession from setup.ts
 *
 * Optional:
 *   TELEGRAM_CHANNELS      – comma-separated channel usernames to track
 *                            (default: built-in TRACKED_CHANNELS list)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'

// ─── Tracked channels ─────────────────────────────────────────────────────────
// Add / remove channel usernames as AgenticBro expands its channel network.
// Scores are sourced from the alpha auditor scoring model — update them after
// each full audit run.

export interface TrackedChannel {
  username:    string   // Telegram @username (no @)
  displayName: string
  score:       number   // 0–1 edge score from alpha auditor
  classification: 'HIGH_ALPHA' | 'TRADEABLE' | 'LOW_QUALITY' | 'NOISE'
}

export const TRACKED_CHANNELS: TrackedChannel[] = [
  { username: 'cryptoedgepro',   displayName: 'CryptoEdge Pro', score: 0.81, classification: 'HIGH_ALPHA' },
  { username: 'alphawhaleio',    displayName: 'AlphaWhale',     score: 0.76, classification: 'HIGH_ALPHA' },
  { username: 'defigems_io',     displayName: 'DeFi Gems',      score: 0.63, classification: 'TRADEABLE'  },
  { username: 'moonsignalshq',   displayName: 'MoonSignals',    score: 0.58, classification: 'TRADEABLE'  },
  { username: 'gemhuntersdao',   displayName: 'GemHunters',     score: 0.42, classification: 'LOW_QUALITY'},
]

// Override with env if provided
export function getTrackedChannels(): TrackedChannel[] {
  const envChannels = process.env.TELEGRAM_CHANNELS
  if (!envChannels) return TRACKED_CHANNELS
  return envChannels.split(',').map(u => {
    const username = u.trim()
    const existing = TRACKED_CHANNELS.find(c => c.username === username)
    return existing ?? {
      username,
      displayName: username,
      score: 0.50,
      classification: 'TRADEABLE' as const,
    }
  })
}

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: TelegramClient | null = null
let _connectPromise: Promise<TelegramClient> | null = null

export function isTelegramConfigured(): boolean {
  return !!(
    process.env.TELEGRAM_API_ID &&
    process.env.TELEGRAM_API_HASH &&
    process.env.TELEGRAM_SESSION_STRING
  )
}

export async function getTelegramClient(): Promise<TelegramClient> {
  if (_client?.connected) return _client

  // Deduplicate concurrent connection attempts
  if (_connectPromise) return _connectPromise

  _connectPromise = (async () => {
    const apiId      = parseInt(process.env.TELEGRAM_API_ID!, 10)
    const apiHash    = process.env.TELEGRAM_API_HASH!
    const sessionStr = process.env.TELEGRAM_SESSION_STRING!

    const session = new StringSession(sessionStr)
    const client  = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 3,
      retryDelay: 1000,
      autoReconnect: true,
    })

    await client.connect()
    console.log('[telegram] client connected')
    _client = client
    _connectPromise = null
    return client
  })()

  return _connectPromise
}

export async function disconnectTelegramClient(): Promise<void> {
  if (_client) {
    await _client.disconnect()
    _client = null
    console.log('[telegram] client disconnected')
  }
}
