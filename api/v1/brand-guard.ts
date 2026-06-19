import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { authenticateDeveloperRequest, logDeveloperUsage, type DeveloperIdentity } from '../_lib/brand-guard-auth.js';
import { entitlementsForOwner, ownerHasFeature } from '../_lib/brand-guard-entitlements.js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const db = createClient(url, serviceKey);

const PLAN_PRIORITY: Record<string, number> = { free: 10, guardian: 30, sentinel: 60, fortress: 100 };
const PLATFORMS = new Set(['x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin']);
const JOB_TYPES = new Set(['impersonator', 'domain', 'email', 'full']);

function routeParts(req: VercelRequest): string[] {
  const pathname = (req.url || '').split('?')[0];
  const parts = pathname.split('/').filter(Boolean);
  const root = parts.lastIndexOf('brand-guard');
  return root >= 0 ? parts.slice(root + 1) : [];
}

async function activePlan(ownerId: string): Promise<string> {
  const { data } = await db.from('brand_guard_subscriptions').select('plan_id')
    .eq('owner_id', ownerId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data?.plan_id || 'free';
}

async function respond(
  req: VercelRequest,
  res: VercelResponse,
  identity: DeveloperIdentity,
  scope: string,
  startedAt: number,
  status: number,
  body: unknown,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await logDeveloperUsage(db, req, identity, scope, status, startedAt, metadata);
  res.status(status).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const startedAt = Date.now();
  const parts = routeParts(req);
  const resource = parts[0] || '';
  const id = parts[1] || '';
  const method = req.method || 'GET';
  const scope = resource === 'usage' ? 'usage:read'
    : `${resource === 'takedowns' ? 'takedowns' : 'scans'}:${method === 'GET' ? 'read' : 'write'}`;
  const identity = await authenticateDeveloperRequest(req, res, db, scope);
  if (!identity) return;
  const entitlement = await entitlementsForOwner(identity.ownerId, db);
  if (!ownerHasFeature(entitlement, 'developer_api')) {
    await respond(req, res, identity, scope, startedAt, 403, {
      error: 'entitlement_required', feature: 'developer_api', current_plan: entitlement.plan, required_plan: 'sentinel',
    });
    return;
  }

  try {
    if (resource === 'scans' && method === 'POST' && !id) {
      const monitorId = String(req.body?.brand_monitor_id || '');
      const jobType = String(req.body?.job_type || 'full');
      if (!monitorId || !JOB_TYPES.has(jobType)) {
        await respond(req, res, identity, scope, startedAt, 400, { error: 'brand_monitor_id and valid job_type are required' });
        return;
      }
      const { data: monitor } = await db.from('brand_monitors')
        .select('id, brand_name, brand_handle, brand_domain, platforms')
        .eq('id', monitorId).eq('owner_id', identity.ownerId).eq('is_active', true).maybeSingle();
      if (!monitor) {
        await respond(req, res, identity, scope, startedAt, 404, { error: 'brand_monitor_not_found' });
        return;
      }
      const platforms = Array.isArray(req.body?.platforms)
        ? req.body.platforms.map(String).filter((platform: string) => PLATFORMS.has(platform))
        : monitor.platforms;
      if (!platforms?.length) {
        await respond(req, res, identity, scope, startedAt, 400, { error: 'At least one supported platform is required' });
        return;
      }
      const plan = await activePlan(identity.ownerId);
      const idempotencyKey = String(req.headers['idempotency-key'] || '').trim() || null;
      const row = {
        owner_id: identity.ownerId,
        api_key_id: identity.apiKeyId,
        brand_monitor_id: monitor.id,
        plan_id: plan,
        job_type: jobType,
        priority: PLAN_PRIORITY[plan] || 10,
        idempotency_key: idempotencyKey ? `${identity.ownerId}:${idempotencyKey}` : null,
        payload: {
          brand_name: monitor.brand_name,
          brand_handle: monitor.brand_handle,
          brand_domain: monitor.brand_domain,
          platforms,
          source: 'developer_api',
        },
      };
      let query = db.from('brand_guard_scan_queue').insert(row).select('id, status, priority, scheduled_for, created_at').single();
      let { data, error } = await query;
      if (error?.code === '23505' && row.idempotency_key) {
        const existing = await db.from('brand_guard_scan_queue')
          .select('id, status, priority, scheduled_for, created_at')
          .eq('idempotency_key', row.idempotency_key).eq('owner_id', identity.ownerId).single();
        data = existing.data;
        error = existing.error;
      }
      if (error || !data) throw new Error(error?.message || 'Failed to enqueue scan');
      await respond(req, res, identity, scope, startedAt, 202, { job: data }, { job_id: data.id, job_type: jobType });
      return;
    }

    if (resource === 'scans' && method === 'GET') {
      let query = db.from('brand_guard_scan_queue')
        .select('id, brand_monitor_id, job_type, plan_id, status, priority, result, last_error, attempt_count, scheduled_for, created_at, started_at, completed_at')
        .eq('owner_id', identity.ownerId).order('created_at', { ascending: false });
      query = id ? query.eq('id', id).limit(1) : query.limit(Math.min(Number(req.query.limit) || 25, 100));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (id && !data?.length) {
        await respond(req, res, identity, scope, startedAt, 404, { error: 'scan_job_not_found' });
      } else {
        await respond(req, res, identity, scope, startedAt, 200, id ? { job: data?.[0] } : { jobs: data || [] });
      }
      return;
    }

    if (resource === 'takedowns' && method === 'POST' && !id) {
      const monitorId = String(req.body?.brand_monitor_id || '');
      const platform = String(req.body?.platform || '').toLowerCase();
      const targetUrl = String(req.body?.target_url || '');
      if (!monitorId || !platform || !targetUrl) {
        await respond(req, res, identity, scope, startedAt, 400, { error: 'brand_monitor_id, platform, and target_url are required' });
        return;
      }
      const { data: monitor } = await db.from('brand_monitors').select('id')
        .eq('id', monitorId).eq('owner_id', identity.ownerId).maybeSingle();
      if (!monitor) {
        await respond(req, res, identity, scope, startedAt, 404, { error: 'brand_monitor_not_found' });
        return;
      }
      const payload = {
        target_url: targetUrl,
        claim: req.body?.claim || 'brand_impersonation',
        evidence: req.body?.evidence || [],
        contact: req.body?.contact || {},
      };
      const { data, error } = await db.from('takedown_actions').insert({
        owner_id: identity.ownerId,
        brand_monitor_id: monitorId,
        report_id: req.body?.report_id || null,
        impersonator_id: req.body?.impersonator_id || null,
        platform,
        action_type: 'report',
        status: 'queued',
        evidence_url: targetUrl,
        submission_payload: payload,
        submission_provider: 'gateway',
        next_attempt_at: new Date().toISOString(),
      }).select('id, status, platform, created_at').single();
      if (error || !data) throw new Error(error?.message || 'Failed to queue takedown');
      await respond(req, res, identity, scope, startedAt, 202, { takedown: data }, { takedown_id: data.id });
      return;
    }

    if (resource === 'takedowns' && method === 'GET') {
      let query = db.from('takedown_actions')
        .select('id, brand_monitor_id, report_id, platform, action_type, status, evidence_url, external_reference, attempt_count, last_error, submitted_at, acknowledged_at, completed_at, created_at, updated_at')
        .eq('owner_id', identity.ownerId).order('created_at', { ascending: false });
      query = id ? query.eq('id', id).limit(1) : query.limit(Math.min(Number(req.query.limit) || 25, 100));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (id && !data?.length) await respond(req, res, identity, scope, startedAt, 404, { error: 'takedown_not_found' });
      else await respond(req, res, identity, scope, startedAt, 200, id ? { takedown: data?.[0] } : { takedowns: data || [] });
      return;
    }

    if (resource === 'usage' && method === 'GET') {
      const since = typeof req.query.since === 'string' ? req.query.since : new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await db.from('brand_guard_api_usage_logs')
        .select('request_id, method, path, scope, status_code, duration_ms, units, created_at')
        .eq('owner_id', identity.ownerId).gte('created_at', since).order('created_at', { ascending: false }).limit(1000);
      if (error) throw new Error(error.message);
      const logs = data || [];
      await respond(req, res, identity, scope, startedAt, 200, {
        period_start: since,
        totals: {
          requests: logs.length,
          units: logs.reduce((sum, item) => sum + item.units, 0),
          errors: logs.filter(item => item.status_code >= 400).length,
        },
        usage: logs,
      });
      return;
    }

    await respond(req, res, identity, scope, startedAt, 404, { error: 'not_found' });
  } catch (error) {
    await respond(req, res, identity, scope, startedAt, 500, {
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
