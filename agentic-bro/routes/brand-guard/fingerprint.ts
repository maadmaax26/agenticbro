import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { generatePHash } from '../../services/marketplace-scanner/visual-comparator';
import { headlessBrowser } from '../../services/marketplace-scanner/headless-browser';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/brand-guard/fingerprint/register
// Body: { brandId, userId, images: [{ url, type }] } or { brandId, userId, imageUrl, imageType }
router.post('/register', async (req: Request, res: Response) => {
  const { brandId, userId, images, imageUrl, imageType } = req.body;

  // Support single image registration
  const imageList = images?.length ? images : imageUrl ? [{ url: imageUrl, type: imageType || 'product' }] : [];
  if (!brandId || !imageList.length) {
    return res.status(400).json({ error: 'Missing brandId or images' });
  }

  const results = { registered: 0, failed: 0 };

  for (const image of imageList.slice(0, 25)) { // cap at 25 images
    const hash = await generatePHash(image.url);
    if (!hash) { results.failed++; continue; }

    const { error } = await supabase.from('brand_visual_fingerprints').insert({
      brand_id: brandId,
      user_id: userId || null,
      image_url: image.url,
      image_type: image.type || 'product',
      phash: hash,
    });

    if (error) { results.failed++; } else { results.registered++; }
  }

  return res.json(results);
});

// POST /api/brand-guard/fingerprint/auto-discover
// Crawls brand website and auto-registers images
// Uses headless browser (CDP) when available, falls back to simple fetch
router.post('/auto-discover', async (req: Request, res: Response) => {
  const { brandId, userId, websiteUrl } = req.body;
  if (!brandId || !websiteUrl) {
    return res.status(400).json({ error: 'Missing brandId or websiteUrl' });
  }

  try {
    let imageUrls: string[] = [];
    let usedHeadless = false;

    // Try headless browser first (handles SPAs)
    const useHeadless = await headlessBrowser.isAvailable();
    if (useHeadless) {
      console.log('[Fingerprint] Using headless browser for:', websiteUrl);
      const extracted = await headlessBrowser.extractFingerprintImages(websiteUrl);
      if (extracted && extracted.images.length > 0) {
        // Prioritize OG image as logo
        if (extracted.ogImage) {
          imageUrls = [extracted.ogImage, ...extracted.images.filter(u => u !== extracted.ogImage)];
        } else {
          imageUrls = extracted.images;
        }
        usedHeadless = true;
      }
    }

    // Fallback to simple HTTP fetch
    if (imageUrls.length === 0) {
      console.log('[Fingerprint] Falling back to simple fetch for:', websiteUrl);
      const response = await fetch(websiteUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrandGuard/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      const html = await response.text();

      const ogRegex = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/gi;
      const imgRegex = /<img[^>]+src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp))"/gi;
      let match;

      while ((match = ogRegex.exec(html)) !== null) imageUrls.push(match[1]);
      while ((match = imgRegex.exec(html)) !== null) {
        if (!imageUrls.includes(match[1])) imageUrls.push(match[1]);
        if (imageUrls.length >= 20) break;
      }
    }

    // Auto-register discovered images
    let registered = 0;
    for (const url of imageUrls.slice(0, 20)) {
      const hash = await generatePHash(url);
      if (!hash) continue;
      const { error } = await supabase.from('brand_visual_fingerprints').insert({
        brand_id: brandId,
        user_id: userId || null,
        image_url: url,
        image_type: registered === 0 ? 'logo' : 'product',
        phash: hash,
      });
      if (!error) registered++;
    }

    return res.json({ discovered: imageUrls.length, registered, method: usedHeadless ? 'headless' : 'fetch' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/brand-guard/fingerprint/:brandId — list fingerprints for a brand
router.get('/:brandId', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('brand_visual_fingerprints')
      .select('*')
      .eq('brand_id', req.params.brandId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;