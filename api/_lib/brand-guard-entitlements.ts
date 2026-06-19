import type { IncomingMessage } from 'node:http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type BrandGuardPlan = 'free' | 'guardian' | 'sentinel' | 'fortress';
export type BrandGuardFeature =
  | 'brand_management' | 'dashboard' | 'credits' | 'scan'
  | 'takedown_templates' | 'automated_takedowns' | 'visual_fingerprints'
  | 'developer_api' | 'customer_delivery' | 'custom_reports'
  | 'enterprise_sla' | 'weekly_briefings' | 'account_manager';

interface PlanDefinition {
  rank: number;
  brandLimit: number;
  features: ReadonlySet<BrandGuardFeature>;
}

const BASE: BrandGuardFeature[] = ['brand_management', 'dashboard', 'credits', 'scan'];
export const PLAN_ENTITLEMENTS: Record<BrandGuardPlan, PlanDefinition> = {
  free: { rank: 0, brandLimit: 1, features: new Set(BASE) },
  guardian: { rank: 1, brandLimit: 3, features: new Set([...BASE, 'takedown_templates']) },
  sentinel: {
    rank: 2,
    brandLimit: 10,
    features: new Set([...BASE, 'takedown_templates', 'automated_takedowns', 'visual_fingerprints', 'developer_api', 'customer_delivery', 'custom_reports']),
  },
  fortress: {
    rank: 3,
    brandLimit: -1,
    features: new Set([...BASE, 'takedown_templates', 'automated_takedowns', 'visual_fingerprints', 'developer_api', 'customer_delivery', 'custom_reports', 'enterprise_sla', 'weekly_briefings', 'account_manager']),
  },
};

export interface EntitlementContext {
  ownerId: string;
  email: string;
  plan: BrandGuardPlan;
  brandLimit: number;
  features: BrandGuardFeature[];
  subscriptionId: string | null;
  db: SupabaseClient;
}

type EntitlementRequest = IncomingMessage & { method?: string; body?: unknown };
type EntitlementResponse = { status: (code: number) => { json: (body: unknown) => unknown }; setHeader: (name: string, value: string) => unknown };

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function entitlementsForOwner(ownerId: string, db = createClient(url, serviceKey)): Promise<EntitlementContext> {
  const { data } = await db.from('brand_guard_subscriptions').select('id, plan_id, status, current_period_end')
    .eq('owner_id', ownerId).in('status', ['active', 'trialing', 'trial_ending']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const candidate = String(data?.plan_id || 'free') as BrandGuardPlan;
  const plan = PLAN_ENTITLEMENTS[candidate] ? candidate : 'free';
  const definition = PLAN_ENTITLEMENTS[plan];
  return {
    ownerId,
    email: '',
    plan,
    brandLimit: definition.brandLimit,
    features: [...definition.features],
    subscriptionId: data?.id || null,
    db,
  };
}

export function ownerHasFeature(context: EntitlementContext, feature: BrandGuardFeature): boolean {
  return PLAN_ENTITLEMENTS[context.plan].features.has(feature);
}

export async function requireBrandGuardEntitlement(
  req: EntitlementRequest,
  res: EntitlementResponse,
  feature: BrandGuardFeature,
): Promise<EntitlementContext | null> {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'authentication_required' });
    return null;
  }
  const authClient = createClient(url, anonKey);
  const { data, error } = await authClient.auth.getUser(auth.slice(7));
  if (error || !data.user) {
    res.status(401).json({ error: 'invalid_access_token' });
    return null;
  }
  const context = await entitlementsForOwner(data.user.id);
  context.email = data.user.email || '';
  if (!ownerHasFeature(context, feature)) {
    const requiredPlan = (Object.entries(PLAN_ENTITLEMENTS) as Array<[BrandGuardPlan, PlanDefinition]>)
      .find(([, definition]) => definition.features.has(feature))?.[0] || 'fortress';
    res.status(403).json({
      error: 'entitlement_required',
      feature,
      current_plan: context.plan,
      required_plan: requiredPlan,
      upgrade_url: '/brand-guard/pricing',
    });
    return null;
  }
  res.setHeader('X-Brand-Guard-Plan', context.plan);
  return context;
}

export async function enforceBrandLimit(context: EntitlementContext): Promise<{ allowed: boolean; used: number; limit: number }> {
  const { count } = await context.db.from('brand_monitors').select('*', { count: 'exact', head: true }).eq('owner_id', context.ownerId);
  const used = count || 0;
  return { allowed: context.brandLimit < 0 || used < context.brandLimit, used, limit: context.brandLimit };
}
