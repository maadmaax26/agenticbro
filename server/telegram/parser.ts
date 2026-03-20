/**
 * server/telegram/parser.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Parses raw Telegram messages into structured alpha calls.
 *
 * Detects:
 *   - Token tickers:        $ABC, $NOVA, TICKER/SOL, bare ALL-CAPS near alpha terms
 *   - Contract addresses:   0x[40 hex], CA: <base58>, standalone 40+ char base58
 *   - Call direction:       long / short / gem / alert heuristics
 *   - Urgency / shill language
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type CallType = 'long' | 'short' | 'gem' | 'alert'

export interface ParsedCall {
  ticker:      string
  contract:    string | null
  callType:    CallType
  rawText:     string
  timestamp:   string   // ISO8601
  messageId:   number
  channelUsername: string
}

// ─── Regex patterns ───────────────────────────────────────────────────────────

// $TICKER format (most common, highest confidence)
const TICKER_DOLLAR_RE = /\$([A-Z]{2,10})\b/gi

// EVM contract addresses (0x + 40 hex chars)
const EVM_CONTRACT_RE = /0x[0-9a-fA-F]{40}/g

// Solana contract prefixed by CA:, contract:, token:, address:, mint:
const SOL_PREFIXED_RE = /(?:CA|contract|token|address|mint)\s*[:\-]\s*([1-9A-HJ-NP-Za-km-z]{32,44})\b/gi

// Standalone Solana pubkey — 40+ base58 chars (most pubkeys are 43-44)
const SOL_ADDR_RE = /\b([1-9A-HJ-NP-Za-km-z]{40,44})\b/g

// TICKER/SOL, TICKER/ETH, TICKER/USDT pair notation — very common in alpha channels
const PAIR_RE = /\b([A-Z]{2,10})\s*\/\s*(?:SOL|ETH|BNB|USDT|USDC|BTC)\b/gi

// Bare ALL-CAPS ticker — used as fallback only when the message has alpha keywords
// Exclusion list prevents noisy common English / crypto meta words
const BARE_TICKER_RE = /\b([A-Z]{2,10})\b/g

const EXCLUDED_TICKERS = new Set([
  // English stop words
  'THE', 'AND', 'FOR', 'NOT', 'BUT', 'YOU', 'ARE', 'ALL', 'CAN', 'GET', 'NOW', 'NEW',
  'HAS', 'HAD', 'HIS', 'HER', 'ITS', 'OUR', 'OUT', 'ONE', 'TWO', 'ANY', 'TOO', 'WAS',
  'FROM', 'INTO', 'HAVE', 'THIS', 'THAT', 'WITH', 'WILL', 'THEY', 'THEM', 'WHEN', 'WHAT',
  'THEN', 'BOTH', 'MORE', 'MOST', 'ALSO', 'VERY', 'JUST', 'LIKE', 'GOOD', 'WELL', 'BEEN',
  'OVER', 'BACK', 'ONLY', 'SOME', 'SAME', 'EACH', 'BEEN', 'MUCH', 'DOWN', 'LAST', 'LONG',
  'TIME', 'YEAR', 'HERE', 'NEXT', 'THAN', 'TAKE', 'COME', 'KNOW', 'LOOK', 'MAKE', 'WANT',
  'GIVE', 'FIND', 'TELL', 'FEEL', 'KEEP', 'CALL', 'NEED',
  // Action / direction words
  'BUY', 'SELL', 'HOLD', 'WAIT', 'STOP', 'SEND', 'SIGN', 'LOAD', 'APE', 'SNIPE',
  'ENTRY', 'EXIT', 'TOP', 'HIGH', 'LOW', 'ADD', 'SET', 'FIX', 'RUN',
  // Chart / trading terms
  'LONG', 'SHORT', 'PUMP', 'DUMP', 'MOON', 'DIPS', 'WICK', 'ATH', 'ATL', 'ROI', 'PNL',
  'TP', 'SL', 'MC', 'LIQ', 'TVL', 'APY', 'APR', 'VOL', 'LP', 'TG',
  // Crypto meta
  'NFT', 'DEX', 'CEX', 'DAO', 'DeFi', 'WEB3', 'L1', 'L2', 'AI', 'P2E', 'RWA', 'BTD',
  'NFA', 'DYOR', 'WAGMI', 'NGMI', 'GG', 'ALPHA', 'BETA', 'CALL', 'SIGNAL', 'ALERT',
  'GEM', 'RUG', 'SCAM', 'SAFE', 'BASED', 'APED',
  // Chains / major tokens
  'ETH', 'BTC', 'SOL', 'BNB', 'AVAX', 'MATIC', 'POL', 'FTM', 'OP', 'ARB', 'SUI', 'APT',
  'TRX', 'TON', 'XRP', 'ADA', 'DOT', 'LINK', 'UNI', 'AAVE', 'MKR', 'SNX', 'CRV', 'CVX',
  'WETH', 'WBTC', 'WBNB', 'WSOL',
  // Stables
  'USDT', 'USDC', 'BUSD', 'DAI', 'FRAX', 'USD', 'EUR', 'GBP',
  // Channel meta
  'DM', 'TG', 'TEL', 'TLG', 'CHAT', 'JOIN', 'LINK', 'POST', 'SITE',
])

// Alpha keywords — a message must contain at least one of these
// for bare-ticker fallback to be considered a call
const ALPHA_KEYWORD_RE = /\b(buy|entry|gem|launch|snipe|ape|presale|stealth|degen|alpha|signal|trade|call|liq(?:uidity)?|mc|market ?cap|x\d+|🚀|💎|🔥|🌙|📈|⚡)/i

// ─── Directional heuristics ───────────────────────────────────────────────────

const CALL_HEURISTICS: { type: CallType; patterns: RegExp[] }[] = [
  {
    type: 'short',
    patterns: [
      /\bshort\b/i, /\bbear(ish)?\b/i, /\bsell\b/i, /\brejection\b/i,
      /\bresistance\b/i, /\bfunding.*elevated\b/i,
    ],
  },
  {
    type: 'alert',
    patterns: [
      /\bwhale\b/i, /\balert\b/i, /\bwatch out\b/i, /\bmoving.*exchange\b/i,
      /\bvolatility\b/i, /\bfunding.*spike\b/i, /\blarge.*transfer\b/i,
    ],
  },
  {
    type: 'gem',
    patterns: [
      /\bgem\b/i, /\blaunch(ing)?\b/i, /\bpresale\b/i, /\bnew.*dex\b/i,
      /\bstealth\b/i, /\bearly\b.*\bentry\b/i, /\b(liq|liquidity).*lock(ed)?\b/i,
      /\bdeployer\b/i, /\bcontract\b.*0x/i, /\bsnipe\b/i, /\bdegen\b/i, /\bape\b/i,
      /CA\s*:/i, /\bmint\b/i, /\bnew\s+token\b/i,
    ],
  },
  {
    type: 'long',
    patterns: [
      /\blong\b/i, /\bbull(ish)?\b/i, /\bentry\b/i, /\baccumulat(e|ing)\b/i,
      /\bmomentum\b/i, /\bbreak(out)?\b/i, /\bpump\b/i, /\bx\d+\b/i, /\bmoon\b/i,
    ],
  },
]

// ─── Shill / urgency scoring ──────────────────────────────────────────────────

const SHILL_PATTERNS = [
  /\btrust me bro\b/i, /\b100x\b/i, /\ball in\b/i, /\bguaranteed\b/i,
  /\bcan't miss\b/i, /\bgoing to moon\b/i, /\blast chance\b/i,
  /\bget in now\b/i, /\b🚀{2,}/,
]

const URGENCY_PATTERNS = [
  /\bnow\b/i, /\bhurry\b/i, /\bends soon\b/i, /\b2h?\b/i,
  /\btonight\b/i, /\bfast\b/i, /\bquick\b/i, /\b!{2,}/,
]

export function scoreShillProbability(text: string): number {
  const hits = SHILL_PATTERNS.filter(p => p.test(text)).length
  return Math.min(hits / 3, 1.0)
}

export function scoreUrgency(text: string): number {
  const hits = URGENCY_PATTERNS.filter(p => p.test(text)).length
  return Math.min(hits / 4, 1.0)
}

// ─── Core parser ──────────────────────────────────────────────────────────────

export interface RawMessage {
  id:        number
  text:      string
  date:      number  // Unix timestamp
  channelUsername: string
}

export function parseMessage(msg: RawMessage): ParsedCall | null {
  const text = msg.text?.trim()
  if (!text || text.length < 8) return null

  // ── 1. $TICKER (highest confidence — explicit dollar prefix) ──────────────
  const tickers = [...text.matchAll(TICKER_DOLLAR_RE)].map(m => `$${m[1].toUpperCase()}`)
  let primaryTicker = tickers[0] ?? null

  // ── 2. TICKER/CHAIN pair notation (e.g. RUSH/SOL, NOVA/ETH) ─────────────
  if (!primaryTicker) {
    const pairMatch = [...text.matchAll(PAIR_RE)]
    if (pairMatch.length > 0) {
      primaryTicker = `$${pairMatch[0][1].toUpperCase()}`
    }
  }

  // ── 3. Contract addresses ─────────────────────────────────────────────────
  const evmContracts  = text.match(EVM_CONTRACT_RE) ?? []
  const solPrefixed   = [...text.matchAll(SOL_PREFIXED_RE)].map(m => m[1])
  const solStandalone = [...text.matchAll(SOL_ADDR_RE)].map(m => m[1])
  const contract      = evmContracts[0] ?? solPrefixed[0] ?? solStandalone[0] ?? null

  // ── 4. Bare ALL-CAPS ticker fallback ──────────────────────────────────────
  // Only when: no $TICKER/pair found AND message has alpha keywords (signal or emoji)
  if (!primaryTicker && ALPHA_KEYWORD_RE.test(text)) {
    const bareMatches = [...text.matchAll(BARE_TICKER_RE)]
      .map(m => m[1])
      .filter(t => !EXCLUDED_TICKERS.has(t) && t.length >= 2 && t.length <= 10)
    if (bareMatches.length > 0) {
      primaryTicker = `$${bareMatches[0]}`
    }
  }

  // ── 5. Contract-only call (no ticker at all, but address present) ─────────
  // Requires alpha keyword to avoid catching random links
  if (!primaryTicker && contract && ALPHA_KEYWORD_RE.test(text)) {
    // Use short form of contract as label
    primaryTicker = contract.length > 12
      ? `$${contract.slice(0, 4).toUpperCase()}`
      : `$${contract.toUpperCase()}`
  }

  // Nothing actionable found
  if (!primaryTicker) return null

  const ticker = primaryTicker

  // ── 6. Detect call type ───────────────────────────────────────────────────
  let callType: CallType = 'gem'   // default to gem for short alpha-channel posts
  for (const { type, patterns } of CALL_HEURISTICS) {
    if (patterns.some(p => p.test(text))) {
      callType = type
      break
    }
  }

  return {
    ticker,
    contract,
    callType,
    rawText:         text,
    timestamp:       new Date(msg.date * 1000).toISOString(),
    messageId:       msg.id,
    channelUsername: msg.channelUsername,
  }
}

export function parseMessages(messages: RawMessage[]): ParsedCall[] {
  return messages
    .map(parseMessage)
    .filter((c): c is ParsedCall => c !== null)
}
