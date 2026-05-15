/**
 * api/website-scan.ts — Website Security Scanner API
 * 
 * Detects wallet drainers, fake airdrops, phishing sites, wallet theft attempts,
 * AND fake event ticket scams (World Cup 2026, major sporting events)
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
  webSearchResults?: SearchResult[];
  deepScanId?: string;
  deepScanPollUrl?: string;
  scanDate: string;
  scanCategory?: 'general' | 'ticket';
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

  // ─── World Cup 2026 Ticket Scams ────────────────────────────────────────
  // Known fake ticket sites — FIFA only sells via FIFA.com/tickets
  'fifa2026tickets.com': { regulator: 'FIFA', warning: 'Fake World Cup 2026 ticket site — FIFA is the ONLY authorized seller' },
  'worldcup2026tickets.com': { regulator: 'FIFA', warning: 'Fake World Cup 2026 ticket site — NOT authorized by FIFA' },
  'fifaworldcup2026tickets.com': { regulator: 'FIFA', warning: 'Fake World Cup 2026 ticket site — FIFA does not use subdomains for tickets' },
  'wc2026tickets.com': { regulator: 'FIFA', warning: 'Fake World Cup 2026 ticket reseller — unauthorized' },
  '2026worldcuptickets.com': { regulator: 'FIFA', warning: 'Fake World Cup 2026 ticket site — not authorized by FIFA' },
  'worldcuptickets2026.com': { regulator: 'FIFA', warning: 'Fake World Cup 2026 ticket site — FIFA is the ONLY official source' },
  'fifatickets2026.com': { regulator: 'FIFA', warning: 'Impersonates FIFA — only FIFA.com/tickets is official' },
  'fifa2026official.com': { regulator: 'FIFA', warning: 'Fake FIFA official site — FIFA only uses FIFA.com domain' },
  'fifafans2026.com': { regulator: 'FIFA', warning: 'Fake FIFA fan site used for ticket scams' },
  'worldcup-hospitality.com': { regulator: 'FIFA', warning: 'Fake hospitality reseller — FIFA Hospitality is the ONLY authorized program' },
  'matchhospitality2026.com': { regulator: 'FIFA', warning: 'Fake hospitality reseller — not affiliated with FIFA/MATCH Hospitality' },
};

// ─── Scam Domain Patterns ───────────────────────────────────────────────────

const SCAM_DOMAIN_PATTERNS = [
  { pattern: /tradevectorai/i, regulator: 'FCA', warning: 'UK FCA warned entity', weight: 30 },
  { pattern: /trade-vectorai/i, regulator: 'FCA', warning: 'UK FCA warned entity', weight: 30 },
  { pattern: /errors-app/i, regulator: 'SUSPICIOUS', warning: 'Suspicious domain pattern', weight: 25 },
  { pattern: /vectorai-app/i, regulator: 'FCA', warning: 'Associated with FCA warned entity', weight: 25 },
  // World Cup 2026 ticket scam domain patterns
  { pattern: /fifa.*2026.*ticket/i, regulator: 'FIFA', warning: 'Fake FIFA World Cup 2026 ticket site — FIFA.com is the ONLY authorized seller', weight: 30 },
  { pattern: /worldcup.*2026.*ticket/i, regulator: 'FIFA', warning: 'Fake World Cup 2026 ticket site — NOT authorized by FIFA', weight: 30 },
  { pattern: /2026.*worldcup.*ticket/i, regulator: 'FIFA', warning: 'Fake World Cup 2026 ticket site — NOT authorized by FIFA', weight: 30 },
  { pattern: /wc2026.*ticket/i, regulator: 'FIFA', warning: 'Fake World Cup 2026 ticket site — NOT authorized by FIFA', weight: 30 },
  { pattern: /fifa.*official.*2026/i, regulator: 'FIFA', warning: 'Fake FIFA official site — FIFA only uses FIFA.com domain', weight: 30 },
  { pattern: /fifaticket/i, regulator: 'FIFA', warning: 'Impersonates FIFA ticket sales — only FIFA.com/tickets is official', weight: 30 },
  { pattern: /worldcup.*hospitality/i, regulator: 'FIFA', warning: 'Fake World Cup hospitality reseller — FIFA Hospitality is the ONLY authorized program', weight: 25 },
  { pattern: /match.*hospitality.*2026/i, regulator: 'FIFA', warning: 'Fake MATCH Hospitality reseller — not affiliated with FIFA', weight: 25 },
  { pattern: /copa.*america.*2026.*ticket/i, regulator: 'CONCACAF', warning: 'Suspect Copa America 2026 ticket reseller — verify with CONCACAF', weight: 20 },
];

// ─── Wallet Drainer Patterns ────────────────────────────────────────────────

const WALLET_DRAINER_SIGNATURES = [
  { pattern: 'seed phrase', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'recovery phrase', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'mnemonic', type: 'seed_harvesting', weight: 20, severity: 'CRITICAL' as const },
  { pattern: 'private key', type: 'key_harvesting', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'enter your seed', type: 'seed_harvesting', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'import wallet', type: 'wallet_import', weight: 15, severity: 'HIGH' as const },
  { pattern: 'drainer', type: 'drainer_script', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'sign drain', type: 'drainer_script', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'claim free', type: 'fake_airdrop', weight: 15, severity: 'HIGH' as const },
  { pattern: 'free airdrop', type: 'fake_airdrop', weight: 15, severity: 'HIGH' as const },
  { pattern: 'connect to claim', type: 'fake_airdrop', weight: 20, severity: 'CRITICAL' as const },
  { pattern: 'verify your wallet', type: 'phishing', weight: 20, severity: 'CRITICAL' as const },
  { pattern: 'wallet verification', type: 'phishing', weight: 20, severity: 'CRITICAL' as const },
  { pattern: 'suspicious activity', type: 'phishing', weight: 15, severity: 'HIGH' as const },
];

// ─── Investment Fraud Keywords ──────────────────────────────────────────────

const INVESTMENT_FRAUD_KEYWORDS = [
  { pattern: 'recover your investment', type: 'investment_fraud', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'recover your funds', type: 'investment_fraud', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'fund recovery', type: 'investment_fraud', weight: 20, severity: 'HIGH' as const },
  { pattern: 'account suspended', type: 'brokerage_phishing', weight: 15, severity: 'HIGH' as const },
  { pattern: 'account locked', type: 'brokerage_phishing', weight: 15, severity: 'HIGH' as const },
];

// ─── Event Ticket Scam Keywords (World Cup 2026 & Major Events) ────────────────

const EVENT_TICKET_SCAM_KEYWORDS = [
  // FIFA / World Cup 2026 specific
  { pattern: 'world cup 2026 tickets', type: 'fake_event_ticket', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'fifa 2026 tickets', type: 'fake_event_ticket', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'guaranteed world cup tickets', type: 'fake_event_ticket', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'buy world cup tickets', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },
  { pattern: 'world cup tickets for sale', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },
  { pattern: 'cheap world cup tickets', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },
  { pattern: 'discount world cup', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },
  { pattern: 'vip world cup packages', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },
  { pattern: 'fifa hospitality package', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },
  { pattern: 'official ticket reseller', type: 'fake_event_ticket', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'authorized ticket vendor', type: 'fake_event_ticket', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'fifa approved seller', type: 'fake_event_ticket', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'world cup final tickets', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },
  { pattern: 'semi final tickets 2026', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },

  // General ticket scam patterns
  { pattern: 'tickets guaranteed', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },
  { pattern: '100% guaranteed tickets', type: 'fake_event_ticket', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'sold out tickets', type: 'fake_event_ticket', weight: 15, severity: 'HIGH' as const },
  { pattern: 'hard to find tickets', type: 'fake_event_ticket', weight: 15, severity: 'MEDIUM' as const },
  { pattern: 'below face value', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },
  { pattern: 'below face value tickets', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },
  { pattern: 'no questions asked', type: 'fake_event_ticket', weight: 15, severity: 'MEDIUM' as const },
  { pattern: 'e-ticket instant delivery', type: 'fake_event_ticket', weight: 15, severity: 'HIGH' as const },
  { pattern: 'pdf ticket download', type: 'fake_event_ticket', weight: 15, severity: 'MEDIUM' as const },
  { pattern: 'paperless ticket transfer', type: 'fake_event_ticket', weight: 15, severity: 'MEDIUM' as const },

  // Urgency / scarcity pressure
  { pattern: 'selling fast', type: 'ticket_urgency', weight: 15, severity: 'HIGH' as const },
  { pattern: 'limited availability', type: 'ticket_urgency', weight: 10, severity: 'MEDIUM' as const },
  { pattern: 'last chance tickets', type: 'ticket_urgency', weight: 15, severity: 'HIGH' as const },
  { pattern: 'tickets almost gone', type: 'ticket_urgency', weight: 15, severity: 'HIGH' as const },
  { pattern: 'book now before', type: 'ticket_urgency', weight: 10, severity: 'MEDIUM' as const },

  // Payment red flags
  { pattern: 'wire transfer only', type: 'suspicious_payment', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'western union', type: 'suspicious_payment', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'crypto payment only', type: 'suspicious_payment', weight: 20, severity: 'HIGH' as const },
  { pattern: 'pay via bitcoin', type: 'suspicious_payment', weight: 20, severity: 'HIGH' as const },
  { pattern: 'no refund', type: 'suspicious_payment', weight: 15, severity: 'HIGH' as const },
  { pattern: 'all sales final', type: 'suspicious_payment', weight: 15, severity: 'MEDIUM' as const },
  { pattern: 'non-refundable', type: 'suspicious_payment', weight: 10, severity: 'MEDIUM' as const },
  { pattern: 'cash only', type: 'suspicious_payment', weight: 20, severity: 'HIGH' as const },
  { pattern: 'zelle payment', type: 'suspicious_payment', weight: 10, severity: 'MEDIUM' as const },
  { pattern: 'no buyer protection', type: 'suspicious_payment', weight: 20, severity: 'HIGH' as const },

  // Contact/method red flags
  { pattern: 'whatsapp ticket', type: 'ticket_scam_method', weight: 20, severity: 'HIGH' as const },
  { pattern: 'telegram ticket', type: 'ticket_scam_method', weight: 20, severity: 'HIGH' as const },
  { pattern: 'dm for tickets', type: 'ticket_scam_method', weight: 20, severity: 'HIGH' as const },
  { pattern: 'direct message for tickets', type: 'ticket_scam_method', weight: 20, severity: 'HIGH' as const },
  { pattern: 'meet in person', type: 'ticket_scam_method', weight: 15, severity: 'MEDIUM' as const },
  { pattern: 'pickup only', type: 'ticket_scam_method', weight: 15, severity: 'MEDIUM' as const },
];

// ─── FIFA Official Domains (never flag as scam) ───────────────────────────────

const FIFA_OFFICIAL_DOMAINS = [
  'fifa.com',
  'fifa.org',
  'fifaworldcup.com',
  'fifaworldcup26.com',
  'fifaconnect.com',
  'fifadata.azurewebsites.net',
];

// ─── Authorized Ticket Sellers ────────────────────────────────────────────────

const AUTHORIZED_TICKET_SELLERS = [
  'fifa.com',
  'fifaworldcup.com',
  'match-hospitality.com',
  'stubhub.com',
  'ticketmaster.com',
  'viagogo.com',
  'seatgeek.com',
  'vivaticket.com',
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
  // FIFA official
  'fifa.com', 'fifaworldcup.com', 'fifa.org',
  // Authorized ticket resale platforms
  'stubhub.com', 'ticketmaster.com', 'viagogo.com', 'seatgeek.com',
  'vivaticket.com', 'match-hospitality.com',
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

function isAuthorizedTicketSeller(domain: string): boolean {
  return AUTHORIZED_TICKET_SELLERS.some(seller =>
    domain === seller || domain.endsWith('.' + seller)
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

function analyzeContent(html: string, _domain: string): ThreatDetection[] {
  const threats: ThreatDetection[] = [];
  const lowerHtml = html.toLowerCase();
  const domain = _domain.toLowerCase();
  
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
  
  // Check event ticket scam keywords (World Cup 2026 & major events)
  for (const keyword of EVENT_TICKET_SCAM_KEYWORDS) {
    if (lowerHtml.includes(keyword.pattern)) {
      threats.push({
        type: keyword.type,
        severity: keyword.severity,
        description: getThreatDescription(keyword.type),
        evidence: `Ticket scam keyword: "${keyword.pattern}"`,
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

  // ─── Event Ticket Specific Checks ──────────────────────────────────────

  // Check for FIFA impersonation claims (e.g., "official FIFA partner")
  const fifaImpersonationPatterns = [
    { pattern: 'official fifa partner', severity: 'CRITICAL' as const, weight: 30 },
    { pattern: 'fifa authorized', severity: 'CRITICAL' as const, weight: 30 },
    { pattern: 'fifa approved', severity: 'CRITICAL' as const, weight: 30 },
    { pattern: 'authorized fifa ticket', severity: 'CRITICAL' as const, weight: 30 },
    { pattern: 'fifa official reseller', severity: 'CRITICAL' as const, weight: 30 },
    { pattern: 'fifa world cup official tickets', severity: 'CRITICAL' as const, weight: 25 },
    { pattern: 'fifa certified', severity: 'CRITICAL' as const, weight: 25 },
    { pattern: 'concacaf official', severity: 'HIGH' as const, weight: 20 },
  ];

  // If domain is NOT FIFA official, flag impersonation claims
  const isFifaOfficial = FIFA_OFFICIAL_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
  if (!isFifaOfficial) {
    for (const imp of fifaImpersonationPatterns) {
      if (lowerHtml.includes(imp.pattern)) {
        threats.push({
          type: 'fifa_impersonation',
          severity: imp.severity,
          description: 'Claiming FIFA authorization — FIFA.com is the ONLY authorized ticket source for World Cup 2026',
          evidence: `Pattern: "${imp.pattern}" on non-FIFA domain`,
          weight: imp.weight,
        });
      }
    }
  }

  // Check for ticket-specific page elements only when scam indicators present
  const hasScamIndicator = threats.some(t => 
    ['fake_event_ticket', 'ticket_urgency', 'suspicious_payment', 'ticket_scam_method', 'fifa_impersonation'].includes(t.type)
  );
  
  if (hasScamIndicator) {
    const ticketPagePatterns = [
      { pattern: 'add to cart', type: 'ticket_ecommerce', severity: 'LOW' as const, weight: 3 },
      { pattern: 'checkout', type: 'ticket_ecommerce', severity: 'LOW' as const, weight: 3 },
      { pattern: 'seat selection', type: 'ticket_ecommerce', severity: 'LOW' as const, weight: 5 },
      { pattern: 'stadium map', type: 'ticket_ecommerce', severity: 'LOW' as const, weight: 3 },
      { pattern: 'vip package', type: 'ticket_ecommerce', severity: 'MEDIUM' as const, weight: 5 },
      { pattern: 'hospitality package', type: 'ticket_ecommerce', severity: 'MEDIUM' as const, weight: 5 },
    ];

    for (const tp of ticketPagePatterns) {
      if (lowerHtml.includes(tp.pattern)) {
        threats.push({
          type: tp.type,
          severity: tp.severity,
          description: 'Ticket sale page with scam indicators present',
          evidence: `Pattern: "${tp.pattern}"`,
          weight: tp.weight,
        });
      }
    }
  }

  // Check for recently created domain signal (copyright 2026 + ticket keywords)
  if (lowerHtml.includes('copyright 2026') && lowerHtml.includes('ticket')) {
    threats.push({
      type: 'recent_domain_ticket',
      severity: 'HIGH',
      description: 'Site appears newly created for 2026 event ticket sales — common scam pattern',
      evidence: 'Copyright 2026 + ticket keywords on same page',
      weight: 15,
    });
  }

  // Check for no physical address / company info on ticket sites
  const hasTicketKeywords = lowerHtml.includes('ticket') && 
    (lowerHtml.includes('world cup') || lowerHtml.includes('fifa') || lowerHtml.includes('2026'));
  const hasContactInfo = lowerHtml.includes('address') && 
    (lowerHtml.includes('street') || lowerHtml.includes('ave') || lowerHtml.includes('road') || lowerHtml.includes('blvd'));
  const hasCompanyInfo = lowerHtml.includes('llc') || lowerHtml.includes('inc.') || lowerHtml.includes('ltd') || lowerHtml.includes('corp');
  if (hasTicketKeywords && !hasContactInfo && !hasCompanyInfo) {
    threats.push({
      type: 'no_seller_info',
      severity: 'MEDIUM',
      description: 'Ticket selling site with no verifiable business address or company info',
      evidence: 'Ticket keywords present but no company/address details found',
      weight: 10,
    });
  }

  // Check for pressure tactics specific to event tickets
  const pressurePatterns = [
    { pattern: 'selling fast', type: 'ticket_urgency', weight: 10, severity: 'MEDIUM' as const },
    { pattern: 'price increases soon', type: 'ticket_urgency', weight: 15, severity: 'HIGH' as const },
    { pattern: 'book now pay later', type: 'ticket_urgency', weight: 10, severity: 'MEDIUM' as const },
    { pattern: 'reserve your seat', type: 'ticket_urgency', weight: 10, severity: 'MEDIUM' as const },
  ];

  for (const pp of pressurePatterns) {
    if (lowerHtml.includes(pp.pattern)) {
      threats.push({
        type: pp.type,
        severity: pp.severity,
        description: 'High-pressure ticket sales tactic',
        evidence: `Pressure pattern: "${pp.pattern}"`,
        weight: pp.weight,
      });
    }
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
    // Event ticket scam descriptions
    fake_event_ticket: 'Fake event ticket scam — verify tickets only at official sources',
    ticket_urgency: 'High-pressure ticket sales tactics — designed to force rushed decisions',
    suspicious_payment: 'Suspicious payment method — no buyer protection, likely a scam',
    ticket_scam_method: 'Dodgy ticket selling method — high risk of non-delivery',
    fifa_impersonation: 'FIFA impersonation — only FIFA.com sells official World Cup 2026 tickets',
    ticket_ecommerce: 'Ticket sales page with scam indicators — verify seller is authorized',
    recent_domain_ticket: 'Recently created site selling event tickets — common scam pattern',
    no_seller_info: 'No verifiable business info — legitimate ticket sellers always provide company details',
  };
  return descriptions[type] || 'Suspicious activity';
}

function calculateRiskScore(threats: ThreatDetection[], scamIndicators: string[] = []): number {
  const totalWeight = threats.reduce((sum, t) => sum + t.weight, 0);
  
  // Add weight for scam indicators from web search (2 points each, max 10)
  const indicatorWeight = Math.min(scamIndicators.length * 2, 10);
  
  const combinedWeight = totalWeight + indicatorWeight;
  
  // 30+ points = CRITICAL (10), 20+ = HIGH (7), 10+ = MEDIUM (5)
  if (combinedWeight >= 30) return Math.min(10, Math.round(combinedWeight / 5));
  if (combinedWeight >= 20) return Math.min(8, Math.round(combinedWeight / 4));
  if (combinedWeight >= 10) return Math.min(5, Math.round(combinedWeight / 3));
  if (combinedWeight >= 5) return Math.min(4, Math.round(combinedWeight / 2));
  return Math.min(Math.round((combinedWeight / 10) * 10) / 10, 10);
}

function getRiskLevel(score: number, threats: ThreatDetection[] = [], scamIndicators: string[] = []): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  // Any CRITICAL threat automatically elevates to CRITICAL level
  if (threats.some(t => t.severity === 'CRITICAL')) {
    return 'CRITICAL';
  }
  // Multiple scam indicators from web search elevates risk
  if (scamIndicators.length >= 5) return 'HIGH';
  if (scamIndicators.length >= 3) return 'MEDIUM';
  
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

async function searchScamReports(domain: string, isTicketRelated?: boolean): Promise<{ results: SearchResult[]; scamIndicators: string[] }> {
  const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
  
  if (!BRAVE_API_KEY) {
    return { results: [], scamIndicators: [] };
  }
  
  try {
    // Build search query — add World Cup ticket context if domain seems ticket-related
    let searchQuery = `${domain} scam legit review warning`;
    if (isTicketRelated) {
      searchQuery = `${domain} scam fake tickets legit review FIFA World Cup 2026`;
    }
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
      /fake tickets/i, /ticket scam/i, /invalid tickets/i,
      /refused entry/i, /not authentic/i, /counterfeit/i,
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

async function checkReputation(domain: string, isTicketRelated?: boolean): Promise<{ results: ReputationResult[]; webSearchResults?: SearchResult[] }> {
  const reputationResults: ReputationResult[] = [];
  
  // Always add static reputation links
  reputationResults.push({
    source: 'ScamAdviser',
    verdict: 'Check recommended',
    details: `https://www.scamadviser.com/check-website/${domain}`,
  });
  reputationResults.push({
    source: 'Scam Detector',
    verdict: 'Check recommended',
    details: `https://www.scam-detector.com/validator/${domain.replace('.', '-')}-review/`,
  });
  reputationResults.push({
    source: 'Trustpilot',
    verdict: 'Check reviews',
    details: `https://www.trustpilot.com/review/${domain}`,
  });

  // Add FIFA-specific verification links for ticket-related domains
  if (isTicketRelated) {
    reputationResults.push({
      source: 'FIFA Official',
      verdict: 'Official tickets only at FIFA.com',
      details: 'https://www.fifa.com/tickets',
    });
    reputationResults.push({
      source: 'FIFA Integrity',
      verdict: 'Report FIFA ticket fraud',
      details: 'https://www.fifa.com/about-fifa/organisation/integrity',
    });
    reputationResults.push({
      source: 'WHOIS',
      verdict: 'Check domain registration date',
      details: `https://who.is/whois/${domain}`,
    });
  }
  
  // Try to get live search results if API key is available
  const { results: searchResults, scamIndicators } = await searchScamReports(domain, isTicketRelated);
  
  if (searchResults.length > 0) {
    reputationResults.push({
      source: 'Web Search',
      verdict: scamIndicators.length > 0 ? `${scamIndicators.length} potential scam indicators found` : 'No obvious scam indicators',
      details: scamIndicators.slice(0, 3).join('; ') || 'Search completed',
    });
    return { results: reputationResults, webSearchResults: searchResults };
  }
  
  return { results: reputationResults };
}

function generateRecommendations(threats: ThreatDetection[], isLegit: boolean, domain?: string): string[] {
  if (isLegit) {
    return ['✅ Known legitimate domain', '🔐 Still verify URL is correct'];
  }
  
  const recs: string[] = [];
  const hasTicketScam = threats.some(t => 
    ['fake_event_ticket', 'ticket_urgency', 'suspicious_payment', 'ticket_scam_method', 'fifa_impersonation', 'no_seller_info', 'recent_domain_ticket'].includes(t.type)
  );
  
  // World Cup 2026 ticket-specific recommendations
  if (threats.some(t => t.type === 'fifa_impersonation')) {
    recs.push('🚨 CRITICAL: This site claims FIFA authorization — FIFA is the ONLY official seller');
    recs.push('⚽ Buy World Cup 2026 tickets ONLY at FIFA.com/tickets');
    recs.push('❌ Do NOT purchase from this site');
    recs.push('📋 Report FIFA ticket scams: https://www.fifa.com/about-fifa/organisation/integrity');
  }
  
  if (threats.some(t => t.type === 'fake_event_ticket')) {
    recs.push('🚨 CRITICAL: Potential fake event ticket scam detected');
    recs.push('⚽ World Cup 2026 tickets are ONLY sold via FIFA.com/tickets');
    recs.push('🎫 Authorized resale: StubHub, Ticketmaster, ViaGogo — verify before buying');
    recs.push('❌ Never pay via wire transfer, crypto, or gift cards for event tickets');
  }
  
  if (threats.some(t => t.type === 'suspicious_payment')) {
    recs.push('🚨 CRITICAL: Suspicious payment method — likely a scam');
    recs.push('❌ Wire transfer, crypto, and gift card payments have NO buyer protection');
    recs.push('✅ Only buy tickets from sites with buyer protection (credit card, PayPal)');
  }
  
  if (threats.some(t => t.type === 'ticket_scam_method')) {
    recs.push('⚠️ Dodgy selling method detected — high risk of non-delivery');
    recs.push('❌ Never buy tickets via DM, WhatsApp, or Telegram');
    recs.push('✅ Use authorized resale platforms only');
  }
  
  if (threats.some(t => t.type === 'ticket_urgency')) {
    recs.push('⚠️ High-pressure sales tactics — legitimate sellers don\'t rush you');
    recs.push('🤚 Take your time — real tickets won\'t disappear in seconds');
  }
  
  if (threats.some(t => t.type === 'no_seller_info')) {
    recs.push('⚠️ No verifiable business info found on this ticket site');
    recs.push('🔍 Legitimate sellers always list company name, address, and registration');
  }
  
  if (threats.some(t => t.type === 'recent_domain_ticket')) {
    recs.push('⚠️ This site appears newly created for 2026 event ticket sales');
    recs.push('🔍 Check domain age at who.is — scam sites are often recently registered');
  }
  
  // General recommendations
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
  
  // Add FIFA-specific verification links for any ticket-related threats
  if (hasTicketScam) {
    recs.push('🔗 Verify World Cup 2026 tickets: https://www.fifa.com/tickets');
    if (domain) {
      recs.push(`🔗 Check domain age: https://who.is/whois/${domain}`);
    }
    recs.push('🔗 Report ticket fraud: https://reportfraud.ftc.gov');
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
  let webSearchResults: SearchResult[] | undefined;
  
  // Detect if this is a ticket-related domain
  const isTicketRelated = domain.includes('ticket') || domain.includes('fifa') || domain.includes('worldcup') || domain.includes('wc2026') || domain.includes('worldcup2026') || domain.includes('fifa2026') || domain.includes('hospitality');
  
  // ALWAYS check known scam domains FIRST (even if fetch fails later)
  const knownScamThreat = checkKnownScamDomain(domain);
  if (knownScamThreat) {
    threats.push(knownScamThreat);
  }
  
  // Run reputation check in parallel with content fetch
  let scamIndicators: string[] = [];
  const [reputationResults] = await Promise.allSettled([
    checkReputation(domain, isTicketRelated),
  ]);
  
  if (reputationResults.status === 'fulfilled') {
    reputation = reputationResults.value.results;
    webSearchResults = reputationResults.value.webSearchResults;
    // Extract scam indicators from web search results
    if (reputationResults.value.webSearchResults) {
      const scamPatterns = [
        /scam/i, /fraud/i, /warning/i, /avoid/i, /stolen/i,
        /withdrawal/i, /no response/i, /fake/i, /suspicious/i,
      ];
      
      for (const result of reputationResults.value.webSearchResults) {
        const text = `${result.title} ${result.description}`.toLowerCase();
        for (const pattern of scamPatterns) {
          if (pattern.test(text)) {
            scamIndicators.push(result.title);
            break;
          }
        }
      }
      scamIndicators = [...new Set(scamIndicators)];
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
  
  const riskScore = calculateRiskScore(threats, scamIndicators);
  const riskLevel = getRiskLevel(riskScore, threats, scamIndicators);
  const recommendations = generateRecommendations(threats, isLegit, domain);

  // Determine scan category for frontend
  const hasTicketKeywords = threats.some(t => 
    ['fake_event_ticket', 'ticket_urgency', 'suspicious_payment', 'ticket_scam_method', 'fifa_impersonation', 'no_seller_info', 'recent_domain_ticket', 'ticket_ecommerce'].includes(t.type)
  );
  const scanCategory: 'general' | 'ticket' = hasTicketKeywords || isTicketRelated ? 'ticket' : 'general';
  
  // Queue deep scan if basic scan is inconclusive (fetch error or LOW risk with no threats)
  let deepScanId: string | undefined;
  const shouldQueueDeepScan = threats.some(t => t.type === 'fetch_error') || 
    (riskLevel === 'LOW' && threats.length === 0);
  
  if (shouldQueueDeepScan) {
    const scanId = `deep-${domain}-${Date.now()}`;
    deepScanId = scanId;
    
    // Trigger immediate wake event to OpenClaw agent
    fetch('https://gateway.openclaw.ai/api/cron/wake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'now',
        text: `DEEP SCAN REQUEST: ${validUrl}

Scan ID: ${scanId}
Domain: ${domain}
Category: ${scanCategory}

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
    webSearchResults,
    deepScanId,
    deepScanPollUrl: deepScanId ? `/api/website-deep-scan?scanId=${deepScanId}` : undefined,
    scanDate: new Date().toISOString(),
    scanCategory,
  };
  
  return res.status(200).json(result);
}