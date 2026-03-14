import { TrendingUp, TrendingDown, Zap } from 'lucide-react'

interface Signal {
  token: string
  direction: 'long' | 'short'
  confidence: number
  timestamp: string
}

const mockSignals: Signal[] = [
  { token: 'SOL', direction: 'long', confidence: 82, timestamp: '2m ago' },
  { token: 'WIF', direction: 'short', confidence: 67, timestamp: '5m ago' },
  { token: 'BONK', direction: 'long', confidence: 74, timestamp: '11m ago' },
  { token: 'JUP', direction: 'long', confidence: 91, timestamp: '18m ago' },
]

export default function SignalFeed() {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-purple-500/20">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-yellow-400" />
        <h3 className="text-lg font-bold text-white">Live Signals</h3>
        <span className="ml-auto text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">● Live</span>
      </div>
      <div className="space-y-3">
        {mockSignals.map((s, i) => (
          <div key={i} className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2">
              {s.direction === 'long'
                ? <TrendingUp className="w-4 h-4 text-green-400" />
                : <TrendingDown className="w-4 h-4 text-red-400" />}
              <span className="text-white font-semibold text-sm">{s.token}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${s.direction === 'long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {s.direction.toUpperCase()}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs text-purple-300 font-semibold">{s.confidence}%</p>
              <p className="text-xs text-gray-500">{s.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
