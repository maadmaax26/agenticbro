import { SupabaseClient } from '@supabase/supabase-js';
import { searchShopify } from './shopify-crawler';
import { searchEtsy } from './etsy-crawler';
import { compareImages } from './visual-comparator';

export interface MarketplaceScanOptions {
  brandId: string;
  userId?: string;
  brandName: string;
  brandWebsite: string;
  keywords?: string[];
  platforms?: ('shopify' | 'etsy')[];
}

export async function runMarketplaceScan(
  options: MarketplaceScanOptions,
  supabase: SupabaseClient
): Promise<string> { // returns scan job ID

  const platforms = options.platforms || ['shopify', 'etsy'];
  const keywords = options.keywords || [];

  // Load brand's visual fingerprints
  const { data: fingerprints } = await supabase
    .from('brand_visual_fingerprints')
    .select('image_url, phash')
    .eq('brand_id', options.brandId);

  for (const platform of platforms) {
    const candidates = platform === 'shopify'
      ? await searchShopify(options.brandName, keywords)
      : await searchEtsy(options.brandName, keywords);

    for (const candidate of candidates) {
      // Text-based scoring
      let score = 0;
      const matchTypes: string[] = [];

      // Store name similarity (simple contains check — enhance with fuzzy matching later)
      const nameLower = (candidate.name || '').toLowerCase();
      const brandLower = options.brandName.toLowerCase();
      if (nameLower.includes(brandLower) || brandLower.includes(nameLower)) {
        score += 35;
        matchTypes.push('store_name');
      }

      // Product name matches
      const productMatches = candidate.productNames.filter(p =>
        p.toLowerCase().includes(brandLower)
      ).length;
      if (productMatches > 0) {
        score += Math.min(productMatches * 8, 25);
        matchTypes.push('product_name');
      }

      // Visual fingerprint matching
      let imageMatches: any[] = [];
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
      if (score < 20) continue; // skip low-confidence results

      const riskLevel = score >= 70 ? 'critical' : score >= 50 ? 'high' : score >= 30 ? 'medium' : 'low';

      // Save to database
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
            imageMatches: imageMatches.slice(0, 10), // cap stored evidence
            productMatches: candidate.productNames.filter(p =>
              p.toLowerCase().includes(brandLower)
            ),
          },
        })
        .select('id')
        .single();

      if (result) {
        // Save visual match evidence separately
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

  return `scan-${Date.now()}`;
}