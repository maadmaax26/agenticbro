/**
 * Public token impersonation shell.
 *
 * Search expansion, scoring, categorization, and alert generation live in the
 * private intelligence service.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import {
  callPrivateIntel,
  parseJsonBody,
  privateIntelConfigured,
  privateIntelUnavailable,
  sendJson,
} from './_lib/private-intel-service';

interface VercelResponse extends ServerResponse {
  status?: (code: number) => VercelResponse;
  json?: (data: unknown) => void;
}

export default async function handler(req: IncomingMessage, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  if (!privateIntelConfigured()) return privateIntelUnavailable(res);

  try {
    const body = await parseJsonBody(req);
    const result = await callPrivateIntel('/v1/token/impersonation-scan', {
      method: 'POST',
      body,
      authorization: req.headers.authorization,
    });
    return sendJson(res, 200, result);
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;
    return sendJson(res, statusCode, {
      success: false,
      error: error instanceof Error ? error.message : 'Private token scan failed',
    });
  }
}
