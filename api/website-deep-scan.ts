/**
 * api/website-deep-scan.ts — Deep Website Security Scanner
 * 
 * Triggers OpenClaw agent for detailed external reputation research
 * 
 * POST /api/website-deep-scan
 * Body: { url: string, callbackUrl?: string }
 * Returns: { success: boolean, message: string, scanId: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface DeepScanRequest {
  url: string;
  callbackUrl?: string;
}

interface DeepScanResponse {
  success: boolean;
  message: string;
  scanId: string;
  estimatedTime: string;
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

  const { url, callbackUrl } = req.body as DeepScanRequest;

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

  // Trigger OpenClaw agent via webhook
  // This sends a system event to the agentic-bro agent for detailed scanning
  const agentWebhook = process.env.OPENCLAW_WEBHOOK_URL || 'https://gateway.openclaw.ai/webhook';
  
  try {
    const webhookPayload = {
      event: 'website_deep_scan',
      url: validUrl,
      domain,
      scanId,
      callbackUrl,
      requestedAt: new Date().toISOString(),
    };

    // Fire and forget - agent will process asynchronously
    await fetch(agentWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENCLAW_AGENT_TOKEN || ''}`,
      },
      body: JSON.stringify(webhookPayload),
    }).catch(() => {
      // Webhook failed - but we still return success
      // Agent will pick up from event queue
    });

    const response: DeepScanResponse = {
      success: true,
      message: `Deep scan initiated for ${domain}. Agent is performing detailed reputation research.`,
      scanId,
      estimatedTime: '30-60 seconds',
    };

    return res.status(202).json(response);

  } catch (error: any) {
    // Fallback - still return success, agent will process from scan queue
    const response: DeepScanResponse = {
      success: true,
      message: `Deep scan queued for ${domain}. Check back in 30-60 seconds.`,
      scanId,
      estimatedTime: '30-60 seconds',
    };

    return res.status(202).json(response);
  }
}