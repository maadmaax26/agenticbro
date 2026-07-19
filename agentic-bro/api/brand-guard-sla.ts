/**
 * Brand Guard SLA Status — Vercel Serverless Function
 * GET /api/brand-guard/sla-status
 * Returns latest SLA monitor status from Supabase sla_status table.
 */

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://drvasofyghnxfxvkkwad.supabase.co';
  // Try service role key (bypasses RLS), then secret API key, then service role key alt name
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!SUPABASE_KEY) {
    return res.status(200).json({
      overall_status: 'unknown',
      checks_total: 9, checks_passed: 0, checks_failed: 0, checks: [],
      message: 'No Supabase key configured. Set SUPABASE_SECRET_API_KEY in Vercel env.',
    });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/sla_status?order=timestamp.desc&limit=1`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(200).json({
        overall_status: 'unknown',
        checks_total: 9, checks_passed: 0, checks_failed: 0, checks: [],
        message: `Supabase returned ${response.status}: ${body.substring(0, 100)}`,
      });
    }

    const data = await response.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(200).json({
        overall_status: 'unknown',
        checks_total: 9, checks_passed: 0, checks_failed: 0, checks: [],
        message: 'SLA monitor has not run yet',
      });
    }

    const s = data[0];
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({
      timestamp: s.timestamp,
      overall_status: s.overall_status,
      issues_count: s.issues_count,
      checks_total: s.checks_total,
      checks_passed: s.checks_passed,
      checks_failed: s.checks_failed,
      checks: s.checks || [],
    });
  } catch (error) {
    return res.status(200).json({
      overall_status: 'unknown',
      checks_total: 9, checks_passed: 0, checks_failed: 0, checks: [],
      error: error.message || 'Unknown error',
    });
  }
};