/**
 * useTokenGating
 *
 * Checks the connected wallet's AGNTCBRO balance on Solana mainnet and
 * fetches the live USD price from DexScreener to calculate tier access.
 *
 * Token: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
 * Pair:  bwapiak2d43zt443x6wczj4rdeamdcba5mdrzz3rqd9k (Solana)
 *
 * Tier logic (live price from DexScreener):
 *   USD value >= $100   → Holder Tier unlocked
 *   USD value >= $1,000 → Whale Tier unlocked
 */

import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'

// AGNTCBRO SPL token mint address
const AGNTCBRO_MINT = new PublicKey('52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump')

// DexScreener pair address for AGNTCBRO/SOL on Solana
const DEXSCREENER_PAIR = 'bwapiak2d43zt443x6wczj4rdeamdcba5mdrzz3rqd9k'
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/pairs/solana/${DEXSCREENER_PAIR}`

// USD thresholds for tier access
const HOLDER_TIER_USD = 100    // $100 USD → Holder Tier
const WHALE_TIER_USD  = 1000   // $1,000 USD → Whale Tier

// Fallback price if DexScreener is unreachable (conservative — nearly nothing unlocks)
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

/** Fetch live AGNTCBRO price (USD) from DexScreener. Returns 0 on failure. */
async function fetchLivePrice(): Promise<number> {
  try {
    const res = await fetch(DEXSCREENER_API, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return FALLBACK_PRICE_USD
    const data = await res.json()
    const price = parseFloat(data?.pair?.priceUsd ?? data?.pairs?.[0]?.priceUsd ?? '0')
    return isNaN(price) ? FALLBACK_PRICE_USD : price
  } catch {
    return FALLBACK_PRICE_USD
  }
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

      try {
        // Run balance fetch and price fetch in parallel
        const [tokenAccounts, livePrice] = await Promise.all([
          connection.getParsedTokenAccountsByOwner(publicKey!, { mint: AGNTCBRO_MINT }),
          fetchLivePrice(),
        ])

        if (cancelled) return

        // Sum balances across all accounts for this mint (usually just one)
        let rawBalance = 0
        for (const { account } of tokenAccounts.value) {
          const parsed = account.data.parsed?.info?.tokenAmount
          if (parsed) {
            rawBalance += parsed.uiAmount ?? 0
          }
        }

        const usdValue = rawBalance * livePrice

        setState({
          balance: rawBalance,
          usdValue,
          tokenPriceUsd: livePrice,
          holderTierUnlocked: usdValue >= HOLDER_TIER_USD,
          whaleTierUnlocked:  usdValue >= WHALE_TIER_USD,
          loading: false,
          error: null,
        })
      } catch (err) {
        if (cancelled) return
        console.error('Token gating check failed:', err)
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Could not verify AGNTCBRO balance. Please try again.',
        }))
      }
    }

    checkBalance()

    return () => { cancelled = true }
  }, [connected, publicKey, connection])

  return state
}
