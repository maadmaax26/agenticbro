/**
 * api/website-deep-scan-callback.ts — Callback for agent deep scan results
 * 
 * Receives scan results from OpenClaw agent
 * 
 * POST /api/website-deep-scan/callback
 * Body: DeepScanResult
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface DeepScanResult {
  scanId: string;
  url: string;
  domain: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scamReports: {
    source: string;
    title: string;
    url: string;
    description: string;
    isScam: boolean;
  }[];
  scamIndicators: string[];
  recommendations: string[];
  scanDate: string;
}

// Shared storage - in production use Redis or database
// This file imports from website-deep-scan.ts's scans Map
declare const scans: Map<string, any>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = req.body as DeepScanResult;

  if (!result.scanId) {
    return res.status(400).json({ error: 'scanId is required' });
  }

  // In production, store in database
  // For now, we'll use Vercel KV or just return success
  // The frontend will need to poll or use real-time updates

  console.log('Deep scan callback received:', {
    scanId: result.scanId,
    domain: result.domain,
    riskLevel: result.riskLevel,
    scamIndicators: result.scamIndicators?.length || 0,
  });

  // Store result for retrieval
  // In production: await kv.set(`scan:${result.scanId}`, result, { ex: 3600 });

  return res.status(200).json({
    success: true,
    message: 'Scan result received',
    scanId: result.scanId,
  });
}