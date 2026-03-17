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
 * Tier logic:
 *   USD value >= $100   → Holder Tier unlocked
 *   USD value >= $1,000 → Whale Tier unlocked
 */

import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'

// AGNTCBRO SPL token mint address
const AGNTCBRO_MINT_STR = '52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump'
const AGNTCBRO_MINT = new PublicKey(AGNTCBRO_MINT_STR)

// Price source 1: DexScreener
const DEXSCREENER_PAIR = 'bwapiak2d43zt443x6wczj4rdeamdcba5mdrzz3rqd9k'
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/pairs/solana/${DEXSCREENER_PAIR}`

// Price source 2: pump.fun (backup)
const PUMPFUN_API = `https://frontend-api.pump.fun/coins/${AGNTCBRO_MINT_STR}`

// USD thresholds for tier access
const HOLDER_TIER_USD = 100    // $100 USD → Holder Tier
const WHALE_TIER_USD  = 1000   // $1,000 USD → Whale Tier

// Last-resort fallback if both sources fail (conservative — blocks access)
const FALLBACK_PRICE_USD = 0

export interface TokenGatingState {
  /** Raw AGNTCBRO token balance (human-readable, already divided by decimals) */
  balance: number
  /** USD value of held tokens at live price */
  usdValue: number
  /** Live price per token in USD (from DexScreener) */
  tokenPriceUsd: number
  /** Holder Tier access granted (usdValue >= $100) */
  holderTierUnlocked: boolean
  /** Whale Tier access granted (usdValue >= $1,000) */
  whaleTierUnlocked: boolean
  /** True while the balance or price fetch is in-flight */
  loading: boolean
  /** Error message if the fetch failed */
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

/**
 * Attempt to get price from DexScreener.
 * Returns a valid positive number, or null if unavailable.
 */
async function fetchPriceFromDexScreener(): Promise<number | null> {
  try {
    const res = await fetch(DEXSCREENER_API, { headers: { 'Accept': 'application/json' } })
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

/**
 * Attempt to get price from pump.fun as a backup.
 * pump.fun returns { usd_market_cap, virtual_sol_reserves, virtual_token_reserves, ... }
 * Price (USD) = (virtual_sol_reserves / virtual_token_reserves) × SOL/USD price.
 * pump.fun also exposes `usd_market_cap` and total supply so we can derive it directly.
 * Returns a valid positive number, or null if unavailable.
 */
async function fetchPriceFromPumpFun(): Promise<number | null> {
  try {
    const res = await fetch(PUMPFUN_API, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()

    // pump.fun may return `usd_market_cap` and `total_supply`
    const marketCap: number = data?.usd_market_cap ?? 0
    const totalSupply: number = data?.total_supply ?? 0
    if (marketCap > 0 && totalSupply > 0) {
      // token decimals are 6 on pump.fun
      const humanSupply = totalSupply / 1_000_000
      const price = marketCap / humanSupply
      if (price > 0) return price
    }

    // Alternative: derive from virtual reserves if market cap not available
    const solReserves: number = data?.virtual_sol_reserves ?? 0
    const tokenReserves: number = data?.virtual_token_reserves ?? 0
    const solPriceUsd: number = data?.sol_price_usd ?? 0
    if (solReserves > 0 && tokenReserves > 0 && solPriceUsd > 0) {
      // token reserves use 6 decimals, SOL uses 9 decimals on pump.fun
      const price = (solReserves / 1e9) / (tokenReserves / 1e6) * solPriceUsd
      if (price > 0) return price
    }

    return null
  } catch {
    return null
  }
}

/**
 * Fetch live AGNTCBRO price (USD).
 * Tries DexScreener first, falls back to pump.fun, then returns 0.
 */
async function fetchLivePrice(): Promise<number> {
  const dex = await fetchPriceFromDexScreener()
  if (dex !== null) return dex

  console.warn('DexScreener price unavailable — falling back to pump.fun')
  const pump = await fetchPriceFromPumpFun()
  if (pump !== null) return pump

  console.warn('Both DexScreener and pump.fun price feeds unavailable')
  return FALLBACK_PRICE_USD
}

// Reliable public RPC fallbacks tried in order when the primary fails
const FALLBACK_RPCS = [
  'https://solana-rpc.publicnode.com',
  'https://rpc.ankr.com/solana',
  'https://api.mainnet-beta.solana.com',
]

/**
 * Try to fetch token accounts from multiple RPC endpoints until one succeeds.
 * Uses the ConnectionProvider's connection first, then works through FALLBACK_RPCS.
 */
async function fetchTokenAccountsWithFallback(
  primaryConnection: import('@solana/web3.js').Connection,
  owner: import('@solana/web3.js').PublicKey,
): Promise<import('@solana/web3.js').RpcResponseAndContext<Array<import('@solana/web3.js').ParsedTokenAccountData extends infer T ? any : any>> | null> {
  // We just need the raw result, use dynamic import to get Connection class
  const { Connection } = await import('@solana/web3.js')

  const endpoints = [
    primaryConnection,
    ...FALLBACK_RPCS.map(url => new Connection(url, 'confirmed')),
  ]

  for (let i = 0; i < endpoints.length; i++) {
    const conn = endpoints[i]
    const label = i === 0 ? 'primary RPC' : FALLBACK_RPCS[i - 1]
    try {
      console.log(`[TokenGating] Trying ${label}...`)
      const result = await conn.getParsedTokenAccountsByOwner(owner, { mint: AGNTCBRO_MINT })
      console.log(`[TokenGating] ✓ ${label} responded — ${result.value.length} account(s) found`)
      return result as any
    } catch (err) {
      console.warn(`[TokenGating] ✗ ${label} failed:`, err)
    }
  }

  console.error('[TokenGating] All RPC endpoints failed')
  return null
}

export function useTokenGating(): TokenGatingState {
  const { connection } = useConnection()
  const { publicKey, connected } = useWallet()
  const [state, setState] = useState<TokenGatingState>(DEFAULT_STATE)

  useEffect(() => {
    if (!connected || !publicKey) {
      setState(DEFAULT_STATE)
      return
    }

    let cancelled = false

    async function checkBalance() {
      setState(prev => ({ ...prev, loading: true, error: null }))
      console.log('[TokenGating] Checking balance for:', publicKey!.toBase58())

      try {
        // Fetch price and token accounts in parallel (accounts with RPC fallback)
        const [tokenAccounts, livePrice] = await Promise.all([
          fetchTokenAccountsWithFallback(connection, publicKey!),
          fetchLivePrice(),
        ])

        if (cancelled) return

        console.log('[TokenGating] Live price USD:', livePrice)

        // Sum balances across all accounts for this mint (usually just one)
        let rawBalance = 0
        if (tokenAccounts) {
          for (const { account } of tokenAccounts.value) {
            const parsed = (account.data as any).parsed?.info?.tokenAmount
            if (parsed) {
              const amt = parsed.uiAmount ?? 0
              console.log('[TokenGating] Account balance:', amt)
              rawBalance += amt
            }
          }
        }

        const usdValue = rawBalance * livePrice
        console.log(`[TokenGating] Total: ${rawBalance} AGNTCBRO = $${usdValue.toFixed(4)} USD`)

        setState({
          balance: rawBalance,
          usdValue,
          tokenPriceUsd: livePrice,
          holderTierUnlocked: usdValue >= HOLDER_TIER_USD,
          whaleTierUnlocked:  usdValue >= WHALE_TIER_USD,
          loading: false,
          error: tokenAccounts === null ? 'RPC unavailable — balance may be inaccurate' : null,
        })
      } catch (err) {
        if (cancelled) return
        console.error('[TokenGating] Unexpected error:', err)
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Could not verify AGNTCBRO balance. Please try again.',
        }))
      }
    }

    checkBalance()

    return () => { cancelled = true }
  }, [connected, publicKey?.toBase58()]) // use .toBase58() to avoid object ref changes

  return state
}
