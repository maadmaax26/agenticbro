/**
 * api/website-report.ts — Community Website Report Submission
 * =============================================================
 * Lets users flag a domain as phishing/scam/malware so future scans
 * show real community data in the Website Security Scanner.
 *
 * GET  /api/website-report?domain=example.com
 *   Returns count + recent reports for a domain
 *
 * POST /api/website-report
 *   { domain, url?, report_type, notes? }
 *   report_type: 'phishing'|'scam'|'malware'|'fake_store'|'investment_fraud'|'impersonation'|'unknown'
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseService = process.env.SUPABASE_SECRET_API_KEY || '';

const VALID_TYPES = ['phishing', 'scam', 'malware', 'fake_store', 'investment_fraud', 'impersonation', 'unknown'] as const;
type ReportType = typeof VALID_TYPES[number];

function extractDomain(raw: string): string {
  try {
    const url = raw.startsWith('http') ? raw : `https://${raw}`;
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/^www\./, '');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: fetch report count + recent reports for a domain ─────────────────
  if (req.method === 'GET') {
    const raw = (req.query?.domain as string || '').trim();
    if (!raw) return res.status(400).json({ error: 'domain query param required' });

    const domain = extractDomain(raw);
    const db = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await db
      .from('website_community_reports')
      .select('report_type, notes, reported_at')
      .eq('domain', domain)
      .order('reported_at', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ error: 'Failed to fetch reports' });

    const typeCounts = (data || []).reduce<Record<string, number>>((acc, r) => {
      acc[r.report_type] = (acc[r.report_type] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      domain,
      total:       data?.length ?? 0,
      type_counts: typeCounts,
      reports:     (data || []).map(r => ({
        type:        r.report_type,
        notes:       r.notes || null,
        reported_at: r.reported_at,
      })),
    });
  }

  // ── POST: submit a report ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { domain: rawDomain, url, report_type, notes } = req.body as {
      domain?:      string;
      url?:         string;
      report_type?: string;
      notes?:       string;
    };

    if (!rawDomain || typeof rawDomain !== 'string') {
      return res.status(400).json({ error: 'domain is required' });
    }

    const domain = extractDomain(rawDomain);
    if (!domain || domain.length < 3) {
      return res.status(400).json({ error: 'Invalid domain' });
    }

    if (!report_type || !VALID_TYPES.includes(report_type as ReportType)) {
      return res.status(400).json({
        error: `report_type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    if (notes && notes.length > 500) {
      return res.status(400).json({ error: 'notes must be 500 characters or fewer' });
    }

    const db = createClient(supabaseUrl, supabaseService || supabaseAnonKey);

    const { error } = await db
      .from('website_community_reports')
      .insert({
        domain,
        url:         url?.trim() || null,
        report_type: report_type as ReportType,
        notes:       notes?.trim() || null,
        source:      'agenticbro_website',
      });

    if (error) {
      console.error('[website-report] insert error:', error);
      return res.status(500).json({ error: 'Failed to submit report' });
    }

    // Return updated count
    const { count } = await db
      .from('website_community_reports')
      .select('id', { count: 'exact', head: true })
      .eq('domain', domain);

    return res.status(201).json({
      success:       true,
      domain,
      message:       'Report submitted — thank you for protecting the community.',
      total_reports: count ?? null,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
