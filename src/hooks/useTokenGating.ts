/**
 * useTokenGating
 *
 * Checks the connected wallet's AGNTCBRO balance on Solana mainnet and
 * fetches the live USD price to calculate tier access.
 *
 * Price sources (tried in order):
 *   1. DexScreener API
 *   2. pump.fun API (fallback)
 *
 * Balance source:
 *   Raw JSON-RPC POST via fetch() to multiple RPC endpoints.
 *   This bypasses @solana/web3.js entirely for maximum reliability.
 *
 * Tier logic:
 *   USD value >= $100   → Holder Tier
 *   USD value >= $1,000 → Whale Tier
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const AGNTCBRO_MINT = '52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump'

const DEXSCREENER_PAIR = 'bwapiak2d43zt443x6wczj4rdeamdcba5mdrzz3rqd9k'
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/pairs/solana/${DEXSCREENER_PAIR}`
const PUMPFUN_API = `https://frontend-api.pump.fun/coins/${AGNTCBRO_MINT}`

const HOLDER_TIER_USD = 100
const WHALE_TIER_USD = 150 // temporary test threshold (production: 1000)

// Multiple RPC endpoints — tried in order, first success wins
const RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://rpc.ankr.com/solana',
  'https://api.mainnet-beta.solana.com',
]

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TokenGatingState {
  balance: number
  usdValue: number
  tokenPriceUsd: number
  holderTierUnlocked: boolean
  whaleTierUnlocked: boolean
  loading: boolean
  error: string | null
}

const DEFAULT_STATE: TokenGatingState = {
  balance: 0,
  usdValue: 0,
  tokenPriceUsd: 0,
  holderTierUnlocked: false,
  whaleTierUnlocked: false,
  loading: false,
  error: null,
}

// ─── Session cache ────────────────────────────────────────────────────────────
// One balance+tier check per wallet per browser session. Clears on tab close.

interface GatingCache {
  balance: number
  usdValue: number
  tokenPriceUsd: number
  holderTierUnlocked: boolean
  whaleTierUnlocked: boolean
}

function cacheKey(addr: string) {
  return `agntcbro_gating_${addr}`
}

function readCache(addr: string): GatingCache | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(addr))
    if (!raw) return null
    return JSON.parse(raw) as GatingCache
  } catch {
    return null
  }
}

function writeCache(addr: string, data: GatingCache) {
  try {
    sessionStorage.setItem(cacheKey(addr), JSON.stringify(data))
  } catch { /* storage quota — ignore */ }
}

function clearCache(addr: string) {
  try {
    sessionStorage.removeItem(cacheKey(addr))
  } catch { /* ignore */ }
}

// ─── Price fetching ──────────────────────────────────────────────────────────

async function fetchPriceFromDexScreener(): Promise<number | null> {
  try {
    const res = await fetch(DEXSCREENER_API, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      console.warn('[TokenGating] DexScreener returned', res.status)
      return null
    }
    const data = await res.json()
    const raw = data?.pair?.priceUsd ?? data?.pairs?.[0]?.priceUsd ?? null
    if (raw === null) return null
    const price = parseFloat(raw)
    return isNaN(price) || price <= 0 ? null : price
  } catch (err) {
    console.warn('[TokenGating] DexScreener fetch error:', err)
    return null
  }
}

async function fetchPriceFromPumpFun(): Promise<number | null> {
  try {
    const res = await fetch(PUMPFUN_API, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()

    const marketCap: number = data?.usd_market_cap ?? 0
    const totalSupply: number = data?.total_supply ?? 0
    if (marketCap > 0 && totalSupply > 0) {
      const price = marketCap / (totalSupply / 1_000_000)
      if (price > 0) return price
    }

    const solReserves: number = data?.virtual_sol_reserves ?? 0
    const tokenReserves: number = data?.virtual_token_reserves ?? 0
    const solPriceUsd: number = data?.sol_price_usd ?? 0
    if (solReserves > 0 && tokenReserves > 0 && solPriceUsd > 0) {
      const price = (solReserves / 1e9) / (tokenReserves / 1e6) * solPriceUsd
      if (price > 0) return price
    }

    return null
  } catch {
    return null
  }
}


// ─── Balance fetching (raw JSON-RPC only — no web3.js dependency) ────────────

async function fetchBalanceFromRpc(
  rpcUrl: string,
  ownerAddress: string,
): Promise<number | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          ownerAddress,
          { mint: AGNTCBRO_MINT },
          { encoding: 'jsonParsed' },
        ],
      }),
    })

    if (!res.ok) {
      console.warn(`[TokenGating] ${rpcUrl} HTTP ${res.status}`)
      return null
    }

    const json = await res.json()

    if (json.error) {
      console.warn(`[TokenGating] ${rpcUrl} RPC error:`, json.error.message ?? json.error)
      return null
    }

    const accounts = json?.result?.value ?? []
    console.log(`[TokenGating] ${rpcUrl} → ${accounts.length} account(s)`)

    let balance = 0
    for (const acct of accounts) {
      const tokenAmount = acct?.account?.data?.parsed?.info?.tokenAmount
      if (tokenAmount) {
        const amt = Number(tokenAmount.uiAmount ?? tokenAmount.uiAmountString ?? 0)
        if (!isNaN(amt)) {
          console.log(`[TokenGating]   account balance: ${amt}`)
          balance += amt
        }
      }
    }

    return balance
  } catch (err) {
    console.warn(`[TokenGating] ${rpcUrl} fetch failed:`, err)
    return null
  }
}

async function fetchBalance(ownerAddress: string): Promise<number | null> {
  for (const rpc of RPC_ENDPOINTS) {
    console.log(`[TokenGating] Trying RPC: ${rpc}`)
    const result = await fetchBalanceFromRpc(rpc, ownerAddress)
    if (result !== null) {
      console.log(`[TokenGating] Balance from ${rpc}: ${result}`)
      return result
    }
  }

  console.error('[TokenGating] ALL RPCs failed — could not read balance')
  return null // null = total failure (distinct from genuine 0 balance)
}

async function fetchLivePriceOrNull(): Promise<number | null> {
  const dex = await fetchPriceFromDexScreener()
  if (dex !== null) {
    console.log('[TokenGating] Price (DexScreener):', dex)
    return dex
  }

  console.warn('[TokenGating] DexScreener unavailable, trying pump.fun...')
  const pump = await fetchPriceFromPumpFun()
  if (pump !== null) {
    console.log('[TokenGating] Price (pump.fun):', pump)
    return pump
  }

  console.error('[TokenGating] All price feeds failed')
  return null
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTokenGating(): TokenGatingState {
  const { publicKey } = useWallet()
  const [state, setState] = useState<TokenGatingState>(DEFAULT_STATE)
  const walletAddr = publicKey?.toBase58() ?? ''
  const runId  = useRef(0)
  const lastAddr = useRef('') // survives publicKey → null on disconnect

  // Core fetch logic — returns true on success, false on failure.
  const runCheck = useCallback(async (addr: string, currentRun: number): Promise<boolean> => {
    try {
      const [balance, livePrice] = await Promise.all([
        fetchBalance(addr),
        fetchLivePriceOrNull(),
      ])

      if (currentRun !== runId.current) return false

      // If either fetch totally failed, don't cache — allow retry
      if (balance === null || livePrice === null) {
        console.warn('[TokenGating] Fetch incomplete — balance:', balance, 'price:', livePrice)
        setState(prev => ({
          ...prev,
          loading: false,
          error: balance === null
            ? 'Could not read wallet balance — RPCs may be rate-limited.'
            : 'Could not fetch token price — price feeds unavailable.',
        }))
        return false
      }

      const usdValue           = balance * livePrice
      const holderTierUnlocked = usdValue >= HOLDER_TIER_USD
      const whaleTierUnlocked  = usdValue >= WHALE_TIER_USD

      console.log(`[TokenGating] ${balance} AGNTCBRO × $${livePrice} = $${usdValue.toFixed(4)} USD`)
      console.log(`[TokenGating] Holder: ${holderTierUnlocked ? 'UNLOCKED' : 'locked'} | Whale: ${whaleTierUnlocked ? 'UNLOCKED' : 'locked'}`)

      // Only cache successful results — never cache failures
      writeCache(addr, { balance, usdValue, tokenPriceUsd: livePrice, holderTierUnlocked, whaleTierUnlocked })

      setState({ balance, usdValue, tokenPriceUsd: livePrice, holderTierUnlocked, whaleTierUnlocked, loading: false, error: null })
      return true
    } catch (err) {
      if (currentRun !== runId.current) return false
      console.error('[TokenGating] Error:', err)
      setState(prev => ({ ...prev, loading: false, error: 'Could not verify AGNTCBRO balance. Please try again.' }))
      return false
    }
  }, [])

  // Stable check function — reads cache first, then fetches with one retry.
  const doCheck = useCallback(async (addr: string) => {
    // Return cached result immediately if already checked this session
    const cached = readCache(addr)
    if (cached) {
      console.log(`[TokenGating] Session cache hit for ${addr}`)
      setState({ ...cached, loading: false, error: null })
      return
    }

    const currentRun = ++runId.current
    setState(prev => ({ ...prev, loading: true, error: null }))
    console.log(`[TokenGating] ── Checking balance for ${addr} ──`)

    const ok = await runCheck(addr, currentRun)

    // If first attempt failed, retry once after 2 seconds
    if (!ok && currentRun === runId.current) {
      console.log('[TokenGating] First attempt failed — retrying in 2s…')
      await new Promise(r => setTimeout(r, 2000))
      if (currentRun !== runId.current) return // wallet changed during wait
      setState(prev => ({ ...prev, loading: true, error: null }))
      await runCheck(addr, currentRun)
    }
  }, [runCheck])

  // Single effect: fires exactly when the wallet address appears or disappears.
  // Using walletAddr (derived from publicKey) as the sole trigger avoids the
  // race condition where `connected` and `publicKey` update in separate renders.
  useEffect(() => {
    if (walletAddr) {
      lastAddr.current = walletAddr
      doCheck(walletAddr)
    } else {
      // publicKey became null — wallet disconnected or changed.
      // Use lastAddr to clear the cache even though publicKey is now null.
      if (lastAddr.current) {
        clearCache(lastAddr.current)
        lastAddr.current = ''
      }
      setState(DEFAULT_STATE)
    }
  }, [walletAddr, doCheck])

  return state
}
