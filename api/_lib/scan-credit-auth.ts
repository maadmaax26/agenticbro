import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const env = (name: string, fallback = '') => (process.env[name] || fallback).trim();
const url = env('VITE_SUPABASE_URL', env('SUPABASE_URL'));
const publishableKey = env('VITE_SUPABASE_PUBLISHABLE_KEY', env('SUPABASE_PUBLISHABLE_KEY'));
const legacyAnonKey = env('VITE_SUPABASE_ANON_KEY', env('SUPABASE_ANON_KEY'));
const serviceKey = env('SUPABASE_SECRET_API_KEY', env('SUPABASE_SERVICE_ROLE_KEY'));
const authKey = publishableKey || serviceKey || legacyAnonKey;

export async function requireScanCreditUser(req: VercelRequest, res: VercelResponse) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    res.status(401).json({ error: 'authentication_required' });
    return null;
  }
  const auth = createClient(url, authKey);
  const { data, error } = await auth.auth.getUser(authorization.slice(7));
  if (error || !data.user) {
    res.status(401).json({ error: 'invalid_access_token' });
    return null;
  }
  return {
    userId: data.user.id,
    email: data.user.email || '',
    db: createClient(url, serviceKey),
  };
}
