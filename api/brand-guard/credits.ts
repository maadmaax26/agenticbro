/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/credits.ts — Brand Guard Credits API
 * ========================================================================
 * Manages pay-as-you-go credits for Brand Guard scans.
 * Mirrors the social scan credit system: 25 free scans, then $1/scan.
 *
 * GET    /api/brand-guard/credits                    — Get user's credit balance
 * POST   /api/brand-guard/credits/deduct             — Deduct 1 credit for a scan
 * POST   /api/brand-guard/credits/add                 — Add credits (purchase/admin)
 * GET    /api/brand-guard/credits/history              — Get transaction history
 * POST   /api/brand-guard/credits/stripe-checkout      — Create Stripe checkout session
 * POST   /api/brand-guard/credits/crypto-confirm        — Confirm crypto payment
 *
 * Credit priority: Free credits used first → Paid credits second
 * All operations are scoped to the authenticated user via Supabase Auth.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

// ── Stripe Price IDs (created 2026-05-28) ─────────────────────────────────────
const STRIPE_PRICES = {
  'bg-starter':  process.env.STRIPE_BG_STARTER_PRICE_ID  || 'price_1TcC6R1lUBogdwcDsg8wYTgx', // $5 / 5 credits
  'bg-basic':    process.env.STRIPE_BG_BASIC_PRICE_ID    || 'price_1TcC6S1lUBogdwcDuCMkWIJW', // $10 / 10 credits
  'bg-pro':      process.env.STRIPE_BG_PRO_PRICE_ID      || 'price_1TcC6S1lUBogdwcDsI9CF0PD', // $25 / 25 credits
  'bg-whale':    process.env.STRIPE_BG_WHALE_PRICE_ID    || 'price_1TcC6S1lUBogdwcDGonv0mZQ', // $100 / 110 credits
  'bg-guardian': process.env.STRIPE_BG_GUARDIAN_PRICE_ID || 'price_1TcC6Z1lUBogdwcDetJfQtGS', // $29/mo
  'bg-sentinel': process.env.STRIPE_BG_SENTINEL_PRICE_ID || 'price_1TcC6Z1lUBogdwcDzNKnTEkh', // $79/mo
  'bg-fortress': process.env.STRIPE_BG_FORTRESS_PRICE_ID || 'price_1TcC6Z1lUBogdwcDgTFlMRFf', // $199/mo
  // Brand Guard Subscription plans (new)
  'guardian':    process.env.STRIPE_GUARDIAN_PRICE_ID    || 'price_guardian_12345', // $29/mo
  'sentinel':    process.env.STRIPE_SENTINEL_PRICE_ID    || 'price_sentinel_67890', // $99/mo
  'fortress':    process.env.STRIPE_FORTRESS_PRICE_ID    || 'price_fortress_abcde', // $299/mo
} as const;

// ── Brand Guard Subscription Plans ────────────────────────────────────────────
const SUBSCRIPTION_PLANS = [
  { id: 'guardian', name: 'Guardian', price_usd: 29, monthly_credits: 50, brands_included: 3, stripe_price_id: STRIPE_PRICES['guardian'] },
  { id: 'sentinel', name: 'Sentinel', price_usd: 99, monthly_credits: 200, brands_included: 10, stripe_price_id: STRIPE_PRICES['sentinel'] },
  { id: 'fortress', name: 'Fortress', price_usd: 299, monthly_credits: -1, brands_included: -1, stripe_price_id: STRIPE_PRICES['fortress'] }, // -1 = unlimited
];

// ── Credit Packages (mirrors social scan pricing) ────────────────────────────
const CREDIT_PACKAGES = [
  { id: 'bg-starter', name: 'Starter', credits: 5, price_usd: 5, bonus: 0, stripe_price_id: STRIPE_PRICES['bg-starter'] },
  { id: 'bg-basic', name: 'Basic', credits: 10, price_usd: 10, bonus: 0, stripe_price_id: STRIPE_PRICES['bg-basic'] },
  { id: 'bg-pro', name: 'Pro', credits: 25, price_usd: 25, bonus: 0, popular: true, stripe_price_id: STRIPE_PRICES['bg-pro'] },
  { id: 'bg-whale', name: 'Whale', credits: 100, price_usd: 100, bonus: 10, stripe_price_id: STRIPE_PRICES['bg-whale'] },
];

const FREE_CREDITS_DEFAULT = 25;
const PRICE_PER_SCAN_USD = 1.00;

// Payment wallets (same as social scans)
const PAYMENT_WALLET_SOLANA = '9SFtm4S5QNDdMuWwgpy8E7ZhqRfgmjNtE1JLqkzPKj9F';
const PAYMENT_WALLET_BASE = '0x1c793592adf512dfe590817225c3b2b6bd913fac';
const AGNTCBRO_MINT = '52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump';

// ── Types ─────────────────────────────────────────────────────────────────────
type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getAuthenticatedUserId(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// ── Parse body ────────────────────────────────────────────────────────────────
function parseBody(req: VercelRequest): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── Parse URL path ────────────────────────────────────────────────────
  const url = new URL(req.url || '', 'https://brand-guard.local');
  const path = url.pathname.replace('/api/brand-guard/credits', '').replace(/\/$/, '');

  // ── Public routes (no auth required) ───────────────────────────────────
  // GET /packages — public, shows pricing info
  if (req.method === 'GET' && path === '/packages') {
    res.status(200).json({
      success: true,
      packages: CREDIT_PACKAGES,
      price_per_scan: PRICE_PER_SCAN_USD,
      free_credits: FREE_CREDITS_DEFAULT,
      payment_wallets: {
        solana: PAYMENT_WALLET_SOLANA,
        base: PAYMENT_WALLET_BASE,
        agntcbro_mint: AGNTCBRO_MINT,
      },
    });
    return;
  }

  // ── Auth check ──────────────────────────────────────────────────────────
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required. Send Bearer token from Supabase Auth.' });
    return;
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // ══════════════════════════════════════════════════════════════════════════
  // GET / — Get credit balance
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET' && (path === '' || path === '/')) {
    const { data: credits, error } = await serviceClient
      .from('brand_guard_credits')
      .select('*')
      .eq('owner_id', userId)
      .single();

    if (error || !credits) {
      // No credits row yet — return defaults (25 free available)
      res.status(200).json({
        success: true,
        credits: {
          free_total: FREE_CREDITS_DEFAULT,
          free_used: 0,
          free_remaining: FREE_CREDITS_DEFAULT,
          paid_credits: 0,
          total_remaining: FREE_CREDITS_DEFAULT,
          has_credits: true,
          first_brand_at: null,
        },
      });
      return;
    }

    const freeRemaining = credits.free_credits_total - credits.free_credits_used;
    const totalRemaining = freeRemaining + credits.paid_credits;

    res.status(200).json({
      success: true,
      credits: {
        free_total: credits.free_credits_total,
        free_used: credits.free_credits_used,
        free_remaining: freeRemaining,
        paid_credits: credits.paid_credits,
        paid_credits_total_purchased: credits.paid_credits_total_purchased,
        total_remaining: totalRemaining,
        has_credits: totalRemaining > 0,
        first_brand_at: credits.first_brand_at,
        promo_code: credits.promo_code || null,
        promo_credits: credits.promo_credits || 0,
      },
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /deduct — Deduct 1 credit for a scan
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/deduct') {
    const body = await parseBody(req);
    const brandMonitorId = body.brand_monitor_id as string | undefined;
    const scanId = body.scan_id as string | undefined;

    // Use the database function for atomic credit deduction
    const { data, error } = await serviceClient.rpc('deduct_brand_guard_credit', {
      p_owner_id: userId,
      p_brand_monitor_id: brandMonitorId || null,
      p_scan_id: scanId || null,
    });

    if (error) {
      res.status(500).json({ error: 'Failed to deduct credit', details: error.message });
      return;
    }

    const result = data as Record<string, unknown>;
    if (!(result.success as boolean)) {
      res.status(402).json({
        error: 'Insufficient credits',
        message: result.message || 'No credits available. Purchase credits or set up a subscription.',
        ...result,
      });
      return;
    }

    res.status(200).json({ success: true, ...result });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /add — Add credits (after purchase confirmation)
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/add') {
    const body = await parseBody(req);
    const amount = body.amount as number;
    const paymentMethod = body.payment_method as string;
    const paymentReference = body.payment_reference as string | undefined;
    const amountUsd = body.amount_usd as number | undefined;
    const description = body.description as string | undefined;

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive integer' });
      return;
    }

    if (!paymentMethod || !['stripe', 'usdc_solana', 'usdc_base', 'agntcbro', 'subscription', 'admin', 'refund', 'health_refresh'].includes(paymentMethod)) {
      res.status(400).json({ error: 'Invalid payment_method. Must be: stripe, usdc_solana, usdc_base, agntcbro, subscription, admin, or refund' });
      return;
    }

    const { data, error } = await serviceClient.rpc('add_brand_guard_credits', {
      p_owner_id: userId,
      p_amount: amount,
      p_transaction_type: paymentMethod === 'subscription' ? 'subscription_grant' : 'purchase',
      p_payment_method: paymentMethod,
      p_payment_reference: paymentReference || null,
      p_amount_usd: amountUsd || null,
      p_description: description || `Added ${amount} Brand Guard credits via ${paymentMethod}`,
    });

    if (error) {
      res.status(500).json({ error: 'Failed to add credits', details: error.message });
      return;
    }

    res.status(200).json({ success: true, ...(data as Record<string, unknown>) });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /history — Get transaction history
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET' && path === '/history') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const { data, error } = await serviceClient
      .from('brand_guard_credit_transactions')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch history', details: error.message });
      return;
    }

    res.status(200).json({ success: true, transactions: data || [] });
    return;
  }



  // ══════════════════════════════════════════════════════════════════════════
  // POST /stripe-checkout — Create Stripe checkout session
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/stripe-checkout') {
    const body = await parseBody(req);
    const packageId = body.package_id as string;
    const email = body.email as string | undefined;

    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
    if (!pkg) {
      res.status(400).json({ error: `Invalid package_id. Available: ${CREDIT_PACKAGES.map(p => p.id).join(', ')}` });
      return;
    }

    if (!stripeSecretKey) {
      res.status(503).json({ error: 'Stripe not configured. Use crypto payment instead.' });
      return;
    }

    try {
      // Use pre-created Stripe price IDs for reliability
      const priceId = pkg.stripe_price_id;
      const totalCredits = pkg.credits + (pkg.bonus || 0);

      const checkoutParams: Record<string, string> = {
        'payment_method_types[]': 'card',
        'mode': 'payment',
        'success_url': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agenticbro.app'}/brand-guard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agenticbro.app'}/brand-guard?checkout=cancelled`,
        'customer_email': email || '',
        'metadata[user_id]': userId,
        'metadata[credits]': String(totalCredits),
        'metadata[package_id]': pkg.id,
        'metadata[type]': 'brand_guard',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
      };

      // Create Stripe checkout session
      const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(checkoutParams).toString(),
      });

      const session = await stripeResponse.json();

      if (!stripeResponse.ok) {
        throw new Error(session.error?.message || 'Stripe checkout creation failed');
      }

      res.status(200).json({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment processing failed';
      res.status(500).json({ error: message });
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /crypto-confirm — Confirm crypto payment and add credits
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/crypto-confirm') {
    const body = await parseBody(req);
    const paymentMethod = body.payment_method as string;  // usdc_solana | usdc_base | agntcbro
    const txSignature = body.tx_signature as string;
    const packageId = body.package_id as string;

    if (!['usdc_solana', 'usdc_base', 'agntcbro'].includes(paymentMethod)) {
      res.status(400).json({ error: 'Invalid payment_method for crypto. Use usdc_solana, usdc_base, or agntcbro' });
      return;
    }

    if (!txSignature) {
      res.status(400).json({ error: 'tx_signature is required' });
      return;
    }

    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
    if (!pkg) {
      res.status(400).json({ error: 'Invalid package_id' });
      return;
    }

    const credits = pkg.credits + (pkg.bonus || 0);

    // Add credits immediately (in production, verify on-chain transaction first)
    const { data, error } = await serviceClient.rpc('add_brand_guard_credits', {
      p_owner_id: userId,
      p_amount: credits,
      p_transaction_type: 'purchase',
      p_payment_method: paymentMethod,
      p_payment_reference: txSignature,
      p_amount_usd: pkg.price_usd,
      p_description: `Purchased ${credits} Brand Guard credits via ${paymentMethod} (${pkg.name} package)`,
    });

    if (error) {
      res.status(500).json({ error: 'Failed to add credits', details: error.message });
      return;
    }

    res.status(200).json({
      success: true,
      ...(data as Record<string, unknown>),
      message: `${credits} credits added successfully`,
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /subscribe — Create Stripe subscription checkout (recurring)
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/subscribe') {
    const body = await parseBody(req);
    const planId = body.plan_id as string; // guardian | sentinel | fortress
    const email = body.email as string | undefined;

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      res.status(400).json({ error: `Invalid plan_id. Available: guardian, sentinel, fortress` });
      return;
    }

    if (!stripeSecretKey) {
      res.status(503).json({ error: 'Stripe not configured' });
      return;
    }

    try {
      const checkoutParams: Record<string, string> = {
        'mode': 'subscription',
        'success_url': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agenticbro.app'}/brand-guard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agenticbro.app'}/brand-guard?checkout=cancelled`,
        'customer_email': email || '',
        'metadata[user_id]': userId || '',
        'metadata[plan_id]': planId,
        'metadata[type]': 'brand_guard_subscription',
        'subscription_data[trial_period_days]': '7',
        'subscription_data[metadata][user_id]': userId || '',
        'subscription_data[metadata][plan_id]': planId,
        'line_items[0][price]': plan.stripe_price_id,
        'line_items[0][quantity]': '1',
      };

      const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(checkoutParams).toString(),
      });

      const session = await stripeResponse.json();

      if (!stripeResponse.ok) {
        throw new Error(session.error?.message || 'Stripe checkout creation failed');
      }

      res.status(200).json({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
        plan: planId,
        trial_days: 7,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment processing failed';
      res.status(500).json({ error: message });
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /subscription — Get current subscription status
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET' && path === '/subscription') {
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const { data: subscription, error } = await serviceClient
        .from('brand_guard_subscriptions')
        .select('*')
        .eq('owner_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        res.status(500).json({ error: 'Failed to fetch subscription', details: error.message });
        return;
      }

      // Get credits info
      const { data: credits } = await serviceClient
        .from('brand_guard_credits')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle();

      const planConfig = subscription
        ? SUBSCRIPTION_PLANS.find(p => p.id === subscription.plan_id)
        : null;

      res.status(200).json({
        success: true,
        subscription: subscription ? {
          id: subscription.id,
          plan_id: subscription.plan_id,
          plan_name: planConfig?.name || subscription.plan_id,
          status: subscription.status,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
          monthly_credits_included: subscription.monthly_credits_included,
          monthly_credits_used: subscription.monthly_credits_used,
          brands_included: subscription.brands_included,
          price_usd: planConfig?.price_usd || 0,
        } : null,
        credits: credits || { total_credits: 25, used_credits: 0, free_credits_remaining: 25 },
        is_free: !subscription,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /stripe-portal — Create Stripe Customer Portal session
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/stripe-portal') {
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!stripeSecretKey) {
      res.status(503).json({ error: 'Stripe not configured' });
      return;
    }

    try {
      // Find the user's Stripe customer ID
      const { data: subscription } = await serviceClient
        .from('brand_guard_subscriptions')
        .select('stripe_customer_id')
        .eq('owner_id', userId)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subscription?.stripe_customer_id) {
        res.status(404).json({ error: 'No Stripe customer found. Subscribe first.' });
        return;
      }

      const portalParams = new URLSearchParams({
        'customer': subscription.stripe_customer_id,
        'return_url': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agenticbro.app'}/brand-guard`,
      });

      const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: portalParams.toString(),
      });

      const session = await portalResponse.json();

      if (!portalResponse.ok) {
        throw new Error(session.error?.message || 'Failed to create portal session');
      }

      res.status(200).json({ url: session.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create billing portal';
      res.status(500).json({ error: message });
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /cancel-subscription — Cancel active subscription
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/cancel-subscription') {
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!stripeSecretKey) {
      res.status(503).json({ error: 'Stripe not configured' });
      return;
    }

    try {
      const { data: subscription } = await serviceClient
        .from('brand_guard_subscriptions')
        .select('id, stripe_subscription_id, plan_id')
        .eq('owner_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (!subscription?.stripe_subscription_id) {
        res.status(404).json({ error: 'No active subscription found' });
        return;
      }

      // Cancel at period end (don't immediately revoke access)
      const cancelResponse = await fetch(
        `https://api.stripe.com/v1/subscriptions/${subscription.stripe_subscription_id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'cancel_at_period_end=true',
        }
      );

      if (!cancelResponse.ok) {
        const err = await cancelResponse.json();
        throw new Error(err.error?.message || 'Failed to cancel subscription');
      }

      // Update local DB
      await serviceClient
        .from('brand_guard_subscriptions')
        .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
        .eq('id', subscription.id);

      res.status(200).json({
        success: true,
        message: 'Subscription will be cancelled at the end of the current billing period',
        cancel_at_period_end: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel subscription';
      res.status(500).json({ error: message });
    }
    return;
  }

  res.status(404).json({ error: 'Not found. Available: GET /, POST /deduct, POST /add, GET /history, GET /packages, POST /stripe-checkout, POST /subscribe, GET /subscription, POST /stripe-portal, POST /cancel-subscription, POST /crypto-confirm' });
}

export const config = {
  maxDuration: 15,
};