/**
 * api/phone-verify.ts — Phone verification via Supabase Edge Function
 *
 * Calls the phone-verify Edge Function deployed on Supabase.
 * Uses direct fetch instead of Supabase SDK for reliability.
 */

interface VercelRequest extends Request {
  body?: Record<string, unknown>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const body = typeof req.body === 'object' ? req.body : await req.json?.();
  const phone = body?.phone as string;
  const textScam = body?.textScam as boolean;
  const useQueue = body?.useQueue === true;

  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ error: 'Missing required field: phone' });
    return;
  }

  // Basic validation
  const stripped = phone.replace(/[^0-9+]/g, '');
  if (stripped.length < 7 || stripped.length > 16) {
    res.status(400).json({ error: 'Invalid phone number format. Include country code, e.g. +1234567890' });
    return;
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const supabaseKey = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Supabase not configured' });
    return;
  }

  // If useQueue is true, create a scan job via Supabase REST API
  if (useQueue) {
    try {
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/scan_jobs`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          scan_type: 'phone_community',
          payload: { phone: stripped, sources: ['800notes', 'whocalledme'] },
          status: 'pending',
          priority: 5,
        }),
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error('[phone-verify] Supabase insert error:', errText);
        res.status(500).json({ error: 'Failed to queue scan job' });
        return;
      }

      const jobs = await insertRes.json() as any[];
      const job = jobs[0];

      res.status(202).json({
        success: true,
        job_id: job.id,
        status: 'queued',
        poll_url: `/api/phone-scan/${job.id}`,
        message: 'CDP scan queued. Poll poll_url for results.',
      });
      return;
    } catch (err: any) {
      console.error('[phone-verify] Queue error:', err);
      res.status(500).json({ error: 'Failed to queue scan job', details: err.message });
      return;
    }
  }

  // Call the Supabase Edge Function directly via fetch
  // Using v1 endpoint which is the default for supabase-js v2
  try {
    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/phone-verify`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: stripped, textScam: !!textScam }),
      signal: AbortSignal.timeout(12000),
    });

    const text = await edgeRes.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!edgeRes.ok) {
      console.error('[phone-verify] Edge function returned', edgeRes.status, text);
      res.status(edgeRes.status).json({
        error: data?.error || 'Phone verification failed',
        details: data?.details || data?.raw || undefined,
      });
      return;
    }

    // Edge function returns { success: true, result: {...} }
    res.status(200).json(data);
  } catch (err: any) {
    console.error('[phone-verify] Fetch error:', err);
    res.status(500).json({
      error: 'Phone verification failed',
      details: err.message || 'Edge function unreachable',
    });
  }
}

export const config = {
  maxDuration: 15,
};