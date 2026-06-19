import { randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { encryptDeliverySecret, validateDeliveryUrl } from '../_lib/delivery-crypto.js';
import { requireBrandGuardEntitlement } from '../_lib/brand-guard-entitlements.js';

const CHANNELS = new Set(['slack', 'webhook']);
const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const EVENTS = new Set(['alert', 'weekly_briefing', 'sla_report', 'test']);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const entitlement = await requireBrandGuardEntitlement(req, res, 'customer_delivery');
  if (!entitlement) return;
  const db = entitlement.db;
  const path = (req.url || '').split('?')[0].replace('/api/brand-guard/delivery', '').replace(/\/$/, '');

  if (req.method === 'GET' && path === '/monitoring') {
    const [queued, delivered, dead, endpoints, recentJobs, deadLetters] = await Promise.all([
      db.from('brand_guard_delivery_jobs').select('*', { count: 'exact', head: true }).eq('owner_id', entitlement.ownerId).in('status', ['queued', 'leased']),
      db.from('brand_guard_delivery_jobs').select('*', { count: 'exact', head: true }).eq('owner_id', entitlement.ownerId).eq('status', 'delivered').gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      db.from('brand_guard_delivery_dead_letters').select('*', { count: 'exact', head: true }).eq('owner_id', entitlement.ownerId).is('resolved_at', null),
      db.from('brand_guard_delivery_endpoints').select('id, name, channel, enabled, consecutive_failures, last_success_at, last_failure_at').eq('owner_id', entitlement.ownerId),
      db.from('brand_guard_delivery_jobs').select('id, endpoint_id, event_type, status, attempt_count, last_error, last_status_code, created_at, delivered_at').eq('owner_id', entitlement.ownerId).order('created_at', { ascending: false }).limit(50),
      db.from('brand_guard_delivery_dead_letters').select('id, original_job_id, endpoint_id, final_error, attempt_count, created_at').eq('owner_id', entitlement.ownerId).is('resolved_at', null).order('created_at', { ascending: false }).limit(50),
    ]);
    res.status(200).json({
      summary: { queued: queued.count || 0, delivered_24h: delivered.count || 0, dead_letters: dead.count || 0 },
      endpoints: endpoints.data || [], jobs: recentJobs.data || [], dead_letters: deadLetters.data || [],
    });
    return;
  }

  if (req.method === 'GET') {
    const { data, error } = await db.from('brand_guard_delivery_endpoints')
      .select('id, brand_monitor_id, name, channel, event_types, minimum_severity, enabled, last_success_at, last_failure_at, consecutive_failures, created_at, updated_at')
      .eq('owner_id', entitlement.ownerId).eq('enabled', true).order('created_at', { ascending: false });
    if (error) res.status(500).json({ error: error.message });
    else res.status(200).json({ endpoints: data || [] });
    return;
  }

  if (req.method === 'POST' && path === '/test') {
    const endpointId = String(req.body?.endpoint_id || '');
    const { data: endpoint } = await db.from('brand_guard_delivery_endpoints').select('id')
      .eq('id', endpointId).eq('owner_id', entitlement.ownerId).eq('enabled', true).maybeSingle();
    if (!endpoint) { res.status(404).json({ error: 'Endpoint not found' }); return; }
    const { data, error } = await db.from('brand_guard_delivery_jobs').insert({
      owner_id: entitlement.ownerId,
      endpoint_id: endpoint.id,
      event_type: 'test',
      payload: { event: 'brand_guard.test', message: 'Brand Guard delivery test', created_at: new Date().toISOString() },
      idempotency_key: `test:${endpoint.id}:${Date.now()}:${randomBytes(4).toString('hex')}`,
    }).select('id, status').single();
    if (error) res.status(500).json({ error: error.message });
    else res.status(202).json({ job: data });
    return;
  }

  if (req.method === 'POST' && path === '/dead-letters/replay') {
    const deadLetterId = String(req.body?.dead_letter_id || '');
    const { data: letter } = await db.from('brand_guard_delivery_dead_letters').select('id, original_job_id')
      .eq('id', deadLetterId).eq('owner_id', entitlement.ownerId).is('resolved_at', null).maybeSingle();
    if (!letter) { res.status(404).json({ error: 'Dead letter not found' }); return; }
    const now = new Date().toISOString();
    const { error } = await db.from('brand_guard_delivery_jobs').update({
      status: 'queued', attempt_count: 0, available_at: now, last_error: null,
      last_status_code: null, locked_by: null, locked_until: null, lease_token: null, updated_at: now,
    }).eq('id', letter.original_job_id).eq('owner_id', entitlement.ownerId);
    if (!error) await db.from('brand_guard_delivery_dead_letters').update({ resolved_at: now, resolution_notes: 'Replayed by customer' }).eq('id', letter.id);
    if (error) res.status(500).json({ error: error.message });
    else res.status(202).json({ replayed: letter.original_job_id });
    return;
  }

  if (req.method === 'POST') {
    const name = String(req.body?.name || '').trim().slice(0, 100);
    const channel = String(req.body?.channel || '') as 'slack' | 'webhook';
    const endpointUrl = String(req.body?.url || '');
    const events = Array.isArray(req.body?.event_types) ? req.body.event_types.map(String) : ['alert'];
    const minimumSeverity = String(req.body?.minimum_severity || 'low');
    if (!name || !CHANNELS.has(channel) || !SEVERITIES.has(minimumSeverity) || events.some((event: string) => !EVENTS.has(event))) {
      res.status(400).json({ error: 'Invalid name, channel, event_types, or minimum_severity' });
      return;
    }
    try { validateDeliveryUrl(endpointUrl, channel); } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid endpoint URL' });
      return;
    }
    const monitorId = req.body?.brand_monitor_id ? String(req.body.brand_monitor_id) : null;
    if (monitorId) {
      const { data: monitor } = await db.from('brand_monitors').select('id').eq('id', monitorId).eq('owner_id', entitlement.ownerId).maybeSingle();
      if (!monitor) { res.status(404).json({ error: 'Brand monitor not found' }); return; }
    }
    const signingSecret = channel === 'webhook' ? String(req.body?.signing_secret || randomBytes(32).toString('base64url')) : '';
    const { data, error } = await db.from('brand_guard_delivery_endpoints').insert({
      owner_id: entitlement.ownerId, brand_monitor_id: monitorId, name, channel,
      endpoint_ciphertext: encryptDeliverySecret(endpointUrl),
      signing_secret_ciphertext: signingSecret ? encryptDeliverySecret(signingSecret) : null,
      event_types: events, minimum_severity: minimumSeverity,
    }).select('id, brand_monitor_id, name, channel, event_types, minimum_severity, enabled, created_at').single();
    if (error) res.status(500).json({ error: error.message });
    else res.status(201).json({ endpoint: data, signing_secret: channel === 'webhook' ? signingSecret : undefined, warning: channel === 'webhook' ? 'The signing secret is shown once.' : undefined });
    return;
  }

  if (req.method === 'PATCH') {
    const id = String(req.query.id || '');
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (req.body?.name !== undefined) updates.name = String(req.body.name).slice(0, 100);
    if (req.body?.enabled !== undefined) updates.enabled = Boolean(req.body.enabled);
    if (req.body?.minimum_severity !== undefined && SEVERITIES.has(String(req.body.minimum_severity))) updates.minimum_severity = String(req.body.minimum_severity);
    if (Array.isArray(req.body?.event_types) && req.body.event_types.every((event: unknown) => EVENTS.has(String(event)))) updates.event_types = req.body.event_types.map(String);
    const { data, error } = await db.from('brand_guard_delivery_endpoints').update(updates)
      .eq('id', id).eq('owner_id', entitlement.ownerId).select('id, name, enabled, event_types, minimum_severity, updated_at').maybeSingle();
    if (error) res.status(500).json({ error: error.message });
    else if (!data) res.status(404).json({ error: 'Endpoint not found' });
    else res.status(200).json({ endpoint: data });
    return;
  }

  if (req.method === 'DELETE') {
    const id = String(req.query.id || '');
    const { data, error } = await db.from('brand_guard_delivery_endpoints')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('id', id).eq('owner_id', entitlement.ownerId).select('id').maybeSingle();
    if (error) res.status(500).json({ error: error.message });
    else if (!data) res.status(404).json({ error: 'Endpoint not found' });
    else res.status(200).json({ disabled: id });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
