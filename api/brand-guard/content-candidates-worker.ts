import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  buildBrandGuardContentCandidate,
  type CompletedBrandGuardScan,
} from '../_lib/brand-guard-content.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!supabaseUrl || !serviceKey) {
    res.status(503).json({ error: 'Supabase service configuration missing' });
    return;
  }

  const db = createClient(supabaseUrl, serviceKey);
  const limit = Math.min(Math.max(Number(req.query.limit || req.body?.limit || 100), 1), 500);
  const { data: scans, error } = await db
    .from('brand_guard_scans')
    .select('id, owner_id, brand_name, status, completed_at, content_reuse_consent, content_reuse_scope, content_reuse_revoked_at, result')
    .eq('status', 'complete')
    .eq('content_reuse_consent', true)
    .is('content_reuse_revoked_at', null)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const candidates = (scans || [])
    .map(row => buildBrandGuardContentCandidate(row as CompletedBrandGuardScan))
    .filter(candidate => candidate !== null);

  if (!candidates.length) {
    res.status(200).json({
      checked: scans?.length || 0,
      eligible: 0,
      created: 0,
      skipped: scans?.length || 0,
    });
    return;
  }

  const { data: inserted, error: insertError } = await db
    .from('brand_guard_content_candidates')
    .upsert(candidates, {
      onConflict: 'scan_id,finding_type',
      ignoreDuplicates: true,
    })
    .select('id');

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  res.status(200).json({
    checked: scans?.length || 0,
    eligible: candidates.length,
    created: inserted?.length || 0,
    skipped: (scans?.length || 0) - (inserted?.length || 0),
  });
}
