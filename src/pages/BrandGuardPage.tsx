/**
 * BrandGuardPage.tsx — Full Brand Guard Dashboard
 * 
 * Route: /brand-guard
 * Handles onboarding, dashboard, and credit management for brand impersonation detection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Rocket, X } from 'lucide-react';
import { supabase, signUpWithEmail, signInWithEmail, signOut } from '../lib/supabase';
import { TakedownModal } from '../components/brand-guard/TakedownModal';
import { DeliverySettings } from '../components/brand-guard/DeliverySettings';
import { FingerprintManager } from '../components/brand-guard/FingerprintManager';
import { MarketplaceScanner } from '../components/brand-guard/MarketplaceScanner';
import { SubscriptionPlans } from '../components/brand-guard/SubscriptionPlans';
import { SubscriptionManager } from '../components/brand-guard/SubscriptionManager';
import { ContactUs } from '../components/ContactUs';

// ════════════════════════════════════════════════════════════════════════════════
// Mobile Detection Hook
// ════════════════════════════════════════════════════════════════════════════════
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

// ════════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════════

interface Brand {
  id: string;
  brand_name: string;
  brand_handle: string;
  brand_domain: string | null;
  platforms: string[];
  scan_frequency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreditInfo {
  free_total: number;
  free_used: number;
  free_remaining: number;
  paid_credits: number;
  paid_credits_total_purchased: number;
  total_remaining: number;
  has_credits: boolean;
  first_brand_at: string | null;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_usd: number;
  bonus: number;
  popular?: boolean;
  stripe_price_id?: string;
}

type PaymentMethod = 'stripe' | 'usdc-solana' | 'usdc-base' | 'agntcbro';

const API_BASE = '/api/brand-guard';
const AUTH_SESSION_TIMEOUT_MS = 6000;

async function getBrandGuardSession() {
  if (!supabase) return null;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      supabase.auth.getSession().then(({ data }) => data?.session ?? null).catch(() => null),
      new Promise<null>(resolve => {
        timeoutId = setTimeout(() => resolve(null), AUTH_SESSION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const PLATFORMS = [
  { id: 'x', label: 'X (Twitter)', icon: '𝕏' },
  { id: 'instagram', label: 'Instagram', icon: '📷' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
  { id: 'telegram', label: 'Telegram', icon: '✈️' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
];

const FREQUENCIES = [
  { id: 'daily', label: 'Daily', desc: 'Best for high-risk brands' },
  { id: 'weekly', label: 'Weekly', desc: 'Recommended' },
  { id: 'monthly', label: 'Monthly', desc: 'Low-risk monitoring' },
];

const PILOT_CONCERNS = [
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'fake_store', label: 'Fake store' },
  { id: 'spoofed_email', label: 'Spoofed email' },
  { id: 'fake_ads', label: 'Fake ads' },
  { id: 'lookalike_domain', label: 'Lookalike domain' },
  { id: 'marketplace_clone', label: 'Marketplace clone' },
  { id: 'other', label: 'Other' },
];

// Payment wallets
const PAYMENT_WALLETS = {
  solana: '9SFtm4S5QNDdMuWwgpy8E7ZhqRfgmjNtE1JLqkzPKj9F',
  base: '0x1c793592adf512dfe590817225c3b2b6bd913fac',
  agntcbro_mint: '52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump',
};

// ════════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ════════════════════════════════════════════════════════════════════════════════

export function BrandGuardPage() {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // Auth
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');

  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login form state
  const [loginMode, setLoginMode] = useState<'login' | 'register' | 'reset'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupPromoCode, setSignupPromoCode] = useState('');
  const [promoCode, setPromoCode] = useState('');

  // Brand state
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(true); void brandsLoading;
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [showPurchase, setShowPurchase] = useState(false);

  // Subscription management state
  const [showSubscriptionManager, setShowSubscriptionManager] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  void subscriptionError;
  const checkoutStartedRef = useRef(false);

  // Alert bell state
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);

  // Onboarding form
  const [onboardStep, setOnboardStep] = useState(1);
  const [brandName, setBrandName] = useState('');
  const [brandHandle, setBrandHandle] = useState('');
  const [brandDomain, setBrandDomain] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['x']);
  const [scanFrequency, setScanFrequency] = useState('weekly');
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  // Check for payment success redirect
  const selectedPlan = searchParams.get('plan');
  const checkoutRequested = searchParams.get('checkout') === 'success';
  const checkoutSessionId = searchParams.get('session_id');
  const pilotRequestToken = searchParams.get('pilot_request') || '';
  const requestPilot = searchParams.get('request_pilot') === '1';
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>(
    checkoutRequested ? 'verifying' : 'idle',
  );

  const [showPilotRequestForm, setShowPilotRequestForm] = useState(false);
  const [pilotRequestForm, setPilotRequestForm] = useState({
    email: '',
    company_name: '',
    brand_name: '',
    website: '',
    concern: 'impersonation',
    notes: '',
  });
  const [pilotRequestLoading, setPilotRequestLoading] = useState(false);
  const [pilotRequestMessage, setPilotRequestMessage] = useState<string | null>(null);
  const [pilotRequestSubmitted, setPilotRequestSubmitted] = useState(false);

  // Store realtime subscriptions for cleanup
  const [realtimeSubscriptions, setRealtimeSubscriptions] = useState<any[]>([]);
  
  useEffect(() => {
    if (selectedPlan) setLoginMode(mode => mode === 'login' ? 'register' : mode);
  }, [selectedPlan]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;

    async function checkAuth() {
      try {
        const session = await getBrandGuardSession();
        if (cancelled) return;
        if (session?.access_token) {
          setAuthToken(session.access_token);
          setUserId(session.user.id);
          setUserEmail(session.user.email || '');
        }
      } catch { /* not authenticated */ }
      finally {
        if (!cancelled) setAuthLoading(false);
      }
    }
    checkAuth();

    // Listen for auth state changes (email confirmation, sign in, sign out, password reset)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      setAuthLoading(false);
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked the password reset link — show the update form, don't go to dashboard
        setShowPasswordUpdate(true);
        setAuthToken(session?.access_token || null);
        setUserId(session?.user?.id || null);
        return; // Don't redirect to dashboard
      }
      if (session?.access_token) {
        setAuthToken(session.access_token);
        setUserId(session.user.id);
        setUserEmail(session.user.email || '');
      } else {
        setAuthToken(null);
        setUserId(null);
        setUserEmail('');
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (pilotRequestToken) {
      setLoginMode('register');
      setShowPilotRequestForm(false);
      setLoginError('Pilot invitation loaded. Create an account or sign in with the approved email to activate it.');
    }
  }, [pilotRequestToken]);

  useEffect(() => {
    if (requestPilot && !pilotRequestToken) {
      setLoginMode('register');
      setShowPilotRequestForm(true);
    }
  }, [requestPilot, pilotRequestToken]);

  // ── Realtime subscriptions for Brand Guard alerts and subscriptions ──────────
  useEffect(() => {
    if (!supabase || !authToken) {
      // Cleanup any existing subscriptions
      realtimeSubscriptions.forEach(sub => sub.unsubscribe());
      setRealtimeSubscriptions([]);
      return;
    }

    const newSubscriptions: any[] = [];

    // Subscribe to brand_guard_alerts table (for real-time alert updates)
    const alertsSubscription = supabase
      .channel('brand-guard-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'brand_guard_alerts' }, payload => {
        // New alert inserted - handle real-time update
        console.log('[Realtime] New alert:', payload.new);
        // Trigger alert sound or notification if desired
        if (payload.new.severity === 'critical') {
          // Play alert sound
          try {
            new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3').play();
          } catch { /* audio playback not supported */ }
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] brand_guard_alerts subscription:', status);
      });
    newSubscriptions.push(alertsSubscription);

    // Subscribe to brand_guard_subscriptions table (for subscription status changes)
    const subsSubscription = supabase
      .channel('brand-guard-subscriptions')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'brand_guard_subscriptions' }, payload => {
        // Subscription updated - refresh subscription data
        console.log('[Realtime] Subscription updated:', payload.new);
        if (payload.new.status === 'canceled' || payload.new.status === 'expired') {
          // Subscription ended - notify user
          setShowPurchase(true);
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] brand_guard_subscriptions subscription:', status);
      });
    newSubscriptions.push(subsSubscription);

    setRealtimeSubscriptions(newSubscriptions);

    // Cleanup on unmount or when dependencies change
    return () => {
      newSubscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [authToken, supabase]);

  // ── Handle email login/register ───────────────────────────────────────────────
  const activateSignupPilot = async (accessToken: string, code: string, requestToken = '') => {
    if (!code && !requestToken) return;
    const response = await fetch(`${API_BASE}/pilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ promo_code: code, request_token: requestToken }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not activate the Brand Guard pilot.');
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      if (loginMode === 'register') {
        const normalizedPromo = signupPromoCode.trim().toUpperCase();
        if (normalizedPromo && normalizedPromo !== 'BGPILOT30') {
          throw new Error('Promo code is not valid.');
        }
        const result = await signUpWithEmail(loginEmail, loginPassword, normalizedPromo ? { promo_code: normalizedPromo } : {});
        if (result.error) throw new Error(result.error.message || 'Sign up failed');
        
        if ((result as any).needsConfirmation) {
          // Email confirmation required — auto-confirm via server endpoint
          setLoginError('Confirming your account...');
          try {
            const confirmRes = await fetch(`${API_BASE}/auto-confirm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: loginEmail }),
            });
            const confirmData = await confirmRes.json();
            if (confirmData.success && confirmData.confirmed) {
              // Auto-confirmed — now sign in
              const { user: signInUser, error: signInError } = await signInWithEmail(loginEmail, loginPassword);
              if (signInError) throw new Error(signInError.message || 'Auto sign-in failed');
              if (signInUser) {
                const session = await getBrandGuardSession();
                if (session?.access_token) {
                  await activateSignupPilot(session.access_token, normalizedPromo, pilotRequestToken);
                  setAuthToken(session.access_token);
                  setUserId(session.user.id);
                  setLoginError(null);
                }
              }
            } else {
              setLoginError('Account created! Please sign in with your credentials.');
              setLoginMode('login');
            }
          } catch (confirmErr: any) {
            // Auto-confirm failed — fall back to manual email confirmation
            setLoginError('Account created! Please sign in with your credentials.');
            setLoginMode('login');
          }
        } else {
          // Auto-confirmed — try to get session
          const session = await getBrandGuardSession();
          if (session?.access_token) {
            await activateSignupPilot(session.access_token, normalizedPromo, pilotRequestToken);
            setAuthToken(session.access_token);
            setUserId(session.user.id);
          } else {
            // No session yet — switch to login mode
            setLoginError('Account created! Please sign in with your credentials.');
            setLoginMode('login');
          }
        }
      } else {
        const { user, error } = await signInWithEmail(loginEmail, loginPassword);
        if (error) throw new Error(error.message || 'Login failed');
        if (user) {
          const session = await getBrandGuardSession();
          if (session?.access_token) {
            const storedPromo = String(session.user.user_metadata?.promo_code || '');
            await activateSignupPilot(session.access_token, storedPromo, pilotRequestToken);
            setAuthToken(session.access_token);
            setUserId(session.user.id);
          } else {
            // No session — email might not be confirmed. Try auto-confirm.
            try {
              const confirmRes = await fetch(`${API_BASE}/auto-confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: loginEmail }),
              });
              const confirmData = await confirmRes.json();
              if (confirmData.success && confirmData.confirmed) {
                // Confirmed now — retry login
                const { user: retryUser } = await signInWithEmail(loginEmail, loginPassword);
                if (retryUser) {
                  const session = await getBrandGuardSession();
                  if (session?.access_token) {
                    const storedPromo = String(session.user.user_metadata?.promo_code || '');
                    await activateSignupPilot(session.access_token, storedPromo, pilotRequestToken);
                    setAuthToken(session.access_token);
                    setUserId(session.user.id);
                    setLoginError(null);
                  }
                } else {
                  setLoginError('Please try signing in again.');
                }
              } else {
                setLoginError('Please confirm your email first, then try signing in again.');
              }
            } catch {
              setLoginError('Please confirm your email first, then try signing in again.');
            }
          }
        }
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Resend confirmation email ─────────────────────────────────────────────────
  const handleResendConfirmation = async () => {
    if (!loginEmail) { setLoginError('Enter your email first'); return; }
    setLoginLoading(true);
    setLoginError(null);
    try {
      if (!supabase) throw new Error('Email confirmation is not available right now.');
      const { error } = await supabase!.auth.resend({ type: 'signup', email: loginEmail });
      if (error) throw error;
      setLoginError('Confirmation email sent! Check your inbox and spam folder.');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setLoginLoading(false);
    }
  };

  const handlePilotRequestSubmit = async () => {
    setPilotRequestLoading(true);
    setPilotRequestMessage(null);
    try {
      const payload = {
        ...pilotRequestForm,
        email: authToken && userEmail ? userEmail : pilotRequestForm.email || loginEmail,
      };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE}/pilot-request`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit pilot request.');
      setPilotRequestMessage('Request received. We will review the brand fit and follow up with next steps.');
      setPilotRequestSubmitted(true);
      setPilotRequestForm({
        email: '',
        company_name: '',
        brand_name: '',
        website: '',
        concern: 'impersonation',
        notes: '',
      });
    } catch (err) {
      setPilotRequestMessage(err instanceof Error ? err.message : 'Could not submit pilot request.');
    } finally {
      setPilotRequestLoading(false);
    }
  };

  // ── Password Reset ────────────────────────────────────────────────────────
  const [resetSent, setResetSent] = useState(false);
  void resetSent;

  const handleResetPassword = async () => {
    if (!loginEmail) { setLoginError('Enter your email address'); return; }
    setLoginLoading(true);
    setLoginError(null);
    setResetSent(false);
    try {
      if (!supabase) throw new Error('Password reset is not available right now.');
      const { error } = await supabase!.auth.resetPasswordForEmail(loginEmail, {
        redirectTo: `${window.location.origin}/brand-guard`,
      });
      if (error) throw error;
      setResetSent(true);
      setLoginError('Password reset email sent! Check your inbox (and spam folder). The link expires in 1 hour.');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle password reset callback (when user returns from email link)
  // Supabase puts the recovery token in the URL hash.
  // The onAuthStateChange listener above will fire with PASSWORD_RECOVERY event
  // and set the session. We just need to detect that and show the update form.
  const [showPasswordUpdate, setShowPasswordUpdate] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setShowPasswordUpdate(true);
      // Clear the hash so it doesn't re-trigger on refresh
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const [newPassword, setNewPassword] = useState('');

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) { setLoginError('Password must be at least 6 characters'); return; }
    setLoginLoading(true);
    setLoginError(null);
    try {
      // Ensure we have an active session (the recovery link should have established one)
      const session = await getBrandGuardSession();
      if (!session) {
        // Session not established yet — try to exchange the hash fragment
        // This happens if onAuthStateChange hasn't fired yet
        setLoginError('Session expired. Please request a new password reset link.');
        setLoginLoading(false);
        return;
      }
      const { error } = await supabase!.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setLoginError(null);
      setLoginMode('login');
      setLoginPassword('');
      setShowPasswordUpdate(false);
      // Clear the hash fragment
      window.history.replaceState(null, '', window.location.pathname);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Failed to update password. The reset link may have expired.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Fetch brands ────────────────────────────────────────────────────────────
  const fetchBrands = useCallback(async () => {
    if (!authToken) { setBrandsLoading(false); return; }
    setBrandsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/brands`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success && data.brands?.length > 0) {
        setBrands(data.brands);
        setActiveBrand(data.brands[0]);
      } else if (data.brands?.length === 0) {
        setShowOnboarding(true);
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    } finally {
      setBrandsLoading(false);
    }
  }, [authToken]);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  // ── Fetch credits ────────────────────────────────────────────────────────────
  const fetchCredits = useCallback(async () => {
    if (!authToken) { setCreditsLoading(false); return; }
    setCreditsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/credits`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) setCredits(data.credits);
    } catch { /* ignore */ }
    finally { setCreditsLoading(false); }
  }, [authToken]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  useEffect(() => {
    if (!checkoutRequested || !checkoutSessionId) {
      if (checkoutRequested) setCheckoutStatus('error');
      return;
    }
    if (!authToken) return;

    let cancelled = false;
    const verifyCheckout = async () => {
      setCheckoutStatus('verifying');
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const res = await fetch(`${API_BASE}/credits/verify-checkout?session_id=${encodeURIComponent(checkoutSessionId)}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          const data = await res.json();
          if (!res.ok || !data.verified) throw new Error(data.error || 'Payment could not be verified');
          if (data.fulfilled) {
            if (cancelled) return;
            setCheckoutStatus('success');
            await fetchCredits();
            const conversionKey = `gads_purchase_conversion:${checkoutSessionId}`;
            if (typeof window !== 'undefined' && (window as any).gtag && !sessionStorage.getItem(conversionKey)) {
              (window as any).gtag('event', 'conversion', {
                send_to: 'AW-18179207888/QWLaCJqZi7kcENDlwtxD',
                value: data.amount_usd,
                currency: 'USD',
                transaction_id: checkoutSessionId,
              });
              sessionStorage.setItem(conversionKey, '1');
            }
            return;
          }
        } catch {
          if (attempt === 4 && !cancelled) setCheckoutStatus('error');
          return;
        }
        await new Promise(resolve => window.setTimeout(resolve, 1000));
      }
      if (!cancelled) setCheckoutStatus('error');
    };
    void verifyCheckout();
    return () => { cancelled = true; };
  }, [authToken, checkoutRequested, checkoutSessionId, fetchCredits]);

  // ── Fetch subscription ──────────────────────────────────────────────────────
  const fetchSubscription = useCallback(async () => {
    if (!authToken) { setSubscriptionChecked(false); return; }
    setSubscriptionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/credits/subscription`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) setSubscription(data.subscription);
    } catch (err) {
      setSubscriptionError(err instanceof Error ? err.message : 'Failed to fetch subscription');
    } finally {
      setSubscriptionLoading(false);
      setSubscriptionChecked(true);
    }
  }, [authToken]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const startSubscriptionCheckout = useCallback(async (planId: string) => {
    if (!authToken) throw new Error('Please sign in first');

    const res = await fetch(`${API_BASE}/credits/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ plan_id: planId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create checkout session');

    if (data.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }
    if (data.session_id) {
      const stripe = (window as any).stripe;
      if (!stripe) throw new Error('Stripe checkout is unavailable');
      const { error } = await stripe.redirectToCheckout({ sessionId: data.session_id });
      if (error) throw new Error(error.message);
      return;
    }
    throw new Error('Invalid checkout response');
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !subscriptionChecked || subscriptionLoading || checkoutStartedRef.current) return;
    if (!selectedPlan || !['guardian', 'sentinel', 'fortress'].includes(selectedPlan)) return;
    if (subscription?.plan_id === selectedPlan) return;

    checkoutStartedRef.current = true;
    startSubscriptionCheckout(selectedPlan).catch((err) => {
      checkoutStartedRef.current = false;
      setSubscriptionError(err instanceof Error ? err.message : 'Failed to create checkout session');
      setShowPlansModal(true);
    });
  }, [authToken, selectedPlan, startSubscriptionCheckout, subscription, subscriptionChecked, subscriptionLoading]);

  // ── Subscription management handlers ────────────────────────────────────────
  const handleManageBilling = useCallback(async () => {
    if (!authToken) { setSubscriptionError('Please sign in first'); return; }
    try {
      const res = await fetch(`${API_BASE}/credits/stripe-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        const stripe = (window as any).stripe;
        if (stripe) {
          const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
          if (error) throw new Error(error.message);
        }
      } else {
        throw new Error('Failed to create portal session');
      }
    } catch (err) {
      setSubscriptionError(err instanceof Error ? err.message : 'Failed to open billing portal');
    }
  }, [authToken]);

  const handleCancelSubscription = useCallback(async () => {
    if (!authToken) { setSubscriptionError('Please sign in first'); return; }
    setSubscriptionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/credits/cancel-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setSubscription(null);
        setSubscriptionError(null);
        alert('Subscription cancelled successfully');
      } else {
        throw new Error(data.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      setSubscriptionError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setSubscriptionLoading(false);
    }
  }, [authToken]);

  // ── Alert bell handlers ──────────────────────────────────────────────────────
  // (alerts, showAlertsDropdown, unreadAlerts already declared above)
  const fetchAlerts = useCallback(async () => {
    if (!authToken) { return; }
    try {
      const res = await fetch(`${API_BASE}/alerts?limit=50`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
        setUnreadAlerts(data.alerts.filter((a: any) => !a.read).length);
      }
    } catch {
      // Ignore errors for alerts
    }
  }, [authToken]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const markAlertRead = useCallback(async (alertId: string) => {
    if (!authToken || !alertId) { return; }
    try {
      const res = await fetch(`${API_BASE}/alerts/${alertId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
        setUnreadAlerts(prev => Math.max(0, prev - 1));
      }
    } catch {
      // Ignore errors
    }
  }, [authToken]);

  // ── Create brand ─────────────────────────────────────────────────────────────
  const handleCreateBrand = async () => {
    if (!authToken) { setOnboardError('Please sign in first'); return; }
    setOnboardLoading(true);
    setOnboardError(null);
    try {
      const res = await fetch(`${API_BASE}/brands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          brand_name: brandName,
          brand_handle: brandHandle,
          brand_domain: brandDomain || null,
          platforms: selectedPlatforms,
          scan_frequency: scanFrequency,
          promo_code: promoCode.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchBrands();
        await fetchCredits();
        setShowOnboarding(false);
        setOnboardStep(1);
        setBrandName(''); setBrandHandle(''); setBrandDomain('');
        setSelectedPlatforms(['x']); setScanFrequency('weekly');
      } else {
        setOnboardError(data.error || 'Failed to create brand');
      }
    } catch (err) {
      setOnboardError(err instanceof Error ? err.message : 'Network error');
    } finally { setOnboardLoading(false); }
  };

  // ── Monitoring Dashboard ──────────────────────────────────────────────────
  const [dashboardTab, setDashboardTab] = useState<'scans' | 'monitoring' | 'takedowns' | 'delivery'>('scans');
  const [monitoringData, setMonitoringData] = useState<Record<string, unknown> | null>(null);
  const [takedownStandalone, setTakedownStandalone] = useState(false);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);

  const fetchMonitoring = useCallback(async (silent = false) => {
    if (!authToken || !activeBrand) return;
    if (!silent) setMonitoringLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dashboard?brand_id=${activeBrand.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success && data.dashboard) {
        setMonitoringData(data.dashboard);
      }
    } catch {
      // Non-blocking: monitoring data failure shouldn't break the dashboard
    } finally {
      if (!silent) setMonitoringLoading(false);
    }
  }, [authToken, activeBrand]);

  const refreshHealthScore = async () => {
    if (!authToken || !activeBrand) return;
    setRefreshingHealth(true);
    try {
      const ok = await deductCredit('health_refresh');
      if (!ok) { setRefreshingHealth(false); return; }
      // Run all scan types in parallel for the brand
      await Promise.allSettled([
        fetch(`${API_BASE}/impersonator-scan`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ brand_id: activeBrand.id, brand_name: activeBrand.brand_name, brand_handle: activeBrand.brand_handle, brand_domain: activeBrand.brand_domain || '', platforms: activeBrand.platforms }),
        }),
        fetch(`${API_BASE}/domain-monitor`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ domain: activeBrand.brand_domain || activeBrand.brand_handle, limit: 30, brand_name: activeBrand.brand_name }),
        }),
      ]);
      // Refund the extra credits — the health refresh only costs 1, not per-scan
      try {
        await fetch(`${API_BASE}/credits/add`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ amount: 1, payment_method: 'refund', description: 'Refund: health refresh batch scan' }),
        });
      } catch {}
      // Refetch monitoring data with fresh scan results
      await fetchMonitoring();
      await fetchCredits();
    } catch {
      // Best effort
    } finally {
      setRefreshingHealth(false);
    }
  };

  useEffect(() => {
    if (authToken && activeBrand && dashboardTab === 'monitoring') {
      fetchMonitoring();
      const interval = window.setInterval(() => void fetchMonitoring(true), 30_000);
      return () => window.clearInterval(interval);
    }
  }, [authToken, activeBrand, dashboardTab, fetchMonitoring]);

  // ── Run scans ────────────────────────────────────────────────────────────────
  const [scanning, setScanning] = useState<string | null>(null); // scan type being run
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanType, setScanType] = useState<string>('impersonator');
  const [showTakedown, setShowTakedown] = useState(false);

  const deductCredit = async (scanTypeStr: string) => {
    if (!authToken || !activeBrand) return false;
    if (credits && !credits.has_credits) { setShowPurchase(true); return false; }
    const deductRes = await fetch(`${API_BASE}/credits/deduct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ brand_monitor_id: activeBrand.id, scan_type: scanTypeStr }),
    });
    const deductData = await deductRes.json();
    if (!deductData.success && deductRes.status === 402) {
      setShowPurchase(true);
      return false;
    }
    return true;
  };

  const handleRunScan = async (type: string = 'impersonator') => {
    if (!authToken || !activeBrand) return;
    setScanning(type);
    setScanType(type);
    setScanResult(null);
    try {
      const ok = await deductCredit(type);
      if (!ok) { setScanning(null); return; }

      let endpoint = '';
      let body: Record<string, unknown> = {};

      if (type === 'impersonator') {
        endpoint = `${API_BASE}/impersonator-scan`;
        body = {
          brand_id: activeBrand.id,
          brand_name: activeBrand.brand_name,
          brand_handle: activeBrand.brand_handle,
          brand_domain: activeBrand.brand_domain || '',
          platforms: activeBrand.platforms,
        };
      } else if (type === 'domain') {
        endpoint = `${API_BASE}/domain-monitor`;
        body = {
          domain: activeBrand.brand_domain || activeBrand.brand_handle,
          limit: 50,
          monitoring: 'once',
          brand_name: activeBrand.brand_name,
        };
      } else if (type === 'threat') {
        endpoint = `${API_BASE}/threat-correlate`;
        body = {
          brand_name: activeBrand.brand_name,
          brand_handle: activeBrand.brand_handle,
          brand_domain: activeBrand.brand_domain || '',
        };
      } else if (type === 'email') {
        endpoint = `${API_BASE}/email-spoof`;
        body = {
          domain: activeBrand.brand_domain || activeBrand.brand_handle,
          brand_name: activeBrand.brand_name,
          brand_monitor_id: activeBrand.id,
        };
      } else if (type === 'vendor') {
        endpoint = `${API_BASE}/vendor-verify`;
        body = {
          phone: '', // will prompt
          country: 'US',
          vendor_name: activeBrand.brand_name,
        };
      } else if (type === 'website') {
        // Website scan needs URL input — redirect to input
        setShowWebsiteInput(true);
        setScanning(null);
        return;
      }

      if (!endpoint) { setScanning(null); return; }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      // Domain monitor & vendor verify wrap results under .result; flatten for display
      const result = data.success && data.result ? data.result : data;

      // If scan failed on the server side, refund the deducted credit
      if (data.error || res.status >= 400) {
        try {
          await fetch(`${API_BASE}/credits/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ amount: 1, payment_method: 'refund', description: `Refund: ${type} scan failed` }),
          });
        } catch { /* best-effort refund */ }
      }

      setScanResult(result);
      await fetchCredits();

      // ── Poll for real results if scan is pending ──────────────────────────────
      if (data.real_scan_pending && data.scan_id) {
        const pollScanId = data.scan_id;
        const pollInterval = (data.poll_interval || 10) * 1000;
        const maxPolls = 30; // 5 minutes max (30 * 10s)
        let pollCount = 0;

        const pollForResults = async () => {
          try {
            const pollRes = await fetch(`${API_BASE}/impersonator-scan?scan_id=${pollScanId}`, {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            const pollData = await pollRes.json();

            if (pollData.status === 'complete' && pollData.result?.real_scan) {
              // Real scan results are in — update display
              const realResult = pollData.result;
              setScanResult(realResult);
              setScanning(null);
              return true; // Done polling
            } else if (pollData.status === 'failed') {
              // Scan failed
              setScanResult({ ...result, error: pollData.result?.error || 'Real platform scan failed', real_scan_pending: false });
              setScanning(null);
              return true;
            }
            return false; // Still pending
          } catch {
            return false; // Network error, keep polling
          }
        };

        // Initial short poll after 5 seconds
        await new Promise(r => setTimeout(r, 5000));
        let done = await pollForResults();

        while (!done && pollCount < maxPolls) {
          await new Promise(r => setTimeout(r, pollInterval));
          pollCount++;
          done = await pollForResults();
        }

        // If polling timed out, keep the preview results but mark as not-pending
        if (!done) {
          setScanResult((prev: any) => prev ? { ...prev, real_scan_pending: false, poll_timeout: true } : prev);
        }
      }
    } catch (err) {
      // Network error — refund the deducted credit
      try {
        await fetch(`${API_BASE}/credits/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ amount: 1, payment_method: 'refund', description: `Refund: ${type} scan network error` }),
        });
      } catch { /* best-effort refund */ }
      setScanResult({ error: err instanceof Error ? err.message : 'Scan failed' });
    } finally { setScanning(null); }
  };

  // Vendor verify needs a phone number input
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorCountry, setVendorCountry] = useState('US');
  const [showVendorInput, setShowVendorInput] = useState(false);

  // Website scan needs a URL input
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [showWebsiteInput, setShowWebsiteInput] = useState(false);
  const [showMarketplacePanel, setShowMarketplacePanel] = useState(false);
  const [showFingerprintPanel, setShowFingerprintPanel] = useState(false);

  const handleVendorScan = async () => {
    if (!vendorPhone) return;
    if (!authToken || !activeBrand) return;
    setScanning('vendor');
    setScanType('vendor');
    setScanResult(null);
    setShowVendorInput(false);
    try {
      const ok = await deductCredit('vendor');
      if (!ok) { setScanning(null); return; }
      const res = await fetch(`${API_BASE}/vendor-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ phone: vendorPhone.startsWith('+') ? vendorPhone : `+${vendorPhone}`, country: vendorCountry, vendor_name: activeBrand.brand_name, brand_monitor_id: activeBrand.id }),
      });
      const data = await res.json();
      const result = data.success && data.result ? data.result : data;

      // Refund credit if scan failed on server
      if (data.error || res.status >= 400) {
        try {
          await fetch(`${API_BASE}/credits/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ amount: 1, payment_method: 'refund', description: 'Refund: vendor scan failed' }),
          });
        } catch { /* best-effort refund */ }
      }

      setScanResult(result);
      await fetchCredits();
    } catch (err) {
      // Network error — refund the deducted credit
      try {
        await fetch(`${API_BASE}/credits/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ amount: 1, payment_method: 'refund', description: 'Refund: vendor scan network error' }),
        });
      } catch { /* best-effort refund */ }
      setScanResult({ error: err instanceof Error ? err.message : 'Scan failed' });
    } finally { setScanning(null); }
  };

  const handleWebsiteScan = async () => {
    if (!websiteUrl) return;
    if (!authToken || !activeBrand) return;
    setScanning('website');
    setScanType('website');
    setScanResult(null);
    setShowWebsiteInput(false);
    try {
      const ok = await deductCredit('website');
      if (!ok) { setScanning(null); return; }
      const res = await fetch('/api/website-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ url: websiteUrl, brand_monitor_id: activeBrand?.id }),
      });
      const data = await res.json();
      const result = data.success && data.result ? data.result : data;

      // Refund credit if scan failed on server
      if (data.error || res.status >= 400) {
        try {
          await fetch(`${API_BASE}/credits/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ amount: 1, payment_method: 'refund', description: 'Refund: website scan failed' }),
          });
        } catch { /* best-effort refund */ }
      }

      setScanResult(result);
      await fetchCredits();
    } catch (err) {
      // Network error — refund the deducted credit
      try {
        await fetch(`${API_BASE}/credits/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ amount: 1, payment_method: 'refund', description: 'Refund: website scan network error' }),
        });
      } catch { /* best-effort refund */ }
      setScanResult({ error: err instanceof Error ? err.message : 'Scan failed' });
    } finally { setScanning(null); }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════════

  // Dark theme matching agenticbro.app
  const dark = {
    bg: '#0a0a0f',
    cardBg: 'rgba(15,15,25,0.8)',
    border: 'rgba(139,92,246,0.2)',
    accent: '#8b5cf6',
    accentLight: 'rgba(139,92,246,0.15)',
    green: '#22c55e',
    red: '#ef4444',
    yellow: '#eab308',
    text: '#e2e8f0',
    textMuted: '#94a3b8',
  };

  // ── Not authenticated ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: dark.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
          <div style={{ color: dark.textMuted }}>Loading Brand Guard...</div>
        </div>
      </div>
    );
  }

  if (!authToken || showPasswordUpdate) {
    // Password update form (shown when user clicks reset link from email)
    if (showPasswordUpdate) {
      return (
        <div style={{ minHeight: '100vh', background: dark.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '420px', width: '100%', padding: isMobile ? '16px' : '32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔑</div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>Update Password</h1>
              <p style={{ color: dark.textMuted, fontSize: '15px' }}>Choose a new password for your Brand Guard account.</p>
            </div>

            <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '16px', padding: isMobile ? '20px' : '28px', backdropFilter: 'blur(12px)' }}>
              <div style={{ display: 'grid', gap: '14px' }}>
                <div>
                  <label style={{ color: dark.text, fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '10px',
                      background: 'rgba(0,0,0,0.4)', border: `1px solid ${dark.border}`, color: '#fff',
                      fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleUpdatePassword()}
                  />
                </div>
              </div>

              {loginError && (
                <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: loginError.includes('reset') || loginError.includes('sent') ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${loginError.includes('reset') || loginError.includes('sent') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: loginError.includes('reset') || loginError.includes('sent') ? dark.green : dark.red, fontSize: '13px' }}>
                  {loginError}
                </div>
              )}

              <button
                onClick={handleUpdatePassword}
                disabled={loginLoading || !newPassword || newPassword.length < 6}
                style={{
                  width: '100%', marginTop: '16px', padding: '14px', borderRadius: '12px', border: 'none',
                  background: loginLoading || !newPassword || newPassword.length < 6 ? 'rgba(139,92,246,0.3)' : `linear-gradient(135deg, ${dark.accent}, #6d28d9)`,
                  color: '#fff', fontSize: '16px', fontWeight: 700,
                  cursor: loginLoading || !newPassword || newPassword.length < 6 ? 'not-allowed' : 'pointer',
                }}
              >
                {loginLoading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ minHeight: '100vh', background: dark.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '420px', width: '100%', padding: isMobile ? '16px' : '32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔐</div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>Brand Guard</h1>
            <p style={{ color: dark.textMuted, fontSize: '15px' }}>
              AI-powered brand impersonation detection across X, Instagram, TikTok, Facebook, Telegram & LinkedIn
            </p>
          </div>

          <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '16px', padding: isMobile ? '20px' : '28px', backdropFilter: 'blur(12px)' }}>
            {/* Tab switcher (hidden in reset/update-password mode) */}
            {(loginMode === 'login' || loginMode === 'register') && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
              <button
                onClick={() => { setLoginMode('login'); setLoginError(null); }}
                style={{
                  padding: '10px', borderRadius: '8px', border: 'none',
                  background: loginMode === 'login' ? dark.accent : 'rgba(0,0,0,0.3)',
                  color: loginMode === 'login' ? '#fff' : dark.textMuted,
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => { setLoginMode('register'); setLoginError(null); }}
                style={{
                  padding: '10px', borderRadius: '8px', border: 'none',
                  background: loginMode === 'register' ? dark.accent : 'rgba(0,0,0,0.3)',
                  color: loginMode === 'register' ? '#fff' : dark.textMuted,
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Create Account
              </button>
            </div>
            )}

            {/* Reset password heading */}
            {loginMode === 'reset' && (
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>🔑 Reset Password</h2>
                <p style={{ color: dark.textMuted, fontSize: '13px' }}>Enter your email and we\'ll send you a link to reset your password.</p>
              </div>
            )}

            {(loginMode === 'login' || loginMode === 'register') && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center', marginBottom: '20px' }}>
              <span style={{ color: dark.green, fontWeight: 600, fontSize: '14px' }}>
                {pilotRequestToken
                  ? 'Approved pilot invitation ready'
                  : loginMode === 'register' && signupPromoCode.trim().toUpperCase() === 'BGPILOT30'
                  ? '30-day Fortress pilot included'
                  : '25 free scans included with sign-up'}
              </span>
            </div>
            )}

            {(loginMode === 'login' || loginMode === 'register') && !pilotRequestToken && (
              <div style={{ marginBottom: '20px' }}>
                <button
                  onClick={() => {
                    setShowPilotRequestForm(v => !v);
                    setPilotRequestMessage(null);
                    setPilotRequestForm(f => ({ ...f, email: f.email || loginEmail }));
                  }}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '10px',
                    border: '1px solid rgba(59,130,246,0.35)', background: 'rgba(59,130,246,0.1)',
                    color: '#bfdbfe', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Request 30-Day Pilot
                </button>
                {showPilotRequestForm && (
                  <div style={{ marginTop: '12px', padding: '14px', borderRadius: '12px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.25)', display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
                      <input
                        type="email"
                        value={pilotRequestForm.email || loginEmail}
                        onChange={e => setPilotRequestForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="Work email"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.35)', color: '#fff', boxSizing: 'border-box' }}
                      />
                      <input
                        type="text"
                        value={pilotRequestForm.company_name}
                        onChange={e => setPilotRequestForm(f => ({ ...f, company_name: e.target.value }))}
                        placeholder="Company"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.35)', color: '#fff', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
                      <input
                        type="text"
                        value={pilotRequestForm.brand_name}
                        onChange={e => setPilotRequestForm(f => ({ ...f, brand_name: e.target.value }))}
                        placeholder="Brand name"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.35)', color: '#fff', boxSizing: 'border-box' }}
                      />
                      <input
                        type="text"
                        value={pilotRequestForm.website}
                        onChange={e => setPilotRequestForm(f => ({ ...f, website: e.target.value }))}
                        placeholder="Website"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.35)', color: '#fff', boxSizing: 'border-box' }}
                      />
                    </div>
                    <select
                      value={pilotRequestForm.concern}
                      onChange={e => setPilotRequestForm(f => ({ ...f, concern: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.35)', color: '#fff', boxSizing: 'border-box' }}
                    >
                      {PILOT_CONCERNS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    <textarea
                      value={pilotRequestForm.notes}
                      onChange={e => setPilotRequestForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Optional note"
                      rows={3}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.35)', color: '#fff', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                    {pilotRequestMessage && (
                      <div style={{ color: pilotRequestMessage.includes('received') ? dark.green : dark.red, fontSize: '12px', lineHeight: 1.4 }}>
                        {pilotRequestMessage}
                      </div>
                    )}
                    <button
                      onClick={handlePilotRequestSubmit}
                      disabled={pilotRequestLoading}
                      style={{
                        width: '100%', padding: '11px 14px', borderRadius: '10px', border: 'none',
                        background: pilotRequestLoading ? 'rgba(139,92,246,0.3)' : `linear-gradient(135deg, ${dark.accent}, #6d28d9)`,
                        color: '#fff', fontSize: '14px', fontWeight: 700, cursor: pilotRequestLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {pilotRequestLoading ? 'Submitting...' : 'Submit Pilot Request'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {(loginMode === 'login' || loginMode === 'register') && (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ color: dark.text, fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.4)', border: `1px solid ${dark.border}`, color: '#fff',
                    fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <div>
                <label style={{ color: dark.text, fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.4)', border: `1px solid ${dark.border}`, color: '#fff',
                    fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
              {loginMode === 'register' && (
                <div>
                  <label htmlFor="brand-guard-promo" style={{ color: dark.text, fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    Promo code <span style={{ color: dark.textMuted, fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    id="brand-guard-promo"
                    type="text"
                    value={signupPromoCode}
                    onChange={e => setSignupPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter promo code"
                    autoComplete="off"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '10px', textTransform: 'uppercase',
                      background: signupPromoCode.trim().toUpperCase() === 'BGPILOT30' ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.4)',
                      border: `1px solid ${signupPromoCode.trim().toUpperCase() === 'BGPILOT30' ? 'rgba(34,197,94,0.5)' : dark.border}`,
                      color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                  {signupPromoCode.trim().toUpperCase() === 'BGPILOT30' && (
                    <div style={{ marginTop: '7px', color: dark.green, fontSize: '12px', lineHeight: 1.4 }}>
                      30-day Fortress pilot: full monitoring access starts when this account is created.
                    </div>
                  )}
                </div>
              )}
              {loginMode === 'login' && (
                <div style={{ textAlign: 'right', marginTop: '4px' }}>
                  <button
                    onClick={() => { setLoginMode('reset'); setLoginError(null); setResetSent(false); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark.accent, fontSize: '13px', textDecoration: 'underline' }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Reset Password form */}
            {loginMode === 'reset' && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'grid', gap: '14px' }}>
                  <div>
                    <label style={{ color: dark.text, fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Email address</label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="you@company.com"
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: '10px',
                        background: 'rgba(0,0,0,0.4)', border: `1px solid ${dark.border}`, color: '#fff',
                        fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                    />
                  </div>
                </div>
                <p style={{ color: dark.textMuted, fontSize: '13px', marginTop: '8px' }}>
                  We\'ll send a password reset link to your email. The link expires in 1 hour.
                </p>
                <button
                  onClick={handleResetPassword}
                  disabled={loginLoading || !loginEmail}
                  style={{
                    width: '100%', marginTop: '12px', padding: '14px', borderRadius: '12px', border: 'none',
                    background: loginLoading || !loginEmail ? 'rgba(139,92,246,0.3)' : `linear-gradient(135deg, ${dark.accent}, #6d28d9)`,
                    color: '#fff', fontSize: '16px', fontWeight: 700,
                    cursor: loginLoading || !loginEmail ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loginLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  onClick={() => { setLoginMode('login'); setLoginError(null); }}
                  style={{ width: '100%', marginTop: '8px', padding: '10px', borderRadius: '10px', border: `1px solid ${dark.border}`, background: 'transparent', color: dark.textMuted, fontSize: '13px', cursor: 'pointer' }}
                >
                  ← Back to Sign In
                </button>
              </div>
            )}


            {loginError && (
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: loginError.includes('sent') || loginError.includes('Account created') || loginError.includes('reset') ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${loginError.includes('sent') || loginError.includes('Account created') || loginError.includes('reset') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: loginError.includes('sent') || loginError.includes('Account created') || loginError.includes('reset') ? dark.green : dark.red, fontSize: '13px' }}>
                {loginError}
                {(loginError.includes('confirm') || loginError.includes('Confirmation')) && (
                  <button onClick={handleResendConfirmation} style={{ marginLeft: '8px', color: dark.accent, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}>
                    Resend email
                  </button>
                )}
              </div>
            )}

            {(loginMode === 'login' || loginMode === 'register') && (
            <button
              onClick={handleLogin}
              disabled={loginLoading || !loginEmail || !loginPassword}
              style={{
                width: '100%', marginTop: '20px', padding: '14px', borderRadius: '12px', border: 'none',
                background: loginLoading || !loginEmail || !loginPassword ? 'rgba(139,92,246,0.3)' : `linear-gradient(135deg, ${dark.accent}, #6d28d9)`,
                color: '#fff', fontSize: '16px', fontWeight: 700,
                cursor: loginLoading || !loginEmail || !loginPassword ? 'not-allowed' : 'pointer',
              }}
            >
              {loginLoading ? 'Please wait...' : loginMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={() => navigate('/brand-guard')} style={{ color: dark.accent, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>
              View Plans & Pricing
            </button>
            <button onClick={() => navigate('/')} style={{ color: dark.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
              ← Back to Agentic Bro
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Onboarding ───────────────────────────────────────────────────────────────
  if (showOnboarding || brands.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: dark.bg, overflowX: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? '10px 12px' : '12px 24px', borderBottom: `1px solid ${dark.border}`,
          background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(12px)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button onClick={() => { setShowOnboarding(false); navigate('/'); }} style={{ color: dark.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
            ← Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🔐</span>
            <span style={{ fontWeight: 700, color: '#fff' }}>Brand Guard Setup</span>
          </div>
          <div style={{ width: '60px' }} />
        </div>

        <div style={{ maxWidth: '640px', margin: '0 auto', padding: isMobile ? '20px 12px' : '40px 24px' }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                flex: 1, height: '4px', borderRadius: '2px',
                background: s <= onboardStep ? dark.accent : 'rgba(139,92,246,0.2)',
                transition: 'background 0.3s ease',
              }} />
            ))}
          </div>

          {/* Step 1: Brand Info */}
          {onboardStep === 1 && (
            <div>
              <h2 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                What brand are you protecting?
              </h2>
              <p style={{ color: dark.textMuted, marginBottom: '32px' }}>
                Enter your brand name and handle. We'll monitor for impersonators across your selected platforms.
              </p>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ color: dark.text, fontSize: '14px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    Brand Name *
                  </label>
                  <input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="e.g. Agentic Bro"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '10px',
                      background: 'rgba(0,0,0,0.4)', border: `1px solid ${dark.border}`, color: '#fff',
                      fontSize: '15px', outline: 'none',
                    }} />
                </div>
                <div>
                  <label style={{ color: dark.text, fontSize: '14px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    Brand Handle / Username *
                  </label>
                  <input value={brandHandle} onChange={e => setBrandHandle(e.target.value)} placeholder="e.g. @AgenticBro11"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '10px',
                      background: 'rgba(0,0,0,0.4)', border: `1px solid ${dark.border}`, color: '#fff',
                      fontSize: '15px', outline: 'none',
                    }} />
                </div>
                <div>
                  <label style={{ color: dark.text, fontSize: '14px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    Website Domain (optional)
                  </label>
                  <input value={brandDomain} onChange={e => setBrandDomain(e.target.value)} placeholder="e.g. agenticbro.app"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '10px',
                      background: 'rgba(0,0,0,0.4)', border: `1px solid ${dark.border}`, color: '#fff',
                      fontSize: '15px', outline: 'none',
                    }} />
                </div>
              </div>
              <button
                onClick={() => { if (brandName && brandHandle) setOnboardStep(2); }}
                disabled={!brandName || !brandHandle}
                style={{
                  width: '100%', marginTop: '24px', padding: '14px', borderRadius: '12px',
                  border: 'none', background: brandName && brandHandle ? `linear-gradient(135deg, ${dark.accent}, #6d28d9)` : 'rgba(139,92,246,0.3)',
                  color: brandName && brandHandle ? '#fff' : dark.textMuted,
                  fontSize: '16px', fontWeight: 700, cursor: brandName && brandHandle ? 'pointer' : 'not-allowed',
                }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* Step 2: Platforms */}
          {onboardStep === 2 && (
            <div>
              <h2 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                Which platforms should we monitor?
              </h2>
              <p style={{ color: dark.textMuted, marginBottom: '32px' }}>
                Select all platforms where your brand has a presence. We'll scan for impersonators on each.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
                {PLATFORMS.map(p => {
                  const selected = selectedPlatforms.includes(p.id);
                  return (
                    <div key={p.id} onClick={() => {
                      setSelectedPlatforms(prev =>
                        prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                      );
                    }} style={{
                      padding: '16px', borderRadius: '12px', cursor: 'pointer',
                      background: selected ? dark.accentLight : 'rgba(0,0,0,0.3)',
                      border: `2px solid ${selected ? dark.accent : 'rgba(139,92,246,0.15)'}`,
                      transition: 'all 0.2s ease',
                    }}>
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>{p.icon}</div>
                      <div style={{ fontWeight: 600, color: selected ? '#fff' : dark.textMuted }}>{p.label}</div>
                      {selected && <div style={{ color: dark.green, fontSize: '12px', marginTop: '2px' }}>✓ Monitoring</div>}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => { if (selectedPlatforms.length > 0) setOnboardStep(3); }}
                disabled={selectedPlatforms.length === 0}
                style={{
                  width: '100%', marginTop: '24px', padding: '14px', borderRadius: '12px',
                  border: 'none', background: selectedPlatforms.length > 0 ? `linear-gradient(135deg, ${dark.accent}, #6d28d9)` : 'rgba(139,92,246,0.3)',
                  color: selectedPlatforms.length > 0 ? '#fff' : dark.textMuted,
                  fontSize: '16px', fontWeight: 700, cursor: selectedPlatforms.length > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {onboardStep === 3 && (
            <div>
              <h2 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                Review & Confirm
              </h2>
              <p style={{ color: dark.textMuted, marginBottom: '32px' }}>
                Confirm your brand monitoring setup. {promoCode.trim().toLowerCase() === 'beta2026' ? 'As a beta tester, you\'ll get 500 free scans!' : 'You\'ll get 25 free scans to start.'}
              </p>
              <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: dark.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Brand Name</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{brandName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: dark.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Handle</div>
                    <div style={{ fontSize: '16px', color: dark.accent }}>@{brandHandle.replace('@', '')}</div>
                  </div>
                  {brandDomain && (
                    <div>
                      <div style={{ fontSize: '12px', color: dark.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Website</div>
                      <div style={{ fontSize: '16px', color: dark.text }}>{brandDomain}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '12px', color: dark.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platforms</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {selectedPlatforms.map(pid => {
                        const p = PLATFORMS.find(x => x.id === pid);
                        return p ? (
                          <span key={pid} style={{
                            padding: '4px 10px', borderRadius: '6px', fontSize: '13px',
                            background: dark.accentLight, color: '#fff', border: `1px solid ${dark.border}`,
                          }}>{p.icon} {p.label}</span>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: dark.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scan Frequency</div>
                    <div style={{ fontSize: '16px', color: dark.text }}>{FREQUENCIES.find(f => f.id === scanFrequency)?.label}</div>
                  </div>
                </div>
              </div>
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '12px', padding: isMobile ? '10px' : '16px', textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>🎁</div>
                <div style={{ color: dark.green, fontWeight: 700 }}>{promoCode.trim().toLowerCase() === 'beta2026' ? '500 free scans (Beta Tester)' : '25 free scans included'}</div>
                <div style={{ color: dark.textMuted, fontSize: '13px' }}>$1 per scan after that</div>
              </div>
              {/* Promo code input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: dark.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>
                  Promo Code (optional)
                </label>
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Enter promo code"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '10px',
                    border: `1px solid ${promoCode.trim().toLowerCase() === 'beta2026' ? dark.green : dark.border}`,
                    background: promoCode.trim().toLowerCase() === 'beta2026' ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.3)',
                    color: '#fff', fontSize: '14px', outline: 'none',
                  }}
                />
                {promoCode.trim().toLowerCase() === 'beta2026' && (
                  <div style={{ fontSize: '13px', color: dark.green, marginTop: '6px', fontWeight: 600 }}>
                    ✅ Beta tester unlocked — 500 free scans!
                  </div>
                )}
              </div>
              {onboardError && (
                <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: dark.red, fontSize: '14px', marginBottom: '16px' }}>
                  {onboardError}
                </div>
              )}
              <button
                onClick={handleCreateBrand}
                disabled={onboardLoading}
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                  background: `linear-gradient(135deg, ${dark.green}, #16a34a)`, color: '#fff',
                  fontSize: '16px', fontWeight: 700, cursor: onboardLoading ? 'wait' : 'pointer',
                }}
              >
                {onboardLoading ? 'Creating Brand...' : '🚀 Start Protecting My Brand'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  const totalRemaining = credits?.total_remaining ?? 25;
  const freeRemaining = credits?.free_remaining ?? 25;
  const paidCredits = credits?.paid_credits ?? 0;
  const isFreeAccount = subscriptionChecked && (!subscription || subscription.plan_id === 'free');

  const openPilotRequest = () => {
    setPilotRequestMessage(null);
    setPilotRequestSubmitted(false);
    setPilotRequestForm(form => ({
      ...form,
      email: form.email || userEmail,
      company_name: form.company_name || activeBrand?.brand_name || '',
      brand_name: form.brand_name || activeBrand?.brand_name || '',
      website: form.website || activeBrand?.brand_domain || '',
    }));
    setShowPilotRequestForm(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: dark.bg, overflowX: 'hidden' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Header */}
      <div style={{
        padding: isMobile ? '10px 12px' : '12px 24px', borderBottom: `1px solid ${dark.border}`,
        background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '8px',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isMobile && (
            <button onClick={() => navigate('/')} style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', cursor: 'pointer', color: '#fff', fontSize: '14px', padding: '6px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              ←
            </button>
          )}
          {!isMobile && <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark.textMuted, fontSize: '14px' }}>
            ← Home
          </button>}
          {!isMobile && <div style={{ width: '1px', height: '20px', background: dark.border }} />}
          <span style={{ fontSize: '20px' }}>🔐</span>
          <span style={{ fontWeight: 700, color: '#fff' }}>Brand Guard</span>
          {activeBrand && (
            <span style={{ color: dark.textMuted, fontSize: '13px' }}>
              / {activeBrand.brand_name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Credits badge */}
          <div
            onClick={() => { if (totalRemaining <= 5) setShowPurchase(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '8px',
              background: totalRemaining === 0 ? 'rgba(239,68,68,0.15)' : totalRemaining <= 5 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
              border: `1px solid ${totalRemaining === 0 ? 'rgba(239,68,68,0.4)' : totalRemaining <= 5 ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)'}`,
              cursor: totalRemaining <= 5 ? 'pointer' : 'default',
            }}
          >
            <span style={{ fontSize: '14px' }}>{totalRemaining === 0 ? '🚫' : totalRemaining <= 5 ? '⚠️' : '✅'}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: totalRemaining === 0 ? dark.red : totalRemaining <= 5 ? '#f59e0b' : dark.green }}>
              {creditsLoading ? '...' : totalRemaining} scans
            </span>
            {freeRemaining > 0 && !creditsLoading && (
              <span style={{ fontSize: '11px', color: dark.textMuted }}>({freeRemaining} free + {paidCredits} paid)</span>
            )}
            {totalRemaining <= 5 && !creditsLoading && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#3b82f6', marginLeft: '4px' }}>
                {totalRemaining === 0 ? 'Buy Credits →' : '+ Add more'}
              </span>
            )}
          </div>
          {/* Brand switcher */}
          {brands.length > 1 && (
            <select
              value={activeBrand?.id || ''}
              onChange={e => { const b = brands.find(x => x.id === e.target.value); if (b) setActiveBrand(b); }}
              style={{
                padding: '6px 10px', borderRadius: '8px', background: dark.cardBg,
                border: `1px solid ${dark.border}`, color: dark.text, fontSize: '13px',
              }}
            >
              {brands.map(b => <option key={b.id} value={b.id}>{b.brand_name}</option>)}
            </select>
          )}
          {/* Add brand button */}
          <button
            onClick={() => { setShowOnboarding(true); setOnboardStep(1); }}
            style={{
              padding: '6px 12px', borderRadius: '8px', background: dark.accentLight,
              border: `1px solid ${dark.border}`, color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            + Add Brand
          </button>
          {/* Sign out button */}
          <button
            onClick={async () => { await signOut(); setAuthToken(null); }}
            style={{
              padding: '6px 12px', borderRadius: '8px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
          {/* Alert bell */}
          {authToken && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
                style={{
                  padding: '6px 10px', borderRadius: '8px',
                  background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
                  color: '#8b5cf6', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                🔔 Alerts
                {unreadAlerts > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: '#fff',
                      background: '#ef4444',
                      padding: '2px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    {unreadAlerts}
                  </span>
                )}
              </button>
              {showAlertsDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    width: '320px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    background: '#1a1a2e',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: '12px',
                    padding: '12px',
                    zIndex: 60,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: '#fff', fontWeight: '600' }}>Alerts</span>
                    {unreadAlerts > 0 && (
                      <button
                        onClick={async () => {
                          if (authToken) {
                            try {
                              await fetch(`${API_BASE}/alerts/mark-all-read`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                              });
                              setAlerts(prev => prev.map(a => ({ ...a, read: true })));
                              setUnreadAlerts(0);
                              setShowAlertsDropdown(false);
                            } catch {
                              // Ignore errors
                            }
                          }
                        }}
                        style={{
                          fontSize: '11px',
                          color: '#8b5cf6',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {alerts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>
                      No alerts
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {alerts.map((alert: any) => (
                        <div
                          key={alert.id}
                          onClick={() => {
                            markAlertRead(alert.id);
                            setShowAlertsDropdown(false);
                          }}
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            background: alert.read ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.2)',
                            border: `1px solid ${alert.read ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.4)'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', color: alert.read ? '#94a3b8' : '#8b5cf6' }}>{alert.severity.toUpperCase()} • {new Date(alert.created_at).toLocaleTimeString()} - {alert.platform}</span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: alert.read ? '#94a3b8' : '#fff' }}>{alert.title}</span>
                          </div>
                          {alert.message && (
                            <div style={{ fontSize: '12px', color: alert.read ? '#94a3b8' : '#e2e8f0' }}>{alert.message}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stripe checkout status */}
      {checkoutStatus !== 'idle' && (
        <div style={{
          margin: '16px auto', maxWidth: '800px', padding: '16px', borderRadius: '12px',
          background: checkoutStatus === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
          border: `1px solid ${checkoutStatus === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
          textAlign: 'center', color: checkoutStatus === 'success' ? dark.green : '#fbbf24',
        }}>
          {checkoutStatus === 'verifying' && 'Verifying payment and adding credits...'}
          {checkoutStatus === 'success' && 'Payment verified. Credits have been added to your account.'}
          {checkoutStatus === 'error' && 'We could not verify this checkout yet. Your card will only be credited after Stripe confirms payment.'}
        </div>
      )}

      {/* Dashboard content */}
      <div style={{ maxWidth: dashboardTab === 'monitoring' ? '1600px' : '1200px', margin: '0 auto', padding: isMobile ? '12px' : '24px', transition: 'max-width 180ms ease' }}>
        {activeBrand ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile || dashboardTab === 'monitoring' ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '24px' }}>
            {/* Left: Brand info + scan */}
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Brand card */}
              <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '16px', padding: isMobile ? '16px' : '24px', backdropFilter: 'blur(12px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: 0 }}>{activeBrand.brand_name}</h2>
                    <p style={{ color: dark.accent, fontSize: '14px', margin: '4px 0 0' }}>@{activeBrand.brand_handle.replace('@', '')}</p>
                    {activeBrand.brand_domain && (
                      <p style={{ color: dark.textMuted, fontSize: '13px', margin: '4px 0 0' }}>🌐 {activeBrand.brand_domain}</p>
                    )}
                  </div>
                  <div style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <span style={{ color: dark.green, fontSize: '12px', fontWeight: 600 }}>● Active</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {activeBrand.platforms.map(pid => {
                    const p = PLATFORMS.find(x => x.id === pid);
                    return p ? (
                      <span key={pid} style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
                        background: dark.accentLight, color: '#fff', border: `1px solid ${dark.border}`,
                      }}>{p.icon} {p.label}</span>
                    ) : null;
                  })}
                </div>
                <div style={{ marginTop: '16px', fontSize: '12px', color: dark.textMuted }}>
                  Scanning {activeBrand.scan_frequency} · Created {new Date(activeBrand.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Dashboard tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '4px', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                <button
                  onClick={() => setDashboardTab('scans')}
                  style={{
                    flex: isMobile ? '0 0 auto' : 1, minWidth: isMobile ? '92px' : undefined, minHeight: '42px', padding: '10px', borderRadius: '8px', border: 'none',
                    background: dashboardTab === 'scans' ? dark.accent : 'transparent',
                    color: dashboardTab === 'scans' ? '#fff' : dark.textMuted,
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  }}
                >🔍 Scans</button>
                <button
                  onClick={() => setDashboardTab('monitoring')}
                  style={{
                    flex: isMobile ? '0 0 auto' : 1, minWidth: isMobile ? '110px' : undefined, minHeight: '42px', padding: '10px', borderRadius: '8px', border: 'none',
                    background: dashboardTab === 'monitoring' ? dark.accent : 'transparent',
                    color: dashboardTab === 'monitoring' ? '#fff' : dark.textMuted,
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  }}
                >📊 Monitoring</button>
                <button
                  onClick={() => setDashboardTab('takedowns')}
                  style={{
                    flex: isMobile ? '0 0 auto' : 1, minWidth: isMobile ? '108px' : undefined, minHeight: '42px', padding: '10px', borderRadius: '8px', border: 'none',
                    background: dashboardTab === 'takedowns' ? dark.accent : 'transparent',
                    color: dashboardTab === 'takedowns' ? '#fff' : dark.textMuted,
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  }}
                >📋 Takedowns</button>
                <button
                  onClick={() => setDashboardTab('delivery')}
                  style={{
                    flex: isMobile ? '0 0 auto' : 1, minWidth: isMobile ? '92px' : undefined, minHeight: '42px', padding: '10px', borderRadius: '8px', border: 'none',
                    background: dashboardTab === 'delivery' ? dark.accent : 'transparent',
                    color: dashboardTab === 'delivery' ? '#fff' : dark.textMuted,
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  }}
                >Delivery</button>
              </div>

              {dashboardTab === 'monitoring' ? (
                <div> {/* ── Monitoring Dashboard — Cyberpunk HUD ─────────────── */}
                  {/* ── Header ─────────────────────────────────────────────── */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', padding: isMobile ? '14px 0' : '12px 4px', borderBottom: '1px solid rgba(191,0,255,0.28)' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#39FF14', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '4px' }}>◆ AGENTICBRO SECURITY OPERATIONS</div>
                      <div style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: 900, color: '#fff', textShadow: '0 0 20px rgba(57,255,20,0.25)', letterSpacing: '1.5px' }}>BRAND GUARD</div>
                      <div style={{ fontSize: '11px', color: '#8B8B8B', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '3px' }}>Live monitoring and protection for {activeBrand.brand_name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '7px', background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.22)' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#39FF14', boxShadow: '0 0 8px #39FF14' }} />
                      <span style={{ color: '#39FF14', fontSize: '10px', fontWeight: 800, letterSpacing: '1px', fontFamily: 'monospace' }}>LIVE · AUTO REFRESH 30S</span>
                    </div>
                  </div>

                  {/* ── What We Monitor — Scanner Grid ───────────────────── */}
                  <div style={{ background: 'rgba(26,10,46,0.6)', border: '1px solid rgba(191,0,255,0.3)', borderRadius: '8px', padding: isMobile ? '12px' : '16px', marginBottom: '16px', boxShadow: '0 0 8px rgba(191,0,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#39FF14', letterSpacing: '2px', textTransform: 'uppercase' }}>◆ Scanner Matrix</div>
                      <div style={{ flex: 1, height: '1px', background: 'rgba(57,255,20,0.2)' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#39FF14', boxShadow: '0 0 6px #39FF14' }} />
                        <span style={{ fontSize: '10px', color: '#39FF14', fontWeight: 600 }}>ALL ONLINE</span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(4, minmax(128px, 1fr))' : 'repeat(8, minmax(0, 1fr))', gap: '8px', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? '4px' : 0, scrollSnapType: isMobile ? 'x proximity' : undefined, WebkitOverflowScrolling: 'touch' }}>
                      {[
                        { icon: '🔍', label: 'Impersonator', desc: 'X, IG, TikTok, FB', active: true },
                        { icon: '🌐', label: 'Domain Sweep', desc: 'Typosquat + age + pages', active: true },
                        { icon: '📧', label: 'Email Spoof', desc: 'SPF/DKIM/DMARC', active: true },
                        { icon: '🔗', label: 'Link Scanner', desc: 'URL phishing check', active: true },
                        { icon: '⚡', label: 'Threat Correlate', desc: 'Cross-channel risk', active: true },
                        { icon: '📞', label: 'Vendor Verify', desc: 'Phone fraud check', active: true },
                        { icon: '🛍️', label: 'Marketplace', desc: 'Shopify & Etsy', active: true },
                        { icon: '🖼️', label: 'Visual FP', desc: 'Logo monitoring', active: true },
                      ].map(item => (
                        <div key={item.label} style={{ padding: isMobile ? '10px 8px' : '8px', borderRadius: '6px', background: 'rgba(5,5,16,0.5)', border: '1px solid rgba(57,255,20,0.15)', textAlign: 'center', scrollSnapAlign: isMobile ? 'start' : undefined }}>
                          <div style={{ fontSize: '18px', marginBottom: '2px' }}>{item.icon}</div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{item.label}</div>
                          <div style={{ fontSize: '9px', color: '#8B8B8B', lineHeight: 1.2 }}>{item.desc}</div>
                          <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'center' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#39FF14', boxShadow: '0 0 4px #39FF14' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '4px', background: 'rgba(57,255,20,0.05)', borderLeft: '2px solid #39FF14' }}>
                      <div style={{ fontSize: '10px', color: '#39FF14', fontFamily: 'monospace' }}>
                        SCAN FREQUENCY: {activeBrand?.scan_frequency === 'daily' ? 'DAILY' : activeBrand?.scan_frequency === 'weekly' ? 'WEEKLY' : 'ON-DEMAND'}
                        {activeBrand?.scan_frequency !== 'daily' && <span style={{ color: '#FFAA00', marginLeft: '8px' }}>⚡ UPGRADE TO DAILY</span>}
                      </div>
                    </div>
                  </div>

                  {/* ── Monitoring Content ──────────────────────────────── */}
                  {monitoringLoading && !monitoringData ? (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'pulse 2s infinite' }}>⏳</div>
                      <div style={{ color: '#39FF14', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '2px' }}>INITIALIZING SCANNERS...</div>
                    </div>
                  ) : monitoringData ? (
                    <> {(() => {
                      const health = monitoringData.health_score as Record<string, unknown> | undefined;
                      const summary = monitoringData.summary as Record<string, number> | undefined;
                      const threats = (monitoringData.threats || []) as Record<string, unknown>[];
                      const score = (health?.overall_score as number) ?? 0;
                      const level = (health?.overall_level as string) ?? 'UNKNOWN';
                      const trend = (health?.trend as string) ?? 'stable';
                      const breakdown = health?.breakdown as Record<string, number> | undefined;
                      const recs = (health?.recommendations as string[]) ?? [];
                      const scoreColor = score >= 80 ? '#39FF14' : score >= 60 ? '#FFAA00' : score >= 40 ? '#f97316' : '#FF073A';
                      const scoreGlow = score >= 80 ? '0 0 15px rgba(57,255,20,0.4)' : score >= 60 ? '0 0 15px rgba(255,170,0,0.4)' : score >= 40 ? '0 0 15px rgba(249,115,22,0.4)' : '0 0 15px rgba(255,7,58,0.4)';
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.75fr) minmax(340px, 0.85fr)', gridTemplateRows: 'auto auto auto 1fr', alignItems: 'start', gap: '16px' }}>
                          {/* ── Health Score — Main Gauge ──────────────────── */}
                          <div style={{ gridColumn: isMobile ? '1' : '2', gridRow: isMobile ? 'auto' : '1', background: 'rgba(26,10,46,0.72)', border: '1px solid rgba(191,0,255,0.3)', borderRadius: '10px', padding: isMobile ? '14px' : '18px', boxShadow: '0 0 12px rgba(191,0,255,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#39FF14', letterSpacing: '2px', textTransform: 'uppercase' }}>◆ System Status</div>
                              </div>
                              <button
                                onClick={refreshHealthScore}
                                disabled={refreshingHealth}
                                style={{
                                  minHeight: isMobile ? '40px' : undefined, padding: '5px 12px', borderRadius: '4px', border: '1px solid rgba(57,255,20,0.3)',
                                  background: refreshingHealth ? 'rgba(57,255,20,0.1)' : 'transparent',
                                  color: '#39FF14', fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', cursor: refreshingHealth ? 'not-allowed' : 'pointer',
                                  letterSpacing: '1px', textTransform: 'uppercase',
                                }}
                              >
                                {refreshingHealth ? '⟳ SCANNING...' : '⟳ REFRESH'}
                              </button>
                            </div>

                            {/* Main score circle */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
                              <div style={{
                                width: isMobile ? '90px' : '100px', height: isMobile ? '90px' : '100px', borderRadius: '50%',
                                border: `3px solid ${scoreColor}`, boxShadow: scoreGlow,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(5,5,16,0.6)', flexShrink: 0,
                              }}>
                                <div style={{ fontSize: isMobile ? '28px' : '32px', fontWeight: 900, color: scoreColor, fontFamily: 'monospace', textShadow: scoreGlow }}>{score}</div>
                                <div style={{ fontSize: '9px', color: '#8B8B8B', fontFamily: 'monospace', letterSpacing: '1px' }}>/100</div>
                              </div>
                              <div>
                                <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 900, color: scoreColor, letterSpacing: '2px', textShadow: scoreGlow }}>{level}</div>
                                <div style={{ fontSize: '11px', color: '#8B8B8B', marginTop: '4px', fontFamily: 'monospace' }}>
                                  TREND: {trend === 'improving' ? '📈 IMPROVING' : trend === 'declining' ? '📉 DECLINING' : '➡️ STABLE'}
                                </div>
                                <div style={{ fontSize: '10px', color: '#39FF14', fontFamily: 'monospace', marginTop: '4px' }}>
                                  ● 24/7 MONITORING ACTIVE
                                </div>
                              </div>
                            </div>

                            {/* Health bars — HUD style */}
                            <div style={{ display: 'grid', gap: '12px' }}>
                              {[
                                { label: 'SOCIAL', icon: '👤', value: breakdown?.social_health ?? 0, key: 'social' },
                                { label: 'DOMAIN', icon: '🌐', value: breakdown?.domain_health ?? 0, key: 'domain' },
                                { label: 'EMAIL', icon: '📧', value: breakdown?.email_health ?? 0, key: 'email' },
                                { label: 'PHONE', icon: '📞', value: breakdown?.phone_health ?? 0, key: 'phone' },
                                { label: 'WEB REP', icon: '🌐', value: breakdown?.web_reputation ?? 100, key: 'web' },
                              ].map(item => {
                                const tips = ((health?.improvement_tips as Record<string, string[]>) || {})[item.key] || [];
                                const needsImprovement = item.value < 80;
                                const barColor = item.value >= 80 ? '#39FF14' : item.value >= 60 ? '#FFAA00' : item.value >= 40 ? '#f97316' : '#FF073A';
                                const barGlow = item.value >= 80 ? '0 0 6px rgba(57,255,20,0.3)' : item.value >= 60 ? '0 0 6px rgba(255,170,0,0.3)' : item.value >= 40 ? '0 0 6px rgba(249,115,22,0.3)' : '0 0 6px rgba(255,7,58,0.3)';
                                return (
                                  <div key={item.label} style={{ padding: '8px', borderRadius: '4px', background: 'rgba(5,5,16,0.4)', border: needsImprovement ? `1px solid ${barColor}40` : '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '12px' }}>{item.icon}</span>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', letterSpacing: '1.5px', fontFamily: 'monospace' }}>{item.label}</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {needsImprovement && <span style={{ fontSize: '10px', color: barColor }}>⚠</span>}
                                        <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', color: barColor, textShadow: barGlow }}>{item.value}%</span>
                                      </div>
                                    </div>
                                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${item.value}%`, background: barColor, borderRadius: '2px', boxShadow: barGlow, transition: 'width 0.5s ease' }} />
                                    </div>
                                    {needsImprovement && tips.length > 0 && (
                                      <div style={{ marginTop: '6px', padding: '6px 8px', background: 'rgba(5,5,16,0.5)', borderRadius: '4px', borderLeft: `2px solid ${barColor}` }}>
                                        <div style={{ fontSize: '9px', fontWeight: 700, color: barColor, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px', fontFamily: 'monospace' }}>HOW TO IMPROVE</div>
                                        {tips.slice(0, 2).map((tip: string, ti: number) => (
                                          <div key={ti} style={{ fontSize: '10px', color: '#b0b0b0', lineHeight: 1.4 }}>◆ {tip}</div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {recs.length > 0 && (
                              <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(5,5,16,0.5)', borderRadius: '4px', borderLeft: '2px solid #BF00FF' }}>
                                <div style={{ fontSize: '9px', fontWeight: 700, color: '#BF00FF', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px', fontFamily: 'monospace' }}>◆ RECOMMENDATIONS</div>
                                {recs.map((r: string, i: number) => <div key={i} style={{ fontSize: '11px', color: '#d0d0d0', marginBottom: '2px' }}>→ {r}</div>)}
                              </div>
                            )}
                          </div>

                          {/* ── Threat Count — HUD style ─────────────────── */}
                          <div style={{ gridColumn: isMobile ? '1' : '2', gridRow: isMobile ? 'auto' : '2', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: '6px' }}>
                            {[
                              { label: 'TOTAL', value: summary?.total_threats ?? 0, color: '#00F0FF', bg: 'rgba(0,240,255,0.08)', border: 'rgba(0,240,255,0.2)' },
                              { label: 'CRITICAL', value: summary?.critical_threats ?? 0, color: '#FF073A', bg: 'rgba(255,7,58,0.08)', border: 'rgba(255,7,58,0.25)' },
                              { label: 'HIGH', value: summary?.high_threats ?? 0, color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)' },
                              { label: 'MEDIUM', value: summary?.medium_threats ?? 0, color: '#FFAA00', bg: 'rgba(255,170,0,0.08)', border: 'rgba(255,170,0,0.2)' },
                              { label: 'LOW', value: summary?.low_threats ?? 0, color: '#39FF14', bg: 'rgba(57,255,20,0.08)', border: 'rgba(57,255,20,0.2)' },
                            ].map(card => (
                              <div key={card.label} style={{ gridColumn: isMobile && card.label === 'TOTAL' ? '1 / -1' : undefined, padding: '12px 8px', borderRadius: '6px', background: card.bg, border: `1px solid ${card.border}`, textAlign: 'center', boxShadow: `0 0 8px ${card.border}` }}>
                                <div style={{ fontSize: isMobile ? '22px' : '24px', fontWeight: 900, color: card.color, fontFamily: 'monospace', textShadow: `0 0 10px ${card.border}` }}>{card.value}</div>
                                <div style={{ fontSize: '9px', color: card.color, fontWeight: 700, marginTop: '2px', letterSpacing: '1.5px', fontFamily: 'monospace' }}>{card.label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Live premium intelligence streams */}
                          {(() => {
                            const feeds = monitoringData.live_feeds as Record<string, unknown> | undefined;
                            const dns = (feeds?.dns || []) as Record<string, unknown>[];
                            const dmarc = (feeds?.dmarc || []) as Record<string, unknown>[];
                            const intel = (feeds?.threat_intel || []) as Record<string, unknown>[];
                            const updatedAt = feeds?.updated_at ? new Date(String(feeds.updated_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'WAITING';
                            const feedCard = (title: string, color: string, count: number, content: ReactNode) => (
                              <div style={{ minWidth: 0, padding: isMobile ? '11px' : '14px', borderRadius: '8px', background: 'rgba(5,5,16,0.62)', border: `1px solid ${color}35`, boxShadow: `0 0 8px ${color}16` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, boxShadow: `0 0 7px ${color}` }} />
                                  <div style={{ fontSize: '10px', fontWeight: 800, color, letterSpacing: '1.5px', fontFamily: 'monospace' }}>{title}</div>
                                  <div style={{ marginLeft: 'auto', fontSize: '9px', color: '#8B8B8B', fontFamily: 'monospace' }}>{count} EVENTS</div>
                                </div>
                                {content}
                              </div>
                            );
                            const empty = <div style={{ padding: '18px 4px', textAlign: 'center', color: '#666', fontSize: '10px', fontFamily: 'monospace' }}>AWAITING TELEMETRY</div>;
                            return (
                              <div style={{ gridColumn: isMobile ? '1' : '1', gridRow: isMobile ? 'auto' : '1 / span 4', background: 'rgba(26,10,46,0.68)', border: '1px solid rgba(191,0,255,0.36)', borderRadius: '10px', padding: isMobile ? '12px' : '16px', boxShadow: '0 0 14px rgba(191,0,255,0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#00F0FF', letterSpacing: '2px', fontFamily: 'monospace' }}>◆ LIVE INTELLIGENCE STREAMS</div>
                                  <div style={{ flex: 1, height: '1px', minWidth: '24px', background: 'rgba(0,240,255,0.2)' }} />
                                  <div style={{ fontSize: '9px', color: '#8B8B8B', fontFamily: 'monospace' }}>AUTO 30S · {updatedAt}</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                  {feedCard('DNS TRANSITIONS', '#00F0FF', dns.length, dns.length ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '7px', maxHeight: '270px', overflowY: 'auto' }}>
                                      {dns.slice(0, 8).map(row => <div key={String(row.id)} style={{ padding: '8px', background: 'rgba(0,240,255,0.04)', borderLeft: `2px solid ${row.resolves ? '#39FF14' : '#8B8B8B'}` }}>
                                        <div style={{ color: '#fff', fontSize: '11px', fontWeight: 700, wordBreak: 'break-all' }}>{String(row.domain)}</div>
                                        <div style={{ color: row.resolves ? '#39FF14' : '#8B8B8B', fontSize: '9px', fontFamily: 'monospace', marginTop: '3px', overflowWrap: 'anywhere' }}>{row.resolves ? 'ACTIVE DNS' : 'NO RESOLUTION'} · IP {((row.ip_addresses as string[]) || [])[0] || '—'} · {((row.mx_records as string[]) || []).length} MX</div>
                                        <div style={{ color: '#666', fontSize: '9px', marginTop: '2px' }}>{new Date(String(row.checked_at)).toLocaleString()}</div>
                                      </div>)}
                                    </div>
                                  ) : empty)}
                                  {feedCard('DMARC AUTH', '#BF00FF', dmarc.length, dmarc.length ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '7px', maxHeight: '250px', overflowY: 'auto' }}>
                                      {dmarc.slice(0, 8).map(row => {
                                        const failed = Number(row.failed_count || 0);
                                        return <div key={String(row.id)} style={{ padding: '8px', background: 'rgba(191,0,255,0.04)', borderLeft: `2px solid ${failed ? '#FFAA00' : '#39FF14'}` }}>
                                          <div style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>{String(row.reporter)}</div>
                                          <div style={{ color: failed ? '#FFAA00' : '#39FF14', fontSize: '9px', fontFamily: 'monospace', marginTop: '3px' }}>{Number(row.message_count || 0)} MAIL · {failed} FAILED · {Number(row.unauthorized_sources || 0)} UNAUTH</div>
                                          <div style={{ color: '#666', fontSize: '9px', marginTop: '2px' }}>{new Date(String(row.period_end)).toLocaleString()}</div>
                                        </div>;
                                      })}
                                    </div>
                                  ) : empty)}
                                  {feedCard('THREAT INTEL', '#FF073A', intel.length, intel.length ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '7px', maxHeight: '250px', overflowY: 'auto' }}>
                                      {intel.slice(0, 8).map(row => <div key={String(row.id)} style={{ padding: '8px', background: 'rgba(255,7,58,0.04)', borderLeft: `2px solid ${Number(row.severity) >= 4 ? '#FF073A' : '#FFAA00'}` }}>
                                        <div style={{ color: '#fff', fontSize: '11px', fontWeight: 700, wordBreak: 'break-all' }}>{String(row.target)}</div>
                                        <div style={{ color: '#FFAA00', fontSize: '9px', fontFamily: 'monospace', marginTop: '3px' }}>{String(row.threat_type).toUpperCase()} · {String(row.job_status || row.status).toUpperCase()} · {Number(row.confidence)}%</div>
                                        <div style={{ color: '#666', fontSize: '9px', marginTop: '2px' }}>{row.fingerprint ? `FP ${String(row.fingerprint).slice(0, 14)}` : new Date(String(row.updated_at)).toLocaleString()}</div>
                                      </div>)}
                                    </div>
                                  ) : empty)}
                                </div>
                              </div>
                            );
                          })()}

                          {/* ── Threat Feed — Neon card style ────────────── */}
                          <div style={{ gridColumn: isMobile ? '1' : '2', gridRow: isMobile ? 'auto' : '3', background: 'rgba(26,10,46,0.72)', border: '1px solid rgba(255,7,58,0.28)', borderRadius: '10px', padding: '16px', boxShadow: '0 0 10px rgba(255,7,58,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#FF073A', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'monospace' }}>◆ Threat Monitor</div>
                              <div style={{ flex: 1, height: '1px', background: 'rgba(255,7,58,0.2)' }} />
                              <div style={{ fontSize: '10px', color: '#8B8B8B', fontFamily: 'monospace' }}>{threats.length} DETECTED</div>
                            </div>
                            {threats.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
                                <div style={{ fontSize: '12px', color: '#39FF14', fontFamily: 'monospace', letterSpacing: '1px' }}>ALL CLEAR — NO THREATS DETECTED</div>
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gap: '8px', maxHeight: isMobile ? '400px' : '500px', overflowY: 'auto' }}>
                                {threats.slice(0, 15).map((t: Record<string, unknown>, i: number) => {
                                  const sev = (t.severity as string) || 'low';
                                  const typeLabel = (t.type as string) === 'social_impersonator' ? 'IMP' : (t.type as string) === 'domain_lookalike' ? 'DOMAIN' : (t.type as string) === 'phone_scam' ? 'PHONE' : (t.type as string) === 'cross_channel' ? 'X-CHAN' : (t.type as string) === 'email' ? 'EMAIL' : 'UNKNOWN';
                                  const typeIcon = (t.type as string) === 'social_impersonator' ? '👤' : (t.type as string) === 'domain_lookalike' ? '🌐' : (t.type as string) === 'phone_scam' ? '📞' : (t.type as string) === 'cross_channel' ? '🔗' : (t.type as string) === 'email' ? '📧' : '🕵️';
                                  const sevColor = sev === 'critical' ? '#FF073A' : sev === 'high' ? '#f97316' : sev === 'medium' ? '#FFAA00' : '#39FF14';
                                  const sevBg = sev === 'critical' ? 'rgba(255,7,58,0.08)' : sev === 'high' ? 'rgba(249,115,22,0.08)' : sev === 'medium' ? 'rgba(255,170,0,0.06)' : 'rgba(57,255,20,0.06)';
                                  const sevBorder = sev === 'critical' ? 'rgba(255,7,58,0.3)' : sev === 'high' ? 'rgba(249,115,22,0.25)' : sev === 'medium' ? 'rgba(255,170,0,0.2)' : 'rgba(57,255,20,0.15)';
                                  const evidence = (t.evidence as string[]) || [];
                                  const score = Number(t.risk_score ?? 0);
                                  const scoreDisplay = score > 0 ? `${score}` : '—';
                                  return (
                                    <div key={i} style={{ padding: '10px 12px', borderRadius: '6px', background: sevBg, border: `1px solid ${sevBorder}`, boxShadow: `0 0 4px ${sevBorder}` }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '16px' }}>{typeIcon}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', wordBreak: 'break-all' }}>{String(t.target || 'Unknown')}</div>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', marginTop: '3px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#8B8B8B', letterSpacing: '1px', fontFamily: 'monospace' }}>{typeLabel}</span>
                                            {evidence.length > 0 && <span style={{ fontSize: '10px', color: sevColor, fontStyle: 'italic' }}>{evidence[0]}</span>}
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                          <span style={{ fontSize: '14px', fontWeight: 900, color: sevColor, fontFamily: 'monospace', textShadow: `0 0 6px ${sevBorder}` }}>{scoreDisplay}</span>
                                          <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '2px', background: sevBorder, color: sevColor, fontWeight: 700, letterSpacing: '0.5px', fontFamily: 'monospace' }}>{sev.toUpperCase()}</span>
                                        </div>
                                      </div>
                                      {['critical', 'high'].includes(sev) && (
                                        <button
                                          onClick={() => setDashboardTab('takedowns')}
                                          style={{ marginTop: '8px', width: '100%', minHeight: isMobile ? '42px' : undefined, padding: '7px 10px', borderRadius: '5px', border: `1px solid ${sevBorder}`, background: 'rgba(255,255,255,0.025)', color: sevColor, fontSize: '9px', fontWeight: 800, letterSpacing: '1px', fontFamily: 'monospace', cursor: 'pointer' }}
                                        >REVIEW TAKEDOWN OPTIONS</button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* ── Takedown Center ────────────────────────────── */}
                          {(() => {
                            const takedowns = (monitoringData?.takedown_actions || []) as Record<string, unknown>[];
                            const pending = takedowns.filter(t => t.status === 'pending');
                            const inProgress = takedowns.filter(t => ['submitted', 'acknowledged'].includes(String(t.status)));
                            const completed = takedowns.filter(t => ['removed', 'rejected'].includes(String(t.status)));
                            return (
                              <div style={{ gridColumn: isMobile ? '1' : '2', gridRow: isMobile ? 'auto' : '4', background: 'rgba(26,10,46,0.72)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: '10px', padding: '16px', boxShadow: '0 0 10px rgba(0,240,255,0.08)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#00F0FF', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'monospace' }}>◆ Takedown Center</div>
                                  <div style={{ flex: 1, height: '1px', background: 'rgba(0,240,255,0.2)' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                  <div style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.2)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#FFAA00', fontFamily: 'monospace' }}>{pending.length}</div>
                                    <div style={{ fontSize: '9px', color: '#FFAA00', fontWeight: 700, letterSpacing: '1px', fontFamily: 'monospace' }}>PENDING</div>
                                  </div>
                                  <div style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#00F0FF', fontFamily: 'monospace' }}>{inProgress.length}</div>
                                    <div style={{ fontSize: '9px', color: '#00F0FF', fontWeight: 700, letterSpacing: '1px', fontFamily: 'monospace' }}>IN PROGRESS</div>
                                  </div>
                                  <div style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#39FF14', fontFamily: 'monospace' }}>{completed.length}</div>
                                    <div style={{ fontSize: '9px', color: '#39FF14', fontWeight: 700, letterSpacing: '1px', fontFamily: 'monospace' }}>COMPLETED</div>
                                  </div>
                                </div>
                                {takedowns.length === 0 ? (
                                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                    <div style={{ fontSize: '11px', color: '#8B8B8B', fontFamily: 'monospace', letterSpacing: '1px' }}>NO TAKEDOWN ACTIONS YET</div>
                                  </div>
                                ) : (
                                  <div style={{ display: 'grid', gap: '6px' }}>
                                    {takedowns.slice(0, 8).map((t: Record<string, unknown>, i: number) => (
                                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '4px', background: 'rgba(5,5,16,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.priority === 'urgent' ? '#FF073A' : t.priority === 'high' ? '#f97316' : '#FFAA00', boxShadow: t.priority === 'urgent' ? '0 0 4px #FF073A' : 'none' }} />
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{String(t.priority || 'medium').toUpperCase()} · {String(t.platform || 'unknown').toUpperCase()}</div>
                                          <div style={{ fontSize: '10px', color: '#8B8B8B' }}>{String(t.action_type || 'report')} → {String(t.target || 'unknown')}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
                      <div style={{ color: '#8B8B8B', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '1px' }}>NO MONITORING DATA AVAILABLE</div>
                      <div style={{ color: '#8B8B8B', fontSize: '11px', marginTop: '4px' }}>Run a scan or refresh your health score to populate the dashboard.</div>
                    </div>
                  )}
                </div>
              ) : dashboardTab === 'delivery' ? (
                <DeliverySettings authToken={authToken || ''} brandMonitorId={activeBrand.id} />
              ) : dashboardTab === 'takedowns' ? (
                <div>
                  {/* ── Takedowns Tab ─────────────────────────────── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>📋 Takedown Center</div>
                      <div style={{ fontSize: '12px', color: dark.textMuted, marginTop: '2px' }}>Generate DMCA, Shopify, and platform-specific takedown reports</div>
                    </div>
                    <button
                      onClick={() => setTakedownStandalone(true)}
                      style={{
                        padding: '10px 20px', borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      📋 Generate Takedown Report
                    </button>
                  </div>

                  {(() => {
                    const takedowns = (monitoringData?.takedown_actions || []) as Record<string, unknown>[];
                    const pending = takedowns.filter(t => t.status === 'pending' || t.status === 'new');
                    const inProgress = takedowns.filter(t => ['submitted', 'acknowledged', 'monitoring'].includes(String(t.status)));
                    const completed = takedowns.filter(t => ['removed', 'resolved', 'dismissed', 'rejected'].includes(String(t.status)));
                    const draft = takedowns.filter(t => t.status === 'draft');

                    return (
                      <>
                        {/* Status cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                          {[
                            { label: 'Drafts', count: draft.length, color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
                            { label: 'Pending', count: pending.length, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
                            { label: 'In Progress', count: inProgress.length, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
                            { label: 'Resolved', count: completed.length, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
                          ].map(s => (
                            <div key={s.label} style={{ padding: '12px', borderRadius: '10px', background: s.bg, textAlign: 'center' }}>
                              <div style={{ fontSize: '24px', fontWeight: 700, color: s.color }}>{s.count}</div>
                              <div style={{ fontSize: '11px', color: s.color, marginTop: '2px' }}>{s.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Takedown actions list */}
                        {takedowns.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '40px 0', background: dark.cardBg, borderRadius: '12px', border: `1px solid ${dark.border}` }}>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                            <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>No Takedown Reports Yet</div>
                            <div style={{ color: dark.textMuted, fontSize: '13px', maxWidth: '360px', margin: '0 auto', lineHeight: 1.5 }}>
                              Generate a takedown report to create DMCA notices, Shopify IP complaints, and platform-specific removal requests for impersonating stores and accounts.
                            </div>
                            <button
                              onClick={() => setTakedownStandalone(true)}
                              style={{
                                marginTop: '16px', padding: '10px 24px', borderRadius: '10px', border: 'none',
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              📋 Generate Your First Report
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: '6px' }}>
                            {takedowns.slice(0, 20).map((t: Record<string, unknown>, i: number) => {
                              const status = String(t.status || 'new');
                              const statusColors: Record<string, string> = {
                                draft: '#6b7280', new: '#f59e0b', pending: '#f59e0b',
                                submitted: '#3b82f6', acknowledged: '#3b82f6', monitoring: '#3b82f6',
                                removed: '#22c55e', resolved: '#22c55e', dismissed: '#6b7280', rejected: '#ef4444',
                              };
                              const statusBgs: Record<string, string> = {
                                draft: 'rgba(107,114,128,0.1)', new: 'rgba(245,158,11,0.1)', pending: 'rgba(245,158,11,0.1)',
                                submitted: 'rgba(59,130,246,0.1)', acknowledged: 'rgba(59,130,246,0.1)', monitoring: 'rgba(59,130,246,0.1)',
                                removed: 'rgba(34,197,94,0.1)', resolved: 'rgba(34,197,94,0.1)', dismissed: 'rgba(107,114,128,0.1)', rejected: 'rgba(239,68,68,0.1)',
                              };
                              const priorityIcon = String(t.priority) === 'urgent' ? '🔴' : String(t.priority) === 'high' ? '🟠' : '🟡';
                              return (
                                <div key={i} style={{
                                  display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px',
                                  borderRadius: '8px', border: `1px solid ${dark.border}`, background: statusBgs[status] || 'transparent',
                                }}>
                                  <span>{priorityIcon}</span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                                      {String(t.platform || 'unknown').toUpperCase()} · {String(t.action_type || 'report')}
                                    </div>
                                    <div style={{ fontSize: '11px', color: dark.textMuted }}>
                                      {String(t.target || 'unknown').substring(0, 60)}
                                    </div>
                                  </div>
                                  <span style={{
                                    padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                                    background: statusBgs[status] || 'transparent', color: statusColors[status] || '#fff',
                                    textTransform: 'uppercase',
                                  }}>{status}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
              <div>
              {/* Scan buttons */}
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  { type: 'impersonator', icon: '🔍', label: 'Impersonator Scan', desc: 'Find fake accounts mimicking your brand' },
                  { type: 'domain', icon: '🌐', label: 'Domain Sweep', desc: 'Map all lookalike & typosquat domains targeting your brand' },
                  { type: 'email', icon: '📧', label: 'Email Spoof Check', desc: 'Check SPF/DKIM/DMARC & find spoofable lookalike domains' },
                  { type: 'website', icon: '🔗', label: 'Link Scanner', desc: 'Check any URL — is it impersonating your brand or a scam?' },
                  { type: 'threat', icon: '⚡', label: 'Threat Correlate', desc: 'Cross-channel risk correlation' },
                  { type: 'vendor', icon: '📞', label: 'Vendor Verify', desc: 'Check phone numbers for vendor fraud' },
                  { type: 'marketplace', icon: '🛍️', label: 'Marketplace Scanner', desc: 'Scan Shopify & Etsy for brand impersonators' },
                  { type: 'fingerprint', icon: '🖼️', label: 'Visual Fingerprints', desc: 'Register & manage brand image fingerprints' },
                ].map(scan => (
                  <button
                    key={scan.type}
                    onClick={() => scan.type === 'vendor' ? setShowVendorInput(true) : scan.type === 'website' ? setShowWebsiteInput(true) : scan.type === 'marketplace' ? setShowMarketplacePanel(v => !v) : scan.type === 'fingerprint' ? setShowFingerprintPanel(v => !v) : handleRunScan(scan.type)}
                    disabled={scanning !== null || !credits?.has_credits}
                    style={{
                      padding: '12px', borderRadius: '10px', border: `1px solid ${dark.border}`,
                      background: scanning === scan.type ? 'rgba(139,92,246,0.3)' : scan.type === 'marketplace' && showMarketplacePanel ? 'rgba(139,92,246,0.3)' : scan.type === 'fingerprint' && showFingerprintPanel ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.1)',
                      color: '#fff', fontSize: '14px', fontWeight: 600, cursor: scanning !== null || !credits?.has_credits ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{scan.icon}</span>
                    <div>
                      <div>{scanning === scan.type ? 'Scanning...' : scan.label}</div>
                      <div style={{ fontSize: '11px', color: dark.textMuted, fontWeight: 400 }}>{scan.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              {!credits?.has_credits && (
                <button
                  onClick={() => setShowPurchase(true)}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '10px',
                    border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)',
                    color: dark.green, fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  💎 Buy Credits — $1/scan
                </button>
              )}
              </div>
              )}
              {/* Vendor phone input modal */}
              {showVendorInput && (
                <div style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${dark.border}`, background: dark.cardBg }}>
                  <div style={{ color: '#fff', fontWeight: 600, marginBottom: '8px' }}>📞 Vendor Phone Verification</div>
                  <input
                    placeholder="+1 555 123 4567 (with country code)"
                    value={vendorPhone}
                    onChange={e => setVendorPhone(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '14px', marginBottom: '8px', outline: 'none' }}
                  />
                  <input
                    placeholder="Country code (US, UK, etc.)"
                    value={vendorCountry}
                    onChange={e => setVendorCountry(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '14px', marginBottom: '8px', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleVendorScan} disabled={!vendorPhone} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: dark.accent, color: '#fff', fontWeight: 600, border: 'none', cursor: vendorPhone ? 'pointer' : 'not-allowed' }}>
                      Verify
                    </button>
                    <button onClick={() => setShowVendorInput(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'transparent', color: dark.textMuted, border: `1px solid ${dark.border}`, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {/* Website URL input */}
              {showWebsiteInput && (
                <div style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${dark.border}`, background: dark.cardBg }}>
                  <div style={{ color: '#fff', fontWeight: 600, marginBottom: '8px' }}>🔗 Link Scanner</div>
                  <input
                    placeholder="https://example.com"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '14px', marginBottom: '8px', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleWebsiteScan} disabled={!websiteUrl} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: dark.accent, color: '#fff', fontWeight: 600, border: 'none', cursor: websiteUrl ? 'pointer' : 'not-allowed' }}>
                      Scan
                    </button>
                    <button onClick={() => setShowWebsiteInput(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'transparent', color: dark.textMuted, border: `1px solid ${dark.border}`, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Scan results / threats */}
            <div style={{ display: dashboardTab === 'monitoring' ? 'none' : 'grid', gap: '16px' }}>
              {/* Marketplace Scanner Panel */}
              {showMarketplacePanel && activeBrand && (
                <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '16px', padding: isMobile ? '16px' : '24px', backdropFilter: 'blur(12px)' }}>
                  <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
                    🛍️ Marketplace Scanner
                  </h3>
                  <div style={{ fontSize: '12px', color: dark.textMuted, marginBottom: '4px' }}>
                    Scan Shopify & Etsy for stores impersonating your brand. Visual fingerprint matching included.
                  </div>
                  <MarketplaceScanner
                    brandId={activeBrand.id}
                    brandName={activeBrand.brand_name}
                    brandDomain={activeBrand.brand_domain}
                    authToken={authToken}
                    dark={dark}
                    isMobile={isMobile}
                    apiBase={API_BASE}
                  />
                </div>
              )}

              {/* Fingerprint Manager Panel */}
              {showFingerprintPanel && activeBrand && (
                <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '16px', padding: isMobile ? '16px' : '24px', backdropFilter: 'blur(12px)' }}>
                  <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
                    🖼️ Visual Fingerprints
                  </h3>
                  <div style={{ fontSize: '12px', color: dark.textMuted, marginBottom: '4px' }}>
                    Register your brand images to enable visual matching across marketplaces and social platforms.
                  </div>
                  <FingerprintManager
                    brandId={activeBrand.id}
                    brandDomain={activeBrand.brand_domain}
                    authToken={authToken}
                    dark={dark}
                    isMobile={isMobile}
                    apiBase={API_BASE}
                  />
                </div>
              )}

              {/* Scan results */}
              {scanResult ? (
                <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '16px', padding: isMobile ? '16px' : '24px', backdropFilter: 'blur(12px)' }}>
                  <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
                    {scanType === 'domain' ? '🌐 Domain Sweep Results' : scanType === 'website' ? '🔗 Link Scanner Results' : scanType === 'threat' ? '⚡ Threat Correlation Results' : scanType === 'vendor' ? '📞 Vendor Verification Results' : scanType === 'email' ? '📧 Email Spoof Check Results' : '🔍 Impersonator Scan Results'}
                  </h3>
                  {scanResult.real_scan_pending && (
                    <div style={{ padding: '12px', marginBottom: '12px', borderRadius: '8px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                      Checking real platforms for actual impersonator accounts... The preview below shows theoretical variants while we scan X, Instagram, TikTok, and more.
                    </div>
                  )}
                  {scanResult.error ? (
                    <div style={{ color: dark.red, fontSize: '14px' }}>{String(scanResult.error)}</div>
                  ) : (scanResult.success || scanResult.total_variants || scanResult.impersonators || scanResult.variants || scanResult.risk_score !== undefined || scanResult.aggregate_risk_score !== undefined || scanResult.verification_level || scanResult.vendor_verification || scanResult.email_security || scanResult.red_flags) ? (
                    <div>
                      {/* Impersonator scan results */}
                      {scanType === 'impersonator' && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                              <div style={{ fontSize: '12px', color: dark.textMuted }}>Impersonators Found</div>
                              <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: dark.red }}>
                                {String(scanResult.total_found ?? scanResult.impersonators?.length ?? 0)}
                              </div>
                            </div>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                              <div style={{ fontSize: '12px', color: dark.textMuted }}>Platforms Scanned</div>
                              <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: dark.accent }}>
                                {Array.isArray(scanResult.platforms_scanned) ? (scanResult.platforms_scanned as Array<unknown>).length : activeBrand.platforms.length}
                              </div>
                            </div>
                          </div>
                          {Array.isArray(scanResult.impersonators) && scanResult.impersonators.length > 0 && (
                            <div style={{ display: 'grid', gap: '8px' }}>
                              {scanResult.impersonators.slice(0, 5).map((imp: Record<string, unknown>, i: number) => (
                                <div key={i} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{String(imp.username || imp.handle || 'Unknown')}</div>
                                    <div style={{ color: dark.red, fontSize: '12px', fontWeight: 600 }}>
                                      Risk: {String(imp.risk_score ?? imp.risk ?? '?')}/10
                                    </div>
                                  </div>
                                  <div style={{ color: dark.textMuted, fontSize: '12px', marginTop: '4px' }}>
                                    {String(imp.platform || '?')} · {String(imp.match_type || imp.type || 'Impersonator')}
                                  </div>
                                </div>
                              ))}
                              {scanResult.impersonators.length > 5 && (
                                <div style={{ color: dark.textMuted, fontSize: '13px', textAlign: 'center', padding: '8px' }}>
                                  +{scanResult.impersonators.length - 5} more
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Domain monitor results */}
                      {scanType === 'domain' && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                              <div style={{ fontSize: '12px', color: dark.textMuted }}>Lookalike Domains</div>
                              <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: dark.red }}>
                                {String(scanResult.total_variants ?? scanResult.variants?.length ?? 0)}
                              </div>
                            </div>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                              <div style={{ fontSize: '12px', color: dark.textMuted }}>Risk Level</div>
                              <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: scanResult.risk_level === 'HIGH' || scanResult.risk_level === 'CRITICAL' ? dark.red : dark.accent }}>
                                {String(scanResult.risk_level ?? 'LOW')}
                              </div>
                            </div>
                          </div>
                          {Array.isArray(scanResult.variants) && scanResult.variants.length > 0 && (
                            <div style={{ display: 'grid', gap: '8px' }}>
                              {scanResult.variants.slice(0, 5).map((v: Record<string, unknown>, i: number) => {
                                const vAge = v.domain_age as Record<string, unknown> | undefined;
                                const vActive = v.active_page as Record<string, unknown> | undefined;
                                const ageDays = vAge?.days as number | undefined;
                                const isNew = vAge?.is_new as boolean | undefined;
                                const isActive = vActive?.is_active as boolean | undefined;
                                const hasBrand = vActive?.has_brand_content as boolean | undefined;
                                const impConf = (vActive?.impersonation_confidence as number | undefined) ?? 0;
                                const vTitle = vActive?.title as string | undefined;
                                return (
                                  <div key={i} style={{ padding: '10px', borderRadius: '8px',
                                    background: impConf && impConf > 50 ? 'rgba(239,68,68,0.15)' : impConf && impConf > 20 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                    border: impConf && impConf > 50 ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(239,68,68,0.2)'
                                  }}>
                                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>{String(v.domain || v.name || '?')}</div>
                                    <div style={{ color: dark.textMuted, fontSize: '11px', marginTop: '2px' }}>
                                      {String(v.type || v.risk || 'Lookalike')}
                                      {Boolean(v.risk_level) && <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                        background: v.risk_level === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : v.risk_level === 'HIGH' ? 'rgba(245,158,11,0.2)' : 'rgba(139,92,246,0.2)',
                                        color: v.risk_level === 'CRITICAL' ? '#ef4444' : v.risk_level === 'HIGH' ? '#f59e0b' : '#8b5cf6'
                                      }}>{String(v.risk_level)}</span>}
                                    </div>
                                    {ageDays !== undefined && (
                                      <div style={{ color: isNew ? '#f59e0b' : '#64748b', fontSize: '11px', marginTop: '3px' }}>
                                        {isNew ? '🆕' : '📅'} Domain age: {ageDays < 30 ? `${ageDays} days` : ageDays < 365 ? `${Math.round(ageDays/30)} months` : `${Math.round(ageDays/365)} years`}
                                        {isNew && <span style={{ color: '#f59e0b', fontWeight: 600 }}> (NEW!)</span>}
                                      </div>
                                    )}
                                    {isActive && (
                                      <div style={{ color: hasBrand ? '#ef4444' : '#64748b', fontSize: '11px', marginTop: '2px' }}>
                                        {hasBrand ? '🚨' : '🌐'} Active page{hasBrand ? ' with brand content' : ''}
                                        {impConf > 0 && <span style={{ fontWeight: 600 }}> ({impConf}% impersonation)</span>}
                                      </div>
                                    )}
                                    {vTitle && (
                                      <div style={{ color: '#475569', fontSize: '10px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        Page title: {vTitle}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}

                      {/* Website scan results */}
                      {scanType === 'website' && (
                        <>
                          {/* Brand impersonation alert */}
                          {scanResult.brandImpersonationInfo?.is_lookalike && (
                            <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>
                              <div style={{ color: dark.red, fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>⚠️ Brand Domain Impersonation Detected</div>
                              <div style={{ color: '#fff', fontSize: '13px', marginBottom: '6px' }}>
                                <strong>{scanResult.domain}</strong> is a <strong>{scanResult.brandImpersonationInfo.variant_type.replace(/_/g, ' ')}</strong> of your brand domain <strong>{scanResult.brandImpersonationInfo.brand_domain}</strong>
                              </div>
                              <div style={{ color: dark.textMuted, fontSize: '12px' }}>
                                Similarity: {Math.round((scanResult.brandImpersonationInfo.similarity ?? 0) * 100)}% — this domain may be impersonating your brand
                              </div>
                            </div>
                          )}
                          {/* Verified brand domain */}
                          {scanResult.brandImpersonationInfo === null && scanResult.legitimate && scanResult.riskScore === 0 && (
                            <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                              <div style={{ color: dark.green, fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>✅ Verified Brand Domain</div>
                              <div style={{ color: dark.textMuted, fontSize: '12px' }}>This is your registered brand domain — no impersonation detected.</div>
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                              <div style={{ fontSize: '12px', color: dark.textMuted }}>Risk Score</div>
                              <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: (scanResult.risk_score ?? scanResult.overall_risk ?? 0) >= 7 ? dark.red : (scanResult.risk_score ?? scanResult.overall_risk ?? 0) >= 4 ? '#f59e0b' : dark.green }}>
                                {String(scanResult.risk_score ?? scanResult.overall_risk ?? '?')}/10
                              </div>
                            </div>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                              <div style={{ fontSize: '12px', color: dark.textMuted }}>Verdict</div>
                              <div style={{ fontSize: isMobile ? '14px' : '18px', fontWeight: 800, color: (scanResult.is_scam ?? scanResult.legitimate === false) ? dark.red : dark.green }}>
                                {String(scanResult.is_scam ? 'SCAM' : scanResult.legitimate === false ? 'SUSPICIOUS' : scanResult.legitimate === true ? 'LEGITIMATE' : scanResult.verdict ?? 'UNKNOWN')}
                              </div>
                            </div>
                          </div>
                          {Array.isArray(scanResult.red_flags) && scanResult.red_flags.length > 0 && (
                            <div style={{ display: 'grid', gap: '8px' }}>
                              {scanResult.red_flags.slice(0, 5).map((f: Record<string, unknown>, i: number) => (
                                <div key={i} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>{String(f.type || f.flag || 'Red Flag')}</div>
                                  <div style={{ color: dark.textMuted, fontSize: '11px', marginTop: '2px' }}>{String(f.description || f.detail || '')}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {/* Threat correlate results */}
                      {scanType === 'threat' && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                              <div style={{ fontSize: '12px', color: dark.textMuted }}>Aggregate Risk</div>
                              <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: (scanResult.aggregate_risk_score ?? 0) >= 7 ? dark.red : dark.accent }}>
                                {String(scanResult.aggregate_risk_score ?? scanResult.risk_score ?? '?')}/10
                              </div>
                            </div>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                              <div style={{ fontSize: '12px', color: dark.textMuted }}>Channels Analyzed</div>
                              <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: dark.accent }}>
                                {String(scanResult.channels_analyzed ?? scanResult.platforms?.length ?? '?')}
                              </div>
                            </div>
                          </div>
                          {Array.isArray(scanResult.threat_indicators) && scanResult.threat_indicators.length > 0 && (
                            <div style={{ display: 'grid', gap: '8px' }}>
                              {scanResult.threat_indicators.slice(0, 5).map((t: Record<string, unknown>, i: number) => (
                                <div key={i} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>{String(t.type || t.indicator || 'Threat')}</div>
                                  <div style={{ color: dark.textMuted, fontSize: '11px', marginTop: '2px' }}>{String(t.description || t.detail || '')}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {/* Vendor verify results */}
                      {scanType === 'vendor' && (
                        <>
                          {(() => {
                            const vv = scanResult.vendor_verification as Record<string, unknown> | undefined;
                            const ba = scanResult.business_assessment as Record<string, unknown> | undefined;
                            const sd = scanResult.scam_detection as Record<string, unknown> | undefined;
                            const pr = scanResult.phone_risk as Record<string, unknown> | undefined;
                            const vLevel = (vv?.level as string) || (scanResult.verification_level as string) || 'UNKNOWN';
                            const vScore = (vv?.score as number) ?? (scanResult.verification_score as number) ?? 0;
                            const vMessage = (vv?.message as string) || '';
                            const bScore = (ba?.legitimacy_score as number) ?? (scanResult.legitimacy_score as number) ?? 0;
                            const bLevel = (ba?.legitimacy_level as string) || '';
                            const bIndicators = (ba?.business_indicators as string[]) || [];
                            const sIndicators = (ba?.suspicious_indicators as string[]) || [];
                            const patterns = (sd?.patterns_detected as Record<string, unknown>[]) || (scanResult.scam_patterns as Record<string, unknown>[]) || [];
                            const phoneCarrier = (pr?.carrier as string) || 'Unknown';
                            const phoneLineType = (pr?.line_type as string) || 'unknown';
                            return (
                              <>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                                    <div style={{ fontSize: '12px', color: dark.textMuted }}>Verification</div>
                                    <div style={{ fontSize: isMobile ? '14px' : '18px', fontWeight: 800, color: (vLevel === 'LIKELY_FRAUDULENT' || vLevel === 'SUSPICIOUS') ? dark.red : vLevel === 'VERIFIED' ? dark.green : '#f59e0b' }}>
                                      {vLevel}
                                    </div>
                                  </div>
                                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                                    <div style={{ fontSize: '12px', color: dark.textMuted }}>Risk Score</div>
                                    <div style={{ fontSize: isMobile ? '14px' : '18px', fontWeight: 800, color: vScore < 50 ? dark.red : vScore < 70 ? '#f59e0b' : dark.green }}>
                                      {vScore}/100
                                    </div>
                                  </div>
                                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                                    <div style={{ fontSize: '12px', color: dark.textMuted }}>Legitimacy</div>
                                    <div style={{ fontSize: isMobile ? '14px' : '18px', fontWeight: 800, color: bScore < 40 ? dark.red : bScore < 60 ? '#f59e0b' : dark.green }}>
                                      {bScore}/100 {bLevel && `(${bLevel})`}
                                    </div>
                                  </div>
                                </div>
                                {vMessage && (
                                  <div style={{ padding: '12px', borderRadius: '8px', background: vLevel === 'LIKELY_FRAUDULENT' || vLevel === 'SUSPICIOUS' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${vLevel === 'LIKELY_FRAUDULENT' || vLevel === 'SUSPICIOUS' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, marginBottom: '12px' }}>
                                    <div style={{ fontSize: '13px', color: vLevel === 'LIKELY_FRAUDULENT' || vLevel === 'SUSPICIOUS' ? dark.red : dark.green, fontWeight: 600 }}>{vMessage}</div>
                                  </div>
                                )}
                                {(patterns.length > 0 || sIndicators.length > 0) && (
                                  <div style={{ marginBottom: '12px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: dark.red, marginBottom: '8px' }}>⚠️ Red Flags</div>
                                    <div style={{ display: 'grid', gap: '6px' }}>
                                      {patterns.map((p: Record<string, unknown>, i: number) => (
                                        <div key={i} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{String(p.type || p.pattern || 'Scam Pattern')}</div>
                                          <div style={{ fontSize: '11px', color: dark.textMuted }}>{String(p.description || p.detail || '')}</div>
                                        </div>
                                      ))}
                                      {sIndicators.map((s: string, i: number) => (
                                        <div key={`s-${i}`} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                          <div style={{ fontSize: '12px', color: '#f59e0b' }}>⚠️ {s}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {bIndicators.length > 0 && (
                                  <div style={{ marginBottom: '12px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: dark.green, marginBottom: '8px' }}>✅ Positive Indicators</div>
                                    <div style={{ display: 'grid', gap: '4px' }}>
                                      {bIndicators.map((b: string, i: number) => (
                                        <div key={i} style={{ fontSize: '12px', color: dark.green }}>• {b}</div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)' }}>
                                    <div style={{ fontSize: '11px', color: dark.textMuted }}>Carrier</div>
                                    <div style={{ fontSize: '13px', color: '#fff' }}>{phoneCarrier}</div>
                                  </div>
                                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)' }}>
                                    <div style={{ fontSize: '11px', color: dark.textMuted }}>Line Type</div>
                                    <div style={{ fontSize: '13px', color: '#fff' }}>{phoneLineType}</div>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </>
                      )}

                      {/* Email Spoof Check Results */}
                      {scanType === 'email' && (() => {
                        const es = scanResult.email_security as Record<string, unknown> | undefined;
                        if (!es) return null;
                        const spf = es.spf as Record<string, unknown> | null;
                        const dmarc = es.dmarc as Record<string, unknown> | null;
                        const dkim = es.dkim as Record<string, unknown> | null;
                        const newThreats = (Array.isArray(scanResult.new_domain_threats) ? scanResult.new_domain_threats : []) as Record<string, unknown>[];
                        const recs = (Array.isArray(scanResult.recommendations) ? scanResult.recommendations : []) as string[];
                        const overallScore = (es.overall_score as number) ?? 0;
                        const vulLevel = (es.vulnerability_level as string) || 'UNKNOWN';
                        const isSpoofable = es.spoofable === true;
                        const spoofMethods = (Array.isArray(es.spoof_methods) ? es.spoof_methods : []) as string[];
                        const scoreColor = overallScore >= 80 ? dark.green : overallScore >= 60 ? '#f59e0b' : overallScore >= 40 ? '#f97316' : dark.red;
                        const levelColor = vulLevel === 'PROTECTED' ? dark.green : vulLevel === 'LOW' ? '#f59e0b' : vulLevel === 'MEDIUM' ? '#f97316' : dark.red;
                        return (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                                <div style={{ fontSize: '12px', color: dark.textMuted }}>Security Score</div>
                                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 800, color: scoreColor }}>{overallScore}/100</div>
                              </div>
                              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                                <div style={{ fontSize: '12px', color: dark.textMuted }}>Vulnerability</div>
                                <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 800, color: levelColor }}>{vulLevel}</div>
                              </div>
                              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                                <div style={{ fontSize: '12px', color: dark.textMuted }}>Spoofable?</div>
                                <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 800, color: isSpoofable ? dark.red : dark.green }}>
                                  {isSpoofable ? '🚨 YES' : '✅ NO'}
                                </div>
                              </div>
                            </div>
                            {isSpoofable && spoofMethods.length > 0 && (
                              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: '12px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: dark.red, marginBottom: '6px' }}>🚨 This Domain Is Spoofable</div>
                                {spoofMethods.map((m: string, i: number) => (
                                  <div key={i} style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '2px' }}>• {m}</div>
                                ))}
                              </div>
                            )}
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${dark.border}`, marginBottom: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>📧 SPF Record</div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: spf ? (spf.isStrict ? dark.green : spf.isPassAll ? dark.red : '#f59e0b') : dark.red }}>
                                  {spf ? (spf.isStrict ? '✅ Strict (-all)' : spf.isSoftFail ? '⚠️ Soft (~all)' : spf.isPassAll ? '🚨 Open (+all)' : '? Neutral') : '❌ Missing'}
                                </div>
                              </div>
                              {spf && Boolean(spf.raw) && (
                                <div style={{ fontSize: '11px', color: dark.textMuted, wordBreak: 'break-all' }}>{String(spf.raw)}</div>
                              )}
                              {spf && Array.isArray(spf.issues) && (spf.issues as string[]).length > 0 && (
                                <div style={{ marginTop: '4px' }}>
                                  {(spf.issues as string[]).map((issue: string, i: number) => (
                                    <div key={i} style={{ fontSize: '11px', color: '#fca5a5' }}>⚠️ {issue}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${dark.border}`, marginBottom: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>🔒 DMARC Policy</div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: dmarc ? (dmarc.isEnforced ? dark.green : dmarc.policy === 'none' ? dark.red : '#f59e0b') : dark.red }}>
                                  {dmarc ? (dmarc.policy === 'reject' ? '✅ Reject' : dmarc.policy === 'quarantine' ? '⚠️ Quarantine' : dmarc.policy === 'none' ? '🚨 None' : '? Unknown') : '❌ Missing'}
                                </div>
                              </div>
                              {dmarc && Boolean(dmarc.raw) && (
                                <div style={{ fontSize: '11px', color: dark.textMuted, wordBreak: 'break-all' }}>{String(dmarc.raw)}</div>
                              )}
                              {dmarc && Array.isArray(dmarc.issues) && (dmarc.issues as string[]).length > 0 && (
                                <div style={{ marginTop: '4px' }}>
                                  {(dmarc.issues as string[]).map((issue: string, i: number) => (
                                    <div key={i} style={{ fontSize: '11px', color: '#fca5a5' }}>⚠️ {issue}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${dark.border}`, marginBottom: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>🔑 DKIM Record</div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: dkim && dkim.found ? dark.green : '#f59e0b' }}>
                                  {dkim && dkim.found ? `✅ Found (${(dkim.selectors as string[]).length})` : '⚠️ Not Found'}
                                </div>
                              </div>
                              {dkim && Array.isArray(dkim.issues) && (dkim.issues as string[]).length > 0 && (
                                <div style={{ marginTop: '4px' }}>
                                  {(dkim.issues as string[]).map((issue: string, i: number) => (
                                    <div key={i} style={{ fontSize: '11px', color: '#f59e0b' }}>⚠️ {issue}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {newThreats.length > 0 && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: dark.red, marginBottom: '8px' }}>🔍 {String(newThreats.length)} Lookalike Domain{newThreats.length > 1 ? 's' : ''} Found</div>
                                <div style={{ display: 'grid', gap: '6px' }}>
                                  {newThreats.slice(0, 10).map((t: Record<string, unknown>, i: number) => {
                                    const riskLevel = (t.riskLevel || t.risk_level || 'LOW') as string;
                                    const riskColor = riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? dark.red : riskLevel === 'MEDIUM' ? '#f59e0b' : dark.textMuted;
                                    return (
                                      <div key={i} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{String(t.domain || 'unknown')}</div>
                                          <div style={{ fontSize: '11px', fontWeight: 600, color: riskColor, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)' }}>{riskLevel}</div>
                                        </div>
                                        <div style={{ fontSize: '11px', color: dark.textMuted, marginTop: '2px' }}>
                                          {String(t.variantType || '')} • {String(Math.round((t.similarity as number || 0) * 100))}% similar
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {recs.length > 0 && (
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>📋 Recommendations</div>
                                <div style={{ display: 'grid', gap: '4px' }}>
                                  {recs.map((r: string, i: number) => (
                                    <div key={i} style={{ fontSize: '12px', color: dark.textMuted }}>{r}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Takedown Report button for medium/high/critical risk results */}
                      {scanResult && (scanResult.risk_level === 'HIGH' || scanResult.risk_level === 'CRITICAL' || scanResult.risk_level === 'MEDIUM' || scanResult.risk_score >= 4) && (
                        <>
                          <button
                            onClick={() => setShowTakedown(true)}
                            style={{
                              marginTop: '12px',
                              width: '100%',
                              padding: '8px 16px',
                              background: 'rgba(239,68,68,0.2)',
                              border: '1px solid rgba(239,68,68,0.5)',
                              borderRadius: '8px',
                              color: '#ef4444',
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontSize: '14px',
                              transition: 'all 0.2s',
                            }}
                          >
                            📋 Generate Takedown Report
                          </button>
                          <TakedownModal
                            isOpen={showTakedown}
                            onClose={() => setShowTakedown(false)}
                            scanId={activeBrand?.id || ''}
                            scanType={scanType}
                            riskScore={scanResult.aggregate_risk_score ?? scanResult.risk_score ?? 0}
                            riskLevel={String(scanResult.risk_level ?? 'LOW')}
                            evidence={{
                              urls: Array.isArray(scanResult.variants) ? scanResult.variants.map((v: any) => v.domain || v.url || '').filter(Boolean) : [],
                              descriptions: String(scanResult.risk_level ?? '')
                            }}
                            brand={{
                              name: activeBrand?.brand_name || '',
                              website: activeBrand?.brand_domain || ''
                            }}
                            violator={{
                              platform: scanType,
                              url: Array.isArray(scanResult.variants) && scanResult.variants[0]?.domain ? String(scanResult.variants[0].domain) : '',
                              name: Array.isArray(scanResult.variants) && scanResult.variants[0]?.domain ? String(scanResult.variants[0].domain) : ''
                            }}
                            user={{
                              id: userId || '',
                              email: '',
                              companyName: activeBrand?.brand_name || ''
                            }}
                            authToken={authToken || ''}
                            brandMonitorId={activeBrand?.id}
                          />
                        </>
                      )}

                      {/* Standalone Takedown Modal (from Takedowns tab) */}
                      {takedownStandalone && activeBrand && (
                        <TakedownModal
                          isOpen={takedownStandalone}
                          onClose={() => setTakedownStandalone(false)}
                          scanId={activeBrand.id}
                          scanType="impersonator"
                          riskScore={0}
                          riskLevel="medium"
                          evidence={{ urls: [], descriptions: '' }}
                          brand={{
                            name: activeBrand.brand_name,
                            website: activeBrand.brand_domain || ''
                          }}
                          violator={{
                            platform: '',
                            url: '',
                          }}
                          user={{
                            id: userId || '',
                            email: '',
                            companyName: activeBrand.brand_name
                          }}
                          authToken={authToken || ''}
                          brandMonitorId={activeBrand.id}
                          standalone={true}
                        />
                      )}

                      <div style={{ marginTop: '16px', fontSize: '11px', color: dark.textMuted, textAlign: 'center' }}>
                        Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR. Scan date: {new Date().toLocaleDateString()}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: dark.textMuted, textAlign: 'center' }}>No results yet</div>
                  )}
                </div>
              ) : (
                <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '16px', padding: isMobile ? '24px 16px' : '48px 24px', backdropFilter: 'blur(12px)', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
                  <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Run Your First Scan</h3>
                  <p style={{ color: dark.textMuted, fontSize: '14px' }}>
                    Choose a scan type to protect your brand across {activeBrand.platforms.length} platform{activeBrand.platforms.length > 1 ? 's' : ''}.
                  </p>
                </div>
              )}

              {/* Quick stats */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '12px', padding: isMobile ? '10px' : '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: dark.accent }}>{activeBrand.platforms.length}</div>
                  <div style={{ fontSize: '12px', color: dark.textMuted }}>Platforms</div>
                </div>
                <div
                  style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '12px', padding: isMobile ? '10px' : '16px', textAlign: 'center', cursor: totalRemaining <= 5 ? 'pointer' : 'default' }}
                  onClick={() => { if (totalRemaining <= 5) setShowPurchase(true); }}
                >
                  <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: totalRemaining === 0 ? dark.red : totalRemaining <= 5 ? '#f59e0b' : dark.green }}>{totalRemaining >= 1000000 ? `${(totalRemaining / 1000000).toFixed(1)}M` : totalRemaining >= 1000 ? `${(totalRemaining / 1000).toFixed(1)}K` : totalRemaining}</div>
                  <div style={{ fontSize: '12px', color: dark.textMuted }}>Scans Left</div>
                  {totalRemaining <= 5 && !creditsLoading && (
                    <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '4px', fontWeight: 600 }}>{totalRemaining === 0 ? 'Buy Credits →' : '+ Add more'}</div>
                  )}
                </div>
                <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '12px', padding: isMobile ? '10px' : '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: '#fff' }}>{brands.length}</div>
                  <div style={{ fontSize: '12px', color: dark.textMuted }}>Brand{brands.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: isMobile ? '24px' : '48px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
            <h2 style={{ color: '#fff', fontSize: '24px', marginBottom: '8px' }}>Loading brand data...</h2>
          </div>
        )}

        {/* Credit Balance Details Panel */}
        <div style={{
          display: dashboardTab === 'monitoring' ? 'none' : 'block',
          background: dark.cardBg,
          border: `1px solid ${dark.border}`,
          borderRadius: '16px',
          padding: isMobile ? '16px' : '24px',
          marginTop: '24px',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, margin: 0 }}>🔐 Credit Balance</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              {isFreeAccount && (
                <button
                  onClick={openPilotRequest}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.4)',
                    color: '#86efac', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <Rocket size={14} aria-hidden="true" />
                  Request 30-Day Pilot
                </button>
              )}
              <button
                onClick={() => setShowPurchase(true)}
                style={{
                  padding: '6px 14px', borderRadius: '8px',
                  background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)',
                  color: '#60a5fa', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >+ Buy Credits</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: dark.green }}>{creditsLoading ? '...' : freeRemaining}</div>
              <div style={{ fontSize: '11px', color: dark.textMuted }}>Free Scans</div>
            </div>
            <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#a78bfa' }}>{creditsLoading ? '...' : paidCredits}</div>
              <div style={{ fontSize: '11px', color: dark.textMuted }}>Paid Credits</div>
            </div>
            <div style={{ background: totalRemaining === 0 ? 'rgba(239,68,68,0.1)' : totalRemaining <= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', border: totalRemaining === 0 ? '1px solid rgba(239,68,68,0.3)' : totalRemaining <= 5 ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: totalRemaining === 0 ? dark.red : totalRemaining <= 5 ? '#f59e0b' : dark.green }}>{creditsLoading ? '...' : totalRemaining}</div>
              <div style={{ fontSize: '11px', color: dark.textMuted }}>Total Remaining</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${dark.border}`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{creditsLoading ? '...' : credits?.free_used ?? 0}</div>
              <div style={{ fontSize: '11px', color: dark.textMuted }}>Scans Used</div>
            </div>
          </div>
          {totalRemaining === 0 && !creditsLoading && (
            <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: dark.red, marginBottom: '8px' }}>🔒 Out of credits</div>
              <button
                onClick={() => setShowPurchase(true)}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                💎 Buy Credits — $1/scan
              </button>
            </div>
          )}
          {totalRemaining > 0 && totalRemaining <= 5 && !creditsLoading && (
            <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', textAlign: 'center' }}>
              <span style={{ fontSize: '13px', color: '#f59e0b' }}>⚠️ Running low on credits — </span>
              <span style={{ fontSize: '13px', color: '#3b82f6', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowPurchase(true)}>Buy more →</span>
            </div>
          )}
        </div>
      </div>

      {/* Credit Purchase Modal */}
      {showPurchase && (
        <CreditPurchaseModal
          authToken={authToken}
          onClose={() => setShowPurchase(false)}
          onSuccess={() => { setShowPurchase(false); fetchCredits(); }}
        />
      )}
      {/* Pilot request dialog for signed-in free accounts */}
      {showPilotRequestForm && authToken && isFreeAccount && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pilot-request-title"
          style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: isMobile ? '12px' : '24px' }}
          onClick={e => e.target === e.currentTarget && setShowPilotRequestForm(false)}
        >
          <div style={{ position: 'relative', width: '100%', maxWidth: '620px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', background: '#151522', border: '1px solid rgba(34,197,94,0.35)', borderRadius: '12px', padding: isMobile ? '20px 16px' : '28px' }}>
            <button
              type="button"
              aria-label="Close pilot request"
              title="Close"
              onClick={() => setShowPilotRequestForm(false)}
              style={{ position: 'absolute', top: '14px', right: '14px', width: '32px', height: '32px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${dark.border}`, borderRadius: '8px', color: dark.textMuted, cursor: 'pointer' }}
            >
              <X size={17} aria-hidden="true" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '40px', marginBottom: '6px' }}>
              <Rocket size={22} color="#4ade80" aria-hidden="true" />
              <h2 id="pilot-request-title" style={{ margin: 0, color: '#fff', fontSize: '20px' }}>Request a 30-Day Pilot</h2>
            </div>
            <p style={{ margin: '0 0 20px', color: dark.textMuted, fontSize: '13px', lineHeight: 1.5 }}>
              Tell us what impersonation risk you need to monitor. Approved pilots receive 30 days of Fortress access.
            </p>

            {pilotRequestSubmitted ? (
              <div style={{ padding: '18px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)', color: '#86efac', fontSize: '14px', lineHeight: 1.5 }}>
                {pilotRequestMessage}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                  <input type="email" value={userEmail} readOnly placeholder="Work email" aria-label="Work email" style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(255,255,255,0.04)', color: dark.textMuted, boxSizing: 'border-box', cursor: 'not-allowed' }} />
                  <input type="text" value={pilotRequestForm.company_name} onChange={e => setPilotRequestForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Company" aria-label="Company" style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.35)', color: '#fff', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                  <input type="text" value={pilotRequestForm.brand_name} onChange={e => setPilotRequestForm(f => ({ ...f, brand_name: e.target.value }))} placeholder="Brand name" aria-label="Brand name" style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.35)', color: '#fff', boxSizing: 'border-box' }} />
                  <input type="text" value={pilotRequestForm.website} onChange={e => setPilotRequestForm(f => ({ ...f, website: e.target.value }))} placeholder="Website" aria-label="Website" style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.35)', color: '#fff', boxSizing: 'border-box' }} />
                </div>
                <select value={pilotRequestForm.concern} onChange={e => setPilotRequestForm(f => ({ ...f, concern: e.target.value }))} aria-label="Primary impersonation concern" style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: '#101019', color: '#fff', boxSizing: 'border-box' }}>
                  {PILOT_CONCERNS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <textarea value={pilotRequestForm.notes} onChange={e => setPilotRequestForm(f => ({ ...f, notes: e.target.value }))} placeholder="Describe the impersonation activity or monitoring need" aria-label="Pilot request details" rows={4} style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.35)', color: '#fff', boxSizing: 'border-box', resize: 'vertical' }} />
                {pilotRequestMessage && <div style={{ color: dark.red, fontSize: '13px' }}>{pilotRequestMessage}</div>}
                <button
                  type="button"
                  onClick={handlePilotRequestSubmit}
                  disabled={pilotRequestLoading}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: 'none', background: pilotRequestLoading ? 'rgba(34,197,94,0.3)' : '#16a34a', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: pilotRequestLoading ? 'wait' : 'pointer' }}
                >
                  {pilotRequestLoading ? 'Submitting...' : 'Submit Pilot Request'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Subscription Plans Modal */}
      {showPlansModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: isMobile ? '12px' : '24px' }}
          onClick={(e) => e.target === e.currentTarget && setShowPlansModal(false)}
        >
          <div style={{ maxWidth: isMobile ? '100%' : '800px', width: '100%', background: '#1a1a2e', borderRadius: '16px', padding: isMobile ? '20px' : '32px', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowPlansModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>💎</div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0 }}>Select Your Plan</h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Choose the perfect plan for your brand protection needs</p>
            </div>

            <SubscriptionPlans
              currentPlanId={subscription?.plan_id || 'free'}
              onSelectPlan={async (planId) => {
                await startSubscriptionCheckout(planId);
              }}
            />
          </div>
        </div>
      )}
      {/* Subscription Manager Modal */}
      {showSubscriptionManager && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: isMobile ? '12px' : '24px' }}
          onClick={(e) => e.target === e.currentTarget && setShowSubscriptionManager(false)}
        >
          <div style={{ maxWidth: isMobile ? '100%' : '700px', width: '100%', background: '#1a1a2e', borderRadius: '16px', padding: isMobile ? '20px' : '32px', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowSubscriptionManager(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>⚙️</div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0 }}>Subscription Management</h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Manage your current plan and billing settings</p>
            </div>

            <SubscriptionManager
              subscription={subscription}
              onManageBilling={handleManageBilling}
              onChangePlan={() => {
                setShowSubscriptionManager(false);
                setShowPlansModal(true);
              }}
              onCancelSubscription={handleCancelSubscription}
              loading={subscriptionLoading}
            />
          </div>
        </div>
      )}
      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '16px 12px', borderTop: `1px solid ${dark.border}`, background: 'rgba(10,10,15,0.6)', color: dark.textMuted, fontSize: '13px' }}>
        <p style={{ margin: 0 }}>
          Hybrid AI brand trust intelligence •{' '}
          <a href="https://twitter.com/AgenticBro11" target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6', textDecoration: 'none' }}>@AgenticBro11</a>
          {' '}•{' '}
          <a href="https://t.me/Agenticbro1" target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4', textDecoration: 'none' }}>Telegram</a>
          {' '}•{' '}
          <ContactUs />
        </p>
      </footer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// Credit Purchase Modal
// ════════════════════════════════════════════════════════════════════════════════

function CreditPurchaseModal({ authToken, onClose, onSuccess }: { authToken: string | null; onClose: () => void; onSuccess: () => void }) {
  const isMobile = useIsMobile();
  const [selectedPkg, setSelectedPkg] = useState('bg-pro');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);

  // Fetch packages from API
  useEffect(() => {
    fetch(`${API_BASE}/credits/packages`)
      .then(r => r.json())
      .then(d => { if (d.success && d.packages) setPackages(d.packages); })
      .catch(() => {});
  }, []);

  const pkgs = packages.length > 0 ? packages : [
    { id: 'bg-starter', name: 'Starter', credits: 5, price_usd: 5, bonus: 0 },
    { id: 'bg-basic', name: 'Basic', credits: 10, price_usd: 10, bonus: 0 },
    { id: 'bg-pro', name: 'Pro', credits: 25, price_usd: 25, bonus: 0, popular: true },
    { id: 'bg-whale', name: 'Whale', credits: 100, price_usd: 100, bonus: 10 },
  ];

  const pkg = pkgs.find(p => p.id === selectedPkg) || pkgs[2];
  const totalCredits = pkg.credits + (pkg.bonus || 0);

  const handlePurchase = async () => {
    if (!authToken) { setError('Please sign in to purchase credits'); return; }
    setLoading(true);
    setError(null);
    try {
      if (paymentMethod === 'stripe') {
        const res = await fetch(`${API_BASE}/credits/stripe-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ package_id: selectedPkg }),
        });
        const data = await res.json();
        if (data.checkout_url) { window.location.href = data.checkout_url; return; }
        throw new Error(data.error || 'Failed to create checkout session');
      } else {
        // Crypto payment
        const walletAddr = paymentMethod === 'usdc-solana' ? PAYMENT_WALLETS.solana
          : paymentMethod === 'usdc-base' ? PAYMENT_WALLETS.base
          : PAYMENT_WALLETS.solana; // AGNTCBRO on Solana

        const label = paymentMethod === 'usdc-solana' ? `${pkg.price_usd} USDC (Solana)`
          : paymentMethod === 'usdc-base' ? `${pkg.price_usd} USDC (Base)`
          : `AGNTCBRO tokens`;

        alert(`Send ${label} to:\n\n${walletAddr}\n\nThen paste the transaction signature to confirm.`);
        const txSignature = prompt('Paste your transaction signature:');
        if (!txSignature) { setLoading(false); return; }

        const res = await fetch(`${API_BASE}/credits/crypto-confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ payment_method: paymentMethod, tx_signature: txSignature, package_id: selectedPkg }),
        });
        const data = await res.json();
        if (data.success) { onSuccess(); return; }
        throw new Error(data.error || 'Payment confirmation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: isMobile ? '12px' : '24px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ maxWidth: isMobile ? '100%' : '560px', width: '100%', background: '#1a1a2e', borderRadius: '16px', padding: isMobile ? '20px' : '32px', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>💎</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0 }}>Buy Brand Guard Credits</h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>1 scan = $1 USD — Credits never expire</p>
        </div>

        {/* Package selection */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
          {pkgs.map(p => (
            <div key={p.id} onClick={() => setSelectedPkg(p.id)} style={{
              padding: '14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
              border: `2px solid ${selectedPkg === p.id ? '#8b5cf6' : 'rgba(139,92,246,0.2)'}`,
              background: selectedPkg === p.id ? 'rgba(139,92,246,0.2)' : 'rgba(0,0,0,0.3)',
            }}>
              {p.popular && <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600 }}>★ POPULAR</div>}
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff' }}>{p.credits + (p.bonus || 0)}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{p.bonus ? `${p.credits} + ${p.bonus} bonus` : 'scans'}</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>${p.price_usd}</div>
            </div>
          ))}
        </div>

        {/* Payment method */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)', gap: '8px', marginBottom: '20px' }}>
          {[
            { id: 'stripe' as PaymentMethod, icon: '💳', label: 'Card', sublabel: 'USD', color: '#10b981' },
            { id: 'usdc-solana' as PaymentMethod, icon: '◎', label: 'USDC', sublabel: 'Solana', color: '#8b5cf6' },
            { id: 'usdc-base' as PaymentMethod, icon: '🔷', label: 'USDC', sublabel: 'Base', color: '#3b82f6' },
            { id: 'agntcbro' as PaymentMethod, icon: '🦞', label: 'AGNTCBRO', sublabel: 'Token', color: '#f59e0b' },
          ].map(m => (
            <div key={m.id} onClick={() => setPaymentMethod(m.id)} style={{
              padding: '12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
              border: `2px solid ${paymentMethod === m.id ? m.color : 'rgba(139,92,246,0.2)'}`,
              background: paymentMethod === m.id ? `${m.color}20` : 'rgba(0,0,0,0.3)',
            }}>
              <div style={{ fontSize: '20px' }}>{m.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{m.label}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{m.sublabel}</div>
            </div>
          ))}
        </div>

        {error && <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '13px', marginBottom: '12px', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>}

        <button onClick={handlePurchase} disabled={loading} style={{
          width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
          fontSize: '16px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
          background: `linear-gradient(135deg, #8b5cf6, #6d28d9)`, color: '#fff',
        }}>
          {loading ? 'Processing...' : `Pay $${pkg.price_usd} — ${totalCredits} scans`}
        </button>
      </div>
    </div>
  );
}

export default BrandGuardPage;
