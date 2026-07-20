/**
 * Public API shell for transaction analysis.
 *
 * The private intelligence service owns parsing, address reputation, scoring
 * weights, and recommendation logic.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  callPrivateIntel,
  parseJsonBody,
  privateIntelConfigured,
  privateIntelUnavailable,
  sendJson,
} from './_lib/private-intel-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      success: false,
      fee: 0,
      instructions: [],
      overallRisk: {
        score: 0,
        level: 'SAFE',
        flags: [],
        recommendation: 'REJECT',
        explanation: 'Method not allowed',
      },
      error: 'Method not allowed',
    });
  }

  if (!privateIntelConfigured()) {
    return privateIntelUnavailable(res);
  }

  try {
    const body = await parseJsonBody(req);
    const result = await callPrivateIntel('/v1/wallet/transaction-analyze', {
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
      fee: 0,
      instructions: [],
      overallRisk: {
        score: 0,
        level: 'SAFE',
        flags: [],
        recommendation: 'REJECT',
        explanation: 'Private transaction analysis failed',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
