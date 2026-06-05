/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/stripe-webhook.ts — Brand Guard Stripe Webhook
 * ========================================================================
 * Handles Stripe webhook events for Brand Guard credit purchases.
 * Verifies signatures, adds credits via Supabase, and logs transactions.
 *
 * Endpoint: POST /api/brand-guard/stripe-webhook
 *
 * Setup:
 * 1. Go to Stripe Dashboard → Developers → Webhooks
 * 2. Add endpoint: https://agenticbro.app/api/brand-guard/stripe-webhook
 * 3. Copy the webhook signing secret to STRIPE_WEBHOOK_SECRET env var
 * 4. Select events: checkout.session.completed, customer.subscription.created,
 *    customer.subscription.updated, customer.subscription.deleted
 *
 * Stripe Products to create:
 *   - Brand Guard Starter (5 credits / $5)  → price: price_bg_starter
 *   - Brand Guard Basic (10 credits / $10)   → price: price_bg_basic
 *   - Brand Guard Pro (25 credits / $25)     → price: price_bg_pro
 *   - Brand Guard Whale (100+10 / $100)      → price: price_bg_whale
 *   - Guardian Plan ($29/mo)                 → price: price_bg_guardian
 *   - Sentinel Plan ($79/mo)                 → price: price_bg_sentinel
 *   - Fortress Plan ($199/mo)                → price: price_bg_fortress
 *
 * Subscription Plans (for Stripe Checkout):
 *   - Guardian:   $29/mo, 50 scans, 3 brands
 *   - Sentinel:   $99/mo, 200 scans, 10 brands
 *   - Fortress:   $299/mo, unlimited scans, unlimited brands
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// Stripe Subscription Price IDs (set in Stripe Dashboard, then copy here)
const GUARDIAN_PRICE_ID = process.env.STRIPE_GUARDIAN_PRICE_ID || 'price_guardian_12345';
const SENTINEL_PRICE_ID = process.env.STRIPE_SENTINEL_PRICE_ID || 'price_sentinel_67890';
const FORTRESS_PRICE_ID = process.env.STRIPE_FORTRESS_PRICE_ID || 'price_fortress_abcde';

// ── Plan Configuration ────────────────────────────────────────────────────────
const PLAN_CONFIG: Record<string, { name: string; price_usd: number; monthly_credits: number; brands_included: number; plan_id: string }> = {
  [GUARDIAN_PRICE_ID]: { name: 'Guardian', price_usd: 29, monthly_credits: 50, brands_included: 3, plan_id: 'guardian' },
  [SENTINEL_PRICE_ID]: { name: 'Sentinel', price_usd: 99, monthly_credits: 200, brands_included: 10, plan_id: 'sentinel' },
  [FORTRESS_PRICE_ID]: { name: 'Fortress', price_usd: 299, monthly_credits: -1, brands_included: -1, plan_id: 'fortress' }, // -1 = unlimited
};

// ── Credit Package Lookup ─────────────────────────────────────────────────────
// Maps Stripe price_id → { credits, package_name, type }
const PRICE_MAP: Record<string, { credits: number; name: string; type: 'credits' | 'subscription'; plan_id?: string }> = {
  // Pay-as-you-go credit packages (prices will be set in Stripe Dashboard)
  [process.env.STRIPE_BG_STARTER_PRICE_ID || 'price_bg_starter']: { credits: 5, name: 'Brand Guard Starter', type: 'credits' },
  [process.env.STRIPE_BG_BASIC_PRICE_ID || 'price_bg_basic']: { credits: 10, name: 'Brand Guard Basic', type: 'credits' },
  [process.env.STRIPE_BG_PRO_PRICE_ID || 'price_bg_pro']: { credits: 25, name: 'Brand Guard Pro', type: 'credits' },
  [process.env.STRIPE_BG_WHALE_PRICE_ID || 'price_bg_whale']: { credits: 110, name: 'Brand Guard Whale (100+10 bonus)', type: 'credits' },
  // Subscription plans
  [process.env.STRIPE_BG_GUARDIAN_PRICE_ID || 'price_bg_guardian']: { credits: 50, name: 'Guardian Monthly', type: 'subscription', plan_id: 'guardian' },
  [process.env.STRIPE_BG_SENTINEL_PRICE_ID || 'price_bg_sentinel']: { credits: 200, name: 'Sentinel Monthly', type: 'subscription', plan_id: 'sentinel' },
  [process.env.STRIPE_BG_FORTRESS_PRICE_ID || 'price_bg_fortress']: { credits: -1, name: 'Fortress Monthly (unlimited)', type: 'subscription', plan_id: 'fortress' },
  // Brand Guard Subscription plans (via new checkout flow)
  [GUARDIAN_PRICE_ID]: { credits: 50, name: 'Guardian ($29/mo)', type: 'subscription', plan_id: 'guardian' },
  [SENTINEL_PRICE_ID]: { credits: 200, name: 'Sentinel ($99/mo)', type: 'subscription', plan_id: 'sentinel' },
  [FORTRESS_PRICE_ID]: { credits: -1, name: 'Fortress ($299/mo, unlimited)', type: 'subscription', plan_id: 'fortress' },
};

// ── Supabase Client ────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ── Stripe Signature Verification ──────────────────────────────────────────────
// Verifies the webhook signature using the raw body and signing secret.
// Uses Web Crypto API (available in Node 18+ and Vercel Edge) instead of
// the stripe npm package to keep the bundle small.

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<{ verified: boolean; event: any | null; error?: string }> {
  if (!sigHeader) {
    return { verified: false, event: null, error: 'Missing stripe-signature header' };
  }

  // Parse the signature header
  const elements = sigHeader.split(',');
  const sigMap: Record<string, string> = {};
  for (const element of elements) {
    const [key, value] = element.split('=');
    sigMap[key.trim()] = value.trim();
  }

  const timestamp = sigMap['t'];
  const signature = sigMap['v1'];

  if (!timestamp || !signature) {
    return { verified: false, event: null, error: 'Invalid signature format' };
  }

  // Reconstruct the signed payload
  const signedPayload = `${timestamp}.${payload}`;

  // Compute HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(signedPayload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const hmacBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const computedSig = Array.from(new Uint8Array(hmacBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Compare signatures (constant-time comparison)
  if (computedSig.length !== signature.length) {
    return { verified: false, event: null, error: 'Signature mismatch' };
  }

  let mismatch = 0;
  for (let i = 0; i < computedSig.length; i++) {
    mismatch |= computedSig.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return { verified: false, event: null, error: 'Signature verification failed' };
  }

  // Check timestamp (reject events older than 5 minutes)
  const eventTime = parseInt(timestamp, 10) * 1000;
  const currentTime = Date.now();
  const tolerance = 5 * 60 * 1000; // 5 minutes

  if (Math.abs(currentTime - eventTime) > tolerance) {
    return { verified: false, event: null, error: 'Event timestamp too old' };
  }

  try {
    const event = JSON.parse(payload);
    return { verified: true, event };
  } catch (err) {
    return { verified: false, event: null, error: 'Failed to parse event JSON' };
  }
}

// ── Credit Package Resolution ──────────────────────────────────────────────────
// Resolves credits from metadata or price_id lookup.

function resolveCredits(
  metadata: Record<string, string | undefined>,
  lineItems: Array<{ price?: { id?: string } }>
): { credits: number; packageId: string; type: 'credits' | 'subscription'; planId?: string } {
  // 1. Metadata takes priority (set by our checkout session)
  const metaCredits = parseInt(metadata.credits || '0', 10);
  const metaPackageId = metadata.package_id || '';
  const metaType = (metadata.type as 'credits' | 'subscription') || 'credits';

  if (metaCredits > 0) {
    return {
      credits: metaCredits,
      packageId: metaPackageId,
      type: metaType,
      planId: metadata.plan_id,
    };
  }

  // 2. Fall back to price_id lookup from line items
  for (const item of lineItems) {
    const priceId = item.price?.id;
    if (priceId && PRICE_MAP[priceId]) {
      const pkg = PRICE_MAP[priceId];
      return {
        credits: pkg.credits,
        packageId: priceId,
        type: pkg.type,
        planId: pkg.plan_id,
      };
    }
  }

  // 3. Unknown — use default of 0
  return { credits: 0, packageId: metaPackageId || 'unknown', type: 'credits' };
}

// ── Webhook Handler ───────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sigHeader = req.headers['stripe-signature'] as string;

  // ── Development mode: skip signature verification ──────────────────────
  const isDev = !webhookSecret || process.env.NODE_ENV !== 'production';

  let event: any;

  if (!isDev && sigHeader) {
    // Production: verify signature
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const verification = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);

    if (!verification.verified) {
      console.error('[bg-webhook] Signature verification failed:', verification.error);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    event = verification.event;
  } else {
    // Development: parse body directly
    event = typeof req.body === 'object' ? req.body : JSON.parse(typeof req.body === 'string' ? req.body : '{}');

    if (!isDev && !sigHeader) {
      console.error('[bg-webhook] No stripe-signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }

    if (isDev) {
      console.warn('[bg-webhook] Development mode: skipping signature verification');
    }
  }

  console.log(`[bg-webhook] Received event: ${event.type}`);

  // ── Route by event type ───────────────────────────────────────────────
  switch (event.type) {
    // ══════════════════════════════════════════════════════════════════════
    // checkout.session.completed — One-time credit purchase
    // ══════════════════════════════════════════════════════════════════════
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const customerEmail = session.customer_email || session.customer_details?.email;
      const paymentStatus = session.payment_status;

      if (paymentStatus !== 'paid') {
        console.log(`[bg-webhook] Session not paid yet: ${session.id} (status: ${paymentStatus})`);
        return res.status(200).json({ received: true, skipped: 'not_paid' });
      }

      if (!userId) {
        console.error('[bg-webhook] Missing user_id in session metadata');
        return res.status(400).json({ error: 'Missing user_id in metadata' });
      }

      // Resolve credits from metadata or price lookup
      const lineItems = session.line_items?.data || [];
      const { credits, packageId, type } = resolveCredits(session.metadata || {}, lineItems);

      if (credits <= 0) {
        console.error(`[bg-webhook] Could not resolve credits for session ${session.id}`);
        return res.status(400).json({ error: 'Could not resolve credit amount' });
      }

      // Add credits via Supabase function
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('add_brand_guard_credits', {
        p_owner_id: userId,
        p_amount: credits,
        p_transaction_type: type === 'subscription' ? 'subscription_grant' : 'purchase',
        p_payment_method: 'stripe',
        p_payment_reference: session.id,
        p_amount_usd: session.amount_total ? session.amount_total / 100 : null,
        p_description: `Purchased ${credits} Brand Guard credits via Stripe (${packageId})`,
      });

      if (error) {
        console.error('[bg-webhook] Failed to add credits:', error);
        return res.status(500).json({ error: 'Failed to add credits', details: error.message });
      }

      console.log(`[bg-webhook] ✅ Added ${credits} Brand Guard credits to ${userId}:`, data);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // customer.subscription.created — New subscription
    // ══════════════════════════════════════════════════════════════════════
    case 'customer.subscription.created': {
      const subscription = event.data.object;
      const subUserId = subscription.metadata?.user_id;
      const priceId = subscription.items?.data?.[0]?.price?.id;
      const planInfo = PRICE_MAP[priceId] || { credits: 0, name: 'Unknown', type: 'subscription' as const, plan_id: 'free' };

      if (!subUserId) {
        console.error('[bg-webhook] Missing user_id in subscription metadata');
        return res.status(400).json({ error: 'Missing user_id' });
      }

      const supabase = getSupabase();

      // Create subscription record
      const { error: subError } = await supabase
        .from('brand_guard_subscriptions')
        .insert({
          owner_id: subUserId,
          brand_monitor_id: subscription.metadata?.brand_monitor_id || null,
          plan_id: planInfo.plan_id || 'free',
          status: 'active',
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          monthly_credits_included: planInfo.credits === -1 ? 999999 : (planInfo.credits || 0),
          monthly_credits_used: 0,
          brands_included: planInfo.plan_id === 'guardian' ? 3 : planInfo.plan_id === 'sentinel' ? 10 : 999,
          stripe_customer_id: subscription.customer,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
        });

      if (subError) {
        console.error('[bg-webhook] Failed to create subscription:', subError);
        // Don't fail the webhook — we can reconcile later
      }

      // Grant monthly credits (for Fortress, mark as unlimited via large number)
      const monthlyCredits = planInfo.credits === -1 ? 999999 : planInfo.credits;

      if (monthlyCredits > 0) {
        const { data: creditData, error: creditError } = await supabase.rpc('add_brand_guard_credits', {
          p_owner_id: subUserId,
          p_amount: monthlyCredits,
          p_transaction_type: 'subscription_grant',
          p_payment_method: 'stripe',
          p_payment_reference: subscription.id,
          p_amount_usd: null,
          p_description: `${planInfo.name} subscription — ${monthlyCredits === 999999 ? 'unlimited' : monthlyCredits} monthly credits`,
        });

        if (creditError) {
          console.error('[bg-webhook] Failed to grant subscription credits:', creditError);
        } else {
          console.log(`[bg-webhook] ✅ Granted ${monthlyCredits} monthly credits for ${planInfo.name} subscription to ${subUserId}`);
        }
      }

      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // customer.subscription.updated — Plan change or billing cycle renewal
    // ══════════════════════════════════════════════════════════════════════
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const subUserId = subscription.metadata?.user_id;
      const priceId = subscription.items?.data?.[0]?.price?.id;
      const planInfo = PRICE_MAP[priceId] || { plan_id: 'free', credits: 0, name: 'Unknown', type: 'subscription' as const };

      if (!subUserId) {
        console.error('[bg-webhook] Missing user_id in subscription update');
        return res.status(400).json({ error: 'Missing user_id' });
      }

      const supabase = getSupabase();

      // Update subscription record
      const { error: updateError } = await supabase
        .from('brand_guard_subscriptions')
        .update({
          plan_id: planInfo.plan_id || 'free',
          status: subscription.status === 'active' ? 'active' : subscription.status === 'trialing' ? 'trialing' : subscription.cancel_at_period_end ? 'canceled' : subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end || false,
          monthly_credits_included: planInfo.credits === -1 ? 999999 : (planInfo.credits || 0),
          brands_included: planInfo.plan_id === 'guardian' ? 3 : planInfo.plan_id === 'sentinel' ? 10 : 999,
          stripe_price_id: priceId,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)
        .eq('owner_id', subUserId);

      if (updateError) {
        console.error('[bg-webhook] Failed to update subscription:', updateError);
      } else {
        console.log(`[bg-webhook] ✅ Updated subscription ${subscription.id} to plan ${planInfo.plan_id}`);
      }

      // If billing cycle renewed (new period), grant fresh monthly credits
      const previousAttributes = event.data.previous_attributes;
      if (previousAttributes?.current_period_start && 
          previousAttributes.current_period_start !== subscription.current_period_start) {
        const monthlyCredits = planInfo.credits === -1 ? 999999 : planInfo.credits;

        // Reset monthly_credits_used
        await supabase
          .from('brand_guard_subscriptions')
          .update({ monthly_credits_used: 0 })
          .eq('stripe_subscription_id', subscription.id);

        // Grant new monthly credits
        if (monthlyCredits > 0) {
          await supabase.rpc('add_brand_guard_credits', {
            p_owner_id: subUserId,
            p_amount: monthlyCredits,
            p_transaction_type: 'subscription_grant',
            p_payment_method: 'stripe',
            p_payment_reference: subscription.id,
            p_amount_usd: null,
            p_description: `${planInfo.name} subscription renewal — ${monthlyCredits === 999999 ? 'unlimited' : monthlyCredits} monthly credits`,
          });
          console.log(`[bg-webhook] ✅ Granted ${monthlyCredits} renewal credits for ${planInfo.name}`);
        }
      }

      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // customer.subscription.deleted — Subscription cancelled/expired
    // ══════════════════════════════════════════════════════════════════════
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const subUserId = subscription.metadata?.user_id;

      if (!subUserId) {
        console.error('[bg-webhook] Missing user_id in subscription deletion');
        return res.status(400).json({ error: 'Missing user_id' });
      }

      const supabase = getSupabase();

      // Mark subscription as expired
      const { error: deleteError } = await supabase
        .from('brand_guard_subscriptions')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)
        .eq('owner_id', subUserId);

      if (deleteError) {
        console.error('[bg-webhook] Failed to mark subscription expired:', deleteError);
      } else {
        console.log(`[bg-webhook] ✅ Marked subscription ${subscription.id} as expired for ${subUserId}`);
      }

      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // invoice.payment_succeeded — Recurring payment confirmed
    // ══════════════════════════════════════════════════════════════════════
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      const customerId = invoice.customer;

      // Only handle subscription invoices (not one-time)
      if (!subscriptionId) {
        console.log('[bg-webhook] Skipping non-subscription invoice');
        break;
      }

      // We already handle renewal credits in subscription.updated
      // This event is logged for reconciliation purposes
      console.log(`[bg-webhook] Invoice payment confirmed: ${invoice.id} for subscription ${subscriptionId}`);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // invoice.payment_failed — Payment failed (subscription past_due)
    // ══════════════════════════════════════════════════════════════════════
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;

      if (!subscriptionId) break;

      const supabase = getSupabase();

      // Mark subscription as past_due
      await supabase
        .from('brand_guard_subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscriptionId);

      console.log(`[bg-webhook] ⚠️ Payment failed for subscription ${subscriptionId}`);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // checkout.session.completed — Brand Guard subscription signup (new flow)
    // ══════════════════════════════════════════════════════════════════════
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const customerEmail = session.customer_email || session.customer_details?.email;
      const paymentStatus = session.payment_status;

      if (paymentStatus !== 'paid') {
        console.log(`[bg-webhook] Session not paid yet: ${session.id} (status: ${paymentStatus})`);
        return res.status(200).json({ received: true, skipped: 'not_paid' });
      }

      if (!userId) {
        console.error('[bg-webhook] Missing user_id in session metadata');
        return res.status(400).json({ error: 'Missing user_id in metadata' });
      }

      const lineItems = session.line_items?.data || [];
      const { credits, packageId, type, planId } = resolveCredits(session.metadata || {}, lineItems);

      // Check if this is a subscription plan
      if (type === 'subscription' && planId) {
        // Handle subscription checkout (Guardian/Sentinel/Fortress plans)
        const planConfig = Object.values(PLAN_CONFIG).find(p => p.plan_id === planId);
        if (!planConfig) {
          console.error(`[bg-webhook] Unknown plan_id in subscription checkout: ${planId}`);
          return res.status(400).json({ error: 'Unknown subscription plan' });
        }

        const supabase = getSupabase();
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;

        // Check if subscription already exists
        const { data: existingSub } = await supabase
          .from('brand_guard_subscriptions')
          .select('*')
          .eq('owner_id', userId)
          .eq('plan_id', planId)
          .maybeSingle();

        if (existingSub && existingSub.stripe_subscription_id) {
          // Upgrade or update existing subscription
          const { error: updateError } = await supabase
            .from('brand_guard_subscriptions')
            .update({
              status: 'active',
              current_period_start: new Date(session.current_period_start * 1000).toISOString(),
              current_period_end: new Date(session.current_period_end * 1000).toISOString(),
              cancel_at_period_end: false,
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId as string,
              stripe_price_id: packageId,
              updated_at: new Date().toISOString(),
            })
            .eq('owner_id', userId)
            .eq('plan_id', planId);

          if (updateError) {
            console.error(`[bg-webhook] Failed to update subscription: ${updateError.message}`);
          }

          // Grant renewal credits if period restarted
          const previousAttributes = event.data.previous_attributes;
          if (previousAttributes?.current_period_start &&
              previousAttributes.current_period_start !== session.current_period_start) {
            const monthlyCredits = planConfig.monthly_credits === -1 ? 999999 : planConfig.monthly_credits;
            await supabase.rpc('add_brand_guard_credits', {
              p_owner_id: userId,
              p_amount: monthlyCredits,
              p_transaction_type: 'subscription_grant',
              p_payment_method: 'stripe',
              p_payment_reference: stripeSubscriptionId as string,
              p_amount_usd: planConfig.price_usd,
              p_description: `${planConfig.name} subscription renewal — ${monthlyCredits === 999999 ? 'unlimited' : monthlyCredits} monthly credits`,
            });
            console.log(`[bg-webhook] ✅ Granted ${monthlyCredits} renewal credits for ${planConfig.name}`);
          }
        } else {
          // Create new subscription
          const { error: subError } = await supabase
            .from('brand_guard_subscriptions')
            .insert({
              owner_id: userId,
              brand_monitor_id: session.metadata?.brand_monitor_id || null,
              plan_id: planId,
              status: 'active',
              current_period_start: new Date(session.current_period_start * 1000).toISOString(),
              current_period_end: new Date(session.current_period_end * 1000).toISOString(),
              cancel_at_period_end: false,
              monthly_credits_included: planConfig.monthly_credits === -1 ? 999999 : planConfig.monthly_credits,
              monthly_credits_used: 0,
              brands_included: planConfig.brands_included === -1 ? 999 : planConfig.brands_included,
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId as string,
              stripe_price_id: packageId,
              created_at: new Date().toISOString(),
            });

          if (subError) {
            console.error(`[bg-webhook] Failed to create subscription: ${subError.message}`);
          } else {
            console.log(`[bg-webhook] ✅ Created new ${planConfig.name} subscription for ${userId}`);
          }

          // Grant initial monthly credits
          const monthlyCredits = planConfig.monthly_credits === -1 ? 999999 : planConfig.monthly_credits;
          if (monthlyCredits > 0) {
            await supabase.rpc('add_brand_guard_credits', {
              p_owner_id: userId,
              p_amount: monthlyCredits,
              p_transaction_type: 'subscription_grant',
              p_payment_method: 'stripe',
              p_payment_reference: stripeSubscriptionId as string,
              p_amount_usd: planConfig.price_usd,
              p_description: `${planConfig.name} subscription — ${monthlyCredits === 999999 ? 'unlimited' : monthlyCredits} monthly credits`,
            });
            console.log(`[bg-webhook] ✅ Granted ${monthlyCredits} initial credits for ${planConfig.name}`);
          }
        }
      } else {
        // One-time credit purchase (existing logic)
        if (credits <= 0) {
          console.error(`[bg-webhook] Could not resolve credits for session ${session.id}`);
          return res.status(400).json({ error: 'Could not resolve credit amount' });
        }

        // Add credits via Supabase function
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('add_brand_guard_credits', {
          p_owner_id: userId,
          p_amount: credits,
          p_transaction_type: type === 'subscription' ? 'subscription_grant' : 'purchase',
          p_payment_method: 'stripe',
          p_payment_reference: session.id,
          p_amount_usd: session.amount_total ? session.amount_total / 100 : null,
          p_description: `Purchased ${credits} Brand Guard credits via Stripe (${packageId})`,
        });

        if (error) {
          console.error('[bg-webhook] Failed to add credits:', error);
          return res.status(500).json({ error: 'Failed to add credits', details: error.message });
        }

        console.log(`[bg-webhook] ✅ Added ${credits} Brand Guard credits to ${userId}:`, data);
      }

      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // customer.subscription.trial_will_end — Trial ending soon (3 days before)
    // ══════════════════════════════════════════════════════════════════════
    case 'customer.subscription.trial_will_end': {
      const subscription = event.data.object;
      const subUserId = subscription.metadata?.user_id;
      const priceId = subscription.items?.data?.[0]?.price?.id;
      const planInfo = PRICE_MAP[priceId] || { name: 'Unknown', plan_id: 'free' };

      if (!subUserId) {
        console.error('[bg-webhook] Missing user_id in trial_will_end');
        break;
      }

      // Update subscription status to trial_ending in Supabase
      const supabase = getSupabase();
      await supabase
        .from('brand_guard_subscriptions')
        .update({
          status: 'trial_ending',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)
        .eq('owner_id', subUserId);

      // Send trial-ending email via Resend
      try {
        const { data: userData } = await supabase
          .from('auth.users')  // eslint-disable-line
          .select('email')
          .eq('id', subUserId)
          .single();

        if (userData?.email) {
          const resendUrl = process.env.RESEND_API_KEY
            ? 'https://api.resend.com/emails'
            : null;

          if (resendUrl) {
            await fetch(resendUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: process.env.RESEND_FROM_EMAIL || 'alerts@agenticbro.app',
                to: userData.email,
                subject: `Your Brand Guard ${planInfo.name} trial ends in 3 days`,
                html: `
                  <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f59e0b;">⏰ Your free trial is ending soon</h2>
                    <p>Your Brand Guard <strong>${planInfo.name}</strong> trial ends in 3 days. 
                    Add a payment method to keep your brand protection active.</p>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://agenticbro.app'}/brand-guard/settings" 
                       style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; 
                              text-decoration: none; border-radius: 8px; margin: 16px 0;">
                      Add Payment Method
                    </a>
                    <p style="color: #9ca3af; font-size: 14px; margin-top: 24px;">
                      If no payment method is added, your subscription will cancel automatically — no charges, no surprises.
                    </p>
                  </div>
                `,
              }),
            });
            console.log(`[bg-webhook] ✅ Sent trial-ending email to ${userData.email}`);
          }
        }
      } catch (emailError) {
        console.error('[bg-webhook] Failed to send trial-ending email:', emailError);
      }

      console.log(`[bg-webhook] ⏰ Trial ending soon for subscription ${subscription.id} (plan: ${planInfo.name})`);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // checkout.session.expired — Checkout expired (not completed in time)
    // ══════════════════════════════════════════════════════════════════════
    case 'checkout.session.expired': {
      const session = event.data.object;
      console.log(`[bg-webhook] Checkout session expired: ${session.id}`);
      // No action needed — user abandoned checkout
      break;
    }

    default: {
      console.log(`[bg-webhook] Unhandled event type: ${event.type}`);
    }
  }

  // Always return 200 to Stripe so it doesn't retry
  return res.status(200).json({ received: true });
}

export const config = {
  maxDuration: 15,
};