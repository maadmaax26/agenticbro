/**
 * api/telegram/priority-scan.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Serverless Function — Priority Scan endpoint
 *
 * Routes:
 *   POST /api/telegram/priority-scan
 *     Body:  { target: 'all'|'wallet'|'channels'|'token', wallet?, channel?, token? }
 *     Returns: { results: ScoredResult[], mock: boolean, ts: number }
 *
 * Token scans run GoPlus Security API to check for:
 *   - Honeypot, hidden owner, mintable, blacklist, proxy
 *   - Buy/sell tax, owner concentration
 *
 * Other scan targets (wallet, channels, all) require a live Telegram session —
 * those fall back to representative demo data when not configured.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { IncomingMessage, ServerResponse } from 'http'

type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string }
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => VercelResponse
  end: () => void
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Confidence   = 'HIGH' | 'MEDIUM' | 'LOW'
type ScamVerdict  = 'SCAM' | 'RISKY' | 'CLEAN' | 'UNKNOWN'

interface ScamAnalysis {
  verdict:     ScamVerdict
  flags:       string[]
  buyTaxPct:   number
  sellTaxPct:  number
  holderCount: number
  source:      'goplus' | 'unavailable'
}

interface ScoredResult {
  ticker:        string
  contract?:     string
  chainId?:      string
  dexUrl?:       string
  edgeScore:     number
  confidence:    Confidence
  winRate:       number
  rugRate:       number
  liquidity:     number
  volume24h:     number
  priceChange1h: string
  sourceChannel: string
  rawText:       string
  scamAnalysis?: ScamAnalysis
  isNew:         boolean
}

// ─── GoPlus chain_id mapping ──────────────────────────────────────────────────

const GOPLUS_CHAIN: Record<string, string> = {
  eth:       '1',
  ethereum:  '1',
  bsc:       '56',
  polygon:   '137',
  arbitrum:  '42161',
  base:      '8453',
  avalanche: '43114',
  fantom:    '250',
  cronos:    '25',
  optimism:  '10',
}

// ─── GoPlus Token Security ────────────────────────────────────────────────────

interface GoPlusRaw {
  is_honeypot?:             string | number
  cannot_sell_all?:         string | number
  hidden_owner?:            string | number
  can_take_back_ownership?: string | number
  is_proxy?:                string | number
  is_blacklisted?:          string | number
  is_blacklist?:            string | number
  is_mintable?:             string | number
  buy_tax?:                 string | number
  sell_tax?:                string | number
  owner_percent?:           string | number
  creator_percent?:         string | number
  holder_count?:            string | number
}

async function checkTokenSecurity(
  contract: string,
  chainId: string,
): Promise<ScamAnalysis> {
  const isSolana    = chainId === 'solana'
  const goplusChain = isSolana ? null : GOPLUS_CHAIN[chainId]

  const unavailable: ScamAnalysis = {
    verdict: 'UNKNOWN', flags: [], buyTaxPct: 0, sellTaxPct: 0,
    holderCount: 0, source: 'unavailable',
  }

  if (!isSolana && !goplusChain) return unavailable

  try {
    const url = isSolana
      ? `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${contract}`
      : `https://api.gopluslabs.io/api/v1/token_security/${goplusChain}?contract_addresses=${contract}`

    const apiKey = process.env.GOPLUS_API_KEY
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return unavailable

    const json = await res.json() as { code?: number; result?: Record<string, GoPlusRaw> }
    if (json.code !== 1 && json.code !== undefined) return unavailable

    const d: GoPlusRaw | undefined =
      json.result?.[contract.toLowerCase()] ?? json.result?.[contract]
    if (!d) return unavailable

    const b = (v: string | number | undefined): boolean =>
      v === '1' || v === 1 || v === true

    const n = (v: string | number | undefined): number =>
      parseFloat(String(v ?? '0')) || 0

    const flags: string[] = []

    if (b(d.is_honeypot))             flags.push('Honeypot detected — cannot sell')
    if (b(d.cannot_sell_all))         flags.push('Cannot sell all tokens')
    if (b(d.hidden_owner))            flags.push('Hidden owner in contract')
    if (b(d.can_take_back_ownership)) flags.push('Owner can reclaim contract ownership')
    if (b(d.is_proxy))                flags.push('Proxy contract — logic can change')
    if (b(d.is_blacklisted) || b(d.is_blacklist)) flags.push('Blacklist function present')
    if (b(d.is_mintable))             flags.push('Token is mintable — unlimited supply risk')

    const buyTax  = n(d.buy_tax)  * 100
    const sellTax = n(d.sell_tax) * 100

    if (buyTax > 10)  flags.push(`High buy tax: ${buyTax.toFixed(1)}%`)
    if (sellTax > 10) flags.push(`High sell tax: ${sellTax.toFixed(1)}%`)

    const ownerPct   = n(d.owner_percent)   * 100
    const creatorPct = n(d.creator_percent) * 100
    if (ownerPct > 20)   flags.push(`Owner holds ${ownerPct.toFixed(1)}% of supply`)
    if (creatorPct > 20) flags.push(`Creator holds ${creatorPct.toFixed(1)}% of supply`)

    const isCritical = b(d.is_honeypot) || b(d.hidden_owner) || b(d.can_take_back_ownership)
    const isRisky    = flags.length >= 2 || sellTax > 10 || buyTax > 10

    const verdict: ScamVerdict = isCritical ? 'SCAM' : isRisky ? 'RISKY' : flags.length === 0 ? 'CLEAN' : 'RISKY'

    return {
      verdict,
      flags,
      buyTaxPct:   buyTax,
      sellTaxPct:  sellTax,
      holderCount: parseInt(String(d.holder_count ?? '0'), 10),
      source:      'goplus',
    }
  } catch (err) {
    console.warn('[priority-scan/goplus] failed:', err instanceof Error ? err.message : String(err))
    return unavailable
  }
}

// ─── DexScreener ─────────────────────────────────────────────────────────────

interface DSPair {
  chainId:     string
  url:         string
  baseToken:   { symbol: string; address: string }
  liquidity?:  { usd: number }
  volume?:     { h24: number }
  priceUsd?:   string
  priceChange?: { h1: number; h24: number }
}

interface DexData {
  ticker:        string
  contract:      string | null
  chainId:       string | null
  dexUrl:        string | null
  liquidity:     number
  volume24h:     number
  priceChange1h: number
}

async function getDexData(query: string): Promise<DexData | null> {
  try {
    const isEvmContract = /^0x[0-9a-fA-F]{40}$/.test(query)
    const isSolContract = /^[1-9A-HJ-NP-Za-km-z]{40,44}$/.test(query)
    const isContract    = isEvmContract || isSolContract

    const url = isContract
      ? `https://api.dexscreener.com/latest/dex/tokens/${query}`
      : `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null

    const data = await res.json() as { pairs?: DSPair[] }
    const pairs = data.pairs ?? []
    if (pairs.length === 0) return null

    const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]

    return {
      ticker:        `$${best.baseToken.symbol.toUpperCase()}`,
      contract:      best.baseToken.address ?? null,
      chainId:       best.chainId ?? null,
      dexUrl:        best.url ?? null,
      liquidity:     best.liquidity?.usd ?? 0,
      volume24h:     best.volume?.h24 ?? 0,
      priceChange1h: best.priceChange?.h1 ?? 0,
    }
  } catch {
    return null
  }
}

// ─── Edge score calculator ────────────────────────────────────────────────────

function computeEdgeScore(
  liquidity: number,
  scam: ScamAnalysis | undefined,
): { edgeScore: number; confidence: Confidence; winRate: number; rugRate: number } {
  if (scam?.verdict === 'SCAM') {
    return { edgeScore: 0.05, confidence: 'LOW', winRate: 0.02, rugRate: 0.95 }
  }

  const liqScore  = Math.min(liquidity / 200_000, 1.0)
  const scamPenalty = scam?.verdict === 'RISKY' ? 0.25 : 0
  const baseWin   = 0.3 + liqScore * 0.15
  const baseRug   = scam?.verdict === 'RISKY' ? 0.35 : Math.max(0.05, 0.3 - liqScore * 0.2)

  const edgeScore = Math.max(
    0.05,
    (baseWin * 0.5) + ((1 - baseRug) * 0.30) + (liqScore * 0.20) - scamPenalty,
  )

  const confidence: Confidence =
    edgeScore >= 0.70 ? 'HIGH' :
    edgeScore >= 0.50 ? 'MEDIUM' : 'LOW'

  return {
    edgeScore:  parseFloat(edgeScore.toFixed(2)),
    confidence,
    winRate:    parseFloat(baseWin.toFixed(2)),
    rugRate:    parseFloat(baseRug.toFixed(2)),
  }
}

// ─── Token scan handler ───────────────────────────────────────────────────────

async function runTokenScan(tokenQuery: string): Promise<ScoredResult[]> {
  const cleanQuery = tokenQuery.replace(/^\$/, '').trim()

  // Step 1 — DexScreener for market data + contract + chain
  const dex = await getDexData(cleanQuery)

  const ticker   = dex?.ticker   ?? `$${cleanQuery.toUpperCase()}`
  const contract = dex?.contract ?? null
  const chainId  = dex?.chainId  ?? null

  // Step 2 — GoPlus security check (if we have contract + supported chain)
  let scam: ScamAnalysis | undefined
  if (contract && chainId) {
    scam = await checkTokenSecurity(contract, chainId)
  }

  // Step 3 — compute edge score
  const { edgeScore, confidence, winRate, rugRate } = computeEdgeScore(
    dex?.liquidity ?? 0,
    scam,
  )

  // Step 4 — build result summary text
  const summaryParts: string[] = []
  if (scam?.verdict === 'SCAM')  summaryParts.push('CONTRACT FLAGGED — DO NOT BUY')
  else if (scam?.verdict === 'RISKY') summaryParts.push('Security risks detected — proceed with caution')
  else if (scam?.verdict === 'CLEAN') summaryParts.push('GoPlus: contract appears clean')

  if (scam?.flags.length) {
    summaryParts.push(`Flags: ${scam.flags.slice(0, 3).join(' | ')}`)
  }

  if (dex?.liquidity) {
    summaryParts.push(`Liquidity: $${(dex.liquidity / 1000).toFixed(0)}K`)
  }

  if (!contract) {
    summaryParts.push('Contract not found on DexScreener — enter contract address for full analysis')
  }

  const result: ScoredResult = {
    ticker,
    contract:      contract ?? undefined,
    chainId:       chainId ?? undefined,
    dexUrl:        dex?.dexUrl ?? undefined,
    edgeScore,
    confidence,
    winRate,
    rugRate,
    liquidity:     dex?.liquidity     ?? 0,
    volume24h:     dex?.volume24h     ?? 0,
    priceChange1h: dex?.priceChange1h ? `${dex.priceChange1h >= 0 ? '+' : ''}${dex.priceChange1h.toFixed(1)}%` : '0.0%',
    sourceChannel: 'GoPlus + DexScreener',
    rawText:       summaryParts.join(' · ') || `Scanned ${ticker} — no data available`,
    scamAnalysis:  scam,
    isNew:         false,
  }

  return [result]
}

// ─── Mock results for non-Telegram scan targets ───────────────────────────────

const MOCK_RESULTS: ScoredResult[] = [
  {
    ticker: '$NOVA', edgeScore: 0.81, confidence: 'HIGH', winRate: 0.44, rugRate: 0.08,
    liquidity: 182000, volume24h: 540000, priceChange1h: '+12.4%',
    sourceChannel: 'CryptoEdge Pro', isNew: true,
    rawText: 'Strong edge signal. Clean deployer history. Liquidity locked 6mo.',
    scamAnalysis: { verdict: 'CLEAN', flags: [], buyTaxPct: 0, sellTaxPct: 0, holderCount: 412, source: 'goplus' },
  },
  {
    ticker: '$FLUX', edgeScore: 0.76, confidence: 'HIGH', winRate: 0.39, rugRate: 0.12,
    liquidity: 94000, volume24h: 310000, priceChange1h: '+6.7%',
    sourceChannel: 'AlphaWhale', isNew: true,
    rawText: 'Good channel score + new listing momentum. Volume accelerating.',
    scamAnalysis: { verdict: 'CLEAN', flags: [], buyTaxPct: 0, sellTaxPct: 0, holderCount: 238, source: 'goplus' },
  },
  {
    ticker: '$KRYPT', edgeScore: 0.71, confidence: 'HIGH', winRate: 0.36, rugRate: 0.14,
    liquidity: 126000, volume24h: 275000, priceChange1h: '+5.2%',
    sourceChannel: 'CryptoEdge Pro', isNew: false,
    rawText: 'Solid fundamentals for the sector. Institutional interest detected on-chain.',
    scamAnalysis: { verdict: 'RISKY', flags: ['High sell tax: 12.0%', 'Owner holds 22.3% of supply'], buyTaxPct: 2, sellTaxPct: 12, holderCount: 187, source: 'goplus' },
  },
  {
    ticker: '$PRISM', edgeScore: 0.63, confidence: 'MEDIUM', winRate: 0.31, rugRate: 0.19,
    liquidity: 55000, volume24h: 88000, priceChange1h: '+3.2%',
    sourceChannel: 'DeFi Gems', isNew: false,
    rawText: 'Moderate quality. Mixed track record. Smaller position sizing recommended.',
    scamAnalysis: { verdict: 'CLEAN', flags: [], buyTaxPct: 5, sellTaxPct: 5, holderCount: 144, source: 'goplus' },
  },
]

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return }

  const body   = req.body ?? {}
  const target = String(body.target ?? 'all') as 'all' | 'wallet' | 'channels' | 'token'
  const wallet  = body.wallet  ? String(body.wallet).trim()  : undefined
  const channel = body.channel ? String(body.channel).trim() : undefined
  const token   = body.token   ? String(body.token).trim()   : undefined

  const validTargets = ['all', 'wallet', 'channels', 'token']
  if (!validTargets.includes(target)) {
    res.status(400).json({ error: `Invalid target. Must be one of: ${validTargets.join(', ')}` })
    return
  }

  // Validation
  if (target === 'wallet'   && !wallet)  { res.status(400).json({ error: 'wallet field required' });  return }
  if (target === 'channels' && !channel) { res.status(400).json({ error: 'channel field required' }); return }
  if (target === 'token'    && !token)   { res.status(400).json({ error: 'token field required' });   return }

  try {
    if (target === 'token' && token) {
      // Live scan — GoPlus + DexScreener
      const results = await runTokenScan(token)
      res.status(200).json({ results, mock: false, ts: Date.now() })
      return
    }

    // wallet / channels / all — requires Telegram session (server-side only)
    // Return demo data so the UI still works when accessed via Vercel
    res.status(200).json({
      results: MOCK_RESULTS,
      mock: true,
      mockReason: 'Telegram session required for live wallet/channel scans — connect the backend server for live data',
      ts: Date.now(),
    })
  } catch (err) {
    console.error('[priority-scan] error:', err)
    res.status(500).json({
      error:  'Scan failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}
