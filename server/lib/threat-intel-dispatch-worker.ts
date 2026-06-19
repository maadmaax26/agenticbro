import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

interface IntelJob {
  id: string;
  threat_id: string;
  target_url: string;
  attempt_count: number;
  max_attempts: number;
}

const workerId = `intel-dispatch-${randomUUID()}`;
const runnerUrl = process.env.THREAT_INTEL_RUNNER_URL || '';
const runnerToken = process.env.THREAT_INTEL_RUNNER_TOKEN || '';
const pollMs = Number(process.env.THREAT_INTEL_POLL_MS || 30_000);
const batchSize = Math.min(4, Math.max(1, Number(process.env.THREAT_INTEL_BATCH || 1)));

function validateTarget(value: string): string {
  const target = new URL(value);
  if (target.protocol !== 'https:') throw new Error('Threat-intel targets must use HTTPS');
  const host = target.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) {
    throw new Error('Private threat-intel targets are prohibited');
  }
  target.username = ''; target.password = '';
  return target.toString();
}

async function retry(db: SupabaseClient, job: IntelJob, error: unknown): Promise<void> {
  const terminal = job.attempt_count >= job.max_attempts;
  const delay = Math.min(3600, 60 * (2 ** Math.max(0, job.attempt_count - 1)));
  await db.from('brand_guard_threat_intel_jobs').update({
    status: terminal ? 'failed' : 'queued',
    available_at: new Date(Date.now() + delay * 1000).toISOString(),
    locked_by: null, locked_until: null,
    last_error: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
    completed_at: terminal ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('locked_by', workerId);
}

async function dispatch(db: SupabaseClient, job: IntelJob): Promise<void> {
  try {
    if (!runnerUrl || !runnerToken) throw new Error('External threat-intel runner is not configured');
    const endpoint = new URL('/v1/analyze', runnerUrl);
    if (endpoint.protocol !== 'https:') throw new Error('Threat-intel runner must use HTTPS');
    const targetUrl = validateTarget(job.target_url);
    await db.from('brand_guard_threat_intel_jobs').update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', job.id).eq('locked_by', workerId);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${runnerToken}`, 'Idempotency-Key': job.id },
      body: JSON.stringify({
        job_id: job.id, target_url: targetUrl,
        limits: { wall_time_seconds: 90, max_response_bytes: 5_000_000, max_redirects: 5 },
        isolation: { browser: 'ephemeral', filesystem: 'read_only', private_networks: 'deny' },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(`Threat-intel runner returned ${response.status}`);
    const now = new Date().toISOString();
    await db.from('brand_guard_threat_intel_jobs').update({ status: 'completed', result, locked_by: null, locked_until: null, completed_at: now, updated_at: now })
      .eq('id', job.id).eq('locked_by', workerId);
    await db.from('brand_guard_detected_threats').update({
      status: 'pending_review',
      phishing_kit_fingerprint: result.fingerprint || null,
      exfil_endpoints: Array.isArray(result.exfil_endpoints) ? result.exfil_endpoints : [],
      evidence: result,
      last_mutated_at: now,
      updated_at: now,
    }).eq('id', job.threat_id);
  } catch (error) {
    await retry(db, job, error);
  }
}

let running = false;
async function tick(db: SupabaseClient): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { data, error } = await db.rpc('claim_threat_intel_jobs', { p_worker_id: workerId, p_limit: batchSize, p_lease_seconds: 180 });
    if (error) throw error;
    await Promise.all(((data || []) as IntelJob[]).map(job => dispatch(db, job)));
  } catch (error) {
    console.error('[Threat Intel Dispatcher] Tick failed:', error);
  } finally {
    running = false;
  }
}

export function startThreatIntelDispatchWorker(db: SupabaseClient): void {
  console.log(`[Threat Intel Dispatcher] Starting ${workerId}; browser execution remains external`);
  void tick(db);
  setInterval(() => void tick(db), Math.max(10_000, pollMs));
}
