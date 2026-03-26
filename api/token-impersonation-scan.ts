/**
 * api/token-impersonation-scan.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Vercel Serverless Function – scans for tokens impersonating a legitimate
 * token by contract address, using DexScreener API (pure TypeScript, no
 * Python dependency). Mirrors the Express backend route at
 * /api/token-impersonation-scan.
 * ──────────────────────────────────────────────────────────────────────────
 */

import type { IncomingMessage, ServerResponse } from 'http'

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => VercelResponse
  end: () => void
}

// ─── Types ───────────────────────────────────────────────────────────────

interface TokenInfo {
  symbol: string
  name: string
  address: string
  price: string
  volume: number
  liquidity: number
  chain: string
  dex: string
  url: string
  pairAddress: string
  websites: { url: string; label: string }[]
  socials: { type: string; url: string }[]
}

interface ImpersonatorToken {
  symbol: string
  name: string
  address: string
  price: string
  liquidity: number
  volume: number
  chain: string
  dex: string
  url: string
  risk_score: number
  risk_factors: string[]
}

interface ScanResults {
  exact_symbol_fakes: ImpersonatorToken[]
  high_risk: ImpersonatorToken[]
  medium_risk: ImpersonatorToken[]
  low_risk: ImpersonatorToken[]
  unrelated: ImpersonatorToken[]
}

// ─── DexScreener helpers ──────────────────────────────────────────────────

async function getTokenInfo(contractAddress: string): Promise<TokenInfo | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`)
    const data = await res.json() as any
    if (!data.pairs || data.pairs.length === 0) return null
    const pair = data.pairs[0]
    const token = pair.baseToken ?? {}
    return {
      symbol:      token.symbol ?? '',
      name:        token.name ?? '',
      address:     token.address ?? '',
      price:       pair.priceUsd ?? 'N/A',
      volume:      pair.volume?.h24 ?? 0,
      liquidity:   pair.liquidity?.usd ?? 0,
      chain:       pair.chainId ?? '',
      dex:         pair.dexId ?? '',
      url:         pair.url ?? '',
      pairAddress: pair.pairAddress ?? '',
      websites:    pair.info?.websites ?? [],
      socials:     pair.info?.socials ?? [],
    }
  } catch {
    return null
  }
}

async function searchSimilarTokens(
  symbol: string,
  name: string,
  legitimateAddress: string,
): Promise<ImpersonatorToken[]> {
  const searchTerms = [
    symbol,
    name,
    symbol.includes(' ') ? symbol.split(' ')[0] : symbol,
    name.includes(' ')   ? name.split(' ')[0]   : symbol,
  ]
  const allPairs: any[] = []
  const seenAddresses = new Set<string>()

  for (const term of searchTerms) {
    try {
      const res  = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(term)}`)
      const data = await res.json() as any
      if (data.pairs) {
        for (const pair of data.pairs) {
          const addr = pair.baseToken?.address ?? ''
          if (addr && addr !== legitimateAddress && !seenAddresses.has(addr)) {
            allPairs.push(pair)
            seenAddresses.add(addr)
          }
        }
      }
    } catch {
      // continue
    }
  }

  const impersonators: ImpersonatorToken[] = []
  const legitSymbolUpper = symbol.toUpperCase()

  for (const pair of allPairs) {
    const t = pair.baseToken ?? {}
    const tSymbol  = (t.symbol ?? '').toUpperCase()
    const tAddress = t.address ?? ''

    let riskScore = 0
    const riskFactors: string[] = []

    if (tSymbol === legitSymbolUpper && tAddress !== legitimateAddress) {
      riskScore += 10
      riskFactors.unshift('FAKE TOKEN - Same symbol, different contract address!')
    } else if (tSymbol === legitSymbolUpper) {
      riskScore += 5
      riskFactors.push('Exact symbol match')
    } else if (tSymbol.includes(legitSymbolUpper)) {
      riskScore += 3
      riskFactors.push('Symbol contains legitimate token symbol')
    } else if (legitSymbolUpper.length >= 4 && tSymbol.startsWith(legitSymbolUpper.slice(0, 4))) {
      riskScore += 2
      riskFactors.push('Symbol starts with same characters')
    }

    if ((t.name ?? '').toUpperCase().includes(symbol.toUpperCase())) {
      riskScore += 2
      riskFactors.push('Name contains legitimate symbol')
    }

    const liquidity = pair.liquidity?.usd ?? 0
    if (liquidity < 1000 && riskScore > 0) {
      riskScore += 1
      riskFactors.push('Very low liquidity')
    }

    impersonators.push({
      symbol:       t.symbol ?? '',
      name:         t.name   ?? '',
      address:      tAddress,
      price:        pair.priceUsd ?? 'N/A',
      liquidity,
      volume:       pair.volume?.h24 ?? 0,
      chain:        pair.chainId ?? '',
      dex:          pair.dexId   ?? '',
      url:          pair.url     ?? '',
      risk_score:   riskScore,
      risk_factors: riskFactors,
    })
  }

  return impersonators
}

function categorise(impersonators: ImpersonatorToken[]): ScanResults {
  const results: ScanResults = {
    exact_symbol_fakes: [],
    high_risk:          [],
    medium_risk:        [],
    low_risk:           [],
    unrelated:          [],
  }
  for (const imp of impersonators) {
    if (imp.risk_score >= 10)      results.exact_symbol_fakes.push(imp)
    else if (imp.risk_score >= 5)  results.high_risk.push(imp)
    else if (imp.risk_score >= 3)  results.medium_risk.push(imp)
    else if (imp.risk_score >= 1)  results.low_risk.push(imp)
    else                           results.unrelated.push(imp)
  }
  return results
}

function generateAlert(legitimateToken: TokenInfo, impersonators: ScanResults): string {
  const totalExact = impersonators.exact_symbol_fakes.length
  const totalSuspicious = totalExact +
    impersonators.high_risk.length +
    impersonators.medium_risk.length +
    impersonators.low_risk.length
  const totalAnalyzed = totalSuspicious + impersonators.unrelated.length + 1

  let alert = 'SCAM ALERT - ' + legitimateToken.symbol.toUpperCase() + '\n\n' +
    'Completed full scan of ' + totalAnalyzed + ' tokens:\n\n' +
    'LEGITIMATE ' + legitimateToken.symbol.toUpperCase() + ': Verified Safe\n' +
    'Contract: ' + legitimateToken.address + '\n' +
    'Price: $' + legitimateToken.price + '\n\n'

  if (totalExact > 0) {
    alert += 'EXACT FAKES FOUND (' + totalExact + '):\n'
    for (const imp of impersonators.exact_symbol_fakes.slice(0, 5)) {
      alert += '- ' + imp.symbol + ' (' + imp.name + ') - ' + (imp.risk_factors[0] ?? '') + '\n'
      alert += '  Contract: ' + imp.address + '\n'
    }
  }

  if (impersonators.high_risk.length > 0) {
    alert += '\nHIGH RISK - AVOID:\n'
    for (const imp of impersonators.high_risk.slice(0, 5)) {
      const factors = imp.risk_factors.slice(0, 2).join(' | ')
      alert += '- ' + imp.symbol + ' (' + imp.name + ') - ' + factors + '\n'
      alert += '  Contract: ' + imp.address + '\n'
    }
  }

  if (impersonators.medium_risk.length > 0) {
    alert += '\nMEDIUM RISK:\n'
    for (const imp of impersonators.medium_risk.slice(0, 3)) {
      alert += '- ' + imp.symbol + ' (' + imp.name + ') - ' + (imp.risk_factors[0] ?? 'Suspicious') + '\n'
    }
  }

  alert += '\nPROTECT YOURSELF:\n' +
    'ALWAYS verify contract address before buying\n' +
    'Use Agentic Bro Scam Detection for deep investigations\n' +
    'Never buy tokens shared in unsolicited messages\n'

  return alert
}

// ─── Vercel handler ───────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Parse body
  let body: any = {}
  try {
    const chunks: Buffer[] = []
    for await (const chunk of req as any) chunks.push(Buffer.from(chunk))
    body = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  const contractAddress = (body.contractAddress ?? '').trim()
  if (!contractAddress) {
    res.status(400).json({ error: 'contractAddress is required' })
    return
  }

  try {
    // 1. Get legitimate token info
    const legitimateToken = await getTokenInfo(contractAddress)
    if (!legitimateToken) {
      res.status(404).json({ success: false, error: 'Token not found on DexScreener. Please check the contract address.' })
      return
    }

    // 2. Search for similar tokens
    const candidates = await searchSimilarTokens(
      legitimateToken.symbol,
      legitimateToken.name,
      contractAddress,
    )

    // 3. Categorise by risk
    const impersonators = categorise(candidates)

    // 4. Generate alert text
    const alert = generateAlert(legitimateToken, impersonators)

    const totalSuspicious =
      impersonators.exact_symbol_fakes.length +
      impersonators.high_risk.length +
      impersonators.medium_risk.length +
      impersonators.low_risk.length

    res.status(200).json({
      success: true,
      legitimateToken,
      impersonators,
      summary: {
        totalAnalyzed:    candidates.length + 1,
        exactSymbolFakes: impersonators.exact_symbol_fakes.length,
        highRisk:         impersonators.high_risk.length,
        mediumRisk:       impersonators.medium_risk.length,
        lowRisk:          impersonators.low_risk.length,
        unrelated:        impersonators.unrelated.length,
        suspicious:       totalSuspicious,
      },
      alert,
      scanDate: new Date().toISOString(),
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message ?? 'Internal server error' })
  }
}
