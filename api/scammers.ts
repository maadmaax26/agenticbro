/**
 * Scammer Database API for AgenticBro Website
 * 
 * Fetches live scammer data from Supabase
 */

export default async function handler(req: Request): Promise<Response> {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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
      return new Response(JSON.stringify({ error: 'Failed to fetch scammers' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    // Transform data for website compatibility
    const formatted = data.map((scammer: any) => ({
      id: scammer.id,
      name: scammer.display_name || scammer.username,
      platform: scammer.platform,
      x_handle: scammer.x_handle,
      telegram_channel: scammer.telegram_channel,
      verification_level: scammer.verification_level,
      threat_level: scammer.threat_level,
      risk_score: scammer.risk_score,
      scam_type: scammer.scam_type,
      victim_count: scammer.victim_count,
      total_lost_usd: scammer.total_lost_usd,
      wallet_address: scammer.wallet_address,
      notes: scammer.notes,
      evidence_links: scammer.evidence_urls || scammer.evidence_links,
      last_seen: scammer.last_seen,
      status: scammer.status,
      updated_at: scammer.updated_at,
    }));

    return new Response(JSON.stringify({
      total: formatted.length,
      scammers: formatted,
      last_updated: new Date().toISOString(),
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}