/**
 * api/_lib/outreach-sender.ts — Gmail draft creation for approved outreach
 * ========================================================================
 * Shared by api/brand-guard/cron-send-drafts.ts (cron trigger) and
 * api/brand-guard/admin.ts (/send-approved-drafts manual trigger).
 *
 * Required Vercel env vars:
 *   GOOGLE_CLIENT_ID              Google OAuth2 app client ID
 *   GOOGLE_CLIENT_SECRET          Google OAuth2 app client secret
 *   GOOGLE_REFRESH_TOKEN          Offline refresh token (for GMAIL_SENDER_EMAIL account)
 *   GMAIL_SENDER_EMAIL            Gmail address the token belongs to (e.g. efinney@brandguardhq.com)
 *   OUTREACH_SUPABASE_URL         Outreach DB URL (falls back to main Supabase)
 *   OUTREACH_SUPABASE_SECRET_API_KEY or OUTREACH_SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ─────────────────────────────────────────────────────────────────
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
// MUST match the Gmail account the refresh token belongs to
const GMAIL_SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || '';

// ── Types ──────────────────────────────────────────────────────────────────
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

export interface SendResult {
  draft_id: string;
  company: string;
  to: string;
  status: 'created' | 'skipped' | 'error';
  gmail_draft_id?: string;
  reason?: string;
}

export interface SendWorkerResult {
  processed: number;
  results: SendResult[];
  error?: string;
}

// ── Gmail OAuth2 ── get a fresh access token from the refresh token ─────────
async function getGmailAccessToken(): Promise<string> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      'Missing Google OAuth2 credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in Vercel env vars.'
    );
  }
  if (!GMAIL_SENDER_EMAIL) {
    throw new Error(
      'GMAIL_SENDER_EMAIL is not set. Set it to the Gmail address the GOOGLE_REFRESH_TOKEN belongs to (e.g. efinney@brandguardhq.com).'
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

// ── Build RFC 2822 email, base64url-encoded for the Gmail API ───────────────
function buildRawEmail(to: string, subject: string, body: string): string {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  const raw =
    `From: Brand Guard <${GMAIL_SENDER_EMAIL}>\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${encodedSubject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n` +
    `Content-Transfer-Encoding: quoted-printable\r\n` +
    `\r\n` +
    body;

  return Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ── Create a Gmail draft via the Gmail API ──────────────────────────────────
async function createGmailDraft(accessToken: string, to: string, subject: string, body: string): Promise<string> {
  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw: buildRawEmail(to, subject, body) } }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Gmail drafts.create failed: ${resp.status} — ${text}`);
  }

  const data = await resp.json() as { id?: string };
  return data.id || '';
}

// ── Compose final email body from draft row ─────────────────────────────────
function composeFinalBody(draft: ApprovedDraft): string {
  const bodyText = (draft.edited_body || draft.body || '').trim();
  const optOut = (draft.opt_out_line || '').trim();
  if (optOut && !bodyText.includes(optOut)) {
    return `${bodyText}\n\n${optOut}`;
  }
  return bodyText;
}

// ── Main: poll approved drafts and create Gmail drafts ──────────────────────
export async function runSendWorker(batchLimit = 50): Promise<SendWorkerResult> {
  if (!outreachUrl || !outreachServiceKey) {
    return {
      processed: 0,
      results: [],
      error: 'OUTREACH_SUPABASE_URL and OUTREACH_SUPABASE_SECRET_API_KEY are not configured.',
    };
  }

  const db = createClient(outreachUrl, outreachServiceKey);

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
      code === '42P01' || code === 'PGRST205' || code === 'PGRST202' ||
      msg.includes('does not exist') || msg.includes('could not find the table');
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

    if (!to) {
      results.push({ draft_id: draft.id, company, to: '', status: 'skipped', reason: 'No contact_email on prospect record' });
      continue;
    }

    const subject = draft.subject || `Brand protection opportunity for ${company}`;
    const bodyText = composeFinalBody(draft);

    if (!bodyText) {
      results.push({ draft_id: draft.id, company, to, status: 'skipped', reason: 'Empty email body' });
      continue;
    }

    try {
      const gmailDraftId = await createGmailDraft(accessToken, to, subject, bodyText);

      // Mark as sent — try to store gmail_draft_id if the column exists
      const updatePayload: Record<string, unknown> = { sent_at: nowIso };
      if (gmailDraftId) updatePayload.gmail_draft_id = gmailDraftId;

      const { error: updateErr } = await db.from('outreach_drafts').update(updatePayload).eq('id', draft.id);

      if (updateErr) {
        const colMissing = (updateErr.message || '').toLowerCase().includes('does not exist') ||
          (updateErr.message || '').toLowerCase().includes('column');
        if (colMissing) {
          await db.from('outreach_drafts').update({ sent_at: nowIso }).eq('id', draft.id);
        }
      }

      results.push({ draft_id: draft.id, company, to, status: 'created', gmail_draft_id: gmailDraftId || undefined });
    } catch (err) {
      results.push({ draft_id: draft.id, company, to, status: 'error', reason: (err as Error).message });
    }
  }

  return { processed: results.filter(r => r.status === 'created').length, results };
}
