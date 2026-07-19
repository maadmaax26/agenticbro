import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Brand Guard SLA Status API
 * 
 * GET /api/brand-guard/sla-status
 * Returns the latest SLA monitor status for the admin dashboard.
 * 
 * The status is written by scripts/brand-guard-sla-monitor.py every 5 min
 * to output/brand-guard-sla-status.json
 */

const STATUS_FILE = '/Users/efinney/.openclaw/workspace/output/brand-guard-sla-status.json';

interface SLACheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail';
  icon: string;
  details: string;
  metric?: number;
  threshold?: number;
}

interface SLAStatus {
  timestamp: string;
  overall_status: 'healthy' | 'degraded';
  issues_count: number;
  checks_total: number;
  checks_passed: number;
  checks_failed: number;
  checks: SLACheck[];
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  try {
    const fs = await import('fs');
    
    if (!fs.existsSync(STATUS_FILE)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        timestamp: new Date().toISOString(),
        overall_status: 'unknown',
        issues_count: 0,
        checks_total: 9,
        checks_passed: 0,
        checks_failed: 0,
        checks: [],
        message: 'SLA monitor has not run yet. Status file not found.',
      }));
    }

    const data = fs.readFileSync(STATUS_FILE, 'utf-8');
    const status: SLAStatus = JSON.parse(data);

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    return res.end(JSON.stringify(status));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      error: 'Failed to read SLA status',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}