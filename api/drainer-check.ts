/**
 * Public drainer-check shell. Private address reputation stays server-side.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  callPrivateIntel,
  parseJsonBody,
  privateIntelConfigured,
  privateIntelUnavailable,
  sendJson,
} from './_lib/private-intel-service.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }
  if (!privateIntelConfigured()) return privateIntelUnavailable(res);

  try {
    const body = req.method === 'GET' ? req.query : await parseJsonBody(req);
    const result = await callPrivateIntel('/v1/wallet/drainer-check', {
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
      error: error instanceof Error ? error.message : 'Private drainer check failed',
    });
  }
}
