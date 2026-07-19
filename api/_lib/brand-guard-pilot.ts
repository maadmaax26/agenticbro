import type { SupabaseClient } from '@supabase/supabase-js';

export const BRAND_GUARD_PILOT_CODE = 'BGPILOT30';
export const BRAND_GUARD_PILOT_DAYS = 30;

export type PilotSource = 'signup' | 'admin';

export interface BrandGuardPilot {
  id: string;
  owner_id: string;
  promo_code: string;
  status: 'active' | 'expired' | 'canceled';
  subscription_id: string;
  source: PilotSource;
  started_at: string;
  ends_at: string;
  expired_at: string | null;
  notification_sent_at: string | null;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function setCreditPromo(db: SupabaseClient, ownerId: string, promoCode: string | null): Promise<void> {
  const { data, error } = await db
    .from('brand_guard_credits')
    .update({ promo_code: promoCode })
    .eq('owner_id', ownerId)
    .select('owner_id')
    .maybeSingle();
  if (error) throw error;
  if (!data && promoCode) {
    const { error: insertError } = await db.from('brand_guard_credits').insert({
      owner_id: ownerId,
      promo_code: promoCode,
      promo_credits: 0,
    });
    if (insertError) throw insertError;
  }
}

export async function activateBrandGuardPilot(
  db: SupabaseClient,
  options: {
    ownerId: string;
    promoCode: string;
    source: PilotSource;
    startedAt: string;
    createdBy?: string | null;
  },
): Promise<BrandGuardPilot> {
  const promoCode = options.promoCode.trim().toUpperCase();
  if (promoCode !== BRAND_GUARD_PILOT_CODE) throw new Error('Invalid pilot promo code.');

  const { data: existing, error: existingError } = await db
    .from('brand_guard_pilots')
    .select('*')
    .eq('owner_id', options.ownerId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (existing.status === 'active') return existing as BrandGuardPilot;
    throw new Error('This account has already used the 30-day Brand Guard pilot.');
  }

  const startedAt = new Date(options.startedAt);
  if (Number.isNaN(startedAt.getTime())) throw new Error('Invalid pilot start date.');
  const endsAt = addDays(startedAt, BRAND_GUARD_PILOT_DAYS);
  if (endsAt.getTime() <= Date.now()) throw new Error('The pilot eligibility window has already ended.');

  const { data: paidSubscription, error: paidError } = await db
    .from('brand_guard_subscriptions')
    .select('id')
    .eq('owner_id', options.ownerId)
    .not('stripe_subscription_id', 'is', null)
    .in('status', ['active', 'trialing', 'trial_ending'])
    .limit(1)
    .maybeSingle();
  if (paidError) throw paidError;
  if (paidSubscription) throw new Error('This account already has an active paid subscription.');

  const { data: subscription, error: subscriptionError } = await db
    .from('brand_guard_subscriptions')
    .insert({
      owner_id: options.ownerId,
      plan_id: 'fortress',
      status: 'trialing',
      current_period_start: startedAt.toISOString(),
      current_period_end: endsAt.toISOString(),
      cancel_at_period_end: true,
      monthly_credits_included: 0,
      brands_included: 2147483647,
    })
    .select('id')
    .single();
  if (subscriptionError || !subscription) throw subscriptionError || new Error('Could not create pilot subscription.');

  const { data: pilot, error: pilotError } = await db
    .from('brand_guard_pilots')
    .insert({
      owner_id: options.ownerId,
      promo_code: promoCode,
      status: 'active',
      subscription_id: subscription.id,
      source: options.source,
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
      created_by: options.createdBy || null,
    })
    .select('*')
    .single();

  if (pilotError || !pilot) {
    await db.from('brand_guard_subscriptions').delete().eq('id', subscription.id);
    throw pilotError || new Error('Could not activate pilot.');
  }

  try {
    await setCreditPromo(db, options.ownerId, promoCode);
  } catch (error) {
    await db.from('brand_guard_pilots').delete().eq('id', pilot.id);
    await db.from('brand_guard_subscriptions').delete().eq('id', subscription.id);
    throw error;
  }

  return pilot as BrandGuardPilot;
}

export async function endBrandGuardPilot(
  db: SupabaseClient,
  pilot: Pick<BrandGuardPilot, 'id' | 'owner_id' | 'subscription_id'>,
  status: 'expired' | 'canceled',
): Promise<void> {
  const now = new Date().toISOString();
  const { error: subscriptionError } = await db
    .from('brand_guard_subscriptions')
    .update({ status: 'expired', updated_at: now })
    .eq('id', pilot.subscription_id)
    .is('stripe_subscription_id', null);
  if (subscriptionError) throw subscriptionError;

  const { error: creditsError } = await db
    .from('brand_guard_credits')
    .update({ promo_code: null })
    .eq('owner_id', pilot.owner_id)
    .eq('promo_code', BRAND_GUARD_PILOT_CODE);
  if (creditsError) throw creditsError;

  const { data: userData, error: userError } = await db.auth.admin.getUserById(pilot.owner_id);
  if (userError) throw userError;
  if (userData.user?.user_metadata?.promo_code === BRAND_GUARD_PILOT_CODE) {
    const { error: metadataError } = await db.auth.admin.updateUserById(pilot.owner_id, {
      user_metadata: { ...userData.user.user_metadata, promo_code: null },
    });
    if (metadataError) throw metadataError;
  }

  const { error: pilotError } = await db
    .from('brand_guard_pilots')
    .update({ status, expired_at: now, updated_at: now })
    .eq('id', pilot.id)
    .eq('status', 'active');
  if (pilotError) throw pilotError;
}
