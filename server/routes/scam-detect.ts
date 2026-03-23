/**
 * Live Scam Detection API
 *
 * Routes:
 *   POST /api/scam-detect → Analyze X/Telegram user for scam patterns
 *
 * Data Sources:
 *   - Nitter (X profiles) — no API key required
 *   - Reddit Search (victim reports) — public API
 *   - Known Scammers Database (hardcoded)
 *
 * Start: Server already runs on port 3001
 */

import express, { Request, Response } from 'express'
import { readFileSync } from 'fs'
import { join } from 'path'

const router = express.Router()

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ScamDetectionRequest {
  username: string
  platform: 'X' | 'Telegram'
  walletAddress?: string
}

interface ScamDetectionResult {
  username: string
  platform: 'X' | 'Telegram'
  riskScore: number
  redFlags: string[]
  verificationLevel: 'Unverified' | 'Partially Verified' | 'Verified' | 'Highly Verified' | 'Legitimate'
  scamType?: string
  recommendedAction: string
  fullReport?: string
  xProfile?: {
    name?: string
    bio?: string
    followers?: number
    following?: number
    isVerified: boolean
    profileImage?: string
    profileUrl: string
    createdDate?: string
  }
  walletAnalysis?: {
    address: string
    blockchain: string
    balance: number
    balanceUsd: number
    totalReceived: number
    totalSent: number
    txCount: number
    uniqueSenders: number
  }
  victimReports?: {
    totalReports: number
    reports: { title: string; url: string; platform: string; score?: number }[]
  }
  knownScammer?: {
    name: string
    status: string
    victims: number
    notes: string
  }
  evidence: string[]
  dataSource: 'live' | 'mock'
}

interface KnownScammerEntry {
  name: string
  platform: string
  xHandle?: string
  telegramChannel?: string
  victims: number
  totalLostUsd: string
  verificationLevel: string
  scamType: string
  notes: string
}

// ─── Known Scammers Database ─────────────────────────────────────────────────────

const KNOWN_SCAMMERS: KnownScammerEntry[] = [
  {
    name: 'raynft_',
    platform: 'X',
    xHandle: '@raynft_',
    victims: 5,
    totalLostUsd: '$871.70',
    verificationLevel: 'Verified',
    scamType: 'Wallet Drainer / Fake Token Locker',
    notes: 'CONFIRMED SCAM (Solana): Stole $871.70 USD (9.33 SOL + 220M AGNTCBRO tokens). Promoted wallet drainer site https://app.solstreamflow.finance/ claiming to be a "developer token locker". Account is Verified (13+ years, 325K followers) but likely hacked or paid promotion. Thief hub wallet: 7vZKk8j4Jr2XctmhMTeUwNuUfqCbgSmEmSAogQVE7Msn (actively trading). KuCoin funding connection identified.',
  },
  {
    name: 'Bolo_WaQar1',
    platform: 'X',
    xHandle: '@Bolo_WaQar1',
    victims: 1,
    totalLostUsd: '?',
    verificationLevel: 'Unverified',
    scamType: 'Unknown',
    notes: 'X search executed - no public victim reports found. Earl reports this as a scammer. Investigation pending.',
  },
  {
    name: 'oudalserf',
    platform: 'X',
    xHandle: '@oudalserf',
    victims: 1,
    totalLostUsd: '?',
    verificationLevel: 'Unverified',
    scamType: 'Unknown',
    notes: 'X search executed - no public victim reports found. Earl reports this as a scammer. Investigation pending.',
  },
  {
    name: '22J27',
    platform: 'X',
    xHandle: '@22J27',
    victims: 1,
    totalLostUsd: '?',
    verificationLevel: 'Unverified',
    scamType: 'Unknown',
    notes: 'X search executed - no public victim reports found. Earl reports this as a scammer. Investigation pending.',
  },
]

// ─── Risk Scoring Logic ────────────────────────────────────────────────────────

function calculateRiskScore(
  redFlags: string[],
  _verificationLevel: string,
  victimReportCount: number,
  isKnownScammer: boolean
): number {
  let score = 0

  // Red flag weights
  redFlags.forEach(flag => {
    if (flag.includes('Guaranteed returns') || flag.includes('x100')) score += 2.0
    else if (flag.includes('Private alpha') || flag.includes('VIP')) score += 1.5
    else if (flag.includes('Urgency') || flag.includes('act now')) score += 1.2
    else if (flag.includes('No track record') || flag.includes('New account')) score += 1.0
    else if (flag.includes('Unverified')) score += 0.5
    else score += 0.8
  })

  // Known scammer penalty
  if (isKnownScammer) score += 3.0

  // Victim reports penalty
  if (victimReportCount > 10) score += 2.0
  else if (victimReportCount > 5) score += 1.5
  else if (victimReportCount > 0) score += 1.0

  // Cap at 10
  return Math.min(Math.round(score * 10) / 10, 10)
}

function getVerificationLevel(riskScore: number, victimReportCount: number): string {
  if (riskScore < 3 && victimReportCount === 0) return 'Legitimate'
  if (riskScore >= 7 && victimReportCount >= 5) return 'Highly Verified'
  if (riskScore >= 7 || victimReportCount >= 5) return 'Verified'
  if (riskScore >= 4 || victimReportCount > 0) return 'Partially Verified'
  return 'Unverified'
}

function getRecommendedAction(riskScore: number, _verificationLevel: string): string {
  if (riskScore < 3) return 'LOW RISK — Safe to interact. Still exercise normal caution.'
  if (riskScore < 5) return 'PROCEED WITH CAUTION — Medium risk detected. Verify track record before engaging.'
  if (riskScore < 7) return 'HIGH RISK DETECTED — Avoid interaction. Multiple red flags present.'
  return 'CRITICAL RISK — Block/Report immediately. Strong evidence of scam activity.'
}

// ─── Live Data Fetchers ───────────────────────────────────────────────────────

async function fetchXProfile(username: string): Promise<ScamDetectionResult['xProfile'] | undefined> {
  try {
    // Try multiple Nitter instances for better reliability
    const nitterInstances = [
      'https://nitter.net',
      'https://nitter.fdn.fr',
      'https://nitter.1d4.us',
      'https://nitter.kavin.rocks',
    ]

    const cleanUsername = username.replace('@', '')

    for (const instance of nitterInstances) {
      try {
        const response = await fetch(`${instance}/${cleanUsername}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(8000),
        })

        if (response.ok) {
          const html = await response.text()

          // Parse profile data from HTML
          const nameMatch = html.match(/<title>(.+?) \(@.+?\) <\/title>/)
          const bioMatch = html.match(/<meta name="description" content="(.+?)">/)
          const followersMatch = html.match(/<strong>([\d,]+)<\/strong>\s*<span class="profile-stat-header">Followers<\/span>/)
          const followingMatch = html.match(/<strong>([\d,]+)<\/strong>\s*<span class="profile-stat-header">Following<\/span>/)
          const joinedMatch = html.match(/Joined (.+?)<\/li>/)
          const isVerified = html.includes('<svg class="icon verified"') ||
                           html.includes('verified-badge') ||
                           html.includes('icon icon-verified-badge')
          const imageMatch = html.match(/<img class="profile-avatar" src="(.+?)"/) ||
                           html.match(/<img class="rounded-full" src="(.+?)"/)

          return {
            name: nameMatch?.[1]?.split(' (')[0]?.trim() || undefined,
            bio: bioMatch?.[1]?.trim() || undefined,
            followers: followersMatch?.[1] ? parseInt(followersMatch[1].replace(/,/g, '')) : undefined,
            following: followingMatch?.[1] ? parseInt(followingMatch[1].replace(/,/g, '')) : undefined,
            isVerified,
            profileImage: imageMatch?.[1],
            profileUrl: `https://x.com/${cleanUsername}`,
            createdDate: joinedMatch?.[1]?.trim() || undefined,
          }
        }
      } catch (e) {
        // Try next Nitter instance
        continue
      }
    }
  } catch (error) {
    console.error('Error fetching X profile:', error)
  }

  return undefined
}

async function searchVictimReports(username: string): Promise<ScamDetectionResult['victimReports']> {
  const reports: { title: string; url: string; platform: string; score?: number }[] = []

  try {
    const cleanUsername = username.replace('@', '')
    const redditQuery = encodeURIComponent(`${cleanUsername} scam`)

    // Search Reddit for victim reports
    const response = await fetch(`https://www.reddit.com/search.json?q=${redditQuery}&limit=5&sort=relevance`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })

    if (response.ok) {
      const data = await response.json()
      if (data.data?.children) {
        data.data.children.forEach((post: any) => {
          reports.push({
            title: post.data.title,
            url: `https://reddit.com${post.data.permalink}`,
            platform: 'Reddit',
            score: post.data.score,
          })
        })
      }
    }
  } catch (error) {
    console.error('Error searching Reddit:', error)
  }

  return { totalReports: reports.length, reports }
}

function checkScammerDatabase(username: string, _platform: string): ScamDetectionResult['knownScammer'] | undefined {
  const cleanUsername = username.replace('@', '').toLowerCase()

  const found = KNOWN_SCAMMERS.find(scammer => {
    const scammerHandle = scammer.xHandle?.replace('@', '').toLowerCase()
    return scammerHandle === cleanUsername
  })

  if (found) {
    return {
      name: found.name,
      status: found.verificationLevel,
      victims: found.victims,
      notes: found.notes,
    }
  }

  return undefined
}

// ─── Red Flag Detection ───────────────────────────────────────────────────────

function detectRedFlags(
  _username: string,
  profile: ScamDetectionResult['xProfile'],
  victimReports: ScamDetectionResult['victimReports']
): string[] {
  const flags: string[] = []

  if (!profile?.isVerified) {
    flags.push('Unverified account')
  }

  if (profile?.followers && profile.followers < 500) {
    flags.push('Low follower count (possible bot/fake account)')
  }

  if (profile?.bio) {
    const bioLower = profile.bio.toLowerCase()

    if (bioLower.includes('guaranteed') || bioLower.includes('100x') || bioLower.includes('1000x')) {
      flags.push('Claims guaranteed returns or unrealistic profits')
    }

    if (bioLower.includes('private') && bioLower.includes('alpha')) {
      flags.push('Private alpha/early access model (requires payment for information)')
    }

    if (bioLower.includes('vip') || bioLower.includes('premium')) {
      flags.push('VIP upsell tactics (paid tiers for access)')
    }

    if (bioLower.includes('act now') || bioLower.includes('limited time') || bioLower.includes('fomo')) {
      flags.push('Urgency tactics to create fear of missing out')
    }

    if (bioLower.includes('1000x') && bioLower.includes('gem')) {
      flags.push('Aggressive "1000x gem" language typical of pump-and-dump groups')
    }
  }

  if (profile?.createdDate) {
    const createdDate = new Date(profile.createdDate)
    const accountAge = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30) // months

    if (accountAge < 3) {
      flags.push(`New account (${Math.round(accountAge)} months old)`)
    }
  }

  if (victimReports && victimReports.totalReports > 0) {
    flags.push(`${victimReports.totalReports} victim report(s) found on Reddit`)
  }

  return flags
}

// ─── Generate Full Report ───────────────────────────────────────────────────────

function generateFullReport(
  result: ScamDetectionResult
): string {
  let report = `SCAM DETECTION REPORT
=====================

Target: ${result.username}
Platform: ${result.platform}
Investigation Date: ${new Date().toISOString()}
Data Source: ${result.dataSource.toUpperCase()}

RISK ASSESSMENT
Risk Score: ${result.riskScore}/10 (${result.riskScore < 4 ? 'LOW' : result.riskScore < 7 ? 'MEDIUM' : 'HIGH'} RISK)
Verification Level: ${result.verificationLevel}

RECOMMENDED ACTION
${result.recommendedAction}

RED FLAGS FOUND (${result.redFlags.length})
${result.redFlags.map(flag => `- ${flag}`).join('\n')}`

if (result.scamType) {
    report += `\n\nSCAM TYPE\n${result.scamType}`
  }

  if (result.xProfile) {
    report += `\n\nPROFILE ANALYSIS
${result.xProfile.name || result.username}
${result.xProfile.isVerified ? '✓ Verified' : '✗ Unverified'}`
    if (result.xProfile.followers !== undefined) {
      report += `\nFollowers: ${result.xProfile.followers.toLocaleString()}`
    }
    if (result.xProfile.following !== undefined) {
      report += `\nFollowing: ${result.xProfile.following.toLocaleString()}`
    }
    if (result.xProfile.createdDate) {
      report += `\nAccount Created: ${result.xProfile.createdDate}`
    }
    if (result.xProfile.bio) {
      report += `\nBio: ${result.xProfile.bio}`
    }
    report += `\nProfile URL: ${result.xProfile.profileUrl}`
  }

  if (result.victimReports && result.victimReports.totalReports > 0) {
    report += `\n\nVICTIM REPORTS FOUND: ${result.victimReports.totalReports}`
    result.victimReports.reports.forEach((victimReport, idx) => {
      report += `\n${idx + 1}. "${victimReport.title}" - ${victimReport.platform}`
      if (victimReport.score !== undefined) {
        report += ` (${victimReport.score} ${victimReport.score === 1 ? 'upvote' : 'upvotes'})`
      }
      report += `\n   ${victimReport.url}`
    })
  }

  report += `\n\nEVIDENCE
${result.evidence.map(ev => `- ${ev}`).join('\n')}`

  if (result.knownScammer) {
    report += `\n\n⚠️ KNOWN SCAMMER DETECTED\nStatus: ${result.knownScammer.status}\nVictims: ${result.knownScammer.victims}\nNotes: ${result.knownScammer.notes}`
  }

  report += `\n\nDISCLAIMER
This report contains only publicly available information. Use for legitimate awareness purposes only. Do not harass, dox, or contact scammers directly — file reports with proper authorities.`

  return report
}

// ─── POST /api/scam-detect ──────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, platform, walletAddress } = req.body as ScamDetectionRequest

    // Validate request
    if (!username || !platform) {
      return res.status(400).json({ error: 'Missing required fields: username and platform' })
    }

    if (platform !== 'X' && platform !== 'Telegram') {
      return res.status(400).json({ error: 'Invalid platform. Must be "X" or "Telegram"' })
    }

    // Fetch live data in parallel
    const [xProfile, victimReports, knownScammer] = await Promise.all([
      platform === 'X' ? fetchXProfile(username) : Promise.resolve(undefined),
      searchVictimReports(username),
      Promise.resolve(checkScammerDatabase(username, platform)),
    ])

    // Detect red flags
    const redFlags = detectRedFlags(username, xProfile, victimReports)

    // Calculate risk score
    const riskScore = calculateRiskScore(
      redFlags,
      'unknown',
      victimReports.totalReports,
      !!knownScammer
    )

    // Determine verification level
    const verificationLevel = getVerificationLevel(riskScore, victimReports.totalReports)

    // Get recommended action
    const recommendedAction = getRecommendedAction(riskScore, verificationLevel)

    // Determine scam type
    let scamType: string | undefined
    if (redFlags.some(f => f.includes('guaranteed') || f.includes('unrealistic'))) {
      scamType = 'Investment Fraud / High-Yield Scam'
    } else if (redFlags.some(f => f.includes('private alpha') || f.includes('VIP'))) {
      scamType = 'Paid Signal / Premium Alpha Scam'
    } else if (redFlags.some(f => f.includes('urgency'))) {
      scamType = 'Pump-and-Dump / FOMO Scheme'
    } else if (redFlags.some(f => f.includes('wallet') || f.includes('aggregation'))) {
      scamType = 'Wallet Drainer / Phishing Scheme'
    }

    // Generate evidence
    const evidence = [
      redFlags.length > 0 ? `${redFlags.length} red flag(s) detected` : 'No red flags detected',
      xProfile ? `Profile data analyzed: ${xProfile.isVerified ? 'Verified' : 'Unverified'}, ${xProfile.followers?.toLocaleString() || 'N/A'} followers` : 'Profile data unavailable',
      victimReports.totalReports > 0 ? `${victimReports.totalReports} victim report(s) found on Reddit` : 'No victim reports found',
      `Investigation timestamp: ${new Date().toISOString()}`,
    ]

    // Build result
    const result: ScamDetectionResult = {
      username,
      platform,
      riskScore,
      redFlags,
      verificationLevel: verificationLevel as any,
      scamType,
      recommendedAction,
      xProfile,
      victimReports,
      knownScammer,
      evidence,
      dataSource: 'live',
      fullReport: '', // Will be generated below
    }

    // Generate full report
    result.fullReport = generateFullReport(result)

    // Return result
    res.json({ results: [result], mock: false })
  } catch (error) {
    console.error('Scam detection error:', error)
    res.status(500).json({ error: 'Internal server error', detail: error instanceof Error ? error.message : 'Unknown error' })
  }
})

export default router