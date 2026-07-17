import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireScanCreditUser } from './_lib/scan-credit-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireScanCreditUser(req, res);
  if (!user) return;

  const sessionId = String(req.query.session_id || '').trim();
  if (!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) return res.status(400).json({ error: 'Invalid checkout session' });
  const secret = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secret) return res.status(503).json({ error: 'Stripe not configured' });

  const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const session = await stripeResponse.json();
  if (!stripeResponse.ok || session.metadata?.user_id !== user.userId || session.metadata?.type !== 'scan_credits') {
    return res.status(404).json({ error: 'Checkout session not found' });
  }

  const verified = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
  let { data: transaction } = await user.db.from('scan_credit_transactions')
    .select('id').eq('owner_id', user.userId).eq('payment_reference', sessionId).maybeSingle();
  if (verified && !transaction) {
    const credits = Number(session.metadata?.credits || 0);
    if (!Number.isInteger(credits) || credits <= 0) return res.status(400).json({ error: 'Invalid checkout metadata' });
    const { error } = await user.db.rpc('add_scan_credits', {
      p_owner_id: user.userId,
      p_credits: credits,
      p_reference: sessionId,
      p_amount_usd: typeof session.amount_total === 'number' ? session.amount_total / 100 : null,
    });
    if (error) return res.status(500).json({ error: 'Credit fulfillment failed' });
    const result = await user.db.from('scan_credit_transactions')
      .select('id').eq('owner_id', user.userId).eq('payment_reference', sessionId).maybeSingle();
    transaction = result.data;
  }
  return res.status(verified ? 200 : 402).json({
    success: verified,
    verified,
    fulfilled: Boolean(transaction),
    credits: Number(session.metadata?.credits || 0),
    amount_usd: typeof session.amount_total === 'number' ? session.amount_total / 100 : 0,
  });
}
