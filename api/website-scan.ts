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

// ─── Known Scam Domains (Regulatory Warnings, Community Reports) ─────────

const KNOWN_SCAM_DOMAINS = [
  // FCA Warned - Trade Vector AI variants
  'trade-vectorai.net', 'tradevectorai.net', 'tradevectorai-app.org', 'tradevectorai-official.com',
  'trade.errors-app.org', 'trade-errors-app.org',
  'vectorai-app.org', 'vector-ai-app.org',
  
  // Common scam patterns
  'trade-ai.net', 'trading-ai.net', 'profit-ai.net',
  'crypto-ai.net', 'bitcoin-ai.net', 'ethereum-ai.net',
];

// ─── Regulatory Warning Domains ───────────────────────────────────────────

const REGULATORY_WARNING_DOMAINS = [
  // FCA warned entities
  { pattern: 'tradevectorai', regulator: 'FCA', warning: 'UK Financial Conduct Authority warning - unauthorised firm' },
  { pattern: 'trade-vectorai', regulator: 'FCA', warning: 'UK Financial Conduct Authority warning - unauthorised firm' },
  { pattern: 'errors-app', regulator: 'SUSPICIOUS', warning: 'Suspicious domain pattern detected' },
];

const LEGITIMATE_DOMAINS = [
  'phantom.app', 'metamask.io', 'uniswap.org', 'jupiter.ag',
  'raydium.io', 'pump.fun', 'magiceden.io', 'opensea.io',
  'dexscreener.com', 'coingecko.com', 'coinmarketcap.com',
  'binance.com', 'coinbase.com', 'kraken.com', 'bybit.com',
  'okx.com', 'kucoin.com', 'crypto.com', 'gate.io',
  'bitget.com', 'mexc.com', 'bingx.com', 'htx.com',
  // Legitimate brokerage platforms
  'robinhood.com', 'webull.com', 'etrade.com', 'fidelity.com',
  'charles-schwab.com', 'schwab.com', 'vanguard.com',
  'interactivebrokers.com', 'tdameritrade.com', 'merrill.com',
  'sofi.com', 'public.com', 'e*trade.com', 'trade.com',
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

// ─── Known Fake Brokerage Websites (Community Reports + Research) ─────

const FAKE_BROKERAGE_DOMAINS = [
  // Robinhood impersonators
  'robinhood-support', 'robinhood-help', 'robinhood-login', 'robinhood-verify',
  'robinhood-wallet', 'robinhood-secure', 'robinhood-recovery',
  'robinhood-auth', 'robinhood-reset', 'robinhood-cust',
  
  // Fidelity impersonators
  'fidelity-support', 'fidelity-help', 'fidelity-login', 'fidelity-verify',
  'fidelity-secure', 'fidelity-recovery', 'fidelity-auth',
  
  // Charles Schwab impersonators
  'schwab-support', 'schwab-help', 'schwab-login', 'schwab-verify',
  'charles-schwab-support', 'charles-schwab-help',
  'schwab-secure', 'schwab-recovery',
  
  // Vanguard impersonators
  'vanguard-support', 'vanguard-help', 'vanguard-login', 'vanguard-verify',
  'vanguard-secure', 'vanguard-recovery',
  
  // E*Trade impersonators
  'etrade-support', 'etrade-help', 'etrade-login', 'etrade-verify',
  'e-trade-support', 'etrade-secure', 'etrade-recovery',
  
  // Webull impersonators
  'webull-support', 'webull-help', 'webull-login', 'webull-verify',
  'webull-secure', 'webull-recovery',
  
  // TD Ameritrade impersonators
  'tdameritrade-support', 'tdameritrade-help', 'tdameritrade-login',
  'td-ameritrade-support', 'tdameritrade-secure',
  
  // Interactive Brokers impersonators
  'interactivebrokers-support', 'interactivebrokers-help',
  'ibkr-support', 'ibkr-help', 'ibkr-login',
  
  // SoFi impersonators
  'sofi-support', 'sofi-help', 'sofi-login', 'sofi-verify',
  'sofi-invest-support', 'sofi-secure',
  
  // Public.com impersonators
  'public-support', 'public-help', 'public-login', 'public-verify',
  'public-secure', 'public-recovery',
  
  // Merrill impersonators
  'merrill-support', 'merrill-help', 'merrill-login', 'merrill-verify',
  'merrill-edge-support', 'merrill-secure',
  
  // Generic fake brokerage patterns
  'brokerage-account', 'stock-trading', 'investment-account',
  'trading-account', 'broker-support', 'broker-help',
  'account-recovery', 'fund-recovery', 'withdraw-help',
  
  // Known fake brokerage domains
  'robinhood-login.net', 'robinhood-support.org',
  'fidelity-login.net', 'fidelity-support.com',
  'schwab-login.net', 'schwab-support.org',
  'vanguard-login.net', 'vanguard-support.org',
  'etrade-support.com', 'webull-support.org',
  'webull-login.net', 'tdameritrade-support.net',
];

// ─── Investment Fraud Keywords ───────────────────────────────────────────

const INVESTMENT_FRAUD_KEYWORDS = [
  // Recovery scams
  { pattern: 'recover your investment', type: 'investment_fraud', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'recover your funds', type: 'investment_fraud', weight: 25, severity: 'CRITICAL' },
  { pattern: 'fund recovery', type: 'investment_fraud', weight: 20, severity: 'CRITICAL' },
  { pattern: 'investment recovery', type: 'investment_fraud', weight: 20, severity: 'CRITICAL' },
  { pattern: 'claim your funds', type: 'investment_fraud', weight: 20, severity: 'HIGH' },
  { pattern: 'unclaimed funds', type: 'investment_fraud', weight: 15, severity: 'HIGH' },
  
  // Fake account verification
  { pattern: 'verify your brokerage', type: 'brokerage_phishing', weight: 20, severity: 'CRITICAL' },
  { pattern: 'verify your account', type: 'brokerage_phishing', weight: 15, severity: 'HIGH' },
  { pattern: 'account suspended', type: 'brokerage_phishing', weight: 15, severity: 'HIGH' },
  { pattern: 'account locked', type: 'brokerage_phishing', weight: 15, severity: 'HIGH' },
  { pattern: 'verify identity', type: 'brokerage_phishing', weight: 10, severity: 'MEDIUM' },
  
  // Wire fraud indicators
  { pattern: 'wire transfer', type: 'wire_fraud', weight: 15, severity: 'HIGH' },
  { pattern: 'urgent wire', type: 'wire_fraud', weight: 20, severity: 'CRITICAL' },
  { pattern: 'international wire', type: 'wire_fraud', weight: 15, severity: 'HIGH' },
  
  // Brokerage impersonation
  { pattern: 'official broker', type: 'brokerage_phishing', weight: 15, severity: 'HIGH' },
  { pattern: 'authorized representative', type: 'brokerage_phishing', weight: 15, severity: 'HIGH' },
  { pattern: 'account manager will', type: 'brokerage_phishing', weight: 10, severity: 'MEDIUM' },
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

function isFakeBrokerage(domain: string): { isFake: boolean; match?: string } {
  const lowerDomain = domain.toLowerCase();
  
  // Check exact fake brokerage domain matches
  for (const fakeDomain of FAKE_BROKERAGE_DOMAINS) {
    if (lowerDomain === fakeDomain || lowerDomain.endsWith('.' + fakeDomain)) {
      return { isFake: true, match: fakeDomain };
    }
    if (lowerDomain.includes(fakeDomain)) {
      return { isFake: true, match: fakeDomain };
    }
  }
  
  // Brokerage impersonation patterns
  const brokerageImpersonationPatterns = [
    /^robinhood[a-z-]*\.(com|net|org|io|co)/i,
    /^fidelity[a-z-]*\.(com|net|org|io|co)/i,
    /^schwab[a-z-]*\.(com|net|org|io|co)/i,
    /^vanguard[a-z-]*\.(com|net|org|io|co)/i,
    /^etrade[a-z-]*\.(com|net|org|io|co)/i,
    /^webull[a-z-]*\.(com|net|org|io|co)/i,
    /^sofi[a-z-]*\.(com|net|org|io|co)/i,
    /^merrill[a-z-]*\.(com|net|org|io|co)/i,
    /-recovery\.(com|net|org|io)/i,
    /-brokerage\.(com|net|org|io)/i,
  ];
  
  for (const pattern of brokerageImpersonationPatterns) {
    if (pattern.test(lowerDomain)) {
      return { isFake: true, match: `Brokerage impersonation: ${pattern.source}` };
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
  const fakeExchangeCheck = isFakeExchange(domain);
  if (fakeExchangeCheck.isFake) {
    threats.push({
      type: 'fake_exchange',
      severity: 'CRITICAL',
      description: 'Fake cryptocurrency exchange - impersonating legitimate platform',
      evidence: fakeExchangeCheck.match,
      weight: 25,
    });
  }
  
  // Check for fake brokerage domain
  const fakeBrokerageCheck = isFakeBrokerage(domain);
  if (fakeBrokerageCheck.isFake) {
    threats.push({
      type: 'fake_brokerage',
      severity: 'CRITICAL',
      description: 'Fake brokerage website - impersonating legitimate investment platform',
      evidence: fakeBrokerageCheck.match,
      weight: 25,
    });
  }
  
  // Check for known scam domains (FCA warned, community reported)
  const lowerDomain = domain.toLowerCase();
  for (const scamDomain of KNOWN_SCAM_DOMAINS) {
    if (lowerDomain === scamDomain || lowerDomain.includes(scamDomain)) {
      threats.push({
        type: 'known_scam_domain',
        severity: 'CRITICAL',
        description: 'Known scam domain - regulatory warning or community report',
        evidence: scamDomain,
        weight: 30,
      });
      break;
    }
  }
  
  // Check for regulatory warning patterns
  for (const warning of REGULATORY_WARNING_DOMAINS) {
    if (lowerDomain.includes(warning.pattern)) {
      threats.push({
        type: 'regulatory_warning',
        severity: 'CRITICAL',
        description: `${warning.regulator} WARNING: ${warning.warning}`,
        evidence: warning.pattern,
        weight: 30,
      });
    }
  }
  
  // Check for wallet drainer patterns
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
  
  // Check for investment fraud keywords
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
    fake_brokerage: 'Fake brokerage website - impersonating investment platform',
    investment_fraud: 'Investment fraud - recovery/claim scam',
    brokerage_phishing: 'Brokerage phishing - attempts to steal login credentials',
    wire_fraud: 'Wire fraud indicators - requests urgent transfers',
    phishing: 'Phishing attempt - steals credentials',
    urgency: 'Urgency tactics - forces quick decisions',
    wallet_connect: 'Wallet connection - verify site first',
    obfuscated_code: 'Hidden malicious code',
    approval_abuse: 'Token approval abuse - grants spending rights',
    known_scam_domain: 'Known scam domain - flagged by regulators or community',
    regulatory_warning: 'Regulatory warning - official authority has flagged this domain',
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
  }
  
  if (threats.some(t => t.type === 'fake_brokerage')) {
    recs.push('🚨 CRITICAL: Fake brokerage website detected');
    recs.push('❌ Do NOT provide personal info or transfer funds');
    recs.push('🔍 Verify URL matches official brokerage website');
    recs.push('📋 Report to SEC: https://www.sec.gov/oiea/ActionForm.htm');
  }
  
  if (threats.some(t => t.type === 'investment_fraud')) {
    recs.push('🚨 CRITICAL: Investment fraud/recovery scam detected');
    recs.push('❌ Do NOT send money or provide banking info');
    recs.push('📋 Report to FTC: https://reportfraud.ftc.gov');
  }
  
  if (threats.some(t => t.type === 'brokerage_phishing')) {
    recs.push('⚠️ Brokerage phishing attempt detected');
    recs.push('❌ Do NOT enter your login credentials');
    recs.push('🔍 Log in directly from official app or website');
  }
  
  if (threats.some(t => t.type === 'wire_fraud')) {
    recs.push('🚨 Wire fraud indicators detected');
    recs.push('❌ Do NOT send wire transfers');
    recs.push('📞 Call your bank immediately if already contacted');
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
  
  // Check known scam domains BEFORE content fetch (handles Cloudflare blocks)
  const lowerDomain = domain.toLowerCase();
  let threats: ThreatDetection[] = [];
  
  // Check for known scam domains
  for (const scamDomain of KNOWN_SCAM_DOMAINS) {
    if (lowerDomain === scamDomain || lowerDomain.includes(scamDomain)) {
      threats.push({
        type: 'known_scam_domain',
        severity: 'CRITICAL',
        description: 'Known scam domain - regulatory warning or community report',
        evidence: scamDomain,
        weight: 30,
      });
      break;
    }
  }
  
  // Check for regulatory warning patterns
  for (const warning of REGULATORY_WARNING_DOMAINS) {
    if (lowerDomain.includes(warning.pattern)) {
      threats.push({
        type: 'regulatory_warning',
        severity: 'CRITICAL',
        description: `${warning.regulator} WARNING: ${warning.warning}`,
        evidence: warning.pattern,
        weight: 30,
      });
    }
  }
  
  // If already CRITICAL from domain checks, return early
  if (threats.some(t => t.severity === 'CRITICAL')) {
    const riskScore = calculateRiskScore(threats);
    const riskLevel = getRiskLevel(riskScore);
    const recommendations = generateRecommendations(threats, isLegit);
    
    return res.status(200).json({
      success: true,
      url: validUrl,
      domain,
      riskScore,
      riskLevel,
      threats,
      recommendations,
      scanDate: new Date().toISOString(),
    });
  }
  
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