import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { RefreshCw, TrendingUp, TrendingDown, Zap, AlertTriangle } from 'lucide-react'
import { fetchWalletStats } from '../lib/helius'

interface WalletStats {
  totalTrades: number
  winRate: number
  totalProfit: number
  totalLoss: number
  avgTradeSize: number
  gasSpent: number
  topToken: string
  degenScore: number // 0-100
}

export default function PortfolioCard() {
  const { publicKey, connected } = useWallet()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<WalletStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchWalletStatsData = async () => {
    if (!publicKey) return

    setLoading(true)
    setError(null)

    try {
      const walletStats = await fetchWalletStats(publicKey.toString())
      setStats(walletStats)
    } catch (err) {
      setError('Failed to fetch wallet stats. Try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (connected && publicKey) {
      fetchWalletStatsData()
    }
  }, [connected, publicKey])

  if (!connected) {
    return null
  }

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-purple-500/20 animate-slide-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>📊</span> Portfolio Analysis
        </h2>
        <button
          onClick={fetchWalletStatsData}
          disabled={loading}
          className="p-2 hover:bg-purple-600/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 text-purple-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Analyzing your degen behavior...</p>
          </div>
        </div>
      ) : stats ? (
        <div className="space-y-4">
          {/* Win Rate */}
          <div className="bg-black/30 p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Win Rate</span>
              <span className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.winRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${stats.winRate >= 50 ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${stats.winRate}%` }}
              />
            </div>
          </div>

          {/* PnL */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/30 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-gray-400 text-sm">Total Profit</span>
              </div>
              <p className="text-xl font-bold text-green-400">
                ${stats.totalProfit.toLocaleString()}
              </p>
            </div>
            <div className="bg-black/30 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-gray-400 text-sm">Total Loss</span>
              </div>
              <p className="text-xl font-bold text-red-400">
                ${stats.totalLoss.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/30 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-gray-400 text-sm">Total Trades</span>
              </div>
              <p className="text-xl font-bold text-white">{stats.totalTrades}</p>
            </div>
            <div className="bg-black/30 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-gray-400 text-sm">Gas Spent</span>
              </div>
              <p className="text-xl font-bold text-yellow-400">
                ${stats.gasSpent.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Degen Score */}
          <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 p-4 rounded-xl border border-purple-500/30">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-semibold">Degen Score</span>
              <span className="text-3xl font-bold text-purple-300">{stats.degenScore}</span>
            </div>
            <p className="text-sm text-gray-300">
              {stats.degenScore >= 80 ? "🔥 You're absolutely cooked" :
               stats.degenScore >= 60 ? "⚠️ Moderate degen behavior" :
               "💀 Certified degen"}
            </p>
          </div>

          {/* Top Token */}
          <div className="bg-black/30 p-4 rounded-xl">
            <span className="text-gray-400 text-sm">Most Traded Token</span>
            <p className="text-lg font-bold text-white mt-1">#{stats.topToken}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}