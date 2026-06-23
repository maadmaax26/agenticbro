/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/cron-send-drafts.ts — Outreach Gmail Draft Creator
 * ========================================================================
 * Polls outreach_drafts rows with approval='approved' and sent_at IS NULL
 * for email channels (A = verified contact, B = role inbox) and creates
 * Gmail drafts so the admin can review and send them from their Gmail account.
 *
 * Channel codes:
 *   A = email (verified direct contact)   → creates Gmail draft
 *   B = email (role / generic inbox)      → creates Gmail draft
 *   C = LinkedIn (by hand)                → skipped — manual action required
 *   D = form / other                      → skipped — manual action required
 *
 * Required Vercel env vars:
 *   GOOGLE_CLIENT_ID              Google OAuth2 app client ID
 *   GOOGLE_CLIENT_SECRET          Google OAuth2 app client secret
 *   GOOGLE_REFRESH_TOKEN          Offline refresh token for sender Gmail account
 *   GMAIL_SENDER_EMAIL            Sender address (default: ADMIN_EMAIL)
 *   OUTREACH_SUPABASE_URL         Outreach DB URL  (falls back to main Supabase)
 *   OUTREACH_SUPABASE_SECRET_API_KEY  or OUTREACH_SUPABASE_SERVICE_ROLE_KEY
 *   CRON_SECRET                   Vercel cron authentication secret
 *
 * Endpoints:
 *   GET  /api/brand-guard/cron-send-drafts   — Vercel cron trigger (CRON_SECRET required)
 *   POST /api/brand-guard/cron-send-drafts   — Manual admin trigger (same auth)
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'agenticbro@agenticbro.app';

const outreachUrl =
  process.env.OUTREACH_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';
const outreachServiceKey =
  process.env.OUTREACH_SUPABASE_SECRET_API_KEY ||
  process.env.OUTREACH_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_API_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';
const GMAIL_SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || ADMIN_EMAIL;

// ── Types ─────────────────────────────────────────────────────────────────────
type VercelRequest = IncomingMessage & {
  body?: Record<string, unknown>;
  method?: string;
  query?: Record<string, string | string[]>;
};
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

interface ApprovedDraft {
  id: string;
  subject: string | null;
  body: string | null;
  edited_body: string | null;
  opt_out_line: string | null;
  channel: string;
  prospect_id: string | null;
  contact_email: string | null;
  company_name: string | null;
}

interface SendResult {
  draft_id: string;
  company: string;
  to: string;
  status: 'created' | 'skipped' | 'error';
  gmail_draft_id?: string;
  reason?: string;
}

// ── Gmail OAuth2 — get a fresh access token from the refresh token ────────────
async function getGmailAccessToken(): Promise<string> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      'Missing Google OAuth2 credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in Vercel env vars.'
    );
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Failed to refresh Google access token: ${resp.status} — ${text}`);
  }

  const data = await resp.json() as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Google token refresh returned no access_token');
  }
  return data.access_token;
}

// ── Build RFC 2822 email and base64url-encode it for the Gmail API ────────────
function buildRawEmail(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): string {
  const { from, to, subject, body } = opts;

  // Encode subject as RFC 2047 quoted-printable UTF-8 to handle special chars
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

  const raw =
    `From: AgenticBro Brand Guard <${from}>\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${encodedSubject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n` +
    `Content-Transfer-Encoding: quoted-printable\r\n` +
    `\r\n` +
    body;

  // Gmail API requires base64url encoding (RFC 4648 §5)
  return Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ── Create a single Gmail draft via the Gmail API ─────────────────────────────
async function createGmailDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<string> {
  const raw = buildRawEmail({
    from: GMAIL_SENDER_EMAIL,
    to,
    subject,
    body,
  });

  const resp = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: { raw } }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Gmail drafts.create failed: ${resp.status} — ${text}`);
  }

  const data = await resp.json() as { id?: string };
  return data.id || '';
}

// ── Compose final email body from draft fields ────────────────────────────────
function composeFinalBody(draft: ApprovedDraft): string {
  const bodyText = (draft.edited_body || draft.body || '').trim();
  const optOut = (draft.opt_out_line || '').trim();

  if (optOut && !bodyText.includes(optOut)) {
    return `${bodyText}\n\n${optOut}`;
  }
  return bodyText;
}

// ── Core send worker logic ────────────────────────────────────────────────────
async function runSendWorker(batchLimit = 50): Promise<{
  processed: number;
  results: SendResult[];
  error?: string;
}> {
  if (!outreachUrl || !outreachServiceKey) {
    return {
      processed: 0,
      results: [],
      error: 'OUTREACH_SUPABASE_URL and OUTREACH_SUPABASE_SECRET_API_KEY are not configured.',
    };
  }

  const db = createClient(outreachUrl, outreachServiceKey);

  // Fetch approved, unsent drafts for email channels only
  const { data: rows, error: fetchErr } = await db
    .from('outreach_drafts')
    .select('id, subject, body, edited_body, opt_out_line, channel, prospect_id, prospects(contact_email, company_name)')
    .eq('approval', 'approved')
    .is('sent_at', null)
    .in('channel', ['A', 'B'])
    .order('approved_at', { ascending: true })
    .limit(batchLimit);

  if (fetchErr) {
    const code = (fetchErr as { code?: string }).code || '';
    const msg = (fetchErr.message || '').toLowerCase();
    const isMissing =
      code === '42P01' ||
      code === 'PGRST205' ||
      code === 'PGRST202' ||
      msg.includes('does not exist') ||
      msg.includes('could not find the table');

    if (isMissing) {
      return {
        processed: 0,
        results: [],
        error: 'Outreach tables not yet provisioned. Apply db/schema.sql from the brand-guard-agent project.',
      };
    }
    return { processed: 0, results: [], error: fetchErr.message };
  }

  const drafts: ApprovedDraft[] = (rows || []).map((r: Record<string, unknown>) => {
    const pr = (r.prospects as Record<string, unknown>) || {};
    return {
      id: r.id as string,
      subject: (r.subject as string | null) ?? null,
      body: (r.body as string | null) ?? null,
      edited_body: (r.edited_body as string | null) ?? null,
      opt_out_line: (r.opt_out_line as string | null) ?? null,
      channel: (r.channel as string) || '',
      prospect_id: (r.prospect_id as string | null) ?? null,
      contact_email: (pr.contact_email as string | null) ?? null,
      company_name: (pr.company_name as string | null) ?? null,
    };
  });

  if (drafts.length === 0) {
    return { processed: 0, results: [] };
  }

  // Get Gmail access token once for the whole batch
  let accessToken: string;
  try {
    accessToken = await getGmailAccessToken();
  } catch (err) {
    return {
      processed: 0,
      results: [],
      error: `Gmail auth failed: ${(err as Error).message}`,
    };
  }

  const results: SendResult[] = [];
  const nowIso = new Date().toISOString();

  for (const draft of drafts) {
    const company = draft.company_name || draft.prospect_id || draft.id;
    const to = draft.contact_email || '';

    // Skip drafts with no contact email
    if (!to) {
      results.push({
        draft_id: draft.id,
        company,
        to: '',
        status: 'skipped',
        reason: 'No contact_email on prospect record',
      });
      continue;
    }

    const subject = draft.subject || `Brand protection opportunity for ${company}`;
    const bodyText = composeFinalBody(draft);

    if (!bodyText) {
      results.push({
        draft_id: draft.id,
        company,
        to,
        status: 'skipped',
        reason: 'Empty email body',
      });
      continue;
    }

    try {
      const gmailDraftId = await createGmailDraft(accessToken, to, subject, bodyText);

      // Mark as sent — try to store gmail_draft_id if the column exists
      const updatePayload: Record<string, unknown> = { sent_at: nowIso };
      if (gmailDraftId) updatePayload.gmail_draft_id = gmailDraftId;

      const { error: updateErr } = await db
        .from('outreach_drafts')
        .update(updatePayload)
        .eq('id', draft.id);

      if (updateErr) {
        // gmail_draft_id column may not exist — retry with just sent_at
        const colMissing =
          (updateErr.message || '').toLowerCase().includes('does not exist') ||
          (updateErr.message || '').toLowerCase().includes('column');
        if (colMissing) {
          await db.from('outreach_drafts').update({ sent_at: nowIso }).eq('id', draft.id);
        }
      }

      results.push({
        draft_id: draft.id,
        company,
        to,
        status: 'created',
        gmail_draft_id: gmailDraftId || undefined,
      });
    } catch (err) {
      results.push({
        draft_id: draft.id,
        company,
        to,
        status: 'error',
        reason: (err as Error).message,
      });
    }
  }

  const processed = results.filter(r => r.status === 'created').length;
  return { processed, results };
}

// ── HTTP Handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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

  // Optional: limit override from query string (e.g. ?limit=10)
  const qs = req.url ? new URL(`https://x${req.url}`).searchParams : null;
  const limitParam = qs ? parseInt(qs.get('limit') || '50', 10) : 50;
  const batchLimit = isNaN(limitParam) || limitParam < 1 ? 50 : Math.min(limitParam, 200);

  console.log(`[cron-send-drafts] Starting — batch limit: ${batchLimit}`);

  const { processed, results, error } = await runSendWorker(batchLimit);

  if (error) {
    console.error('[cron-send-drafts] Error:', error);
    // Return 200 for cron-triggered calls to prevent Vercel from retrying forever;
    // include the error in the body for visibility in logs
    res.status(200).json({ success: false, error, processed: 0, results: [] });
    return;
  }

  const created = results.filter(r => r.status === 'created').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'error').length;

  console.log(
    `[cron-send-drafts] Done — created: ${created}, skipped: ${skipped}, failed: ${failed}`
  );

  res.status(200).json({
    success: true,
    processed,
    created,
    skipped,
    failed,
    results,
  });
}
