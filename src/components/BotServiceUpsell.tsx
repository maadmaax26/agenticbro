import { Zap } from 'lucide-react'

export default function BotServiceUpsell() {
  return (
    <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 p-6 rounded-xl border border-green-500/30 mt-4 animate-pulse-glow">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-green-400" />
        <h3 className="text-xl font-bold text-white">⚡ Upgrade Your Trading</h3>
      </div>

      <p className="text-gray-300 mb-4">
        Get access to advanced trading features and automated strategies.
      </p>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Holder Tier Signals</span>
          <span className="text-white font-semibold">10K AGNTCBRO</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Whale Tier Bundle</span>
          <span className="text-white font-semibold">100K AGNTCBRO</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Full Access</span>
          <span className="text-white font-semibold">Buy Tokens →</span>
        </div>
      </div>

      <a
        href="https://pump.fun/coin/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors text-center"
      >
        Get AGNTCBRO Tokens
      </a>

      <p className="text-xs text-gray-500 mt-3 text-center">
        Purchase tokens on <a href="https://pump.fun/coin/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump" target="_blank" rel="noopener noreferrer" className="text-[#39ff14] hover:underline">Pump.fun</a>
      </p>
    </div>
  )
}