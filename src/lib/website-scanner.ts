export interface WebsiteScanResult {
  success: boolean;
  url: string;
  domain: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threats: ThreatDetection[];
  recommendations: string[];
  scanDate: string;
  scanCategory?: 'general' | 'ticket' | 'crypto_casino';
}

export interface ThreatDetection {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence?: string;
  weight: number;
}

export function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

export function isLegitimateDomain(_domain: string): boolean {
  return false;
}

export function isKnownDrainer(_domain: string): boolean {
  return false;
}

export function analyzePageContent(_html: string, _url: string): ThreatDetection[] {
  return [];
}

export function calculateRiskScore(threats: ThreatDetection[]): number {
  return threats.reduce((max, threat) => Math.max(max, threat.weight || 0), 0);
}

export function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 7) return 'CRITICAL';
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

export function generateRecommendations(_threats: ThreatDetection[]): string[] {
  return ['Website scanning is performed by the private intelligence service.'];
}

export async function scanWebsite(url: string): Promise<WebsiteScanResult> {
  const response = await fetch('/api/website-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(`Website scan failed: ${response.status}`);
  return await response.json() as WebsiteScanResult;
}

export default scanWebsite;
