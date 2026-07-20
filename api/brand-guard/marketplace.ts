/**
 * api/brand-guard/marketplace.ts — Public marketplace scanner boundary
 * ========================================================================
 * Scanner execution lives in the private intelligence service. This route
 * exposes the public contract, forwards execution requests, and reads saved
 * results for the dashboard.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import {
  callPrivateIntel,
  parseJsonBody,
  privateIntelConfigured,
  privateIntelUnavailable,
} from '../_lib/private-intel-service.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = req.url || '/';
  const parsedUrl = new URL(url, 'https://brand-guard.local');
  const parts = url.split('?')[0].split('/').filter(Boolean);
  const hasRunScheduled = parts.includes('run-scheduled');
  const hasResults = parts.includes('results');

  if (req.method === 'GET' && hasResults && parts.length >= 5) {
    if (!supabase) return sendJson(res, 500, { error: 'Database not configured' });

    const brandId = parts[4];
    const { data, error } = await supabase
      .from('marketplace_scan_results')
      .select('*, visual_match_evidence(*)')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return sendJson(res, 500, { error: error.message });
    return sendJson(res, 200, data || []);
  }

  if (!privateIntelConfigured()) {
    privateIntelUnavailable(res as any);
    return;
  }

  try {
    if (req.method === 'POST' && !hasRunScheduled) {
      const body = await parseJsonBody(req);
      const result = await callPrivateIntel('/v1/brand-guard/marketplace/scan', {
        method: 'POST',
        body,
        authorization: req.headers.authorization,
      });
      return sendJson(res, 200, result);
    }

    if ((req.method === 'GET' || req.method === 'POST') && hasRunScheduled) {
      const body = req.method === 'POST' ? await parseJsonBody(req) : undefined;
      const query = parsedUrl.search ? parsedUrl.search : '';
      const result = await callPrivateIntel('/v1/brand-guard/marketplace/run-scheduled', {
        method: req.method,
        body,
        authorization: req.headers.authorization,
        query,
      });
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode || 502;
    return sendJson(res, statusCode, {
      error: err instanceof Error ? err.message : 'Private intelligence service error',
      code: 'PRIVATE_INTEL_SERVICE_ERROR',
    });
  }
}

export const config = {
  maxDuration: 15,
};
