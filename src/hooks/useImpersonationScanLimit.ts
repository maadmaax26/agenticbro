/**
 * useImpersonationScanLimit
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks daily Token Impersonation Scan usage per session/wallet.
 *
 * Limits:
 *   • Anonymous (no wallet): 2 free scans per day
 *   • Connected wallet:      5 free scans per day
 *
 * Storage: localStorage, keyed by wallet address or "anon".
 * Resets automatically at midnight (date-based key).
 */

import { useState, useCallback, useEffect } from 'react'

// ─── Config ───────────────────────────────────────────────────────────────────

const ANON_DAILY_LIMIT   = 2
const WALLET_DAILY_LIMIT = 3

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
}

function storageKey(walletAddress: string | undefined): string {
  return `impersonation_scan_${walletAddress ?? 'anon'}`
}

interface StoredData {
  date:  string
  count: number
}

function loadCount(walletAddress: string | undefined): number {
  try {
    const raw = localStorage.getItem(storageKey(walletAddress))
    if (!raw) return 0
    const data: StoredData = JSON.parse(raw)
    // Reset if stored date is not today
    if (data.date !== todayStr()) return 0
    return data.count
  } catch {
    return 0
  }
}

function saveCount(walletAddress: string | undefined, count: number): void {
  try {
    const data: StoredData = { date: todayStr(), count }
    localStorage.setItem(storageKey(walletAddress), JSON.stringify(data))
  } catch {
    // localStorage blocked — fail silently
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface ImpersonationScanLimit {
  scansUsed:      number
  scansLimit:     number
  scansRemaining: number
  canScan:        boolean
  isAnon:         boolean
  /** Call this after a successful scan to consume one use */
  recordScan:     () => void
}

export function useImpersonationScanLimit(
  walletAddress: string | undefined,
): ImpersonationScanLimit {
  const isAnon   = !walletAddress
  const limit    = isAnon ? ANON_DAILY_LIMIT : WALLET_DAILY_LIMIT

  const [scansUsed, setScansUsed] = useState<number>(() =>
    loadCount(walletAddress),
  )

  // Re-read from storage whenever the wallet address changes (connect / disconnect)
  useEffect(() => {
    setScansUsed(loadCount(walletAddress))
  }, [walletAddress])

  const recordScan = useCallback(() => {
    const next = loadCount(walletAddress) + 1
    saveCount(walletAddress, next)
    setScansUsed(next)
  }, [walletAddress])

  const scansRemaining = Math.max(0, limit - scansUsed)

  return {
    scansUsed,
    scansLimit:  limit,
    scansRemaining,
    canScan:     scansRemaining > 0,
    isAnon,
    recordScan,
  }
}
