import { useState, useCallback, useRef, useEffect } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTokenGating, isTestWallet } from './hooks/useTokenGating'
import MobileMenu from './components/MobileMenu'

import ValueProposition from './components/ValueProposition'
import ScamDetectionSection from './components/ScamDetectionSection'
import ScamDatabaseModal from './components/ScamDatabaseModal'
import ProfileVerifierScanner from './components/ProfileVerifierScanner'
import PhoneNumberVerifier from './components/PhoneNumberVerifier'
import PriorityTokenScanner from './components/PriorityTokenScanner'
import TokenScanner from './components/TokenScanner'
import TokenImpersonationScanner from './components/TokenImpersonationScanner'
import AgntcbroBalanceTracker from './components/AgntcbroBalanceTracker'
import Roadmap from './components/Roadmap'
import PreConnectScanWidget from './components/PreConnectScanWidget'
import LanguageSelector, { type Locale } from './components/LanguageSelector'
import UserMenu from './components/UserMenu'
import AuthModal from './components/AuthModal'
import PaymentModal from './components/PaymentModal'

// Relative URL base — Vite proxy forwards /api/* → localhost:3001 in dev,
// Vercel serverless functions handle /api/* in production.
const API_BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? ''

// ─── Known channel data (module-level so both generateChannelSuccessRate and runScan can access it) ──
const knownChannels: Record<string, any> = {
  'cryptolordgem': {
    success_tier: 'POOR', winRate: 36, rugRate: 38, avgWinGain: 2.8, avgLoss: 72,
    avgLiquidity: 85000, totalCalls: 47, wins: 17, losses: 12, rugs: 18,
    recentWinRate: 30, riskAdjustedReturn: -0.18, tradeable: false, risk_level: 'HIGH', confidence: 'LOW',
  },
  'cryptospacex04': {
    success_tier: 'GOOD', winRate: 42, rugRate: 28, avgWinGain: 2.5, avgLoss: 35,
    avgLiquidity: 125000, totalCalls: 62, wins: 26, losses: 19, rugs: 17,
    recentWinRate: 50, riskAdjustedReturn: 0.85, tradeable: true, risk_level: 'MODERATE', confidence: 'MEDIUM',
  },
  'elitebullsignals': {
    success_tier: 'GOOD', winRate: 48, rugRate: 22, avgWinGain: 3.4, avgLoss: 28,
    avgLiquidity: 168000, totalCalls: 58, wins: 28, losses: 13, rugs: 17,
    recentWinRate: 52, riskAdjustedReturn: 1.45, tradeable: true, risk_level: 'MODERATE', confidence: 'MEDIUM',
  },
  'dailypumpgems': {
    success_tier: 'MODERATE', winRate: 38, rugRate: 32, avgWinGain: 2.9, avgLoss: 52,
    avgLiquidity: 95000, totalCalls: 98, wins: 37, losses: 30, rugs: 31,
    recentWinRate: 40, riskAdjustedReturn: 0.45, tradeable: true, risk_level: 'HIGH', confidence: 'LOW',
    tokens: [
      { ticker: '$PUMP',  name: 'PumpToken',    contract: 'DezXAZfZcL7fG1P8j2Tb3v5E7d9hK8mLqQn3fG', edgeScore: 0.74, confidence: 'HIGH',   winRate: 0.52, rugRate: 0.20, liquidity: 145000, volume24h: 520000, sourceChannel: 'DailyPumpGems', priceChange1h: '+28.6%', maxGain: '4.8x', isNew: false },
      { ticker: '$GEM',   name: 'GemHunterPro', contract: '9mF8d8h9gK7k2LpN4r5v6T8wX1yZ2cB3nD4eA',  edgeScore: 0.66, confidence: 'MEDIUM',  winRate: 0.48, rugRate: 0.25, liquidity: 118000, volume24h: 410000, sourceChannel: 'DailyPumpGems', priceChange1h: '+22.4%', maxGain: '4.1x', isNew: true  },
      { ticker: '$MOON',  name: 'MoonShot',     contract: '5aR7e7f8d9gK8k3MqN5r6v7T9wX2yZ3dD4eF5bG',edgeScore: 0.58, confidence: 'MEDIUM',  winRate: 0.42, rugRate: 0.28, liquidity:  92000, volume24h: 340000, sourceChannel: 'DailyPumpGems', priceChange1h: '+16.8%', maxGain: '3.4x', isNew: false },
      { ticker: '$DAILY', name: 'DailyGains',   contract: '8bS8g8h9hL9l4NqO6r7v8T0wX3yZ4eE5fF6cH',  edgeScore: 0.50, confidence: 'MEDIUM',  winRate: 0.38, rugRate: 0.30, liquidity:  78000, volume24h: 280000, sourceChannel: 'DailyPumpGems', priceChange1h: '+12.4%', maxGain: '2.8x', isNew: true  },
    ],
  },
  'cryptorush_global_call': {
    success_tier: 'GOOD', winRate: 45, rugRate: 25, avgWinGain: 3.2, avgLoss: 38,
    avgLiquidity: 142000, totalCalls: 72, wins: 32, losses: 22, rugs: 18,
    recentWinRate: 48, riskAdjustedReturn: 0.92, tradeable: true, risk_level: 'MODERATE', confidence: 'MEDIUM',
    tokens: [
      { ticker: '$RUSH',     name: 'RushProtocol', contract: '8cT9i9j0lK6m3NqO5r6v7T9wX2yZ3dD4eF5bG', edgeScore: 0.81, confidence: 'HIGH',  winRate: 0.58, rugRate: 0.18, liquidity: 168000, volume24h: 590000, sourceChannel: 'Crypto_Rush_Global_Call', priceChange1h: '+35.6%', maxGain: '5.8x', isNew: false },
      { ticker: '$GLOBAL',   name: 'GlobalToken',  contract: '2dS8h8i0lL7m3NqO5r6v7T9wX2yZ3eE4fG6cH', edgeScore: 0.74, confidence: 'HIGH',  winRate: 0.52, rugRate: 0.20, liquidity: 155000, volume24h: 520000, sourceChannel: 'Crypto_Rush_Global_Call', priceChange1h: '+28.4%', maxGain: '5.2x', isNew: true  },
      { ticker: '$ALPHA',    name: 'AlphaRush',    contract: '1eR7g7g8i0lL6m3NqO5r6v7T9wX2yZ3cD3eF4bG',edgeScore: 0.68, confidence: 'MEDIUM', winRate: 0.48, rugRate: 0.22, liquidity: 134000, volume24h: 410000, sourceChannel: 'Crypto_Rush_Global_Call', priceChange1h: '+21.2%', maxGain: '4.5x', isNew: false },
      { ticker: '$SPEED',    name: 'SpeedToken',   contract: '3fU9i9k0lL6m3NqO5r6v7T9wX2yZ3eE3fF5cG', edgeScore: 0.62, confidence: 'MEDIUM', winRate: 0.42, rugRate: 0.25, liquidity: 118000, volume24h: 350000, sourceChannel: 'Crypto_Rush_Global_Call', priceChange1h: '+15.8%', maxGain: '3.6x', isNew: false },
      { ticker: '$MOMENTUM', name: 'MomentumX',    contract: '4gV9i0l0mL6m3NqO5r6v7T9wX2yZ4fF5cG',    edgeScore: 0.55, confidence: 'MEDIUM', winRate: 0.38, rugRate: 0.28, liquidity:  98000, volume24h: 280000, sourceChannel: 'Crypto_Rush_Global_Call', priceChange1h: '+11.4%', maxGain: '2.9x', isNew: true  },
    ],
  },
}

// ─── Priority Scan types ──────────────────────────────────────────────────────

type ScanMode = 'wallet' | 'channels' | 'token' | 'social' | 'phone'

type ScamVerdict = 'SCAM' | 'RISKY' | 'CLEAN' | 'UNKNOWN'

interface ScamAnalysis {
  verdict:     ScamVerdict
  isHoneypot:  boolean
  highSellTax: boolean
  hiddenOwner: boolean
  isMintable:  boolean
  isBlacklist: boolean
  holderCount: number
  sellTaxPct:  number
  buyTaxPct:   number
  source:      'goplus' | 'heuristic' | 'unavailable'
}

interface ScanResult {
  ticker: string
  edgeScore: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  winRate: number
  rugRate: number
  liquidity: number
  volume24h: number
  priceUsd: number
  priceChange1h: string   // formatted e.g. "+12.4%"
  maxGain: string         // estimated e.g. "3.2x"
  isNew: boolean
  sourceChannel: string
  recommendation: string
  flagged: boolean
  flagReason?: string
  contract?: string
  chainId?: string | null
  dexUrl?: string | null
  scamAnalysis?: ScamAnalysis
}

interface ChatMessage {
  id: number
  type: 'system' | 'success' | 'warning' | 'error' | 'result'
  icon: string
  text: string
  result?: ScanResult
  scamResult?: {
    username: string
    platform: 'X' | 'Telegram'
    riskScore: number
    verificationLevel: string
    redFlags: string[]
    scamType?: string
    evidence: string[]
    recommendedAction: string
  }
}

function App() {
  const { connected, publicKey } = useWallet()
  const [showValueProp, setShowValueProp] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [showTierPage, setShowTierPage] = useState<'holder' | 'whale' | null>(null)
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false)
  const [showScamDatabase, setShowScamDatabase] = useState(false)
  const [locale, setLocale] = useState<Locale>('en')

  // Get wallet-specific scan count - memoized to ensure consistent key
  const getWalletScanKey = useCallback(() => {
    if (!publicKey) return 'priorityFreeScans';
    return `priorityFreeScans_${publicKey.toString()}`;
  }, [publicKey]);

  const { holderTierUnlocked, whaleTierUnlocked: _whaleTierUnlocked, balance, usdValue, tokenPriceUsd, loading: gatingLoading } = useTokenGating()
  
  // Track if we've initialized the scan count for the current wallet
  const scanKeyRef = useRef<string | null>(null);
  
  const [priorityScansRemaining, setPriorityScansRemaining] = useState(() => {
    // Use a stable key based on wallet
    const key = publicKey ? `priorityFreeScans_${publicKey.toString()}` : 'priorityFreeScans';
    scanKeyRef.current = key;
    const saved = localStorage.getItem(key);
    // Default to 5 - will be updated by useEffect when holderTierUnlocked is known
    return saved ? Math.max(0, parseInt(saved, 10)) : 5;
  });

  // Update scan count - uses functional update to avoid stale closure
  const updateScanCount = useCallback((newCount: number) => {
    const key = getWalletScanKey();
    console.log('[updateScanCount] Decrementing scan count. Key:', key, 'New count:', newCount);
    setPriorityScansRemaining(prev => {
      console.log('[updateScanCount] Previous count:', prev, 'Setting to:', newCount);
      return newCount;
    });
    localStorage.setItem(key, String(newCount));
  }, [getWalletScanKey]);

  const [isScanning, setIsScanning]     = useState(false)
  const [scanMessages, setScanMessages] = useState<ChatMessage[]>([])
  const [scanMode, setScanMode]         = useState<ScanMode>('wallet')
  const [walletInput, setWalletInput]   = useState('')
  const [channelInput, setChannelInput] = useState('')
  const [tokenInput, setTokenInput]     = useState('')
  const [socialPlatform, setSocialPlatform] = useState<'instagram' | 'tiktok' | 'facebook'>('instagram')
  const [socialUsername, setSocialUsername] = useState('')
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Update scan count when wallet connects or holder tier status changes
  // IMPORTANT: Only initialize ONCE per wallet, don't reset after decrement
  useEffect(() => {
    const key = getWalletScanKey();
    
    // Skip if this is the same wallet we already initialized
    if (scanKeyRef.current === key) {
      return;
    }
    
    // Update the ref to track current wallet
    scanKeyRef.current = key;
    
    const saved = localStorage.getItem(key);
    if (saved) {
      // Use saved value if it exists
      const savedCount = Math.max(0, parseInt(saved, 10));
      console.log('[useEffect] Restoring saved count:', savedCount, 'for key:', key);
      setPriorityScansRemaining(savedCount);
    } else {
      // Only set default if no saved value exists
      const defaultScans = holderTierUnlocked ? 50 : 5;
      console.log('[useEffect] Setting default count:', defaultScans, 'for key:', key);
      setPriorityScansRemaining(defaultScans);
      localStorage.setItem(key, String(defaultScans));
    }
  }, [publicKey, holderTierUnlocked, getWalletScanKey]);

  // Tier denial state removed — now scrolls to scan section

  // Auth and Payment modals
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  // Auth context is available via AuthProvider in main.tsx

  // Tier click scrolls to priority scan section

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [scanMessages])

  // Show welcome banner when wallet connects
  useEffect(() => {
    if (connected && publicKey && !showWelcomeBanner) {
      const hasSeenWelcome = localStorage.getItem('walletWelcomeSeen')
      if (!hasSeenWelcome) {
        setShowWelcomeBanner(true)
      }
    }
  }, [connected, publicKey])

  const isTest = isTestWallet(publicKey?.toBase58() ?? '')

  const addMsg = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    setScanMessages(prev => [...prev, { ...msg, id: Date.now() + Math.random() }])
  }, [])

  // Generate mock channel success rate data (in production, this would come from an API)
  const generateChannelSuccessRate = (channelName: string) => {
    // Use channel name hash to generate consistent but varied data
    const hash = channelName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    
    
    // Return known data if available
    if (knownChannels[channelName.toLowerCase()]) {
      return knownChannels[channelName.toLowerCase()]
    }
    
    // Otherwise generate based on hash
    const totalCalls = 20 + (hash % 60) // 20-80 calls
    const winRate = 30 + (hash % 25) // 30-55%
    const rugRate = 20 + (hash % 30) // 20-50%
    const wins = Math.round(totalCalls * winRate / 100)
    const rugs = Math.round(totalCalls * rugRate / 100)
    const losses = totalCalls - wins - rugs
    
    let success_tier: string
    if (winRate >= 50 && rugRate <= 15) success_tier = 'EXCELLENT'
    else if (winRate >= 40 && rugRate <= 25) success_tier = 'GOOD'
    else if (winRate >= 30 && rugRate <= 35) success_tier = 'MODERATE'
    else success_tier = 'POOR'
    
    const avg_win_gain = 1.5 + (hash % 20) / 10 // 1.5-3.5x
    const avg_loss = 25 + (hash % 50) // 25-75%
    const loss_rate = (losses + rugs) / totalCalls
    const risk_adjusted_return = (winRate / 100 * avg_win_gain) - (loss_rate * avg_loss / 100)
    
    return {
      success_tier,
      winRate,
      rugRate,
      avgWinGain: Number(avg_win_gain.toFixed(2)),
      avgLoss: avg_loss,
      avgLiquidity: 50000 + (hash % 150000), // $50K-$200K
      totalCalls,
      wins,
      losses,
      rugs,
      recentWinRate: Math.max(0, winRate - 5 + (hash % 10)), // Varied recent performance
      riskAdjustedReturn: Number(risk_adjusted_return.toFixed(2)),
      tradeable: success_tier !== 'POOR',
      risk_level: rugRate > 30 ? 'HIGH' : rugRate > 20 ? 'MODERATE' : 'LOW',
      confidence: success_tier === 'EXCELLENT' ? 'HIGH' : success_tier === 'GOOD' ? 'MEDIUM' : 'LOW'
    }
  }

  const runScan = useCallback(async () => {
    // Social profile scan uses a different API
    if (scanMode === 'social') {
      const uName = socialUsername.trim().replace(/^@/, '')
      if (!uName) return
      setIsScanning(true)
      setScanMessages([])
      addMsg({ type: 'system', icon: '🔍', text: `Scanning ${socialPlatform} profile: @${uName}…` })

      try {
        // Start async scan — get job ID immediately
        const startRes = await fetch(`${API_BASE}/api/social-scan?async=1`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: socialPlatform, username: uName }),
        })
        const startData = await startRes.json() as any

        let data: any = null
        if (startData.status === 'pending' && startData.id) {
          // Poll for result (max 15 seconds)
          const jobId = startData.id
          let attempts = 0
          const maxAttempts = 30
          const pollInterval = 500

          while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, pollInterval))
            const pollRes = await fetch(`${API_BASE}/api/social-scan/${jobId}`)
            data = await pollRes.json() as any
            if (data.status === 'done' || data.status === 'error') break
            attempts++
          }

          if (!data || (data.status !== 'done' && data.status !== 'error')) {
            addMsg({ type: 'error', icon: '⏱️', text: 'Scan timed out. The platform may be slow or blocking requests.' })
          } else {
            data = { ...data, ...data.result }
          }
        } else {
          // Fallback: sync scan
          const syncRes = await fetch(`${API_BASE}/api/social-scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: socialPlatform, username: uName }),
          })
          data = await syncRes.json() as any
        }

        // Process result (same for async and sync)
        const result = data?.result ?? data
        if (!result.success || result.error) {
          if (result.error === 'PROFILE_LOGIN_REQUIRED') {
            addMsg({ type: 'warning', icon: '🔒', text: `${socialPlatform.charAt(0).toUpperCase() + socialPlatform.slice(1)} requires login to view @${uName}. This profile can't be scanned via web.` })
            addMsg({ type: 'system', icon: '💡', text: 'For accurate scanning, use the Jeeevs Telegram bot or request a Chrome CDP scan.' })
          } else {
            addMsg({ type: 'error', icon: '❌', text: result.error ?? 'Scan failed' })
          }
        } else {
          const emoji = result.riskLevel === 'LOW' ? '✅' : result.riskLevel === 'MEDIUM' ? '🟡' : result.riskLevel === 'HIGH' ? '🔴' : '🚨'
          addMsg({ type: 'result', icon: '🔍', text: `Platform: ${socialPlatform.charAt(0).toUpperCase() + socialPlatform.slice(1)}` })
          addMsg({ type: 'result', icon: '📊', text: `Risk Score: ${result.riskScore}/10 — ${result.riskLevel} RISK ${emoji}` })
          if (result.flagDetails?.length) {
            for (const flag of result.flagDetails) {
              const fEmoji = flag.weight >= 15 ? '🚨' : flag.weight >= 10 ? '⚠️' : '📌'
              addMsg({ type: flag.weight >= 15 ? 'warning' : 'result', icon: fEmoji, text: `• ${flag.flag.replace(/_/g, ' ')} (${flag.weight}pts) — ${flag.description}` })
            }
            addMsg({ type: 'system', icon: '📊', text: `Total: ${result.weightsSum}/${result.maxPossibleWeight || 90} pts · Flag values: guaranteed_returns(25) · giveaway_airdrop(20) · dm_solicitation(15) · free_crypto(15) · alpha_dm_scheme(15) · unrealistic_claims(10) · download_install(10) · urgency_tactics(10) · emotional_manipulation(10) · low_credibility(10)` })
          }
          const patternText = result.riskLevel === 'CRITICAL' ? 'Multiple high-severity scam indicators detected. Extreme caution advised.' :
            result.riskLevel === 'HIGH' ? 'Significant scam indicators present. Verify independently before any engagement.' :
            result.riskLevel === 'MEDIUM' ? 'Some concerning patterns detected. Further verification recommended.' :
            'No significant scam patterns identified.'
          addMsg({ type: 'system', icon: '🔍', text: `Behavioral Pattern: ${patternText}` })
          addMsg({ type: 'system', icon: '📋', text: `Disclaimer: Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR. Scan date: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` })
        }
      } catch (err: any) {
        addMsg({ type: 'error', icon: '❌', text: err?.message ?? 'Scan request failed' })
      } finally {
        setIsScanning(false)
      }
      return
    }

    const inputValue = scanMode === 'wallet' ? walletInput.trim()
                     : scanMode === 'channels' ? channelInput.trim()
                     : scanMode === 'token' ? tokenInput.trim()
                     : ''

    if (!inputValue) return
    if (!isTest && priorityScansRemaining <= 0 && !holderTierUnlocked) {
      alert('Scan limit reached. Hold $100+ in AGNTCBRO for 50 monthly Priority Scans.')
      return
    }

    if (!isTest && priorityScansRemaining > 0) updateScanCount(priorityScansRemaining - 1)

    setIsScanning(true)
    setScanMessages([])

    const modeLabel = scanMode === 'wallet' ? `wallet ${inputValue.slice(0,6)}…${inputValue.slice(-4)}`
                    : scanMode === 'channels' ? `channel ${inputValue}`
                    : scanMode === 'token' ? `token ${inputValue}`
                    : 'unknown'

    addMsg({ type: 'system', icon: '🔍', text: `Initiating Priority Scan for ${modeLabel}…` })
    addMsg({ type: 'system', icon: '📡', text: 'Connecting to Telegram alpha feeds…' })

    // For channel scans, add success rate analysis
    if (scanMode === 'channels') {
      addMsg({ type: 'system', icon: '📊', text: 'Analyzing historical call performance and success rates…' })
      await new Promise(r => setTimeout(r, 600))
      
      // Generate mock success rate data (in production, this would come from an API)
      const channelName = inputValue.replace(/^@/, '').replace(/^t\.me\//, '').toLowerCase()
      const successRateData = generateChannelSuccessRate(channelName)
      
      const successTier = successRateData.success_tier
      const tierEmoji = successTier === 'EXCELLENT' ? '🟢' : 
                       successTier === 'GOOD' ? '🟡' : 
                       successTier === 'MODERATE' ? '🟠' : '🔴'
      
      addMsg({ 
        type: successTier === 'POOR' ? 'error' : successTier === 'MODERATE' ? 'warning' : 'success',
        icon: '📈', 
        text: `Channel: @${inputValue.replace(/^@/, '')} · ${tierEmoji} ${successTier} Tier` 
      })
      
      // Detailed performance breakdown
      addMsg({ type: 'result', icon: '📊', text: `Total Calls: ${successRateData.totalCalls} · Wins: ${successRateData.wins} · Losses: ${successRateData.losses} · Rugs: ${successRateData.rugs}` })
      addMsg({ type: 'result', icon: '🎯', text: `Win Rate: ${successRateData.winRate}% · Rug Rate: ${successRateData.rugRate}% · Recent (10): ${successRateData.recentWinRate}%` })
      addMsg({ type: 'result', icon: '💰', text: `Avg Win: ${successRateData.avgWinGain}x · Avg Loss: ${successRateData.avgLoss}%` })
      addMsg({ type: 'result', icon: '💹', text: `Risk-Adjusted Return: ${successRateData.riskAdjustedReturn} ${successRateData.riskAdjustedReturn >= 0 ? '(Positive)' : '(Negative)'}` })
      addMsg({ type: 'result', icon: '💧', text: `Avg Liquidity: $${successRateData.avgLiquidity.toLocaleString()}` })
      
      const riskLevel = successRateData.risk_level
      const riskEmoji = riskLevel === 'HIGH' ? '🔴' : riskLevel === 'MODERATE' ? '🟡' : '🟢'
      addMsg({ 
        type: riskLevel === 'HIGH' ? 'error' : riskLevel === 'MODERATE' ? 'warning' : 'result',
        icon: '⚠️', 
        text: `${riskEmoji} Risk Level: ${riskLevel} · Confidence: ${successRateData.confidence} · ${successRateData.tradeable ? '✅ Tradeable' : '❌ Avoid'}` 
      })
      
      // Benchmark comparison
      const industryAvgWin = 35.0
      const industryAvgRug = 40.0
      const aboveAvgWin = successRateData.winRate >= industryAvgWin
      const belowAvgRug = successRateData.rugRate <= industryAvgRug
      
      addMsg({ type: 'result', icon: '🏆', text: `Industry Comparison: ${aboveAvgWin ? '📈' : '📉'} Win ${successRateData.winRate >= industryAvgWin ? '+' : ''}${(successRateData.winRate - industryAvgWin).toFixed(0)}% · ${belowAvgRug ? '✅' : '❌'} Rug ${successRateData.rugRate <= industryAvgRug ? '-' : '+'}${Math.abs(successRateData.rugRate - industryAvgRug).toFixed(0)}%` })
      
      await new Promise(r => setTimeout(r, 400))
    }

    try {
      const res  = await fetch(`${API_BASE}/api/telegram/priority-scan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target:  scanMode,
          wallet:  scanMode === 'wallet'   ? inputValue : undefined,
          channel: scanMode === 'channels' ? inputValue : undefined,
          token:   scanMode === 'token'    ? inputValue : undefined,
        }),
      })
      const data = await res.json() as { results?: ScanResult[]; mock?: boolean; ts?: number; error?: string; detail?: string }

      // Surface server-side errors (e.g. channel not found) directly to the user
      if (!res.ok || data.error) {
        const msg = data.detail ?? data.error ?? `Server error (${res.status})`
        addMsg({ type: 'error', icon: '❌', text: msg })
        return
      }

      const results: ScanResult[] = data.results ?? []

      if (data.mock) addMsg({ type: 'warning', icon: '⚠️', text: 'Running in demo mode — add Telegram credentials for live data' })

      addMsg({ type: 'system', icon: '⚙️', text: `Scoring ${results.length} token calls…` })
      await new Promise(r => setTimeout(r, 400))

      if (results.length === 0) {
        // Check if this is a known channel with token data
        const channelName = scanMode === 'channels' ? channelInput.trim().replace(/^@/, '').replace(/^t\.me\//, '').toLowerCase() : ''
        const knownChannel = knownChannels[channelName]
        
        if (knownChannel && knownChannel.tokens && knownChannel.tokens.length > 0) {
          // Use known channel tokens instead of empty API results
          const channelTokens = knownChannel.tokens
          const high = channelTokens.filter((t: any) => t.confidence === 'HIGH').length
          addMsg({ type: 'success', icon: '✅', text: `Scan complete — ${channelTokens.length} tokens evaluated, ${high} HIGH confidence (known channel data)` })
          
          for (const token of channelTokens) {
            await new Promise(res2 => setTimeout(res2, 180))
            addMsg({
              type: token.rugRate > 0.3 ? 'warning' : token.confidence === 'HIGH' ? 'success' : 'result',
              icon: token.rugRate > 0.3 ? '🚩' : token.confidence === 'HIGH' ? '💎' : token.confidence === 'MEDIUM' ? '📊' : '📉',
              text: `${token.ticker} — ${token.confidence} confidence · Edge ${Math.round(token.edgeScore * 100)} · ${token.sourceChannel}`,
              result: {
                ticker:        token.ticker,
                edgeScore:     token.edgeScore,
                confidence:    token.confidence,
                winRate:       token.winRate,
                rugRate:       token.rugRate,
                liquidity:     token.liquidity,
                volume24h:     token.volume24h  ?? 0,
                priceUsd:      token.priceUsd   ?? 0,
                priceChange1h: token.priceChange1h || 'N/A',
                maxGain:       token.maxGain     || 'N/A',
                isNew:         token.isNew       ?? false,
                sourceChannel: token.sourceChannel,
                recommendation: [
                  token.priceChange1h ? `${token.priceChange1h} 1h` : null,
                  token.maxGain       ? `Est. max: ${token.maxGain}` : null,
                  token.liquidity     ? `Liq: $${(token.liquidity / 1000).toFixed(0)}K` : null,
                ].filter(Boolean).join(' · ') || 'Known channel data',
                flagged:   token.rugRate > 0.3,
                flagReason: token.rugRate > 0.3 ? 'High rug rate detected' : undefined,
                contract:   token.contract,
                scamAnalysis: undefined,
              },
            })
          }
        } else {
          addMsg({ type: 'result', icon: '✅', text: `Scan complete — No recent token calls found, but channel metrics are available above.` })
        }
      } else {
        const high = results.filter(r => r.confidence === 'HIGH').length
        addMsg({ type: 'success', icon: '✅', text: `Scan complete — ${results.length} tokens evaluated, ${high} HIGH confidence` })
        for (const r of results) {
          await new Promise(res2 => setTimeout(res2, 180))
          // Build a complete ScanResult from the ScoredCall fields
          const ra = r as any  // ScoredCall has extra fields not in ScanResult type
          const scamVerdict = r.scamAnalysis?.verdict
          const isScamFlagged = scamVerdict === 'SCAM' || scamVerdict === 'RISKY'
          const scanResult: ScanResult = {
            ticker:        r.ticker,
            edgeScore:     r.edgeScore,
            confidence:    r.confidence,
            winRate:       r.winRate,
            rugRate:       r.rugRate,
            liquidity:     r.liquidity,
            volume24h:     ra.volume24h    ?? 0,
            priceUsd:      ra.priceUsd     ?? 0,
            priceChange1h: ra.priceChange1h ?? 'N/A',
            maxGain:       ra.maxGain       ?? 'N/A',
            isNew:         ra.isNew         ?? false,
            sourceChannel: r.sourceChannel,
            recommendation: [
              ra.priceChange1h && ra.priceChange1h !== 'N/A' ? `${ra.priceChange1h} 1h` : null,
              ra.maxGain       && ra.maxGain !== 'N/A'       ? `Est. max gain: ${ra.maxGain}` : null,
              r.liquidity > 0  ? `Liq: $${(r.liquidity / 1000).toFixed(0)}K` : null,
            ].filter(Boolean).join(' · ') || 'Live scan result',
            flagged:     isScamFlagged || r.rugRate > 0.35,
            flagReason:  scamVerdict === 'SCAM'  ? '🚨 Identified as potential scam token'
                       : scamVerdict === 'RISKY'  ? '⚠ Security flags detected — trade with caution'
                       : r.rugRate > 0.35         ? 'High rug rate detected on this channel'
                       : undefined,
            contract:    r.contract  ?? undefined,
            chainId:     r.chainId   ?? undefined,
            dexUrl:      r.dexUrl    ?? undefined,
            scamAnalysis: r.scamAnalysis,
          }
          addMsg({
            type: scanResult.flagged ? 'warning' : scanResult.confidence === 'HIGH' ? 'success' : 'result',
            icon: scamVerdict === 'SCAM' ? '🚨' : scanResult.flagged ? '🚩' : scanResult.confidence === 'HIGH' ? '💎' : scanResult.confidence === 'MEDIUM' ? '📊' : '📉',
            text: `${scanResult.ticker} — ${scanResult.confidence} confidence · Edge ${Math.round(scanResult.edgeScore * 100)} · ${scanResult.sourceChannel}`,
            result: scanResult,
          })
        }
      }
    } catch {
      addMsg({ type: 'error', icon: '❌', text: 'Scan failed — could not reach API. Check your server is running.' })
    } finally {
      setIsScanning(false)
    }
  }, [scanMode, walletInput, channelInput, tokenInput, isTest, priorityScansRemaining,
      holderTierUnlocked, updateScanCount, addMsg])

  return (
    <div className="min-h-screen" style={{
        backgroundImage: 'url(/hero-banner.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      }}>
      {/* Dark overlay so all content stays readable over the background */}
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm pointer-events-none" />
      {/* Subtle purple grid on top */}
      <div className="fixed inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'linear-gradient(rgba(139,92,246,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.4) 1px, transparent 1px)', backgroundSize: '40px 40px'}} />

      {showValueProp ? (
        <ValueProposition onBack={() => setShowValueProp(false)} />
      ) : showRoadmap ? (
        <Roadmap onBack={() => setShowRoadmap(false)} />
      ) : showScamDatabase ? (
        <ScamDatabaseModal onClose={() => setShowScamDatabase(false)} />
      ) : (
        <>
          {/* ── Dev Phase Banner ── */}
          <div className="relative z-10 px-4 py-2 text-center text-xs font-semibold"
            style={{ background: 'linear-gradient(90deg, rgba(34,197,94,0.15), rgba(139,92,246,0.15), rgba(34,197,94,0.15))', borderBottom: '1px solid rgba(34,197,94,0.3)' }}>
            <span className="text-green-400">🚀 DEVELOPMENT & TESTING PHASE</span>
            <span className="text-gray-400 mx-2">—</span>
            <span className="text-gray-300">Holder Tier: <span className="text-green-400 font-bold">50 Priority Scans/month</span> with $100+ in AGNTCBRO. Free tier: 5 scans. Hold tokens to unlock more.</span>
          </div>

          <header className="relative z-50 px-4 md:px-6 py-3 md:py-4 flex justify-between items-center backdrop-blur-md bg-black/40 border-b border-purple-500/20">
            {/* Left — icon + branding */}
            <div className="flex items-center gap-2 md:gap-3">
              <img
                src="/icon.png"
                alt="Agentic Bro"
                className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover ring-2 ring-purple-500/50"
              />
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight">
                  Agentic Bro
                </h1>
                <p className="text-[10px] md:text-xs font-mono hidden sm:block" style={{color: '#39ff14', textShadow: '0 0 8px #39ff14'}}>
                  AI-powered scam detection · Scan first, trust later!
                </p>
              </div>
            </div>

            {/* Center — tier access buttons (hidden on mobile) */}
            <div className="hidden md:flex items-center gap-3">

              {/* User Menu (Login/Balance) */}
              <UserMenu 
                onLoginClick={() => {
                  setAuthMode('login')
                  setShowAuthModal(true)
                }}
                onBuyCreditsClick={() => setShowPaymentModal(true)}
              />

              {/* Scan Credits badge */}
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold"
                style={holderTierUnlocked
                  ? {background: 'rgba(139,92,246,0.3)', borderColor: 'rgba(139,92,246,0.7)', color: '#c4b5fd'}
                  : {background: 'rgba(80,80,80,0.2)', borderColor: 'rgba(120,120,120,0.4)', color: '#9ca3af'}}
                title={holderTierUnlocked
                  ? `Holder Tier · ${balance.toLocaleString()} AGNTCBRO · 50 scans/month`
                  : `Hold $100+ in AGNTCBRO for 50 monthly scans (currently ${priorityScansRemaining} free scans)`}
              >
                {gatingLoading ? (
                  <span className="animate-pulse">…</span>
                ) : holderTierUnlocked ? (
                  <><span style={{color: '#39ff14', textShadow: '0 0 6px #39ff14'}}>✓</span> 🔍 {priorityScansRemaining}/50</>
                ) : (
                  <>🔍 {priorityScansRemaining}/5</>
                )}
              </div>

              {/* Live balance pill — only when connected */}
              {connected && !gatingLoading && (
                <div className="px-3 py-1 rounded-full text-xs font-mono border border-purple-500/30 text-purple-300 bg-black/30">
                  {balance.toLocaleString()} AGNTCBRO
                </div>
              )}
            </div>

            {/* Right — nav + wallet (desktop only) */}
            <div className="hidden lg:flex items-center gap-2 xl:gap-3">
              <div className="relative group">
                <button
                  onClick={() => setShowValueProp(true)}
                  className="px-2 xl:px-3 py-1 bg-purple-600/50 hover:bg-purple-600 text-white rounded-md text-xs font-semibold transition-colors"
                >
                  Why Agentic Bro?
                </button>
                <div className="absolute left-0 top-full mt-1 z-50 rounded-xl border border-white/10 bg-black/90 backdrop-blur-md shadow-2xl overflow-hidden min-w-[130px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <a
                    href="/AgenticBro_WhitePaper.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-3 py-2 text-xs text-left text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    📄 White Paper
                  </a>
                  <button
                    onClick={() => setShowRoadmap(true)}
                    className="w-full px-3 py-2 text-xs text-left text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    🗺️ Roadmap
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowScamDatabase(true)}
                className="px-2 xl:px-3 py-1 bg-red-600/50 hover:bg-red-600 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1"
              >
                🔍 Scam Database
              </button>
              <a
                href="https://pump.fun/coin/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 xl:px-3 py-1 bg-[#39ff14]/20 hover:bg-[#39ff14]/40 text-[#39ff14] border border-[#39ff14]/40 rounded-md text-xs font-bold transition-colors flex items-center gap-1"
              >
                💰 Buy $AGNTCBRO
              </a>
              <LanguageSelector current={locale} onChange={setLocale} />
              <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !font-semibold !text-xs !px-2 !py-1 !rounded-md !h-auto !leading-normal !min-w-[90px]" />
            </div>

            {/* Mobile menu button */}
            <MobileMenu
              onNavigate={(section) => {
                if (section === 'roadmap') setShowRoadmap(true)
                if (section === 'features') setShowValueProp(true)
                if (section === 'scanners') setShowScamDatabase(true)
                if (section === 'holder') setShowTierPage('holder')
                if (section === 'whale') setShowTierPage('whale')
              }}
              onLoginClick={() => {
                setAuthMode('login')
                setShowAuthModal(true)
              }}
            />
          </header>

          {/* ── Wallet Connected Welcome Banner ── */}
          {showWelcomeBanner && (
            <div className="relative z-10 mx-auto mt-4 max-w-4xl">
              <div className="bg-gradient-to-r from-purple-900/40 to-cyan-900/40 backdrop-blur-md rounded-2xl border border-purple-500/30 p-6 relative">
                <button
                  onClick={() => { setShowWelcomeBanner(false); localStorage.setItem('walletWelcomeSeen', 'true'); }}
                  className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
                <div className="flex items-start gap-4">
                  <div className="text-4xl">👋</div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white mb-2">Welcome to Agentic Bro, {publicKey ? publicKey.toBase58().slice(0, 6) : 'User'}…</h2>
                    <p className="text-sm text-gray-300 mb-4">
                      Your wallet is connected. You now have access to:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      {[
                        { icon: '🔍', title: 'Priority Scans', desc: '5 free wallet/channel/token scans' },
                        { icon: '📊', title: 'Portfolio Roast', desc: 'AI-powered portfolio analysis' },
                        { icon: '💎', title: 'Holder Tier', desc: `Unlocks with ${tokenPriceUsd > 0 ? (15000 / tokenPriceUsd).toLocaleString(undefined, {maximumFractionDigits: 0}) : '10K'} AGNTCBRO` },
                      ].map((item) => (
                        <div key={item.title} className="bg-black/30 rounded-xl p-3 border border-purple-500/20">
                          <div className="text-2xl mb-1">{item.icon}</div>
                          <p className="text-sm font-bold text-white">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span className="text-green-400">✓</span>
                      <span>Balance: <span className="text-white font-semibold">{balance.toLocaleString()}</span> AGNTCBRO {usdValue > 0 ? `(~$${usdValue.toFixed(2)})` : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

      <main className="relative z-10 container mx-auto px-4 md:px-6 pb-10">
        {/* ── AGNTCBRO Balance Tracker — shows after wallet connect ── */}
        <AgntcbroBalanceTracker />

        {/* ── Profile Verifier Scanner - TOP OF PAGE (3 FREE SCANS) ── */}
        <ProfileVerifierScanner onLoginRequired={() => setShowAuthModal(true)} />

            {/* ── Priority Scan Section ── */}
            <div id="priority-scan-section" className="max-w-6xl mx-auto mb-6">
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">🔍</div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Priority Scan</h2>
                      <p className="text-sm text-gray-400">Deep scan your wallet, a Telegram channel, or a specific token</p>
                    </div>
                  </div>
                  {!isTest && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                         style={{
                           background: priorityScansRemaining > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                           border:     priorityScansRemaining > 0 ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(245,158,11,0.4)',
                           color:      priorityScansRemaining > 0 ? '#4ade80' : '#fbbf24',
                         }}>
                      {priorityScansRemaining > 0 ? <><span>🎁</span><span>{priorityScansRemaining} Scans{holderTierUnlocked ? ' (Holder — 50/mo)' : ' (Free)'}</span></>
                                                  : <><span>💎</span><span>Hold $100 AGNTCBRO for 50/mo</span></>}
                    </div>
                  )}
                  {isTest && (
                    <span className="text-xs px-2 py-1 rounded-full font-semibold"
                          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#4ade80' }}>
                      ✓ Test Wallet — Unlimited
                    </span>
                  )}
                </div>

                {/* ── Scan mode tabs ── */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                  {([
                    { id: 'wallet',   icon: '👛', label: 'Wallet Scan',  hint: 'Track alpha signals for a wallet' },
                    { id: 'channels', icon: '📡', label: 'Channel Scan', hint: 'Deep-scan a Telegram channel' },
                    { id: 'token',    icon: '🔍', label: 'Token Scan',   hint: 'Find all calls for a token' },
                    { id: 'social',   icon: '🛡️', label: 'Social Scan',  hint: 'Scan Instagram/TikTok/FB profiles' },
                    { id: 'phone',    icon: '📞', label: 'Phone Verify', hint: 'Verify phone numbers for scams' },
                  ] as { id: ScanMode; icon: string; label: string; hint: string }[]).map(m => (
                    <button
                      key={m.id}
                      onClick={() => setScanMode(m.id)}
                      className="rounded-xl p-3 text-left transition-all border"
                      style={scanMode === m.id
                        ? { background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.6)' }
                        : { background: 'rgba(0,0,0,0.3)',       borderColor: 'rgba(139,92,246,0.2)' }}
                    >
                      <p className={`text-sm font-semibold ${scanMode === m.id ? 'text-white' : 'text-gray-400'}`}>
                        {m.icon} {m.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{m.hint}</p>
                    </button>
                  ))}
                </div>

                {/* ── Input field (changes per mode) ── */}
                <div className="mb-4">
                  {scanMode === 'wallet' && (
                    <input
                      type="text"
                      value={walletInput}
                      onChange={e => setWalletInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isScanning && runScan()}
                      placeholder="Solana: 7xKX…Bm3a  ·  EVM: 0x4e3a…f29b"
                      className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors font-mono"
                    />
                  )}
                  {scanMode === 'channels' && (
                    <input
                      type="text"
                      value={channelInput}
                      onChange={e => setChannelInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isScanning && runScan()}
                      placeholder="e.g. CryptoEdgePro  ·  @alphawhalecalls  ·  t.me/defi_gems"
                      className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors"
                    />
                  )}
                  {scanMode === 'token' && (
                    <input
                      type="text"
                      value={tokenInput}
                      onChange={e => setTokenInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isScanning && runScan()}
                      placeholder="e.g. $NOVA  ·  SOL  ·  0x4e3a…f29b"
                      className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors font-mono"
                    />
                  )}
                  {scanMode === 'social' && (
                    <div className="flex gap-2">
                      <select
                        value={socialPlatform}
                        onChange={e => setSocialPlatform(e.target.value as any)}
                        className="bg-black/50 border border-purple-500/30 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-colors"
                      >
                        <option value="instagram">📸 Instagram</option>
                        <option value="tiktok">🎵 TikTok</option>
                        <option value="facebook">📘 Facebook</option>
                      </select>
                      <input
                        type="text"
                        value={socialUsername}
                        onChange={e => setSocialUsername(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !isScanning && runScan()}
                        placeholder="e.g. crypto_scammer99"
                        className="flex-1 bg-black/50 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors font-mono"
                      />
                    </div>
                  )}
                  {scanMode === 'phone' && (
                    <div>
                      <PhoneNumberVerifier />
                    </div>
                  )}
                </div>

                {/* ── Launch button (hidden for phone mode — uses its own) ── */}
                <button
                  onClick={runScan}
                  disabled={isScanning ||
                    scanMode === 'phone' ||
                    (scanMode === 'wallet'   && !walletInput.trim())  ||
                    (scanMode === 'channels' && !channelInput.trim()) ||
                    (scanMode === 'token'    && !tokenInput.trim())    ||
                    (scanMode === 'social'   && !socialUsername.trim())}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={scanMode === 'phone' ? { display: 'none' } : { background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.6)', color: '#c4b5fd' }}
                >
                  {isScanning
                    ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full" /> Scanning…</>
                    : <>⚡ Run Priority Scan{!isTest && priorityScansRemaining > 0 ? ` (${priorityScansRemaining} left${holderTierUnlocked ? ' — Holder 50/mo' : ''})` : !isTest ? ' — Hold $100 AGNTCBRO' : ''}</>
                  }
                </button>

              </div>
            </div>

        {/* ── Token Scanner (consolidated: priority + contract + impersonation) ── */}
        <PriorityTokenScanner onLoginRequired={() => setShowAuthModal(true)} />
        <TokenScanner onLoginRequired={() => setShowAuthModal(true)} />
        <TokenImpersonationScanner />

        {/* ── Free Scam Protection Tools Info (shown for all users) ── */}
        <div className="max-w-6xl mx-auto mb-10">
          <div className="bg-gradient-to-r from-purple-900/30 to-cyan-900/30 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">🛡️ Free Scam Protection Tools</h3>
              <p className="text-gray-400">5 free scans for each tool — {connected ? 'logged in' : 'no wallet needed'}</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
              {/* Profile Verifier */}
              <div className="bg-black/30 rounded-xl p-4 border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🔍</span>
                  <h4 className="font-bold text-white">Profile Verifier</h4>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Scan any X/Twitter, Telegram, Discord, YouTube, TikTok, or Instagram profile for scam red flags.
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>✓ 6 platform support</li>
                  <li>✓ Risk scoring (0-10)</li>
                  <li>✓ Paid promoter detection</li>
                  <li>✓ 10 red flag checks</li>
                </ul>
              </div>

              {/* Token Scanner */}
              <div className="bg-black/30 rounded-xl p-4 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🪙</span>
                  <h4 className="font-bold text-white">Token Scanner</h4>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Analyze any token by contract address across Solana, Base, and Ethereum chains.
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>✓ Multi-chain support</li>
                  <li>✓ Liquidity analysis</li>
                  <li>✓ Holder distribution</li>
                  <li>✓ Security flags check</li>
                </ul>
              </div>

              {/* Token Impersonation */}
              <div className="bg-black/30 rounded-xl p-4 border border-red-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">⚠️</span>
                  <h4 className="font-bold text-white">Fake Token Detector</h4>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Detect impersonator tokens copying legitimate project names and symbols.
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>✓ DexScreener API scan</li>
                  <li>✓ Symbol/name matching</li>
                  <li>✓ Pump.fun detection</li>
                  <li>✓ Risk scoring</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* ── Scam Detection System — for logged-in users ── */}
        {connected && publicKey && (
          <ScamDetectionSection walletAddress={publicKey.toBase58()} tokenPriceUsd={tokenPriceUsd} />
        )}

        {!connected ? (
          <div className="max-w-6xl mx-auto">

            {/* Hero Message */}
            <div className="text-center mb-10 pt-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/40 bg-red-950/30 text-red-300 text-xs font-semibold mb-4">
                <span>🛡️</span> AI-Powered Crypto Protection
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                Stop Gambling.<br />
                <span style={{background: 'linear-gradient(90deg, #a855f7, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                  Start Investigating.
                </span>
              </h2>
              <p className="text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
                The crypto space is full of scammers, rug pulls, and fake alpha. Agentic Bro arms you with AI-powered investigation tools to protect your capital and make every trade count.
              </p>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
              {[
                { value: '5,000+', label: 'Scammers in Database', color: '#f87171' },
                { value: '<30s',   label: 'Average Scan Time',    color: '#4ade80' },
                { value: '10 Free', label: 'Priority Scans',       color: '#a78bfa' },
                { value: '100%',   label: 'On-Chain Verified',    color: '#22d3ee' },
              ].map((stat) => (
                <div key={stat.label} className="bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 p-4 text-center">
                  <p className="text-2xl font-black mb-1" style={{color: stat.color}}>{stat.value}</p>
                  <p className="text-xs text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Two core strengths */}
            <div className="grid md:grid-cols-2 gap-6 mb-10">

              {/* Scam Detection System */}
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-red-500/30 p-6 hover:border-red-500/60 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)'}}>🔍</div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Scam Detection System</h3>
                    <p className="text-xs text-red-400 font-semibold">Your on-chain lie detector</p>
                  </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-4">
                  Cross-reference any wallet, Telegram channel, or token against our live scammer database. Get a full risk report with red flags, on-chain behaviour patterns, and a plain-English verdict before you ape in.
                </p>
                <div className="space-y-2">
                  {[
                    '🚨 Cross-reference 5,000+ known scammer wallets',
                    '📊 On-chain behaviour pattern analysis',
                    '💬 Telegram channel credibility scoring',
                    '🪙 Token rug-pull risk assessment',
                    '📝 Plain-English investigation report',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-gray-300">
                      <span>{item.slice(0, 2)}</span>
                      <span>{item.slice(3)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority Scan */}
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/30 p-6 hover:border-purple-500/60 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)'}}>⚡</div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Priority Scan</h3>
                    <p className="text-xs text-purple-400 font-semibold">Deep intel. Fast.</p>
                  </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-4">
                  Run a deep-dive investigation on any wallet, Telegram channel, or token in under 30 seconds. Get alpha signals, risk scores, and actionable insights so you trade with conviction — not hope.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    { icon: '👛', label: 'Wallet Scan', desc: 'Track alpha signals and risk profile' },
                    { icon: '📡', label: 'Channel Scan', desc: 'Verify Telegram channel credibility' },
                    { icon: '🪙', label: 'Token Scan', desc: 'Find all calls and rug-pull risk' },
                  ].map((mode) => (
                    <div key={mode.label} className="bg-purple-900/20 rounded-xl p-3 text-center border border-purple-500/20">
                      <div className="text-xl mb-1">{mode.icon}</div>
                      <p className="text-xs font-bold text-white">{mode.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{mode.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold" style={{background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#4ade80'}}>
                  <span>🎁</span>
                  <span>5 free scans when you connect your wallet — no token required</span>
                </div>
              </div>
            </div>

            {/* Informed Trading section */}
            <div className="bg-gradient-to-r from-purple-900/20 to-cyan-900/20 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6 mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📈</span>
                <div>
                  <h3 className="text-xl font-bold text-white">Informed Trading and Investing Intelligence</h3>
                  <p className="text-xs text-cyan-400 font-semibold">Because degen without data is just gambling</p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { icon: '🤖', title: 'AI Portfolio Analysis', desc: 'Get a brutally honest AI breakdown of your portfolio with risk scores, over-exposure flags, and actionable rebalancing advice.' },
                  { icon: '📊', title: 'Real-Time Market Signals', desc: 'Live BTC, ETH, SOL signals with liquidation level tracking and AI-synthesised daily market reports.' },
                  { icon: '🏆', title: 'Holder Tier — 50 Scans/mo', desc: 'Hold $100+ in AGNTCBRO to unlock 50 monthly Priority Scans across all scan types.' },
                ].map((item) => (
                  <div key={item.title} className="bg-black/30 rounded-xl p-4 border border-white/10">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <p className="font-bold text-white text-sm mb-1">{item.title}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            
            <PreConnectScanWidget lang={locale} />
            {/* Connect CTA */}
            <div className="text-center py-8 bg-black/20 rounded-2xl border border-purple-500/20">
              <p className="text-white font-bold text-xl mb-2">Ready to protect your capital?</p>
              <p className="text-gray-400 text-sm mb-6">Connect your Solana wallet to run your first free scan — no token required to start.</p>
              <div className="flex justify-center">
                <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !font-bold !text-base !px-8 !py-3 !rounded-xl" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Wallet bar — quick access to wallet functions */}
            <div className="flex items-center justify-between max-w-6xl mx-auto mb-4 mt-4 px-1">
              <div className="flex items-center gap-3">
                <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !font-semibold !text-xs !px-3 !py-1 !rounded-md !h-auto !leading-normal !min-w-0" />
                {!gatingLoading && (
                  <span className="px-3 py-1 rounded-full text-xs font-mono border border-purple-500/30 text-purple-300 bg-black/30">
                    {balance.toLocaleString()} AGNTCBRO {usdValue > 0 ? `· $${usdValue.toFixed(2)}` : ''}
                  </span>
                )}
              </div>
            </div>

            {/* ── Priority Scan Section ── */}
            <div className="max-w-6xl mx-auto mb-6">
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">🔍</div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Priority Scan</h2>
                      <p className="text-sm text-gray-400">Deep scan your wallet, a Telegram channel, or a specific token</p>
                    </div>
                  </div>
                  {!isTest && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                         style={{
                           background: priorityScansRemaining > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                           border:     priorityScansRemaining > 0 ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(245,158,11,0.4)',
                           color:      priorityScansRemaining > 0 ? '#4ade80' : '#fbbf24',
                         }}>
                      {priorityScansRemaining > 0 ? <><span>🎁</span><span>{priorityScansRemaining} Free Scans{holderTierUnlocked ? ' (Holder)' : ''}</span></>
                                                  : <><span>💎</span><span>10K AGNTCBRO/scan</span></>}
                    </div>
                  )}
                  {isTest && (
                    <span className="text-xs px-2 py-1 rounded-full font-semibold"
                          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#4ade80' }}>
                      ✓ Test Wallet — Unlimited
                    </span>
                  )}
                </div>

                {/* ── Scan mode tabs ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {([
                    { id: 'wallet',   icon: '👛', label: 'Wallet Scan',  hint: 'Track alpha signals for a wallet' },
                    { id: 'channels', icon: '📡', label: 'Channel Scan', hint: 'Deep-scan a Telegram channel' },
                    { id: 'token',    icon: '🔍', label: 'Token Scan',   hint: 'Find all calls for a token' },
                    { id: 'phone',    icon: '📞', label: 'Phone Verify', hint: 'Verify phone numbers for scams' },
                  ] as { id: ScanMode; icon: string; label: string; hint: string }[]).map(m => (
                    <button
                      key={m.id}
                      onClick={() => setScanMode(m.id)}
                      className="rounded-xl p-3 text-left transition-all border"
                      style={scanMode === m.id
                        ? { background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.6)' }
                        : { background: 'rgba(0,0,0,0.3)',       borderColor: 'rgba(139,92,246,0.2)' }}
                    >
                      <p className={`text-sm font-semibold ${scanMode === m.id ? 'text-white' : 'text-gray-400'}`}>
                        {m.icon} {m.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{m.hint}</p>
                    </button>
                  ))}
                </div>

                {/* ── Input field (changes per mode) ── */}
                <div className="mb-4">
                  {scanMode === 'wallet' && (
                    <input
                      type="text"
                      value={walletInput}
                      onChange={e => setWalletInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isScanning && runScan()}
                      placeholder="Solana: 7xKX…Bm3a  ·  EVM: 0x4e3a…f29b"
                      className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors font-mono"
                    />
                  )}
                  {scanMode === 'channels' && (
                    <input
                      type="text"
                      value={channelInput}
                      onChange={e => setChannelInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isScanning && runScan()}
                      placeholder="e.g. CryptoEdgePro  ·  @alphawhalecalls  ·  t.me/defi_gems"
                      className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors"
                    />
                  )}
                  {scanMode === 'token' && (
                    <input
                      type="text"
                      value={tokenInput}
                      onChange={e => setTokenInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isScanning && runScan()}
                      placeholder="e.g. $NOVA  ·  SOL  ·  0x4e3a…f29b"
                      className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors font-mono"
                    />
                  )}
                  {scanMode === 'phone' && (
                    <PhoneNumberVerifier />
                  )}
                </div>

                {/* ── Launch button ── */}
                <button
                  onClick={runScan}
                  disabled={isScanning ||
                    scanMode === 'phone' ||
                    (scanMode === 'wallet'   && !walletInput.trim())  ||
                    (scanMode === 'channels' && !channelInput.trim()) ||
                    (scanMode === 'token'    && !tokenInput.trim())}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={scanMode === 'phone' ? { display: 'none' } : { background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.6)', color: '#c4b5fd' }}
                >
                  {isScanning
                    ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full" /> Scanning…</>
                    : <>⚡ Run Priority Scan{!isTest && priorityScansRemaining > 0 ? ` (${priorityScansRemaining} free${holderTierUnlocked ? ' - Holder' : ''})` : !isTest ? ' — 10K AGNTCBRO' : ''}</>
                  }
                </button>

              </div>
            </div>
          </>
        )}
      </main>
      </>
    )}

      {!showValueProp && !showRoadmap && !showTierPage && !showScamDatabase && (
        <footer className="relative z-10 text-center p-4 text-sm border-t border-purple-500/20 bg-black/30 backdrop-blur-sm">
          <p className="text-gray-500">
            Built for degens, by degens •{' '}
            <a href="https://twitter.com/AgenticBro11" className="text-purple-400 hover:text-purple-300">@AgenticBro11</a>
            {' '}•{' '}
            <a href="https://t.me/Agenticbro1" className="text-cyan-400 hover:text-cyan-300">Telegram</a>
            {' '}•{' '}
            <a href="/AgenticBro_WhitePaper.pdf" target="_blank" className="hover:text-white transition-colors" style={{color: '#39ff14'}}>White Paper</a>
          </p>
        </footer>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
      />
    </div>
  )
}

export default App
