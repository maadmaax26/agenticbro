import { BarChart2 } from 'lucide-react'

interface Trade {
  token: string
  pnl: number
  size: string
  time: string
}

const mockTrades: Trade[] = [
  { token: 'POPCAT', pnl: 340, size: '$420', time: '1h ago' },
  { token: 'MYRO', pnl: -180, size: '$200', time: '3h ago' },
  { token: 'WIF', pnl: 890, size: '$1,100', time: '6h ago' },
  { token: 'SLERF', pnl: -55, size: '$150', time: '9h ago' },
]

export default function TradeAnalysis() {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-purple-500/20">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-bold text-white">Trade Analysis</h3>
      </div>
      <div className="space-y-3">
        {mockTrades.map((t, i) => (
          <div key={i} className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-2.5">
            <div>
              <p className="text-white text-sm font-semibold">{t.token}</p>
              <p className="text-gray-500 text-xs">{t.size} · {t.time}</p>
            </div>
            <span className={`text-sm font-bold ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {t.pnl >= 0 ? '+' : ''}${t.pnl}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
