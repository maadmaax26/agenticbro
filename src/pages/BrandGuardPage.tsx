/**
 * BrandGuardPage.tsx — Full Brand Guard Dashboard
 * 
 * Route: /brand-guard
 * Handles onboarding, dashboard, and credit management for brand impersonation detection.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, signUpWithEmail, signInWithEmail } from '../lib/supabase';

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // Auth
  const [authToken, setAuthToken] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login form state
  const [loginMode, setLoginMode] = useState<'login' | 'register' | 'reset' | 'update-password'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');

  // Brand state
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(true); void brandsLoading;
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [showPurchase, setShowPurchase] = useState(false);

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
  const paymentSuccess = searchParams.get('payment') === 'success';
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data } = await supabase!.auth.getSession();
        if (data?.session?.access_token) {
          setAuthToken(data.session.access_token);
          setUserId(data.session.user.id);
        }
      } catch { /* not authenticated */ }
      setAuthLoading(false);
    }
    checkAuth();

    // Listen for auth state changes (email confirmation, sign in, sign out)
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.access_token) {
          setAuthToken(session.access_token);
          setUserId(session.user.id);
        } else {
          setAuthToken(null);
          setUserId(null);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // ── Handle email login/register ───────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      if (loginMode === 'register') {
        const result = await signUpWithEmail(loginEmail, loginPassword);
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
                const { data } = await supabase!.auth.getSession();
                if (data?.session?.access_token) {
                  setAuthToken(data.session.access_token);
                  setUserId(data.session.user.id);
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
          const { data } = await supabase!.auth.getSession();
          if (data?.session?.access_token) {
            setAuthToken(data.session.access_token);
            setUserId(data.session.user.id);
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
          const { data } = await supabase!.auth.getSession();
          if (data?.session?.access_token) {
            setAuthToken(data.session.access_token);
            setUserId(data.session.user.id);
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
                const { user: retryUser, error: retryErr } = await signInWithEmail(loginEmail, loginPassword);
                if (retryUser) {
                  const { data } = await supabase!.auth.getSession();
                  if (data?.session?.access_token) {
                    setAuthToken(data.session.access_token);
                    setUserId(data.session.user.id);
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
      const { error } = await supabase!.auth.resend({ type: 'signup', email: loginEmail });
      if (error) throw error;
      setLoginError('Confirmation email sent! Check your inbox and spam folder.');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Password Reset ────────────────────────────────────────────────────────
  const [resetSent, setResetSent] = useState(false);

  const handleResetPassword = async () => {
    if (!loginEmail) { setLoginError('Enter your email address'); return; }
    setLoginLoading(true);
    setLoginError(null);
    setResetSent(false);
    try {
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
  useEffect(() => {
    if (!supabase) return;
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      // User clicked the reset link — switch to password update mode
      setLoginMode('update-password');
    }
  }, []);

  const [newPassword, setNewPassword] = useState('');

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) { setLoginError('Password must be at least 6 characters'); return; }
    setLoginLoading(true);
    setLoginError(null);
    try {
      const { error } = await supabase!.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setLoginError(null);
      setLoginMode('login');
      setLoginPassword('');
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

  // ── Run scans ────────────────────────────────────────────────────────────────
  const [scanning, setScanning] = useState<string | null>(null); // scan type being run
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanType, setScanType] = useState<string>('impersonator');

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
        };
      } else if (type === 'threat') {
        endpoint = `${API_BASE}/threat-correlate`;
        body = {
          brand_name: activeBrand.brand_name,
          brand_handle: activeBrand.brand_handle,
          brand_domain: activeBrand.brand_domain || '',
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
        body: JSON.stringify({ phone: vendorPhone, country: vendorCountry, vendor_name: activeBrand.brand_name }),
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
        body: JSON.stringify({ url: websiteUrl }),
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

  if (!authToken) {
    return (
      <div style={{ minHeight: '100vh', background: dark.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '420px', width: '100%', padding: isMobile ? '16px' : '32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔐</div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>Brand Guard</h1>
            <p style={{ color: dark.textMuted, fontSize: '15px' }}>
              AI-powered brand impersonation detection across X, Instagram, TikTok, Facebook, Telegram & LinkedIn
n            </p>
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
            {loginMode === 'update-password' && (
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>🔑 Update Password</h2>
                <p style={{ color: dark.textMuted, fontSize: '13px' }}>Choose a new password for your account.</p>
              </div>
            )}

            {(loginMode === 'login' || loginMode === 'register') && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center', marginBottom: '20px' }}>
              <span style={{ color: dark.green, fontWeight: 600, fontSize: '14px' }}>🎁 10 free scans included with sign-up</span>
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

            {/* Update Password form (after clicking reset link) */}
            {loginMode === 'update-password' && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center', marginBottom: '16px' }}>
                  <span style={{ color: dark.accent, fontWeight: 600, fontSize: '14px' }}>🔑 Set your new password</span>
                </div>
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

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
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
                Confirm your brand monitoring setup. {promoCode.trim().toLowerCase() === 'beta2026' ? 'As a beta tester, you\'ll get 500 free scans!' : 'You\'ll get 10 free scans to start.'}
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
                <div style={{ color: dark.green, fontWeight: 700 }}>{promoCode.trim().toLowerCase() === 'beta2026' ? '500 free scans (Beta Tester)' : '10 free scans included'}</div>
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
  const totalRemaining = credits?.total_remaining ?? 10;
  const freeRemaining = credits?.free_remaining ?? 10;
  const paidCredits = credits?.paid_credits ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: dark.bg, overflowX: 'hidden' }}>
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
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '8px',
            background: totalRemaining > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${totalRemaining > 0 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          }}>
            <span style={{ fontSize: '14px' }}>{totalRemaining > 0 ? '✅' : '🚫'}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: totalRemaining > 0 ? dark.green : dark.red }}>
              {creditsLoading ? '...' : totalRemaining} scans
            </span>
            {freeRemaining > 0 && (
              <span style={{ fontSize: '11px', color: dark.textMuted }}>({freeRemaining} free + {paidCredits} paid)</span>
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
        </div>
      </div>

      {/* Payment success banner */}
      {paymentSuccess && (
        <div style={{
          margin: '16px auto', maxWidth: '800px', padding: '16px', borderRadius: '12px',
          background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
          textAlign: 'center', color: dark.green,
        }}>
          ✅ Payment successful! Credits have been added to your account.
        </div>
      )}

      {/* Dashboard content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '12px' : '24px' }}>
        {activeBrand ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '24px' }}>
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

              {/* Scan buttons */}
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  { type: 'impersonator', icon: '🔍', label: 'Impersonator Scan', desc: 'Find fake accounts mimicking your brand' },
                  { type: 'domain', icon: '🌐', label: 'Domain Monitor', desc: 'Detect lookalike domains & phishing sites' },
                  { type: 'website', icon: '🖥️', label: 'Website Scan', desc: 'Scan any URL for scam indicators' },
                  { type: 'threat', icon: '⚡', label: 'Threat Correlate', desc: 'Cross-channel risk correlation' },
                  { type: 'vendor', icon: '📞', label: 'Vendor Verify', desc: 'Check phone numbers for vendor fraud' },
                ].map(scan => (
                  <button
                    key={scan.type}
                    onClick={() => scan.type === 'vendor' ? setShowVendorInput(true) : scan.type === 'website' ? setShowWebsiteInput(true) : handleRunScan(scan.type)}
                    disabled={scanning !== null || !credits?.has_credits}
                    style={{
                      padding: '12px', borderRadius: '10px', border: `1px solid ${dark.border}`,
                      background: scanning === scan.type ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.1)',
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
              {/* Vendor phone input modal */}
              {showVendorInput && (
                <div style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${dark.border}`, background: dark.cardBg }}>
                  <div style={{ color: '#fff', fontWeight: 600, marginBottom: '8px' }}>📞 Vendor Phone Verification</div>
                  <input
                    placeholder="+1 555 123 4567"
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
                  <div style={{ color: '#fff', fontWeight: 600, marginBottom: '8px' }}>🖥️ Website Scan</div>
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
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Scan results */}
              {scanResult ? (
                <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '16px', padding: isMobile ? '16px' : '24px', backdropFilter: 'blur(12px)' }}>
                  <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
                    {scanType === 'domain' ? '🌐 Domain Monitor Results' : scanType === 'website' ? '🖥️ Website Scan Results' : scanType === 'threat' ? '⚡ Threat Correlation Results' : scanType === 'vendor' ? '📞 Vendor Verification Results' : '🔍 Impersonator Scan Results'}
                  </h3>
                  {scanResult.error ? (
                    <div style={{ color: dark.red, fontSize: '14px' }}>{String(scanResult.error)}</div>
                  ) : (scanResult.success || scanResult.total_variants || scanResult.impersonators || scanResult.variants || scanResult.risk_score !== undefined || scanResult.aggregate_risk_score !== undefined || scanResult.verification_level || scanResult.red_flags) ? (
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
                              {scanResult.variants.slice(0, 5).map((v: Record<string, unknown>, i: number) => (
                                <div key={i} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>{String(v.domain || v.name || '?')}</div>
                                  <div style={{ color: dark.textMuted, fontSize: '11px', marginTop: '2px' }}>{String(v.type || v.risk || 'Lookalike')}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {/* Website scan results */}
                      {scanType === 'website' && (
                        <>
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
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                              <div style={{ fontSize: '12px', color: dark.textMuted }}>Verification Level</div>
                              <div style={{ fontSize: '18px', fontWeight: 800, color: (scanResult.verification_level === 'LIKELY_FRAUDULENT' || scanResult.verification_level === 'SUSPICIOUS') ? dark.red : dark.green }}>
                                {String(scanResult.verification_level ?? '?')}
                              </div>
                            </div>
                            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${dark.border}` }}>
                              <div style={{ fontSize: '12px', color: dark.textMuted }}>Vendor Score</div>
                              <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: (scanResult.verification_score ?? 100) < 50 ? dark.red : dark.green }}>
                                {String(scanResult.verification_score ?? '?')}/100
                              </div>
                            </div>
                          </div>
                          {Array.isArray(scanResult.scam_patterns) && scanResult.scam_patterns.length > 0 && (
                            <div style={{ display: 'grid', gap: '8px' }}>
                              {scanResult.scam_patterns.slice(0, 5).map((p: Record<string, unknown>, i: number) => (
                                <div key={i} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>{String(p.type || p.pattern || 'Scam Pattern')}</div>
                                  <div style={{ color: dark.textMuted, fontSize: '11px', marginTop: '2px' }}>{String(p.description || p.detail || '')}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
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
                <div style={{ background: dark.cardBg, border: `1px solid ${dark.border}`, borderRadius: '12px', padding: isMobile ? '10px' : '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: dark.green }}>{totalRemaining}</div>
                  <div style={{ fontSize: '12px', color: dark.textMuted }}>Scans Left</div>
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
      </div>

      {/* Credit Purchase Modal */}
      {showPurchase && (
        <CreditPurchaseModal
          authToken={authToken}
          onClose={() => setShowPurchase(false)}
          onSuccess={() => { setShowPurchase(false); fetchCredits(); }}
        />
      )}
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