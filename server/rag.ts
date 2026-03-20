/**
 * RAG Classifier — determines data freshness requirement for a query.
 *
 * Three tiers:
 *   STATIC  — model training knowledge is sufficient (concepts, theory, explanations).
 *             No data fetch at all. Fastest path.
 *
 *   CACHED  — in-process cache is good enough (prices, funding < 30s old).
 *             Zero async wait. Use for most price/signal queries.
 *
 *   FRESH   — user explicitly needs live data right now.
 *             Triggers a synchronous cache refresh before responding.
 *             Used only when query contains strong recency signals.
 *
 * This cuts unnecessary data fetches from ~100% of requests to ~10%,
 * eliminating the main source of pre-LLM latency.
 */

export type DataFreshness = 'STATIC' | 'CACHED' | 'FRESH'

// ─── Keyword sets ─────────────────────────────────────────────────────────────

// Queries that need no market data — model knowledge is sufficient
const STATIC_PATTERNS = [
  /^(what|explain|define|describe|how does|why does|what is|what are|tell me about|teach me)/i,
  /\b(explain|definition|meaning|concept|theory|history|how (does|do|did)|what (is|are|was|were))\b/i,
  /\b(liquidation cascade|funding rate mechanism|order book|what is defi|how (leverage|perps?|futures?|options?) work)\b/i,
  /\b(backtest methodology|sharpe ratio formula|drawdown calculation|risk management theory)\b/i,
]

// Strong recency signals — must have fresh data
const FRESH_PATTERNS = [
  /\bright now\b|\bat this (moment|second|instant)\b/i,
  /\bcurrent(ly)?\s+(trading|price|level|rate|value)\b/i,
  /\b(live|real.?time)\s+(price|data|feed|update)\b/i,
  /\bjust (happened|pumped|dumped|broke|crossed)\b/i,
  /\b(latest|breaking|urgent)\s+(news|update|move|signal)\b/i,
  /\bwhat('s| is) (btc|eth|sol|bnb|xrp|doge) (at|doing|trading|worth)\b/i,
]

// Anything else with market keywords uses cache
const MARKET_PATTERNS = [
  /\b(price|prices|cost|worth|value|level|levels)\b/i,
  /\b(funding|liquidat|perp|perpetual|oi|open interest)\b/i,
  /\b(long|short|trade|signal|setup|entry|target|stop)\b/i,
  /\b(btc|eth|sol|bnb|xrp|doge|bitcoin|ethereum|solana)\b/i,
  /\b(bull|bear|rally|dump|pump|trend|momentum)\b/i,
  /\b(whale|on.?chain|wallet|transfer|flow)\b/i,
]

// ─── Cache age check ──────────────────────────────────────────────────────────

// Imported lazily to avoid circular dep — router exports this
let getCacheAge: (() => number) | null = null
export function registerCacheAgeGetter(fn: () => number) {
  getCacheAge = fn
}

const CACHE_STALE_THRESHOLD = 25_000 // treat cache as stale after 25s

// ─── Classifier ───────────────────────────────────────────────────────────────

export function classifyFreshness(query: string): DataFreshness {
  // 1. Check for static/conceptual — skip all data fetching
  if (STATIC_PATTERNS.some(p => p.test(query))) {
    // But override if they also mention specific current levels
    const hasPriceAnchor = /\$[\d,]+|\d+k\b|\d+\s*(dollars?|usd)/i.test(query)
    if (!hasPriceAnchor) return 'STATIC'
  }

  // 2. Check for explicit real-time demand
  if (FRESH_PATTERNS.some(p => p.test(query))) return 'FRESH'

  // 3. Check if cache is too stale — force refresh
  if (getCacheAge) {
    const age = getCacheAge()
    if (age > CACHE_STALE_THRESHOLD && MARKET_PATTERNS.some(p => p.test(query))) {
      return 'FRESH'
    }
  }

  // 4. Has market keywords but no recency pressure — use cache
  if (MARKET_PATTERNS.some(p => p.test(query))) return 'CACHED'

  // 5. No market content at all — treat as static
  return 'STATIC'
}

// ─── Human-readable label for logging ────────────────────────────────────────

export function freshnessLabel(f: DataFreshness): string {
  return { STATIC: '⚡ static', CACHED: '📦 cached', FRESH: '🔄 fresh-fetch' }[f]
}
