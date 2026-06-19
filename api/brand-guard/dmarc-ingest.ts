import { isIP } from 'node:net';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { decompressDmarcAttachment, parseDmarcXml } from '../_lib/dmarc-parser.js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const inboundSecret = process.env.DMARC_INBOUND_SECRET || '';
const db = createClient(url, key);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!inboundSecret || req.headers.authorization !== `Bearer ${inboundSecret}`) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const token = String(body.token || '');
  const filename = String(body.filename || 'report.xml').slice(0, 255);
  const encoded = String(body.content_base64 || '');
  if (!token || !encoded || encoded.length > 14_000_000) { res.status(400).json({ error: 'token and bounded content_base64 are required' }); return; }

  try {
    const { data: monitor } = await db.from('brand_monitors').select('id, owner_id').eq('dmarc_rua_token', token).eq('is_active', true).maybeSingle();
    if (!monitor) { res.status(404).json({ error: 'Unknown DMARC recipient token' }); return; }
    const bytes = Buffer.from(encoded, 'base64');
    const xml = decompressDmarcAttachment(filename, bytes);
    const report = parseDmarcXml(xml);
    const { data: stored, error } = await db.from('brand_guard_dmarc_reports').upsert({
      owner_id: monitor.owner_id, brand_monitor_id: monitor.id, report_id: report.reportId,
      reporter: report.reporter, period_start: report.periodStart, period_end: report.periodEnd,
      source_filename: filename, message_count: report.messageCount, failed_count: report.failedCount,
      raw_size_bytes: bytes.byteLength,
    }, { onConflict: 'brand_monitor_id,report_id' }).select('id').single();
    if (error) throw error;
    const validSources = report.sources.filter(row => isIP(row.sourceIp) !== 0);
    await db.from('brand_guard_dmarc_sources').delete().eq('report_id', stored.id);
    if (validSources.length) {
      const { error: sourceError } = await db.from('brand_guard_dmarc_sources').insert(validSources.map(row => ({
        report_id: stored.id, brand_monitor_id: monitor.id, source_ip: row.sourceIp,
        message_count: row.count, dkim_result: row.dkim, spf_result: row.spf,
        disposition: row.disposition, unauthorized: row.unauthorized,
      })));
      if (sourceError) throw sourceError;
    }
    for (const source of validSources.filter(row => row.unauthorized && row.count >= 100)) {
      await db.from('brand_guard_detected_threats').upsert({
        owner_id: monitor.owner_id, brand_monitor_id: monitor.id, threat_type: 'spoofing', target: source.sourceIp,
        confidence: Math.min(99, 70 + Math.log10(source.count) * 10), severity: source.count >= 1000 ? 5 : 4,
        status: 'detected', evidence: { dmarc_report_id: stored.id, message_count: source.count, dkim: source.dkim, spf: source.spf },
        last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'brand_monitor_id,threat_type,target' });
    }
    if (report.failedCount >= 100) {
      await db.from('brand_guard_alerts').insert({
        brand_monitor_id: monitor.id, alert_type: 'new_threat', severity: 'high',
        title: 'High-volume DMARC authentication failures',
        message: `${report.failedCount} messages failed both SPF and DKIM in report ${report.reportId}.`,
        platform: 'email', risk_score: 85, risk_level: 'HIGH', evidence: [`report:${stored.id}`],
      });
    }
    res.status(202).json({ accepted: true, report_id: stored.id, messages: report.messageCount, failed: report.failedCount });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid DMARC report' });
  }
}

export const config = { maxDuration: 30 };
