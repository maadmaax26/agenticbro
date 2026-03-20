/**
 * SubagentRouter — dual-agent, intent-aware routing with real-time data injection.
 *
 * Performance design:
 * - In-process cache (no HTTP round-trip to own endpoints)
 * - Background refresh every 25s keeps data ready before it's needed
 * - Parallel price + funding fetch on warm start (both resolve from cache instantly)
 * - Compact context block — only relevant assets, no padding
 */

import type { AgentMode, TradingProfile } from './sessions.js'
import { classifyFreshness, registerCacheAgeGetter, freshnessLabel } from './rag.js'

// ─── Intent + sub-agent types ─────────────────────────────────────────────────

export type Intent   = 'price' | 'funding' | 'orderbook' | 'onchain' | 'backtest' | 'news' | 'analysis' | 'general'
export type SubAgent = 'DataAgent' | 'SignalAgent' | 'AnalysisAgent' | 'ReportAgent'

const INTENT_TO_SUBAGENT: Record<Intent, SubAgent> = {
  price:     'SignalAgent',
  funding:   'SignalAgent',
  orderbook: 'SignalAgent',
  onchain:   'AnalysisAgent',
  backtest:  'DataAgent',
  news:      'ReportAgent',
  analysis:  'AnalysisAgent',
  general:   'AnalysisAgent',
}

// ─── Intent classifier ────────────────────────────────────────────────────────

const KEYWORDS: Record<Intent, string[]> = {
  price:     ['price', 'worth', 'value', 'cost', 'trading at', 'current', 'how much', 'level', 'support', 'resistance', 'ath', 'chart'],
  funding:   ['funding', 'liquidat', 'liq', 'crowded', 'perp', 'perpetual', 'open interest', 'oi', 'borrow rate'],
  orderbook: ['orderbook', 'order book', 'depth', 'bid', 'ask', 'buy wall', 'sell wall'],
  onchain:   ['on-chain', 'onchain', 'whale wallet', 'transfer', 'flow', 'holder', 'accumulate', 'distribution'],
  backtest:  ['backtest', 'back test', 'historical', 'last 30 days', 'sharpe', 'drawdown', 'win rate', 'simulate'],
  news:      ['news', 'latest', 'recent', 'what happened', 'why did', 'why is', 'search', 'find', 'research', 'tell me about', 'what caused', 'explain', 'event'],
  analysis:  ['setup', 'trade', 'signal', 'analyze', 'analysis', 'strategy', 'entry', 'target', 'stop', 'position', 'thesis', 'outlook', 'highest conviction', 'best trade'],
  general:   [],
}

export function classifyIntent(query: string): Intent {
  const q = query.toLowerCase()
  const scores = (Object.entries(KEYWORDS) as [Intent, string[]][])
    .filter(([k]) => k !== 'general')
    .map(([intent, kws]) => ({ intent, score: kws.filter(kw => q.includes(kw)).length }))
    .sort((a, b) => b.score - a.score)

  if ((scores.find(s => s.intent === 'analysis')?.score ?? 0) >= 1) return 'analysis'
  return scores[0]?.score > 0 ? scores[0].intent : 'general'
}

export function extractAssets(query: string): string[] {
  const map: Record<string, string> = {
    'bitcoin': 'BTC', 'btc': 'BTC', 'ethereum': 'ETH', 'eth': 'ETH',
    'solana': 'SOL', 'sol': 'SOL', 'bnb': 'BNB', 'binance coin': 'BNB',
    'xrp': 'XRP', 'ripple': 'XRP', 'doge': 'DOGE', 'dogecoin': 'DOGE',
  }
  const q = query.toLowerCase()
  const found = new Set(Object.entries(map).filter(([k]) => q.includes(k)).map(([, v]) => v))
  return found.size > 0 ? [...found] : ['BTC', 'ETH', 'SOL']
}

// ─── In-process market cache (no HTTP round-trip) ─────────────────────────────

interface LivePrice   { asset: string; price: number; change24h: number }
interface FundingRate { symbol: string; fundingRate: number; nextFundingTime: number }

interface MarketCache {
  prices:    LivePrice[]
  funding:   FundingRate[]
  fetchedAt: number
}

let CACHE: MarketCache = { prices: [], funding: [], fetchedAt: 0 }
const CACHE_TTL = 30_000

async function refreshCache(): Promise<void> {
  try {
    const [priceRes, fundRes] = await Promise.all([
      fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,ripple,dogecoin&vs_currencies=usd&include_24hr_change=true',
        { signal: AbortSignal.timeout(6000) }
      ),
      fetch(
        // Batch all symbols in one call via Binance premiumIndex (no symbol param = all)
        'https://fapi.binance.com/fapi/v1/premiumIndex',
        { signal: AbortSignal.timeout(5000) }
      ),
    ])

    // Prices
    if (priceRes.ok) {
      const data = await priceRes.json() as Record<string, { usd: number; usd_24h_change: number }>
      const assetMap: Record<string, string> = {
        bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL',
        binancecoin: 'BNB', ripple: 'XRP', dogecoin: 'DOGE',
      }
      CACHE.prices = Object.entries(data).map(([id, v]) => ({
        asset:     assetMap[id] ?? id.toUpperCase(),
        price:     v.usd,
        change24h: v.usd_24h_change ?? 0,
      }))
    }

    // Funding — Binance returns an array when no symbol specified
    if (fundRes.ok) {
      const data = await fundRes.json() as Array<{ symbol: string; lastFundingRate: string; nextFundingTime: number }>
      const wanted = new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'])
      CACHE.funding = data
        .filter(d => wanted.has(d.symbol))
        .map(d => ({
          symbol:          d.symbol.replace('USDT', ''),
          fundingRate:     parseFloat(d.lastFundingRate) * 100,
          nextFundingTime: d.nextFundingTime,
        }))
    }

    CACHE.fetchedAt = Date.now()
    console.log(`[router] cache refreshed — ${CACHE.prices.length} prices, ${CACHE.funding.length} funding rates`)
  } catch (err) {
    // Keep stale cache — a stale price is better than a slow response
    console.warn('[router] cache refresh failed (using stale):', err instanceof Error ? err.message : err)
  }
}

// Pre-warm immediately on module load, then refresh every 25s in the background
refreshCache()
setInterval(refreshCache, 25_000)

// Register cache age getter for RAG stale-check
registerCacheAgeGetter(() => Date.now() - CACHE.fetchedAt)

function getCachedData(assets: string[], needsFunding: boolean) {
  const prices  = CACHE.prices.filter(p => assets.includes(p.asset))
  const funding = needsFunding ? CACHE.funding.filter(f => assets.includes(f.symbol)) : []
  return { prices, funding }
}

// ─── Routing context ─────────────────────────────────────────────────────────

export interface RoutingContext {
  intent:      Intent
  subAgent:    SubAgent
  assets:      string[]
  agent:       AgentMode
  liveData:    string
  freshness:   'STATIC' | 'CACHED' | 'FRESH'
  /**
   * targetModel:
   *   'realtime' — FRESH query → RealtimeDataAgent (gemini-3-flash-preview)
   *   'cloud'    — news/search → OLLAMA_PRO_HOST
   *   'local'    — everything else → OLLAMA_HOST
   */
  targetModel: 'local' | 'cloud' | 'realtime'
  modelName:   string
}

// ─── Context block builder ────────────────────────────────────────────────────

function fmtPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1)    return `$${p.toFixed(4)}`
  return `$${p.toFixed(6)}`
}

function buildLiveDataBlock(prices: LivePrice[], funding: FundingRate[], assets: string[]): string {
  const lines: string[] = [`[LIVE DATA ${new Date().toUTCString()}]`]

  const rel = prices.filter(p => assets.includes(p.asset))
  if (rel.length > 0) {
    lines.push('Prices: ' + rel.map(p => {
      const dir = p.change24h >= 0 ? '▲' : '▼'
      return `${p.asset} ${fmtPrice(p.price)} ${dir}${Math.abs(p.change24h).toFixed(2)}%`
    }).join(' | '))
  }

  const relF = funding.filter(f => assets.includes(f.symbol))
  if (relF.length > 0) {
    lines.push('Funding: ' + relF.map(f => {
      const bias = f.fundingRate > 0.05 ? 'CROWDED LONG⚠' : f.fundingRate > 0.01 ? 'bull'
                 : f.fundingRate < -0.05 ? 'CROWDED SHORT⚠' : f.fundingRate < -0.01 ? 'bear' : 'neutral'
      return `${f.symbol} ${f.fundingRate >= 0 ? '+' : ''}${f.fundingRate.toFixed(4)}%(${bias})`
    }).join(' | '))
  }

  lines.push('USE ONLY ABOVE NUMBERS for current prices — training data is outdated.')
  return lines.join('\n')
}

// ─── Model config ─────────────────────────────────────────────────────────────

const LOCAL_MODEL     = process.env.OLLAMA_MODEL          ?? 'qwen3.5:27b'
const CLOUD_MODEL     = process.env.OLLAMA_PRO_MODEL      ?? 'glm-4.7:cloud'
const REALTIME_MODEL  = process.env.OLLAMA_REALTIME_MODEL ?? 'kimi-k2.5:cloud'

// ─── Main router ──────────────────────────────────────────────────────────────

export async function buildRoutingContext(
  query:    string,
  agent:    AgentMode = 'cipher',
  _profile?: TradingProfile,
): Promise<RoutingContext> {
  const intent    = classifyIntent(query)
  const subAgent  = INTENT_TO_SUBAGENT[intent]
  const assets    = extractAssets(query)
  const freshness = classifyFreshness(query)

  const needsFunding = ['funding', 'analysis', 'general'].includes(intent)

  let liveData = ''

  if (freshness === 'STATIC') {
    // No market data needed — pure concept/theory query, skip all fetching
    liveData = ''
  } else if (freshness === 'FRESH') {
    // Explicit real-time demand — force a cache refresh before reading
    await refreshCache()
    const { prices, funding } = getCachedData(assets, needsFunding)
    liveData = buildLiveDataBlock(prices, funding, assets)
  } else {
    // CACHED — synchronous read from in-process cache, zero async wait
    // If cache is completely empty (very first boot), kick one off
    if (CACHE.prices.length === 0) {
      await refreshCache()
    }
    const { prices, funding } = getCachedData(assets, needsFunding)
    liveData = buildLiveDataBlock(prices, funding, assets)
  }

  // Model routing:
  //  FRESH  → RealtimeDataAgent (gemini-3-flash-preview) — fetches own live data
  //  news   → cloud (glm-4.7:cloud) — search-augmented
  //  else   → local (qwen3.5:27b)
  const targetModel: 'local' | 'cloud' | 'realtime' =
    freshness === 'FRESH' ? 'realtime'
    : intent === 'news'  ? 'cloud'
    : 'local'

  const modelName =
    targetModel === 'realtime' ? REALTIME_MODEL
    : targetModel === 'cloud'  ? CLOUD_MODEL
    : LOCAL_MODEL

  console.log(`[router] agent=${agent} intent=${intent} subAgent=${subAgent} model=${modelName} freshness=${freshnessLabel(freshness)} cached=${Date.now() - CACHE.fetchedAt}ms ago`)

  return { intent, subAgent, assets, agent, liveData, freshness, targetModel, modelName }
}

// ─── System prompt builder ────────────────────────────────────────────────────

const SUBAGENT_GUIDANCE: Record<SubAgent, string> = {
  DataAgent:     'DataAgent: backtests, liquidation clusters, Sharpe/drawdown. Use structured output.',
  SignalAgent:   'SignalAgent: live signals, entry/exit, funding interpretation. Always give direction + entry + target + stop.',
  AnalysisAgent: 'AnalysisAgent: synthesize on-chain whale flows, exchange data, macro into a trade thesis.',
  ReportAgent:   'ReportAgent: recent news/events with market impact. Cite sources. Keep it tight.',
}

const CIPHER_PERSONA = `Cipher — technical analyst. Methodical, data-rich, risk-focused.
Rules: cite data source, include R/R on every trade idea, flag uncertainty explicitly.`

const ALPHA_PERSONA = `Alpha — aggressive alpha. Action-first, P&L-obsessed.
Rules: lead with the call, state conviction 1-10, always specify long/short/avoid and time horizon.`

export function buildSystemPrompt(ctx: RoutingContext, profile?: TradingProfile): string {
  const persona  = ctx.agent === 'alpha' ? ALPHA_PERSONA : CIPHER_PERSONA
  const guidance = SUBAGENT_GUIDANCE[ctx.subAgent]

  const profileLine = profile?.preferredAssets.length
    ? `User: prefers ${profile.preferredAssets.join(',')} | style=${profile.tradingStyle} | risk=${profile.riskTolerance}`
    : ''

  // Anchor every model call with today's date — prevents training-data time bleed
  const dateAnchor = `TODAY: ${new Date().toUTCString()} — your training data is outdated; use ONLY the live data block below for current prices.`

  return [dateAnchor, persona, guidance, profileLine, ctx.liveData].filter(Boolean).join('\n\n')
}
