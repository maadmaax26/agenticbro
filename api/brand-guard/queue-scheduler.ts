import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const db = createClient(url, serviceKey);

const PLAN_SCHEDULE: Record<string, { seconds: number | null; priority: number }> = {
  free: { seconds: null, priority: 10 },
  guardian: { seconds: 6 * 60 * 60, priority: 30 },
  sentinel: { seconds: 15 * 60, priority: 60 },
  fortress: { seconds: 5 * 60, priority: 100 },
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const now = new Date();
  const { data: monitors, error } = await db.from('brand_monitors')
    .select('id, owner_id, brand_name, brand_handle, brand_domain, platforms, next_scan_at')
    .eq('is_active', true).or(`next_scan_at.is.null,next_scan_at.lte.${now.toISOString()}`).limit(200);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  let queued = 0;
  let skipped = 0;
  const failures: Array<{ monitor_id: string; error: string }> = [];
  for (const monitor of monitors || []) {
    const { data: subscription } = await db.from('brand_guard_subscriptions').select('plan_id')
      .eq('owner_id', monitor.owner_id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const plan = subscription?.plan_id || 'free';
    const config = PLAN_SCHEDULE[plan] || PLAN_SCHEDULE.free;
    if (!config.seconds) {
      skipped++;
      continue;
    }

    const slot = Math.floor(now.getTime() / (config.seconds * 1000));
    const nextScanAt = new Date(now.getTime() + config.seconds * 1000).toISOString();
    const idempotencyKey = `schedule:${monitor.id}:${plan}:${slot}`;
    const { error: insertError } = await db.from('brand_guard_scan_queue').insert({
      owner_id: monitor.owner_id,
      brand_monitor_id: monitor.id,
      plan_id: plan,
      job_type: 'full',
      priority: config.priority,
      idempotency_key: idempotencyKey,
      payload: {
        brand_name: monitor.brand_name,
        brand_handle: monitor.brand_handle,
        brand_domain: monitor.brand_domain,
        platforms: monitor.platforms,
        source: 'plan_scheduler',
      },
    });
    if (insertError && insertError.code !== '23505') {
      failures.push({ monitor_id: monitor.id, error: insertError.message });
      continue;
    }
    await db.from('brand_monitors').update({ next_scan_at: nextScanAt }).eq('id', monitor.id)
      .or(`next_scan_at.is.null,next_scan_at.lte.${now.toISOString()}`);
    if (!insertError) queued++;
    else skipped++;
  }

  res.status(failures.length ? 207 : 200).json({ checked: monitors?.length || 0, queued, skipped, failures });
}
