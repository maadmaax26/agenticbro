/**
 * API Route: GET /api/scan/[job_id]
 * Check the status of a scan job
 * 
 * Params: job_id (UUID)
 * Response: { id, status, result, error, created_at, completed_at }
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: Request,
  { params }: { params: { job_id: string } }
) {
  try {
    const { job_id } = params;
    
    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id required' },
        { status: 400 }
      );
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(job_id)) {
      return NextResponse.json(
        { error: 'invalid job_id format' },
        { status: 400 }
      );
    }
    
    const { data: job, error } = await supabase
      .from('scan_jobs')
      .select('id, status, scan_type, payload, result, error, created_at, started_at, completed_at, retry_count')
      .eq('id', job_id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'job not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(job);
    
  } catch (error) {
    console.error('Get job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Allow DELETE to cancel a pending job
export async function DELETE(
  request: Request,
  { params }: { params: { job_id: string } }
) {
  try {
    const { job_id } = params;
    
    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id required' },
        { status: 400 }
      );
    }
    
    // Only allow cancellation of pending jobs
    const { data: job, error: fetchError } = await supabase
      .from('scan_jobs')
      .select('id, status')
      .eq('id', job_id)
      .single();
    
    if (fetchError || !job) {
      return NextResponse.json(
        { error: 'job not found' },
        { status: 404 }
      );
    }
    
    if (job.status !== 'pending') {
      return NextResponse.json(
        { error: 'can only cancel pending jobs' },
        { status: 400 }
      );
    }
    
    const { error: deleteError } = await supabase
      .from('scan_jobs')
      .delete()
      .eq('id', job_id);
    
    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, message: 'job cancelled' });
    
  } catch (error) {
    console.error('Cancel job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}