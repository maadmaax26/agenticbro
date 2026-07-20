import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { runMarketplaceScan } from '../../services/marketplace-scanner/index';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/brand-guard/marketplace/scan
router.post('/scan', async (req: Request, res: Response) => {
  const { brandId, userId, brandName, brandWebsite, keywords, platforms } = req.body;
  if (!brandId || !brandName) {
    return res.status(400).json({ error: 'Missing brandId or brandName' });
  }

  // Run scan asynchronously — return immediately with job ID
  const jobId = `job-${Date.now()}`;
  res.json({ jobId, status: 'running', message: 'Scan started. Poll for results.' });

  // Run scan in background (fire-and-forget for Express)
  runMarketplaceScan(
    { brandId, userId, brandName, brandWebsite, keywords, platforms },
    supabase
  ).catch(err => console.error('Marketplace scan error:', err));
});

// GET /api/brand-guard/marketplace/results/:brandId
router.get('/results/:brandId', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('marketplace_scan_results')
      .select('*, visual_match_evidence(*)')
      .eq('brand_id', req.params.brandId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/brand-guard/marketplace/run-scheduled (called by cron)
router.post('/run-scheduled', async (_req: Request, res: Response) => {
  try {
    const { data: brands } = await supabase
      .from('brand_guard_brands')
      .select('id, user_id, name, website')
      .eq('subscription_active', true);

    if (!brands || brands.length === 0) {
      return res.json({ message: 'No active brands' });
    }

    for (const brand of brands) {
      runMarketplaceScan({
        brandId: brand.id,
        userId: brand.user_id,
        brandName: brand.name,
        brandWebsite: brand.website,
      }, supabase).catch(console.error);
    }

    return res.json({ message: `Scheduled scan started for ${brands.length} brands` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;