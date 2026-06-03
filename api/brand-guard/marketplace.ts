/**
 * api/brand-guard/marketplace.ts — Marketplace Scanner (Shopify + Etsy)
 * ========================================================================
 * Scans Shopify and Etsy for brand impersonation using visual fingerprinting.
 *
 * POST /api/brand-guard/marketplace/scan
 *   Body: { brandId, userId, brandName, brandWebsite, keywords, platforms }
 *   Returns: { jobId, status }
 *
 * GET /api/brand-guard/marketplace/results/:brandId
 *   Returns: Scan results for a brand
 *
 * POST /api/brand-guard/marketplace/run-scheduled
 *   Cron-triggered scan for all active brands
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import https from 'https';
import http from 'http';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ── Visual Comparator (inline for Vercel serverless) ─────────────────────────

async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = imageUrl.startsWith('https') ? https : http;
    protocol.get(imageUrl, { timeout: 10000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImageBuffer(res.headers.location).then(resolve, reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function generatePHash(imageUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchImageBuffer(imageUrl);
    const { data } = await sharp(buffer)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = Array.from(data) as number[];
    const mean = pixels.reduce((a: number, b: number) => a + b, 0) / pixels.length;
    const bits = pixels.map((p: number) => p > mean ? '1' : '0').join('');

    let hex = '';
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}

function hammingDistance(hash1: string, hash2: string): number {
  const a = BigInt('0x' + hash1);
  const b = BigInt('0x' + hash2);
  let xor = a ^ b;
  let distance = 0;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}

interface VisualMatch {
  referenceUrl: string;
  candidateUrl: string;
  hammingDistance: number;
  similarityPct: number;
}

async function compareImages(
  candidateUrls: string[],
  brandFingerprints: Array<{ image_url: string; phash: string }>
): Promise<VisualMatch[]> {
  const matches: VisualMatch[] = [];
  const THRESHOLD = 10;

  for (const candidateUrl of candidateUrls.slice(0, 50)) {
    const candidateHash = await generatePHash(candidateUrl);
    if (!candidateHash) continue;

    for (const fp of brandFingerprints) {
      const distance = hammingDistance(candidateHash, fp.phash);
      if (distance <= THRESHOLD) {
        matches.push({
          referenceUrl: fp.image_url,
          candidateUrl,
          hammingDistance: distance,
          similarityPct: Math.round((1 - distance / 64) * 100),
        });
      }
    }
  }

  return matches;
}

// ── Shopify Crawler ──────────────────────────────────────────────────────────

function generateShopifyVariants(brandName: string): string[] {
  const base = brandName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return [
    `${base}-official`, `${base}-store`, `${base}-shop`,
    `official-${base}`, `${base}-uk`, `${base}-us`,
    `${base}-online`, `real-${base}`, `${base}shop`, `${base}store`,
  ].map(v => `https://${v}.myshopify.com`);
}

async function fetchShopifyStore(storeUrl: string): Promise<any> {
  try {
    const response = await fetch(storeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrandGuard/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const html = await response.text();

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const name = titleMatch?.[1]?.split('–')[0]?.trim();

    const imageUrls: string[] = [];
    const imgRegex = /https?:\/\/cdn\.shopify\.com\/s\/files\/[^\s"']+\.(jpg|jpeg|png|webp)/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      if (!imageUrls.includes(match[0])) imageUrls.push(match[0]);
      if (imageUrls.length >= 50) break;
    }

    const productNames: string[] = [];
    const h2Regex = /<h2[^>]*>([^<]+)<\/h2>/gi;
    while ((match = h2Regex.exec(html)) !== null) {
      const text = match[1].trim();
      if (text.length > 3 && text.length < 100) productNames.push(text);
    }

    return { url: storeUrl, name, platform: 'shopify', imageUrls, productNames };
  } catch {
    return null;
  }
}

async function searchShopify(brandName: string): Promise<any[]> {
  const candidates: any[] = [];
  const variants = generateShopifyVariants(brandName);

  for (const variantUrl of variants) {
    await new Promise(r => setTimeout(r, 500));
    const store = await fetchShopifyStore(variantUrl);
    if (store) candidates.push(store);
  }

  return candidates;
}

// ── Etsy Crawler ──────────────────────────────────────────────────────────────

async function searchEtsy(brandName: string): Promise<any[]> {
  const candidates: any[] = [];
  const searchQuery = encodeURIComponent(brandName);
  const searchUrl = `https://www.etsy.com/search/shops?q=${searchQuery}`;

  try {
    await new Promise(r => setTimeout(r, 500));
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return candidates;
    const html = await response.text();

    const shopUrlRegex = /https:\/\/www\.etsy\.com\/shop\/([a-zA-Z0-9]+)/g;
    const shopUrls = new Set<string>();
    let match;
    while ((match = shopUrlRegex.exec(html)) !== null) {
      shopUrls.add(`https://www.etsy.com/shop/${match[1]}`);
    }

    for (const shopUrl of Array.from(shopUrls).slice(0, 10)) {
      await new Promise(r => setTimeout(r, 800));
      try {
        const shopResponse = await fetch(shopUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
          signal: AbortSignal.timeout(8000),
        });
        if (!shopResponse.ok) continue;

        const shopHtml = await shopResponse.text();
        const titleMatch = shopHtml.match(/<title>([^<]+)<\/title>/i);
        const shopName = titleMatch?.[1]?.split('|')[0]?.trim();

        const imageUrls: string[] = [];
        const imgRegex = /https:\/\/i\.etsystatic\.com\/[^\s"']+\.(jpg|jpeg|png)/gi;
        while ((match = imgRegex.exec(shopHtml)) !== null) {
          if (!imageUrls.includes(match[0])) imageUrls.push(match[0]);
          if (imageUrls.length >= 30) break;
        }

        const productNames: string[] = [];
        const h3Regex = /<h3[^>]*>([^<]{3,80})<\/h3>/gi;
        while ((match = h3Regex.exec(shopHtml)) !== null) {
          productNames.push(match[1].trim());
        }

        candidates.push({ url: shopUrl, name: shopName, platform: 'etsy', imageUrls, productNames });
      } catch { continue; }
    }
  } catch { /* Etsy search failed — return empty */ }

  return candidates;
}

// ── Marketplace Scan Orchestrator ────────────────────────────────────────────

async function runMarketplaceScan(options: {
  brandId: string; userId?: string; brandName: string; brandWebsite: string;
  keywords?: string[]; platforms?: ('shopify' | 'etsy')[];
}) {
  if (!supabase) return;

  const platforms = options.platforms || ['shopify', 'etsy'];

  const { data: fingerprints } = await supabase
    .from('brand_visual_fingerprints')
    .select('image_url, phash')
    .eq('brand_id', options.brandId);

  for (const platform of platforms) {
    const candidates = platform === 'shopify'
      ? await searchShopify(options.brandName)
      : await searchEtsy(options.brandName);

    for (const candidate of candidates) {
      let score = 0;
      const matchTypes: string[] = [];

      const nameLower = (candidate.name || '').toLowerCase();
      const brandLower = options.brandName.toLowerCase();
      if (nameLower.includes(brandLower) || brandLower.includes(nameLower)) {
        score += 35;
        matchTypes.push('store_name');
      }

      const productMatches = candidate.productNames.filter((p: string) =>
        p.toLowerCase().includes(brandLower)
      ).length;
      if (productMatches > 0) {
        score += Math.min(productMatches * 8, 25);
        matchTypes.push('product_name');
      }

      let imageMatches: VisualMatch[] = [];
      if (fingerprints && fingerprints.length > 0 && candidate.imageUrls.length > 0) {
        imageMatches = await compareImages(candidate.imageUrls, fingerprints);
        if (imageMatches.length > 0) {
          const nearIdentical = imageMatches.filter(m => m.hammingDistance <= 5).length;
          score += nearIdentical * 40;
          score += (imageMatches.length - nearIdentical) * 15;
          matchTypes.push('image_hash');
        }
      }

      score = Math.min(score, 100);
      if (score < 20) continue;

      const riskLevel = score >= 70 ? 'critical' : score >= 50 ? 'high' : score >= 30 ? 'medium' : 'low';

      const { data: result } = await supabase
        .from('marketplace_scan_results')
        .insert({
          user_id: options.userId || null,
          brand_id: options.brandId,
          platform,
          store_url: candidate.url,
          store_name: candidate.name,
          risk_score: score,
          risk_level: riskLevel,
          match_types: matchTypes,
          evidence: {
            imageMatches: imageMatches.slice(0, 10),
            productMatches: candidate.productNames.filter((p: string) =>
              p.toLowerCase().includes(brandLower)
            ),
          },
        })
        .select('id')
        .single();

      if (result) {
        for (const match of imageMatches.slice(0, 20)) {
          await supabase.from('visual_match_evidence').insert({
            scan_result_id: result.id,
            reference_url: match.referenceUrl,
            candidate_url: match.candidateUrl,
            hamming_distance: match.hammingDistance,
            similarity_pct: match.similarityPct,
          });
        }
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (!supabase) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database not configured' }));
  }

  const url = req.url || '/';
  const parts = url.split('?')[0].split('/').filter(Boolean);
  const hasRunScheduled = parts.includes('run-scheduled');
  const hasResults = parts.includes('results');

  try {
    // POST /scan (default POST action)
    if (req.method === 'POST' && !hasRunScheduled) {
      const { brandId, userId, brandName, brandWebsite, keywords, platforms } = await parseBody(req);
      if (!brandId || !brandName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing brandId or brandName' }));
      }

      const jobId = `job-${Date.now()}`;

      // Fire-and-forget the scan
      runMarketplaceScan({
        brandId, userId, brandName, brandWebsite: brandWebsite || '', keywords, platforms,
      }).catch(err => console.error('[Marketplace] Scan error:', err));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ jobId, status: 'running', message: 'Scan started. Poll for results.' }));
    }

    // POST /run-scheduled
    if (req.method === 'POST' && hasRunScheduled) {
      const { data: brands } = await supabase
        .from('brand_guard_brands')
        .select('id, user_id, name, website')
        .eq('subscription_active', true);

      if (!brands || brands.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: 'No active brands' }));
      }

      for (const brand of brands) {
        runMarketplaceScan({
          brandId: brand.id,
          userId: brand.user_id,
          brandName: brand.name,
          brandWebsite: brand.website,
        }).catch(console.error);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: `Scheduled scan started for ${brands.length} brands` }));
    }

    // GET /results/:brandId
    if (req.method === 'GET' && hasResults && parts.length >= 5) {
      const brandId = parts[4]; // /api/brand-guard/marketplace/results/:brandId
      const { data, error } = await supabase
        .from('marketplace_scan_results')
        .select('*, visual_match_evidence(*)')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: error.message }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(data || []));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));

  } catch (err: any) {
    console.error('[Marketplace] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || 'Internal error' }));
  }
}

export const config = {
  maxDuration: 60,
};