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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      {/* Animated background effect */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-30" />

      {showValueProp ? (
        <ValueProposition onBack={() => setShowValueProp(false)} />
      ) : showRoadmap ? (
        <Roadmap onBack={() => setShowRoadmap(false)} />
      ) : (
        <>
          <header className="relative z-10 p-6 flex justify-between items-center backdrop-blur-sm bg-black/20">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🤖</div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Agentic Bro
                </h1>
                <p className="text-xs text-purple-300 font-mono">
                  Your agentic degen advisor
                </p>
              </div>
            </div>
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

      <main className="relative z-10 container mx-auto p-6">
        {!connected ? (
          <div className="text-center py-20 max-w-lg mx-auto">
            <div className="mb-8">
              <div className="text-8xl mb-4">🤖💸</div>
              <h2 className="text-4xl font-bold text-white mb-4">
                Ready to Get Roasted?
              </h2>
              <p className="text-xl text-gray-300 mb-2">
                Connect your wallet and let Agentic Bro analyze your degen behavior
              </p>
              <p className="text-sm text-gray-500">
                Brutal honesty. Agentic AI. No feelings spared.
              </p>
            </div>

            <div className="grid gap-4 text-left bg-black/30 p-6 rounded-xl backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="font-semibold text-white">Portfolio Analysis</p>
                  <p className="text-sm text-gray-400">We'll analyze your last 7 days of trades</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔥</span>
                <div>
                  <p className="font-semibold text-white">Degen Detection</p>
                  <p className="text-sm text-gray-400">Spot high-risk, low-cap plays</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">💬</span>
                <div>
                  <p className="font-semibold text-white">AI Roasts</p>
                  <p className="text-sm text-gray-400">Generated on the fly, never repeats</p>
                </div>
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
        <footer className="relative z-10 text-center p-4 text-sm text-gray-500">
          <p>Built for degens, by degens • <a href="https://twitter.com/AgenticBro" className="text-purple-400 hover:text-purple-300">@AgenticBro</a></p>
        </footer>
      )}
    </div>
  )
}

export default App