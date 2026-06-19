/**
 * api/brand-guard/fingerprint.ts — Brand Visual Fingerprint Registration
 * ========================================================================
 * Registers perceptual hashes of brand images for marketplace matching.
 *
 * POST /api/brand-guard/fingerprint/register
 *   Body: { brandId, userId, images: [{ url, type }] }
 *   Returns: { registered, failed }
 *
 * POST /api/brand-guard/fingerprint/auto-discover
 *   Body: { brandId, userId, websiteUrl }
 *   Returns: { discovered, registered }
 *
 * GET /api/brand-guard/fingerprint/:brandId
 *   Returns: List of fingerprints for a brand
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import https from 'https';
import http from 'http';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ── Vercel type shim ─────────────────────────────────────────────────────────
type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getAuthenticatedUserId(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// ── SSRF guard ────────────────────────────────────────────────────────────────
// Blocks requests to loopback, link-local, and private IP ranges (e.g. AWS metadata).
function isSafeUrl(rawUrl: string): boolean {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return false; }
  if (!['https:', 'http:'].includes(parsed.protocol)) return false;
  const h = parsed.hostname.toLowerCase();
  if (h === 'localhost' || h === '::1') return false;
  if (/^127\./.test(h)) return false;          // loopback
  if (/^169\.254\./.test(h)) return false;     // link-local / AWS + GCP metadata
  if (/^10\./.test(h)) return false;           // RFC-1918 Class A
  if (/^192\.168\./.test(h)) return false;     // RFC-1918 Class C
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;  // RFC-1918 Class B
  if (/^fc00:/i.test(h) || /^fe80:/i.test(h)) return false; // IPv6 ULA / link-local
  return true;
}

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseBody(req: VercelRequest): Promise<any> {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!supabase) {
    res.status(500).json({ error: 'Database not configured' });
    return;
  }

  // ── Auth check (required for all write operations) ─────────────────────────
  const authedUserId = await getAuthenticatedUserId(req);
  if (!authedUserId && req.method !== 'GET') {
    res.status(401).json({ error: 'Authentication required. Send Bearer token from Supabase Auth.' });
    return;
  }

  const url = req.url || '/';
  const parts = url.split('?')[0].split('/').filter(Boolean);
  // /api/brand-guard/fingerprint/register
  // /api/brand-guard/fingerprint/auto-discover
  // /api/brand-guard/fingerprint/:brandId
  const hasAutoDiscover = parts.includes('auto-discover');

  try {
    // POST /register (default POST when not auto-discover)
    if (req.method === 'POST' && !hasAutoDiscover) {
      const { brandId, images, imageUrl, imageType, label } = await parseBody(req);
      // Support single image or array
      const imageList = images?.length ? images : imageUrl ? [{ url: imageUrl, type: imageType || 'product', label }] : [];
      if (!brandId || !imageList.length) {
        res.status(400).json({ error: 'Missing brandId or images' });
        return;
      }

      // Verify authenticated user owns this brand
      const { data: brand, error: brandErr } = await supabase
        .from('brand_monitors')
        .select('id')
        .eq('id', brandId)
        .eq('owner_id', authedUserId)
        .maybeSingle();
      if (brandErr || !brand) {
        res.status(403).json({ error: 'Forbidden: brand not found or not owned by authenticated user' });
        return;
      }

      const results = { registered: 0, failed: 0 };

      for (const image of imageList.slice(0, 25)) {
        const hash = await generatePHash(image.url);
        if (!hash) { results.failed++; continue; }

        const { error } = await supabase.from('brand_visual_fingerprints').insert({
          brand_id: brandId,
          user_id: authedUserId,
          image_url: image.url,
          image_type: image.type || 'product',
          phash: hash,
        });

        if (error) { results.failed++; } else { results.registered++; }
      }

      res.status(200).json(results);
      return;
    }

    // POST /auto-discover
    if (req.method === 'POST' && hasAutoDiscover) {
      const { brandId, websiteUrl } = await parseBody(req);
      if (!brandId || !websiteUrl) {
        res.status(400).json({ error: 'Missing brandId or websiteUrl' });
        return;
      }

      // SSRF guard: reject private/loopback/link-local URLs before fetching
      if (!isSafeUrl(websiteUrl)) {
        res.status(400).json({ error: 'Invalid or disallowed websiteUrl. Must be a public https:// URL.' });
        return;
      }

      // Verify authenticated user owns this brand
      const { data: brand, error: brandErr } = await supabase
        .from('brand_monitors')
        .select('id')
        .eq('id', brandId)
        .eq('owner_id', authedUserId)
        .maybeSingle();
      if (brandErr || !brand) {
        res.status(403).json({ error: 'Forbidden: brand not found or not owned by authenticated user' });
        return;
      }

      const response = await fetch(websiteUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrandGuard/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      const html = await response.text();

      const imageUrls: string[] = [];
      const ogRegex = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/gi;
      const imgRegex = /<img[^>]+src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp))"/gi;
      let match;

      while ((match = ogRegex.exec(html)) !== null) imageUrls.push(match[1]);
      while ((match = imgRegex.exec(html)) !== null) {
        if (!imageUrls.includes(match[1])) imageUrls.push(match[1]);
        if (imageUrls.length >= 20) break;
      }

      let registered = 0;
      for (const imgUrl of imageUrls.slice(0, 20)) {
        const hash = await generatePHash(imgUrl);
        if (!hash) continue;
        const { error } = await supabase.from('brand_visual_fingerprints').insert({
          brand_id: brandId,
          user_id: authedUserId,
          image_url: imgUrl,
          image_type: registered === 0 ? 'logo' : 'product',
          phash: hash,
        });
        if (!error) registered++;
      }

      res.status(200).json({ discovered: imageUrls.length, registered, method: 'fetch' });
      return;
    }

    // GET /:brandId — list fingerprints
    if (req.method === 'GET' && parts.length >= 4 && !hasAutoDiscover) {
      const brandId = parts[3]; // /api/brand-guard/fingerprint/:brandId
      const { data, error } = await supabase
        .from('brand_visual_fingerprints')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json(data || []);
      return;
    }

    res.status(404).json({ error: 'Not found' });

  } catch (err: any) {
    console.error('[Fingerprint] Error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export const config = {
  maxDuration: 30,
};