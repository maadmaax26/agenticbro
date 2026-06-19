import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { runDomainWatcherTick } from '../../server/lib/domain-watcher-worker.js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const cronSecret = process.env.CRON_SECRET || '';
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!url || !key) {
    res.status(503).json({ error: 'Supabase is not configured' });
    return;
  }

  try {
    await runDomainWatcherTick(createClient(url, key));
    res.status(200).json({ success: true, completed_at: new Date().toISOString() });
  } catch (error) {
    console.error('[DNS Watcher API] Run failed:', error);
    res.status(500).json({ error: 'Domain watch run failed' });
  }
}

export const config = { maxDuration: 60 };
