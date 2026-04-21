/**
 * Phone Scan Job Status — Vercel Serverless Function
 *
 * GET /api/phone-scan/:job_id
 * Returns the current status and result of a queued phone scan job.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { job_id } = req.query as { job_id: string };

  if (!job_id || typeof job_id !== 'string') {
    return res.status(400).json({ error: 'job_id is required' });
  }

  // UUID format check
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(job_id)) {
    return res.status(400).json({ error: 'Invalid job_id format' });
  }

  try {
    const { data: job, error } = await supabase
      .from('scan_jobs')
      .select('id, status, scan_type, payload, result, error, created_at, claimed_at, started_at, completed_at, retry_count')
      .eq('id', job_id)
      .eq('scan_type', 'phone_community')
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.status(200).json(job);

  } catch (err) {
    console.error('[phone-scan/job_id] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}