import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateEnterpriseReport, type EnterpriseReportType } from '../_lib/enterprise-reports.js';
import { ownerHasFeature, requireBrandGuardEntitlement } from '../_lib/brand-guard-entitlements.js';

function pathParts(req: VercelRequest): string[] {
  return (req.url || '').split('?')[0].replace('/api/brand-guard/enterprise', '').split('/').filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const parts = pathParts(req);
  const resource = parts[0] || 'reports';
  const feature = resource === 'account-manager' || resource === 'cases' ? 'account_manager'
    : resource === 'sla' ? 'enterprise_sla' : resource === 'briefings' ? 'weekly_briefings' : 'custom_reports';
  const entitlement = await requireBrandGuardEntitlement(req, res, feature);
  if (!entitlement) return;
  const db = entitlement.db;

  if (req.method === 'GET' && resource === 'sla') {
    let { data } = await db.from('brand_guard_sla_policies').select('*').eq('owner_id', entitlement.ownerId).maybeSingle();
    if (!data) {
      const created = await db.from('brand_guard_sla_policies').insert({ owner_id: entitlement.ownerId, escalation_email: entitlement.email }).select('*').single();
      data = created.data;
    }
    const { data: latestReport } = await db.from('brand_guard_enterprise_reports').select('id, summary, period_start, period_end, generated_at')
      .eq('owner_id', entitlement.ownerId).eq('report_type', 'monthly_sla').order('period_end', { ascending: false }).limit(1).maybeSingle();
    res.status(200).json({ policy: data, latest_report: latestReport });
    return;
  }

  if (req.method === 'GET' && (resource === 'reports' || resource === 'briefings')) {
    let query = db.from('brand_guard_enterprise_reports').select('*').eq('owner_id', entitlement.ownerId).order('period_end', { ascending: false }).limit(100);
    if (resource === 'briefings') query = query.eq('report_type', 'weekly_briefing');
    if (parts[1]) query = query.eq('id', parts[1]).limit(1);
    const { data, error } = await query;
    if (error) res.status(500).json({ error: error.message });
    else res.status(200).json(parts[1] ? { report: data?.[0] || null } : { reports: data || [] });
    return;
  }

  if (req.method === 'POST' && (resource === 'reports' || resource === 'briefings')) {
    const reportType = (resource === 'briefings' ? 'weekly_briefing' : String(req.body?.report_type || 'custom')) as EnterpriseReportType;
    if (!['weekly_briefing', 'monthly_sla', 'custom'].includes(reportType)) { res.status(400).json({ error: 'Invalid report_type' }); return; }
    if (reportType === 'monthly_sla' && !ownerHasFeature(entitlement, 'enterprise_sla')) {
      res.status(403).json({ error: 'entitlement_required', feature: 'enterprise_sla', required_plan: 'fortress' }); return;
    }
    if (reportType === 'weekly_briefing' && !ownerHasFeature(entitlement, 'weekly_briefings')) {
      res.status(403).json({ error: 'entitlement_required', feature: 'weekly_briefings', required_plan: 'fortress' }); return;
    }
    const periodEnd = req.body?.period_end ? new Date(String(req.body.period_end)) : new Date();
    const defaultDays = reportType === 'monthly_sla' ? 30 : 7;
    const periodStart = req.body?.period_start ? new Date(String(req.body.period_start)) : new Date(periodEnd.getTime() - defaultDays * 86400000);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart >= periodEnd) {
      res.status(400).json({ error: 'Invalid report period' }); return;
    }
    const report = await generateEnterpriseReport(db, entitlement.ownerId, reportType, periodStart, periodEnd);
    res.status(201).json({ report });
    return;
  }

  if (req.method === 'GET' && resource === 'account-manager') {
    const { data: assignment } = await db.from('brand_guard_account_assignments')
      .select('id, status, assigned_at, next_review_at, notes, manager:brand_guard_account_managers(id, name, email)')
      .eq('owner_id', entitlement.ownerId).maybeSingle();
    const { data: cases } = await db.from('brand_guard_account_cases').select('*')
      .eq('owner_id', entitlement.ownerId).order('created_at', { ascending: false }).limit(100);
    res.status(200).json({ assignment, cases: cases || [] });
    return;
  }

  if (req.method === 'POST' && resource === 'cases' && !parts[1]) {
    const subject = String(req.body?.subject || '').trim().slice(0, 200);
    if (!subject) { res.status(400).json({ error: 'subject is required' }); return; }
    const { data: assignment } = await db.from('brand_guard_account_assignments').select('id')
      .eq('owner_id', entitlement.ownerId).eq('status', 'active').maybeSingle();
    const { data, error } = await db.from('brand_guard_account_cases').insert({
      owner_id: entitlement.ownerId, assignment_id: assignment?.id || null, created_by: entitlement.ownerId,
      subject, description: String(req.body?.description || '').slice(0, 10000), priority: req.body?.priority || 'normal',
    }).select('*').single();
    if (error || !data) { res.status(500).json({ error: error?.message || 'Failed to create case' }); return; }
    await db.from('brand_guard_account_case_events').insert({ case_id: data.id, actor_id: entitlement.ownerId, event_type: 'created', message: data.description });
    res.status(201).json({ case: data });
    return;
  }

  if (req.method === 'POST' && resource === 'cases' && parts[1]) {
    const message = String(req.body?.message || '').trim().slice(0, 10000);
    const { data: ownedCase } = await db.from('brand_guard_account_cases').select('id').eq('id', parts[1]).eq('owner_id', entitlement.ownerId).maybeSingle();
    if (!ownedCase) { res.status(404).json({ error: 'Case not found' }); return; }
    const { data, error } = await db.from('brand_guard_account_case_events').insert({
      case_id: ownedCase.id, actor_id: entitlement.ownerId, event_type: 'customer_message', message,
    }).select('*').single();
    if (error) res.status(500).json({ error: error.message });
    else res.status(201).json({ event: data });
    return;
  }

  res.status(404).json({ error: 'Not found' });
}
