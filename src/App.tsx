import { useState, useCallback, useRef, useEffect } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTokenGating, isTestWallet } from './hooks/useTokenGating'
import PortfolioCard from './components/PortfolioCard'
import MobileMenu from './components/MobileMenu'

import SignalFeed from './components/dashboard/SignalFeed'
import TradeAnalysis from './components/dashboard/TradeAnalysis'
import AlertFeed from './components/dashboard/AlertFeed'
import DailyReport from './components/dashboard/DailyReport'
import ValueProposition from './components/ValueProposition'
import ScamDetectionSection from './components/ScamDetectionSection'
import ScamDatabaseModal from './components/ScamDatabaseModal'
import ProfileVerifierScanner from './components/ProfileVerifierScanner'
import TokenImpersonationScanner from './components/TokenImpersonationScanner'
import Roadmap from './components/Roadmap'
import HolderDashboard from './components/dashboard/HolderDashboard'
import WhaleDashboard from './components/dashboard/WhaleDashboard'
import MarketSentiment from './components/MarketSentiment'
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

type ScanMode = 'wallet' | 'channels' | 'token'

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

  // Get wallet-specific scan count
  const getWalletScanKey = () => {
    if (!publicKey) return 'priorityFreeScans';
    return `priorityFreeScans_${publicKey.toString()}`;
  };

  const { holderTierUnlocked, whaleTierUnlocked, balance, usdValue, tokenPriceUsd, loading: gatingLoading } = useTokenGating()
  const [priorityScansRemaining, setPriorityScansRemaining] = useState(() => {
    const saved = localStorage.getItem(getWalletScanKey());
    const defaultScans = holderTierUnlocked ? 15 : 10; // 15 for holders, 10 for regular users
    return saved ? Math.max(0, parseInt(saved, 10)) : defaultScans;
  });

  // Update scan count when wallet changes or holder tier status changes
  const updateScanCount = useCallback((newCount: number) => {
    setPriorityScansRemaining(newCount);
    localStorage.setItem(getWalletScanKey(), String(newCount));
  }, []);

  const [isScanning, setIsScanning]     = useState(false)
  const [scanMessages, setScanMessages] = useState<ChatMessage[]>([])
  const [showScanChat, setShowScanChat] = useState(false)
  const [scanMode, setScanMode]         = useState<ScanMode>('wallet')
  const [walletInput, setWalletInput]   = useState('')
  const [channelInput, setChannelInput] = useState('')
  const [tokenInput, setTokenInput]     = useState('')
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Update default scans when holder tier status changes
  useEffect(() => {
    const saved = localStorage.getItem(getWalletScanKey());
    if (!saved) {
      const defaultScans = holderTierUnlocked ? 15 : 10;
      setPriorityScansRemaining(defaultScans);
    }
  }, [holderTierUnlocked]);

  // Denial popover state — null = hidden, 'holder' | 'whale' = show message
  const [denied, setDenied] = useState<'holder' | 'whale' | null>(null)

  // Auth and Payment modals
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  // Auth context is available via AuthProvider in main.tsx

  const handleTierClick = useCallback((tier: 'holder' | 'whale') => {
    const unlocked = tier === 'holder' ? holderTierUnlocked : whaleTierUnlocked
    if (unlocked) {
      setShowTierPage(tier)
    } else {
      setDenied(tier)
      setTimeout(() => setDenied(null), 3500)
    }
  }, [holderTierUnlocked, whaleTierUnlocked])

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
    const inputValue = scanMode === 'wallet' ? walletInput.trim()
                     : scanMode === 'channels' ? channelInput.trim()
                     : scanMode === 'token' ? tokenInput.trim()
                     : ''

    if (!inputValue) return
    if (!isTest && priorityScansRemaining <= 0 && !holderTierUnlocked) {
      alert('Scan limit reached. Unlock Holder Tier for unlimited priority scans.')
      return
    }

    if (!isTest && priorityScansRemaining > 0) updateScanCount(priorityScansRemaining - 1)

    setIsScanning(true)
    setShowScanChat(true)
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

      {showTierPage === 'holder' ? (
        <HolderDashboard onBack={() => setShowTierPage(null)} />
      ) : showTierPage === 'whale' ? (
        <WhaleDashboard
          onBack={() => setShowTierPage(null)}
          whaleTierUnlocked={whaleTierUnlocked}
          balance={balance}
          usdValue={usdValue}
        />
      ) : showValueProp ? (
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
            <span className="text-gray-300">Holder & Whale tier access reduced to <span className="text-green-400 font-bold">$15</span> during early development. Tier thresholds will increase as we approach production launch.</span>
          </div>

          <header className="relative z-10 px-4 md:px-6 py-3 md:py-4 flex justify-between items-center backdrop-blur-md bg-black/40 border-b border-purple-500/20">
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
                  $AGNTCBRO · Your agentic degen advisor
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

              {/* Holder Tier button */}
              <div className="relative">
                <button
                  onClick={() => handleTierClick('holder')}
                  disabled={gatingLoading}
                  className="flex items-center justify-center gap-1 px-3 py-1 rounded-md border text-xs font-semibold transition-all hover:brightness-125 disabled:opacity-50"
                  style={holderTierUnlocked
                    ? {background: 'rgba(139,92,246,0.3)', borderColor: 'rgba(139,92,246,0.7)', color: '#c4b5fd'}
                    : {background: 'rgba(80,80,80,0.2)', borderColor: 'rgba(120,120,120,0.4)', color: '#9ca3af'}}
                  title={holderTierUnlocked
                    ? `Unlocked · ${balance.toLocaleString()} AGNTCBRO (~$${usdValue.toFixed(2)} USD)`
                    : `Requires $15 USD of AGNTCBRO (dev phase)${tokenPriceUsd > 0 ? ` · Current price: $${tokenPriceUsd.toFixed(6)}` : ''}`}
                >
                  {gatingLoading ? (
                    <span className="animate-pulse">…</span>
                  ) : holderTierUnlocked ? (
                    <><span style={{color: '#39ff14', textShadow: '0 0 6px #39ff14'}}>✓</span> 💰 Holder Tier</>
                  ) : (
                    <>🔒 Holder Tier</>
                  )}
                </button>
                {denied === 'holder' && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg border border-red-500/60 bg-red-950/90 px-3 py-2 text-xs text-red-300 shadow-lg backdrop-blur-sm">
                    ⛔ You do not meet the access criteria
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-red-950 border-t border-l border-red-500/60" />
                  </div>
                )}
              </div>

              {/* Whale Tier button */}
              <div className="relative">
                <button
                  onClick={() => handleTierClick('whale')}
                  disabled={gatingLoading}
                  className="flex items-center justify-center gap-1 px-3 py-1 rounded-md border text-xs font-semibold transition-all hover:brightness-125 disabled:opacity-50"
                  style={whaleTierUnlocked
                    ? {background: 'rgba(6,182,212,0.25)', borderColor: 'rgba(6,182,212,0.7)', color: '#67e8f9'}
                    : {background: 'rgba(80,80,80,0.2)', borderColor: 'rgba(120,120,120,0.4)', color: '#9ca3af'}}
                  title={whaleTierUnlocked
                    ? `Unlocked · ${balance.toLocaleString()} AGNTCBRO (~$${usdValue.toFixed(2)} USD)`
                    : `Requires $15 USD of AGNTCBRO (dev phase)${tokenPriceUsd > 0 ? ` · Current price: $${tokenPriceUsd.toFixed(6)}` : ''}`}
                >
                  {gatingLoading ? (
                    <span className="animate-pulse">…</span>
                  ) : whaleTierUnlocked ? (
                    <><span style={{color: '#39ff14', textShadow: '0 0 6px #39ff14'}}>✓</span> 🐋 Whale Tier</>
                  ) : (
                    <>🔒 Whale Tier</>
                  )}
                </button>
                {denied === 'whale' && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg border border-red-500/60 bg-red-950/90 px-3 py-2 text-xs text-red-300 shadow-lg backdrop-blur-sm">
                    ⛔ You do not meet the access criteria
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-red-950 border-t border-l border-red-500/60" />
                  </div>
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
              <a
                href="/AgenticBro_WhitePaper.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 xl:px-3 py-1 bg-cyan-600/50 hover:bg-cyan-600 text-white rounded-md text-xs font-semibold transition-colors"
              >
                White Paper
              </a>
              <button
                onClick={() => setShowRoadmap(true)}
                className="px-2 xl:px-3 py-1 bg-purple-600/50 hover:bg-purple-600 text-white rounded-md text-xs font-semibold transition-colors"
              >
                Roadmap
              </button>
              <button
                onClick={() => setShowValueProp(true)}
                className="px-2 xl:px-3 py-1 bg-purple-600/50 hover:bg-purple-600 text-white rounded-md text-xs font-semibold transition-colors"
              >
                Why Agentic Bro?
              </button>
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
              <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !font-semibold !text-[10px] !px-2 !py-1 !rounded-md !h-auto !leading-normal !min-w-[90px]" />
            </div>

            {/* Mobile menu button */}
            <MobileMenu
              onNavigate={(section) => {
                if (section === 'roadmap') setShowRoadmap(true)
                if (section === 'features') setShowValueProp(true)
                if (section === 'scanners') setShowScamDatabase(true)
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
                        { icon: '🔍', title: 'Priority Scans', desc: '10 free wallet/channel/token scans' },
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
        {/* ── Profile Verifier Scanner - TOP OF PAGE (3 FREE SCANS) ── */}
        <ProfileVerifierScanner />

        {/* ── Scam Detection System — requires wallet connection ── */}
        {connected && publicKey && (
          <ScamDetectionSection walletAddress={publicKey.toBase58()} tokenPriceUsd={tokenPriceUsd} />
        )}

        {/* ── Token Impersonation Scanner ── */}
        {/* 2 free scans/day anon · 3 free scans/day with connected wallet */}
        <TokenImpersonationScanner walletAddress={publicKey?.toBase58()} />

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
                { value: '3 Free', label: 'Priority Scans',       color: '#a78bfa' },
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
                  <span>3 free scans when you connect your wallet — no token required</span>
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
                  { icon: '🏆', title: 'Holder Tier Intelligence', desc: 'Unlock unlimited scans, gem advisory, and whale-level insights by holding $AGNTCBRO.' },
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
                </div>

                {/* ── Launch button ── */}
                <button
                  onClick={runScan}
                  disabled={isScanning ||
                    (scanMode === 'wallet'   && !walletInput.trim())  ||
                    (scanMode === 'channels' && !channelInput.trim()) ||
                    (scanMode === 'token'    && !tokenInput.trim())}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.6)', color: '#c4b5fd' }}
                >
                  {isScanning
                    ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full" /> Scanning…</>
                    : <>⚡ Run Priority Scan{!isTest && priorityScansRemaining > 0 ? ` (${priorityScansRemaining} free${holderTierUnlocked ? ' - Holder' : ''})` : !isTest ? ' — 10K AGNTCBRO' : ''}</>
                  }
                </button>

              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto mb-6">
              <PortfolioCard />

              {/* ── Priority Scan Results Panel ── */}
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 flex flex-col overflow-hidden" style={{ minHeight: '420px' }}>
                {/* Panel header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isScanning ? 'bg-purple-400 animate-pulse' : showScanChat ? 'bg-green-400' : 'bg-gray-600'}`} />
                    <h3 className="text-base font-bold text-white">Scan Results</h3>
                    {showScanChat && !isScanning && (() => {
                      const tokenCount = scanMessages.filter(m => m.result).length
                      const highCount  = scanMessages.filter(m => m.result?.confidence === 'HIGH').length
                      return tokenCount > 0 ? (
                        <span className="text-xs text-gray-500 font-mono">
                          {tokenCount} token{tokenCount !== 1 ? 's' : ''} · <span className="text-green-400">{highCount} HIGH</span>
                        </span>
                      ) : null
                    })()}
                  </div>
                  {showScanChat && (
                    <button
                      onClick={() => { setShowScanChat(false); setScanMessages([]) }}
                      className="text-gray-500 hover:text-white text-xs transition-colors"
                    >
                      Clear ✕
                    </button>
                  )}
                </div>

                {/* Content */}
                {!showScanChat ? (
                  /* Empty state — prompt to run a scan */
                  <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-4">
                    <div className="text-5xl opacity-30">🔍</div>
                    <div>
                      <p className="text-gray-400 text-sm font-semibold mb-1">No scan results yet</p>
                      <p className="text-gray-600 text-xs leading-relaxed">
                        Select a scan mode above, enter your target, and run<br />a Priority Scan to see full token details here.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-xs mt-2">
                      {[
                        { icon: '👛', label: 'Wallet', desc: 'Track alpha for a wallet' },
                        { icon: '📡', label: 'Channel', desc: 'Deep-scan a Telegram channel' },
                        { icon: '🔍', label: 'Token', desc: 'Find all calls for a token' },
                      ].map(m => (
                        <div key={m.label} className="rounded-xl p-2 text-center" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                          <div className="text-xl mb-1">{m.icon}</div>
                          <p className="text-xs font-semibold text-gray-400">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Results */
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {scanMessages.map(msg => (
                      <div key={msg.id}>
                        {msg.scamResult ? (
                          <ScamResultCard result={msg.scamResult} />
                        ) : msg.result ? (
                          <ScanResultCard result={msg.result} icon={msg.icon} defaultExpanded={msg.result.confidence === 'HIGH'} />
                        ) : (
                          <div className={`flex items-start gap-2.5 px-3 py-2 rounded-lg text-xs ${
                            msg.type === 'success' ? 'bg-green-900/20 border border-green-500/20 text-green-300'
                          : msg.type === 'warning' ? 'bg-yellow-900/20 border border-yellow-500/20 text-yellow-300'
                          : msg.type === 'error'   ? 'bg-red-900/20 border border-red-500/20 text-red-300'
                          : 'bg-purple-900/10 border border-purple-500/10 text-gray-500'
                          }`}>
                            <span className="flex-shrink-0 mt-0.5">{msg.icon}</span>
                            <span className="leading-relaxed">{msg.text}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {isScanning && (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
                        <span className="animate-spin inline-block w-3 h-3 border border-purple-500 border-t-transparent rounded-full" />
                        Scanning…
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Market sentiment */}
            <div className="max-w-6xl mx-auto mb-6">
              <MarketSentiment />
            </div>

            {/* Trading Signals Section */}
            <div className="grid lg:grid-cols-3 gap-4 max-w-7xl mx-auto mb-6">
              <SignalFeed />
              <TradeAnalysis />
              <AlertFeed />
            </div>

            {/* Daily Market Report */}
            <div className="max-w-7xl mx-auto mb-6">
              <DailyReport />
            </div>

            {/* Gem Advise Preview */}
            <div className="max-w-7xl mx-auto mb-6">
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">💎</div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Gem Advise</h2>
                      <p className="text-sm text-gray-400">AI-ranked token recommendations (Preview)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTierPage('holder')}
                    disabled={!holderTierUnlocked}
                    className="px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                    style={holderTierUnlocked
                      ? {background: 'rgba(139,92,246,0.2)', borderColor: 'rgba(139,92,246,0.6)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.6)'}
                      : {background: 'rgba(80,80,80,0.2)', borderColor: 'rgba(120,120,120,0.4)', color: '#9ca3af', border: '1px solid rgba(120,120,120,0.4)'}
                    }
                  >
                    {holderTierUnlocked ? 'Open Full Version' : 'Unlock (10K AGNTCBRO)'}
                  </button>
                </div>

                {!holderTierUnlocked ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4 opacity-50">🔒</div>
                    <h3 className="text-xl font-bold text-white mb-2">Holder Tier Feature</h3>
                    <p className="text-gray-400 text-sm mb-4 max-w-md mx-auto">
                      Get unlimited AI-ranked gem recommendations with confidence tiers, edge scoring, and quality guards.
                    </p>
                    <div className="bg-purple-900/40 rounded-xl p-4 max-w-md mx-auto border border-purple-500/30">
                      <p className="text-sm text-gray-400 mb-2">Holder Tier includes:</p>
                      <ul className="text-left text-sm space-y-1">
                        <li>• 3 free gem advise scans</li>
                        <li>• AI-ranked token recommendations</li>
                        <li>• Confidence tiers (HIGH/MEDIUM/LOW)</li>
                        <li>• Rug rate & liquidity guards</li>
                        <li>• Real-time Telegram alpha analysis</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <GemPreviewCard
                        ticker="$NOVA"
                        name="NovaProtocol"
                        edgeScore={0.81}
                        confidence="HIGH"
                        winRate={44}
                        rugRate={8}
                        liquidity="182K"
                        change="+12.4%"
                        maxGain="3.2x"
                      />
                      <GemPreviewCard
                        ticker="$FLUX"
                        name="FluxLayer"
                        edgeScore={0.76}
                        confidence="HIGH"
                        winRate={39}
                        rugRate={12}
                        liquidity="94K"
                        change="+8.1%"
                        maxGain="2.7x"
                      />
                      <GemPreviewCard
                        ticker="$KRYPT"
                        name="KryptVault"
                        edgeScore={0.71}
                        confidence="HIGH"
                        winRate={36}
                        rugRate={14}
                        liquidity="126K"
                        change="+6.7%"
                        maxGain="2.4x"
                      />
                    </div>
                    <p className="text-center text-xs text-gray-500 mt-4">
                      * Preview mode — Open full version for unlimited scans and advanced filters
                    </p>
                  </div>
                )}
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
            <a href="https://t.me/AgenticBro" className="text-cyan-400 hover:text-cyan-300">Telegram</a>
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

// ─── Scan Result Card ─────────────────────────────────────────────────────────

function ScanResultCard({ result, icon, defaultExpanded = false }: { result: ScanResult; icon: string; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const edgePct = Math.round(result.edgeScore * 100)

  const cs = result.confidence === 'HIGH'
    ? { color: '#4ade80', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' }
    : result.confidence === 'MEDIUM'
    ? { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' }
    : { color: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'  }

  const scamVerdict  = result.scamAnalysis?.verdict
  const changePos    = result.priceChange1h?.startsWith('+')
  const shortAddr    = result.contract
    ? result.contract.length > 20
      ? `${result.contract.slice(0, 6)}…${result.contract.slice(-4)}`
      : result.contract
    : null

  return (
    <div
      className="rounded-xl border overflow-hidden cursor-pointer transition-all hover:brightness-110"
      style={result.flagged
        ? { background: 'rgba(239,68,68,0.06)',  borderColor: 'rgba(239,68,68,0.3)'  }
        : { background: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)' }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* ── Collapsed header row ── */}
      <div className="px-4 py-3 flex flex-col gap-1.5">
        {/* Top line: icon + ticker + badges + edge */}
        <div className="flex items-center gap-2">
          <span className="text-base flex-shrink-0">{icon}</span>
          <span className="font-bold text-white text-sm flex-shrink-0">{result.ticker}</span>
          {result.isNew && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
              NEW
            </span>
          )}
          {scamVerdict === 'SCAM'  && <span className="text-xs text-red-400 font-bold flex-shrink-0">🚨 SCAM</span>}
          {scamVerdict === 'RISKY' && <span className="text-xs text-yellow-400 font-bold flex-shrink-0">⚠ RISKY</span>}
          {result.flagged && !scamVerdict && <span className="text-xs text-red-400 font-semibold flex-shrink-0">FLAGGED</span>}
          <span className="flex-1" />
          {/* 1h change */}
          {result.priceChange1h && result.priceChange1h !== 'N/A' && (
            <span className={`text-xs font-bold flex-shrink-0 ${changePos ? 'text-green-400' : 'text-red-400'}`}>
              {result.priceChange1h}
            </span>
          )}
          {/* Confidence badge */}
          <span className="text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
            style={{ background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color }}>
            {result.confidence}
          </span>
          {/* Edge score */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${edgePct}%`, background: 'linear-gradient(90deg,#7c3aed,#00d4ff)' }} />
            </div>
            <span className="text-xs font-bold text-purple-300 w-5 text-right">{edgePct}</span>
          </div>
          <span className="text-gray-600 text-xs flex-shrink-0 ml-1">{expanded ? '▲' : '▼'}</span>
        </div>

        {/* Bottom line: channel + contract snippet + max gain */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="truncate flex-1">📡 {result.sourceChannel}</span>
          {shortAddr && (
            <span className="font-mono text-purple-400 flex-shrink-0 bg-purple-500/10 px-1.5 py-0.5 rounded">
              {shortAddr}
              {result.chainId && <span className="text-gray-600 ml-1">{result.chainId.toUpperCase()}</span>}
            </span>
          )}
          {result.maxGain && result.maxGain !== 'N/A' && (
            <span className="text-cyan-400 font-bold flex-shrink-0">🎯 {result.maxGain}</span>
          )}
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(139,92,246,0.12)' }}>

          {/* Flag / recommendation */}
          {result.flagged && result.flagReason && (
            <p className="text-xs text-red-400">⚠ {result.flagReason}</p>
          )}
          {result.recommendation && (
            <p className="text-xs text-gray-400 leading-relaxed">{result.recommendation}</p>
          )}

          {/* Price stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              {
                label: 'Price',
                value: result.priceUsd > 0
                  ? result.priceUsd < 0.0001
                    ? `$${result.priceUsd.toExponential(2)}`
                    : result.priceUsd < 1
                      ? `$${result.priceUsd.toFixed(6)}`
                      : `$${result.priceUsd.toFixed(4)}`
                  : '—',
                color: 'text-white',
              },
              {
                label: '1h Change',
                value: result.priceChange1h !== 'N/A' ? result.priceChange1h : '—',
                color: result.priceChange1h?.startsWith('+') ? 'text-green-400' : result.priceChange1h?.startsWith('-') ? 'text-red-400' : 'text-gray-400',
              },
              {
                label: 'Volume 24h',
                value: result.volume24h > 0
                  ? result.volume24h >= 1_000_000
                    ? `$${(result.volume24h / 1_000_000).toFixed(1)}M`
                    : `$${(result.volume24h / 1000).toFixed(0)}K`
                  : '—',
                color: 'text-white',
              },
              {
                label: 'Max Gain',
                value: result.maxGain !== 'N/A' ? result.maxGain : '—',
                color: 'text-cyan-400',
              },
            ].map(s => (
              <div key={s.label} className="bg-black/30 rounded-lg p-2 border border-purple-500/10">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Channel stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Win Rate',  value: `${Math.round(result.winRate * 100)}%`,            color: 'text-green-400' },
              { label: 'Rug Rate',  value: `${Math.round(result.rugRate * 100)}%`,            color: result.rugRate > 0.3 ? 'text-red-400' : 'text-gray-300' },
              { label: 'Liquidity', value: result.liquidity > 0 ? `$${(result.liquidity / 1000).toFixed(0)}K` : '—', color: 'text-white' },
              { label: 'Edge Score', value: `${edgePct}`,                                     color: 'text-purple-300' },
            ].map(s => (
              <div key={s.label} className="bg-black/30 rounded-lg p-2 border border-purple-500/10">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Scam verdict panel */}
          {result.scamAnalysis && scamVerdict !== 'UNKNOWN' && (() => {
            const { verdict, isHoneypot, highSellTax, hiddenOwner, isMintable, isBlacklist, sellTaxPct, buyTaxPct, holderCount, source } = result.scamAnalysis
            const vColor = verdict === 'SCAM' ? '#f87171' : verdict === 'RISKY' ? '#fbbf24' : '#4ade80'
            const vBg    = verdict === 'SCAM' ? 'rgba(239,68,68,0.12)' : verdict === 'RISKY' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)'
            const flags  = [
              isHoneypot  && '🍯 Honeypot',
              highSellTax && `⚠ Sell tax ${sellTaxPct.toFixed(0)}%`,
              hiddenOwner && '👻 Hidden owner',
              isMintable  && '🖨 Mintable',
              isBlacklist && '🚫 Blacklist',
            ].filter(Boolean) as string[]
            return (
              <div className="rounded-lg p-2 border" style={{ background: vBg, borderColor: vColor + '55' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold" style={{ color: vColor }}>
                    {verdict === 'SCAM' ? '🚨' : verdict === 'RISKY' ? '⚠️' : '✅'} Security: {verdict}
                  </span>
                  <span className="text-xs text-gray-500">
                    {source} {holderCount > 0 ? `· ${holderCount.toLocaleString()} holders` : ''}
                  </span>
                </div>
                {flags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {flags.map(f => (
                      <span key={f} className="text-xs bg-black/30 rounded px-1.5 py-0.5" style={{ color: vColor }}>{f}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: vColor }}>No security flags detected</p>
                )}
                {(buyTaxPct > 0 || sellTaxPct > 0) && (
                  <p className="text-xs text-gray-400 mt-1">Tax: buy {buyTaxPct.toFixed(0)}% / sell {sellTaxPct.toFixed(0)}%</p>
                )}
              </div>
            )
          })()}

          {/* Full contract address */}
          {result.contract && (
            <div className="bg-black/30 rounded-lg p-2.5 border border-purple-500/15">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-500 font-semibold">
                  Contract Address{result.chainId ? ` · ${result.chainId.toUpperCase()}` : ''}
                </p>
                <div className="flex items-center gap-2">
                  {result.dexUrl && (
                    <a href={result.dexUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-purple-400 hover:text-purple-200 font-semibold"
                      onClick={e => e.stopPropagation()}>
                      View on DexScreener ↗
                    </a>
                  )}
                </div>
              </div>
              <p
                className="text-xs text-purple-300 font-mono break-all leading-relaxed"
                onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(result.contract!) }}
                title="Click to copy"
                style={{ cursor: 'copy' }}
              >
                {result.contract}
              </p>
              <p className="text-xs text-gray-600 mt-1">Click address to copy</p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Scam Result Card Component ─────────────────────────────────────────────────────────

function ScamResultCard({ result }: { result: {
  username: string
  platform: 'X' | 'Telegram'
  riskScore: number
  verificationLevel: string
  redFlags: string[]
  scamType?: string
  evidence: string[]
  recommendedAction: string
}}) {
  const [expanded, setExpanded] = useState(true)

  const riskScoreStyle = (score: number) => {
    if (score >= 7) return { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' }
    if (score >= 4) return { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' }
    return                  { color: '#4ade80', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' }
  }

  const rs = riskScoreStyle(result.riskScore)

  return (
    <div className="rounded-xl border overflow-hidden">
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer transition-all hover:brightness-110"
        style={result.riskScore >= 7
          ? { background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.3)' }
          : result.riskScore >= 4
          ? { background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.3)' }
          : { background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-xl flex-shrink-0">🚨</span>
        <span className="font-bold text-white text-sm flex-shrink-0">
          {result.platform === 'X' ? 'X' : 'Telegram'}: {result.username}
        </span>
        <span
          className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
          style={{ background: rs.bg, border: `1px solid ${rs.border}`, color: rs.color }}
        >
          Risk Score: {result.riskScore}/10
        </span>
        {expanded ? <span className="text-gray-600 text-xs flex-shrink-0">▲</span> : <span className="text-gray-600 text-xs flex-shrink-0">▼</span>}
      </div>

      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(239,68,68,0.15)' }}>
          {result.riskScore >= 7 && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 mt-3 mb-3 text-sm"
                 style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              <span className="text-lg">⚠️</span>
              HIGH RISK DETECTED ({result.riskScore}/10)
            </div>
          )}

          <div className="rounded-xl p-4 mt-3" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Scam Analysis</p>
            {result.scamType && (
              <p className="text-sm font-bold text-white mb-2">Type: {result.scamType}</p>
            )}
            <p className="text-sm text-gray-300 mb-4">{result.recommendedAction}</p>

            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Red Flags ({result.redFlags.length})</p>
                <ul className="space-y-1">
                  {result.redFlags.map((flag, idx) => (
                    <li key={idx} className="text-sm text-red-400 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Evidence ({result.evidence.length})</p>
                <ul className="space-y-1">
                  {result.evidence.map((ev, idx) => (
                    <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                      <span className="text-gray-500 mt-0.5">•</span>
                      {ev}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Gem Preview Card Component (for free page preview) ────────────────────────────────────────────────────────────

function GemPreviewCard({
  ticker, name, edgeScore, confidence, winRate, rugRate: _rugRate, liquidity, change, maxGain,
}: {
  ticker: string;
  name: string;
  edgeScore: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  winRate: number;
  rugRate: number;
  liquidity: string;
  change: string;
  maxGain: string;
}) {
  const edgePct = Math.round(edgeScore * 100);
  const isPositive = change.startsWith('+');

  const confidenceStyle: Record<'HIGH' | 'MEDIUM' | 'LOW', { bg: string; border: string; color: string }> = {
    HIGH:   { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.35)',  color: '#4ade80' },
    MEDIUM: { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.35)',  color: '#fbbf24' },
    LOW:    { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.35)',   color: '#f87171' },
  };
  const cs = confidenceStyle[confidence];

  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4 hover:border-purple-500/40 transition-all">
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-bold text-white text-sm">{name}</div>
          <p className="text-xs text-gray-500">{ticker}</p>
        </div>
        <span
          className="text-xs font-bold px-2 py-1 rounded-lg"
          style={{ background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color }}
        >
          {confidence}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-purple-900/20 rounded-lg p-2 border border-purple-500/20">
          <p className="text-xs text-gray-500">Win Rate</p>
          <p className="text-sm font-bold text-green-400">{winRate}%</p>
        </div>
        <div className="bg-purple-900/20 rounded-lg p-2 border border-purple-500/20">
          <p className="text-xs text-gray-500">1h Change</p>
          <p className={`text-sm font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>{change}</p>
        </div>
        <div className="bg-purple-900/20 rounded-lg p-2 border border-purple-500/20">
          <p className="text-xs text-gray-500">Liquidity</p>
          <p className="text-sm font-bold text-white">${liquidity}</p>
        </div>
        <div className="bg-purple-900/20 rounded-lg p-2 border border-purple-500/20">
          <p className="text-xs text-gray-500">Max Gain</p>
          <p className="text-sm font-bold text-purple-300">{maxGain}</p>
        </div>
      </div>

      {/* Edge score bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Edge</span>
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${edgePct}%`,
                background: 'linear-gradient(90deg, #7c3aed, #00d4ff)',
              }}
            />
          </div>
          <span className="text-xs font-bold text-purple-300">{edgePct}</span>
        </div>
      </div>
    </div>
  );
}

export default App

// ─── Auth Modal Wrapper ─────────────────────────────────────────────────────────

// Auth Modal is rendered at the App level, passed via props to components that need it
export { AuthModal, PaymentModal }
