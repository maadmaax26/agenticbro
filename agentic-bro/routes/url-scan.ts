/**
 * URL Scanner API Routes
 * 
 * REST API endpoints for JavaScript detonation URL scanning
 * Submits URL scan jobs to the Supabase queue (processed by url-scan-worker.py)
 * 
 * Endpoints:
 *   POST /api/v1/scan/url          — Submit a URL scan job
 *   GET  /api/v1/scan/url/:jobId   — Get URL scan job status/results
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

// ── Supabase client (lazy init) ───────────────────────────────────────────────

let _supabase: any = null;

function getSupabase() {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  const { createClient } = require('@supabase/supabase-js');
  _supabase = createClient(url, key);
  return _supabase;
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ── POST /api/v1/scan/url ─────────────────────────────────────────────────────

router.post('/url', async (req: Request, res: Response) => {
  try {
    const { url, timeout } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'url is required',
        },
      });
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    if (!isValidUrl(normalizedUrl)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'A valid HTTP(S) URL is required',
        },
      });
    }

    // Sanitize timeout
    const scanTimeout = Math.min(Math.max(parseInt(timeout) || 30, 5), 60);

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'BACKEND_UNAVAILABLE',
          message: 'Scan backend is not configured',
        },
      });
    }

    const jobId = crypto.randomUUID();

    // Submit to Supabase scan_jobs queue
    const { data, error } = await supabase
      .from('scan_jobs')
      .insert({
        id: jobId,
        scan_type: 'url_scan',
        payload: {
          url: normalizedUrl,
          timeout: scanTimeout,
        },
        status: 'pending',
        priority: 5,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to submit URL scan job:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'QUEUE_ERROR',
          message: 'Failed to submit scan job',
        },
      });
    }

    return res.json({
      success: true,
      job_id: jobId,
      status: 'pending',
      url: normalizedUrl,
      message: 'URL scan job submitted to queue',
      poll_url: `/api/v1/scan/url/${jobId}`,
    });

  } catch (err: any) {
    console.error('URL scan submit error:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }
});

// ── GET /api/v1/scan/url/:jobId ───────────────────────────────────────────────

router.get('/url/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JOB_ID',
          message: 'A valid job ID is required',
        },
      });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'BACKEND_UNAVAILABLE',
          message: 'Scan backend is not configured',
        },
      });
    }

    const { data, error } = await supabase
      .from('scan_jobs')
      .select('id,scan_type,status,result,created_at,started_at,completed_at,error')
      .eq('id', jobId)
      .eq('scan_type', 'url_scan')
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Scan job not found',
        },
      });
    }

    const result: any = {
      success: true,
      job_id: data.id,
      status: data.status,
      created_at: data.created_at,
      started_at: data.started_at,
      completed_at: data.completed_at,
    };

    if (data.status === 'completed' && data.result) {
      const scanResult = data.result;

      result.url = scanResult.url;
      result.domain = scanResult.domain;
      result.risk_score = scanResult.risk_score;
      result.risk_level = scanResult.risk_level;
      result.verdict = scanResult.verdict;
      result.findings = scanResult.findings || [];
      result.finding_count = scanResult.finding_count || 0;
      result.network_summary = scanResult.network_summary || {};
      result.scripts_analyzed = scanResult.scripts_analyzed || 0;
      result.scan_date = scanResult.scan_date;

      // Disclaimer
      result.disclaimer = 'This scan is for educational purposes only. Not a guarantee of safety. Always DYOR.';
    } else if (data.status === 'failed') {
      result.error = data.error || data.result?.error || 'Scan failed';
    }

    return res.json(result);

  } catch (err: any) {
    console.error('URL scan status error:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }
});

export default router;