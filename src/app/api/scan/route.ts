/**
 * API Route: POST /api/scan
 * Submit a scan job to the durable queue
 * 
 * Body: { address?: string, username?: string, platform?: string, scan_type?: 'token' | 'wallet' | 'profile', options?: { priority?: number, deepScan?: boolean, chain?: string } }
 * Response: { job_id: string, status: 'queued' }
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use service role key (never anon key) in server-side routes
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate input
    const { 
      address, 
      username, 
      platform, 
      scan_type = 'token', 
      options = {} 
    } = body;
    
    if (!address && !username) {
      return NextResponse.json(
        { error: 'address or username required' },
        { status: 400 }
      );
    }
    
    // Validate scan_type
    const validTypes = ['token', 'wallet', 'profile'];
    if (!validTypes.includes(scan_type)) {
      return NextResponse.json(
        { error: `scan_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Build payload
    const payload: Record<string, unknown> = {
      address: address || null,
      username: username || null,
      platform: platform || 'solana',
      options: {
        priority: options.priority ?? 5,
        deepScan: options.deepScan ?? false,
        chain: options.chain ?? 'solana',
      },
    };
    
    // Insert job
    const { data: job, error } = await supabase
      .from('scan_jobs')
      .insert({
        scan_type,
        payload,
        status: 'pending',
        priority: options.priority ?? 5,
      })
      .select('id, status, created_at')
      .single();
    
    if (error) {
      console.error('Failed to insert scan job:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      job_id: job.id,
      status: 'queued',
      created_at: job.created_at,
    });
    
  } catch (error) {
    console.error('Scan submission error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Allow GET to list recent jobs (optional)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = searchParams.get('status');
    
    let query = supabase
      .from('scan_jobs')
      .select('id, status, scan_type, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: jobs, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ jobs });
    
  } catch (error) {
    console.error('List jobs error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}