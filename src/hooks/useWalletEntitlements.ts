/**
 * useWalletEntitlements
 *
 * Checks the user's associated Solana wallet for $AGNTCBRO balance
 * and returns tier + scan entitlements.
 *
 * Works with:
 * - Connected wallet (via Solana wallet adapter)
 * - Associated wallet (linked to email account in Supabase)
 *
 * Calls /api/wallet-entitlements to get server-side verification.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WalletEntitlements {
  balance: number;
  usdValue: number;
  tokenPriceUsd: number;
  tier: 'free' | 'holder' | 'whale';
  monthlyLimit: number;  // -1 = unlimited
  monthlyUsed: number;
  freeScansRemaining: number;
  paidCredits: number;
  totalRemaining: number;  // -1 = unlimited
  holderTierUnlocked: boolean;
  whaleTierUnlocked: boolean;
  loading: boolean;
  error: string | null;
  checkedAt: string | null;
}

const DEFAULT_STATE: WalletEntitlements = {
  balance: 0,
  usdValue: 0,
  tokenPriceUsd: 0,
  tier: 'free',
  monthlyLimit: 10,
  monthlyUsed: 0,
  freeScansRemaining: 10,
  paidCredits: 0,
  totalRemaining: 10,
  holderTierUnlocked: false,
  whaleTierUnlocked: false,
  loading: false,
  error: null,
  checkedAt: null,
};

// ── Cache ────────────────────────────────────────────────────────────────────

interface EntitlementCache extends Omit<WalletEntitlements, 'loading' | 'error'> {}

function cacheKey(addr: string) {
  return `agntcbro_entitlements_${addr}`;
}

function readCache(addr: string): EntitlementCache | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(addr));
    if (!raw) return null;
    const data = JSON.parse(raw) as EntitlementCache;
    // Cache valid for 2 minutes
    if (data.checkedAt && Date.now() - new Date(data.checkedAt).getTime() < 120_000) {
      return data;
    }
    return null;
  } catch { return null; }
}

function writeCache(addr: string, data: EntitlementCache) {
  try {
    sessionStorage.setItem(cacheKey(addr), JSON.stringify(data));
  } catch { /* quota — ignore */ }
}

function clearCache(addr: string) {
  try { sessionStorage.removeItem(cacheKey(addr)); } catch { /* ignore */ }
}

// ── Test wallets (unrestricted) ───────────────────────────────────────────────

const TEST_WALLETS = new Set<string>([
  'J4wsP4HZHDL5SPa7kZBQGcyksrCdHoYgVFigiW1qFGuC',
]);

const TEST_STATE: WalletEntitlements = {
  balance: 999_999_999,
  usdValue: 999_999,
  tokenPriceUsd: 0,
  tier: 'whale',
  monthlyLimit: -1,
  monthlyUsed: 0,
  freeScansRemaining: 999,
  paidCredits: 999,
  totalRemaining: -1,
  holderTierUnlocked: true,
  whaleTierUnlocked: true,
  loading: false,
  error: null,
  checkedAt: new Date().toISOString(),
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWalletEntitlements(
  associatedWalletAddress?: string | null,
  userId?: string | null,
): WalletEntitlements & { refresh: () => void } {
  const { publicKey } = useWallet();
  const [state, setState] = useState<WalletEntitlements>(DEFAULT_STATE);
  const runId = useRef(0);
  const refreshing = useRef(false);

  // Use connected wallet or associated wallet
  const walletAddr = publicKey?.toBase58() || associatedWalletAddress || '';

  const doCheck = useCallback(async (addr: string, uid?: string | null) => {
    if (!addr) {
      setState(DEFAULT_STATE);
      return;
    }

    // Test wallet bypass
    if (TEST_WALLETS.has(addr)) {
      setState(TEST_STATE);
      return;
    }

    // Check cache first
    const cached = readCache(addr);
    if (cached) {
      setState({ ...cached, loading: false, error: null });
      return;
    }

    const currentRun = ++runId.current;
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch('/api/wallet-entitlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: addr,
          userId: uid || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (currentRun !== runId.current) return;

      const entitlements: WalletEntitlements = {
        balance: data.balance ?? 0,
        usdValue: data.usdValue ?? 0,
        tokenPriceUsd: data.tokenPriceUsd ?? 0,
        tier: data.tier ?? 'free',
        monthlyLimit: data.monthlyLimit ?? 10,
        monthlyUsed: data.monthlyUsed ?? 0,
        freeScansRemaining: data.freeScansRemaining ?? 10,
        paidCredits: data.paidCredits ?? 0,
        totalRemaining: data.totalRemaining ?? 10,
        holderTierUnlocked: data.holderTierUnlocked ?? false,
        whaleTierUnlocked: data.whaleTierUnlocked ?? false,
        loading: false,
        error: null,
        checkedAt: data.checkedAt ?? new Date().toISOString(),
      };

      // Cache the result
      const { loading: _l, error: _e, ...cacheData } = entitlements;
      writeCache(addr, cacheData);

      setState(entitlements);
    } catch (err: any) {
      if (currentRun !== runId.current) return;
      console.error('[useWalletEntitlements] Error:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: err?.message ?? 'Failed to check wallet entitlements',
      }));
    }
  }, []);

  useEffect(() => {
    if (!walletAddr) {
      setState(DEFAULT_STATE);
      return;
    }

    doCheck(walletAddr, userId);
  }, [walletAddr, userId, doCheck]);

  const refresh = useCallback(() => {
    if (!walletAddr || refreshing.current) return;
    refreshing.current = true;
    clearCache(walletAddr);
    doCheck(walletAddr, userId).finally(() => { refreshing.current = false });
  }, [walletAddr, userId, doCheck]);

  return { ...state, refresh };
}