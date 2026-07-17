import { randomUUID } from 'node:crypto';
import { resolve4, resolveMx } from 'node:dns/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dnsTransition, generateWatchDomains } from './domain-watch-utils.js';

interface MonitoredBrand {
  id: string;
  owner_id: string;
  brand_name: string;
  brand_domain: string;
}

const workerId = `dns-watch-${randomUUID()}`;
const pollMs = Number(process.env.DOMAIN_WATCH_POLL_MS || 60_000);
const batchSize = Math.min(10, Math.max(1, Number(process.env.DOMAIN_WATCH_BATCH || 2)));
const variantLimit = Math.min(100, Math.max(5, Number(process.env.DOMAIN_WATCH_VARIANTS || 40)));

async function observe(domain: string): Promise<{ resolves: boolean; ip_addresses: string[]; mx_records: string[] }> {
  const [ips, mx] = await Promise.all([
    resolve4(domain).catch(() => [] as string[]),
    resolveMx(domain).catch(() => [] as Array<{ exchange: string }>),
  ]);
  return { resolves: ips.length > 0, ip_addresses: [...new Set(ips)], mx_records: [...new Set(mx.map(row => row.exchange.toLowerCase()))] };
}

async function processDomain(db: SupabaseClient, brand: MonitoredBrand, domain: string): Promise<void> {
  const { data: previous } = await db.from('brand_guard_dns_observations')
    .select('resolves, mx_records').eq('brand_monitor_id', brand.id).eq('domain', domain)
    .order('checked_at', { ascending: false }).limit(1).maybeSingle();
  const current = await observe(domain);
  const transition = dnsTransition(previous, current);
  await db.from('brand_guard_dns_observations').insert({ brand_monitor_id: brand.id, domain, ...current });
  if (!transition) return;

  const confidence = transition === 'activated' && current.mx_records.length > 0 ? 90 : 75;
  const severity = confidence >= 90 ? 4 : 3;
  const evidence = { transition, primary_domain: brand.brand_domain, observed_at: new Date().toISOString() };
  const { data: threat, error } = await db.from('brand_guard_detected_threats').upsert({
    owner_id: brand.owner_id,
    brand_monitor_id: brand.id,
    threat_type: 'lookalike',
    target: domain,
    resolved_ips: current.ip_addresses,
    mx_records: current.mx_records,
    confidence,
    severity,
    status: 'detected',
    evidence,
    last_seen_at: new Date().toISOString(),
    last_mutated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'brand_monitor_id,threat_type,target' }).select('id').single();
  if (error) throw error;

  await db.from('brand_guard_alerts').insert({
    brand_monitor_id: brand.id,
    alert_type: 'new_threat',
    severity: severity >= 4 ? 'high' : 'medium',
    title: `Lookalike domain ${transition === 'activated' ? 'became active' : 'added email routing'}`,
    message: `${domain} changed DNS state and now requires review.`,
    threat_id: threat.id,
    target: domain,
    platform: 'domain',
    risk_score: confidence,
    risk_level: severity >= 4 ? 'HIGH' : 'MEDIUM',
    evidence: [JSON.stringify(evidence)],
  });
}

async function processBrand(db: SupabaseClient, brand: MonitoredBrand): Promise<void> {
  try {
    const domains = generateWatchDomains(brand.brand_domain, variantLimit);
    for (let i = 0; i < domains.length; i += 10) {
      await Promise.all(domains.slice(i, i + 10).map(domain => processDomain(db, brand, domain)));
    }
  } finally {
    await db.from('brand_monitors').update({
      domain_watch_next_at: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      domain_watch_locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq('id', brand.id);
  }
}

let running = false;
async function tick(db: SupabaseClient): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { data, error } = await db.rpc('claim_domain_watch_brands', { p_worker_id: workerId, p_limit: batchSize, p_lease_seconds: 900 });
    if (error) throw error;
    await Promise.all(((data || []) as MonitoredBrand[]).map(brand => processBrand(db, brand)));
  } catch (error) {
    console.error('[DNS Watcher] Tick failed:', error);
  } finally {
    running = false;
  }
}

export async function runDomainWatcherTick(db: SupabaseClient): Promise<void> {
  await tick(db);
}

export function startDomainWatcherWorker(db: SupabaseClient): void {
  console.log(`[DNS Watcher] Starting ${workerId} with batch=${batchSize}, variants=${variantLimit}`);
  void tick(db);
  setInterval(() => void tick(db), Math.max(10_000, pollMs));
}
