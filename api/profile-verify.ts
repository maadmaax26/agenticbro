/**
 * Public profile verification shell.
 *
 * Queue orchestration, known-scammer lookups, scoring rules, and fallback
 * profile heuristics run in the private intelligence service.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  callPrivateIntel,
  parseJsonBody,
  privateIntelConfigured,
  privateIntelUnavailable,
  sendJson,
} from './_lib/private-intel-service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }
  if (!privateIntelConfigured()) return privateIntelUnavailable(res);

  try {
    const body = await parseJsonBody(req);
    const result = await callPrivateIntel('/v1/profile/verify', {
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
      error: error instanceof Error ? error.message : 'Private profile verification failed',
    });
  }
}
