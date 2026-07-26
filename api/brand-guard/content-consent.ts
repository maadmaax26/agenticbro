import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || '';
const serviceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!supabaseUrl || !anonKey || !serviceKey) {
    res.status(503).json({ error: 'Supabase configuration missing' });
    return;
  }

  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const auth = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: authError } = await auth.auth.getUser(authorization.slice(7));
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid access token' });
    return;
  }

  const scanId = String(req.body?.scan_id || '').trim();
  if (!scanId) {
    res.status(400).json({ error: 'scan_id is required' });
    return;
  }

  const db = createClient(supabaseUrl, serviceKey);
  const revokedAt = new Date().toISOString();
  const { data, error } = await db
    .from('brand_guard_scans')
    .update({
      content_reuse_consent: false,
      content_reuse_scope: 'none',
      content_reuse_revoked_at: revokedAt,
    })
    .eq('scan_id', scanId)
    .eq('owner_id', user.id)
    .select('scan_id')
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: 'Owned scan not found' });
    return;
  }

  res.status(200).json({ success: true, scan_id: data.scan_id, revoked_at: revokedAt });
}
