/**
 * api/website-scan.ts — Website Security Scanner API
 * =====================================================
 * Enhanced with:
 *   1. Google Safe Browsing API (live phishing/malware database)
 *   2. urlscan.io integration (independent verdict + IP/ASN/screenshot)
 *   3. TLD risk scoring (.xyz, .tk, .ml, .top, etc.)
 *   4. Redirect chain detection (expose multi-hop redirects)
 *   5. IP & hosting analysis (ipwho.is — country, ISP, bulletproof flag)
 *   6. Own community reports (website_community_reports Supabase table)
 *
 * POST /api/website-scan
 * Body: { url: string, brand_monitor_id?: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 25 };

// ─── Types ────────────────────────────────────────────────────────────────────

type ThreatDetection = {
  type:        string;
  severity:    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence?:   string;
  weight:      number;
};

interface ReputationResult {
  source:   string;
  score?:   number;
  verdict:  string;
  details?: string;
}

interface DomainInfo {
  registeredDate?: string;
  domainAgeDays?:  number;
  registrar?:      string;
  isNewDomain?:    boolean;
}

interface PaymentAnalysis {
  detectedMethods:  string[];
  safeMethods:      string[];
  riskyMethods:     string[];
  paymentProviders: string[];
  hasBuyerProtection: boolean;
  riskAssessment:   'SAFE' | 'MIXED' | 'RISKY' | 'DANGEROUS';
}

interface SafeBrowsingResult {
  flagged:  boolean;
  threats:  { type: string; platform: string }[];
}

interface UrlScanIoResult {
  found:        boolean;
  verdict:      'malicious' | 'suspicious' | 'benign' | 'unknown';
  score:        number | null;
  screenshotUrl: string | null;
  reportUrl:    string | null;
  country:      string | null;
  asnName:      string | null;
  scanDate:     string | null;
}

interface IPHostingInfo {
  ip:              string | null;
  country:         string | null;
  countryCode:     string | null;
  city:            string | null;
  isp:             string | null;
  org:             string | null;
  asn:             string | null;
  isHosting:       boolean;
  isBulletproof:   boolean;
  hostingProvider: string | null;
}

interface WebsiteScanResult {
  success:      boolean;
  url:          string;
  finalUrl?:    string;
  domain:       string;
  riskScore:    number;
  riskLevel:    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threats:      ThreatDetection[];
  recommendations: string[];
  reputation?:  ReputationResult[];
  scamIndicators?: string[];
  webSearchResults?: SearchResult[];
  deepScanId?:  string;
  deepScanPollUrl?: string;
  scanDate:     string;
  scanCategory?: 'general' | 'ticket' | 'crypto_casino' | 'brand_impersonation';
  domainInfo?:  DomainInfo;
  paymentAnalysis?: PaymentAnalysis;
  brandImpersonationInfo?: { is_lookalike: boolean; brand_domain: string | null; similarity: number; variant_type: string } | null;
  // ── New enhanced fields ──
  redirectChain?:       string[];
  safeBrowsing?:        SafeBrowsingResult | null;
  urlScanInfo?:         UrlScanIoResult | null;
  ipInfo?:              IPHostingInfo | null;
  ownCommunityReports?: number;
}

// ─── High-Risk TLDs ───────────────────────────────────────────────────────────

const HIGH_RISK_TLDS: Record<string, { score: number; severity: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string }> = {
  tk:     { score: 20, severity: 'HIGH',   reason: 'Free TLD with highest global scam/phishing rate' },
  ml:     { score: 20, severity: 'HIGH',   reason: 'Free TLD — extremely high malware and phishing rate' },
  ga:     { score: 20, severity: 'HIGH',   reason: 'Free TLD — extremely high scam rate' },
  cf:     { score: 20, severity: 'HIGH',   reason: 'Free TLD — among highest phishing rates worldwide' },
  gq:     { score: 20, severity: 'HIGH',   reason: 'Free TLD — extremely high scam rate' },
  xyz:    { score: 15, severity: 'MEDIUM', reason: 'Very cheap TLD heavily abused by scammers and phishers' },
  top:    { score: 15, severity: 'MEDIUM', reason: 'Among highest scam rates of any paid TLD' },
  click:  { score: 15, severity: 'MEDIUM', reason: 'Frequently used in phishing and malvertising campaigns' },
  work:   { score: 12, severity: 'MEDIUM', reason: 'Commonly used in job scams and investment fraud' },
  online: { score: 10, severity: 'MEDIUM', reason: 'Common in fake stores and phishing sites' },
  site:   { score: 10, severity: 'MEDIUM', reason: 'High usage in scam and phishing sites' },
  club:   { score: 8,  severity: 'LOW',    reason: 'Frequently used in crypto and investment scam sites' },
  live:   { score: 8,  severity: 'LOW',    reason: 'Common in streaming and tech support scams' },
  shop:   { score: 6,  severity: 'LOW',    reason: 'High fake store/counterfeit scam usage' },
  store:  { score: 6,  severity: 'LOW',    reason: 'Common in fake merchandise and dropship scams' },
  info:   { score: 5,  severity: 'LOW',    reason: 'Historically high spam and scam usage' },
  biz:    { score: 5,  severity: 'LOW',    reason: 'Historically higher scam rate than .com/.org' },
};

// ─── Bulletproof / high-risk hosting providers ───────────────────────────────

const BULLETPROOF_HOSTING_PATTERNS = [
  'colocrossing', 'colox', 'serverius', 'combahton', 'ecatel',
  'quasi networks', 'frantech', 'buyvm', 'voxility', 'marosnet',
  'baxet', 'selectel', 'serverplace', 'verdina', 'netzbetrieb',
];

// ─── Known Scam Domains ───────────────────────────────────────────────────────

const KNOWN_SCAM_DOMAINS: Record<string, { regulator: string; warning: string }> = {
  'tradevectorai-app.org':       { regulator: 'FCA',        warning: 'UK FCA warning — unauthorised investment firm' },
  'fastinvest.com':              { regulator: 'MULTIPLE',   warning: 'Multiple scam reports — no withdrawals, regulatory warning' },
  'trade-vectorai.net':          { regulator: 'FCA',        warning: 'UK FCA warning — unauthorised investment firm' },
  'tradevectorai.net':           { regulator: 'FCA',        warning: 'UK FCA warning — unauthorised investment firm' },
  'tradevectorai-official.com':  { regulator: 'FCA',        warning: 'UK FCA warning — unauthorised investment firm' },
  'trade.errors-app.org':        { regulator: 'SUSPICIOUS', warning: 'Suspicious domain pattern associated with scams' },
  'trade-errors-app.org':        { regulator: 'SUSPICIOUS', warning: 'Suspicious domain pattern associated with scams' },
  'fifa2026tickets.com':         { regulator: 'FIFA',       warning: 'Fake World Cup 2026 ticket site — FIFA.com is the ONLY authorized seller' },
  'worldcup2026tickets.com':     { regulator: 'FIFA',       warning: 'Fake World Cup 2026 ticket site — NOT authorized by FIFA' },
  'fifaworldcup2026tickets.com': { regulator: 'FIFA',       warning: 'Fake World Cup 2026 ticket site — FIFA.com is the ONLY source' },
  'wc2026tickets.com':           { regulator: 'FIFA',       warning: 'Fake World Cup 2026 ticket reseller — unauthorized' },
  '2026worldcuptickets.com':     { regulator: 'FIFA',       warning: 'Fake World Cup 2026 ticket site — not authorized by FIFA' },
  'worldcuptickets2026.com':     { regulator: 'FIFA',       warning: 'Fake World Cup 2026 ticket site — FIFA is the ONLY official source' },
  'fifatickets2026.com':         { regulator: 'FIFA',       warning: 'Impersonates FIFA — only FIFA.com/tickets is official' },
  'fifa2026official.com':        { regulator: 'FIFA',       warning: 'Fake FIFA official site — FIFA only uses FIFA.com domain' },
  'fifafans2026.com':            { regulator: 'FIFA',       warning: 'Fake FIFA fan site used for ticket scams' },
  'worldcup-hospitality.com':    { regulator: 'FIFA',       warning: 'Fake hospitality reseller — FIFA Hospitality is the ONLY authorized program' },
  'matchhospitality2026.com':    { regulator: 'FIFA',       warning: 'Fake hospitality reseller — not affiliated with FIFA/MATCH Hospitality' },
};

const SCAM_DOMAIN_PATTERNS = [
  { pattern: /tradevectorai/i,     regulator: 'FCA',        warning: 'UK FCA warned entity', weight: 30 },
  { pattern: /trade-vectorai/i,    regulator: 'FCA',        warning: 'UK FCA warned entity', weight: 30 },
  { pattern: /errors-app/i,        regulator: 'SUSPICIOUS', warning: 'Suspicious domain pattern', weight: 25 },
  { pattern: /vectorai-app/i,      regulator: 'FCA',        warning: 'Associated with FCA warned entity', weight: 25 },
  { pattern: /fifa.*2026.*ticket/i, regulator: 'FIFA',       warning: 'Fake FIFA World Cup 2026 ticket site', weight: 30 },
  { pattern: /worldcup.*2026.*ticket/i, regulator: 'FIFA',   warning: 'Fake World Cup 2026 ticket site', weight: 30 },
  { pattern: /2026.*worldcup.*ticket/i, regulator: 'FIFA',   warning: 'Fake World Cup 2026 ticket site', weight: 30 },
  { pattern: /wc2026.*ticket/i,    regulator: 'FIFA',       warning: 'Fake World Cup 2026 ticket site', weight: 30 },
  { pattern: /fifaticket/i,        regulator: 'FIFA',       warning: 'Impersonates FIFA ticket sales', weight: 30 },
  { pattern: /worldcup.*hospitality/i, regulator: 'FIFA',   warning: 'Fake World Cup hospitality reseller', weight: 25 },
  { pattern: /copa.*america.*2026.*ticket/i, regulator: 'CONCACAF', warning: 'Suspect Copa America 2026 ticket reseller', weight: 20 },
];

// ─── Content Keyword Lists (unchanged from original) ─────────────────────────

const WALLET_DRAINER_SIGNATURES = [
  { pattern: 'seed phrase',       type: 'seed_harvesting',  weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'recovery phrase',   type: 'seed_harvesting',  weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'mnemonic',          type: 'seed_harvesting',  weight: 20, severity: 'CRITICAL' as const },
  { pattern: 'private key',       type: 'key_harvesting',   weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'enter your seed',   type: 'seed_harvesting',  weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'import wallet',     type: 'wallet_import',    weight: 15, severity: 'HIGH' as const },
  { pattern: 'drainer',           type: 'drainer_script',   weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'sign drain',        type: 'drainer_script',   weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'claim free',        type: 'fake_airdrop',     weight: 15, severity: 'HIGH' as const },
  { pattern: 'free airdrop',      type: 'fake_airdrop',     weight: 15, severity: 'HIGH' as const },
  { pattern: 'connect to claim',  type: 'fake_airdrop',     weight: 20, severity: 'CRITICAL' as const },
  { pattern: 'verify your wallet', type: 'phishing',        weight: 20, severity: 'CRITICAL' as const },
  { pattern: 'wallet verification', type: 'phishing',       weight: 20, severity: 'CRITICAL' as const },
  { pattern: 'suspicious activity', type: 'phishing',       weight: 15, severity: 'HIGH' as const },
];

const INVESTMENT_FRAUD_KEYWORDS = [
  { pattern: 'recover your investment', type: 'investment_fraud',     weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'recover your funds',      type: 'investment_fraud',     weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'fund recovery',           type: 'investment_fraud',     weight: 20, severity: 'HIGH' as const },
  { pattern: 'account suspended',       type: 'brokerage_phishing',   weight: 15, severity: 'HIGH' as const },
  { pattern: 'account locked',          type: 'brokerage_phishing',   weight: 15, severity: 'HIGH' as const },
];

const EVENT_TICKET_SCAM_KEYWORDS = [
  { pattern: 'world cup 2026 tickets',      type: 'fake_event_ticket',   weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'fifa 2026 tickets',           type: 'fake_event_ticket',   weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'guaranteed world cup tickets', type: 'fake_event_ticket',  weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'buy world cup tickets',        type: 'fake_event_ticket',  weight: 20, severity: 'HIGH' as const },
  { pattern: 'world cup tickets for sale',   type: 'fake_event_ticket',  weight: 20, severity: 'HIGH' as const },
  { pattern: 'cheap world cup tickets',      type: 'fake_event_ticket',  weight: 20, severity: 'HIGH' as const },
  { pattern: 'official ticket reseller',     type: 'fake_event_ticket',  weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'authorized ticket vendor',     type: 'fake_event_ticket',  weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'fifa approved seller',         type: 'fake_event_ticket',  weight: 25, severity: 'CRITICAL' as const },
  { pattern: '100% guaranteed tickets',      type: 'fake_event_ticket',  weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'below face value',             type: 'fake_event_ticket',  weight: 20, severity: 'HIGH' as const },
  { pattern: 'selling fast',                 type: 'ticket_urgency',     weight: 15, severity: 'HIGH' as const },
  { pattern: 'last chance tickets',          type: 'ticket_urgency',     weight: 15, severity: 'HIGH' as const },
  { pattern: 'wire transfer only',           type: 'suspicious_payment', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'western union',               type: 'suspicious_payment', weight: 25, severity: 'CRITICAL' as const },
  { pattern: 'crypto payment only',          type: 'suspicious_payment', weight: 20, severity: 'HIGH' as const },
  { pattern: 'pay via bitcoin',             type: 'suspicious_payment', weight: 20, severity: 'HIGH' as const },
  { pattern: 'cash only',                   type: 'suspicious_payment', weight: 20, severity: 'HIGH' as const },
  { pattern: 'whatsapp ticket',             type: 'ticket_scam_method', weight: 20, severity: 'HIGH' as const },
  { pattern: 'telegram ticket',             type: 'ticket_scam_method', weight: 20, severity: 'HIGH' as const },
  { pattern: 'dm for tickets',              type: 'ticket_scam_method', weight: 20, severity: 'HIGH' as const },
];

const CRYPTO_CASINO_KEYWORDS = [
  { pattern: 'crypto casino',       type: 'fake_casino',      weight: 20, severity: 'HIGH' as const },
  { pattern: 'blockchain casino',   type: 'fake_casino',      weight: 20, severity: 'HIGH' as const },
  { pattern: 'bitcoin casino',      type: 'fake_casino',      weight: 20, severity: 'HIGH' as const },
  { pattern: 'solana casino',       type: 'fake_casino',      weight: 20, severity: 'HIGH' as const },
  { pattern: 'online casino',       type: 'fake_casino',      weight: 15, severity: 'MEDIUM' as const },
  { pattern: 'crypto slots',        type: 'fake_casino',      weight: 20, severity: 'HIGH' as const },
  { pattern: 'crypto betting',      type: 'fake_casino',      weight: 20, severity: 'HIGH' as const },
  { pattern: 'provably fair',       type: 'fake_casino',      weight: 10, severity: 'MEDIUM' as const },
  { pattern: 'crash game',          type: 'fake_casino',      weight: 15, severity: 'MEDIUM' as const },
  { pattern: 'plinko',              type: 'fake_casino',      weight: 10, severity: 'LOW' as const },
  { pattern: 'deposit bonus',       type: 'casino_lure',      weight: 15, severity: 'HIGH' as const },
  { pattern: 'no deposit bonus',    type: 'casino_lure',      weight: 15, severity: 'HIGH' as const },
  { pattern: 'free spins',          type: 'casino_lure',      weight: 10, severity: 'MEDIUM' as const },
  { pattern: 'wagering requirement', type: 'casino_withhold', weight: 15, severity: 'HIGH' as const },
  { pattern: 'wager requirement',   type: 'casino_withhold',  weight: 15, severity: 'HIGH' as const },
  { pattern: 'playthrough requirement', type: 'casino_withhold', weight: 15, severity: 'HIGH' as const },
  { pattern: 'withdrawal pending',  type: 'casino_withhold',  weight: 20, severity: 'HIGH' as const },
];

const FIFA_OFFICIAL_DOMAINS   = ['fifa.com', 'fifa.org', 'fifaworldcup.com', 'fifaworldcup26.com'];
const AUTHORIZED_TICKET_SELLERS = ['fifa.com', 'fifaworldcup.com', 'match-hospitality.com', 'stubhub.com', 'ticketmaster.com', 'viagogo.com', 'seatgeek.com', 'vivaticket.com'];
const LEGITIMATE_DOMAINS = [
  'phantom.app', 'metamask.io', 'uniswap.org', 'jupiter.ag', 'raydium.io',
  'pump.fun', 'magiceden.io', 'opensea.io', 'dexscreener.com', 'coingecko.com',
  'coinmarketcap.com', 'binance.com', 'coinbase.com', 'kraken.com', 'bybit.com',
  'okx.com', 'kucoin.com', 'crypto.com', 'gate.io', 'robinhood.com',
  'webull.com', 'etrade.com', 'fidelity.com', 'schwab.com', 'vanguard.com',
  'sofi.com', 'agenticbro.app',
  'fifa.com', 'fifaworldcup.com', 'fifa.org',
  'stubhub.com', 'ticketmaster.com', 'viagogo.com', 'seatgeek.com',
  'vivaticket.com', 'match-hospitality.com',
  // DeFi / trading platforms (wallet connection is expected behavior)
  'bullpen.fi', 'hyperliquid.xyz', 'polymarket.com',
  'driftprotocol.com', 'zeta.markets', 'photon.xyz',
  'axiom.trade', 'bloomtrade.com', 'trojanonbase.com',
  'pumpportal.com', 'birdeye.so', 'rugcheck.xyz',
  'solscan.io', 'solana.fm', 'explorer.solana.com',
];

// ─── Helper: Extract Domain ──────────────────────────────────────────────────

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

function isLegitimateDomain(domain: string): boolean {
  return LEGITIMATE_DOMAINS.some(l => domain === l || domain.endsWith('.' + l));
}

// ─── Levenshtein distance ─────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// ─── 1. TLD Risk Scoring ──────────────────────────────────────────────────────

function checkTLDRisk(domain: string): ThreatDetection | null {
  const parts = domain.split('.');
  const tld = parts[parts.length - 1].toLowerCase();
  const risk = HIGH_RISK_TLDS[tld];
  if (!risk) return null;
  return {
    type:        'high_risk_tld',
    severity:    risk.severity,
    description: `High-risk TLD (.${tld}): ${risk.reason}`,
    evidence:    `Domain extension: .${tld}`,
    weight:      risk.score,
  };
}

// ─── 2. Redirect Chain Detection ─────────────────────────────────────────────

async function followRedirectChain(url: string, maxHops = 6): Promise<{ chain: string[]; finalUrl: string }> {
  const chain: string[] = [url];
  let current = url;

  for (let i = 0; i < maxHops; i++) {
    try {
      const res = await fetch(current, {
        method:   'HEAD',
        redirect: 'manual',
        headers:  { 'User-Agent': 'Mozilla/5.0 (compatible; AgenticBro Scanner)' },
        signal:   AbortSignal.timeout(3000),
      });
      const location = res.headers.get('location');
      if (!location || res.status < 300 || res.status >= 400) break;
      const next = location.startsWith('http') ? location : new URL(location, current).href;
      if (next === current) break;
      chain.push(next);
      current = next;
    } catch {
      break;
    }
  }
  return { chain, finalUrl: current };
}

// ─── 3. Google Safe Browsing ──────────────────────────────────────────────────

async function checkGoogleSafeBrowsing(url: string): Promise<SafeBrowsingResult> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) return { flagged: false, threats: [] };

  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'agenticbro', clientVersion: '2.0' },
          threatInfo: {
            threatTypes:      ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes:    ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries:    [{ url }],
          },
        }),
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return { flagged: false, threats: [] };
    const data = await res.json();
    if (!data.matches?.length) return { flagged: false, threats: [] };
    return {
      flagged:  true,
      threats:  data.matches.map((m: any) => ({ type: m.threatType, platform: m.platformType })),
    };
  } catch {
    return { flagged: false, threats: [] };
  }
}

// ─── 4. urlscan.io ────────────────────────────────────────────────────────────

interface SearchResult {
  title:       string;
  url:         string;
  description: string;
}

async function searchUrlScan(domain: string): Promise<UrlScanIoResult> {
  const dflt: UrlScanIoResult = { found: false, verdict: 'unknown', score: null, screenshotUrl: null, reportUrl: null, country: null, asnName: null, scanDate: null };
  try {
    const res = await fetch(
      `https://urlscan.io/api/v1/search/?q=domain:${encodeURIComponent(domain)}&size=1`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return dflt;
    const data = await res.json();
    if (!data.results?.length) return dflt;

    const scan     = data.results[0];
    const verdicts = scan.verdicts?.overall;
    return {
      found:         true,
      verdict:       verdicts?.malicious ? 'malicious' : verdicts?.suspicious ? 'suspicious' : 'benign',
      score:         verdicts?.score ?? null,
      screenshotUrl: scan.screenshot ?? `https://urlscan.io/screenshots/${scan.id}.png`,
      reportUrl:     `https://urlscan.io/result/${scan.id}/`,
      country:       scan.page?.country ?? null,
      asnName:       scan.page?.asnname ?? null,
      scanDate:      scan.task?.time ?? null,
    };
  } catch {
    return dflt;
  }
}

// ─── 5. IP & Hosting Analysis ─────────────────────────────────────────────────

async function getIPHostingInfo(domain: string): Promise<IPHostingInfo> {
  const dflt: IPHostingInfo = { ip: null, country: null, countryCode: null, city: null, isp: null, org: null, asn: null, isHosting: false, isBulletproof: false, hostingProvider: null };
  try {
    const res = await fetch(
      `https://ipwho.is/${domain}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return dflt;
    const d = await res.json();
    if (!d.success) return dflt;

    const isp      = d.connection?.isp  || '';
    const org      = d.connection?.org  || '';
    const ispLower = isp.toLowerCase();
    const orgLower = org.toLowerCase();

    const isBulletproof = BULLETPROOF_HOSTING_PATTERNS.some(p => ispLower.includes(p) || orgLower.includes(p));
    const isHosting     = d.type === 'hosting' || isBulletproof;

    return {
      ip:              d.ip              || null,
      country:         d.country         || null,
      countryCode:     d.country_code    || null,
      city:            d.city            || null,
      isp:             isp               || null,
      org:             org               || null,
      asn:             d.connection?.asn ? `AS${d.connection.asn}` : null,
      isHosting,
      isBulletproof,
      hostingProvider: isp || org || null,
    };
  } catch {
    return dflt;
  }
}

// ─── 6. Own Community Reports ─────────────────────────────────────────────────

async function queryOwnWebsiteReports(domain: string): Promise<number> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_API_KEY;
    if (!supabaseUrl || !supabaseKey) return 0;
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(supabaseUrl, supabaseKey);
    const { count } = await sb
      .from('website_community_reports')
      .select('id', { count: 'exact', head: true })
      .eq('domain', domain);
    return count || 0;
  } catch {
    return 0;
  }
}

// ─── Known Scam Domain Check ──────────────────────────────────────────────────

function checkKnownScamDomain(domain: string): ThreatDetection | null {
  const lower = domain.toLowerCase();
  if (KNOWN_SCAM_DOMAINS[lower]) {
    const info = KNOWN_SCAM_DOMAINS[lower];
    return { type: 'regulatory_warning', severity: 'CRITICAL', description: `${info.regulator} Warning: ${info.warning}`, evidence: `Domain: ${domain}`, weight: 30 };
  }
  for (const { pattern, regulator, warning, weight } of SCAM_DOMAIN_PATTERNS) {
    if (pattern.test(lower)) {
      return { type: 'regulatory_warning', severity: 'CRITICAL', description: `${regulator} Warning: ${warning}`, evidence: `Pattern match on: ${domain}`, weight };
    }
  }
  return null;
}

// ─── Content Analysis ─────────────────────────────────────────────────────────

function analyzeContent(html: string, _domain: string, isLegit: boolean = false): ThreatDetection[] {
  const threats: ThreatDetection[] = [];
  const lower   = html.toLowerCase();
  const domain  = _domain.toLowerCase();

  for (const sig of WALLET_DRAINER_SIGNATURES) {
    if (lower.includes(sig.pattern)) threats.push({ type: sig.type, severity: sig.severity, description: getThreatDescription(sig.type), evidence: `Pattern: "${sig.pattern}"`, weight: sig.weight });
  }
  for (const kw of INVESTMENT_FRAUD_KEYWORDS) {
    if (lower.includes(kw.pattern)) threats.push({ type: kw.type, severity: kw.severity, description: getThreatDescription(kw.type), evidence: `Keyword: "${kw.pattern}"`, weight: kw.weight });
  }

  let casinoHitCount = 0;
  for (const kw of CRYPTO_CASINO_KEYWORDS) {
    if (lower.includes(kw.pattern)) { casinoHitCount++; threats.push({ type: kw.type, severity: kw.severity, description: getThreatDescription(kw.type), evidence: `Casino keyword: "${kw.pattern}"`, weight: kw.weight }); }
  }

  const isLikelyCasino = casinoHitCount >= 2;
  if (!isLikelyCasino) {
    for (const kw of EVENT_TICKET_SCAM_KEYWORDS) {
      if (lower.includes(kw.pattern)) threats.push({ type: kw.type, severity: kw.severity, description: getThreatDescription(kw.type), evidence: `Ticket scam keyword: "${kw.pattern}"`, weight: kw.weight });
    }
  }

  if (lower.includes('eval(') || lower.includes('atob(')) threats.push({ type: 'obfuscated_code', severity: 'HIGH', description: 'Obfuscated JavaScript — often hides malicious code', weight: 15 });
  if (!isLegit && (lower.includes('connect wallet') || lower.includes('walletconnect'))) threats.push({ type: 'wallet_connect', severity: 'MEDIUM', description: 'Wallet connection requested', weight: 10 });
  if (lower.includes('cloudflare') && lower.includes('blocked')) threats.push({ type: 'cloudflare_block', severity: 'MEDIUM', description: 'Site blocking automated access — could hide malicious content', evidence: 'Cloudflare challenge detected', weight: 10 });

  if (!isLikelyCasino) {
    const isFifaOfficial = FIFA_OFFICIAL_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
    if (!isFifaOfficial) {
      const fifaPatterns = [
        { p: 'official fifa partner', w: 30 }, { p: 'fifa authorized', w: 30 },
        { p: 'fifa approved', w: 30 }, { p: 'fifa certified', w: 25 },
        { p: 'authorized fifa ticket', w: 30 }, { p: 'fifa official reseller', w: 30 },
      ];
      for (const { p, w } of fifaPatterns) {
        if (lower.includes(p)) threats.push({ type: 'fifa_impersonation', severity: 'CRITICAL', description: 'Claiming FIFA authorization — FIFA.com is the ONLY authorized World Cup 2026 ticket source', evidence: `Pattern: "${p}" on non-FIFA domain`, weight: w });
      }
    }

    if (!lower.includes('copyright 2026') && lower.includes('ticket') || (lower.includes('copyright 2026') && lower.includes('ticket'))) {
      if (lower.includes('copyright 2026') && lower.includes('ticket')) {
        threats.push({ type: 'recent_domain_ticket', severity: 'HIGH', description: 'Site appears newly created for 2026 event ticket sales — common scam pattern', evidence: 'Copyright 2026 + ticket keywords on same page', weight: 15 });
      }
    }

    const hasTicketKeywords = lower.includes('ticket') && (lower.includes('world cup') || lower.includes('fifa') || lower.includes('2026'));
    const hasContactInfo    = lower.includes('address') && (lower.includes('street') || lower.includes('ave') || lower.includes('road'));
    const hasCompanyInfo    = lower.includes('llc') || lower.includes('inc.') || lower.includes('ltd') || lower.includes('corp');
    if (hasTicketKeywords && !hasContactInfo && !hasCompanyInfo) {
      threats.push({ type: 'no_seller_info', severity: 'MEDIUM', description: 'Ticket selling site with no verifiable business address or company info', evidence: 'Ticket keywords present but no company/address details found', weight: 10 });
    }
  }

  const paymentAnalysis = analyzePaymentMethods(html, _domain);
  const cryptoMethods   = ['bitcoin', 'ethereum', 'cryptocurrency', 'crypto', 'usdt', 'usdc', 'tether'];
  for (const method of paymentAnalysis.riskyMethods) {
    if (isLegitimateDomain(_domain) && cryptoMethods.includes(method)) continue;
    const severity = ['wire transfer', 'western union', 'moneygram'].includes(method) ? 'CRITICAL' as const : ['bitcoin', 'cryptocurrency', 'crypto', 'gift card', 'prepaid card'].includes(method) ? 'HIGH' as const : 'MEDIUM' as const;
    const weight   = severity === 'CRITICAL' ? 25 : severity === 'HIGH' ? 20 : 10;
    threats.push({ type: 'risky_payment_method', severity, description: `Non-standard payment method: ${method} — no buyer protection`, evidence: `Payment method "${method}" found on site`, weight });
  }
  if (paymentAnalysis.detectedMethods.length > 0 && paymentAnalysis.safeMethods.length === 0 && paymentAnalysis.riskyMethods.length > 0) {
    threats.push({ type: 'no_safe_payment', severity: 'CRITICAL', description: 'Site only accepts non-standard payment methods — no buyer protection', evidence: `Only accepts: ${paymentAnalysis.riskyMethods.join(', ')}`, weight: 25 });
  }

  return threats;
}

// ─── Payment Method Analysis (unchanged) ─────────────────────────────────────

function analyzePaymentMethods(html: string, _domain: string): PaymentAnalysis {
  const lower = html.toLowerCase();
  const analysis: PaymentAnalysis = { detectedMethods: [], safeMethods: [], riskyMethods: [], paymentProviders: [], hasBuyerProtection: false, riskAssessment: 'SAFE' };

  const SAFE_PROVIDERS = [
    { pattern: 'stripe.com', name: 'Stripe' }, { pattern: 'js.stripe.com', name: 'Stripe' },
    { pattern: 'paypal.com/sdk', name: 'PayPal' }, { pattern: 'paypalobjects.com', name: 'PayPal' },
    { pattern: 'squareup.com', name: 'Square' }, { pattern: 'shopify.com/s', name: 'Shopify Payments' },
    { pattern: 'braintreegateway.com', name: 'Braintree' }, { pattern: 'authorize.net', name: 'Authorize.net' },
    { pattern: 'adyen.com', name: 'Adyen' }, { pattern: 'checkout.com', name: 'Checkout.com' },
    { pattern: 'klarna.com', name: 'Klarna' }, { pattern: 'afterpay.com', name: 'Afterpay' },
  ];
  for (const p of SAFE_PROVIDERS) { if (lower.includes(p.pattern)) { analysis.paymentProviders.push(p.name); analysis.hasBuyerProtection = true; } }

  const SAFE_METHODS = [
    { pattern: 'credit card', name: 'Credit Card' }, { pattern: 'visa', name: 'Visa' },
    { pattern: 'mastercard', name: 'Mastercard' }, { pattern: 'american express', name: 'American Express' },
    { pattern: 'apple pay', name: 'Apple Pay' }, { pattern: 'google pay', name: 'Google Pay' },
    { pattern: 'paypal', name: 'PayPal' }, { pattern: 'debit card', name: 'Debit Card' },
  ];
  for (const m of SAFE_METHODS) { if (lower.includes(m.pattern)) { analysis.safeMethods.push(m.name); analysis.hasBuyerProtection = true; } }

  const RISKY_METHODS = [
    { pattern: 'wire transfer', name: 'wire transfer' }, { pattern: 'bank wire', name: 'wire transfer' },
    { pattern: 'swift transfer', name: 'wire transfer' }, { pattern: 'western union', name: 'Western Union' },
    { pattern: 'moneygram', name: 'MoneyGram' }, { pattern: 'bitcoin', name: 'bitcoin' },
    { pattern: 'ethereum', name: 'ethereum' }, { pattern: 'usdt', name: 'cryptocurrency' },
    { pattern: 'crypto payment', name: 'cryptocurrency' }, { pattern: 'pay with crypto', name: 'cryptocurrency' },
    { pattern: 'gift card', name: 'gift card' }, { pattern: 'prepaid card', name: 'prepaid card' },
    { pattern: 'zelle', name: 'Zelle' }, { pattern: 'venmo', name: 'Venmo' },
    { pattern: 'cash app', name: 'Cash App' }, { pattern: 'cash only', name: 'cash' },
    { pattern: 'money order', name: 'money order' }, { pattern: 'cashier check', name: "cashier's check" },
  ];
  for (const m of RISKY_METHODS) { if (lower.includes(m.pattern) && !analysis.riskyMethods.includes(m.name)) analysis.riskyMethods.push(m.name); }

  analysis.detectedMethods = Array.from(new Set([...analysis.safeMethods, ...analysis.riskyMethods]));

  const hasCritical = analysis.riskyMethods.some(m => ['wire transfer', 'Western Union', 'MoneyGram'].includes(m));
  const hasHigh     = analysis.riskyMethods.some(m => ['bitcoin', 'ethereum', 'cryptocurrency', 'gift card', 'prepaid card', 'cash'].includes(m));

  if (hasCritical && !analysis.hasBuyerProtection)              analysis.riskAssessment = 'DANGEROUS';
  else if ((hasCritical || hasHigh) && analysis.hasBuyerProtection) analysis.riskAssessment = 'MIXED';
  else if (analysis.riskyMethods.length > 0)                    analysis.riskAssessment = 'RISKY';

  return analysis;
}

// ─── Threat Descriptions ──────────────────────────────────────────────────────

function getThreatDescription(type: string): string {
  const d: Record<string, string> = {
    drainer_script:         'Wallet drainer script — steals all assets on connection',
    seed_harvesting:        'Seed phrase harvesting — NEVER enter your seed phrase anywhere',
    key_harvesting:         'Private key theft — NEVER share your private key',
    fake_airdrop:           'Fake airdrop scam — drains your wallet on interaction',
    regulatory_warning:     'Official regulatory fraud alert',
    investment_fraud:       'Investment fraud — fund recovery/claim scam',
    brokerage_phishing:     'Brokerage phishing — steals trading credentials',
    phishing:               'Phishing attempt — steals login credentials',
    wallet_connect:         'Wallet connection requested — verify site legitimacy first',
    obfuscated_code:        'Hidden/obfuscated JavaScript — frequently used to hide malicious code',
    cloudflare_block:       'Site blocking security scanners — suspicious for legitimate sites',
    fake_event_ticket:      'Fake event ticket scam — buy tickets only from official sources',
    ticket_urgency:         'High-pressure ticket sales tactics — designed to force rushed decisions',
    suspicious_payment:     'Suspicious payment method — no buyer protection',
    ticket_scam_method:     'Dodgy ticket selling channel — high risk of non-delivery',
    fake_casino:            'Fake or unlicensed crypto casino — fund theft or rigged games',
    casino_lure:            'Casino deposit/bonus lure — withdrawal trap with impossible terms',
    casino_withhold:        'Withdrawal restrictions — scam casinos block or delay payouts',
    fifa_impersonation:     'FIFA impersonation — only FIFA.com sells official World Cup 2026 tickets',
    recent_domain_ticket:   'Newly created site selling event tickets — common scam pattern',
    no_seller_info:         'No verifiable business info — legitimate ticket sellers always provide details',
    risky_payment_method:   'Non-standard payment — no buyer protection, money not recoverable',
    no_safe_payment:        'No safe payment options — site only accepts irreversible methods',
    newly_registered_domain:'Domain registered recently — scam sites are often newly created',
    high_risk_tld:          'High-risk domain extension — disproportionately used by scammers',
    redirect_chain:         'Multiple URL redirects — can hide the true destination',
    redirect_domain_change: 'Redirects to a different domain — common phishing technique',
    google_safe_browsing:   '⚠️ Flagged by Google Safe Browsing — in live phishing/malware database',
    urlscan_malicious:      'Flagged as malicious by urlscan.io community scans',
    urlscan_suspicious:     'Flagged as suspicious by urlscan.io community scans',
    bulletproof_hosting:    'Hosted on known bulletproof/abuse-tolerant hosting provider',
    brand_domain_lookalike: 'Domain closely resembles a legitimate brand — likely impersonation',
  };
  return d[type] || 'Suspicious activity detected';
}

// ─── Reputation Check (Brave Search + static links) ─────────────────────────

async function searchScamReports(domain: string, isTicketRelated?: boolean): Promise<{ results: SearchResult[]; scamIndicators: string[] }> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return { results: [], scamIndicators: [] };
  try {
    const q = isTicketRelated
      ? `${domain} scam fake tickets legit review FIFA World Cup 2026`
      : `${domain} scam legit review warning`;
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10`,
      { headers: { Accept: 'application/json', 'X-Subscription-Token': key } }
    );
    if (!res.ok) return { results: [], scamIndicators: [] };
    const data = await res.json();
    const results: SearchResult[] = (data.web?.results || []).map((r: any) => ({ title: r.title, url: r.url, description: r.description }));
    const domainRoot = domain.split('.')[0].toLowerCase();
    const scamPatterns = [/scam/i, /fraud/i, /warning/i, /avoid/i, /stolen/i, /fake/i, /suspicious/i, /phishing/i];
    const scamIndicators: string[] = [];
    for (const r of results) {
      const text = `${r.title} ${r.description}`.toLowerCase();
      if (!text.includes(domain) && !text.includes(domainRoot) && !r.url.toLowerCase().includes(domain)) continue;
      for (const p of scamPatterns) { if (p.test(text)) { scamIndicators.push(r.title); break; } }
    }
    return { results, scamIndicators: Array.from(new Set(scamIndicators)) };
  } catch {
    return { results: [], scamIndicators: [] };
  }
}

async function checkReputation(domain: string, isTicketRelated?: boolean): Promise<{ results: ReputationResult[]; webSearchResults?: SearchResult[] }> {
  const reps: ReputationResult[] = [
    { source: 'ScamAdviser',   verdict: 'Check recommended', details: `https://www.scamadviser.com/check-website/${domain}` },
    { source: 'Scam Detector', verdict: 'Check recommended', details: `https://www.scam-detector.com/validator/${domain.replace('.', '-')}-review/` },
    { source: 'Trustpilot',    verdict: 'Check reviews',     details: `https://www.trustpilot.com/review/${domain}` },
  ];
  if (isTicketRelated) {
    reps.push({ source: 'FIFA Official', verdict: 'Official tickets only at FIFA.com', details: 'https://www.fifa.com/tickets' });
    reps.push({ source: 'WHOIS',         verdict: 'Check domain age',                  details: `https://who.is/whois/${domain}` });
  }
  const { results: searchResults, scamIndicators } = await searchScamReports(domain, isTicketRelated);
  if (searchResults.length > 0) {
    reps.push({ source: 'Web Search', verdict: scamIndicators.length > 0 ? `${scamIndicators.length} potential scam indicators` : 'No obvious scam indicators', details: scamIndicators.slice(0, 3).join('; ') || 'Search completed' });
    return { results: reps, webSearchResults: searchResults };
  }
  return { results: reps };
}

// ─── Domain Age Check ─────────────────────────────────────────────────────────

async function checkDomainAge(domain: string): Promise<DomainInfo> {
  const info: DomainInfo = {};
  try {
    const tld = domain.split('.').pop() || '';
    const rdapUrls: Record<string, string> = {
      com: 'https://rdap.verisign.com/com/v1/domain/',
      net: 'https://rdap.verisign.com/net/v1/domain/',
      org: 'https://rdap.publicinterestregistry.org/rdap/domain/',
    };
    const rdapBase = rdapUrls[tld] || `https://rdap.${tld}/v1/domain/`;
    const res = await fetch(`${rdapBase}${domain}`, { headers: { Accept: 'application/rdap+json' }, signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      for (const ev of (data.events || [])) {
        if (ev.eventAction === 'registration') { info.registeredDate = ev.eventDate; break; }
      }
      for (const entity of (data.entities || [])) {
        if (entity.roles?.includes('registrar')) info.registrar = entity.vcardArray?.[1]?.find((v: any[]) => v[0] === 'fn')?.[3];
      }
      if (info.registeredDate) {
        info.domainAgeDays = Math.floor((Date.now() - new Date(info.registeredDate).getTime()) / 86400000);
        info.isNewDomain   = info.domainAgeDays < 180;
      }
    }
  } catch {
    try {
      const res = await fetch(`https://who.is/whois/${domain}`, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        const text = await res.text();
        const m = text.match(/(?:Creation Date|Registered On|created|Registration Date)[:\s]+(\d{4}-\d{2}-\d{2})/i);
        if (m) {
          info.registeredDate = m[1];
          info.domainAgeDays  = Math.floor((Date.now() - new Date(m[1]).getTime()) / 86400000);
          info.isNewDomain    = info.domainAgeDays < 180;
        }
      }
    } catch { /* both failed */ }
  }
  return info;
}

// ─── Risk Score + Level ───────────────────────────────────────────────────────

function calculateRiskScore(threats: ThreatDetection[], scamIndicators: string[] = []): number {
  const total    = threats.reduce((s, t) => s + t.weight, 0);
  const indWeight = Math.min(scamIndicators.length * 2, 10);
  const combined = total + indWeight;
  if (combined >= 30) return Math.min(10, Math.round(combined / 5));
  if (combined >= 20) return Math.min(8,  Math.round(combined / 4));
  if (combined >= 10) return Math.min(5,  Math.round(combined / 3));
  if (combined >= 5)  return Math.min(4,  Math.round(combined / 2));
  return Math.min(Math.round((combined / 10) * 10) / 10, 10);
}

function getRiskLevel(score: number, threats: ThreatDetection[] = [], scamIndicators: string[] = [], isLegitimate = false): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (isLegitimate && !threats.some(t => t.severity === 'CRITICAL')) return 'LOW';
  if (threats.some(t => t.severity === 'CRITICAL'))  return 'CRITICAL';
  if (scamIndicators.length >= 5)  return 'HIGH';
  if (scamIndicators.length >= 3)  return 'MEDIUM';
  if (score >= 7) return 'CRITICAL';
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

// ─── Recommendations ──────────────────────────────────────────────────────────

function generateRecommendations(threats: ThreatDetection[], isLegit: boolean, domain?: string): string[] {
  if (isLegit) return ['✅ Known legitimate domain', '🔐 Still verify the URL is correct'];

  const recs: string[] = [];
  const has = (type: string) => threats.some(t => t.type === type);

  if (has('google_safe_browsing')) { recs.push('🚨 CRITICAL: Flagged by Google Safe Browsing — do NOT visit or enter credentials'); recs.push('❌ Google\'s live database has classified this as phishing or malware'); }
  if (has('urlscan_malicious'))    { recs.push('🚨 CRITICAL: urlscan.io community marked this domain as malicious'); recs.push('❌ Do NOT interact with this site'); }
  if (has('urlscan_suspicious'))   { recs.push('⚠️ urlscan.io has flagged this domain as suspicious'); }
  if (has('redirect_domain_change')) { recs.push('⚠️ URL redirects to a completely different domain — classic phishing technique'); recs.push('🔍 Verify the final destination is what you expected'); }
  if (has('bulletproof_hosting'))  { recs.push('⚠️ Hosted on a known bulletproof/abuse-tolerant provider — scam sites use these to avoid takedowns'); }
  if (has('high_risk_tld'))        { recs.push('⚠️ High-risk domain extension — verify this site carefully before entering any information'); }
  if (has('regulatory_warning'))   { recs.push('🚨 CRITICAL: Regulatory warning — known scam/fraud site'); recs.push('❌ Do NOT interact with this site'); recs.push('📋 Report: https://reportfraud.ftc.gov'); }
  if (has('investment_fraud'))     { recs.push('🚨 CRITICAL: Investment fraud detected'); recs.push('❌ Do NOT send money or provide banking info'); }
  if (has('seed_harvesting') || has('key_harvesting')) { recs.push('🚨 CRITICAL: Site asks for seed phrase/private key — NEVER share these'); recs.push('❌ Close immediately and never return'); }
  if (has('drainer_script'))       { recs.push('🚨 Wallet drainer detected — will steal all assets'); recs.push('❌ Do NOT connect wallet to this site'); }
  if (has('fake_casino'))          { recs.push('🎰 CRITICAL: Fake or unlicensed crypto casino detected'); recs.push('❌ Do NOT deposit funds — scam casinos often refuse withdrawals'); }
  if (has('casino_withhold'))      { recs.push('🚨 Withdrawal restrictions detected — classic casino scam pattern'); recs.push('⚠️ Wagering requirements mean you must bet your deposit many times over'); }
  if (has('fifa_impersonation'))   { recs.push('🚨 CRITICAL: FIFA impersonation — only FIFA.com/tickets is the official source'); recs.push('❌ Do NOT purchase from this site'); }
  if (has('fake_event_ticket'))    { recs.push('🚨 CRITICAL: Potential fake event ticket scam detected'); recs.push('⚽ World Cup 2026 tickets — ONLY via FIFA.com/tickets'); }
  if (has('suspicious_payment') || has('no_safe_payment')) { recs.push('🚨 CRITICAL: No safe payment methods — wire/crypto/gift cards have NO buyer protection'); recs.push('❌ Once sent, your money cannot be recovered'); }
  if (has('newly_registered_domain')) { recs.push('🆕 Domain registered very recently — scam sites are often newly created'); recs.push(`🔗 Verify domain age: https://who.is/whois/${domain || 'DOMAIN'}`); }
  if (has('phishing') || has('brokerage_phishing')) { recs.push('⚠️ Phishing site detected — do NOT enter login credentials'); }

  if (threats.length === 0) {
    recs.push('✅ No obvious threats detected by automated scan');
    recs.push('🔍 Always verify the URL matches the official site before entering credentials');
    recs.push('🔗 Cross-check at ScamAdviser, Trustpilot, and Google Safe Browsing');
  }

  return recs.length > 0 ? recs : ['⚠️ Exercise caution', '🔍 Verify site legitimacy before proceeding'];
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { url, brand_monitor_id } = req.body as { url?: string; brand_monitor_id?: string };
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL is required' });

  let validUrl: string;
  try {
    validUrl = url.startsWith('http://') || url.startsWith('https://') ? url : 'https://' + url;
    new URL(validUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  const domain = extractDomain(validUrl);

  // ── Brand domain lookup ────────────────────────────────────────────────────
  let brandDomain: string | null = null;
  if (brand_monitor_id) {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SECRET_API_KEY;
      if (supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(supabaseUrl, supabaseKey);
        const { data: brand } = await sb.from('brand_monitors').select('brand_domain').eq('id', brand_monitor_id).single();
        if (brand?.brand_domain) brandDomain = brand.brand_domain.replace(/^https?:\/\//, '').replace(/\/.+$/, '').toLowerCase();
      }
    } catch (e) { console.error('[website-scan] brand domain lookup:', e); }
  }

  const dynamicLegitDomains = [...LEGITIMATE_DOMAINS];
  if (brandDomain && !dynamicLegitDomains.includes(brandDomain)) dynamicLegitDomains.push(brandDomain);
  const isLegit = dynamicLegitDomains.some(l => domain === l || domain.endsWith('.' + l));

  // ── Early return for known legit domains ──────────────────────────────────
  if (isLegit) {
    return res.status(200).json({
      success: true, url: validUrl, domain,
      riskScore: 0, riskLevel: 'LOW', threats: [], scamIndicators: [],
      recommendations: brandDomain && domain === brandDomain
        ? ['✅ This is your verified brand domain', '🔐 Monitor for lookalike domains that impersonate your brand']
        : ['✅ Known legitimate domain', '🔐 Still verify the URL is correct'],
      legitimate: true, scanDate: new Date().toISOString(),
      scanCategory: 'general',
    });
  }

  const threats: ThreatDetection[] = [];

  // ── Synchronous checks ─────────────────────────────────────────────────────
  const tldThreat       = checkTLDRisk(domain);
  const knownScamThreat = checkKnownScamDomain(domain);
  if (tldThreat)       threats.push(tldThreat);
  if (knownScamThreat) threats.push(knownScamThreat);

  // ── Brand impersonation ────────────────────────────────────────────────────
  let brandImpersonationInfo: WebsiteScanResult['brandImpersonationInfo'] = null;
  if (brandDomain && domain !== brandDomain) {
    const bp = brandDomain.split('.')[0].toLowerCase();
    const dp = domain.split('.')[0].toLowerCase();
    const levDist    = levenshtein(dp, bp);
    const maxLen     = Math.max(dp.length, bp.length);
    const similarity = maxLen > 0 ? Math.round((1 - levDist / maxLen) * 1000) / 1000 : 0;
    let variantType  = 'unknown';
    let isLookalike  = false;
    const dTld = '.' + domain.split('.').slice(1).join('.');
    const bTld = '.' + brandDomain.split('.').slice(1).join('.');
    if (dp === bp && dTld !== bTld)                                           { variantType = 'tld_swap';         isLookalike = true; }
    else if (dp.startsWith(bp) && dp !== bp)                                  { variantType = 'phishing_prefix'; isLookalike = true; }
    else if (dp.endsWith(bp)   && dp !== bp)                                  { variantType = 'phishing_suffix'; isLookalike = true; }
    else if (similarity >= 0.6 && dp !== bp)                                  { variantType = 'homoglyph';       isLookalike = true; }
    else if (domain.includes(brandDomain) && domain !== brandDomain)          { variantType = 'subdomain_phishing'; isLookalike = true; }
    if (isLookalike) {
      brandImpersonationInfo = { is_lookalike: true, brand_domain: brandDomain, similarity, variant_type: variantType };
      const sev = similarity >= 0.9 ? 'CRITICAL' : similarity >= 0.75 ? 'HIGH' : similarity >= 0.5 ? 'MEDIUM' : 'LOW';
      threats.push({ type: 'brand_domain_lookalike', severity: sev as any, description: `"${domain}" is a ${variantType.replace(/_/g, ' ')} of brand domain "${brandDomain}" (${Math.round(similarity * 100)}% similar)`, evidence: `Scanned: ${domain} | Brand: ${brandDomain} | Similarity: ${Math.round(similarity * 100)}%`, weight: similarity >= 0.9 ? 30 : similarity >= 0.75 ? 25 : similarity >= 0.5 ? 15 : 8 });
    }
  }

  const isTicketRelated = !['casino','bet','slot'].some(t => domain.includes(t)) && ['ticket','fifa','worldcup','wc2026','hospitality'].some(t => domain.includes(t));

  // ── Parallel async checks ──────────────────────────────────────────────────
  const [
    reputationRes,
    domainAgeRes,
    safeBrowsingRes,
    urlScanRes,
    ipInfoRes,
    communityRes,
    redirectRes,
  ] = await Promise.allSettled([
    checkReputation(domain, isTicketRelated),
    checkDomainAge(domain),
    checkGoogleSafeBrowsing(validUrl),
    searchUrlScan(domain),
    getIPHostingInfo(domain),
    queryOwnWebsiteReports(domain),
    followRedirectChain(validUrl),
  ]);

  const reputation          = reputationRes.status === 'fulfilled'   ? reputationRes.value.results        : undefined;
  const webSearchResults    = reputationRes.status === 'fulfilled'   ? reputationRes.value.webSearchResults : undefined;
  const domainInfo: DomainInfo = domainAgeRes.status === 'fulfilled' ? domainAgeRes.value                  : {};
  const safeBrowsing        = safeBrowsingRes.status === 'fulfilled' ? safeBrowsingRes.value               : null;
  const urlScanInfo         = urlScanRes.status === 'fulfilled'      ? urlScanRes.value                    : null;
  const ipInfo              = ipInfoRes.status === 'fulfilled'       ? ipInfoRes.value                     : null;
  const ownCommunityReports = communityRes.status === 'fulfilled'    ? communityRes.value                  : 0;
  const { chain: redirectChain, finalUrl } = redirectRes.status === 'fulfilled' ? redirectRes.value : { chain: [validUrl], finalUrl: validUrl };
  const finalDomain = extractDomain(finalUrl);

  // ── Add redirect threats ───────────────────────────────────────────────────
  if (redirectChain.length > 2) {
    threats.push({ type: 'redirect_chain', severity: 'MEDIUM', description: `URL redirects through ${redirectChain.length - 1} hop(s) before reaching final destination`, evidence: redirectChain.join(' → '), weight: Math.min((redirectChain.length - 1) * 5, 15) });
  }
  if (finalDomain !== domain && !isLegitimateDomain(finalDomain)) {
    threats.push({ type: 'redirect_domain_change', severity: 'HIGH', description: `URL redirects to a completely different domain: ${finalDomain}`, evidence: `Input domain: ${domain} → Final domain: ${finalDomain}`, weight: 20 });
  }

  // ── Add Google Safe Browsing threats ──────────────────────────────────────
  if (safeBrowsing?.flagged) {
    threats.push({ type: 'google_safe_browsing', severity: 'CRITICAL', description: `Flagged by Google Safe Browsing: ${safeBrowsing.threats.map(t => t.type.replace('_', ' ').toLowerCase()).join(', ')}`, evidence: 'Listed in Google\'s live phishing/malware database', weight: 35 });
  }

  // ── Add urlscan.io threats ─────────────────────────────────────────────────
  if (urlScanInfo?.found) {
    if (urlScanInfo.verdict === 'malicious')  threats.push({ type: 'urlscan_malicious',  severity: 'CRITICAL', description: 'Flagged as malicious by urlscan.io community',  evidence: `Score: ${urlScanInfo.score ?? 'n/a'} | Report: ${urlScanInfo.reportUrl}`, weight: 30 });
    if (urlScanInfo.verdict === 'suspicious') threats.push({ type: 'urlscan_suspicious', severity: 'HIGH',     description: 'Flagged as suspicious by urlscan.io',           evidence: `Score: ${urlScanInfo.score ?? 'n/a'} | Report: ${urlScanInfo.reportUrl}`, weight: 20 });
  }

  // ── Add IP/hosting threats ────────────────────────────────────────────────
  if (ipInfo?.isBulletproof) {
    threats.push({ type: 'bulletproof_hosting', severity: 'HIGH', description: `Hosted on known bulletproof/abuse-tolerant provider: ${ipInfo.hostingProvider}`, evidence: `ISP: ${ipInfo.isp} | ASN: ${ipInfo.asn} | Country: ${ipInfo.country}`, weight: 20 });
  }

  // ── Extract scam indicators from web search ───────────────────────────────
  let scamIndicators: string[] = [];
  if (webSearchResults) {
    const domainRoot   = domain.split('.')[0].toLowerCase();
    const scamPatterns = [/scam/i, /fraud/i, /warning/i, /avoid/i, /stolen/i, /fake/i, /suspicious/i];
    for (const r of webSearchResults) {
      const text = `${r.title} ${r.description}`.toLowerCase();
      if (!text.includes(domain) && !text.includes(domainRoot) && !r.url.toLowerCase().includes(domain)) continue;
      for (const p of scamPatterns) { if (p.test(text)) { scamIndicators.push(r.title); break; } }
    }
    scamIndicators = Array.from(new Set(scamIndicators));
  }

  // ── Fetch HTML from final URL ─────────────────────────────────────────────
  let paymentAnalysis: PaymentAnalysis | undefined;
  try {
    const pageRes = await fetch(finalUrl, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgenticBro Scanner)' }, signal: AbortSignal.timeout(8000) });
    const html    = await pageRes.text();
    threats.push(...analyzeContent(html, finalDomain, isLegit));
    paymentAnalysis = analyzePaymentMethods(html, finalDomain);
  } catch {
    if (threats.length === 0) threats.push({ type: 'fetch_error', severity: 'LOW', description: 'Could not fetch page — site may be down or blocking scanners', weight: 0 });
  }

  // ── Domain age threats ────────────────────────────────────────────────────
  if (domainInfo.isNewDomain) {
    threats.push({ type: 'newly_registered_domain', severity: 'HIGH', description: `Domain registered only ${domainInfo.domainAgeDays} days ago — scam sites are often newly created`, evidence: `Registered: ${domainInfo.registeredDate} (${domainInfo.domainAgeDays} days old)`, weight: 20 });
  } else if (domainInfo.domainAgeDays && domainInfo.domainAgeDays < 365) {
    threats.push({ type: 'newly_registered_domain', severity: 'MEDIUM', description: `Domain is less than 1 year old (${domainInfo.domainAgeDays} days) — newer domains carry more risk`, evidence: `Registered: ${domainInfo.registeredDate}`, weight: 10 });
  }

  // ── Score + level ─────────────────────────────────────────────────────────
  const riskScore = calculateRiskScore(threats, scamIndicators);
  const riskLevel = getRiskLevel(riskScore, threats, scamIndicators);
  const recommendations = generateRecommendations(threats, isLegit, domain);

  // ── Scan category ─────────────────────────────────────────────────────────
  const hasTicketKw    = threats.some(t => ['fake_event_ticket','ticket_urgency','ticket_scam_method','fifa_impersonation','recent_domain_ticket'].includes(t.type));
  const hasCasinoKw    = threats.some(t => ['fake_casino','casino_lure','casino_withhold'].includes(t.type));
  const hasBrandLook   = threats.some(t => t.type === 'brand_domain_lookalike');
  let scanCategory: WebsiteScanResult['scanCategory'] = 'general';
  if (hasBrandLook)                                          scanCategory = 'brand_impersonation';
  else if (hasCasinoKw || /casino|bet|slot/.test(domain))   scanCategory = 'crypto_casino';
  else if (hasTicketKw || isTicketRelated)                   scanCategory = 'ticket';

  // ── Deep scan queue (for inconclusive scans) ──────────────────────────────
  let deepScanId: string | undefined;
  if (threats.some(t => t.type === 'fetch_error') || (riskLevel === 'LOW' && threats.length === 0)) {
    deepScanId = `deep-${domain}-${Date.now()}`;
    fetch('https://gateway.openclaw.ai/api/cron/wake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'now', text: `DEEP SCAN REQUEST: ${validUrl}\nScan ID: ${deepScanId}\nDomain: ${domain}\nCategory: ${scanCategory}\n\nResearch this domain for scam reports, regulatory warnings, user reviews and respond with findings.` }),
    }).catch(() => {});
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_API_KEY;
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js');
      await createClient(supabaseUrl, supabaseKey).rpc('record_scan_event', { p_event_type: 'website', p_platform: 'website', p_username: domain, p_risk_score: riskScore, p_risk_level: riskLevel, p_source: 'website' });
    }
  } catch (e) { console.error('[website-scan] analytics:', e); }

  const result: WebsiteScanResult = {
    success: true,
    url: validUrl,
    finalUrl: finalUrl !== validUrl ? finalUrl : undefined,
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
    domainInfo: Object.keys(domainInfo).length > 0 ? domainInfo : undefined,
    paymentAnalysis,
    brandImpersonationInfo,
    redirectChain: redirectChain.length > 1 ? redirectChain : undefined,
    safeBrowsing,
    urlScanInfo: urlScanInfo?.found ? urlScanInfo : undefined,
    ipInfo: ipInfo?.ip ? ipInfo : undefined,
    ownCommunityReports,
  };

  return res.status(200).json(result);
}
