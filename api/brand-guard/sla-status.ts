/**
 * api/brand-guard/sla-status.ts — Brand Guard SLA Status API
 * ========================================================================
 * GET /api/brand-guard/sla-status
 * Returns latest SLA monitor status from Supabase sla_status table.
 * Written by scripts/brand-guard-sla-monitor.py every 5 minutes.
 *
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 */

import type { IncomingMessage, ServerResponse } from 'http';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://drvasofyghnxfxvkkwad.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  if (!supabaseServiceKey) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      overall_status: 'unknown',
      checks_total: 9,
      checks_passed: 0,
      checks_failed: 0,
      checks: [],
      message: 'Supabase key not configured',
    }));
  }

  try {
    const url = `${supabaseUrl}/rest/v1/sla_status?order=timestamp.desc&limit=1`;
    const response = await fetch(url, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });

    if (!response.ok) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        overall_status: 'unknown',
        checks_total: 9,
        checks_passed: 0,
        checks_failed: 0,
        checks: [],
        message: `Supabase returned ${response.status}`,
      }));
    }

    const data = await response.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        overall_status: 'unknown',
        checks_total: 9,
        checks_passed: 0,
        checks_failed: 0,
        checks: [],
        message: 'SLA monitor has not run yet',
      }));
    }

    const s = data[0];
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    return res.end(JSON.stringify({
      timestamp: s.timestamp,
      overall_status: s.overall_status,
      issues_count: s.issues_count,
      checks_total: s.checks_total,
      checks_passed: s.checks_passed,
      checks_failed: s.checks_failed,
      checks: s.checks || [],
    }));
  } catch (error) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      overall_status: 'unknown',
      checks_total: 9,
      checks_passed: 0,
      checks_failed: 0,
      checks: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}