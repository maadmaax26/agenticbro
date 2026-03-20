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
  chainId:         string | null   // e.g. 'solana', 'eth', 'bsc', 'base'
  dexUrl:          string | null   // DexScreener link
  priceUsd:        number
  liquidity:       number   // USD
  volume24h:       number   // USD
  priceChange1h:   number   // percentage
  priceChange24h:  number   // percentage
  source:          'dexscreener' | 'geckoterminal' | 'unavailable'
  fetchedAt:       number
}

// ─── GoPlus token security ────────────────────────────────────────────────────

export interface SecurityData {
  // Resolved
  contract:           string
  chainId:            string

  // GoPlus flags (string "0"/"1" or missing = not checked)
  isHoneypot:         boolean
  cannotSellAll:      boolean
  hasHiddenOwner:     boolean
  canTakeBackOwnership: boolean
  isProxy:            boolean
  isBlacklist:        boolean    // contract can blacklist addresses
  isMintable:         boolean    // new tokens can be minted (dilution risk)

  // Tax
  buyTaxPct:          number     // 0–100
  sellTaxPct:         number     // 0–100

  // Concentration
  ownerPercent:       number     // % supply held by owner
  creatorPercent:     number     // % supply held by creator
  holderCount:        number

  // Meta
  source:             'goplus' | 'heuristic' | 'unavailable'
  fetchedAt:          number
}

// GoPlus chain_id mapping from DexScreener chainId strings
const GOPLUS_CHAIN: Record<string, string> = {
  eth:       '1',
  bsc:       '56',
  polygon:   '137',
  arbitrum:  '42161',
  base:      '8453',
  avalanche: '43114',
  fantom:    '250',
  cronos:    '25',
  optimism:  '10',
}

const securityCache = new Map<string, { data: SecurityData; ts: number }>()
const SEC_CACHE_TTL = 5 * 60_000   // 5 minutes

export async function getTokenSecurity(
  contract: string,
  chainId:  string,
): Promise<SecurityData> {
  const cacheKey = `${chainId}:${contract}`
  const cached = securityCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < SEC_CACHE_TTL) return cached.data

  // Solana uses a different GoPlus endpoint
  const isSolana = chainId === 'solana'
  const goplusChain = isSolana ? null : GOPLUS_CHAIN[chainId]

  const fallback: SecurityData = {
    contract, chainId,
    isHoneypot: false, cannotSellAll: false, hasHiddenOwner: false,
    canTakeBackOwnership: false, isProxy: false, isBlacklist: false, isMintable: false,
    buyTaxPct: 0, sellTaxPct: 0, ownerPercent: 0, creatorPercent: 0, holderCount: 0,
    source: 'unavailable', fetchedAt: Date.now(),
  }

  // Only Solana or known EVM chains
  if (!isSolana && !goplusChain) return fallback

  try {
    const url = isSolana
      ? `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${contract}`
      : `https://api.gopluslabs.io/api/v1/token_security/${goplusChain}?contract_addresses=${contract}`

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return fallback

    const json = await res.json() as { result?: Record<string, any> }
    const d = json.result?.[contract.toLowerCase()] ?? json.result?.[contract]
    if (!d) return fallback

    const b = (v: any) => v === '1' || v === 1 || v === true
    const n = (v: any) => parseFloat(String(v ?? '0')) || 0

    const data: SecurityData = {
      contract, chainId,
      isHoneypot:             b(d.is_honeypot),
      cannotSellAll:          b(d.cannot_sell_all),
      hasHiddenOwner:         b(d.hidden_owner),
      canTakeBackOwnership:   b(d.can_take_back_ownership),
      isProxy:                b(d.is_proxy),
      isBlacklist:            b(d.is_blacklist),
      isMintable:             b(d.is_mintable),
      buyTaxPct:              n(d.buy_tax)  * 100,
      sellTaxPct:             n(d.sell_tax) * 100,
      ownerPercent:           n(d.owner_percent)   * 100,
      creatorPercent:         n(d.creator_percent) * 100,
      holderCount:            parseInt(String(d.holder_count ?? '0'), 10),
      source:                 'goplus',
      fetchedAt:              Date.now(),
    }

    securityCache.set(cacheKey, { data, ts: Date.now() })
    return data

  } catch (err) {
    console.warn(`[dex/security] GoPlus failed for ${chainId}:${contract}:`, err instanceof Error ? err.message : err)
    return fallback
  }
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
  chainId:    string
  url:        string
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
    const isEvmContract = /^0x[0-9a-fA-F]{40}$/.test(query)
    const isSolContract = /^[1-9A-HJ-NP-Za-km-z]{40,44}$/.test(query)
    const isContract = isEvmContract || isSolContract
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
      chainId:        best.chainId  ?? null,
      dexUrl:         best.url      ?? null,
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
      chainId:        'eth',
      dexUrl:         null,
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
    chainId:         null,
    dexUrl:          null,
    priceUsd:        0,
    liquidity:       0,
    volume24h:       0,
    priceChange1h:   0,
    priceChange24h:  0,
    source:          'unavailable',
    fetchedAt:       Date.now(),
  }
}
