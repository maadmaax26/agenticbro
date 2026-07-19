/**
 * Brand Guard SLA Status — Vercel Serverless Function
 * 
 * GET /api/brand-guard/sla-status
 * Returns latest SLA monitor status from Supabase sla_status table.
 * Written by scripts/brand-guard-sla-monitor.py every 5 minutes.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://drvasofyghnxfxvkkwad.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_KEY) {
    // Fallback to anon key for public read (RLS allows SELECT)
    const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!ANON_KEY) {
      return res.status(200).json({
        overall_status: 'unknown',
        checks_total: 9,
        checks_passed: 0,
        checks_failed: 0,
        checks: [],
        message: 'Supabase key not configured',
      });
    }
    return fetchSlaStatus(SUPABASE_URL, ANON_KEY, res);
  }

  return fetchSlaStatus(SUPABASE_URL, SUPABASE_KEY, res);
}

async function fetchSlaStatus(url, key, res) {
  try {
    const resp = await fetch(
      `${url}/rest/v1/sla_status?order=timestamp.desc&limit=1`,
      {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
        },
      }
    );

    if (!resp.ok) {
      return res.status(200).json({
        overall_status: 'unknown',
        checks_total: 9,
        checks_passed: 0,
        checks_failed: 0,
        checks: [],
        message: 'SLA status not available yet',
      });
    }

    const data = await resp.json();

    if (!data || data.length === 0) {
      return res.status(200).json({
        overall_status: 'unknown',
        checks_total: 9,
        checks_passed: 0,
        checks_failed: 0,
        checks: [],
        message: 'SLA monitor has not run yet',
      });
    }

    const status = data[0];
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({
      timestamp: status.timestamp,
      overall_status: status.overall_status,
      issues_count: status.issues_count,
      checks_total: status.checks_total,
      checks_passed: status.checks_passed,
      checks_failed: status.checks_failed,
      checks: status.checks || [],
    });
  } catch (error) {
    return res.status(200).json({
      overall_status: 'unknown',
      checks_total: 9,
      checks_passed: 0,
      checks_failed: 0,
      checks: [],
      message: 'Failed to fetch SLA status',
      error: error.message,
    });
  }
}