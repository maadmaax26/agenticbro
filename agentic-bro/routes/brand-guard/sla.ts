/**
 * Brand Guard SLA Status Route
 *
 * GET /api/brand-guard/sla-status
 * Returns SLA monitor status for the admin dashboard.
 */
import { Router } from 'express';
import * as fs from 'fs';

const router = Router();

const STATUS_FILE = '/Users/efinney/.openclaw/workspace/output/brand-guard-sla-status.json';

router.get('/sla-status', async (req, res) => {
  try {
    if (!fs.existsSync(STATUS_FILE)) {
      return res.json({
        timestamp: new Date().toISOString(),
        overall_status: 'unknown',
        issues_count: 0,
        checks_total: 9,
        checks_passed: 0,
        checks_failed: 0,
        checks: [],
        message: 'SLA monitor has not run yet. Status file not found.',
      });
    }

    const data = fs.readFileSync(STATUS_FILE, 'utf-8');
    const status = JSON.parse(data);

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.json(status);
  } catch (error) {
    console.error('[SLA API] Error:', error);
    return res.status(500).json({
      error: 'Failed to read SLA status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;