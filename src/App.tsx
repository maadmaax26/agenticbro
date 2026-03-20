import { useState, useCallback } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTokenGating } from './hooks/useTokenGating'
import PortfolioCard from './components/PortfolioCard'
import RoastDisplay from './components/RoastDisplay'
import PriorityScan from './components/dashboard/PriorityScan'
import SignalFeed from './components/dashboard/SignalFeed'
import TradeAnalysis from './components/dashboard/TradeAnalysis'
import AlertFeed from './components/dashboard/AlertFeed'
import DailyReport from './components/dashboard/DailyReport'
import GemAdvise from './components/dashboard/GemAdvise'
import ValueProposition from './components/ValueProposition'
import Roadmap from './components/Roadmap'
import HolderDashboard from './components/dashboard/HolderDashboard'
import WhaleDashboard from './components/dashboard/WhaleDashboard'
import MarketSentiment from './components/MarketSentiment'

function App() {
  const { connected } = useWallet()
  const [showValueProp, setShowValueProp] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [showTierPage, setShowTierPage] = useState<'holder' | 'whale' | null>(null)
  const [priorityScansRemaining, setPriorityScansRemaining] = useState(() => {
    const saved = localStorage.getItem('priorityFreeScans');
    return saved ? Math.max(0, parseInt(saved, 10)) : 3;
  });
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<string[]>([]);
  const [showScanResults, setShowScanResults] = useState(false);
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

            {/* Priority Scan Section */}
            <div className="max-w-6xl mx-auto mb-6">
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">🔍</div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Priority Scan</h2>
                      <p className="text-sm text-gray-400">Deep scan your wallet, channels, or tokens</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                         style={{
                           background: priorityScansRemaining > 0
                             ? 'rgba(16,185,129,0.15)'
                             : 'rgba(245,158,11,0.15)',
                           border: priorityScansRemaining > 0
                             ? '1px solid rgba(16,185,129,0.4)'
                             : '1px solid rgba(245,158,11,0.4)',
                           color: priorityScansRemaining > 0 ? '#4ade80' : '#fbbf24',
                         }}>
                      {priorityScansRemaining > 0 ? (
                        <>
                          <span>🎁</span>
                          <span>{priorityScansRemaining} Free Scans</span>
                        </>
                      ) : (
                        <>
                          <span>💎</span>
                          <span>10K AGNTCBRO/Scan</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-black/30 rounded-xl p-6 border border-purple-500/20">
                  <div className="text-center">
                    <div className="text-5xl mb-3">⚡</div>
                    <h3 className="text-lg font-bold text-white mb-2">Run Deep Analysis</h3>
                    <p className="text-gray-400 text-sm mb-4 max-w-md mx-auto">
                      Priority Scan analyzes your wallet, favorite channels, or specific tokens to uncover opportunities and risks.
                    </p>
                    <div className="grid md:grid-cols-3 gap-3 mb-4">
                      <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
                        <p className="text-xs text-gray-400 mb-1">Wallet Scan</p>
                        <p className="text-sm font-bold text-purple-300">Full portfolio analysis</p>
                      </div>
                      <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
                        <p className="text-xs text-gray-400 mb-1">Channel Scan</p>
                        <p className="text-sm font-bold text-purple-300">Alpha quality assessment</p>
                      </div>
                      <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
                        <p className="text-xs text-gray-400 mb-1">Token Scan</p>
                        <p className="text-sm font-bold text-purple-300">Deep token research</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (priorityScansRemaining > 0) {
                          setPriorityScansRemaining(priorityScansRemaining - 1);
                          localStorage.setItem('priorityFreeScans', String(priorityScansRemaining - 1));
                          setIsScanning(true);
                          setShowScanResults(true);
                          setScanResults([]);

                          // Simulate scan results with chat-like messages
                          const mockResults = [
                            "🔍 Initiating Priority Scan...",
                            "📊 Analyzing wallet holdings...",
                            "✅ Found 5 tokens in portfolio",
                            "📈 SOL position: +12.4% this week (strong momentum)",
                            "⚠️ Token #3 showing signs of waning volume - monitor closely",
                            "💎 Top opportunity: Consider rebalancing into BTC for stability",
                            "🎯 Channel analysis: CryptoEdge Pro trending positive (edge score: 0.81)",
                            "📊 Overall portfolio health: 7.2/10",
                            "✅ Scan complete. 3 actionable insights generated."
                          ];

                          for (let i = 0; i < mockResults.length; i++) {
                            await new Promise(resolve => setTimeout(resolve, 800));
                            setScanResults(prev => [...prev, mockResults[i]]);
                          }
                          setIsScanning(false);
                        } else {
                          if (holderTierUnlocked) {
                            setShowTierPage('holder');
                          } else {
                            alert('Scan limit reached. Unlock Holder Tier (10K AGNTCBRO) for unlimited priority scans.');
                          }
                        }
                      }}
                      disabled={isScanning}
                      className="px-6 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                      style={holderTierUnlocked || priorityScansRemaining > 0
                        ? {background: 'rgba(139,92,246,0.2)', borderColor: 'rgba(139,92,246,0.6)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.6)'}
                        : {background: 'rgba(80,80,80,0.2)', borderColor: 'rgba(120,120,120,0.4)', color: '#9ca3af', border: '1px solid rgba(120,120,120,0.4)'}
                      }
                    >
                      {isScanning ? 'Scanning...' : (priorityScansRemaining > 0 ? `Run Priority Scan (${priorityScansRemaining} remaining)` : 'Run Priority Scan (10K AGNTCBRO)')}
                    </button>
                  </div>

                  {/* Scan Results Chat Window */}
                  {showScanResults && (
                    <div className="mt-6 rounded-xl border border-purple-500/30 overflow-hidden">
                      <div className="bg-black/40 px-4 py-3 border-b border-purple-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                          <span className="text-sm font-semibold text-white">Priority Scan Results</span>
                        </div>
                        <button
                          onClick={() => setShowScanResults(false)}
                          className="text-gray-400 hover:text-white text-sm transition-colors"
                        >
                          Close ✕
                        </button>
                      </div>
                      <div className="bg-black/60 p-4 max-h-96 overflow-y-auto">
                        {scanResults.length === 0 ? (
                          <p className="text-gray-500 text-sm text-center py-8">
                            {isScanning ? 'Starting scan...' : 'Click "Run Priority Scan" to begin'}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {scanResults.map((result, index) => (
                              <div
                                key={index}
                                className={`flex items-start gap-3 p-3 rounded-lg ${
                                  result.startsWith('🔍') || result.startsWith('✅')
                                    ? 'bg-purple-900/20 border border-purple-500/20'
                                    : result.startsWith('⚠️')
                                    ? 'bg-red-900/20 border border-red-500/20'
                                    : 'bg-black/40'
                                }`}
                              >
                                <div className="flex-shrink-0 text-lg">
                                  {result.startsWith('🔍') ? '🔍' :
                                   result.startsWith('📊') ? '📊' :
                                   result.startsWith('✅') ? '✅' :
                                   result.startsWith('📈') ? '📈' :
                                   result.startsWith('⚠️') ? '⚠️' :
                                   result.startsWith('💎') ? '💎' :
                                   result.startsWith('🎯') ? '🎯' :
                                   '•'}
                                </div>
                                <p className="text-sm text-gray-200 leading-relaxed">{result.slice(2).trim() || result}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto mb-6">
              <PortfolioCard />
              <RoastDisplay />
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

// ─── Gem Preview Card Component (for free page preview) ────────────────────────────────────────────────────────────

function GemPreviewCard({
  ticker, name, edgeScore, confidence, winRate, rugRate, liquidity, change, maxGain,
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