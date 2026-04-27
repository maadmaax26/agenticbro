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

interface WebsiteScanResult {
  success: boolean;
  url: string;
  domain: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threats: ThreatDetection[];
  recommendations: string[];
  scanDate: string;
}

// ─── Known Patterns ──────────────────────────────────────────────────────────

const WALLET_DRAINER_SIGNATURES = [
  // Seed phrase harvesting
  { pattern: 'seed phrase', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'recovery phrase', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' },
  { pattern: 'mnemonic', type: 'seed_harvesting', weight: 20, severity: 'CRITICAL' },
  { pattern: 'private key', type: 'key_harvesting', weight: 25, severity: 'CRITICAL' },
  { pattern: 'enter your seed', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' },
  { pattern: 'import wallet', type: 'wallet_import', weight: 15, severity: 'HIGH' as const },
  
  // Drainer scripts
  { pattern: 'drainer', type: 'drainer_script', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'sign drain', type: 'drainer_script', weight: 25, severity: 'CRITICAL' },
  { pattern: 'setApprovalForAll', type: 'approval_abuse', weight: 20, severity: 'HIGH' as const },
  
  // Fake airdrop
  { pattern: 'claim free', type: 'fake_airdrop', weight: 15, severity: 'HIGH' as const },
  { pattern: 'free airdrop', type: 'fake_airdrop', weight: 15, severity: 'HIGH' },
  { pattern: 'connect to claim', type: 'fake_airdrop', weight: 20, severity: 'CRITICAL' },
  { pattern: 'limited time claim', type: 'fake_airdrop', weight: 15, severity: 'HIGH' },
  
  // Phishing
  { pattern: 'verify your wallet', type: 'phishing', weight: 20, severity: 'CRITICAL' as const },
  { pattern: 'wallet verification', type: 'phishing', weight: 20, severity: 'CRITICAL' },
  { pattern: 'suspicious activity', type: 'phishing', weight: 15, severity: 'HIGH' as const },
  
  // Urgency
  { pattern: 'act now', type: 'urgency', weight: 10, severity: 'MEDIUM' as const },
  { pattern: 'limited spots', type: 'urgency', weight: 10, severity: 'MEDIUM' },
  { pattern: 'expires in', type: 'urgency', weight: 10, severity: 'MEDIUM' },
];

const LEGITIMATE_DOMAINS = [
  'phantom.app', 'metamask.io', 'uniswap.org', 'jupiter.ag',
  'raydium.io', 'pump.fun', 'magiceden.io', 'opensea.io',
  'dexscreener.com', 'coingecko.com', 'coinmarketcap.com',
  'binance.com', 'coinbase.com', 'kraken.com', 'bybit.com',
  'okx.com', 'kucoin.com', 'crypto.com', 'gate.io',
  'bitget.com', 'mexc.com', 'bingx.com', 'htx.com',
];

// ─── Known Fake Crypto Exchanges (Community Reports + Research) ────────

const FAKE_EXCHANGE_DOMAINS = [
  // Binance impersonators
  'binance-support', 'binance-help', 'binance-cust', 'binance-web3',
  'binance-login', 'binance-verify', 'binance-secure', 'binance-auth',
  'binance-recovery', 'binance-reset', 'binance-live', 'binance-chat',
  
  // Coinbase impersonators
  'coinbase-support', 'coinbase-help', 'coinbase-login', 'coinbase-verify',
  'coinbase-wallet', 'coinbase-secure', 'coinbase-recovery', 'coinbase-auth',
  
  // Kraken impersonators
  'kraken-support', 'kraken-help', 'kraken-login', 'kraken-verify',
  'kraken-wallet', 'kraken-secure',
  
  // Generic fake exchange patterns
  'crypto-exchange', 'crypto-trade', 'crypto-swap', 'crypto-buy',
  'buy-crypto', 'trade-crypto', 'swap-crypto', 'instant-exchange',
  'fast-exchange', 'secure-exchange', 'trusted-exchange',
  
  // Known scam domains (from community reports)
  'falsubinance.com', 'binance-kuwait.com', 'binancesg.com',
  'coinbase-france.com', 'coinbasesupport.org',
  'kraken-login.net', 'kraken-support.org',
  'bybit-support.com', 'bybit-login.net',
  'kucoin-support.org', 'kucoin-login.net',
  'gate-support.com', 'gate-login.net',
  'mexc-support.com', 'mexc-login.net',
];

function isFakeExchange(domain: string): { isFake: boolean; match?: string } {
  const lowerDomain = domain.toLowerCase();
  
  // Check exact fake domain matches
  for (const fakeDomain of FAKE_EXCHANGE_DOMAINS) {
    if (lowerDomain === fakeDomain || lowerDomain.endsWith('.' + fakeDomain)) {
      return { isFake: true, match: fakeDomain };
    }
    // Check if domain contains fake pattern (e.g., binance-support123.com)
    if (lowerDomain.includes(fakeDomain)) {
      return { isFake: true, match: fakeDomain };
    }
  }
  
  // Check for impersonation patterns
  const impersonationPatterns = [
    /^binance[a-z-]*\.(com|net|org|io|co)/i,
    /^coinbase[a-z-]*\.(com|net|org|io|co)/i,
    /^kraken[a-z-]*\.(com|net|org|io|co)/i,
    /^bybit[a-z-]*\.(com|net|org|io|co)/i,
    /^kucoin[a-z-]*\.(com|net|org|io|co)/i,
    /^gate[a-z-]*\.(com|net|org|io|co)/i,
    /-support\.(com|net|org|io)/i,
    /-help\.(com|net|org|io)/i,
    /-login\.(com|net|org|io)/i,
    /-verify\.(com|net|org|io)/i,
    /-wallet\.(com|net|org|io)/i,
  ];
  
  for (const pattern of impersonationPatterns) {
    if (pattern.test(lowerDomain)) {
      return { isFake: true, match: `Impersonation pattern: ${pattern.source}` };
    }
  }
  
  return { isFake: false };
}

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

function analyzeContent(html: string, url: string, domain: string): ThreatDetection[] {
  const threats: ThreatDetection[] = [];
  const lowerHtml = html.toLowerCase();
  
  // Check for fake exchange domain
  const fakeCheck = isFakeExchange(domain);
  if (fakeCheck.isFake) {
    threats.push({
      type: 'fake_exchange',
      severity: 'CRITICAL',
      description: 'Fake cryptocurrency exchange - impersonating legitimate platform',
      evidence: fakeCheck.match,
      weight: 25,
    });
  }
  
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
    fake_exchange: 'Fake crypto exchange - impersonating legitimate platform',
    phishing: 'Phishing attempt - steals credentials',
    urgency: 'Urgency tactics - forces quick decisions',
    wallet_connect: 'Wallet connection - verify site first',
    obfuscated_code: 'Hidden malicious code',
    approval_abuse: 'Token approval abuse - grants spending rights',
  };
  return descriptions[type] || 'Suspicious activity';
}

function calculateRiskScore(threats: ThreatDetection[]): number {
  const totalWeight = threats.reduce((sum, t) => sum + t.weight, 0);
  return Math.min(Math.round((totalWeight / 150) * 100) / 10, 10);
}

function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 7) return 'CRITICAL';
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

function generateRecommendations(threats: ThreatDetection[], isLegit: boolean): string[] {
  if (isLegit) {
    return ['✅ Known legitimate domain', '🔐 Still verify URL is correct'];
  }
  
  const recs: string[] = [];
  
  if (threats.some(t => t.type === 'fake_exchange')) {
    recs.push('🚨 CRITICAL: Fake crypto exchange detected');
    recs.push('❌ Do NOT deposit funds or connect wallet');
    recs.push('🔍 Verify URL matches official exchange website');
    recs.push('📋 Report to: support@legitimate-exchange.com');
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
  
  if (threats.some(t => t.type === 'phishing')) {
    recs.push('⚠️ Phishing site detected');
    recs.push('🔍 Check URL against official site');
  }
  
  if (threats.length === 0) {
    recs.push('✅ No obvious threats detected');
    recs.push('🔍 Still verify URL matches official site');
  }
  
  return recs.length > 0 ? recs : ['⚠️ Exercise caution', '🔍 Verify site legitimacy'];
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
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

  // Validate URL format
  let validUrl: string;
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      validUrl = 'https://' + url;
    } else {
      validUrl = url;
    }
    new URL(validUrl); // Validate
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  const domain = extractDomain(validUrl);
  const isLegit = isLegitimateDomain(domain);
  
  try {
    // Fetch page content
    const response = await fetch(validUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AgenticBro Scanner)',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
    
    const html = await response.text();
    const threats = analyzeContent(html, validUrl, domain);
    const riskScore = calculateRiskScore(threats);
    const riskLevel = getRiskLevel(riskScore);
    const recommendations = generateRecommendations(threats, isLegit);
    
    const result: WebsiteScanResult = {
      success: true,
      url: validUrl,
      domain,
      riskScore,
      riskLevel,
      threats,
      recommendations,
      scanDate: new Date().toISOString(),
    };
    
    return res.status(200).json(result);
    
  } catch (error: any) {
    // Network error or timeout
    const result: WebsiteScanResult = {
      success: true,
      url: validUrl,
      domain,
      riskScore: 0,
      riskLevel: 'LOW',
      threats: [{
        type: 'fetch_error',
        severity: 'LOW',
        description: 'Could not fetch page - site may be down or blocking scanners',
        weight: 0,
      }],
      recommendations: [
        '⚠️ Could not scan page content',
        '🔍 Verify URL manually before visiting',
        '🔐 Never connect wallet to unverified sites',
      ],
      scanDate: new Date().toISOString(),
    };
    
    return res.status(200).json(result);
  }
}