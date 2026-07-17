import type { SupabaseClient } from '@supabase/supabase-js';

export type EnterpriseReportType = 'weekly_briefing' | 'monthly_sla' | 'custom';

export async function generateEnterpriseReport(
  db: SupabaseClient,
  ownerId: string,
  reportType: EnterpriseReportType,
  periodStart: Date,
  periodEnd: Date,
): Promise<Record<string, unknown>> {
  const start = periodStart.toISOString();
  const end = periodEnd.toISOString();
  const { data: monitors } = await db.from('brand_monitors').select('id, brand_name, brand_handle').eq('owner_id', ownerId);
  const monitorIds = (monitors || []).map(item => item.id);
  const empty = { data: [] as Array<Record<string, unknown>> };
  const [alertsResult, scansResult, takedownsResult, deliveryResult, deadResult, casesResult] = await Promise.all([
    monitorIds.length ? db.from('brand_guard_alerts').select('id, severity, title, platform, risk_score, created_at').in('brand_monitor_id', monitorIds).gte('created_at', start).lt('created_at', end) : Promise.resolve(empty),
    monitorIds.length ? db.from('brand_guard_scans').select('id, status, impersonators_found, scammer_db_matches, created_at, completed_at').in('brand_monitor_id', monitorIds).gte('created_at', start).lt('created_at', end) : Promise.resolve(empty),
    db.from('takedown_actions').select('id, status, platform, created_at, completed_at').eq('owner_id', ownerId).gte('created_at', start).lt('created_at', end),
    db.from('brand_guard_delivery_jobs').select('id, status, event_type, attempt_count, created_at, delivered_at').eq('owner_id', ownerId).gte('created_at', start).lt('created_at', end),
    db.from('brand_guard_delivery_dead_letters').select('id, created_at, resolved_at').eq('owner_id', ownerId).gte('created_at', start).lt('created_at', end),
    db.from('brand_guard_account_cases').select('id, status, priority, created_at, resolved_at').eq('owner_id', ownerId).gte('created_at', start).lt('created_at', end),
  ]);
  const alerts = alertsResult.data || [];
  const scans = scansResult.data || [];
  const takedowns = takedownsResult.data || [];
  const deliveries = deliveryResult.data || [];
  const deadLetters = deadResult.data || [];
  const cases = casesResult.data || [];
  const delivered = deliveries.filter(item => item.status === 'delivered');
  const completedScans = scans.filter(item => item.status === 'complete');
  const deliverySuccessRate = deliveries.length ? Math.round((delivered.length / deliveries.length) * 10000) / 100 : 100;
  const scanSuccessRate = scans.length ? Math.round((completedScans.length / scans.length) * 10000) / 100 : 100;
  const latencies = delivered
    .filter(item => item.delivered_at)
    .map(item => new Date(String(item.delivered_at)).getTime() - new Date(String(item.created_at)).getTime());
  const averageDeliverySeconds = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length / 1000) : 0;
  const summary = {
    brands_monitored: monitors?.length || 0,
    scans_total: scans.length,
    scan_success_rate: scanSuccessRate,
    threats_detected: alerts.filter(item => item.severity !== 'info').length,
    critical_threats: alerts.filter(item => item.severity === 'critical').length,
    impersonators_found: scans.reduce((sum, item) => sum + Number(item.impersonators_found || 0), 0),
    takedowns_opened: takedowns.length,
    takedowns_removed: takedowns.filter(item => item.status === 'removed').length,
    deliveries_total: deliveries.length,
    delivery_success_rate: deliverySuccessRate,
    average_delivery_seconds: averageDeliverySeconds,
    dead_letters: deadLetters.length,
    account_cases_opened: cases.length,
    account_cases_resolved: cases.filter(item => ['resolved', 'closed'].includes(String(item.status))).length,
  };
  const title = reportType === 'weekly_briefing' ? 'Weekly Executive Threat Briefing'
    : reportType === 'monthly_sla' ? 'Monthly Brand Guard SLA Report' : 'Enterprise Brand Protection Report';
  const reportMarkdown = `# ${title}

Period: ${start} to ${end}

## Executive Summary

- Brands monitored: ${summary.brands_monitored}
- Threats detected: ${summary.threats_detected} (${summary.critical_threats} critical)
- Impersonators found: ${summary.impersonators_found}
- Takedowns opened / removed: ${summary.takedowns_opened} / ${summary.takedowns_removed}

## Service Performance

- Scan success rate: ${summary.scan_success_rate}%
- Delivery success rate: ${summary.delivery_success_rate}%
- Average notification delivery: ${summary.average_delivery_seconds}s
- Dead-letter deliveries: ${summary.dead_letters}

## Account Management

- Cases opened: ${summary.account_cases_opened}
- Cases resolved: ${summary.account_cases_resolved}

## Highest-Severity Events

${alerts.filter(item => ['critical', 'high'].includes(String(item.severity))).slice(0, 20).map(item => `- [${String(item.severity).toUpperCase()}] ${item.title} (${item.platform || 'unknown'})`).join('\n') || '- No critical or high-severity events in this period.'}
`;
  const { data: report, error } = await db.from('brand_guard_enterprise_reports').upsert({
    owner_id: ownerId, report_type: reportType, period_start: start, period_end: end,
    title, status: 'ready', summary, report_markdown: reportMarkdown, generated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id,report_type,period_start,period_end' }).select('*').single();
  if (error || !report) throw new Error(error?.message || 'Failed to store enterprise report');

  const { data: endpoints } = await db.from('brand_guard_delivery_endpoints').select('id, event_types')
    .eq('owner_id', ownerId).eq('enabled', true);
  const eventType = reportType === 'weekly_briefing' ? 'weekly_briefing' : 'sla_report';
  const rows = (endpoints || []).filter(endpoint => (endpoint.event_types || []).includes(eventType)).map(endpoint => ({
    owner_id: ownerId, endpoint_id: endpoint.id, event_type: eventType,
    payload: { event: `brand_guard.${eventType}`, report_id: report.id, title, summary, period_start: start, period_end: end },
    idempotency_key: `report:${report.id}:${endpoint.id}`,
  }));
  if (rows.length) await db.from('brand_guard_delivery_jobs').upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true });
  return report as Record<string, unknown>;
}
