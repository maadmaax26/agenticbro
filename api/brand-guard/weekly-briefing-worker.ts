import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateEnterpriseReport } from '../_lib/enterprise-reports.js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const db = createClient(url, key);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!['GET', 'POST'].includes(req.method || '')) { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }
  const { data: subscriptions, error } = await db.from('brand_guard_subscriptions').select('owner_id')
    .eq('plan_id', 'fortress').eq('status', 'active');
  if (error) { res.status(500).json({ error: error.message }); return; }
  const now = new Date();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const periodStart = new Date(periodEnd.getTime() - 7 * 86400000);
  const results: Array<{ owner_id: string; report_id?: string; error?: string }> = [];
  for (const subscription of subscriptions || []) {
    try {
      const report = await generateEnterpriseReport(db, subscription.owner_id, 'weekly_briefing', periodStart, periodEnd);
      results.push({ owner_id: subscription.owner_id, report_id: String(report.id) });
      if (now.getUTCDate() <= 7) {
        const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const monthStart = new Date(Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth() - 1, 1));
        await generateEnterpriseReport(db, subscription.owner_id, 'monthly_sla', monthStart, monthEnd);
      }
    } catch (reportError) {
      results.push({ owner_id: subscription.owner_id, error: reportError instanceof Error ? reportError.message : String(reportError) });
    }
  }
  res.status(results.some(item => item.error) ? 207 : 200).json({ generated: results.filter(item => item.report_id).length, results });
}
