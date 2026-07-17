/**
 * api/phone-report.ts — Community Phone Report Submission
 * =========================================================
 * Lets users flag a phone number as scam/spam so future scans
 * show real community data instead of just external sources.
 *
 * POST /api/phone-report
 *   { phone: "+1234567890", report_type: "scam"|"spam"|"robocall"|"fraud"|"impersonation"|"unknown", notes?: string }
 *
 * GET /api/phone-report?phone=+1234567890
 *   Returns count and latest reports for a number (public)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseService = process.env.SUPABASE_SECRET_API_KEY || '';

const VALID_TYPES = ['scam', 'spam', 'robocall', 'fraud', 'impersonation', 'unknown'] as const;
type ReportType = typeof VALID_TYPES[number];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: fetch report count + recent reports for a number ─────────────────
  if (req.method === 'GET') {
    const phone = (req.query?.phone as string || '').trim();
    if (!phone) return res.status(400).json({ error: 'phone query param required' });

    const db = createClient(supabaseUrl, supabaseAnonKey);
    const stripped = phone.replace(/[^0-9+]/g, '');

    const { data, error } = await db
      .from('phone_community_reports')
      .select('report_type, notes, reported_at, source')
      .eq('phone', stripped)
      .order('reported_at', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ error: 'Failed to fetch reports' });

    const typeCounts = (data || []).reduce<Record<string, number>>((acc, r) => {
      acc[r.report_type] = (acc[r.report_type] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      phone:       stripped,
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
    const { phone, report_type, notes } = req.body as {
      phone?: string;
      report_type?: string;
      notes?: string;
    };

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'phone is required' });
    }

    const stripped = phone.replace(/[^0-9+]/g, '');
    if (stripped.length < 7 || stripped.length > 16) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    if (!report_type || !VALID_TYPES.includes(report_type as ReportType)) {
      return res.status(400).json({
        error: `report_type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    if (notes && notes.length > 500) {
      return res.status(400).json({ error: 'notes must be 500 characters or fewer' });
    }

    // Use service role to bypass RLS on insert (anon INSERT policy is open but
    // service key is more reliable across different RLS configs)
    const db = createClient(supabaseUrl, supabaseService || supabaseAnonKey);

    const { error } = await db
      .from('phone_community_reports')
      .insert({
        phone:       stripped,
        report_type: report_type as ReportType,
        notes:       notes?.trim() || null,
        source:      'agenticbro_website',
      });

    if (error) {
      console.error('[phone-report] insert error:', error);
      return res.status(500).json({ error: 'Failed to submit report' });
    }

    // Fetch updated count to return
    const { data: countData } = await db
      .from('phone_community_reports')
      .select('id', { count: 'exact', head: true })
      .eq('phone', stripped);

    return res.status(201).json({
      success: true,
      phone:   stripped,
      message: 'Report submitted — thank you for helping protect the community.',
      total_reports: (countData as any)?.length ?? null,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
