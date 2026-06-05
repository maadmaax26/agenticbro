/**
 * useSubscription Hook
 * 
 * Fetches and manages subscription data from Brand Guard API
 * Provides methods for creating checkout sessions, managing billing, and refreshing data
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Subscription {
  id: string;
  plan_id: 'free' | 'guardian' | 'sentinel' | 'fortress';
  status: 'active' | 'past_due' | 'canceled' | 'expired' | 'unpaid' | 'trialing' | 'trial_ending';
  current_period_start: string;
  current_period_end: string;
  scan_limit: number;
  scans_used: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionData {
  subscription: Subscription | null;
  credits: {
    free_total: number;
    free_used: number;
    free_remaining: number;
    paid_credits: number;
  } | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSubscription() {
  const { user, walletAddress, email } = useAuth();
  const [data, setData] = useState<SubscriptionData>({
    subscription: null,
    credits: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!walletAddress && !email) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userId = user?.id || walletAddress || 'anonymous';
      const userEmail = email || user?.email || '';

      // Fetch subscription data
      const res = await fetch(`/api/brand-guard/subscription?userId=${userId}&email=${encodeURIComponent(userEmail)}`);

      if (!res.ok) {
        if (res.status === 404) {
          // No subscription found - user is on free tier
          setData({
            subscription: null,
            credits: null,
          });
          setLoading(false);
          return;
        }
        throw new Error(`Failed to fetch subscription: ${res.status}`);
      }

      const result = await res.json();

      if (result.success) {
        setData({
          subscription: result.subscription,
          credits: result.credits,
        });
      } else {
        throw new Error(result.error || 'Invalid subscription data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('[useSubscription] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, walletAddress, email]);

  // Initial fetch
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Create Stripe checkout session
  const createCheckoutSession = useCallback(async (planId: string) => {
    if (!walletAddress && !email) {
      throw new Error('Please sign in or connect your wallet first');
    }

    setLoading(true);
    try {
      const userId = user?.id || walletAddress || 'anonymous';
      const userEmail = email || user?.email || '';

      const res = await fetch('/api/brand-guard/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userEmail,
          planId,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to create checkout session');
      }

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, walletAddress, email]);

  // Create Stripe customer portal session
  const createPortalSession = useCallback(async () => {
    if (!user?.id && !walletAddress && !email) {
      throw new Error('Please sign in or connect your wallet first');
    }

    setLoading(true);
    try {
      const userId = user?.id || walletAddress || 'anonymous';
      const userEmail = email || user?.email || '';

      const res = await fetch('/api/brand-guard/stripe-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userEmail,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to create portal session');
      }

      // Redirect to customer portal
      if (result.url) {
        window.location.href = result.url;
      }

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, walletAddress, email]);

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    if (!user?.id && !walletAddress) {
      throw new Error('Please sign in or connect your wallet first');
    }

    setLoading(true);
    try {
      const userId = user?.id || walletAddress || 'anonymous';

      const res = await fetch('/api/brand-guard/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to cancel subscription');
      }

      // Refresh data after cancellation
      await fetchSubscription();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, walletAddress, email, fetchSubscription]);

  // Refresh data
  const refresh = useCallback(() => {
    return fetchSubscription();
  }, [fetchSubscription]);

  return {
    subscription: data.subscription,
    credits: data.credits,
    loading,
    error,
    isTrialing: data.subscription?.status === 'trialing' || data.subscription?.status === 'trial_ending',
    trialEndsAt: data.subscription?.status === 'trialing' || data.subscription?.status === 'trial_ending' 
      ? data.subscription.current_period_end 
      : null,
    createCheckoutSession,
    createPortalSession,
    cancelSubscription,
    refresh,
  };
}
