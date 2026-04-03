/**
 * useScanResult — React hook for real-time scan job status
 *
 * Usage:
 *   const [jobId, setJobId] = useState<string | null>(null)
 *   const { job, loading } = useScanResult(jobId)
 *
 *   // Submit a scan and store the job_id
 *   const handleScan = async (address: string) => {
 *     const res = await fetch('/api/scan', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ address, scan_type: 'token' }),
 *     })
 *     const { job_id } = await res.json()
 *     setJobId(job_id)   // hook starts listening immediately
 *   }
 *
 *   // job.status transitions: pending → claimed → running → completed/failed
 *   // job.result is populated when status === 'completed'
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type ScanStatus = 'pending' | 'claimed' | 'running' | 'completed' | 'failed' | 'timeout';

export interface ScanJob {
  id: string;
  status: ScanStatus;
  scan_type: string;
  result?: Record<string, unknown>;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  retry_count?: number;
}

export function useScanResult(jobId: string | null) {
  const [job, setJob] = useState<ScanJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      setFetchError(null);
      return;
    }

    if (!supabase) {
      setFetchError('Supabase not configured');
      return;
    }

    setLoading(true);
    setFetchError(null);

    // ── 1. Initial fetch ───────────────────────────────────────────────────
    supabase
      .from('scan_jobs')
      .select('id, status, scan_type, result, error, created_at, started_at, completed_at, retry_count')
      .eq('id', jobId)
      .single()
      .then(({ data, error: err }) => {
        if (err) {
          setFetchError(err.message);
        } else {
          setJob(data as ScanJob);
        }
        setLoading(false);
      });

    // ── 2. Realtime subscription — instant push when worker updates row ────
    const channel = supabase
      .channel(`scan-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scan_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          setJob(payload.new as ScanJob);
          setLoading(false);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  const isTerminal = job?.status === 'completed' || job?.status === 'failed' || job?.status === 'timeout';

  return {
    job,
    loading,
    error: fetchError,
    isComplete: job?.status === 'completed',
    isFailed: job?.status === 'failed' || job?.status === 'timeout',
    isRunning: !isTerminal && job !== null,
    result: job?.status === 'completed' ? job.result : null,
  };
}

// ── Helper: submit a scan job ─────────────────────────────────────────────────

export interface SubmitScanOptions {
  address?: string;
  username?: string;
  platform?: string;
  scan_type?: 'token' | 'wallet' | 'profile';
  priority?: number;
  deepScan?: boolean;
}

/**
 * Submit a scan job to the queue and return the job_id.
 * Pair with useScanResult(jobId) to get real-time status.
 */
export async function submitScan(opts: SubmitScanOptions): Promise<string> {
  const { address, username, platform, scan_type = 'token', priority = 5, deepScan = false } = opts;

  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      username,
      platform,
      scan_type,
      options: { priority, deepScan },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Scan submission failed (${res.status})`);
  }

  const { job_id } = await res.json();
  return job_id;
}
