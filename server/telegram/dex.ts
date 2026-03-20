/**
 * server/telegram/dex.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * DEX market data adapter.
 *
 * Primary:  DexScreener API (no key required for basic use)
 * Fallback: GeckoTerminal
 *
 * Returns price, liquidity, volume, and 1h/24h change for a given
 * ticker or contract address.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface DexTokenData {
  ticker:          string
  contract:        string | null
  priceUsd:        number
  liquidity:       number   // USD
  volume24h:       number   // USD
  priceChange1h:   number   // percentage
  priceChange24h:  number   // percentage
  source:          'dexscreener' | 'geckoterminal' | 'unavailable'
  fetchedAt:       number
}

// ─── Simple cache ─────────────────────────────────────────────────────────────

const dexCache = new Map<string, { data: DexTokenData; ts: number }>()
const DEX_CACHE_TTL = 60_000  // 1 minute

function fromDexCache(key: string): DexTokenData | null {
  const entry = dexCache.get(key)
  if (!entry || Date.now() - entry.ts > DEX_CACHE_TTL) return null
  return entry.data
}

// ─── DexScreener ─────────────────────────────────────────────────────────────

interface DSPair {
  baseToken:  { symbol: string; address: string }
  liquidity?: { usd: number }
  volume?:    { h24: number }
  priceUsd?:  string
  priceChange?: { h1: number; h24: number }
}

async function fetchDexScreener(query: string): Promise<DexTokenData | null> {
  const cached = fromDexCache(`ds_${query}`)
  if (cached) return cached

  try {
    // DexScreener supports both ticker search and contract lookup
    const isContract = /^0x[0-9a-fA-F]{40}$/.test(query)
    const url = isContract
      ? `https://api.dexscreener.com/latest/dex/tokens/${query}`
      : `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null

    const data = await res.json() as { pairs?: DSPair[] }
    const pairs = data.pairs ?? []
    if (pairs.length === 0) return null

    // Pick the pair with the highest liquidity
    const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]

    const result: DexTokenData = {
      ticker:         `$${best.baseToken.symbol.toUpperCase()}`,
      contract:       best.baseToken.address,
      priceUsd:       parseFloat(best.priceUsd ?? '0'),
      liquidity:      best.liquidity?.usd ?? 0,
      volume24h:      best.volume?.h24 ?? 0,
      priceChange1h:  best.priceChange?.h1  ?? 0,
      priceChange24h: best.priceChange?.h24 ?? 0,
      source:         'dexscreener',
      fetchedAt:      Date.now(),
    }

    dexCache.set(`ds_${query}`, { data: result, ts: Date.now() })
    return result

  } catch (err) {
    console.warn(`[dex] DexScreener failed for ${query}:`, err instanceof Error ? err.message : err)
    return null
  }
}

// ─── GeckoTerminal fallback ───────────────────────────────────────────────────

async function fetchGeckoTerminal(contract: string): Promise<DexTokenData | null> {
  const cached = fromDexCache(`gt_${contract}`)
  if (cached) return cached

  try {
    // GeckoTerminal multi-network token lookup
    const url = `https://api.geckoterminal.com/api/v2/networks/eth/tokens/${contract}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json;version=20230302' },
      signal:  AbortSignal.timeout(6000),
    })
    if (!res.ok) return null

    const json = await res.json() as {
      data?: {
        attributes?: {
          symbol:                  string
          price_usd:               string
          total_reserve_in_usd:    string
          volume_usd?:             { h24: string }
          price_change_percentage?: { h1: string; h24: string }
        }
      }
    }

    const attrs = json.data?.attributes
    if (!attrs) return null

    const result: DexTokenData = {
      ticker:         `$${attrs.symbol.toUpperCase()}`,
      contract,
      priceUsd:       parseFloat(attrs.price_usd ?? '0'),
      liquidity:      parseFloat(attrs.total_reserve_in_usd ?? '0'),
      volume24h:      parseFloat(attrs.volume_usd?.h24 ?? '0'),
      priceChange1h:  parseFloat(attrs.price_change_percentage?.h1  ?? '0'),
      priceChange24h: parseFloat(attrs.price_change_percentage?.h24 ?? '0'),
      source:         'geckoterminal',
      fetchedAt:      Date.now(),
    }

    dexCache.set(`gt_${contract}`, { data: result, ts: Date.now() })
    return result

  } catch (err) {
    console.warn(`[dex] GeckoTerminal failed for ${contract}:`, err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getTokenData(
  ticker: string,
  contract: string | null,
): Promise<DexTokenData> {
  const query = contract ?? ticker.replace('$', '')

  // Try DexScreener first, then GeckoTerminal if we have a contract
  let data = await fetchDexScreener(query)

  if (!data && contract) {
    data = await fetchGeckoTerminal(contract)
  }

  return data ?? {
    ticker,
    contract,
    priceUsd:        0,
    liquidity:       0,
    volume24h:       0,
    priceChange1h:   0,
    priceChange24h:  0,
    source:          'unavailable',
    fetchedAt:       Date.now(),
  }
}
