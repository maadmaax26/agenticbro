/**
 * server/telegram/scorer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Edge scoring engine + gem advise logic.
 *
 * Mirrors the Python gem_advise.py scoring model so frontend/backend
 * classifications stay in sync.
 *
 * Scoring formula (from handoff document):
 *   edge_score = (win_rate * 0.50)
 *              + ((1 - rug_rate) * 0.30)
 *              + (liquidity_score * 0.20)
 *
 *   liquidity_score = min(liquidity_usd / 200_000, 1.0)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ParsedCall } from './parser.js'
import type { DexTokenData, SecurityData } from './dex.js'
import type { TrackedChannel } from './client.js'
import { scoreShillProbability, scoreUrgency } from './parser.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export type ScamVerdict = 'SCAM' | 'RISKY' | 'CLEAN' | 'UNKNOWN'

export interface ScamAnalysis {
  verdict:       ScamVerdict
  isHoneypot:    boolean
  highSellTax:   boolean     // sellTaxPct > 10
  hiddenOwner:   boolean
  isMintable:    boolean
  isBlacklist:   boolean
  holderCount:   number
  sellTaxPct:    number
  buyTaxPct:     number
  source:        'goplus' | 'heuristic' | 'unavailable'
}

export function buildScamAnalysis(sec: SecurityData): ScamAnalysis {
  const highSellTax = sec.sellTaxPct > 10
  const flagCount   = [
    sec.isHoneypot,
    sec.cannotSellAll,
    sec.hasHiddenOwner,
    sec.canTakeBackOwnership,
    highSellTax,
    sec.isMintable && sec.ownerPercent > 5,
    sec.isBlacklist,
  ].filter(Boolean).length

  const verdict: ScamVerdict =
    sec.isHoneypot || sec.cannotSellAll || sec.sellTaxPct > 20
      ? 'SCAM'
    : flagCount >= 2
      ? 'RISKY'
    : sec.source === 'unavailable'
      ? 'UNKNOWN'
      : 'CLEAN'

  return {
    verdict,
    isHoneypot:   sec.isHoneypot,
    highSellTax,
    hiddenOwner:  sec.hasHiddenOwner,
    isMintable:   sec.isMintable,
    isBlacklist:  sec.isBlacklist,
    holderCount:  sec.holderCount,
    sellTaxPct:   sec.sellTaxPct,
    buyTaxPct:    sec.buyTaxPct,
    source:       sec.source,
  }
}

export interface ScoredCall {
  // Identity
  ticker:         string
  contract:       string | null
  chainId:        string | null
  dexUrl:         string | null
  callType:       ParsedCall['callType']
  rawText:        string
  timestamp:      string
  messageId:      number

  // Channel
  sourceChannel:  string
  channelScore:   number
  channelClass:   TrackedChannel['classification']

  // Scoring
  edgeScore:      number   // 0–1 composite
  confidence:     ConfidenceLevel
  winRate:        number   // derived from channel win rate
  rugRate:        number   // estimated from shill/urgency + channel history
  shillScore:     number
  urgencyScore:   number

  // Market data
  liquidity:      number
  volume24h:      number
  priceUsd:       number
  priceChange1h:  string   // formatted e.g. "+12.4%"
  maxGain:        string   // estimated e.g. "3.2x"
  isNew:          boolean

  // Security
  scamAnalysis:   ScamAnalysis
}

export interface GemAdviseItem extends ScoredCall {
  // Extra gem-specific fields
  avgEdge:   number
}

// ─── Channel baseline metrics ─────────────────────────────────────────────────
// These are seeded from the alpha auditor historical run.
// In production, update these after each full channel audit.

const CHANNEL_BASELINES: Record<string, { winRate: number; rugRate: number }> = {
  cryptoedgepro: { winRate: 0.44, rugRate: 0.08 },
  alphawhaleio:  { winRate: 0.39, rugRate: 0.12 },
  defigems_io:   { winRate: 0.31, rugRate: 0.19 },
  moonsignalshq: { winRate: 0.28, rugRate: 0.22 },
  gemhuntersdao: { winRate: 0.24, rugRate: 0.28 },
}

function getChannelBaseline(username: string) {
  return CHANNEL_BASELINES[username] ?? { winRate: 0.20, rugRate: 0.35 }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function classifyConfidence(edgeScore: number): ConfidenceLevel {
  if (edgeScore > 0.70) return 'HIGH'
  if (edgeScore > 0.50) return 'MEDIUM'
  return 'LOW'
}

function estimateMaxGain(edgeScore: number, liquidity: number): string {
  // Simple heuristic: higher edge + lower liquidity = higher max gain potential
  const base = 1 + edgeScore * 3
  const liqMult = liquidity < 50_000 ? 1.4 : liquidity < 100_000 ? 1.2 : 1.0
  const gain = base * liqMult
  return `${gain.toFixed(1)}x`
}

function formatPriceChange(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

// ─── Core scoring function ────────────────────────────────────────────────────

export function scoreCall(
  call:    ParsedCall,
  dex:     DexTokenData,
  channel: TrackedChannel,
  ageMs:   number,   // how old the message is in ms
): ScoredCall {
  const baseline      = getChannelBaseline(channel.username)
  const shillScore    = scoreShillProbability(call.rawText)
  const urgencyScore  = scoreUrgency(call.rawText)

  // Adjust win/rug based on shill probability — high shill lowers quality
  const adjustedWinRate = baseline.winRate  * (1 - shillScore * 0.4)
  const adjustedRugRate = baseline.rugRate  + shillScore * 0.25

  const liquidityScore = Math.min(dex.liquidity / 200_000, 1.0)

  const edgeScore = (
    (adjustedWinRate   * 0.50) +
    ((1 - adjustedRugRate) * 0.30) +
    (liquidityScore    * 0.20)
  )

  const isNew = ageMs < 30 * 60 * 1000   // < 30 minutes old

  const defaultScam: ScamAnalysis = {
    verdict: 'UNKNOWN', isHoneypot: false, highSellTax: false,
    hiddenOwner: false, isMintable: false, isBlacklist: false,
    holderCount: 0, sellTaxPct: 0, buyTaxPct: 0, source: 'unavailable',
  }

  return {
    ticker:        call.ticker,
    contract:      call.contract,
    chainId:       dex.chainId,
    dexUrl:        dex.dexUrl,
    callType:      call.callType,
    rawText:       call.rawText,
    timestamp:     call.timestamp,
    messageId:     call.messageId,

    sourceChannel: channel.displayName,
    channelScore:  channel.score,
    channelClass:  channel.classification,

    edgeScore:     Math.max(0, Math.min(1, edgeScore)),
    confidence:    classifyConfidence(edgeScore),
    winRate:       adjustedWinRate,
    rugRate:       adjustedRugRate,
    shillScore,
    urgencyScore,

    liquidity:     dex.liquidity,
    volume24h:     dex.volume24h,
    priceUsd:      dex.priceUsd,
    priceChange1h: formatPriceChange(dex.priceChange1h),
    maxGain:       estimateMaxGain(edgeScore, dex.liquidity),
    isNew,

    scamAnalysis:  defaultScam,
  }
}

// ─── Gem advise filter ────────────────────────────────────────────────────────

export interface GemAdviseOptions {
  filter?:       'all' | 'high' | 'medium' | 'low' | 'new'
  rugRateMax?:   number
  liquidityMin?: number
  topN?:         number
}

export function filterGems(
  calls:   ScoredCall[],
  options: GemAdviseOptions = {},
): ScoredCall[] {
  const {
    filter      = 'all',
    rugRateMax  = 0.30,
    liquidityMin = 20_000,
    topN        = 10,
  } = options

  return calls
    .filter(c => c.rugRate    <= rugRateMax)
    .filter(c => c.liquidity  >= liquidityMin)
    .filter(c => {
      if (filter === 'high')   return c.confidence === 'HIGH'
      if (filter === 'medium') return c.confidence === 'MEDIUM'
      if (filter === 'low')    return c.confidence === 'LOW'
      if (filter === 'new')    return c.isNew
      return true
    })
    .sort((a, b) => b.edgeScore - a.edgeScore)
    .slice(0, topN)
}

export function computeSummary(gems: ScoredCall[]) {
  const avgEdge   = gems.length
    ? gems.reduce((s, g) => s + g.edgeScore, 0) / gems.length
    : 0
  const highCount = gems.filter(g => g.confidence === 'HIGH').length
  const channels  = new Set(gems.map(g => g.sourceChannel)).size
  return {
    totalGems:       gems.length,
    highConfidence:  highCount,
    avgEdgeScore:    parseFloat(avgEdge.toFixed(4)),
    channelsSourced: channels,
    generatedAt:     new Date().toISOString(),
  }
}
