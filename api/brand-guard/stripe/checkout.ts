/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/stripe/checkout.ts — Stripe Checkout Session Creation
 * ========================================================================
 * Creates Stripe checkout sessions for Brand Guard subscription plans.
 *
 * POST /api/brand-guard/stripe/checkout
 *   Body: { plan_id: string, brand_monitor_id: string, promo_code?: string }
 *   Returns: { session_id: string, url: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { BRAND_GUARD_LEGAL_VERSIONS, verifyLegalAcceptanceId } from '../../_lib/brand-guard-legal.js';

// ── Config ────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

// ── Supabase Client ────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ── Stripe Client ─────────────────────────────────────────────────────────────
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: '2026-05-27.dahlia',
    });
  }
  return stripeInstance;
}

// ── Plan Definitions ──────────────────────────────────────────────────────────
interface PlanDefinition {
  id: string;
  name: string;
  monthly_credits_included: number;
  brands_included: number;
  scan_frequency: string;
  price_usd: number;
  stripe_price_id: string;
  description: string;
  features: string[];
}

const PLANS: Record<string, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free Tier',
    monthly_credits_included: 10,
    brands_included: 1,
    scan_frequency: 'weekly',
    price_usd: 0,
    stripe_price_id: '',
    description: '10 free scans per month, 1 brand, weekly monitoring',
    features: [
      '10 free scans per month',
      '1 brand monitored',
      'Weekly automated scans',
      'Email alert notifications',
      'Dashboard access',
    ],
  },
  guardian: {
    id: 'guardian',
    name: 'Guardian',
    monthly_credits_included: 100,
    brands_included: 3,
    scan_frequency: 'weekly',
    price_usd: 29,
    stripe_price_id: process.env.STRIPE_BG_GUARDIAN_PRICE_ID || 'price_bg_guardian',
    description: '$29/month: 100 scans, 3 brands, 6-hour monitoring',
    features: [
      '100 scans per month included',
      '3 brands monitored',
      '6-hour automated monitoring',
      'Email alert notifications',
      'Dashboard access',
      'Priority support',
    ],
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    monthly_credits_included: 300,
    brands_included: 10,
    scan_frequency: '15_minutes',
    price_usd: 99,
    stripe_price_id: process.env.STRIPE_BG_SENTINEL_PRICE_ID || 'price_bg_sentinel',
    description: '$99/month: 300 scans, 10 brands, 15-minute monitoring, webhook integrations',
    features: [
      '300 scans per month included',
      '10 brands monitored',
      '15-minute automated monitoring',
      'Email alert notifications',
      'Dashboard access',
      'Real-time monitoring',
      'Webhook Integrations',
      'Priority support',
    ],
  },
  fortress: {
    id: 'fortress',
    name: 'Fortress',
    monthly_credits_included: -1, // Unlimited
    brands_included: -1, // Unlimited
    scan_frequency: 'daily',
    price_usd: 299,
    stripe_price_id: process.env.STRIPE_BG_FORTRESS_PRICE_ID || 'price_bg_fortress',
    description: '$299/month: Unlimited scans, unlimited brands, real-time monitoring',
    features: [
      'Unlimited scans',
      'Unlimited brands',
      'Daily automated scans',
      'Email alert notifications',
      'Dashboard access',
      'Real-time monitoring',
      'Webhook Integrations',
      'Priority support',
    ],
  },
};

// ── Helper Functions ──────────────────────────────────────────────────────────

async function getOrCreateStripeCustomer(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string
): Promise<{ customer_id: string; created: boolean }> {
  // Check if customer already exists
  const { data: subscriptionData, error: subError } = await supabase
    .from('brand_guard_subscriptions')
    .select('stripe_customer_id')
    .eq('owner_id', userId)
    .single();

  if (!subError && subscriptionData?.stripe_customer_id) {
    return { customer_id: subscriptionData.stripe_customer_id, created: false };
  }

  // Create new customer in Stripe
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
      app: 'agenticbro',
    },
  });

  // Store in Supabase
  await supabase
    .from('brand_guard_subscriptions')
    .insert({
      owner_id: userId,
      plan_id: 'free',
      status: 'active',
      stripe_customer_id: customer.id,
    });

  return { customer_id: customer.id, created: true };
}

async function createStripeCheckoutSession(
  customer_id: string,
  price_id: string,
  success_url: string,
  cancel_url: string,
  promotion_code_id?: string,
  trial_days?: number
): Promise<{ session_id: string; url: string }> {
  const stripe = getStripe();

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customer_id,
    mode: 'subscription',
    line_items: [
      {
        price: price_id,
        quantity: 1,
      },
    ],
    success_url: success_url,
    cancel_url: cancel_url,
    payment_method_types: ['card'],
    allow_promotion_codes: !promotion_code_id,
    metadata: {
      plan_id: price_id,
      source: 'brand_guard',
    },
    // ── Free Trial: No credit card required ──────────────────────────────────
    // Users can sign up with just email and start a 7-day free trial.
    // Stripe only collects payment when the trial ends.
    // If no payment method is added by trial end, subscription cancels (not pauses).
    payment_method_collection: 'if_required',
    subscription_data: {
      trial_period_days: trial_days || 7,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel',
        },
      },
      metadata: {
        plan_id: price_id,
        source: 'brand_guard',
      },
    },
  };

  if (promotion_code_id) {
    sessionParams.discounts = [{ promotion_code: promotion_code_id }];
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return {
    session_id: session.id,
    url: session.url!,
  };
}

async function validatePromoCode(
  stripe: Stripe,
  promoCode: string
): Promise<string | null> {
  try {
    // Verify the promo code exists and is active
    const promo = await stripe.promotionCodes.list({
      code: promoCode,
      active: true,
      limit: 1,
    });

    return promo.data[0]?.id || null;
  } catch (error) {
    return null;
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

async function handleCheckout(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const supabase = getSupabase();
  if (!supabase) {
    res.status(500).json({ error: 'Supabase client not configured' });
    return;
  }

  const body = req.body;
  if (!body) {
    res.status(400).json({ error: 'Request body is required' });
    return;
  }

  const { plan_id, brand_monitor_id, promo_code, redirect_url, trial_days, legal_acceptance_id } = body;

  // Validate plan_id
  if (!plan_id || !PLANS[plan_id]) {
    res.status(400).json({ error: 'Invalid plan_id' });
    return;
  }

  // Default to 7-day free trial if not explicitly set
  const effectiveTrialDays = trial_days !== undefined ? trial_days : 7;

  const plan = PLANS[plan_id];

  // Get user info from brand monitor
  const { data: brandData, error: brandError } = await supabase
    .from('brand_monitors')
    .select('owner_id')
    .eq('id', brand_monitor_id)
    .single();

  if (brandError || !brandData) {
    res.status(404).json({ error: 'Brand monitor not found' });
    return;
  }

  const userId = brandData.owner_id;

  // Get user email
  const { data: userData, error: userError } = await supabase
    .from('auth.users')
    .select('email')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const email = userData.email;

  try {
    const accepted = await verifyLegalAcceptanceId(supabase, userId, typeof legal_acceptance_id === 'string' ? legal_acceptance_id : null);
    if (!accepted) {
      res.status(428).json({
        error: 'Legal acceptance required before checkout',
        code: 'LEGAL_ACCEPTANCE_REQUIRED',
        required_versions: BRAND_GUARD_LEGAL_VERSIONS,
      });
      return;
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Legal acceptance verification failed' });
    return;
  }

  // Validate promo code if provided
  let promotionCodeId: string | undefined;
  if (promo_code) {
    const stripe = getStripe();
    const validPromotionCodeId = await validatePromoCode(stripe, promo_code);
    if (!validPromotionCodeId) {
      res.status(400).json({ error: 'Invalid or inactive promo code' });
      return;
    }
    promotionCodeId = validPromotionCodeId;
  }

  try {
    // Get or create Stripe customer
    const { customer_id } = await getOrCreateStripeCustomer(supabase, userId, email);

    // Create checkout session (with free trial — no credit card required)
    const { session_id, url } = await createStripeCheckoutSession(
      customer_id,
      plan.stripe_price_id,
      redirect_url || `${process.env.NEXT_PUBLIC_APP_URL}/brand-guard?payment=success`,
      `${process.env.NEXT_PUBLIC_APP_URL}/brand-guard`,
      promotionCodeId,
      effectiveTrialDays
    );

    res.status(200).json({
      session_id,
      url,
      plan_id,
      plan_name: plan.name,
      price_usd: plan.price_usd,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}

export default handleCheckout;
