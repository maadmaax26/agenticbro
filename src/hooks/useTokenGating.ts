/**
 * useTokenGating
 *
 * Checks the connected wallet's AGNTCBRO balance on Solana mainnet and
 * fetches the live USD price to calculate tier access.
 *
 * Price sources (in order):
 *   1. DexScreener — pair bwapiak2d43zt443x6wczj4rdeamdcba5mdrzz3rqd9k
 *   2. pump.fun    — mint 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump (fallback)
 *
 * Balance sources (in order):
 *   1. Primary RPC from ConnectionProvider
 *   2. publicnode.com, ankr.com, api.mainnet-beta (fallbacks)
 *   3. Raw JSON-RPC POST as last resort
 *
 * Tier logic:
 *   USD value >= $100   → Holder Tier unlocked
 *   USD value >= $1,000 → Whale Tier unlocked
 */

import { useEffect, useState, useRef } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'

// ─── Constants ───────────────────────────────────────────────────────────────

const AGNTCBRO_MINT_STR = '52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump'
const AGNTCBRO_MINT = new PublicKey(AGNTCBRO_MINT_STR)

const DEXSCREENER_PAIR = 'bwapiak2d43zt443x6wczj4rdeamdcba5mdrzz3rqd9k'
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/pairs/solana/${DEXSCREENER_PAIR}`
const PUMPFUN_API = `https://frontend-api.pump.fun/coins/${AGNTCBRO_MINT_STR}`

const HOLDER_TIER_USD = 100
const WHALE_TIER_USD = 1000

const FALLBACK_RPCS = [
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
    if (!res.ok) return null
    const data = await res.json()
    const raw = data?.pair?.priceUsd ?? data?.pairs?.[0]?.priceUsd ?? null
    if (raw === null) return null
    const price = parseFloat(raw)
    return isNaN(price) || price <= 0 ? null : price
  } catch {
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
    console.log('[TokenGating] DexScreener price:', dex)
    return dex
  }

  console.warn('[TokenGating] DexScreener unavailable, trying pump.fun...')
  const pump = await fetchPriceFromPumpFun()
  if (pump !== null) {
    console.log('[TokenGating] pump.fun price:', pump)
    return pump
  }

  console.error('[TokenGating] Both price feeds failed')
  return 0
}

// ─── Balance fetching ────────────────────────────────────────────────────────

/**
 * Try getParsedTokenAccountsByOwner via @solana/web3.js Connection objects.
 * Tries the primary (from ConnectionProvider), then fallback RPCs.
 */
async function fetchBalanceViaWeb3(
  primaryConn: Connection,
  owner: PublicKey,
): Promise<number | null> {
  const connections = [
    { conn: primaryConn, label: 'primary RPC' },
    ...FALLBACK_RPCS.map(url => ({ conn: new Connection(url, 'confirmed'), label: url })),
  ]

  for (const { conn, label } of connections) {
    try {
      console.log(`[TokenGating] Trying ${label}...`)
      const result = await conn.getParsedTokenAccountsByOwner(owner, { mint: AGNTCBRO_MINT })
      console.log(`[TokenGating] ${label} returned ${result.value.length} account(s)`)

      let balance = 0
      for (const item of result.value) {
        const tokenAmount = (item.account.data as any)?.parsed?.info?.tokenAmount
        if (tokenAmount) {
          const amt = tokenAmount.uiAmount ?? 0
          console.log(`[TokenGating] Account balance: ${amt}`)
          balance += amt
        }
      }
      return balance
    } catch (err) {
      console.warn(`[TokenGating] ${label} failed:`, err)
    }
  }
  return null
}

/**
 * Last-resort: raw JSON-RPC POST to fetch token accounts.
 * Bypasses @solana/web3.js entirely in case there's a bundling issue.
 */
async function fetchBalanceViaJsonRpc(ownerBase58: string): Promise<number | null> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getTokenAccountsByOwner',
    params: [
      ownerBase58,
      { mint: AGNTCBRO_MINT_STR },
      { encoding: 'jsonParsed' },
    ],
  })

  for (const url of FALLBACK_RPCS) {
    try {
      console.log(`[TokenGating] JSON-RPC fallback: ${url}`)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) continue
      const json = await res.json()
      if (json.error) {
        console.warn(`[TokenGating] JSON-RPC error from ${url}:`, json.error)
        continue
      }

      let balance = 0
      const accounts = json?.result?.value ?? []
      console.log(`[TokenGating] JSON-RPC ${url} returned ${accounts.length} account(s)`)
      for (const acct of accounts) {
        const tokenAmount = acct?.account?.data?.parsed?.info?.tokenAmount
        if (tokenAmount) {
          const amt = tokenAmount.uiAmount ?? 0
          console.log(`[TokenGating] JSON-RPC account balance: ${amt}`)
          balance += amt
        }
      }
      return balance
    } catch (err) {
      console.warn(`[TokenGating] JSON-RPC ${url} failed:`, err)
    }
  }
  return null
}

/**
 * Fetch AGNTCBRO balance using web3.js first, then raw JSON-RPC as fallback.
 */
async function fetchBalance(primaryConn: Connection, owner: PublicKey): Promise<number> {
  // Try via @solana/web3.js first
  const web3Balance = await fetchBalanceViaWeb3(primaryConn, owner)
  if (web3Balance !== null) return web3Balance

  console.warn('[TokenGating] All web3.js RPCs failed — trying raw JSON-RPC...')

  // Last resort: raw fetch to RPC
  const rpcBalance = await fetchBalanceViaJsonRpc(owner.toBase58())
  if (rpcBalance !== null) return rpcBalance

  console.error('[TokenGating] ALL balance fetch methods failed')
  return 0
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTokenGating(): TokenGatingState {
  const { connection } = useConnection()
  const { publicKey, connected } = useWallet()
  const [state, setState] = useState<TokenGatingState>(DEFAULT_STATE)
  const walletAddr = publicKey?.toBase58() ?? ''

  // Ref to track latest run and prevent stale state updates
  const runId = useRef(0)

  useEffect(() => {
    if (!connected || !publicKey) {
      setState(DEFAULT_STATE)
      return
    }

    const currentRun = ++runId.current

    async function run() {
      setState(prev => ({ ...prev, loading: true, error: null }))
      console.log(`[TokenGating] ── Run #${currentRun} for ${publicKey!.toBase58()} ──`)

      try {
        const [balance, livePrice] = await Promise.all([
          fetchBalance(connection, publicKey!),
          fetchLivePrice(),
        ])

        // Discard result if a newer run started
        if (currentRun !== runId.current) return

        const usdValue = balance * livePrice
        console.log(`[TokenGating] Result: ${balance} AGNTCBRO × $${livePrice} = $${usdValue.toFixed(4)} USD`)
        console.log(`[TokenGating] Holder ($100): ${usdValue >= HOLDER_TIER_USD ? 'UNLOCKED' : 'locked'}`)
        console.log(`[TokenGating] Whale ($1000): ${usdValue >= WHALE_TIER_USD ? 'UNLOCKED' : 'locked'}`)

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
    }

    run()
  }, [connected, walletAddr])

  return state
}
