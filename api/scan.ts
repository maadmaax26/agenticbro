/**
 * Scan Job Producer — Vercel Serverless Function
 *
 * POST /api/scan
 * Inserts a scan job into the Supabase queue.
 * Mac Studio OpenClaw worker polls and processes it asynchronously.
 * Frontend subscribes via Supabase Realtime for instant updates.
 *
 * Replaces the old ngrok-tunnel approach entirely.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Use service role key (not anon key) in server-side routes
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ScanRequest {
  address?: string;      // wallet / token address
  username?: string;     // social profile username (profile scans)
  platform?: string;     // twitter, telegram, instagram, etc.
  scan_type?: 'token' | 'wallet' | 'profile';
  options?: {
    priority?: number;   // 1 (urgent) – 10 (low), default 5
    deepScan?: boolean;
    chain?: string;
  };
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

  try {
    const { address, username, platform, scan_type = 'token', options = {} } =
      req.body as ScanRequest;

    // ── Validate ─────────────────────────────────────────────────────────────
    const target = address || username;
    if (!target) {
      return res.status(400).json({
        error: 'address or username is required',
        example: { address: '0x...', scan_type: 'token' },
      });
    }

    const VALID_TYPES = ['token', 'wallet', 'profile'];
    if (!VALID_TYPES.includes(scan_type)) {
      return res.status(400).json({
        error: `scan_type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    // ── Enqueue ──────────────────────────────────────────────────────────────
    const { data: job, error } = await supabase
      .from('scan_jobs')
      .insert({
        scan_type,
        payload: {
          address,
          username,
          platform,
          options,
        },
        status: 'pending',
        priority: options.priority ?? 5,
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      console.error('[scan] Supabase insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(202).json({
      job_id: job.id,
      status: 'queued',
      created_at: job.created_at,
      poll_url: `/api/scan/${job.id}`,
      message: 'Job queued. Subscribe to Supabase Realtime or poll poll_url for status.',
    });

  } catch (err) {
    console.error('[scan] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
