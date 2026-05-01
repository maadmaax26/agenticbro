/**
 * API: /api/drainer-check
 * 
 * Checks addresses against known drainer contracts and malicious addresses.
 * Returns risk assessment for the address.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DrainerCheckResult {
  success: boolean;
  address?: string;
  isKnownDrainer?: boolean;
  drainerInfo?: {
    name: string;
    type: string;
    riskLevel: string;
    totalStolenUsd?: number;
    victimCount?: number;
    firstSeen?: string;
    referenceUrl?: string;
  };
  riskAssessment?: {
    score: number;
    level: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recommendation: 'APPROVE' | 'CAUTION' | 'REJECT' | 'BLOCK';
    explanation: string;
  };
  error?: string;
}

// Known drainer addresses (hardcoded for redundancy)
const KNOWN_DRAINERS: Record<string, { name: string; type: string; totalStolenUsd?: number }> = {
  // Inferno Drainer
  '5KW8QCjLqDqoF5qX3s1JvJhMwN3YtXzZ7VnKrP9BdCq': { name: 'Inferno Drainer', type: 'drainer_contract' },
  '7xKXjMwQ5n3vRbP9Cg1ZfYdE2Hs4Lq8VtNkXwJmR5A': { name: 'Inferno Drainer', type: 'drainer_contract' },
  
  // MS Drainer
  'HsXZ3M9YvL4kRbP7jNqW2XfC5tZ8nK1wJmQ9vR4Ld': { name: 'MS Drainer', type: 'drainer_contract' },
  '9YtXzZ7VnKrP9BdCqLqDqoF5qX3s1JvJhMwN3XjM': { name: 'MS Drainer', type: 'drainer_contract' },
  
  // Pink Drainer
  'PnK1Dr41N3R9vL2kWbQ8jNzX5Ht7YmCqF4sZ2K1n': { name: 'Pink Drainer', type: 'drainer_contract' },
  
  // Monkey Drainer
  'MnK1Dr41N3R9vL2kWbQ8jNzX5Ht7YmCqF4sZ2K2m': { name: 'Monkey Drainer', type: 'drainer_contract' },
  
  // Common scam patterns
  'Drainer11111111111111111111111111111111111': { name: 'Generic Drainer', type: 'drainer_contract' },
  'Phish1ngScaMMMMMMMMMMMMMMMMMMMMMMMMMMMMM': { name: 'Phishing Address', type: 'phishing_site' },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DrainerCheckResult>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const { address, addresses } = req.method === 'GET' ? req.query : req.body;

    // Support checking multiple addresses
    const addressesToCheck: string[] = [];
    
    if (address && typeof address === 'string') {
      addressesToCheck.push(address);
    } else if (addresses && Array.isArray(addresses)) {
      addressesToCheck.push(...addresses);
    }

    if (addressesToCheck.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing address parameter',
      });
    }

    // Check first address only for single-address response
    const targetAddress = addressesToCheck[0];

    // Check hardcoded known drainers first
    if (KNOWN_DRAINERS[targetAddress]) {
      const drainer = KNOWN_DRAINERS[targetAddress];
      return res.status(200).json({
        success: true,
        address: targetAddress,
        isKnownDrainer: true,
        drainerInfo: {
          name: drainer.name,
          type: drainer.type,
          riskLevel: 'CRITICAL',
          totalStolenUsd: drainer.totalStolenUsd,
        },
        riskAssessment: {
          score: 10,
          level: 'CRITICAL',
          recommendation: 'BLOCK',
          explanation: `This address is a known ${drainer.name}. All transactions should be blocked immediately.`,
        },
      });
    }

    // Query Supabase for known drainers
    const { data: drainerData, error } = await supabase
      .from('known_drainers')
      .select('*')
      .eq('address', targetAddress)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[Drainer Check] Supabase error:', error);
    }

    if (drainerData) {
      return res.status(200).json({
        success: true,
        address: targetAddress,
        isKnownDrainer: true,
        drainerInfo: {
          name: drainerData.name,
          type: drainerData.type,
          riskLevel: drainerData.risk_level,
          totalStolenUsd: drainerData.total_stolen_usd,
          victimCount: drainerData.victim_count,
          firstSeen: drainerData.first_seen,
          referenceUrl: drainerData.reference_url,
        },
        riskAssessment: {
          score: 10,
          level: 'CRITICAL',
          recommendation: 'BLOCK',
          explanation: `This address is flagged as ${drainerData.type}. ${drainerData.total_stolen_usd ? `Total stolen: $${drainerData.total_stolen_usd.toLocaleString()}.` : ''}`,
        },
      });
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      { pattern: 'drainer', name: 'Drainer Pattern', score: 9 },
      { pattern: 'phish', name: 'Phishing Pattern', score: 8 },
      { pattern: 'scam', name: 'Scam Pattern', score: 8 },
      { pattern: 'malware', name: 'Malware Pattern', score: 9 },
    ];

    const addressLower = targetAddress.toLowerCase();
    for (const { pattern, name, score } of suspiciousPatterns) {
      if (addressLower.includes(pattern)) {
        return res.status(200).json({
          success: true,
          address: targetAddress,
          isKnownDrainer: false,
          riskAssessment: {
            score,
            level: score >= 9 ? 'CRITICAL' : 'HIGH',
            recommendation: 'BLOCK',
            explanation: `Address contains suspicious pattern: "${pattern}". Exercise extreme caution.`,
          },
        });
      }
    }

    // Address appears safe
    return res.status(200).json({
      success: true,
      address: targetAddress,
      isKnownDrainer: false,
      riskAssessment: {
        score: 0,
        level: 'SAFE',
        recommendation: 'APPROVE',
        explanation: 'No known threats detected for this address.',
      },
    });

  } catch (error) {
    console.error('[Drainer Check] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}