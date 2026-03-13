import { Zap, ExternalLink } from 'lucide-react'

export default function BotServiceUpsell() {
  return (
    <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 p-6 rounded-xl border border-green-500/30 mt-4 animate-pulse-glow">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-green-400" />
        <h3 className="text-xl font-bold text-white">⚡ Tired of Manual Trading?</h3>
      </div>

      <p className="text-gray-300 mb-4">
        Let agentic bots trade for you. 24/7 automation, no emotions.
      </p>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">RAmmStein Pro (Hyperliquid)</span>
          <span className="text-white font-semibold">$99/mo</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">MES Master (Options)</span>
          <span className="text-white font-semibold">$149/mo</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Complete Bundle</span>
          <span className="text-white font-semibold">$199/mo</span>
        </div>
      </div>

      <a
        href="https://autonomousalpha.io"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors text-center"
      >
        Learn More
      </a>

      <p className="text-xs text-gray-500 mt-3 text-center">
        <ExternalLink className="w-3 h-3 inline mr-1" />
        autonomousalpha.io
      </p>
    </div>
  )
}