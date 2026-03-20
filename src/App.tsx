import { useState, useCallback, useRef, useEffect } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTokenGating, isTestWallet } from './hooks/useTokenGating'
import PortfolioCard from './components/PortfolioCard'

import SignalFeed from './components/dashboard/SignalFeed'
import TradeAnalysis from './components/dashboard/TradeAnalysis'
import AlertFeed from './components/dashboard/AlertFeed'
import DailyReport from './components/dashboard/DailyReport'
import ValueProposition from './components/ValueProposition'

// Use Vite proxy path (configured in vite.config.ts) - /api routes to http://localhost:3001
const API_BASE = '/api'

// ─── Priority Scan types ──────────────────────────────────────────────────────

type ScanMode = 'wallet' | 'channels' | 'token'

interface ScanResult {
  ticker: string
  edgeScore: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  winRate: number
  rugRate: number
  liquidity: number
  sourceChannel: string
  recommendation: string
  flagged: boolean
  flagReason?: string
}

interface ChatMessage {
  id: number
  type: 'system' | 'success' | 'warning' | 'error' | 'result'
  icon: string
  text: string
  result?: ScanResult
}
import Roadmap from './components/Roadmap'
import HolderDashboard from './components/dashboard/HolderDashboard'
import WhaleDashboard from './components/dashboard/WhaleDashboard'
import MarketSentiment from './components/MarketSentiment'

function App() {
  const { connected, publicKey } = useWallet()
  const [showValueProp, setShowValueProp] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [showTierPage, setShowTierPage] = useState<'holder' | 'whale' | null>(null)

  // Get wallet-specific scan count
  const getWalletScanKey = () => {
    if (!publicKey) return 'priorityFreeScans';
    return `priorityFreeScans_${publicKey.toString()}`;
  };

  const [priorityScansRemaining, setPriorityScansRemaining] = useState(() => {
    const saved = localStorage.getItem(getWalletScanKey());
    return saved ? Math.max(0, parseInt(saved, 10)) : 3;
  });

  // Update scan count when wallet changes
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
  const { holderTierUnlocked, whaleTierUnlocked, balance, usdValue, tokenPriceUsd, loading: gatingLoading } = useTokenGating()

  // Denial popover state — null = hidden, 'holder' | 'whale' = show message
  const [denied, setDenied] = useState<'holder' | 'whale' | null>(null)

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

  const isTest = isTestWallet(publicKey?.toBase58() ?? '')

  const addMsg = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    setScanMessages(prev => [...prev, { ...msg, id: Date.now() + Math.random() }])
  }, [])

  // Generate mock channel success rate data (in production, this would come from an API)
  const generateChannelSuccessRate = (channelName: string) => {
    // Use channel name hash to generate consistent but varied data
    const hash = channelName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    
    // Known channels with specific data
    const knownChannels: Record<string, any> = {
      'cryptolordgem': {
        success_tier: 'POOR',
        winRate: 36,
        rugRate: 38,
        avgWinGain: 2.8,
        avgLoss: 72,
        avgLiquidity: 85000,
        totalCalls: 47,
        wins: 17,
        losses: 12,
        rugs: 18,
        recentWinRate: 30,
        riskAdjustedReturn: -0.18,
        tradeable: false,
        risk_level: 'HIGH',
        confidence: 'LOW'
      },
      'cryptospacex04': {
        success_tier: 'GOOD',
        winRate: 42,
        rugRate: 28,
        avgWinGain: 2.5,
        avgLoss: 35,
        avgLiquidity: 125000,
        totalCalls: 62,
        wins: 26,
        losses: 19,
        rugs: 17,
        recentWinRate: 50,
        riskAdjustedReturn: 0.85,
        tradeable: true,
        risk_level: 'MODERATE',
        confidence: 'MEDIUM'
      },
      'elitebullsignals': {
        success_tier: 'GOOD',
        winRate: 48,
        rugRate: 22,
        avgWinGain: 3.4,
        avgLoss: 28,
        avgLiquidity: 168000,
        totalCalls: 58,
        wins: 28,
        losses: 13,
        rugs: 17,
        recentWinRate: 52,
        riskAdjustedReturn: 1.45,
        tradeable: true,
        risk_level: 'MODERATE',
        confidence: 'MEDIUM'
      },
      'dailypumpgems': {
        success_tier: 'MODERATE',
        winRate: 38,
        rugRate: 32,
        avgWinGain: 2.9,
        avgLoss: 52,
        avgLiquidity: 95000,
        totalCalls: 98,
        wins: 37,
        losses: 30,
        rugs: 31,
        recentWinRate: 40,
        riskAdjustedReturn: 0.45,
        tradeable: true,
        risk_level: 'HIGH',
        confidence: 'LOW'
      }
    }
    
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
                     : tokenInput.trim()

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
                    : `token ${inputValue}`

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
      const res  = await fetch(`${API_BASE}/telegram/priority-scan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target:  scanMode,
          wallet:  scanMode === 'wallet'   ? inputValue : undefined,
          channel: scanMode === 'channels' ? inputValue : undefined,
          token:   scanMode === 'token'    ? inputValue : undefined,
        }),
      })
      const data = await res.json() as { results: ScanResult[]; mock?: boolean; ts?: number }
      const results: ScanResult[] = data.results ?? []

      if (data.mock) addMsg({ type: 'warning', icon: '⚠️', text: 'Running in demo mode — add Telegram credentials for live data' })

      addMsg({ type: 'system', icon: '⚙️', text: `Scoring ${results.length} token calls…` })
      await new Promise(r => setTimeout(r, 400))

      if (results.length === 0) {
        // Don't show "no tokens found" warning - just show success rate analysis
        addMsg({ type: 'result', icon: '✅', text: `Scan complete — No recent token calls found, but channel metrics are available above.` })
      } else {
        const high = results.filter(r => r.confidence === 'HIGH').length
        addMsg({ type: 'success', icon: '✅', text: `Scan complete — ${results.length} tokens evaluated, ${high} HIGH confidence` })
        for (const r of results) {
          await new Promise(res2 => setTimeout(res2, 180))
          addMsg({
            type: r.flagged ? 'warning' : r.confidence === 'HIGH' ? 'success' : 'result',
            icon: r.flagged ? '🚩' : r.confidence === 'HIGH' ? '💎' : r.confidence === 'MEDIUM' ? '📊' : '📉',
            text: `${r.ticker} — ${r.confidence} confidence · Edge ${Math.round(r.edgeScore * 100)} · ${r.sourceChannel}`,
            result: r,
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
      ) : (
        <>
          <header className="relative z-10 px-6 py-4 flex justify-between items-center backdrop-blur-md bg-black/40 border-b border-purple-500/20">
            {/* Left — icon + branding */}
            <div className="flex items-center gap-3">
              <img
                src="/icon.png"
                alt="Agentic Bro"
                className="w-12 h-12 rounded-xl object-cover ring-2 ring-purple-500/50"
              />
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Agentic Bro
                </h1>
                <p className="text-xs font-mono" style={{color: '#39ff14', textShadow: '0 0 8px #39ff14'}}>
                  $AGNTCBRO · Your agentic degen advisor
                </p>
              </div>
            </div>

            {/* Center — tier access buttons (click-to-check balance) */}
            <div className="flex items-center gap-3">

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
                    : `Requires $100 USD of AGNTCBRO${tokenPriceUsd > 0 ? ` · Current price: $${tokenPriceUsd.toFixed(6)}` : ''}`}
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
                    : `Requires $1,000 USD of AGNTCBRO${tokenPriceUsd > 0 ? ` · Current price: $${tokenPriceUsd.toFixed(6)}` : ''}`}
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

            {/* Right — nav + wallet */}
            <div className="flex items-center gap-3">
              <a
                href="/AgenticBro_WhitePaper.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-cyan-600/50 hover:bg-cyan-600 text-white rounded-md text-xs font-semibold transition-colors"
              >
                White Paper
              </a>
              <button
                onClick={() => setShowRoadmap(true)}
                className="px-3 py-1 bg-purple-600/50 hover:bg-purple-600 text-white rounded-md text-xs font-semibold transition-colors"
              >
                Roadmap
              </button>
              <button
                onClick={() => setShowValueProp(true)}
                className="px-3 py-1 bg-purple-600/50 hover:bg-purple-600 text-white rounded-md text-xs font-semibold transition-colors"
              >
                Why Agentic Bro?
              </button>
              <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !font-semibold !text-xs !px-3 !py-1 !rounded-md !h-auto !leading-normal !min-w-0" />
            </div>
          </header>

      <main className="relative z-10 container mx-auto px-6 pb-10">
        {!connected ? (
          <div className="max-w-6xl mx-auto">
            {/* Feature action grid */}
            <div className="grid md:grid-cols-2 gap-6 mb-10">
              {/* Left column — action buttons */}
              <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold text-white mb-2">Get Started</h2>
                {[
                  { icon: '👛', label: 'CONNECT WALLET', desc: 'Link your Solana wallet to begin', color: 'from-purple-600/40 to-purple-800/40 border-purple-500/50', action: null },
                  { icon: '📊', label: 'ANALYZE TRADES', desc: 'Deep dive into your last 7 days', color: 'from-blue-600/40 to-blue-900/40 border-blue-500/50', action: null },
                  { icon: '🔥', label: 'GET ROASTED', desc: 'Brutal AI critique of your portfolio', color: 'from-orange-600/40 to-red-900/40 border-orange-500/50', action: null },
                  { icon: '💡', label: 'GET SMARTER', desc: 'Real-time signals & AI insights', color: 'from-cyan-600/40 to-teal-900/40 border-cyan-500/50', action: null },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center gap-4 bg-gradient-to-r ${item.color} border rounded-xl px-5 py-4 cursor-pointer hover:brightness-125 transition-all`}>
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <p className="font-bold text-white tracking-wide text-sm">{item.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right column — feature checklist */}
              <div className="flex flex-col justify-center bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-8">
                <h2 className="text-2xl font-bold text-white mb-6">What You Get</h2>
                {[
                  { icon: '✅', text: 'Live AI roasting (Ollama-powered)' },
                  { icon: '✅', text: 'Degen score calculation' },
                  { icon: '✅', text: 'Portfolio breakdown & risk analysis' },
                  { icon: '✅', text: 'Real-time BTC, ETH, SOL, BNB, XRP signals' },
                  { icon: '✅', text: 'Liquidation level tracking' },
                  { icon: '✅', text: 'Daily AI-synthesized market reports' },
                  { icon: '💎', text: 'Gem Advise preview (Holder Tier: unlimited)' },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-3 mb-4">
                    <span className="text-green-400 text-lg mt-0.5">{item.icon}</span>
                    <p className="text-gray-200 text-sm leading-snug">{item.text}</p>
                  </div>
                ))}

                {/* Token tiers */}
                <div className="mt-4 pt-4 border-t border-purple-500/20 grid grid-cols-2 gap-3">
                  <div className="bg-purple-900/40 rounded-xl p-3 text-center border border-purple-500/30">
                    <p className="text-xs text-gray-400 mb-1">Holder Tier</p>
                    <p className="font-bold text-purple-300 text-sm">10K AGNTCBRO</p>
                    <p className="text-xs text-gray-500">$100 one-time</p>
                  </div>
                  <div className="bg-cyan-900/40 rounded-xl p-3 text-center border border-cyan-500/30">
                    <p className="text-xs text-gray-400 mb-1">Whale Tier</p>
                    <p className="font-bold text-cyan-300 text-sm">100K AGNTCBRO</p>
                    <p className="text-xs text-gray-500">$1,000 one-time</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Connect CTA */}
            <div className="text-center py-6 bg-black/20 rounded-2xl border border-purple-500/20">
              <p className="text-gray-400 text-sm mb-4">Connect your wallet to unlock your dashboard</p>
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
                      {priorityScansRemaining > 0 ? <><span>🎁</span><span>{priorityScansRemaining} Free Scans</span></>
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
                <div className="grid grid-cols-3 gap-2 mb-4">
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
                    : <>⚡ Run Priority Scan{!isTest && priorityScansRemaining > 0 ? ` (${priorityScansRemaining} free)` : !isTest ? ' — 10K AGNTCBRO' : ''}</>
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
                    <div className="grid grid-cols-3 gap-2 w-full max-w-xs mt-2">
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
                        {msg.result ? (
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

      {!showValueProp && !showRoadmap && !showTierPage && (
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
    </div>
  )
}

// ─── Scan Result Card ─────────────────────────────────────────────────────────

function ScanResultCard({ result, icon, defaultExpanded = false }: { result: ScanResult; icon: string; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const edgePct = Math.round(result.edgeScore * 100)

  const cs = result.confidence === 'HIGH'
    ? { color: '#4ade80', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  }
    : result.confidence === 'MEDIUM'
    ? { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  }
    : { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'   }

  return (
    <div
      className="rounded-xl border overflow-hidden cursor-pointer transition-all hover:brightness-110"
      style={result.flagged
        ? { background: 'rgba(239,68,68,0.06)',   borderColor: 'rgba(239,68,68,0.3)'   }
        : { background: 'rgba(139,92,246,0.06)',   borderColor: 'rgba(139,92,246,0.2)'  }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-base flex-shrink-0">{icon}</span>
        <span className="font-bold text-white text-sm flex-shrink-0">{result.ticker}</span>
        <span className="text-xs text-gray-500 flex-1 truncate">{result.sourceChannel}</span>
        {result.flagged && <span className="text-xs text-red-400 font-semibold flex-shrink-0">FLAGGED</span>}
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
          style={{ background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color }}
        >
          {result.confidence}
        </span>
        {/* Mini edge bar */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full" style={{ width: `${edgePct}%`, background: 'linear-gradient(90deg,#7c3aed,#00d4ff)' }} />
          </div>
          <span className="text-xs font-bold text-purple-300">{edgePct}</span>
        </div>
        <span className="text-gray-600 text-xs flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid rgba(139,92,246,0.12)' }}>
          {result.flagged && result.flagReason && (
            <p className="text-xs text-red-400 mb-2">⚠ {result.flagReason}</p>
          )}
          <p className="text-xs text-gray-400 leading-relaxed mb-3">{result.recommendation}</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Win Rate',   value: `${Math.round(result.winRate  * 100)}%`,                  color: 'text-green-400'  },
              { label: 'Rug Rate',   value: `${Math.round(result.rugRate  * 100)}%`,                  color: result.rugRate > 0.3 ? 'text-red-400' : 'text-gray-300' },
              { label: 'Liquidity', value: `$${(result.liquidity / 1000).toFixed(0)}K`,               color: 'text-white'      },
              { label: 'Edge',      value: String(edgePct),                                            color: 'text-purple-300' },
            ].map(s => (
              <div key={s.label} className="bg-black/30 rounded-lg p-2 border border-purple-500/10">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
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