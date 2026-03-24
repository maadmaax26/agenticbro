/**
 * RealtimeDataAgent — handles all FRESH data queries via gemini-3-flash-preview:latest.
 *
 * Responsibilities:
 * 1. Fetch live data from multiple sources in parallel (prices, funding, liquidations,
 *    orderbook depth, on-chain flows via Helius)
 * 2. Build a rich, timestamped context payload — far richer than the background cache
 * 3. Call gemini-3-flash-preview:latest on OLLAMA_PRO_HOST with a data-reporter persona
 * 4. Stream SSE tokens back to the caller via the provided Response object
 *
 * The agent is intentionally separate from the main SubagentRouter so it can:
 * - Always fetch fresh data regardless of cache state
 * - Pull additional sources (orderbook, Helius) that the background cache doesn't cover
 * - Use a different model + system prompt tuned for data reporting
 */

import type { Response } from 'express'
import type { Intent, SubAgent } from '../router.js'
import type { AgentMode } from '../sessions.js'
import {
  fetchKrakenTickers,
  fetchKrakenBTCPrice,
  getKrakenMarketData,
  checkKrakenHealth,
  type KrakenTicker,
} from './krakenApi.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const PRO_HOST        = process.env.OLLAMA_PRO_HOST        ?? 'http://localhost:11434'
const REALTIME_MODEL  = process.env.OLLAMA_REALTIME_MODEL  ?? 'kimi-k2.5:cloud'
const HELIUS_API_KEY  = process.env.HELIUS_API_KEY         ?? ''
// Use Kraken API if Binance fails or if explicitly configured
const USE_KRAKEN_AS_FALLBACK = process.env.USE_KRAKEN_AS_FALLBACK !== 'false'
// Timeout for the Ollama model call only — starts AFTER data fetches complete.
// Separate from OLLAMA_TIMEOUT_MS (which governs the base local/cloud path).
// Must be < OLLAMA_REALTIME_TIMEOUT_MS in chat.ts (default 90s).
const MODEL_TIMEOUT_MS = parseInt(process.env.OLLAMA_REALTIME_MODEL_TIMEOUT_MS ?? '150000', 10)

// ─── Data types ───────────────────────────────────────────────────────────────

interface LivePrice {
  asset: string
  price: number
  change1h:  number
  change24h: number
  marketCap: number
  volume24h: number
}

// ─── Kraken API Functions ──────────────────────────────────────────────────────

/**
 * Fetch prices from Kraken API as fallback when Binance fails
 */
async function fetchPricesFromKraken(assets: string[]): Promise<LivePrice[]> {
  try {
    console.log('[realtime] Attempting to fetch prices from Kraken API...');
    
    // Check Kraken health first
    const krakenHealthy = await checkKrakenHealth();
    if (!krakenHealthy) {
      console.warn('[realtime] Kraken API health check failed, skipping...');
      return [];
    }

    const krakenData = await getKrakenMarketData(assets);
    
    // Convert Kraken data to LivePrice format
    const prices: LivePrice[] = krakenData.prices
      .filter(kp => assets.includes(kp.pair))
      .map(kp => ({
        asset: kp.pair,
        price: kp.price,
        change1h: 0, // Kraken doesn't provide 1h change in ticker
        change24h: kp.change24h,
        marketCap: 0, // Kraken doesn't provide market cap
        volume24h: kp.volume24h,
      }));

    console.log(`[realtime] Successfully fetched ${prices.length} prices from Kraken API`);
    return prices;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[realtime] Error fetching prices from Kraken: ${errMsg}`);
    return [];
  }
}

/**
 * Fetch BTC price specifically from Kraken as fallback
 */
async function fetchBTCPriceFromKraken(): Promise<number | null> {
  try {
    console.log('[realtime] Attempting to fetch BTC price from Kraken API...');
    const price = await fetchKrakenBTCPrice();
    
    if (price && price > 0) {
      console.log(`[realtime] Successfully fetched BTC price from Kraken: ${price}`);
      return price;
    }
    
    return null;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[realtime] Error fetching BTC price from Kraken: ${errMsg}`);
    return null;
  }
}

interface FundingRate {
  symbol:          string
  fundingRate:     number   // percentage
  nextFundingTime: number   // ms timestamp
  openInterest:    number   // USDT
}

interface Liquidation {
  symbol:    string
  longLiq:   number        // USD liquidated longs (last hour)
  shortLiq:  number        // USD liquidated shorts (last hour)
}

interface OrderbookSnapshot {
  symbol:      string
  bestBid:     number
  bestAsk:     number
  spread:      number      // absolute
  spreadBps:   number      // basis points
  bidDepth:    number      // total USD within 1% of mid
  askDepth:    number
  buyPressure: number      // bidDepth / (bidDepth + askDepth)
}

interface OnchainFlow {
  mint:       string
  topHolders: Array<{ address: string; amount: number; pct: number }>
  recentBuys:  number   // USD last 4h
  recentSells: number
}

export interface LiqClusterEntry {
  priceMid:   number
  longUsd:    number
  shortUsd:   number
  totalUsd:   number
  intensity:  number   // 0–1 relative to hottest bucket
  source:     'historical' | 'estimated'
  label?:     string   // for estimated zones: "10x Long" etc.
  side?:      'long' | 'short'
}

export interface BTCLiqData {
  currentPrice: number
  openInterest: number              // total open interest in USD
  oiLongRatio: number               // long vs short ratio (0-1)
  clusters:     LiqClusterEntry[]   // historical actual liquidations by price bucket
  estimated:    LiqClusterEntry[]   // forward model zones
  heatmap:      LiqHeatmapEntry[]   // liquidation concentration heatmap
  fetchedAt:    Date
}

export interface LiqHeatmapEntry {
  priceRange: string              // e.g., "$90,000-$92,000"
  priceLow: number
  priceHigh: number
  longLiq: number                 // long liquidations in this range (USD)
  shortLiq: number                // short liquidations in this range (USD)
  totalLiq: number                // total liquidations (USD)
  intensity: number               // concentration intensity (0-1)
  leverageBands: {
    highLeverage: number          // >20x leverage liquidations
    mediumLeverage: number        // 5x-20x leverage liquidations
    lowLeverage: number           // <5x leverage liquidations
  }
}

export interface RealtimePayload {
  fetchedAt:    Date
  prices:       LivePrice[]
  funding:      FundingRate[]
  liquidations: Liquidation[]
  orderbooks:   OrderbookSnapshot[]
  onchain:      OnchainFlow[]
  btcLiq:       BTCLiqData | null
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchPrices(assets: string[]): Promise<LivePrice[]> {
  const idMap: Record<string, string> = {
    BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
    BNB: 'binancecoin', XRP: 'ripple', DOGE: 'dogecoin',
  }
  const ids = assets.map(a => idMap[a]).filter(Boolean).join(',')
  if (!ids) return []

  try {
    console.log('[realtime] Attempting to fetch prices from CoinGecko API...');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd` +
      `&include_24hr_change=true&include_1hr_change=true&include_market_cap=true&include_24hr_vol=true`,
      { signal: AbortSignal.timeout(7000) }
    )
    if (!res.ok) {
      console.warn(`[realtime] CoinGecko API returned ${res.status}, trying Kraken fallback...`);
      throw new Error(`CoinGecko ${res.status}`);
    }
    
    const data = await res.json() as Record<string, {
      usd: number
      usd_1h_change?: number
      usd_24h_change?: number
      usd_market_cap?: number
      usd_24h_vol?: number
    }>
    
    const reverseMap: Record<string, string> = Object.fromEntries(
      Object.entries(idMap).map(([sym, id]) => [id, sym])
    )
    
    const prices = Object.entries(data).map(([id, v]) => ({
      asset:     reverseMap[id] ?? id.toUpperCase(),
      price:     v.usd,
      change1h:  v.usd_1h_change  ?? 0,
      change24h: v.usd_24h_change ?? 0,
      marketCap: v.usd_market_cap ?? 0,
      volume24h: v.usd_24h_vol    ?? 0,
    }))
    
    console.log(`[realtime] Successfully fetched ${prices.length} prices from CoinGecko`);
    return prices;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[realtime] CoinGecko API failed: ${errMsg}`);
    
    // Fallback to Kraken API
    if (USE_KRAKEN_AS_FALLBACK) {
      console.log('[realtime] Falling back to Kraken API...');
      const krakenPrices = await fetchPricesFromKraken(assets);
      if (krakenPrices.length > 0) {
        return krakenPrices;
      }
    }
    
    console.error('[realtime] All price APIs failed, returning empty array');
    return []
  }
}

async function fetchFunding(assets: string[]): Promise<FundingRate[]> {
  const symbols = new Set(assets.map(a => `${a}USDT`))
  try {
    // Batch — no symbol param returns all perps
    const [fundRes, oiRes] = await Promise.allSettled([
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex', { signal: AbortSignal.timeout(5000) }),
      fetch('https://fapi.binance.com/fapi/v1/openInterest', { signal: AbortSignal.timeout(5000) })
        .then(r => r.ok ? r.json() : []),
    ])

    const fundData: Array<{ symbol: string; lastFundingRate: string; nextFundingTime: number }> =
      fundRes.status === 'fulfilled' && fundRes.value.ok
        ? await fundRes.value.json() as Array<{ symbol: string; lastFundingRate: string; nextFundingTime: number }>
        : []

    // OI endpoint requires a symbol — skip batch OI, use premium index nextFundingTime as proxy
    const rates = fundData
      .filter(d => symbols.has(d.symbol))
      .map(d => ({
        symbol:          d.symbol.replace('USDT', ''),
        fundingRate:     parseFloat(d.lastFundingRate) * 100,
        nextFundingTime: d.nextFundingTime,
        openInterest:    0,  // populated below if available
      }))

    // Fetch per-symbol OI for requested assets
    const oiResults = await Promise.allSettled(
      assets.map(async a => {
        const r = await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${a}USDT`,
          { signal: AbortSignal.timeout(4000) })
        if (!r.ok) return { symbol: a, oi: 0 }
        const d = await r.json() as { openInterest: string }
        return { symbol: a, oi: parseFloat(d.openInterest) }
      })
    )
    for (const result of oiResults) {
      if (result.status === 'fulfilled') {
        const entry = rates.find(r => r.symbol === result.value.symbol)
        if (entry) entry.openInterest = result.value.oi
      }
    }

    return rates
  } catch {
    return []
  }
}

async function fetchLiquidations(assets: string[]): Promise<Liquidation[]> {
  // Bybit V5 — recent liquidations by symbol
  const results = await Promise.allSettled(
    assets.map(async asset => {
      try {
        const symbol = `${asset}USDT`
        const res = await fetch(
          `https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=${symbol}&limit=200`,
          { signal: AbortSignal.timeout(5000) }
        )
        if (!res.ok) return { symbol: asset, longLiq: 0, shortLiq: 0 }
        // Bybit doesn't expose a direct liq endpoint publicly — use open-interest change as proxy
        // Instead fetch from the Binance liquidation snapshot endpoint
        const liqRes = await fetch(
          `https://fapi.binance.com/fapi/v1/forceOrders?symbol=${symbol}&autoCloseType=LIQUIDATION&limit=200`,
          { signal: AbortSignal.timeout(4000) }
        ).catch(() => null)

        if (!liqRes || !liqRes.ok) return { symbol: asset, longLiq: 0, shortLiq: 0 }

        const orders = await liqRes.json() as Array<{
          side: string; origQty: string; price: string; time: number
        }>
        const cutoff = Date.now() - 3600_000   // last 1h
        let longLiq = 0, shortLiq = 0
        for (const o of orders) {
          if (o.time < cutoff) continue
          const usd = parseFloat(o.origQty) * parseFloat(o.price)
          // A SELL liquidation = a long got liquidated; BUY = short liquidated
          if (o.side === 'SELL') longLiq  += usd
          else                   shortLiq += usd
        }
        return { symbol: asset, longLiq, shortLiq }
      } catch {
        return { symbol: asset, longLiq: 0, shortLiq: 0 }
      }
    })
  )
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { symbol: assets[i], longLiq: 0, shortLiq: 0 }
  )
}

async function fetchOrderbook(assets: string[]): Promise<OrderbookSnapshot[]> {
  const results = await Promise.allSettled(
    assets.map(async asset => {
      try {
        const symbol = `${asset}USDT`
        const res = await fetch(
          `https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=100`,
          { signal: AbortSignal.timeout(4000) }
        )
        if (!res.ok) throw new Error('depth fetch failed')
        const data = await res.json() as {
          bids: [string, string][]
          asks: [string, string][]
        }

        const mid    = (parseFloat(data.bids[0][0]) + parseFloat(data.asks[0][0])) / 2
        const range  = mid * 0.01   // ±1%

        let bidDepth = 0, askDepth = 0
        for (const [p, q] of data.bids) {
          const price = parseFloat(p)
          if (price >= mid - range) bidDepth += parseFloat(q) * price
        }
        for (const [p, q] of data.asks) {
          const price = parseFloat(p)
          if (price <= mid + range) askDepth += parseFloat(q) * price
        }

        const bestBid   = parseFloat(data.bids[0][0])
        const bestAsk   = parseFloat(data.asks[0][0])
        const spread    = bestAsk - bestBid
        const spreadBps = (spread / mid) * 10_000

        return {
          symbol:      asset,
          bestBid,
          bestAsk,
          spread:      +spread.toFixed(4),
          spreadBps:   +spreadBps.toFixed(2),
          bidDepth:    Math.round(bidDepth),
          askDepth:    Math.round(askDepth),
          buyPressure: +(bidDepth / (bidDepth + askDepth)).toFixed(4),
        }
      } catch {
        return null
      }
    })
  )
  return results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter((r): r is OrderbookSnapshot => r !== null)
}

async function fetchOnchain(assets: string[]): Promise<OnchainFlow[]> {
  if (!HELIUS_API_KEY) return []

  // Map ticker → Solana mint (main tokens only)
  const MINT_MAP: Record<string, string> = {
    SOL: 'So11111111111111111111111111111111111111112',
  }

  const results: OnchainFlow[] = []
  for (const asset of assets) {
    const mint = MINT_MAP[asset]
    if (!mint) continue
    try {
      const [holdersRes, txRes] = await Promise.allSettled([
        fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenLargestAccounts', params: [mint] }),
          signal:  AbortSignal.timeout(5000),
        }),
        fetch(`https://api.helius.xyz/v0/addresses/${mint}/transactions?api-key=${HELIUS_API_KEY}&limit=50`, {
          signal: AbortSignal.timeout(5000),
        }),
      ])

      let topHolders: Array<{ address: string; amount: number; pct: number }> = []
      if (holdersRes.status === 'fulfilled' && holdersRes.value.ok) {
        const hd = await holdersRes.value.json() as {
          result: { value: Array<{ address: string; amount: string; uiAmount: number }> }
        }
        const total = hd.result.value.reduce((s, h) => s + (h.uiAmount ?? 0), 0)
        topHolders = hd.result.value.slice(0, 10).map(h => ({
          address: h.address,
          amount:  h.uiAmount ?? 0,
          pct:     total > 0 ? +((h.uiAmount / total) * 100).toFixed(2) : 0,
        }))
      }

      let recentBuys = 0, recentSells = 0
      if (txRes.status === 'fulfilled' && txRes.value.ok) {
        const txs = await txRes.value.json() as Array<{
          type?: string; tokenTransfers?: Array<{
            fromUserAccount: string; toUserAccount: string; tokenAmount: number
          }>
        }>
        const cutoff = Date.now() - 4 * 3600_000
        for (const tx of txs) {
          if (!tx.tokenTransfers) continue
          for (const t of tx.tokenTransfers) {
            const usd = t.tokenAmount   // rough approximation
            recentBuys  += usd
          }
        }
      }

      results.push({ mint, topHolders, recentBuys, recentSells })
    } catch {
      // skip this asset
    }
  }
  return results
}

// ─── BTC Liquidation Cluster Fetcher ─────────────────────────────────────────

const BUCKET_SIZE = 500   // $500 price buckets

async function fetchBTCLiqClusterData(): Promise<BTCLiqData | null> {
  try {
    const now24h = Date.now() - 24 * 3600_000   // only last 24 hours of liq data

    console.log('[liqClusters] Starting BTC liquidation cluster data fetch...')

    let currentPrice = 0;
    let binanceAvailable = false;

    // Try Binance first
    const [markRes, forceRes, lsRatioRes, oiRes] = await Promise.allSettled([
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT',
        { signal: AbortSignal.timeout(5000) }),
      // startTime restricts to last 24h — avoids Binance returning week-old orders
      // at prices that no longer reflect current market
      fetch(`https://fapi.binance.com/fapi/v1/forceOrders?symbol=BTCUSDT&limit=1000&startTime=${now24h}`,
        { signal: AbortSignal.timeout(7000) }),
      fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1',
        { signal: AbortSignal.timeout(5000) }),
      fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT',
        { signal: AbortSignal.timeout(5000) }),
    ])

    console.log('[liqClusters] Binance API calls completed:', {
      mark: markRes.status,
      force: forceRes.status,
      lsRatio: lsRatioRes.status,
      oi: oiRes.status
    })

    // Check if Binance data is available
    if (markRes.status === 'fulfilled' && markRes.value.ok) {
      try {
        const d = await markRes.value.json() as { markPrice: string }
        currentPrice = parseFloat(d.markPrice)
        console.log('[liqClusters] Current BTC price fetched from Binance:', currentPrice)
        binanceAvailable = currentPrice > 0;
      } catch (e) {
        console.warn('[liqClusters] Failed to parse Binance markPrice:', e)
      }
    }

    // Fallback to Kraken if Binance price fetch failed
    if (!currentPrice && USE_KRAKEN_AS_FALLBACK) {
      console.log('[liqClusters] Binance price unavailable, trying Kraken fallback...');
      const krakenPrice = await fetchBTCPriceFromKraken();
      if (krakenPrice) {
        currentPrice = krakenPrice;
        console.log('[liqClusters] Current BTC price fetched from Kraken:', currentPrice);
      }
    }

    if (!currentPrice) {
      console.warn('[liqClusters] No valid current price available from any source, returning null')
      return null
    }

    // Historical clusters from forceOrders — only keep prices within ±30% of current
    // to guard against stale orders that slipped through or an asset in a different era
    const PRICE_SANITY_LOW  = currentPrice * 0.70
    const PRICE_SANITY_HIGH = currentPrice * 1.30

    const buckets = new Map<number, { longUsd: number; shortUsd: number; count: number }>()
    let ordersUsed = 0, ordersDropped = 0

    if (forceRes.status === 'fulfilled' && forceRes.value.ok) {
      const raw = await forceRes.value.json()
      // Binance may return an error object instead of an array when the endpoint
      // requires auth or is temporarily blocked — handle gracefully
      const orders: Array<{
        side: string; price: string; origQty: string; avgPrice: string; time?: number
      }> = Array.isArray(raw) ? raw : []

      for (const o of orders) {
        const execPrice = parseFloat(o.avgPrice || o.price)
        if (!execPrice || execPrice < PRICE_SANITY_LOW || execPrice > PRICE_SANITY_HIGH) {
          ordersDropped++
          continue   // price is clearly from a different era — skip
        }
        const usd    = parseFloat(o.origQty) * execPrice
        const bucket = Math.floor(execPrice / BUCKET_SIZE) * BUCKET_SIZE
        const b      = buckets.get(bucket) ?? { longUsd: 0, shortUsd: 0, count: 0 }
        if (o.side === 'SELL') b.longUsd  += usd
        else                   b.shortUsd += usd
        b.count++
        buckets.set(bucket, b)
        ordersUsed++
      }
      console.log(`[liqClusters] forceOrders: ${ordersUsed} used, ${ordersDropped} dropped (price sanity)`)
    } else {
      const err = forceRes.status === 'rejected'
        ? String(forceRes.reason)
        : `HTTP ${(forceRes.value as { status?: number }).status ?? 'unknown'}`
      console.warn('[liqClusters] forceOrders unavailable:', err, '— using estimated-only mode')
    }

    const rawClusters = [...buckets.entries()]
      .map(([lo, v]) => ({
        priceMid:  lo + BUCKET_SIZE / 2,
        longUsd:   v.longUsd,
        shortUsd:  v.shortUsd,
        totalUsd:  v.longUsd + v.shortUsd,
        source:    'historical' as const,
      }))
      .filter(c => c.totalUsd > 0)
      .sort((a, b) => a.priceMid - b.priceMid)

    const maxTotal = rawClusters.reduce((m, c) => Math.max(m, c.totalUsd), 1)
    const clusters: LiqClusterEntry[] = rawClusters.map(c => ({
      ...c, intensity: c.totalUsd / maxTotal,
    }))

    console.log('[liqClusters] Historical clusters:', clusters.length, 'found')

    // Estimated forward zones
    let longRatio = 0.5, oiUsd = 0
    if (lsRatioRes.status === 'fulfilled' && lsRatioRes.value.ok) {
      try {
        const d = await lsRatioRes.value.json() as Array<{ longAccount: string }>
        longRatio = parseFloat(d[0]?.longAccount ?? '0.5')
        console.log('[liqClusters] Long/short ratio fetched:', longRatio)
      } catch (e) {
        console.warn('[liqClusters] Failed to parse lsRatio:', e)
      }
    } else {
      const err = lsRatioRes.status === 'rejected'
        ? String(lsRatioRes.reason)
        : `HTTP ${(lsRatioRes.value as { status?: number }).status ?? 'unknown'}`
      console.warn('[liqClusters] Failed to fetch long/short ratio:', err)
    }

    if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
      try {
        const d = await oiRes.value.json() as { openInterest: string }
        oiUsd = parseFloat(d.openInterest) * currentPrice
        console.log('[liqClusters] Open interest fetched:', oiUsd)
      } catch (e) {
        console.warn('[liqClusters] Failed to parse open interest:', e)
      }
    } else {
      const err = oiRes.status === 'rejected'
        ? String(oiRes.reason)
        : `HTTP ${(oiRes.value as { status?: number }).status ?? 'unknown'}`
      console.warn('[liqClusters] Failed to fetch open interest:', err)
    }

    const LEVERAGE_TIERS = [
      { leverage: 5,   share: 0.25, label: '5x'   },
      { leverage: 10,  share: 0.30, label: '10x'  },
      { leverage: 20,  share: 0.25, label: '20x'  },
      { leverage: 50,  share: 0.12, label: '50x'  },
      { leverage: 100, share: 0.08, label: '100x' },
    ]

    const estimated: LiqClusterEntry[] = []
    for (const tier of LEVERAGE_TIERS) {
      const mmRate         = 0.005
      const longLiqPrice   = Math.round(currentPrice * (1 - (1 / tier.leverage) + mmRate))
      const shortLiqPrice  = Math.round(currentPrice * (1 + (1 / tier.leverage) - mmRate))
      const longNotional   = oiUsd * longRatio       * tier.share
      const shortNotional  = oiUsd * (1 - longRatio) * tier.share
      const maxNotional    = oiUsd * 0.30   // normalise intensity against 30% of OI

      estimated.push({
        priceMid:   longLiqPrice,
        longUsd:    Math.round(longNotional),
        shortUsd:   0,
        totalUsd:   Math.round(longNotional),
        intensity:  Math.min(longNotional / maxNotional, 1),
        source:     'estimated',
        label:      `${tier.label} Long`,
        side:       'long',
      })
      estimated.push({
        priceMid:   shortLiqPrice,
        longUsd:    0,
        shortUsd:   Math.round(shortNotional),
        totalUsd:   Math.round(shortNotional),
        intensity:  Math.min(shortNotional / maxNotional, 1),
        source:     'estimated',
        label:      `${tier.label} Short`,
        side:       'short',
      })
    }

    const result = {
      currentPrice,
      openInterest: oiUsd,
      oiLongRatio: longRatio,
      clusters,
      estimated: estimated.sort((a, b) => a.priceMid - b.priceMid),
      heatmap: generateLiquidationHeatmap(currentPrice, oiUsd, longRatio, clusters, estimated),
      fetchedAt: new Date(),
    }

    console.log('[liqClusters] Successfully fetched BTC liquidation data:', {
      currentPrice,
      openInterest: oiUsd,
      oiLongRatio: longRatio,
      historicalClusters: clusters.length,
      estimatedZones: estimated.length,
      heatmapZones: result.heatmap.length,
      timestamp: result.fetchedAt.toISOString()
    })

    return result
  } catch (error) {
    console.error('[liqClusters] Unexpected error fetching BTC liquidation data:', error)
    return null
  }
}

// ─── Payload orchestrator ─────────────────────────────────────────────────────

/**
 * Generate liquidation concentration heatmap based on OI distribution
 */
function generateLiquidationHeatmap(
  currentPrice: number,
  oiUsd: number,
  longRatio: number,
  historical: LiqClusterEntry[],
  estimated: LiqClusterEntry[]
): LiqHeatmapEntry[] {
  const heatmap: LiqHeatmapEntry[] = []
  const rangeSize = currentPrice * 0.02  // 2% price ranges
  const numRanges = 20  // Cover ±20% of current price

  // Combine historical and estimated liquidations for heatmap
  const allLiqs = [...historical, ...estimated]

  for (let i = 0; i < numRanges; i++) {
    const offset = (i - Math.floor(numRanges / 2)) * rangeSize
    const priceLow = currentPrice + offset
    const priceHigh = priceLow + rangeSize
    const priceMid = (priceLow + priceHigh) / 2

    // Calculate leverage band distribution for this price range
    let longLiq = 0
    let shortLiq = 0
    let highLeverage = 0   // >20x
    let mediumLeverage = 0 // 5x-20x
    let lowLeverage = 0    // <5x

    for (const tier of LEVERAGE_TIERS) {
      const mmRate = 0.005
      const longLiqPrice = Math.round(currentPrice * (1 - (1 / tier.leverage) + mmRate))
      const shortLiqPrice = Math.round(currentPrice * (1 + (1 / tier.leverage) - mmRate))

      // Check if this tier's liquidation falls in this range
      if (longLiqPrice >= priceLow && longLiqPrice <= priceHigh) {
        const longNotional = oiUsd * longRatio * tier.share
        longLiq += longNotional

        if (tier.leverage >= 20) {
          highLeverage += longNotional
        } else if (tier.leverage >= 5) {
          mediumLeverage += longNotional
        } else {
          lowLeverage += longNotional
        }
      }

      if (shortLiqPrice >= priceLow && shortLiqPrice <= priceHigh) {
        const shortNotional = oiUsd * (1 - longRatio) * tier.share
        shortLiq += shortNotional

        if (tier.leverage >= 20) {
          highLeverage += shortNotional
        } else if (tier.leverage >= 5) {
          mediumLeverage += shortNotional
        } else {
          lowLeverage += shortNotional
        }
      }
    }

    // Add boost from historical liquidations (actual data)
    for (const liq of historical) {
      if (liq.priceMid >= priceLow && liq.priceMid <= priceHigh) {
        longLiq += liq.longUsd
        shortLiq += liq.shortUsd

        // Estimate leverage bands from historical data based on intensity
        if (liq.intensity > 0.7) {
          highLeverage += (liq.longUsd + liq.shortUsd) * 0.5
        } else if (liq.intensity > 0.4) {
          mediumLeverage += (liq.longUsd + liq.shortUsd) * 0.6
        } else {
          lowLeverage += (liq.longUsd + liq.shortUsd) * 0.7
        }
      }
    }

    const totalLiq = longLiq + shortLiq
    const maxLiqInAllRanges = Math.max(1, ...heatmap.map(h => h.totalLiq))
    const intensity = Math.min(totalLiq / (maxLiqInAllRanges || oiUsd * 0.3), 1)

    if (totalLiq > 0) {
      heatmap.push({
        priceRange: `$${Math.round(priceLow).toLocaleString()}-$${Math.round(priceHigh).toLocaleString()}`,
        priceLow: Math.round(priceLow),
        priceHigh: Math.round(priceHigh),
        longLiq: Math.round(longLiq),
        shortLiq: Math.round(shortLiq),
        totalLiq: Math.round(totalLiq),
        intensity: Math.round(intensity * 100) / 100,
        leverageBands: {
          highLeverage: Math.round(highLeverage),
          mediumLeverage: Math.round(mediumLeverage),
          lowLeverage: Math.round(lowLeverage),
        }
      })
    }
  }

  return heatmap.sort((a, b) => b.totalLiq - a.totalLiq)
}

export async function fetchRealtimePayload(
  assets: string[],
  intent: Intent,
): Promise<RealtimePayload> {
  const needsOnchain      = ['onchain', 'analysis'].includes(intent)
  const needsOrderbook    = ['orderbook', 'price', 'analysis', 'general'].includes(intent)
  const needsLiquidations = ['funding', 'analysis', 'general'].includes(intent)
  const needsBTCLiq       = assets.includes('BTC') &&
                            ['funding', 'analysis', 'general', 'price'].includes(intent)

  console.log('[fetchRealtimePayload] Starting data fetch:', {
    assets,
    intent,
    needs: { onchain: needsOnchain, orderbook: needsOrderbook, liquidations: needsLiquidations, btcLiq: needsBTCLiq }
  })

  const [prices, funding, liquidations, orderbooks, onchain, btcLiq] = await Promise.all([
    fetchPrices(assets),
    fetchFunding(assets),
    needsLiquidations ? fetchLiquidations(assets)   : Promise.resolve([] as Liquidation[]),
    needsOrderbook    ? fetchOrderbook(assets)       : Promise.resolve([] as OrderbookSnapshot[]),
    needsOnchain      ? fetchOnchain(assets)         : Promise.resolve([] as OnchainFlow[]),
    needsBTCLiq       ? fetchBTCLiqClusterData()     : Promise.resolve(null),
  ])

  const result = {
    fetchedAt: new Date(),
    prices,
    funding,
    liquidations,
    orderbooks,
    onchain,
    btcLiq
  }

  console.log('[fetchRealtimePayload] Data fetch completed:', {
    prices: prices.length,
    funding: funding.length,
    liquidations: liquidations.length,
    orderbooks: orderbooks.length,
    onchain: onchain.length,
    btcLiq: btcLiq ? 'available' : 'unavailable',
    timestamp: result.fetchedAt.toISOString()
  })

  return result
}

// ─── Context block builder ────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function fmtPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1)    return `$${p.toFixed(4)}`
  return `$${p.toFixed(6)}`
}

export function buildRealtimeContextBlock(payload: RealtimePayload): string {
  const now  = new Date()
  const ts   = payload.fetchedAt.toUTCString()
  const ageMs = now.getTime() - payload.fetchedAt.getTime()
  const ageSec = (ageMs / 1000).toFixed(0)

  const lines: string[] = [
    // Date block first — model anchors on the very first tokens
    '╔══════════════════════════════════════════════════════════════════╗',
    `║  TODAY: ${now.toUTCString()}`,
    `║  DATA FETCHED: ${ts} (${ageSec}s ago)`,
    `║  ⚠  YOUR TRAINING DATA IS FROM 2023/2024 AND IS COMPLETELY OUTDATED`,
    `║  ⚠  IGNORE ALL TRAINING-DATA PRICES. USE ONLY THE NUMBERS BELOW.`,
    '╚══════════════════════════════════════════════════════════════════╝',
    '',
  ]

  // Prices
  if (payload.prices.length > 0) {
    lines.push('── SPOT PRICES ──')
    for (const p of payload.prices) {
      const d1h  = p.change1h  >= 0 ? `▲${p.change1h.toFixed(2)}%`  : `▼${Math.abs(p.change1h).toFixed(2)}%`
      const d24h = p.change24h >= 0 ? `▲${p.change24h.toFixed(2)}%` : `▼${Math.abs(p.change24h).toFixed(2)}%`
      const mcap = p.marketCap > 0 ? ` MCap:${fmt(p.marketCap)}` : ''
      const vol  = p.volume24h > 0 ? ` Vol24h:${fmt(p.volume24h)}` : ''
      lines.push(`  ${p.asset.padEnd(5)} ${fmtPrice(p.price).padEnd(14)} 1h:${d1h.padEnd(9)} 24h:${d24h}${mcap}${vol}`)
    }
    lines.push('')
  }

  // Funding + OI
  if (payload.funding.length > 0) {
    lines.push('── PERP FUNDING RATES (Binance) ──')
    for (const f of payload.funding) {
      const bias = f.fundingRate > 0.05  ? '🔴 CROWDED LONG'
                 : f.fundingRate > 0.01  ? '🟡 bullish bias'
                 : f.fundingRate < -0.05 ? '🔵 CROWDED SHORT'
                 : f.fundingRate < -0.01 ? '🟡 bearish bias'
                 : '⚪ neutral'
      const nextFund = new Date(f.nextFundingTime).toUTCString().slice(17, 25)
      const oi = f.openInterest > 0 ? ` OI:${fmt(f.openInterest)}` : ''
      lines.push(`  ${f.symbol.padEnd(5)} ${f.fundingRate >= 0 ? '+' : ''}${f.fundingRate.toFixed(5)}%  ${bias}${oi}  next:${nextFund}`)
    }
    lines.push('')
  }

  // Liquidations
  const liqs = payload.liquidations.filter(l => l.longLiq + l.shortLiq > 0)
  if (liqs.length > 0) {
    lines.push('── LIQUIDATIONS LAST 1H ──')
    for (const l of liqs) {
      const total  = l.longLiq + l.shortLiq
      const domSide = l.longLiq > l.shortLiq ? 'LONGS dominate' : 'SHORTS dominate'
      lines.push(`  ${l.symbol.padEnd(5)} Longs liquidated:${fmt(l.longLiq)}  Shorts:${fmt(l.shortLiq)}  Total:${fmt(total)}  → ${domSide}`)
    }
    lines.push('')
  }

  // Orderbook
  if (payload.orderbooks.length > 0) {
    lines.push('── ORDERBOOK DEPTH (±1% from mid, Binance Perp) ──')
    for (const ob of payload.orderbooks) {
      const pct = (ob.buyPressure * 100).toFixed(1)
      const dir = ob.buyPressure > 0.6 ? '🟢 buy-heavy'
                : ob.buyPressure < 0.4 ? '🔴 sell-heavy'
                : '⚪ balanced'
      lines.push(`  ${ob.symbol.padEnd(5)} Bid:${fmtPrice(ob.bestBid)}  Ask:${fmtPrice(ob.bestAsk)}  Spread:${ob.spreadBps}bps  BidDepth:${fmt(ob.bidDepth)}  AskDepth:${fmt(ob.askDepth)}  BuyPressure:${pct}% ${dir}`)
    }
    lines.push('')
  }

  // On-chain
  if (payload.onchain.length > 0) {
    lines.push('── ON-CHAIN FLOWS (Helius) ──')
    for (const oc of payload.onchain) {
      lines.push(`  ${oc.mint.slice(0, 8)}…  Top holders: ${oc.topHolders.slice(0, 3).map(h => `${h.address.slice(0, 6)}… ${h.pct}%`).join(' | ')}`)
      lines.push(`  Estimated 4h activity — buys:${fmt(oc.recentBuys)}  sells:${fmt(oc.recentSells)}`)
    }
    lines.push('')
  }

  // BTC Liquidation Clusters
  if (payload.btcLiq) {
    const liq = payload.btcLiq
    const cp  = liq.currentPrice

    lines.push(`── BTC LIQUIDATION CLUSTERS (current price: ${fmtPrice(cp)}) ──`)

    // Open Interest Overview
    if (liq.openInterest > 0) {
      const longPct = (liq.oiLongRatio * 100).toFixed(1)
      const shortPct = ((1 - liq.oiLongRatio) * 100).toFixed(1)
      lines.push(
        `  Total OI: ${fmt(liq.openInterest)}  ` +
        `Longs: ${longPct}%  Shorts: ${shortPct}%  ` +
        `Ratio: ${liq.oiLongRatio.toFixed(2)}`
      )
      lines.push('')
    }

    // Historical — top 10 busiest buckets within ±20% of current price
    const nearby = liq.clusters
      .filter(c => Math.abs(c.priceMid - cp) / cp <= 0.20)
      .sort((a, b) => b.totalUsd - a.totalUsd)
      .slice(0, 10)

    if (nearby.length > 0) {
      lines.push('  Historical (actual liquidations — most active zones):')
      for (const c of nearby.sort((a, b) => a.priceMid - b.priceMid)) {
        const dir   = c.priceMid > cp ? '▲' : '▼'
        const pct   = (((c.priceMid - cp) / cp) * 100).toFixed(1)
        const bar   = '█'.repeat(Math.round(c.intensity * 12)).padEnd(12, '░')
        const domSide = c.longUsd > c.shortUsd ? 'LONG-DOM' : 'SHORT-DOM'
        lines.push(
          `  ${dir}${Math.abs(parseFloat(pct)).toFixed(1).padStart(5)}%  ` +
          `${fmtPrice(c.priceMid).padEnd(12)} ${bar}  ` +
          `Total:${fmt(c.totalUsd)}  Longs:${fmt(c.longUsd)}  Shorts:${fmt(c.shortUsd)}  [${domSide}]`
        )
      }
    }

    // Estimated — most dangerous levels above and below
    const below = liq.estimated
      .filter(e => e.side === 'long' && e.priceMid < cp)
      .sort((a, b) => b.priceMid - a.priceMid)
      .slice(0, 3)
    const above = liq.estimated
      .filter(e => e.side === 'short' && e.priceMid > cp)
      .sort((a, b) => a.priceMid - b.priceMid)
      .slice(0, 3)

    if (below.length > 0 || above.length > 0) {
      lines.push('  Estimated forward liq zones (based on OI + leverage model):')
      for (const e of [...below.reverse(), ...above]) {
        const dir  = e.priceMid > cp ? '▲' : '▼'
        const pct  = (((e.priceMid - cp) / cp) * 100).toFixed(2)
        const sign = parseFloat(pct) >= 0 ? '+' : ''
        lines.push(
          `  ${dir} ${sign}${pct}%  ${fmtPrice(e.priceMid).padEnd(12)} ${(e.label ?? '').padEnd(12)}  Notional:${fmt(e.totalUsd)}`
        )
      }
    }

    // Liquidation Heatmap - Top 5 concentration zones
    if (liq.heatmap && liq.heatmap.length > 0) {
      lines.push('  LIQUIDATION HEATMAP (top 5 concentration zones):')
      const top5 = liq.heatmap.slice(0, 5)
      for (const h of top5) {
        const dir = h.priceHigh > cp ? '▲' : '▼'
        const pct = (((h.priceHigh - cp) / cp) * 100).toFixed(1)
        const bar = '█'.repeat(Math.round(h.intensity * 10)).padEnd(10, '░')
        const leverageDist = `>20x:${fmt(h.leverageBands.highLeverage)} 5-20x:${fmt(h.leverageBands.mediumLeverage)} <5x:${fmt(h.leverageBands.lowLeverage)}`
        lines.push(
          `  ${dir}${Math.abs(parseFloat(pct)).toFixed(1).padStart(5)}%  ${h.priceRange.padEnd(20)} ${bar}  ` +
          `Total:${fmt(h.totalLiq)}  Longs:${fmt(h.longLiq)}  Shorts:${fmt(h.shortLiq)}`
        )
        lines.push(`    ${leverageDist}`)
      }
    }

    lines.push('')
  }

  lines.push('╚══ END LIVE DATA ══╝')
  return lines.join('\n')
}

// ─── System prompt (built fresh each call with current timestamp) ─────────────

function buildRealtimeSystemPrompt(): string {
  const now       = new Date()
  const dateStr   = now.toUTCString()
  const year      = now.getUTCFullYear()
  const month     = now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })

  return `You are RealTimeAgent, a live market data analyst for AgenticBro.

══ CRITICAL DATE AND DATA RULES ══
TODAY IS: ${dateStr}
CURRENT YEAR: ${year} — it is ${month} ${year}, NOT 2023 or 2024.
Your training data cutoff is in the past and ALL training-data prices are WRONG.
The LIVE DATA block injected below was fetched seconds ago — it is the ONLY source of truth.

DATA SOURCES: Price data comes from multiple APIs (CoinGecko, Kraken) with automatic fallback.
Liquidation cluster data comes from exchange APIs (Binance, Kraken) with estimation where direct data unavailable.

ABSOLUTE RULES:
1. NEVER quote a price, funding rate, OI, or liquidation number from training data
2. ALWAYS use the exact numbers from the LIVE DATA block
3. If the live data block is missing a number, say "data unavailable" — do NOT invent a figure
4. Begin every price response with the number from the live block, e.g. "BTC is currently $X"
5. Cite the fetch timestamp when giving price data so the user knows how fresh it is
6. When data is unavailable, mention it may be due to API rate limits or temporary outages

Response format:
- Lead with data (price / rate / cluster level from live block)
- Add 1-2 sentence interpretation after the numbers
- For liquidation clusters: state specific price levels, USD notional, dominant side
- Keep it tight — data first, no preamble, no training-data filler`
}

// ─── Main stream function ─────────────────────────────────────────────────────

export async function streamRealtimeAgent(opts: {
  query:         string
  intent:        Intent
  subAgent:      SubAgent
  assets:        string[]
  agentMode:     AgentMode
  history:       Array<{ role: 'user' | 'assistant'; content: string }>
  res:           Response
  abort:         AbortController
}): Promise<string> {
  const { query, intent, assets, history, res, abort } = opts

  // ── SSE keepalive: send a comment every 5s to prevent proxy/browser timeouts
  //    during the data-fetch + model-warmup phase (before first real token).
  //    SSE spec says lines starting with ":" are comments and are ignored by
  //    EventSource clients.  Our manual reader in WhaleChat also skips them
  //    because they don't start with "data: ".
  const heartbeat = setInterval(() => {
    try { res.write(': keepalive\n\n') } catch { /* client gone */ }
  }, 5_000)

  // 1. Fetch fresh data from all relevant sources in parallel.
  //    We do this BEFORE starting the model deadline — data fetches have their
  //    own per-call AbortSignal.timeout() guards and should not eat into the
  //    time budget reserved for the (potentially cold-loading) model.
  const payload   = await fetchRealtimePayload(assets, intent)
  const dataBlock = buildRealtimeContextBlock(payload)

  // 2. Build messages — system prompt is generated fresh with current date
  const messages = [
    { role: 'system' as const, content: `${buildRealtimeSystemPrompt()}\n\n${dataBlock}` },
    ...history.slice(-6),   // tighter context — model is fast, keep it focused
    { role: 'user' as const, content: query },
  ]

  // 3. Start model-specific deadline NOW (after data fetches) so a cold model
  //    gets the full MODEL_TIMEOUT_MS budget rather than (total - fetch time).
  //    Uses a local AbortController so we can cancel it on first token without
  //    disturbing the caller's controller (used for client-disconnect detection).
  const localAbort    = new AbortController()
  const localDeadline = setTimeout(() => {
    console.warn(`[RealtimeAgent] model timeout (${MODEL_TIMEOUT_MS}ms) exceeded — aborting fetch`)
    localAbort.abort()
  }, MODEL_TIMEOUT_MS)
  // Propagate external abort → local abort
  abort.signal.addEventListener('abort', () => localAbort.abort(), { once: true })

  // 4. Call model via OLLAMA_PRO_HOST
  let ollamaRes: globalThis.Response
  try {
    ollamaRes = await fetch(`${PRO_HOST}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  localAbort.signal,
      body: JSON.stringify({
        model:   REALTIME_MODEL,
        messages,
        stream:  true,
        options: {
          temperature:  0.3,    // low temp — data reporting, not creative
          num_ctx:      8192,   // large context for data blocks
          num_predict:  1536,
        },
      }),
    })
  } catch (err) {
    clearInterval(heartbeat)
    clearTimeout(localDeadline)
    throw err
  }

  if (!ollamaRes.ok) {
    clearInterval(heartbeat)
    clearTimeout(localDeadline)
    const errText = await ollamaRes.text()
    throw new Error(`RealtimeAgent Ollama ${ollamaRes.status}: ${errText.slice(0, 120)}`)
  }

  if (!ollamaRes.body) {
    clearInterval(heartbeat)
    clearTimeout(localDeadline)
    throw new Error('No response body from RealtimeAgent')
  }

  // 5. Stream tokens to client
  const reader  = ollamaRes.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''
  let firstToken  = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text  = decoder.decode(value, { stream: true })
      const lines = text.split('\n').filter(l => l.trim())

      for (const line of lines) {
        try {
          const chunk = JSON.parse(line) as {
            message?: { content?: string }
            done?:    boolean
          }

          if (chunk.message?.content) {
            if (!firstToken) {
              // First token arrived — cancel the local deadline and heartbeat
              // so a slow but active stream isn't killed mid-response
              clearTimeout(localDeadline)
              clearInterval(heartbeat)
              firstToken = true
            }
            fullContent += chunk.message.content
            res.write(`data: ${JSON.stringify({ content: chunk.message.content, done: false })}\n\n`)
          }

          if (chunk.done) {
            res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
  } finally {
    clearInterval(heartbeat)
    clearTimeout(localDeadline)
  }

  return fullContent
}
