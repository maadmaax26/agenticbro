/**
 * Stripe Payment Integration
 * 
 * Setup Instructions:
 * 1. Create a Stripe account at https://stripe.com
 * 2. Get your API keys from Dashboard → Developers → API Keys
 * 3. Add to .env.local:
 *    VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
 *    STRIPE_SECRET_KEY=sk_test_... (server-side)
 *    STRIPE_WEBHOOK_SECRET=whsec_... (server-side)
 * 4. For production, use live keys and complete business verification
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

export interface PaymentState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

// ─── Credit Packages ──────────────────────────────────────────────────────────

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
    price: 9,
    bonus: 1,
    description: '10 scans + 1 bonus for $9',
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 25,
    price: 20,
    bonus: 5,
    popular: true,
    description: '25 scans + 5 bonus for $20',
  },
  {
    id: 'whale',
    name: 'Whale',
    credits: 100,
    price: 75,
    bonus: 25,
    description: '100 scans + 25 bonus for $75',
  },
];

// ─── Payment Hook ──────────────────────────────────────────────────────────────

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
      
      // Redirect to Stripe Checkout
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

  // Load Stripe.js dynamically
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

  // Load credits from storage or API
  useEffect(() => {
    const loadCredits = async () => {
      setLoading(true);
      
      // Try localStorage first
      const storageKey = userId || email || walletAddress || 'anonymous';
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
  }, [userId, email, walletAddress]);

  const saveCredits = (newCredits: number) => {
    const storageKey = userId || email || walletAddress || 'anonymous';
    localStorage.setItem(`agenticbro_credits_${storageKey}`, String(newCredits));
    setCredits(newCredits);
  };

  const saveFreeScans = (newFree: number) => {
    const storageKey = userId || email || walletAddress || 'anonymous';
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