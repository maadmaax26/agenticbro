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
 *   POST /api/telegram/scam-detect
 *     Body:  { username: string, platform?: 'X' | 'Telegram' }
 *     Returns: { results: ScamDetectionResult[] }
 *
 *   GET  /api/telegram/meme-coins
 *     Query: filter (all|high|medium|low|new), sortBy (edge|mentions|engagement)
 *     Returns: { coins[], summary{} }
 *
 *   GET  /api/telegram/status
 *     Returns: whether Telegram credentials are configured
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from 'express'
import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import { isTelegramConfigured, getTrackedChannels } from '../telegram/client.js'
import { fetchAlphaFeed, runPriorityScan, getGemAdvise, runScamDetection } from '../telegram/ingestion.js'
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

// ─── Scam Detection ───────────────────────────────────────────────────────────

router.post('/scam-detect', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, platform = 'Telegram', walletAddress } = req.body as {
      username?: string
      platform?: 'X' | 'Telegram'
      walletAddress?: string
    }

    if (!username?.trim()) {
      res.status(400).json({ error: 'username field is required' })
      return
    }

    // X (Twitter) analysis works without Telegram configured — uses OpenClaw service
    if (platform === 'X') {
      const result = await runScamDetection(username.trim(), platform, walletAddress?.trim())
      res.json({ results: [result], mock: false, ts: Date.now() })
      return
    }

    if (!isTelegramConfigured() && platform === 'Telegram') {
      // Return mock data when Telegram is not configured
      res.json({
        results: [MOCK_SCAM_RESULT(username.trim(), platform)],
        mock: true,
        ts: Date.now(),
      })
      return
    }

    const result = await runScamDetection(username.trim(), platform, walletAddress?.trim())
    res.json({ results: [result], mock: false, ts: Date.now() })
  } catch (err) {
    console.error('[telegram/scam-detect]', err)
    res.status(502).json({ error: 'Scam detection failed', detail: String(err) })
  }
})

// ─── Full Scam Investigation (Python engine) ─────────────────────────────────

router.post('/scam-investigate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, platform = 'X', walletAddress } = req.body as {
      username?: string
      platform?: 'X' | 'Telegram'
      walletAddress?: string
    }

    if (!username?.trim()) {
      res.status(400).json({ error: 'username field is required' })
      return
    }

    // Build the scammer_data JSON for the Python service
    const scammerData: Record<string, string> = {}
    if (platform === 'X') {
      scammerData.x_handle = username.trim().replace(/^@/, '')
    } else {
      scammerData.telegram_channel = username.trim().replace(/^@/, '')
    }
    if (walletAddress?.trim()) {
      scammerData.wallet_address = walletAddress.trim()
      // Auto-detect blockchain from address format
      if (walletAddress.trim().length >= 32 && walletAddress.trim().length <= 44 && !walletAddress.trim().startsWith('0x')) {
        scammerData.blockchain = 'solana'
      } else if (walletAddress.trim().startsWith('0x')) {
        scammerData.blockchain = 'ethereum'
      }
    }

    // Path to the OpenClaw scammer detection service
    const serviceDir = path.join(os.homedir(), '.openclaw', 'workspace', 'scammer-detection-service')

    // Build a Python runner script that redirects all progress output to stderr
    // and only outputs JSON to stdout for clean parsing
    const pythonScript = `
import sys, json, os

# Redirect all print() output to stderr so only final JSON goes to stdout
class StderrPrinter:
    def write(self, text):
        sys.stderr.write(text)
    def flush(self):
        sys.stderr.flush()

original_stdout = sys.stdout
sys.stdout = StderrPrinter()

sys.path.insert(0, ${JSON.stringify(serviceDir)})
os.chdir(${JSON.stringify(serviceDir)})

from scammer_detection_service import ScammerDetectionService

service = ScammerDetectionService()
scammer_data = json.loads(${JSON.stringify(JSON.stringify(scammerData))})
report = service.investigate(scammer_data)

# Restore stdout and write ONLY the JSON
sys.stdout = original_stdout
print(json.dumps(report, default=str))
`

    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn('python3', ['-c', pythonScript], {
        cwd: serviceDir,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
        timeout: 120_000,  // 2 minute timeout
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

      proc.on('close', (code: number | null) => {
        if (code !== 0) {
          reject(new Error(`Python exited with code ${code}: ${stderr.slice(0, 500)}`))
        } else if (!stdout.trim()) {
          reject(new Error(`Python produced no output. stderr: ${stderr.slice(0, 500)}`))
        } else {
          resolve(stdout)
        }
      })

      proc.on('error', (err: Error) => reject(err))
    })

    // Parse the Python output as JSON — extract last JSON line in case of stray output
    let investigation: Record<string, unknown>
    try {
      investigation = JSON.parse(result.trim())
    } catch {
      // Try to find JSON in the output (last line that starts with {)
      const lines = result.trim().split('\n')
      const jsonLine = lines.reverse().find(l => l.trim().startsWith('{'))
      if (jsonLine) {
        investigation = JSON.parse(jsonLine.trim())
      } else {
        throw new Error('Failed to parse Python output as JSON')
      }
    }

    // Also run the enhanced scam-service analysis if available (for risk score + red flags)
    try {
      const enhanced = await runScamDetection(
        username.trim(),
        platform,
        walletAddress?.trim(),
      )
      investigation.enhanced = {
        riskScore:         enhanced.riskScore ?? 0,
        redFlags:          enhanced.redFlags ?? [],
        verificationLevel: enhanced.verificationLevel ?? 'Unknown',
        scamType:          enhanced.scamType,
        recommendedAction: enhanced.recommendedAction ?? '',
      }
    } catch {
      // Enhanced analysis is optional — continue without it
    }

    res.json({ investigation, mock: false, ts: Date.now() })
  } catch (err) {
    console.error('[telegram/scam-investigate]', err)
    const detail = err instanceof Error ? err.message : String(err)
    res.status(502).json({ error: 'Investigation failed', detail })
  }
})

// ─── Meme Coin Analyzer ─────────────────────────────────────────────────────────

router.get('/meme-coins', async (req: Request, res: Response): Promise<void> => {
  // For now, always return mock data (live connection requires Discord API)
  // This endpoint is ready for live Discord integration

  try {
    const filter = String(req.query.filter ?? 'all') as 'all' | 'high' | 'medium' | 'low' | 'new'
    const sortBy = String(req.query.sortBy ?? 'edge') as 'edge' | 'mentions' | 'engagement'

    let coins = [...MOCK_MEME_COINS]

    // Apply filters
    if (filter === 'high') coins = coins.filter(c => c.confidence === 'HIGH')
    if (filter === 'medium') coins = coins.filter(c => c.confidence === 'MEDIUM')
    if (filter === 'low') coins = coins.filter(c => c.confidence === 'LOW')
    if (filter === 'new') coins = coins.filter(c => c.is_new)

    // Sort by specified field
    if (sortBy === 'edge') coins.sort((a, b) => b.edge - a.edge)
    if (sortBy === 'mentions') coins.sort((a, b) => b.mentions - a.mentions)
    if (sortBy === 'engagement') coins.sort((a, b) => b.engagement - a.engagement)

    const summary = {
      totalCoins: MOCK_MEME_COINS.length,
      filteredCount: coins.length,
      highConfidence: MOCK_MEME_COINS.filter(c => c.confidence === 'HIGH').length,
      mediumConfidence: MOCK_MEME_COINS.filter(c => c.confidence === 'MEDIUM').length,
      lowConfidence: MOCK_MEME_COINS.filter(c => c.confidence === 'LOW').length,
      newCoins: MOCK_MEME_COINS.filter(c => c.is_new).length,
      avgEdgeScore: MOCK_MEME_COINS.reduce((sum, c) => sum + c.edge, 0) / MOCK_MEME_COINS.length,
      generatedAt: new Date().toISOString(),
    }

    res.json({ coins, summary, mock: true, ts: Date.now() })
  } catch (err) {
    console.error('[telegram/meme-coins]', err)
    res.status(502).json({ error: 'Failed to get meme coins', detail: String(err) })
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

// ─── Meme Coin Analyzer Mock Data ────────────────────────────────────────────────

interface MemeCoin {
  ticker: string
  edge: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  mentions: number
  engagement: number
  sentiment_trend: 'improving' | 'degrading' | 'stable'
  risk: 'HIGH_RISK' | 'MODERATE_RISK' | 'LOW_RISK'
  red_flags: string[]
  is_new: boolean
  market_cap: string
  volume: string
  age: string
  holders: number
  contract?: string
}

const MOCK_MEME_COINS: MemeCoin[] = [
  {
    ticker: 'PEPE',
    edge: 0.85,
    confidence: 'HIGH',
    mentions: 124,
    engagement: 42.3,
    sentiment_trend: 'improving',
    risk: 'LOW_RISK',
    red_flags: [],
    is_new: false,
    market_cap: '$85K',
    volume: '$420K',
    age: '4 hours',
    holders: 156,
    contract: '0x1234...5678',
  },
  {
    ticker: 'DOGE',
    edge: 0.78,
    confidence: 'HIGH',
    mentions: 98,
    engagement: 38.7,
    sentiment_trend: 'improving',
    risk: 'LOW_RISK',
    red_flags: [],
    is_new: false,
    market_cap: '$72K',
    volume: '$380K',
    age: '5 hours',
    holders: 134,
    contract: '0xabcd...efgh',
  },
  {
    ticker: 'WIF',
    edge: 0.71,
    confidence: 'HIGH',
    mentions: 72,
    engagement: 31.2,
    sentiment_trend: 'stable',
    risk: 'LOW_RISK',
    red_flags: [],
    is_new: false,
    market_cap: '$65K',
    volume: '$310K',
    age: '6 hours',
    holders: 112,
    contract: '0x9876...5432',
  },
  {
    ticker: 'GEM',
    edge: 0.68,
    confidence: 'HIGH',
    mentions: 65,
    engagement: 28.9,
    sentiment_trend: 'improving',
    risk: 'LOW_RISK',
    red_flags: [],
    is_new: true,
    market_cap: '$52K',
    volume: '$280K',
    age: '3 hours',
    holders: 98,
    contract: '0xfedc...ba98',
  },
  {
    ticker: 'MOON',
    edge: 0.61,
    confidence: 'MEDIUM',
    mentions: 58,
    engagement: 24.3,
    sentiment_trend: 'stable',
    risk: 'LOW_RISK',
    red_flags: [],
    is_new: true,
    market_cap: '$48K',
    volume: '$240K',
    age: '4 hours',
    holders: 87,
    contract: '0x1357...2468',
  },
  {
    ticker: 'RUSH',
    edge: 0.58,
    confidence: 'MEDIUM',
    mentions: 52,
    engagement: 21.8,
    sentiment_trend: 'degrading',
    risk: 'MODERATE_RISK',
    red_flags: ['Declining sentiment trend'],
    is_new: false,
    market_cap: '$41K',
    volume: '$200K',
    age: '8 hours',
    holders: 76,
  },
  {
    ticker: 'BONK',
    edge: 0.49,
    confidence: 'MEDIUM',
    mentions: 45,
    engagement: 19.4,
    sentiment_trend: 'degrading',
    risk: 'MODERATE_RISK',
    red_flags: ['Declining trend', 'Lower than average engagement'],
    is_new: false,
    market_cap: '$38K',
    volume: '$180K',
    age: '10 hours',
    holders: 65,
  },
  {
    ticker: 'PUMP',
    edge: 0.42,
    confidence: 'LOW',
    mentions: 38,
    engagement: 16.2,
    sentiment_trend: 'stable',
    risk: 'MODERATE_RISK',
    red_flags: ['Normal engagement', 'Not fresh launch'],
    is_new: false,
    market_cap: '$32K',
    volume: '$150K',
    age: '12 hours',
    holders: 54,
  },
]

// ─── Mock scam detection result ─────────────────────────────────────────────

function MOCK_SCAM_RESULT(username: string, platform: 'X' | 'Telegram') {
  return {
    username,
    platform,
    riskScore:         7.2,
    redFlags: [
      'High shill language density (42% avg)',
      'Excessive urgency tactics (38% avg)',
      'Almost every message is a token call (78% call density)',
      'Claims guaranteed returns (4 occurrences)',
    ],
    verificationLevel: 'Unverified' as const,
    scamType:          'Pump-and-Dump Channel',
    evidence: [
      '34% of messages contain shill patterns ("guaranteed", "100x", "all in", etc.)',
      'Frequent use of "now", "hurry", "last chance", excessive exclamation marks',
      'Channels that only post token calls with no analysis are often pump-and-dump groups',
      '"Guaranteed returns" is a hallmark of scam operations',
    ],
    recommendedAction: `DO NOT INVEST — HIGH RISK SCAM (7.2/10). Multiple red flags detected. Avoid all calls from this source.`,
    stats: {
      totalMessages: 87,
      shillAvg:      0.42,
      urgencyAvg:    0.38,
      rugRate:       0.78,
      uniqueTickers: 23,
    },
  }
}
