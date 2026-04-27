/**
 * useTokenGating
 *
 * Checks the connected wallet's AGNTCBRO balance on Solana mainnet and
 * fetches the live USD price to calculate tier access.
 *
 * Price sources (tried in order):
 *   1. DexScreener API
 *   2. pump.fun API (fallback)
 *   3. Jupiter API (fallback)
 *
 * Balance source:
 *   Uses @solana/web3.js Connection for proper CORS handling on mobile.
 *
 * Tier logic:
 *   USD value >= $100   → Holder Tier
 *   USD value >= $1000   → Whale Tier
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'

// ─── Test wallets (unrestricted access — no token check, no burns) ────────────

const TEST_WALLETS = new Set<string>([
  'J4wsP4HZHDL5SPa7kZBQGcyksrCdHoYgVFigiW1qFGuC',
])

export function isTestWallet(address: string): boolean {
  return TEST_WALLETS.has(address)
}

const TEST_WALLET_STATE: TokenGatingState = {
  balance:             999_999_999,
  usdValue:            999_999,
  tokenPriceUsd:       0,
  holderTierUnlocked:  true,
  whaleTierUnlocked:   true,
  loading:             false,
  error:               null,
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AGNTCBRO_MINT = '52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump'

// Price APIs
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/tokens/${AGNTCBRO_MINT}`
const PUMPFUN_API = `https://frontend-api.pump.fun/coins/${AGNTCBRO_MINT}`
const JUPITER_PRICE_API = `https://api.jup.ag/price/v2?ids=${AGNTCBRO_MINT}`

const HOLDER_TIER_USD = 100  // $100 USD in AGNTCBRO
const WHALE_TIER_USD  = 1000  // $1000 USD in AGNTCBRO

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
    if (!res.ok) return null
    const data = await res.json()
    const pairs = data?.pairs
    if (!Array.isArray(pairs) || pairs.length === 0) return null
    const sorted = [...pairs].sort((a: any, b: any) =>
      (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0)
    )
    const best = sorted[0]
    const raw = best?.priceUsd ?? null
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
    return null
  } catch {
    return null
  }
}

async function fetchPriceFromJupiter(): Promise<number | null> {
  try {
    const res = await fetch(JUPITER_PRICE_API, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    const priceStr = data?.data?.[AGNTCBRO_MINT]?.price ?? null
    if (priceStr === null) return null
    const price = parseFloat(priceStr)
    return isNaN(price) || price <= 0 ? null : price
  } catch {
    return null
  }
}

async function fetchLivePriceOrNull(): Promise<number | null> {
  const [dexResult, pumpResult, jupiterResult] = await Promise.allSettled([
    fetchPriceFromDexScreener(),
    fetchPriceFromPumpFun(),
    fetchPriceFromJupiter(),
  ])

  const dex = dexResult.status === 'fulfilled' ? dexResult.value : null
  const pump = pumpResult.status === 'fulfilled' ? pumpResult.value : null
  const jupiter = jupiterResult.status === 'fulfilled' ? jupiterResult.value : null

  if (dex !== null) return dex
  if (pump !== null) return pump
  if (jupiter !== null) return jupiter
  
  return null
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTokenGating(): TokenGatingState & { refresh: () => void } {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const [state, setState] = useState<TokenGatingState>(DEFAULT_STATE)
  const walletAddr = publicKey?.toBase58() ?? ''
  const runId  = useRef(0)
  const lastAddr = useRef('')
  const refreshing = useRef(false)

  const runCheck = useCallback(async (addr: string, currentRun: number): Promise<boolean> => {
    try {
      // Use web3.js connection (properly handles CORS on mobile)
      let balance: number = 0
      
      console.log(`[TokenGating] Fetching balance via web3.js for ${addr.slice(0,8)}...`)
      
      try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          new PublicKey(addr),
          { mint: new PublicKey(AGNTCBRO_MINT) }
        )
        
        for (const { account } of tokenAccounts.value) {
          const tokenAmount = account.data.parsed.info.tokenAmount
          const amt = Number(tokenAmount.uiAmount ?? tokenAmount.uiAmountString ?? 0)
          if (!isNaN(amt)) {
            balance += amt
          }
        }
        console.log(`[TokenGating] Balance: ${balance} AGNTCBRO`)
      } catch (web3Err: any) {
        console.error('[TokenGating] web3.js error:', web3Err?.message)
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Connection failed. Check your network and try again.',
        }))
        return false
      }

      if (currentRun !== runId.current) return false

      // Fetch price
      const livePrice = await fetchLivePriceOrNull()
      
      if (currentRun !== runId.current) return false

      const effectivePrice = livePrice ?? 0
      const usdValue = balance * effectivePrice
      const holderTierUnlocked = livePrice !== null && usdValue >= HOLDER_TIER_USD
      const whaleTierUnlocked = livePrice !== null && usdValue >= WHALE_TIER_USD

      console.log(`[TokenGating] ${balance} AGNTCBRO × $${effectivePrice} = $${usdValue.toFixed(4)}`)

      if (livePrice !== null) {
        writeCache(addr, { balance, usdValue, tokenPriceUsd: livePrice, holderTierUnlocked, whaleTierUnlocked })
      }

      setState({ balance, usdValue, tokenPriceUsd: effectivePrice, holderTierUnlocked, whaleTierUnlocked, loading: false, error: null })
      return true
    } catch (err) {
      if (currentRun !== runId.current) return false
      console.error('[TokenGating] Error:', err)
      setState(prev => ({ ...prev, loading: false, error: 'Could not verify balance. Please try again.' }))
      return false
    }
  }, [connection])

  const doCheck = useCallback(async (addr: string) => {
    const cached = readCache(addr)
    if (cached) {
      console.log(`[TokenGating] Cache hit for ${addr.slice(0,8)}...`)
      setState({ ...cached, loading: false, error: null })
      return
    }

    const currentRun = ++runId.current
    setState(prev => ({ ...prev, loading: true, error: null }))
    console.log(`[TokenGating] Checking balance for ${addr.slice(0,8)}...`)

    const ok = await runCheck(addr, currentRun)

    // Single retry after 1.5s if failed
    if (!ok && currentRun === runId.current) {
      console.log('[TokenGating] Retrying in 1.5s...')
      await new Promise(r => setTimeout(r, 1500))
      if (currentRun !== runId.current) return
      setState(prev => ({ ...prev, loading: true, error: null }))
      await runCheck(addr, currentRun)
    }
  }, [runCheck])

  useEffect(() => {
    if (!walletAddr) {
      const timer = setTimeout(() => {
        if (lastAddr.current) {
          clearCache(lastAddr.current)
          lastAddr.current = ''
        }
        setState(DEFAULT_STATE)
      }, 500)
      return () => clearTimeout(timer)
    }

    lastAddr.current = walletAddr

    if (isTestWallet(walletAddr)) {
      setState(TEST_WALLET_STATE)
      return
    }

    doCheck(walletAddr)
  }, [walletAddr, doCheck])

  const refresh = useCallback(() => {
    if (!walletAddr || refreshing.current) return
    refreshing.current = true
    clearCache(walletAddr)
    doCheck(walletAddr).finally(() => { refreshing.current = false })
  }, [walletAddr, doCheck])

  return { ...state, refresh }
}