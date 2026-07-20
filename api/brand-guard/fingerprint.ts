/**
 * api/brand-guard/fingerprint.ts — Public visual fingerprint boundary
 * ========================================================================
 * Hash generation and image discovery live in the private intelligence service.
 * This public route keeps auth/entitlement checks and returns redacted
 * fingerprint metadata for dashboard display.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import { requireBrandGuardEntitlement } from '../_lib/brand-guard-entitlements.js';
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!supabase) {
    sendJson(res, 500, { error: 'Database not configured' });
    return;
  }

  const entitlement = await requireBrandGuardEntitlement(req, res, 'visual_fingerprints');
  if (!entitlement) return;

  const url = req.url || '/';
  const parts = url.split('?')[0].split('/').filter(Boolean);
  const hasAutoDiscover = parts.includes('auto-discover');

  if (req.method === 'GET' && parts.length >= 4 && !hasAutoDiscover) {
    const brandId = parts[3];
    const { data: ownedBrand } = await supabase
      .from('brand_monitors')
      .select('id')
      .eq('id', brandId)
      .eq('owner_id', entitlement.ownerId)
      .maybeSingle();
    if (!ownedBrand) {
      sendJson(res, 404, { error: 'Brand not found' });
      return;
    }

    const { data, error } = await supabase
      .from('brand_visual_fingerprints')
      .select('id, brand_id, image_url, image_type, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      sendJson(res, 500, { error: error.message });
      return;
    }
    sendJson(res, 200, data || []);
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (!privateIntelConfigured()) {
    privateIntelUnavailable(res);
    return;
  }

  const body = await parseJsonBody(req) as Record<string, unknown>;
  const path = hasAutoDiscover
    ? '/v1/brand-guard/fingerprint/auto-discover'
    : '/v1/brand-guard/fingerprint/register';

  try {
    const result = await callPrivateIntel(path, {
      method: 'POST',
      body: {
        ...body,
        authenticatedOwnerId: entitlement.ownerId,
      },
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
