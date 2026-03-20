/**
 * server/routes/telegram.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Telegram alpha intelligence API.
 *
 * Routes:
 *   GET  /api/telegram/alpha-feed
 *     Query: limit (default 20), type (all|gem|long|short|alert), channel
 *     Returns: scored alpha calls, newest first
 *
 *   POST /api/telegram/priority-scan
 *     Body:  { target: 'all'|'wallet'|'channels'|'token', wallet?: string, channel?: string, token?: string }
 *     Returns: ranked scored calls, best edge score first
 *
 *   GET  /api/telegram/gem-advise
 *     Query: filter, rugRateMax, liquidityMin, topN
 *     Returns: { gems[], summary{} }
 *
 *   GET  /api/telegram/status
 *     Returns: whether Telegram credentials are configured
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from 'express'
import { isTelegramConfigured, getTrackedChannels } from '../telegram/client.js'
import { fetchAlphaFeed, runPriorityScan, getGemAdvise } from '../telegram/ingestion.js'
import type { ScoredCall } from '../telegram/scorer.js'

const router = Router()

// ─── Status ───────────────────────────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response): void => {
  res.json({
    configured:  isTelegramConfigured(),
    channels:    getTrackedChannels().map(c => ({
      username:       c.username,
      displayName:    c.displayName,
      score:          c.score,
      classification: c.classification,
    })),
    ts: Date.now(),
  })
})

// ─── Alpha Feed ───────────────────────────────────────────────────────────────

router.get('/alpha-feed', async (req: Request, res: Response): Promise<void> => {
  if (!isTelegramConfigured()) {
    res.json({ calls: MOCK_ALPHA_CALLS, mock: true, ts: Date.now() })
    return
  }

  try {
    const limit   = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 50)
    const type    = String(req.query.type ?? 'all')
    const channel = String(req.query.channel ?? 'all')

    let calls = await fetchAlphaFeed(limit)

    if (type !== 'all')    calls = calls.filter(c => c.callType === type)
    if (channel !== 'all') calls = calls.filter(c => c.sourceChannel === channel)

    res.json({ calls, mock: false, ts: Date.now() })
  } catch (err) {
    console.error('[telegram/alpha-feed]', err)
    res.status(502).json({ error: 'Failed to fetch alpha feed', detail: String(err) })
  }
})

// ─── Priority Scan ────────────────────────────────────────────────────────────

router.post('/priority-scan', async (req: Request, res: Response): Promise<void> => {
  if (!isTelegramConfigured()) {
    res.json({ results: MOCK_SCAN_RESULTS, mock: true, ts: Date.now() })
    return
  }

  try {
    const { target = 'all', wallet, channel, token } = req.body as {
      target?: string
      wallet?: string
      channel?: string
      token?: string
    }

    const validTargets = ['all', 'wallet', 'channels', 'token']
    if (!validTargets.includes(target)) {
      res.status(400).json({ error: `Invalid target. Must be one of: ${validTargets.join(', ')}` })
      return
    }

    if (target === 'wallet'   && !wallet)  { res.status(400).json({ error: 'wallet field required when target is "wallet"' });   return }
    if (target === 'channels' && !channel) { res.status(400).json({ error: 'channel field required when target is "channels"' }); return }
    if (target === 'token'    && !token)   { res.status(400).json({ error: 'token field required when target is "token"' });      return }

    const results = await runPriorityScan(
      target as 'all' | 'wallet' | 'channels' | 'token',
      { wallet, channel, token },
    )

    res.json({ results, mock: false, ts: Date.now() })
  } catch (err) {
    console.error('[telegram/priority-scan]', err)
    res.status(502).json({ error: 'Scan failed', detail: String(err) })
  }
})

// ─── Gem Advise ───────────────────────────────────────────────────────────────

router.get('/gem-advise', async (req: Request, res: Response): Promise<void> => {
  if (!isTelegramConfigured()) {
    res.json({ gems: MOCK_GEMS, summary: MOCK_GEM_SUMMARY, mock: true, ts: Date.now() })
    return
  }

  try {
    const filter       = String(req.query.filter      ?? 'all') as 'all' | 'high' | 'medium' | 'low' | 'new'
    const rugRateMax   = parseFloat(String(req.query.rugRateMax   ?? '0.30'))
    const liquidityMin = parseFloat(String(req.query.liquidityMin ?? '20000'))
    const topN         = parseInt(String(req.query.topN           ?? '10'), 10)

    const { gems, summary } = await getGemAdvise({ filter, rugRateMax, liquidityMin, topN })
    res.json({ gems, summary, mock: false, ts: Date.now() })
  } catch (err) {
    console.error('[telegram/gem-advise]', err)
    res.status(502).json({ error: 'Failed to get gem advise', detail: String(err) })
  }
})

export default router

// ─── Mock fallback data (served when TELEGRAM_SESSION_STRING is not set) ──────

const MOCK_ALPHA_CALLS: Partial<ScoredCall>[] = [
  {
    ticker: '$NOVA', callType: 'gem', sourceChannel: 'CryptoEdge Pro', channelScore: 0.81,
    edgeScore: 0.81, confidence: 'HIGH', winRate: 0.44, rugRate: 0.08,
    liquidity: 182000, volume24h: 540000, priceChange1h: '+12.4%', maxGain: '3.2x',
    timestamp: new Date(Date.now() - 60_000).toISOString(), isNew: true,
    rawText: 'New gem launching now — $NOVA just hit DEX, deployer wallets clean, liq locked 6mo.',
    contract: '0x4e3a...f29b',
  },
  {
    ticker: 'SOL', callType: 'long', sourceChannel: 'AlphaWhale', channelScore: 0.76,
    edgeScore: 0.76, confidence: 'HIGH', winRate: 0.39, rugRate: 0.12,
    liquidity: 0, volume24h: 0, priceChange1h: '+8.1%', maxGain: '2.1x',
    timestamp: new Date(Date.now() - 4 * 60_000).toISOString(), isNew: true,
    rawText: 'SOL momentum confirmed — whale accumulation on-chain, funding neutral. Entry zone $185–$188.',
  },
  {
    ticker: '$FLUX', callType: 'gem', sourceChannel: 'AlphaWhale', channelScore: 0.76,
    edgeScore: 0.72, confidence: 'HIGH', winRate: 0.36, rugRate: 0.14,
    liquidity: 94000, volume24h: 310000, priceChange1h: '+6.7%', maxGain: '2.7x',
    timestamp: new Date(Date.now() - 7 * 60_000).toISOString(), isNew: true,
    rawText: '$FLUX presale ending — team doxxed, audit passed, stealth launch in 2h.',
    contract: '0x8c1d...a442',
  },
  {
    ticker: 'BTC', callType: 'short', sourceChannel: 'CryptoEdge Pro', channelScore: 0.81,
    edgeScore: 0.63, confidence: 'MEDIUM', winRate: 0.31, rugRate: 0.08,
    liquidity: 0, volume24h: 0, priceChange1h: '-1.2%', maxGain: '1.4x',
    timestamp: new Date(Date.now() - 12 * 60_000).toISOString(), isNew: false,
    rawText: 'BTC rejection at $72k resistance. Funding rate elevated. Short bias for next 4–6h.',
  },
  {
    ticker: '$PRISM', callType: 'gem', sourceChannel: 'DeFi Gems', channelScore: 0.63,
    edgeScore: 0.63, confidence: 'MEDIUM', winRate: 0.31, rugRate: 0.19,
    liquidity: 55000, volume24h: 88000, priceChange1h: '+3.2%', maxGain: '1.9x',
    timestamp: new Date(Date.now() - 15 * 60_000).toISOString(), isNew: false,
    rawText: '$PRISM DeFi protocol — new AMM design, TVL growing fast. Getting in early.',
    contract: '0x2f7b...e891',
  },
  {
    ticker: 'ETH', callType: 'alert', sourceChannel: 'AlphaWhale', channelScore: 0.76,
    edgeScore: 0.58, confidence: 'MEDIUM', winRate: 0.28, rugRate: 0.12,
    liquidity: 0, volume24h: 0, priceChange1h: '-0.4%', maxGain: '1.5x',
    timestamp: new Date(Date.now() - 19 * 60_000).toISOString(), isNew: false,
    rawText: 'ETH whale moved 12,000 ETH to exchange — watch for volatility spike next 30–60min.',
  },
  {
    ticker: '$KRYPT', callType: 'gem', sourceChannel: 'CryptoEdge Pro', channelScore: 0.81,
    edgeScore: 0.71, confidence: 'HIGH', winRate: 0.36, rugRate: 0.14,
    liquidity: 126000, volume24h: 275000, priceChange1h: '+6.7%', maxGain: '2.4x',
    timestamp: new Date(Date.now() - 26 * 60_000).toISOString(), isNew: false,
    rawText: '$KRYPT KryptVault — custodial yield product, institutional backing rumoured.',
    contract: '0x9a3c...b17e',
  },
]

const MOCK_SCAN_RESULTS: Partial<ScoredCall>[] = [
  {
    ticker: '$NOVA', edgeScore: 0.81, confidence: 'HIGH', winRate: 0.44, rugRate: 0.08,
    liquidity: 182000, sourceChannel: 'CryptoEdge Pro',
    rawText: 'Strong edge signal. Clean deployer history. Liquidity locked.',
  },
  {
    ticker: '$FLUX', edgeScore: 0.76, confidence: 'HIGH', winRate: 0.39, rugRate: 0.12,
    liquidity: 94000, sourceChannel: 'AlphaWhale',
    rawText: 'Good channel score + new listing momentum. Volume accelerating.',
  },
  {
    ticker: '$PRISM', edgeScore: 0.63, confidence: 'MEDIUM', winRate: 0.31, rugRate: 0.19,
    liquidity: 55000, sourceChannel: 'DeFi Gems',
    rawText: 'Moderate quality. Mixed track record. Smaller position sizing recommended.',
  },
  {
    ticker: '$KRYPT', edgeScore: 0.71, confidence: 'HIGH', winRate: 0.36, rugRate: 0.14,
    liquidity: 126000, sourceChannel: 'CryptoEdge Pro',
    rawText: 'Solid fundamentals for the sector. Institutional interest detected on-chain.',
  },
]

const MOCK_GEMS: Partial<ScoredCall>[] = MOCK_SCAN_RESULTS.filter(r => (r.edgeScore ?? 0) >= 0.60)

const MOCK_GEM_SUMMARY = {
  totalGems:       MOCK_GEMS.length,
  highConfidence:  MOCK_GEMS.filter(g => g.confidence === 'HIGH').length,
  avgEdgeScore:    0.73,
  channelsSourced: 2,
  generatedAt:     new Date().toISOString(),
}
