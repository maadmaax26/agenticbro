import sharp from 'sharp';
import https from 'https';
import http from 'http';

// Fetch image from URL and return as Buffer
async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = imageUrl.startsWith('https') ? https : http;
    protocol.get(imageUrl, { timeout: 10000 }, (res) => {
      // Follow redirects
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

// Generate a 64-bit perceptual hash (pHash) as hex string
export async function generatePHash(imageUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchImageBuffer(imageUrl);
    const { data } = await sharp(buffer)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = Array.from(data);
    const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
    const bits = pixels.map(p => p > mean ? '1' : '0').join('');

    // Convert binary string to 16-char hex
    let hex = '';
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch {
    return null; // silently skip unfetchable images
  }
}

// Hamming distance between two hex hashes
export function hammingDistance(hash1: string, hash2: string): number {
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

export interface VisualMatch {
  referenceUrl: string;
  candidateUrl: string;
  hammingDistance: number;
  similarityPct: number;
}

// Compare a list of candidate image URLs against stored brand fingerprints
export async function compareImages(
  candidateUrls: string[],
  brandFingerprints: Array<{ image_url: string; phash: string }>
): Promise<VisualMatch[]> {
  const matches: VisualMatch[] = [];
  const THRESHOLD = 10; // Hamming distance ≤10 = potential match

  for (const candidateUrl of candidateUrls.slice(0, 50)) { // cap at 50 images per store
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