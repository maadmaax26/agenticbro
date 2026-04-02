/**
 * Scam Database Sync API Route
 * 
 * Manual trigger endpoint for syncing local CSV to Supabase
 */

import { Router, Request, Response } from 'express';
import { SupabaseScamDBSync } from '../services/supabase-scam-sync';

const router = Router();

// Supabase configuration from environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const CSV_PATH = process.env.SCAM_DB_CSV_PATH || '/Users/efinney/.openclaw/workspace/scammer-database.csv';

/**
 * POST /api/v1/sync/scam-db
 * 
 * Manually trigger a sync of the local CSV to Supabase
 */
router.post('/scam-db', async (req: Request, res: Response) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
      });
    }

    console.log('[Sync API] Starting sync to Supabase...');
    
    const sync = new SupabaseScamDBSync(
      { url: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_KEY },
      CSV_PATH
    );
    const result = await sync.sync();

    console.log('[Sync API] Sync complete:', result);

    return res.json({
      success: true,
      result: {
        timestamp: result.timestamp.toISOString(),
        added: result.added,
        updated: result.updated,
        unchanged: result.unchanged,
        totalRecords: result.totalRecords,
        errors: result.errors,
      },
    });

  } catch (error) {
    console.error('[Sync API] Sync failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/sync/status
 * 
 * Get sync status (last sync info)
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Supabase not configured',
      });
    }

    // Query Supabase for last sync info
    const response = await fetch(`${SUPABASE_URL}/rest/v1/known_scammers?select=updated_at&order=updated_at.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!response.ok) {
      return res.json({
        success: true,
        lastSync: null,
        message: 'No records found in database',
      });
    }

    const records = await response.json();
    
    if (records.length === 0) {
      return res.json({
        success: true,
        lastSync: null,
        message: 'No records in database',
      });
    }

    return res.json({
      success: true,
      lastSync: records[0].updated_at,
    });

  } catch (error) {
    console.error('[Sync API] Status check failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/sync/csv-stats
 * 
 * Get statistics about the local CSV file
 */
router.get('/csv-stats', async (req: Request, res: Response) => {
  try {
    const fs = await import('fs');
    const csv = await import('csv-parse/sync');

    if (!fs.existsSync(CSV_PATH)) {
      return res.status(404).json({
        success: false,
        error: 'CSV file not found',
      });
    }

    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = csv.parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as Record<string, string>[];

    // Count by section
    const sections = {
      legitimate: 0,
      suspicious: 0,
      highRisk: 0,
      resolved: 0,
    };

    let currentSection = 'unknown';
    for (const record of records) {
      const name = record['Scammer Name'] || '';
      if (name.includes('LEGITIMATE')) currentSection = 'legitimate';
      else if (name.includes('SUSPICIOUS')) currentSection = 'suspicious';
      else if (name.includes('HIGH RISK')) currentSection = 'highRisk';
      else if (name.includes('RESOLVED')) currentSection = 'resolved';
      else if (name && !name.startsWith('===')) {
        sections[currentSection as keyof typeof sections]++;
      }
    }

    return res.json({
      success: true,
      csvPath: CSV_PATH,
      totalRecords: records.filter((r) => r['Scammer Name'] && !r['Scammer Name'].startsWith('===')).length,
      sections,
      lastModified: fs.statSync(CSV_PATH).mtime,
    });

  } catch (error) {
    console.error('[Sync API] CSV stats failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;