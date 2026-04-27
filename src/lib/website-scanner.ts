/**
 * Website Security Scanner
 * 
 * Detects:
 * - Wallet drainer scripts
 * - Fake airdrop pages
 * - Phishing clones
 * - Seed phrase harvesting
 * - Private key theft attempts
 * - Malicious contract interactions
 */

export interface WebsiteScanResult {
  success: boolean;
  url: string;
  domain: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threats: ThreatDetection[];
  recommendations: string[];
  scanDate: string;
}

export interface ThreatDetection {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence?: string;
  weight: number;
}

// ─── Known Malicious Patterns ────────────────────────────────────────────────

const WALLET_DRAINER_SIGNATURES: Array<{ pattern: string; type: string; weight: number; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [
  // Common drainer script names
  { pattern: 'drainer', type: 'drainer_script', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'walletconnect-drain', type: 'drainer_script', weight: 25, severity: 'CRITICAL' },
  { pattern: 'sign drain', type: 'drainer_script', weight: 25, severity: 'CRITICAL' },
  { pattern: 'setApprovalForAll', type: 'approval_abuse', weight: 20, severity: 'HIGH' as const },
  { pattern: 'permit2', type: 'suspicious_permit', weight: 15, severity: 'HIGH' as const },
  
  // Seed phrase harvesting
  { pattern: 'seed phrase', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'recovery phrase', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' },
  { pattern: 'mnemonic', type: 'seed_harvesting', weight: 20, severity: 'CRITICAL' },
  { pattern: 'private key', type: 'key_harvesting', weight: 25, severity: 'CRITICAL' },
  { pattern: 'enter your seed', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' },
  { pattern: 'import wallet', type: 'wallet_import', weight: 15, severity: 'HIGH' as const },
  
  // Fake airdrop patterns
  { pattern: 'claim free', type: 'fake_airdrop', weight: 15, severity: 'HIGH' as const },
  { pattern: 'free airdrop', type: 'fake_airdrop', weight: 15, severity: 'HIGH' },
  { pattern: 'connect to claim', type: 'fake_airdrop', weight: 20, severity: 'CRITICAL' },
  { pattern: 'limited time claim', type: 'fake_airdrop', weight: 15, severity: 'HIGH' },
  { pattern: 'exclusive mint', type: 'fake_mint', weight: 15, severity: 'HIGH' },
  
  // Phishing indicators
  { pattern: 'verify your wallet', type: 'phishing', weight: 20, severity: 'CRITICAL' as const },
  { pattern: 'wallet verification', type: 'phishing', weight: 20, severity: 'CRITICAL' },
  { pattern: 'suspicious activity', type: 'phishing', weight: 15, severity: 'HIGH' as const },
  { pattern: 'your wallet will be', type: 'phishing', weight: 20, severity: 'CRITICAL' },
  { pattern: 'click to verify', type: 'phishing', weight: 15, severity: 'HIGH' as const },
  
  // Clone/impersonation patterns
  { pattern: 'official site', type: 'clone_site', weight: 10, severity: 'MEDIUM' as const },
  { pattern: 'legit', type: 'suspicious_claim', weight: 5, severity: 'MEDIUM' as const },
  { pattern: 'not a scam', type: 'suspicious_claim', weight: 10, severity: 'MEDIUM' as const },
  
  // Urgency tactics
  { pattern: 'act now', type: 'urgency', weight: 10, severity: 'MEDIUM' as const },
  { pattern: 'limited spots', type: 'urgency', weight: 10, severity: 'MEDIUM' },
  { pattern: 'expires in', type: 'urgency', weight: 10, severity: 'MEDIUM' },
  { pattern: 'hurry', type: 'urgency', weight: 5, severity: 'LOW' as const },
  
  // Malicious redirects
  { pattern: 'window.location.replace', type: 'redirect', weight: 5, severity: 'LOW' as const },
  { pattern: 'meta refresh', type: 'redirect', weight: 5, severity: 'LOW' as const },
];

const KNOWN_DRAINER_DOMAINS = [
  // Add known malicious domains here
  'wallet-connect.xyz',
  'walletconnect-validator.com',
  'nft-airdrop.io',
  'token-claim.xyz',
];

const LEGITIMATE_DOMAINS = [
  // Legitimate crypto domains (never flag as phishing)
  'phantom.app',
  'metamask.io',
  'uniswap.org',
  'jupiter.ag',
  'raydium.io',
  'pump.fun',
  'magiceden.io',
  'opensea.io',
  'dexscreener.com',
  'coingecko.com',
  'coinmarketcap.com',
];

// ─── Scanner Functions ──────────────────────────────────────────────────────

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function isLegitimateDomain(domain: string): boolean {
  return LEGITIMATE_DOMAINS.some(legit => 
    domain === legit || domain.endsWith('.' + legit)
  );
}

export function isKnownDrainer(domain: string): boolean {
  return KNOWN_DRAINER_DOMAINS.some(bad => 
    domain === bad || domain.endsWith('.' + bad)
  );
}

export function analyzePageContent(html: string, url: string): ThreatDetection[] {
  const threats: ThreatDetection[] = [];
  const lowerHtml = html.toLowerCase();
  const lowerUrl = url.toLowerCase();
  
  // Check each pattern
  for (const sig of WALLET_DRAINER_SIGNATURES) {
    if (lowerHtml.includes(sig.pattern) || lowerUrl.includes(sig.pattern)) {
      threats.push({
        type: sig.type,
        severity: sig.severity,
        description: getThreatDescription(sig.type),
        evidence: `Pattern found: "${sig.pattern}"`,
        weight: sig.weight,
      });
    }
  }
  
  // Check for obfuscated code
  if (lowerHtml.includes('eval(') || lowerHtml.includes('atob(') || lowerHtml.includes('fromcharcode')) {
    threats.push({
      type: 'obfuscated_code',
      severity: 'HIGH',
      description: 'Obfuscated JavaScript detected - often used to hide malicious code',
      weight: 15,
    });
  }
  
  // Check for external script loading
  const externalScripts = (html.match(/<script[^>]+src=/gi) || []).length;
  if (externalScripts > 10) {
    threats.push({
      type: 'excessive_scripts',
      severity: 'MEDIUM',
      description: 'Unusually high number of external scripts',
      evidence: `${externalScripts} external scripts found`,
      weight: 5,
    });
  }
  
  // Check for iframe injection
  if (lowerHtml.includes('<iframe')) {
    threats.push({
      type: 'iframe_present',
      severity: 'LOW',
      description: 'Hidden iframe detected - could be used for clickjacking',
      weight: 5,
    });
  }
  
  // Check for form submission to external domains
  if (lowerHtml.includes('form') && lowerHtml.includes('action=')) {
    const formActions = html.match(/action=["']([^"']+)["']/gi) || [];
    for (const action of formActions) {
      const url = action.match(/["']([^"']+)["']/)?.[1] || '';
      if (url.startsWith('http') && !url.includes(extractDomain(url))) {
        threats.push({
          type: 'external_form',
          severity: 'HIGH',
          description: 'Form submits data to external domain',
          evidence: `Form action: ${url}`,
          weight: 15,
        });
      }
    }
  }
  
  // Check for wallet connection buttons
  if (lowerHtml.includes('connect wallet') || lowerHtml.includes('connect to wallet')) {
    threats.push({
      type: 'wallet_connect',
      severity: 'MEDIUM',
      description: 'Wallet connection requested - verify the site is legitimate',
      weight: 10,
    });
  }
  
  return threats;
}

export function calculateRiskScore(threats: ThreatDetection[]): number {
  const totalWeight = threats.reduce((sum, t) => sum + t.weight, 0);
  // Max possible weight is ~150 (multiple critical threats)
  const normalizedScore = Math.min((totalWeight / 150) * 10, 10);
  return Math.round(normalizedScore * 10) / 10;
}

export function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 7) return 'CRITICAL';
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

function getThreatDescription(type: string): string {
  const descriptions: Record<string, string> = {
    drainer_script: 'Wallet drainer script detected - designed to steal all assets',
    seed_harvesting: 'Seed phrase harvesting detected - NEVER enter your seed phrase',
    key_harvesting: 'Private key theft attempt - NEVER share your private key',
    fake_airdrop: 'Fake airdrop scam - connects wallet and drains funds',
    fake_mint: 'Fake mint page - steals NFTs and tokens',
    phishing: 'Phishing attempt - tries to steal credentials or wallet access',
    clone_site: 'Possible clone/impersonation site',
    suspicious_claim: 'Suspicious legitimacy claims - legitimate sites don\'t need to say they\'re legit',
    urgency: 'Urgency tactics - trying to force quick decisions',
    redirect: 'Redirect detected - could lead to malicious site',
    obfuscated_code: 'Obfuscated code - hiding malicious functionality',
    wallet_connect: 'Wallet connection requested - verify site authenticity',
    external_form: 'Data sent to external server - potential data theft',
    approval_abuse: 'Token approval abuse - grants unlimited spending rights',
    suspicious_permit: 'Suspicious permit signature - may drain tokens',
  };
  return descriptions[type] || 'Suspicious activity detected';
}

export function generateRecommendations(threats: ThreatDetection[]): string[] {
  const recommendations: string[] = [];
  
  if (threats.some(t => t.type === 'seed_harvesting' || t.type === 'key_harvesting')) {
    recommendations.push('🚨 CRITICAL: This site asks for seed phrase/private key - NEVER share these');
    recommendations.push('🔐 Legitimate sites NEVER ask for your seed phrase');
    recommendations.push('❌ Close this site immediately and never return');
  }
  
  if (threats.some(t => t.type === 'drainer_script')) {
    recommendations.push('🚨 Wallet drainer detected - this site will steal all your assets');
    recommendations.push('❌ Do NOT connect your wallet under any circumstances');
  }
  
  if (threats.some(t => t.type === 'fake_airdrop' || t.type === 'fake_mint')) {
    recommendations.push('⚠️ Fake airdrop/mint scam detected');
    recommendations.push('🔍 Verify the official project website and social channels');
    recommendations.push('❌ Do not connect wallet or sign any transactions');
  }
  
  if (threats.some(t => t.type === 'phishing')) {
    recommendations.push('⚠️ Phishing site detected');
    recommendations.push('🔍 Check the URL carefully - compare to official site');
    recommendations.push('❌ Do not enter any credentials or connect wallet');
  }
  
  if (threats.some(t => t.type === 'clone_site')) {
    recommendations.push('⚠️ Possible clone site - verify URL matches official domain');
    recommendations.push('🔍 Check social media for official links');
  }
  
  if (threats.some(t => t.severity === 'MEDIUM')) {
    recommendations.push('⚠️ Exercise caution on this site');
    recommendations.push('🔍 Verify the site is legitimate before connecting wallet');
  }
  
  if (threats.length === 0) {
    recommendations.push('✅ No obvious threats detected');
    recommendations.push('🔍 Still verify the URL matches the official site');
    recommendations.push('🔐 Only connect wallet if you trust the site');
  }
  
  return [...new Set(recommendations)]; // Remove duplicates
}

// ─── Main Scan Function ─────────────────────────────────────────────────────

export async function scanWebsite(url: string): Promise<WebsiteScanResult> {
  const domain = extractDomain(url);
  const threats: ThreatDetection[] = [];
  
  // Check if legitimate domain
  if (isLegitimateDomain(domain)) {
    return {
      success: true,
      url,
      domain,
      riskScore: 0,
      riskLevel: 'LOW',
      threats: [],
      recommendations: ['✅ This is a known legitimate domain', '🔐 Still verify the URL is correct'],
      scanDate: new Date().toISOString(),
    };
  }
  
  // Check if known drainer
  if (isKnownDrainer(domain)) {
    return {
      success: true,
      url,
      domain,
      riskScore: 10,
      riskLevel: 'CRITICAL',
      threats: [{
        type: 'known_drainer',
        severity: 'CRITICAL',
        description: 'This domain is a known wallet drainer',
        weight: 25,
      }],
      recommendations: [
        '🚨 KNOWN MALICIOUS SITE',
        '❌ Do NOT visit this site',
        '🔐 This site will steal your assets',
      ],
      scanDate: new Date().toISOString(),
    };
  }
  
  // Fetch and analyze content
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AgenticBro Scanner)',
      },
    });
    
    const html = await response.text();
    const pageThreats = analyzePageContent(html, url);
    threats.push(...pageThreats);
    
  } catch (error) {
    threats.push({
      type: 'fetch_error',
      severity: 'LOW',
      description: 'Could not fetch page content - site may be down or blocking scanners',
      weight: 0,
    });
  }
  
  const riskScore = calculateRiskScore(threats);
  const riskLevel = getRiskLevel(riskScore);
  const recommendations = generateRecommendations(threats);
  
  return {
    success: true,
    url,
    domain,
    riskScore,
    riskLevel,
    threats,
    recommendations,
    scanDate: new Date().toISOString(),
  };
}

export default scanWebsite;