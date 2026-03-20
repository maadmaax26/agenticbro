/**
 * On-chain data route (Helius API)
 *
 * GET /api/onchain/whales/:mint  → Top token holders (largest accounts)
 * GET /api/onchain/flows/:mint   → Recent large transfers
 *
 * Uses HELIUS_API_KEY from environment.
 * Caches for 60s (on-chain data changes slowly).
 */

import { Router, Request, Response } from 'express'

const router = Router()

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? ''
const HELIUS_RPC     = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
const HELIUS_API     = `https://api.helius.xyz/v0`

// ─── Cache (60s TTL for on-chain) ─────────────────────────────────────────────

interface CacheEntry<T> { data: T; ts: number }
const cache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL = 60_000

function fromCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry || Date.now() - entry.ts > CACHE_TTL) return null
  return entry.data
}
function toCache<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() })
}

// ─── Helius RPC helper ────────────────────────────────────────────────────────

async function heliusRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(HELIUS_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Helius RPC HTTP ${res.status}`)
  const json = await res.json() as { result?: T; error?: { message: string } }
  if (json.error) throw new Error(`Helius RPC error: ${json.error.message}`)
  return json.result as T
}

// ─── Top holders ─────────────────────────────────────────────────────────────

interface TokenAccount {
  address: string
  uiAmount: number
}

router.get('/whales/:mint', async (req: Request, res: Response): Promise<void> => {
  const { mint } = req.params

  if (!HELIUS_API_KEY) {
    res.status(503).json({ error: 'HELIUS_API_KEY not configured' })
    return
  }

  const cacheKey = `whales_${mint}`
  const cached = fromCache<TokenAccount[]>(cacheKey)
  if (cached) {
    res.json({ holders: cached, cached: true })
    return
  }

  try {
    const result = await heliusRpc<{
      value: Array<{
        address: string
        amount: { uiAmount: number }
      }>
    }>('getTokenLargestAccounts', [mint])

    const holders: TokenAccount[] = (result?.value ?? []).map(acct => ({
      address:  acct.address,
      uiAmount: acct.amount.uiAmount,
    }))

    toCache(cacheKey, holders)
    res.json({ holders, cached: false, ts: Date.now() })
  } catch (err) {
    console.error('[onchain/whales]', err)
    res.status(502).json({ error: 'Failed to fetch largest token accounts' })
  }
})

// ─── Recent large transfers ───────────────────────────────────────────────────

interface Transfer {
  signature: string
  timestamp: number
  fromAddress: string
  toAddress: string
  amount: number
  type: 'buy' | 'sell' | 'transfer'
}

router.get('/flows/:mint', async (req: Request, res: Response): Promise<void> => {
  const { mint } = req.params
  const minAmount = parseInt(req.query['min'] as string ?? '0', 10) || 0

  if (!HELIUS_API_KEY) {
    res.status(503).json({ error: 'HELIUS_API_KEY not configured' })
    return
  }

  const cacheKey = `flows_${mint}_${minAmount}`
  const cached = fromCache<Transfer[]>(cacheKey)
  if (cached) {
    res.json({ transfers: cached, cached: true })
    return
  }

  try {
    // Use Helius enhanced transactions API
    const url = `${HELIUS_API}/addresses/${mint}/transactions?api-key=${HELIUS_API_KEY}&limit=50&type=TRANSFER`
    const res2 = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res2.ok) throw new Error(`Helius API HTTP ${res2.status}`)

    const txns = await res2.json() as Array<{
      signature: string
      timestamp: number
      tokenTransfers?: Array<{
        fromUserAccount: string
        toUserAccount: string
        tokenAmount: number
        mint: string
      }>
    }>

    const transfers: Transfer[] = txns
      .flatMap(tx =>
        (tx.tokenTransfers ?? [])
          .filter(t => t.mint === mint && t.tokenAmount >= minAmount)
          .map(t => ({
            signature:   tx.signature,
            timestamp:   tx.timestamp * 1000,
            fromAddress: t.fromUserAccount,
            toAddress:   t.toUserAccount,
            amount:      t.tokenAmount,
            type:        'transfer' as const,
          }))
      )
      .slice(0, 20)

    toCache(cacheKey, transfers)
    res.json({ transfers, cached: false, ts: Date.now() })
  } catch (err) {
    console.error('[onchain/flows]', err)
    res.status(502).json({ error: 'Failed to fetch on-chain flows' })
  }
})

export default router
