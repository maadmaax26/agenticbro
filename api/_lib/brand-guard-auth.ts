import { createHash, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface DeveloperIdentity {
  ownerId: string;
  apiKeyId: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  remaining: number;
  resetAt: string;
}

interface StoredKey {
  id: string;
  owner_id: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  rate_limit_per_minute: number;
  expires_at: string | null;
  revoked_at: string | null;
}

export const hashApiKey = (key: string): string => createHash('sha256').update(key).digest('hex');

function hasScope(scopes: string[], requiredScope: string): boolean {
  if (scopes.includes('*') || scopes.includes(requiredScope)) return true;
  const namespace = requiredScope.split(':')[0];
  return scopes.includes(`${namespace}:*`);
}

function bearerToken(req: VercelRequest): string {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

export async function authenticateDeveloperRequest(
  req: VercelRequest,
  res: VercelResponse,
  db: SupabaseClient,
  requiredScope: string,
): Promise<DeveloperIdentity | null> {
  const key = bearerToken(req);
  if (!key.startsWith('bg_live_') && !key.startsWith('bg_test_')) {
    res.status(401).json({ error: 'invalid_api_key', message: 'Use Authorization: Bearer <api-key>' });
    return null;
  }

  const keyHash = hashApiKey(key);
  const { data, error } = await db
    .from('brand_guard_api_keys')
    .select('id, owner_id, key_prefix, key_hash, scopes, rate_limit_per_minute, expires_at, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle<StoredKey>();

  const supplied = Buffer.from(keyHash, 'hex');
  const stored = Buffer.from(data?.key_hash || '0'.repeat(64), 'hex');
  if (error || !data || supplied.length !== stored.length || !timingSafeEqual(supplied, stored) || data.revoked_at) {
    res.status(401).json({ error: 'invalid_api_key' });
    return null;
  }
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    res.status(401).json({ error: 'api_key_expired' });
    return null;
  }
  if (!hasScope(data.scopes || [], requiredScope)) {
    res.status(403).json({ error: 'insufficient_scope', required_scope: requiredScope });
    return null;
  }

  const { data: windows, error: limitError } = await db.rpc('consume_brand_guard_rate_limit', {
    p_api_key_id: data.id,
    p_limit: data.rate_limit_per_minute,
  });
  const window = Array.isArray(windows) ? windows[0] : windows;
  if (limitError || !window) {
    res.status(503).json({ error: 'rate_limiter_unavailable' });
    return null;
  }

  res.setHeader('X-RateLimit-Limit', String(data.rate_limit_per_minute));
  res.setHeader('X-RateLimit-Remaining', String(window.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(new Date(window.reset_at).getTime() / 1000)));
  if (!window.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((new Date(window.reset_at).getTime() - Date.now()) / 1000))));
    res.status(429).json({ error: 'rate_limit_exceeded', reset_at: window.reset_at });
    return null;
  }

  void db.from('brand_guard_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  return {
    ownerId: data.owner_id,
    apiKeyId: data.id,
    keyPrefix: data.key_prefix,
    scopes: data.scopes,
    rateLimit: data.rate_limit_per_minute,
    remaining: Number(window.remaining),
    resetAt: String(window.reset_at),
  };
}

export async function logDeveloperUsage(
  db: SupabaseClient,
  req: VercelRequest,
  identity: DeveloperIdentity,
  scope: string,
  statusCode: number,
  startedAt: number,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const salt = process.env.API_USAGE_HASH_SALT || 'brand-guard';
  const ipHash = forwarded ? createHash('sha256').update(`${salt}:${forwarded}`).digest('hex') : null;
  await db.from('brand_guard_api_usage_logs').insert({
    owner_id: identity.ownerId,
    api_key_id: identity.apiKeyId,
    method: req.method || 'UNKNOWN',
    path: req.url?.split('?')[0] || '/',
    scope,
    status_code: statusCode,
    duration_ms: Date.now() - startedAt,
    ip_hash: ipHash,
    user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
    metadata,
  });
}
