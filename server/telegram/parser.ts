/**
 * server/telegram/parser.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Parses raw Telegram messages into structured alpha calls.
 *
 * Detects:
 *   - Token tickers:        $ABC, $NOVA  (case-insensitive)
 *   - Contract addresses:   0x[40 hex chars]
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

const TICKER_RE = /\$([A-Z]{2,10})\b/gi

// EVM contract addresses (0x + 40 hex chars)
const EVM_CONTRACT_RE = /0x[0-9a-fA-F]{40}/g

// Solana contract prefixed by CA:, contract:, token:, address:, or mint:
const SOL_PREFIXED_RE = /(?:CA|contract|token|address|mint)\s*[:\-]\s*([1-9A-HJ-NP-Za-km-z]{32,44})\b/gi

// Standalone Solana pubkey — exactly 43-44 base58 chars on a word boundary
// (min 43 to avoid matching short common words in base58 alphabet)
const SOL_ADDR_RE = /\b([1-9A-HJ-NP-Za-km-z]{43,44})\b/g

// Directional heuristics — ordered by priority (first match wins)
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
      /\bdeployer\b/i, /\bcontract\b.*0x/i,
    ],
  },
  {
    type: 'long',
    patterns: [
      /\blong\b/i, /\bbull(ish)?\b/i, /\bentry\b/i, /\baccumulat(e|ing)\b/i,
      /\bmomentum\b/i, /\bbreak(out)?\b/i, /\bpump\b/i,
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

  // Extract tickers ($ABC format)
  const tickers = [...text.matchAll(TICKER_RE)].map(m => `$${m[1].toUpperCase()}`)
  const primaryTicker = tickers[0] ?? null

  // Extract contract — try EVM first, then Solana prefixed, then standalone Solana pubkey
  const evmContracts  = text.match(EVM_CONTRACT_RE) ?? []
  const solPrefixed   = [...text.matchAll(SOL_PREFIXED_RE)].map(m => m[1])
  const solStandalone = [...text.matchAll(SOL_ADDR_RE)].map(m => m[1])

  const contract = evmContracts[0] ?? solPrefixed[0] ?? solStandalone[0] ?? null

  // Must have at least a ticker or a contract to be actionable
  if (!primaryTicker && !contract) return null

  // Derive a short ticker label from the contract if no $TICKER found
  const ticker = primaryTicker ?? (contract ? contract.slice(0, 6) + '…' : '???')

  // Detect call type
  let callType: CallType = 'alert'
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
