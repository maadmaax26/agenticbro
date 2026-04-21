/**
 * Phone Community Scan Job Producer — Vercel Serverless Function
 *
 * POST /api/phone-scan
 * Queues a phone number for CDP-based community report scanning.
 * Mac Studio OpenClaw worker processes it asynchronously.
 *
 * Flow:
 * 1. Vercel inserts job into Supabase scan_jobs table
 * 2. Mac Studio worker polls and processes via CDP (800notes/whocalledme)
 * 3. Worker updates job with results
 * 4. Frontend polls or uses Supabase Realtime for updates
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PhoneScanRequest {
  phone: string;           // Phone number in E.164 format (+1234567890)
  options?: {
    priority?: number;     // 1 (urgent) – 10 (low), default 5
    sources?: string[];    // ['800notes', 'whocalledme'], default both
    timeout_ms?: number;   // Max time per source, default 10000
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
    const { phone, options = {} } = req.body as PhoneScanRequest;

    // ── Validate phone ───────────────────────────────────────────────────────
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({
        error: 'phone is required',
        example: { phone: '+1234567890' },
      });
    }

    // E.164 format validation
    const e164 = phone.replace(/[^0-9+]/g, '');
    if (e164.length < 7 || e164.length > 16) {
      return res.status(400).json({
        error: 'Invalid phone format. Use E.164: +1234567890',
        received: phone,
      });
    }

    // ── Enqueue job ──────────────────────────────────────────────────────────
    const { data: job, error } = await supabase
      .from('scan_jobs')
      .insert({
        scan_type: 'phone_community',
        payload: {
          phone: e164,
          sources: options.sources || ['800notes', 'whocalledme'],
          timeout_ms: options.timeout_ms || 10000,
        },
        status: 'pending',
        priority: options.priority ?? 5,
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      console.error('[phone-scan] Supabase insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(202).json({
      job_id: job.id,
      status: 'queued',
      phone: e164,
      created_at: job.created_at,
      poll_url: `/api/phone-scan/${job.id}`,
      message: 'Phone scan queued. Poll poll_url for results (usually 5-15 seconds).',
    });

  } catch (err) {
    console.error('[phone-scan] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}