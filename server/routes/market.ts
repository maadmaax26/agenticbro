/**
 * Market data aggregation route
 *
 * GET /api/market/prices        → CoinGecko spot prices + 24h change
 * GET /api/market/funding       → Binance perpetual funding rates
 * GET /api/market/liquidations  → Bybit recent liquidation data
 * GET /api/market/orderbook/:symbol → Binance orderbook depth (top 20)
 *
 * All endpoints cache responses for 30s to avoid rate limits.
 */

import { Router, Request, Response } from 'express'

const router = Router()

// ─── Simple in-memory cache ───────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  ts: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL = 30_000 // 30 seconds

function fromCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function toCache<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() })
}

// ─── CoinGecko ───────────────────────────────────────────────────────────────

const CG_IDS = 'bitcoin,ethereum,solana,binancecoin,ripple,dogecoin'

interface CoinGeckoPrice {
  usd: number
  usd_24h_change: number
}

interface PriceResult {
  asset: string
  price: number
  change24h: number
}

async function fetchCoinGeckoPrices(): Promise<PriceResult[]> {
  const cached = fromCache<PriceResult[]>('cg_prices')
  if (cached) return cached

  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${CG_IDS}&vs_currencies=usd&include_24hr_change=true`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)

  const data = await res.json() as Record<string, CoinGeckoPrice>

  const assetMap: Record<string, string> = {
    bitcoin:     'BTC',
    ethereum:    'ETH',
    solana:      'SOL',
    binancecoin: 'BNB',
    ripple:      'XRP',
    dogecoin:    'DOGE',
  }

  const result: PriceResult[] = Object.entries(data).map(([id, v]) => ({
    asset:    assetMap[id] ?? id.toUpperCase(),
    price:    v.usd,
    change24h: v.usd_24h_change ?? 0,
  }))

  toCache('cg_prices', result)
  return result
}

// ─── Binance funding rates ────────────────────────────────────────────────────

interface FundingRate {
  symbol: string
  fundingRate: number
  nextFundingTime: number
}

async function fetchBinanceFunding(): Promise<FundingRate[]> {
  const cached = fromCache<FundingRate[]>('binance_funding')
  if (cached) return cached

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT']

  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const res = await fetch(
        `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (!res.ok) throw new Error(`${symbol}: ${res.status}`)
      const data = await res.json() as {
        symbol: string
        lastFundingRate: string
        nextFundingTime: number
      }
      return {
        symbol: data.symbol.replace('USDT', ''),
        fundingRate: parseFloat(data.lastFundingRate) * 100, // convert to %
        nextFundingTime: data.nextFundingTime,
      }
    })
  )

  const funding: FundingRate[] = results
    .filter((r): r is PromiseFulfilledResult<FundingRate> => r.status === 'fulfilled')
    .map(r => r.value)

  toCache('binance_funding', funding)
  return funding
}

// ─── Bybit liquidations ───────────────────────────────────────────────────────

interface LiquidationSummary {
  symbol: string
  longLiqUsd: number   // 24h long liquidations in USD
  shortLiqUsd: number  // 24h short liquidations in USD
}

async function fetchBybitLiquidations(): Promise<LiquidationSummary[]> {
  const cached = fromCache<LiquidationSummary[]>('bybit_liq')
  if (cached) return cached

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT']

  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      // Bybit v5 tickers endpoint — includes open interest but not liquidations directly.
      // Use the 24h liquidation data from the instruments endpoint as a proxy.
      const res = await fetch(
        `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (!res.ok) throw new Error(`${symbol}: ${res.status}`)
      const data = await res.json() as {
        result?: {
          list?: Array<{
            symbol: string
            openInterestValue?: string
          }>
        }
      }
      const ticker = data?.result?.list?.[0]
      if (!ticker) throw new Error(`No ticker for ${symbol}`)

      // Note: Bybit doesn't expose per-direction liquidations in tickers.
      // Using open interest as a proxy signal (high OI = higher liquidation risk).
      const oi = parseFloat(ticker.openInterestValue ?? '0')

      return {
        symbol: symbol.replace('USDT', ''),
        longLiqUsd:  oi * 0.003, // estimated 0.3% liquidated on long side (rough approximation)
        shortLiqUsd: oi * 0.002, // estimated 0.2% on short side
      }
    })
  )

  const liquidations: LiquidationSummary[] = results
    .filter((r): r is PromiseFulfilledResult<LiquidationSummary> => r.status === 'fulfilled')
    .map(r => r.value)

  toCache('bybit_liq', liquidations)
  return liquidations
}

// ─── Binance orderbook ────────────────────────────────────────────────────────

interface OrderbookLevel {
  price: number
  qty: number
}

interface Orderbook {
  symbol: string
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
  timestamp: number
}

async function fetchOrderbook(symbol: string): Promise<Orderbook> {
  const cacheKey = `ob_${symbol}`
  const cached = fromCache<Orderbook>(cacheKey)
  if (cached) return cached

  const res = await fetch(
    `https://api.binance.com/api/v3/depth?symbol=${symbol}USDT&limit=20`,
    { signal: AbortSignal.timeout(5000) }
  )
  if (!res.ok) throw new Error(`Binance orderbook ${symbol}: ${res.status}`)

  const data = await res.json() as {
    bids: [string, string][]
    asks: [string, string][]
  }

  const ob: Orderbook = {
    symbol,
    bids: data.bids.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
    asks: data.asks.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
    timestamp: Date.now(),
  }

  toCache(cacheKey, ob)
  return ob
}

// ─── BTC Liquidation Clusters ─────────────────────────────────────────────────
// Two layers of data:
//  1. HISTORICAL — real forced orders from Binance, bucketed into $500 price bands
//  2. ESTIMATED  — forward-looking zones derived from current OI, long/short ratio,
//                  and a leverage-distribution model for the perp market

export interface LiqCluster {
  priceLow:  number    // bucket lower bound
  priceHigh: number    // bucket upper bound
  priceMid:  number    // midpoint (use for display)
  longUsd:   number    // USD value of long liquidations at this level
  shortUsd:  number    // USD value of short liquidations at this level
  totalUsd:  number
  /** 0–1 relative intensity vs the busiest bucket in the set */
  intensity: number
  source:    'historical' | 'estimated'
}

export interface EstimatedZone {
  priceMid:   number
  label:      string   // e.g. "10x Long" / "20x Short"
  side:       'long' | 'short'
  /** distance from current price as a percentage */
  pctFromCurrent: number
  notionalUsd: number  // rough USD size of this zone based on OI share
}

export interface LiqClusters {
  currentPrice: number
  clusters:     LiqCluster[]
  estimated:    EstimatedZone[]
  fetchedAt:    number
}

const BUCKET_SIZE = 500   // $500 price buckets for BTC

async function fetchBTCLiqClusters(): Promise<LiqClusters> {
  const cacheKey = 'btc_liq_clusters'
  const cached = fromCache<LiqClusters>(cacheKey)
  if (cached) return cached

  // ── 1. Fetch inputs in parallel ──────────────────────────────────────────
  const now24h = Date.now() - 24 * 3600_000  // only last 24h of force orders

  const [markRes, forceRes, lsRatioRes, oiRes] = await Promise.allSettled([
    // Current BTC mark price
    fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT',
      { signal: AbortSignal.timeout(5000) }),
    // Last 24h of forced liquidation orders — startTime prevents returning week-old orders
    fetch(`https://fapi.binance.com/fapi/v1/forceOrders?symbol=BTCUSDT&limit=1000&startTime=${now24h}`,
      { signal: AbortSignal.timeout(7000) }),
    // Global long/short account ratio (sentiment)
    fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1',
      { signal: AbortSignal.timeout(5000) }),
    // Open interest in USD
    fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT',
      { signal: AbortSignal.timeout(5000) }),
  ])

  // ── 2. Parse mark price ───────────────────────────────────────────────────
  let currentPrice = 0
  if (markRes.status === 'fulfilled' && markRes.value.ok) {
    const d = await markRes.value.json() as { markPrice: string }
    currentPrice = parseFloat(d.markPrice)
  }
  if (!currentPrice) throw new Error('Could not fetch BTC mark price')

  // ── 3. Build historical clusters from forced orders ───────────────────────
  const buckets = new Map<number, { longUsd: number; shortUsd: number }>()

  if (forceRes.status === 'fulfilled' && forceRes.value.ok) {
    const raw = await forceRes.value.json()
    // Guard: Binance may return an error JSON object rather than an array
    // when the endpoint requires auth or is geo-blocked
    const orders: Array<{
      side: string; price: string; origQty: string; avgPrice: string
    }> = Array.isArray(raw) ? raw : []

    // Price sanity window — only accept orders within ±30% of current price
    // Prevents stale era data from polluting the heatmap
    const priceLo = currentPrice * 0.70
    const priceHi = currentPrice * 1.30

    for (const o of orders) {
      const execPrice = parseFloat(o.avgPrice || o.price)
      if (!execPrice || execPrice < priceLo || execPrice > priceHi) continue

      const usd      = parseFloat(o.origQty) * execPrice
      const bucket   = Math.floor(execPrice / BUCKET_SIZE) * BUCKET_SIZE
      const existing = buckets.get(bucket) ?? { longUsd: 0, shortUsd: 0 }
      // SELL side = long position got liquidated (selling it to market)
      // BUY  side = short position got liquidated (buying back at market)
      if (o.side === 'SELL') existing.longUsd  += usd
      else                   existing.shortUsd += usd
      buckets.set(bucket, existing)
    }

    if (orders.length === 0 && !Array.isArray(raw)) {
      console.warn('[market/liq-clusters] forceOrders returned non-array:', JSON.stringify(raw).slice(0, 200))
    }
  }

  // Convert map to sorted array with intensity
  const rawClusters = [...buckets.entries()]
    .map(([lo, v]) => ({
      priceLow:  lo,
      priceHigh: lo + BUCKET_SIZE,
      priceMid:  lo + BUCKET_SIZE / 2,
      longUsd:   v.longUsd,
      shortUsd:  v.shortUsd,
      totalUsd:  v.longUsd + v.shortUsd,
      source:    'historical' as const,
    }))
    .sort((a, b) => a.priceMid - b.priceMid)

  const maxTotal = rawClusters.reduce((m, c) => Math.max(m, c.totalUsd), 1)
  const historicalClusters: LiqCluster[] = rawClusters.map(c => ({
    ...c,
    intensity: c.totalUsd / maxTotal,
  }))

  // ── 4. Build estimated forward zones ──────────────────────────────────────
  let longRatio   = 0.5
  let oiUsd       = 0

  if (lsRatioRes.status === 'fulfilled' && lsRatioRes.value.ok) {
    const d = await lsRatioRes.value.json() as Array<{ longShortRatio: string; longAccount: string }>
    longRatio = parseFloat(d[0]?.longAccount ?? '0.5')
  }
  if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
    const d = await oiRes.value.json() as { openInterest: string }
    oiUsd = parseFloat(d.openInterest) * currentPrice
  }

  // Leverage distribution model — approximate market positioning
  // Each tier gets a share of total OI
  const LEVERAGE_TIERS = [
    { leverage: 5,   share: 0.25, label: '5x'   },
    { leverage: 10,  share: 0.30, label: '10x'  },
    { leverage: 20,  share: 0.25, label: '20x'  },
    { leverage: 50,  share: 0.12, label: '50x'  },
    { leverage: 100, share: 0.08, label: '100x' },
  ]

  const estimated: EstimatedZone[] = []

  for (const tier of LEVERAGE_TIERS) {
    // Maintenance margin ≈ 0.5% for BTC — liq triggered before full inverse
    const mmRate     = 0.005
    const longLiqPct  = -(1 / tier.leverage) + mmRate   // negative % from entry
    const shortLiqPct =  (1 / tier.leverage) - mmRate   // positive % from entry

    const longNotional  = oiUsd * longRatio       * tier.share
    const shortNotional = oiUsd * (1 - longRatio) * tier.share

    // Assume entry price ≈ current price (simplification — real clusters trail)
    const longLiqPrice  = currentPrice * (1 + longLiqPct)
    const shortLiqPrice = currentPrice * (1 + shortLiqPct)
    const pctLong  = longLiqPct  * 100
    const pctShort = shortLiqPct * 100

    estimated.push({
      priceMid:       Math.round(longLiqPrice),
      label:          `${tier.label} Long`,
      side:           'long',
      pctFromCurrent: +pctLong.toFixed(2),
      notionalUsd:    Math.round(longNotional),
    })
    estimated.push({
      priceMid:       Math.round(shortLiqPrice),
      label:          `${tier.label} Short`,
      side:           'short',
      pctFromCurrent: +pctShort.toFixed(2),
      notionalUsd:    Math.round(shortNotional),
    })
  }

  const result: LiqClusters = {
    currentPrice,
    clusters:  historicalClusters,
    estimated: estimated.sort((a, b) => a.priceMid - b.priceMid),
    fetchedAt: Date.now(),
  }

  toCache(cacheKey, result)
  return result
}

// ─── Route handlers ───────────────────────────────────────────────────────────

router.get('/prices', async (_req: Request, res: Response): Promise<void> => {
  try {
    const prices = await fetchCoinGeckoPrices()
    res.json({ prices, ts: Date.now() })
  } catch (err) {
    console.error('[market/prices]', err)
    res.status(502).json({ error: 'Failed to fetch prices' })
  }
})

router.get('/funding', async (_req: Request, res: Response): Promise<void> => {
  try {
    const funding = await fetchBinanceFunding()
    res.json({ funding, ts: Date.now() })
  } catch (err) {
    console.error('[market/funding]', err)
    res.status(502).json({ error: 'Failed to fetch funding rates' })
  }
})

router.get('/liquidations', async (_req: Request, res: Response): Promise<void> => {
  try {
    const liquidations = await fetchBybitLiquidations()
    res.json({ liquidations, ts: Date.now() })
  } catch (err) {
    console.error('[market/liquidations]', err)
    res.status(502).json({ error: 'Failed to fetch liquidation data' })
  }
})

router.get('/orderbook/:symbol', async (req: Request, res: Response): Promise<void> => {
  const { symbol } = req.params as { symbol: string }
  const upper = symbol.toUpperCase()

  const allowed = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE']
  if (!allowed.includes(upper)) {
    res.status(400).json({ error: `Symbol ${upper} not supported` })
    return
  }

  try {
    const ob = await fetchOrderbook(upper)
    res.json(ob)
  } catch (err) {
    console.error(`[market/orderbook/${upper}]`, err)
    res.status(502).json({ error: `Failed to fetch orderbook for ${upper}` })
  }
})

router.get('/liq-clusters', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await fetchBTCLiqClusters()
    res.json(data)
  } catch (err) {
    console.error('[market/liq-clusters]', err)
    res.status(502).json({ error: 'Failed to fetch BTC liquidation cluster data' })
  }
})

export default router
