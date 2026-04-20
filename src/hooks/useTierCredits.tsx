/**
 * useTierCredits
 *
 * Manages monthly scan credits for Holder and Whale tier users.
 * 
 * Holder Tier (10K+ AGNTCBRO): 20 free scans per month
 * Whale Tier (100K+ AGNTCBRO): 20 free scans per month
 * 
 * After monthly allowance is used, users can purchase credits at $1/scan.
 */

import { useState, useEffect, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

export const TIER_MONTHLY_SCANS = 20; // 20 free scans per month for both tiers
export const SCAN_PRICE_USD = 1; // $1 per scan after allowance

// Test wallets get unlimited scans
const TEST_WALLETS_UNLIMITED = new Set<string>([
  'J4wsP4HZHDL5SPa7kZBQGcyksrCdHoYgVFigiW1qFGuC',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TierCreditsState {
  tierMonthlyScans: number;       // Total monthly allowance (20)
  tierScansUsed: number;          // Scans used this month
  tierScansRemaining: number;     // Scans remaining this month
  paidCredits: number;            // Purchased credits (don't expire)
  totalAvailable: number;         // tierScansRemaining + paidCredits
  hasScans: boolean;              // Can scan?
  loading: boolean;
  isTestWallet: boolean;
  useCredit: () => { success: boolean; remaining: number; type: 'tier' | 'paid' };
  addCredits: (amount: number) => void;
}

// ─── Internal State (without functions) ────────────────────────────────────────

interface TierCreditsData {
  tierMonthlyScans: number;
  tierScansUsed: number;
  tierScansRemaining: number;
  paidCredits: number;
  totalAvailable: number;
  hasScans: boolean;
  loading: boolean;
  isTestWallet: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getStorageKey(walletAddress: string): string {
  return `agenticbro_tier_${walletAddress.toLowerCase()}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTierCredits(walletAddress: string | null): TierCreditsState {
  const [data, setData] = useState<TierCreditsData>({
    tierMonthlyScans: TIER_MONTHLY_SCANS,
    tierScansUsed: 0,
    tierScansRemaining: TIER_MONTHLY_SCANS,
    paidCredits: 0,
    totalAvailable: TIER_MONTHLY_SCANS,
    hasScans: true,
    loading: true,
    isTestWallet: false,
  });

  useEffect(() => {
    if (!walletAddress) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    // Test wallet gets unlimited scans
    if (TEST_WALLETS_UNLIMITED.has(walletAddress)) {
      setData({
        tierMonthlyScans: 999999,
        tierScansUsed: 0,
        tierScansRemaining: 999999,
        paidCredits: 999999,
        totalAvailable: 999999,
        hasScans: true,
        loading: false,
        isTestWallet: true,
      });
      return;
    }

    const storageKey = getStorageKey(walletAddress);
    const thisMonth = getMonthKey();
    
    // Load stored data
    const stored = localStorage.getItem(storageKey);
    const storedPaidCredits = localStorage.getItem(`agenticbro_credits_${walletAddress.toLowerCase()}`);
    
    let used = 0;
    let month = thisMonth;
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        month = parsed.month || thisMonth;
        used = parsed.used || 0;
        
        // Reset if new month
        if (month !== thisMonth) {
          used = 0;
          month = thisMonth;
        }
      } catch {
        used = 0;
      }
    }
    
    const paidCredits = storedPaidCredits ? parseInt(storedPaidCredits, 10) || 0 : 0;
    const remaining = Math.max(0, TIER_MONTHLY_SCANS - used);
    const total = remaining + paidCredits;
    
    // Save updated data if month changed
    localStorage.setItem(storageKey, JSON.stringify({ month, used }));
    
    setData({
      tierMonthlyScans: TIER_MONTHLY_SCANS,
      tierScansUsed: used,
      tierScansRemaining: remaining,
      paidCredits,
      totalAvailable: total,
      hasScans: total > 0,
      loading: false,
      isTestWallet: false,
    });
  }, [walletAddress]);

  const useCredit = useCallback((): { success: boolean; remaining: number; type: 'tier' | 'paid' } => {
    if (!walletAddress) {
      return { success: false, remaining: 0, type: 'tier' };
    }

    // Test wallet always succeeds
    if (TEST_WALLETS_UNLIMITED.has(walletAddress)) {
      return { success: true, remaining: 999999, type: 'tier' };
    }

    const storageKey = getStorageKey(walletAddress);
    const thisMonth = getMonthKey();
    
    // Try tier scans first
    if (data.tierScansRemaining > 0) {
      const newUsed = data.tierScansUsed + 1;
      localStorage.setItem(storageKey, JSON.stringify({ month: thisMonth, used: newUsed }));
      
      setData(prev => ({
        ...prev,
        tierScansUsed: newUsed,
        tierScansRemaining: prev.tierMonthlyScans - newUsed,
        totalAvailable: (prev.tierMonthlyScans - newUsed) + prev.paidCredits,
        hasScans: (prev.tierMonthlyScans - newUsed) + prev.paidCredits > 0,
      }));
      
      return { success: true, remaining: data.tierMonthlyScans - newUsed, type: 'tier' };
    }

    // Use paid credits
    if (data.paidCredits > 0) {
      const newCredits = data.paidCredits - 1;
      localStorage.setItem(`agenticbro_credits_${walletAddress.toLowerCase()}`, String(newCredits));
      
      setData(prev => ({
        ...prev,
        paidCredits: newCredits,
        totalAvailable: prev.tierScansRemaining + newCredits,
        hasScans: prev.tierScansRemaining + newCredits > 0,
      }));
      
      return { success: true, remaining: newCredits, type: 'paid' };
    }

    return { success: false, remaining: 0, type: 'paid' };
  }, [walletAddress, data]);

  const addCredits = useCallback((amount: number) => {
    if (!walletAddress || TEST_WALLETS_UNLIMITED.has(walletAddress)) return;
    
    const newCredits = data.paidCredits + amount;
    localStorage.setItem(`agenticbro_credits_${walletAddress.toLowerCase()}`, String(newCredits));
    
    setData(prev => ({
      ...prev,
      paidCredits: newCredits,
      totalAvailable: prev.tierScansRemaining + newCredits,
      hasScans: prev.tierScansRemaining + newCredits > 0,
    }));
  }, [walletAddress, data]);

  return {
    ...data,
    useCredit,
    addCredits,
  };
}

export default useTierCredits;