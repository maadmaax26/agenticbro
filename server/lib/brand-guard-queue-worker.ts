import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

interface QueueJob {
  id: string;
  lease_token: string;
  job_type: 'impersonator' | 'domain' | 'email' | 'full';
  brand_monitor_id: string | null;
  attempt_count: number;
  max_attempts: number;
  payload: {
    brand_name?: string;
    brand_handle?: string;
    brand_domain?: string;
    platforms?: string[];
  };
  result?: { scan_id?: string } | null;
}

const workerId = `brand-guard-${randomUUID()}`;
const apiBase = process.env.BRAND_GUARD_API_BASE || process.env.API_BASE_URL || 'https://agenticbro.app';
const pollMs = Number(process.env.BRAND_GUARD_QUEUE_POLL_MS || 10_000);

async function callEndpoint(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Worker': workerId },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text) as Record<string, unknown>; } catch { data = { body: text.slice(0, 2000) }; }
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${String(data.error || text).slice(0, 500)}`);
  return data;
}

async function failOrRetry(db: SupabaseClient, job: QueueJob, error: unknown): Promise<void> {
  const terminal = job.attempt_count >= job.max_attempts;
  const delaySeconds = Math.min(3600, 30 * (2 ** Math.max(0, job.attempt_count - 1)));
  await db.from('brand_guard_scan_queue').update({
    status: terminal ? 'failed' : 'queued',
    available_at: terminal ? new Date().toISOString() : new Date(Date.now() + delaySeconds * 1000).toISOString(),
    last_error: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
    locked_by: null,
    locked_until: null,
    lease_token: null,
    completed_at: terminal ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('lease_token', job.lease_token);
}

async function dispatchJob(db: SupabaseClient, job: QueueJob): Promise<void> {
  await db.from('brand_guard_scan_queue').update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', job.id).eq('lease_token', job.lease_token);
  try {
    const common = {
      brand_monitor_id: job.brand_monitor_id,
      brand_name: job.payload.brand_name,
      brand_handle: job.payload.brand_handle,
      brand_domain: job.payload.brand_domain,
      platforms: job.payload.platforms,
    };
    const marketplacePayload = {
      brandId: job.brand_monitor_id,
      brandName: job.payload.brand_name,
      brandWebsite: job.payload.brand_domain,
      platforms: ['shopify', 'etsy'],
    };
    if (job.job_type === 'domain') {
      const result = await callEndpoint('/api/brand-guard/domain-monitor', {
        domain: job.payload.brand_domain,
        brand_name: job.payload.brand_name,
        brand_monitor_id: job.brand_monitor_id,
      });
      await db.from('brand_guard_scan_queue').update({ status: 'completed', result, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', job.id).eq('lease_token', job.lease_token);
      return;
    }
    if (job.job_type === 'email') {
      const result = await callEndpoint('/api/brand-guard/email-spoof', {
        domain: job.payload.brand_domain,
        brand_name: job.payload.brand_name,
        brand_monitor_id: job.brand_monitor_id,
      });
      await db.from('brand_guard_scan_queue').update({ status: 'completed', result, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', job.id).eq('lease_token', job.lease_token);
      return;
    }

    const scan = await callEndpoint('/api/brand-guard/impersonator-scan', common);
    const scanId = String(scan.scan_id || '');
    if (!scanId) throw new Error('Impersonator endpoint accepted job without scan_id');
    const auxiliary = job.job_type === 'full'
      ? await Promise.allSettled([
          job.payload.brand_domain ? callEndpoint('/api/brand-guard/domain-monitor', {
            domain: job.payload.brand_domain,
            brand_name: job.payload.brand_name,
            brand_monitor_id: job.brand_monitor_id,
          }) : Promise.resolve(null),
          job.payload.brand_domain ? callEndpoint('/api/brand-guard/email-spoof', {
            domain: job.payload.brand_domain,
            brand_name: job.payload.brand_name,
            brand_monitor_id: job.brand_monitor_id,
          }) : Promise.resolve(null),
          job.brand_monitor_id && job.payload.brand_name
            ? callEndpoint('/api/brand-guard/marketplace/scan', marketplacePayload)
            : Promise.resolve(null),
        ])
      : [];
    await db.from('brand_guard_scan_queue').update({
      status: 'processing',
      result: { scan_id: scanId, auxiliary: auxiliary.map(item => item.status) },
      locked_until: new Date(Date.now() + 15 * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', job.id).eq('lease_token', job.lease_token);
  } catch (error) {
    await failOrRetry(db, job, error);
  }
}

async function reconcileProcessing(db: SupabaseClient): Promise<void> {
  const { data: jobs } = await db.from('brand_guard_scan_queue')
    .select('id, result, started_at, attempt_count, max_attempts').eq('status', 'processing').not('result', 'is', null).limit(50);
  for (const job of jobs || []) {
    const scanId = String((job.result as { scan_id?: string } | null)?.scan_id || '');
    if (!scanId) continue;
    const { data: scan } = await db.from('brand_guard_scans').select('status, result, completed_at')
      .eq('scan_id', scanId).maybeSingle();
    const ageMs = Date.now() - new Date(job.started_at || Date.now()).getTime();
    if (!scan) {
      if (ageMs > 10 * 60_000) {
        const terminal = job.attempt_count >= job.max_attempts;
        await db.from('brand_guard_scan_queue').update({
          status: terminal ? 'failed' : 'queued',
          available_at: new Date(Date.now() + 60_000).toISOString(),
          last_error: 'Dispatched scan record was not created',
          result: null,
          locked_by: null,
          locked_until: null,
          lease_token: null,
          completed_at: terminal ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id).eq('status', 'processing');
      }
      continue;
    }
    if (!['complete', 'failed'].includes(scan.status)) {
      if (ageMs > 2 * 60 * 60_000) {
        await db.from('brand_guard_scan_queue').update({
          status: 'failed',
          last_error: 'Underlying scan exceeded the two-hour processing deadline',
          completed_at: new Date().toISOString(),
          locked_by: null,
          locked_until: null,
          lease_token: null,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id).eq('status', 'processing');
      } else {
        await db.from('brand_guard_scan_queue').update({
          locked_until: new Date(Date.now() + 15 * 60_000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', job.id).eq('status', 'processing');
      }
      continue;
    }
    await db.from('brand_guard_scan_queue').update({
      status: scan.status === 'complete' ? 'completed' : 'failed',
      result: { ...(job.result as Record<string, unknown>), scan: scan.result },
      last_error: scan.status === 'failed' ? String(scan.result?.error || 'Scan failed') : null,
      completed_at: scan.completed_at || new Date().toISOString(),
      locked_by: null,
      locked_until: null,
      lease_token: null,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id).eq('status', 'processing');
  }
}

let running = false;
async function tick(db: SupabaseClient): Promise<void> {
  if (running) return;
  running = true;
  try {
    await reconcileProcessing(db);
    await db.rpc('requeue_expired_brand_guard_jobs');
    const { data, error } = await db.rpc('claim_brand_guard_scan_jobs', {
      p_worker_id: workerId,
      p_limit: Number(process.env.BRAND_GUARD_QUEUE_BATCH || 2),
      p_lease_seconds: 180,
    });
    if (error) throw error;
    await Promise.all(((data || []) as QueueJob[]).map(job => dispatchJob(db, job)));
  } catch (error) {
    console.error('[BG Queue] Worker tick failed:', error);
  } finally {
    running = false;
  }
}

export function startBrandGuardQueueWorker(db: SupabaseClient): void {
  console.log(`[BG Queue] Starting durable queue worker ${workerId}`);
  void tick(db);
  setInterval(() => void tick(db), Math.max(1000, pollMs));
}
