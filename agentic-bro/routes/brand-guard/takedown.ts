import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { generateTakedownReport, TakedownInput } from '../../services/takedown-generator/index';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/brand-guard/takedown/generate
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const input: TakedownInput = req.body;

    // Basic validation
    if (!input.platform || !input.brand || !input.user) {
      return res.status(400).json({ error: 'Missing required fields: platform, brand, user' });
    }
    // Ensure scanId has a value (generate UUID if not provided)
    if (!input.scanId) {
      input.scanId = crypto.randomUUID();
    }

    const report = await generateTakedownReport(input, supabase);
    return res.json(report);

  } catch (err: any) {
    console.error('Takedown generation error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/brand-guard/takedown/:reportId
router.get('/:reportId', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('brand_guard_reports')
      .select('*')
      .eq('id', req.params.reportId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Report not found' });
    return res.json(data);

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/brand-guard/takedown/scan/:scanId — get all reports for a scan
// NOTE: This route must be registered BEFORE /:reportId to avoid conflict
router.get('/scan/:scanId', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('brand_guard_reports')
      .select('*')
      .eq('scan_id', req.params.scanId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data || []);

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;