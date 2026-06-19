import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

interface TakedownAction {
  id: string;
  owner_id: string | null;
  status: 'submitting' | 'submitted' | 'acknowledged' | 'monitoring';
  platform: string;
  evidence_url: string | null;
  submission_payload: Record<string, unknown>;
  external_reference: string | null;
  attempt_count: number;
  max_attempts: number;
}

const workerId = `takedown-${randomUUID()}`;
const gatewayUrl = process.env.TAKEDOWN_GATEWAY_URL || '';
const gatewayToken = process.env.TAKEDOWN_GATEWAY_TOKEN || '';
const pollMs = Number(process.env.TAKEDOWN_WORKER_POLL_MS || 15_000);

function normalizeStatus(value: unknown): TakedownAction['status'] | 'removed' | 'rejected' | 'failed' {
  const status = String(value || '').toLowerCase();
  if (['removed', 'resolved', 'complete', 'completed'].includes(status)) return 'removed';
  if (['rejected', 'denied'].includes(status)) return 'rejected';
  if (['acknowledged', 'accepted'].includes(status)) return 'acknowledged';
  if (['monitoring', 'under_review', 'in_review'].includes(status)) return 'monitoring';
  if (status === 'failed') return 'failed';
  return 'submitted';
}

async function gatewayRequest(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  if (!gatewayUrl || !gatewayToken) throw new Error('TAKEDOWN_GATEWAY_URL and TAKEDOWN_GATEWAY_TOKEN are required');
  const response = await fetch(`${gatewayUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gatewayToken}`,
      ...init.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text) as Record<string, unknown>; } catch { data = { message: text.slice(0, 2000) }; }
  if (!response.ok) throw new Error(`Gateway returned ${response.status}: ${String(data.error || data.message || '')}`);
  return data;
}

async function retry(db: SupabaseClient, action: TakedownAction, error: unknown): Promise<void> {
  const nextAttempt = action.attempt_count + 1;
  const terminal = nextAttempt >= action.max_attempts;
  const delayMinutes = Math.min(360, 2 ** Math.max(0, nextAttempt - 1));
  await db.from('takedown_actions').update({
    status: terminal ? 'failed' : action.external_reference ? 'submitted' : 'queued',
    last_error: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
    attempt_count: nextAttempt,
    next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    locked_by: null,
    locked_until: null,
    completed_at: terminal ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', action.id).eq('locked_by', workerId);
}

async function processAction(db: SupabaseClient, action: TakedownAction): Promise<void> {
  try {
    if (action.owner_id) {
      const { data: subscription } = await db.from('brand_guard_subscriptions').select('id')
        .eq('owner_id', action.owner_id).eq('status', 'active').in('plan_id', ['sentinel', 'fortress']).maybeSingle();
      if (!subscription) {
        await db.from('takedown_actions').update({
          status: 'canceled', last_error: 'Automated takedown entitlement is no longer active',
          locked_by: null, locked_until: null, updated_at: new Date().toISOString(),
        }).eq('id', action.id).eq('locked_by', workerId);
        return;
      }
    }
    const response = action.external_reference
      ? await gatewayRequest(`/v1/submissions/${encodeURIComponent(action.external_reference)}`, { method: 'GET' })
      : await gatewayRequest('/v1/submissions', {
          method: 'POST',
          headers: { 'Idempotency-Key': action.id },
          body: JSON.stringify({
            action_id: action.id,
            platform: action.platform,
            target_url: action.evidence_url,
            ...action.submission_payload,
          }),
        });
    const status = normalizeStatus(response.status);
    const externalReference = String(response.id || response.reference || action.external_reference || '');
    if (!externalReference && !action.external_reference) throw new Error('Takedown gateway response did not include an id');
    const terminal = ['removed', 'rejected', 'failed'].includes(status);
    const now = new Date().toISOString();
    await db.from('takedown_actions').update({
      status,
      external_reference: externalReference,
      provider_response: response,
      submitted_at: action.external_reference ? undefined : now,
      acknowledged_at: status === 'acknowledged' ? now : undefined,
      completed_at: terminal ? now : null,
      next_attempt_at: terminal ? null : new Date(Date.now() + 15 * 60_000).toISOString(),
      last_error: null,
      locked_by: null,
      locked_until: null,
      updated_at: now,
    }).eq('id', action.id).eq('locked_by', workerId);
  } catch (error) {
    await retry(db, action, error);
  }
}

let running = false;
async function tick(db: SupabaseClient): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { data, error } = await db.rpc('claim_takedown_actions', {
      p_worker_id: workerId,
      p_limit: Number(process.env.TAKEDOWN_WORKER_BATCH || 5),
      p_lease_seconds: 120,
    });
    if (error) throw error;
    await Promise.all(((data || []) as TakedownAction[]).map(action => processAction(db, action)));
  } catch (error) {
    console.error('[Takedown Worker] Tick failed:', error);
  } finally {
    running = false;
  }
}

export function startTakedownWorker(db: SupabaseClient): void {
  console.log(`[Takedown Worker] Starting ${workerId}`);
  void tick(db);
  setInterval(() => void tick(db), Math.max(1000, pollMs));
}
