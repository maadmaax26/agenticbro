/**
 * api/website-scan.ts — Website Security Scanner API
 * 
 * Detects wallet drainers, fake airdrops, phishing sites, and wallet theft attempts
 * 
 * POST /api/website-scan
 * Body: { url: string }
 * Returns: WebsiteScanResult
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

type ThreatDetection = {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence?: string;
  weight: number;
};

interface ReputationResult {
  source: string;
  score?: number;
  verdict: string;
  details?: string;
}

interface WebsiteScanResult {
  success: boolean;
  url: string;
  domain: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threats: ThreatDetection[];
  recommendations: string[];
  reputation?: ReputationResult[];
  scamIndicators?: string[];
  deepScanId?: string;
  deepScanPollUrl?: string;
  scanDate: string;
}

// ─── Known Scam Domains (Regulatory Warnings) ────────────────────────────────

const KNOWN_SCAM_DOMAINS: Record<string, { regulator: string; warning: string }> = {
  // FCA Warned - Trade Vector AI variants
  'tradevectorai-app.org': { regulator: 'FCA', warning: 'UK FCA warning - unauthorised investment firm' },
  'fastinvest.com': { regulator: 'MULTIPLE', warning: 'Multiple scam reports - investment fraud, no withdrawals, regulatory warning from Hellenic Commission' },
  'trade-vectorai.net': { regulator: 'FCA', warning: 'UK FCA warning - unauthorised investment firm' },
  'tradevectorai.net': { regulator: 'FCA', warning: 'UK FCA warning - unauthorised investment firm' },
  'tradevectorai-official.com': { regulator: 'FCA', warning: 'UK FCA warning - unauthorised investment firm' },
  'trade.errors-app.org': { regulator: 'SUSPICIOUS', warning: 'Suspicious domain pattern associated with scams' },
  'trade-errors-app.org': { regulator: 'SUSPICIOUS', warning: 'Suspicious domain pattern associated with scams' },
};

// ─── Scam Domain Patterns ───────────────────────────────────────────────────

const SCAM_DOMAIN_PATTERNS = [
  { pattern: /tradevectorai/i, regulator: 'FCA', warning: 'UK FCA warned entity', weight: 30 },
  { pattern: /trade-vectorai/i, regulator: 'FCA', warning: 'UK FCA warned entity', weight: 30 },
  { pattern: /errors-app/i, regulator: 'SUSPICIOUS', warning: 'Suspicious domain pattern', weight: 25 },
  { pattern: /vectorai-app/i, regulator: 'FCA', warning: 'Associated with FCA warned entity', weight: 25 },
];

// ─── Wallet Drainer Patterns ────────────────────────────────────────────────

const WALLET_DRAINER_SIGNATURES = [
  { pattern: 'seed phrase', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'recovery phrase', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' },
  { pattern: 'mnemonic', type: 'seed_harvesting', weight: 20, severity: 'CRITICAL' },
  { pattern: 'private key', type: 'key_harvesting', weight: 25, severity: 'CRITICAL' },
  { pattern: 'enter your seed', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' },
  { pattern: 'import wallet', type: 'wallet_import', weight: 15, severity: 'HIGH' as const },
  { pattern: 'drainer', type: 'drainer_script', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'sign drain', type: 'drainer_script', weight: 25, severity: 'CRITICAL' },
  { pattern: 'claim free', type: 'fake_airdrop', weight: 15, severity: 'HIGH' as const },
  { pattern: 'free airdrop', type: 'fake_airdrop', weight: 15, severity: 'HIGH' },
  { pattern: 'connect to claim', type: 'fake_airdrop', weight: 20, severity: 'CRITICAL' },
  { pattern: 'verify your wallet', type: 'phishing', weight: 20, severity: 'CRITICAL' as const },
  { pattern: 'wallet verification', type: 'phishing', weight: 20, severity: 'CRITICAL' },
  { pattern: 'suspicious activity', type: 'phishing', weight: 15, severity: 'HIGH' as const },
];

// ─── Investment Fraud Keywords ──────────────────────────────────────────────

const INVESTMENT_FRAUD_KEYWORDS = [
  { pattern: 'recover your investment', type: 'investment_fraud', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'recover your funds', type: 'investment_fraud', weight: 25, severity: 'CRITICAL' },
  { pattern: 'fund recovery', type: 'investment_fraud', weight: 20, severity: 'CRITICAL' },
  { pattern: 'account suspended', type: 'brokerage_phishing', weight: 15, severity: 'HIGH' as const },
  { pattern: 'account locked', type: 'brokerage_phishing', weight: 15, severity: 'HIGH' },
];

// ─── Legitimate Domains ─────────────────────────────────────────────────────

const LEGITIMATE_DOMAINS = [
  'phantom.app', 'metamask.io', 'uniswap.org', 'jupiter.ag',
  'raydium.io', 'pump.fun', 'magiceden.io', 'opensea.io',
  'dexscreener.com', 'coingecko.com', 'coinmarketcap.com',
  'binance.com', 'coinbase.com', 'kraken.com', 'bybit.com',
  'okx.com', 'kucoin.com', 'crypto.com', 'gate.io',
  'robinhood.com', 'webull.com', 'etrade.com', 'fidelity.com',
  'schwab.com', 'vanguard.com', 'sofi.com',
];

// ─── Helper Functions ────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function isLegitimateDomain(domain: string): boolean {
  return LEGITIMATE_DOMAINS.some(legit => 
    domain === legit || domain.endsWith('.' + legit)
  );
}

function checkKnownScamDomain(domain: string): ThreatDetection | null {
  const lowerDomain = domain.toLowerCase();
  
  // Check exact matches first
  if (KNOWN_SCAM_DOMAINS[lowerDomain]) {
    const info = KNOWN_SCAM_DOMAINS[lowerDomain];
    return {
      type: 'regulatory_warning',
      severity: 'CRITICAL',
      description: `${info.regulator} Warning: ${info.warning}`,
      evidence: `Domain: ${domain}`,
      weight: 30,
    };
  }
  
  // Check pattern matches
  for (const { pattern, regulator, warning, weight } of SCAM_DOMAIN_PATTERNS) {
    if (pattern.test(lowerDomain)) {
      return {
        type: 'regulatory_warning',
        severity: 'CRITICAL',
        description: `${regulator} Warning: ${warning}`,
        evidence: `Pattern match: ${pattern.source}`,
        weight,
      };
    }
  }
  
  return null;
}

function analyzeContent(html: string, domain: string): ThreatDetection[] {
  const threats: ThreatDetection[] = [];
  const lowerHtml = html.toLowerCase();
  
  // Check wallet drainer patterns
  for (const sig of WALLET_DRAINER_SIGNATURES) {
    if (lowerHtml.includes(sig.pattern)) {
      threats.push({
        type: sig.type,
        severity: sig.severity,
        description: getThreatDescription(sig.type),
        evidence: `Pattern: "${sig.pattern}"`,
        weight: sig.weight,
      });
    }
  }
  
  // Check investment fraud keywords
  for (const keyword of INVESTMENT_FRAUD_KEYWORDS) {
    if (lowerHtml.includes(keyword.pattern)) {
      threats.push({
        type: keyword.type,
        severity: keyword.severity,
        description: getThreatDescription(keyword.type),
        evidence: `Keyword: "${keyword.pattern}"`,
        weight: keyword.weight,
      });
    }
  }
  
  // Check for Cloudflare block (suspicious for financial sites)
  if (lowerHtml.includes('cloudflare') && lowerHtml.includes('blocked')) {
    threats.push({
      type: 'cloudflare_block',
      severity: 'MEDIUM',
      description: 'Site is blocking automated access - could be hiding malicious content',
      evidence: 'Cloudflare challenge page detected',
      weight: 10,
    });
  }
  
  // Check for obfuscated code
  if (lowerHtml.includes('eval(') || lowerHtml.includes('atob(')) {
    threats.push({
      type: 'obfuscated_code',
      severity: 'HIGH',
      description: 'Obfuscated JavaScript - often hides malicious code',
      weight: 15,
    });
  }
  
  // Check for wallet connection
  if (lowerHtml.includes('connect wallet') || lowerHtml.includes('walletconnect')) {
    threats.push({
      type: 'wallet_connect',
      severity: 'MEDIUM',
      description: 'Wallet connection requested',
      weight: 10,
    });
  }
  
  return threats;
}

function getThreatDescription(type: string): string {
  const descriptions: Record<string, string> = {
    drainer_script: 'Wallet drainer script - steals all assets',
    seed_harvesting: 'Seed phrase harvesting - NEVER enter your seed phrase',
    key_harvesting: 'Private key theft - NEVER share your private key',
    fake_airdrop: 'Fake airdrop scam - drains wallet',
    regulatory_warning: 'Regulatory warning - official fraud alert',
    investment_fraud: 'Investment fraud - recovery/claim scam',
    brokerage_phishing: 'Brokerage phishing - attempts to steal credentials',
    phishing: 'Phishing attempt - steals credentials',
    wallet_connect: 'Wallet connection - verify site first',
    obfuscated_code: 'Hidden malicious code',
    cloudflare_block: 'Site blocking scanners - suspicious behavior',
  };
  return descriptions[type] || 'Suspicious activity';
}

function calculateRiskScore(threats: ThreatDetection[]): number {
  const totalWeight = threats.reduce((sum, t) => sum + t.weight, 0);
  // 30+ points = CRITICAL (10), 20+ = HIGH (7), 10+ = MEDIUM (5)
  if (totalWeight >= 30) return Math.min(10, Math.round(totalWeight / 5));
  if (totalWeight >= 20) return Math.min(8, Math.round(totalWeight / 4));
  if (totalWeight >= 10) return Math.min(5, Math.round(totalWeight / 3));
  return Math.min(Math.round((totalWeight / 10) * 10) / 10, 10);
}

function getRiskLevel(score: number, threats: ThreatDetection[] = []): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  // Any CRITICAL threat automatically elevates to CRITICAL level
  if (threats.some(t => t.severity === 'CRITICAL')) {
    return 'CRITICAL';
  }
  if (score >= 7) return 'CRITICAL';
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

// ─── External Reputation Check via Brave Search API ─────────────────────────

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

async function searchScamReports(domain: string): Promise<{ results: SearchResult[]; scamIndicators: string[] }> {
  const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
  
  if (!BRAVE_API_KEY) {
    // Fallback to static reputation links if no API key
    return {
      results: [],
      scamIndicators: [],
    };
  }
  
  try {
    const searchQuery = `${domain} scam legit review warning`;
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=10`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': BRAVE_API_KEY,
        },
      }
    );
    
    if (!response.ok) {
      return { results: [], scamIndicators: [] };
    }
    
    const data = await response.json();
    const results: SearchResult[] = (data.web?.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }));
    
    // Extract scam indicators from descriptions
    const scamIndicators: string[] = [];
    const scamPatterns = [
      /scam/i, /fraud/i, /warning/i, /avoid/i, /stolen/i,
      /withdrawal/i, /no response/i, /fake/i, /suspicious/i,
    ];
    
    for (const result of results) {
      const text = `${result.title} ${result.description}`.toLowerCase();
      for (const pattern of scamPatterns) {
        if (pattern.test(text)) {
          scamIndicators.push(result.title);
          break;
        }
      }
    }
    
    return { results, scamIndicators: [...new Set(scamIndicators)] };
  } catch {
    return { results: [], scamIndicators: [] };
  }
}

async function checkReputation(domain: string): Promise<ReputationResult[]> {
  const results: ReputationResult[] = [];
  
  // Always add static reputation links
  results.push({
    source: 'ScamAdviser',
    verdict: 'Check recommended',
    details: `https://www.scamadviser.com/check-website/${domain}`,
  });
  results.push({
    source: 'Scam Detector',
    verdict: 'Check recommended',
    details: `https://www.scam-detector.com/validator/${domain.replace('.', '-')}-review/`,
  });
  results.push({
    source: 'Trustpilot',
    verdict: 'Check reviews',
    details: `https://www.trustpilot.com/review/${domain}`,
  });
  
  // Try to get live search results if API key is available
  const { results: searchResults, scamIndicators } = await searchScamReports(domain);
  
  if (searchResults.length > 0) {
    results.push({
      source: 'Web Search',
      verdict: scamIndicators.length > 0 ? `${scamIndicators.length} potential scam indicators found` : 'No obvious scam indicators',
      details: scamIndicators.slice(0, 3).join('; ') || 'Search completed',
    });
  }
  
  return results;
}

function generateRecommendations(threats: ThreatDetection[], isLegit: boolean, reputation?: ReputationResult[]): string[] {
  if (isLegit) {
    return ['✅ Known legitimate domain', '🔐 Still verify URL is correct'];
  }
  
  const recs: string[] = [];
  
  if (threats.some(t => t.type === 'regulatory_warning')) {
    recs.push('🚨 CRITICAL: Regulatory warning - known scam/fraud');
    recs.push('❌ Do NOT interact with this site');
    recs.push('📋 Report: https://reportfraud.ftc.gov');
  }
  
  if (threats.some(t => t.type === 'investment_fraud')) {
    recs.push('🚨 CRITICAL: Investment fraud detected');
    recs.push('❌ Do NOT send money or provide banking info');
    recs.push('📋 Report to FTC: reportfraud.ftc.gov');
  }
  
  if (threats.some(t => t.type === 'seed_harvesting' || t.type === 'key_harvesting')) {
    recs.push('🚨 CRITICAL: Site asks for seed phrase/private key - NEVER share');
    recs.push('❌ Close immediately and never return');
  }
  
  if (threats.some(t => t.type === 'drainer_script')) {
    recs.push('🚨 Wallet drainer detected - will steal all assets');
    recs.push('❌ Do NOT connect wallet');
  }
  
  if (threats.some(t => t.type === 'fake_airdrop')) {
    recs.push('⚠️ Fake airdrop scam');
    recs.push('🔍 Verify official project website');
  }
  
  if (threats.some(t => t.type === 'phishing' || t.type === 'brokerage_phishing')) {
    recs.push('⚠️ Phishing site detected');
    recs.push('❌ Do NOT enter login credentials');
  }
  
  if (threats.some(t => t.type === 'cloudflare_block')) {
    recs.push('⚠️ Site is blocking security scanners');
    recs.push('🔍 This is suspicious for a legitimate financial site');
  }
  
  if (threats.length === 0) {
    recs.push('✅ No obvious threats detected');
    recs.push('🔍 Still verify URL matches official site');
  }
  
  return recs.length > 0 ? recs : ['⚠️ Exercise caution', '🔍 Verify site legitimacy'];
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  let validUrl: string;
  try {
    validUrl = url.startsWith('http://') || url.startsWith('https://') ? url : 'https://' + url;
    new URL(validUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  const domain = extractDomain(validUrl);
  const isLegit = isLegitimateDomain(domain);
  const threats: ThreatDetection[] = [];
  let reputation: ReputationResult[] | undefined;
  
  // ALWAYS check known scam domains FIRST (even if fetch fails later)
  const knownScamThreat = checkKnownScamDomain(domain);
  if (knownScamThreat) {
    threats.push(knownScamThreat);
  }
  
  // Run reputation check in parallel with content fetch
  let scamIndicators: string[] = [];
  const [reputationResults] = await Promise.allSettled([
    checkReputation(domain),
  ]);
  
  if (reputationResults.status === 'fulfilled') {
    reputation = reputationResults.value;
    // Extract scam indicators from reputation results
    const webSearchResult = reputation.find(r => r.source === 'Web Search');
    if (webSearchResult && webSearchResult.details) {
      scamIndicators = webSearchResult.details.split('; ').filter(s => s && s !== 'Search completed');
    }
  }
  
  try {
    const response = await fetch(validUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgenticBro Scanner)' },
      signal: AbortSignal.timeout(10000),
    });
    
    const html = await response.text();
    const contentThreats = analyzeContent(html, domain);
    threats.push(...contentThreats);
    
  } catch (error: any) {
    // Fetch failed - but we still check domain reputation
    if (threats.length === 0) {
      threats.push({
        type: 'fetch_error',
        severity: 'LOW',
        description: 'Could not fetch page - site may be down or blocking scanners',
        weight: 0,
      });
    }
  }
  
  const riskScore = calculateRiskScore(threats);
  const riskLevel = getRiskLevel(riskScore, threats);
  const recommendations = generateRecommendations(threats, isLegit, reputation);
  
  // Queue deep scan if basic scan is inconclusive (fetch error or LOW risk with no threats)
  let deepScanId: string | undefined;
  const shouldQueueDeepScan = threats.some(t => t.type === 'fetch_error') || 
    (riskLevel === 'LOW' && threats.length === 0);
  
  if (shouldQueueDeepScan) {
    const scanId = `deep-${domain}-${Date.now()}`;
    deepScanId = scanId;
    
    // Trigger immediate wake event to OpenClaw agent
    // Agent will process with web_search and store results in session
    fetch('https://gateway.openclaw.ai/api/cron/wake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'now',
        text: `DEEP SCAN REQUEST: ${validUrl}

Scan ID: ${scanId}
Domain: ${domain}

Use web_search to research this domain for scam reports, regulatory warnings, user reviews. 
Then respond with detailed findings including risk level, scam indicators, and recommendations.

Format response as JSON for the user to see.`,
      }),
    }).catch(() => {
      // Ignore errors - best effort
    });
  }
  
  const result: WebsiteScanResult = {
    success: true,
    url: validUrl,
    domain,
    riskScore,
    riskLevel,
    threats,
    recommendations,
    reputation,
    scamIndicators,
    deepScanId,
    deepScanPollUrl: deepScanId ? `/api/website-deep-scan?scanId=${deepScanId}` : undefined,
    scanDate: new Date().toISOString(),
  };
  
  return res.status(200).json(result);
}