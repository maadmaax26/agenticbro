/**
 * Payment Integration
 * 
 * Multiple payment options:
 * - Stripe (USD): $1/scan credit
 * - USDC (Solana): ~$1 worth per scan
 * - USDC (Base): ~$1 worth per scan
 * - AGNTCBRO tokens: $1 equivalent value per scan
 * 
 * Track credits by wallet address or email
 */

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonus?: number;
  popular?: boolean;
  description?: string;
}

export interface TokenPrice {
  symbol: string;
  usdPrice: number;
  lastUpdated: number;
}

export interface PaymentState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const SCAN_PRICE_USD = 1; // $1 per scan

// AGNTCBRO Token Configuration
export const AGNTCBRO_MINT = '52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump';
export const AGNTCBRO_DECIMALS = 6;

// USDC Token Mints
export const USDC_MINT_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_MINT_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// ─── Credit Packages ($1/scan) ────────────────────────────────────────────────

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 5,
    price: 5,
    description: '5 scans for $5',
  },
  {
    id: 'basic',
    name: 'Basic',
    credits: 10,
    price: 10,
    description: '10 scans for $10',
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 25,
    price: 25,
    popular: true,
    description: '25 scans for $25',
  },
  {
    id: 'whale',
    name: 'Whale',
    credits: 100,
    price: 100,
    bonus: 10,
    description: '100 scans + 10 bonus for $100',
  },
];

// ─── Token Price Fetching ──────────────────────────────────────────────────────

export async function fetchTokenPrice(mint: string): Promise<number> {
  try {
    // Use DexScreener API for token prices
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      // Get the best priced pair (highest liquidity)
      const bestPair = data.pairs.sort((a: any, b: any) => 
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];
      
      return parseFloat(bestPair.priceUsd) || 0;
    }
    
    return 0;
  } catch (error) {
    console.error('Error fetching token price:', error);
    return 0;
  }
}

export async function getAGNTCBROPrice(): Promise<number> {
  return fetchTokenPrice(AGNTCBRO_MINT);
}

export function calculateAGNTCBROAmount(usdAmount: number, tokenPrice: number): number {
  if (tokenPrice <= 0) return 0;
  return (usdAmount / tokenPrice) * Math.pow(10, AGNTCBRO_DECIMALS);
}

// ─── Stripe Payment Hook ───────────────────────────────────────────────────────

export function useStripePayment() {
  const [state, setState] = useState<PaymentState>({
    loading: false,
    error: null,
    success: false,
  });

  const createCheckoutSession = useCallback(async (
    packageId: string,
    userId: string,
    email: string
  ) => {
    setState({ loading: true, error: null, success: false });

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, userId, email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
      
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Payment failed',
        success: false,
      });
    }
  }, []);

  const verifyPayment = useCallback(async (sessionId: string) => {
    setState({ loading: true, error: null, success: false });

    try {
      const response = await fetch(`/api/verify-payment?session_id=${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setState({ loading: false, error: null, success: true });
        return data;
      } else {
        throw new Error(data.error || 'Payment verification failed');
      }
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Verification failed',
        success: false,
      });
      return null;
    }
  }, []);

  return {
    ...state,
    createCheckoutSession,
    verifyPayment,
    reset: () => setState({ loading: false, error: null, success: false }),
  };
}

// ─── Stripe Elements Loader ────────────────────────────────────────────────────

declare global {
  interface Window {
    Stripe?: (key: string) => any;
  }
}

export async function loadStripe(): Promise<any | null> {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  
  if (!key) {
    console.warn('Stripe publishable key not configured');
    return null;
  }

  if (!window.Stripe) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Stripe.js'));
      document.head.appendChild(script);
    });
  }

  return window.Stripe ? window.Stripe(key) : null;
}

// ─── Credit Management Hook ───────────────────────────────────────────────────

export function useCredits(userId: string | null, email: string | null, walletAddress: string | null) {
  const [credits, setCredits] = useState(0);
  const [freeScansRemaining, setFreeScansRemaining] = useState(3);
  const [loading, setLoading] = useState(true);

  // Storage key based on wallet or email
  const getStorageKey = useCallback(() => {
    return walletAddress?.toLowerCase() || email?.toLowerCase() || userId || 'anonymous';
  }, [userId, email, walletAddress]);

  // Load credits from storage
  useEffect(() => {
    const loadCredits = async () => {
      setLoading(true);
      
      const storageKey = getStorageKey();
      const stored = localStorage.getItem(`agenticbro_credits_${storageKey}`);
      const storedFree = localStorage.getItem(`agenticbro_free_${storageKey}`);
      
      if (stored) {
        setCredits(parseInt(stored, 10) || 0);
      }
      if (storedFree) {
        setFreeScansRemaining(Math.max(0, parseInt(storedFree, 10)));
      } else {
        // New user gets 3 free scans
        setFreeScansRemaining(3);
        localStorage.setItem(`agenticbro_free_${storageKey}`, '3');
      }
      
      setLoading(false);
    };

    loadCredits();
  }, [getStorageKey]);

  const saveCredits = (newCredits: number) => {
    const storageKey = getStorageKey();
    localStorage.setItem(`agenticbro_credits_${storageKey}`, String(newCredits));
    setCredits(newCredits);
  };

  const saveFreeScans = (newFree: number) => {
    const storageKey = getStorageKey();
    localStorage.setItem(`agenticbro_free_${storageKey}`, String(newFree));
    setFreeScansRemaining(newFree);
  };

  const useCredit = (): { success: boolean; remaining: number; type: 'free' | 'paid' } => {
    // Try free scans first
    if (freeScansRemaining > 0) {
      const newFree = freeScansRemaining - 1;
      saveFreeScans(newFree);
      return { success: true, remaining: newFree, type: 'free' };
    }

    // Use paid credits
    if (credits > 0) {
      const newCredits = credits - 1;
      saveCredits(newCredits);
      return { success: true, remaining: newCredits, type: 'paid' };
    }

    return { success: false, remaining: 0, type: 'paid' };
  };

  const addCredits = (amount: number) => {
    const newCredits = credits + amount;
    saveCredits(newCredits);
  };

  const hasScans = freeScansRemaining > 0 || credits > 0;

  return {
    credits,
    freeScansRemaining,
    totalScans: freeScansRemaining + credits,
    hasScans,
    loading,
    useCredit,
    addCredits,
    saveCredits,
    saveFreeScans,
  };
}

// ─── USDC Payment Utilities ────────────────────────────────────────────────────

export const USDC_PAYMENT_CONFIG = {
  solana: {
    mint: USDC_MINT_SOLANA,
    name: 'Solana USDC',
    network: 'Solana',
    icon: '◎',
  },
  base: {
    mint: USDC_MINT_BASE,
    name: 'Base USDC',
    network: 'Base',
    icon: '🔷',
  },
};

export function generateUSDCPaymentMemo(userId: string, credits: number): string {
  return `agenticbro-${userId}-${credits}`;
}