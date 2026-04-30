/**
 * api/website-deep-scan.ts — Deep Website Security Scanner
 * 
 * Triggers OpenClaw agent for detailed external reputation research
 * 
 * POST /api/website-deep-scan
 * Body: { url: string }
 * Returns: { success: boolean, scanId: string }
 * 
 * GET /api/website-deep-scan?scanId=xxx - Get scan result
 * GET /api/website-deep-scan?pending=true - List pending scans
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface DeepScanRequest {
  url: string;
}

interface DeepScanResult {
  scanId: string;
  url: string;
  domain: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scamReports: {
    source: string;
    title: string;
    verdict: string;
    isScam: boolean;
  }[];
  scamIndicators: string[];
  recommendations: string[];
  scanDate: string;
}

interface ScanStatus {
  scanId: string;
  domain: string;
  url: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  result?: DeepScanResult;
  createdAt: string;
  completedAt?: string;
}

// Use Vercel KV if available, otherwise in-memory fallback
const kv = (globalThis as any).vercelKV;
const memoryStore = new Map<string, ScanStatus>();

async function getStore() {
  return kv || {
    get: async (key: string) => memoryStore.get(key),
    set: async (key: string, value: any) => memoryStore.set(key, value),
    keys: async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return Array.from(memoryStore.keys()).filter(k => k.startsWith(prefix));
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const store = await getStore();

  // GET - Check scan status/results or list pending scans
  if (req.method === 'GET') {
    const { scanId, pending } = req.query;
    
    // List pending scans
    if (pending === 'true' || pending === '1') {
      const keys = await store.keys('scan:*');
      const pendingScans: ScanStatus[] = [];
      
      for (const key of keys) {
        const scan = await store.get(key);
        if (scan && (scan.status === 'pending' || scan.status === 'processing')) {
          pendingScans.push(scan);
        }
      }
      
      return res.status(200).json({
        success: true,
        pending: pendingScans,
        count: pendingScans.length,
      });
    }
    
    if (!scanId || typeof scanId !== 'string') {
      return res.status(400).json({ error: 'scanId is required (or use ?pending=true)' });
    }
    
    const scan = await store.get(`scan:${scanId}`);
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    
    return res.status(200).json({
      success: true,
      ...scan,
    });
  }

  // POST - Initiate new scan OR update existing scan with results
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as DeepScanRequest | DeepScanResult;
  
  // Check if this is a result update (has scanId)
  if ('scanId' in body && body.scanId) {
    // This is a result update from the agent
    const { scanId, domain, riskScore, riskLevel, scamReports, scamIndicators, recommendations } = body as DeepScanResult;
    
    const existingScan = await store.get(`scan:${scanId}`) as ScanStatus | null;
    if (!existingScan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    
    // Update with results
    const updatedScan: ScanStatus = {
      ...existingScan,
      status: 'complete',
      result: {
        scanId,
        url: existingScan.url,
        domain,
        riskScore,
        riskLevel,
        scamReports,
        scamIndicators,
        recommendations,
        scanDate: new Date().toISOString(),
      },
      completedAt: new Date().toISOString(),
    };
    
    await store.set(`scan:${scanId}`, updatedScan);
    
    return res.status(200).json({
      success: true,
      message: 'Scan result updated',
      scanId,
    });
  }

  const { url } = body as DeepScanRequest;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL format
  let validUrl: string;
  try {
    validUrl = url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : 'https://' + url;
    new URL(validUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Extract domain
  const domain = new URL(validUrl).hostname.replace('www.', '');

  // Generate scan ID
  const scanId = `deep-${domain}-${Date.now()}`;
  
  // Store scan status
  const scanStatus: ScanStatus = {
    scanId,
    domain,
    url: validUrl,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  
  await store.set(`scan:${scanId}`, scanStatus);

  // OpenClaw agent will pick this up via cron job checking /pending
  return res.status(202).json({
    success: true,
    message: `Deep scan queued for ${domain}`,
    scanId,
    pollUrl: `/api/website-deep-scan?scanId=${scanId}`,
    estimatedTime: '30-60 seconds',
  });
}