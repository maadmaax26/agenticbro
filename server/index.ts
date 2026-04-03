/**
 * Express API Server for Agentic Bro
 * Handles scan job queue operations
 */

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Submit a scan job
app.post('/api/scan', async (req, res) => {
  try {
    const { address, username, platform = 'solana', scan_type = 'token', options = {} } = req.body;
    
    if (!address && !username) {
      return res.status(400).json({ error: 'address or username required' });
    }
    
    const validTypes = ['token', 'wallet', 'profile'];
    if (!validTypes.includes(scan_type)) {
      return res.status(400).json({ error: `scan_type must be one of: ${validTypes.join(', ')}` });
    }
    
    const payload = {
      address: address || null,
      username: username || null,
      platform,
      options: {
        priority: options.priority ?? 5,
        deepScan: options.deepScan ?? false,
        chain: options.chain ?? 'solana',
      },
    };
    
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
      return res.status(500).json({ error: error.message });
    }
    
    res.json({
      job_id: job.id,
      status: 'queued',
      created_at: job.created_at,
    });
    
  } catch (error) {
    console.error('Scan submission error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get job status
app.get('/api/scan/:job_id', async (req, res) => {
  try {
    const { job_id } = req.params;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(job_id)) {
      return res.status(400).json({ error: 'invalid job_id format' });
    }
    
    const { data: job, error } = await supabase
      .from('scan_jobs')
      .select('id, status, scan_type, payload, result, error, created_at, started_at, completed_at, retry_count')
      .eq('id', job_id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'job not found' });
      }
      return res.status(500).json({ error: error.message });
    }
    
    res.json(job);
    
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// List jobs
app.get('/api/scan', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || '10', 10);
    const status = req.query.status as string;
    
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
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ jobs });
    
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Cancel a pending job
app.delete('/api/scan/:job_id', async (req, res) => {
  try {
    const { job_id } = req.params;
    
    const { data: job, error: fetchError } = await supabase
      .from('scan_jobs')
      .select('id, status')
      .eq('id', job_id)
      .single();
    
    if (fetchError || !job) {
      return res.status(404).json({ error: 'job not found' });
    }
    
    if (job.status !== 'pending') {
      return res.status(400).json({ error: 'can only cancel pending jobs' });
    }
    
    const { error: deleteError } = await supabase
      .from('scan_jobs')
      .delete()
      .eq('id', job_id);
    
    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }
    
    res.json({ success: true, message: 'job cancelled' });
    
  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.listen(PORT, () => {
  console.log(`Agentic Bro API server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Submit scan: POST http://localhost:${PORT}/api/scan`);
});

export default app;