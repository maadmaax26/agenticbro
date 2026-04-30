/**
 * api/website-deep-scan-sync.ts — Synchronous Deep Website Scanner
 * 
 * Calls OpenClaw agent for real-time deep scan with web research
 * 
 * POST /api/website-deep-scan-sync
 * Body: { url: string }
 * Returns: DeepScanResult (synchronously, ~10-20 seconds)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface DeepScanResult {
  success: boolean;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL format
  let validUrl: string;
  let domain: string;
  try {
    validUrl = url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : 'https://' + url;
    const parsed = new URL(validUrl);
    domain = parsed.hostname.replace('www.', '');
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Call OpenClaw agent to perform deep scan
  const openclawApi = process.env.OPENCLAW_API_URL || 'https://gateway.openclaw.ai';
  const agentToken = process.env.OPENCLAW_AGENT_TOKEN || '';
  const agentId = process.env.OPENCLAW_AGENT_ID || 'agentic-bro';

  try {
    // Send message to OpenClaw agent and wait for response
    const agentResponse = await fetch(`${openclawApi}/api/agent/${agentId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        message: `Deep scan website: ${validUrl}\n\nUse web_search to research this domain for scam reports, regulatory warnings, and user reviews. Provide a detailed risk assessment with sources.`,
        waitForResponse: true,
        timeout: 30000,
      }),
    });

    if (!agentResponse.ok) {
      throw new Error(`Agent request failed: ${agentResponse.status}`);
    }

    const agentResult = await agentResponse.json();
    
    // Parse agent response into structured result
    const result: DeepScanResult = {
      success: true,
      url: validUrl,
      domain,
      riskScore: parseRiskScore(agentResult.response),
      riskLevel: parseRiskLevel(agentResult.response),
      scamReports: parseScamReports(agentResult.response),
      scamIndicators: extractScamIndicators(agentResult.response),
      recommendations: extractRecommendations(agentResult.response),
      scanDate: new Date().toISOString(),
    };

    return res.status(200).json(result);

  } catch (error: any) {
    // Fallback - return basic scan with manual check links
    const result: DeepScanResult = {
      success: false,
      url: validUrl,
      domain,
      riskScore: 0,
      riskLevel: 'LOW',
      scamReports: [],
      scamIndicators: [],
      recommendations: [
        '⚠️ Deep scan temporarily unavailable',
        '🔍 Check manually: https://www.scamadviser.com/check-website/' + domain,
        '🔍 Check manually: https://www.trustpilot.com/review/' + domain,
      ],
      scanDate: new Date().toISOString(),
    };

    return res.status(200).json(result);
  }
}

function parseRiskScore(response: string): number {
  const match = response.match(/risk score[:\s]*(\d+)/i);
  return match ? parseInt(match[1]) : 5;
}

function parseRiskLevel(response: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (/critical/i.test(response)) return 'CRITICAL';
  if (/high risk/i.test(response)) return 'HIGH';
  if (/medium risk/i.test(response)) return 'MEDIUM';
  return 'LOW';
}

function parseScamReports(response: string): DeepScanResult['scamReports'] {
  const reports: DeepScanResult['scamReports'] = [];
  const lines = response.split('\n');
  
  for (const line of lines) {
    if (/scam|fraud|warning|avoid/i.test(line)) {
      reports.push({
        source: 'Web Search',
        title: line.slice(0, 100),
        verdict: 'Potential scam indicator',
        isScam: true,
      });
    }
  }
  
  return reports.slice(0, 10);
}

function extractScamIndicators(response: string): string[] {
  const indicators: string[] = [];
  const patterns = [
    /no withdrawal/i, /stolen/i, /fake/i, /scam/i,
    /phishing/i, /suspicious/i, /blocked/i, /fraud/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(response)) {
      const match = response.match(new RegExp(`[^.]*${pattern.source}[^.]*`, 'i'));
      if (match) {
        indicators.push(match[0].trim().slice(0, 100));
      }
    }
  }
  
  return [...new Set(indicators)].slice(0, 5);
}

function extractRecommendations(response: string): string[] {
  const recs: string[] = [];
  const lines = response.split('\n');
  
  for (const line of lines) {
    if (/❌|⚠️|🔍|📋|🚨/.test(line)) {
      recs.push(line.trim());
    }
  }
  
  return recs.slice(0, 10);
}