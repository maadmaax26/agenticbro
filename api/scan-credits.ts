import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireScanCreditUser } from './_lib/scan-credit-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireScanCreditUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const { data, error } = await user.db.from('scan_credit_accounts')
      .select('paid_credits, lifetime_purchased').eq('owner_id', user.userId).maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to load scan credits' });
    return res.status(200).json({ success: true, paid_credits: data?.paid_credits || 0, lifetime_purchased: data?.lifetime_purchased || 0 });
  }

  if (req.method === 'POST' && req.query.action === 'deduct') {
    const { data, error } = await user.db.rpc('deduct_scan_credit', { p_owner_id: user.userId });
    if (error) return res.status(500).json({ error: 'Failed to deduct scan credit' });
    if (!data?.success) return res.status(402).json({ error: 'No paid scan credits remaining', paid_credits: 0 });
    return res.status(200).json(data);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
