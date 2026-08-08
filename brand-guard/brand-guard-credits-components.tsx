/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * BrandGuardCredits — React Components for Credit Management
 * ============================================================
 * Shows credit balance, exhaustion state, purchase modal, and subscription upsell.
 *
 * Components:
 *   <CreditBalance />     — Shows remaining credits in the dashboard header
 *   <CreditGate />        — Blocks scans when credits are exhausted, shows buy prompt
 *   <CreditPurchase />    — Modal for buying pay-as-you-go credits (Stripe + crypto)
 *   <SubscriptionUpsell /> — Shows subscription plans when credits run out
 *
 * Integration:
 *   import { CreditBalance, CreditGate, CreditPurchase } from '@/components/BrandGuardCredits';
 */

import React, { useState, useEffect, useCallback } from 'react';

// ── API Config ────────────────────────────────────────────────────────────────
const API_BASE = '/api/brand-guard';

// ── Types ─────────────────────────────────────────────────────────────────────
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

interface CreditTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  free_remaining_after: number;
  paid_remaining_after: number;
  payment_method: string | null;
  amount_usd: number | null;
  description: string | null;
  created_at: string;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_usd: number;
  bonus: number;
  popular?: boolean;
}

type PaymentMethod = 'stripe' | 'usdc-solana' | 'usdc-base' | 'agntcbro';

// ── Credit Packages (mirrors API) ─────────────────────────────────────────────
const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'bg-starter', name: 'Starter', credits: 5, price_usd: 5, bonus: 0 },
  { id: 'bg-basic', name: 'Basic', credits: 10, price_usd: 10, bonus: 0 },
  { id: 'bg-pro', name: 'Pro', credits: 25, price_usd: 25, bonus: 0, popular: true },
  { id: 'bg-whale', name: 'Whale', credits: 100, price_usd: 100, bonus: 10 },
];

const FREE_CREDITS = 25;

// ── Subscription Plans ────────────────────────────────────────────────────────
const SUBSCRIPTION_PLANS = [
  {
    id: 'guardian',
    name: 'Guardian',
    price: 29,
    period: 'mo',
    credits: 100,
    brands: 3,
    frequency: '6-hour monitoring',
    features: ['100 scans/month', '3 brands', '6-hour monitoring', 'Email alerts', 'Takedown templates'],
    highlight: false,
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    price: 99,
    period: 'mo',
    credits: 300,
    brands: 10,
    frequency: '15-minute monitoring',
    features: ['300 scans/month', '10 brands', '15-minute monitoring', 'Priority alerts', 'Auto takedown filing', 'Domain monitoring', 'Webhook Integrations'],
    highlight: true,
  },
  {
    id: 'fortress',
    name: 'Fortress',
    price: 299,
    period: 'mo',
    credits: -1, // unlimited
    brands: -1, // unlimited
    frequency: 'Real-time monitoring',
    features: ['Unlimited scans', 'Unlimited brands', 'Real-time monitoring', 'Dedicated support', 'Auto takedown + follow-up', 'Full threat correlation', 'Webhook Integrations'],
    highlight: false,
  },
];

// ── Hook: useCredits ──────────────────────────────────────────────────────────
function useCredits(authToken: string | null) {
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/credits`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) setCredits(data.credits);
      else setError(data.error || 'Failed to fetch credits');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally { setLoading(false); }
  }, [authToken]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  const deductCredit = useCallback(async (brandMonitorId?: string, scanId?: string): Promise<{ success: boolean; remaining: number; type: string }> => {
    if (!authToken) return { success: false, remaining: 0, type: 'free' };
    try {
      const res = await fetch(`${API_BASE}/credits/deduct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ brand_monitor_id: brandMonitorId, scan_id: scanId }),
      });
      const data = await res.json();
      if (data.success) {
        setCredits(prev => prev ? {
          ...prev,
          free_remaining: data.free_remaining ?? prev.free_remaining,
          paid_credits: data.paid_remaining ?? prev.paid_credits,
          total_remaining: data.remaining ?? prev.total_remaining,
          has_credits: true,
        } : prev);
        return { success: true, remaining: data.remaining, type: data.type };
      }
      // 402 = no credits
      if (res.status === 402) {
        setCredits(prev => prev ? { ...prev, total_remaining: 0, has_credits: false } : prev);
        return { success: false, remaining: 0, type: 'paid' };
      }
      return { success: false, remaining: 0, type: 'paid' };
    } catch {
      return { success: false, remaining: 0, type: 'paid' };
    }
  }, [authToken]);

  return { credits, loading, error, refetch: fetchCredits, deductCredit };
}

// ── CreditBalance Component ───────────────────────────────────────────────────
export function CreditBalance({ authToken }: { authToken: string | null }) {
  const { credits, loading } = useCredits(authToken);

  if (loading || !credits) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9' }}>
        <span style={{ fontSize: '14px' }}>🔐</span>
        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Loading...</span>
      </div>
    );
  }

  const freeRem = credits.free_remaining;
  const paidRem = credits.paid_credits;
  const total = credits.total_remaining;
  const lowCredits = total > 0 && total <= 3;
  const noCredits = total === 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 14px', borderRadius: '8px',
      background: noCredits ? '#fef2f2' : lowCredits ? '#fffbeb' : '#f0fdf4',
      border: `1px solid ${noCredits ? '#fca5a5' : lowCredits ? '#fde68a' : '#bbf7d0'}`,
    }}>
      <span style={{ fontSize: '16px' }}>{noCredits ? '🚫' : lowCredits ? '⚠️' : '✅'}</span>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: noCredits ? '#dc2626' : lowCredits ? '#d97706' : '#16a34a' }}>
          {total} scan{total !== 1 ? 's' : ''} remaining
        </div>
        {freeRem > 0 && (
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            {freeRem} free + {paidRem} paid
          </div>
        )}
      </div>
      {noCredits && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('show-credit-purchase'))}
          style={{
            marginLeft: '8px', padding: '4px 10px', borderRadius: '6px',
            background: '#3b82f6', color: 'white', border: 'none',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Buy Credits
        </button>
      )}
    </div>
  );
}

// ── CreditGate Component ──────────────────────────────────────────────────────
// Blocks scan actions when user has no credits, shows buy/subscribe prompt
export function CreditGate({
  authToken,
  children,
}: {
  authToken: string | null;
  children: React.ReactNode;
}) {
  const { credits, loading } = useCredits(authToken);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  if (loading) return <>{children}</>;

  const hasCredits = credits?.has_credits ?? true; // Allow if not loaded yet

  if (hasCredits) return <>{children}</>;

  // No credits — show gate
  return (
    <div style={{
      padding: '32px', textAlign: 'center', borderRadius: '12px',
      background: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
      border: '1px solid #fecaca',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#991b1b', margin: '0 0 8px' }}>
        Out of Scan Credits
      </h3>
      <p style={{ fontSize: '14px', color: '#7f1d1d', marginBottom: '24px' }}>
        You've used all {FREE_CREDITS} free scans. Purchase credits to continue protecting your brand.
      </p>

      {/* Buy Credits Button */}
      <button
        onClick={() => setShowPurchase(true)}
        style={{
          padding: '14px 28px', borderRadius: '10px', border: 'none',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white', fontSize: '16px', fontWeight: 600,
          cursor: 'pointer', marginBottom: '12px', width: '100%',
        }}
      >
        💎 Buy Scan Credits — $1/scan
      </button>

      <div style={{ margin: '16px 0', color: '#94a3b8', fontSize: '13px' }}>or</div>

      {/* Subscription Upsell */}
      <button
        onClick={() => setShowSubscription(true)}
        style={{
          padding: '14px 28px', borderRadius: '10px', border: '1px solid #d1d5db',
          background: 'white', color: '#374151', fontSize: '16px', fontWeight: 600,
          cursor: 'pointer', width: '100%',
        }}
      >
        📋 Set Up Monthly Subscription
      </button>

      <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '16px' }}>
        Plans start at $29/mo — includes monthly scans + monitoring
      </p>

      {showPurchase && <CreditPurchaseModal authToken={authToken} onClose={() => setShowPurchase(false)} />}
      {showSubscription && <SubscriptionUpsellModal onClose={() => setShowSubscription(false)} />}
    </div>
  );
}

// ── CreditPurchaseModal ────────────────────────────────────────────────────────
export function CreditPurchaseModal({ authToken, onClose }: { authToken: string | null; onClose: () => void }) {
  const [selectedPkg, setSelectedPkg] = useState('bg-pro');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  const [loading, setLoading] = useState(false);
  const [agntcbroPrice, setAgntcbroPrice] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pkg = CREDIT_PACKAGES.find(p => p.id === selectedPkg) || CREDIT_PACKAGES[2];
  const totalCredits = pkg.credits + (pkg.bonus || 0);

  // Fetch AGNTCBRO price
  useEffect(() => {
    if (paymentMethod === 'agntcbro') {
      fetch(`https://api.dexscreener.com/latest/dex/tokens/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump`)
        .then(r => r.json())
        .then(d => { if (d.pairs?.[0]?.priceUsd) setAgntcbroPrice(parseFloat(d.pairs[0].priceUsd)); })
        .catch(() => {});
    }
  }, [paymentMethod]);

  const agntcbroAmount = agntcbroPrice > 0 ? Math.ceil(pkg.price_usd / agntcbroPrice) : 0;

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
        // Crypto — confirm payment and add credits
        const txSignature = prompt(`Send ${paymentMethod === 'agntcbro' ? `${agntcbroAmount} AGNTCBRO` : `${pkg.price_usd} USDC`} to the wallet, then paste the transaction signature:`);
        if (!txSignature) { setLoading(false); return; }

        const res = await fetch(`${API_BASE}/credits/crypto-confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ payment_method: paymentMethod, tx_signature: txSignature, package_id: selectedPkg }),
        });
        const data = await res.json();
        if (data.success) { onClose(); return; }
        throw new Error(data.error || 'Payment confirmation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: '24px' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ maxWidth: '560px', width: '100%', background: 'white', borderRadius: '16px', padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>💎</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Buy Brand Guard Credits</h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>1 scan = $1 USD — Credits never expire</p>
        </div>

        {/* Package Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
          {CREDIT_PACKAGES.map(p => (
            <div key={p.id} onClick={() => setSelectedPkg(p.id)} style={{
              padding: '14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
              border: `2px solid ${selectedPkg === p.id ? '#3b82f6' : '#e2e8f0'}`,
              background: selectedPkg === p.id ? '#eff6ff' : 'white',
            }}>
              {p.popular && <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600 }}>★ POPULAR</div>}
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{totalCredits}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{p.bonus ? `${p.credits} + ${p.bonus} bonus` : 'scans'}</div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '4px' }}>${p.price_usd}</div>
            </div>
          ))}
        </div>

        {/* Payment Method */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '20px' }}>
          {[
            { id: 'stripe' as PaymentMethod, icon: '💳', label: 'Card', sublabel: 'USD', color: '#10b981' },
            { id: 'usdc-solana' as PaymentMethod, icon: '◎', label: 'USDC', sublabel: 'Solana', color: '#8b5cf6' },
            { id: 'usdc-base' as PaymentMethod, icon: '🔷', label: 'USDC', sublabel: 'Base', color: '#3b82f6' },
            { id: 'agntcbro' as PaymentMethod, icon: '🦞', label: 'AGNTCBRO', sublabel: 'Token', color: '#f59e0b' },
          ].map(m => (
            <div key={m.id} onClick={() => setPaymentMethod(m.id)} style={{
              padding: '12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
              border: `2px solid ${paymentMethod === m.id ? m.color : '#e2e8f0'}`,
              background: paymentMethod === m.id ? `${m.color}15` : 'white',
            }}>
              <div style={{ fontSize: '20px' }}>{m.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{m.sublabel}</div>
            </div>
          ))}
        </div>

        {error && <div style={{ padding: '10px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

        <button onClick={handlePurchase} disabled={loading} style={{
          width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
          fontSize: '16px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white',
        }}>
          {loading ? 'Processing...' : `Pay $${pkg.price_usd} — ${totalCredits} scans`}
        </button>
      </div>
    </div>
  );
}

// ── SubscriptionUpsellModal ────────────────────────────────────────────────────
export function SubscriptionUpsellModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: '24px' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ maxWidth: '720px', width: '100%', background: 'white', borderRadius: '16px', padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>📋</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Brand Guard Subscriptions</h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>Continuous monitoring + monthly scan credits</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {SUBSCRIPTION_PLANS.map(plan => (
            <div key={plan.id} style={{
              padding: '20px', borderRadius: '12px', textAlign: 'center',
              border: plan.highlight ? '2px solid #3b82f6' : '1px solid #e2e8f0',
              background: plan.highlight ? '#eff6ff' : 'white',
              position: 'relative',
            }}>
              {plan.highlight && <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#3b82f6', color: 'white', padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>BEST VALUE</div>}
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{plan.name}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#3b82f6', margin: '8px 0' }}>${plan.price}<span style={{ fontSize: '14px', fontWeight: 400, color: '#64748b' }}>/mo</span></div>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>{plan.credits === -1 ? 'Unlimited' : `${plan.credits} scans/mo`}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', fontSize: '12px', color: '#475569', textAlign: 'left' }}>
                {plan.features.map((f, i) => <li key={i} style={{ padding: '3px 0' }}>✓ {f}</li>)}
              </ul>
              <button style={{
                width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                background: plan.highlight ? '#3b82f6' : '#f1f5f9', color: plan.highlight ? 'white' : '#374151',
              }}>
                Coming Soon
              </button>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '20px' }}>
          Need credits now? <span style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }} onClick={onClose}>Buy pay-as-you-go credits instead</span>
        </p>
      </div>
    </div>
  );
}

export { useCredits, CREDIT_PACKAGES, SUBSCRIPTION_PLANS };
