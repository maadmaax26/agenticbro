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

async function fetchLivePrice(): Promise<number> {
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
  return 0
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

async function fetchBalance(ownerAddress: string): Promise<number> {
  for (const rpc of RPC_ENDPOINTS) {
    console.log(`[TokenGating] Trying RPC: ${rpc}`)
    const result = await fetchBalanceFromRpc(rpc, ownerAddress)
    if (result !== null) {
      console.log(`[TokenGating] Balance from ${rpc}: ${result}`)
      return result
    }
  }

  console.error('[TokenGating] ALL RPCs failed — could not read balance')
  return 0
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTokenGating(): TokenGatingState {
  const { publicKey, connected } = useWallet()
  const [state, setState] = useState<TokenGatingState>(DEFAULT_STATE)
  const walletAddr = publicKey?.toBase58() ?? ''
  const runId = useRef(0)

  const refresh = useCallback(async () => {
    if (!connected || !walletAddr) {
      setState(DEFAULT_STATE)
      return
    }

    const currentRun = ++runId.current
    setState(prev => ({ ...prev, loading: true, error: null }))
    console.log(`[TokenGating] ── Run #${currentRun} for ${walletAddr} ──`)

    try {
      const [balance, livePrice] = await Promise.all([
        fetchBalance(walletAddr),
        fetchLivePrice(),
      ])

      if (currentRun !== runId.current) return

      const usdValue = balance * livePrice
      console.log(`[TokenGating] RESULT: ${balance} AGNTCBRO × $${livePrice} = $${usdValue.toFixed(4)} USD`)
      console.log(`[TokenGating] Holder ($${HOLDER_TIER_USD}): ${usdValue >= HOLDER_TIER_USD ? 'UNLOCKED' : 'locked'}`)
      console.log(`[TokenGating] Whale ($${WHALE_TIER_USD}): ${usdValue >= WHALE_TIER_USD ? 'UNLOCKED' : 'locked'}`)

      setState({
        balance,
        usdValue,
        tokenPriceUsd: livePrice,
        holderTierUnlocked: usdValue >= HOLDER_TIER_USD,
        whaleTierUnlocked: usdValue >= WHALE_TIER_USD,
        loading: false,
        error: null,
      })
    } catch (err) {
      if (currentRun !== runId.current) return
      console.error('[TokenGating] Unexpected error:', err)
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Could not verify AGNTCBRO balance. Please try again.',
      }))
    }
  }, [connected, walletAddr])

  // Auto-run on wallet connect / address change
  useEffect(() => {
    refresh()
  }, [refresh])

  return state
}
