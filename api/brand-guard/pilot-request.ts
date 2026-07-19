import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const VALID_CONCERNS = new Set([
  'impersonation',
  'fake_store',
  'spoofed_email',
  'fake_ads',
  'lookalike_domain',
  'marketplace_clone',
  'other',
]);

function clean(value: unknown, max = 500): string {
  return String(value || '').trim().slice(0, max);
}

function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const email = clean(req.body?.email, 254).toLowerCase();
  const companyName = clean(req.body?.company_name, 160);
  const brandName = clean(req.body?.brand_name, 160);
  const website = normalizeWebsite(clean(req.body?.website, 260));
  const concern = clean(req.body?.concern, 80);
  const notes = clean(req.body?.notes, 1000);

  if (!isLikelyEmail(email)) { res.status(400).json({ error: 'A valid work email is required.' }); return; }
  if (!companyName || !brandName || !website) {
    res.status(400).json({ error: 'Company, brand, and website are required.' });
    return;
  }
  if (!VALID_CONCERNS.has(concern)) {
    res.status(400).json({ error: 'Choose a valid pilot concern.' });
    return;
  }

  let ownerId: string | null = null;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    const auth = createClient(supabaseUrl, anonKey);
    const { data: { user } } = await auth.auth.getUser(token);
    ownerId = user?.id || null;
  }

  const db = createClient(supabaseUrl, serviceKey);
  const { data, error } = await db
    .from('brand_guard_pilot_requests')
    .insert({
      owner_id: ownerId,
      email,
      company_name: companyName,
      brand_name: brandName,
      website,
      concern,
      notes: notes || null,
      status: 'pending',
    })
    .select('id, status, created_at')
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(200).json({ success: true, request: data });
}
