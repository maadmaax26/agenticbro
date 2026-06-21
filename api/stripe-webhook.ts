import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const env = (name: string, fallback = '') => (process.env[name] || fallback).trim();

async function verifySignature(payload: string, header: string, secret: string) {
  const parts = header.split(',').map(part => part.split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || signatures.length === 0 || Math.abs(Date.now() - Number(timestamp) * 1000) > 300_000) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(signed)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  return signatures.some(signature => {
    if (signature.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
    return difference === 0;
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const webhookSecret = env('STRIPE_WEBHOOK_SECRET');
  const signature = String(req.headers['stripe-signature'] || '');
  if (!webhookSecret || !signature) return res.status(400).json({ error: 'Missing webhook signature' });

  const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (!(await verifySignature(payload, signature, webhookSecret))) return res.status(400).json({ error: 'Invalid webhook signature' });

  const event = JSON.parse(payload);
  if (event.type !== 'checkout.session.completed') return res.status(200).json({ received: true });
  const session = event.data.object;
  if (session.metadata?.type !== 'scan_credits') return res.status(200).json({ received: true, skipped: true });
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return res.status(200).json({ received: true, skipped: 'not_paid' });
  }

  const userId = session.metadata?.user_id;
  const credits = Number(session.metadata?.credits || 0);
  if (!userId || !Number.isInteger(credits) || credits <= 0) return res.status(400).json({ error: 'Invalid checkout metadata' });

  const db = createClient(env('VITE_SUPABASE_URL', env('SUPABASE_URL')), env('SUPABASE_SECRET_API_KEY', env('SUPABASE_SERVICE_ROLE_KEY')));
  const { error } = await db.rpc('add_scan_credits', {
    p_owner_id: userId,
    p_credits: credits,
    p_reference: session.id,
    p_amount_usd: typeof session.amount_total === 'number' ? session.amount_total / 100 : null,
  });
  if (error) {
    console.error('[stripe-webhook] Credit fulfillment failed:', error.message);
    return res.status(500).json({ error: 'Credit fulfillment failed' });
  }
  return res.status(200).json({ received: true });
}
