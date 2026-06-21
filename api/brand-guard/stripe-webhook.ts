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
 *    customer.subscription.updated, customer.subscription.deleted,
 *    invoice.payment_succeeded, invoice.payment_failed,
 *    customer.subscription.trial_will_end
 *
 * Stripe Products to create:
 *   - Brand Guard Starter (5 credits / $5)  → price: price_bg_starter
 *   - Brand Guard Basic (10 credits / $10)   → price: price_bg_basic
 *   - Brand Guard Pro (25 credits / $25)     → price: price_bg_pro
 *   - Brand Guard Whale (100+10 / $100)      → price: price_bg_whale
 *   - Guardian Plan ($29/mo)                 → price: price_bg_guardian
 *   - Sentinel Plan ($99/mo)                 → price: price_bg_sentinel
 *   - Fortress Plan ($299/mo)                → price: price_bg_fortress
 *
 * Idempotency:
 *   Every event is logged to stripe_processed_events (keyed by event.id).
 *   Before processing, we check if already processed. If so, return 200 immediately.
 *   This prevents double-crediting when Stripe retries on 5xx / timeout.
 *
 * Subscription credit flow:
 *   - Initial grant: checkout.session.completed (subscription mode)
 *   - Renewals:      invoice.payment_succeeded (billing_reason = 'subscription_cycle')
 *   - customer.subscription.created does NOT grant credits (checkout already did)
 *   - customer.subscription.updated does NOT grant renewal credits (invoice handles it)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────
const env = (name: string, fallback = '') => (process.env[name] || fallback).trim();
const supabaseUrl = env('VITE_SUPABASE_URL', env('SUPABASE_URL'));
const supabaseServiceKey = env('SUPABASE_SECRET_API_KEY', env('SUPABASE_SERVICE_ROLE_KEY'));
const webhookSecret = env('STRIPE_WEBHOOK_SECRET');

// Stripe Subscription Price IDs (set in Stripe Dashboard, then copy here)
const GUARDIAN_PRICE_ID = env('STRIPE_BG_GUARDIAN_PRICE_ID', env('STRIPE_GUARDIAN_PRICE_ID', 'price_1TcC6Z1lUBogdwcDetJfQtGS'));
const SENTINEL_PRICE_ID = env('STRIPE_BG_SENTINEL_PRICE_ID', env('STRIPE_SENTINEL_PRICE_ID', 'price_1TcC6Z1lUBogdwcDzNKnTEkh'));
const FORTRESS_PRICE_ID = env('STRIPE_BG_FORTRESS_PRICE_ID', env('STRIPE_FORTRESS_PRICE_ID', 'price_1TcC6Z1lUBogdwcDgTFlMRFf'));

// ── Plan Configuration ────────────────────────────────────────────────────────
const PLAN_CONFIG: Record<string, { name: string; price_usd: number; monthly_credits: number; brands_included: number; plan_id: string }> = {
  [GUARDIAN_PRICE_ID]: { name: 'Guardian', price_usd: 29,  monthly_credits: 50,     brands_included: 3,   plan_id: 'guardian' },
  [SENTINEL_PRICE_ID]: { name: 'Sentinel', price_usd: 99,  monthly_credits: 200,    brands_included: 10,  plan_id: 'sentinel' },
  [FORTRESS_PRICE_ID]: { name: 'Fortress', price_usd: 299, monthly_credits: -1,     brands_included: -1,  plan_id: 'fortress' }, // -1 = unlimited
};

// ── Credit Package Lookup ─────────────────────────────────────────────────────
// Maps Stripe price_id → { credits, package_name, type }
const PRICE_MAP: Record<string, { credits: number; name: string; type: 'credits' | 'subscription'; plan_id?: string }> = {
  // Pay-as-you-go credit packages
  [env('STRIPE_BG_STARTER_PRICE_ID', 'price_1TcC6R1lUBogdwcDsg8wYTgx')]: { credits: 5,   name: 'Brand Guard Starter',                     type: 'credits' },
  [env('STRIPE_BG_BASIC_PRICE_ID', 'price_1TcC6S1lUBogdwcDuCMkWIJW')]:   { credits: 10,  name: 'Brand Guard Basic',                       type: 'credits' },
  [env('STRIPE_BG_PRO_PRICE_ID', 'price_1TcC6S1lUBogdwcDsI9CF0PD')]:     { credits: 25,  name: 'Brand Guard Pro',                         type: 'credits' },
  [env('STRIPE_BG_WHALE_PRICE_ID', 'price_1TcC6S1lUBogdwcDGonv0mZQ')]:   { credits: 110, name: 'Brand Guard Whale (100+10 bonus)',         type: 'credits' },
  // Subscription plans
  [GUARDIAN_PRICE_ID]: { credits: 50,  name: 'Guardian ($29/mo)',              type: 'subscription', plan_id: 'guardian' },
  [SENTINEL_PRICE_ID]: { credits: 200, name: 'Sentinel ($99/mo)',              type: 'subscription', plan_id: 'sentinel' },
  [FORTRESS_PRICE_ID]: { credits: -1,  name: 'Fortress ($299/mo, unlimited)',  type: 'subscription', plan_id: 'fortress' },
};

// ── Supabase Client ────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ── Idempotency ────────────────────────────────────────────────────────────────
// Returns true if this event has already been processed (and logs it if not).
// Uses INSERT ... ON CONFLICT DO NOTHING + count to detect duplicates.

async function markEventProcessed(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  eventType: string,
  ownerId?: string
): Promise<{ alreadyProcessed: boolean }> {
  const { error } = await supabase
    .from('stripe_processed_events')
    .insert({ event_id: eventId, event_type: eventType, owner_id: ownerId || null })
    // ON CONFLICT DO NOTHING — if row already exists, error code is 23505
    .select();

  if (error) {
    // Duplicate key → already processed
    if (error.code === '23505') {
      return { alreadyProcessed: true };
    }
    // Real error — log but don't block (risk one double-process vs blocking all processing)
    console.error('[bg-webhook] Could not mark event processed:', error.message);
  }

  return { alreadyProcessed: false };
}

async function releaseProcessedEvent(
  supabase: ReturnType<typeof createClient>,
  eventId: string
): Promise<void> {
  const { error } = await supabase
    .from('stripe_processed_events')
    .delete()
    .eq('event_id', eventId);
  if (error) {
    console.error('[bg-webhook] Could not release failed event:', error.message);
  }
}

// ── Stripe Signature Verification ──────────────────────────────────────────────
// Verifies the webhook signature using the raw body and signing secret.
// Uses Web Crypto API (Node 18+) — no stripe npm package needed.

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<{ verified: boolean; event: any | null; error?: string }> {
  if (!sigHeader) {
    return { verified: false, event: null, error: 'Missing stripe-signature header' };
  }

  // Parse the signature header: t=timestamp,v1=signature
  const sigMap: Record<string, string> = {};
  for (const element of sigHeader.split(',')) {
    const eqIdx = element.indexOf('=');
    if (eqIdx > 0) {
      sigMap[element.slice(0, eqIdx).trim()] = element.slice(eqIdx + 1).trim();
    }
  }

  const timestamp = sigMap['t'];
  const signature = sigMap['v1'];

  if (!timestamp || !signature) {
    return { verified: false, event: null, error: 'Invalid signature format' };
  }

  // Check timestamp tolerance (5 minutes) first — cheap check before crypto
  const eventTime = parseInt(timestamp, 10) * 1000;
  if (Math.abs(Date.now() - eventTime) > 5 * 60 * 1000) {
    return { verified: false, event: null, error: 'Event timestamp too old or too new' };
  }

  // Compute HMAC-SHA256 over "${timestamp}.${payload}"
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const hmacBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(`${timestamp}.${payload}`)
  );

  const computedSig = Array.from(new Uint8Array(hmacBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison to prevent timing attacks
  // Both must be same length and every byte must match
  if (computedSig.length !== signature.length) {
    return { verified: false, event: null, error: 'Signature length mismatch' };
  }
  let diff = 0;
  for (let i = 0; i < computedSig.length; i++) {
    diff |= computedSig.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (diff !== 0) {
    return { verified: false, event: null, error: 'Signature verification failed' };
  }

  try {
    return { verified: true, event: JSON.parse(payload) };
  } catch {
    return { verified: false, event: null, error: 'Failed to parse event JSON' };
  }
}

// ── Credit Package Resolution ──────────────────────────────────────────────────
// Resolves credits from checkout metadata or price_id lookup.
//
// Priority order:
//   1. metadata.credits (explicit credit count set by our checkout session)
//   2. metadata.package_id looked up in PRICE_MAP
//      (handles subscription checkouts where credits aren't set explicitly
//       but package_id = the Stripe price ID — Stripe does not always expand
//       line_items in webhook payloads unless explicitly requested)
//   3. line_items price_id lookup (fallback)

function resolveCredits(
  metadata: Record<string, string | undefined>,
  lineItems: Array<{ price?: { id?: string } }>
): { credits: number; packageId: string; type: 'credits' | 'subscription'; planId?: string } {
  // 1. Explicit credit count in metadata
  const metaCredits = parseInt(metadata.credits || '0', 10);
  if (metaCredits > 0) {
    return {
      credits: metaCredits,
      packageId: metadata.package_id || '',
      type: (metadata.type as 'credits' | 'subscription') || 'credits',
      planId: metadata.plan_id,
    };
  }

  // 2. metadata.package_id → PRICE_MAP lookup
  // Subscription checkouts set package_id = price_id but may omit credits
  const metaPackageId = metadata.package_id || '';
  if (metaPackageId && PRICE_MAP[metaPackageId]) {
    const pkg = PRICE_MAP[metaPackageId];
    return { credits: pkg.credits, packageId: metaPackageId, type: pkg.type, planId: pkg.plan_id };
  }

  // 3. Fall back to price_id lookup from line items (only present if checkout
  //    session was created with expand: ['line_items'])
  for (const item of lineItems) {
    const priceId = item.price?.id;
    if (priceId && PRICE_MAP[priceId]) {
      const pkg = PRICE_MAP[priceId];
      return { credits: pkg.credits, packageId: priceId, type: pkg.type, planId: pkg.plan_id };
    }
  }

  return { credits: 0, packageId: metaPackageId || 'unknown', type: 'credits' };
}

function mapSubscriptionStatus(stripeStatus: string, cancelAtPeriodEnd = false): string {
  switch (stripeStatus) {
    // Trial access is active access in the current database status model.
    case 'trialing': return 'active';
    case 'active': return cancelAtPeriodEnd ? 'canceled' : 'active';
    case 'past_due': return 'past_due';
    case 'canceled':
    case 'unpaid': return 'expired';
    case 'paused': return 'canceled';
    default: return stripeStatus;
  }
}

// ── Webhook Handler ───────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sigHeader = req.headers['stripe-signature'] as string;
  const isDevelopment = process.env.NODE_ENV === 'development' && process.env.VERCEL_ENV !== 'production';

  if (!isDevelopment && !webhookSecret) {
    console.error('[bg-webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(503).json({ error: 'Webhook verification is not configured' });
  }

  let event: any;

  if (!isDevelopment) {
    // Production: verify signature using raw body
    if (!sigHeader) {
      console.error('[bg-webhook] No stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const verification = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
    if (!verification.verified) {
      console.error('[bg-webhook] Signature verification failed:', verification.error);
      return res.status(400).json({ error: 'Invalid signature', detail: verification.error });
    }
    event = verification.event;
  } else {
    // Development: parse body directly
    console.warn('[bg-webhook] ⚠️ Development mode — skipping signature verification');
    event = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  }

  const eventId   = event.id   as string;
  const eventType = event.type as string;

  console.log(`[bg-webhook] Received event: ${eventType} (${eventId})`);

  // ── Idempotency guard ─────────────────────────────────────────────────────
  // Determine owner_id early for logging; it may be undefined for some events
  const ownerIdForLog: string | undefined =
    event.data?.object?.metadata?.user_id ||
    event.data?.object?.metadata?.owner_id ||
    undefined;

  const supabase = getSupabase();
  const { alreadyProcessed } = await markEventProcessed(supabase, eventId, eventType, ownerIdForLog);
  if (alreadyProcessed) {
    console.log(`[bg-webhook] ✅ Event ${eventId} already processed — skipping (idempotent)`);
    return res.status(200).json({ received: true, idempotent: true });
  }

  // ── Route by event type ───────────────────────────────────────────────────
  try {
    switch (eventType) {

      // ════════════════════════════════════════════════════════════════════════
      // checkout.session.completed
      // Handles both one-time credit purchases and new subscription checkouts.
      // NOTE: For subscriptions, this is the ONLY place initial credits are granted.
      //       customer.subscription.created does NOT re-grant them.
      // ════════════════════════════════════════════════════════════════════════
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const paymentStatus = session.payment_status;

        const isPaidOrTrial = paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
        if (!isPaidOrTrial) {
          console.log(`[bg-webhook] Session not paid yet: ${session.id} (status: ${paymentStatus})`);
          return res.status(200).json({ received: true, skipped: 'not_paid' });
        }

        if (!userId) {
          console.error('[bg-webhook] Missing user_id in session metadata');
          return res.status(400).json({ error: 'Missing user_id in metadata' });
        }

        // Main scan-credit purchases share this Stripe account and can be
        // delivered to the Brand Guard endpoint. Keep the ledgers separate.
        if (session.metadata?.type === 'scan_credits') {
          const scanCredits = Number(session.metadata?.credits || 0);
          if (!Number.isInteger(scanCredits) || scanCredits <= 0) {
            await releaseProcessedEvent(supabase, eventId);
            return res.status(400).json({ error: 'Invalid scan credit metadata' });
          }
          const { error: scanCreditError } = await supabase.rpc('add_scan_credits', {
            p_owner_id: userId,
            p_credits: scanCredits,
            p_reference: session.id,
            p_amount_usd: session.amount_total ? session.amount_total / 100 : null,
          });
          if (scanCreditError) {
            await releaseProcessedEvent(supabase, eventId);
            return res.status(500).json({ error: 'Failed to grant scan credits' });
          }
          break;
        }

        const lineItems = session.line_items?.data || [];
        const { credits, packageId, type, planId } = resolveCredits(session.metadata || {}, lineItems);

        // ── Subscription checkout ──────────────────────────────────────────
        if (type === 'subscription' && planId) {
          const planConfig = PLAN_CONFIG[
            // Try price ID first, then planId lookup
            Object.keys(PLAN_CONFIG).find(k => PLAN_CONFIG[k].plan_id === planId) || ''
          ];

          if (!planConfig) {
            console.error(`[bg-webhook] Unknown plan_id in subscription checkout: ${planId}`);
            return res.status(400).json({ error: 'Unknown subscription plan' });
          }

          const stripeCustomerId    = session.customer as string;
          const stripeSubscriptionId = session.subscription as string;
          const monthlyCredits = planConfig.monthly_credits === -1 ? 999999 : planConfig.monthly_credits;

          // Upsert subscription record (handles upgrade/downgrade gracefully)
          const { error: upsertError } = await supabase
            .from('brand_guard_subscriptions')
            .upsert(
              {
                owner_id:                 userId,
                brand_monitor_id:         session.metadata?.brand_monitor_id || null,
                plan_id:                  planId,
                status:                   'active',
                current_period_start:     new Date((session.current_period_start || Date.now() / 1000) * 1000).toISOString(),
                current_period_end:       new Date((session.current_period_end   || Date.now() / 1000 + 30*24*3600) * 1000).toISOString(),
                cancel_at_period_end:     false,
                monthly_credits_included: monthlyCredits,
                monthly_credits_used:     0,
                brands_included:          planConfig.brands_included === -1 ? 999 : planConfig.brands_included,
                stripe_customer_id:       stripeCustomerId,
                stripe_subscription_id:   stripeSubscriptionId,
                stripe_price_id:          packageId,
                updated_at:               new Date().toISOString(),
              },
              { onConflict: 'owner_id' }
            );

          if (upsertError) {
            console.error(`[bg-webhook] Failed to upsert subscription: ${upsertError.message}`);
            await releaseProcessedEvent(supabase, eventId);
            return res.status(500).json({ error: 'Failed to activate subscription', detail: upsertError.message });
          } else {
            console.log(`[bg-webhook] ✅ Upserted ${planConfig.name} subscription for ${userId}`);
          }

          // Grant initial monthly credits (using checkout session ID as payment_reference
          // for idempotency at the RPC level too)
          if (monthlyCredits > 0) {
            const { error: creditError } = await supabase.rpc('add_brand_guard_credits', {
              p_owner_id:          userId,
              p_amount:            monthlyCredits,
              p_transaction_type:  'subscription_grant',
              p_payment_method:    'stripe',
              p_payment_reference: session.id,    // checkout session ID — unique per checkout
              p_amount_usd:        planConfig.price_usd,
              p_description:       `${planConfig.name} subscription — initial ${monthlyCredits === 999999 ? 'unlimited' : monthlyCredits} monthly credits`,
            });

            if (creditError) {
              console.error('[bg-webhook] Failed to grant subscription credits:', creditError.message);
              await releaseProcessedEvent(supabase, eventId);
              return res.status(500).json({ error: 'Failed to grant credits', detail: creditError.message });
            }

            console.log(`[bg-webhook] ✅ Granted ${monthlyCredits} initial credits for ${planConfig.name} to ${userId}`);
          }

          break;
        }

        // ── One-time credit purchase ───────────────────────────────────────
        if (credits <= 0) {
          console.error(`[bg-webhook] Could not resolve credits for session ${session.id}`);
          return res.status(400).json({ error: 'Could not resolve credit amount' });
        }

        const { error: creditError } = await supabase.rpc('add_brand_guard_credits', {
          p_owner_id:          userId,
          p_amount:            credits,
          p_transaction_type:  'purchase',
          p_payment_method:    'stripe',
          p_payment_reference: session.id,
          p_amount_usd:        session.amount_total ? session.amount_total / 100 : null,
          p_description:       `Purchased ${credits} Brand Guard credits via Stripe (${packageId})`,
        });

        if (creditError) {
          console.error('[bg-webhook] Failed to add credits:', creditError.message);
          await releaseProcessedEvent(supabase, eventId);
          return res.status(500).json({ error: 'Failed to add credits', detail: creditError.message });
        }

        console.log(`[bg-webhook] ✅ Added ${credits} Brand Guard credits to ${userId} (session ${session.id})`);
        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // customer.subscription.created
      // Stripe fires this after a subscription checkout completes. We use it only
      // to ensure the subscription DB record exists — credits were already granted
      // in checkout.session.completed. Do NOT re-grant credits here.
      // ════════════════════════════════════════════════════════════════════════
      case 'customer.subscription.created': {
        const subscription = event.data.object;
        const subUserId = subscription.metadata?.user_id;
        const priceId   = subscription.items?.data?.[0]?.price?.id;
        const planInfo  = PRICE_MAP[priceId];

        if (!subUserId || !planInfo) {
          // Not a Brand Guard subscription or missing metadata — skip
          console.log(`[bg-webhook] subscription.created — no action (user_id=${subUserId}, priceId=${priceId})`);
          break;
        }

        // Ensure subscription record exists (checkout.session.completed may have already upserted it)
        const { error: subError } = await supabase
          .from('brand_guard_subscriptions')
          .upsert(
            {
              owner_id:                 subUserId,
              brand_monitor_id:         subscription.metadata?.brand_monitor_id || null,
              plan_id:                  planInfo.plan_id || 'free',
              status:                   mapSubscriptionStatus(subscription.status),
              current_period_start:     new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end:       new Date(subscription.current_period_end   * 1000).toISOString(),
              monthly_credits_included: planInfo.credits === -1 ? 999999 : (planInfo.credits || 0),
              monthly_credits_used:     0,
              brands_included:          planInfo.plan_id === 'guardian' ? 3 : planInfo.plan_id === 'sentinel' ? 10 : 999,
              stripe_customer_id:       subscription.customer,
              stripe_subscription_id:   subscription.id,
              stripe_price_id:          priceId,
              updated_at:               new Date().toISOString(),
            },
            { onConflict: 'owner_id' }
          );

        if (subError) {
          console.error('[bg-webhook] subscription.created upsert error:', subError.message);
          await releaseProcessedEvent(supabase, eventId);
          return res.status(500).json({ error: 'Failed to activate subscription', detail: subError.message });
        } else {
          console.log(`[bg-webhook] ✅ subscription.created — DB record ensured for ${subUserId} (no credits re-granted)`);
        }

        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // customer.subscription.updated — Plan change, cancellation, or pause.
      // Does NOT grant credits — that is handled by invoice.payment_succeeded.
      // ════════════════════════════════════════════════════════════════════════
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const subUserId = subscription.metadata?.user_id;
        const priceId   = subscription.items?.data?.[0]?.price?.id;
        const planInfo  = PRICE_MAP[priceId] || { plan_id: 'free', credits: 0, name: 'Unknown', type: 'subscription' as const };

        if (!subUserId) {
          console.log(`[bg-webhook] subscription.updated — no user_id in metadata, skipping`);
          break;
        }

        const newStatus = mapSubscriptionStatus(subscription.status, subscription.cancel_at_period_end);

        const { error: updateError } = await supabase
          .from('brand_guard_subscriptions')
          .update({
            plan_id:                  planInfo.plan_id || 'free',
            status:                   newStatus,
            current_period_start:     new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end:       new Date(subscription.current_period_end   * 1000).toISOString(),
            cancel_at_period_end:     subscription.cancel_at_period_end || false,
            monthly_credits_included: planInfo.credits === -1 ? 999999 : (planInfo.credits || 0),
            brands_included:          planInfo.plan_id === 'guardian' ? 3 : planInfo.plan_id === 'sentinel' ? 10 : 999,
            stripe_price_id:          priceId,
            updated_at:               new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)
          .eq('owner_id', subUserId);

        if (updateError) {
          console.error('[bg-webhook] Failed to update subscription:', updateError.message);
        } else {
          console.log(`[bg-webhook] ✅ Updated subscription ${subscription.id} → status=${newStatus}, plan=${planInfo.plan_id}`);
        }

        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // customer.subscription.deleted — Subscription cancelled/expired.
      // ════════════════════════════════════════════════════════════════════════
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const subUserId = subscription.metadata?.user_id;

        if (!subUserId) {
          console.log(`[bg-webhook] subscription.deleted — no user_id in metadata, skipping`);
          break;
        }

        const { error: deleteError } = await supabase
          .from('brand_guard_subscriptions')
          .update({ status: 'expired', cancel_at_period_end: false, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id)
          .eq('owner_id', subUserId);

        if (deleteError) {
          console.error('[bg-webhook] Failed to mark subscription expired:', deleteError.message);
        } else {
          console.log(`[bg-webhook] ✅ Marked subscription ${subscription.id} as expired for ${subUserId}`);
        }

        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // invoice.payment_succeeded — Authoritative signal for billing events.
      //
      // billing_reason values:
      //   'subscription_create' — first payment (already handled by checkout.session.completed)
      //   'subscription_cycle'  — monthly renewal → grant fresh credits
      //   'subscription_update' — plan change (no extra credits)
      //   'manual'              — manually triggered invoice
      //
      // Renewal credits are ONLY granted here, not in subscription.updated.
      // ════════════════════════════════════════════════════════════════════════
      case 'invoice.payment_succeeded': {
        const invoice        = event.data.object;
        const subscriptionId = invoice.subscription as string;
        const billingReason  = invoice.billing_reason as string;

        if (!subscriptionId) {
          console.log('[bg-webhook] invoice.payment_succeeded — no subscription, skipping (one-time invoice)');
          break;
        }

        console.log(`[bg-webhook] invoice.payment_succeeded — billing_reason=${billingReason}, sub=${subscriptionId}`);

        // Only grant renewal credits on subscription_cycle
        if (billingReason !== 'subscription_cycle') {
          console.log(`[bg-webhook] Skipping credit grant for billing_reason=${billingReason}`);
          break;
        }

        // Look up the subscription to get owner_id and plan details
        const { data: sub, error: subFetchError } = await supabase
          .from('brand_guard_subscriptions')
          .select('owner_id, plan_id, monthly_credits_included, stripe_price_id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();

        if (subFetchError || !sub) {
          console.error(`[bg-webhook] Could not find subscription ${subscriptionId} for renewal:`, subFetchError?.message);
          break;
        }

        const userId = sub.owner_id;
        const priceId = sub.stripe_price_id;
        const planInfo = PRICE_MAP[priceId] || { name: sub.plan_id, credits: sub.monthly_credits_included };
        const renewalCredits = planInfo.credits === -1 ? 999999 : (planInfo.credits || sub.monthly_credits_included || 0);

        if (renewalCredits <= 0) {
          console.log(`[bg-webhook] No renewal credits to grant for plan ${sub.plan_id}`);
          break;
        }

        // Reset monthly_credits_used for the new billing period
        await supabase
          .from('brand_guard_subscriptions')
          .update({ monthly_credits_used: 0, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscriptionId);

        // Grant renewal credits (invoice.id is unique per invoice — idempotency already handled above)
        const { error: creditError } = await supabase.rpc('add_brand_guard_credits', {
          p_owner_id:          userId,
          p_amount:            renewalCredits,
          p_transaction_type:  'subscription_grant',
          p_payment_method:    'stripe',
          p_payment_reference: invoice.id,      // invoice ID is unique per billing cycle
          p_amount_usd:        invoice.amount_paid ? invoice.amount_paid / 100 : null,
          p_description:       `${planInfo.name || sub.plan_id} subscription renewal — ${renewalCredits === 999999 ? 'unlimited' : renewalCredits} monthly credits`,
        });

        if (creditError) {
          console.error('[bg-webhook] Failed to grant renewal credits:', creditError.message);
          await releaseProcessedEvent(supabase, eventId);
          return res.status(500).json({ error: 'Failed to grant renewal credits', detail: creditError.message });
        }

        console.log(`[bg-webhook] ✅ Granted ${renewalCredits} renewal credits to ${userId} (invoice ${invoice.id})`);
        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // invoice.payment_failed — Mark subscription as past_due.
      // ════════════════════════════════════════════════════════════════════════
      case 'invoice.payment_failed': {
        const invoice        = event.data.object;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        await supabase
          .from('brand_guard_subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscriptionId);

        console.log(`[bg-webhook] ⚠️ Payment failed for subscription ${subscriptionId}`);
        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // customer.subscription.trial_will_end — Stripe sends this three days
      // before trial expiry. The alert-delivery pipeline handles notification.
      // ════════════════════════════════════════════════════════════════════════
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object;
        const subUserId = subscription.metadata?.user_id;
        if (!subUserId) {
          console.log('[bg-webhook] trial_will_end — no user_id in metadata, skipping');
          break;
        }

        await supabase
          .from('brand_guard_subscriptions')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id)
          .eq('owner_id', subUserId);

        console.log(`[bg-webhook] Trial ending soon for subscription ${subscription.id}`);
        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // checkout.session.expired — User abandoned checkout (no action needed).
      // ════════════════════════════════════════════════════════════════════════
      case 'checkout.session.expired': {
        const session = event.data.object;
        console.log(`[bg-webhook] Checkout session expired: ${session.id}`);
        break;
      }

      default: {
        console.log(`[bg-webhook] Unhandled event type: ${eventType}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[bg-webhook] Unhandled error processing ${eventType}:`, msg);
    await releaseProcessedEvent(supabase, eventId);
    return res.status(500).json({ error: 'Internal webhook error', detail: msg });
  }

  // Always return 200 after successful processing
  return res.status(200).json({ received: true });
}

export const config = {
  maxDuration: 15,
};
