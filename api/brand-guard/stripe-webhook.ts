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
import Stripe from 'stripe';

// ── Config ────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// Initialize Stripe SDK
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-04-30.basil',
});

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
// NOTE: Subscription price IDs are resolved at runtime from STRIPE_*_PRICE_ID
//   env vars. The GUARDIAN/SENTINEL/FORTRESS_PRICE_ID aliases below ensure
//   both the `STRIPE_BG_GUARDIAN_PRICE_ID` and `STRIPE_GUARDIAN_PRICE_ID`
//   env var patterns are covered without duplication.

function buildPriceMap(): Record<string, { credits: number; name: string; type: 'credits' | 'subscription'; plan_id?: string }> {
  const map: Record<string, { credits: number; name: string; type: 'credits' | 'subscription'; plan_id?: string }> = {
    // Pay-as-you-go credit packages
    [process.env.STRIPE_BG_STARTER_PRICE_ID || 'price_bg_starter']: { credits: 5, name: 'Brand Guard Starter', type: 'credits' },
    [process.env.STRIPE_BG_BASIC_PRICE_ID || 'price_bg_basic']: { credits: 10, name: 'Brand Guard Basic', type: 'credits' },
    [process.env.STRIPE_BG_PRO_PRICE_ID || 'price_bg_pro']: { credits: 25, name: 'Brand Guard Pro', type: 'credits' },
    [process.env.STRIPE_BG_WHALE_PRICE_ID || 'price_bg_whale']: { credits: 110, name: 'Brand Guard Whale (100+10 bonus)', type: 'credits' },
    // Subscription plans (STRIPE_BG_* pattern)
    [process.env.STRIPE_BG_GUARDIAN_PRICE_ID || 'price_bg_guardian']: { credits: 50, name: 'Guardian Monthly', type: 'subscription', plan_id: 'guardian' },
    [process.env.STRIPE_BG_SENTINEL_PRICE_ID || 'price_bg_sentinel']: { credits: 200, name: 'Sentinel Monthly', type: 'subscription', plan_id: 'sentinel' },
    [process.env.STRIPE_BG_FORTRESS_PRICE_ID || 'price_bg_fortress']: { credits: -1, name: 'Fortress Monthly (unlimited)', type: 'subscription', plan_id: 'fortress' },
  };

  // Add STRIPE_* pattern aliases (Guardian/Sentinel/Fortress) if different from BG_* keys
  const aliases: Array<[string, { credits: number; name: string; type: 'credits' | 'subscription'; plan_id?: string }]> = [
    [GUARDIAN_PRICE_ID, { credits: 50, name: 'Guardian ($29/mo)', type: 'subscription' as const, plan_id: 'guardian' }],
    [SENTINEL_PRICE_ID, { credits: 200, name: 'Sentinel ($99/mo)', type: 'subscription' as const, plan_id: 'sentinel' }],
    [FORTRESS_PRICE_ID, { credits: -1, name: 'Fortress ($299/mo, unlimited)', type: 'subscription' as const, plan_id: 'fortress' }],
  ];

  for (const [key, val] of aliases) {
    if (!map[key]) {
      map[key] = val;
    }
  }

  return map;
}

const PRICE_MAP = buildPriceMap();

// ── Supabase Client ────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
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

// ── Subscription Status Mapping ───────────────────────────────────────────────
// Maps Stripe subscription.status to our Supabase status values.
// Stripe statuses: active, past_due, canceled, unpaid, trialing, incomplete,
//   incomplete_expired, paused
// Our statuses: active, trialing, trial_ending, past_due, canceled, expired

function mapSubscriptionStatus(
  stripeStatus: string,
  cancelAtPeriodEnd?: boolean
): string {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return cancelAtPeriodEnd ? 'canceled' : 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'expired';
    case 'paused':
      return 'canceled';
    default:
      return stripeStatus; // passthrough for unknown statuses
  }
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

  if (!sigHeader) {
    console.error('[bg-webhook] No stripe-signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }

  if (!webhookSecret) {
    console.error('[bg-webhook] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Get raw body for signature verification
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  let event: Stripe.Event;

  try {
    // Use Stripe SDK to verify signature and construct event
    event = stripe.webhooks.constructEvent(rawBody, sigHeader, webhookSecret);
  } catch (err: any) {
    console.error('[bg-webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log(`[bg-webhook] Received event: ${event.type}`);

  // ── Route by event type ───────────────────────────────────────────────
  switch (event.type) {
    // ══════════════════════════════════════════════════════════════════════
    // checkout.session.completed — Unified handler for credit purchases +
    //   subscription signups (including no-card trial flow)
    // ══════════════════════════════════════════════════════════════════════
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const customerEmail = session.customer_email || session.customer_details?.email;
      const paymentStatus = session.payment_status;

      // For trial signups (payment_method_collection: 'if_required'),
      // payment_status may be 'no_payment_required' during trial — treat as success.
      const isPaidOrTrial = paymentStatus === 'paid' || paymentStatus === 'no_payment_required';

      if (!isPaidOrTrial) {
        console.log(`[bg-webhook] Session not paid yet: ${session.id} (status: ${paymentStatus})`);
        return res.status(200).json({ received: true, skipped: 'not_paid' });
      }

      if (!userId) {
        console.error('[bg-webhook] Missing user_id in session metadata');
        return res.status(400).json({ error: 'Missing user_id in metadata' });
      }

      // Resolve credits and plan info from metadata or price lookup
      const lineItems = session.line_items?.data || [];
      const { credits, packageId, type, planId } = resolveCredits(session.metadata || {}, lineItems);
      const supabase = getSupabase();

      // ── Subscription checkout (Guardian / Sentinel / Fortress) ───────────
      if (type === 'subscription' && planId) {
        const planConfig = Object.values(PLAN_CONFIG).find(p => p.plan_id === planId);
        if (!planConfig) {
          console.error(`[bg-webhook] Unknown plan_id in subscription checkout: ${planId}`);
          return res.status(400).json({ error: 'Unknown subscription plan' });
        }

        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;

        // Check if subscription already exists (upgrade)
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
              status: paymentStatus === 'no_payment_required' ? 'trialing' : 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('owner_id', userId)
            .eq('plan_id', planId);

          if (updateError) {
            console.error(`[bg-webhook] Failed to update subscription: ${updateError.message}`);
          } else {
            console.log(`[bg-webhook] ✅ Updated existing ${planConfig.name} subscription for ${userId}`);
          }
        } else {
          // Create new subscription record
          // Note: period dates come from the subscription.created event, not the checkout session.
          // We set them here as placeholders; the subscription.created handler will update them.
          const { error: subError } = await supabase
            .from('brand_guard_subscriptions')
            .insert({
              owner_id: userId,
              brand_monitor_id: session.metadata?.brand_monitor_id || null,
              plan_id: planId,
              status: paymentStatus === 'no_payment_required' ? 'trialing' : 'active',
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
        }

        // Grant initial or renewal monthly credits
        const monthlyCredits = planConfig.monthly_credits === -1 ? 999999 : planConfig.monthly_credits;
        if (monthlyCredits > 0) {
          const { error: creditError } = await supabase.rpc('add_brand_guard_credits', {
            p_owner_id: userId,
            p_amount: monthlyCredits,
            p_transaction_type: 'subscription_grant',
            p_payment_method: 'stripe',
            p_payment_reference: stripeSubscriptionId as string,
            p_amount_usd: planConfig.price_usd,
            p_description: `${planConfig.name} subscription — ${monthlyCredits === 999999 ? 'unlimited' : monthlyCredits} monthly credits`,
          });
          if (creditError) {
            console.error('[bg-webhook] Failed to grant subscription credits:', creditError);
          } else {
            console.log(`[bg-webhook] ✅ Granted ${monthlyCredits} initial credits for ${planConfig.name}`);
          }
        }

        break;
      }

      // ── One-time credit purchase ───────────────────────────────────────
      if (credits <= 0) {
        console.error(`[bg-webhook] Could not resolve credits for session ${session.id}`);
        return res.status(400).json({ error: 'Could not resolve credit amount' });
      }

      const { data, error } = await supabase.rpc('add_brand_guard_credits', {
        p_owner_id: userId,
        p_amount: credits,
        p_transaction_type: 'purchase',
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
          status: mapSubscriptionStatus(subscription.status, false),
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
          status: mapSubscriptionStatus(subscription.status, subscription.cancel_at_period_end),
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