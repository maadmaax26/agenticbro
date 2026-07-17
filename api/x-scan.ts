/**
 * api/x-scan.ts — Queue X/Twitter scan for CDP processing
 * 
 * X requires Chrome CDP which can't run on Vercel serverless.
 * This endpoint queues the scan for backend processing and returns a job ID.
 * 
 * POST /api/x-scan
 * Body: { username: string }
 * Returns: { success: true, jobId: string, message: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_API_KEY!
);

// ── Inline scan event tracking for analytics ──────────────────────────────
async function trackScanEvent(params: { scan_type: string; platform?: string | null; target: string; risk_score?: number | null; risk_level?: string | null; source?: string; country_code?: string | null }) {
  try {
    await supabase.from('scan_events').insert({
      scan_type: params.scan_type,
      platform: params.platform ?? null,
      target: params.target,
      username: params.target,
      risk_score: params.risk_score ?? null,
      risk_level: params.risk_level ?? null,
      source: params.source ?? 'website',
      source_table: 'direct_insert',
      event_date: new Date().toISOString().split('T')[0],
      country_code: params.country_code ?? null,
    });
  } catch (e) {
    console.error('[scan-tracking] Error:', e);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.body as { username?: string };

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ 
      success: false, 
      error: 'Username is required' 
    });
  }

  // Clean username
  const cleanUsername = username.replace(/^@/, '').trim();

  if (cleanUsername.length < 1 || cleanUsername.length > 50) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid username length' 
    });
  }

  try {
    // Create scan job
    const jobId = crypto.randomUUID();
    
    // Record to unified scan_events table for analytics (before job insert so we track even if queue fails)
    try {
      await trackScanEvent({
        scan_type: 'x_cdp',
        platform: 'twitter',
        target: cleanUsername,
        source: 'website',
      });
    } catch (e) {
      console.error('[scan-tracking] x-scan event error:', e);
    }

    const { error: insertError } = await supabase
      .from('scan_jobs')
      .insert({
        id: jobId,
        status: 'pending',
        scan_type: 'x_cdp',
        target: cleanUsername,
        platform: 'twitter',
        created_at: new Date().toISOString(),
        metadata: {
          platform: 'twitter',
          username: cleanUsername,
          url: `https://x.com/${cleanUsername}`,
          queued_from: 'website',
        }
      });

    if (insertError) {
      console.error('[x-scan] Insert error:', insertError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to queue scan' 
      });
    }

    return res.status(200).json({
      success: true,
      jobId,
      message: 'X scan queued for processing. Results will be available shortly.',
      platform: 'X (Twitter)',
      username: cleanUsername,
      url: `https://x.com/${cleanUsername}`,
      instructions: 'X scans require Chrome CDP processing. Check back in 1-2 minutes for results.',
    });

  } catch (err) {
    console.error('[x-scan] Unexpected error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}