/**
 * api/phone-verify.ts — Thin wrapper for Supabase Edge Function
 * 
 * This file acts as a public API route that calls the private
 * phone-verify Edge Function deployed on Supabase.
 * 
 * All proprietary scoring logic is in the Edge Function, not here.
 */

import { createClient } from '@supabase/supabase-js';

interface VercelRequest extends Request {
  body?: Record<string, unknown>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }
  
  const body = typeof req.body === 'object' ? req.body : await req.json?.();
  const phone = body?.phone as string;
  const useQueue = body?.useQueue === true;
  
  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ error: 'Missing required field: phone' });
    return;
  }
  
  // Basic validation
  const stripped = phone.replace(/[^0-9+]/g, '');
  if (stripped.length < 7 || stripped.length > 16) {
    res.status(400).json({ error: 'Invalid phone number format. Include country code, e.g. +1234567890' });
    return;
  }
  
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // If useQueue is true, create a job and return job ID
  if (useQueue) {
    const { data: job, error } = await supabase
      .from('scan_jobs')
      .insert({
        scan_type: 'phone_community',
        payload: { phone: stripped, sources: ['800notes', 'whocalledme'] },
        status: 'pending',
        priority: 5,
      })
      .select('id, status, created_at')
      .single();
    
    if (error) {
      res.status(500).json({ error: 'Failed to queue scan job' });
      return;
    }
    
    res.status(202).json({
      success: true,
      job_id: job.id,
      status: 'queued',
      poll_url: `/api/phone-scan/${job.id}`,
      message: 'CDP scan queued. Poll poll_url for results.',
    });
    return;
  }
  
  // Call the Supabase Edge Function
  const { data, error } = await supabase.functions.invoke('phone-verify', {
    body: { phone: stripped },
  });
  
  if (error) {
    console.error('[phone-verify] Edge function error:', error);
    res.status(500).json({ error: 'Phone verification failed', details: error.message });
    return;
  }
  
  res.status(200).json(data);
}

export const config = {
  maxDuration: 15,
};