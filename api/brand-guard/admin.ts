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
 * GET  /api/brand-guard/admin/users          — List all registered users with promo/credit info
 * GET  /api/brand-guard/admin/stats           — Aggregate stats (total users, scans, credits)
 * POST /api/brand-guard/admin/grant-credits   — Grant credits to a user (admin override)
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
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

    const { data, error, count } = await query;

    if (error) {
      res.status(500).json({ error: 'Failed to fetch users', details: error.message });
      return;
    }

    // Get total count
    const { count: totalCount } = await serviceClient
      .from('brand_guard_admin_all_users')
      .select('*', { count: 'exact', head: true });

    res.status(200).json({
      success: true,
      users: data || [],
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

  res.status(404).json({ error: 'Not found' });
}

export const config = {
  maxDuration: 15,
};
