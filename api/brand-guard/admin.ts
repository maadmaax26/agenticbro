/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/admin.ts — Brand Guard Admin API
 * ========================================================================
 * Admin-only endpoints for managing Brand Guard users, promo codes, and analytics.
 * Access is restricted to agenticbro@agenticbro.app only.
 *
 * GET  /api/brand-guard/admin/users               — List all registered users with promo/credit info
 * GET  /api/brand-guard/admin/stats               — Aggregate stats (total users, scans, credits)
 * POST /api/brand-guard/admin/grant-credits        — Grant credits to a user (admin override)
 * GET  /api/brand-guard/admin/review-queue         — Unreviewed outreach drafts awaiting human approval
 * POST /api/brand-guard/admin/apply-approvals      — Record human approve/reject decisions (no send)
 * GET  /api/brand-guard/admin/approved-drafts      — Approved + unsent drafts awaiting Gmail send
 * PATCH /api/brand-guard/admin/prospect            — Update contact_email / contact_name / linkedin_url on a prospect
 * POST /api/brand-guard/admin/save-draft           — Save a ProspectHunter-generated email as an unreviewed outreach draft
 * POST /api/brand-guard/admin/send-approved-drafts — Immediately create Gmail drafts for all approved+unsent email drafts
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Outreach pipeline (prospects / signals / outreach_drafts / suppression_list) lives on a
// SEPARATE Supabase project from the product DB, to isolate its Disk IO. The /review-queue and
// /apply-approvals routes use these creds; everything else in this file stays on the product DB.
// Falls back to the product creds when OUTREACH_* is unset, so behavior is unchanged until the
// OUTREACH_SUPABASE_* env vars are configured in the deployment environment.
const outreachUrl = process.env.OUTREACH_SUPABASE_URL || supabaseUrl;
const outreachServiceKey = process.env.OUTREACH_SUPABASE_SECRET_API_KEY || process.env.OUTREACH_SUPABASE_SERVICE_ROLE_KEY || supabaseServiceKey;

const ADMIN_EMAIL = 'agenticbro@agenticbro.app';

type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

async function getAuthenticatedUserId(req: VercelRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id, email: user.email || '' };
}

function parseBody(req: VercelRequest): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

/**
 * The outreach review-queue tables (prospects / outreach_drafts / signals /
 * suppression_list) are defined in the brand-guard-agent project's db/schema.sql
 * and may not yet be provisioned in every environment. This detects the
 * "table/relation does not exist" family of Postgres/PostgREST errors so the
 * admin endpoints can degrade gracefully instead of 500-ing.
 */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202') return true;
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

const TABLES_NOT_PROVISIONED =
  'Outreach review tables are not provisioned in this database. Apply db/schema.sql ' +
  'from the brand-guard-agent project to enable the review queue.';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── Auth check: only agenticbro@agenticbro.app ───────────────────────
  const authResult = await getAuthenticatedUserId(req);
  if (!authResult) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (authResult.email.toLowerCase() !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'Admin access required. This endpoint is restricted.' });
    return;
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  // Separate client for the outreach pipeline tables (may point at a different Supabase project).
  const outreachClient = createClient(outreachUrl, outreachServiceKey);
  const url = new URL(req.url || '', 'https://brand-guard.local');
  const path = url.pathname.replace('/api/brand-guard/admin', '').replace(/\/$/, '');

  // ══════════════════════════════════════════════════════════════════════════
  // GET /users — List all users with promo codes and credit info
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET' && path === '/users') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const search = url.searchParams.get('search') || '';

    // Query the admin view
    let query = serviceClient
      .from('brand_guard_admin_all_users')
      .select('*')
      .order('user_created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`email.ilike.%${search}%,promo_code.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: 'Failed to fetch users', details: error.message });
      return;
    }

    // Get total count
    const { count: totalCount } = await serviceClient
      .from('brand_guard_admin_all_users')
      .select('*', { count: 'exact', head: true });

    // Batch-fetch active subscriptions for all returned users so the UI can show a plan column
    const userIds = (data || []).map((u: Record<string, unknown>) => u.user_id as string).filter(Boolean);
    const subscriptionMap: Record<string, { plan_id: string; status: string }> = {};
    if (userIds.length > 0) {
      const { data: subs } = await serviceClient
        .from('brand_guard_subscriptions')
        .select('owner_id, plan_id, status')
        .in('owner_id', userIds)
        .in('status', ['active', 'trialing', 'trial_ending'])
        .order('created_at', { ascending: false });
      for (const sub of (subs || [])) {
        const s = sub as Record<string, string>;
        if (s.owner_id && !subscriptionMap[s.owner_id]) {
          subscriptionMap[s.owner_id] = { plan_id: s.plan_id, status: s.status };
        }
      }
    }

    const usersWithSubs = (data || []).map((u: Record<string, unknown>) => ({
      ...u,
      subscription_plan: subscriptionMap[u.user_id as string]?.plan_id || null,
      subscription_status: subscriptionMap[u.user_id as string]?.status || null,
    }));

    res.status(200).json({
      success: true,
      users: usersWithSubs,
      total: totalCount || 0,
      limit,
      offset,
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /stats — Aggregate admin stats
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET' && path === '/stats') {
    // Total users with credits
    const { count: totalUsers } = await serviceClient
      .from('brand_guard_credits')
      .select('*', { count: 'exact', head: true });

    // Total promo users
    const { count: promoUsers } = await serviceClient
      .from('brand_guard_credits')
      .select('*', { count: 'exact', head: true })
      .not('promo_code', 'is', null);

    // Total brands
    const { count: totalBrands } = await serviceClient
      .from('brand_monitors')
      .select('*', { count: 'exact', head: true });

    // Total scans (usage transactions)
    const { count: totalScans } = await serviceClient
      .from('brand_guard_credit_transactions')
      .select('*', { count: 'exact', head: true })
      .in('transaction_type', ['free_usage', 'paid_usage']);

    // Beta2026 users
    const { count: betaUsers } = await serviceClient
      .from('brand_guard_credits')
      .select('*', { count: 'exact', head: true })
      .eq('promo_code', 'beta2026');

    // Credits granted vs used
    const { data: creditSummary } = await serviceClient
      .from('brand_guard_credits')
      .select('free_credits_total, free_credits_used, paid_credits, paid_credits_total_purchased, promo_credits');

    const summary = creditSummary?.reduce((acc: Record<string, number>, row: Record<string, unknown>) => {
      acc.free_total += (row.free_credits_total as number) || 0;
      acc.free_used += (row.free_credits_used as number) || 0;
      acc.paid_balance += (row.paid_credits as number) || 0;
      acc.paid_purchased += (row.paid_credits_total_purchased as number) || 0;
      acc.promo_bonus += (row.promo_credits as number) || 0;
      return acc;
    }, { free_total: 0, free_used: 0, paid_balance: 0, paid_purchased: 0, promo_bonus: 0 }) || { free_total: 0, free_used: 0, paid_balance: 0, paid_purchased: 0, promo_bonus: 0 };

    // Scan type breakdown
    const { data: scanTypeData } = await serviceClient
      .from('brand_guard_credit_transactions')
      .select('description')
      .in('transaction_type', ['free_usage', 'paid_usage']);
    const scanTypes: Record<string, number> = {};
    for (const tx of (scanTypeData || [])) {
      const desc = (tx.description as string) || '';
      const match = desc.match(/scan:\s*(\w+)/i) || desc.match(/^(impersonator|domain|website|threat|vendor|email)\s/i);
      const type = match ? match[1].toLowerCase() : 'other';
      scanTypes[type] = (scanTypes[type] || 0) + 1;
    }

    // Recent signups
    const { data: recentSignups } = await serviceClient
      .from('brand_guard_credits')
      .select('owner_id, promo_code, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    const signupEmails: Record<string, string> = {};
    if (recentSignups && recentSignups.length > 0) {
      const userIds = recentSignups.map((r: Record<string, unknown>) => r.owner_id);
      const { data: signupUsers } = await serviceClient
        .from('auth.users')
        .select('id, email')
        .in('id', userIds);
      for (const u of (signupUsers || [])) {
        signupEmails[u.id] = u.email;
      }
    }
    const recentSignupsList = (recentSignups || []).map((r: Record<string, unknown>) => ({
      email: signupEmails[r.owner_id as string] || 'unknown',
      created_at: r.created_at as string,
      promo_code: r.promo_code as string | null,
    }));

    // Recent scans
    const { data: recentScans } = await serviceClient
      .from('brand_guard_credit_transactions')
      .select('owner_id, description, created_at')
      .in('transaction_type', ['free_usage', 'paid_usage'])
      .order('created_at', { ascending: false })
      .limit(20);
    const scanEmails: Record<string, string> = {};
    if (recentScans && recentScans.length > 0) {
      const userIds = [...new Set(recentScans.map((r: Record<string, unknown>) => r.owner_id as string))];
      const { data: scanUsers } = await serviceClient
        .from('auth.users')
        .select('id, email')
        .in('id', userIds);
      for (const u of (scanUsers || [])) {
        scanEmails[u.id] = u.email;
      }
    }
    const recentScansList = (recentScans || []).map((r: Record<string, unknown>) => {
      const desc = (r.description as string) || '';
      const typeMatch = desc.match(/scan:\s*(\w+)/i) || desc.match(/^(impersonator|domain|website|threat|vendor|email)\s/i);
      return {
        email: scanEmails[r.owner_id as string] || 'unknown',
        scan_type: typeMatch ? typeMatch[1] : 'unknown',
        created_at: r.created_at as string,
      };
    });

    res.status(200).json({
      success: true,
      stats: {
        total_users: totalUsers || 0,
        total_brands: totalBrands || 0,
        total_scans: totalScans || 0,
        promo_users: promoUsers || 0,
        beta2026_users: betaUsers || 0,
        scan_types: scanTypes,
        recent_signups: recentSignupsList,
        recent_scans: recentScansList,
        credits: summary,
      },
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /grant-credits — Admin grants credits to a user
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/grant-credits') {
    const body = await parseBody(req);
    const targetUserId = body.user_id as string;
    const amount = body.amount as number;
    const description = body.description as string;

    if (!targetUserId || !amount || amount <= 0) {
      res.status(400).json({ error: 'user_id and positive amount are required' });
      return;
    }

    const { data, error } = await serviceClient.rpc('add_brand_guard_credits', {
      p_owner_id: targetUserId,
      p_amount: amount,
      p_transaction_type: 'admin_adjustment',
      p_payment_method: 'admin',
      p_description: description || `Admin granted ${amount} credits`,
    });

    if (error) {
      res.status(500).json({ error: 'Failed to grant credits', details: error.message });
      return;
    }

    res.status(200).json({ success: true, ...(data as Record<string, unknown>) });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /notifications — Admin notification feed
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET' && path === '/notifications') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const typeFilter = url.searchParams.get('type') || '';

    let query = serviceClient
      .from('admin_notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) query = query.eq('read', false);
    if (typeFilter) query = query.eq('type', typeFilter);

    const { data, error, count } = await query;

    if (error) {
      res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
      return;
    }

    // Get unread count
    const { count: unreadCount } = await serviceClient
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false);

    res.status(200).json({
      success: true,
      notifications: data || [],
      total: count || 0,
      unread: unreadCount || 0,
      limit,
      offset,
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /notifications/mark-read — Mark notifications as read
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/notifications/mark-read') {
    const body = await parseBody(req);
    const ids = body.ids as string[] | null;
    const markAll = body.mark_all as boolean;

    if (markAll) {
      await serviceClient.from('admin_notifications').update({ read: true }).eq('read', false);
    } else if (ids && ids.length > 0) {
      await serviceClient.from('admin_notifications').update({ read: true }).in('id', ids);
    }

    res.status(200).json({ success: true });
    return;
  }

  // Enterprise account-manager operations.
  if (req.method === 'GET' && path === '/account-managers') {
    const [managers, assignments, cases] = await Promise.all([
      serviceClient.from('brand_guard_account_managers').select('*').order('name'),
      serviceClient.from('brand_guard_account_assignments').select('*, manager:brand_guard_account_managers(id, name, email)').eq('status', 'active'),
      serviceClient.from('brand_guard_account_cases').select('*').in('status', ['open', 'in_progress', 'waiting_customer']).order('priority', { ascending: false }).order('created_at'),
    ]);
    res.status(200).json({ managers: managers.data || [], assignments: assignments.data || [], open_cases: cases.data || [] });
    return;
  }

  if (req.method === 'GET' && path === '/delivery-monitoring') {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [queued, delivered, dead, failedEndpoints, jobs, letters] = await Promise.all([
      serviceClient.from('brand_guard_delivery_jobs').select('*', { count: 'exact', head: true }).in('status', ['queued', 'leased']),
      serviceClient.from('brand_guard_delivery_jobs').select('*', { count: 'exact', head: true }).eq('status', 'delivered').gte('delivered_at', since),
      serviceClient.from('brand_guard_delivery_dead_letters').select('*', { count: 'exact', head: true }).is('resolved_at', null),
      serviceClient.from('brand_guard_delivery_endpoints').select('*', { count: 'exact', head: true }).gt('consecutive_failures', 0),
      serviceClient.from('brand_guard_delivery_jobs').select('id, owner_id, endpoint_id, event_type, status, attempt_count, last_error, last_status_code, created_at, delivered_at').order('created_at', { ascending: false }).limit(100),
      serviceClient.from('brand_guard_delivery_dead_letters').select('id, original_job_id, owner_id, endpoint_id, final_error, attempt_count, resolved_at, created_at').order('created_at', { ascending: false }).limit(100),
    ]);
    res.status(200).json({
      summary: { queued: queued.count || 0, delivered_24h: delivered.count || 0, unresolved_dead_letters: dead.count || 0, degraded_endpoints: failedEndpoints.count || 0 },
      jobs: jobs.data || [], dead_letters: letters.data || [],
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /review-queue — Unreviewed outreach drafts awaiting human approval
  // Mirrors the Python store's _fetch_review_queue (db/store.py). Read-only.
  // Returns { available:false, drafts:[] } if the outreach tables aren't set up.
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET' && path === '/review-queue') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

    // Load suppression list so already-suppressed prospects can be flagged.
    const supEmails = new Set<string>();
    const supDomains = new Set<string>();
    const { data: supRows, error: supErr } = await outreachClient
      .from('suppression_list')
      .select('match_type, value');
    if (supErr) {
      if (isMissingTable(supErr)) {
        res.status(200).json({ success: true, available: false, count: 0, drafts: [], message: TABLES_NOT_PROVISIONED });
        return;
      }
      res.status(500).json({ error: 'Failed to read suppression list', details: supErr.message });
      return;
    }
    for (const s of (supRows || [])) {
      const row = s as Record<string, unknown>;
      const v = String(row.value || '').toLowerCase();
      if (!v) continue;
      if (row.match_type === 'email') supEmails.add(v);
      else supDomains.add(v);
    }

    const { data: rows, error } = await outreachClient
      .from('outreach_drafts')
      .select('*, prospects(*, signals(*))')
      .eq('approval', 'unreviewed')
      .is('sent_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTable(error)) {
        res.status(200).json({ success: true, available: false, count: 0, drafts: [], message: TABLES_NOT_PROVISIONED });
        return;
      }
      res.status(500).json({ error: 'Failed to fetch review queue', details: error.message });
      return;
    }

    const drafts = (rows || []).map((r: Record<string, unknown>) => {
      const pr = (r.prospects as Record<string, unknown>) || {};
      const email = String(pr.contact_email || '').toLowerCase();
      const domain = String(pr.primary_domain || '').toLowerCase();
      const channel = (r.channel as string) || '';
      return {
        draft_id: r.id,
        prospect_id: (pr.id as string | null) ?? (r.prospect_id as string | null) ?? null,
        company_name: pr.company_name ?? null,
        primary_domain: pr.primary_domain ?? null,
        vertical: pr.vertical ?? null,
        company_size_band: pr.company_size_band ?? null,
        compliance_region: pr.compliance_region ?? null,
        compliance_ok: Boolean(pr.compliance_ok),
        victim_score: (pr.victim_score as number) ?? 0,
        score_breakdown: pr.score_breakdown ?? {},
        channel,
        routing_reason: r.routing_reason ?? null,
        subject: r.subject ?? null,
        body: (r.body as string) ?? '',
        edited_body: r.edited_body ?? null,
        opt_out_line: r.opt_out_line ?? null,
        send_by_hand: channel === 'A' || channel === 'C',
        findings_used: r.findings_used ?? {},
        contact_channel: pr.contact_channel ?? null,
        contact_email: pr.contact_email ?? null,
        contact_name: (pr.contact_name as string | null) ?? null,
        linkedin_url: pr.linkedin_url ?? null,
        approval: r.approval ?? 'unreviewed',
        suppressed:
          Boolean(pr.suppressed) ||
          (email !== '' && supEmails.has(email)) ||
          (domain !== '' && supDomains.has(domain)),
        created_at: r.created_at ?? null,
        signals: pr.signals ?? [],
      };
    });

    res.status(200).json({ success: true, available: true, count: drafts.length, drafts });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /apply-approvals — Record human approve/reject decisions on drafts
  // Mirrors the Python store's apply_approvals (db/store.py). This is the ONLY
  // place approval state changes. It does NOT send anything — approving a draft
  // merely unlocks it for the existing (dry-run, suppression-aware) send worker.
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/apply-approvals') {
    const body = await parseBody(req);
    const raw = (body.decisions ?? body) as unknown;
    const decisions = Array.isArray(raw) ? raw : [];
    if (decisions.length === 0) {
      res.status(400).json({ error: 'Request must include a non-empty "decisions" array.' });
      return;
    }

    const fallbackApprover = (body.approved_by as string) || authResult.email || authResult.id;
    const nowIso = new Date().toISOString();
    const log: string[] = [];

    for (const dRaw of decisions) {
      const d = (dRaw || {}) as Record<string, unknown>;
      const draftId = d.draft_id as string | undefined;
      const decision = String(d.decision || '').toLowerCase();
      const approvedBy = (d.approved_by as string) || fallbackApprover;

      if (!draftId) { log.push('SKIP:missing_draft_id'); continue; }

      const { data: draftRow, error: findErr } = await outreachClient
        .from('outreach_drafts')
        .select('id, prospect_id, channel, prospects(primary_domain)')
        .eq('id', draftId)
        .maybeSingle();

      if (findErr) {
        if (isMissingTable(findErr)) {
          res.status(200).json({ success: true, available: false, applied: 0, skipped: log.length, log, message: TABLES_NOT_PROVISIONED });
          return;
        }
        log.push(`SKIP:lookup_failed:${draftId}`);
        continue;
      }
      if (!draftRow) { log.push(`SKIP:draft_not_found:${draftId}`); continue; }

      const draft = draftRow as Record<string, unknown>;
      const prospectId = draft.prospect_id as string | undefined;
      const prospectObj = (draft.prospects as Record<string, unknown>) || {};
      const domain = String(prospectObj.primary_domain || '?');

      if (decision === 'approve') {
        const draftUpdate: Record<string, unknown> = {
          approval: 'approved',
          approved_by: approvedBy,
          approved_at: nowIso,
        };
        if (typeof d.edited_body === 'string') draftUpdate.edited_body = d.edited_body;
        const newChannel = d.channel as string | undefined;
        if (newChannel) draftUpdate.channel = newChannel;
        await outreachClient.from('outreach_drafts').update(draftUpdate).eq('id', draftId);

        if (prospectId) {
          const prospectUpdate: Record<string, unknown> = { approval: 'approved', draft: 'approved' };
          if (newChannel) prospectUpdate.routed_channel = newChannel;
          await outreachClient.from('prospects').update(prospectUpdate).eq('id', prospectId);
        }
        const ch = newChannel || draft.channel || '?';
        log.push(`approve:${draftId}:${domain}:${ch}`);
      } else if (decision === 'reject') {
        await outreachClient.from('outreach_drafts').update({
          approval: 'rejected',
          approved_by: approvedBy,
          approved_at: nowIso,
        }).eq('id', draftId);

        if (prospectId) {
          await outreachClient.from('prospects').update({ approval: 'rejected', draft: 'none' }).eq('id', prospectId);
        }

        const suppress = (d.suppress || {}) as Record<string, unknown>;
        const supValue = suppress.value ? String(suppress.value) : '';
        if (supValue) {
          await outreachClient.from('suppression_list').upsert(
            { match_type: (suppress.match_type as string) || 'domain', value: supValue, reason: 'manual' },
            { onConflict: 'match_type,value' },
          );
          log.push(`reject+suppress:${draftId}:${supValue}`);
        } else {
          log.push(`reject:${draftId}:${domain}`);
        }
      } else {
        log.push(`UNKNOWN_DECISION:${decision}:${draftId}`);
      }
    }

    const skipped = log.filter(l => l.startsWith('SKIP') || l.startsWith('UNKNOWN'));
    res.status(200).json({
      success: true,
      available: true,
      applied: log.length - skipped.length,
      skipped: skipped.length,
      log,
    });
    return;
  }

  if (req.method === 'POST' && path === '/account-managers') {
    const body = req.body && Object.keys(req.body).length ? req.body : await parseBody(req);
    const { data, error } = await serviceClient.from('brand_guard_account_managers').insert({
      name: String(body.name || '').trim(), email: String(body.email || '').trim().toLowerCase(), max_accounts: Number(body.max_accounts || 25),
    }).select('*').single();
    if (error) res.status(500).json({ error: error.message });
    else res.status(201).json({ manager: data });
    return;
  }

  if (req.method === 'POST' && path === '/account-assignments') {
    const body = req.body && Object.keys(req.body).length ? req.body : await parseBody(req);
    const ownerId = String(body.owner_id || '');
    const managerId = String(body.manager_id || '');
    const { data: fortressSubscription } = await serviceClient.from('brand_guard_subscriptions').select('id')
      .eq('owner_id', ownerId).eq('plan_id', 'fortress').eq('status', 'active').maybeSingle();
    if (!fortressSubscription) { res.status(403).json({ error: 'Active Fortress subscription required' }); return; }
    const { data, error } = await serviceClient.from('brand_guard_account_assignments').upsert({
      owner_id: ownerId, manager_id: managerId, status: 'active', next_review_at: body.next_review_at || null,
      notes: body.notes || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id' }).select('*').single();
    if (!error) await serviceClient.from('brand_guard_sla_policies').upsert({ owner_id: ownerId }, { onConflict: 'owner_id' });
    if (error) res.status(500).json({ error: error.message });
    else res.status(200).json({ assignment: data });
    return;
  }

  if (req.method === 'PATCH' && path === '/account-cases') {
    const body = req.body && Object.keys(req.body).length ? req.body : await parseBody(req);
    const caseId = String(body.case_id || '');
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of ['status', 'priority', 'due_at']) if (body[field] !== undefined) updates[field] = body[field];
    if (body.status === 'resolved' || body.status === 'closed') updates.resolved_at = new Date().toISOString();
    const { data, error } = await serviceClient.from('brand_guard_account_cases').update(updates).eq('id', caseId).select('*').maybeSingle();
    if (data) await serviceClient.from('brand_guard_account_case_events').insert({
      case_id: caseId, actor_id: authResult.id, event_type: 'manager_update', message: body.message || null, metadata: updates,
    });
    if (error) res.status(500).json({ error: error.message });
    else if (!data) res.status(404).json({ error: 'Case not found' });
    else res.status(200).json({ case: data });
    return;
  }

  if (req.method === 'POST' && path === '/delivery-dead-letters/replay') {
    const body = req.body && Object.keys(req.body).length ? req.body : await parseBody(req);
    const deadLetterId = String(body.dead_letter_id || '');
    const { data: letter } = await serviceClient.from('brand_guard_delivery_dead_letters')
      .select('id, original_job_id').eq('id', deadLetterId).is('resolved_at', null).maybeSingle();
    if (!letter) { res.status(404).json({ error: 'Dead letter not found' }); return; }
    const now = new Date().toISOString();
    const { error } = await serviceClient.from('brand_guard_delivery_jobs').update({
      status: 'queued', attempt_count: 0, available_at: now, last_error: null,
      last_status_code: null, locked_by: null, locked_until: null, lease_token: null, updated_at: now,
    }).eq('id', letter.original_job_id);
    if (!error) await serviceClient.from('brand_guard_delivery_dead_letters').update({ resolved_at: now, resolution_notes: 'Replayed by admin' }).eq('id', letter.id);
    if (error) res.status(500).json({ error: error.message });
    else res.status(202).json({ replayed: letter.original_job_id });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /user-details — Brands + active subscription for a specific user
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET' && path === '/user-details') {
    const userId = url.searchParams.get('user_id');
    if (!userId) { res.status(400).json({ error: 'user_id is required' }); return; }

    const [brandsResult, subscriptionResult] = await Promise.all([
      serviceClient
        .from('brand_monitors')
        .select('id, brand_name, brand_handle, brand_domain, platforms, scan_frequency, last_scan_at, is_active, scan_count')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false }),
      serviceClient
        .from('brand_guard_subscriptions')
        .select('id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, monthly_credits_included, stripe_subscription_id')
        .eq('owner_id', userId)
        .in('status', ['active', 'trialing', 'trial_ending', 'canceled', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    res.status(200).json({
      success: true,
      brands: brandsResult.data || [],
      subscription: subscriptionResult.data || null,
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE /brand — Delete a brand monitor (admin)
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'DELETE' && path === '/brand') {
    const body = await parseBody(req);
    const brandId = body.brand_id as string;
    if (!brandId) { res.status(400).json({ error: 'brand_id is required' }); return; }

    const { error } = await serviceClient.from('brand_monitors').delete().eq('id', brandId);
    if (error) { res.status(500).json({ error: 'Failed to delete brand', details: error.message }); return; }

    res.status(200).json({ success: true });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH /brand — Update brand details (admin)
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'PATCH' && path === '/brand') {
    const body = await parseBody(req);
    const brandId = body.brand_id as string;
    if (!brandId) { res.status(400).json({ error: 'brand_id is required' }); return; }

    const updates: Record<string, unknown> = {};
    for (const field of ['brand_name', 'brand_handle', 'brand_domain', 'platforms', 'scan_frequency']) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    const { data, error } = await serviceClient
      .from('brand_monitors')
      .update(updates)
      .eq('id', brandId)
      .select('id, brand_name, brand_handle, brand_domain, platforms, scan_frequency, last_scan_at, is_active, scan_count')
      .maybeSingle();
    if (error) { res.status(500).json({ error: 'Failed to update brand', details: error.message }); return; }

    res.status(200).json({ success: true, brand: data });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH /subscription — Modify subscription plan or status (admin)
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'PATCH' && path === '/subscription') {
    const body = await parseBody(req);
    const subscriptionId = body.subscription_id as string;
    if (!subscriptionId) { res.status(400).json({ error: 'subscription_id is required' }); return; }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of ['plan_id', 'status', 'cancel_at_period_end']) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    const { data, error } = await serviceClient
      .from('brand_guard_subscriptions')
      .update(updates)
      .eq('id', subscriptionId)
      .select('id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, monthly_credits_included, stripe_subscription_id')
      .maybeSingle();
    if (error) { res.status(500).json({ error: 'Failed to update subscription', details: error.message }); return; }

    res.status(200).json({ success: true, subscription: data });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE /subscription — Remove a subscription record (admin)
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'DELETE' && path === '/subscription') {
    const body = await parseBody(req);
    const subscriptionId = body.subscription_id as string;
    if (!subscriptionId) { res.status(400).json({ error: 'subscription_id is required' }); return; }

    const { error } = await serviceClient
      .from('brand_guard_subscriptions')
      .delete()
      .eq('id', subscriptionId);
    if (error) { res.status(500).json({ error: 'Failed to remove subscription', details: error.message }); return; }

    res.status(200).json({ success: true });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /approved-drafts — Approved outreach drafts waiting to be sent
  // Returns the same shape as /review-queue but filtered to approval='approved'
  // and sent_at IS NULL. Used by the admin Approved Queue view and by the
  // Cowork Gmail scheduled task.
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET' && path === '/approved-drafts') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
    const { data: rows, error } = await outreachClient
      .from('outreach_drafts')
      .select('*, prospects(id, company_name, primary_domain, vertical, contact_email, contact_name, contact_title, linkedin_url, victim_score, compliance_region, compliance_ok, signals(*))')
      .eq('approval', 'approved')
      .is('sent_at', null)
      .order('approved_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTable(error)) {
        res.status(200).json({ success: true, available: false, count: 0, drafts: [], message: TABLES_NOT_PROVISIONED });
        return;
      }
      res.status(500).json({ error: 'Failed to fetch approved drafts', details: error.message });
      return;
    }

    const approvedDrafts = (rows || []).map((r: Record<string, unknown>) => {
      const pr = (r.prospects as Record<string, unknown>) || {};
      const channel = (r.channel as string) || '';
      return {
        draft_id: r.id,
        prospect_id: (pr.id as string | null) ?? (r.prospect_id as string | null) ?? null,
        company_name: pr.company_name ?? null,
        primary_domain: pr.primary_domain ?? null,
        vertical: pr.vertical ?? null,
        contact_email: pr.contact_email ?? null,
        contact_name: (pr.contact_name as string | null) ?? null,
        linkedin_url: (pr.linkedin_url as string | null) ?? null,
        compliance_region: pr.compliance_region ?? null,
        compliance_ok: Boolean(pr.compliance_ok),
        victim_score: (pr.victim_score as number) ?? 0,
        channel,
        subject: r.subject ?? null,
        body: (r.body as string) ?? '',
        edited_body: r.edited_body ?? null,
        opt_out_line: r.opt_out_line ?? null,
        approved_at: r.approved_at ?? null,
        created_at: r.created_at ?? null,
        signals: (pr.signals as unknown[]) ?? [],
      };
    });

    res.status(200).json({ success: true, available: true, count: approvedDrafts.length, drafts: approvedDrafts });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH /prospect — Update contact details on a prospect record
  // Editable fields: contact_email, contact_name, contact_title, linkedin_url
  // Used to fix registrar/abuse contact emails before approving a draft.
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'PATCH' && path === '/prospect') {
    const body = await parseBody(req);
    const prospectId = body.prospect_id as string;
    if (!prospectId) { res.status(400).json({ error: 'prospect_id is required' }); return; }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of ['contact_email', 'contact_name', 'contact_title', 'linkedin_url']) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    const { data, error } = await outreachClient
      .from('prospects')
      .update(updates)
      .eq('id', prospectId)
      .select('id, contact_email, contact_name, contact_title, linkedin_url, updated_at')
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) {
        res.status(200).json({ success: false, available: false, message: TABLES_NOT_PROVISIONED });
        return;
      }
      res.status(500).json({ error: 'Failed to update prospect', details: error.message });
      return;
    }

    res.status(200).json({ success: true, prospect: data });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /prospects — Browse all prospects with search + filter
  // Params: search (company/domain/email), channel, approval, suppressed,
  //         compliance_ok, sort (victim_score|created_at), order (desc|asc),
  //         limit (max 200), offset
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET' && path === '/prospects') {
    const search = url.searchParams.get('search') || '';
    const channelFilter = url.searchParams.get('channel') || '';
    const approvalFilter = url.searchParams.get('approval') || '';
    const suppressedFilter = url.searchParams.get('suppressed') || '';
    const complianceFilter = url.searchParams.get('compliance_ok') || '';
    const sort = url.searchParams.get('sort') || 'victim_score';
    const order = url.searchParams.get('order') === 'asc';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const allowedSort = ['victim_score', 'created_at', 'company_name', 'primary_domain', 'updated_at'];
    const sortCol = allowedSort.includes(sort) ? sort : 'victim_score';

    let query = outreachClient
      .from('prospects')
      .select('id, company_name, primary_domain, vertical, contact_email, contact_name, contact_title, linkedin_url, victim_score, compliance_ok, compliance_region, suppressed, channel, approval, sent_at, created_at, updated_at', { count: 'exact' })
      .order(sortCol, { ascending: order })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,primary_domain.ilike.%${search}%,contact_email.ilike.%${search}%,contact_name.ilike.%${search}%`
      );
    }
    if (channelFilter) query = query.eq('channel', channelFilter);
    if (approvalFilter) query = query.eq('approval', approvalFilter);
    if (suppressedFilter === 'true') query = query.eq('suppressed', true);
    else if (suppressedFilter === 'false') query = query.eq('suppressed', false);
    if (complianceFilter === 'true') query = query.eq('compliance_ok', true);
    else if (complianceFilter === 'false') query = query.eq('compliance_ok', false);

    const { data, error, count } = await query;

    if (error) {
      if (isMissingTable(error)) {
        res.status(200).json({ success: true, available: false, total: 0, prospects: [], message: TABLES_NOT_PROVISIONED });
        return;
      }
      res.status(500).json({ error: 'Failed to fetch prospects', details: error.message });
      return;
    }

    res.status(200).json({ success: true, available: true, total: count ?? 0, offset, limit, prospects: data || [] });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /save-draft — Save a manually-written or AI-generated email as an
  // unreviewed outreach draft in the pipeline. Creates the prospect row if
  // one doesn't already exist for the domain. Called from ProspectHunter's
  // "Save to Queue" button.
  //
  // Body: { company_name, primary_domain, contact_email?, contact_name?,
  //         contact_title?, linkedin_url?, vertical?, threat_type?,
  //         victim_score?, subject?, body, channel? }
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/save-draft') {
    const body = await parseBody(req);
    const companyName   = String(body.company_name   || '').trim();
    const primaryDomain = String(body.primary_domain || '').trim().toLowerCase();
    const contactEmail  = String(body.contact_email  || '').trim().toLowerCase();
    const contactName   = String(body.contact_name   || '').trim();
    const contactTitle  = String(body.contact_title  || '').trim();
    const linkedinUrl   = String(body.linkedin_url   || '').trim();
    const vertical      = String(body.vertical       || '').trim();
    const threatType    = String(body.threat_type    || '').trim();
    const victimScore   = Math.min(100, Math.max(0, Number(body.victim_score) || 50));
    const subject       = String(body.subject        || '').trim() || null;
    const emailBody     = String(body.body           || '').trim();
    const channel       = String(body.channel        || (contactEmail ? 'A' : 'C')).toUpperCase();

    if (!companyName && !primaryDomain) {
      res.status(400).json({ error: 'company_name or primary_domain is required' });
      return;
    }
    if (!emailBody) {
      res.status(400).json({ error: 'body (email text) is required' });
      return;
    }

    // ── 1. Upsert prospect ────────────────────────────────────────────────
    let prospectId: string | null = null;

    // Try to find an existing prospect by domain first
    if (primaryDomain) {
      const { data: existing } = await outreachClient
        .from('prospects')
        .select('id')
        .eq('primary_domain', primaryDomain)
        .maybeSingle();
      if (existing) prospectId = (existing as Record<string, unknown>).id as string;
    }

    if (!prospectId) {
      // Insert new prospect
      const prospectRow: Record<string, unknown> = {
        company_name:    companyName  || null,
        primary_domain:  primaryDomain || null,
        contact_email:   contactEmail  || null,
        contact_name:    contactName   || null,
        contact_title:   contactTitle  || null,
        linkedin_url:    linkedinUrl   || null,
        vertical:        vertical      || null,
        victim_score:    victimScore,
        compliance_ok:   true,   // assume OK for manually discovered prospects
        suppressed:      false,
        approval:        'unreviewed',
        channel,
        created_at:      new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      };
      if (threatType) prospectRow.threat_type = threatType;

      const { data: newProspect, error: prospectErr } = await outreachClient
        .from('prospects')
        .insert(prospectRow)
        .select('id')
        .maybeSingle();

      if (prospectErr) {
        if (isMissingTable(prospectErr)) {
          res.status(200).json({ success: false, available: false, message: TABLES_NOT_PROVISIONED });
          return;
        }
        res.status(500).json({ error: 'Failed to create prospect', details: prospectErr.message });
        return;
      }
      prospectId = newProspect ? (newProspect as Record<string, unknown>).id as string : null;
    } else if (contactEmail || contactName || contactTitle || linkedinUrl) {
      // Update contact details on existing prospect if we have new info
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (contactEmail) updates.contact_email = contactEmail;
      if (contactName)  updates.contact_name  = contactName;
      if (contactTitle) updates.contact_title = contactTitle;
      if (linkedinUrl)  updates.linkedin_url  = linkedinUrl;
      await outreachClient.from('prospects').update(updates).eq('id', prospectId);
    }

    // ── 2. Insert outreach_draft ──────────────────────────────────────────
    const draftRow: Record<string, unknown> = {
      prospect_id:  prospectId,
      channel,
      subject,
      body:         emailBody,
      approval:     'unreviewed',
      created_at:   new Date().toISOString(),
      routing_reason: 'manual:prospect-hunter',
    };

    const { data: newDraft, error: draftErr } = await outreachClient
      .from('outreach_drafts')
      .insert(draftRow)
      .select('id')
      .maybeSingle();

    if (draftErr) {
      if (isMissingTable(draftErr)) {
        res.status(200).json({ success: false, available: false, message: TABLES_NOT_PROVISIONED });
        return;
      }
      res.status(500).json({ error: 'Failed to save draft', details: draftErr.message });
      return;
    }

    const draftId = newDraft ? (newDraft as Record<string, unknown>).id as string : null;
    res.status(201).json({ success: true, draft_id: draftId, prospect_id: prospectId });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /send-approved-drafts — Disabled (outreach pipeline removed)
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && path === '/send-approved-drafts') {
    res.status(410).json({ error: 'This endpoint has been disabled.' });
    return;
  }

  res.status(404).json({ error: 'Not found' });
}

export const config = {
  maxDuration: 15,
};
