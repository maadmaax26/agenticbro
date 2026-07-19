import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { activateBrandGuardPilot } from '../_lib/brand-guard-pilot.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ error: 'Authentication required.' }); return; }

  const auth = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) { res.status(401).json({ error: 'Invalid session.' }); return; }
  const db = createClient(supabaseUrl, serviceKey);

  if (req.method === 'GET') {
    const { data, error } = await db.from('brand_guard_pilots').select('*').eq('owner_id', user.id).maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ success: true, pilot: data || null });
    return;
  }

  const promoCode = String(req.body?.promo_code || user.user_metadata?.promo_code || '');
  const requestToken = String(req.body?.request_token || '').trim();
  try {
    if (requestToken) {
      const { data: request, error: requestError } = await db
        .from('brand_guard_pilot_requests')
        .select('*')
        .eq('approval_token', requestToken)
        .eq('status', 'approved')
        .eq('approval_mode', 'invite')
        .maybeSingle();
      if (requestError) throw requestError;
      if (!request) throw new Error('Pilot invitation is invalid or has already been used.');
      if (String(request.email || '').toLowerCase() !== String(user.email || '').toLowerCase()) {
        throw new Error('This pilot invitation was approved for a different email address.');
      }

      const pilot = await activateBrandGuardPilot(db, {
        ownerId: user.id,
        promoCode: 'BGPILOT30',
        source: 'signup',
        startedAt: user.created_at,
      });
      await db
        .from('brand_guard_pilot_requests')
        .update({
          owner_id: user.id,
          status: 'fulfilled',
          pilot_id: pilot.id,
          fulfilled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);
      res.status(200).json({ success: true, pilot, plan: 'fortress' });
      return;
    }

    const pilot = await activateBrandGuardPilot(db, {
      ownerId: user.id,
      promoCode,
      source: 'signup',
      startedAt: user.created_at,
    });
    res.status(200).json({ success: true, pilot, plan: 'fortress' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not activate pilot.';
    res.status(message.includes('Invalid') ? 400 : 409).json({ error: message });
  }
}
