/**
 * useTokenGating
 *
 * Checks the connected wallet's AGNTCBRO balance on Solana mainnet.
 * Token: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
 *
 * Tier logic (implied price $0.01 / token):
 *   >= 10,000  AGNTCBRO  (~$100)  → Holder Tier unlocked
 *   >= 100,000 AGNTCBRO  (~$1,000) → Whale Tier unlocked
 *
 * Per user config: BOTH tiers unlock at the $100 / 10,000-token threshold.
 */

import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'

// AGNTCBRO SPL token mint address
const AGNTCBRO_MINT = new PublicKey('52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump')

// Implied token price from white paper tokenomics
const TOKEN_PRICE_USD = 0.01

// Minimum USD value to unlock both tiers
const ACCESS_THRESHOLD_USD = 100

// Derived minimum token count
const MIN_TOKENS_FOR_ACCESS = ACCESS_THRESHOLD_USD / TOKEN_PRICE_USD // 10,000

export interface TokenGatingState {
  /** Raw AGNTCBRO token balance (human-readable, already divided by decimals) */
  balance: number
  /** USD value of held tokens at implied price */
  usdValue: number
  /** Holder Tier access granted */
  holderTierUnlocked: boolean
  /** Whale Tier access granted */
  whaleTierUnlocked: boolean
  /** True while the balance RPC call is in-flight */
  loading: boolean
  /** Error message if the fetch failed */
  error: string | null
}

const DEFAULT_STATE: TokenGatingState = {
  balance: 0,
  usdValue: 0,
  holderTierUnlocked: false,
  whaleTierUnlocked: false,
  loading: false,
  error: null,
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
        // Fetch all token accounts owned by this wallet for the AGNTCBRO mint
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey!,
          { mint: AGNTCBRO_MINT }
        )

        if (cancelled) return

        // Sum balances across all accounts for this mint (usually just one)
        let rawBalance = 0
        for (const { account } of tokenAccounts.value) {
          const parsed = account.data.parsed?.info?.tokenAmount
          if (parsed) {
            rawBalance += parsed.uiAmount ?? 0
          }
        }

        const usdValue = rawBalance * TOKEN_PRICE_USD
        const hasAccess = rawBalance >= MIN_TOKENS_FOR_ACCESS

        setState({
          balance: rawBalance,
          usdValue,
          // Both tiers unlock at the $100 / 10K-token threshold
          holderTierUnlocked: hasAccess,
          whaleTierUnlocked: hasAccess,
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
