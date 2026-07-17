import { createHmac, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptDeliverySecret, validateDeliveryUrl } from '../../api/_lib/delivery-crypto.js';

interface DeliveryJob {
  id: string;
  owner_id: string;
  endpoint_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  lease_token: string;
}

interface Endpoint {
  id: string;
  owner_id: string;
  channel: 'slack' | 'webhook';
  endpoint_ciphertext: string;
  signing_secret_ciphertext: string | null;
  enabled: boolean;
}

const workerId = `delivery-${randomUUID()}`;
const pollMs = Number(process.env.DELIVERY_WORKER_POLL_MS || 5000);

function slackPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    text: String(payload.title || payload.message || 'Brand Guard notification'),
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: String(payload.title || 'Brand Guard Notification').slice(0, 150) } },
      { type: 'section', text: { type: 'mrkdwn', text: String(payload.message || payload.summary || 'New Brand Guard event').slice(0, 2900) } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Event: ${String(payload.event || 'brand_guard.event')} | Severity: ${String(payload.severity || 'info')}` }] },
    ],
  };
}

async function deliver(db: SupabaseClient, job: DeliveryJob): Promise<void> {
  const started = Date.now();
  const attemptNumber = job.attempt_count + 1;
  let statusCode: number | null = null;
  let errorText = '';
  let responseExcerpt = '';
  try {
    const { data } = await db.from('brand_guard_delivery_endpoints')
      .select('id, owner_id, channel, endpoint_ciphertext, signing_secret_ciphertext, enabled').eq('id', job.endpoint_id).maybeSingle<Endpoint>();
    if (!data?.enabled) throw new Error('Delivery endpoint is disabled or missing');
    const { data: subscription } = await db.from('brand_guard_subscriptions').select('id')
      .eq('owner_id', data.owner_id).eq('status', 'active').in('plan_id', ['sentinel', 'fortress']).maybeSingle();
    if (!subscription) {
      await db.from('brand_guard_delivery_jobs').update({
        status: 'canceled', last_error: 'Customer delivery entitlement is no longer active',
        locked_by: null, locked_until: null, lease_token: null, updated_at: new Date().toISOString(),
      }).eq('id', job.id).eq('lease_token', job.lease_token);
      await db.from('brand_guard_delivery_endpoints').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', data.id);
      return;
    }
    const destination = decryptDeliverySecret(data.endpoint_ciphertext);
    validateDeliveryUrl(destination, data.channel);
    const bodyObject = data.channel === 'slack' ? slackPayload(job.payload) : job.payload;
    const body = JSON.stringify(bodyObject);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'AgenticBro-Delivery/1.0' };
    if (data.channel === 'webhook' && data.signing_secret_ciphertext) {
      const secret = decryptDeliverySecret(data.signing_secret_ciphertext);
      headers['X-AgenticBro-Timestamp'] = timestamp;
      headers['X-AgenticBro-Signature'] = `v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
      headers['X-AgenticBro-Event'] = job.event_type;
      headers['X-AgenticBro-Delivery'] = job.id;
    }
    const response = await fetch(destination, { method: 'POST', headers, body, signal: AbortSignal.timeout(15_000) });
    statusCode = response.status;
    responseExcerpt = (await response.text()).slice(0, 1000);
    if (!response.ok) throw new Error(`Destination returned HTTP ${response.status}`);

    await db.from('brand_guard_delivery_jobs').update({
      status: 'delivered', attempt_count: attemptNumber, last_status_code: statusCode,
      delivered_at: new Date().toISOString(), locked_by: null, locked_until: null, lease_token: null, last_error: null, updated_at: new Date().toISOString(),
    }).eq('id', job.id).eq('lease_token', job.lease_token);
    await db.from('brand_guard_delivery_endpoints').update({
      last_success_at: new Date().toISOString(), consecutive_failures: 0, updated_at: new Date().toISOString(),
    }).eq('id', data.id);
  } catch (error) {
    errorText = error instanceof Error ? error.message : String(error);
    const terminal = attemptNumber >= job.max_attempts;
    const delaySeconds = Math.min(21600, 30 * (2 ** Math.max(0, attemptNumber - 1))) + Math.floor(Math.random() * 15);
    await db.from('brand_guard_delivery_jobs').update({
      status: terminal ? 'dead_letter' : 'queued', attempt_count: attemptNumber,
      available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(), last_error: errorText.slice(0, 2000),
      last_status_code: statusCode, locked_by: null, locked_until: null, lease_token: null, updated_at: new Date().toISOString(),
    }).eq('id', job.id).eq('lease_token', job.lease_token);
    await db.from('brand_guard_delivery_endpoints').update({
      last_failure_at: new Date().toISOString(), consecutive_failures: attemptNumber, updated_at: new Date().toISOString(),
    }).eq('id', job.endpoint_id);
    if (terminal) {
      await db.from('brand_guard_delivery_dead_letters').upsert({
        original_job_id: job.id, owner_id: job.owner_id, endpoint_id: job.endpoint_id,
        payload: job.payload, final_error: errorText.slice(0, 2000), attempt_count: attemptNumber,
        resolved_at: null, resolution_notes: null,
      }, { onConflict: 'original_job_id' });
    }
  } finally {
    await db.from('brand_guard_delivery_attempts').insert({
      job_id: job.id, endpoint_id: job.endpoint_id, attempt_number: attemptNumber,
      status_code: statusCode, duration_ms: Date.now() - started, error: errorText || null, response_excerpt: responseExcerpt || null,
    });
  }
}

let running = false;
async function tick(db: SupabaseClient): Promise<void> {
  if (running) return;
  running = true;
  try {
    await db.from('brand_guard_delivery_jobs').update({
      status: 'queued', locked_by: null, locked_until: null, lease_token: null,
      available_at: new Date().toISOString(), last_error: 'Worker lease expired', updated_at: new Date().toISOString(),
    }).eq('status', 'leased').lt('locked_until', new Date().toISOString());
    const { data, error } = await db.rpc('claim_brand_guard_delivery_jobs', {
      p_worker_id: workerId, p_limit: Number(process.env.DELIVERY_WORKER_BATCH || 10), p_lease_seconds: 60,
    });
    if (error) throw error;
    await Promise.all(((data || []) as DeliveryJob[]).map(job => deliver(db, job)));
  } catch (error) {
    console.error('[Delivery Worker] Tick failed:', error);
  } finally {
    running = false;
  }
}

export function startDeliveryWorker(db: SupabaseClient): void {
  console.log(`[Delivery Worker] Starting ${workerId}`);
  void tick(db);
  setInterval(() => void tick(db), Math.max(1000, pollMs));
}
