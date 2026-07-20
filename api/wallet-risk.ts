/**
 * api/wallet-risk.ts — Public wallet risk boundary
 * ========================================================================
 * Wallet transaction scoring lives in the private intelligence service. This
 * endpoint forwards parsed transaction data without exposing scoring weights,
 * drainer intelligence, or private reputation lists in frontend bundles.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import {
  callPrivateIntel,
  parseJsonBody,
  privateIntelConfigured,
  privateIntelUnavailable,
  sendJson,
} from './_lib/private-intel-service.js';

type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
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

  try {
    const body = await parseJsonBody(req);
    const result = await callPrivateIntel('/v1/wallet/risk', {
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
