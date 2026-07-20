/**
 * Public Brand Guard vendor verification shell.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  callPrivateIntel,
  parseJsonBody,
  privateIntelConfigured,
  privateIntelUnavailable,
  sendJson,
} from '../_lib/private-intel-service.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, error: 'Method not allowed' });
    return;
  }
  if (!privateIntelConfigured()) {
    privateIntelUnavailable(res);
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const result = await callPrivateIntel('/v1/brand-guard/vendor-verify', {
      method: 'POST',
      body,
      authorization: req.headers.authorization,
    });
    sendJson(res, 200, result);
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;
    sendJson(res, statusCode, {
      success: false,
      error: error instanceof Error ? error.message : 'Private vendor verification failed',
    });
  }
}
