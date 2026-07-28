/**
 * Website Scan API Routes (Express backend on Mac Studio)
 * 
 * Handles private intel requests from the Vercel frontend:
 *   POST /v1/website/scan  — Run full website scan including JS detonation
 *
 * Integration:
 *   1. Submits a url_scan job to Supabase scan_jobs queue
 *   2. Polls for completion (up to 60s)
 *   3. Returns combined result with JS detonation findings
 *   4. Also chains: profile scans with website field auto-trigger this
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const router = Router();

// ── Supabase client (lazy) ────────────────────────────────────────────────────

let _supabase: any = null;

function getSupabase() {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

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

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

// ── JS Detonation via Supabase queue ─────────────────────────────────────────

async function submitUrlScanJob(url: string, timeout: number = 30): Promise<string | null> {
  // Submit a URL scan job to the Supabase queue and return the job ID.
  const sb = getSupabase();
  if (!sb) return null;

  const jobId = crypto.randomUUID();
  try {
    await sb.from('scan_jobs').insert({
      id: jobId,
      scan_type: 'url_scan',
      payload: { url, timeout },
      status: 'pending',
      priority: 5,
    }).execute();
    return jobId;
  } catch (err) {
    console.error('[website-scan] Failed to submit URL scan job:', err);
    return null;
  }
}

async function pollUrlScanResult(jobId: string, maxWaitMs: number = 60000): Promise<any | null> {
  // Poll for URL scan job completion. Returns the result or null on timeout.
  const sb = getSupabase();
  if (!sb) return null;

  const startTime = Date.now();
  const pollInterval = 3000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const { data, error } = await sb.from('scan_jobs')
        .select('status,result')
        .eq('id', jobId)
        .single();

      if (error || !data) {
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }

      if (data.status === 'completed' && data.result) {
        return data.result;
      }

      if (data.status === 'failed') {
        return { error: data.result?.error || 'Scan failed' };
      }

      // Still pending/running
      await new Promise(r => setTimeout(r, pollInterval));
    } catch (err) {
      await new Promise(r => setTimeout(r, pollInterval));
    }
  }

  return null; // Timeout
}

// ── POST /v1/website/scan ────────────────────────────────────────────────────

router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { url, timeout, includeJsDetonation } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'url is required' },
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
        error: { code: 'INVALID_URL', message: 'A valid HTTP(S) URL is required' },
      });
    }

    const domain = extractDomain(normalizedUrl);
    const scanTimeout = Math.min(Math.max(parseInt(timeout) || 30, 5), 60);
    const doJsDetonation = includeJsDetonation !== false; // Default: true

    // Submit JS detonation scan to queue
    let jsDetonationResult: any = null;
    let jsDetonationJobId: string | null = null;

    if (doJsDetonation) {
      jsDetonationJobId = await submitUrlScanJob(normalizedUrl, scanTimeout);
    }

    // Wait for JS detonation result (up to 60s)
    if (jsDetonationJobId) {
      jsDetonationResult = await pollUrlScanResult(jsDetonationJobId, 60000);
    }

    // Build combined result
    const result: any = {
      success: true,
      url: normalizedUrl,
      domain,
      scanDate: new Date().toISOString(),
      scanCategory: 'general',
    };

    // JS Detonation results
    if (jsDetonationResult && !jsDetonationResult.error) {
      result.jsDetonation = {
        riskScore: jsDetonationResult.risk_score || 0,
        riskLevel: jsDetonationResult.risk_level || 'UNKNOWN',
        verdict: jsDetonationResult.verdict || '',
        findings: jsDetonationResult.findings || [],
        findingCount: jsDetonationResult.finding_count || 0,
        networkSummary: jsDetonationResult.network_summary || {},
        scriptsAnalyzed: jsDetonationResult.scripts_analyzed || 0,
        scanId: jsDetonationResult.scan_id,
      };

      // Merge JS detonation risk into overall score
      // JS detonation uses 0-100 scale, website scan uses 0-10 scale
      // Convert JS detonation to a threat weight (0-10)
      const jsThreatWeight = Math.min(Math.floor((jsDetonationResult.risk_score || 0) / 10), 10);

      result.threats = [
        ...(result.threats || []),
        ...((jsDetonationResult.findings || []).map((f: any) => ({
          type: f.flag || 'js_threat',
          severity: f.weight >= 15 ? 'HIGH' : f.weight >= 8 ? 'MEDIUM' : 'LOW',
          description: f.description,
          weight: Math.min(f.weight / 5, 10),
          source: 'js_detonation',
        }))),
      ];

      // If JS detonation found critical threats, elevate overall risk
      if ((jsDetonationResult.risk_score || 0) >= 40) {
        result.threats.push({
          type: 'js_detonation_critical',
          severity: 'CRITICAL',
          description: `JS Detonation: ${jsDetonationResult.verdict}`,
          weight: 8,
          source: 'js_detonation',
        });
      }
    } else if (jsDetonationResult?.error) {
      result.jsDetonation = { error: jsDetonationResult.error };
    } else if (jsDetonationJobId) {
      result.jsDetonation = { status: 'timeout', message: 'JS detonation scan timed out' };
    }

    // Calculate combined risk score
    const threats: any[] = result.threats || [];
    result.riskScore = threats.reduce((max, t) => Math.max(max, t.weight || 0), 0);
    result.riskLevel = result.riskScore >= 7 ? 'CRITICAL'
      : result.riskScore >= 5 ? 'HIGH'
      : result.riskScore >= 3 ? 'MEDIUM'
      : 'LOW';

    result.recommendations = generateRecommendations(result.riskLevel, jsDetonationResult);

    return res.json(result);

  } catch (error: any) {
    console.error('Website scan error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SCAN_ERROR',
        message: 'Failed to scan website',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    });
  }
});

// ── POST /v1/website/scan/queue — Async submission (no wait) ─────────────────

router.post('/scan/queue', async (req: Request, res: Response) => {
  try {
    const { url, timeout } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'url is required' },
      });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    if (!isValidUrl(normalizedUrl)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_URL', message: 'A valid HTTP(S) URL is required' },
      });
    }

    const scanTimeout = Math.min(Math.max(parseInt(timeout) || 30, 5), 60);
    const jobId = await submitUrlScanJob(normalizedUrl, scanTimeout);

    if (!jobId) {
      return res.status(503).json({
        success: false,
        error: { code: 'QUEUE_ERROR', message: 'Failed to submit scan job' },
      });
    }

    return res.json({
      success: true,
      job_id: jobId,
      status: 'pending',
      url: normalizedUrl,
      poll_url: `/api/v1/scan/url/${jobId}`,
    });

  } catch (error: any) {
    console.error('Website queue error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
});

// ── GET /v1/website/scan/:jobId — Poll for async result ──────────────────────

router.get('/scan/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_JOB_ID', message: 'Valid job ID required' },
      });
    }

    const sb = getSupabase();
    if (!sb) {
      return res.status(503).json({
        success: false,
        error: { code: 'BACKEND_UNAVAILABLE', message: 'Backend not configured' },
      });
    }

    const { data, error } = await sb.from('scan_jobs')
      .select('id,status,result,created_at,started_at,completed_at')
      .eq('id', jobId)
      .eq('scan_type', 'url_scan')
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Scan job not found' },
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
      const sr = data.result;
      result.url = sr.url;
      result.domain = sr.domain;
      result.riskScore = sr.risk_score;
      result.riskLevel = sr.risk_level;
      result.verdict = sr.verdict;
      result.findings = sr.findings || [];
      result.findingCount = sr.finding_count || 0;
      result.networkSummary = sr.network_summary || {};
      result.scriptsAnalyzed = sr.scripts_analyzed || 0;
      result.scanDate = sr.scan_date;
      result.disclaimer = 'This scan is for educational purposes only. Not a guarantee of safety. Always DYOR.';
    } else if (data.status === 'failed') {
      result.error = data.result?.error || 'Scan failed';
    }

    return res.json(result);

  } catch (error: any) {
    console.error('Job status error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
});

// ── Recommendations ───────────────────────────────────────────────────────────

function generateRecommendations(riskLevel: string, jsResult: any): string[] {
  const recs: string[] = [];

  if (riskLevel === 'CRITICAL') {
    recs.push('🛑 Do not interact with this website. Active malicious JavaScript detected.');
    recs.push('Do not connect your wallet or sign any transactions on this site.');
    recs.push('If you already visited, clear your browser cache and disconnect any wallet connections.');
  } else if (riskLevel === 'HIGH') {
    recs.push('⚠️ Exercise extreme caution. Suspicious JavaScript activity detected.');
    recs.push('Do not connect your wallet or enter sensitive information.');
    recs.push('Use a hardware wallet with a separate browsing profile if you must interact.');
  } else if (riskLevel === 'MEDIUM') {
    recs.push('⚡ Some suspicious indicators found. Verify the site is legitimate before proceeding.');
    recs.push('Check for official links from verified social media accounts.');
  } else {
    recs.push('✅ No significant threats detected. Always verify URLs before connecting your wallet.');
  }

  if (jsResult) {
    const findings = jsResult.findings || [];
    if (findings.some((f: any) => f.flag === 'wallet_injection' || f.flag === 'wallet_drain_attempt')) {
      recs.push('🔐 Wallet drain patterns detected — do NOT connect any wallet to this site.');
    }
    if (findings.some((f: any) => f.flag === 'clipboard_hijack')) {
      recs.push('📋 Clipboard hijacking detected — copy-paste addresses manually, never via clipboard.');
    }
    if (findings.some((f: any) => f.flag === 'wasm_compilation' || f.flag === 'wasm_module_creation')) {
      recs.push('🦠 WebAssembly malware detected — this site builds code in browser memory to evade detection.');
    }
  }

  recs.push('Verify trust before you act. Scan at agenticbro.app');
  return recs;
}

export default router;