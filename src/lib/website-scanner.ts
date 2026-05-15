/**
 * Website Security Scanner Library
 * 
 * Detects:
 * - Wallet drainer scripts
 * - Fake airdrop pages
 * - Phishing clones
 * - Seed phrase harvesting
 * - Private key theft attempts
 * - Malicious contract interactions
 * - Fake event ticket scams (World Cup 2026, major sporting events)
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
  scanCategory?: 'general' | 'ticket';
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

// ─── Event Ticket Scam Keywords (World Cup 2026 & Major Events) ────────────────────

const EVENT_TICKET_SCAM_SIGNATURES: Array<{ pattern: string; type: string; weight: number; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [
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
  { pattern: 'below face value', type: 'fake_event_ticket', weight: 20, severity: 'HIGH' as const },
  { pattern: 'no questions asked', type: 'fake_event_ticket', weight: 15, severity: 'MEDIUM' as const },
  { pattern: 'e-ticket instant delivery', type: 'fake_event_ticket', weight: 15, severity: 'HIGH' as const },

  // Urgency / scarcity pressure
  { pattern: 'selling fast', type: 'ticket_urgency', weight: 15, severity: 'HIGH' as const },
  { pattern: 'limited availability', type: 'ticket_urgency', weight: 10, severity: 'MEDIUM' as const },
  { pattern: 'last chance tickets', type: 'ticket_urgency', weight: 15, severity: 'HIGH' as const },
  { pattern: 'tickets almost gone', type: 'ticket_urgency', weight: 15, severity: 'HIGH' as const },

  // Payment red flags
  { pattern: 'wire transfer only', type: 'suspicious_payment', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'western union', type: 'suspicious_payment', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'crypto payment only', type: 'suspicious_payment', weight: 20, severity: 'HIGH' as const },
  { pattern: 'pay via bitcoin', type: 'suspicious_payment', weight: 20, severity: 'HIGH' as const },
  { pattern: 'no refund', type: 'suspicious_payment', weight: 15, severity: 'HIGH' as const },
  { pattern: 'all sales final', type: 'suspicious_payment', weight: 15, severity: 'MEDIUM' as const },
  { pattern: 'cash only', type: 'suspicious_payment', weight: 20, severity: 'HIGH' as const },
  { pattern: 'no buyer protection', type: 'suspicious_payment', weight: 20, severity: 'HIGH' as const },

  // Contact/method red flags
  { pattern: 'whatsapp ticket', type: 'ticket_scam_method', weight: 20, severity: 'HIGH' as const },
  { pattern: 'telegram ticket', type: 'ticket_scam_method', weight: 20, severity: 'HIGH' as const },
  { pattern: 'dm for tickets', type: 'ticket_scam_method', weight: 20, severity: 'HIGH' as const },
  { pattern: 'direct message for tickets', type: 'ticket_scam_method', weight: 20, severity: 'HIGH' as const },

  // FIFA impersonation
  { pattern: 'official fifa partner', type: 'fifa_impersonation', weight: 30, severity: 'CRITICAL' as const },
  { pattern: 'fifa authorized', type: 'fifa_impersonation', weight: 30, severity: 'CRITICAL' as const },
  { pattern: 'fifa approved', type: 'fifa_impersonation', weight: 30, severity: 'CRITICAL' as const },
  { pattern: 'authorized fifa ticket', type: 'fifa_impersonation', weight: 30, severity: 'CRITICAL' as const },
  { pattern: 'fifa official reseller', type: 'fifa_impersonation', weight: 30, severity: 'CRITICAL' as const },
  { pattern: 'fifa certified', type: 'fifa_impersonation', weight: 25, severity: 'CRITICAL' as const },
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

const KNOWN_DRAINER_DOMAINS = [
  'wallet-connect.xyz',
  'walletconnect-validator.com',
  'nft-airdrop.io',
  'token-claim.xyz',
];

const LEGITIMATE_DOMAINS = [
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
  // FIFA official
  'fifa.com', 'fifaworldcup.com', 'fifa.org',
  // Authorized ticket resale platforms
  'stubhub.com', 'ticketmaster.com', 'viagogo.com', 'seatgeek.com',
  'vivaticket.com', 'match-hospitality.com',
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
  const domain = extractDomain(url).toLowerCase();
  
  // Check each wallet drainer pattern
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

  // Check event ticket scam patterns
  for (const sig of EVENT_TICKET_SCAM_SIGNATURES) {
    if (lowerHtml.includes(sig.pattern)) {
      threats.push({
        type: sig.type,
        severity: sig.severity,
        description: getThreatDescription(sig.type),
        evidence: `Ticket scam keyword: "${sig.pattern}"`,
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

  // Check for recently registered domain signal (copyright 2026 + ticket keywords)
  if (lowerHtml.includes('copyright 2026') && lowerHtml.includes('ticket')) {
    threats.push({
      type: 'recent_domain_ticket',
      severity: 'HIGH',
      description: 'Site appears newly created for 2026 event ticket sales — common scam pattern',
      evidence: 'Copyright 2026 + ticket keywords on same page',
      weight: 15,
    });
  }

  // Check for no business info on ticket sites
  const hasTicketKeywords = lowerHtml.includes('ticket') && 
    (lowerHtml.includes('world cup') || lowerHtml.includes('fifa') || lowerHtml.includes('2026'));
  const hasContactInfo = lowerHtml.includes('address') && 
    (lowerHtml.includes('street') || lowerHtml.includes('ave') || lowerHtml.includes('road'));
  const hasCompanyInfo = lowerHtml.includes('llc') || lowerHtml.includes('inc.') || lowerHtml.includes('ltd');
  if (hasTicketKeywords && !hasContactInfo && !hasCompanyInfo) {
    threats.push({
      type: 'no_seller_info',
      severity: 'MEDIUM',
      description: 'Ticket selling site with no verifiable business address or company info',
      evidence: 'Ticket keywords present but no company/address details found',
      weight: 10,
    });
  }

  // FIFA impersonation check on non-FIFA domains
  const isFifaOfficial = FIFA_OFFICIAL_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
  if (!isFifaOfficial) {
    const fifaImpersonationPatterns = [
      'official fifa partner', 'fifa authorized', 'fifa approved',
      'authorized fifa ticket', 'fifa official reseller', 'fifa certified',
    ];
    for (const pattern of fifaImpersonationPatterns) {
      if (lowerHtml.includes(pattern)) {
        threats.push({
          type: 'fifa_impersonation',
          severity: 'CRITICAL',
          description: 'Claiming FIFA authorization — FIFA.com is the ONLY authorized ticket source for World Cup 2026',
          evidence: `Pattern: "${pattern}" on non-FIFA domain ${domain}`,
          weight: 30,
        });
        break; // Only flag once
      }
    }
  }
  
  return threats;
}

export function calculateRiskScore(threats: ThreatDetection[]): number {
  const totalWeight = threats.reduce((sum, t) => sum + t.weight, 0);
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
    fake_event_ticket: 'Fake event ticket scam — verify tickets only at official sources',
    ticket_urgency: 'High-pressure ticket sales tactics — designed to force rushed decisions',
    suspicious_payment: 'Suspicious payment method — no buyer protection, likely a scam',
    ticket_scam_method: 'Dodgy ticket selling method — high risk of non-delivery',
    fifa_impersonation: 'FIFA impersonation — only FIFA.com sells official World Cup 2026 tickets',
    recent_domain_ticket: 'Recently created site selling event tickets — common scam pattern',
    no_seller_info: 'No verifiable business info — legitimate ticket sellers always provide company details',
  };
  return descriptions[type] || 'Suspicious activity detected';
}

export function generateRecommendations(threats: ThreatDetection[]): string[] {
  const recommendations: string[] = [];
  
  const hasTicketScam = threats.some(t => 
    ['fake_event_ticket', 'ticket_urgency', 'suspicious_payment', 'ticket_scam_method', 'fifa_impersonation', 'no_seller_info', 'recent_domain_ticket'].includes(t.type)
  );

  // FIFA / World Cup 2026 specific
  if (threats.some(t => t.type === 'fifa_impersonation')) {
    recommendations.push('🚨 CRITICAL: This site claims FIFA authorization — FIFA is the ONLY official seller');
    recommendations.push('⚽ Buy World Cup 2026 tickets ONLY at FIFA.com/tickets');
    recommendations.push('❌ Do NOT purchase from this site');
    recommendations.push('📋 Report FIFA ticket scams: https://www.fifa.com/about-fifa/organisation/integrity');
  }

  if (threats.some(t => t.type === 'fake_event_ticket')) {
    recommendations.push('🚨 CRITICAL: Potential fake event ticket scam detected');
    recommendations.push('⚽ World Cup 2026 tickets are ONLY sold via FIFA.com/tickets');
    recommendations.push('🎫 Authorized resale: StubHub, Ticketmaster, ViaGogo — verify before buying');
    recommendations.push('❌ Never pay via wire transfer, crypto, or gift cards for event tickets');
  }

  if (threats.some(t => t.type === 'suspicious_payment')) {
    recommendations.push('🚨 CRITICAL: Suspicious payment method — likely a scam');
    recommendations.push('❌ Wire transfer, crypto, and gift card payments have NO buyer protection');
    recommendations.push('✅ Only buy tickets from sites with buyer protection (credit card, PayPal)');
  }

  if (threats.some(t => t.type === 'ticket_scam_method')) {
    recommendations.push('⚠️ Dodgy selling method detected — high risk of non-delivery');
    recommendations.push('❌ Never buy tickets via DM, WhatsApp, or Telegram');
    recommendations.push('✅ Use authorized resale platforms only');
  }

  if (threats.some(t => t.type === 'ticket_urgency')) {
    recommendations.push('⚠️ High-pressure sales tactics — legitimate sellers don\'t rush you');
    recommendations.push('🤚 Take your time — real tickets won\'t disappear in seconds');
  }

  if (threats.some(t => t.type === 'no_seller_info')) {
    recommendations.push('⚠️ No verifiable business info found on this ticket site');
    recommendations.push('🔍 Legitimate sellers always list company name, address, and registration');
  }

  if (threats.some(t => t.type === 'recent_domain_ticket')) {
    recommendations.push('⚠️ This site appears newly created for 2026 event ticket sales');
    recommendations.push('🔍 Check domain age at who.is — scam sites are often recently registered');
  }

  if (hasTicketScam) {
    recommendations.push('🔗 Verify World Cup 2026 tickets: https://www.fifa.com/tickets');
    recommendations.push('🔗 Report ticket fraud: https://reportfraud.ftc.gov');
  }

  // General crypto security recommendations
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
  
  return [...new Set(recommendations)];
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
      scanCategory: domain.includes('fifa') || domain.includes('ticket') ? 'ticket' : 'general',
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
      scanCategory: 'general',
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
  const hasTicketKeywords = threats.some(t => 
    ['fake_event_ticket', 'ticket_urgency', 'suspicious_payment', 'ticket_scam_method', 'fifa_impersonation', 'no_seller_info', 'recent_domain_ticket'].includes(t.type)
  );
  const isTicketRelated = domain.includes('ticket') || domain.includes('fifa') || domain.includes('worldcup') || hasTicketKeywords;
  
  return {
    success: true,
    url,
    domain,
    riskScore,
    riskLevel,
    threats,
    recommendations,
    scanDate: new Date().toISOString(),
    scanCategory: isTicketRelated ? 'ticket' : 'general',
  };
}

export default scanWebsite;