/**
 * Scammer Database API for AgenticBro Website
 * 
 * Fetches live scammer data from Supabase
 */

import type { IncomingMessage, ServerResponse } from 'http'

type VercelRequest = IncomingMessage & { body?: any; method?: string }
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse
  json: (data: any) => void
  setHeader: (name: string, value: string) => VercelResponse
  end: () => void
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.status(500).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    // Query Supabase for all scammers
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/known_scammers?select=*&order=updated_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Supabase error:', error);
      res.status(response.status).json({ error: 'Failed to fetch scammers' });
      return;
    }

    const data = await response.json();

    // Transform data for website compatibility
    const formatted = data.map((scammer: any) => ({
      id: scammer.id,
      scammer_name: scammer.display_name || scammer.username || scammer.id,
      platform: scammer.platform,
      x_handle: scammer.x_handle,
      telegram_channel: scammer.telegram_channel,
      verification_level: scammer.verification_level,
      risk_level: scammer.threat_level || 'MEDIUM',
      risk_score: scammer.risk_score || 50,
      scam_type: scammer.scam_type || 'Unknown',
      victims_count: scammer.victim_count || 0,
      total_lost_usd: scammer.total_lost_usd || '$0',
      wallet_address: scammer.wallet_address,
      notes: scammer.notes,
      evidence_urls: scammer.evidence_urls || scammer.evidence_links,
      red_flags: scammer.red_flags,
      scan_notes: scammer.scan_notes,
      status: scammer.status,
      impersonating: scammer.impersonating,
      first_reported: scammer.first_reported || scammer.created_at,
      last_updated: scammer.updated_at || scammer.last_seen,
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({
      total: formatted.length,
      scammers: formatted,
      last_updated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}