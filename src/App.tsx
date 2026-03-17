import { useState } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import PortfolioCard from './components/PortfolioCard'
import RoastDisplay from './components/RoastDisplay'
import SignalFeed from './components/dashboard/SignalFeed'
import TradeAnalysis from './components/dashboard/TradeAnalysis'
import AlertFeed from './components/dashboard/AlertFeed'
import DailyReport from './components/dashboard/DailyReport'
import ValueProposition from './components/ValueProposition'
import Roadmap from './components/Roadmap'

function App() {
  const { connected } = useWallet()
  const [showValueProp, setShowValueProp] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)

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

            {/* Center — tier access buttons */}
            <div className="flex items-center gap-3">
              <a
                href="https://agenticbro.app/holder"
                className="px-4 py-2 font-bold text-sm rounded-lg border transition-colors"
                style={{background: 'rgba(139,92,246,0.25)', borderColor: 'rgba(139,92,246,0.6)', color: '#c4b5fd'}}
                onMouseOver={e => (e.currentTarget.style.background='rgba(139,92,246,0.5)')}
                onMouseOut={e => (e.currentTarget.style.background='rgba(139,92,246,0.25)')}
              >
                💰 Holder Tier — 10K AGNTCBRO
              </a>
              <a
                href="https://agenticbro.app/whale"
                className="px-4 py-2 font-bold text-sm rounded-lg border transition-colors"
                style={{background: 'rgba(6,182,212,0.2)', borderColor: 'rgba(6,182,212,0.6)', color: '#67e8f9'}}
                onMouseOver={e => (e.currentTarget.style.background='rgba(6,182,212,0.4)')}
                onMouseOut={e => (e.currentTarget.style.background='rgba(6,182,212,0.2)')}
              >
                🐋 Whale Tier — 100K AGNTCBRO
              </a>
            </div>

            {/* Right — nav + wallet */}
            <div className="flex items-center gap-3">
              <a
                href="/AgenticBro_WhitePaper.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-cyan-600/50 hover:bg-cyan-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                White Paper
              </a>
              <button
                onClick={() => setShowRoadmap(true)}
                className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Roadmap
              </button>
              <button
                onClick={() => setShowValueProp(true)}
                className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Why Agentic Bro?
              </button>
              <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !font-semibold" />
            </div>
          </header>

      <main className="relative z-10 container mx-auto px-6 pb-10">
        {!connected ? (
          <div className="max-w-6xl mx-auto">
            {/* Hero banner image */}
            <div className="rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-900/50 mb-10">
              <img
                src="/hero-banner.png"
                alt="Agentic Bro — tells you where your trading sucks and how to fix it"
                className="w-full object-cover"
              />
            </div>

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
                  { icon: '✅', text: "Direct access to AutonomousAlpha\u2019s AI Trading Playbook" },
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
            <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto mb-6">
              <PortfolioCard />
              <RoastDisplay />
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
          </>
        )}
      </main>
      </>
    )}

      {!showValueProp && !showRoadmap && (
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
    </div>
  )
}

export default App