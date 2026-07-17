/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/cron-send-drafts.ts — Outreach Gmail Draft Creator (cron entry point)
 * ========================================================================
 * Triggered by Vercel cron every 15 minutes. Polls outreach_drafts rows with
 * approval='approved' and sent_at IS NULL for email channels (A, B) and
 * creates Gmail drafts so the admin can review and send them from Gmail.
 *
 * Core logic lives in api/_lib/outreach-sender.ts (shared with admin.ts manual trigger).
 *
 * Required Vercel env vars: see api/_lib/outreach-sender.ts
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN,
 *   GMAIL_SENDER_EMAIL, OUTREACH_SUPABASE_URL, OUTREACH_SUPABASE_SECRET_API_KEY,
 *   CRON_SECRET
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { runSendWorker } from '../_lib/outreach-sender.js';

type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Auth: require CRON_SECRET (Vercel injects this for cron invocations)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const qs = req.url ? new URL(`https://x${req.url}`).searchParams : null;
  const limitParam = qs ? parseInt(qs.get('limit') || '50', 10) : 50;
  const batchLimit = isNaN(limitParam) || limitParam < 1 ? 50 : Math.min(limitParam, 200);

  console.log(`[cron-send-drafts] Starting — batch limit: ${batchLimit}`);

  const { processed, results, error } = await runSendWorker(batchLimit);

  if (error) {
    console.error('[cron-send-drafts] Error:', error);
    res.status(200).json({ success: false, error, processed: 0, results: [] });
    return;
  }

  const created = results.filter(r => r.status === 'created').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'error').length;

  console.log(`[cron-send-drafts] Done — created: ${created}, skipped: ${skipped}, failed: ${failed}`);
  res.status(200).json({ success: true, processed, created, skipped, failed, results });
}
