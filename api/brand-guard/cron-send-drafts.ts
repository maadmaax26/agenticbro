/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/cron-send-drafts.ts — Disabled (outreach pipeline removed)
 * ========================================================================
 * This endpoint was previously used for the cold-outreach Gmail draft pipeline.
 * It has been disabled as part of the repo cleanup for public review.
 */

import type { IncomingMessage, ServerResponse } from 'http';

type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(410).json({ error: 'This endpoint has been disabled.' });
}

export const config = {
  api: {
    bodyParser: false,
  },
};