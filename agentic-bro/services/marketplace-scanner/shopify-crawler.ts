import { sleep } from '../../utils/sleep';
import { headlessBrowser, HeadlessBrowserFetcher } from './headless-browser';

export interface CandidateStore {
  url: string;
  name?: string;
  platform: 'shopify';
  imageUrls: string[];
  productNames: string[];
  description?: string;
}

// Generate typosquat variants of a brand name for Shopify subdomains
function generateShopifyVariants(brandName: string): string[] {
  const base = brandName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return [
    `${base}-official`,
    `${base}-store`,
    `${base}-shop`,
    `official-${base}`,
    `${base}-uk`,
    `${base}-us`,
    `${base}-online`,
    `real-${base}`,
    `${base}shop`,
    `${base}store`,
  ].map(v => `https://${v}.myshopify.com`);
}

// Extract store data using simple HTTP fetch (fallback)
async function fetchStoreDataSimple(storeUrl: string): Promise<CandidateStore | null> {
  try {
    const response = await fetch(storeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrandGuard/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;

    const html = await response.text();

    // Extract store name from title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const name = titleMatch?.[1]?.split('–')[0]?.trim();

    // Extract image URLs from og:image and product images
    const imageUrls: string[] = [];
    const imgRegex = /https?:\/\/cdn\.shopify\.com\/s\/files\/[^\s"']+\.(jpg|jpeg|png|webp)/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      if (!imageUrls.includes(match[0])) imageUrls.push(match[0]);
      if (imageUrls.length >= 50) break;
    }

    // Extract product names from H2
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

// Extract store data using headless browser (full rendering)
async function fetchStoreDataHeadless(storeUrl: string, browser: HeadlessBrowserFetcher): Promise<CandidateStore | null> {
  try {
    const data = await browser.extractStoreData(storeUrl);
    if (!data) return null;

    return {
      url: storeUrl,
      name: data.name,
      platform: 'shopify',
      imageUrls: data.imageUrls.slice(0, 50),
      productNames: data.productNames,
      description: data.description,
    };
  } catch {
    return null;
  }
}

export async function searchShopify(
  brandName: string,
  _keywords: string[]
): Promise<CandidateStore[]> {
  const candidates: CandidateStore[] = [];
  const variants = generateShopifyVariants(brandName);

  // Check if headless browser is available
  const useHeadless = await headlessBrowser.isAvailable();
  console.log(`[Shopify] Searching ${variants.length} variants for "${brandName}" (headless: ${useHeadless})`);

  for (const variantUrl of variants) {
    await sleep(useHeadless ? 1000 : 500); // slower with headless to avoid overwhelming Chrome

    const store = useHeadless
      ? await fetchStoreDataHeadless(variantUrl, headlessBrowser)
      : await fetchStoreDataSimple(variantUrl);

    if (store) {
      candidates.push(store);
    }
  }

  return candidates;
}