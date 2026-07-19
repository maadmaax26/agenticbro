import { randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { hashApiKey } from '../_lib/brand-guard-auth.js';
import { requireBrandGuardEntitlement } from '../_lib/brand-guard-entitlements.js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const db = createClient(url, serviceKey);
const ALLOWED_SCOPES = new Set(['scans:read', 'scans:write', 'takedowns:read', 'takedowns:write', 'usage:read']);
const PLAN_RATE_LIMITS: Record<string, number> = { free: 30, guardian: 60, sentinel: 300, fortress: 1000 };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const entitlement = await requireBrandGuardEntitlement(req, res, 'developer_api');
  if (!entitlement) return;
  const ownerId = entitlement.ownerId;

  if (req.method === 'GET') {
    const { data, error } = await db.from('brand_guard_api_keys')
      .select('id, name, key_prefix, scopes, rate_limit_per_minute, last_used_at, expires_at, revoked_at, created_at')
      .eq('owner_id', ownerId).order('created_at', { ascending: false });
    if (error) res.status(500).json({ error: error.message });
    else res.status(200).json({ api_keys: data || [] });
    return;
  }

  if (req.method === 'POST') {
    const name = String(req.body?.name || '').trim().slice(0, 100);
    const scopes = Array.isArray(req.body?.scopes) ? req.body.scopes.map(String) : ['scans:read', 'scans:write'];
    if (!name || scopes.length === 0 || scopes.some((scope: string) => !ALLOWED_SCOPES.has(scope))) {
      res.status(400).json({ error: 'Valid name and scopes are required', allowed_scopes: [...ALLOWED_SCOPES] });
      return;
    }
    const { data: subscription } = await db.from('brand_guard_subscriptions').select('plan_id')
      .eq('owner_id', ownerId).in('status', ['active', 'trialing', 'trial_ending']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const plan = subscription?.plan_id || 'free';
    const planLimit = PLAN_RATE_LIMITS[plan] || PLAN_RATE_LIMITS.free;
    const rawKey = `bg_live_${randomBytes(24).toString('base64url')}`;
    const prefix = rawKey.slice(0, 16);
    const requestedLimit = Number(req.body?.rate_limit_per_minute || 60);
    const rateLimit = Math.min(planLimit, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : planLimit));
    const { data, error } = await db.from('brand_guard_api_keys').insert({
      owner_id: ownerId,
      name,
      key_prefix: prefix,
      key_hash: hashApiKey(rawKey),
      scopes,
      rate_limit_per_minute: rateLimit,
      expires_at: req.body?.expires_at || null,
    }).select('id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, created_at').single();
    if (error) res.status(500).json({ error: error.message });
    else res.status(201).json({ ...data, api_key: rawKey, warning: 'This key is shown once. Store it securely.' });
    return;
  }

  if (req.method === 'DELETE') {
    const id = String(req.query.id || '');
    const { data, error } = await db.from('brand_guard_api_keys')
      .update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('owner_id', ownerId).is('revoked_at', null)
      .select('id').maybeSingle();
    if (error) res.status(500).json({ error: error.message });
    else if (!data) res.status(404).json({ error: 'API key not found' });
    else res.status(200).json({ revoked: true, id });
    return;
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  res.status(405).json({ error: 'Method not allowed' });
}
