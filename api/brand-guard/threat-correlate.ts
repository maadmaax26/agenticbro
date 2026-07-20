/**
 * Copyright (c) 2026 Agentic Insights LLC. SPDX-License-Identifier: Apache-2.0
 */

/**
 * Public Brand Guard threat-correlation boundary.
 *
 * The correlation engine, risk weights, entity-linking rules, and takedown
 * decision logic live in the private intelligence service. This route only
 * validates the public API contract, forwards authenticated POST requests, and
 * reads already-stored profiles for GET requests.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import {
  callPrivateIntel,
  parseJsonBody,
  privateIntelConfigured,
  privateIntelUnavailable,
  sendJson,
} from '../_lib/private-intel-service.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    const threatId = (req.url?.split('threat_id=')[1]?.split('&')[0]) || '';
    if (!threatId) {
      sendJson(res, 400, { error: 'Missing threat_id parameter' });
      return;
    }
    if (supabase) {
      const { data, error } = await supabase
        .from('threat_profiles')
        .select('*')
        .eq('threat_id', threatId)
        .single();
      if (data && !error) {
        sendJson(res, 200, data);
        return;
      }
    }
    sendJson(res, 404, { error: 'Threat profile not found', threat_id: threatId });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!privateIntelConfigured()) {
    privateIntelUnavailable(res);
    return;
  }

  const body = await parseJsonBody(req) as Record<string, unknown>;
  if (!body.brand_name || !body.brand_handle) {
    sendJson(res, 400, { error: 'brand_name and brand_handle are required' });
    return;
  }

  try {
    const result = await callPrivateIntel('/v1/brand-guard/threat-correlate', {
      method: 'POST',
      body,
      authorization: req.headers.authorization,
    });
    sendJson(res, 200, result);
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode || 502;
    sendJson(res, statusCode, {
      error: err instanceof Error ? err.message : 'Private intelligence service error',
      code: 'PRIVATE_INTEL_SERVICE_ERROR',
    });
  }
}

export const config = {
  maxDuration: 15,
};
