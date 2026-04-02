/**
 * Detailed Scan Reports API
 * 
 * Fetches full scan report details from Supabase
 * Used when a scammer card is selected to show full report
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

  // Get username from query params
  const url = new URL(req.url || '', `https://${req.headers.host}`);
  const username = url.searchParams.get('username');

  if (!username) {
    res.status(400).json({ error: 'username parameter required' });
    return;
  }

  try {
    // Query Supabase for the scammer record
    const cleanHandle = username.replace('@', '').toLowerCase();
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/known_scammers?or=(username.eq.${cleanHandle},x_handle.ilike.%25${cleanHandle}%25,telegram_channel.eq.${cleanHandle})&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      res.status(response.status).json({ error: 'Database query failed' });
      return;
    }

    const data = await response.json();
    
    if (data.length === 0) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const record = data[0];

    // Transform into detailed scan report format
    const report = {
      scan_id: record.id,
      scan_type: 'Database Lookup',
      timestamp: record.updated_at,
      target: {
        platform: record.platform,
        handle: record.x_handle || record.telegram_channel || record.username,
        display_name: record.display_name,
        profile_url: record.platform === 'twitter' 
          ? `https://x.com/${record.username}` 
          : `https://t.me/${record.telegram_channel}`,
      },
      profile_data: {
        followers: extractNumber(record.notes, 'followers'),
        account_age: extractText(record.notes, 'Age'),
        bio: record.notes?.split('.')[0] || '',
        telegram: record.telegram_channel ? `t.me/${record.telegram_channel}` : null,
      },
      verification_status: {
        verification_level: record.verification_level,
        verification_notes: record.notes,
      },
      red_flag_analysis: parseRedFlags(record.red_flags, record.verification_level, record.threat_level),
      risk_score: {
        score: record.risk_score / 10,
        level: record.threat_level,
        raw_score: record.risk_score,
        max_score: 100,
      },
      content_analysis: {
        recent_posts: [],
        engagement_metrics: {},
        promotion_frequency: record.verification_level === 'Paid Promoter' ? 'Multiple paid promotions observed' : 'Unknown',
      },
      partnership_assessment: {
        viable_target: record.verification_level !== 'High Risk' && record.verification_level !== 'Verified',
        pros: extractPros(record.notes, record.verification_level),
        considerations: extractConsiderations(record.notes, record.verification_level),
      },
      conclusion: {
        is_scammer: record.verification_level === 'Verified' || record.threat_level === 'HIGH',
        is_legitimate: record.verification_level === 'Legitimate' || record.verification_level === 'Paid Promoter',
        is_paid_promoter: record.verification_level === 'Paid Promoter',
        action: getAction(record),
      },
      evidence: record.evidence_urls || [],
      scam_type: record.scam_type,
      victim_count: record.victim_count,
      total_lost_usd: record.total_lost_usd,
      wallet_address: record.wallet_address,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(report);

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function extractNumber(text: string, key: string): number | null {
  if (!text) return null;
  const match = text.match(new RegExp(`([\\d.]+[KM]?)\\s*${key}`, 'i'));
  if (!match) return null;
  
  const num = match[1];
  if (num.endsWith('K')) return parseFloat(num) * 1000;
  if (num.endsWith('M')) return parseFloat(num) * 1000000;
  return parseInt(num);
}

function extractText(text: string, key: string): string | null {
  if (!text) return null;
  const match = text.match(new RegExp(`${key}:\\s*([^|]+)`, 'i'));
  return match ? match[1].trim() : null;
}

function parseRedFlags(flags: string[], verificationLevel: string, threatLevel: string): Record<string, any> {
  const result: Record<string, any> = {
    guaranteed_returns: { detected: false, weight: 15, score: 0, notes: '' },
    private_alpha: { detected: false, weight: 15, score: 0, notes: '' },
    unrealistic_claims: { detected: false, weight: 15, score: 0, notes: '' },
    urgency_tactics: { detected: false, weight: 10, score: 0, notes: '' },
    no_track_record: { detected: false, weight: 10, score: 0, notes: '' },
    requests_crypto: { detected: false, weight: 10, score: 0, notes: '' },
    no_verification: { detected: false, weight: 10, score: 0, notes: '' },
    fake_followers: { detected: false, weight: 10, score: 0, notes: '' },
    new_account: { detected: false, weight: 10, score: 0, notes: '' },
    vip_upsell: { detected: false, weight: 10, score: 0, notes: '' },
  };

  // Parse flags
  if (flags && Array.isArray(flags)) {
    if (flags.includes('verified_scammer')) {
      result.no_verification = { detected: false, weight: 10, score: 0, notes: 'Account verified but is confirmed scammer' };
    }
    if (flags.includes('high_risk')) {
      result.unrealistic_claims = { detected: true, weight: 15, score: 15, notes: 'High risk account' };
    }
    if (flags.includes('paid_promotions')) {
      result.unrealistic_claims = { detected: true, weight: 15, score: 15, notes: 'Account does paid promotions' };
    }
    if (flags.includes('established_account')) {
      result.no_track_record = { detected: false, weight: 10, score: 0, notes: 'Established account with history' };
    }
    if (flags.includes('high_followers')) {
      result.fake_followers = { detected: false, weight: 10, score: 0, notes: 'High follower count (verify authenticity)' };
    }
    if (flags.includes('rug_pull_risk')) {
      result.unrealistic_claims = { detected: true, weight: 15, score: 15, notes: 'Token confusion/rug pull risk' };
    }
    if (flags.includes('phishing')) {
      result.urgency_tactics = { detected: true, weight: 10, score: 10, notes: 'Phishing activity detected' };
    }
    if (flags.includes('wallet_drainer')) {
      result.requests_crypto = { detected: true, weight: 10, score: 10, notes: 'Wallet drainer detected' };
    }
  }

  return result;
}

function extractPros(notes: string, verificationLevel: string): string[] {
  const pros: string[] = [];
  if (!notes) return pros;

  if (notes.includes('Legitimate') || notes.includes('legitimate')) {
    pros.push('Legitimate account');
  }
  if (notes.includes('717K') || notes.includes('followers')) {
    pros.push('High follower count');
  }
  if (notes.includes('14+ years') || notes.includes('established')) {
    pros.push('Established account with history');
  }
  if (verificationLevel === 'Paid Promoter') {
    pros.push('Transparent about paid promotions');
  }
  if (notes.includes('AMA HOST') || notes.includes('CEO')) {
    pros.push('Public figure/entrepreneur');
  }

  return pros;
}

function extractConsiderations(notes: string, verificationLevel: string): string[] {
  const considerations: string[] = [];
  if (!notes) return considerations;

  if (verificationLevel === 'Paid Promoter') {
    considerations.push('Account does paid token promotions');
  }
  if (notes.includes('paid token') || notes.includes('paid promotions')) {
    considerations.push('May promote tokens for payment');
  }
  if (notes.includes('100x') || notes.includes('unrealistic')) {
    considerations.push('Some unrealistic claims in posts');
  }
  if (verificationLevel === 'Partially Verified') {
    considerations.push('Suspicious patterns detected - investigate further');
  }
  if (verificationLevel === 'High Risk') {
    considerations.push('HIGH RISK - avoid engagement');
  }

  return considerations;
}

function getAction(record: any): string {
  const level = record.verification_level?.toLowerCase();
  
  if (level === 'paid promoter') {
    return 'Viable for partnership with disclosure. Verify paid promotion terms.';
  }
  if (level === 'legitimate' || level === 'resolved') {
    return 'Safe to engage. No action required.';
  }
  if (level === 'high risk' || level === 'verified') {
    return 'AVOID. High risk confirmed scammer.';
  }
  if (level === 'partially verified') {
    return 'CAUTION. Investigate further before engaging.';
  }
  
  return 'Unknown. Verify independently before engaging.';
}